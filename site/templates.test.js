// UdyamSetu Site — invoice templates + sharing tests.
// Run: node site/templates.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const inv = require('./invoice.js');
const i18n = require('./i18n.js');

let pass = 0;
let fail = 0;
const failures = [];
function eq(name, actual, expected) {
  if (actual === expected) pass++;
  else { fail++; failures.push(name + ': expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)); }
}

const profile = {
  name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC', phone: '9876543210',
  address: 'Main Road, Bhubaneswar', logoDataUrl: null, upiId: 'sharma@upi',
  invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
};
const draft = inv.createInvoiceDraft({
  profile, type: 'invoice', partyName: 'Ramesh Kumar', partyGstin: '', buyerState: '21',
  lines: [
    { name: 'Rice 5kg', hsn: '1006', qty: 2, unitPricePaise: 50000, discountPct: 0, taxRatePct: 5 },
    { name: 'Sugar 1kg', hsn: '1701', qty: 3, unitPricePaise: 4500, discountPct: 10, taxRatePct: 5 },
  ],
  date: new Date(2026, 10, 22),
});
const done = inv.finalizeInvoice(draft, profile, new Date(2026, 10, 22));
const invoice = done.invoice;
const labels = { kind: 'GST Bill', taxable: 'Taxable', roundOff: 'Round off', grandTotal: 'Grand Total', draft: 'DRAFT', against: 'Against: ' };
const totalStr = '₹1178.00'; // taxable 112150 + CGST 2804 + SGST 2804 = 117758, round-off +42
eq('sample total', require('../core/gst.js').formatINR(invoice.totals.roundedTotalPaise), totalStr);

// --- Templates: 4 looks, identical numbers ---
eq('template list', inv.INVOICE_TEMPLATES.join(','), 'classic,modern,minimal,thermal');
eq('isInvoiceTemplate classic', inv.isInvoiceTemplate('classic'), true);
eq('isInvoiceTemplate bogus', inv.isInvoiceTemplate('fancy'), false);
for (const tpl of inv.INVOICE_TEMPLATES) {
  const html = inv.invoiceTemplateHtml(invoice, profile, tpl, labels);
  eq(tpl + ' has tpl class', html.includes('tpl-' + tpl), true);
  eq(tpl + ' shows grand total', html.includes(totalStr), true);
  eq(tpl + ' shows taxable', html.includes(require('../core/gst.js').formatINR(invoice.totals.taxablePaise)), true);
  eq(tpl + ' shows CGST', html.includes(require('../core/gst.js').formatINR(invoice.totals.cgstPaise)), true);
  eq(tpl + ' shows both items', html.includes('Rice 5kg') && html.includes('Sugar 1kg'), true);
  eq(tpl + ' shows invoice number', html.includes('INV/2026-27/0001'), true);
}
eq('unknown template falls back to classic', inv.invoiceTemplateHtml(invoice, profile, 'nope', labels).includes('tpl-classic'), true);

// Inter-state invoice: IGST only, no CGST/SGST row.
const draft2 = inv.createInvoiceDraft({
  profile, type: 'invoice', partyName: 'Delhi Buyer', partyGstin: '', buyerState: '07',
  lines: [{ name: 'Rice 5kg', hsn: '1006', qty: 1, unitPricePaise: 50000, discountPct: 0, taxRatePct: 5 }],
  date: new Date(2026, 10, 22),
});
const inv2 = inv.finalizeInvoice(draft2, profile, new Date(2026, 10, 22)).invoice;
const html2 = inv.invoiceTemplateHtml(inv2, profile, 'modern', labels);
eq('inter-state shows IGST', html2.includes('IGST'), true);
eq('inter-state hides CGST', html2.includes('CGST'), false);

// --- Sharing: every channel from the same summary ---
const urls = inv.invoiceShareUrls(invoice, profile);
eq('whatsapp url', urls.whatsapp.startsWith('https://wa.me/?text='), true);
eq('whatsapp text has total', decodeURIComponent(urls.whatsapp).includes(totalStr), true);
eq('sms url', urls.sms.startsWith('sms:?body='), true);
eq('sms text has party', decodeURIComponent(urls.sms).includes('Ramesh Kumar'), true);
eq('email url', urls.email.startsWith('mailto:?subject='), true);
eq('email body has total', decodeURIComponent(urls.email).includes(totalStr), true);
eq('telegram url', urls.telegram.startsWith('https://t.me/share/url?'), true);
eq('telegram text has total', decodeURIComponent(urls.telegram).includes(totalStr), true);
eq('whatsappUrl matches share urls', inv.whatsappUrl(invoice, profile), urls.whatsapp);

// --- PNG image lines: same numbers, no HTML ---
const lines = inv.invoiceImageLines(invoice, profile);
const flat = lines.map((l) => l.text).join('\n');
eq('image lines have total', flat.includes(totalStr), true);
eq('image lines have party', flat.includes('Ramesh Kumar'), true);
eq('image lines have both items', flat.includes('Rice 5kg') && flat.includes('Sugar 1kg'), true);
eq('image lines have CGST', flat.includes('CGST:'), true);
eq('image lines no HTML tags', /<[a-z]+>/i.test(flat), false);

// --- i18n: template + share keys in every language ---
const tplKeys = ['tplTitle', 'tplClassic', 'tplModern', 'tplMinimal', 'tplThermal',
  'shareTitle', 'shareSms', 'shareEmail', 'shareTelegram', 'shareCopy', 'shareCopied',
  'sharePdf', 'shareImage', 'shareSheet'];
for (const lang of Object.keys(i18n.STRINGS)) {
  for (const k of tplKeys) {
    eq('key ' + k + ' in ' + lang, typeof i18n.STRINGS[lang][k] === 'string' && i18n.STRINGS[lang][k].length > 0, true);
  }
}
eq('hi share title translated', i18n.STRINGS.hi.shareTitle, 'Ye bill share karein');

// --- HTML + CSS wiring ---
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
eq('template picker in HTML', /id="tplSelect"/.test(html), true);
for (const tpl of inv.INVOICE_TEMPLATES) {
  eq('picker option ' + tpl, html.includes('value="' + tpl + '"'), true);
}
for (const id of ['smsShareBtn', 'emailShareBtn', 'tgShareBtn', 'copyShareBtn', 'pdfShareBtn', 'pngShareBtn', 'sheetShareBtn', 'sheetApkBadge']) {
  eq('share control ' + id, html.includes('id="' + id + '"'), true);
}
eq('share sheet badge uses apkBadge key', html.includes('data-i18n="apkBadge"'), true);
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
for (const tpl of inv.INVOICE_TEMPLATES) {
  if (tpl !== 'classic') eq('css for tpl-' + tpl, css.includes('.tpl-' + tpl), true);
}
eq('css has tpl picker', css.includes('.tpl-picker'), true);
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
eq('app.js uses invoiceTemplateHtml', appJs.includes('invoiceTemplateHtml'), true);
eq('app.js wires copy button', appJs.includes("$('copyShareBtn').addEventListener('click', copyShareText)"), true);
eq('app.js wires png button', appJs.includes("$('pngShareBtn').addEventListener('click', downloadInvoicePng)"), true);
eq('app.js wires template picker', appJs.includes("$('tplSelect').addEventListener('change'"), true);

console.log(`templates tests: ${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
