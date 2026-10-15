"""Language detection + a small gazetteer (spec §12).

Without an LLM we cannot translate arbitrary sentences, but the gazetteer
maps the domain vocabulary (regions, parameters, common verbs) from major
Indian languages into English tokens, which is enough for the rule-based
NL→SQL engine. When an LLM provider is configured, full translation goes
through it instead.
"""
from __future__ import annotations

# ordered longest-first at build time so multi-word phrases match first
GAZETTEER: dict[str, str] = {
    # Hindi
    "बंगाल की खाड़ी": "bay of bengal",
    "अरब सागर": "arabian sea",
    "हिंद महासागर": "indian ocean",
    "भूमध्य रेखा के पास": "near the equator",
    "भूमध्य रेखा": "equator",
    "लवणता": "salinity",
    "खारापन": "salinity",
    "तापमान": "temperature",
    "गहराई": "depth",
    "औसत": "average",
    "कितने": "how many",
    "फ्लोट": "floats",
    "निकटतम": "nearest",
    "सबसे नज़दीक": "nearest",
    "मार्च": "march",
    # Tamil
    "வங்காள விரிகுடா": "bay of bengal",
    "அரபிக்கடல்": "arabian sea",
    "இந்தியப் பெருங்கடல்": "indian ocean",
    "உப்புத்தன்மை": "salinity",
    "வெப்பநிலை": "temperature",
    "சராசரி": "average",
    "எத்தனை": "how many",
    "மிதவைகள்": "floats",
    "மிதவை": "float",
    "ஆழம்": "depth",
    # Bengali
    "বঙ্গোপসাগর": "bay of bengal",
    "আরব সাগর": "arabian sea",
    "লবণাক্ততা": "salinity",
    "তাপমাত্রা": "temperature",
    "গড়": "average",
    # Telugu
    "బంగాళాఖాతం": "bay of bengal",
    "అరేబియా సముద్రం": "arabian sea",
    "లవణీయత": "salinity",
    "ఉష్ణోగ్రత": "temperature",
    # --- Fisheries vocabulary ---
    # Hindi
    "मछली पकड़ने का क्षेत्र": "fishing zone",
    "मछली": "fish",
    "मछुआरे": "fishermen",
    "टूना": "tuna",
    "सार्डिन": "sardine",
    "बांगड़ा": "mackerel",
    "क्लोरोफिल": "chlorophyll",
    "इस सप्ताह": "this week",
    "इस महीने": "this month",
    "गर्म": "warm",
    "कोच्चि": "kochi",
    "चेन्नई": "chennai",
    "मुंबई": "mumbai",
    "विशाखापत्तनम": "visakhapatnam",
    # Tamil
    "மீன்பிடி மண்டலம்": "fishing zone",
    "மீன்பிடி": "fishing",
    "மீன்": "fish",
    "சூரை": "tuna",
    "மத்தி": "sardine",
    "அயிலை": "mackerel",
    "வஞ்சிரம்": "seer fish",
    "இந்த வாரம்": "this week",
    "சென்னை": "chennai",
    "தூத்துக்குடி": "tuticorin",
    # Bengali
    "মাছ ধরার অঞ্চল": "fishing zone",
    "মাছ ধরা": "fishing",
    "মাছ": "fish",
    "ইলিশ": "hilsa",
    "এই সপ্তাহে": "this week",
    # Telugu
    "చేపలు పట్టే ప్రాంతం": "fishing zone",
    "చేపలు": "fish",
    "చేప": "fish",
    "విశాఖపట్నం": "visakhapatnam",
    "ఈ వారం": "this week",
    # Malayalam (Kerala coast)
    "മീൻപിടിത്ത മേഖല": "fishing zone",
    "മീൻ": "fish",
    "മത്തി": "sardine",
    "ചൂര": "tuna",
    "അയല": "mackerel",
    "കൊച്ചി": "kochi",
    "ഈ ആഴ്ച": "this week",
    "ചൂട്": "warm",
}

_ORDERED = sorted(GAZETTEER.items(), key=lambda kv: -len(kv[0]))


def detect_language(text: str) -> str:
    try:
        from langdetect import detect

        return detect(text)
    except Exception:
        return "en"


def apply_gazetteer(text: str) -> str:
    for src, dst in _ORDERED:
        if src in text:
            text = text.replace(src, f" {dst} ")
    return text


def translate_to_english(text: str, lang: str) -> str:
    """Best-effort translation. LLM if available, else gazetteer substitution."""
    if lang.startswith("en"):
        return text
    # Map native place names to their canonical English first, so they survive
    # regardless of how the model translates the rest of the sentence.
    pre = apply_gazetteer(text)
    try:
        from app.llm import chat, reasoning_extra

        out = chat(
            "You translate ocean-data questions to English for a database search. "
            "Translate to natural English, and preserve EXACTLY: place names (seas, "
            "bays, regions like 'Bay of Bengal', 'Arabian Sea', 'equator'), all numbers, "
            "coordinates, dates, and units. Output only the translation.",
            pre,
            max_tokens=200,
            extra=reasoning_extra(),
        ).strip()
        return out or pre
    except Exception:
        return pre
