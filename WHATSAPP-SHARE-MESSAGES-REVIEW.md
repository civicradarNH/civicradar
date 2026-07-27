# CivicRadar — WhatsApp share message content review

Report only, no code changed. Scope: every prewritten WhatsApp message the
app generates for the user to send — report-pinned share, Me too, Challenge
a friend, cleanup win, resolved win, self-resolve win, weekly recap, app
invite/referral, and the XP certificate. This is content review; the
technical bug where these messages open WhatsApp *blank* on real phones is
already covered in [WHATSAPP-PREFILL-FIX-SPEC.md](WHATSAPP-PREFILL-FIX-SPEC.md)
— fix 3f there (`shareWhatsApp()`, `js/app.js:38962`) is the same
`wa.me`→`api.whatsapp.com` domain fix and applies to every message below
too, since they all route through that one function.

**Full inventory** — nine distinct message templates, all built with
`fillShareTemplate()` (`js/app.js:38241`) except the certificate caption:

| Trigger | Builder | i18n key |
|---|---|---|
| Report pinned → "Share on WhatsApp" | `buildShareReportMessage` | `success.shareMsg` |
| "Me too" backing a report | `buildShareMeTooMessage` | `share.meTooMsg` |
| Community tab → "Challenge a friend" | `buildShareWardMapMessage` | `share.wardMapMsg` |
| Volunteer cleanup logged → share win | `buildShareCleanupMessage` | `share.cleanupMsg` |
| Report resolved → share win | `buildShareResolvedMessage` | `confirm.shareResolvedMsg` |
| Self-resolve confirm → share | `buildShareBackedMessage` | `confirm.shareMsg` |
| Weekly recap share | `buildWeeklyRecapMessage` | `share.weeklyRecap` |
| Generic "Share CivicRadar" / referral | `buildDefaultShareMessage` | `share.appMsg` |
| About modal → "Copy WhatsApp pitch" | `copySharePitch` | `about.sharePitch` |
| XP certificate → share | `buildCertificateCaption` | `cert.caption` |

---

## 1. `#MonsoonGuardian` is hardcoded into almost every one of these messages

`buildHashtagLine()` (`js/app.js:38151`):

```js
function buildHashtagLine(ward) {
  const wh = getWardHashtag(ward || user.ward);
  return `#CivicRadar #MonsoonGuardian ${wh}`;
}
```

This feeds the `{hashtags}` placeholder in `fillShareTemplate()`, which
every template above except `cert.caption` uses. That means a Pune user
sharing a **pothole** report, or a Thane user sharing a **broken
streetlight** fix, or a "Challenge a friend" invite sent in the middle of
January, all get `#MonsoonGuardian` appended — regardless of hazard type or
season. `about.sharePitch`'s copy-to-clipboard path
(`copySharePitch()`, `js/app.js:18772-18783`) appends the same hashtag line
manually, so it's affected too. In practice this is **every WhatsApp/share
surface in the app**, all nine templates.

This is the same root pattern already flagged in
[CONTENT-WORDINESS-REVIEW.md](CONTENT-WORDINESS-REVIEW.md) (`#MumbaiMonsoon`
/`#ThaneMonsoon` in the escalation tier-3 tweet templates) — copy written
during the monsoon-focused early build that never got generalized when the
app became explicitly multi-hazard (per this project's own CLAUDE.md: "app
is multi-hazard, not monsoon-only"). This instance is more pervasive than
that one, since it isn't confined to one tier of one modal — it's in the
one function nearly every share message calls.

**Fix:** drop `#MonsoonGuardian` from `buildHashtagLine()`:

```js
function buildHashtagLine(ward) {
  const wh = getWardHashtag(ward || user.ward);
  return `#CivicRadar ${wh}`;
}
```

If a seasonal hashtag is genuinely wanted during the monsoon months, make
it conditional on the current date (India's monsoon is roughly June–
September) rather than permanent — but the simplest, safest fix is to just
drop it, matching the app's own stated multi-hazard identity.

## 2. `cert.caption` bakes the same monsoon assumption directly into prose (not just a hashtag)

Current: *"I earned {level} on CivicRadar — join me protecting {ward}
**this monsoon**!\n{link}"*

Unlike the hashtag, this can't be filtered out by a reader who doesn't care
about hashtags — it's the actual sentence. A citizen who earns a Civic Hero
level in November for logging pothole reports is asked to share a message
claiming they're protecting their ward "this monsoon."

**Fix:** *"I earned {level} on CivicRadar — join me keeping {ward}
safer!\n{link}"*

(Also note: this is the only one of the nine templates that doesn't append
`{hashtags}` at all — worth a deliberate decision either way, but currently
looks like an oversight rather than a choice, since every other share
message gets hashtags and this one silently doesn't.)

## 3. Two independently-maintained "invite someone to CivicRadar" messages, already drifting apart

`share.appMsg` (used by the direct "Share CivicRadar" button, via
`buildDefaultShareMessage`):

> {city} ward hazard map — pin garbage, potholes, streetlights & stagnant
> water. Me too, beat rival wards!
> {link}
> {hashtags}

`about.sharePitch` (used by the About modal's "Copy WhatsApp pitch"
button, via `copySharePitch`):

> Free {city} ward hazard map — pin garbage, potholes, streetlights &
> stagnant water in 30 sec. Me too, beat rival wards.
> Built for Mumbai, Pune & Thane. No login, 4 languages.
> {link}
> Forward to your RWA / society WhatsApp group

These exist for the same purpose — get someone to install/try the app —
and open with nearly identical phrasing, but have already diverged: one
says "beat rival wards!" (exclamation), the other "beat rival wards."
(period); one has an explicit "no login, 4 languages" trust-building line
and a "forward to your RWA" instruction, the other doesn't. Two people
maintaining two copies of the same pitch is exactly how they end up saying
subtly different things, and a future copy edit to one is easy to forget
to make in the other.

**Recommendation:** consolidate to one canonical invite message. The About
version's extra context (no-login, 4 languages, explicit forward
instruction) is genuinely useful for a "copy this and paste it wherever"
use case — recommend keeping that richer version as the canonical one and
having `buildDefaultShareMessage()` use it too, rather than the shorter
`share.appMsg`.

## 4. "So local officials take action faster" — a claim the app's own legal copy is careful not to make elsewhere

Two templates use this exact justification for why someone should tap
"Me too":

- `success.shareMsg`: *"Back this spot with 'Me too' so local officials
  take action faster"*
- `share.meTooMsg`: *"Join in so local officials take action faster"*

CivicRadar's own Terms of Service (Section 3) is explicit that the app
does **not** guarantee municipal action or response times, and that
community corroboration is separate from actually filing an official
complaint. A "Me too" tap doesn't notify BMC/PMC/TMC of anything — only
filing does. Telling an invited neighbour that backing a pin makes
officials act faster overstates what the mechanism actually does, and sits
oddly next to how carefully the legal pages avoid exactly this kind of
claim.

**Fix — soften to what "Me too" actually accomplishes** (visibility and
weight of evidence, not a direct line to officials):

- `success.shareMsg`: *"Back this spot with 'Me too' so it's harder to
  ignore"*
- `share.meTooMsg`: *"Join in — more neighbours means more weight when
  someone files"*

(Second option deliberately nods at the real mechanism — official action
still requires someone to file — without turning the share message into a
disclaimer.)

## 5. Gujarati translations of two templates added emoji the other three languages don't have

Comparing all four language blocks for the same two keys:

**`confirm.shareMsg`** (self-resolve win share):
- en: *"Hazard I flagged in {ward} is FIXED on CivicRadar! Community
  pressure works:\n{link}\n{hashtags}"*
- hi / mr: same structure, no emoji
- gu: *"**✅** {ward} માં જોખમ CivicRadar પર ઠીક! ..."* — leading ✅ not
  present in the other three languages

**`share.weeklyRecap`**:
- en: *"{ward} this week: {reports} new, {resolved} fixed, {backed}
  backed. Join on CivicRadar\n{link}\n{hashtags}"*
- hi / mr: same structure, no emoji
- gu: *"**📊** આ અઠવાડિયે {ward}: ... CivicRadar પર જોડાઓ **👇**\n{link}\n{hashtags}"*
  — leading 📊 and trailing 👇, neither present elsewhere

This isn't wrong on its own — emoji are used consistently across all four
languages in other templates (`success.shareMsg` and `share.meTooMsg` both
use ⚠️ and 👉 in every language). But these two specific templates are
emoji-free in three languages and emoji-decorated only in Gujarati, which
reads as drift rather than a deliberate per-language style choice.

**Fix:** either add the matching emoji to en/hi/mr for these two keys, or
remove them from Gujarati — recommend the latter, to keep these two
specific templates in the plainer, stat-forward style the other three
languages already use for them.

## 6. Minor: `share.weeklyRecap`'s "Join on CivicRadar" reads slightly off

*"{ward} this week: {reports} new, {resolved} fixed, {backed} backed.
**Join on CivicRadar**\n{link}"* — "Join on" isn't quite idiomatic English.
**Fix:** *"Join CivicRadar"* or *"Join us on CivicRadar"*.

---

## What's already working well (no changes needed)

- `share.wardMapMsg` ("Challenge a friend"): 🎯 framing, clear stat, clear
  CTA — good template for a gamified invite, no findings.
- `share.cleanupMsg` / `confirm.shareResolvedMsg`: both lead with the
  outcome, promise "before → after," and stay to two lines plus link —
  tight and effective, assuming the linked page actually shows a
  before/after image pair (worth a quick manual check, not a copy issue).
- `confirm.shareMsg`: "Community pressure works" is a good, earned tagline
  — keep as-is (just needs the hashtag fix from item 1).
- `share.appMsg`'s core sentence (once merged per item 3) already frames
  the app correctly as multi-hazard — "pin garbage, potholes, streetlights
  & stagnant water" — no monsoon-only bias in the prose itself.

---

## Priority summary

| Item | Type | Effort | Why it matters |
|---|---|---|---|
| 1. `#MonsoonGuardian` in `buildHashtagLine()` | Bug-adjacent | XS | Appears on ~9 of 9 share surfaces, contradicts app's own multi-hazard framing, one-line fix |
| 2. `cert.caption` "this monsoon" | Bug-adjacent | XS | Same issue, in prose rather than a hashtag — harder for a user to just ignore |
| 4. "Officials take action faster" claim | Accuracy/trust | XS | Overstates what Me-too actually does; app's own legal copy is careful not to claim this |
| 3. Duplicate app-invite pitch (`share.appMsg` vs `about.sharePitch`) | De-dup | S | Two independently-maintained messages for the same CTA, already diverged |
| 5. Gujarati-only emoji on 2 templates | Consistency | XS | Cross-language drift, not a deliberate style choice |
| 6. "Join on CivicRadar" phrasing | Wordiness | XS | Minor, non-idiomatic |

Also worth doing while touching `buildHashtagLine()` and `shareWhatsApp()`:
apply the `wa.me` → `api.whatsapp.com` domain fix from
[WHATSAPP-PREFILL-FIX-SPEC.md](WHATSAPP-PREFILL-FIX-SPEC.md) fix 3f at the
same time, since all nine of these messages go through that one function
and share the same on-device reliability risk as the BMC/PMC/TMC filing
WhatsApp buttons.
