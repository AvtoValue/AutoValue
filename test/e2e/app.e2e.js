'use strict';
// Browser tests for the whole app. Run with `npm run test:e2e` (needs the `playwright` package and Chromium).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
const { createApp } = require('../../server/server.js');

let server, base, browser;

test.before(async () => {
  server = http.createServer(createApp({ providers: [], log: () => {}, rateLimit: { limit: 100000, windowMs: 60000 } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

test.after(async () => {
  await browser.close();
  await new Promise(r => server.close(r));
});

// Opens a fresh page and fails the test on any page error or console error.
async function openPage(t, options = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 390, height: 900 }, locale: 'sl-SI' }, options));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], 'browser errors');
  });
  await page.goto(base);
  return { page, context };
}

const adText = (price, year, km, extra = '') =>
  `Cena: ${price.toLocaleString('de-DE')} €\nPrva registracija: ${year}\nPrevoženi km: ${km.toLocaleString('de-DE')} km\nGorivo: dizel\nMenjalnik: ročni\n${extra}`;

async function enterCar(page, { search = 'skoda octavia', year = '2018', km = '120000', sell = false, price } = {}) {
  await page.click('#next');
  if (sell) await page.click('[data-mode=sell]');
  await page.fill('#quickSearch', search);
  await page.keyboard.press('Enter');
  await page.selectOption('#year', year);
  await page.fill('#mileage', km);
  if (price) await page.fill('#price', price);
  await page.click('#analyse');
}

async function addAds(page, ads) {
  for (let i = 0; i < ads.length; i++) {
    if (!(await page.$('#text' + (i + 1)))) await page.click('#addComp');
    await page.fill('#text' + (i + 1), adText(...ads[i]));
  }
}

const SIX_ADS = [[12900, 2017, 150000], [14200, 2018, 135000], [15400, 2018, 110000], [16900, 2019, 95000], [14600, 2018, 125000], [13900, 2017, 118000]];

test('first visit picks the market from the browser language', async t => {
  const { page } = await openPage(t, { locale: 'de-AT' });
  assert.equal(await page.inputValue('#country'), 'AT');
  assert.equal(await page.inputValue('#lang'), 'de');
  assert.equal(await page.textContent('#next'), 'Weiter →');
});

test('buyer flow: quick search, ad parsing, adjustment, chart and folded rows', async t => {
  const { page } = await openPage(t);
  await enterCar(page);
  assert.equal(await page.textContent('#carSummary'), 'Škoda Octavia');
  await addAds(page, SIX_ADS);
  assert.match(await page.textContent('#info1'), /12\.900\s€ · letnik 2017 · 150\.000 km/);
  await page.click('#comparePrices');
  const result = await page.innerText('#manualResult');
  assert.match(result, /Število upoštevanih oglasov: 6/);
  assert.match(result, /Cene so prilagojene tvojemu avtu/);
  assert.match(result, /Priporočen nakupni razpon/);
  assert.equal(await page.$$eval('#chart circle', c => c.length), 6);
  assert.equal(await page.$$eval('.comp-row.collapsed', r => r.length), 6);
  await page.click('#sum2');
  assert.ok(await page.isVisible('#text2'));
});

test('seller gets a verdict on the asking price', async t => {
  const { page } = await openPage(t);
  await enterCar(page, { sell: true, price: '19500' });
  await addAds(page, SIX_ADS.slice(0, 3));
  await page.click('#comparePrices');
  assert.match(await page.innerText('#manualResult'), /Cena je verjetno previsoka/);
  assert.equal(await page.$$eval('#chart path.ask', p => p.length), 1);
});

test('entries survive a reload, and a new valuation keeps the old one in My garage', async t => {
  const { page } = await openPage(t);
  await enterCar(page);
  await addAds(page, SIX_ADS.slice(0, 3));
  await page.click('#comparePrices');
  await page.waitForTimeout(400);
  await page.reload();
  assert.equal(await page.textContent('#stepLabel'), 'KORAK 3 · POROČILO');
  assert.match(await page.innerText('#manualResult'), /Število upoštevanih oglasov: 3/);

  await page.click('#reset');
  await page.waitForLoadState('load');
  assert.equal(await page.textContent('#stepLabel'), 'KORAK 1 · IZBIRA TRGA');
  assert.deepEqual(await page.$$eval('.garage-item b', b => b.map(x => x.textContent)), ['Škoda Octavia 2018']);
  await page.click('.garage-item .btn');
  await page.waitForLoadState('load');
  assert.equal(await page.textContent('#carSummary'), 'Škoda Octavia');
  assert.match(await page.innerText('#manualResult'), /Število upoštevanih oglasov: 3/);
});

test('a shared link rebuilds the report elsewhere without the VIN', async t => {
  const { page, context } = await openPage(t);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base.slice(0, -1) });
  await enterCar(page, { sell: true, price: '15000' });
  await page.click('#edit');
  await page.fill('#vin', 'WVWZZZ1KZAW000001');
  await page.click('#analyse');
  await addAds(page, SIX_ADS.slice(0, 4));
  await page.click('#comparePrices');
  await page.click('#share');
  const url = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(url, /#r=[A-Za-z0-9_-]+$/);

  const { page: other } = await openPage(t);
  await other.goto(url);
  await other.waitForLoadState('load');
  assert.equal(await other.textContent('#carSummary'), 'Škoda Octavia');
  assert.equal(await other.inputValue('#vin'), '');
  assert.match(await other.innerText('#manualResult'), /Število upoštevanih oglasov: 4/);

  await other.goto(base + '#r=broken');
  assert.match(await other.textContent('#notice'), /poškodovana/);
});

test('the example opens a complete report and is not saved to the garage', async t => {
  const { page } = await openPage(t);
  await page.click('#demo');
  await page.waitForLoadState('load');
  assert.ok(await page.isVisible('#demoBanner'));
  assert.ok(await page.isVisible('#chart svg'));
  assert.ok(await page.isHidden('#saveGarage'));
  await page.click('#reset');
  await page.waitForLoadState('load');
  assert.ok(await page.isHidden('#garage'));
});

test('ads arrive from the extension and from the share menu', async t => {
  const { page } = await openPage(t);
  const ad = { url: 'https://www.example.com/ad/1', title: 'Škoda Octavia', text: adText(14500, 2018, 115000) };
  await page.goto(base + '#ad=' + encodeURIComponent(JSON.stringify(ad)));
  assert.match(await page.textContent('#notice'), /dodan kot #1/);
  assert.equal(await page.inputValue('#comp1'), '14500');
  await page.goto(base + '#ad=' + encodeURIComponent(JSON.stringify(ad)));
  assert.match(await page.textContent('#notice'), /že v tvoji primerjavi/);
  await page.goto(base + '?text=' + encodeURIComponent('Poglej https://www.example.com/ad/2'));
  assert.equal(await page.inputValue('#link2'), 'https://www.example.com/ad/2');
});

test('every language translates the main buttons', async t => {
  const { page } = await openPage(t);
  await page.click('#demo');
  await page.waitForLoadState('load');
  const seen = new Set();
  for (const lang of ['en', 'sl', 'de', 'it', 'hr']) {
    await page.selectOption('#lang', lang);
    const labels = await page.$$eval('#edit, #copy, #share, #print, #comparePrices', b => b.map(x => x.textContent).join('|'));
    assert.ok(!seen.has(labels), lang + ' repeats another language: ' + labels);
    seen.add(labels);
  }
});

test('privacy page shows the chosen language and the contact address', async t => {
  const { page } = await openPage(t);
  await page.goto(base + 'privacy.html?lang=de');
  assert.equal(await page.textContent('article:not(.hidden) h1'), 'Datenschutz und Nutzungsbedingungen');
  assert.match(await page.textContent('article:not(.hidden)'), /val\.golicnik21@gmail\.com/);
});
