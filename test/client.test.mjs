import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import {
  ApiError,
  CoinsPay,
  ERROR_CODES,
  VERSION,
  constructEvent,
  newIdempotencyKey,
  signatureHeader,
} from '../dist/esm/index.mjs';
import { INVOICE_ID, scripted, vectors } from './helpers.mjs';

const ok = (body, status = 200) => ({ status, body });

describe('client options', () => {
  const make = (baseUrl, extra = {}) => new CoinsPay({ apiKey: 'cpk_x', baseUrl, ...extra }).baseUrl;

  it('takes the dashboard origin or the address ending in /api/v1', () => {
    assert.equal(make('https://pay.example.com'), 'https://pay.example.com/api/v1');
    assert.equal(make('https://pay.example.com/'), 'https://pay.example.com/api/v1');
    assert.equal(make('https://pay.example.com/api/v1/'), 'https://pay.example.com/api/v1');
    assert.equal(make('https://example.com/coinspay/api/v1'), 'https://example.com/coinspay/api/v1');
    assert.equal(make(' https://pay.example.com:8443 '), 'https://pay.example.com:8443/api/v1');
  });

  it('rejects other addresses', () => {
    for (const url of ['', 'pay.example.com', 'https://pay.example.com/api', 'https://pay.example.com/api/v2', 'https://pay.example.com/?x=1', 'https://u:p@pay.example.com', 'ftp://pay.example.com']) {
      assert.throws(() => make(url), TypeError, url);
    }
  });

  it('allows plain http only for localhost or with allowInsecureHttp', () => {
    assert.equal(make('http://localhost:3400'), 'http://localhost:3400/api/v1');
    assert.equal(make('http://127.0.0.1:3400/api/v1'), 'http://127.0.0.1:3400/api/v1');
    assert.throws(() => make('http://host.docker.internal:3400'), TypeError);
    assert.equal(make('http://host.docker.internal:3400', { allowInsecureHttp: true }), 'http://host.docker.internal:3400/api/v1');
  });

  it('needs a key without spaces and knows a test key', () => {
    assert.throws(() => new CoinsPay({ apiKey: '', baseUrl: 'https://x.example' }), TypeError);
    assert.throws(() => new CoinsPay({ apiKey: 'cpk_a\nb', baseUrl: 'https://x.example' }), TypeError);
    assert.equal(new CoinsPay({ apiKey: 'cpk_test_abc', baseUrl: 'https://x.example' }).testMode, true);
    assert.equal(new CoinsPay({ apiKey: 'cpk_live', baseUrl: 'https://x.example' }).testMode, false);
  });

  it('never shows the key', () => {
    const client = new CoinsPay({ apiKey: 'cpk_super_secret', baseUrl: 'https://x.example' });
    assert.doesNotMatch(inspect(client, { showHidden: true, depth: 5 }), /super_secret/);
    assert.doesNotMatch(JSON.stringify(client), /super_secret/);
    assert.doesNotMatch(Object.keys(client).join(','), /apiKey/);
  });

  it('rejects bad numbers', () => {
    assert.throws(() => new CoinsPay({ apiKey: 'cpk_x', baseUrl: 'https://x.example', timeout: 0 }), TypeError);
    assert.throws(() => new CoinsPay({ apiKey: 'cpk_x', baseUrl: 'https://x.example', maxRetries: -1 }), TypeError);
  });
});

describe('requests', () => {
  it('sends the key, the version and JSON', async () => {
    const { client, requests } = scripted([ok({ invoice: { id: INVOICE_ID } }, 201)]);
    const invoice = await client.invoices.create({ currency: 'USD', amount: '49.90', reference: 'order-1042' });
    const [request] = requests;
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/invoices');
    assert.equal(request.headers['authorization'], 'Bearer cpk_test_secret_key_value');
    assert.equal(request.headers['content-type'], 'application/json');
    assert.equal(request.headers['accept'], 'application/json');
    assert.match(request.headers['user-agent'], new RegExp(`^coinspay-node/${VERSION.replace(/\./g, '\\.')} node/v\\d+`));
    assert.deepEqual(JSON.parse(request.body), { currency: 'USD', amount: '49.90', reference: 'order-1042' });
    assert.equal(invoice.id, INVOICE_ID);
    assert.equal(invoice.lastResponse.status, 201);
    assert.equal(invoice.lastResponse.replayed, false);
    assert.deepEqual(Object.keys(invoice), ['id'], 'lastResponse is not enumerable');
  });

  it('makes an idempotency key for an invoice when there is none', async () => {
    const { client, requests } = scripted([ok({ invoice: { id: INVOICE_ID } }, 201), ok({ invoice: { id: INVOICE_ID } }, 201)]);
    await client.invoices.create({ currency: 'USD', amount: '1' });
    await client.invoices.create({ currency: 'USD', amount: '1' }, { idempotencyKey: 'order-1042' });
    assert.match(requests[0].headers['idempotency-key'], /^[0-9a-f-]{36}$/);
    assert.equal(requests[1].headers['idempotency-key'], 'order-1042');
  });

  it('demands an idempotency key for a payout and checks its format', async () => {
    const { client } = scripted([]);
    const params = { address_id: INVOICE_ID, asset: 'USDT', recipients: [{ address: 'T1', percent: '100' }] };
    await assert.rejects(client.payouts.create(params), TypeError);
    await assert.rejects(client.payouts.create(params, {}), TypeError);
    await assert.rejects(client.payouts.create(params, { idempotencyKey: 'short' }), TypeError);
    await assert.rejects(client.payouts.create(params, { idempotencyKey: 'has space inside' }), TypeError);
    assert.match(newIdempotencyKey(), /^[0-9a-f-]{36}$/);
  });

  it('cancels with an empty JSON body', async () => {
    const { client, requests } = scripted([ok({ invoice: { id: INVOICE_ID, status: 'cancelled' } })]);
    await client.invoices.cancel(INVOICE_ID.toUpperCase());
    assert.equal(requests[0].path, `/invoices/${INVOICE_ID}/cancel`);
    assert.equal(requests[0].body, '{}');
  });

  it('checks ids before sending', async () => {
    const { client, requests } = scripted([]);
    for (const id of ['..', '../payouts', '', 'not-a-uuid', `${INVOICE_ID}/cancel`, undefined]) {
      await assert.rejects(client.invoices.get(id), TypeError);
    }
    assert.equal(requests.length, 0);
  });

  it('refuses numbers as amounts', async () => {
    const { client, requests } = scripted([]);
    await assert.rejects(client.invoices.create({ currency: 'USD', amount: 49.9 }), /amount must be a decimal string/);
    await assert.rejects(client.invoices.create({ currency: 'USD', items: [{ name: 'A', quantity: '1', price: 1e-7 }] }), /items\[0\]\.price/);
    await assert.rejects(client.addresses.create({ chain: 'tron', payout: [{ address: 'T1', percent: 100 }] }), /payout\[0\]\.percent/);
    assert.equal(requests.length, 0);
  });

  it('builds the query without empty values', async () => {
    const { client, requests } = scripted([ok({ invoices: [], next_cursor: null })]);
    await client.invoices.list({ status: 'paid', reference: 'order 1&2', cursor: undefined, limit: 10 });
    assert.equal(requests[0].search, '?status=paid&reference=order+1%262&limit=10');
  });

  it('walks all pages', async () => {
    const { client, requests } = scripted([
      ok({ invoices: [{ id: 'a' }, { id: 'b' }], next_cursor: 'b0000000-0000-4000-8000-000000000000' }),
      ok({ invoices: [{ id: 'c' }], next_cursor: null }),
    ]);
    const ids = [];
    for await (const invoice of client.invoices.iterate({ status: 'paid', limit: 2 })) ids.push(invoice.id);
    assert.deepEqual(ids, ['a', 'b', 'c']);
    assert.equal(requests[1].search, '?status=paid&limit=2&cursor=b0000000-0000-4000-8000-000000000000');
  });

  it('returns a page and whole answers', async () => {
    const { client } = scripted([
      ok({ deposits: [{ id: 'd' }], next_cursor: null }),
      ok({ balances: [{ chain: 'tron', asset: 'USDT' }] }),
      ok({ shop: { id: 's' }, key: { test: true, access: 'invoices' } }),
    ]);
    assert.deepEqual(await client.deposits.list(), { data: [{ id: 'd' }], next_cursor: null });
    const balances = await client.balances.list();
    assert.equal(balances[0].asset, 'USDT');
    assert.equal(balances.lastResponse.status, 200);
    const shop = await client.shop.get();
    assert.equal(shop.key.access, 'invoices');
  });

  it('sends any request through request()', async () => {
    const { client, requests } = scripted([ok({ anything: true })]);
    const result = await client.request('GET', '/something/new', { query: { a: 1 } });
    assert.deepEqual(result, { anything: true });
    assert.equal(requests[0].search, '?a=1');
    await assert.rejects(client.request('GET', '../admin'), TypeError);
    await assert.rejects(client.request('GET', '/a/../b'), TypeError);
    await assert.rejects(client.request('DELETE', '/x'), TypeError);
  });

  it('keeps the key out of errors', async () => {
    const { client } = scripted([{ status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } } }]);
    const error = await client.shop.get().catch((caught) => caught);
    assert.ok(error instanceof ApiError);
    assert.doesNotMatch(inspect(error, { depth: 5, showHidden: true }), /secret_key_value/);
  });

  it('stops at once when the caller aborts', async () => {
    const controller = new AbortController();
    const { client, requests } = scripted([{ network: 'timeout' }, ok({ invoice: {} })], { timeout: 10_000 });
    const pending = client.invoices.get(INVOICE_ID, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error('stop')), 20);
    await assert.rejects(pending, /stop/);
    assert.equal(requests.length, 1);
  });

  it('lists error codes by status', () => {
    assert.ok(ERROR_CODES[403].includes('KEY_ACCESS_DENIED'));
  });
});

describe('webhooks', () => {
  const { signHeader } = vectors('signatures');

  it('signs like the server', () => {
    assert.equal(signatureHeader(signHeader.body, signHeader.secret, signHeader.timestamp), signHeader.header);
    assert.equal(signatureHeader(Buffer.from(signHeader.body), signHeader.secret, signHeader.timestamp), signHeader.header);
  });

  it('returns the event after the check', () => {
    const event = constructEvent(Buffer.from(signHeader.body), signHeader.header, signHeader.secret, { now: signHeader.timestamp });
    assert.equal(event.type, 'invoice.paid');
    if (event.type === 'invoice.paid') assert.equal(event.data.invoice.status, 'paid');
  });

  it('accepts a header given as an array, as some frameworks pass it', () => {
    const event = constructEvent(signHeader.body, [signHeader.header], signHeader.secret, { now: signHeader.timestamp });
    assert.equal(event.id, '0b0e1c1e-6f0c-4c56-9a8e-2d6c1e1f0a01');
  });

  it('wants a secret', () => {
    assert.throws(() => constructEvent(signHeader.body, signHeader.header, '', { now: signHeader.timestamp }), TypeError);
    assert.throws(() => constructEvent(signHeader.body, signHeader.header, [], { now: signHeader.timestamp }), TypeError);
  });

  it('rejects a signed body that is not an event', () => {
    const body = '[1,2,3]';
    assert.throws(() => constructEvent(body, signatureHeader(body, 's', 100), 's', { now: 100 }), /not a CoinsPay event/);
  });
});
