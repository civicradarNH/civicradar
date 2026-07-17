# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).with_name("_apply_v238.py")
text = p.read_text(encoding="utf-8")
start = text.find("    geo_new = [")
end = text.find('    if "function syncSheetDepthClass()" not in t:')
if start < 0 or end < 0:
    raise SystemExit(f"markers missing: {start} {end}")

replacement = r'''    import importlib.util

    _i18n_path = Path(__file__).with_name('_v238_i18n.py')
    _spec = importlib.util.spec_from_file_location('v238i18n', _i18n_path)
    _mod = importlib.util.module_from_spec(_spec)
    assert _spec and _spec.loader
    _spec.loader.exec_module(_mod)
    geo_new = [_mod.strengthen_geo(old, i) for i, old in enumerate(geo_vals[:4])]
    cam_new = [_mod.strengthen_cam(old, i) for i, old in enumerate(cam_vals[:4])]

    for old, new in zip(geo_vals[:4], geo_new):
        needle = f"'report.geoExplainerBody': '{old}'"
        repl = f"'report.geoExplainerBody': '{new}'"
        if needle not in t:
            raise SystemExit('geo needle missing')
        t = t.replace(needle, repl, 1)

    for old, new in zip(cam_vals[:4], cam_new):
        needle = f"'report.cameraDisclosureBody': '{old}'"
        repl = f"'report.cameraDisclosureBody': '{new}'"
        if needle not in t:
            raise SystemExit('cam needle missing')
        t = t.replace(needle, repl, 1)

'''
p.write_text(text[:start] + replacement + text[end:], encoding="utf-8")
print("fixed")
