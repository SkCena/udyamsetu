// UdyamSetu Site — Tally Prime XML export (pure, no DOM, no I/O).
// Tally Prime ka native import format XML hai (Alt+O > Transactions) —
// CSV seedha import NAHI hota: use pehle .xlsx me save karke mapping
// template se import karna padta hai (Release 4.0+, Tally Help FAQ).
// Isliye ye XML variant hai: wahi invoices, wahi core totals, Tally ke
// ENVELOPE > TALLYMESSAGE > VOUCHER format me. BETA hai — "CA-ready"
// tabhi likhenge jab real CA test pass ho (docs/CA-PILOT.md).
'use strict';

function escXml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function rupees(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.round(paise));
  return sign + (abs / 100).toFixed(2);
}

function tallyDate(iso) {
  // '2026-11-22' -> '20261122'
  return String(iso || '').replace(/-/g, '').slice(0, 8);
}

function voucherType(inv) {
  if (inv.type === 'credit-note') return 'Credit Note';
  if (inv.type === 'debit-note') return 'Debit Note';
  return 'Sales';
}

function ledgerEntry(name, amountPaise, isDebit) {
  // Tally XML: debit = amount as-is + ISDEEMEDPOSITIVE Yes;
  // credit = negated amount + ISDEEMEDPOSITIVE No. A credit-note invoice
  // carries negated totals, so a "credit" leg becomes a positive amount
  // (a reversal) — plain negation keeps every voucher balanced.
  const amt = isDebit ? rupees(amountPaise) : rupees(-amountPaise);
  return '<ALLLEDGERENTRIES.LIST>' +
    '<LEDGERNAME>' + escXml(name) + '</LEDGERNAME>' +
    '<ISDEEMEDPOSITIVE>' + (isDebit ? 'Yes' : 'No') + '</ISDEEMEDPOSITIVE>' +
    '<AMOUNT>' + amt + '</AMOUNT>' +
    '</ALLLEDGERENTRIES.LIST>';
}

function ledgerMaster(name, parent, gstin) {
  return '<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="' + escXml(name) + '">' +
    '<NAME>' + escXml(name) + '</NAME>' +
    '<PARENT>' + escXml(parent) + '</PARENT>' +
    (gstin ? '<GSTIN>' + escXml(gstin) + '</GSTIN>' : '') +
    '</LEDGER></TALLYMESSAGE>';
}

function stockItemMaster(name) {
  return '<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM NAME="' + escXml(name) + '">' +
    '<NAME>' + escXml(name) + '</NAME>' +
    '<PARENT>Primary</PARENT>' +
    '<BASEUNITS>Nos</BASEUNITS>' +
    '</STOCKITEM></TALLYMESSAGE>';
}

function voucherXml(inv) {
  const t = inv.totals || {};
  const total = t.roundedTotalPaise !== undefined ? t.roundedTotalPaise : (t.totalPaise || 0);
  const taxable = t.taxablePaise || 0;
  const cgst = t.cgstPaise || 0;
  const sgst = t.sgstPaise || 0;
  const igst = t.igstPaise || 0;
  const roundOff = t.roundOffPaise || 0;
  const vtype = voucherType(inv);
  const vno = inv.number || inv.id || '';
  const party = inv.partyName || '';
  let entries = ledgerEntry(party, total, true);
  entries += ledgerEntry('Sales', taxable, false);
  if (cgst) entries += ledgerEntry('CGST Payable', cgst, false);
  if (sgst) entries += ledgerEntry('SGST Payable', sgst, false);
  if (igst) entries += ledgerEntry('IGST Payable', igst, false);
  if (roundOff) entries += ledgerEntry('Round Off', roundOff, false);
  const invEntries = (inv.lines || []).map((l) => {
    const lineTaxable = Math.round(l.qty * l.unitPricePaise * (100 - (l.discountPct || 0)) / 100);
    return '<INVENTORYENTRIES.LIST>' +
      '<STOCKITEMNAME>' + escXml(l.name) + '</STOCKITEMNAME>' +
      '<ACTUALQTY>' + l.qty + ' Nos</ACTUALQTY>' +
      '<BILLEDQTY>' + l.qty + ' Nos</BILLEDQTY>' +
      '<RATE>' + rupees(l.unitPricePaise) + '/Nos</RATE>' +
      '<AMOUNT>' + rupees(lineTaxable) + '</AMOUNT>' +
      '</INVENTORYENTRIES.LIST>';
  }).join('');
  return '<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="' + escXml(vtype) + '">' +
    '<DATE>' + tallyDate(inv.date) + '</DATE>' +
    '<VOUCHERTYPENAME>' + escXml(vtype) + '</VOUCHERTYPENAME>' +
    '<VOUCHERNUMBER>' + escXml(vno) + '</VOUCHERNUMBER>' +
    '<PARTYLEDGERNAME>' + escXml(party) + '</PARTYLEDGERNAME>' +
    '<NARRATION>' + escXml(vtype + ' ' + vno + ' — ' + party) + '</NARRATION>' +
    entries + invEntries +
    '</VOUCHER></TALLYMESSAGE>';
}

/**
 * Poora Tally XML: pehle masters (party + Sales + tax ledgers + stock
 * items), phir har invoice ka ek voucher. Masters pehle isliye, kyunki
 * Tally voucher tabhi import karta hai jab ledger/item pehle se ho.
 * Note: 'CGST Payable' / 'SGST Payable' / 'IGST Payable' / 'Round Off'
 * ledgers ko CA apne company ke GST ledgers se map kare — pilot doc
 * dekhein (docs/CA-PILOT.md). Pure function.
 */
function invoicesToTallyXml(invoices, profile, companyName) {
  const list = invoices || [];
  const parties = {};
  const items = {};
  for (const inv of list) {
    if (inv.partyName) parties[inv.partyName] = inv.partyGstin || '';
    for (const l of inv.lines || []) items[l.name] = true;
  }
  let masters = '';
  for (const name of Object.keys(parties)) {
    masters += ledgerMaster(name, 'Sundry Debtors', parties[name]);
  }
  masters += ledgerMaster('Sales', 'Sales Accounts', '');
  masters += ledgerMaster('CGST Payable', 'Duties & Taxes', '');
  masters += ledgerMaster('SGST Payable', 'Duties & Taxes', '');
  masters += ledgerMaster('IGST Payable', 'Duties & Taxes', '');
  masters += ledgerMaster('Round Off', 'Indirect Incomes', '');
  for (const name of Object.keys(items)) masters += stockItemMaster(name);
  const vouchers = list.map(voucherXml).join('');
  return '<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>' +
    '<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME>' +
    '<STATICVARIABLES><SVCURRENTCOMPANY>' + escXml(companyName || (profile && profile.name) || '') +
    '</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>' +
    masters + vouchers +
    '</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>';
}

const tallyXmlApi = { invoicesToTallyXml, voucherType, escXml, rupees, tallyDate };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = tallyXmlApi;
} else {
  // Browser: classic script — no global export needed yet; the fixture
  // generator and tests run in node.
  var tallyXmlApiGlobal = tallyXmlApi; // eslint-disable-line no-unused-vars
}
