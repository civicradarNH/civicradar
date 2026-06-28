import re
lines=open("js/app.js",encoding="utf-8").read().splitlines()
for i,l in enumerate(lines):
    if re.match(r"\s+(hi|mr|gu): \{", l):
        print(i+1, l.strip())
