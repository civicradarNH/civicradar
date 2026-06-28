# -*- coding: utf-8 -*-
"""Fix corrupted location.* i18n strings (question marks) in hi/mr/gu."""
from pathlib import Path

TRANSLATIONS = {
    "hi": {
        "location.banner": "खतरों को सटीक दिखाने के लिए लोकेशन चालू करें।",
        "location.bannerNearby": "खतरे रिपोर्ट करने और नज़दीकी मुद्दे देखने के लिए लोकेशन चालू करें।",
        "location.unavailable": "इस ब्राउज़र में लोकेशन उपलब्ध नहीं है।",
        "location.withdrawn": "लोकेशन की अनुमति वापस ली गई। जब रिपोर्ट करना चाहें तब फिर चालू करें।",
        "location.dismiss": "लोकेशन संकेत बंद करें",
        "location.locate": "मेरा स्थान",
        "location.locateAria": "लोकेशन चालू करें",
        "location.enable": "चालू करें",
    },
    "mr": {
        "location.banner": "धोक अचूक दाखवण्यासाठी स्थान सुरू करा.",
        "location.bannerNearby": "धोके नोंदवण्यासाठी आणि जवळचे मुद्दे पाहण्यासाठी स्थान सुरू करा.",
        "location.unavailable": "या ब्राउझरमध्ये स्थान उपलब्ध नाही.",
        "location.withdrawn": "स्थान परवानगी रद्द केली. नोंदवायचं असेल तेव्हा पुन्हा सुरू करा.",
        "location.dismiss": "स्थान सूचना बंद करा",
        "location.locate": "माझे स्थान",
        "location.locateAria": "स्थान सुरू करा",
        "location.enable": "सुरू करा",
    },
    "gu": {
        "location.banner": "જોખમો ચોક્કસ દર્શાવવા માટે સ્થાન ચાલુ કરો.",
        "location.bannerNearby": "જોખમો રિપોર્ટ કરવા અને નજીકના મુદ્દા જોવા માટે સ્થાન ચાલુ કરો.",
        "location.unavailable": "આ બ્રાઉઝરમાં સ્થાન ઉપલબ્ધ નથી.",
        "location.withdrawn": "સ્થાનની પરવાનગી પાછી લeli. રિપોર્ટ કરવું હોય ત્યારે ફરી ચાલુ કરો.",
        "location.dismiss": "સ્થાન સૂચના બંધ કરો",
        "location.locate": "મારું સ્થાન",
        "location.locateAria": "સ્થાન ચાલુ કરો",
        "location.enable": "ચાલુ કરો",
    },
}

path = Path("js/app.js")
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
lang = None
changed = 0
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith("hi: {"):
        lang = "hi"
    elif stripped.startswith("mr: {"):
        lang = "mr"
    elif stripped.startswith("gu: {"):
        lang = "gu"
    elif stripped.startswith("en: {") or stripped == "};":
        if stripped == "};" and lang:
            lang = None
    if not lang or lang not in TRANSLATIONS:
        continue
    for key, val in TRANSLATIONS[lang].items():
        needle = f"'{key}':"
        if needle in line and "?" in line:
            indent = line[: len(line) - len(line.lstrip())]
            lines[i] = f"{indent}'{key}': '{val}',\n"
            changed += 1

text = "".join(lines)
path.write_text(text, encoding="utf-8")
dev = sum(1 for c in text if "\u0900" <= c <= "\u097f")
print("replaced lines", changed, "devanagari chars now", dev)
