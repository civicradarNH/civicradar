# CivicRadar — Messaging systems audit: toasts, confirms, banners, inline errors

Report only. No code was changed. Covers every popup/message surface in the app:
the toast engine (~150 call sites), confirm dialogs, floating banners/nudges, and
inline field-validation errors. All findings are grounded in exact file:line
locations so each is a mechanical fix, not a re-investigation.

---

## Executive summary

**What's already solid — worth knowing before "fixing" anything:**
- There is **one toast engine** (`showToast()`, `js/app.js:23762`), not several
  competing systems. "Snackbar" is not a second component — it's a CSS modifier
  (`.toast--snackbar`) and a naming convention for the WhatsApp/action-CTA variant
  of the same toast. Good architecture underneath.
- There are **no live native `alert()`/`confirm()`/`prompt()` dialogs** anywhere
  in the app. The one `window.confirm(` reference is a defensive fallback inside
  `confirmAction()`, reached only if the custom modal DOM is missing — never hit
  in normal operation. The app is consistently modal-based, as intended.

**What needs attention — four real inconsistency clusters, in order of how much
they'd actually confuse a user or a screen reader:**

1. **Inline field errors use three different visual/semantic treatments** for the
   same job, and one of the three is missing `role="alert"` entirely — a real
   accessibility gap, not just a style nit. (§4)
2. **Banners have no shared rules** for dismiss mechanism, storage (localStorage
   vs sessionStorage), or z-index — and the guard that prevents banners stacking
   on each other doesn't cover all of them, so two *can* visually overlap. (§3)
3. **Toast durations are assigned ad hoc** — a 3× range (1600ms–12000ms) with no
   visible rule connecting duration to message length or severity, plus a
   `warning` severity that's referenced in copy/design tokens but doesn't exist
   as an actual toast type. (§1)
4. **The generic confirm dialog's customization options go unused** — every one
   of its 6 call sites accepts the default "Cancel"/"Confirm" buttons instead of
   an action-specific label, even though the API already supports one. (§2)

Plus two pieces of dead/misleading CSS worth a cleanup pass (§1).

---

## 1. Toast system

**Engine:** `showToast(message, type = 'info', duration = 3500, action = null)`,
`js/app.js:23762`. Types: `info` / `success` / `error` only — **no `warning`
type exists**, despite `--warning`-family CSS tokens existing elsewhere in the
design system (`dashboard-stat--warn`, `.esc-complaint-warn` uses
`--warning-fg`). Any toast that's "heads up, not quite a failure" currently gets
typed `info` or `error` by whoever wrote that call site, with no consistent rule:

| Example | Typed as | Arguably should be |
|---|---|---|
| `toast.pledgeWardMismatch` — "this doesn't match your ward" | `info` | closer to `warning` |
| `lead.errAlreadyVoted` — "you already voted" | `info` | closer to `warning` |
| `toast.pledgeDuplicate` — duplicate pledge blocked | `error` | closer to `warning` (not a failure, just a no-op) |

**Fix:** either add a real `warning` type (new `.toast--warning` CSS + icon
mapping) and re-triage the ambiguous call sites into it, or explicitly decide the
app only needs two severities (info/success vs. error) and stop reaching for
`error` on things that aren't failures — either is fine, but right now it's
neither, it's per-call-site guesswork.

### 1a. Duration has no visible rule (P1)

Explicit durations across ~150 call sites range from **1600ms to 12000ms** with
no consistent mapping to message length, severity, or whether an action button
is present. A few concrete anomalies:

- `lang.native` (language-switch confirmation) — **1600ms**. Likely too short to
  read and register before it's gone.
- Nudge-with-action toasts (`reminder.unfiled`, `reminder.staleCheck` ×2,
  `notify.report`) are all **9000ms** — this sub-group is internally consistent,
  good pattern, worth keeping as the explicit standard for "toast with an action
  button" going forward.
- `analytics.prompt` (consent prompt with action) — **12000ms**, the single
  longest duration in the app, for a toast in the same "action toast" family that
  otherwise standardizes on 9000ms. No stated reason it needs 3s more.
- The **close (×) button only renders when `sticky || duration >= 4000`**
  (`js/app.js:24026`) — meaning any short toast using the function's own default
  (`3500ms`, dozens of validation-error call sites like `toast.wardRequired`,
  `toast.hazardTypeRequired`, `toast.photoRequired`) has **no way to dismiss it
  early**. For an error toast specifically — the type that triggers a haptic
  buzz and is most likely to be read carefully — giving the user no close button
  and only 3.5s is the wrong pairing.

**Fix:** define 3–4 named duration tiers (e.g. `SHORT=2500` /
`STANDARD=4000` / `WITH_ACTION=9000` / `STICKY=0`) and have call sites pick a
tier instead of a bespoke number each time. Bump the default from 3500 to at
least 4000 so ordinary error toasts get a close button by default — the current
3500 default sits *just* under that 4000 threshold, which looks like an
off-by-a-little accident rather than a decision.

### 1b. Two toast CSS blocks — the second silently wins (P2, hygiene)

`.toast-container` and `.toast` are each defined **twice** in `css/styles.css`
— once in an earlier block (~line 2273) and again in a later, more specific
block (~line 12022, `/* Toast → top snackbar */`). The later block overrides
`z-index`, `padding`, `font-size`, and the entry/exit animation for every
property they share. Concretely:

- `--z-toast: 2150` is declared as the design token (`css/styles.css:137`,
  commented "snackbars; below `--z-modal`") but the **actual applied z-index is
  a hardcoded `9999`** from the later block — meaning toasts render above
  *everything*, including open modals (`--z-modal` is 2200). That may well be
  the correct real-world behavior (a validation-error toast fired while a modal
  is open should be visible), but the documented token is simply wrong about
  what value is in effect — anyone reading `--z-toast: 2150` would assume toasts
  sit under modals, and they don't.
- `@keyframes toast-in`/`toast-out` (first block, ~line 2505) are fully defined
  but **dead** — the later block's `.toast` rule overrides `animation` to use
  `snackbar-in`/`snackbar-out` instead, so `toast-in`/`toast-out` never run.
- A bare `.snackbar` selector exists at `css/styles.css:12865` — it matches
  **no element in the app** (nothing ever gets `className="snackbar"` without
  the `.toast` prefix); leftover from before the `.toast--snackbar` modifier
  pattern was adopted.

**Fix:** consolidate the two `.toast`/`.toast-container` blocks into one
(delete the earlier, fully-overridden one), delete the dead `toast-in`/`toast-out`
keyframes, delete the dead `.snackbar` selector, and update the `--z-toast`
comment/value to match the real `9999` in effect (or move the real rule to use
the variable, so the token is the actual source of truth again).

---

## 2. Confirm dialogs

**Two systems, both legitimate — not a redundancy problem:**

- **Generic** — `confirmAction(opts)` (`js/app.js:34588-34643`), backing
  `#genericConfirmOverlay`. A proper `window.confirm()` replacement: takes
  `title` (optional), `body`, `confirmLabel`/`cancelLabel` (both optional,
  default "Confirm"/"Cancel"), `danger` (bool, default `true`), `success` (bool).
  Resolves a Promise\<boolean\>.
- **Delete-my-data** — bespoke `#deleteConfirmOverlay`, opened directly via
  `openModal('deleteConfirm')`. Genuinely needs to be separate: it renders a
  4-item bulleted list of exactly what gets deleted, which the generic dialog's
  API has no mechanism for. Reasonable to keep bespoke.

### 2a. Every generic-confirm call site skips the customization it has (P1)

All 6 call sites pass **only** `body` — none pass `title`, `confirmLabel`, or
`cancelLabel`, despite the API supporting all three:

| Call site | Body (shortened) | Button says |
|---|---|---|
| `js/app.js:32724` | "Hide this pin and flag it for review...?" | "Confirm" |
| `js/app.js:32738` | "Hide all pins from this reporter...?" | "Confirm" |
| `js/app.js:44672` | "Remove this report from the public map...?" | "Confirm" |
| `js/app.js:45971` | "Remove your volunteer signup? Cannot be undone." | "Confirm" |
| `js/app.js:46719` | "Mark this pledge as delivered? Cannot be undone." | "Confirm" |
| `js/app.js:46777` | "Verify these volunteer hours? Cannot be undone." | "Confirm" |

A generic "Confirm" button after a specific, sometimes-consequential question is
weaker than an action-named button ("Hide pin" / "Remove report" / "Mark
delivered") — the delete-my-data dialog already demonstrates the better pattern
("Yes, delete everything" vs. a bare "Confirm"). Since the API already accepts
`confirmLabel`, this is a copy-only fix at each of the 6 call sites, not a
capability gap.

**Also worth checking:** two of the six (`pledge.deliverConfirm`,
`pledge.verifyConfirm`) explicitly pass `danger: false` while their body text
still says "This cannot be undone" — the same irreversibility warning rendered
in neutral styling in some places and red danger-styling in others (the other
four). That split may be intentional (destructive vs. administrative-but-final),
but it's worth a deliberate pass to confirm it's a rule and not four coincidences.

---

## 3. Banners

Seven floating/inline nudges: `#locationBanner`, `#manualPinBanner`,
`#appOpenBanner`, `#referralWelcome`, `#iosInstallHint`, `#pwaInstallNudge`,
`#seasonHook`. No shared base component — each has its own markup, dismiss
logic, and positioning rules.

### 3a. The stacking guard doesn't cover all of them (P1 — can actually break)

`isAnyBannerVisible()` (`js/app.js:20726`) only manages mutual exclusion between
`appOpenBanner`, `referralWelcome`, `homeHero`, and `iosInstallHint`.
**`locationBanner`, `manualPinBanner`, `pwaInstallNudge`, and `seasonHook` are
not covered.** Three of the uncovered ones — `locationBanner`, `manualPinBanner`,
and `iosInstallHint` — all position at effectively the same offset
(`top: calc(header + persona-bar + ward-pulse + 8px)`, `css/styles.css:1849`,
`2090`, `2859`) with only small z-index deltas (1002 / 1003 / 1001) separating
them. If two of these trigger in the same session, they will visually overlap or
stack awkwardly rather than one yielding to the other — this is a genuine
potential visual bug, not just a style-consistency nit.

**Fix:** extend `isAnyBannerVisible()`'s guard list to include all seven, or at
minimum the three that share the same top-anchored position.

### 3b. Dismissal storage is inconsistent (P2)

| Banner | Storage | Persistence |
|---|---|---|
| `locationBanner` | `localStorage`, time-based | snoozes, reappears after `LOCBANNER_SNOOZE_MS` |
| `referralWelcome` | `localStorage`, permanent | never reappears once dismissed |
| `iosInstallHint` | `localStorage`, time-based (7 days) | snoozes |
| `pwaInstallNudge` | `localStorage`, permanent | never reappears |
| `seasonHook` | `localStorage`, permanent but **keyed per seasonal message** | each seasonal variant tracked separately |
| `appOpenBanner` | **`sessionStorage`** | resets every new browser session |
| `manualPinBanner` | none (transient mode indicator, not a nudge) | n/a — correctly not persisted |

`appOpenBanner` is the only one using `sessionStorage` instead of
`localStorage` — meaning it's the only banner in the app that comes back every
time someone opens a new tab/session, while everything else in this list
"remembers" across sessions. There may be a real reason (it's tied to a specific
deep-linked report, so per-session re-prompting could be deliberate) — but if
that reasoning wasn't explicit, this is worth a conscious decision rather than
an accidental one-off.

### 3c. No z-index scale (P2)

Observed values: `locationBanner` 1002, `manualPinBanner` 1003, `appOpenBanner`
**900**, `referralWelcome` 1003, `iosInstallHint` 1001, `pwaInstallNudge`
**1500**. These read as independently-chosen numbers rather than tiers of a
scale — `appOpenBanner` sits notably lower than the map-chrome elements around
it, and `pwaInstallNudge` sits notably higher than every other banner without an
evident reason tied to importance. Worth defining 2-3 named z-tiers (e.g.
"top-anchored info banners" vs. "bottom-anchored action nudges") the way
`--z-toast`/`--z-modal` already exist for other layers, and assigning banners to
a tier instead of a bespoke number each.

### 3d. Dismiss-button presence is inconsistent (P2)

5 of 7 have an explicit × icon-button (`locationBanner`, `appOpenBanner`,
`referralWelcome`, `iosInstallHint`, `seasonHook`). `manualPinBanner` reasonably
omits it (it's a mode indicator with its own "Cancel" action, not a nudge).
`pwaInstallNudge` also omits it, relying on a "Not now" text button instead —
but unlike `manualPinBanner`, `pwaInstallNudge` visually belongs to the same
family as the ×-having banners (a floating card with a title + body + actions),
so its missing × reads as an inconsistency rather than a deliberate exception.

### 3e. Two install banners, two unrelated copy voices (P2, minor)

`pwaInstallNudge` (Android/desktop, native install prompt) and `iosInstallHint`
(iOS, no native prompt available) exist for a real technical reason — that's
fine. But their copy doesn't share a voice: `pwaInstallNudge` leads with a
benefit ("One-tap reporting from your home screen"), `iosInstallHint` leads with
pure instructions ("No App Store needed. In Safari: Share → Add to Home
Screen.") and states no benefit at all. Recommend both open with the same value
line before branching into platform-specific instructions.

---

## 4. Inline field-validation errors

Three different visual treatments exist for what is conceptually one job
("this field/form is invalid"), and one of the three has an actual
accessibility gap.

| Class | Used by | Visual | `role="alert"` |
|---|---|---|---|
| `.field-error` | `#reportPhotoError`, `#wardError`, `#profileWardError` | bordered red box, no icon | Yes |
| `.form-error` | `#accessError`, `#leadNomError`, `#feedbackError` | borderless flex row, ⚠ icon via `::before` | Yes |
| `.field-hint` + `.esc-complaint-warn` override | `#escComplaintWarn` | plain colored text, no box, no icon | **No** |

There's a *plausible* semantic split hiding in the first two — `.field-error`
instances are all genuinely per-field (a specific input is invalid),
`.form-error` instances are form-level summaries (shown once regardless of
which field is empty) — which could justify two tiers. But nothing signals that
split is deliberate rather than incidental (two different eras of code), and
even if it is deliberate, it isn't documented anywhere a future contributor
would find it.

**`#escComplaintWarn` is the clear, unambiguous bug:** it's the only one of the
seven missing `role="alert"` entirely, meaning **screen-reader users are never
told a possibly-invalid BMC complaint number was flagged.** This one should be
fixed regardless of what happens with the broader field-error/form-error
question.

**Fix, in order of value:**
1. Add `role="alert"` (or at minimum `aria-live="polite"`, since this is a soft
   warning rather than a blocking error) to `#escComplaintWarn` — accessibility
   gap, independent of everything else.
2. Decide whether `.field-error` vs `.form-error` is an intentional two-tier
   system (field-level vs. form-level) — if yes, document it once near the CSS
   definitions so it doesn't drift further; if no, consolidate to one class.

---

## Summary — fixes by effort

| Fix | Location | Effort |
|---|---|---|
| Add `role="alert"` to `#escComplaintWarn` | `index.html:1806` | XS |
| Extend `isAnyBannerVisible()` to cover all 7 banners | `js/app.js:20726` | XS |
| Consolidate the two `.toast`/`.toast-container` CSS blocks | `css/styles.css:2273` + `12022` | S |
| Delete dead `toast-in`/`toast-out` keyframes | `css/styles.css:~2505` | XS |
| Delete dead `.snackbar` selector | `css/styles.css:12865` | XS |
| Fix `--z-toast` token to match the real `9999` in effect (or vice versa) | `css/styles.css:137` + `12037` | XS |
| Give the 6 generic-confirm call sites action-specific `confirmLabel`s | `js/app.js:32724,32738,44672,45971,46719,46777` | S |
| Define 3–4 named toast-duration tiers; raise default from 3500→4000+ | `js/app.js:23762` + call sites | S |
| Decide on a real `warning` toast type or stop typing non-failures as `error` | `js/app.js` toast call sites | S |
| Give banners a named z-index scale (2-3 tiers) instead of ad hoc numbers | `css/styles.css`, 7 banner rules | S |
| Reconcile `appOpenBanner`'s `sessionStorage` vs. the rest's `localStorage` | `js/app.js:28472` | XS |
| Add a × dismiss to `pwaInstallNudge` (or document why it's the exception) | `index.html` pwa-nudge markup | XS |
| Align `pwaInstallNudge`/`iosInstallHint` copy to share a value-prop line | i18n keys `pwa.nudge`, `iosInstall.hint` | XS |
| Document (or consolidate) the `.field-error` vs `.form-error` split | `css/styles.css:787`, `9753` | S |

Nothing here is a redesign — the toast engine and the modal-confirm approach are
both already the right architecture. This is a data-consistency and hygiene
pass on top of them.
