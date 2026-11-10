# CoinsPay for Node.js

Official library for the [CoinsPay](https://coinspay.app) crypto payments API: invoices
with a payment page, receiving addresses, payments, payouts to your wallets and webhooks.
TypeScript types included, no dependencies, Node.js 18 or newer, ESM and CommonJS.
The API reference is at [coinspay.app/docs](https://coinspay.app/docs).

```bash
npm install coinspay
```

## Quick start

Create an API key in the dashboard: shop → "API keys". A key with "Invoices only" access is
enough for a website; addresses, payments, balances and payouts need full access. Keep the
key on your server.

```ts
import { CoinsPay } from 'coinspay';

const coinspay = new CoinsPay({
  apiKey: process.env.COINSPAY_KEY!,
  baseUrl: 'https://coinspay.app', // or the full https://coinspay.app/api/v1
});

const invoice = await coinspay.invoices.create(
  { currency: 'USD', amount: '49.90', reference: 'order-1042', return_url: 'https://shop.example/orders/1042' },
  { idempotencyKey: 'order-1042' },
);
// send the buyer to invoice.pay_url
```

Amounts are decimal strings (`'49.90'`), never numbers: a JavaScript number such as
`0.1 + 0.2` or `1e-7` is not what you meant, so the library refuses it.

## Webhooks

Verify the signature over the body exactly as received, before `JSON.parse`:

```ts
import express from 'express';
import { constructEvent, SignatureVerificationError } from 'coinspay';

app.post('/coinspay/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = constructEvent(req.body, req.headers['x-cpay-signature'], process.env.COINSPAY_WEBHOOK_SECRET!);
  } catch (error) {
    if (error instanceof SignatureVerificationError) return res.status(401).end();
    throw error;
  }
  res.status(200).end(); // answer at once, work afterwards

  if (event.test) return; // a dashboard test or a test invoice
  switch (event.type) {
    case 'invoice.paid':
      markOrderPaid(event.data.invoice.reference, event.data.invoice.id);
      break;
    case 'payment.confirmed':
      console.log(event.data.deposit.tx_hash);
      break;
  }
});
```

- A type a newer API adds still arrives: keep a `default` branch and answer 2xx. Status
  types such as `InvoiceStatus` are open for new values too.
- One event may arrive twice: drop duplicates by `event.id` (the `x-cpay-delivery` header).
- Rely on the state in the body, not on the arrival order.
- While you replace the secret, pass both: `constructEvent(body, header, [newSecret, oldSecret])`.
- `signatureHeader(body, secret)` signs a body for tests of your handler.

## Lists

```ts
const page = await coinspay.invoices.list({ status: 'paid', limit: 100 }); // page.data, page.next_cursor
for await (const invoice of coinspay.invoices.iterate({ status: 'paid' })) {
  // every paid invoice, page after page
}
```

## Errors

```ts
import { ApiConnectionError, ApiError, PermissionDeniedError, RateLimitError } from 'coinspay';

try {
  await coinspay.balances.list();
} catch (error) {
  if (error instanceof PermissionDeniedError && error.code === 'KEY_ACCESS_DENIED') {
    // an "Invoices only" key
  } else if (error instanceof RateLimitError) {
    console.log(error.retryAfter);
  } else if (error instanceof ApiConnectionError && !error.sent) {
    // never reached the API: safe to try again
  } else if (error instanceof ApiError) {
    console.log(error.status, error.code, error.details);
  }
}
```

| Class | When |
|---|---|
| `InvalidRequestError` 400, `AuthenticationError` 401, `PermissionDeniedError` 403, `NotFoundError` 404, `ConflictError` 409, `UnprocessableError` 422, `RateLimitError` 429, `ServiceUnavailableError` 503 | the API answered with an error; all extend `ApiError` |
| `ApiConnectionError` | no answer; `sent: false` means the request never left |
| `ApiTimeoutError` | no answer within the timeout; the request may have been processed |
| `InvalidResponseError` | the answer was not JSON, for example a proxy error page |
| `SignatureVerificationError` | the webhook signature does not hold; see `reason` |

Branch on `code`; `ERROR_CODES` lists them by status.

## Retries and idempotency

Failures that are safe to retry are retried twice with a short pause: network errors and
timeouts, 429, 502, 503 and 504 for reads, quotes, cancellations and creates with an
idempotency key. `addresses.create` has no idempotency key and is retried only when the
request surely did not reach the API.

`invoices.create` without `idempotencyKey` gets a random key for its own retries; pass your
order number to make your own retries safe too. `payouts.create` requires a key: take it
from your payout record, so the money never goes twice. A repeat with a used key returns
the existing object in its current state, and `result.lastResponse.replayed` is `true`.

## Test mode

A test key (`cpk_test_…`) creates test invoices that are paid on the payment page without
money; `coinspay.testMode` tells which key you have. Addresses, payments, balances and
payouts are not available in test mode.

## Client behaviour

- The API address must use `https`. Plain `http` is accepted for `localhost` and `127.0.0.1`, or with `allowInsecureHttp: true` for a test stand.
- Each attempt times out after 30 seconds, and connecting after 10.
- Redirects are not followed, so the key is never sent to another host.
- IDs in the path are checked as UUIDs before the request is sent.
- The key never shows up in errors or `util.inspect` output.
- The transport can be replaced with the `fetch` option, for example to go through a proxy.

## Options

```ts
new CoinsPay({
  apiKey, baseUrl,
  timeout: 30_000,        // ms per attempt
  maxRetries: 2,
  maxRetryDelay: 5_000,   // a longer Retry-After fails at once
  fetch: myFetch,         // e.g. through a proxy
  headers: { 'X-Request-Source': 'shop' },
});
await coinspay.invoices.get(id, { timeout: 5_000, maxRetries: 0, signal });
await coinspay.request('GET', '/something/new'); // a method this version does not know yet
```

## Development

```bash
npm install
npm test            # builds dist/, then runs the tests
npm run typecheck
```

Files that start with "Generated from the CoinsPay OpenAPI document" and the data in `test/data` come from our generator and are shared by the libraries for Node.js, PHP, Python and Go. Please do not edit them by hand: if a model or a test vector looks wrong, open an issue.

## License

MIT
