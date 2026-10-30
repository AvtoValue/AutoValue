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

// Clicks a control that reloads the page (new valuation, garage, example) and waits for the new page.
async function clickAndReload(page, selector) {
  await Promise.all([page.waitForEvent('load'), page.click(selector)]);
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

test('on a phone, tapping a suggestion fills make and model; engine size is compared', async t => {
  const { devices } = require('playwright');
  const { page } = await openPage(t, { ...devices['iPhone 13'], locale: 'sl-SI' });
  await page.tap('#next');
  await page.tap('#quickSearch');
  await page.keyboard.type('honda civic');
  assert.deepEqual(await page.$$eval('#quickSearchList li', l => l.map(x => x.textContent)), ['Honda Civic', 'Honda Civic Type R', 'Honda Civic Tourer']);
  await page.tap('#quickSearchList li:nth-child(2)');
  assert.equal(await page.inputValue('#model'), 'Civic Type R');
  assert.match(await page.textContent('#quickSearchChosen'), /Izbrano: Honda Civic Type R/);

  await page.selectOption('#model', 'Civic');
  await page.selectOption('#fuel', 'Petrol');
  assert.equal(await page.textContent('#engine option[value="1400"]'), '1400 cm³');
  await page.selectOption('#engine', '1400');
  await page.selectOption('#fuel', 'Electric');
  assert.ok(await page.isHidden('#engineField'));
  await page.selectOption('#fuel', 'Petrol');
  await page.selectOption('#engine', '1400');
  await page.selectOption('#year', '2006');
  await page.fill('#mileage', '180000');
  await page.tap('#analyse');
  assert.match(await page.textContent('#metaSummary'), /1400 cm³/);
  await page.fill('#text1', 'Honda Civic 1.8 i-VTEC\nCena: 5.900 €\nLetnik: 2006\nPrevoženi km: 175.000\nGorivo: bencin');
  assert.match(await page.textContent('#info1'), /1800 cm³ .*⚠ druga prostornina motorja/);
  await page.fill('#text2', 'Honda Civic\nProstornina motorja: 1.398 ccm\nCena: 4.900 €\nLetnik: 2006\nPrevoženi km: 190.000\nGorivo: bencin');
  assert.match(await page.textContent('#info2'), /1398 cm³/);
  assert.doesNotMatch(await page.textContent('#info2'), /⚠/);
  assert.doesNotMatch(await page.getAttribute('#searchLinks a', 'href'), /1400|1%2C4|1\.4/);
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

  await clickAndReload(page, '#reset');
  assert.equal(await page.textContent('#stepLabel'), 'KORAK 1 · IZBIRA TRGA');
  assert.deepEqual(await page.$$eval('.garage-item b', b => b.map(x => x.textContent)), ['Škoda Octavia 2018']);
  await clickAndReload(page, '.garage-item .btn');
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
  await page.waitForFunction(() => /kopirana/.test(document.getElementById('notice').textContent));
  const url = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(url, /#r=[A-Za-z0-9_-]+$/);

  const { page: other } = await openPage(t);
  await other.goto(url);
  // Opening the link reloads the page into the shared report.
  await other.waitForFunction(() => document.getElementById('carSummary').textContent === 'Škoda Octavia');
  assert.equal(await other.inputValue('#vin'), '');
  assert.match(await other.innerText('#manualResult'), /Število upoštevanih oglasov: 4/);

  await other.goto(base + '#r=broken');
  await other.waitForFunction(() => /poškodovana/.test(document.getElementById('notice').textContent));
});

test('a shared link with damaged ad data still opens the report', async t => {
  const { page } = await openPage(t);
  const { encodeState } = require('../../public/js/core.js');
  const payload = { v: 1, fields: { make: 'BMW', model: 'M3', year: '2019', mileage: '50000' },
    rows: [{ price: '30000', meta: '{broken' }, { price: '31000', meta: JSON.stringify({ km: null, year: 'x' }) }, { link: 'javascript:alert(1)', price: '32000', meta: JSON.stringify({ km: 40000 }) }] };
  await page.goto(base + '#r=' + encodeState(payload));
  await page.waitForFunction(() => document.getElementById('carSummary').textContent === 'BMW M3');
  assert.match(await page.innerText('#manualResult'), /3/);
  assert.equal(await page.inputValue('#link3'), '');
});

test('the example opens a complete report and is not saved to the garage', async t => {
  const { page } = await openPage(t);
  await clickAndReload(page, '#demo');
  assert.ok(await page.isVisible('#demoBanner'));
  assert.ok(await page.isVisible('#chart svg'));
  assert.ok(await page.isHidden('#saveGarage'));
  await clickAndReload(page, '#reset');
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
  await clickAndReload(page, '#demo');
  const seen = new Set();
  for (const lang of ['en', 'sl', 'de', 'it', 'hr']) {
    await page.selectOption('#lang', lang);
    const labels = await page.$$eval('#edit, #copy, #share, #print, #comparePrices', b => b.map(x => x.textContent).join('|'));
    assert.ok(!seen.has(labels), lang + ' repeats another language: ' + labels);
    assert.ok(!/Early prototype|Know the value/.test((await page.textContent('.footer')) + (await page.title())) || lang === 'en', lang + ' footer or title is English');
    seen.add(labels);
  }
});

test('privacy page shows the chosen language and the contact address', async t => {
  const { page } = await openPage(t);
  await page.goto(base + 'privacy.html?lang=de');
  assert.equal(await page.textContent('article:not(.hidden) h1'), 'Datenschutz und Nutzungsbedingungen');
  assert.match(await page.textContent('article:not(.hidden)'), /val\.golicnik21@gmail\.com/);
});
