import { inspect } from 'node:util';
import { HttpClient, checkIdempotencyKey, normalizeBaseUrl, sleep, type FetchLike, type RequestOptions } from './http';
import { OPERATIONS, type OperationId } from './generated/operations';
import {
  Addresses,
  Balances,
  Chains,
  Currencies,
  Deposits,
  Invoices,
  Payouts,
  ShopResource,
  type CallInput,
  type Caller,
  type WithResponse,
} from './resources';

export interface ClientOptions {
  /** API key of the shop: `cpk_…`, or `cpk_test_…` for test mode. Keep it on your server. */
  apiKey: string;
  /** The dashboard origin (`https://pay.example.com`) or the API address ending in `/api/v1`. */
  baseUrl: string;
  /** Timeout of one attempt in milliseconds; 30 000 by default. */
  timeout?: number;
  /** Retries after failures that are safe to retry; 2 by default, 0 turns them off. */
  maxRetries?: number;
  /** The longest pause before a retry in milliseconds; a longer `Retry-After` fails at once. 5000 by default. */
  maxRetryDelay?: number;
  /** Allows plain http to hosts other than localhost, for a test stand. */
  allowInsecureHttp?: boolean;
  /** Your own `fetch`, for example one that goes through a proxy. */
  fetch?: FetchLike;
  /** Headers sent with every request. */
  headers?: Record<string, string>;
  /** @internal Pause between retries; tests replace it. */
  sleep?: (ms: number, signal: AbortSignal | undefined) => Promise<void>;
}

export interface RawRequestOptions extends RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  /** Makes a POST safe to retry; without it a POST is retried only when it surely did not reach the API. */
  idempotencyKey?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client of the CoinsPay API.
 *
 * ```ts
 * const coinspay = new CoinsPay({ apiKey: process.env.COINSPAY_KEY!, baseUrl: 'https://pay.example.com' });
 * const invoice = await coinspay.invoices.create({ currency: 'USD', amount: '49.90', reference: 'order-1042' });
 * ```
 */
export class CoinsPay implements Caller {
  readonly invoices: Invoices;
  readonly addresses: Addresses;
  readonly deposits: Deposits;
  readonly balances: Balances;
  readonly payouts: Payouts;
  readonly shop: ShopResource;
  readonly chains: Chains;
  readonly currencies: Currencies;

  /** The API address requests go to, ending in `/api/v1`. */
  readonly baseUrl: string;
  /** `true` for a test key (`cpk_test_…`): invoices only, paid without money. */
  readonly testMode: boolean;

  readonly #http: HttpClient;

  constructor(options: ClientOptions) {
    if (!options || typeof options.apiKey !== 'string' || options.apiKey.trim() === '') {
      throw new TypeError('apiKey is required');
    }
    const apiKey = options.apiKey.trim();
    if (/[\s\0-\x1f\x7f]/.test(apiKey)) throw new TypeError('apiKey contains spaces or control characters');
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new TypeError('No fetch: pass options.fetch');

    this.baseUrl = normalizeBaseUrl(options.baseUrl, options.allowInsecureHttp ?? false);
    this.testMode = apiKey.startsWith('cpk_test_');
    this.#http = new HttpClient({
      apiKey,
      baseUrl: this.baseUrl,
      timeout: positive(options.timeout, 30_000, 'timeout'),
      maxRetries: count(options.maxRetries, 2, 'maxRetries'),
      maxRetryDelay: count(options.maxRetryDelay, 5_000, 'maxRetryDelay'),
      fetch: (input, init) => fetchImpl(input, init),
      headers: { ...options.headers },
      sleep: options.sleep ?? sleep,
    });

    this.invoices = new Invoices(this);
    this.addresses = new Addresses(this);
    this.deposits = new Deposits(this);
    this.balances = new Balances(this);
    this.payouts = new Payouts(this);
    this.shop = new ShopResource(this);
    this.chains = new Chains(this);
    this.currencies = new Currencies(this);
  }

  /**
   * Any API request, for methods this version of the library does not know
   * yet. `path` is relative to `/api/v1`, for example `/invoices`. Returns the
   * parsed JSON body as is.
   */
  async request<T = unknown>(method: 'GET' | 'POST', path: string, options: RawRequestOptions = {}): Promise<WithResponse<T>> {
    if (method !== 'GET' && method !== 'POST') throw new TypeError('method must be GET or POST');
    if (!/^\/[\w\-./]*$/.test(path) || path.split('/').some((segment) => segment === '..' || segment === '.')) {
      throw new TypeError(`Bad API path: ${path}`);
    }
    const { query, body, idempotencyKey, ...rest } = options;
    const key = idempotencyKey === undefined ? undefined : checkIdempotencyKey(idempotencyKey);
    const { body: result, info } = await this.#http.send({
      method,
      path,
      query,
      body,
      retry: method === 'GET' ? 'safe' : key ? 'idempotent' : 'unsafe',
      idempotencyKey: key,
      options: rest,
    });
    return attach(result as T, info);
  }

  /** @internal */
  async call<T>(id: OperationId, input: CallInput): Promise<WithResponse<T>> {
    const spec = OPERATIONS[id];
    let path: string = spec.path;
    if (path.includes('{id}')) {
      if (typeof input.id !== 'string' || !UUID.test(input.id)) throw new TypeError(`id must be a UUID, got ${JSON.stringify(input.id)}`);
      path = path.replace('{id}', input.id.toLowerCase());
    }
    if (input.body !== undefined) rejectNumbers(input.body, spec.decimals);

    const { body, info } = await this.#http.send({
      method: spec.method,
      path,
      query: input.query as Record<string, unknown> | undefined,
      body: input.body,
      retry: spec.retry,
      idempotencyKey: input.idempotencyKey,
      options: input.options,
    });

    const data = body as Record<string, unknown>;
    let result: unknown = data;
    if (spec.unwrap) result = data[spec.unwrap];
    else if (spec.page) result = { data: data[spec.page], next_cursor: data['next_cursor'] ?? null };
    if (result === undefined || result === null || typeof result !== 'object') {
      throw new TypeError(`Unexpected answer of ${id}: no "${spec.unwrap ?? spec.page}"`);
    }
    return attach(result as T, info);
  }

  [inspect.custom](): string {
    return `CoinsPay { baseUrl: ${JSON.stringify(this.baseUrl)}, testMode: ${this.testMode} }`;
  }

  toJSON(): Record<string, unknown> {
    return { baseUrl: this.baseUrl, testMode: this.testMode };
  }
}

function attach<T>(value: T, info: unknown): WithResponse<T> {
  Object.defineProperty(value, 'lastResponse', { value: info, enumerable: false });
  return value as WithResponse<T>;
}

/** Amounts go as decimal strings: a JS number like 1e-7 or 0.1 + 0.2 would not be what you meant. */
function rejectNumbers(body: object, paths: readonly string[]): void {
  for (const path of paths) visitDecimal(body, path.split('.'), []);
}

function visitDecimal(value: unknown, segments: string[], where: string[]): void {
  if (value === undefined || value === null) return;
  const [segment, ...rest] = segments;
  if (segment === undefined) {
    if (typeof value === 'number' || typeof value === 'bigint') {
      throw new TypeError(`${where.join('.')} must be a decimal string such as "49.90", not a number`);
    }
    return;
  }
  if (typeof value !== 'object') return;
  const many = segment.endsWith('[]');
  const name = many ? segment.slice(0, -2) : segment;
  const next = (value as Record<string, unknown>)[name];
  if (!many) {
    visitDecimal(next, rest, [...where, name]);
  } else if (Array.isArray(next)) {
    next.forEach((item, index) => visitDecimal(item, rest, [...where, `${name}[${index}]`]));
  }
}

function positive(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive number`);
  return value;
}

function count(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}
