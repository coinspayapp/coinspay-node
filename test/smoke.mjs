import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CoinsPay, SignatureVerificationError, verifySignature } from '../dist/esm/index.mjs';
import { startMockServer } from '../scripts/mock-server.mjs';
import { ERROR_CLASS, callByRetry, scripted, vectors } from './helpers.mjs';

let checks = 0;

const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
assert.equal(cjs.CoinsPay, CoinsPay);
checks++;

for (const item of vectors('signatures').cases) {
  try {
    verifySignature(item.body, item.header, item.secrets, { now: item.now, tolerance: item.tolerance });
    assert.equal(item.expect, 'ok', item.name);
  } catch (error) {
    if (!(error instanceof SignatureVerificationError)) throw error;
    assert.equal(error.reason, item.expect, item.name);
  }
  checks++;
}

for (const item of vectors('retries').cases) {
  const { client, requests } = scripted(item.steps, item.maxRetries === undefined ? {} : { maxRetries: item.maxRetries });
  const error = await callByRetry(client, item.retry).then(
    () => null,
    (caught) => caught,
  );
  assert.equal(requests.length, item.expect.attempts, item.name);
  assert.equal(error?.constructor.name ?? null, item.expect.error ? ERROR_CLASS[item.expect.error] : null, item.name);
  checks++;
}

const mock = await startMockServer();
try {
  const client = new CoinsPay({ apiKey: 'cpk_test_wire', baseUrl: `${mock.url}/echo/api/v1` });
  const invoice = await client.invoices.create({ currency: 'USD', amount: '1' }, { idempotencyKey: 'order-77' });
  assert.equal(invoice.headers['idempotency-key'], 'order-77');
  assert.equal(invoice.lastResponse.status, 201);
  checks++;
} finally {
  mock.server.close();
}

console.log(`smoke ${process.version}: ${checks} checks passed`);
