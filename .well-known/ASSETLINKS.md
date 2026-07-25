# Digital Asset Links (TWA / App Links)

Package: **`in.civicradar.app`**  
Host: **`civicradarnh.github.io`** (not `icradarnh` — typo)

## What Android / Play fetches (required)

```
https://civicradarnh.github.io/.well-known/assetlinks.json
```

This must be at the **domain root**. Path-prefix apps (`/civicradar/`) do **not** change that: verification is always host-root `.well-known/assetlinks.json`.

## What this repo deploys (project Pages)

```
https://civicradarnh.github.io/civicradar/.well-known/assetlinks.json
```

GitHub **project** Pages serves the civicradar repo under `/civicradar/`. Keeping a matching file here is good hygiene and helps local/E2E checks, but **it does not satisfy** Play/Android host verification by itself.

## Current live status (investigated)

| URL | Status | Notes |
|-----|--------|--------|
| `https://civicradarnh.github.io/.well-known/assetlinks.json` | **200** `application/json` | Already hosted (org/user Pages or equivalent). Google DAL API lists `in.civicradar.app` + the SHA-256 below. |
| `https://civicradarnh.github.io/civicradar/.well-known/assetlinks.json` | **200** `application/json` | From this repo after deploy. |
| `https://civicradarnh.github.io/` (site index) | **404** | Root index missing is OK if `.well-known/` is still served. |

**SHA-256 currently published (root + this file):**

`F5:60:31:34:A2:89:3D:B1:A8:9A:20:1C:08:52:84:FD:E6:3F:57:99:C2:2E:A9:72:0E:40:9F:D9:D6:BB:7F:F1`

Source: already live at host root (not invented). Bubblewrap `twa-manifest.json` had `fingerprints: []`; android keystore SHA was not re-derived in-repo.

## Founder steps if Play still says “1 domain not verified”

Play installs are signed with the **App signing key**, which often differs from the **upload key**.

1. Play Console → **Setup** → **App signing** → copy **App signing key certificate** SHA-256 (colon-separated, uppercase).
2. Compare to `F5:60:31:34:…` above.
   - **Same** → re-run domain verification / wait for cache; ensure the listed deep link path is under `/civicradar`.
   - **Different** → add the Play App Signing SHA-256 to `sha256_cert_fingerprints` in:
     - this file (`.well-known/assetlinks.json`), then deploy this repo, **and**
     - the **host-root** file at `https://civicradarnh.github.io/.well-known/assetlinks.json` (org/user site repo — **not** only `/civicradar/…`).
3. Optional: also keep the upload-key fingerprint in the array so sideloaded/debug builds verify.
4. Tester: [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) — site `https://civicradarnh.github.io`, package `in.civicradar.app`.
5. Do **not** remove `android:autoVerify="true"` from the TWA unless you intentionally want Custom Tabs chrome instead of verified fullscreen TWA.

## Android manifest (civicradar-android)

- `autoVerify=true` on `https` + host `civicradarnh.github.io` + `pathPrefix` for `/civicradar`
- `asset_statements` site: `https://civicradarnh.github.io`
- Prefer fixing assetlinks over removing autoVerify

## Content-Type

GitHub Pages already serves `.json` as `application/json; charset=utf-8`. No extra Pages config required.
