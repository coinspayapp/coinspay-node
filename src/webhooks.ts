import { createHmac, timingSafeEqual } from 'node:crypto';
import { CoinsPayError, SignatureVerificationError } from './errors';
import type { WebhookEvent } from './generated/models';

/** Header with the webhook signature: `t=<unix>,v1=<hex>`. */
export const SIGNATURE_HEADER = 'x-cpay-signature';
/** Header with the event type. */
export const EVENT_HEADER = 'x-cpay-event';
/** Header with the event id; a repeated delivery carries the same id. */
export const DELIVERY_HEADER = 'x-cpay-delivery';
/** Allowed clock difference in seconds, in both directions. */
export const DEFAULT_TOLERANCE = 300;

export interface VerifyOptions {
  /** Allowed clock difference in seconds; 300 by default. */
  tolerance?: number;
  /** Current time in unix seconds, for tests. */
  now?: number;
}

type Payload = string | Uint8Array;

/**
 * Checks the `x-cpay-signature` header of a webhook and throws
 * `SignatureVerificationError` if it does not hold.
 *
 * `payload` is the request body exactly as received, before any JSON parsing:
 * the signature covers the bytes, and re-serialized JSON does not reproduce
 * them. `secret` may be a list: the old secret stops working at once when you
 * replace it in the dashboard, so pass both while you roll the new one out.
 */
export function verifySignature(
  payload: Payload,
  header: string | string[] | null | undefined,
  secret: string | readonly string[],
  options: VerifyOptions = {},
): void {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  // NaN or a negative tolerance would turn the age check off.
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new TypeError('tolerance must be a non-negative number of seconds');
  const value = Array.isArray(header) ? header.join(',') : header;
  if (!value) throw new SignatureVerificationError('missing');

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const piece of value.split(',')) {
    const eq = piece.indexOf('=');
    if (eq <= 0) throw new SignatureVerificationError('malformed');
    const key = piece.slice(0, eq).trim();
    const part = piece.slice(eq + 1).trim();
    if (key === 't') timestamp = part;
    else if (key === 'v1') signatures.push(part);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0 || !signatures.every((sig) => /^[0-9a-f]{64}$/.test(sig))) {
    throw new SignatureVerificationError('malformed');
  }

  const t = Number(timestamp);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance) throw new SignatureVerificationError('stale');

  const secrets = typeof secret === 'string' ? [secret] : [...secret];
  if (secrets.length === 0 || secrets.some((item) => typeof item !== 'string' || item === '')) {
    throw new TypeError('The webhook secret is empty');
  }
  const body = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  for (const key of secrets) {
    const expected = mac(key, t, body);
    for (const presented of signatures) {
      if (timingSafeEqual(Buffer.from(presented, 'hex'), expected)) return;
    }
  }
  throw new SignatureVerificationError('mismatch');
}

/**
 * Verifies the signature and returns the parsed event. Narrow it by `type`;
 * an unknown future type is returned as is, so ignore types you do not handle.
 */
export function constructEvent(
  payload: Payload,
  header: string | string[] | null | undefined,
  secret: string | readonly string[],
  options?: VerifyOptions,
): WebhookEvent {
  verifySignature(payload, header, secret, options);
  const text = typeof payload === 'string' ? payload : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString('utf8');
  let event: unknown;
  try {
    event = JSON.parse(text);
  } catch {
    throw new CoinsPayError('The webhook body is not JSON');
  }
  if (!event || typeof event !== 'object' || typeof (event as { type?: unknown }).type !== 'string') {
    throw new CoinsPayError('The webhook body is not a CoinsPay event');
  }
  return event as WebhookEvent;
}

/** A valid `x-cpay-signature` value, for testing your webhook handler. */
export function signatureHeader(payload: Payload, secret: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
  const body = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  return `t=${timestamp},v1=${mac(secret, timestamp, body).toString('hex')}`;
}

function mac(secret: string, timestamp: number, body: Buffer): Buffer {
  return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest();
}
