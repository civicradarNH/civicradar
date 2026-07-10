# Play Store link fix — DO NOT drag-overwrite Claude's zip

Claude's `civicradar-playstore-fix/` zip is **stale** and unsafe to drop on this repo:

- It would wipe newer UI (ward pulse, manual pin, design work, v156+).
- It reintroduces **broken** hosts: `thanecity.gov.in` (times out), and weakens PMC/Swachhata URLs.

## What we applied instead (v157) in the live source tree

| Old (Play crawler flags) | New (verified 200) |
|--------------------------|--------------------|
| `portal.mcgm.gov.in/irj/...` | `https://www.mcgm.gov.in/` |
| `aaplesarkar.mahaonline.gov.in` | `https://pgportal.gov.in/` |
| `webadmin.pmc.gov.in/...` | `https://www.pmc.gov.in/` |
| TMC | keep `https://tmc.gov.in/` (not thanecity) |
| Swachhata | keep `https://www.mohua.gov.in/cms/...` (not sbm alone) |

Also: Privacy contact always gets a real `mailto:` (never `#`); index.html escalation label uses `www.mcgm.gov.in`.

## Your deploy steps (GitHub Desktop)

1. Commit these files (at least): `js/app.js`, `js/config.js`, `index.html`, `official-sources.html`, `sw.js`, `tests/e2e_comprehensive.py`
2. Push to `main` (or whatever Pages deploys from)
3. Wait ~2 minutes
4. Open https://civicradarnh.github.io/civicradar/js/app.js
5. Ctrl+F — each must be **0**:
   - `mahaonline`
   - `portal.mcgm.gov.in/irj`
   - `webadmin.pmc`
6. Hard-refresh the app, click the 7 gov links in an incognito window, then record the Guidde demo

## Incognito link checklist

- https://www.mcgm.gov.in/
- https://participatemumbai.mcgm.gov.in/
- https://www.pmc.gov.in/
- https://tmc.gov.in/
- https://pgportal.gov.in/
- https://www.mohua.gov.in/cms/swachh-bharat-mission-urban.php
- https://cooperatives.gov.in/ (may time out from some networks — known flaky)

You can delete the `civicradar-playstore-fix/` folder after deploy; it is not needed for shipping.
