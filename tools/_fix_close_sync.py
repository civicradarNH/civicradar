# -*- coding: utf-8 -*-
import re
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "js" / "app.js"
t = p.read_text(encoding="utf-8")
pat = re.compile(
    r"(\} else \{\s*"
    r"// Rebind trap \+ move focus into the still-open parent \(e\.g\. success ← escalation\)\.\s*"
    r")restoreFocusTrapToTopmost\(\);\s*"
    r"(\}\s*"
    r"\}\s*"
    r"function getTopmostOpenModalName\(\))",
    re.M,
)
m = pat.search(t)
if not m:
    raise SystemExit("closeModal end pattern missing")
repl = (
    m.group(1)
    + "try { restoreFocusTrapToTopmost(); } catch { /* ignore */ }\n\n    }\n\n    syncSheetDepthClass();\n\n  }\n\n\n\n  function getTopmostOpenModalName()"
)
# Careful - group 2 includes closing braces. Rebuild more carefully.
old = m.group(0)
new = old.replace(
    "restoreFocusTrapToTopmost();",
    "try { restoreFocusTrapToTopmost(); } catch { /* ignore */ }",
    1,
)
if "syncSheetDepthClass();" not in new:
    # Insert before final `  }\n\n\n\n  function getTopmost`
    new = re.sub(
        r"(\n  \}\n\n\n\n  function getTopmostOpenModalName)",
        r"\n\n    syncSheetDepthClass();\1",
        new,
        count=1,
    )
t = t[: m.start()] + new + t[m.end() :]
p.write_text(t, encoding="utf-8")
print("closeModal sync patched" if "syncSheetDepthClass" in new else "FAIL")
