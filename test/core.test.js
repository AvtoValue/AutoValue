'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../public/js/core.js');

test('parseNumber handles European and English number formats', () => {
  const cases = { '12.990': 12990, '12,990': 12990, '12 990': 12990, '12.990,00': 12990, '12,990.50': 12990.5, '12.990,-': 12990, "12'990": 12990, '1.5': 1.5, '12,99': 12.99, '': NaN, 'abc': NaN };
  for (const [input, expected] of Object.entries(cases)) assert.deepEqual(core.parseNumber(input), expected, input);
});

test('extractAd reads a Slovenian avto.net style ad and skips the monthly instalment', () => {
  const d = core.extractAd(`Volkswagen Golf 1.6 TDI Comfortline
Financiranje že od 189 €/mesec
Cena: 12.990 €
Prva registracija: 2017
Prevoženi km: 148.000 km
Gorivo: dizel motor
Moč motorja: 85 kW (116 KM)
Menjalnik: ročni menjalnik (5 pr.)
Električni pomik stekel`);
  assert.deepEqual(d, { price: 12990, year: 2017, km: 148000, kw: 85, hp: 116, fuel: 'Diesel', transmission: 'Manual', cc: 1600 });
});

test('extractAd reads an English AutoScout24 style ad', () => {
  const d = core.extractAd('€ 15,490\nMileage 98,500 km\nFirst registration 03/2018\nPower 110 kW (150 hp)\nGearbox Automatic\nFuel type Gasoline\nCO2 120 g/km');
  assert.deepEqual(d, { price: 15490, year: 2018, km: 98500, kw: 110, hp: 150, fuel: 'Petrol', transmission: 'Automatic' });
});

test('extractAd reads a German mobile.de style ad and ignores "mtl." financing', () => {
  const d = core.extractAd('Finanzierung 249 € mtl.\nPreis 18.900 € Brutto\nKilometerstand 75.000 km\nErstzulassung 06/2019\nLeistung 140 kW (190 PS)\nKraftstoffart Diesel\nGetriebe Automatik');
  assert.deepEqual(d, { price: 18900, year: 2019, km: 75000, kw: 140, hp: 190, fuel: 'Diesel', transmission: 'Automatic' });
});

test('extractAd prefers the sale price over the regular price', () => {
  assert.equal(core.extractAd('Redna cena 21.500 EUR Akcijska cena 19.990 EUR').price, 19990);
});

test('extractAd ignores electric range and does not treat electric windows as fuel', () => {
  const ev = core.extractAd('Tesla Model 3\nCena 29.900 €\nLetnik 2021\nDoseg 560 km\nPrevoženih km: 62.000\nGorivo: električni pogon');
  assert.equal(ev.km, 62000);
  assert.equal(ev.fuel, 'Electric');
  assert.equal(core.extractAd('Cena 9.000 €, električni pomik stekel').fuel, undefined);
});

test('extractAd does not read horsepower written as "KM" as kilometres', () => {
  const d = core.extractAd('Cena 8.500 € 1.4 TSI 125 KM');
  assert.equal(d.km, undefined);
  assert.equal(d.hp, 125);
  assert.equal(d.kw, 92);
});

test('extractAd returns an empty object for text without data', () => {
  assert.deepEqual(core.extractAd('nothing useful here'), {});
  assert.deepEqual(core.extractAd(''), {});
});

test('comparabilityWarnings flags year, mileage, fuel, transmission and power differences', () => {
  const tgt = { year: 2018, km: 100000, fuel: 'Diesel', transmission: 'Manual', kw: 100 };
  assert.deepEqual(core.comparabilityWarnings({ year: 2019, km: 140000, fuel: 'Diesel', transmission: 'Manual', kw: 101 }, tgt), []);
  assert.deepEqual(core.comparabilityWarnings({ year: 2015, km: 200000, fuel: 'Petrol', transmission: 'Automatic', kw: 140 }, tgt), ['year', 'km', 'fuel', 'transmission', 'power']);
  assert.deepEqual(core.comparabilityWarnings({ fuel: 'Petrol' }, { fuel: 'Other' }), []);
});

test('priceStats removes outliers once there are four or more prices', () => {
  const s = core.priceStats([10000, 10500, 11000, 11200, 30000]);
  assert.deepEqual(s.outliers, [30000]);
  assert.equal(s.n, 4);
  assert.equal(s.median, 10750);
  assert.equal(core.priceStats([1000, 50000]).outliers.length, 0);
  assert.deepEqual(core.priceStats([11500, 12400, 12800, 12990, 40000]).outliers, [40000]);
  assert.equal(core.priceStats([0, -5, NaN]), null);
});

test('summarizeComparison gives a buying range and confidence', () => {
  const r = core.summarizeComparison({ prices: [10000, 10500, 11000, 11200, 30000], mode: 'buy' });
  assert.deepEqual(r.buyRange, [10375, 10750]);
  assert.equal(r.confidence, 'medium');
  assert.equal(core.summarizeComparison({ prices: [9000], mode: 'buy' }).confidence, 'low');
  assert.equal(core.summarizeComparison({ prices: [], mode: 'buy' }), null);
});

test('summarizeComparison lowers confidence when prices vary a lot', () => {
  const r = core.summarizeComparison({ prices: [5000, 8000, 11000, 14000, 17000, 20000], mode: 'buy' });
  assert.equal(r.highSpread, true);
  assert.equal(r.confidence, 'medium');
});

test('summarizeComparison judges the seller asking price against the median', () => {
  const prices = [10000, 10500, 11000];
  assert.equal(core.summarizeComparison({ prices, mode: 'sell', askingPrice: 12500 }).verdict, 'high');
  assert.equal(core.summarizeComparison({ prices, mode: 'sell', askingPrice: 9000 }).verdict, 'low');
  const fair = core.summarizeComparison({ prices, mode: 'sell', askingPrice: 10800 });
  assert.equal(fair.verdict, 'fair');
  assert.equal(fair.tolerance, 525);
  assert.equal(core.summarizeComparison({ prices, mode: 'sell' }).verdict, undefined);
});

test('buildVehicleQuery includes year and mileage windows, fuel and transmission terms', () => {
  const q = core.buildVehicleQuery({ make: 'Škoda', model: 'Octavia', year: 2018, mileage: 120000, fuel: 'Diesel', transmission: 'Manual', mode: 'buy', hp: 150, kw: 110 });
  assert.match(q, /^"Škoda" "Octavia" \("2017" OR "2018" OR "2019"\) 70000\.\.170000 km \("diesel"/);
  assert.match(q, /"150 KM" OR "150 PS" OR "150 hp" OR "110 kW"/);
  assert.match(q, /Schaltgetriebe/);
});

test('isValidVinFormat and power conversion', () => {
  assert.equal(core.isValidVinFormat('WVWZZZ1KZAW000001'), true);
  assert.equal(core.isValidVinFormat('WVWZZZ1KZAW00000I'), false);
  assert.equal(core.isValidVinFormat('SHORT'), false);
  assert.equal(Math.round(core.kwToHp(100)), 136);
  assert.equal(Math.round(core.hpToKw(136)), 100);
});

const { modelOptions, OTHER_MAKE, OTHER_MODEL } = require('../public/js/data.js');
const catalogue = {};
for (const make of Object.keys(modelOptions)) if (make !== OTHER_MAKE) catalogue[make] = modelOptions[make].filter(m => m !== OTHER_MODEL);
const top = q => core.searchVehicles(q, catalogue, 3).map(x => x.make + ' ' + x.model);

test('searchVehicles finds models from partial and compact input', () => {
  assert.equal(top('civic ty')[0], 'Honda Civic Type R');
  assert.equal(top('civic')[0], 'Honda Civic');
  assert.equal(top('golf r')[0], 'Volkswagen Golf R');
  assert.equal(top('c63')[0], 'Mercedes-Benz C 63 AMG');
  assert.equal(top('skoda octavia rs')[0], 'Škoda Octavia RS');
  assert.equal(top('megane rs')[0], 'Renault Mégane R.S.');
  assert.equal(top('id3')[0], 'Volkswagen ID.3');
  assert.deepEqual(top('xyz'), []);
  assert.deepEqual(top('   '), []);
});

const synthetic = (pairs, noise = []) => pairs.map(([year, km], i) => ({ year, km, price: 10000 + 2000 * (year - 2016) - 0.05 * (km - 100000) + (noise[i] || 0) }));

test('depreciationModel recovers value lost per year and per km', () => {
  const m = core.depreciationModel(synthetic([[2016, 150000], [2017, 120000], [2018, 100000], [2018, 140000], [2019, 80000], [2020, 60000], [2017, 90000]]));
  assert.ok(Math.abs(m.perYear - 2000) < 1);
  assert.ok(Math.abs(m.perKm + 0.05) < 1e-6);
  assert.equal(m.n, 7);
});

test('depreciationModel uses mileage alone when every ad has the same year', () => {
  const m = core.depreciationModel(synthetic([[2018, 60000], [2018, 80000], [2018, 100000], [2018, 120000], [2018, 140000]]));
  assert.equal(m.perYear, 0);
  assert.ok(Math.abs(m.perKm + 0.05) < 1e-6);
});

test('depreciationModel refuses thin, collinear or implausible data', () => {
  assert.equal(core.depreciationModel(synthetic([[2016, 150000], [2017, 120000], [2018, 100000], [2019, 80000]])), null);
  // Mileage exactly follows year, so their effects cannot be separated.
  assert.equal(core.depreciationModel(synthetic([[2016, 160000], [2017, 140000], [2018, 120000], [2019, 100000], [2020, 80000]])), null);
  // Prices rising with mileage are implausible.
  const rising = [60000, 80000, 100000, 120000, 140000].map((km, i) => ({ year: 2018, km, price: 10000 + i * 1000 }));
  assert.equal(core.depreciationModel(rising), null);
  assert.equal(core.depreciationModel([]), null);
});

test('adjustPrice moves a price to the target car and caps large changes', () => {
  const m = { perYear: 1000, perKm: -0.05, n: 6 };
  assert.equal(core.adjustPrice({ price: 10000, year: 2017, km: 120000 }, { year: 2018, km: 100000 }, m), 12000);
  assert.equal(core.adjustPrice({ price: 10000, year: 2010, km: 300000 }, { year: 2018, km: 100000 }, m), 14000);
  assert.equal(core.adjustPrice({ price: 10000 }, { year: 2018, km: 100000 }, m), 10000);
  assert.equal(core.adjustPrice({ price: 10000, year: 2017, km: 1 }, { year: 2018, km: 100000 }, null), 10000);
});

test('encodeState and decodeState round-trip Unicode and are URL safe', () => {
  const state = { make: 'Škoda', model: 'Octavia RS', rows: [{ price: 12990, meta: '{"km":1}' }], note: 'čšž €' };
  const encoded = core.encodeState(state);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(core.decodeState(encoded), state);
  assert.throws(() => core.decodeState('!!!'));
});

test('niceTicks returns round values covering the range', () => {
  assert.deepEqual(core.niceTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(core.niceTicks(27500, 40000, 4), [25000, 30000, 35000, 40000]);
  const t = core.niceTicks(31, 149, 5);
  assert.ok(t[0] <= 31 && t[t.length - 1] >= 149);
  assert.deepEqual(core.niceTicks(5, 5, 5), [5]);
});

test('marketForLocale maps browser languages to markets', () => {
  assert.deepEqual(core.marketForLocale('sl-SI'), { country: 'SI', lang: 'sl' });
  assert.deepEqual(core.marketForLocale('de-AT'), { country: 'AT', lang: 'de' });
  assert.deepEqual(core.marketForLocale('de'), { country: 'DE', lang: 'de' });
  assert.deepEqual(core.marketForLocale('en-GB'), { country: 'UK', lang: 'en' });
  assert.deepEqual(core.marketForLocale('fr-FR'), { country: 'FR', lang: 'en' });
  assert.equal(core.marketForLocale('ja-JP'), null);
  assert.equal(core.marketForLocale('en-US'), null);
  assert.equal(core.marketForLocale(''), null);
});

test('extractDisplacement reads engine size from labels, cm³ values and model names', () => {
  const cases = {
    'Honda Civic 1.4 i-VTEC Sport': 1400, 'Honda Civic 1.8 i-VTEC Type S': 1800,
    'Prostornina motorja: 1.798 ccm': 1798, 'Hubraum 1.598 cm³': 1598, 'Cilindrata 1968 cc': 1968,
    'obujam motora 1.995 cm3': 1995, 'VW Golf 2,0 TDI': 2000, 'Fiat 500 0.9 TwinAir': 900,
    'Toyota Yaris 1.33 VVT-i': 1330, 'Renault Clio 1.5 dCi': 1500, 'motor 2.5 l': 2500,
  };
  for (const [text, cc] of Object.entries(cases)) assert.equal(core.extractDisplacement(text), cc, text);
  for (const text of ['Cena 1.400 €', 'Poraba 5.4 l/100 km', 'BMW 320d', 'nothing']) assert.equal(core.extractDisplacement(text), undefined, text);
});

test('extractAd includes engine size and flags a different engine', () => {
  const d = core.extractAd('Honda Civic 1.8 i-VTEC\nCena: 6.900 €\nLetnik: 2006\nPrevoženi km: 180.000\nGorivo: bencin\nPoraba 6,9 l/100 km');
  assert.equal(d.cc, 1800);
  assert.deepEqual(core.comparabilityWarnings(d, { year: 2006, cc: 1400 }), ['engine']);
  assert.deepEqual(core.comparabilityWarnings({ cc: 1398 }, { cc: 1400 }), []);
  // Engine size is left out of searches: portals list exact figures (1798) that "1.8" would miss.
  assert.doesNotMatch(core.buildVehicleQuery({ make: 'Honda', model: 'Civic', cc: 1800 }), /1[.,]8|1800/);
  // The ad's exact figure must round to the chosen size (nearest 100 cm³).
  const exact = cc => core.extractAd('Prostornina motorja: ' + cc + ' ccm');
  assert.deepEqual(core.comparabilityWarnings(exact(1798), { cc: 1800 }), []);
  assert.deepEqual(core.comparabilityWarnings(exact(1398), { cc: 1400 }), []);
  for (const [cc, target] of [[1493, 1400], [1339, 1400], [1498, 1400], [1598, 1800], [1851, 1800]])
    assert.deepEqual(core.comparabilityWarnings(exact(cc), { cc: target }), ['engine'], cc + ' vs ' + target);
  assert.deepEqual(core.comparabilityWarnings(core.extractAd('Civic 1.5 i-VTEC'), { cc: 1400 }), ['engine']);
});

test('engineSize rounds mathematically except for engines sold under another size', () => {
  assert.equal(core.engineSize(1349, 'Toyota', 'Petrol'), 1300);
  assert.equal(core.engineSize(1350, 'Toyota', 'Petrol'), 1400);
  assert.equal(core.engineSize(1798, 'Honda', 'Petrol'), 1800);
  assert.equal(core.engineSize(1339, 'Honda', 'Petrol'), 1400);
  assert.equal(core.engineSize(1339, 'Honda', 'Hybrid'), 1300);
  assert.equal(core.engineSize(1248, 'Fiat', 'Diesel'), 1300);
  assert.equal(core.engineSize(1248, 'Hyundai', 'Petrol'), 1200);
  assert.equal(core.engineSize(2143, 'Mercedes-Benz', 'Diesel'), 2200);
  assert.deepEqual(core.comparabilityWarnings({ cc: 1339, fuel: 'Petrol' }, { make: 'Honda', cc: 1400, fuel: 'Petrol' }), []);
  assert.deepEqual(core.comparabilityWarnings({ cc: 1339, fuel: 'Petrol' }, { make: 'Toyota', cc: 1400, fuel: 'Petrol' }), ['engine']);
});

test('power must match within 2 kW', () => {
  assert.deepEqual(core.comparabilityWarnings({ kw: 85.3 }, { kw: 85 }), []);
  assert.deepEqual(core.comparabilityWarnings({ kw: 77 }, { kw: 85 }), ['power']);
  assert.deepEqual(core.comparabilityWarnings({ kw: 110 }, { kw: 103 }), ['power']);
});
