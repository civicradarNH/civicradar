#!/usr/bin/env python3
"""Generate ward-keyed society suggestions for CivicRadar config."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def extract_ward_names(path: Path, pattern: str) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return re.findall(pattern, text)


mumbai = extract_ward_names(ROOT / "js/wards/mumbai.js", r"name: '([^']+)'")

PUNE_AREAS_LIST = [
    "Kasba Vishrambag", "Bhavani Peth", "Swargate", "Shaniwar Peth", "Sadashiv Peth",
    "Kasba Peth", "Narayan Peth", "Raviwar Peth", "Shukrawar Peth", "Ganesh Peth",
    "Somwar Peth", "Mangalwar Peth", "Budhwar Peth", "Shivajinagar", "Model Colony",
    "Aundh", "Baner", "Balewadi", "Pashan", "Sus",
    "Kothrud", "Karve Nagar", "Warje", "Dahanukar Colony", "Bavdhan",
    "Erandwane", "Deccan", "Parvati", "Dhankawadi", "Bibwewadi",
    "Hadapsar", "Magarpatta", "Kondhwa", "Mohammedwadi", "Undri",
    "Wanowrie", "Fatima Nagar", "Koregaon Park", "Kalyani Nagar", "Yerwada",
    "Dhanori",
]
pune = [f"Ward {i + 1} — {area}" for i, area in enumerate(PUNE_AREAS_LIST)]

THANE_AREAS_LIST = [
    "Kopri", "Naupada", "Charai", "Panchpakhadi", "Vartak Nagar", "Hiranandani Estate",
    "Ghodbunder Road", "Kasarvadavali", "Waghbil", "Manpada", "Bhayandarpada",
    "Majiwada", "Kolshet", "Balkum", "Dhokali", "Kalwa East", "Kalwa West",
    "Mumbra", "Diva", "Shil",
    "Kausa", "Rabodi", "Jambli Naka", "Temghar", "Teen Hath Naka", "Cadbury Junction",
    "Wagle Estate", "Louis Wadi", "Hari Niwas", "Upvan", "Yeoor Hills",
    "Patlipada", "Hiranandani Meadows", "Beverly Park", "Vartak Nagar East", "Oswal Park",
    "Kolshet Road", "Mhada Colony", "Indira Nagar", "Ram Maruti Road", "Shree Nagar",
    "Kisan Nagar", "Naupada East", "Talao Pali", "Jambli Naka West", "Kharegaon",
    "Kolshet Industrial", "Balkum Naka", "Dawodi", "Kausa East", "Mumbra Devi",
    "Diva East", "Shil Phata", "Kasheli", "Bhiwandi Naka", "Majiwada East",
    "Hiranandani Estate West", "Manpada Hills", "Bhayandarpada East", "Waghbil Naka",
    "Ghodbunder Village", "Kopri East", "Charai West", "Panchpakhadi North", "Vartak Nagar West",
    "Kolshet West",
]
thane = [f"TMC Ward {i + 1} — {area}" for i, area in enumerate(THANE_AREAS_LIST)]

MAJOR_MUMBAI = {
    "G/N Ward": [
        "Shivaji Park CHS", "Hindu Colony CHS", "Dadar TT RWA", "Portuguese Church Lane",
        "Kataria Colony", "Shivaji Park Society", "Senapati Bapat Road CHS", "Dadar Parsi Colony",
        "Matunga Labour Camp", "Wadala Truck Terminus area", "Five Gardens CHS", "King's Circle CHS",
        "Dadar East RWA", "Naigaon CHS", "Prabhadevi Road CHS", "Siddhivinayak Lane",
        "Tulsiwadi CHS", "Matunga East CHS", "Antop Hill CHS", "Dadar West RWA",
    ],
    "G/S Ward": [
        "Worli Sea Face CHS", "Phoenix Mills area", "Lower Parel Mill lands", "Atria Mall vicinity",
        "Indiabulls Sky CHS", "Lodha World Towers", "Parel Village CHS", "Worli Naka CHS",
        "Century Mills area", "Hard Rock Cafe lane", "Dr Annie Besant Road", "N M Joshi Marg CHS",
        "Currey Road CHS", "Jacob Circle CHS", "Worli Koliwada", "Shiv Sagar Estate",
        "Trade World CHS", "Peninsula Corporate Park", "Mahalaxmi Racecourse area", "Delisle Road CHS",
    ],
    "H/W Ward": [
        "Pali Hill CHS", "Hill Road Bandra", "St Andrews Road", "Carter Road CHS",
        "Bandra Reclamation", "Linking Road CHS", "Turner Road CHS", "16th Road Bandra",
        "33rd Road Bandra", "Chimbai Village", "Mount Mary area", "Bandra West RWA",
        "Khar Danda CHS", "Khar West CHS", "Union Park CHS", "Pali Village CHS",
        "Waterfield Road CHS", "Perry Cross Road", "St Martin Road CHS", "Bandra Fort area",
    ],
    "H/E Ward": [
        "Bandra East CHS", "Khar East CHS", "Bandra Kurla Complex", "Kala Nagar CHS",
        "Dharavi Transit Camp", "Bharat Nagar CHS", "Garib Nagar CHS", "Kherwadi CHS",
        "Government Colony Bandra", "Navpada CHS", "Behrampada CHS", "Kherwadi Road CHS",
        "Bandra East RWA", "Khar East RWA", "MIG Bandra East", "Hill Road Khar East",
        "Chakala CHS", "Vakola Bridge area", "Kalina CHS", "Santacruz East CHS",
    ],
    "K/E Ward": [
        "Andheri East CHS", "Vile Parle East CHS", "Marol Military Road", "Saki Naka CHS",
        "MIDC Andheri", "Chakala Andheri", "JB Nagar CHS", "Mogra CHS", "Santacruz East CHS",
        "Sahar Village CHS", "Airport Road CHS", "Marol Naka CHS", "Andheri Kurla Road CHS",
        "Seepz MIDC area", "Kondivita CHS", "Tank Road Andheri", "Gundavali CHS",
        "Military Road Marol", "Sahar Cargo CHS", "Vile Parle East RWA",
    ],
    "K/W Ward": [
        "Andheri West CHS", "Vile Parle West CHS", "Versova CHS", "Lokhandwala Complex",
        "Oshiwara CHS", "Yari Road CHS", "Seven Bungalows CHS", "Four Bungalows CHS",
        "DN Nagar CHS", "JP Road Andheri", "Lokhandwala Back Road", "Madh Island CHS",
        "Versova Village", "Andheri West RWA", "Irla CHS", "SV Road Andheri",
        "Goregaon West border CHS", "Lokhandwala Garden CHS", "Yari Road RWA", "Versova Beach CHS",
    ],
    "L Ward": [
        "Kurla West CHS", "Sakinaka CHS", "Jarimari CHS", "Kurla East CHS", "Premier Auto CHS",
        "LBS Marg Kurla", "Sakinaka Naka CHS", "Kurla Village CHS", "Chunabhatti CHS",
        "Tilak Nagar Kurla", "Kurla Court area", "Sakinaka Industrial", "Kurla RWA",
        "Saki Vihar Road CHS", "Kamani CHS", "Kurla Station area", "Sakinaka Pipeline CHS",
        "Kurla West RWA", "Jarimari Industrial", "L Ward Sakinaka RWA",
    ],
    "D Ward": [
        "Malabar Hill CHS", "Tardeo CHS", "Walkeshwar CHS", "Cumbala Hill CHS", "Nepean Sea Road",
        "Altamount Road CHS", "Pedder Road CHS", "Breach Candy CHS", "Malabar Hill RWA",
        "Tardeo Road CHS", "Walkeshwar Tank area", "Hanging Gardens vicinity", "Malabar Hill Society",
        "Napean Sea Road CHS", "Tardeo Naka CHS",
    ],
    "F/N Ward": [
        "Sion CHS", "Matunga CHS", "King Circle CHS", "Sion East RWA", "Sion Koliwada",
        "Matunga Labour Camp", "Sion Hospital area", "Sion Circle CHS", "Matunga West CHS",
        "King's Circle RWA", "Sion Trombay Road CHS", "Matunga East CHS", "Sion Station area",
        "Ambedkar Road Sion", "Sion Dharavi link CHS",
    ],
    "F/S Ward": [
        "Parel CHS", "Sewri CHS", "Parel Village", "Sewri Fort area", "Parel RWA",
        "Sewri Cross Road CHS", "Parel Naka CHS", "Cotton Green CHS", "Sewri East CHS",
        "Parel East CHS", "Sewri Bunder CHS", "Parel Tank Road", "Sewri Hill CHS",
        "Parel West RWA", "Sewri Village CHS",
    ],
    "A Ward": [
        "Colaba CHS", "Fort area RWA", "Cuffe Parade CHS", "Nariman Point vicinity",
        "Gateway of India area", "Colaba Causeway CHS", "Apollo Bunder CHS", "Regal Cinema lane",
        "Colaba Market CHS", "Fort Railway CHS", "CST vicinity CHS", "Ballard Estate CHS",
    ],
    "B Ward": [
        "Dongri CHS", "Umarkhadi CHS", "Mohammed Ali Road CHS", "Dongri RWA", "Umarkhadi RWA",
        "Dongri Police Station area", "J J Hospital vicinity", "Dongri Market CHS",
        "Umarkhadi Naka CHS", "Dongri Gaon CHS",
    ],
    "C Ward": [
        "Bhuleshwar CHS", "Kalbadevi CHS", "Zaveri Bazaar CHS", "Crawford Market area",
        "Bhuleshwar RWA", "Kalbadevi Road CHS", "Mumbadevi Temple area", "Bhuleshwar Lane CHS",
        "Kalbadevi Market CHS", "C Ward Bhuleshwar Society",
    ],
    "E Ward": [
        "Byculla CHS", "Mazgaon CHS", "Byculla East RWA", "Mazgaon Docks area", "Byculla Zoo vicinity",
        "Mazgaon Hill CHS", "Byculla Station area", "Mazgaon RWA", "Byculla West CHS",
        "Mazgaon Village CHS",
    ],
    "M/E Ward": [
        "Chembur CHS", "Deonar CHS", "Chembur Camp CHS", "Deonar Dump vicinity RWA",
        "Chembur East RWA", "Deonar Village CHS", "Chembur Naka CHS", "Deonar East CHS",
        "Chembur Colony CHS", "Deonar RWA", "Chembur Gaon CHS", "Deonar West CHS",
    ],
    "M/W Ward": [
        "Marol CHS", "Jogeshwari CHS", "Marol Military Road CHS", "Jogeshwari East RWA",
        "Marol Naka CHS", "Jogeshwari West CHS", "Marol Village CHS", "Jogeshwari Station area",
        "Marol Industrial CHS", "Jogeshwari Hill CHS",
    ],
    "N Ward": [
        "Ghatkopar CHS", "Vikhroli CHS", "Ghatkopar East RWA", "Vikhroli West CHS",
        "Ghatkopar West CHS", "Vikhroli East CHS", "Ghatkopar Station area", "Vikhroli RWA",
        "Ghatkopar Gaon CHS", "Vikhroli Gaon CHS", "Rajawadi CHS", "Vikhroli Village CHS",
    ],
    "P/N Ward": [
        "Goregaon CHS", "Malad CHS", "Goregaon East RWA", "Malad West CHS", "Goregaon West CHS",
        "Malad East CHS", "Goregaon Station area", "Malad RWA", "Goregaon Gaon CHS",
        "Malad Gaon CHS", "Film City vicinity CHS", "Malad Marve CHS",
    ],
    "P/S Ward": [
        "Kandivali CHS", "Charkop CHS", "Kandivali East RWA", "Charkop Village CHS",
        "Kandivali West CHS", "Charkop Sector CHS", "Kandivali Station area", "Charkop RWA",
        "Kandivali Gaon CHS", "Charkop Gaon CHS",
    ],
    "R/N Ward": [
        "Dahisar CHS", "Borivali CHS", "Dahisar East RWA", "Borivali East CHS",
        "Dahisar West CHS", "Borivali West CHS", "Dahisar Station area", "Borivali RWA",
        "Dahisar Gaon CHS", "Borivali Gaon CHS",
    ],
    "R/C Ward": [
        "Borivali West CHS", "IC Colony CHS", "Borivali West RWA", "Lokhandwala Borivali",
        "Borivali West Gaon CHS", "IC Church area CHS", "Borivali West Station CHS",
        "Shimpoli Road CHS", "Borivali West Society", "IC Colony RWA",
    ],
    "R/S Ward": [
        "Kandivali West CHS", "Kandivali West RWA", "Thakur Village CHS", "Kandivali West Gaon",
        "Mahavir Nagar CHS", "Kandivali West Station area", "Hanuman Nagar CHS",
        "Kandivali West Society", "Thakur Complex CHS", "Kandivali West Lane CHS",
    ],
    "S Ward": [
        "Bhandup CHS", "Mulund CHS", "Bhandup West RWA", "Mulund West CHS",
        "Bhandup East CHS", "Mulund East CHS", "Bhandup Station area", "Mulund RWA",
        "Bhandup Gaon CHS", "Mulund Gaon CHS", "Bhandup Village CHS", "Mulund Colony CHS",
    ],
    "T Ward": [
        "Mulund CHS", "Nahur CHS", "Mulund East RWA", "Nahur East CHS", "Mulund West CHS",
        "Nahur West CHS", "Mulund Station area", "Nahur RWA", "Mulund Gaon CHS",
        "Nahur Gaon CHS", "Mulund Colony CHS", "Nahur Village CHS",
    ],
}

PUNE_AREAS = {
    "Kasba Vishrambag": [
        "Vishrambag Wada CHS", "Kasba Peth CHS", "Shaniwar Peth border RWA", "Vishrambag Society",
        "Kasba RWA", "Laxmi Road CHS", "Kasba Vishrambag RWA", "Shaniwar Wada vicinity",
        "Kasba lane CHS", "Vishrambag Housing",
    ],
    "Koregaon Park": [
        "Koregaon Park CHS", "Lane 5 KP", "Lane 6 KP", "Lane 7 KP", "North Main Road KP",
        "Osho Ashram area", "KP RWA", "Koregaon Park Annexe", "Lane 1 KP CHS",
        "Bund Garden Road KP", "KP Society Network", "Kalyani Nagar border CHS",
    ],
    "Baner": [
        "Baner Road CHS", "Aundh-Baner Link CHS", "Baner Pashan Link", "Sus Road CHS",
        "Baner RWA", "Vitthal Mandir area", "Baner Gaon CHS", "Pancard Club area",
        "Baner Hill CHS", "Sus Gaon border",
    ],
    "Hadapsar": [
        "Magarpatta CHS", "Hadapsar Gaon CHS", "Fursungi CHS", "Hadapsar RWA",
        "Magarpatta City A", "Magarpatta City B", "Hadapsar Industrial", "Saswad Road CHS",
        "Hadapsar Station area", "Kalewadi Hadapsar",
    ],
    "Kothrud": [
        "Kothrud CHS", "Karve Nagar CHS", "Paud Road CHS", "Kothrud RWA", "Vanaz CHS",
        "Ideal Colony Kothrud", "Mayur Colony CHS", "Kothrud Depot area", "Karve Putala CHS",
        "Kothrud Gaon CHS",
    ],
    "Shivajinagar": [
        "Shivajinagar CHS", "Model Colony CHS", "Fergusson College area", "Shivajinagar RWA",
        "JM Road CHS", "Ganeshkhind CHS", "Shivajinagar Station area", "Model Colony RWA",
        "FC Road CHS", "Shivajinagar Gaon",
    ],
    "Aundh": [
        "Aundh CHS", "Baner-Aundh Link CHS", "D P Road Aundh", "Aundh RWA", "Parihar Chowk area",
        "Aundh Gaon CHS", "ITI Road CHS", "Aundh Camp CHS", "Windsor County CHS", "Aundh-Baner CHS",
    ],
    "Magarpatta": [
        "Magarpatta City CHS", "Magarpatta Annex CHS", "Magarpatta RWA", "Magarpatta Hadapsar",
        "Magarpatta Sector 1", "Magarpatta Sector 2", "Magarpatta IT Park area",
        "Magarpatta Garden CHS", "Magarpatta Main Road CHS", "Magarpatta Society Network",
    ],
    "Wanowrie": [
        "Wanowrie CHS", "Fatima Nagar CHS", "Wanowrie RWA", "NIBM Road CHS", "Wanowrie Gaon CHS",
        "Fatima Nagar RWA", "Wanowrie Station area", "NIBM Annex CHS", "Wanowrie Society",
        "Fatima Nagar Society",
    ],
    "Yerwada": [
        "Yerwada CHS", "Yerwada Gaon CHS", "Yerwada RWA", "Bund Garden Yerwada", "Yerwada Jail vicinity",
        "Yerwada Station area", "Yerwada Society", "Yerwada Nagar CHS", "Yerwada Road CHS",
        "Yerwada Colony",
    ],
}

THANE_AREAS = {
    "Kopri": [
        "Kopri Colony CHS", "Kopri Naka CHS", "Kopri RWA", "Kopri East CHS", "Kopri West CHS",
        "Kopri Gaon CHS", "Kopri Station area", "Kopri Hill CHS", "Kopri Road CHS", "Kopri Industrial",
    ],
    "Ghodbunder Road": [
        "GB Road CHS", "Kavesar CHS", "Hiranandani Estate CHS", "GB Road RWA", "Owale CHS",
        "Manpada GB Road", "Kavesar Gaon CHS", "GB Road West CHS", "Kolshet GB Road",
        "Hiranandani Meadows border",
    ],
    "Hiranandani Estate": [
        "Hiranandani Estate CHS", "Hiranandani Meadows CHS", "Hiranandani RWA", "Heaven CHS",
        "Hiranandani Circle CHS", "Hiranandani Business Park", "Hiranandani Estate West",
        "Hiranandani Estate East", "Lake Enclave CHS", "Hiranandani Gardens Thane",
    ],
    "Wagle Estate": [
        "Wagle Estate CHS", "Wagle Industrial CHS", "Wagle Estate RWA", "Wagle Estate Phase 1",
        "Wagle Estate Phase 2", "Wagle Naka CHS", "Wagle Udyan CHS", "Wagle Estate Road CHS",
        "Wagle Estate MIDC", "Wagle Estate Society",
    ],
    "Panchpakhadi": [
        "Panchpakhadi CHS", "Talao Pali area CHS", "Panchpakhadi RWA", "Naupada border CHS",
        "Panchpakhadi Naka", "Panchpakhadi Road CHS", "Panchpakhadi East CHS", "Panchpakhadi West CHS",
        "Panchpakhadi Gaon", "Panchpakhadi Society",
    ],
    "Manpada": [
        "Manpada CHS", "Manpada Hills CHS", "Manpada RWA", "Manpada Gaon CHS", "Manpada Road CHS",
        "Manpada East CHS", "Manpada West CHS", "Manpada Village", "Manpada Society", "Manpada Naka CHS",
    ],
    "Kasarvadavali": [
        "Kasarvadavali CHS", "Kasarvadavali RWA", "Kasarvadavali Gaon CHS", "Kasarvadavali Station area",
        "Kasarvadavali Road CHS", "Kasarvadavali East CHS", "Kasarvadavali West CHS",
        "Kasarvadavali Society", "Kasarvadavali Nagar CHS", "Kasarvadavali Hills CHS",
    ],
    "Vartak Nagar": [
        "Vartak Nagar CHS", "Vartak Nagar RWA", "Vartak Nagar East CHS", "Vartak Nagar West CHS",
        "Vartak Nagar Gaon CHS", "Vartak Nagar Road CHS", "Vartak Nagar Society",
        "Vartak Nagar Station area", "Vartak Nagar Colony CHS", "Vartak Nagar Hills CHS",
    ],
}


def gen_mumbai(name: str) -> list[str]:
    prefix = name.split(" — ")[0]
    for key, societies in MAJOR_MUMBAI.items():
        if name.startswith(key):
            return societies[:]
    area = name.split(" — ")[-1] if " — " in name else name
    parts = [p.strip() for p in area.replace(",", " ").split() if p.strip()]
    base: list[str] = []
    for p in parts[:3]:
        base += [f"{p} CHS", f"{p} RWA", f"{p} Nagar CHS", f"{p} Colony"]
    base += [f"{area} Housing Society", f"{area} RWA", f"{prefix} Residents Association"]
    seen: set[str] = set()
    out: list[str] = []
    for s in base:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out[:12]


def gen_pune(name: str) -> list[str]:
    area = name.split(" — ")[-1] if " — " in name else name
    if area in PUNE_AREAS:
        return PUNE_AREAS[area][:]
    return [
        f"{area} CHS", f"{area} RWA", f"{area} Housing Society", f"{area} Nagar CHS",
        f"{area} Colony", f"{area} Residents Association", f"{area} Gaon CHS",
        f"{area} Road CHS", f"{area} Society", f"Ward {area} CHS",
    ][:10]


def gen_thane(name: str) -> list[str]:
    area = name.split(" — ")[-1] if " — " in name else name
    if area in THANE_AREAS:
        return THANE_AREAS[area][:]
    return [
        f"{area} CHS", f"{area} RWA", f"{area} Housing Society", f"{area} Nagar CHS",
        f"{area} Colony", f"{area} Residents Association", f"TMC {area} CHS",
        f"{area} Gaon CHS", f"{area} Road CHS", f"{area} Society",
    ][:10]


data = {
    "mumbai": {w: gen_mumbai(w) for w in mumbai},
    "pune": {w: gen_pune(w) for w in pune},
    "thane": {w: gen_thane(w) for w in thane},
}

for city, wards in data.items():
    counts = [len(v) for v in wards.values()]
    print(
        f"{city}: wards={len(counts)} total={sum(counts)} "
        f"min={min(counts)} max={max(counts)} avg={sum(counts) / len(counts):.1f}"
    )

out = ROOT / "js" / "society-suggestions-data.js"
out.write_text(
    "/* Ward-keyed society/neighbourhood suggestions — NOT a full registry */\n"
    "(function (global) {\n"
    "  'use strict';\n"
    "  global.CIVICRADAR_SOCIETY_BY_WARD = "
    + json.dumps(data, indent=2, ensure_ascii=False)
    + ";\n"
    "})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print(f"written {out}")
