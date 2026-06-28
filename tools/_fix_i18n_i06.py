# -*- coding: utf-8 -*-
from pathlib import Path
path = Path("js/app.js")
text = path.read_text(encoding="utf-8")
replacements = [
    ("hi", "'profile.title': '???? ?????????', 'profile.persona': '??????',",
     "'profile.title': 'आपकी प्रोफ़ाइल', 'profile.persona': 'नागरिक',"),
    ("hi", "'community.title': '??????',", "'community.title': 'समुदाय',"),
    # about.subtitle hi - match prefix
]
# find hi about.subtitle line
for line in text.splitlines():
    if "'about.subtitle':" in line and "Mumbai" not in line and "????" in line and line.strip().startswith("'about"):
        old_hi_about = line.strip().rstrip(",")
        break
else:
    old_hi_about = None

FIX = {
    "hi": {
        "'community.title': '??????',": "'community.title': 'समुदाय',",
        "'profile.title': '???? ?????????', 'profile.persona': '??????',": "'profile.title': 'आपकी प्रोफ़ाइल', 'profile.persona': 'नागरिक',",
    },
    "mr": {
        "'community.title': '??????',": "'community.title': 'समुदाय',",
        "'profile.title': '????? ????????', 'profile.persona': '??????',": "'profile.title': 'तुमचे प्रोफाइल', 'profile.persona': 'नागरिक',",
    },
}

# about subtitles - replace any hi/mr about.subtitle line with ?
import re
def fix_about(lang, new):
    global text
    pat = rf"(\s+'about\.subtitle': ')[^']*(\?[^']*)(')"
    # simpler: line by line in lang blocks
    pass

lines = text.splitlines(keepends=True)
lang = None
changed = 0
for i, line in enumerate(lines):
    st = line.strip()
    if st.startswith("hi: {"): lang = "hi"
    elif st.startswith("mr: {"): lang = "mr"
    elif st.startswith("gu: {"): lang = "gu"
    elif st.startswith("en: {"):
        lang = "en"
    if lang in FIX:
        for old, new in FIX[lang].items():
            if old in line:
                lines[i] = line.replace(old, new)
                changed += 1
    if lang == "hi" and "'about.subtitle':" in line and "?" in line and "Mumbai" not in line:
        indent = line[: len(line) - len(line.lstrip())]
        lines[i] = indent + "'about.subtitle': 'मुंबई, पुणे और ठाणे के लिए समुदाय-संचालित वार्ड मानचित्र — अज्ञात हेल्पलाइन नहीं।',\n"
        changed += 1
    if lang == "mr" and "'about.subtitle':" in line and "?" in line and "Mumbai" not in line:
        indent = line[: len(line) - len(line.lstrip())]
        lines[i] = indent + "'about.subtitle': 'मुंबई, पुणे आणि ठाण्यासाठी समुदाय-चालित वॉर्ड नकाशा — निनावी हेल्पलाइन नाही.',\n"
        changed += 1

path.write_text("".join(lines), encoding="utf-8")
print("changed", changed)
