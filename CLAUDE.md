# CivicRadar — Claude Code instructions

## Stack (do not assume React/Next.js)
- Static PWA: index.html, js/app.js, css/styles.css, sw.js, manifest.json, js/config.js
- No npm app build, no TypeScript, no Tailwind, no shadcn
- i18n: English, Hindi, Marathi, Gujarati (all in js/app.js)
- Deploy: GitHub Pages → https://civicradarnh.github.io/civicradar/
- Android TWA is a separate repo; this is the web app only

## When changing shipped JS/CSS/HTML
1. Bump `CIVIC_APP_VERSION` in js/app.js
2. Bump `CACHE` in sw.js to the same version (e.g. civicradar-v109)
3. Update SW06 in tests/e2e_comprehensive.py if it checks cache string

## Git
- Do NOT commit or push unless I explicitly ask
- I use GitHub Desktop to commit and push

## Verification before saying "done"
- node --check js/app.js
- python -m http.server 8095 --bind 127.0.0.1 (background)
- python tests/e2e_comprehensive.py (needs: pip install playwright && playwright install chromium)

## Hazard types
stagnant-water, garbage, potholes, streetlight — app is multi-hazard, not monsoon-only