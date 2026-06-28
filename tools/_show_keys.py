lines=open("js/app.js",encoding="utf-8").read().splitlines()
keys=["profile.title","community.title","about.subtitle","fab.report"]
lang=None
for i,l in enumerate(lines):
    s=l.strip()
    if s.startswith("hi: {"): lang="hi"
    elif s.startswith("mr: {"): lang="mr"
    elif s.startswith("gu: {"): lang="gu"
    elif s.startswith("en: {"): lang="en"
    for k in keys:
        if f"'{k}':" in l and lang:
            print(lang, k, l.strip()[:90])
