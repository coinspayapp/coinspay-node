import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CoinsPay, signatureHeader, verifySignature } from '../dist/esm/index.mjs';
import { INVOICE_ID, scripted } from './helpers.mjs';

const ok = { status: 200, body: { invoice: { id: INVOICE_ID } } };

describe('review findings', () => {
  it("a caller's idempotency-key header replaces ours instead of joining it", async () => {
    const { client, requests } = scripted([ok]);
    await client.invoices.create({ currency: 'USD', amount: '1' }, { idempotencyKey: 'order-1042', headers: { 'Idempotency-Key': 'other-key-1' } });
    assert.equal(requests[0].headers['idempotency-key'], 'order-1042');
    assert.equal(Object.keys(requests[0].headers).filter((name) => name.toLowerCase() === 'idempotency-key').length, 1);
  });

  it('a bad header fails before sending, not as a connection error', async () => {
    const { client, requests } = scripted([ok, ok, ok]);
    await assert.rejects(client.invoices.get(INVOICE_ID, { headers: { 'X-Note': 'a\r\nInjected: 1' } }), TypeError);
    await assert.rejects(client.invoices.get(INVOICE_ID, { headers: { 'Bad Name': 'x' } }), TypeError);
    assert.equal(requests.length, 0);
  });

  it('a NaN or negative tolerance does not turn the age check off', () => {
    const header = signatureHeader('{}', 's', 0);
    for (const tolerance of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      assert.throws(() => verifySignature('{}', header, 's', { tolerance, now: 1_000_000_000 }), TypeError);
    }
  });

  it('a key passed as the base URL by mistake is not repeated in the error', () => {
    assert.throws(
      () => new CoinsPay({ apiKey: 'https://pay.example.com', baseUrl: 'cpk_live_secret_value' }),
      (error) => error instanceof TypeError && !error.message.includes('cpk_live_secret_value'),
    );
  });
});
