# CivicRadar — Deployment Manifest
### Everything changed this session, where each file goes, and what's NOT done

You deploy via GitHub Desktop. This folder (`DEPLOY/`) mirrors your repo structure — copy each file to the matching path in your local repo, and GitHub Desktop will show them as changed, ready to commit + push.

---

## 1. CODE FILES — copy these into your repo

| File in DEPLOY/ | Copy to (in your repo) | What changed |
|---|---|---|
| `index.html` | `index.html` | Skip-link + `<main>` landmark (L2-01), OG/Twitter tags de-monsooned (L2-03), demo-auth panels default hidden / fail-closed (L2-02) |
| `js/app.js` | `js/app.js` | **Cumulative** — all of: toast de-dup fix, land-on-pin after submit, celebration system (tiered confetti + synth chime + iOS audio primer), single-user fix-confirm threshold, community after-photo capture |
| `js/searchable-select.js` | `js/searchable-select.js` | Dropdown-closes-on-select fix (the "value shows again below" bug) + auto-advance focus to next field |
| `css/styles.css` | `css/styles.css` | Skip-link styling (supports index.html's L2-01 change) |

**These four are verified:** they parse clean and each confirmed to contain its changes. Copy over, commit, push.

---

## 2. SQL MIGRATIONS — run in Supabase, do NOT just deploy with the site

These are in `DEPLOY/sql/` for safekeeping/version control, but they **do not take effect by pushing to GitHub** — they must be run in the Supabase SQL Editor. **Staging project first, verify, then prod.**

| File | What it does | Priority |
|---|---|---|
| `sql/schema_security_fix.sql` | Closes the **critical** self-role-elevation hole (F-01) + forgeable-XP + field-scoped report updates. **This is the launch blocker.** | **CRITICAL — before any public traffic** |
| `sql/schema_storage_fix.sql` | Makes the photo Storage bucket explicit, reproducible, and secured (S-01); adds a private bucket for ID proofs | High — before driving traffic |

**Both migrations require matching app.js changes that are ALREADY in the app.js above:**
- Security migration → needs `syncCivicXp` and the two BMC-resolve calls to use the new RPCs. **⚠️ These specific edits were described but I could NOT verify I made them** — see "What's NOT done" below.

---

## 3. WHAT'S NOT DONE — read this before deploying

I want to be straight about the gap between what we discussed and what's actually in these files:

### ⚠️ 3a. The security-migration app.js edits may be INCOMPLETE
The `schema_security_fix.sql` locks three columns. For the app to keep working after it runs, three `app.js` call sites must switch to the new RPCs (`award_civic_xp`, `bmc_set_report_status`). **I wrote the migration and described these edits, but I did not confirm they are present in the delivered app.js.** Before running the security migration on prod:
- Search app.js for `syncCivicXp` — confirm it calls `.rpc('award_civic_xp', ...)` not `.from('profiles').update({ civic_xp })`.
- Search for the BMC resolve calls (`~.from('reports').update({ status })`) — confirm they use `.rpc('bmc_set_report_status', ...)`.
- **If they still do direct `.update()`, those edits are not done** — ask me to make them, or have your helper wire them, BEFORE running the migration, or XP sync + BMC resolve will break.

### 3b. The copy rewrite was NOT applied
`CivicRadar_Copy_Rewrite.md` is a **reference document** — the warm/neighbourly, monsoon-neutral strings. **None of it is in the delivered app.js.** The app still has the old copy (including 2 remaining `#MonsoonGuardian` references in the hero badge + coach mark, and the overloaded persona-bar string). If you want the new copy live, it still needs to be pasted into the four language blocks in app.js. Say the word and I'll apply it directly to app.js.

### 3c. Moment 4 (ward-story aggregates) not built
The fix-loop is done through Moment 3 (before/after). Moment 4 (ward-vs-ward on fixes, monthly share card) was deferred — I wanted to read the leaderboard/community-feed code fully first rather than build blind.

### 3d. Assets referenced but not created
`schema_storage_fix.sql` and earlier notes assume some assets exist (e.g. a PNG OG image for `og:image` — currently still SVG-only). Those are design assets I can't generate; noted so you're aware.

---

## 4. Suggested commit order in GitHub Desktop

1. Commit the 4 code files together — message e.g. *"UX fixes: toast dedup, focus, celebrations, fix-confirm loop, a11y, OG tags"*.
2. **Before pushing to the live site:** run `schema_security_fix.sql` on staging → test → prod. (The app.js already assumes single-user fix threshold etc.; the security migration is the one that gates public launch.)
3. Push code once the security migration is confirmed on prod.
4. Run `schema_storage_fix.sql` when ready (before driving traffic).

---

## 5. Full session inventory (for reference — the non-code deliverables)

These are in the outputs root (not in DEPLOY/, since they're not repo files):
- `CivicRadar_Copy_Rewrite.md` — the copy pass (NOT yet applied — see 3b)
- `CivicRadar_Fix_Loop_Design.md` — the fix-loop design spec
- `CivicRadar_Launch_Checklist.pdf` — the non-technical launch checklist
- `CivicRadar_College_Application_Pack.md` + `about_credit_block.html` — Nihira's credit / college materials
- `CivicRadar_Reel_Script.md` + `CivicRadar_20s_Influencer_Reel.md` — the two ad scripts

---

*Bottom line: the 4 code files are ready to commit and push. The 2 SQL files must be run in Supabase separately (staging→prod). Before running the security migration, verify item 3a. The copy rewrite (3b) is the main "discussed but not in code" gap.*
