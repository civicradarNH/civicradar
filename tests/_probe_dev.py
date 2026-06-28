text=open("js/app.js",encoding="utf-8").read()
dev=sum(1 for c in text if "\u0900"<=c<="\u097f")
print("devanagari chars", dev)
# find mr block start
idx=text.find("  mr: {")
chunk=text[idx:idx+50000]
for key in ["location.banner","location.dismiss","location.locateAria","nav.map"]:
    import re
    m=re.search(r"'"+key+r"': '([^']*)'", chunk)
    if m:
        v=m.group(1)
        print(key, "dev", any("\u0900"<=c<="\u097f" for c in v), "len", len(v))
