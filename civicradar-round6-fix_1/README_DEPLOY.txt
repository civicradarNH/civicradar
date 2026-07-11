CIVICRADAR — REVIEW-ROUND-6 FIX BUNDLE (all files together)
1. js/app.js                  -> js/app.js      (18 tmc.gov.in display refs fixed; 2 Gujarati keys added)
2. privacy.html               -> root           (counsel placeholders removed, email fallback hardened)
3. child-safety-standards.html-> root           (email fallback hardened; now linked + precached)
4. sw.js                      -> root           (v162; child-safety page precached)
DELETE Turnstile.txt FROM THE REPO if present, and ROTATE the Turnstile secret in Cloudflare.
VERIFY after push: live js/app.js Ctrl+F "tmc.gov.in" -> only "thanecity.gov.in" matches remain.
Play Console: enter https://civicradarnh.github.io/civicradar/child-safety-standards.html in the
App content -> Child safety standards (CSAE) URL field.
