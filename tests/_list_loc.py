lines=open("js/app.js",encoding="utf-8").read().splitlines()
for i,l in enumerate(lines):
    if "'location." in l and i<2000:
        print(l.strip())
