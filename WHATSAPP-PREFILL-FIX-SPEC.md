# CivicRadar — WhatsApp filing prefill blank on real devices: root cause + exact fix

Cursor-ready spec. Verified against current code (v445). Report only in the
sense that no file has been edited yet — this doc contains the exact patch
to apply.

## Confirmed vs. suspected

**Confirmed by direct testing:** I intercepted `window.open` in a live
browser session and called `openOfficialChannel('bmc_whatsapp', {report})`
with a synthetic report. It produced a fully populated `wa.me` URL with a
correctly encoded `text=` parameter — the JS-level logic is not the bug.

**Not directly testable from here** (no real phone / native WhatsApp app in
this environment): what actually happens when a mobile OS resolves that
`wa.me` URL and hands off to the WhatsApp app. The user confirmed live, on
their phone, against the current deployed build (v445, latest on `main`)
that WhatsApp opens with the message box blank.

Given the JS output is correct but the on-device result is blank, the two
most likely causes — both well-documented, independent of this app's logic
— are addressed below. Apply both; either could be the actual cause and
there's no way to isolate which without a real-device test after the fix.

---

## Root cause A — `wa.me` is a redirector, not the real endpoint

Every WhatsApp-open in this codebase currently targets `https://wa.me/...`.
`wa.me` is a Meta-owned short-link that 302-redirects to
`https://api.whatsapp.com/send` before the OS hands off to the native app.
On that redirect hop — especially from a PWA/installed-app context, or with
a long query string — mobile Chrome/Safari's app-link resolution is widely
reported to drop the `text` query param, landing the user in WhatsApp with
an empty compose box even though the URL that was opened had `text=...` on
it. Going directly to `api.whatsapp.com/send?phone=...&text=...` (skipping
the redirect hop) is the standard fix cited for this exact symptom.

## Root cause B — the prefilled text is bloated with content that doesn't belong in a WhatsApp message

`buildCitizenComplaintText()` (`js/app.js:41238`) just calls
`buildBmcComplaintCopyText()` (`js/app.js:45995`), which builds **one
combined block** meant to serve three different channels at once: pasting
into a portal form, reading aloud to a call-centre operator, and (currently)
prefilling WhatsApp. That block includes, unconditionally:

- category / ward / landmark / GPS + Maps link / date / complaint status
  (genuinely useful in a WhatsApp message)
- a full **Marathi call-centre script** section (`copy1916.marathiHeader` +
  lead/action lines) — only relevant when *speaking* to 1916, meaningless
  pasted into a WhatsApp chat
- a CivicRadar deep-link line, occasionally suffixed with a dev-only
  caveat string (`copy1916.linkLocalhostNote`, only shown on localhost —
  won't appear in production, but still bulk that doesn't belong here)

Then `buildOfficialSummaryText()` (`js/app.js:1709`), which builds the
WhatsApp `text=` param on top of that, **adds a second, redundant report-ID
line and a second, redundant date line** in a different format:

```
Date: 25 Jul 2026                                    ← from copy1916.dateLabel (inside the block)
...
Reference (optional): CivicRadar ID test-report-123  ← from copy1916.refId (inside the block)
...
CivicRadar report ID: test-report-123                ← from buildOfficialSummaryText, duplicate
Report date: 7/25/2026                                ← from buildOfficialSummaryText, duplicate, different format
```

The result, captured live from the current code: a ~1,050-character URL
after encoding, containing a Marathi paragraph, a duplicated report ID, a
duplicated date in two formats, and (on localhost) a caveat sentence — none
of which a citizen needs in a WhatsApp chat with MyBMC. Long, redundant
query strings are exactly the shape most likely to hit a mobile browser's
URL-length or app-link-parsing limits, compounding root cause A. Trimming
this is not just cosmetic — it directly reduces the odds of the prefill
getting dropped.

---

## Fix 1 — add a WhatsApp-specific, trimmed summary builder

Add this new function immediately after `buildOfficialSummaryText`
(`js/app.js:1709-1733`), so both are defined together:

```js
  function buildWhatsappComplaintText(report, channelId) {
    if (!report) return '';
    const city = getReportCity(report);
    const wardParts = parseWardParts(report.ward);
    const wardLine = formatWardForCopy(wardParts);
    const category = bmcCategoryLabel(report.hazard);
    const complaintFiledKey = city === 'pune' ? 'copy1916.pmc.complaintFiled' : city === 'thane' ? 'copy1916.tmc.complaintFiled' : 'copy1916.complaintFiled';
    const complaintNotFiledKey = city === 'pune' ? 'copy1916.pmc.complaintNotFiled' : city === 'thane' ? 'copy1916.tmc.complaintNotFiled' : 'copy1916.complaintNotFiled';
    const dateStr = new Date(report.timestamp).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    const lines = [
      `${te('copy1916.categoryLabel')}: ${category}`,
      `${te('copy1916.wardLabel')}: ${wardLine}`,
    ];
    if (report.notes) lines.push(`${te('copy1916.landmarkLabel')}: ${report.notes}`);
    if (report.lat != null && report.lng != null) {
      lines.push(`${te('copy1916.gpsLabel')}: ${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`);
      if (isGpsOutsideCity(report.lat, report.lng, city)) {
        lines.push(te('copy1916.gpsWarning').replace('{city}', getCityLabel(city)));
      }
      lines.push(`${te('copy1916.mapsLabel')}: https://maps.google.com/?q=${report.lat},${report.lng}`);
    }
    lines.push(`${te('copy1916.dateLabel')}: ${dateStr}`);
    lines.push(
      report.complaintId
        ? te(complaintFiledKey).replace('{id}', report.complaintId)
        : te(complaintNotFiledKey)
    );

    const hint = getOfficialCategoryHint(channelId, report.hazard, city);
    if (hint) lines.push(te('official.categoryHint').replace('{hint}', hint));

    lines.push(te('copy1916.refId').replace('{id}', report.id));
    lines.push(te('official.photoGuidance'));

    return lines.join('\n');
  }
```

This reuses only existing i18n keys (no new strings, no language work
needed) and drops the Marathi block, the CivicRadar deep-link line, and
both duplicate lines — category, ward, landmark, GPS+Maps, date, complaint
status, suggested-category hint, report ID, photo tip, each stated once.

---

## Fix 2 — add one shared WhatsApp-opener that uses `api.whatsapp.com`

Add this near `buildWhatsappComplaintText` (or any shared-utility spot —
it has no dependency on the functions above):

```js
  function openWhatsAppUrl(phone, text) {
    const params = new URLSearchParams();
    if (phone) params.set('phone', String(phone).replace(/^\+/, ''));
    if (text) params.set('text', text);
    const qs = params.toString();
    window.open(`https://api.whatsapp.com/send${qs ? '?' + qs : ''}`, '_blank');
  }
```

`api.whatsapp.com/send` is the real endpoint `wa.me` redirects to — this
skips the redirect hop that's the most likely place the `text` param gets
dropped on real devices. Works for both the phone+text case (BMC/PMC/TMC
filing) and the phone-less generic share case (`shareWhatsApp`, fix 3f
below).

---

## Fix 3 — route every existing WhatsApp-open through the two fixes above

Five call sites currently build `wa.me` URLs independently. Update each.

### 3a. `bmc_whatsapp` channel metadata — `js/app.js:1477-1493`

**Current:**
```js
      case 'bmc_whatsapp':
        return {
          id: 'bmc_whatsapp',
          icon: 'whatsapp-logo',
          label: t('official.bmcWa.label'),
          small: BMC.whatsapp ? ('+' + String(BMC.whatsapp).replace(/^\+/, '')) : '',
          url: `https://wa.me/${BMC.whatsapp}`,
          urlKind: 'whatsapp',
        };
```

**Replace with:**
```js
      case 'bmc_whatsapp':
        return {
          id: 'bmc_whatsapp',
          icon: 'whatsapp-logo',
          label: t('official.bmcWa.label'),
          small: BMC.whatsapp ? ('+' + String(BMC.whatsapp).replace(/^\+/, '')) : '',
          url: `https://api.whatsapp.com/send?phone=${BMC.whatsapp}`,
          urlKind: 'whatsapp',
        };
```

### 3b. `pmc_wa` channel metadata — `js/app.js:1545-1561`

**Current:**
```js
      case 'pmc_wa':
        return corp.whatsapp ? {
          id: 'pmc_wa',
          icon: 'whatsapp-logo',
          label: t('esc.pmc.channelWa'),
          small: t('esc.pmc.channelWaSmall'),
          url: `https://wa.me/${corp.whatsapp}`,
          urlKind: 'whatsapp',
        } : null;
```

**Replace with:**
```js
      case 'pmc_wa':
        return corp.whatsapp ? {
          id: 'pmc_wa',
          icon: 'whatsapp-logo',
          label: t('esc.pmc.channelWa'),
          small: t('esc.pmc.channelWaSmall'),
          url: `https://api.whatsapp.com/send?phone=${corp.whatsapp}`,
          urlKind: 'whatsapp',
        } : null;
```

### 3c. `openOfficialChannel()` — `js/app.js:1753-1785`

This is the handler behind every `[data-official-channel]` button (the
"more ways to file" panel on Resources, the success modal, and the
escalation modal's extras section). It needs to: use the trimmed builder
for WhatsApp specifically, and append `text=` correctly now that the
WhatsApp `meta.url` already contains a `?phone=` query param (so it must
join with `&`, not `?`).

**Current:**
```js
  function openOfficialChannel(channelId, opts) {
    const options = opts || {};
    const report = options.report || (options.reportId ? findReportById(options.reportId) : null);
    const city = getReportCity(report || {}) || getUserCity();
    const meta = resolveOfficialChannelMeta(channelId, city);
    if (!meta || !meta.url) return;
    let url = meta.url;
    if (meta.urlKind === 'whatsapp' && report) {
      url = `${meta.url}?text=${encodeURIComponent(buildOfficialSummaryText(report, channelId))}`;
    }
    if (options.copySummary !== false && report) {
      copyTextSafe(buildOfficialSummaryText(report, channelId), 'official.copyDone');
    }
    trackOfficialChannelOpen(channelId, options.context || 'panel', report?.ward, report?.hazard);
    if (meta.urlKind === 'tel') window.open(url, '_self');
    else window.open(url, '_blank');
  }
```

**Replace with:**
```js
  function openOfficialChannel(channelId, opts) {
    const options = opts || {};
    const report = options.report || (options.reportId ? findReportById(options.reportId) : null);
    const city = getReportCity(report || {}) || getUserCity();
    const meta = resolveOfficialChannelMeta(channelId, city);
    if (!meta || !meta.url) return;
    const isWhatsapp = meta.urlKind === 'whatsapp';
    const summaryText = report
      ? (isWhatsapp ? buildWhatsappComplaintText(report, channelId) : buildOfficialSummaryText(report, channelId))
      : '';
    let url = meta.url;
    if (isWhatsapp && report) {
      url = `${meta.url}${meta.url.includes('?') ? '&' : '?'}text=${encodeURIComponent(summaryText)}`;
    }
    if (options.copySummary !== false && report) {
      copyTextSafe(summaryText || buildOfficialSummaryText(report, channelId), 'official.copyDone');
    }
    trackOfficialChannelOpen(channelId, options.context || 'panel', report?.ward, report?.hazard);
    if (meta.urlKind === 'tel') window.open(url, '_self');
    else window.open(url, '_blank');
  }
```

### 3d. `escalationFileWhatsApp()` — `js/app.js:42875-42887`

This is the escalation modal's primary "Recommended: MyBMC WhatsApp" tier
button (`#btnEscWhatsApp`) — likely the single most-clicked WhatsApp entry
point in the app, and hardcoded to BMC regardless of which corp channel
list is active.

**Current:**
```js
  function escalationFileWhatsApp() {
    setEscGuidanceChannel('whatsapp');
    const report = findReportById(activeEscalationId);
    trackBmcEvent('bmc_channel_opened', { channel: 'whatsapp' }, report?.ward);
    const text = encodeURIComponent(report ? buildCitizenComplaintText(report) : 'Hazard report — CivicRadar');
    window.open(`https://wa.me/${BMC.whatsapp}?text=${text}`, '_blank');
  }
```

**Replace with:**
```js
  function escalationFileWhatsApp() {
    setEscGuidanceChannel('whatsapp');
    const report = findReportById(activeEscalationId);
    trackBmcEvent('bmc_channel_opened', { channel: 'whatsapp' }, report?.ward);
    const text = report ? buildWhatsappComplaintText(report, 'bmc_whatsapp') : 'Hazard report — CivicRadar';
    openWhatsAppUrl(BMC.whatsapp, text);
  }
```

### 3e. `openCorpWhatsApp(report, corp)` — `js/app.js:42151-42161`

The PMC/TMC-generic equivalent of 3d (dispatched via `data-corp-channel`
and `data-esc-channel="corp-wa"`).

**Current:**
```js
  function openCorpWhatsApp(report, corp) {
    const wa = corp && corp.whatsapp;
    if (!wa) return;
    const text = encodeURIComponent(report ? buildCitizenComplaintText(report) : 'Hazard report — CivicRadar');
    window.open(`https://wa.me/${wa}?text=${text}`, '_blank');
  }
```

**Replace with:**
```js
  function openCorpWhatsApp(report, corp) {
    const wa = corp && corp.whatsapp;
    if (!wa) return;
    const text = report ? buildWhatsappComplaintText(report, 'pmc_wa') : 'Hazard report — CivicRadar';
    openWhatsAppUrl(wa, text);
  }
```

*(`channelId` param passed to `buildWhatsappComplaintText` only affects
`getOfficialCategoryHint`'s lookup — `'pmc_wa'` is a reasonable default
here since this function currently only ever receives PMC/TMC corps; if
`getCityCorpChannels` is ever extended to a corp where that hint lookup
matters per-city, thread the real channel id through instead.)*

### 3f. `shareWhatsApp()` — `js/app.js:38962-38976` (optional, same root cause, lower priority)

Not part of the BMC/PMC/TMC filing flow — this is the generic "share this
report / share the app" WhatsApp button (success modal, referral pitch,
etc.), with much shorter text so it's less likely to hit any length-related
failure. Same domain-reliability issue applies though; low-risk one-line
fix, worth doing while in this code:

**Current:**
```js
    window.open(`https://wa.me/?text=${text}`, '_blank');
```

**Replace with:**
```js
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
```

(`text` here is already `encodeURIComponent`-ed a few lines above, so this
one stays a plain template string rather than switching to
`openWhatsAppUrl`, which does its own encoding — don't double-encode.)

---

## Ship checklist reminder (per CLAUDE.md)

- Bump `CIVIC_APP_VERSION` in `js/app.js` (currently `v445`)
- Bump `CACHE` in `sw.js` to match
- Update SW06 in `tests/e2e_comprehensive.py` if it checks the cache string
- **Test on a real phone after deploying**, both BMC (Mumbai) and PMC/TMC
  (Pune/Thane) WhatsApp buttons. This is the one thing that could not be
  verified from this environment — the JS-level fix is confirmed correct
  (tested live), but whether it resolves the actual on-device blank-message
  symptom can only be confirmed on a real device against the deployed build.
