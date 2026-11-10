import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SignatureVerificationError, verifySignature } from '../dist/esm/index.mjs';
import { ERROR_CLASS, callByRetry, scripted, vectors } from './helpers.mjs';

describe('signatures', () => {
  for (const item of vectors('signatures').cases) {
    it(item.name, () => {
      const run = () => verifySignature(item.body, item.header, item.secrets, { now: item.now, tolerance: item.tolerance });
      if (item.expect === 'ok') {
        run();
      } else {
        assert.throws(run, (error) => error instanceof SignatureVerificationError && error.reason === item.expect);
      }
    });
  }
});

describe('retries', () => {
  for (const item of vectors('retries').cases) {
    it(item.name, async () => {
      const options = item.maxRetries === undefined ? {} : { maxRetries: item.maxRetries };
      const { client, requests, sleeps } = scripted(item.steps, options);
      const outcome = await callByRetry(client, item.retry).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      const { expect } = item;
      assert.equal(requests.length, expect.attempts, 'attempts');

      if (expect.result === 'ok') {
        assert.ifError(outcome.error);
        if (expect.replayed !== undefined) assert.equal(outcome.value.lastResponse.replayed, expect.replayed);
      } else {
        assert.ok(outcome.error, 'an error');
        assert.equal(outcome.error.constructor.name, ERROR_CLASS[expect.error]);
        if (expect.code) assert.equal(outcome.error.code, expect.code);
        if (expect.retryAfter !== undefined) assert.equal(outcome.error.retryAfter, expect.retryAfter);
        if (expect.sent !== undefined) assert.equal(outcome.error.sent, expect.sent);
      }

      if (expect.sleeps) {
        assert.equal(sleeps.length, expect.sleeps.length, 'sleeps');
        expect.sleeps.forEach((want, index) => {
          if (Array.isArray(want)) assert.ok(sleeps[index] >= want[0] && sleeps[index] <= want[1], `sleep ${sleeps[index]}`);
          else assert.equal(sleeps[index], want);
        });
      }
      if (expect.lastRequest) {
        const last = requests.at(-1);
        assert.equal(`${last.method} ${last.path}`, expect.lastRequest);
      }

      const attempts = expect.lastRequest ? requests.slice(0, -1) : requests;
      assert.equal(new Set(attempts.map((request) => request.body ?? '')).size, 1, 'one body');
      assert.equal(new Set(attempts.map((request) => request.headers['idempotency-key'])).size, 1, 'one key');
    });
  }
});

describe('errors', () => {
  for (const item of vectors('errors').cases) {
    it(`${item.status} ${item.body?.error?.code ?? item.expect.error}`, async () => {
      const { client } = scripted([item], { maxRetries: 0 });
      const error = await client.invoices.get('7c9e6679-7425-40de-944b-e07fc1f90ae7').then(
        () => assert.fail('no error'),
        (caught) => caught,
      );
      const { expect } = item;
      assert.equal(error.constructor.name, ERROR_CLASS[expect.error]);
      assert.equal(error.status, item.status);
      if (expect.code !== undefined) assert.equal(error.code, expect.code);
      if (expect.message !== undefined) assert.equal(error.message, expect.message);
      if (expect.details !== undefined) assert.deepEqual(error.details, expect.details);
      if (expect.retryAfter !== undefined) assert.equal(error.retryAfter, expect.retryAfter);
    });
  }
});
