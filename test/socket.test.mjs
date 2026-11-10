import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { ApiConnectionError, ApiTimeoutError, CoinsPay, InvalidResponseError } from '../dist/esm/index.mjs';
import { startMockServer } from '../scripts/mock-server.mjs';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
let mock;

before(async () => {
  mock = await startMockServer();
});
after(() => mock.server.close());

const client = (mode, options = {}) => new CoinsPay({ apiKey: 'cpk_test_wire', baseUrl: `${mock.url}/${mode}/api/v1`, maxRetries: 0, ...options });

async function closedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

describe('over a real socket', () => {
  it('sends what the API expects', async () => {
    const invoice = await client('echo').invoices.create({ currency: 'USD', amount: '1.50', title: 'Заказ ✓' }, { idempotencyKey: 'order-77' });
    const { headers, body, path, method } = invoice;
    assert.equal(method, 'POST');
    assert.equal(path, '/api/v1/invoices');
    assert.equal(headers['authorization'], 'Bearer cpk_test_wire');
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['idempotency-key'], 'order-77');
    assert.match(headers['user-agent'], /^coinspay-node\//);
    assert.equal(Number(headers['content-length']), Buffer.byteLength(body));
    assert.deepEqual(JSON.parse(body), { currency: 'USD', amount: '1.50', title: 'Заказ ✓' });
    assert.equal(invoice.lastResponse.status, 201);
  });

  it('gives up after the timeout', async () => {
    const started = Date.now();
    await assert.rejects(client('slow', { timeout: 300 }).invoices.get(ID), ApiTimeoutError);
    assert.ok(Date.now() - started < 2000);
  });

  it('tells a refused connection from a sent request', async () => {
    const port = await closedPort();
    const refused = new CoinsPay({ apiKey: 'cpk_x', baseUrl: `http://127.0.0.1:${port}`, maxRetries: 0 });
    const error = await refused.invoices.get(ID).catch((caught) => caught);
    assert.ok(error instanceof ApiConnectionError);
    assert.equal(error.sent, false);
  });

  it('does not follow a redirect with the key', async () => {
    const error = await client('redirect').invoices.get(ID).catch((caught) => caught);
    assert.ok(error instanceof InvalidResponseError);
    assert.equal(error.status, 302);
    const hits = await (await fetch(`${mock.url}/hits`)).json();
    assert.equal(hits.target, 0);
  });

  it('reports an HTML page as an invalid answer', async () => {
    const error = await client('html502').invoices.get(ID).catch((caught) => caught);
    assert.ok(error instanceof InvalidResponseError);
    assert.equal(error.status, 502);
  });
});
