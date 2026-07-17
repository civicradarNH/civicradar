# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "js" / "app.js"
t = p.read_text(encoding="utf-8")
if "let wardDetectReady = Promise.resolve();" not in t:
    t = t.replace(
        "let markerRefreshTimer = null;",
        "let markerRefreshTimer = null;\n\n  let wardDetectReady = Promise.resolve();",
        1,
    )
t = t.replace(
    "const wardDetectReady = loadScriptOnce('js/ward-detect.js')",
    "wardDetectReady = loadScriptOnce('js/ward-detect.js')",
    1,
)
t = t.replace(
    "try { if (typeof wardDetectReady !== 'undefined') await wardDetectReady; } catch { /* ignore */ }",
    "try { await wardDetectReady; } catch { /* ignore */ }",
    1,
)
p.write_text(t, encoding="utf-8")
print("OK")
