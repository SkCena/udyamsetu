// UdyamSetu Site — mobile/desktop views + REA structure checks (node).
// Run: node site/views.test.js
// These are STATIC checks (HTML/CSS text) — they prove the desktop rules,
// Home/Quick actions, FTU, language-first prompt, APK markers and GitHub
// links exist and that the mobile base CSS is untouched. They are NOT a
// browser render test: a real visual check needs a browser at 360px and
// at 1280px (see SPEC.md "Web views" + docs/DEVICE-TEST-1.2-site.md).
'use strict';
const fs = require('fs');
const path = require('path');
const i18n = require('./i18n.js');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ': ' + extra : '')); }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const spec = fs.readFileSync(path.join(__dirname, '..', 'SPEC.md'), 'utf8');

// Split CSS into: base (before any @media) and the desktop block.
const desktopAt = css.indexOf('@media (min-width: 1024px)');
ok('desktop media query exists', desktopAt > 0);
const baseCss = desktopAt > 0 ? css.slice(0, desktopAt) : css;
const desktopCss = desktopAt > 0 ? css.slice(desktopAt) : '';

// --- 1. Mobile base untouched ---
ok('mobile base: .tab is a horizontal flex item (flex 1 1 20%)',
  /\.tab\s*\{[^}]*flex:\s*1 1 20%/.test(baseCss));
ok('mobile base: tabs stay a horizontal row (no column direction on .tabs outside desktop)',
  !/\.tabs\s*\{[^}]*flex-direction:\s*column/.test(baseCss));
ok('mobile base: main is full-width padded (no desktop max-width)',
  !/max-width:\s*1180px/.test(baseCss));
ok('mobile base: no sidebar grid outside desktop',
  !/grid-template-columns:\s*240px/.test(baseCss));
ok('mobile base: 640px centering still present',
  /@media \(min-width: 640px\)/.test(css));

// --- 2. Desktop view rules (only inside the 1024px block) ---
ok('desktop: shell is a grid with a 240px sidebar column',
  /\.shell\s*\{[^}]*grid-template-columns:\s*240px minmax\(0, 1fr\)/.test(desktopCss));
ok('desktop: tabs become a vertical sidebar (flex-direction column)',
  /\.tabs\s*\{[^}]*flex-direction:\s*column/.test(desktopCss));
ok('desktop: content is wider (max-width 1180px)',
  /max-width:\s*1180px/.test(desktopCss));
ok('desktop: quick buttons use 4 columns',
  /\.quick-grid\s*\{[^}]*repeat\(4, 1fr\)/.test(desktopCss));
ok('desktop: invoice list uses 2 columns',
  /\.invoice-list\s*\{[^}]*grid-template-columns:\s*1fr 1fr/.test(desktopCss));
ok('desktop: line editor uses 5 columns',
  /\.line-grid\s*\{[^}]*grid-template-columns:\s*2fr 1fr 1fr 1fr 1fr/.test(desktopCss));
ok('desktop: language prompt is wider (5-col lang grid)',
  /\.lang-grid\s*\{[^}]*repeat\(5, 1fr\)/.test(desktopCss));
ok('desktop: forms use 2 columns',
  /#tab-setup form[^}]*grid-template-columns:\s*1fr 1fr/.test(desktopCss));

// --- 3. Home view: Quick actions + stats + FTU + first-bill guide ---
ok('home section exists and is the default visible view',
  /<section id="tab-home" class="view">/.test(html));
ok('setup section is hidden by default (home is default)',
  /<section id="tab-setup" class="view" hidden>/.test(html));
ok('home has 4 quick buttons (bill, udhaar, stock, payment)',
  (html.match(/class="quick-btn"/g) || []).length === 4);
ok('quick buttons point at billing/party/stock tabs',
  /data-goto="billing"/.test(html) && /data-goto="party"/.test(html) && /data-goto="stock"/.test(html));
ok('home has 3 stat boxes (sales, udhaar, low stock)',
  /id="homeStatSales"/.test(html) && /id="homeStatUdhaar"/.test(html) && /id="homeStatLowStock"/.test(html));
ok('FTU form exists (shop type, GST, what you sell)',
  /id="ftuForm"/.test(html) && /id="ftuShopType"/.test(html) && /id="ftuGst"/.test(html) && /id="ftuSell"/.test(html));
ok('first-bill guide card exists (3 steps)',
  /id="firstBillGuide"/.test(html) && /data-i18n="guideStep1"/.test(html)
  && /data-i18n="guideStep2"/.test(html) && /data-i18n="guideStep3"/.test(html));
ok('about section exists', /<section id="tab-about" class="view" hidden>/.test(html));
ok('app.js showTab knows home + about',
  /'home', 'setup', 'billing', 'list', 'detail', 'party', 'stock', 'gst', 'payroll', 'reports', 'about'/.test(appJs));
ok('app.js renders home stats on home tab', /if \(name === 'home'\) renderHome\(\);/.test(appJs));

// --- 4. Language-first prompt ---
ok('language prompt overlay exists', /id="langPrompt"/.test(html));
ok('language prompt has a language button grid + continue button',
  /id="langPromptBtns"/.test(html) && /id="langContinueBtn"/.test(html));
ok('i18n exposes hasChosenLang + markLangChosen',
  typeof i18n.hasChosenLang === 'function' && typeof i18n.markLangChosen === 'function');
ok('app.js shows the prompt only until a language is chosen',
  /showLangPromptIfNeeded/.test(appJs) && /hasChosenLang\(\)/.test(appJs));

// --- 5. APK-needed markers + APK download link ---
ok('APK card exists with 3 browser-impossible features',
  /Barcode scan/.test(html) && /Home widget/.test(html) && /Background sync/.test(html));
ok('each APK feature carries an "APK needed" badge (3 badges)',
  (html.match(/data-i18n="apkBadge"/g) || []).length === 3);
ok('APK download link points at GitHub Releases (no fake direct .apk URL)',
  /href="https:\/\/github\.com\/SkCena\/udyamsetu\/releases"/.test(html)
  && !/\.apk"/.test(html));
ok('APK download link appears in home card + about + footer',
  (html.match(/github\.com\/SkCena\/udyamsetu\/releases/g) || []).length >= 3);

// --- 6. GitHub link everywhere ---
const ghLinks = (html.match(/href="https:\/\/github\.com\/SkCena\/udyamsetu"/g) || []).length;
ok('GitHub repo link appears in header + home + about + footer (>= 4)', ghLinks >= 4, 'found ' + ghLinks);
ok('GitHub link is the public SkCena/udyamsetu repo',
  /github\.com\/SkCena\/udyamsetu/.test(html));

// --- 7. New visible keys exist in all 10 languages (i18n.test.js also checks this) ---
const visibleKeys = new Set();
for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) visibleKeys.add(m[1]);
for (const m of html.matchAll(/data-i18n-ph="([^"]+)"/g)) visibleKeys.add(m[1]);
for (const lang of i18n.SUPPORTED_LANGS) {
  const missing = [...visibleKeys].filter((k) => i18n.STRINGS[lang.code][k] === undefined);
  eq('visible keys complete in ' + lang.code, missing, []);
}
ok('new home/ftu/guide keys exist in English + Hindi',
  ['tabHome', 'tabAbout', 'quickBill', 'ftuTitle', 'guideStep1', 'langPromptTitle', 'apkBadge', 'aboutTitle']
    .every((k) => i18n.STRINGS.en[k] && i18n.STRINGS.hi[k]));

// --- 7b. Live-site fix: GST core lives inside site/ (Pages serves only site/) ---
const coreGst = fs.readFileSync(path.join(__dirname, '..', 'core', 'gst.js'), 'utf8');
const siteGst = fs.readFileSync(path.join(__dirname, 'gst-core.js'), 'utf8');
eq('site/gst-core.js is byte-identical to core/gst.js', siteGst, coreGst);
ok('index.html loads gst-core.js from inside site/ (no ../core path)',
  /<script src="gst-core\.js" defer><\/script>/.test(html) && !/\.\.\/core\/gst\.js/.test(html));
const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
ok('service worker caches ./gst-core.js (no ../core path)',
  /'\.\/gst-core\.js'/.test(swJs) && !/\.\.\/core\/gst\.js/.test(swJs));

// --- 7c. Dark / Light theme ---
ok('theme toggle button exists in the header',
  /id="themeToggle"/.test(html) && /class="theme-toggle"/.test(html));
ok('head script sets data-theme before paint (saved choice, else phone setting)',
  /localStorage\.getItem\('udyamsetu\.theme'\)/.test(html)
  && /prefers-color-scheme: dark/.test(html)
  && /setAttribute\('data-theme'/.test(html));
ok('CSS defines a dark theme (html[data-theme="dark"]) with dark bg + card',
  /html\[data-theme="dark"\]\s*\{[^}]*--bg:\s*#0b1220/.test(css)
  && /html\[data-theme="dark"\]\s*\{[^}]*--card:\s*#1e293b/.test(css));
ok('app.js wires the theme toggle and saves the choice',
  /THEME_KEY = 'udyamsetu\.theme'/.test(appJs)
  && /themeToggle/.test(appJs)
  && /function setTheme/.test(appJs)
  && /localStorage\.setItem\(THEME_KEY/.test(appJs));
ok('theme toggle shows moon in light mode and sun in dark mode (CSS)',
  /\.theme-toggle \.icon-sun \{ display: none; \}/.test(css)
  && /html\[data-theme="dark"\] \.theme-toggle \.icon-sun \{ display: block; \}/.test(css));
ok('print output is forced light even in dark mode',
  /@media print \{[\s\S]*html\[data-theme="dark"\] \{ --bg: #fff/.test(css));

// --- 8. SPEC documents the views ---
ok('SPEC has a Web views section', /## Web views/.test(spec));
ok('SPEC Web views covers mobile + desktop + acceptance', /Mobile view/.test(spec) && /Desktop view/.test(spec) && /Acceptance/.test(spec));
ok('SPEC says the repo is public at SkCena/udyamsetu',
  /repo is\s+public at `https:\/\/github\.com\/SkCena\/udyamsetu`/.test(spec));

console.log(`views tests: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFAILURES:\n' + failures.join('\n'));
  process.exit(1);
}
