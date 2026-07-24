# Splash screen — bug report (review only, no code changed)

Two compounding bugs in the current `#appLaunch` splash ("The First Drop" animation).
Both trace to how the animation was wired into the real app: the SVG markup landed
in the HTML body (paints immediately), but its animation CSS landed in a stylesheet
the app deliberately loads *after* first paint.

---

## Bug 1 — logo flashes/pops (FOUC)

**Where:** `index.html:8-15` (inline `<style id="critical-splash">`) vs.
`css/styles.css:254-400` (`.lh-*` rules + `@keyframes`).

The inline critical-splash block only defines `.app-launch`, `.app-launch
.lh-stage` (sizing), and `.app-launch--done`. Every rule that actually animates the
splash SVG — `.lh-drop`, `.lh-ripple`, `.lh-firefly`, `.lh-pin`, `.lh-pin-glow`,
`.lh-word`, `.lh-tag`, and their keyframes — lives in `css/styles.css`, which
`index.html:54-56` deliberately defers (`rel="preload"` + `onload` swap) so it
doesn't block first paint. That deferral exists on purpose: the comment right
above it (`index.html:47-53`) explains it was added to fix an *earlier*
flash-of-white-background bug.

**What happens on screen:** before `styles.css` (339KB) finishes loading, the
splash SVG paints fully unstyled — all 3 ripple rings collapse onto one (identical
`r`/`cx`/`cy` with nothing yet differentiating them), all 4 hazard-colored dots sit
fully visible in their fixed positions, the pin+glow renders already "resolved" at
center, and the "CivicRadar" / "Spot it. Snap it. Sorted." text is fully visible
immediately — a busy, static, half-finished composite. Then, the instant
`styles.css` applies, most of those elements **snap to their animation's 0% state
(`opacity:0`)** simultaneously (most have `animation-delay: 0s` or near it) — a
visible pop/vanish — before the intended sequence restarts from scratch. That
vanish-then-restart is almost certainly the "flash" being seen.

**Fix:** move the `.lh-*` rules + `@keyframes` (currently `css/styles.css:254-400`)
into the inline `critical-splash` block in `index.html`, next to
`.app-launch`/`.app-launch--done` — same category of "must not depend on deferred
CSS" content those already exist for, and it's small (a few hundred bytes
gzipped). If duplicating the full animation in two places is unwanted upkeep, the
minimal fix is adding just `.app-launch .lh-stage > *{opacity:0}` to the critical
block — trades "no animation until CSS loads" for "no pop," the safer failure mode
(a near-blank brand-color screen for an extra beat is invisible; a popping logo
is not).

---

## Bug 2 — wordmark rarely finishes appearing before the splash hides

**Where:** `js/app.js:28760` (`LAUNCH_SPLASH_MIN_MS = 2500`) vs. the animation's
own timeline in `css/styles.css` (`.lh-pin` / `.lh-word` keyframes).

The splash is guaranteed to show for **exactly 2.5s minimum** (900ms under
reduced motion), then hides as soon as `hideAppLaunch()` fires. In `initMap()`
(`js/app.js:29201-29277`), that call fires right after the Leaflet map object is
synchronously constructed — no network wait for tiles — so in practice the 2.5s
floor, not real load time, is almost always what determines when the splash hides.

Against that: the animation is a 4.4s infinite loop where the pin doesn't finish
resolving until **56% (~2.46s)**, and the wordmark doesn't even *start* fading in
until **54% (~2.38s)**, only reaching full visibility at **64% (~2.82s)**. Since
the splash almost always hides right around 2.5s, **most users see the raindrop
fall and the ripple expand, but the "CivicRadar" wordmark is cut off mid-fade or
never starts** — the one beat meant to be the payoff is the one most likely
missing. Reads as broken/incomplete, independent of Bug 1.

**Fix:** compress the animation's overall duration so beat-to-beat pacing holds
but everything finishes with margin inside the 2.5s floor — e.g. shorten
`animation-duration` from `4.4s` to roughly `2.2–2.4s` across all `.lh-*`
declarations (a single consistent number change, not a re-derivation of every
percentage, since percentages are relative to duration). That puts the pin's
settle point around ~1.4s and the wordmark's full appearance around ~1.6s,
comfortably inside the guaranteed window.

---

## Net effect once both are fixed

First paint shows nothing (or a static, correctly-composed logo, if the minimal
Bug-1 fix is used), the intended sequence plays once cleanly, and "CivicRadar"
reliably resolves with real margin before the splash fades — no pop, no cut-off
logo.

## Ship checklist reminder

Once fixed: bump `CIVIC_APP_VERSION` in `js/app.js`, match `CACHE` in `sw.js`,
update SW06 in `tests/e2e_comprehensive.py` (per CLAUDE.md).
