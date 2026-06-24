# Changelog

All notable changes to CivicRadar are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release process and environment details live in [`RELEASE.md`](./RELEASE.md).

## [Unreleased]

### Added
- **Coordinator access requests + approval workflow** — BMC officials and
  NGO/community coordinators can now request elevated access in-app (entry points
  in Profile, the partner portal, and the About modal). A low-friction request
  form (name, role, ward/city, one contact required; organization, proof photo,
  and note optional) submits even without logging in. The CivicRadar team reviews
  requests in an admin-only "Access requests" screen (reachable from the BMC
  queue) and approves/rejects with one tap; approving issues a one-time **claim
  code** the applicant enters to unlock their role. New `access_requests` table
  with RLS (anon/auth may INSERT a pending request only; admin-only read/update),
  an `admin` super-admin role on `profiles`, and `request_access` /
  `approve_access_request` / `reject_access_request` / `claim_access` RPCs. Works
  fully in local/no-Supabase mode (on-device queue). All UI strings localized in
  en/hi/mr/gu. **Requires re-running `supabase/schema.sql` and bootstrapping one
  super-admin.**
- Multi-city support for **Mumbai, Pune, and Thane** — per-city map centers,
  bounds, ward detection, and corporation channels (BMC / PMC CARE / TMC).
- Environment-aware configuration in `js/config.js` (and `js/config.example.js`):
  hostname-based `dev` / `staging` / `prod` detection that resolves
  `supabaseUrl`, `supabaseAnonKey`, and `publicUrl` per environment, with a safe
  fallback to production for unknown hosts.
- Release scaffolding: `RELEASE.md` runbook, PR-triggered E2E gate workflow
  (`.github/workflows/pr-checks.yml`), and an optional secret-guarded Cloudflare
  Pages preview workflow (`.github/workflows/preview-cloudflare.yml`).
- Admin proof-photo scan when resolving reports (resolution requires a proof
  photo).
- Soft photo-relevance confirmation prompt on report submission.
- Image-safety test scenarios in the E2E suite.

### Changed
- Anonymized founder identity across the public UI — no personal names shown
  ("The CivicRadar team"); contact via project email only.
- Migrated to a name-free public URL on the **civicradarNH** GitHub org
  (`https://civicradarnh.github.io/civicradar`).
- PWA icons moved from vector to raster for broader install/launch compatibility.
- Navigation Phase 1 improvements.
- E2E coverage expanded from **234 to 243** passing checks.

### Fixed
- Referral welcome banner behavior (shows on `?ref=`, hides after dismiss, stays
  hidden in demo tour).
- Single-language WhatsApp share — shared messages no longer duplicate content
  across multiple languages.
- Accessibility fixes.
- Offline / service-worker reliability fixes.
- Coordinator access copy no longer promises email when the applicant only
  provides a phone number; claim-code copy toast no longer references the team
  inbox instead of the applicant.
- BMC OTP fallback now accepts `admin` super-admin profiles (was signing them out).
- Magic-link callback hash errors routed through `formatAuthError` (no raw `{}`).
- Bottom-nav ghost taps ignored while the native camera / file picker is active.
- Twitter share no longer duplicates hashtag lines already in the template.

[Unreleased]: https://github.com/civicradarnh/civicradar/commits/main
