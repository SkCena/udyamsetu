// UdyamSetu Site logic tests (node). Run: node site/app.test.js
// Tests the pure layers only — site/store.js (with the in-memory adapter)
// and site/invoice.js. No DOM, no IndexedDB, no browser needed.
'use strict';
const fs = require('fs');
const path = require('path');
const gst = require('../core/gst.js');
const storeMod = require('./store.js');
const inv = require('./invoice.js');

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'core', 'gst-test-vectors.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

function eq(name, actual, expected) {
  const a = JSON.stringify(sortKeys(actual)), e = JSON.stringify(sortKeys(expected));
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}

function throws(name, fn) {
  try { fn(); fail++; failures.push(name + ': expected throw, got a value'); }
  catch (e) { pass++; }
}

function includes(name, arr, value) {
  if (arr.includes(value)) { pass++; }
  else { fail++; failures.push(name + ': expected ' + JSON.stringify(arr) + ' to include ' + JSON.stringify(value)); }
}

const byId = {};
for (const v of vectors.lineVectors) byId[v.id] = v;
function vecLines(ids) {
  return ids.map((l) => (typeof l === 'string' ? byId[l] : l))
    .map((x) => ({ name: 'item', hsn: '1001', qty: x.qty, unitPricePaise: x.unitPricePaise, discountPct: x.discountPct, taxRatePct: x.taxRatePct }));
}

function goodProfile(over) {
  return Object.assign({
    name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC', phone: '9876543210',
    address: 'Main Road, Bhubaneswar', logoDataUrl: null, upiId: 'sharma@upi',
    invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
  }, over || {});
}

async function main() {
  // --- rupeesToPaise: exact string parsing, never float rupees ---
  eq('paise 100', inv.rupeesToPaise('100'), 10000);
  eq('paise 19.99', inv.rupeesToPaise('19.99'), 1999);
  eq('paise 1,000.50', inv.rupeesToPaise('1,000.50'), 100050);
  eq('paise ₹250.5', inv.rupeesToPaise('₹250.5'), 25050);
  eq('paise 0.07', inv.rupeesToPaise('0.07'), 7);
  eq('paise number 12.34', inv.rupeesToPaise(12.34), 1234);
  throws('paise abc', () => inv.rupeesToPaise('abc'));
  throws('paise empty', () => inv.rupeesToPaise(''));
  throws('paise 3 decimals', () => inv.rupeesToPaise('10.999'));
  throws('paise negative', () => inv.rupeesToPaise('-5'));

  // --- states / intra vs inter ---
  eq('intra same state', inv.isIntraState('21', '21'), true);
  eq('inter diff state', inv.isIntraState('21', '27'), false);
  eq('stateName 21', inv.stateName('21'), 'Odisha');
  eq('stateName 27', inv.stateName('27'), 'Maharashtra');
  eq('STATES count', inv.STATES.length, 37);

  // --- totals match the shared vectors (same math as core) ---
  const i01 = vectors.invoiceVectors.find((v) => v.id === 'I01-two-lines-intra');
  eq('I01 totals', inv.buildTotals(vecLines(i01.lines), true), i01.expected);
  const i03 = vectors.invoiceVectors.find((v) => v.id === 'I03-inter-mix');
  eq('I03 totals', inv.buildTotals(vecLines(i03.lines), false), i03.expected);
  const i02 = vectors.invoiceVectors.find((v) => v.id === 'I02-single-roundoff-neg');
  eq('I02 totals', inv.buildTotals(vecLines(i02.lines), true), i02.expected);

  // --- profile validation ---
  eq('profile good', inv.validateProfile(goodProfile()), []);
  eq('profile gstin null ok', inv.validateProfile(goodProfile({ gstin: null })), []);
  includes('profile bad gstin', inv.validateProfile(goodProfile({ gstin: '27AAAPL1234C1ZF' })), 'gstin-invalid');
  includes('profile empty name', inv.validateProfile(goodProfile({ name: '  ' })), 'name-required');
  includes('profile lowercase prefix', inv.validateProfile(goodProfile({ invoicePrefix: 'inv' })), 'prefix-invalid');
  includes('profile nextSeq 0', inv.validateProfile(goodProfile({ nextSeq: 0 })), 'nextseq-invalid');
  includes('profile bad state', inv.validateProfile(goodProfile({ sellerState: '99' })), 'sellerstate-required');
  includes('profile bad phone', inv.validateProfile(goodProfile({ phone: '12345' })), 'phone-invalid');

  // --- line validation ---
  const goodLine = { name: 'Rice', hsn: '1001', qty: 2, unitPricePaise: 10000, discountPct: 0, taxRatePct: 18 };
  eq('line good', inv.validateLine(goodLine), []);
  includes('line bad hsn', inv.validateLine(Object.assign({}, goodLine, { hsn: '100' })), 'hsn-invalid');
  includes('line qty 0', inv.validateLine(Object.assign({}, goodLine, { qty: 0 })), 'qty-invalid');
  includes('line bad rate', inv.validateLine(Object.assign({}, goodLine, { taxRatePct: 25 })), 'rate-invalid');
  includes('line discount 101', inv.validateLine(Object.assign({}, goodLine, { discountPct: 101 })), 'discount-invalid');

  // --- draft validation ---
  const draftBase = {
    partyName: 'Ramesh', partyGstin: null, buyerState: '21',
    lines: [goodLine],
  };
  eq('draft good', inv.validateInvoiceDraft(draftBase), []);
  includes('draft no party', inv.validateInvoiceDraft(Object.assign({}, draftBase, { partyName: '' })), 'party-required');
  includes('draft bad party gstin', inv.validateInvoiceDraft(Object.assign({}, draftBase, { partyGstin: 'BAD' })), 'party-gstin-invalid');
  includes('draft no lines', inv.validateInvoiceDraft(Object.assign({}, draftBase, { lines: [] })), 'need-line');

  // --- draft creation: no number, intra flag, no seq consumed ---
  const profile = goodProfile();
  const draft = inv.createInvoiceDraft({
    profile, partyName: 'Ramesh', partyGstin: null, buyerState: '21',
    lines: vecLines(i01.lines), date: new Date(2026, 10, 22),
  });
  eq('draft number null', draft.number, null);
  eq('draft status', draft.status, 'draft');
  eq('draft intra', draft.intraState, true);
  eq('draft totals', draft.totals, i01.expected);
  eq('draft does not consume seq', profile.nextSeq, 1);
  const interDraft = inv.createInvoiceDraft({
    profile, partyName: 'Mumbai Buyer', partyGstin: null, buyerState: '27',
    lines: vecLines(i03.lines), date: new Date(2026, 10, 22),
  });
  eq('inter draft intra false', interDraft.intraState, false);
  eq('inter draft igst', interDraft.totals.igstPaise, 17600);
  eq('inter draft cgst 0', interDraft.totals.cgstPaise, 0);

  // --- finalizing: numbering + seq increments ONLY on save ---
  const f1 = inv.finalizeInvoice(draft, profile, new Date(2026, 10, 22));
  eq('first number', f1.invoice.number, 'INV/2026-27/0001');
  eq('first fy', f1.invoice.fy, '2026-27');
  eq('first status saved', f1.invoice.status, 'saved');
  eq('seq bumped to 2', f1.profile.nextSeq, 2);
  eq('draft untouched by finalize', draft.number, null);
  eq('input profile untouched', profile.nextSeq, 1);
  const draft2 = inv.createInvoiceDraft({
    profile: f1.profile, partyName: 'Sita', partyGstin: null, buyerState: '21',
    lines: [goodLine], date: new Date(2026, 10, 22),
  });
  const f2 = inv.finalizeInvoice(draft2, f1.profile, new Date(2026, 10, 22));
  eq('second number', f2.invoice.number, 'INV/2026-27/0002');
  eq('seq bumped to 3', f2.profile.nextSeq, 3);
  // FY boundary: 31 Mar 2026 -> 2025-26
  const fyDraft = inv.createInvoiceDraft({
    profile: f2.profile, partyName: 'X', partyGstin: null, buyerState: '21',
    lines: [goodLine], date: new Date(2026, 2, 31),
  });
  eq('FY Mar 31', inv.finalizeInvoice(fyDraft, f2.profile, new Date(2026, 2, 31)).invoice.fy, '2025-26');

  // --- credit / debit notes: linked, mirrored / same totals ---
  const saved = f1.invoice;
  const credit = inv.makeNoteDraft(saved, 'credit-note', f2.profile);
  eq('credit type', credit.type, 'credit-note');
  eq('credit linked', credit.linkedInvoiceNumber, 'INV/2026-27/0001');
  eq('credit totals negated', credit.totals, {
    taxablePaise: -i01.expected.taxablePaise,
    cgstPaise: -i01.expected.cgstPaise,
    sgstPaise: -i01.expected.sgstPaise,
    igstPaise: -i01.expected.igstPaise,
    totalPaise: -i01.expected.totalPaise,
    roundedTotalPaise: -i01.expected.roundedTotalPaise,
    roundOffPaise: -i01.expected.roundOffPaise,
  });
  const debit = inv.makeNoteDraft(saved, 'debit-note', f2.profile);
  eq('debit type', debit.type, 'debit-note');
  eq('debit totals same as original', debit.totals, i01.expected);
  eq('debit linked', debit.linkedInvoiceNumber, 'INV/2026-27/0001');
  throws('note bad type', () => inv.makeNoteDraft(saved, 'invoice', f2.profile));
  throws('note needs numbered invoice', () => inv.makeNoteDraft(draft, 'credit-note', f2.profile));
  // A finalized credit note also consumes the series, like an invoice.
  const fc = inv.finalizeInvoice(credit, f2.profile, new Date(2026, 10, 22));
  eq('credit note number', fc.invoice.number, 'INV/2026-27/0003');
  eq('credit note number consumes seq', fc.profile.nextSeq, 4);

  // --- WhatsApp text ---
  const text = inv.whatsappText(saved, goodProfile());
  includes('wa has number', [text.includes('INV/2026-27/0001')], true);
  includes('wa has total', [text.includes(gst.formatINR(saved.totals.roundedTotalPaise))], true);
  includes('wa has party', [text.includes('Ramesh')], true);
  includes('wa has upi', [text.includes('sharma@upi')], true);
  eq('wa url prefix', inv.whatsappUrl(saved, goodProfile()).startsWith('https://wa.me/?text='), true);

  // --- store round-trip with the in-memory adapter ---
  const adapter = new storeMod.MemoryAdapter();
  const s1 = new storeMod.Store(adapter);
  eq('default profile', await s1.getProfile(), storeMod.DEFAULT_PROFILE);
  await s1.saveProfile(goodProfile());
  eq('profile round-trip', await s1.getProfile(), goodProfile());
  eq('empty invoice list', await s1.listInvoices(), []);
  await s1.saveInvoice(saved);
  await s1.saveInvoice(f2.invoice);
  const listed = await s1.listInvoices();
  eq('list count', listed.length, 2);
  eq('list newest first', listed[0].number, 'INV/2026-27/0002');
  eq('getInvoice by id', (await s1.getInvoice(saved.id)).number, 'INV/2026-27/0001');
  eq('getInvoice missing', await s1.getInvoice('nope'), null);
  // A second Store over the same adapter sees the same data (survives "reload").
  const s2 = new storeMod.Store(adapter);
  eq('second store sees profile', await s2.getProfile(), goodProfile());
  eq('second store sees invoices', (await s2.listInvoices()).length, 2);
  // Updating a draft in place keeps one row, not a duplicate.
  const edited = Object.assign({}, saved, { partyName: 'Ramesh Kumar' });
  await s1.saveInvoice(edited);
  eq('upsert keeps count', (await s1.listInvoices()).length, 2);
  eq('upsert updates row', (await s1.getInvoice(saved.id)).partyName, 'Ramesh Kumar');

  console.log(`Site logic tests: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFAILURES:\n' + failures.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error('TEST CRASH: ' + (e && e.stack || e)); process.exit(1); });
