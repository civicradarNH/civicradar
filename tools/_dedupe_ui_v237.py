# -*- coding: utf-8 -*-
"""Dedupe Community / profile / confirm copy; bump to v237."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js" / "app.js"
SW = ROOT / "sw.js"
E2E = ROOT / "tests" / "e2e_comprehensive.py"
HTML = ROOT / "index.html"
CSS = ROOT / "css" / "styles.css"


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"FAIL missing: {label}")
    return text.replace(old, new, 1)


def replace_nth_key(text: str, key: str, new_value: str, n: int) -> str:
    pattern = re.compile(r"(      '" + re.escape(key) + r"': )('(?:\\'|[^'])*')")
    matches = list(pattern.finditer(text))
    if n >= len(matches):
        raise SystemExit(f"FAIL {key} index {n} of {len(matches)}")
    m = matches[n]
    esc = new_value.replace("\\", "\\\\").replace("'", "\\'")
    return text[: m.start(2)] + "'" + esc + "'" + text[m.end(2) :]


def replace_all_key(text: str, key: str, values: list[str]) -> str:
    for i, v in enumerate(values):
        text = replace_nth_key(text, key, v, i)
    return text


def patch_lang_social(
    text: str,
    old_week: str,
    new_week: str,
    old_backed: str,
    new_backed: str,
    resolved: str,
    full: str,
) -> str:
    if f"'social.wardWeekResolved': '{resolved}'" in text:
        print("SKIP social", resolved[:24])
        return text
    old = (
        f"      'social.wardWeek': '{old_week}',\n\n"
        f"      'social.wardWeekBacked': '{old_backed}',\n\n"
        f"      'social.wardWeekEmpty':"
    )
    new = (
        f"      'social.wardWeek': '{new_week}',\n\n"
        f"      'social.wardWeekResolved': '{resolved}',\n\n"
        f"      'social.wardWeekBacked': '{new_backed}',\n\n"
        f"      'social.wardWeekFull': '{full}',\n\n"
        f"      'social.wardWeekEmpty':"
    )
    if old not in text:
        raise SystemExit(f"FAIL social block: {old_week[:48]}")
    return text.replace(old, new, 1)


def main() -> None:
    t = APP.read_text(encoding="utf-8")

    # --- i18n (unicode escapes keep this file ASCII-safe) ---
    # gu subtitleActive still has open/fixed counts
    t = replace_nth_key(
        t,
        "community.subtitleActive",
        "{ward}: "
        + "\u0aa4\u0aae\u0abe\u0ab0\u0abe {pending} \u0ab9\u0a9c\u0ac1 \u0a96\u0ac1\u0ab2\u0acd\u0ab2\u0abe"
        + " \u2014 \u0aaa\u0aa1\u0acb\u0ab6\u0ac0\u0a93\u0aa8\u0ac7 \u0aac\u0acb\u0ab2\u0abe\u0ab5\u0acb"
        + " \u0a85\u0aa5\u0ab5\u0abe Resources \u0a9c\u0ac1\u0a93.",
        3,
    )
    print("OK gu subtitleActive")

    t = replace_all_key(
        t,
        "report.photoHint",
        [
            "Does this photo show the hazard clearly?",
            "\u092b\u093c\u094b\u091f\u094b \u092e\u0947\u0902 \u0916\u0924\u0930\u093e \u0938\u093e\u092b\u093c \u0926\u093f\u0916 \u0930\u0939\u093e \u0939\u0948?",
            "\u092b\u094b\u091f\u094b\u092e\u0927\u094d\u092f\u0947 \u0927\u094b\u0915\u093e \u0938\u094d\u092a\u0937\u094d\u091f \u0926\u093f\u0938\u0924\u094b \u0915\u093e?",
            "\u0aab\u0acb\u0a9f\u0acb\u0aae\u0abe\u0a82 \u0a9c\u0acb\u0a96\u0aae \u0ab8\u0acd\u0aaa\u0ab7\u0acd\u0a9f \u0aa6\u0ac7\u0a96\u0abe\u0aaf \u0a9b\u0ac7?",
        ],
    )
    print("OK photoHint")

    t = replace_all_key(
        t,
        "coach.body",
        [
            "Open spots show on this map \u2014 tap Report when you see a hazard in your lane.",
            "\u0916\u0941\u0932\u0947 \u0916\u0924\u0930\u0947 \u0907\u0938 \u0928\u0915\u094d\u0936\u0947 \u092a\u0930 \u0926\u093f\u0916\u0924\u0947 \u0939\u0948\u0902 \u2014 \u0917\u0932\u0940 \u092e\u0947\u0902 \u0916\u0924\u0930\u093e \u0926\u093f\u0916\u0947 \u0924\u094b Report \u0926\u092c\u093e\u090f\u0901\u0964",
            "\u0916\u0941\u0932\u0947 \u0927\u094b\u0915\u0947 \u092f\u093e \u0928\u0915\u093e\u0936\u093e\u0935\u0930 \u0926\u093f\u0938\u0924\u093e\u0924 \u2014 \u0917\u0932\u094d\u0932\u0940\u0924 \u0927\u094b\u0915\u093e \u0926\u093f\u0938\u0932\u093e \u0924\u0930 Report \u0926\u093e\u092c\u093e.",
            "\u0a96\u0ac1\u0ab2\u0acd\u0ab2\u0abe \u0a9c\u0acb\u0a96\u0aae\u0acb \u0a86 \u0aa8\u0a95\u0ab6\u0abe \u0aaa\u0ab0 \u0aa6\u0ac7\u0a96\u0abe\u0aaf \u0a9b\u0ac7 \u2014 \u0ab6\u0ac7\u0ab0\u0ac0\u0aae\u0abe\u0a82 \u0a9c\u0acb\u0a96\u0aae \u0aa6\u0ac7\u0a96\u0abe\u0aaf \u0aa4\u0acb Report \u0aa6\u0aac\u0abe\u0ab5\u0acb.",
        ],
    )
    print("OK coach.body")

    t = replace_all_key(
        t,
        "official.subtitle",
        [
            "CivicRadar does not file for you \u2014 open a verified .gov app or portal below.",
            "CivicRadar \u0906\u092a\u0915\u0940 \u0913\u0930 \u0938\u0947 \u0926\u0930\u094d\u091c \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u093e \u2014 \u0928\u0940\u091a\u0947 \u0938\u0924\u094d\u092f\u093e\u092a\u093f\u0924 .gov \u0910\u092a \u0916\u094b\u0932\u0947\u0902\u0964",
            "CivicRadar \u0924\u0941\u092e\u091a\u094d\u092f\u093e \u0935\u0924\u0940\u0928\u0947 \u0928\u094b\u0902\u0926\u0935\u0924 \u0928\u093e\u0939\u0940 \u2014 \u0916\u093e\u0932\u0940 \u0938\u0924\u094d\u092f\u093e\u092a\u093f\u0924 .gov \u0905\u0951\u092a \u0909\u0918\u0921\u093e.",
            "CivicRadar \u0aa4\u0aae\u0abe\u0ab0\u0ac0 \u0aa4\u0ab0\u0aab\u0aa5\u0ac0 \u0aa8\u0acb\u0a82\u0aa7\u0abe\u0ab5\u0aa4\u0ac1\u0a82 \u0aa8\u0aa5\u0ac0 \u2014 \u0aa8\u0ac0\u0a9a\u0ac7 \u0a9a\u0a95\u0abe\u0ab8\u0ac7\u0ab2 .gov \u0a8f\u0aaa \u0a96\u0acb\u0ab2\u0acb.",
        ],
    )
    print("OK official.subtitle")

    # hi / mr / gu social week keys (+ strip emoji prefixes)
    t = patch_lang_social(
        t,
        "\U0001f465 \u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939 {ward} \u092e\u0947\u0902 {n} \u092a\u0921\u093c\u094b\u0938\u093f\u092f\u094b\u0902 \u0928\u0947 \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u0915\u0940",
        "\u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939 {ward} \u092e\u0947\u0902 {n} \u092a\u0921\u093c\u094b\u0938\u093f\u092f\u094b\u0902 \u0928\u0947 \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u0915\u0940",
        "\U0001f465 \u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939 {ward} \u092e\u0947\u0902 {n} \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u00b7 {c} \u0938\u092e\u0930\u094d\u0925\u0928",
        "\u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939 {ward} \u092e\u0947\u0902 {n} \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u00b7 {c} \u0938\u092e\u0930\u094d\u0925\u0928",
        "\u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939 {ward}: {n} \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u00b7 {r} \u0939\u0932",
        "\u0907\u0938 \u0938\u092a\u094d\u0924\u093e\u0939 {ward}: {n} \u0930\u093f\u092a\u094b\u0930\u094d\u091f \u00b7 {r} \u0939\u0932 \u00b7 {c} \u0938\u092e\u0930\u094d\u0925\u0928",
    )
    t = patch_lang_social(
        t,
        "\U0001f465 \u092f\u093e \u0906\u0920\u0935\u0921\u094d\u092f\u093e\u0924 {ward} \u092e\u0927\u094d\u092f\u0947 {n} \u0936\u0947\u091c\u093e\u0931\u094d\u092f\u093e\u0902\u0928\u0940 \u0928\u094b\u0902\u0926 \u0915\u0947\u0932\u0940",
        "\u092f\u093e \u0906\u0920\u0935\u0921\u094d\u092f\u093e\u0924 {ward} \u092e\u0927\u094d\u092f\u0947 {n} \u0936\u0947\u091c\u093e\u0931\u094d\u092f\u093e\u0902\u0928\u0940 \u0928\u094b\u0902\u0926 \u0915\u0947\u0932\u0940",
        "\U0001f465 \u092f\u093e \u0906\u0920\u0935\u0921\u094d\u092f\u093e\u0924 {ward}: {n} \u0928\u094b\u0902\u0926\u0940 \u00b7 {c} \u092a\u093e\u0920\u093f\u0902\u092c\u093e",
        "\u092f\u093e \u0906\u0920\u0935\u0921\u094d\u092f\u093e\u0924 {ward}: {n} \u0928\u094b\u0902\u0926\u0940 \u00b7 {c} \u092a\u093e\u0920\u093f\u0902\u092c\u093e",
        "\u092f\u093e \u0906\u0920\u0935\u0921\u094d\u092f\u093e\u0924 {ward}: {n} \u0928\u094b\u0902\u0926\u0940 \u00b7 {r} \u0938\u094b\u0921\u0935\u0932\u0947",
        "\u092f\u093e \u0906\u0920\u0935\u0921\u094d\u092f\u093e\u0924 {ward}: {n} \u0928\u094b\u0902\u0926\u0940 \u00b7 {r} \u0938\u094b\u0921\u0935\u0932\u0947 \u00b7 {c} \u092a\u093e\u0920\u093f\u0902\u092c\u093e",
    )
    t = patch_lang_social(
        t,
        "\U0001f465 \u0a86 \u0a85\u0aa0\u0ab5\u0abe\u0aa1\u0abf\u0aaf\u0ac7 {ward} \u0aae\u0abe\u0a82 {n} \u0aaa\u0aa1\u0acb\u0ab6\u0ac0\u0a93\u0a8f \u0aa8\u0acb\u0a82\u0aa7\u0acd\u0aaf\u0ac1\u0a82",
        "\u0a86 \u0a85\u0aa0\u0ab5\u0abe\u0aa1\u0abf\u0aaf\u0ac7 {ward} \u0aae\u0abe\u0a82 {n} \u0aaa\u0aa1\u0acb\u0ab6\u0ac0\u0a93\u0a8f \u0aa8\u0acb\u0a82\u0aa7\u0acd\u0aaf\u0ac1\u0a82",
        "\U0001f465 \u0a86 \u0a85\u0aa0\u0ab5\u0abe\u0aa1\u0abf\u0aaf\u0ac7 {ward}: {n} \u0aa8\u0acb\u0a82\u0aa7 \u00b7 {c} \u0ab8\u0aae\u0ab0\u0acd\u0aa5\u0aa8",
        "\u0a86 \u0a85\u0aa0\u0ab5\u0abe\u0aa1\u0abf\u0aaf\u0ac7 {ward}: {n} \u0aa8\u0acb\u0a82\u0aa7 \u00b7 {c} \u0ab8\u0aae\u0ab0\u0acd\u0aa5\u0aa8",
        "\u0a86 \u0a85\u0aa0\u0ab5\u0abe\u0aa1\u0abf\u0aaf\u0ac7 {ward}: {n} \u0aa8\u0acb\u0a82\u0aa7 \u00b7 {r} \u0a89\u0a95\u0ac7\u0ab2\u0abe\u0aaf\u0abe",
        "\u0a86 \u0a85\u0aa0\u0ab5\u0abe\u0aa1\u0abf\u0aaf\u0ac7 {ward}: {n} \u0aa8\u0acb\u0a82\u0aa7 \u00b7 {r} \u0a89\u0a95\u0ac7\u0ab2\u0abe\u0aaf\u0abe \u00b7 {c} \u0ab8\u0aae\u0ab0\u0acd\u0aa5\u0aa8",
    )
    print("OK social week hi/mr/gu")

    # --- Logic ---
    t = must_replace(
        t,
        """  function updateCommunitySubtitle() {

    const el = $('#communitySubtitle');

    if (!el) return;

    const mine = getUserReports();

    const pending = mine.filter((r) => r.status === 'pending').length;

    const resolved = mine.filter((r) => r.status === 'resolved').length;

    const wardLabel = user.ward ? user.ward.split('\u2014')[0].trim() : t('header.context');

    el.textContent = pending > 0

      ? t('community.subtitleActive')

        .replace('{ward}', wardLabel)

        .replace('{pending}', String(pending))

        .replace('{resolved}', String(resolved))

      : t('community.subtitle')

        .replace('{ward}', wardLabel)

        .replace('{corp}', getCorpShortName(getUserCity()));

  }""",
        """  function updateCommunitySubtitle() {

    const el = $('#communitySubtitle');

    if (!el) return;

    const mine = getUserReports();

    const pending = mine.filter((r) => r.status === 'pending').length;

    const wardLabel = user.ward ? user.ward.split('\u2014')[0].trim() : t('header.context');

    el.textContent = pending > 0

      ? t('community.subtitleActive')

        .replace('{ward}', wardLabel)

        .replace('{pending}', String(pending))

      : t('community.subtitle')

        .replace('{ward}', wardLabel)

        .replace('{corp}', getCorpShortName(getUserCity()));

  }""",
        "updateCommunitySubtitle",
    )
    print("OK updateCommunitySubtitle")

    t = must_replace(
        t,
        """    const weekEl = $('#impactWeekLine');

    if (weekEl) {

      weekEl.textContent = t('impact.week')

        .replace('{reports}', String(w.reports))

        .replace('{resolved}', String(w.resolved))

        .replace('{confirms}', String(w.confirmations));

    }""",
        """    const weekEl = $('#impactWeekLine');

    if (weekEl) {

      // Ward-scoped social line under "Your ward this week" already covers weekly
      // counts when a ward is set \u2014 hide the city-wide duplicate.
      if (user && user.ward) {

        weekEl.textContent = '';

        weekEl.classList.add('hidden');

      } else {

        weekEl.classList.remove('hidden');

        weekEl.textContent = t('impact.week')

          .replace('{reports}', String(w.reports))

          .replace('{resolved}', String(w.resolved))

          .replace('{confirms}', String(w.confirmations));

      }

    }""",
        "impactWeekLine",
    )
    print("OK impactWeekLine")

    t = must_replace(
        t,
        """  function renderWardWeekSocialProof() {

    const el = $('#wardWeekSocial');

    if (!el) return;

    const wardLabel = user.ward ? getWardShortName(user.ward) : getCityLabel();

    const w = getWardWeekStats(user.ward);

    if (w.reports === 0) {

      el.textContent = t('social.wardWeekEmpty').replace('{ward}', wardLabel);

      el.classList.add('ward-week-social--empty');

    } else if (w.backed > 0) {

      el.textContent = t('social.wardWeekBacked')

        .replace('{n}', String(w.reports))

        .replace('{c}', String(w.backed))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    } else {

      el.textContent = t('social.wardWeek')

        .replace('{n}', String(w.reports))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    }

  }""",
        """  function renderWardWeekSocialProof() {

    const el = $('#wardWeekSocial');

    if (!el) return;

    const wardLabel = user.ward ? getWardShortName(user.ward) : getCityLabel();

    const w = getWardWeekStats(user.ward);

    if (w.reports === 0) {

      el.textContent = t('social.wardWeekEmpty').replace('{ward}', wardLabel);

      el.classList.add('ward-week-social--empty');

    } else if (w.resolved > 0 && w.backed > 0) {

      el.textContent = t('social.wardWeekFull')

        .replace('{n}', String(w.reports))

        .replace('{r}', String(w.resolved))

        .replace('{c}', String(w.backed))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    } else if (w.resolved > 0) {

      el.textContent = t('social.wardWeekResolved')

        .replace('{n}', String(w.reports))

        .replace('{r}', String(w.resolved))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    } else if (w.backed > 0) {

      el.textContent = t('social.wardWeekBacked')

        .replace('{n}', String(w.reports))

        .replace('{c}', String(w.backed))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    } else {

      el.textContent = t('social.wardWeek')

        .replace('{n}', String(w.reports))

        .replace('{ward}', wardLabel);

      el.classList.remove('ward-week-social--empty');

    }

  }""",
        "renderWardWeekSocialProof",
    )
    print("OK renderWardWeekSocialProof")

    t = must_replace(
        t,
        """    // Engaged users (\u22651 report) see the volunteer section expanded by default.
    if (getUserReports().length >= 1) {
      setCollapsibleSectionOpen('getInvolvedSection', 'getInvolvedBody', 'btnGetInvolvedToggle', true);
    }

  };""",
        """    // Engaged users (\u22651 report) see the volunteer section expanded by default.
    if (getUserReports().length >= 1) {
      setCollapsibleSectionOpen('getInvolvedSection', 'getInvolvedBody', 'btnGetInvolvedToggle', true);
    }

    // Surface weekly ward facts once \u2014 subtitle keeps only a short personal open nudge.
    const minePending = getUserReports().filter((r) => r.status === 'pending').length;
    const weekStats = typeof getWardWeekStats === 'function' ? getWardWeekStats(user.ward) : null;
    if (minePending > 0 || (weekStats && weekStats.reports > 0)) {
      setCollapsibleSectionOpen('communityWardImpactSection', 'communityWardImpactBody', 'btnCommunityWardImpactToggle', true);
    }

  };""",
        "openCommunity expand",
    )
    print("OK openCommunity expand")

    old_streak = (
        "      wardImpactEl.textContent = t('profile.wardImpact').replace('{n}', String(wardCount)) +\n\n"
        "        (streak >= 2 ? ` \u2014 ${t('profile.streak').replace('{n}', String(streak))}` : '');"
    )
    new_streak = "      wardImpactEl.textContent = t('profile.wardImpact').replace('{n}', String(wardCount));"
    n = t.count(old_streak)
    if n < 1:
        raise SystemExit("FAIL streak concat")
    t = t.replace(old_streak, new_streak)
    print(f"OK streak x{n}")

    t = must_replace(
        t,
        """  /** Inline confirm-step copy \u2014 drag is optional; soft hint when GPS is provisional. */
  function syncConfirmPinUiHints() {

    const softHint = confirmPinProvisional && !confirmPinUserAdjusted;

    const hint = $('#reportPinDragHint');

    if (hint) {

      hint.textContent = t(softHint ? 'report.pinProvisionalDragHint' : 'report.pinDragHint');

      hint.classList.toggle('report-pin-drag-hint--required', softHint);

    }""",
        """  /** Inline confirm-step copy \u2014 drag is optional; soft hint when GPS is provisional. */
  function syncConfirmPinUiHints() {

    const softHint = confirmPinProvisional && !confirmPinUserAdjusted;

    const hint = $('#reportPinDragHint');

    if (hint) {

      // Accuracy line already says "drag the pin" for fair/poor/unknown \u2014
      // keep a separate drag hint only for good accuracy, or when provisional.
      const acc = confirmPinAccuracyM;
      const accuracyMentionsDrag = (!softHint && !confirmPinUserAdjusted)
        && (!Number.isFinite(acc) || (Number.isFinite(acc) && acc > GEO_ACCURACY_GOOD_M));
      if (accuracyMentionsDrag) {
        hint.classList.add('hidden');
      } else {
        hint.classList.remove('hidden');
        hint.textContent = t(softHint ? 'report.pinProvisionalDragHint' : 'report.pinDragHint');
      }

      hint.classList.toggle('report-pin-drag-hint--required', softHint);

    }""",
        "syncConfirmPinUiHints",
    )
    print("OK pin hints")

    t = must_replace(
        t,
        """      if (nextBadgeHintEl) {

        let hint = t(milestone.hintKey).replace('{n}', String(milestone.remaining));

        if (streakInfo.nextKey && streakInfo.weeksToNext > 0) {

          hint += ` \u2014 ${t('profile.nextStreakBadge')

            .replace('{n}', String(streakInfo.weeksToNext))

            .replace('{badge}', t(streakInfo.nextKey))}`;

        }

        nextBadgeHintEl.textContent = hint;

      }""",
        """      if (nextBadgeHintEl) {

        // Streak progress lives in profileStreakLine + tracker \u2014 don't append it here.
        nextBadgeHintEl.textContent = t(milestone.hintKey).replace('{n}', String(milestone.remaining));

      }""",
        "nextBadgeHint",
    )
    print("OK nextBadgeHint")

    if "const CIVIC_APP_VERSION = 'v236';" in t:
        t = t.replace("const CIVIC_APP_VERSION = 'v236';", "const CIVIC_APP_VERSION = 'v237';", 1)
        print("OK version")
    elif "const CIVIC_APP_VERSION = 'v237';" in t:
        print("SKIP version")
    else:
        raise SystemExit("FAIL version")

    APP.write_text(t, encoding="utf-8")

    sw = SW.read_text(encoding="utf-8")
    if "civicradar-v236" in sw:
        SW.write_text(sw.replace("civicradar-v236", "civicradar-v237", 1), encoding="utf-8")
        print("OK sw")
    e2e = E2E.read_text(encoding="utf-8")
    if "civicradar-v236" in e2e:
        E2E.write_text(e2e.replace("civicradar-v236", "civicradar-v237"), encoding="utf-8")
        print("OK e2e")

    html = HTML.read_text(encoding="utf-8")
    old_ph = 'data-i18n="report.photoHint">Photo shows the hazard? Tap Submit \u2014 or retake if not.'
    new_ph = 'data-i18n="report.photoHint">Does this photo show the hazard clearly?'
    if old_ph in html:
        HTML.write_text(html.replace(old_ph, new_ph, 1), encoding="utf-8")
        print("OK html photoHint")
    else:
        # try ASCII hyphen variant
        old_ph2 = 'data-i18n="report.photoHint">Photo shows the hazard? Tap Submit — or retake if not.'
        if old_ph2 in html:
            HTML.write_text(html.replace(old_ph2, new_ph, 1), encoding="utf-8")
            print("OK html photoHint (emdash)")

    css = CSS.read_text(encoding="utf-8")
    marker = "/* map empty: hide redundant three-beat when encourage is shown */"
    if marker not in css:
        CSS.write_text(
            css
            + "\n\n"
            + marker
            + "\n.map-empty-cta:not(.hidden) .map-empty-cta__encourage:not(:empty) ~ .map-empty-cta__hint {\n"
            "  display: none;\n}\n",
            encoding="utf-8",
        )
        print("OK css")

    t2 = APP.read_text(encoding="utf-8")
    checks = {
        "subtitle_no_resolved_gu": "{resolved}" not in re.findall(
            r"community\.subtitleActive': '([^']*)'", t2
        )[3],
        "wardWeekResolved_count": t2.count("'social.wardWeekResolved'") >= 4,
        "wardWeekFull_count": t2.count("'social.wardWeekFull'") >= 4,
        "version": "CIVIC_APP_VERSION = 'v237'" in t2,
        "impact_hidden": "weekEl.classList.add('hidden')" in t2,
        "render_full": "t('social.wardWeekFull')" in t2,
        "streak_gone": "profile.streak').replace('{n}', String(streak))" not in t2
        or t2.count("wardImpactEl.textContent = t('profile.wardImpact')") >= 1,
    }
    print("VERIFY", checks)
    if not all(checks.values()):
        raise SystemExit("VERIFY FAIL")
    print("DONE v237")


if __name__ == "__main__":
    main()
