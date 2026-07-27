# CivicRadar — promote "File with {corp}" out of the success modal's nested collapse

Cursor-ready spec. One structural change, zero new JS, zero new CSS.
Verified against current code (v445).

## Why

The report-success modal currently makes "Share on WhatsApp" the single
most visible action on screen — filled brand-green, full-width, above even
"Done" — while "File with {corp}" (the action that actually starts the
official clock with BMC/PMC/TMC) is nested two collapse-levels deep: tap
**More** → tap **File with {corp}** → then pick a channel. Three taps to
file, one tap to share.

That prioritization is explicit in the code (`css/styles.css:11664`:
*"Success modal — WhatsApp primary (growth); Done = bordered secondary
dismiss"*), so this isn't fixing a bug — it's a product call: is a citizen
finishing a report more likely to want to invite friends, or to move their
own report toward getting fixed? This spec doesn't take WhatsApp's spot —
it keeps Share as the visually dominant action — it just gives filing a
visible entry point on the main surface instead of hiding it entirely
behind "More," which currently also hides genuinely secondary stuff
(location thumbnail, progress bar) that filing has no business being
grouped with.

Low-risk because every element this touches is wired by `document
.getElementById` (`$('#id')`), not by DOM path — moving the block doesn't
require touching `js/app.js` at all. The target element
(`#successOfficialBlock`) already has its own promoted visual treatment
sitting unused in the CSS (`css/styles.css:5186-5196` — brand-tinted
background, brand border, 44px touch target) that never reads as promoted
today because of *where* it lives. This change just moves the HTML to
match the styling intent that's already there.

---

## The change

**File:** `index.html`

**Current structure** (`index.html:727-793`, abbreviated to the parts that
move):

```html
      <div class="success-share-block success-share-block--primary">
        <button type="button" class="btn btn--whatsapp btn--full" id="btnShareWhatsApp">
          <i class="ph ph-whatsapp-logo"></i> <span data-i18n="success.shareWhatsapp">Share on WhatsApp</span>
        </button>
      </div>
      <div class="success-footer">
        <button type="button" class="btn btn--secondary btn--full" id="btnSuccessClose" data-i18n="success.done">Done</button>
      </div>
      <div class="success-more" id="successMore">
        <button type="button" class="btn btn--ghost btn--sm success-more__toggle" id="btnSuccessMoreToggle" aria-expanded="false" aria-controls="successMoreBody">
          <span data-i18n="success.more">More</span>
          <i class="ph ph-caret-down" aria-hidden="true"></i>
        </button>
        <div class="success-more__body hidden" id="successMoreBody">
          <div class="success-location-row" id="successLocationRow">
            <!-- thumbnail + tagline + ward name — unchanged, stays in More -->
          </div>
          <div class="success-reward-panel">
            <!-- celebrate / progress bar / streak — unchanged, stays in More -->
          </div>
          <div class="success-optional-block">
            <div class="official-channels-block official-channels-block--collapsed" id="successOfficialBlock">
              <button type="button" class="official-channels-block__toggle" id="btnSuccessOfficialToggle" aria-expanded="false" aria-controls="successOfficialBody">
                <span data-i18n="success.alsoOfficial">File with {corp}</span>
                <i class="ph ph-caret-down" aria-hidden="true"></i>
              </button>
              <div class="official-channels-block__body hidden" id="successOfficialBody">
                <p class="field-hint success-official-hint" data-i18n="success.subtitle">Filing with {corp} starts the official clock — you file, we track.</p>
                <p class="accountability-clock accountability-clock--warn" id="successClock"></p>
                <div class="esc-channels official-channels official-channels--success" id="successOfficialChannels" data-official-context="success"></div>
                <button type="button" class="btn btn--ghost btn--full success-filing-guide" id="btnSuccessFilingGuide">
                  <i class="ph ph-list-checks"></i> <span data-i18n="success.filingGuide">How to file &amp; copy text</span>
                </button>
                <p class="official-sources-all">
                  <a href="official-sources.html" class="official-sources-link" target="_blank" rel="noopener noreferrer">
                    <i class="ph ph-books" aria-hidden="true"></i>
                    <span data-i18n="official.viewAllSources">More filing links</span>
                  </a>
                </p>
                <div class="share-buttons">
                  <button type="button" class="btn btn--ghost btn--full" id="btnShareTwitter">
                    <i class="ph ph-x-logo"></i> <span data-i18n="success.tag">Tag @mybmc</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
```

**Replace with** — the `success-optional-block` (containing
`#successOfficialBlock` and everything inside it) moves out of
`#successMoreBody` to sit between the WhatsApp block and the footer.
Nothing inside that block changes — same IDs, same children, same
`success.alsoOfficial` / `success.subtitle` copy:

```html
      <div class="success-share-block success-share-block--primary">
        <button type="button" class="btn btn--whatsapp btn--full" id="btnShareWhatsApp">
          <i class="ph ph-whatsapp-logo"></i> <span data-i18n="success.shareWhatsapp">Share on WhatsApp</span>
        </button>
      </div>
      <div class="success-optional-block">
        <div class="official-channels-block official-channels-block--collapsed" id="successOfficialBlock">
          <button type="button" class="official-channels-block__toggle" id="btnSuccessOfficialToggle" aria-expanded="false" aria-controls="successOfficialBody">
            <span data-i18n="success.alsoOfficial">File with {corp}</span>
            <i class="ph ph-caret-down" aria-hidden="true"></i>
          </button>
          <div class="official-channels-block__body hidden" id="successOfficialBody">
            <p class="field-hint success-official-hint" data-i18n="success.subtitle">Filing with {corp} starts the official clock — you file, we track.</p>
            <p class="accountability-clock accountability-clock--warn" id="successClock"></p>
            <div class="esc-channels official-channels official-channels--success" id="successOfficialChannels" data-official-context="success"></div>
            <button type="button" class="btn btn--ghost btn--full success-filing-guide" id="btnSuccessFilingGuide">
              <i class="ph ph-list-checks"></i> <span data-i18n="success.filingGuide">How to file &amp; copy text</span>
            </button>
            <p class="official-sources-all">
              <a href="official-sources.html" class="official-sources-link" target="_blank" rel="noopener noreferrer">
                <i class="ph ph-books" aria-hidden="true"></i>
                <span data-i18n="official.viewAllSources">More filing links</span>
              </a>
            </p>
            <div class="share-buttons">
              <button type="button" class="btn btn--ghost btn--full" id="btnShareTwitter">
                <i class="ph ph-x-logo"></i> <span data-i18n="success.tag">Tag @mybmc</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="success-footer">
        <button type="button" class="btn btn--secondary btn--full" id="btnSuccessClose" data-i18n="success.done">Done</button>
      </div>
      <div class="success-more" id="successMore">
        <button type="button" class="btn btn--ghost btn--sm success-more__toggle" id="btnSuccessMoreToggle" aria-expanded="false" aria-controls="successMoreBody">
          <span data-i18n="success.more">More</span>
          <i class="ph ph-caret-down" aria-hidden="true"></i>
        </button>
        <div class="success-more__body hidden" id="successMoreBody">
          <div class="success-location-row" id="successLocationRow">
            <!-- thumbnail + tagline + ward name — unchanged -->
          </div>
          <div class="success-reward-panel">
            <!-- celebrate / progress bar / streak — unchanged -->
          </div>
        </div>
      </div>
```

New resulting order on the main surface: icon/title → points → gamify line
→ **Share on WhatsApp** (primary, unchanged) → **File with {corp}**
(secondary entry point, now visible, still collapsed until tapped) → Done
→ More (now only location thumbnail + reward panel, both genuinely minor
details).

---

## What does NOT change

- **No JS edits.** `btnSuccessOfficialToggle`'s click handler
  (`js/app.js:33179-33197`) and the reset-on-open logic
  (`js/app.js:37898-37908`) both use `$('#id')` lookups — they work
  identically regardless of where the element sits in the DOM.
- **No CSS edits.** `#successOfficialBlock .official-channels-block__toggle`
  (`css/styles.css:5186-5196`) already gives this specific button its
  brand-tinted, 44px-touch-target treatment — it'll simply become visible
  in its new position instead of dormant in its old one.
- **No copy changes.** Same `success.alsoOfficial` ("File with {corp}"),
  same `success.subtitle`, same channel list, same filing-guide and
  sources links.
- **WhatsApp keeps its exact current visual weight** — this spec is
  additive (give filing a visible entry point), not a demotion of Share.

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v445`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- Quick visual check after moving: confirm the report-success modal still
  fits comfortably on a small phone viewport (e.g. iPhone SE / 375px) with
  three stacked full-width rows (Share, File with corp, Done) before
  "More" — if it feels cramped, dropping `.success-optional-block`'s
  `border-top` (`css/styles.css:5166-5170`) in its new position is a safe,
  purely cosmetic follow-up, not required for the fix itself.
