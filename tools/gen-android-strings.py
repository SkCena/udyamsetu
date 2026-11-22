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
    "apkNeeded": {"en": "Needs the APK", "hi": "APK chahiye", "bn": "Needs the APK", "te": "Needs the APK", "mr": "Needs the APK", "ta": "Needs the APK", "gu": "Needs the APK", "pa": "Needs the APK", "or": "Needs the APK", "ur": "Needs the APK"},
    "apkNeededHint": {"en": "This needs the app — it cannot work in a browser.", "hi": "Ye sirf app me chalega — browser me nahi ho sakta.", "bn": "This needs the app — it cannot work in a browser.", "te": "This needs the app — it cannot work in a browser.", "mr": "This needs the app — it cannot work in a browser.", "ta": "This needs the app — it cannot work in a browser.", "gu": "This needs the app — it cannot work in a browser.", "pa": "This needs the app — it cannot work in a browser.", "or": "This needs the app — it cannot work in a browser.", "ur": "This needs the app — it cannot work in a browser."},
    "appName": {"en": "UdyamSetu", "hi": "UdyamSetu", "bn": "UdyamSetu", "te": "UdyamSetu", "mr": "UdyamSetu", "ta": "UdyamSetu", "gu": "UdyamSetu", "pa": "UdyamSetu", "or": "UdyamSetu", "ur": "UdyamSetu"},
    "backupPassShort": {"en": "Passphrase must be at least 4 characters.", "hi": "Passphrase कम से कम 4 characters का हो।", "bn": "Passphrase কমপক্ষে 4 অক্ষরের হতে হবে।", "te": "Passphrase కనీసం 4 అక్షరాలు ఉండాలి.", "mr": "Passphrase किमान 4 अक्षरांची असावी.", "ta": "Passphrase குறைந்தது 4 எழுத்துகள் இருக்க வேண்டும்.", "gu": "Passphrase ઓછામાં ઓછો 4 અક્ષરનો હોવો જોઈએ.", "pa": "Passphrase ਘੱਟੋ-ਘੱਟ 4 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।", "or": "Passphrase ଅତି କମରେ 4 ଅକ୍ଷର ହେବା ଦରକାର।", "ur": "Passphrase کم از کم 4 حروف کا ہو۔"},
    "backupSetupNote": {"en": "Drive backup is not set up yet — the app works normally without it. The shop owner adds the Google sign-in setup, then this screen will work.", "hi": "Drive backup अभी set up नहीं है — app बिना इसके आराम से चलता है। दुकान के मालिक Google sign-in setup जोड़ेंगे, तब ये screen काम करेगी।", "bn": "Drive backup এখনো set up হয়নি — app এটা ছাড়াই ঠিকঠাক চলে। দোকানের মালিক Google sign-in setup যোগ করবেন, তারপর এই screen কাজ করবে।", "te": "Drive backup ఇంకా set up కాలేదు — app ఇది లేకుండా బాగానే నడుస్తుంది. దుకాణం యజమాని Google sign-in setup జోడిస్తారు, ఆ తర్వాత ఈ screen పనిచేస్తుంది.", "mr": "Drive backup अजून set up झालेले नाही — app त्याशिवाय व्यवस्थित चालते. दुकानाचे मालक Google sign-in setup जोडतील, मग ही screen काम करेल.", "ta": "Drive backup இன்னும் set up ஆகவில்லை — app இல்லாமலேயே நன்றாக வேலை செய்யும். கடை உரிமையாளர் Google sign-in setup-ஐ சேர்ப்பார், பிறகு இந்த திரை வேலை செய்யும்.", "gu": "Drive backup હજુ set up થયું નથી — app તેના વગર બરાબર ચાલે છે. દુકાનના માલિક Google sign-in setup ઉમેરશે, પછી આ screen કામ કરશે.", "pa": "Drive backup ਅਜੇ set up ਨਹੀਂ ਹੋਇਆ — app ਇਸ ਤੋਂ ਬਿਨਾਂ ਠੀਕ ਚੱਲਦਾ ਹੈ। ਦੁਕਾਨ ਦਾ ਮਾਲਕ Google sign-in setup ਜੋੜੇਗਾ, ਫਿਰ ਇਹ screen ਕੰਮ ਕਰੇਗੀ।", "or": "Drive backup ଏଯାଏଁ set up ହୋଇନାହିଁ — app ଏହା ବିନା ଠିକ୍ ଚାଲେ। ଦୋକାନ ମାଲିକ Google sign-in setup ଯୋଡିବେ, ତା'ପରେ ଏହି screen କାମ କରିବ।", "ur": "Drive backup ابھی set up نہیں ہے — app اس کے بغیر ٹھیک چلتی ہے۔ دکان کا مالک Google sign-in setup جوڑے گا، پھر یہ screen کام کرے گی۔"},
    "backupSetupPending": {"en": "Setup pending", "hi": "Setup pending है", "bn": "Setup pending", "te": "Setup pending", "mr": "Setup pending", "ta": "Setup pending", "gu": "Setup pending", "pa": "Setup pending", "or": "Setup pending", "ur": "Setup pending"},
    "backupSignedInAs": {"en": "Signed in as ", "hi": "Signed in as ", "bn": "Signed in as ", "te": "Signed in as ", "mr": "Signed in as ", "ta": "Signed in as ", "gu": "Signed in as ", "pa": "Signed in as ", "or": "Signed in as ", "ur": "Signed in as "},
    "backupWrongPass": {"en": "Wrong passphrase — backup could not be opened.", "hi": "गलत passphrase — backup खुल नहीं पाया।", "bn": "ভুল passphrase — backup খোলা যায়নি।", "te": "తప్పు passphrase — backup తెరవలేకపోయింది.", "mr": "चुकीची passphrase — backup उघडले नाही.", "ta": "தவறான passphrase — backup திறக்க முடியவில்லை.", "gu": "ખોટો passphrase — backup ખૂલ્યો નહીં.", "pa": "ਗਲਤ passphrase — backup ਖੁੱਲ੍ਹਿਆ ਨਹੀਂ।", "or": "ଭୁଲ୍ passphrase — backup ଖୋଲିଲା ନାହିଁ।", "ur": "غلط passphrase — backup کھل نہیں پایا۔"},
    "calcCalculate": {"en": "Calculate", "hi": "Calculate करें", "bn": "Calculate করুন", "te": "Calculate చేయండి", "mr": "Calculate करा", "ta": "Calculate செய்க", "gu": "Calculate કરો", "pa": "Calculate ਕਰੋ", "or": "Calculate କରନ୍ତୁ", "ur": "Calculate کریں"},
    "docEstimateNote": {"en": "Estimate only — no sale, no stock change, no GST filing.", "hi": "सिर्फ estimate है — ना बिक्री, ना stock change, ना GST filing।", "bn": "শুধু estimate — কোনো বিক্রি নয়, স্টক বদলাবে না, GST filing নয়।", "te": "కేవలం estimate — అమ్మకం కాదు, స్టాక్ మారదు, GST filing కాదు.", "mr": "फक्त estimate — विक्री नाही, स्टॉक बदल नाही, GST filing नाही.", "ta": "Estimate மட்டும் — விற்பனை இல்லை, ஸ்டாக் மாறாது, GST filing இல்லை.", "gu": "માત્ર estimate — વેચાણ નથી, સ્ટોક બદલાશે નહીં, GST filing નથી.", "pa": "ਸਿਰਫ estimate — ਨਾ ਵਿਕਰੀ, ਨਾ ਸਟਾਕ ਬਦਲਾਅ, ਨਾ GST filing।", "or": "କେବଳ estimate — ବିକ୍ରି ନୁହେଁ, ଷ୍ଟକ୍ ବଦଳିବ ନାହିଁ, GST filing ନୁହେଁ।", "ur": "صرف estimate — نہ فروخت، نہ اسٹاک تبدیلی، نہ GST filing۔"},
    "docNonGstNote": {"en": "No GST on this bill — tax is ₹0.", "hi": "इस bill पर GST नहीं है — tax ₹0 है।", "bn": "এই বিলে GST নেই — ট্যাক্স ₹0।", "te": "ఈ బిల్లుపై GST లేదు — పన్ను ₹0.", "mr": "या बिलावर GST नाही — कर ₹0 आहे.", "ta": "இந்த பில்லில் GST இல்லை — வரி ₹0.", "gu": "આ બિલ પર GST નથી — ટેક્સ ₹0 છે.", "pa": "ਇਸ ਬਿੱਲ ਤੇ GST ਨਹੀਂ ਹੈ — ਟੈਕਸ ₹0 ਹੈ।", "or": "ଏହି ବିଲ୍‌ରେ GST ନାହିଁ — ଟ୍ୟାକ୍ସ ₹0।", "ur": "اس بل پر GST نہیں ہے — ٹیکس ₹0 ہے۔"},
    "docReceiptNote": {"en": "Payment receipt — no GST on this document.", "hi": "Payment receipt है — इस document पर GST नहीं है।", "bn": "Payment receipt — এই কাগজে GST নেই।", "te": "Payment receipt — ఈ పత్రంపై GST లేదు.", "mr": "Payment receipt — या कागदावर GST नाही.", "ta": "Payment receipt — இந்த ஆவணத்தில் GST இல்லை.", "gu": "Payment receipt — આ દસ્તાવેજ પર GST નથી.", "pa": "Payment receipt — ਇਸ ਦਸਤਾਵੇਜ਼ ਤੇ GST ਨਹੀਂ ਹੈ।", "or": "Payment receipt — ଏହି କାଗଜରେ GST ନାହିଁ।", "ur": "Payment receipt — اس دستاویز پر GST نہیں ہے۔"},
    "docTypeCreditNote": {"en": "Credit Note", "hi": "Credit Note", "bn": "Credit Note", "te": "Credit Note", "mr": "Credit Note", "ta": "Credit Note", "gu": "Credit Note", "pa": "Credit Note", "or": "Credit Note", "ur": "Credit Note"},
    "docTypeDebitNote": {"en": "Debit Note", "hi": "Debit Note", "bn": "Debit Note", "te": "Debit Note", "mr": "Debit Note", "ta": "Debit Note", "gu": "Debit Note", "pa": "Debit Note", "or": "Debit Note", "ur": "Debit Note"},
    "firstBillGuide": {"en": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "hi": "Pehla bill: 1) Setup bharo  2) Party jodo  3) Item jodo aur save karo.", "bn": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "te": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "mr": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "ta": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "gu": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "pa": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "or": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save.", "ur": "Your first bill: 1) Fill Setup  2) Add a Party  3) Add items and save."},
    "firstBillStart": {"en": "Start first bill →", "hi": "पहला bill शुरू करें →", "bn": "প্রথম বিল শুরু করুন →", "te": "మొదటి బిల్ ప్రారంభించండి →", "mr": "पहिले bill सुरू करा →", "ta": "முதல் பில்லை தொடங்குக →", "gu": "પહેલું બિલ શરૂ કરો →", "pa": "ਪਹਿਲਾ ਬਿੱਲ ਸ਼ੁਰੂ ਕਰੋ →", "or": "ପ୍ରଥମ ବିଲ୍ ଆରମ୍ଭ କରନ୍ତୁ →", "ur": "پہلا بل شروع کریں →"},
    "githubNote": {"en": "Open source — the code is on GitHub.", "hi": "Open source hai — code GitHub par hai.", "bn": "Open source — the code is on GitHub.", "te": "Open source — the code is on GitHub.", "mr": "Open source — the code is on GitHub.", "ta": "Open source — the code is on GitHub.", "gu": "Open source — the code is on GitHub.", "pa": "Open source — the code is on GitHub.", "or": "Open source — the code is on GitHub.", "ur": "Open source — the code is on GitHub."},
    "githubTitle": {"en": "UdyamSetu on GitHub", "hi": "GitHub par UdyamSetu", "bn": "UdyamSetu on GitHub", "te": "UdyamSetu on GitHub", "mr": "UdyamSetu on GitHub", "ta": "UdyamSetu on GitHub", "gu": "UdyamSetu on GitHub", "pa": "UdyamSetu on GitHub", "or": "UdyamSetu on GitHub", "ur": "UdyamSetu on GitHub"},
    "previewBeforeSave": {"en": "Preview before saving", "hi": "Save se pehle preview", "bn": "Preview before saving", "te": "Preview before saving", "mr": "Preview before saving", "ta": "Preview before saving", "gu": "Preview before saving", "pa": "Preview before saving", "or": "Preview before saving", "ur": "Preview before saving"},
    "saveEstimate": {"en": "Save Estimate", "hi": "Estimate Save करें", "bn": "Estimate Save করুন", "te": "Estimate Save చేయండి", "mr": "Estimate Save करा", "ta": "Estimate Save செய்க", "gu": "Estimate Save કરો", "pa": "Estimate Save ਕਰੋ", "or": "Estimate Save କରନ୍ତୁ", "ur": "Estimate Save کریں"},
    "saveReceipt": {"en": "Save Receipt", "hi": "Receipt Save करें", "bn": "Receipt Save করুন", "te": "Receipt Save చేయండి", "mr": "Receipt Save करा", "ta": "Receipt Save செய்க", "gu": "Receipt Save કરો", "pa": "Receipt Save ਕਰੋ", "or": "Receipt Save କରନ୍ତୁ", "ur": "Receipt Save کریں"},
    "tabBackup": {"en": "Backup", "hi": "Backup", "bn": "Backup", "te": "Backup", "mr": "Backup", "ta": "Backup", "gu": "Backup", "pa": "Backup", "or": "Backup", "ur": "Backup"},
    "tabBills": {"en": "Bills", "hi": "Bills", "bn": "Bills", "te": "Bills", "mr": "Bills", "ta": "Bills", "gu": "Bills", "pa": "Bills", "or": "Bills", "ur": "Bills"},
    "tabMore": {"en": "More", "hi": "More", "bn": "More", "te": "More", "mr": "More", "ta": "More", "gu": "More", "pa": "More", "or": "More", "ur": "More"},
    "themeDark": {"en": "Dark", "hi": "गहरा", "bn": "গাঢ়", "te": "డార్క్", "mr": "गडद", "ta": "இருள்", "gu": "ઘેરી", "pa": "ਗੂੜ੍ਹਾ", "or": "ଗାଢ଼", "ur": "گہرا"},
    "themeLight": {"en": "Light", "hi": "हल्का", "bn": "হালকা", "te": "లైట్", "mr": "हलका", "ta": "ஒளி", "gu": "આછી", "pa": "ਹਲਕਾ", "or": "ହାଲୁକା", "ur": "ہلکا"},
    "themeSystem": {"en": "System", "hi": "सिस्टम", "bn": "সিস্টেম", "te": "సిస్టమ్", "mr": "सिस्टीम", "ta": "சிஸ்டம்", "gu": "સિસ્ટમ", "pa": "ਸਿਸਟਮ", "or": "ସିଷ୍ଟମ୍", "ur": "سسٹم"},
    "themeTitle": {"en": "Theme", "hi": "थीम", "bn": "থিম", "te": "థీమ్", "mr": "थीम", "ta": "தீம்", "gu": "થીમ", "pa": "ਥੀਮ", "or": "ଥିମ୍", "ur": "تھیم"},
    "widgetTitle": {"en": "New bill", "hi": "Naya bill", "bn": "New bill", "te": "New bill", "mr": "New bill", "ta": "New bill", "gu": "New bill", "pa": "New bill", "or": "New bill", "ur": "New bill"},
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
    # Bare '%' breaks aapt ("Multiple substitutions specified in non-positional
    # format") — escape it as '%%', but keep real format specifiers (%s, %d,
    # %1$s ...) untouched so formatted strings still work.
    value = re.sub(r"%(?![sdif]|\d+\$[sdif])", "%%", value)
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
