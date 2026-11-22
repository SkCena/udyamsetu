// UdyamSetu Site — CA pilot tests: Tally XML + GSTR JSON fixtures.
// Run: node site/ca-pilot.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const gen = require('../tools/gen-ca-pilot-fixtures.js');
const tallyXml = require('./tally-xml.js');
const gstRep = require('./gst-reports.js');

let pass = 0;
let fail = 0;
const failures = [];
function eq(name, actual, expected) {
  if (actual === expected) pass++;
  else { fail++; failures.push(name + ': expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)); }
}

const f = gen.buildFixtures();
const invoices = f.invoices;

// --- Fixture invoices: the sample set the CA will test ---
eq('4 sample invoices', invoices.length, 4);
eq('invoice numbers sequential', invoices.map((i) => i.number).join(','), 'INV/2026-27/0001,INV/2026-27/0002,INV/2026-27/0003,INV/2026-27/0004');
eq('intra-state total', invoices[0].totals.roundedTotalPaise, 117800);
eq('inter-state total', invoices[1].totals.roundedTotalPaise, 210000);
eq('b2cs total', invoices[2].totals.roundedTotalPaise, 50400);
eq('credit note total negative', invoices[3].totals.roundedTotalPaise, -52500);
eq('credit note links to invoice 1', invoices[3].linkedInvoiceNumber, 'INV/2026-27/0001');

// --- Tally XML: shape ---
const xml = f.tallyXml;
eq('xml has envelope', xml.startsWith('<ENVELOPE>'), true);
eq('xml import request', xml.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>'), true);
eq('xml company name', xml.includes('Sharma Kirana Store'), true);
eq('xml 4 vouchers', (xml.match(/<VOUCHER /g) || []).length, 4);
eq('xml sales vouchers', (xml.match(/VCHTYPE="Sales"/g) || []).length, 3);
eq('xml credit note voucher', xml.includes('VCHTYPE="Credit Note"'), true);
eq('xml party masters', xml.includes('<LEDGER NAME="Ramesh Kumar">') && xml.includes('<LEDGER NAME="Delhi Traders">'), true);
eq('xml tax ledgers', xml.includes('CGST Payable') && xml.includes('SGST Payable') && xml.includes('IGST Payable'), true);
eq('xml stock items', xml.includes('<STOCKITEM NAME="Rice 5kg">') && xml.includes('<STOCKITEM NAME="Atta 10kg">'), true);
eq('xml no raw ampersand', /&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), false);
// Tag balance: every opened tag (except self-contained) is closed.
for (const tag of ['ENVELOPE', 'HEADER', 'BODY', 'IMPORTDATA', 'REQUESTDESC', 'REQUESTDATA', 'TALLYMESSAGE', 'VOUCHER', 'LEDGER', 'STOCKITEM']) {
  const open = (xml.match(new RegExp('<' + tag + '(\\s|>)', 'g')) || []).length;
  const close = (xml.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  eq('xml tag balanced ' + tag, open, close);
}

// --- Tally XML: every voucher balances (Dr total == Cr total) ---
// Only ledger entries count — inventory AMOUNTs are the same sale again
// (stock detail), not separate postings.
const voucherBlocks = xml.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/g) || [];
eq('voucher blocks parsed', voucherBlocks.length, 4);
voucherBlocks.forEach((block, i) => {
  const ledgerBlocks = block.match(/<ALLLEDGERENTRIES\.LIST>[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/g) || [];
  const amounts = ledgerBlocks.map((b) => Number(b.match(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/)[1]));
  const sum = amounts.reduce((a, b) => a + b, 0);
  eq('voucher ' + (i + 1) + ' balances', Math.abs(sum) < 0.005, true);
  const party = block.match(/<PARTYLEDGERNAME>([^<]*)<\/PARTYLEDGERNAME>/)[1];
  eq('voucher ' + (i + 1) + ' party', party, invoices[i].partyName);
});
// The credit-note voucher reverses the sale: party amount negative.
const cnBlock = voucherBlocks[3];
const cnPartyAmt = Number(cnBlock.match(/<LEDGERNAME>Ramesh Kumar<\/LEDGERNAME>[\s\S]*?<AMOUNT>(-?[\d.]+)<\/AMOUNT>/)[1]);
eq('credit note party amount negative', cnPartyAmt < 0, true);
// XML escaping: a party name with & must not break the file.
const escXmlOut = tallyXml.invoicesToTallyXml(
  [Object.assign({}, invoices[0], { partyName: 'A & B Traders' })], f.profile, 'Test Co');
eq('xml escapes ampersand', escXmlOut.includes('A &amp; B Traders'), true);
eq('xml no raw & in escaped file', /&(?!amp;|lt;|gt;|quot;|apos;)/.test(escXmlOut), false);

// --- GSTR-1 JSON: tax split per item (the bug this pilot caught) ---
const g1 = JSON.parse(f.gstr1Json);
eq('gstr1 gstin', g1.gstin, '22AAAAA0000A1ZC');
eq('gstr1 fp', g1.fp, '112026');
const b2bItem1 = g1.b2b[0].inv[0].itms[0].itm_det;
eq('intra-state item: no IGST', b2bItem1.iamt, 0);
eq('intra-state item: CGST 25', b2bItem1.camt, 25);
eq('intra-state item: SGST 25', b2bItem1.samt, 25);
const b2bItem2 = g1.b2b[1].inv[0].itms[0].itm_det;
eq('inter-state item: IGST 100', b2bItem2.iamt, 100);
eq('inter-state item: no CGST', b2bItem2.camt, 0);
eq('b2cs intra-state CGST', g1.b2cs[0].camt, 12);
eq('b2cs intra-state no IGST', g1.b2cs[0].iamt, 0);
const cdnrItem = g1.cdnr[0].nt[0].itms[0].itm_det;
eq('cdnr val negative', g1.cdnr[0].nt[0].val, -525);
eq('cdnr item txval negative', cdnrItem.txval, -500);
eq('cdnr item rate kept', cdnrItem.rt, 5);
eq('cdnr item CGST negative', cdnrItem.camt, -12.5);

// --- GSTR-3B JSON: hand-checked totals ---
const g3 = JSON.parse(f.gstr3bJson);
eq('3b outward txval', g3.sup_details.osup_det.txval, 3101.5);
eq('3b outward igst', g3.sup_details.osup_det.iamt, 100);
eq('3b outward cgst', g3.sup_details.osup_det.camt, 27.54);
eq('3b outward sgst', g3.sup_details.osup_det.samt, 27.54);
eq('3b itc zero (user-entered, default 0)', g3.itc_elg.itc_net.camt, 0);

// --- Fixtures on disk match the generator (re-run to refresh) ---
const dir = path.join(__dirname, '..', 'docs', 'ca-pilot');
eq('csv fixture fresh', fs.readFileSync(path.join(dir, 'sample-tally.csv'), 'utf8'), f.tallyCsv);
eq('xml fixture fresh', fs.readFileSync(path.join(dir, 'sample-tally.xml'), 'utf8'), f.tallyXml);
eq('gstr1 fixture fresh', fs.readFileSync(path.join(dir, 'sample-gstr1.json'), 'utf8'), f.gstr1Json);
eq('gstr3b fixture fresh', fs.readFileSync(path.join(dir, 'sample-gstr3b.json'), 'utf8'), f.gstr3bJson);
eq('csv fixture still BETA-labelled', f.tallyCsv.includes('BETA'), true);
eq('xml fixture has no CA-ready claim', f.tallyXml.includes('CA-ready'), false);

// --- Reports note (site + pilot doc) ---
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
eq('reports tab has CA pilot card', indexHtml.includes('data-i18n="caPilotTitle"'), true);
eq('reports tab links the pilot doc', indexHtml.includes('docs/CA-PILOT.md'), true);
eq('pilot doc exists', fs.existsSync(path.join(__dirname, '..', 'docs', 'CA-PILOT.md')), true);
const pilotDoc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'CA-PILOT.md'), 'utf8');
eq('pilot doc states BETA until a CA test passes', pilotDoc.includes('BETA'), true);
// Every "CA-ready" in the doc must sit in a negated context (not / never /
// before) — the pilot must never claim the export is CA-ready today.
const readyHits = [...pilotDoc.matchAll(/CA-ready/g)].map((m) => pilotDoc.slice(Math.max(0, m.index - 45), m.index));
eq('pilot doc never claims CA-ready positively',
  readyHits.every((ctx) => /not|never|before|no/i.test(ctx)), true);
eq('pilot doc records the CSV-to-xlsx route', pilotDoc.includes('.xlsx'), true);
eq('pilot doc records XML as the native route', pilotDoc.includes('Alt+O'), true);

console.log(`ca-pilot tests: ${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
