// UdyamSetu i18n tests (node). Run: node site/i18n.test.js
// Language LOCK: English default; Hindi + 8 more Indian languages via tab.
// Every visible (data-i18n) key must exist in every language; English is
// the fallback for any missing key; unknown language falls back to English.
'use strict';
const fs = require('fs');
const path = require('path');
const i18n = require('./i18n.js');

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ': ' + extra : '')); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const visibleKeys = new Set();
for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) visibleKeys.add(m[1]);
for (const m of html.matchAll(/data-i18n-ph="([^"]+)"/g)) visibleKeys.add(m[1]);

// --- structure ---
eq('supported langs count', i18n.SUPPORTED_LANGS.length, 10);
eq('supported lang codes', i18n.SUPPORTED_LANGS.map((l) => l.code),
  ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'pa', 'or', 'ur']);
eq('default lang', i18n.DEFAULT_LANG, 'en');
ok('urdu is rtl', i18n.dir('ur') === 'rtl');
ok('english is ltr', i18n.dir('en') === 'ltr');
ok('every lang has a native name', i18n.SUPPORTED_LANGS.every((l) => l.native && l.native.length > 0));

// --- completeness: en vs hi must match exactly ---
const enKeys = Object.keys(i18n.STRINGS.en).sort();
const hiKeys = Object.keys(i18n.STRINGS.hi).sort();
eq('hi has every en key', hiKeys, enKeys);

// --- every visible key exists in every language ---
for (const lang of i18n.SUPPORTED_LANGS) {
  const missing = [...visibleKeys].filter((k) => i18n.STRINGS[lang.code][k] === undefined);
  eq('visible keys complete in ' + lang.code, missing, []);
}

// --- fallback behaviour ---
eq('t() hindi tab', i18n.t('tabBilling', 'hi'), 'Naya Bill');
eq('t() english default', i18n.t('tabBilling', 'en'), 'New Bill');
eq('t() bengali tab', i18n.t('tabBilling', 'bn'), 'নতুন বিল');
eq('t() telugu tab', i18n.t('tabBilling', 'te'), 'కొత్త బిల్లు');
eq('t() tamil tab', i18n.t('tabBilling', 'ta'), 'புதிய பில்');
eq('t() odia tab', i18n.t('tabBilling', 'or'), 'ନୂଆ ବିଲ୍');
eq('t() urdu tab', i18n.t('tabBilling', 'ur'), 'نیا بل');
eq('t() hint translated in bn (no fallback needed)',
  i18n.t('hintParty', 'bn'), i18n.STRINGS.bn.hintParty);
eq('t() message key in bn falls back to english (messages are en+hi only)',
  i18n.t('setupSaved', 'bn'), i18n.STRINGS.en.setupSaved);
eq('t() unknown language falls back to english', i18n.t('tabBilling', 'xx'), 'New Bill');
eq('t() unknown key returns the key', i18n.t('noSuchKey', 'hi'), 'noSuchKey');
eq('t() message key falls back to english in tamil',
  i18n.t('setupSaved', 'ta'), i18n.STRINGS.en.setupSaved);

// --- getLang / setLang (Node has no localStorage -> default) ---
eq('getLang default is en (no storage in node)', i18n.getLang(), 'en');
eq('setLang unknown returns en', i18n.setLang('xx'), 'en');
eq('setLang hindi returns hi', i18n.setLang('hi'), 'hi');
ok('isSupported rejects xx', !i18n.isSupported('xx'));

console.log(`i18n tests: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFAILURES:\n' + failures.join('\n'));
  process.exit(1);
}
