'use strict';
// Listing providers. Each one must be backed by a permitted API, approved access or a data
// agreement; scraping marketplace pages is not allowed. Secrets come from environment
// variables and never reach the browser.
//
// A provider looks like:
//   {
//     id: 'example',                    // stable identifier
//     name: 'Example Listings API',     // shown to users
//     countries: ['SI', 'HR'],          // markets it covers
//     isConfigured(env) { return Boolean(env.EXAMPLE_API_KEY); },
//     async search(query, env, { signal }) {
//       // query: { country, make, model, year, mileage, fuel, transmission }
//       // return [{ url, price, year, km, kw, hp, fuel, transmission, title }]
//     },
//   }
//
// Register real providers in this array once access has been agreed.
module.exports = [];
