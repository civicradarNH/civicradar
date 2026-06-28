#!/usr/bin/env python3
"""Restore hi/mr/gu i18n blocks from clean v86 git HEAD into current app.js."""
import re
from pathlib import Path

ROOT = Path(r'C:\civicradar')
clean = (ROOT / 'tests' / '_app_git.js').read_text(encoding='utf-8')
app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')

for lang in ('hi', 'mr', 'gu'):
    m_clean = re.search(rf"    {lang}: \{{\n", clean)
    if not m_clean:
        continue
    start = m_clean.start()
    # find matching closing `    },` for this lang block (next lang or en closing pattern)
    rest = clean[start:]
    depth = 0
    end = 0
    for i, ch in enumerate(rest):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = rest[:end]
    app = re.sub(rf"    {lang}: \{{.*?\n    \}},?\n", block + ',\n', app, count=1, flags=re.S)
    print('restored', lang, 'chars', len(block))

(ROOT / 'js' / 'app.js').write_text(app, encoding='utf-8')
print('written app.js')
