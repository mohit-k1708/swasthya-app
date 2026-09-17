# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Swasthya — a barcode-scanning web app. React frontend (Vite) + a minimal Express backend. Users scan a product barcode (camera or manual entry), the frontend POSTs it to the backend, and the backend currently just echoes it back (no external product lookup, grading, or database yet — that's future scope).

This is two independent npm packages in one repo, each with its own `package.json`, `node_modules`, and `.gitignore`:
- `/` — the React frontend
- `/server` — the Express backend

They are not a workspace/monorepo setup; run `npm install` separately in each.

## Commands

### Frontend (run from repo root)
- `npm run dev` — start Vite dev server (default port 5173; pass `-- --port N` to override)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — Oxlint (config in `.oxlintrc.json`)

No test suite is configured yet.

### Backend (run from `server/`)
- `npm run dev` — start with nodemon (auto-restart)
- `npm run start` — start with plain `node`
- Listens on `http://localhost:4000`, hardcoded (not env-configurable)

### Running both together
The frontend calls the backend directly via `fetch` (see `src/api/scan.js`), so for the app to fully work both processes must be running at once: `server` on :4000 and Vite on :5173 (or whatever port). There's no proxy config — CORS on the backend (`cors()` middleware) is what makes cross-port calls work in dev.

## Architecture

### Screen flow (single-page, no router)
`App.jsx` holds one piece of state — `screen: 'home' | 'scan'` — and switches between `HomeScreen` and `BarcodeScanner`. There is no React Router; navigation is just conditional rendering driven by callbacks (`onScan`, `onBack`).

`BarcodeScanner.jsx` internally manages a second-level state machine — `view: 'scan' | 'analyzing' | 'result'` — for the scan → analyze → result flow within that one screen. Key details for anyone touching this file:
- Both manual entry and camera detection funnel through the same `runScanFlow(code)` function, so they get identical Analyzing/Result/error handling. Don't add a separate code path for one without the other.
- `runScanFlow` uses a `flowTokenRef` counter to invalidate in-flight timers/fetches if the user navigates away mid-flow (e.g. hits Back during "Analyzing"). Any new async step added to this flow must check the token before committing a state update, or a stale response can hijack the UI after the user has moved on.
- The Quagga camera viewport (`<div id="quagga-viewport">`) is always mounted in the JSX (visibility toggled via a CSS class, not conditional rendering). This is load-bearing: `Quagga.init()` looks up the target element synchronously, so if the div were conditionally rendered the same tick `startCamera()` runs, the lookup would fail. Apply the same pattern if you add other libraries that mount into a DOM node by ref/id.
- `isMountedRef` guards state updates after unmount. It's set `true` both in `useRef(true)` and again at the top of the mount `useEffect` — this is required because React Strict Mode's dev-only mount→unmount→remount cycle runs the cleanup (setting it `false`) before the "real" mount, and nothing else resets it back to `true` on remount. Omitting the effect-body assignment silently breaks all post-async state updates in dev.

### Barcode scanning
Uses `@ericblade/quagga2` (not `html5-qrcode`, which was tried first and dropped — it couldn't reliably decode 1D barcodes, only QR). Quagga is configured for EAN-13/8, UPC-A/E, and Code128 in `BarcodeScanner.jsx`'s `startCamera()`. If retuning detection, that's the one place to edit (`decoder.readers`, `locator`, `numOfWorkers`).

### Backend contract
Single endpoint: `POST /api/scan` with `{ barcode }` in the body. `server/routes/scan.js` looks the barcode up via `server/services/openFoodFacts.js` (Open Food Facts API v2) and, if found, grades it via `server/services/grading.js`. Response is either the normalized product merged with `{ grade, totalScore, reasons }`, or `{ found: false, message }` if the barcode isn't in Open Food Facts or the lookup failed. `src/api/scan.js` is the single fetch wrapper the frontend uses to call it (`API_BASE_URL` is hardcoded to `http://localhost:4000`).

`openFoodFacts.js` resolves the OFF hostname via a hardcoded public DNS resolver (8.8.8.8/1.1.1.1) instead of the OS resolver — on some networks the system resolver times out for `world.openfoodfacts.org` specifically even though other domains resolve fine. This requires issuing the request through `undici`'s own `request()` with a custom `Agent({ connect: { lookup } })`, not the global `fetch()` — passing an npm-installed `undici` Agent as a `dispatcher` to Node's *built-in* `fetch` throws (`invalid onRequestStart method`) when the two `undici` versions diverge, which they do as of Node 24. Fetching also retries once on timeout (15s per attempt) before giving up.

### Styling
No CSS framework or CSS-in-JS — one hand-written stylesheet, `src/App.css`, using CSS custom properties defined in `:root` for the brand palette (`--orange`, `--yellow`, `--green`, `--ink`, `--cream`, `--brown`). Fonts are Baloo 2 (headings) and Nunito (body), loaded via Google Fonts `<link>` tags in `index.html`. Layout is desktop-first responsive (not a mobile-only design) with breakpoints at 860px and 480px.

### Mascot images
`Mascot.jsx` loads `/mascot/<pose>.png` from `public/mascot/` (plain `<img>`, not a bundled import) and falls back to an emoji via `onError` if the file is missing. This means mascot art can be dropped into `public/mascot/` without touching build config — new poses just need a matching `pose` prop value.
