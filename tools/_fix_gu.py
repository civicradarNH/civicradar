t=open("js/app.js",encoding="utf-8").read()
bad="સ્થાનની પરવાનગી પાછી લeli. રિપોર્ટ કરવું હોય ત્યારે ફરી ચાલુ કરો."
good="સ્થાનની પરવાનગી પાછી લીધી. રિપોર્ટ કરવું હોય ત્યારે ફરી ચાલુ કરો."
if bad in t:
    t=t.replace(bad, good)
    open("js/app.js","w",encoding="utf-8").write(t)
    print("fixed gu withdrawn")
else:
    print("not found, searching leli")
    import re
    for line in t.splitlines():
        if "location.withdrawn" in line and "gu" not in line and "Turn on" not in line:
            if "eli" in line or "?" in line:
                print(line[:120])
