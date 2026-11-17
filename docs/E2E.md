# End-to-end tests (Playwright)

The browser suite lives in `tests/e2e/` and covers boot, sidebar navigation,
task CRUD, task search, the command palette, and settings.

## Prerequisites

```bash
npm install
npx playwright install chromium
```

Python 3 is required because Playwright starts the Harita server itself.

## Running

```bash
npm run test:e2e          # headless
npm run test:e2e:headed   # watch in a real browser
```

A single spec can be run with:

```bash
npx playwright test tests/e2e/app.spec.js
```

## Server handling

The config uses Playwright's `webServer` to boot the app with a throwaway
database:

```bash
HARITA_DB=.e2e/harita.db HARITA_DATA=.e2e HARITA_PORT=8777 python3 server.py
```

If a server is already reachable at `http://127.0.0.1:8777` it is reused
(`reuseExistingServer: true`), so either start Harita yourself or let Playwright
boot it. When reusing a long-running server, remember it may point at your real
`data/harita.db` instead of the isolated `.e2e/` database. Tests clean up the
tasks they create, but prefer stopping the real server if you want a fully
isolated run.

Use `?nosw=1` in test URLs to keep the service worker out of the way. Test
artifacts (traces/screenshots on failure) are written to `test-results/`.

## Cross-browser

The config declares three projects. Chromium is the default; install the other
engines once and run them explicitly:

```bash
npx playwright install firefox webkit
npm run test:e2e:firefox
npm run test:e2e:webkit   # WebKit = closest automated proxy for Safari on Linux
npm run test:e2e:all      # all three engines
```

Safari itself cannot run on Linux, so WebKit coverage is the practical stand-in.
Firefox/WebKit runs are optional in CI; Chromium is the required gate.
