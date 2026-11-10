const assert = require('node:assert/strict');
const { it } = require('node:test');
const cjs = require('../dist/cjs/index.js');

it('CommonJS and ESM share one copy of the code', async () => {
  const esm = await import('../dist/esm/index.mjs');
  assert.equal(esm.CoinsPay, cjs.CoinsPay);
  assert.equal(esm.ApiError, cjs.ApiError);
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).filter((name) => name !== '__esModule').sort());
});

it('the version matches package.json', () => {
  assert.equal(cjs.VERSION, require('../package.json').version);
});
