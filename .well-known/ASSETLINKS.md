# Digital Asset Links (TWA / App Links)

**Deployed URL (GitHub Pages project site):**  
`https://civicradarnh.github.io/civicradar/.well-known/assetlinks.json`

## Founder steps before Closed Testing / production TWA

1. Play Console → **Setup** → **App signing** → copy **App signing key certificate** SHA-256 (colon-separated uppercase).
2. Replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` in `assetlinks.json` with that fingerprint.
3. If upload key ≠ app signing key, also replace `REPLACE_WITH_UPLOAD_KEY_SHA256_IF_DIFFERENT` (otherwise remove that array entry).
4. Redeploy this repo so GitHub Pages serves the updated file.
5. Verify with [Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator) using package `in.civicradar.app`.

## GitHub Pages host-root caveat

Android fetches Asset Links from the **host root**:  
`https://civicradarnh.github.io/.well-known/assetlinks.json`

A project-site file under `/civicradar/.well-known/` may **not** verify for domain-wide App Links. Bubblewrap/TWA with `host=civicradarnh.github.io` and path prefix `/civicradar/` often still needs:

- a **custom domain** with root `.well-known/assetlinks.json`, or  
- org/user Pages that can serve the host-root path, or  
- verification configured in the Android TWA project (`civicradar-android`).

Until fingerprints are real and host verification succeeds, TWA will fall back to Custom Tabs (browser chrome) — not a silent crash, but App Link / verified TWA will Fail Play deep-link checks.

## Package name

Must match the Android applicationId: **`in.civicradar.app`** (see `STORE_LAUNCH.md` / Bubblewrap).
