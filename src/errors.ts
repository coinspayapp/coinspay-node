import type { ErrorCode } from './generated/operations';

/** Base class of every error thrown by this library. */
export class CoinsPayError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
  headers?: Headers | null;
}

/**
 * The API answered with an error: HTTP status 4xx or 5xx and a body
 * `{ error: { code, message, details } }`. Branch on `code`: `message` is an
 * English explanation and may change.
 */
export class ApiError extends CoinsPayError {
  readonly status: number;
  readonly code: ErrorCode | (string & {});
  readonly details: Record<string, unknown> | null;
  readonly headers: Headers | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.headers = init.headers ?? null;
  }

  /** Builds the subclass that matches the HTTP status. */
  static from(init: ApiErrorInit): ApiError {
    switch (init.status) {
      case 400:
        return new InvalidRequestError(init);
      case 401:
        return new AuthenticationError(init);
      case 403:
        return new PermissionDeniedError(init);
      case 404:
        return new NotFoundError(init);
      case 409:
        return new ConflictError(init);
      case 422:
        return new UnprocessableError(init);
      case 429:
        return new RateLimitError(init);
      case 503:
        return new ServiceUnavailableError(init);
      default:
        return new ApiError(init);
    }
  }
}

/** 400: the request is invalid; `details` maps field paths to reasons for `VALIDATION_ERROR`. */
export class InvalidRequestError extends ApiError {}

/** 401: the API key is missing, wrong or revoked. */
export class AuthenticationError extends ApiError {}

/**
 * 403: the key may not do this: `KEY_ACCESS_DENIED` (an invoices-only key),
 * `TEST_MODE_UNSUPPORTED` (a test key), `IP_NOT_ALLOWED` (see `details.ip`),
 * `SHOP_DISABLED`.
 */
export class PermissionDeniedError extends ApiError {}

/** 404: no such object in this shop. */
export class NotFoundError extends ApiError {}

/** 409: `IDEMPOTENCY_CONFLICT` or `INVOICE_NOT_OPEN` (see `details.status`). */
export class ConflictError extends ApiError {}

/** 422: the payout cannot be made: `INSUFFICIENT_BALANCE`, `FUNDS_NOT_MATURE`, `BELOW_MINIMUM` and others. */
export class UnprocessableError extends ApiError {}

/** 429: too many requests. */
export class RateLimitError extends ApiError {
  /** Seconds to wait before retrying, if the API said so. */
  readonly retryAfter: number | null;

  constructor(init: ApiErrorInit) {
    super(init);
    this.retryAfter = retryAfterSeconds(init.headers ?? null, init.details ?? null);
  }
}

/** 503: the service is temporarily unavailable; retry later. */
export class ServiceUnavailableError extends ApiError {}

/**
 * The request did not get an answer. With `sent: false` it never reached the
 * API (connection refused, DNS failure), so it is safe to retry any request.
 * With `sent: true` it may have been processed.
 */
export class ApiConnectionError extends CoinsPayError {
  readonly sent: boolean;

  constructor(message: string, options: { sent: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.sent = options.sent;
  }
}

/** No answer within the timeout; the request may have been processed. */
export class ApiTimeoutError extends ApiConnectionError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, { sent: true, cause: options?.cause });
  }
}

/** The answer was not the JSON the API sends, for example an HTML error page of a proxy. */
export class InvalidResponseError extends CoinsPayError {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type SignatureFailure = 'missing' | 'malformed' | 'stale' | 'mismatch';

/** The webhook signature is missing, malformed, too old or does not match. */
export class SignatureVerificationError extends CoinsPayError {
  readonly reason: SignatureFailure;

  constructor(reason: SignatureFailure) {
    super(SIGNATURE_MESSAGES[reason]);
    this.reason = reason;
  }
}

const SIGNATURE_MESSAGES: Record<SignatureFailure, string> = {
  missing: 'No x-cpay-signature header',
  malformed: 'The x-cpay-signature header is malformed',
  stale: 'The webhook signature is too old or from the future',
  mismatch: 'The webhook signature does not match the body and secret',
};

/** Seconds from `Retry-After` or `details.retry_after`. */
export function retryAfterSeconds(headers: Headers | null, details: Record<string, unknown> | null): number | null {
  const header = headers?.get('retry-after');
  if (header && /^\d+$/.test(header.trim())) return Number(header.trim());
  const value = details?.['retry_after'];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
