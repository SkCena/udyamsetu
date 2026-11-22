// UdyamSetu — CA pilot fixtures generator.
// Builds sample invoices with the Site's own logic (invoice.js, gst-reports.js,
// reports.js, tally-xml.js) and writes docs/ca-pilot/ fixtures a CA can import
// straight away. Dummy test data only — GSTINs 22AAAAA0000A1ZC / 27AAAPL1234C1ZE
// are the repo's standing test values, not real businesses.
// Run: node tools/gen-ca-pilot-fixtures.js
'use strict';
const fs = require('fs');
const path = require('path');

const inv = require('../site/invoice.js');
const gstRep = require('../site/gst-reports.js');
const reports = require('../site/reports.js');
const tallyXml = require('../site/tally-xml.js');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'ca-pilot');
const FP = '112026'; // November 2026

function sampleProfile() {
  return {
    name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC', phone: '9876543210',
    address: 'Main Road, Bhubaneswar', logoDataUrl: null, upiId: 'sharma@upi',
    invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
  };
}

function buildInvoices(profile) {
  const d = (day) => new Date(2026, 10, day);
  const out = [];
  let prof = profile;
  const save = (draft, day) => {
    const done = inv.finalizeInvoice(draft, prof, d(day));
    prof = done.profile;
    out.push(done.invoice);
    return done.invoice;
  };
  // 1. Intra-state B2B, registered buyer (Odisha -> Odisha, CGST+SGST).
  save(inv.createInvoiceDraft({
    profile: prof, type: 'invoice', partyName: 'Ramesh Kumar', partyGstin: '27AAAPL1234C1ZE', buyerState: '21',
    lines: [
      { name: 'Rice 5kg', hsn: '1006', qty: 2, unitPricePaise: 50000, discountPct: 0, taxRatePct: 5 },
      { name: 'Sugar 1kg', hsn: '1701', qty: 3, unitPricePaise: 4500, discountPct: 10, taxRatePct: 5 },
    ],
    date: d(5),
  }), 5);
  // 2. Inter-state B2B, registered buyer (Odisha -> Delhi, IGST).
  save(inv.createInvoiceDraft({
    profile: prof, type: 'invoice', partyName: 'Delhi Traders', partyGstin: '07AAAAA0000A1Z5', buyerState: '07',
    lines: [
      { name: 'Atta 10kg', hsn: '1101', qty: 5, unitPricePaise: 40000, discountPct: 0, taxRatePct: 5 },
    ],
    date: d(12),
  }), 12);
  // 3. Unregistered small buyer, intra-state (B2CS).
  save(inv.createInvoiceDraft({
    profile: prof, type: 'invoice', partyName: 'Walk-in Customer', partyGstin: '', buyerState: '21',
    lines: [
      { name: 'Tea 250g', hsn: '0902', qty: 4, unitPricePaise: 12000, discountPct: 0, taxRatePct: 5 },
    ],
    date: d(18),
  }), 18);
  // 4. Credit note against invoice 1 — 1 bag of rice returned (partial).
  // Built with createInvoiceDraft, not by editing a draft's lines after
  // the fact: totals are computed from the lines at draft time.
  save(inv.createInvoiceDraft({
    profile: prof, type: 'credit-note', linkedInvoiceNumber: out[0].number,
    partyName: 'Ramesh Kumar', partyGstin: '27AAAPL1234C1ZE', buyerState: '21',
    lines: [{ name: 'Rice 5kg', hsn: '1006', qty: 1, unitPricePaise: 50000, discountPct: 0, taxRatePct: 5 }],
    date: d(20),
  }), 20);
  return out;
}

function buildFixtures() {
  const profile = sampleProfile();
  const invoices = buildInvoices(profile);
  const gstr1 = gstRep.gstr1Summary(invoices, { from: '2026-11-01', to: '2026-11-30' });
  const gstr1Json = gstRep.gstr1Json(profile, gstr1, { fp: FP });
  const gstr3b = gstRep.gstr3bSummary(invoices, { igstPaise: 0, cgstPaise: 0, sgstPaise: 0 }, { from: '2026-11-01', to: '2026-11-30' });
  const gstr3bJson = gstRep.gstr3bJson(profile, gstr3b, { fp: FP });
  return {
    profile,
    invoices,
    tallyCsv: reports.tallyCsv(invoices),
    tallyXml: tallyXml.invoicesToTallyXml(invoices, profile, 'Sharma Kirana Store'),
    gstr1Json: JSON.stringify(gstr1Json, null, 2),
    gstr3bJson: JSON.stringify(gstr3bJson, null, 2),
    invoicesJson: JSON.stringify({ app: 'UdyamSetu', fixture: 'ca-pilot-sample', fp: FP, profile, invoices }, null, 2),
  };
}

function main() {
  const f = buildFixtures();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'sample-tally.csv'), f.tallyCsv);
  fs.writeFileSync(path.join(OUT_DIR, 'sample-tally.xml'), f.tallyXml);
  fs.writeFileSync(path.join(OUT_DIR, 'sample-gstr1.json'), f.gstr1Json);
  fs.writeFileSync(path.join(OUT_DIR, 'sample-gstr3b.json'), f.gstr3bJson);
  fs.writeFileSync(path.join(OUT_DIR, 'sample-invoices.json'), f.invoicesJson);
  console.log('CA pilot fixtures written to ' + OUT_DIR);
  for (const iv of f.invoices) {
    console.log('  ' + iv.number + ' ' + iv.type + ' ' + iv.partyName + ' total ' +
      require('../core/gst.js').formatINR(iv.totals.roundedTotalPaise));
  }
}

if (require.main === module) main();
module.exports = { buildFixtures, sampleProfile, FP };
