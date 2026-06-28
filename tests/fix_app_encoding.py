from pathlib import Path
import re

p = Path(r'C:\civicradar\js\app.js')
t = p.read_text(encoding='utf-8')
t = re.sub(
    r"'home\.hero\.subline': 'Monsoon is here[^']*'",
    "'home.hero.subline': 'Monsoon is here — pin stagnant water on the spot: snap a photo, neighbours Me too.'",
    t,
    count=1,
)
# Fix file header comment em dash
t = t.replace('CivicRadar \u009d Core', 'CivicRadar — Core', 1)
t = t.replace('CivicRadar \ufffd Core', 'CivicRadar — Core', 1)
p.write_text(t, encoding='utf-8')
print('done')
