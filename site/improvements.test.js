// UdyamSetu Site — improvement-round tests (node).
// Run: node site/improvements.test.js
// Covers: GST calculator math, bill doc types, DOC/JSON export, GST guide
// content, Drive config gating + encryption round-trip, navy/gold theme
// vars, new tabs, new i18n keys. Async because the crypto checks are async.
'use strict';
const fs = require('fs');
const path = require('path');
const inv = require('./invoice.js');
const calc = require('./calculator.js');
const guide = require('./guide.js');
const drive = require('./drive.js');
const i18n = require('./i18n.js');
const gst = require('../core/gst.js');

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
function throws(name, fn) {
  try { fn(); fail++; failures.push(name + ': expected throw, got a value'); }
  catch (e) { pass++; }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const driveCfgSrc = fs.readFileSync(path.join(__dirname, 'drive-config.js'), 'utf8');

function goodProfile(over) {
  return Object.assign({
    name: 'Sharma Kirana Store', gstin: null, phone: '9876543210', address: 'Main Road',
    upiId: 'sharma@upi', invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
  }, over || {});
}
function line(over) {
  return Object.assign({ name: 'Rice 1kg', hsn: '1006', qty: 2, unitPricePaise: 100000, discountPct: 0, taxRatePct: 18 }, over || {});
}
function draft(type) {
  return inv.createInvoiceDraft({
    profile: goodProfile(), type, partyName: 'Ramesh Kumar',
    partyGstin: null, buyerState: '21', lines: [line()], date: new Date('2026-11-10'),
  });
}

async function main() {
  // --- 1. Calculator math (integer paise, no float rupees) ---
  eq('calc exclusive 1000.00 @ 18%', calc.calcExclusive(100000, 18),
    { taxablePaise: 100000, gstPaise: 18000, totalPaise: 118000 });
  eq('calc exclusive 1000.00 @ 5%', calc.calcExclusive(100000, 5),
    { taxablePaise: 100000, gstPaise: 5000, totalPaise: 105000 });
  eq('calc exclusive 0% -> no GST', calc.calcExclusive(100000, 0),
    { taxablePaise: 100000, gstPaise: 0, totalPaise: 100000 });
  eq('calc exclusive 999.99 @ 28% rounds half-up', calc.calcExclusive(99999, 28),
    { taxablePaise: 99999, gstPaise: 28000, totalPaise: 127999 });
  eq('calc inclusive 1180.00 @ 18% reverses exactly', calc.calcInclusive(118000, 18),
    { taxablePaise: 100000, gstPaise: 18000, totalPaise: 118000 });
  eq('calc inclusive 105.00 @ 5%', calc.calcInclusive(10500, 5),
    { taxablePaise: 10000, gstPaise: 500, totalPaise: 10500 });
  eq('calc inclusive 0% -> all taxable', calc.calcInclusive(100000, 0),
    { taxablePaise: 100000, gstPaise: 0, totalPaise: 100000 });
  eq('calc exclusive + inclusive round-trip @ 12%', calc.calcInclusive(calc.calcExclusive(54321, 12).totalPaise, 12).taxablePaise, 54321);
  eq('calcGstAmount dispatches on mode', calc.calcGstAmount(100000, 18, 'inclusive'),
    { taxablePaise: 84746, gstPaise: 15254, totalPaise: 100000 });
  eq('calcParseRupees handles commas + rupee sign', calc.calcParseRupees('₹1,000.50'), 100050);
  eq('calcParseRupees 19.99 exact', calc.calcParseRupees('19.99'), 1999);
  throws('calc rejects a bad rate (7%)', () => calc.calcExclusive(100000, 7));
  throws('calc rejects a bad amount', () => calc.calcExclusive(-5, 18));
  throws('calc rejects non-numeric input', () => calc.calcParseRupees('abc'));
  ok('calc rates are the app slabs subset', calc.GST_CALC_RATES.every((r) => gst.GST_SLABS.includes(r)));
  ok('calc module exposes all four functions',
    typeof calc.calcExclusive === 'function' && typeof calc.calcInclusive === 'function'
    && typeof calc.calcGstAmount === 'function' && typeof calc.calcParseRupees === 'function');

  // --- 2. Bill doc types ---
  eq('doc types list', inv.DOC_TYPES, ['invoice', 'non-gst', 'estimate', 'receipt', 'credit-note', 'debit-note']);
  eq('docTypeLabel estimate', inv.docTypeLabel('estimate'), 'Estimate / Quotation');
  eq('docTypeLabel unknown falls back to GST Bill', inv.docTypeLabel('nope'), 'GST Bill');
  ok('non-gst + receipt are not taxable, the rest are',
    !inv.isTaxableDocType('non-gst') && !inv.isTaxableDocType('receipt')
    && inv.isTaxableDocType('invoice') && inv.isTaxableDocType('estimate'));
  const ng = draft('non-gst');
  eq('non-gst draft forces 0% lines', ng.lines.map((l) => l.taxRatePct), [0]);
  eq('non-gst totals have zero tax', [ng.totals.cgstPaise, ng.totals.sgstPaise, ng.totals.igstPaise], [0, 0, 0]);
  eq('non-gst grand total is just the taxable amount', ng.totals.roundedTotalPaise, 200000);
  const est = draft('estimate');
  eq('estimate keeps the 18% rate', est.lines[0].taxRatePct, 18);
  eq('estimate totals include GST', est.totals.roundedTotalPaise, 236000);
  const rct = draft('receipt');
  eq('receipt totals have zero tax', [rct.totals.cgstPaise, rct.totals.igstPaise], [0, 0]);
  const invDoc = draft('invoice');
  eq('GST bill totals unchanged (CGST+SGST intra-state)', invDoc.totals.roundedTotalPaise, 236000);
  const cn = draft('credit-note');
  ok('credit note still negates totals', cn.totals.roundedTotalPaise < 0 && cn.totals.roundedTotalPaise === -236000);
  const finEst = inv.finalizeInvoice(est, goodProfile(), new Date('2026-11-10'));
  ok('estimate gets an EST number', /^EST\/2026-27\/0001$/.test(finEst.invoice.number), finEst.invoice.number);
  const finRct = inv.finalizeInvoice(rct, goodProfile(), new Date('2026-11-10'));
  ok('receipt gets an RCT number', /^RCT\/2026-27\/0001$/.test(finRct.invoice.number), finRct.invoice.number);
  const finInv = inv.finalizeInvoice(invDoc, goodProfile(), new Date('2026-11-10'));
  ok('GST bill keeps the INV series', /^INV\/2026-27\/0001$/.test(finInv.invoice.number), finInv.invoice.number);
  ok('finalize still bumps the sequence by one', finInv.profile.nextSeq === 2);
  ok('whatsapp text uses the doc label', inv.whatsappText(finEst.invoice, goodProfile()).startsWith('Estimate / Quotation EST/2026-27/0001'));
  ok('whatsapp text for non-GST bill uses its label', inv.whatsappText(ng, goodProfile()).startsWith('Non-GST Bill'));

  // --- 3. DOC + JSON export ---
  const saved = finInv.invoice;
  const doc = inv.invoiceToDocHtml(saved, goodProfile());
  ok('doc export is Word HTML with the bill number + total', doc.includes('INV/2026-27/0001') && doc.includes('₹2360.00'));
  ok('doc export names the doc type', doc.includes('GST Bill'));
  ok('doc export lists the party + line', doc.includes('Ramesh Kumar') && doc.includes('Rice 1kg'));
  ok('doc export escapes HTML in names', inv.invoiceToDocHtml(Object.assign({}, saved, { partyName: '<b>x</b>' }), goodProfile()).includes('&lt;b&gt;x&lt;/b&gt;'));
  const docEst = inv.invoiceToDocHtml(finEst.invoice, goodProfile());
  ok('doc export for an estimate says Estimate', docEst.includes('Estimate / Quotation') && docEst.includes('EST/2026-27/0001'));
  const jsonText = inv.invoiceToExportJson(saved, goodProfile());
  const parsed = JSON.parse(jsonText);
  eq('json export carries the document + profile', [parsed.app, parsed.document.number, parsed.profile.name],
    ['UdyamSetu', 'INV/2026-27/0001', 'Sharma Kirana Store']);
  eq('doc file name for a saved bill', inv.docFileName(saved, 'doc'), 'INV-2026-27-0001.doc');
  ok('doc file name is safe (no slashes)', !/[/\\]/.test(inv.docFileName(saved, 'json')));

  // --- 4. GST guide content: verified facts only ---
  eq('guide has 6 sections', guide.GUIDE_SECTIONS.length, 6);
  eq('guide section ids', guide.GUIDE_SECTIONS.map((s) => s.id),
    ['what', 'slabs', 'gstr', 'einvoice', 'gstr9', 'mistakes']);
  for (const s of guide.GUIDE_SECTIONS) {
    ok('guide title key exists in English: ' + s.titleKey, !!i18n.STRINGS.en[s.titleKey]);
    ok('guide body key exists in English: ' + s.bodyKey, !!i18n.STRINGS.en[s.bodyKey]);
  }
  const bodies = guide.GUIDE_SECTIONS.map((s) => i18n.STRINGS.en[s.bodyKey]).join(' ');
  ok('guide mentions the 0/5/12/18/28 slabs', /0%, 5%, 12%, 18% and 28%/.test(bodies));
  ok('guide says GSTR-1 is sales and GSTR-3B is the summary', /GSTR-1 lists the sales/.test(bodies) && /GSTR-3B is the monthly summary/.test(bodies));
  ok('guide never states a due date — it says check the portal', /Due dates change — always check the GST portal/.test(bodies));
  ok('guide never states an e-invoice/e-way turnover limit as fact', !/turnover of Rs [0-9]/.test(bodies) && /check the GST portal for the current limits/.test(bodies));
  ok('guide flags draft reports as not filed', /filing happens only on the GST portal/i.test(bodies));

  // --- 5. Drive backup: config gating + encryption ---
  eq('empty client id -> setup missing', drive.driveConfigStatus({ clientId: '' }), 'missing');
  eq('missing config object -> setup missing', drive.driveConfigStatus(null), 'missing');
  eq('whitespace client id -> setup missing', drive.driveConfigStatus({ clientId: '   ' }), 'missing');
  eq('a client id -> ready', drive.driveConfigStatus({ clientId: 'x.apps.googleusercontent.com' }), 'ready');
  eq('backup file name', drive.driveBackupFileName(new Date('2026-11-22')), 'udyamsetu-backup-2026-11-22.json.enc');
  ok('drive-config.js placeholder has no real client id', /clientId:\s*''/.test(driveCfgSrc));
  const driveCfgCode = driveCfgSrc.split('\n').map((l) => l.split('//')[0]).join('\n');
  ok('drive-config.js has setup steps, no secret', /Google Cloud Console/.test(driveCfgSrc)
    && !/client_secret\s*[:=]/.test(driveCfgCode) && !/[A-Za-z0-9_-]{10,}\.apps\.googleusercontent\.com/.test(driveCfgCode));
  ok('no secret/key anywhere in site js', !/client_secret|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{10,}/i.test(
    ['calculator.js', 'guide.js', 'drive.js', 'drive-config.js', 'invoice.js', 'app.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n')));
  const sample = { profile: { name: 'Test' }, invoices: [{ number: 'INV/2026-27/0001' }] };
  const enc = await drive.encryptBackup(sample, 'my-secret-passphrase');
  ok('encrypted backup hides the plaintext', !JSON.stringify(enc).includes('INV/2026-27/0001') && !JSON.stringify(enc).includes('my-secret-passphrase'));
  eq('encrypted backup round-trips', await drive.decryptBackup(enc, 'my-secret-passphrase'), sample);
  let wrongPassThrew = false;
  try { await drive.decryptBackup(enc, 'wrong-passphrase'); } catch (e) { wrongPassThrew = true; }
  ok('wrong passphrase cannot decrypt', wrongPassThrew);
  let shortPassThrew = false;
  try { await drive.encryptBackup(sample, 'ab'); } catch (e) { shortPassThrew = true; }
  ok('short passphrase is refused', shortPassThrew);
  // collect/restore against a fake store (node, no IndexedDB)
  const fakeStore = {
    getProfile: async () => ({ name: 'Shop' }),
    listInvoices: async () => [{ id: 'i1', number: 'INV/1' }],
    listParties: async () => [], listLedger: async () => [], listItems: async () => [],
    listMovements: async () => [], listBatches: async () => [], listEmployees: async () => [],
    listAttendance: async () => [], listAdvances: async () => [], listExpenses: async () => [],
    saveProfile: async () => {}, saveInvoice: async () => {},
  };
  const collected = await drive.collectBackupData(fakeStore);
  eq('collectBackupData gathers profile + invoices', [collected.profile.name, collected.invoices.length], ['Shop', 1]);
  const restored = await drive.restoreBackupData(fakeStore, collected);
  eq('restoreBackupData counts what it upserted', restored.imported, { profile: 1, invoices: 1 });

  // --- 5b. Dead-button audit (device verdict) ---
  const appJsSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const app12Src = fs.readFileSync(path.join(__dirname, 'app12.js'), 'utf8');
  const guideSrc = fs.readFileSync(path.join(__dirname, 'guide.js'), 'utf8');
  ok('first-bill guide card is tappable (whole card navigates to billing)',
    /<div id="firstBillGuide" class="guide-card" data-goto="billing"/.test(html));
  ok('every [data-goto] element gets a click handler (cards included)',
    /querySelectorAll\('\[data-goto\]'\)/.test(appJsSrc));
  ok('stock item rows are buttons that select the item for movement/batch',
    /mSel\.value = it\.id/.test(app12Src) && /bSel\.value = it\.id/.test(app12Src));
  ok('due rows open the party but leave the WhatsApp link alone',
    /openParty/.test(app12Src) && /closest\('a'\)/.test(app12Src));
  ok('guide cards toggle collapsed on tap', /toggle\('collapsed'\)/.test(guideSrc));
  ok('stock rows are real <button> elements, not look-alike divs',
    /const b = document\.createElement\('button'\);\n      b\.type = 'button';\n      b\.className = 'inv-item';/.test(app12Src));
  ok('due rows are the only div.inv-item left and they carry a click handler',
    (app12Src.match(/document\.createElement\('div'\);\n      row\.className = 'inv-item'/g) || []).length === 1
    && /row\.addEventListener\('click', openParty\)/.test(app12Src));

  // --- 6. Navy/gold theme vars ---
  ok('light theme: navy primary + gold accent', /--navy:\s*#1B2A4A/.test(css) && /--gold:\s*#C9A227/.test(css));
  ok('dark theme: gold accent on navy bg', /--navy:\s*#D4AF37/.test(css) && /--bg:\s*#0b1220/.test(css));
  ok('no teal/green hex anywhere in styles.css',
    !/#0f766e|#0b5e57|#115e59|#2dd4bf|#5eead4|#134e4a|#99f6e4|#0f3d38|#0b2e2a|#128c4a|#22c55e|#e0f2f1/i.test(css));
  ok('print is still forced light', /@media print \{[\s\S]*html\[data-theme="dark"\] \{ --bg: #fff/.test(css));

  // --- 7. New tabs + new i18n keys in all 10 languages ---
  ok('calculator + guide tabs in HTML', /data-tab="calculator"/.test(html) && /data-tab="guide"/.test(html));
  ok('GIS script + drive-config script in HTML', /gsi\/client/.test(html) && /drive-config\.js/.test(html));
  const newKeys = ['tabCalculator', 'tabGuide', 'docTypeLabel', 'docInvoice', 'docNonGst', 'docEstimate',
    'docReceipt', 'calcTitle', 'calcHint', 'calcAmount', 'calcRate', 'calcMode', 'calcExclusive',
    'calcInclusive', 'calcTaxable', 'calcGst', 'calcTotal', 'guideTitle', 'guideHint',
    'guideS1Title', 'guideS2Title', 'guideS3Title', 'guideS4Title', 'guideS5Title', 'guideS6Title',
    'driveTitle', 'driveHint', 'driveSetupPending', 'driveSignIn', 'driveSignOut', 'driveBackupNow',
    'driveRestore', 'drivePassphrase', 'drivePassphraseHint', 'driveNoBackups', 'driveOffline',
    'exportDoc', 'exportJson', 'credit'];
  for (const lang of i18n.SUPPORTED_LANGS) {
    const missing = newKeys.filter((k) => i18n.STRINGS[lang.code][k] === undefined);
    eq('new keys complete in ' + lang.code, missing, []);
  }
  eq('credit is the same name in every language',
    i18n.SUPPORTED_LANGS.map((l) => i18n.STRINGS[l.code].credit),
    i18n.SUPPORTED_LANGS.map(() => 'Made by Sk Akram'));
  ok('technical words stay English (GST, Bill, Invoice, UPI, HSN)',
    i18n.STRINGS.hi.docInvoice.includes('GST') && i18n.STRINGS.ta.calcRate.includes('GST')
    && i18n.STRINGS.bn.driveHint.includes('Google Drive'));
  ok('no "AI" word in the new site strings', !Object.values(i18n.STRINGS).some((d) =>
    Object.values(d).some((v) => typeof v === 'string' && /\bAI\b/.test(v))));

  console.log(`improvements tests: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFAILURES:\n' + failures.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.log('improvements tests crashed:', e && e.stack || e); process.exit(1); });
