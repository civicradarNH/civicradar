# CivicRadar — Automated Testing

Two layers. Layer 1 runs anywhere in 2 seconds. Layer 2 drives a real browser.

## Layer 1 — Invariant Linter (no dependencies, run this constantly)

```bash
node tools/invariant-lint.js .
```

Catches the CLASS of bug that keeps biting you — not specific bugs, but the
*patterns* that create them:

| Rule | Catches |
|---|---|
| `state-flag-never-cleared` | flags set true but never reset → flows hang forever |
| `filereader-no-onerror` | **found the real photo-capture hang** |
| `leaflet-no-invalidatesize` | **found the blank pin map** |
| `scroll-trap` | **found the unreachable hazard tiles** |
| `stale-id-never-cleared` | **found the premature share nudge** |
| `overlay-no-close` | screens the user can't exit |
| `toast-not-dismissible` | popups that can't be closed |
| `sw-no-update-check` | users stuck on a stale app version |
| `unguarded-storage-write` | QuotaExceededError breaking a flow |
| `timer-leak` | intervals that outlive their view |

Exit code is 1 on any ERROR → wire it into CI so bugs can't come back:

```yaml
# .github/workflows/lint.yml
- run: node tools/invariant-lint.js .
```

## Layer 2 — Playwright E2E (real browser, real clicks)

```bash
npm i -D @playwright/test
npx playwright install chromium
npx playwright test               # headless
npx playwright test --headed      # watch it
npx playwright test --project=mobile   # emulate a budget Android
```

Every bug we fixed is a REGRESSION TEST — it can never silently return:

- `BUG-1` photo capture always returns to the confirm step
- `BUG-1b` a corrupt photo fails gracefully instead of hanging
- `BUG-2` every hazard tile is reachable (the scroll bug)
- `BUG-3` the pin map renders tiles, not a blank box
- `BUG-4` no share nudge before submitting
- `E2E` full happy path: photo → category → pin → submit → map
- `UX` every overlay is closeable; GPS-denied has a manual-pin fallback
- `PWA` app shell loads offline
- `i18n` all 4 languages complete the flow with no raw keys leaking

It also **fails on any uncaught console error**, which catches silent breakage
you'd never notice by clicking.

## Suggested workflow

1. Before every commit: `node tools/invariant-lint.js .`  (2 seconds)
2. Before every deploy: `npx playwright test`             (~1 minute)
3. On CI: both.

That replaces almost all manual testing. What it does NOT replace: how the app
*feels* on a real budget phone on a slow network. Do that once before launch,
not on every change.
