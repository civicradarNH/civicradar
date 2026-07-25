# One-shot: add Gujarati keys for Community feedback items 6–7.
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "js" / "app.js"
text = path.read_text(encoding="utf-8")

old1 = (
    "      'community.winsEmpty': 'ઠીક થયેલા સ્પોટ અહીં દેખાશે. એક ફરિયાદ નોંધો, પડોશીઓને સાથે લો, અને તમારી શેરી સુધરતી જુઓ.',\n"
    "\n"
    "      'community.winsNeighbours': '{ward} માં પડોશીઓ',"
)
new1 = (
    "      'community.winsEmpty': 'ઠીક થયેલા સ્પોટ અહીં દેખાશે. એક ફરિયાદ નોંધો, પડોશીઓને સાથે લો, અને તમારી શેરી સુધરતી જુઓ.',\n"
    "\n"
    "      'community.winsEmptyAction': 'જોખમ રિપોર્ટ કરો',\n"
    "\n"
    "      'community.winsNeighbours': '{ward} માં પડોશીઓ',"
)
if "community.winsEmptyAction': 'જોખમ" in text:
    print("winsEmptyAction gu already present")
elif old1 not in text:
    raise SystemExit("winsEmpty gu block not found")
else:
    text = text.replace(old1, new1, 1)
    print("winsEmptyAction gu inserted")

old2 = (
    "      'community.challenge.empty': '{ward} હજુ બોર્ડ પર નથી — જોખમની જાણ કરો અને તેને બોર્ડ પર લાવો.',\n"
    "\n"
    "      'community.challenge.beat':"
)
new2 = (
    "      'community.challenge.empty': '{ward} હજુ બોર્ડ પર નથી — જોખમની જાણ કરો અને તેને બોર્ડ પર લાવો.',\n"
    "\n"
    "      'community.challenge.noFixesYet': 'હજુ કોઈ વોર્ડે ઉકેલ નોંધાવ્યો નથી — પહેલા બનો.',\n"
    "\n"
    "      'community.challenge.beat':"
)
if "community.challenge.noFixesYet': 'હજુ કોઈ" in text:
    print("noFixesYet gu already present")
elif old2 not in text:
    raise SystemExit("challenge.empty gu block not found")
else:
    text = text.replace(old2, new2, 1)
    print("noFixesYet gu inserted")

path.write_text(text, encoding="utf-8")
print("winsEmptyAction count", text.count("community.winsEmptyAction"))
print("noFixesYet count", text.count("community.challenge.noFixesYet"))
