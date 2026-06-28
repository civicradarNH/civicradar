from pathlib import Path
lines = Path(r'C:\civicradar\js\app.js').read_text(encoding='utf-8-sig').splitlines()
for n, line in enumerate(lines[:536], 1):
    if line.count('`') % 2 == 1:
        print('odd backtick', n, repr(line[:120]))
total = sum(line.count('`') for line in lines[:536])
print('total backticks in 1-536:', total)
