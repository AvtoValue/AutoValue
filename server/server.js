'use strict';
// Small dependency-free server: serves public/ and a JSON API for licensed listing providers.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { marketSites } = require('../public/js/data.js');
const { version } = require('../package.json');

const COUNTRIES = Object.keys(marketSites);
const MAX_BODY = 16 * 1024;
const PROVIDER_TIMEOUT_MS = 10000;
const MAX_LISTINGS = 50;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.zip': 'application/zip',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers));
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        // Stop buffering but drain the rest so the 413 response can still be delivered.
        req.removeAllListeners('data');
        req.resume();
        reject(Object.assign(new Error('body too large'), { status: 413 }));
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const str = (v, max) => typeof v === 'string' && v.trim().length <= max ? v.trim() : undefined;
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max ? v : undefined;

// Returns a clean query or null when required fields are missing or malformed.
function validateQuery(body) {
  if (!body || typeof body !== 'object') return null;
  const q = {
    country: COUNTRIES.includes(body.country) ? body.country : undefined,
    make: str(body.make, 60),
    model: str(body.model, 60),
    year: int(body.year, 1950, new Date().getFullYear() + 1),
    mileage: int(body.mileage, 0, 2000000),
    fuel: str(body.fuel, 30),
    transmission: str(body.transmission, 30),
  };
  return q.country && q.make && q.model ? q : null;
}

const num = v => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const httpsUrl = v => typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 2048 ? v : undefined;

// Keeps only known fields so a provider cannot push arbitrary data to the browser.
function cleanListing(l, source) {
  const out = { source, url: httpsUrl(l.url), title: str(l.title, 200), price: num(l.price), year: num(l.year), km: num(l.km), kw: num(l.kw), hp: num(l.hp), fuel: str(l.fuel, 30), transmission: str(l.transmission, 30) };
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}

function withTimeout(promise, ms, ctrl) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => { ctrl.abort(); reject(new Error('provider timeout')); }, ms); }),
  ]).finally(() => clearTimeout(timer));
}

function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return ip => {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.start > windowMs) { hits.set(ip, { start: now, count: 1 }); return true; }
    entry.count++;
    if (hits.size > 10000) hits.clear();
    return entry.count <= limit;
  };
}

function serveStatic(publicDir, pathname, res, method) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.includes('\0')) return send(res, 400, 'Bad request');
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(publicDir, '.' + rel);
  if (!file.startsWith(publicDir + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found', { 'Content-Type': TYPES['.txt'] });
    res.writeHead(200, Object.assign({}, SECURITY_HEADERS, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' }));
    if (method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

function createApp(options = {}) {
  const publicDir = path.resolve(options.publicDir || path.join(__dirname, '..', 'public'));
  const providers = options.providers || require('./providers');
  const env = options.env || process.env;
  const allow = rateLimiter(options.rateLimit || { limit: 60, windowMs: 60000 });
  const log = options.log || (msg => console.error(msg));

  const providerInfo = (country) => providers
    .filter(p => !country || p.countries.includes(country))
    .map(p => ({ id: p.id, name: p.name, countries: p.countries, configured: Boolean(p.isConfigured(env)) }));

  async function search(req, res) {
    let body;
    try { body = await readJson(req); } catch (e) {
      if (e.status === 413) res.setHeader('Connection', 'close');
      return sendJson(res, e.status || 400, { error: e.message });
    }
    const query = validateQuery(body);
    if (!query) return sendJson(res, 400, { error: 'invalid_query', required: ['country', 'make', 'model'] });
    const active = providers.filter(p => p.countries.includes(query.country) && p.isConfigured(env));
    if (!active.length) return sendJson(res, 503, { error: 'no_provider_configured', country: query.country });
    const results = await Promise.allSettled(active.map(p => {
      const ctrl = new AbortController();
      return withTimeout(Promise.resolve(p.search(query, env, { signal: ctrl.signal })), PROVIDER_TIMEOUT_MS, ctrl)
        .then(list => (Array.isArray(list) ? list : []).map(l => cleanListing(l || {}, p.name)));
    }));
    const listings = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') listings.push(...r.value);
      else { failed.push(active[i].id); log(`provider ${active[i].id} failed: ${r.reason && r.reason.message}`); }
    });
    if (failed.length === active.length) return sendJson(res, 502, { error: 'providers_failed' });
    sendJson(res, 200, { country: query.country, listings: listings.filter(l => l.price > 0).slice(0, MAX_LISTINGS), failed });
  }

  return function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p.startsWith('/api/')) {
      if (!allow(req.socket.remoteAddress || '')) return sendJson(res, 429, { error: 'rate_limited' });
      if (p === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true, version });
      if (p === '/api/sources' && req.method === 'GET') {
        const country = url.searchParams.get('country') || undefined;
        if (country && !COUNTRIES.includes(country)) return sendJson(res, 400, { error: 'unknown_country' });
        return sendJson(res, 200, { country: country || null, providers: providerInfo(country) });
      }
      if (p === '/api/listings/search') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
        return search(req, res).catch(e => { log(e.stack || String(e)); sendJson(res, 500, { error: 'internal_error' }); });
      }
      return sendJson(res, 404, { error: 'not_found' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    serveStatic(publicDir, p, res, req.method);
  };
}

module.exports = { createApp, validateQuery, cleanListing };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '127.0.0.1';
  http.createServer(createApp()).listen(port, host, () => console.log(`AutoValue running at http://${host}:${port}/`));
}
