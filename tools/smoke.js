// Smoke: load all Site classic scripts in index.html order inside one vm
// context with a minimal DOM stub, then fire DOMContentLoaded.
// Catches load-time ReferenceErrors / wiring mistakes. Not a device test.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const base = require('path').join(__dirname, '..');

function makeEl() {
  const el = {
    value: '', textContent: '', innerHTML: '', hidden: false,
    classList: { toggle() {}, add() {}, remove() {} },
    style: {}, dataset: {},
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, remove() {}, click() {},
    setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [],
    querySelector: () => makeEl(),
  };
  return el;
}
const listeners = {};
const documentStub = {
  getElementById: () => makeEl(),
  querySelectorAll: () => [],
  querySelector: () => makeEl(),
  createElement: () => makeEl(),
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  documentElement: { lang: 'hi', getAttribute: () => 'light', setAttribute() {} },
  body: { setAttribute() {}, removeAttribute() {}, appendChild() {} },
};
const sandbox = {
  console, setTimeout, clearTimeout,
  window: null, document: documentStub,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: {},
  location: { href: '' },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: function () {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const files = [
  'site/gst-core.js', 'site/store.js', 'site/invoice.js', 'site/party.js',
  'site/inventory.js', 'site/gst-reports.js', 'site/einvoice.js',
  'site/payroll.js', 'site/reports.js', 'site/i18n.js', 'site/app.js', 'site/app12.js',
];
for (const f of files) {
  const code = fs.readFileSync(path.join(base, f), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
    console.log('loaded OK:', f);
  } catch (e) {
    console.log('LOAD FAIL:', f, e.message);
    process.exit(1);
  }
}
// Check the ui12 hook + globals exist.
console.log('ui12 hook:', typeof sandbox.window.UdyamSetu.ui12.onShow, typeof sandbox.window.UdyamSetu.ui12.onInvoiceSaved);
console.log('modules:', Object.keys(sandbox.window.UdyamSetu).join(','));
// Language LOCK: default English, switch to Hindi works via i18n module.
const i18n = sandbox.window.UdyamSetu.i18n;
console.log('i18n default lang:', i18n.getLang(), '| langs:', i18n.SUPPORTED_LANGS.length);
console.log('i18n t(hi, tabBilling):', i18n.t('tabBilling', 'hi'), '| t(bn):', i18n.t('tabBilling', 'bn'));
// Fire DOMContentLoaded handlers (async init inside).
(async () => {
  for (const fn of listeners.DOMContentLoaded || []) {
    try { await fn(); console.log('DOMContentLoaded handler OK'); }
    catch (e) { console.log('DOMContentLoaded FAIL:', e && e.stack || e); process.exit(1); }
  }
  // onShow each 1.2 tab (renders with stubbed DOM).
  for (const tab of ['party', 'stock', 'gst', 'payroll', 'reports']) {
    try { await sandbox.window.UdyamSetu.ui12.onShow(tab); console.log('onShow OK:', tab); }
    catch (e) { console.log('onShow FAIL:', tab, e && e.stack || e); process.exit(1); }
  }
  console.log('SMOKE PASS');
})();
