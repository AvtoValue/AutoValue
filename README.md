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

Browser tests drive the whole app in Chromium (they need the `playwright` package; CI installs it):

```bash
npm run test:e2e
```

## Layout

| Path | Contents |
| --- | --- |
| `public/index.html`, `public/css/styles.css` | Page markup and styles |
| `public/js/core.js` | Pure logic: ad-text parsing, price statistics, search query (shared with tests) |
| `public/js/app.js` | DOM wiring |
| `public/js/i18n.js` | Translations (English, Slovenian, German, Italian, Croatian) |
| `public/js/engines.js` | Common engines by maker group (fuel, kW, cm³) used to suggest the engine size from the power |
| `public/js/data.js` | Makes and models sold in Europe, including sport versions (e.g. Civic Type R), and marketplace sites |
| `server/server.js` | Static file server + JSON API |
| `server/providers/index.js` | Registry of licensed listing providers (empty for now) |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` | Installable app, offline cache and share target |
| `extension/` | Browser extension that sends the open ad to AutoValue |
| `public/privacy.html` | Privacy policy and terms of use (5 languages) |
| `docs/chrome-web-store/` | Store listing texts, permission justifications and images for publishing the extension |
| `test/` | `node:test` tests for the core logic and the server |

## How the comparison works

The user pastes the text of comparable ads. AutoValue reads price, first registration, mileage,
power, fuel and transmission (Slovenian, Croatian, German, Italian and English wording; monthly
financing amounts and EV range are ignored) and flags ads that differ from the user's car.

With at least five ads that include year and mileage, AutoValue fits how much these ads lose
per year and per 10,000 km (least squares) and brings each price to the user's car before
comparing; the change per ad is capped at ±40%, and the step is skipped when the pattern is
implausible or year and mileage are too closely linked. The user can turn this off.

From the (adjusted) prices it reports range, median and mean. With four or more prices, outliers
(outside 1.5×IQR and more than 25% from the median) are excluded. Buyers get a suggested range
from the lower quartile to the median; sellers see whether their asking price is within
±max(€500, 5%) of the median. Confidence depends on the number of ads and is lowered when prices
vary by more than 25%.

The report includes a price-vs-mileage chart (inline SVG) with the user's car, the suggested
range or asking price and the trend line. A report can be shared as a link: its state is
base64url-encoded in the URL fragment (the VIN is left out), so nothing is stored on a server.
*My garage* keeps up to 20 valuations in the browser; *See an example* opens a report with
made-up ads, and on a first visit the market and language follow the browser language.

Other conveniences: a quick search for make and model ("civic ty" → Honda Civic Type R), entries
saved in the browser (localStorage) so a reload keeps them, and a print / PDF view of the report.

## On a phone

AutoValue is an installable web app (PWA): on Android choose *Add to Home screen* / *Install app*,
on iPhone *Share → Add to Home Screen*. It then works offline, and on Android it appears in the
*Share* menu of other apps: sharing an ad adds its link (and any shared text) to the comparison.
Most apps share only the link, so the ad text still has to be copied; the *Paste copied ad*
button inserts it from the clipboard.

## Browser extension

`extension/` is a Chrome/Edge extension (Manifest V3). Clicking its icon on an ad page reads the
text of that page (only on click, `activeTab`) and opens AutoValue with it in the URL fragment,
which is never sent to a server. The Pages workflow publishes it as `autovalue-extension.zip`.

Install for testing: `chrome://extensions` → *Developer mode* → *Load unpacked* → choose
`extension/`. The AutoValue address can be changed on the extension's options page (e.g. to
`http://127.0.0.1:8080/` for local development). `npm run build:extension` builds the zip locally.

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
