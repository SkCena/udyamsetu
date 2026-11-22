// UdyamSetu Site — Reports + Export pure logic (no DOM, no I/O).
// All money in integer paise. Pure functions only.
//
// SIGN CONVENTION (ledger, party.js jaisa — canonical):
//   Ledger entry amountPaise POSITIVE = party ka balance BADHA
//   (receivable badha: customer ko udhaar/sale; ya supplier ko dena GHATA
//   kyunki shop ne supplier ko payment diya).
//   Ledger entry amountPaise NEGATIVE = party ka balance GHATA
//   (customer ne payment diya — receivable ghata; ya supplier se credit
//   purchase — payable badha).
//   Isliye 'purchase' entries (supplier se udhaar khareed) NEGATIVE store
//   hoti hain; purchaseSummary/cashFlow usi hisaab se bante hain:
//   purchaseSummary totalPaise = -sum(purchase entries) = khareed ki
//   POSITIVE cost (P&L ke liye).
// cashFlow me sirf ASLI cash movement gini jati hai:
//   receipts = 'payment' entries jahan amountPaise NEGATIVE hai (customer
//     ne diya) unka absolute + cash invoices (sirf paymentMode 'cash').
//   payments = 'payment' entries jahan amountPaise POSITIVE hai (shop ne
//     supplier ko diya).
//   'sale' / 'purchase' entries cashFlow me NAHI aati — udhaar sale ya
//   udhaar purchase se cash nahi hilta. Credit sale invoices ko cashFlow
//   me dobara NAHI gina jata, warna double-count hota.
//
// DATE RANGE: {from, to} 'YYYY-MM-DD' strings, dono inclusive. from/to
// optional hain — na hon to saari entries gini jati hain.
//
// Tally CSV BETA hai — "CA-ready" NAHI hai. CA pilot pending.
'use strict';

let gstRpt;
if (typeof module !== 'undefined' && module.exports) {
  gstRpt = require('../core/gst.js');
} else {
  // Browser: core/gstRpt.js is loaded as a classic script before this file,
  // so its top-level declarations are visible as globals here.
  gstRpt = { calcLine: calcLine };
}

/** Round half-up for non-negative integers: round(n/d). */
function roundDivRpt(n, d) {
  if (n < 0) throw new Error('roundDivRpt: negative input');
  return Math.floor((n * 2 + d) / (2 * d));
}

/** Paise -> rupees 2dp string, e.g. 23600 -> "236.00", -500 -> "-5.00". */
function rupees2dpRpt(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}

/** 'YYYY-MM-DD' valid hai ya nahi. */
function isDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function inDateRange(date, range) {
  if (!range) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function toPaise(v, fallback) {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && Number.isInteger(v.totalPaise)) return v.totalPaise;
  return fallback === undefined ? 0 : fallback;
}

/**
 * NOTE on credit-note sign: invoice.js ALREADY negates a credit note's
 * stored totals (totals fields negative hain). Isliye totals ko yahan
 * dobara sign se multiply NAHI karte — warna double-negation ho jata.
 * Sirf byRate ke liye lines ko sign chahiye, kyunki stored LINES
 * positive rehti hain (sirf totals negate hote hain).
 */
function invoiceSign(inv) {
  return inv.type === 'credit-note' ? -1 : 1;
}

/**
 * Ek invoice line ka taxable + tax (discount-before-tax, core/gstRpt.js jaisa).
 * Credit note ke liye sign caller lagata hai.
 */
function lineTaxableTax(line) {
  const c = gstRpt.calcLine({
    qty: line.qty,
    unitPricePaise: line.unitPricePaise,
    discountPct: line.discountPct || 0,
    taxRatePct: line.taxRatePct,
    intraState: true, // split yahan matter nahi karta; sirf taxPaise chahiye
  });
  return { taxablePaise: c.taxablePaise, taxPaise: c.taxPaise };
}

/**
 * Sales summary. Credit notes totals ghata dete hain (net sales).
 * count = range me aane wale invoices (sab types). byRate line rates se,
 * rate ascending order me.
 */
function salesSummary(invoices, range) {
  const list = (invoices || []).filter((inv) => inDateRange(inv.date, range));
  let taxablePaise = 0, cgstPaise = 0, sgstPaise = 0, igstPaise = 0, totalPaise = 0;
  const byRateMap = {};
  for (const inv of list) {
    const s = invoiceSign(inv); // sirf byRate lines ke liye; totals pehle se signed hain
    const t = inv.totals || {};
    taxablePaise += (t.taxablePaise || 0);
    cgstPaise += (t.cgstPaise || 0);
    sgstPaise += (t.sgstPaise || 0);
    igstPaise += (t.igstPaise || 0);
    totalPaise += (t.roundedTotalPaise !== undefined ? t.roundedTotalPaise : (t.totalPaise || 0));
    for (const line of inv.lines || []) {
      const lt = lineTaxableTax(line);
      const rate = line.taxRatePct;
      if (!byRateMap[rate]) byRateMap[rate] = { ratePct: rate, taxablePaise: 0, taxPaise: 0 };
      byRateMap[rate].taxablePaise += s * lt.taxablePaise;
      byRateMap[rate].taxPaise += s * lt.taxPaise;
    }
  }
  const byRate = Object.keys(byRateMap).map(Number).sort((a, b) => a - b).map((r) => byRateMap[r]);
  return { count: list.length, taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise, byRate };
}

/**
 * Purchase summary: kind 'purchase' wali ledger entries (range me).
 * party.js convention se purchase entries NEGATIVE store hoti hain
 * (supplier se udhaar khareed = payable badha = balance ghata), isliye
 * totalPaise = -sum = khareed ki POSITIVE cost (P&L ke liye).
 */
function purchaseSummary(ledgerEntries, range) {
  const list = (ledgerEntries || []).filter((e) => e.kind === 'purchase' && inDateRange(e.date, range));
  let totalPaise = 0;
  for (const e of list) totalPaise -= e.amountPaise || 0;
  return { count: list.length, totalPaise };
}

/** Expense summary: total + category-wise (total desc, phir naam asc). */
function expenseSummary(expenses, range) {
  const list = (expenses || []).filter((e) => inDateRange(e.date, range));
  let totalPaise = 0;
  const byCat = {};
  for (const e of list) {
    totalPaise += e.amountPaise || 0;
    const cat = e.category || 'Other';
    byCat[cat] = (byCat[cat] || 0) + (e.amountPaise || 0);
  }
  const byCategory = Object.keys(byCat).sort((a, b) => (byCat[b] - byCat[a]) || (a < b ? -1 : 1))
    .map((c) => ({ category: c, totalPaise: byCat[c] }));
  return { totalPaise, byCategory };
}

/**
 * GST summary (saare diye gaye invoices; koi date range nahi).
 * Credit notes signed totals ghata dete hain. invoiceCount = type
 * 'invoice' wale; noteCount = credit-note + debit-note wale.
 */
function gstSummary(invoices) {
  const list = invoices || [];
  let taxablePaise = 0, cgstPaise = 0, sgstPaise = 0, igstPaise = 0, totalPaise = 0;
  let invoiceCount = 0, noteCount = 0;
  for (const inv of list) {
    const t = inv.totals || {}; // totals pehle se signed hain (credit note negative)
    taxablePaise += (t.taxablePaise || 0);
    cgstPaise += (t.cgstPaise || 0);
    sgstPaise += (t.sgstPaise || 0);
    igstPaise += (t.igstPaise || 0);
    totalPaise += (t.roundedTotalPaise !== undefined ? t.roundedTotalPaise : (t.totalPaise || 0));
    if (inv.type === 'credit-note' || inv.type === 'debit-note') noteCount++;
    else invoiceCount++;
  }
  return { taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise, invoiceCount, noteCount };
}

/**
 * Profit & Loss. Inputs paise numbers hain; sales/purchases/expenses
 * summary objects ({totalPaise}) bhi accept karte hain.
 * grossProfit = sales - purchases; netProfit = gross - expenses - payroll.
 */
function profitLoss(input) {
  const i = input || {};
  const salesPaise = toPaise(i.sales, 0);
  const purchasesPaise = toPaise(i.purchases, 0);
  const expensesPaise = toPaise(i.expenses, 0);
  const payrollPaise = toPaise(i.payrollNetPaise, 0);
  const grossProfitPaise = salesPaise - purchasesPaise;
  return {
    salesPaise, purchasesPaise, grossProfitPaise,
    expensesPaise, payrollPaise,
    netProfitPaise: grossProfitPaise - expensesPaise - payrollPaise,
  };
}

/**
 * Stock summary: har item ki qty = movements ke qtyDelta ka sum;
 * value = qty * purchasePricePaise. Items bina movement ke qty 0 ke
 * saath aate hain. lines itemId asc order me.
 */
function stockSummary(items, movements) {
  const qtyById = {};
  for (const m of movements || []) {
    qtyById[m.itemId] = (qtyById[m.itemId] || 0) + (m.qtyDelta || 0);
  }
  const lines = (items || []).map((item) => {
    const qty = qtyById[item.id] || 0;
    return { itemId: item.id, qty, valuePaise: qty * (item.purchasePricePaise || 0) };
  }).sort((a, b) => (a.itemId < b.itemId ? -1 : 1));
  // Movements jin ka item list me nahi hai — unhe bhi dikhao (price 0).
  for (const id of Object.keys(qtyById).sort()) {
    if (!lines.some((l) => l.itemId === id)) {
      lines.push({ itemId: id, qty: qtyById[id], valuePaise: 0 });
    }
  }
  let totalValuePaise = 0;
  for (const l of lines) totalValuePaise += l.valuePaise;
  return { lines, totalValuePaise };
}

/**
 * Cash flow — sign convention upar top comment me (ledger sign wala).
 * Sirf asli cash movement: negative 'payment' entries (customer ne diya)
 * receipts hain, positive 'payment' entries (supplier ko diya) payments
 * hain; 'sale'/'purchase' entries udhaar hoti hain, cash nahi — isliye
 * count NAHI hoti. Cash invoices (paymentMode 'cash') receipts me.
 * net = receipts - payments.
 */
function cashFlow(ledgerEntries, invoices, range) {
  let receiptsPaise = 0, paymentsPaise = 0;
  for (const e of ledgerEntries || []) {
    if (!inDateRange(e.date, range)) continue;
    const amt = e.amountPaise || 0;
    if (e.kind === 'payment' && amt < 0) receiptsPaise += -amt;
    else if (e.kind === 'payment' && amt > 0) paymentsPaise += amt;
    // 'sale' / 'purchase' / 'udhaar' / 'adjustment' = udhaar, cash nahi.
  }
  for (const inv of invoices || []) {
    if (inv.paymentMode !== 'cash') continue;
    if (!inDateRange(inv.date, range)) continue;
    const t = inv.totals || {};
    const total = t.roundedTotalPaise !== undefined ? t.roundedTotalPaise : (t.totalPaise || 0);
    receiptsPaise += total; // totals pehle se signed hain (credit note negative)
  }
  return { receiptsPaise, paymentsPaise, netPaise: receiptsPaise - paymentsPaise };
}

// ---- CSV export ----

/** Ek CSV field escape karo: comma/quote/newline ho to double-quote me. */
function csvField(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** rows = array of arrays -> CSV string (CRLF nahi, LF; akhri newline ke saath). */
function toCSV(rows) {
  return (rows || []).map((row) => row.map(csvField).join(',')).join('\n') + '\n';
}

function invoicesToCSV(invoices) {
  const rows = [['Date', 'Invoice No', 'Party', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']];
  for (const inv of invoices || []) {
    const t = inv.totals || {};
    rows.push([
      inv.date || '', inv.number || inv.id || '', inv.partyName || '', inv.partyGstin || '',
      rupees2dpRpt(t.taxablePaise || 0), rupees2dpRpt(t.cgstPaise || 0),
      rupees2dpRpt(t.sgstPaise || 0), rupees2dpRpt(t.igstPaise || 0),
      rupees2dpRpt(t.roundedTotalPaise !== undefined ? t.roundedTotalPaise : (t.totalPaise || 0)),
    ]);
  }
  return toCSV(rows);
}

/**
 * parties: [{id, name, gstin, phone}]; balances: {partyId: balancePaise}
 * map ya [{partyId, balancePaise}] array — dono chalte hain.
 * Balance sign: positive = party par shop ka paisa (receivable).
 */
function partiesToCSV(parties, balances) {
  const balMap = {};
  if (Array.isArray(balances)) {
    for (const b of balances) balMap[b.partyId] = b.balancePaise || 0;
  } else if (balances) {
    for (const k of Object.keys(balances)) balMap[k] = balances[k] || 0;
  }
  const rows = [['Party', 'GSTIN', 'Phone', 'Balance (Rs)']];
  for (const p of parties || []) {
    rows.push([p.name || '', p.gstin || '', p.phone || '', rupees2dpRpt(balMap[p.id] || 0)]);
  }
  return toCSV(rows);
}

function stockToCSV(items, movements) {
  const s = stockSummary(items, movements);
  const priceById = {};
  const nameById = {};
  for (const item of items || []) {
    priceById[item.id] = item.purchasePricePaise || 0;
    nameById[item.id] = item.name || item.id;
  }
  const rows = [['Item', 'Qty', 'Purchase Price (Rs)', 'Value (Rs)']];
  for (const l of s.lines) {
    rows.push([nameById[l.itemId] || l.itemId, l.qty, rupees2dpRpt(priceById[l.itemId] || 0), rupees2dpRpt(l.valuePaise)]);
  }
  return toCSV(rows);
}

/**
 * Tally-compatible CSV (BETA — CA pilot pending, "CA-ready" NAHI hai).
 * Har invoice ke liye 3 rows:
 *   1. Party debit (total) — Debit Ledger = party name.
 *   2. Sales credit (taxable) — Credit Ledger = 'Sales'.
 *   3. GST credit (total tax) — Credit Ledger = 'CGST / SGST Payable'
 *      (intra-state) ya 'IGST Payable' (inter-state).
 * Credit note ki amounts signed negative hoti hain (same structure).
 * Pehli line ek '#' comment row hai jisme BETA notice hai — Tally import
 * karne se pehle use hatana ya CA se confirm karna pad sakta hai.
 */
function tallyCsv(invoices) {
  const rows = [
    ['# BETA — CA pilot pending: Tally-compatible CSV, "CA-ready" NAHI hai'],
    ['Date', 'Voucher Type', 'Voucher No', 'Party', 'Debit Ledger', 'Debit Amount', 'Credit Ledger', 'Credit Amount', 'Narration'],
  ];
  for (const inv of invoices || []) {
    const t = inv.totals || {}; // totals pehle se signed hain (credit note negative)
    const total = (t.roundedTotalPaise !== undefined ? t.roundedTotalPaise : (t.totalPaise || 0));
    const taxable = (t.taxablePaise || 0);
    const tax = ((t.cgstPaise || 0) + (t.sgstPaise || 0) + (t.igstPaise || 0));
    const vtype = inv.type === 'credit-note' ? 'Credit Note' : inv.type === 'debit-note' ? 'Debit Note' : 'Sales';
    const vno = inv.number || inv.id || '';
    const narration = vtype + ' ' + vno + ' — ' + (inv.partyName || '');
    const gstLedger = inv.intraState === false ? 'IGST Payable' : 'CGST / SGST Payable';
    rows.push([inv.date || '', vtype, vno, inv.partyName || '', inv.partyName || '', rupees2dpRpt(total), '', '', narration]);
    rows.push([inv.date || '', vtype, vno, inv.partyName || '', '', '', 'Sales', rupees2dpRpt(taxable), narration]);
    rows.push([inv.date || '', vtype, vno, inv.partyName || '', '', '', gstLedger, rupees2dpRpt(tax), narration]);
  }
  return toCSV(rows);
}

/**
 * Full JSON backup/export. Koi storage nahi — sirf shape banata hai.
 * profile: {name, gstin}; baaki sab arrays (missing -> []).
 */
function exportBundle(profile, data) {
  const d = data || {};
  const invoices = d.invoices || [];
  const parties = d.parties || [];
  const ledgerEntries = d.ledgerEntries || [];
  const items = d.items || [];
  const movements = d.movements || [];
  const employees = d.employees || [];
  return {
    app: 'UdyamSetu',
    version: '1.2',
    exportedAt: new Date().toISOString(),
    profile: { name: (profile && profile.name) || '', gstin: (profile && profile.gstin) || null },
    counts: {
      invoices: invoices.length, parties: parties.length,
      ledgerEntries: ledgerEntries.length, items: items.length,
      movements: movements.length, employees: employees.length,
    },
    data: { invoices, parties, ledgerEntries, items, movements, employees },
  };
}

const reportsApi = {
  salesSummary, purchaseSummary, expenseSummary, gstSummary, profitLoss,
  stockSummary, cashFlow, toCSV, invoicesToCSV, partiesToCSV, stockToCSV,
  tallyCsv, exportBundle, rupees2dp: rupees2dpRpt, roundDiv: roundDivRpt, isDateStr,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = reportsApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.reports = reportsApi;
}
