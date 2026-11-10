export { CoinsPay, type ClientOptions, type RawRequestOptions } from './client';
export {
  ApiConnectionError,
  ApiError,
  ApiTimeoutError,
  AuthenticationError,
  CoinsPayError,
  ConflictError,
  InvalidRequestError,
  InvalidResponseError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  ServiceUnavailableError,
  SignatureVerificationError,
  UnprocessableError,
  type ApiErrorInit,
  type SignatureFailure,
} from './errors';
export { newIdempotencyKey, type FetchLike, type RequestOptions, type ResponseInfo } from './http';
export type { IdempotentOptions, Page, PayoutParams, WithResponse } from './resources';
export {
  DEFAULT_TOLERANCE,
  DELIVERY_HEADER,
  EVENT_HEADER,
  SIGNATURE_HEADER,
  constructEvent,
  signatureHeader,
  verifySignature,
  type VerifyOptions,
} from './webhooks';
export { ERROR_CODES, type ErrorCode } from './generated/operations';
export * from './generated/models';
export { VERSION } from './version';
