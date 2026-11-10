import { randomUUID } from 'node:crypto';
import {
  ApiConnectionError,
  ApiError,
  ApiTimeoutError,
  CoinsPayError,
  ConflictError,
  InvalidResponseError,
  RateLimitError,
} from './errors';
import type { RetryClass } from './generated/operations';
import { VERSION } from './version';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Options that apply to a single request. */
export interface RequestOptions {
  /** Timeout of one attempt in milliseconds. */
  timeout?: number;
  /** How many times to retry after a failure that is safe to retry. */
  maxRetries?: number;
  /** Extra HTTP headers. */
  headers?: Record<string, string>;
  /** Aborts the request; an aborted request is not retried. */
  signal?: AbortSignal;
}

/** What the API answered, besides the body. */
export interface ResponseInfo {
  readonly status: number;
  readonly headers: Headers;
  /**
   * `true` when a create request repeated an earlier one with the same
   * idempotency key: the API returned the existing object (status 200) in its
   * current state instead of creating a new one (201).
   */
  readonly replayed: boolean;
}

export interface HttpConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  maxRetryDelay: number;
  fetch: FetchLike;
  headers: Record<string, string>;
  sleep: (ms: number, signal: AbortSignal | undefined) => Promise<void>;
}

export interface Call {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, unknown> | undefined;
  body?: unknown;
  retry: RetryClass;
  idempotencyKey?: string | undefined;
  options?: RequestOptions | undefined;
}

const TIMEOUT = Symbol('timeout');

/** Connection errors that mean the request never left this machine. */
const NOT_SENT = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EADDRNOTAVAIL',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/** TLS failures: retrying does not help. */
const TLS_FAILURE = /^(CERT_|ERR_TLS_|ERR_SSL_|UNABLE_TO_|DEPTH_ZERO_|SELF_SIGNED_)/;

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,128}$/;

/** A header name as HTTP allows it. */
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export class HttpClient {
  constructor(private readonly config: HttpConfig) {}

  async send(call: Call): Promise<{ body: unknown; info: ResponseInfo }> {
    const options = call.options ?? {};
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const timeout = options.timeout ?? this.config.timeout;
    const url = this.url(call.path, call.query);
    // The same bytes on every attempt: the idempotency key is bound to the body.
    const payload = call.method === 'POST' ? JSON.stringify(call.body ?? {}) : undefined;
    const headers = this.headers(call, payload !== undefined, options.headers);

    for (let attempt = 0; ; attempt++) {
      let failure: CoinsPayError;
      try {
        const { status, headers: responseHeaders, text } = await this.attempt(url, call.method, headers, payload, timeout, options.signal);
        const body = parse(status, text);
        if (status >= 200 && status < 300) {
          return { body, info: { status, headers: responseHeaders, replayed: call.idempotencyKey !== undefined && status === 200 } };
        }
        failure = toError(status, body, responseHeaders);
      } catch (error) {
        if (!(error instanceof CoinsPayError)) throw error;
        failure = error;
      }

      // A retried cancel that finds the invoice cancelled: the first attempt went through.
      if (
        call.retry === 'cancel' &&
        attempt > 0 &&
        failure instanceof ConflictError &&
        failure.code === 'INVOICE_NOT_OPEN' &&
        failure.details?.['status'] === 'cancelled'
      ) {
        return this.send({ method: 'GET', path: call.path.replace(/\/cancel$/, ''), retry: 'safe', options });
      }

      const delay = attempt < maxRetries ? this.retryDelay(failure, call.retry, attempt) : null;
      if (delay === null) throw failure;
      await this.config.sleep(delay, options.signal);
    }
  }

  private async attempt(
    url: string,
    method: string,
    headers: Record<string, string>,
    payload: string | undefined,
    timeout: number,
    signal: AbortSignal | undefined,
  ): Promise<{ status: number; headers: Headers; text: string }> {
    signal?.throwIfAborted();
    // AbortSignal.any() appeared only in Node 18.17, so the two signals are joined by hand.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(TIMEOUT), timeout);
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const init: RequestInit = { method, headers, redirect: 'manual', signal: controller.signal };
      if (payload !== undefined) init.body = payload;
      const response = await this.config.fetch(url, init);
      const text = await response.text();
      return { status: response.status, headers: response.headers, text };
    } catch (error) {
      if (controller.signal.reason === TIMEOUT) {
        throw new ApiTimeoutError(`No answer from the CoinsPay API within ${timeout} ms`, { cause: error });
      }
      if (signal?.aborted) throw signal.reason;
      throw connectionError(error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /** Pause before the next attempt, or `null` when this failure must not be retried. */
  private retryDelay(failure: CoinsPayError, retry: RetryClass, attempt: number): number | null {
    let retryable = false;
    let hinted: number | null = null;
    const status = failure instanceof ApiError || failure instanceof InvalidResponseError ? failure.status : null;

    if (status === 429) {
      // Rate limits act before the request is handled: any request may repeat.
      retryable = true;
      hinted = failure instanceof RateLimitError ? failure.retryAfter : null;
    } else if (status === 503) {
      retryable = true;
    } else if (status === 502 || status === 504) {
      retryable = retry !== 'unsafe';
    } else if (failure instanceof ApiConnectionError) {
      const code = errorCode(failure.cause);
      retryable = !(code && TLS_FAILURE.test(code)) && (!failure.sent || retry !== 'unsafe');
    }
    if (!retryable) return null;

    const backoff = 500 * 2 ** attempt * (0.75 + Math.random() * 0.5);
    const delay = hinted !== null ? hinted * 1000 : backoff;
    return delay > this.config.maxRetryDelay ? null : delay;
  }

  private url(path: string, query: Record<string, unknown> | undefined): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      search.append(key, String(value));
    }
    const suffix = search.toString();
    return `${this.config.baseUrl}${path}${suffix ? `?${suffix}` : ''}`;
  }

  private headers(call: Call, hasBody: boolean, extra: Record<string, string> | undefined): Record<string, string> {
    // Lowercase names: a caller's "idempotency-key" must replace ours, not join it.
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries({ ...this.config.headers, ...extra })) {
      if (!HEADER_NAME.test(name) || typeof value !== 'string' || /[\r\n\0]/.test(value)) {
        throw new TypeError(`Bad header ${JSON.stringify(name)}`);
      }
      headers[name.toLowerCase()] = value;
    }
    headers['accept'] = 'application/json';
    headers['user-agent'] = `coinspay-node/${VERSION} node/${process.version}`;
    headers['authorization'] = `Bearer ${this.config.apiKey}`;
    if (hasBody) headers['content-type'] = 'application/json';
    if (call.idempotencyKey !== undefined) headers['idempotency-key'] = call.idempotencyKey;
    return headers;
  }
}

/** A random idempotency key, for when there is no natural one such as an order or payout number. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

export function checkIdempotencyKey(key: string): string {
  if (typeof key !== 'string' || !IDEMPOTENCY_KEY.test(key)) {
    throw new TypeError('idempotencyKey must be 8 to 128 printable ASCII characters without spaces');
  }
  return key;
}

const ORIGIN_ONLY = /^\/*$/;

/**
 * The API address from what the merchant passes: the dashboard origin
 * (`https://pay.example.com`) or the full address ending in `/api/v1`.
 */
export function normalizeBaseUrl(value: string, allowInsecureHttp: boolean): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('baseUrl is required');
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    // Without the value: an API key passed here by mistake must not reach the logs.
    throw new TypeError('baseUrl is not a URL');
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new TypeError('baseUrl must not contain a query, a fragment or credentials');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (local || allowInsecureHttp))) {
    throw new TypeError('baseUrl must use https (http is allowed for localhost or with allowInsecureHttp)');
  }
  let path = url.pathname;
  if (ORIGIN_ONLY.test(path)) path = '/api/v1';
  path = path.replace(/\/+$/, '');
  if (!path.endsWith('/api/v1')) throw new TypeError('baseUrl must be the dashboard origin or end with /api/v1');
  return `${url.origin}${path}`;
}

function parse(status: number, text: string): unknown {
  if (status >= 300 && status < 400) {
    throw new InvalidResponseError(`The CoinsPay API answered with a redirect (${status}); redirects are not followed`, status);
  }
  if (text === '') {
    if (status >= 200 && status < 300) throw new InvalidResponseError(`Empty answer with status ${status}`, status);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidResponseError(`The answer with status ${status} is not JSON`, status);
  }
}

function toError(status: number, body: unknown, headers: Headers): CoinsPayError {
  const error = (body as { error?: unknown } | null)?.error as { code?: unknown; message?: unknown; details?: unknown } | undefined;
  if (!error || typeof error.code !== 'string') {
    return new InvalidResponseError(`HTTP ${status} without an API error body`, status);
  }
  return ApiError.from({
    status,
    code: error.code,
    message: typeof error.message === 'string' ? error.message : error.code,
    details: error.details && typeof error.details === 'object' ? (error.details as Record<string, unknown>) : null,
    headers,
  });
}

function connectionError(error: unknown): ApiConnectionError {
  const code = errorCode(error);
  const sent = !(code && NOT_SENT.has(code));
  const detail = code ? ` (${code})` : '';
  return new ApiConnectionError(`Could not reach the CoinsPay API${detail}`, { sent, cause: error });
}

/** `code` of a Node network error; fetch puts it on `cause`. */
function errorCode(error: unknown): string | null {
  for (let current = error, depth = 0; current && typeof current === 'object' && depth < 4; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
