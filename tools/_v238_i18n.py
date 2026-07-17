# -*- coding: utf-8 -*-
"""v238 disclosure copy helpers (en/hi/mr/gu)."""


def strengthen_geo(old: str, i: int) -> str:
    if i == 0:
        return (
            "We use your precise location only to place this hazard pin on the community map. "
            "Pins and photos are visible to neighbours in your ward. "
            "Location is not sold or used for marketing."
        )
    reps = [
        ("हम स्थान नहीं बेचते।", "स्थान नहीं बेचा जाता और मार्केटिंग के लिए उपयोग नहीं होता।"),
        ("आम्ही स्थान विकत नाही.", "स्थान विकले जात नाही आणि मार्केटिंगसाठी वापरले जात नाही."),
        ("અમે સ્થાન વેચતા નથી.", "સ્થાન વેચાતું નથી અને માર્કેટિંગ માટે વપરાતું નથી."),
    ]
    a, b = reps[i - 1]
    return old.replace(a, b)


def strengthen_cam(old: str, i: int) -> str:
    if i == 0:
        return (
            "CivicRadar uses the camera only to capture hazard evidence for your report. "
            "Photos appear on the community map. EXIF location is stripped on-device. "
            "Photos are not sold or used for marketing. Avoid faces and documents."
        )
    inserts = [
        (
            "चेहरे और दस्तावेज़ न लें।",
            "फ़ोटो नहीं बेची जातीं और मार्केटिंग के लिए उपयोग नहीं होतीं। चेहरे और दस्तावेज़ न लें।",
        ),
        (
            "चेहरे आणि कागदपत्रे टाळा.",
            "फोटो विकले जात नाहीत आणि मार्केटिंगसाठी वापरले जात नाहीत. चेहरे आणि कागदपत्रे टाळा.",
        ),
        (
            "ચહેરા અને દસ્તાવેજો ટાળો.",
            "ફોટો વેચાતા નથી અને માર્કેટિંગ માટે વપરાતા નથી. ચહેરા અને દસ્તાવેજો ટાળો.",
        ),
    ]
    a, b = inserts[i - 1]
    return old.replace(a, b)
