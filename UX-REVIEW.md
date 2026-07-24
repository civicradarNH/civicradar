# CivicRadar — Premium UX Review (July 2026, app v378)

Review document — findings, copy audit, and copy-paste implementation code for
**onboarding**, the **report-a-hazard flow**, and the **landing page**, plus a
**content audit** and two rounds of **custom SVG/animation proposals**.
Benchmarks: Uber (task speed), Airbnb (trust + progressive disclosure), Headspace
(warmth + motion).

A companion live demo (renders every animation below) is published as a Claude
Artifact from this conversation — ask for the link if you don't have it.

> Implementation reminder (CLAUDE.md): any shipped change needs `CIVIC_APP_VERSION`
> bump in js/app.js + matching `CACHE` in sw.js + SW06 in tests/e2e_comprehensive.py.

---

## Executive summary

The foundation is genuinely strong — real design tokens, AA-contrast-audited palette,
40+ purposeful keyframes, custom SVG icon set, haptics, skeletons, reduced-motion
support. This is already above most production PWAs.

The gap to "Uber/Airbnb premium" is **not visual polish — it's flow economy and voice
discipline**:

1. **First-run is a gauntlet.** A new user passes through 3 blocking modals
   (ToS → onboarding form → purpose sheet) before ever seeing the map. Airbnb lets you
   browse first and commits you only at the moment of action.
2. **Four competing taglines** and repeated reassurance copy ("not sold", "30 seconds",
   "not a government app") make the app feel like it's talking too much. Premium apps
   say each thing once, in one voice.
3. **The success moment is buried** under 10+ elements. Uber's trip-end screen has one
   hero moment and one action.

Fixing those three things moves the needle more than any new animation.

---

## Priority matrix

| # | Item | Area | Priority | Effort |
|---|------|------|----------|--------|
| 1 | Collapse first-run to 2 steps (merge ToS into onboarding, kill purpose sheet) | Onboarding | **P0** | M |
| 2 | One tagline everywhere ("Spot it. Snap it. Sorted.") | Content | **P0** | S |
| 3 | Slim the success modal to one hero moment + one CTA | Report flow | **P0** | M |
| 4 | "Explore first" escape hatch — browse map without onboarding | Onboarding | **P0** | M |
| 5 | Paged onboarding (2 screens, progress dots, one decision per screen) | Onboarding | **P1** | M |
| 6 | Keep the FAB visible while the hero card shows | Landing | **P1** | S |
| 7 | De-duplicate reassurance copy (privacy / 30-sec / not-BMC) | Content | **P1** | S |
| 8 | Persona bar: auto-retire the static tip after 3 sessions | Landing | **P1** | S |
| 9 | Capture screen: replace "EXIF stripped on-device" jargon | Report flow | **P1** | XS |
| 10 | Animated radar-sweep onboarding hero SVG (code below) | Delight | **P2** | S |
| 11 | Pin-drop success animation (code below) | Delight | **P2** | S |
| 12 | FAB idle sonar pulse (code below) | Delight | **P2** | XS |
| 13 | Count-up numbers in ward pulse / points (code below) | Delight | **P2** | S |
| 14 | Sync index.html fallback copy with i18n strings | Hygiene | **P2** | S |
| 15 | Prune duplicate i18n keys | Hygiene | **P2** | XS |
| 16 | Dark-mode map tiles (light tiles break the dark UI) | Landing | **P0** | S |
| 17 | Confirm screen: remove orphan hint / dead space; photo + hazard above fold | Report flow | **P1** | S |
| 18 | Duplicate state: explain it + "different issue" escape hatch | Report flow | **P1** | S |
| 19 | "Join your ward" CTA: ghost → filled primary when valid | Onboarding | **P1** | XS |
| 20 | Hide Leaflet zoom +/− controls on touch devices | Landing | **P2** | XS |

---

## 1. Onboarding flow

### What happens today (first run)

```
Splash → ToS modal (summary + 2 checkboxes, disabled Continue)
       → Onboarding modal (GPS disclosure + detect button + OR divider
                           + city select + ward combobox + society + name)
       → Purpose coach-mark sheet ("See it. Snap it. Sort it out." → Got it)
       → Map, with: hero card + location banner + (later) PWA nudge + persona bar
```

That is **3 blocking modals and ~7 decisions** before the user sees any value.
The onboarding modal alone shows 5 inputs + 2 buttons + 4 hint paragraphs at once.

### Problems

- **Value is shown last.** The map — the product — is hidden behind legal + forms.
  Airbnb/Uber invert this: product first, commitment at the moment of need.
- **The purpose sheet is redundant.** Its message ("pins alert neighbours, then
  resolve") already appears in the onboarding subtitle AND the hero card AND the
  persona bar. Three explainer surfaces for one idea.
- **Society field adds weight** for an optional nicety. It exists in Profile → Edit
  anyway.
- **The GPS disclosure paragraph** (3 sentences) sits above the fold pushing the
  actual form down. Trust text should support the CTA, not precede it.

### Recommended flow (2 steps, ~30 seconds)

```
Splash → Welcome sheet (paged, progress dots)
   Step 1 "Where do you live?"
     • Animated radar hero SVG (see §5.1)
     • [ Auto-detect my ward ]  ← primary
     • City chips (Mumbai · Pune · Thane) + ward search  ← secondary path
     • One-line disclosure UNDER the button: "Used once to suggest your ward.
       Never shown on the map until you report."
   Step 2 "What should neighbours call you?"
     • Name input (optional — default "Neighbour" if skipped)
     • Single checkbox: "I'm 18+ and accept the Terms & Privacy Policy" (links inline)
     • [ Join your ward ]
   → Map immediately. No purpose sheet.
   → "Explore the map first" ghost link on Step 1 skips everything;
     ward + terms are asked on first Report instead (report flow already
     handles the no-ward case by reopening onboarding).
```

Move the **analytics opt-in** out of the gate entirely — it's optional by design, so a
one-time non-blocking toast ("Help improve CivicRadar? → Allow / No thanks") or a
Profile toggle satisfies consent without taxing first-run. Keep the full ToS text
reachable via the inline links (legal content itself is fine — see §4).

### Small fixes even if the flow stays as-is

- Auto-focus nothing on open (mobile keyboard springing up over a sheet feels cheap);
  focus the ward field only after "or pick manually".
- After GPS detect succeeds, **auto-advance**: collapse the manual section and scroll
  the CTA into view with the detected ward shown as a confirmed chip (`✓ K/W Ward —
  Andheri West`). Today the form stays fully expanded.
- The "OR" divider + two hint paragraphs + disclosure paragraph = 4 grey text blocks
  visible at once. Keep max one hint visible per state.

---

## 2. Report-a-hazard flow

### What's already excellent

Photo-first Capture → Confirm is the right shape (Uber-like: primary action up front).
One-time camera disclosure, draft resume, pin-accuracy messaging, duplicate detection
with inline "Me too" — genuinely sophisticated.

### Issues, in order of impact

**2a. Success modal overload (P0).** Current stack: animated check + title + points
pill + celebrate line + progress bar + streak + thumbnail row + share prompt + WhatsApp
button + native share + "File with {corp}" accordion + Tag @mybmc + Done. That's a
dashboard, not a moment. Premium pattern:

```
[ pin-drop animation — see §5.2 ]
"Pinned in K/W Ward"            ← one line, ward name is the emotional payoff
+15 Civic Points  (count-up)
[ Share on WhatsApp ]           ← single primary CTA
Done                            ← ghost
--- collapsed "More" reveals: streak, badge progress, official filing ---
```

Rotate ONE gamification line per submission (points OR streak OR badge progress —
whichever changed most) instead of showing all three tracks.

**2b. Capture screen is an empty room (P1).** One button + two hint lines on a blank
sheet. Add a lightweight camera-viewfinder illustration or the selected hazard's icon
as a watermark, so the screen has a focal point. Also rewrite:

- `"EXIF stripped on-device"` → **"Location data is removed from photos automatically"**
  (EXIF is developer jargon; this line is doing trust work, let it speak plainly).
- `"Snap a hazard — avoid faces and documents."` is good — keep.

**2c. Confirm screen ordering (P2).** Hazard chips → ward chip → pin map → notes →
submit is right. Two nits: the "Does this photo show the hazard clearly?" hint block
(`photoConfirmGroup`) duplicates what the photo hero already communicates — cut it.
And `+ Add landmark` is a great progressive-disclosure move; consider surfacing the
placeholder text as the button label ("+ Near which shop/building?") so users know
*why* to tap.

**2d. Geo explainer copy (P1).** Three sentences where one earns the tap:
> "Your location is used once — to place this pin where you're standing. Neighbours
> see the pin, never your live location."
Then `Use my location` / `Place pin on map instead` as today.

---

## 3. Landing page (map home)

### What's strong
Full-bleed map with floating HUD is the right premium skeleton (same spatial model as
Uber). Branded splash, ward pulse, custom pins, empty-state illustration with bob
animation — all good.

### Issues

**3a. Hero card hides the FAB (P1).** `body.home-hero-visible` sets `display:none` on
`#btnCamera`, `#personaBar`, `#wardPulse`. So the first thing a new user learns is a
UI without the app's signature button — then the hero dismisses and three elements pop
into existence (layout surprise). Keep the FAB visible (the hero CTA and FAB doing the
same thing is fine — reinforcement, not conflict) and let the hero only suppress the
persona bar.

**3b. Persona bar is a permanent lecture (P1).** 40px of viewport spent on "Hazard
nearby? Report it in 30 seconds." forever. Uber shows contextual banners only when
there's news. Recommend: show the tip for the first 3 sessions, then only surface the
bar when it has a *dynamic* message (`{n} open on your ward map…`), otherwise collapse
to zero height. (The ward pulse already carries ambient status.)

**3c. Three explainer surfaces on one screen (P1).** Hero card + persona bar + map
empty-state sheet can all be on screen within the first minute, each re-explaining
reporting. Empty-state sheet should win (it's contextual); suppress the hero when
`mapEmptyCta` is visible.

**3d. Title tag (P2).** `<title>CivicRadar</title>` → `CivicRadar — Ward hazard map
for Mumbai, Pune & Thane` for SEO/share cards (matches OG tags).

---

## 4. Content audit (redundancy & wordiness)

### 4a. One tagline (P0)

Currently shipping **four**:

| Surface | Copy |
|---|---|
| Splash + index.html hero fallback | "Map it · Snap it · Report it" |
| Hero (i18n, what users actually see) | "Spot it. Snap it. Sorted." |
| Purpose sheet | "See it. Snap it. Sort it out." |
| Onboarding subtitle | "Spot a problem, snap it — then sort it out…" |

Pick **"Spot it. Snap it. Sorted."** (shortest, outcome-first, ownable) and use it on
the splash, hero, OG description, and store listing. Delete the purpose sheet (§1) and
let the onboarding subtitle do feature-explaining instead of tagline-competing.

### 4b. Repeated reassurances (P1)

- **"Not sold / not used for marketing"** appears in: geo explainer, camera disclosure
  (bullet + body string), location banner variant, About. Say it once per flow, at the
  moment of permission, in plain words ("Only used to place your pin"). The full legal
  statement lives in Privacy Policy — that's its job.
- **"30 seconds"** appears in persona bar, hero subline, and map empty hint. Keep it in
  exactly one place (hero subline) — a claim repeated three times reads as marketing,
  once as fact.
- **"Not a government app / not affiliated with BMC"** appears 6+ times (ToS, About ×3,
  escalation modal, resources hint, volunteer modal). Legally it must exist; UX-wise it
  needs to be *findable*, not *ambient*. Keep: ToS clause, About section, escalation
  modal header. Cut from: volunteer subtitle, pledge notice, resources hint.

### 4c. Line-level rewrites

| Location | Current | Suggested |
|---|---|---|
| Capture hint | EXIF stripped on-device | Location data removed from photos automatically |
| Location banner | Turn on location to pin hazards — or place a pin when reporting. | See hazards near you — turn on location. |
| Geo explainer body | We use your precise location only to place this hazard pin on the community map. Pins and photos are visible to neighbours in your ward. Location is not sold or used for marketing. | Used once to place this pin where you're standing. Neighbours see the pin — never your live location. |
| Onboard GPS disclosure | Optional: use precise location once to suggest your ward. Nothing is shared on the map until you report. Or pick a ward from the list. | Used once to find your ward. Nothing is shared until you report. |
| Volunteer subtitle | Fix it together with neighbours — not a government volunteer programme. | Join neighbours for local cleanups. |
| Pledge notice | Your ward NGO coordinator sees this in their hub — not BMC. They may follow up in-app; no automatic calls or SMS. | Seen only by your ward coordinator. Follow-up happens in-app. |
| Success subtitle (official) | Open a {corp} app below — starts the complaint clock. We don't file for you. | Filing with {corp} starts the official clock — you file, we track. |

### 4d. i18n hygiene (P2)

- `success.shareTitle`, `success.sharePrompt`, `success.shareBrag`,
  `success.shareBragFirst` are four keys with the **same English string** — collapse to
  one key (check all four language blocks).
- `purpose.stepNeighbours` duplicates `purpose.stepResolve`.
- index.html `data-i18n` **fallback text diverges from the i18n values** (e.g. hero
  badge fallback `#MonsoonGuardian` vs i18n "Your ward, together"; benefits "Map it /
  Snap it / Report it" vs "Snap a photo / Pin your ward / Neighbours notified"). Users
  on slow devices see a copy flash; maintainers see two sources of truth. Sync the
  HTML to the en i18n strings.

---

## 5. Custom SVGs & animations — Round 1 (ready to implement)

All pieces use existing tokens (`--primary`, `--accent`, `--ease-spring`) and the
established 1.8px-stroke icon language. Every animation must sit inside the existing
`@media (prefers-reduced-motion: reduce)` guards.

### 5.1 Animated radar-sweep hero (onboarding step 1)

A living version of the brand mark — sweep rotates, pins blink in as "detected".
Pure SVG+CSS, ~1 KB, no JS.

```html
<div class="onboard-hero" aria-hidden="true">
  <svg viewBox="0 0 160 160" width="132" height="132" fill="none">
    <!-- rings -->
    <circle cx="80" cy="80" r="70" stroke="#6366F1" stroke-opacity=".14" stroke-width="1.5"/>
    <circle cx="80" cy="80" r="48" stroke="#6366F1" stroke-opacity=".22" stroke-width="1.5"/>
    <circle cx="80" cy="80" r="26" stroke="#6366F1" stroke-opacity=".34" stroke-width="1.5"/>
    <!-- grid cross -->
    <path d="M80 8v144M8 80h144" stroke="#6366F1" stroke-opacity=".08" stroke-width="1.2"/>
    <!-- rotating sweep (conic wedge approximated by gradient-stroked arc) -->
    <g class="radar-sweep">
      <path d="M80 80 L80 10 A70 70 0 0 1 129.5 30.5 Z" fill="url(#sweepGrad)"/>
      <line x1="80" y1="80" x2="80" y2="10" stroke="#22D3EE" stroke-width="2" stroke-linecap="round"/>
    </g>
    <!-- detected hazard pips — blink in sequence -->
    <circle class="radar-pip radar-pip--1" cx="112" cy="52" r="4.5" fill="#0891B2"/>
    <circle class="radar-pip radar-pip--2" cx="52"  cy="104" r="4.5" fill="#EA580C"/>
    <circle class="radar-pip radar-pip--3" cx="106" cy="112" r="4.5" fill="#15803D"/>
    <!-- centre: you -->
    <circle cx="80" cy="80" r="7" fill="#6366F1"/>
    <circle cx="80" cy="80" r="7" fill="none" stroke="#6366F1" stroke-opacity=".3" stroke-width="6"/>
    <defs>
      <linearGradient id="sweepGrad" x1="80" y1="10" x2="120" y2="60" gradientUnits="userSpaceOnUse">
        <stop stop-color="#22D3EE" stop-opacity=".35"/>
        <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
      </linearGradient>
    </defs>
  </svg>
</div>
```

```css
.radar-sweep { transform-origin: 80px 80px; animation: radar-rotate 3.6s linear infinite; }
@keyframes radar-rotate { to { transform: rotate(360deg); } }
/* pips flash as the sweep passes: stagger = angle/360 × 3.6s */
.radar-pip { opacity: 0; animation: radar-pip-blink 3.6s ease-out infinite; }
.radar-pip--1 { animation-delay: .35s }   /* ~35° */
.radar-pip--2 { animation-delay: 2.15s }  /* ~215° */
.radar-pip--3 { animation-delay: 1.45s }  /* ~145° */
@keyframes radar-pip-blink {
  0%, 6% { opacity: 0; transform: scale(.6); }
  9%     { opacity: 1; transform: scale(1.25); }
  14%    { transform: scale(1); }
  55%    { opacity: 1; }
  75%,100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .radar-sweep { animation: none; }
  .radar-pip { animation: none; opacity: .9; }
}
```

### 5.2 Pin-drop success animation (replaces/augments the check)

The emotional payoff of reporting is *your pin exists on the map*. Show exactly that:
pin drops with spring bounce, ground ripple expands, check pops in the pin head.

```html
<svg class="pin-drop" viewBox="0 0 96 96" width="88" height="88" fill="none" aria-hidden="true">
  <ellipse class="pin-drop__shadow" cx="48" cy="78" rx="16" ry="4.5" fill="#0F172A" fill-opacity=".14"/>
  <circle class="pin-drop__ripple" cx="48" cy="78" r="10" stroke="#6366F1" stroke-width="2"/>
  <circle class="pin-drop__ripple pin-drop__ripple--2" cx="48" cy="78" r="10" stroke="#22D3EE" stroke-width="1.5"/>
  <g class="pin-drop__pin">
    <path d="M48 12c-12.2 0-22 9.5-22 21.3 0 15 17 31.9 20.8 35.3.7.7 1.7.7 2.4 0C53 65.2 70 48.3 70 33.3 70 21.5 60.2 12 48 12z"
          fill="#4F46E5" stroke="#4338CA" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="48" cy="33" r="11.5" fill="#fff"/>
    <path class="pin-drop__check" d="M42.5 33.5l4 4 7.5-8" stroke="#047857" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
```

```css
.pin-drop__pin {
  animation: pin-fall .55s cubic-bezier(.34, 1.4, .64, 1) both; /* drop + overshoot */
  transform-origin: 48px 78px;
}
@keyframes pin-fall {
  0%   { transform: translateY(-64px) scale(.9); opacity: 0; }
  55%  { transform: translateY(0)     scale(1);  opacity: 1; }
  72%  { transform: translateY(-7px)  scale(1.02); }  /* bounce */
  100% { transform: translateY(0)     scale(1); }
}
.pin-drop__shadow { animation: pin-shadow .55s ease-out both; transform-origin: 48px 78px; }
@keyframes pin-shadow { 0% { transform: scale(.3); opacity: 0; } 55%,100% { transform: scale(1); opacity: 1; } }
.pin-drop__ripple {
  opacity: 0; transform-origin: 48px 78px;
  animation: pin-ripple 0.9s ease-out .45s both;
}
.pin-drop__ripple--2 { animation-delay: .6s; }
@keyframes pin-ripple {
  0%   { opacity: .7; transform: scale(.4); }
  100% { opacity: 0;  transform: scale(2.4); }
}
.pin-drop__check {
  stroke-dasharray: 20; stroke-dashoffset: 20;
  animation: pin-check-draw .3s ease-out .55s forwards;
}
@keyframes pin-check-draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .pin-drop__pin, .pin-drop__shadow, .pin-drop__ripple { animation: none; opacity: 1; }
  .pin-drop__ripple { display: none; }
  .pin-drop__check { animation: none; stroke-dashoffset: 0; }
}
```

### 5.3 FAB idle sonar pulse (ambient affordance)

One quiet ring every 6s — enough to draw the eye without nagging. Stop after the
user's first report (`body.has-reported` class, or remove the class in JS).

```css
#btnCamera::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  border: 2px solid rgba(99, 102, 241, .55);
  opacity: 0;
  animation: fab-sonar 6s ease-out infinite;
  animation-delay: 3s;
  pointer-events: none;
}
@keyframes fab-sonar {
  0%, 78% { opacity: 0; transform: scale(1); }
  80%  { opacity: .8; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.55); }
}
body.has-reported #btnCamera::after,
body.modal-open #btnCamera::after { animation: none; }
@media (prefers-reduced-motion: reduce) { #btnCamera::after { animation: none; } }
```

### 5.4 Count-up numbers (ward pulse, Civic Points)

Numbers that tick up feel alive (Headspace streaks, Uber earnings). ~15 lines, reuse
everywhere a stat renders:

```js
function countUp(el, to, { duration = 600 } = {}) {
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from = parseInt(el.textContent, 10) || 0;
  if (prefersReduced || to === from) { el.textContent = String(to); return; }
  const start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}
// usage: countUp(document.getElementById('wardPulseOpen'), 12);
//        countUp(document.getElementById('profilePoints'), points);
```

### 5.5 Onboarding progress dots (for the paged flow in §1)

```html
<div class="onboard-dots" role="progressbar" aria-valuemin="1" aria-valuemax="2" aria-valuenow="1">
  <span class="onboard-dots__dot is-active"></span>
  <span class="onboard-dots__dot"></span>
</div>
```

```css
.onboard-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 14px; }
.onboard-dots__dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--border);
  transition: width .3s var(--ease-out-soft), background .3s;
}
.onboard-dots__dot.is-active { width: 20px; background: var(--primary); }
```

### 5.6 Hazard tile "selection ring" (upgrade to existing tile-check-pop)

A ring that draws around the selected tile — feels hand-crafted vs a plain border swap:

```css
.hazard-tile--active {
  position: relative;
}
.hazard-tile--active::before {
  content: '';
  position: absolute; inset: -3px;
  border-radius: inherit;
  border: 2px solid var(--primary);
  animation: tile-ring-in .28s var(--ease-spring) both;
  pointer-events: none;
}
@keyframes tile-ring-in {
  from { opacity: 0; transform: scale(.92); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) { .hazard-tile--active::before { animation: none; } }
```

---

## 6. Verified on device (prod screenshots, dark mode)

Findings from real phone screenshots of the live build (civicradarnh.github.io,
dark theme) — these were invisible in the code-level pass.

### 6a. Light map tiles inside the dark UI (P0)

The chrome (header, sheets, nav) is a polished dark slate, but the OSM tiles — the
main map AND the mini-map on the report Confirm step — render bright light-mode
white. It's the largest un-premium signal on screen: every benchmark app themes its
map to the UI. OSM's raster tiles have no dark variant, but the standard Leaflet
trick filters the **tile pane only** (markers, popups, and your custom pins live in
other panes and are untouched):

```css
/* Dark map tiles — tile pane only; pins/popups live in other panes. */
@media (prefers-color-scheme: dark) {
  .leaflet-tile-pane {
    filter: invert(1) hue-rotate(180deg) brightness(.91) contrast(.88) saturate(.65);
  }
}
/* If the app uses its own dark-mode class instead of the media query,
   scope to that class. Tune brightness/saturate on a real device —
   roads should read as dim lanes, water as deep navy. */
```

Apply the same rule to `#reportPinMap`'s tile pane. Verify the ward-boundary or
accuracy-circle overlays still contrast after the filter.

**Status: implemented** — see `#map .leaflet-tile-pane, #reportPinMap .leaflet-tile-pane`
inside the existing `@media (prefers-color-scheme: dark)` block in css/styles.css.

### 6b. Confirm screen layout (P1)

- **Orphaned hint + dead space:** "Does this photo show the hazard clearly?" renders
  as a floating line with a large empty gap beneath it (seen in both the normal and
  duplicate states). Either bind it visually to the photo hero (caption style,
  directly under the image) or cut it (§2c) — as-is it reads as an unfinished layout.
  **Status: implemented** — `#photoConfirmGroup` / `#photoConfirmHint` removed from
  index.html.
- **Photo + hazard type below the fold:** in the captured state, the top of the
  Confirm sheet shows the mini-map first; the photo hero and hazard chips — the two
  confirmations that matter — aren't visible. Order should be: photo (small, 4:3
  thumb is enough) → hazard chips → ward chip → collapsed map preview ("Adjust pin"
  expands it) → landmark → submit. The map only needs full height when accuracy is
  poor or the user taps to adjust.

### 6c. Duplicate-report state (P1)

When a nearby report exists, Submit is replaced by a "Me too" primary with only a
`1 nearby · 10 m` chip as explanation. Two fixes:

- **Say what happened:** "Looks like this spot is already pinned 10 m away." (keep
  the chip as the compact form, add the sentence the first time).
- **Escape hatch:** a visible ghost action — "It's a different issue — submit new
  report" — so a genuinely new hazard 10 m from an old one isn't dead-ended into
  Me too / Retake. (If this exists below the fold, promote it onto the screen.)

### 6d. Onboarding CTA emphasis (P1)

"Join your ward" — the finish line of onboarding — is ghost/outline styled, the
weakest element on the screen, while "Auto-detect my ward" glows above it. Keep it
secondary while the form is incomplete if you like, but flip it to the filled
primary style the moment a ward is set. The user's eye should always land on the
next action.

### 6e. Ward pulse vs map mismatch (P1)

Screenshot shows "C Ward · 0 Open · 0 Fixed · 0 Me too" while four pins are visible
on the map (other wards). Scoped stats above an unscoped map reads as broken data.
Options: (a) title the pulse "C Ward" more loudly and add a subtle "pins shown:
all wards" state, (b) make the pulse reflect the current viewport instead of the
home ward, or (c) dim out-of-ward pins slightly so the scope boundary is visible.

### 6f. Map chrome nits (P2)

- **Zoom +/− controls:** desktop chrome; touch users pinch. Hide via
  `@media (pointer: coarse) { .leaflet-control-zoom { display: none !important; } }`
  — Uber/Google Maps hide them on phones. **Status: implemented.**
- Attribution line overlaps the map edge behind the FAB; keep the existing
  `--attr-clearance` but check it in dark mode.

---

## 7. Other issues spotted

- **Splash dismiss depends on `requestAnimationFrame` + `transitionend`**
  (app.js ~27252). If the app is opened in a *background* tab (long-press → open in
  new tab), rAF is throttled and the splash can hang until the tab is focused. Verify
  a `setTimeout` fallback exists on that path; add one if not.
- **`onboard.outOfBounds` copy** ends with "…select one of these cities manually to
  explore." — "to explore" dangles. Suggest: "CivicRadar currently covers Mumbai, Pune,
  and Thane. Pick the nearest city to explore the map."
- **`report.notesPh`** "Near which shop/building? e.g. opposite Sai Medical" — great,
  concrete. Model for other placeholders.
- **Success modal `success.shareTitle` element is `hidden` in HTML** while
  `sharePrompt` shows the same string — dead node worth removing with the key cleanup.
- **Confetti, animated check, spring easings already exist** — before adding new
  motion, audit which of the 40+ keyframes still fire; a few (e.g. `aurora-spin`,
  `shimmer-juice`) look like leftovers from reverted experiments. Dead CSS is weight
  on every load (styles.css is 339 KB).
- **styles.css size (339 KB) and app.js (1.36 MB)** are the real perf ceiling for
  "premium feel" on low-end Android — worth a dead-code pass after the Cursor/Gemini
  edit cycles. First impressions are made by load time before any animation plays.

---

## 8. Custom SVGs & animations — Round 2 (map, nav, gamification, gesture)

Deliberately different territory from Round 1 above — none of these overlap with
onboarding/report/success. Same rules: existing tokens only, reduced-motion guarded.
None of these are wired into the app yet — proposals only.

### 8.1 Pin cluster bloom (map · zoom-out / dense wards)

When zooming out packs pins together, nearby pins visibly converge and "bloom" into a
numbered cluster badge instead of just overlapping or popping in flatly.

```css
.cluster-pin {
  position: absolute; width: 22px; height: 22px; border-radius: 50% 50% 50% 4px;
  background: var(--primary); border: 2px solid var(--surface);
  box-shadow: 0 3px 8px rgba(0,0,0,.25);
  transition: transform .4s var(--ease-spring), opacity .3s;
}
.cluster-badge {
  width: 40px; height: 40px; border-radius: 50%; background: var(--primary-fill);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: var(--fs-md);
  box-shadow: 0 4px 14px rgba(79,70,229,.4);
  animation: cluster-badge-pop .3s var(--ease-spring) both;
}
@keyframes cluster-badge-pop { from { opacity: 0; transform: scale(.5); } to { opacity: 1; transform: scale(1); } }
/* On cluster formation: translate each source pin's marker toward the cluster
   center (via Leaflet's marker.setLatLng animation or a CSS transform on the
   DOM icon) before swapping in the badge; reverse the same transform on split. */
```

### 8.2 Sliding active-tab pill (bottom nav · every screen)

Today the active tab is a flat icon-color swap. A pill that physically slides
between tabs makes the nav read as one continuous surface (same trick iOS tab bars
and Airbnb's nav use).

```css
.bottom-nav { position: relative; }
.bottom-nav__pill {
  position: absolute; top: 5px; height: calc(100% - 10px);
  background: var(--primary); border-radius: 999px; z-index: 0;
  transition: transform .32s var(--ease-out-soft), width .32s var(--ease-out-soft);
}
.nav-tab { position: relative; z-index: 1; transition: color .32s; }
.nav-tab.active { color: #fff; }
```

```js
function placeNavPill(activeBtn) {
  const pill = document.querySelector('.bottom-nav__pill');
  if (!pill || !activeBtn) return;
  pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  pill.style.width = `${activeBtn.offsetWidth}px`;
}
// call on tab click and on resize; requires .bottom-nav__pill element added once.
```

### 8.3 Streak flame (Profile · streak line)

`profileStreakLine` is plain text today. Two overlapping SVG flame layers flicker
independently and never sit fully still, so a live flame reads as "still burning."

```html
<svg class="streak-flame" viewBox="0 0 46 56" width="32" height="40" fill="none" aria-hidden="true">
  <path class="streak-flame__core" d="M23 4C14 16 8 24 8 34a15 15 0 0 0 30 0c0-6-3-10-6-13 .6 4-1 7-3 8 1-6-1-13-6-25z" fill="#f97316"/>
  <path class="streak-flame__inner" d="M23 20c-4 7-7 12-7 17a7 7 0 0 0 14 0c0-3-1.5-5.5-3.2-7.2.3 2.4-.8 4-2 4.6.6-3.4-.5-8.4-1.8-14.4z" fill="#fde047"/>
</svg>
```

```css
.streak-flame__core { animation: flame-flicker 1.8s ease-in-out infinite; transform-origin: 50% 90%; }
.streak-flame__inner { animation: flame-flicker 1.4s ease-in-out infinite .15s; transform-origin: 50% 90%; }
@keyframes flame-flicker {
  0%, 100% { transform: scaleY(1) scaleX(1) rotate(0deg); }
  25%      { transform: scaleY(1.05) scaleX(.97) rotate(-1.5deg); }
  50%      { transform: scaleY(.96) scaleX(1.03) rotate(1deg); }
  75%      { transform: scaleY(1.03) scaleX(.98) rotate(-.5deg); }
}
@media (prefers-reduced-motion: reduce) { .streak-flame__core, .streak-flame__inner { animation: none; } }
```

### 8.4 Before/after proof flip card (Community · "Wins this monsoon" cards)

Success-story cards show before/after as static side-by-side thumbnails. A
tap-to-flip 3D card turns the reveal into an interaction; also works auto-flipped
every few seconds in the scroll carousel.

```css
.proof-flip-scene { perspective: 900px; cursor: pointer; }
.proof-flip-card {
  position: relative; width: 100%; height: 100%;
  transition: transform .6s var(--ease-out-soft); transform-style: preserve-3d;
}
.proof-flip-scene.is-flipped .proof-flip-card { transform: rotateY(180deg); }
.proof-flip-face { position: absolute; inset: 0; border-radius: var(--radius); backface-visibility: hidden; }
.proof-flip-face--back { transform: rotateY(180deg); }
```

```js
document.querySelectorAll('.proof-flip-scene').forEach((scene) => {
  scene.addEventListener('click', () => scene.classList.toggle('is-flipped'));
});
```

### 8.5 Me-too flight ping (pin popup · "Me too" corroboration)

Tapping Me too today just increments a number in the popup. Sending a small glowing
dot flying from the button up to the pin — landing as a quick pulse — visually closes
the loop between the tap and the map updating (Duolingo's XP-fly-to-counter pattern).

```css
.metoo-ping-dot {
  position: absolute; width: 9px; height: 9px; border-radius: 50%;
  background: var(--accent); opacity: 0; box-shadow: 0 0 8px var(--accent);
  pointer-events: none;
}
.metoo-ping-dot.is-flying { animation: metoo-ping-fly .62s cubic-bezier(.3,.6,.3,1) forwards; }
@keyframes metoo-ping-fly {
  0%   { opacity: 1; transform: translate(0,0) scale(1); }
  55%  { opacity: 1; transform: translate(var(--dx), var(--dy)) scale(1.3); }
  100% { opacity: 0; transform: translate(calc(var(--dx) * 1.25), calc(var(--dy) * 1.2)) scale(.4); }
}
```

```js
function fireMeTooPing(fromEl, toEl) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'metoo-ping-dot';
  dot.style.left = `${from.left}px`;
  dot.style.top = `${from.top}px`;
  dot.style.setProperty('--dx', `${to.left - from.left}px`);
  dot.style.setProperty('--dy', `${to.top - from.top}px`);
  document.body.appendChild(dot);
  requestAnimationFrame(() => dot.classList.add('is-flying'));
  dot.addEventListener('animationend', () => dot.remove());
}
```

### 8.6 Coin-flip medal unlock (Certificate / badge-unlock modal)

The certificate modal's medal currently pops in statically. A two-rotation coin-flip
settling face-on, with a diagonal shine sweeping across at landing, reads as a genuine
unlock moment (mobile-game achievement register).

```css
.cert-medal { animation: cert-coin-spin 1.1s var(--ease-out-soft) both; }
.cert-medal-shine { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none; }
.cert-medal-shine::after {
  content: ''; position: absolute; top: -20%; left: -60%; width: 40%; height: 140%;
  background: linear-gradient(75deg, transparent, rgba(255,255,255,.85), transparent);
  animation: cert-shine-sweep 1.1s ease-out .35s both;
}
@keyframes cert-coin-spin {
  0%   { transform: rotateY(0deg) scale(.6); opacity: 0; }
  55%  { transform: rotateY(720deg) scale(1.08); opacity: 1; }
  100% { transform: rotateY(1080deg) scale(1); }
}
@keyframes cert-shine-sweep { from { left: -60%; } to { left: 120%; } }
@media (prefers-reduced-motion: reduce) { .cert-medal { animation: none; } .cert-medal-shine::after { animation: none; } }
```

### 8.7 Leaderboard rank-swap — FLIP technique (Community · ward leaderboard)

A leaderboard refresh today silently re-renders in new order — a rank change is
invisible. Animating the row that moved (measure old position, animate to new) with a
brief glow makes "your ward just overtook another" a moment worth noticing.

```css
.leaderboard-row { transition: transform .5s var(--ease-out-soft), box-shadow .4s; }
.leaderboard-row.is-rising {
  box-shadow: 0 0 0 2px var(--primary), 0 8px 20px rgba(79,70,229,.28);
  animation: row-glow 1.1s ease-out;
}
@keyframes row-glow { 0% { box-shadow: 0 0 0 2px var(--accent), 0 8px 26px rgba(34,211,238,.4); } }
```

```js
// Classic FLIP: capture First position, re-order the DOM (Last position),
// Invert via transform, then Play by clearing the transform on next frame.
function animateRowReorder(list, row, insertFn) {
  const first = row.getBoundingClientRect();
  insertFn(); // move `row` to its new position within `list`
  const last = row.getBoundingClientRect();
  const dy = first.top - last.top;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || dy === 0) {
    row.classList.add('is-rising');
    setTimeout(() => row.classList.remove('is-rising'), 1100);
    return;
  }
  row.style.transition = 'none';
  row.style.transform = `translateY(${dy}px)`;
  requestAnimationFrame(() => {
    row.style.transition = '';
    row.style.transform = '';
    row.classList.add('is-rising');
  });
  setTimeout(() => row.classList.remove('is-rising'), 1200);
}
```

### 8.8 Camera shutter flash (Report flow · capture step)

The capture screen jumps straight from viewfinder to preview with no feedback a photo
was taken. A quick white flash + shutter-bounce (~380ms, synced to the existing
haptic tap) gives capture a physical click.

```css
.camera-area { position: relative; overflow: hidden; }
.camera-shutter-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.camera-shutter-flash.is-flashing { animation: shutter-flash .38s ease-out; }
@keyframes shutter-flash { 0% { opacity: 0; } 12% { opacity: .95; } 100% { opacity: 0; } }
.camera-area.is-bounce { animation: shutter-bounce .38s ease-out; }
@keyframes shutter-bounce { 0% { transform: scale(1); } 30% { transform: scale(.96); } 100% { transform: scale(1); } }
```

```js
// Call at the moment handlePhotoCapture() confirms a decoded image is ready.
function playShutterEffect(cameraAreaEl, flashEl) {
  Haptics.tap();
  flashEl.classList.remove('is-flashing'); cameraAreaEl.classList.remove('is-bounce');
  void flashEl.offsetWidth;
  flashEl.classList.add('is-flashing');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) cameraAreaEl.classList.add('is-bounce');
}
```

---

## 9. Custom SVGs & animations — Round 3 (accordions, toggles, status, timeline)

Third pass, deliberately covering UI that Rounds 1–2 didn't touch: the `cr-section`
accordions used across Community/Profile/Resources, notification toggles, the
recenter button, the sync-status indicator, the escalation ladder, language
switching, and the profile badge grid. Same rules as before — existing tokens,
`prefers-reduced-motion` guarded, proposals only (nothing wired into the app).

### 9.1 Accordion expand/collapse (`cr-section` — Community/Profile/Resources)

Every collapsible section (`getInvolvedSection`, `profileActivitySection`,
`communityLeaderboardSection`, etc.) currently hard-toggles a `.hidden` class — an
instant cut, not a reveal. The CSS grid-rows trick animates height without
measuring it in JS, and the chevron rotates to match state.

```css
.cr-section__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows .35s var(--ease-out-soft);
}
.cr-section__body-inner { overflow: hidden; min-height: 0; }
.cr-section--expanded .cr-section__body { grid-template-rows: 1fr; }
.cr-section__toggle .ph-caret-down {
  transition: transform .3s var(--ease-out-soft);
}
.cr-section__toggle[aria-expanded="true"] .ph-caret-down { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) {
  .cr-section__body { transition: none; }
}
```

Markup change needed: wrap the existing `.cr-section__body` children in one
`.cr-section__body-inner` div (grid-rows animates the row track, not the content,
so the overflow-hidden wrapper is what clips it). Swap `.hidden` toggling for
`.cr-section--expanded` on the parent.

### 9.2 Ward pulse meter fill (Map HUD · `wardPulseMeterOpen`/`Fixed`)

The open/fixed split bar already sets `style.width` from JS on load — but jumps
instantly. A transition plus a one-time light sweep on update makes new data feel
like it *arrived* rather than teleported in.

```css
.ward-pulse__meter-open, .ward-pulse__meter-fixed {
  transition: width .6s var(--ease-out-soft);
  position: relative; overflow: hidden;
}
.ward-pulse__meter-open.is-updated::after,
.ward-pulse__meter-fixed.is-updated::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  animation: meter-sweep .6s ease-out;
}
@keyframes meter-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
```

```js
// After setting the new width, toggle the sweep class once:
function pulseMeterUpdate(el) {
  el.classList.remove('is-updated'); void el.offsetWidth;
  el.classList.add('is-updated');
}
```

### 9.3 Toggle switch spring-pop (Profile · Notifications & Privacy)

The three `.toggle-row` switches (new-reports, resolved-nearby, report-reminder)
use a standard flat slide today. A spring easing plus a brief scale-pop on the
knob at the moment of check reads as more tactile — closer to iOS's switch feel.

```css
.toggle-row__switch::after {
  transition: transform .28s var(--ease-spring), background .2s;
}
.toggle-row__input:checked + .toggle-row__switch::after {
  animation: toggle-knob-pop .28s var(--ease-spring);
}
@keyframes toggle-knob-pop {
  0%   { transform: translateX(0) scale(1); }
  55%  { transform: translateX(20px) scale(1.15); }
  100% { transform: translateX(18px) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .toggle-row__switch::after { animation: none; }
}
```

### 9.4 Recenter compass spin (`#btnRecenter`)

The recenter button currently just triggers a map pan with no feedback while GPS
resolves. A spin-while-locating, snap-to-north-on-success treatment borrows the
compass metaphor already implied by the crosshair icon.

```css
#btnRecenter.is-locating i { animation: compass-spin 1s linear infinite; }
#btnRecenter.is-located i { animation: compass-settle .4s var(--ease-spring) both; }
@keyframes compass-spin { to { transform: rotate(360deg); } }
@keyframes compass-settle { from { transform: rotate(45deg); } to { transform: rotate(0deg); } }
@media (prefers-reduced-motion: reduce) {
  #btnRecenter.is-locating i, #btnRecenter.is-located i { animation: none; }
}
```

```js
// Toggle `.is-locating` when the GPS request starts; swap to `.is-located`
// (briefly, then remove) when the position resolves.
```

### 9.5 Live sync-status breathing dot (`#syncStatus`)

`.header__sync` currently renders as plain text (`header__sync--local` etc.). A
small status dot that breathes while syncing and sits solid-still once live gives
at-a-glance confidence the app isn't stuck — same register as Slack/Linear's
connection indicators.

```css
.header__sync { display: inline-flex; align-items: center; gap: 5px; }
.header__sync::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-muted); flex: none;
}
.header__sync--syncing::before {
  background: var(--accent);
  animation: sync-breathe 1.6s ease-in-out infinite;
}
.header__sync--live::before { background: var(--success); }
@keyframes sync-breathe {
  0%, 100% { opacity: .45; transform: scale(.8); }
  50%      { opacity: 1;   transform: scale(1.15); }
}
@media (prefers-reduced-motion: reduce) { .header__sync--syncing::before { animation: none; opacity: .8; } }
```

### 9.6 Escalation ladder timeline unlock (`#escLadder`)

The escalation ladder (`esc.ladderTitle`) lists steps as plain `<li>`s today. A
connecting vertical line that fills as steps complete, with each newly-unlocked
step popping its dot, turns a checklist into a visible timeline — reinforces that
filing is a process with momentum, not a static list.

```css
.esc-ladder { position: relative; padding-left: 24px; }
.esc-ladder::before {
  content: ''; position: absolute; left: 8px; top: 4px; bottom: 4px;
  width: 2px; background: var(--border);
}
.esc-ladder__fill {
  position: absolute; left: 8px; top: 4px; width: 2px;
  background: var(--success); height: 0%;
  transition: height .5s var(--ease-out-soft);
}
.esc-ladder li::before {
  content: ''; position: absolute; left: -24px; width: 10px; height: 10px;
  border-radius: 50%; background: var(--border);
  transition: background .3s, transform .3s var(--ease-spring);
}
.esc-ladder li.is-complete::before {
  background: var(--success);
  animation: ladder-dot-pop .3s var(--ease-spring);
}
@keyframes ladder-dot-pop { 0% { transform: scale(.4); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
```

```js
// Set .esc-ladder__fill height to (completeSteps / totalSteps * 100)%
// whenever escalation state changes; add .is-complete to each completed <li>.
```

### 9.7 Language switch cross-fade (header lang button + i18n text)

Switching EN → हिन्दी → मराठी → ગુજરાતી today swaps text instantly — with four
different scripts, an instant cut reads as a glitch rather than a deliberate
change. A quick fade+shift on the label being swapped makes the script change
register as intentional.

```css
.lang-swap {
  animation: lang-cross-fade .28s ease-out;
}
@keyframes lang-cross-fade {
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) { .lang-swap { animation: none; } }
```

```js
// On language change, after re-rendering data-i18n text nodes, add the class
// and let it self-remove (or just re-trigger via reflow) — scope to the header
// title + currently-open modal to avoid a page-wide flash:
function flashLangSwap(root) {
  root.classList.remove('lang-swap'); void root.offsetWidth;
  root.classList.add('lang-swap');
}
```

### 9.8 Profile badge grid stagger-in (`#profileBadges`)

Reporter badges currently all appear at once when the section renders. A short
stagger (each badge popping in ~45ms after the last) reads as a collection being
revealed rather than a static image dump — appropriate weight for something meant
to feel earned.

```css
.profile-card__badges > * {
  opacity: 0;
  transform: translateY(6px) scale(.9);
  animation: badge-pop-in .35s var(--ease-spring) both;
  animation-delay: calc(var(--i, 0) * 45ms);
}
@keyframes badge-pop-in { to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .profile-card__badges > * { animation: none; opacity: 1; transform: none; }
}
```

```js
// When rendering the badges list, set the stagger index per child:
badges.forEach((el, i) => el.style.setProperty('--i', i));
```

---

## 10. "The First Drop" — a signature splash-screen loader

Today's splash (`#appLaunch` in index.html) is three pulsing rings around a static
logo, a bouncing three-dot loader, and a tagline — functional, but it's the same
generic "loading spinner" pattern any app could ship. This is a replacement concept
that tells CivicRadar's actual story in one continuous loop instead: a raindrop
falls and lands, the impact radiates outward radar-style, the four real hazard
types light up along the ripple like signals being detected (the same idea as the
live ward pulse, just as the very first thing a user sees), and the brand pin
resolves at the center as the wordmark settles in.

It deliberately reuses the app's **real** splash gradient (`radial-gradient(130% 95%
at 50% 30%, #6366f1 0%, #4f46e5 52%, #3730a3 100%)`, straight from the existing
`.app-launch` critical CSS) and the four real hazard colors — so this is a preview
of the actual thing, not a themed mockup with invented colors.

Sequence (single 4.4s loop, all keyframes share the duration so they stay in sync
via `animation-delay`):

1. **0–14%** — droplet falls, squash-lands, flashes on impact.
2. **12–55%** — three concentric rings expand outward and fade (indigo → cyan →
   light indigo, echoing the radar-sweep motif from §5.1 without repeating it).
3. **26–70%**, staggered — four hazard-colored dots (water/garbage/pothole/
   streetlight) pop in along the ripple front, one after another, like sonar
   contacts being detected.
4. **40–96%** — the brand pin resolves at the center with a soft glow halo.
5. **54–96%** — wordmark + tagline fade up beneath the pin.
6. Everything is invisible at both 0% and 100%, so the loop has no visible seam.

```html
<svg class="lh-stage" viewBox="0 0 200 220" fill="none" aria-hidden="true">
  <circle class="lh-ripple lh-ripple--1" cx="100" cy="92" r="6" fill="none" stroke="#6366F1" stroke-width="2"/>
  <circle class="lh-ripple lh-ripple--2" cx="100" cy="92" r="6" fill="none" stroke="#22D3EE" stroke-width="1.6"/>
  <circle class="lh-ripple lh-ripple--3" cx="100" cy="92" r="6" fill="none" stroke="#A5B4FC" stroke-width="1.2"/>

  <circle class="lh-firefly lh-firefly--1" cx="100" cy="52"  r="4.4" fill="#22D3EE"/> <!-- water -->
  <circle class="lh-firefly lh-firefly--2" cx="140" cy="92"  r="4.4" fill="#4ADE80"/> <!-- garbage -->
  <circle class="lh-firefly lh-firefly--3" cx="100" cy="132" r="4.4" fill="#FB923C"/> <!-- potholes -->
  <circle class="lh-firefly lh-firefly--4" cx="60"  cy="92"  r="4.4" fill="#FCD34D"/> <!-- streetlight -->

  <circle class="lh-flash" cx="100" cy="92" r="4" fill="#fff"/>

  <path class="lh-drop" d="M100 20c0 0 9 11 9 18.5a9 9 0 1 1-18 0C91 31 100 20 100 20z" fill="#22D3EE"/>

  <g class="lh-pin">
    <circle class="lh-pin-glow" cx="100" cy="92" r="18" fill="#A5B4FC"/>
    <path d="M100 76c-6.6 0-12 5-12 11.5 0 8 9.2 17 11.3 19.1a1 1 0 0 0 1.4 0C102.8 104.5 112 95.5 112 87.5 112 81 106.6 76 100 76z"
          fill="#fff" fill-opacity=".96" stroke="#fff" stroke-width="1"/>
    <circle cx="100" cy="87.5" r="4.4" fill="#4F46E5"/>
  </g>

  <text class="lh-word" x="100" y="176" text-anchor="middle">CivicRadar</text>
  <text class="lh-tag" x="100" y="193" text-anchor="middle">Spot it. Snap it. Sorted.</text>
</svg>
```

```css
.lh-drop, .lh-flash, .lh-ripple, .lh-firefly, .lh-pin, .lh-pin-glow {
  transform-box: fill-box; transform-origin: center;
}

.lh-drop { animation: lh-drop-fall 4.4s ease-out infinite; }
@keyframes lh-drop-fall {
  0%    { transform: translateY(-70px) scaleY(1); opacity: 0; }
  4%    { opacity: 1; }
  11%   { transform: translateY(0) scaleY(1.12); opacity: 1; }
  12.5% { transform: translateY(2px) scaleY(.4) scaleX(1.3); opacity: 1; }
  14%   { transform: translateY(2px) scaleY(.2) scaleX(1.6); opacity: 0; }
  100%  { opacity: 0; }
}

.lh-flash { animation: lh-flash-pop 4.4s ease-out infinite; }
@keyframes lh-flash-pop {
  0%, 11.5% { opacity: 0; transform: scale(.3); }
  13%   { opacity: 1; transform: scale(2.2); }
  18%   { opacity: 0; transform: scale(3); }
  100%  { opacity: 0; }
}

.lh-ripple { animation: lh-ripple-expand 4.4s ease-out infinite; }
@keyframes lh-ripple-expand {
  0%, 12% { r: 6; opacity: 0; }
  14%   { opacity: .9; }
  55%   { r: 62; opacity: 0; }
  100%  { opacity: 0; }
}
.lh-ripple--2 { animation-delay: .15s; }
.lh-ripple--3 { animation-delay: .3s; }

.lh-firefly { animation: lh-firefly-in 4.4s ease-out infinite; }
@keyframes lh-firefly-in {
  0%, 26% { opacity: 0; transform: scale(.3); }
  30%   { opacity: 1; transform: scale(1.3); }
  36%   { opacity: 1; transform: scale(1); }
  62%   { opacity: 1; }
  70%   { opacity: 0; transform: scale(.6); }
  100%  { opacity: 0; }
}
.lh-firefly--2 { animation-delay: .08s; }
.lh-firefly--3 { animation-delay: .16s; }
.lh-firefly--4 { animation-delay: .24s; }

.lh-pin { animation: lh-pin-in 4.4s cubic-bezier(.34,1.4,.64,1) infinite; }
@keyframes lh-pin-in {
  0%, 40% { opacity: 0; transform: translateY(10px) scale(.5); }
  50%   { opacity: 1; transform: translateY(0) scale(1.08); }
  56%   { transform: translateY(0) scale(1); }
  88%   { opacity: 1; }
  96%   { opacity: 0; transform: scale(.92); }
  100%  { opacity: 0; }
}
.lh-pin-glow { animation: lh-pin-glow 4.4s ease-out infinite; }
@keyframes lh-pin-glow {
  0%, 48% { opacity: 0; transform: scale(.6); }
  55%   { opacity: .55; transform: scale(1); }
  75%   { opacity: .25; transform: scale(1.3); }
  90%   { opacity: 0; transform: scale(1.5); }
  100%  { opacity: 0; }
}

.lh-word, .lh-tag { animation: lh-word-in 4.4s ease-out infinite; fill: #fff; font-family: 'Outfit', system-ui, sans-serif; }
.lh-word { font-size: 20px; font-weight: 800; }
.lh-tag  { font-size: 10.5px; font-weight: 600; fill: rgba(224,231,255,.82); animation-delay: .12s; }
@keyframes lh-word-in {
  0%, 54% { opacity: 0; transform: translateY(8px); }
  64%   { opacity: 1; transform: translateY(0); }
  88%   { opacity: 1; }
  96%   { opacity: 0; }
  100%  { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lh-drop, .lh-flash, .lh-ripple, .lh-firefly, .lh-pin, .lh-pin-glow, .lh-word, .lh-tag {
    animation: none !important;
  }
  .lh-drop, .lh-flash, .lh-ripple { opacity: 0; }
  .lh-firefly, .lh-pin, .lh-word, .lh-tag { opacity: 1; transform: none; }
  .lh-pin-glow { opacity: .3; transform: none; }
}
```

**Implementation note:** the real splash markup (`#appLaunch` in index.html) already
has its own `app-launch--done` fade-out handled in JS (see `hideAppLaunch()` in
app.js) — this SVG would replace the current `.app-launch__mark` rings + logo +
dots block inside the existing `.app-launch` container, keeping the surrounding
fade-to-app transition untouched. Since the real splash typically shows for well
under one loop (~500ms–1.5s on a warm cache), most users will see roughly the drop
→ ripple → pin beats and rarely the full wordmark settle — which is fine, the
sequence front-loads the most legible motion first.

---

## Suggested implementation order

1. **Week 1 (P0):** dark-mode map tiles (§6a) + tagline unification + success-modal
   slim-down + capture-hint rewrite. Pure copy/CSS — low risk, immediately visible.
2. **Week 2 (P0/P1):** first-run restructure (merge ToS, kill purpose sheet, explore-
   first path) — highest impact, needs e2e updates (onboarding tests will break).
3. **Week 3 (P1/P2):** landing cleanup (FAB visibility, persona-bar retirement),
   then delight layer (§5 + §8 animations) — each is independently shippable.
