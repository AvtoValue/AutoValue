# AutoValue

Compare a car against comparable listings before you buy or sell. Early prototype.

## Run it

- **Without a server:** open `index.html` (or `public/index.html`) in Safari or Chrome.
- **With the server** (Node 20+; no dependencies to install):

  ```bash
  npm start
  ```

  Then open http://127.0.0.1:8080/. Set `PORT` / `HOST` to change the address, or copy
  `.env.example` to `.env` and run `node --env-file=.env server/server.js`.
- **GitHub Pages:** `.github/workflows/pages.yml` publishes `public/` on every push to `main`.
  Enable it once under *Settings → Pages → Source: GitHub Actions*. Pages hosts only the
  static app; the API needs the Node server.

## Tests

```bash
npm test
```

## Layout

| Path | Contents |
| --- | --- |
| `public/index.html`, `public/css/styles.css` | Page markup and styles |
| `public/js/core.js` | Pure logic: ad-text parsing, price statistics, search query (shared with tests) |
| `public/js/app.js` | DOM wiring |
| `public/js/i18n.js` | Translations (English, Slovenian, German, Italian, Croatian) |
| `public/js/data.js` | Makes and models sold in Europe, including sport versions (e.g. Civic Type R), and marketplace sites |
| `server/server.js` | Static file server + JSON API |
| `server/providers/index.js` | Registry of licensed listing providers (empty for now) |
| `test/` | `node:test` tests for the core logic and the server |

## How the comparison works

The user pastes the text of comparable ads. AutoValue reads price, first registration, mileage,
power, fuel and transmission (Slovenian, Croatian, German, Italian and English wording; monthly
financing amounts and EV range are ignored) and flags ads that differ from the user's car.

From the entered prices it reports range, median and mean. With four or more prices, outliers
(outside 1.5×IQR and more than 25% from the median) are excluded. Buyers get a suggested range
from the lower quartile to the median; sellers see whether their asking price is within
±max(€500, 5%) of the median. Confidence depends on the number of ads and is lowered when prices
vary by more than 25%.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/health` | `{ ok, version }` |
| GET | `/api/sources?country=SI` | Providers for the market and whether each is configured |
| POST | `/api/listings/search` | `{ country, make, model, year?, mileage?, fuel?, transmission? }` → `{ listings }`; `503` when no provider is configured |

The API is rate limited (60 requests/minute per IP), limits request bodies to 16 KB and keeps only
known listing fields from providers.

## Limitations

- No live listings are fetched yet: no provider is registered in `server/providers/index.js`.
  Each portal must be integrated only through permitted APIs, approved access or a data agreement.
- No VIN decoding (the VIN field checks the format only), no AI, accounts or photo analysis.
- No market valuation is fabricated: results use only prices the user enters.
- API keys belong in server environment variables, never in browser code.
