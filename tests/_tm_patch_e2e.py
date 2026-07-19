#!/usr/bin/env python3
"""Patch e2e harness: re-apply local overrides after reload; harden submit helper."""
from pathlib import Path

p = Path(__file__).resolve().parent / "e2e_comprehensive.py"
t = p.read_text(encoding="utf-8")

old_close = '''async def close_all_modals(page):

    await page.evaluate('() => { if (typeof window.closeAllModals === "function") window.closeAllModals(); else Object.values({profile:"profileOverlay",community:"communityOverlay",report:"reportOverlay",lang:"langOverlay",lead:"leadOverlay",admin:"adminOverlay",partner:"partnerOverlay",coordinator:"coordinatorOverlay",adminQueue:"adminQueueOverlay"}).forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove("open"); el.setAttribute("aria-hidden","true"); } }); document.body.style.overflow=""; }')
'''

new_close = '''async def close_all_modals(page):

    await page.evaluate(
        """() => {
          if (typeof window.closeAllModals === 'function') window.closeAllModals();
          else {
            Object.values({
              profile: 'profileOverlay', community: 'communityOverlay', report: 'reportOverlay',
              lang: 'langOverlay', lead: 'leadOverlay', admin: 'adminOverlay',
              partner: 'partnerOverlay', coordinator: 'coordinatorOverlay',
              adminQueue: 'adminQueueOverlay', success: 'successOverlay',
            }).forEach((id) => {
              const el = document.getElementById(id);
              if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
            });
            document.body.style.overflow = '';
          }
          // Force-close celebrate so a prior success cannot satisfy submit waits.
          const success = document.getElementById('successOverlay');
          if (success) {
            success.classList.remove('open');
            success.setAttribute('aria-hidden', 'true');
          }
        }"""
    )
'''

old_wait = '''async def wait_for_map_ready(page, timeout=20000):

    await page.wait_for_function(

        '() => typeof L !== "undefined" && !!document.querySelector("#map .leaflet-container")',

        timeout=timeout,

    )
'''

new_helpers = '''async def apply_test_runtime_overrides(page):
    """Re-assert local/demo harness after navigation.

    init-script Object.assign is overwritten when config.js assigns a fresh
    CIVICRADAR_CONFIG on every full load/reload — moderation + Supabase come back.
    """
    await page.evaluate(
        """() => {
          if (window.CIVICRADAR_CONFIG) {
            window.CIVICRADAR_CONFIG.moderation = { enabled: false };
            window.CIVICRADAR_CONFIG.supabaseUrl = '';
            window.CIVICRADAR_CONFIG.supabaseAnonKey = '';
          }
        }"""
    )
    await ensure_local_mode(page)




async def wait_for_map_ready(page, timeout=20000):

    await page.wait_for_function(

        '() => typeof L !== "undefined" && !!document.querySelector("#map .leaflet-container")',

        timeout=timeout,

    )
'''

old_submit_start = '''async def submit_report_via_api(page, lat=19.0760, lng=72.8777, notes='test hazard'):
    # Photo-first flow + optional ImageModeration scan need the report sheet open;
    # moderation alone can take several seconds after click.
    await page.evaluate(
        """() => {
          try { localStorage.setItem('civicradar_report_camera_disclosure', '1'); } catch (_) {}
          try { localStorage.setItem('civicradar_report_geo_explainer', '1'); } catch (_) {}
          if (typeof window.openReportModal === 'function') window.openReportModal(false);
        }"""
    )
'''

new_submit_start = '''async def submit_report_via_api(page, lat=19.0760, lng=72.8777, notes='test hazard'):
    # Photo-first flow + optional ImageModeration scan need the report sheet open;
    # moderation alone can take several seconds after click.
    await apply_test_runtime_overrides(page)
    await page.evaluate(
        """() => {
          try { localStorage.setItem('civicradar_report_camera_disclosure', '1'); } catch (_) {}
          try { localStorage.setItem('civicradar_report_geo_explainer', '1'); } catch (_) {}
          const success = document.getElementById('successOverlay');
          if (success) {
            success.classList.remove('open');
            success.setAttribute('aria-hidden', 'true');
          }
          if (typeof window.openReportModal === 'function') window.openReportModal(false);
        }"""
    )
'''

old_goto_mod = '''    await page.evaluate(

        '() => { if (window.CIVICRADAR_CONFIG) window.CIVICRADAR_CONFIG.moderation = { enabled: false }; }'

    )
'''

new_goto_mod = '''    await apply_test_runtime_overrides(page)
'''

checks = {
    "close_all_modals": old_close in t,
    "wait_for_map_ready": old_wait in t,
    "submit_start": old_submit_start in t,
    "goto_mod": old_goto_mod in t,
}
print("CHECKS", checks)
if not all(checks.values()):
    raise SystemExit(1)

t = t.replace(old_close, new_close, 1)
t = t.replace(old_wait, new_helpers, 1)
t = t.replace(old_submit_start, new_submit_start, 1)
t = t.replace(old_goto_mod, new_goto_mod, 1)

# After report-draft reloads, re-apply overrides (RP21 → RP07 path).
reload_needle = "await page.reload()\n\n    await page.wait_for_selector('#reportOverlay.open'"
reload_repl = (
    "await page.reload()\n\n"
    "    await apply_test_runtime_overrides(page)\n\n"
    "    await page.wait_for_selector('#reportOverlay.open'"
)
count = t.count(reload_needle)
print("reload_sites", count)
if count < 1:
    raise SystemExit("no reload sites")
t = t.replace(reload_needle, reload_repl)

# Also cover wait_until form if present for draft restore
reload_needle2 = (
    "await page.reload(wait_until='domcontentloaded')\n\n"
    "    await page.wait_for_selector('#reportOverlay.open'"
)
if reload_needle2 in t:
    t = t.replace(
        reload_needle2,
        "await page.reload(wait_until='domcontentloaded')\n\n"
        "    await apply_test_runtime_overrides(page)\n\n"
        "    await page.wait_for_selector('#reportOverlay.open'",
    )
    print("reload_sites2 patched")

# Bump submit wait slightly (NSFW fail-open is 8s when overrides miss).
t = t.replace(
    """            arg=notes,
            timeout=12000,
        )
    except Exception:
        pass

    await page.wait_for_timeout(200)

    return await page.evaluate(
        \"\"\"(notes) => {
          const reps = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
          const hit = reps.find((r) => r.notes === notes);
          return hit ? hit.id : null;
        }\"\"\",
        notes,
    )""",
    """            arg=notes,
            timeout=16000,
        )
    except Exception:
        pass

    await page.wait_for_timeout(200)

    return await page.evaluate(
        \"\"\"(notes) => {
          const reps = JSON.parse(localStorage.getItem('mosquiTrackReports') || '[]');
          const hit = reps.find((r) => r.notes === notes);
          return hit ? hit.id : null;
        }\"\"\",
        notes,
    )""",
    1,
)

p.write_text(t, encoding="utf-8")
print("OK patched", p)
print("has apply_test_runtime_overrides", "async def apply_test_runtime_overrides" in t)
print("submit calls apply", t.count("await apply_test_runtime_overrides(page)"))
