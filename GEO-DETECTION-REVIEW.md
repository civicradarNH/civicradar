# CivicRadar — Geolocation & ward/neighbourhood detection review

Report only. No code was changed. Reviews how GPS coordinates become a detected
ward and neighbourhood across Mumbai, Pune, and Thane, and how comprehensive the
underlying ward and society/neighbourhood data actually is.

---

## Headline finding

**GPS acquisition is well-engineered. Ward *data* is not equally trustworthy
across the three cities — and the gap is severe, not cosmetic.**

- **Mumbai**: the 24 wards in `js/wards/mumbai.js` are real BMC administrative
  wards (A, B, C, D, E, F/N, F/S, G/N, G/S, H/E, H/W, K/E, K/W, L, M/E, M/W, N,
  P/N, P/S, R/N, R/C, R/S, S, T — a correct, complete match to MCGM's actual
  24-ward structure), with genuine area names attached. The bounding boxes are
  hand-estimated rather than survey-derived, which limits precision but the
  underlying *list* is accurate.
- **Pune**: the 41 "wards" in `js/wards/pune.js` are **not real PMC wards**.
  They're 41 genuinely real Pune locality names (Kothrud, Baner, Hadapsar,
  Kondhwa, etc.) — but instead of being placed at their real coordinates,
  they're mechanically assigned to cells of an **arbitrary 7-column grid**
  carved out of Pune's overall bounding rectangle, in the order they happen to
  appear in a hardcoded array. A locality's grid cell has **no relationship to
  where that locality actually is.** See the worked example below.
- **Thane**: same mechanism, same problem, and worse — the 66-entry area list
  in `js/wards/thane.js` is partly padded with synthetic near-duplicates of the
  same place ("Kopri" *and* "Kopri East"; "Vartak Nagar," "Vartak Nagar East,"
  *and* "Vartak Nagar West" — three "wards" from one place name), fed through
  the identical grid-generation function.

This isn't just an onboarding cosmetic issue. `resolveReportWard()`
(`js/app.js:24649`) calls the *same* detection function at the moment a citizen
**submits a report** — so every GPS-tagged report from Pune or Thane can be
tagged to a fabricated ward, which then feeds ward-scoped community stats, the
ward leaderboard, and the BMC/PMC/TMC admin dashboards' ward filters. The
inaccuracy doesn't stay contained to "your profile shows the wrong ward" — it
propagates into the data the app shows everyone.

---

## 1. How detection actually works

`js/ward-detect.js` — no polygon/GeoJSON data exists anywhere in the repo (only
matches for "polygon"/"geojson" are inside the Leaflet and Supabase vendor
libraries, unrelated to ward geometry). Every ward, in every city, is
represented as a **rectangular bounding box + a centroid point**. The algorithm
(`detectWard(lat, lng, cityId)`, `ward-detect.js:88-117`):

1. Reject the point if it falls outside the city's overall rectangular bounds.
2. Find every ward whose bbox contains the point.
3. If exactly one ward's bbox matches → return it immediately, **no further
   check**.
4. If multiple wards' bboxes match (common — adjacent wards' rectangular boxes
   routinely overlap in a dense city, since real ward shapes aren't rectangles)
   → pick whichever matched ward's *centroid* is nearest by straight-line
   (haversine) distance. This doesn't consult the actual boundary shape at all,
   so a point genuinely just inside Ward A's true boundary can resolve to Ward
   B if B's centroid happens to be closer.
5. If **no** ward's bbox matches → fall back to nearest centroid across *all*
   wards in the city, but only accept if within `detectRadiusKm` (Mumbai: 8km,
   Pune: 6km, Thane: 6km, from `js/config.js:121,128,150`); otherwise return
   `null` (no ward detected).

This bbox+centroid approach is a reasonable, common compromise for a
zero-backend static app — it's the *rectangular bbox itself* that needs to
actually approximate the real ward, and step 3's single-match short-circuit
means even a unique match gets no sanity check against distance from center.
Both are workable caveats for Mumbai, where the boxes at least roughly track
real ward positions. They become much bigger problems for Pune and Thane, where
the boxes don't track anything real at all (§3, §4).

**GPS coordinate acquisition itself is solid** and is not the source of the
problem — worth separating clearly. `js/app.js:29797` uses
`navigator.geolocation.watchPosition()` to collect multiple readings and keep
the best one within a timeout window, with an explicit high-accuracy-first,
network-based-fallback strategy specifically reasoned about monsoon cloud cover
and indoor use (`js/app.js:29751-29756`, comment: *"enableHighAccuracy:true
(GPS-satellite-only) routinely produces zero fixes under heavy cloud cover —
exactly the monsoon conditions this app targets... Network/WiFi-based location
is fast, works in those conditions"*). This part doesn't need work.

---

## 2. Mumbai — real data, approximation caveats only

`js/wards/mumbai.js` lists all 24 real BMC wards with correct names and
real neighbourhood associations (e.g. "H/W Ward — Bandra West, Khar West," "K/E
Ward — Andheri East, Vile Parle East"). The file header is honest about the
limitation: *"approximate community-tool bounding boxes... NOT legal survey
data."*

Remaining risk, lower severity than Pune/Thane: hand-estimated rectangular
boxes for real but often irregularly-shaped (several run along the coast, long
and thin) wards mean bbox overlap and edge-of-boundary misassignment are still
possible near true ward borders — inherent to the bbox approach, not a data
error. Society/neighbourhood coverage: **all 24 wards have entries, 569 total
society names**, none missing or thin (20–26 per ward).

---

## 3. Pune — synthetic ward geometry (severe)

`js/wards/pune.js`'s `buildGridWards()` function takes a flat array of 41 real
Pune area names and mechanically slices Pune's bounding rectangle into a
7-column grid, assigning area `i` to grid cell `(row = ⌊i/7⌋, col = i % 7)` —
**purely by array position, with no reference to the area's real coordinates.**

**Worked example — Kothrud (array index 20, a real, well-known west-Pune
locality near NDA/Karve Road, real coordinates ≈ 18.507°N, 73.807°E):**

- Grid math: row = ⌊20/7⌋ = 2, col = 20 mod 7 = 6
- That cell's bbox works out to roughly lat 18.487–18.51, lng 73.926–73.95
  (computed directly from the file's own `BOUNDS`/`COLS` constants)
- That's the **eastern edge** of Pune's bounding rectangle — nowhere near real
  Kothrud, which sits toward the **west** edge. The synthetic "Kothrud" ward
  centroid lands roughly 13–14 km east of the real place.

So a citizen standing in actual Kothrud won't fall inside "their" ward's
synthetic bbox at all — the point will fail every bbox check and fall through
to the nearest-centroid-across-all-41-areas fallback, which is then
essentially arbitrary with respect to true geography (whichever synthetic
centroid happens to be geometrically closest, which has no relationship to
which named area the person is actually standing in).

This isn't a one-off — it's the mechanism for all 41 entries. Any area late in
the array (higher index) is just as likely to land in a grid cell far from
its real location as an area early in the array.

**Society/neighbourhood data** (`js/society-suggestions-data.js`): all 41
synthetic ward keys have entries (832 names total), and the *content* is
topically matched to the area name in the key (e.g. "Ward 1 — Kasba
Vishrambag" lists "Vishrambag Wada CHS," "Kasba Peth CHS" — real-sounding
Kasba-area names). So *if* a user already knows to manually pick "Ward 1 —
Kasba Vishrambag," the society suggestions shown are reasonable. The problem is
entirely that GPS auto-detection can't reliably land them on the correct key in
the first place. Also worth flagging: the society lists across all wards follow
a visibly repeated template (`"{Area} CHS"`, `"{Area} RWA"`, `"{Area} Society"`,
`"{Area} Society Network"` — the last one appears once per ward, 95 times
total across all three cities) — plausible as placeholder starting content, not
independently sourced per-locality research.

Real PMC wards are called **prabhags**, not "Ward N" — the naming itself is
also not what residents or the corporation would recognize.

---

## 4. Thane — same mechanism, worse underlying list

`js/wards/thane.js` has the identical `buildGridWards()` approach, applied to a
66-entry area array (file header claims "~65 wards"). The array itself shows
signs of having been padded to reach a target count rather than reflecting 66
distinct real places:

- "Kopri" (index 0) and "Kopri East" (index 61) — same place, two entries
- "Naupada" (index 1) and "Naupada East" (index 42)
- "Vartak Nagar" (index 4), "Vartak Nagar East" (index 34), **and** "Vartak
  Nagar West" (index 64) — one real place split into three synthetic "wards"
- Similar East/West/Naka/Hills/Village suffix padding on "Manpada,"
  "Bhayandarpada," "Balkum," "Kausa," "Diva," "Kolshet," "Majiwada,"
  "Hiranandani Estate," "Charai," "Panchpakhadi," "Jambli Naka" — at least 12
  of the 66 entries are variants of a name that already appears elsewhere in
  the same array.

The society-suggestions data agent confirmed this concretely: the near-duplicate
"wards" produce independently-generated but **formulaically identical** lists —
"Kopri" and "Kopri East" each get their own 20-item list built from the same
suffix template, differing only by the East/West word appended. That's strong
evidence the whole Thane dataset — both the ward geometry and the society
suggestions under it — is template-generated placeholder content rather than
researched TMC ward data. (TMC's real administrative wards also aren't called
"TMC Ward N.")

Society data coverage: all 66 keys have entries (1320 names total, 20 each,
suspiciously uniform where Mumbai's naturally varies 20–26).

---

## 5. Downstream impact — this affects live reports, not just onboarding

`resolveReportWard(lat, lng)` (`js/app.js:24649-24653`) — called when a citizen
submits a hazard report with GPS enabled — calls the exact same `detectWard()`
used at onboarding. That means, for every Pune/Thane report submitted by GPS
(not manually ward-selected):

- The report gets tagged with a fabricated ward name.
- Ward pulse (`wardPulseOpen`/`wardPulseFixed`/`wardPulseMeToo`), the "Top
  Wards" leaderboard, and the community "Your ward this week" summary all
  aggregate by this ward field — so their per-ward breakdowns for Pune and
  Thane are aggregating by fictional boundaries, not real geography.
- The BMC/PMC/TMC admin queue's ward filter (`#aqWardFilter`) and per-ward CSV
  export inherit the same fictional grouping — an actual PMC or TMC official
  using this app's admin view would see reports bucketed into "wards" that
  don't correspond to their real jurisdiction.

Mumbai doesn't have this problem — its ward field, however approximate the
boundary, at least always names a real administrative ward a BMC official
would recognize.

---

## 6. UI messaging doesn't reflect the data-quality gap

The detected-ward disclaimer is identical regardless of city:
`onboard.wardDetectedHint`: *"Approximate area from your location — you can
change it."* This is honest framing for Mumbai (approximate boundary, correct
ward). For Pune and Thane it understates the actual risk — the detected result
isn't just imprecise at the edges, it can be entirely disconnected from where
the user is standing. There's no code path that varies confidence messaging,
detection radius behavior, or a "please double check manually" nudge by city,
even though the underlying data quality is not remotely the same across the
three.

---

## 7. Secondary algorithmic notes (lower priority, apply to all 3 cities)

- **Unique-bbox-match short-circuit has no confidence check**
  (`ward-detect.js:97-98`): if exactly one ward's bbox contains the point, it's
  returned immediately with no distance-to-centroid sanity check, even for
  large boxes where the point could be near the far edge. Low risk for Mumbai
  (boxes are reasonably tight), higher relative risk for Pune/Thane's uniform
  grid cells (roughly ~2.3km × ~2.4km each — coarse enough that "inside the
  box" doesn't mean "actually in that area").
- **Centroid tie-break ignores real boundary shape**: when multiple bboxes
  overlap, nearest-centroid is a reasonable heuristic but has no relationship
  to where a true polygon boundary would actually fall — inherent to not
  having real ward polygons, applies everywhere, most consequential for
  Mumbai's coastal/elongated wards where bboxes overlap the most.

---

## Recommendations, in priority order

1. **Replace Pune's and Thane's ward geometry with real data.** This is the
   one finding in this report that's a correctness problem, not just a
   precision limitation. Options, roughly in order of effort: (a) source real
   PMC prabhag and TMC ward boundary shapefiles/GeoJSON (often available via
   the corporation's open-data portal or OpenStreetMap's admin boundary tags
   for Pune/Thane) and convert to bbox+centroid at minimum, ideally true
   polygons; (b) at minimum, re-derive each named area's bbox from its *actual*
   coordinates (e.g. via a geocoding lookup per area name) instead of the
   current array-position grid — this alone would fix the core bug without
   needing full administrative boundary data.
2. **Rename Pune/Thane "wards" to match real terminology** ("Prabhag" for
   Pune) once real boundaries replace the synthetic grid — the current "Ward
   N" naming is itself a small trust problem independent of geometry.
3. **De-duplicate Thane's padded area list** ("Kopri"/"Kopri East",
   "Vartak Nagar" ×3, etc.) as part of the same pass — these should likely
   collapse to fewer, correctly-bounded real wards rather than staying as
   separate entries.
4. **Vary the detected-ward confidence messaging by city** once (1) is
   scheduled but not yet shipped — even a conditional "detection is less
   precise in Pune/Thane right now, please double-check" is more honest than
   the current one-size-fits-all disclaimer.
5. **Lower priority — real polygon data for Mumbai too**, to remove the
   bbox-overlap ambiguity at true ward borders; worth doing eventually but
   Mumbai's current data is functionally correct for the large majority of
   users, unlike Pune/Thane.

## What's already good — don't touch

- GPS acquisition strategy (`watchPosition` + best-of + low-accuracy fallback
  for monsoon/indoor conditions) — well-reasoned, keep as-is.
- Mumbai's ward list and society-suggestion coverage — accurate and complete.
- The "pick manually" escape hatch already present in onboarding for when
  detection fails or is wrong — good safety net regardless of the data fix
  above; make sure it stays prominent (it already is, per the earlier UX
  review) since it's currently the only reliable way for a Pune/Thane user to
  end up on their real ward.
