# CivicRadar — App Store Launch Checklist

Use this before submitting to Google Play or Apple App Store. CivicRadar is a PWA; native store listings typically wrap it as a **TWA (Android)** or **WebView shell (iOS)**.

---

## Pre-flight (both stores)

| Item | Status / action |
|------|-----------------|
| **Privacy Policy URL** | Deploy `privacy.html` at a stable HTTPS URL, e.g. `https://yourdomain.com/privacy.html` |
| **Terms URL** | Deploy `terms.html` at `https://yourdomain.com/terms.html` |
| **Support email** | Set `founder.email` and `legal.grievanceEmail` in `js/config.js` — required for store contact fields and DPDP grievance officer |
| **HTTPS only** | Camera + geolocation require HTTPS in production (not `http://localhost`) |
| **No placeholder content** | Remove/disable demo sponsor (`Clean Mumbai NGO` with `active: false` is OK); set real contact email |
| **Demo logins hidden** | Ship with Supabase configured so `admin`/`password` demo UI never appears |
| **BMC disclaimer** | Store listing must say: *Independent community app — not official BMC/MCGM* |
| **Broken links** | Test 1916, MyBMC, portal, Participate Mumbai links on a real device |
| **Account deletion** | In-app: Profile → Delete my data (reports, pledges, volunteer signup, session analytics). Re-run `supabase/schema.sql` `delete_user_data` RPC if upgrading |

---

## Google Play (recommended path: TWA / Bubblewrap)

### Why TWA
Trusted Web Activity wraps your PWA in Chrome Custom Tabs with your domain verified via Digital Asset Links. Better than a generic WebView for PWAs.

### Steps
1. Deploy PWA to HTTPS hosting (Vercel, Netlify, Cloudflare Pages, etc.).
2. Install [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or use PWABuilder.
3. Set `packageId` to **`in.civicradar.app`**, app name, icon (512×512 PNG).
4. Configure **Digital Asset Links** — repo ships `.well-known/assetlinks.json` (deployed to `https://civicradarnh.github.io/civicradar/.well-known/assetlinks.json`). Paste your Play Console **App signing SHA-256** into that file before expecting verified App Links.
5. Target **API 34+** (Google Play requirement; check current target API in Play Console).
6. Declare permissions in Play Console matching the app:
   - **Location** (precise) — hazard pin accuracy
   - **Camera** — hazard photo evidence
   - **Internet** — map, sync, moderation models

### Play Console — Data safety form

Declare honestly (adjust if your deployment differs):

| Data type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| Approx/precise location | Yes | Yes (map) | App functionality | No (for reporting) |
| Photos | Yes | Yes (map) | App functionality | No (for reporting) |
| Name (display name) | Yes | Yes (leaderboard) | App functionality | Yes |
| User IDs (anonymous UUID) | Yes | No | App functionality | No (if sync on) |
| Email | Only BMC/NGO OTP | No | Account management | Yes (citizens) |
| App interactions (reports, pledges) | Yes | Yes (community) | App functionality | No |

- **Encryption in transit:** Yes (HTTPS)
- **Deletion mechanism:** In-app Delete my data + email support
- **Data not sold:** Yes

### Content rating (IARC)
Typical answers for CivicRadar:
- Violence: None
- Sexual content: None (photo moderation blocks NSFW)
- User interaction: Yes (UGC photos, community map)
- Shares location: Yes
- **Suggested rating:** PEGI 12 / Teen (UGC + location) — complete questionnaire honestly

### Families policy
App is **18+** in Terms. In Play Console: not targeting children; do not select “Designed for families” unless you add a kids mode (you should not).

### Rejection risks (Google) — **Low–Medium** if checklist complete
- Missing privacy URL or Data safety mismatch → **high**
- Missing permission rationale → **medium**
- WebView wrapper without TWA/asset links → **medium**
- Misleading “official BMC” claims → **high**

---

## Apple App Store (WebView / Capacitor / PWA shell)

### Guideline 4.2 — Minimum functionality ⚠️

Apple often **rejects apps that are “just a website in a wrapper”** with no meaningful native value beyond what Safari provides.

**Honest assessment:** A pure WebView of CivicRadar **may be rejected** unless you add native differentiation, for example:
- Push notifications for report status / ward alerts
- Native share sheet integration beyond basic Web Share
- Offline-first native caching layer (service worker helps but Apple may not count it)
- Widgets, Siri shortcuts, or Apple Watch glance
- Camera/location via native APIs with clear UX

**Lower-risk paths:**
1. **Skip Apple App Store** — promote “Add to Home Screen” PWA (works today).
2. **Capacitor wrapper** with native plugins (push, haptics, biometrics for partner login).
3. **Position as a utility** with clear offline map + camera workflow in review notes.

### App Store Connect — App Privacy

| Category | Detail |
|----------|--------|
| Location | Precise, linked to user, for app functionality |
| Photos | Linked to user, for app functionality |
| User content | Reports, notes |
| Identifiers | Anonymous user ID if Supabase sync |
| Contact info | Email (BMC/NGO only) |

- Privacy Policy URL: required
- Data linked to you: Yes (reports tied to anonymous ID)
- Tracking: No (unless you add analytics later — then update labels)

### Age rating
Set **17+** or **18+** to match Terms (user-generated content + location).

### Rejection risks (Apple) — **Medium–High** for WebView-only
- 4.2 Minimum functionality → **high** without native features
- Missing privacy policy / deletion → **high**
- UGC without moderation description → **medium** (document client-side moderation in review notes)
- Claiming government affiliation → **high**

---

## Store listing copy (template)

**Short description:**  
Community hazard map for Mumbai, Pune & Thane — not a gov app. Official links inside.

**Full description highlights:**
- Community hazard reporting with photo evidence
- Official BMC escalation links (1916, MyBMC, portal)
- 4 languages · ward leaderboards · volunteer pledges
- **Disclaimer:** CivicRadar is an independent civic tool, not an official MCGM/BMC application.

**Keywords (Apple):** Mumbai, monsoon, BMC, civic, stagnant water, dengue, hazard map

---

## Play Store resubmission (Misleading Claims — government sources)

**Rejection:** Missing Source Link for Government Information — app references BMC/PMC/TMC but Play requires clear accessible URLs to original .gov sources in the app **and** store listing.

### What we fixed (paste in Play Console → Release notes)

- Replaced broken or non-.gov source URLs in `official-sources.html`, `js/config.js`, in-app i18n, and store listing copy.
- **Removed / replaced:** `pmccare.in` (non-.gov.in), `sbm.gov.in/sbmicc/ICT-platform` (404), `grievances.maharashtra.gov.in` (unreliable), the old dead TMC hostname, and the stale MoHUA CMS deep link.
- **Current verified targets (match app + official-sources.html):** BMC `www.mcgm.gov.in` / Participate Mumbai; PMC `www.pmc.gov.in`; TMC `www.thanecity.gov.in`; Aaple Sarkar / CPGRAMS `pgportal.gov.in`; Swachhata-MoHUA `www.swachh.city`.
- Official sources page shows contact email (`civicradarnh@gmail.com`) and source links in static HTML (no JS required).
- In-app TMC / Swachhata channel labels match these URLs.

### Play Console fields

- If **Website** or **Government information source URL** field exists, paste:  
  `https://civicradarnh.github.io/civicradar/official-sources.html`
- Privacy policy URL (unchanged): `https://civicradarnh.github.io/civicradar/privacy.html`

### Full description (paste into Play Console)

```
CivicRadar — community hazard map for Mumbai, Pune & Thane

Pin civic hazards on a live ward map with photo evidence. Rally neighbours with Me too corroboration. Optionally file official complaints with your municipal corporation when you choose.

WHAT YOU CAN DO
• Report stagnant water, garbage, potholes, and broken streetlights
• See ward-level community map and leaderboards
• Track your official complaint number after you file with BMC, PMC, or TMC
• Volunteer pledges and neighbourhood cleanup coordination
• 4 languages: English, Hindi, Marathi, Gujarati
• Works offline as a PWA — install to Home Screen

DISCLAIMER — NOT A GOVERNMENT APP
CivicRadar is an independent community tool. It is NOT affiliated with, endorsed by, or operated by MCGM/BMC, PMC, TMC, or any government body. CivicRadar does not file complaints on your behalf.

OFFICIAL SOURCES (where YOU file complaints)
Full verified links: https://civicradarnh.github.io/civicradar/official-sources.html

Mumbai (MCGM/BMC):
• BMC online portal: https://www.mcgm.gov.in/
• Participate Mumbai: https://participatemumbai.mcgm.gov.in/
• Helpline: 1916

Pune (PMC):
• PMC citizen services: https://www.pmc.gov.in/
• Helpline: 1800 1030 222

Thane (TMC):
• TMC official website: https://www.thanecity.gov.in/

Maharashtra & national:
• Aaple Sarkar / CPGRAMS: https://pgportal.gov.in/
• Swachhata-MoHUA: https://www.swachh.city/

Privacy: https://civicradarnh.github.io/civicradar/privacy.html
Terms: https://civicradarnh.github.io/civicradar/terms.html
Delete data: https://civicradarnh.github.io/civicradar/delete-account.html

Built by students for neighbours — not by BMC or any government body.
```

**Short description (80 chars max):**  
Community hazard map for Mumbai, Pune & Thane — not a gov app. Official links inside.

---

## Production config checklist

```js
// js/config.js — before launch
founder: {
  email: 'your-real-support@domain.com',  // REQUIRED for stores
},
supabaseUrl: 'https://....supabase.co',   // REQUIRED to hide demo logins
supabaseAnonKey: 'eyJ...',
```

Run updated `supabase/schema.sql` (includes delete policies for account erasure).

---

## TWA / Bubblewrap quick commands

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://yourdomain.com/manifest.json
bubblewrap build
```

Generate PNG icons (512×512, 192×192) — replace emoji data-URI icons in `manifest.json` for store quality.

---

## Optional: robots.txt

`robots.txt` is included for crawlers. Legal pages are indexable; app shell is public.

---

## Review notes (paste for Apple/Google reviewers)

```
CivicRadar is a community hazard-reporting PWA for Mumbai monsoon season.

Test flow:
1. Accept Terms + Privacy (links open privacy.html / terms.html)
2. Select ward + display name
3. Allow location when prompted
4. Tap Report → capture photo → submit
5. Profile shows reports; Delete my data clears account

Demo partner logins are DISABLED when Supabase is configured.
Citizens use anonymous sync — no password required.

Not affiliated with BMC/MCGM. We deep-link to official complaint channels only.
```

---

## Summary: rejection risk

| Platform | Wrapper type | Risk | Mitigation |
|----------|--------------|------|------------|
| **Google Play** | TWA + complete Data safety | **Low–Medium** | Privacy URL, permissions, disclaimer, real icons |
| **Google Play** | Generic WebView | **Medium** | Prefer TWA |
| **Apple** | WebView-only | **Medium–High** | Add native features or ship PWA-only |
| **Apple** | Capacitor + push/offline UX | **Medium** | Strong review notes + moderation docs |
| **Both** | Missing privacy/deletion | **High** | Use implemented pages + Profile deletion |
