'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server/server.js');

async function start(options) {
  const server = http.createServer(createApp(Object.assign({ log: () => {} }, options)));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise(r => server.close(r)) };
}

const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const validQuery = { country: 'SI', make: 'Volkswagen', model: 'Golf', year: 2018, mileage: 120000, fuel: 'Diesel', transmission: 'Manual' };

const fakeProvider = (overrides) => Object.assign({
  id: 'fake', name: 'Fake Listings', countries: ['SI'],
  isConfigured: env => env.FAKE_KEY === 'secret',
  search: async () => [
    { url: 'https://example.com/ad/1', price: 12000, year: 2018, km: 110000, title: 'Golf', extra: 'dropped' },
    { url: 'javascript:alert(1)', price: 11000 },
    { url: 'https://example.com/ad/3' },
  ],
}, overrides);

test('serves the app and static assets with security headers', async () => {
  const app = await start({ providers: [] });
  try {
    const res = await fetch(app.base + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(await res.text(), /AutoValue/);
    const js = await fetch(app.base + '/js/core.js');
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(app.base + '/missing.js')).status, 404);
  } finally { await app.close(); }
});

test('blocks path traversal', async () => {
  const app = await start({ providers: [] });
  try {
    for (const p of ['/%2e%2e/package.json', '/..%2fpackage.json', '/js/%2e%2e/%2e%2e/server/server.js']) {
      const res = await fetch(app.base + p);
      assert.ok([403, 404].includes(res.status), p + ' -> ' + res.status);
    }
  } finally { await app.close(); }
});

test('health and sources endpoints', async () => {
  const app = await start({ providers: [fakeProvider()], env: {} });
  try {
    const health = await (await fetch(app.base + '/api/health')).json();
    assert.equal(health.ok, true);
    const sources = await (await fetch(app.base + '/api/sources?country=SI')).json();
    assert.deepEqual(sources.providers, [{ id: 'fake', name: 'Fake Listings', countries: ['SI'], configured: false }]);
    assert.deepEqual((await (await fetch(app.base + '/api/sources?country=DE')).json()).providers, []);
    assert.equal((await fetch(app.base + '/api/sources?country=XX')).status, 400);
    assert.equal((await fetch(app.base + '/api/nope')).status, 404);
  } finally { await app.close(); }
});

test('search returns 503 when no provider is configured for the market', async () => {
  const app = await start({ providers: [fakeProvider()], env: {} });
  try {
    const res = await postJson(app.base + '/api/listings/search', validQuery);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'no_provider_configured');
  } finally { await app.close(); }
});

test('search validates input and method', async () => {
  const app = await start({ providers: [], env: {} });
  try {
    assert.equal((await fetch(app.base + '/api/listings/search')).status, 405);
    assert.equal((await postJson(app.base + '/api/listings/search', '{bad json')).status, 400);
    assert.equal((await postJson(app.base + '/api/listings/search', { country: 'XX', make: 'A', model: 'B' })).status, 400);
    assert.equal((await postJson(app.base + '/api/listings/search', { country: 'SI', make: 'x'.repeat(61), model: 'B' })).status, 400);
    assert.equal((await postJson(app.base + '/api/listings/search', { blob: 'x'.repeat(20000) })).status, 413);
  } finally { await app.close(); }
});

test('search returns cleaned listings from a configured provider', async () => {
  let seen;
  const app = await start({ providers: [fakeProvider({ search: async q => { seen = q; return fakeProvider().search(); } })], env: { FAKE_KEY: 'secret' } });
  try {
    const res = await postJson(app.base + '/api/listings/search', validQuery);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.listings, [
      { source: 'Fake Listings', url: 'https://example.com/ad/1', title: 'Golf', price: 12000, year: 2018, km: 110000 },
      { source: 'Fake Listings', price: 11000 },
    ]);
    assert.deepEqual(seen, validQuery);
  } finally { await app.close(); }
});

test('search reports 502 when every provider fails', async () => {
  const app = await start({ providers: [fakeProvider({ search: async () => { throw new Error('down'); } })], env: { FAKE_KEY: 'secret' } });
  try {
    const res = await postJson(app.base + '/api/listings/search', validQuery);
    assert.equal(res.status, 502);
  } finally { await app.close(); }
});

test('rate limits the API', async () => {
  const app = await start({ providers: [], rateLimit: { limit: 2, windowMs: 60000 } });
  try {
    assert.equal((await fetch(app.base + '/api/health')).status, 200);
    assert.equal((await fetch(app.base + '/api/health')).status, 200);
    assert.equal((await fetch(app.base + '/api/health')).status, 429);
  } finally { await app.close(); }
});
