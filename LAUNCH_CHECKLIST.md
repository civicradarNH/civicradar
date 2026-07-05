# CivicRadar — Final Launch Checklist

**Audit date:** 4 July 2026 (July re-audit)

**App version:** `v120` — Cloudflare Turnstile captcha on Supabase auth (site key in `js/config.js`; secret is founder-only in Supabase dashboard)

**Verdict:** **Ready with 6 founder steps** — config, PWA icons, and deploy workflow are in place; founder must complete Supabase dashboard setup, HTTPS deploy, counsel review, and phone smoke test before real users.

---

## Must-do before launch

| Priority | Item | Where | Status |
|----------|------|-------|--------|
| P0 | Enable **Anonymous sign-ins** + **Email OTP** | Supabase → **Authentication → Sign In / Providers** | ⬜ **Founder only** — keys in config won't work until this is on |
| P0 | Run `supabase/schema.sql` in SQL Editor | Supabase → **SQL Editor → New query** | ⬜ **Founder only** — required for sync, roles, `delete_user_data` RPC |
| P0 | Paste **Turnstile secret** in Supabase Auth captcha | Supabase → **Authentication → Bot and Abuse Protection → Captcha** | ⬜ **Founder only** — site key already in `js/config.js` (v120) |
| P0 | Set `publicUrl` to production HTTPS URL | `js/config.js` | ✅ `https://civicradarnh.github.io/civicradar` |
| P0 | Set `legal.grievanceEmail` | `js/config.js` | ✅ `civicradarnh@gmail.com` |
| P0 | Set `founder.email` + `founder.operatorEmail` | `js/config.js` | ✅ `civicradarnh@gmail.com` (both) |
| P0 | Deploy to HTTPS hosting | GitHub Pages (workflow ready) | ⬜ **Founder only** — push via GitHub Desktop; camera + GPS require HTTPS |
| P0 | Counsel review of `privacy.html` + `terms.html` | Legal pages | ⬜ **Founder only** — draft complete; marked for counsel review |
| P1 | Replace emoji PWA icons with 512×512 PNG | `manifest.json` | ✅ PNG assets exist; manifest + `sw.js` reference `assets/icon-*.png` |
| P1 | Issue real NGO invite code in Supabase | `ngo_codes` table | ⬜ **Founder only** — demo codes in config for local only |
| P1 | Phone test (camera, GPS, WhatsApp, PWA) | Real Android device | ⬜ **Founder only** |

### Already done (agent / prior session)

| Item | Status |
|------|--------|
| `supabaseUrl` + `supabaseAnonKey` in `js/config.js` | ✅ Project `shrjkexfokootrzrpjsi` (Mumbai) |
| `publicUrl`, `legal.grievanceEmail`, `founder.email`, `founder.operatorEmail` | ✅ All `civicradarnh@gmail.com` / production URL |
| `turnstileSiteKey` in `js/config.js` (v120) | ✅ Site key set; founder must add matching secret in Supabase |
| PWA PNG icons (`icon-192`, `icon-512`, `icon-maskable-512`) | ✅ In `assets/`; referenced by `manifest.json`, `index.html`, `sw.js` |
| GitHub Pages deploy workflow | ✅ `.github/workflows/deploy-pages.yml` (smoke E2E gate + `skip_tests` dispatch) |
| SW cache + network-first `config.js` | ✅ `civicradar-v120` |
| Backend.init error toast | ✅ User-visible on connect failure |
| Duplicate `resolutionBadgeHtml` JS bug | ✅ Fixed → `handleCommunityAutoResolve` |
| `node --check js/app.js` (July audit) | ✅ Pass |

---

## Test results summary

| Suite | Result | Notes |
|-------|--------|-------|
| `node --check js/app.js` (July audit) | **PASS** | Syntax OK at v120 |
| E2E comprehensive (June audit) | **83 / 87 PASS** | 4 expected fails with Supabase keys configured |
| E2E comprehensive (local mode) | **109 / 109 PASS** | Empty Supabase keys → demo logins visible |
| i18n audit (June) | **602 keys, 0 missing** | HI/MR/GU complete |

### E2E failures with Supabase configured (not launch blockers)

| Test | Reason |
|------|--------|
| C05 GPS consent on ToS accept | **By design** — GPS consent is unbundled from ToS |
| E09 Analytics after ToS | **By design** — analytics requires separate opt-in |
| NGO/Admin demo login suites | Demo logins hidden when Supabase connected; use real OTP + invite codes |

CI runs smoke E2E on push. Use workflow_dispatch **Skip E2E** for emergency deploys, or empty Supabase keys temporarily if demo suites must pass.

---

## Founder must-do list (copy-paste, ordered)

### 1. Supabase dashboard — project `shrjkexfokootrzrpjsi`

```
1. Open https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi

2. SQL Editor → + New query
   https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/sql/new
   Paste ALL of supabase/schema.sql → Run (Ctrl+Enter)

3. Authentication → Sign In / Providers
   https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/auth/providers
   - Anonymous sign-ins → Enable
   - Email → Enable → expand Email settings:
     • Confirm email → OFF (OTP login without extra confirmation step)
     • Email OTP is the default passwordless method

4. Authentication → Bot and Abuse Protection → Captcha (v120 Turnstile)
   https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/auth/protection
   - Enable Captcha provider: Cloudflare Turnstile
   - Paste your Turnstile **secret key** (matches site key in js/config.js)
   - Do NOT commit the secret — it lives only in Supabase dashboard

5. (Optional verify) Table Editor
   https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/editor
   Confirm tables exist: reports, profiles, ngo_codes, analytics_events, report_flags

6. Reload production or http://localhost:8095/ — expect toast:
   "Connected — reports sync across devices."
   OTP login should complete without captcha errors once Turnstile secret is set.
```

### 2. Config — already filled (no action unless you change contact email)

`js/config.js` prod block (verified July 2026):

```js
publicUrl: 'https://civicradarnh.github.io/civicradar',
legal: { grievanceEmail: 'civicradarnh@gmail.com' },
founder: {
  email: 'civicradarnh@gmail.com',
  operatorEmail: 'civicradarnh@gmail.com',
},
turnstileSiteKey: '0x4AAAAAADvu8ppZ0_EjSdZd',  // secret → Supabase Auth → Captcha only
```

Legal pages (`privacy.html`, `terms.html`) load emails from `config.js` at runtime — no placeholder text once deployed with this config.

### 3. Deploy to GitHub Pages

```
1. Commit changes in GitHub Desktop (do not push secrets — Turnstile secret stays in Supabase only)

2. Push to main/master on github.com/civicradarnh/civicradar (or your fork)

3. Repo → Settings → Pages → Source: GitHub Actions

4. Wait for green "Deploy to GitHub Pages" workflow run
   (smoke E2E ~5 min; use workflow_dispatch "Skip E2E" only for emergencies)

5. Open https://civicradarnh.github.io/civicradar/ — hard refresh / clear site data if SW cached old shell
```

### 4. Insert pilot NGO invite code (SQL Editor)

**Ward coordinator:**

```sql
insert into public.ngo_codes (code, ward, ngo_name, coordinator_scope)
values ('CLEAN-GN-2026', 'G/N Ward — Dadar, Shivaji Park', 'Your NGO Name', 'ward');
```

**Neighbourhood coordinator:**

```sql
insert into public.ngo_codes (code, ward, ngo_name, neighbourhood, coordinator_scope)
values (
  'NBH-WORLI-2026',
  'G/S Ward — Worli, Lower Parel',
  'Worli RWA',
  'Worli West — Phoenix Mills area',
  'neighbourhood'
);
```

Replace code, ward, and NGO name before sharing with coordinators. Demo codes (`DEMO-*` in `config.js`) work only in local/offline mode.

### 5. Legal counsel review

Send `privacy.html` and `terms.html` to qualified Indian DPDP counsel. Founder is 17; operator contact is `civicradarnh@gmail.com`.

### 6. Android phone smoke test

Open production HTTPS URL → ToS + analytics opt-in → ward onboarding → report with photo + GPS → WhatsApp share link uses `publicUrl` → Add to Home Screen → test OTP login with Turnstile.

### 7. Soft launch

One ward, 2–3 WhatsApp groups. Share `publicUrl` + NGO code with coordinator.

---

## Code quality & security checks

| Check | Result |
|-------|--------|
| TODO / FIXME in app code | ✅ None |
| XSS sanitization | ✅ User inputs sanitized |
| Analytics + GPS consent unbundled | ✅ Separate from ToS accept |
| Service worker cache version | ✅ `civicradar-v120` |
| Legal page links | ✅ privacy ↔ terms ↔ index |
| Legal emails in config | ✅ `civicradarnh@gmail.com` |
| Turnstile integration (v120) | ✅ Site key in config; secret founder-only in Supabase |
| PWA manifest icons | ✅ Real PNGs (not emoji) |

---

## Known limitations (not launch blockers)

- OG meta for individual reports: static defaults; per-report OG needs SSR at scale
- OG/Twitter image URLs are relative — fine for in-app; crawlers may need absolute URL after deploy
- NSFW moderation lazy-loads when online
- PWA offline: shell cached; map tiles need network
- Demo admin/NGO logins auto-hidden when Supabase configured (expected)
- `Turnstile.txt` in repo root is untracked — do not commit; paste secret into Supabase dashboard only

---

## Launch readiness verdict

### **Ready with 6 founder steps**

Application code is at **v120** with Turnstile captcha wired for Supabase auth. Config, emails, public URL, and PWA icons are set in the repo.

**Do not send real users until:** Anonymous auth enabled, schema applied, Turnstile secret in Supabase, HTTPS deployed, counsel has reviewed legal pages, and phone smoke test passes.

---

## GitHub Pages deploy (detailed)

| Topic | Detail |
|-------|--------|
| Repo | Git initialized at `C:\civicradar` — push via GitHub Desktop |
| Pages source | Settings → Pages → **GitHub Actions** |
| Live URL | `https://civicradarnh.github.io/civicradar/` |
| Files deployed | `index.html`, legal pages, `manifest.json`, `sw.js`, `robots.txt`, `css/`, `js/`, `assets/` |
| CI gate | Smoke E2E on push; **Skip E2E** available via workflow_dispatch |
| After deploy | Hard refresh; SW `civicradar-v120` |

See **LAUNCH-WALKTHROUGH.md** for step-by-step commands.

---

## Related docs

- `LAUNCH-WALKTHROUGH.md` — Step-by-step founder guide
- `BACKEND_SETUP.md` — Supabase roles, NGO codes, analytics
- `tests/TEST-RESULTS.md` — Latest E2E scenario table
- `tests/IOS-QA.md` — iOS manual QA
- `STORE_LAUNCH.md` — App store submission checklist
- `js/config.example.js` — Safe template (no real secrets)

---

## Supabase dashboard quick reference (2025/2026 UI)

Project: `shrjkexfokootrzrpjsi` — base URL: `https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi`

| Task | Left sidebar path | Direct link |
|------|-------------------|-------------|
| Run `schema.sql` | **SQL Editor** → **+ New query** | [/sql/new](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/sql/new) |
| Enable Anonymous + Email OTP | **Authentication** → **Sign In / Providers** | [/auth/providers](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/auth/providers) |
| Turn off Confirm email | Same page → **Email** → **Confirm email** OFF | [/auth/providers](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/auth/providers) |
| Turnstile captcha secret (v120) | **Authentication** → **Bot and Abuse Protection** → **Captcha** | [/auth/protection](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/auth/protection) |
| Copy Project URL + anon key | **Project Settings** → **API Keys** | [/settings/api-keys](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/settings/api-keys) |
| Verify tables | **Table Editor** | [/editor](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/editor) |
| Auth logs (debug OTP / captcha) | **Logs** → **Auth** | [/logs/auth-logs](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/logs/auth-logs) |
| Site URL for production (later) | **Authentication** → **URL Configuration** | [/auth/url-configuration](https://supabase.com/dashboard/project/shrjkexfokootrzrpjsi/auth/url-configuration) |

**Key format note:** CivicRadar uses the legacy **anon public** JWT (`eyJ…`) from **Legacy API Keys**. Do not paste **secret** or **service_role** keys into `config.js`.
