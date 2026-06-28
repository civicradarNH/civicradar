import re
text=open("js/app.js",encoding="utf-8").read()
# I18N mr section - find location.banner in mr block by line numbers ~5281
for i,line in enumerate(text.splitlines(),1):
    if "location.banner" in line and 5200 < i < 5350:
        print(i, line.strip()[:100])
