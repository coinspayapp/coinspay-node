import { readFileSync } from 'node:fs';
import { CoinsPay } from '../dist/esm/index.mjs';

export const vectors = (name) => JSON.parse(readFileSync(new URL(`./data/vectors/${name}.json`, import.meta.url), 'utf8'));

export const INVOICE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const networkError = (code) => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) });

export function scripted(steps, options = {}) {
  const requests = [];
  const sleeps = [];
  let index = 0;
  const fetch = async (url, init) => {
    const parsed = new URL(url);
    requests.push({ method: init.method, path: parsed.pathname.replace(/^\/api\/v1/, ''), search: parsed.search, headers: init.headers, body: init.body });
    const step = steps[index++];
    if (!step) throw new Error(`Out of steps: request ${index}`);
    if (step.network === 'refused') throw networkError('ECONNREFUSED');
    if (step.network === 'reset') throw networkError('ECONNRESET');
    if (step.network === 'timeout') {
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }
    const text = step.text ?? JSON.stringify(step.body);
    return new Response(text === '' && step.status === 301 ? null : text, { status: step.status, headers: step.headers ?? {} });
  };
  const client = new CoinsPay({
    apiKey: 'cpk_test_secret_key_value',
    baseUrl: 'https://pay.example.com',
    timeout: 50,
    fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...options,
  });
  return { client, requests, sleeps };
}

export function callByRetry(client, retry) {
  switch (retry) {
    case 'safe':
      return client.invoices.get(INVOICE_ID);
    case 'idempotent':
      return client.invoices.create({ currency: 'USD', amount: '49.90' }, { idempotencyKey: 'order-1042' });
    case 'unsafe':
      return client.addresses.create({ chain: 'tron' });
    case 'cancel':
      return client.invoices.cancel(INVOICE_ID);
    default:
      throw new Error(retry);
  }
}

export const ERROR_CLASS = {
  Api: 'ApiError',
  InvalidRequest: 'InvalidRequestError',
  Authentication: 'AuthenticationError',
  PermissionDenied: 'PermissionDeniedError',
  NotFound: 'NotFoundError',
  Conflict: 'ConflictError',
  Unprocessable: 'UnprocessableError',
  RateLimit: 'RateLimitError',
  ServiceUnavailable: 'ServiceUnavailableError',
  ApiConnection: 'ApiConnectionError',
  ApiTimeout: 'ApiTimeoutError',
  InvalidResponse: 'InvalidResponseError',
};
