// UdyamSetu GST reports + e-invoice/e-way bill tests. Run: node site/gst-einvoice.test.js
// Pure logic only — invoices built through site/invoice.js (real totals).
'use strict';

const invApi = require('./invoice.js');
const rep = require('./gst-reports.js');
const ei = require('./einvoice.js');

let pass = 0, fail = 0;
const failures = [];

function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}

function throws(name, fn) {
  try { fn(); fail++; failures.push(name + '\n  expected throw, got none'); }
  catch (e) { pass++; }
}

let profile = {
  name: 'Test Shop', gstin: '27AAAPL1234C1ZE', address: 'Shop 1, Bhubaneswar',
  phone: '9876543210', upiId: '', invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
};

function save(opts) {
  const draft = invApi.createInvoiceDraft(Object.assign({ profile, date: new Date(opts.date) }, opts));
  const done = invApi.finalizeInvoice(draft, profile, new Date(opts.date));
  profile = done.profile;
  return done.invoice;
}

const B2B_GSTIN = '27AAAPL1234C1ZE';
const line = (unitPricePaise, taxRatePct, qty) => ({
  name: 'Item', hsn: '1001', qty: qty || 1,
  unitPricePaise, discountPct: 0, taxRatePct,
});

// --- Fixtures (all Nov 2026, FY 2026-27) ---
const invA = save({ type: 'invoice', partyName: 'Ramesh Traders', partyGstin: B2B_GSTIN,
  buyerState: '27', date: '2026-11-10', lines: [line(1000000, 18)] }); // tax 1,000,000 / igst 180,000 / tot 1,180,000
const invB = save({ type: 'invoice', partyName: 'Ramesh Traders', partyGstin: B2B_GSTIN,
  buyerState: '27', date: '2026-11-12', lines: [line(500000, 12, 2)] }); // tax 1,000,000 / igst 120,000 / tot 1,120,000
const invC = save({ type: 'invoice', partyName: 'Walk-in', partyGstin: null,
  buyerState: '07', date: '2026-11-15', lines: [line(25000000, 0)] }); // rounded exactly 2,50,000 -> NOT b2cl
const invD = save({ type: 'invoice', partyName: 'Walk-in', partyGstin: null,
  buyerState: '07', date: '2026-11-16', lines: [line(25000100, 0)] }); // rounded 2,50,001 -> b2cl
const invE = save({ type: 'invoice', partyName: 'Walk-in', partyGstin: null,
  buyerState: '21', date: '2026-11-18',
  lines: [Object.assign(line(100000, 18), { name: 'Item18' }), Object.assign(line(200000, 5), { name: 'Item5' })] });
const invF = save({ type: 'invoice', partyName: 'Walk-in', partyGstin: null,
  buyerState: '21', date: '2026-11-20', lines: [line(50000, 18)] });
// Notes against invA (dates = today, Nov 2026).
const cnDraft = invApi.makeNoteDraft(invA, 'credit-note', profile);
const cnDone = invApi.finalizeInvoice(cnDraft, profile, new Date());
profile = cnDone.profile;
const creditNote = cnDone.invoice;
const dnDraft = invApi.makeNoteDraft(invA, 'debit-note', profile);
const dnDone = invApi.finalizeInvoice(dnDraft, profile, new Date());
profile = dnDone.profile;
const debitNote = dnDone.invoice;

const all = [invA, invB, invC, invD, invE, invF, creditNote, debitNote];

// --- GSTR-1 summary ---
const s1 = rep.gstr1Summary(all, {});
eq('gstr1 b2b groups', s1.b2b.length, 1);
eq('gstr1 b2b ctin', s1.b2b[0].ctin, B2B_GSTIN);
eq('gstr1 b2b invoices', s1.b2b[0].invoices.length, 2);
eq('gstr1 b2b invA taxable', s1.b2b[0].invoices[0].taxablePaise, 1000000);
eq('gstr1 b2b invA igst', s1.b2b[0].invoices[0].igstPaise, 180000);
eq('gstr1 b2cl groups', s1.b2cl.length, 1);
eq('gstr1 b2cl state', s1.b2cl[0].state, '07');
eq('gstr1 b2cl invoices', s1.b2cl[0].invoices.length, 1);
eq('gstr1 b2cl is invD', s1.b2cl[0].invoices[0].number, invD.number);
const b2cs07 = s1.b2cs.find((b) => b.state === '07' && b.ratePct === 0);
eq('gstr1 b2cs boundary stays b2cs', !!b2cs07, true);
eq('gstr1 b2cs boundary taxable', b2cs07.taxablePaise, 25000000);
const b2cs18 = s1.b2cs.find((b) => b.state === '21' && b.ratePct === 18);
const b2cs5 = s1.b2cs.find((b) => b.state === '21' && b.ratePct === 5);
eq('gstr1 b2cs buckets', s1.b2cs.length, 3);
eq('gstr1 b2cs 21/18 taxable (line-wise)', b2cs18.taxablePaise, 150000);
eq('gstr1 b2cs 21/18 cgst', b2cs18.cgstPaise, 13500);
eq('gstr1 b2cs 21/18 sgst', b2cs18.sgstPaise, 13500);
eq('gstr1 b2cs 21/5 taxable', b2cs5.taxablePaise, 200000);
eq('gstr1 b2cs 21/5 cgst', b2cs5.cgstPaise, 5000);
eq('gstr1 cdnr count', s1.cdnr.length, 2);
const cnRow = s1.cdnr.find((n) => n.noteType === 'C');
const dnRow = s1.cdnr.find((n) => n.noteType === 'D');
eq('gstr1 cdnr credit negative taxable', cnRow.taxablePaise, -1000000);
eq('gstr1 cdnr credit negative tax', cnRow.taxPaise, -180000);
eq('gstr1 cdnr debit positive', dnRow.taxablePaise, 1000000);
eq('gstr1 totals taxable', s1.totals.taxablePaise, 52350100);
eq('gstr1 totals igst', s1.totals.igstPaise, 300000);
eq('gstr1 totals cgst', s1.totals.cgstPaise, 18500);
eq('gstr1 totals sgst', s1.totals.sgstPaise, 18500);
eq('gstr1 invoiceCount', s1.invoiceCount, 6);
// Filters: draft excluded, month/fy filter.
const draft = invApi.createInvoiceDraft({
  profile, type: 'invoice', partyName: 'Draft Party', partyGstin: B2B_GSTIN,
  buyerState: '27', date: new Date('2026-11-21'), lines: [line(100000, 18)],
});
eq('gstr1 draft excluded', rep.gstr1Summary(all.concat([draft]), {}).invoiceCount, 6);
eq('gstr1 month filter empty', rep.gstr1Summary(all, { month: '2026-10' }).invoiceCount, 0);
eq('gstr1 month filter all', rep.gstr1Summary(all, { month: '2026-11' }).invoiceCount, 6);
eq('gstr1 fy filter empty', rep.gstr1Summary(all, { fy: '2025-26' }).invoiceCount, 0);

// --- GSTR-3B summary ---
const s3 = rep.gstr3bSummary(all, { igstPaise: 100000, cgstPaise: 10000, sgstPaise: 10000 }, {});
eq('gstr3b outward taxable', s3.outward.taxablePaise, 52350100);
eq('gstr3b outward igst', s3.outward.igstPaise, 300000);
eq('gstr3b net igst', s3.netPayable.igstPaise, 200000);
eq('gstr3b net cgst', s3.netPayable.cgstPaise, 8500);
eq('gstr3b net sgst', s3.netPayable.sgstPaise, 8500);
eq('gstr3b note', s3.note, 'ITC user-entered hai');
const s3zero = rep.gstr3bSummary(all, null, {});
eq('gstr3b ITC 0 default igst', s3zero.itc.igstPaise, 0);
eq('gstr3b ITC 0 net = outward', s3zero.netPayable.igstPaise, 300000);
const s3over = rep.gstr3bSummary(all, { igstPaise: 99999999, cgstPaise: 0, sgstPaise: 0 }, {});
eq('gstr3b net never negative', s3over.netPayable.igstPaise, 0);

// --- Sales + purchase registers ---
const reg = rep.salesRegister(all, { from: '2026-11-11', to: '2026-11-18' });
eq('sales register rows', reg.rows.length, 4);
eq('sales register first date', reg.rows[0].date, '2026-11-12');
eq('sales register totals taxable', reg.totals.taxablePaise, 51300100);
eq('sales register totals igst', reg.totals.igstPaise, 120000);
eq('sales register totals cgst', reg.totals.cgstPaise, 14000);
eq('sales register totals totalPaise', reg.totals.totalPaise, 51448100);
const purch = rep.purchaseRegister([
  { date: '2026-11-05', kind: 'purchase', amountPaise: 500000, partyId: 'P1', note: 'stock' },
  { date: '2026-11-09', kind: 'purchase', amountPaise: -50000, partyId: 'P1', note: 'return' },
  { date: '2026-11-09', kind: 'sale', amountPaise: 99999, partyId: 'P1', note: 'not a purchase' },
  { date: '2026-12-01', kind: 'purchase', amountPaise: 100000, partyId: 'P1', note: 'dec' },
], { from: '2026-11-01', to: '2026-11-30' });
eq('purchase register rows', purch.rows.length, 2);
eq('purchase register signed total', purch.totals.amountPaise, 450000);

// --- 2A/2B reconcile ---
function portalRow(inv, over) {
  return Object.assign({
    gstin: inv.partyGstin, invoiceNumber: inv.number, date: inv.date,
    taxablePaise: inv.totals.taxablePaise, igstPaise: inv.totals.igstPaise,
    cgstPaise: inv.totals.cgstPaise, sgstPaise: inv.totals.sgstPaise,
  }, over || {});
}
const rec = rep.reconcile2A2B([invA, invB, invC, draft], [
  portalRow(invA),
  portalRow(invB, { taxablePaise: 999000 }),
  portalRow(invA, { invoiceNumber: 'INV/2026-27/9999', taxablePaise: 500000 }),
]);
eq('2b matched', rec.matched.length, 1);
eq('2b mismatched', rec.mismatched.length, 1);
eq('2b mismatch diffPaise', rec.mismatched[0].diffPaise, 1000);
eq('2b extra', rec.extraInPortal.length, 1);
eq('2b missing none (B2C+draft excluded)', rec.missingInPortal.length, 0);
const rec2 = rep.reconcile2A2B([invA, invB], [portalRow(invA)]);
eq('2b missing', rec2.missingInPortal.length, 1);
eq('2b missing is invB', rec2.missingInPortal[0].number, invB.number);

// --- GSTR-1 JSON ---
const j1 = rep.gstr1Json(profile, s1, { fy: '2026-27', fp: '112026' });
eq('gstr1 json gstin', j1.gstin, profile.gstin);
eq('gstr1 json fp', j1.fp, '112026');
eq('gstr1 json b2b ctin', j1.b2b[0].ctin, B2B_GSTIN);
eq('gstr1 json b2b inv count', j1.b2b[0].inv.length, 2);
eq('gstr1 json b2b val = rounded total Rs', j1.b2b[0].inv[0].val, 11800);
eq('gstr1 json b2b itm txval', j1.b2b[0].inv[0].itms[0].itm_det.txval, 10000);
eq('gstr1 json b2b itm iamt', j1.b2b[0].inv[0].itms[0].itm_det.iamt, 1800);
eq('gstr1 json b2b itm rt', j1.b2b[0].inv[0].itms[0].itm_det.rt, 18);
eq('gstr1 json b2b idt format', j1.b2b[0].inv[0].idt, '10/11/2026');
eq('gstr1 json b2cl val', j1.b2cl[0].inv[0].val, 250001);
eq('gstr1 json b2cs rows', j1.b2cs.length, 3);
eq('gstr1 json cdnr groups', j1.cdnr.length, 1);
eq('gstr1 json cdnr notes', j1.cdnr[0].nt.length, 2);
eq('gstr1 json cdnr credit val negative', j1.cdnr[0].nt.find((n) => n.ntty === 'C').val, -11800);

// --- GSTR-3B JSON ---
const j3 = rep.gstr3bJson(profile, s3, { fp: '112026' });
eq('gstr3b json gstin', j3.gstin, profile.gstin);
eq('gstr3b json osup txval', j3.sup_details.osup_det.txval, 523501);
eq('gstr3b json osup iamt', j3.sup_details.osup_det.iamt, 3000);
eq('gstr3b json osup camt', j3.sup_details.osup_det.camt, 185);
eq('gstr3b json itc avl iamt', j3.itc_elg.itc_avl[0].iamt, 1000);
eq('gstr3b json itc net camt', j3.itc_elg.itc_net.camt, 100);

// --- e-invoice JSON ---
const ej = ei.einvoiceJson(invA, profile);
eq('einvoice version', ej.version, '1.03');
eq('einvoice doc no', ej.DocDtls.No, invA.number);
eq('einvoice doc date', ej.DocDtls.Dt, '10/11/2026');
eq('einvoice seller gstin', ej.SellerDtls.Gstin, profile.gstin);
eq('einvoice seller pin null (not in profile, no fake)', ej.SellerDtls.Pin, null);
eq('einvoice buyer gstin', ej.BuyerDtls.Gstin, B2B_GSTIN);
eq('einvoice buyer pos', ej.BuyerDtls.Pos, '27');
eq('einvoice item tot val', ej.ItemList[0].TotItemVal, 11800);
eq('einvoice ValDtls AssVal', ej.ValDtls.AssVal, 10000);
eq('einvoice ValDtls IgstVal', ej.ValDtls.IgstVal, 1800);
eq('einvoice ValDtls TotInvVal = rounded total', ej.ValDtls.TotInvVal, 11800);
eq('einvoice ValDtls RndOff', ej.ValDtls.RndOffAmt, 0);
const ejUrp = ei.einvoiceJson(invE, profile);
eq('einvoice URP buyer', ejUrp.BuyerDtls.Gstin, 'URP');
eq('einvoice SupTyp B2B (registered buyer)', ej.TranDtls.SupTyp, 'B2B');
eq('einvoice SupTyp B2C (URP buyer)', ejUrp.TranDtls.SupTyp, 'B2C');
eq('einvoice multi-line items', ejUrp.ItemList.length, 2);
throws('einvoice rejects draft', () => ei.einvoiceJson(draft, profile));
throws('einvoice rejects credit note', () => ei.einvoiceJson(creditNote, profile));

// --- e-way bill JSON ---
const ew = ei.ewaybillJson(invA, profile, { distanceKm: 120, vehicleNo: 'OD02AB1234' });
const bill = ew.billLists[0];
eq('eway docNo', bill.docNo, invA.number);
eq('eway docDate', bill.docDate, '10/11/2026');
eq('eway totalValue', bill.totalValue, 10000);
eq('eway totInvValue', bill.totInvValue, 11800);
eq('eway igstValue', bill.igstValue, 1800);
eq('eway distance', bill.transDistance, 120);
eq('eway vehicleNo', bill.vehicleNo, 'OD02AB1234');
eq('eway transporter null', bill.transporterId, null);
eq('eway item taxable', bill.itemList[0].taxableAmount, 10000);
const ew2 = ei.ewaybillJson(invA, profile, {});
eq('eway no-opts distance null', ew2.billLists[0].transDistance, null);
throws('eway rejects credit note', () => ei.ewaybillJson(creditNote, profile, {}));

console.log(`GST reports + e-invoice tests: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFAILURES:\n' + failures.join('\n'));
  process.exit(1);
}
