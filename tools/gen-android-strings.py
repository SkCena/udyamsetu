#!/usr/bin/env python3
"""Generate Android res/values*/strings.xml from site/i18n.js.

Single source of truth: site/i18n.js STRINGS (same keys + structure as the
Site, Language LOCK). Add a language by adding one dict there, then re-run
this script — no hand-editing of strings.xml.
Android resource names are snake_case versions of the JS keys.
Extra app-only keys (navigation, About, widget) live in APP_ONLY below;
non-English values fall back to English until translated.
Usage: python3 tools/gen-android-strings.py
"""
import json
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
SITE_I18N = ROOT / "site" / "i18n.js"
APP_RES = ROOT / "app" / "app" / "src" / "main" / "res"

LANG_DIR = {
    "en": "values", "hi": "values-hi", "bn": "values-bn", "te": "values-te",
    "mr": "values-mr", "ta": "values-ta", "gu": "values-gu",
    "pa": "values-pa", "or": "values-or", "ur": "values-ur",
}

APP_ONLY = {
    "appName": {"en": "UdyamSetu", "hi": "UdyamSetu"},
    "tabHome": {"en": "Home", "hi": "Home"},
    "tabBills": {"en": "Bills", "hi": "Bills"},
    "tabMore": {"en": "More", "hi": "More"},
    "tabAbout": {"en": "About", "hi": "About"},
    "githubTitle": {"en": "UdyamSetu on GitHub", "hi": "GitHub par UdyamSetu"},
    "githubNote": {
        "en": "Open source — the code is on GitHub.",
        "hi": "Open source hai — code GitHub par hai.",
    },
    "apkNeeded": {"en": "Needs the APK", "hi": "APK chahiye"},
    "apkNeededHint": {
        "en": "This needs the app — it cannot work in a browser.",
        "hi": "Ye sirf app me chalega — browser me nahi ho sakta.",
    },
    "quickBill": {"en": "New Bill", "hi": "Naya Bill"},
    "quickUdhaar": {"en": "Udhaar", "hi": "Udhaar"},
    "quickStock": {"en": "Stock", "hi": "Stock"},
    "quickPayment": {"en": "Payment", "hi": "Payment"},
    "ftuTitle": {"en": "3 quick questions", "hi": "3 chhote sawaal"},
    "firstBillGuide": {
        "en": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.",
        "hi": "Pehla bill: 1) Setup bharo  2) Party jodo  3) Item jodo aur save karo.",
    },
    "previewBeforeSave": {"en": "Preview before saving", "hi": "Save se pehle preview"},
    "widgetTitle": {"en": "New bill", "hi": "Naya bill"},
}


def camel_to_snake(name: str) -> str:
    s = re.sub(r"([A-Z])", r"_\1", name).lower()
    return s.lstrip("_")


def parse_strings(text: str) -> dict:
    """Parse the STRINGS object out of i18n.js (string values only)."""
    m = re.search(r"const STRINGS = (\{.*?\n\});", text, re.S)
    if not m:
        raise SystemExit("STRINGS block not found in site/i18n.js")
    body = m.group(1)
    langs = {}
    # Each language block:  en: { ... },  — values are '...' or "..." strings.
    for lm in re.finditer(r"(\w+): \{(.*?)\n  \},", body, re.S):
        lang, block = lm.group(1), lm.group(2)
        entries = {}
        for km in re.finditer(
            r"([A-Za-z0-9_]+):\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")",
            block,
        ):
            key = km.group(1)
            val = km.group(2) if km.group(2) is not None else km.group(3)
            entries[key] = val.replace("\\'", "'").replace('\\"', '"')
        langs[lang] = entries
    return langs


def android_value(value: str) -> str:
    # Android strings.xml: escape XML, escape ' and " for the aapt parser.
    return escape(value).replace("'", "\\'").replace('"', '\\"')


def main() -> None:
    text = SITE_I18N.read_text(encoding="utf-8")
    langs = parse_strings(text)
    en_keys = sorted(langs["en"])
    print(f"site keys: en={len(langs['en'])} " +
          " ".join(f"{k}={len(v)}" for k, v in sorted(langs.items()) if k != "en"))
    for lang, dirname in LANG_DIR.items():
        out_dir = APP_RES / dirname
        out_dir.mkdir(parents=True, exist_ok=True)
        lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"]
        for key in en_keys:
            value = langs.get(lang, {}).get(key, langs["en"][key])
            lines.append(f'    <string name="{camel_to_snake(key)}">{android_value(value)}</string>')
        for key in sorted(APP_ONLY):
            if key in en_keys:
                continue  # site key already covers it — never duplicate a resource
            value = APP_ONLY[key].get(lang, APP_ONLY[key]["en"])
            lines.append(f'    <string name="{camel_to_snake(key)}">{android_value(value)}</string>')
        lines.append("</resources>")
        (out_dir / "strings.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"wrote {dirname}/strings.xml ({len(en_keys) + len(APP_ONLY)} strings)")
    print("done — re-run after any site/i18n.js change")


if __name__ == "__main__":
    main()
