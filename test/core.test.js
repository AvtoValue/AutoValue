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
  assert.deepEqual(d, { price: 12990, year: 2017, km: 148000, kw: 85, hp: 116, fuel: 'Diesel', transmission: 'Manual' });
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
  assert.deepEqual(core.comparabilityWarnings({ year: 2019, km: 140000, fuel: 'Diesel', transmission: 'Manual', kw: 110 }, tgt), []);
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
