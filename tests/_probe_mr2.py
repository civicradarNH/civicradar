import re
text=open("js/app.js",encoding="utf-8").read()
m=re.search(r"'location\.banner': '([^']+)'", text[text.find("mr:"):text.find("gu:")])
# simpler: line 5281
for line in text.splitlines():
    if line.strip().startswith("'location.banner':") and "Turn on" not in line:
        val=line.split("'",3)[3] if line.count("'")>=4 else ""
        # parse
        import ast
        try:
            d=ast.literal_eval("{"+line.strip().rstrip(',')+"}")
            v=list(d.values())[0]
            print(repr(v[:50]), any('\u0900'<=c<='\u097f' for c in v))
        except Exception as e:
            pass
