'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makes, modelOptions, marketSites, OTHER_MAKE, OTHER_MODEL } = require('../public/js/data.js');

test('every make has unique models and ends with "Other / not listed"', () => {
  for (const [make, models] of Object.entries(modelOptions)) {
    assert.equal(new Set(models).size, models.length, make + ' has duplicate models');
    assert.equal(models[models.length - 1], OTHER_MODEL, make);
  }
});

test('makes are sorted alphabetically with "Other" last', () => {
  assert.equal(makes[makes.length - 1], OTHER_MAKE);
  const real = makes.slice(0, -1);
  assert.deepEqual(real, [...real].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  assert.deepEqual([...makes].sort(), Object.keys(modelOptions).sort());
});

test('catalogue includes sport and performance versions as separate models', () => {
  const expected = {
    Honda: ['Civic', 'Civic Type R'], Volkswagen: ['Golf', 'Golf GTI', 'Golf R'], BMW: ['3 Series', 'M3'],
    Audi: ['A3', 'S3', 'RS3'], 'Mercedes-Benz': ['C-Class', 'C 63 AMG'], Hyundai: ['i30', 'i30 N'],
    Renault: ['Mégane', 'Mégane R.S.'], Toyota: ['Yaris', 'GR Yaris'], Škoda: ['Octavia', 'Octavia RS'],
    Porsche: ['911 Carrera', '911 GT3'], Ford: ['Focus', 'Focus ST', 'Focus RS'],
  };
  for (const [make, models] of Object.entries(expected)) for (const m of models) assert.ok(modelOptions[make].includes(m), `${make} ${m}`);
});

test('catalogue covers the main European makes', () => {
  for (const make of ['Alfa Romeo', 'BYD', 'Cupra', 'Dacia', 'DS', 'Jaguar', 'Land Rover', 'Lexus', 'MG', 'Polestar', 'Smart', 'Volvo'])
    assert.ok(makes.includes(make), make);
  assert.ok(makes.length >= 60);
});

test('every market has marketplace sites', () => {
  for (const [country, sites] of Object.entries(marketSites)) assert.ok(sites.length > 0, country);
});
