// UdyamSetu Site logic tests (node). Run: node site/payroll-reports.test.js
// Tests the pure layers only — site/payroll.js and site/reports.js.
// No DOM, no storage, no browser needed.
'use strict';
const payroll = require('./payroll.js');
const reports = require('./reports.js');
const inv = require('./invoice.js');

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

function contains(name, haystack, needle) {
  if (String(haystack).includes(needle)) { pass++; }
  else { fail++; failures.push(name + ': expected text to contain ' + JSON.stringify(needle) + '\n  got: ' + JSON.stringify(haystack)); }
}

function notContains(name, haystack, needle) {
  if (!String(haystack).includes(needle)) { pass++; }
  else { fail++; failures.push(name + ': expected text NOT to contain ' + JSON.stringify(needle)); }
}

function goodProfile(over) {
  return Object.assign({
    name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC', phone: '9876543210',
    invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
  }, over || {});
}

function makeInvoice(opts) {
  const draft = inv.createInvoiceDraft(Object.assign({
    profile: goodProfile(), buyerState: '21', partyName: 'Ramesh Traders',
    partyGstin: null, date: new Date('2026-11-10'),
    lines: [{ name: 'Sugar', hsn: '1701', qty: 10, unitPricePaise: 10000, discountPct: 0, taxRatePct: 18 }],
  }, opts || {}));
  return inv.finalizeInvoice(draft, goodProfile()).invoice;
}

function main() {
  // ---------- payroll: validateEmployee ----------
  eq('employee valid, defaults ok', payroll.validateEmployee({ id: 'e1', name: 'Raju', monthlySalaryPaise: 3000000 }), []);
  eq('employee missing name', payroll.validateEmployee({ id: 'e1', monthlySalaryPaise: 100 }), ['name-required']);
  eq('employee bad pf pct', payroll.validateEmployee({ id: 'e1', name: 'Raju', monthlySalaryPaise: 100, pfPct: 101 }), ['pf-invalid']);
  eq('employee negative salary', payroll.validateEmployee({ id: 'e1', name: 'Raju', monthlySalaryPaise: -5 }), ['salary-invalid']);

  // ---------- payroll: pro-rata payslip (15/30 = aadhi salary) ----------
  const emp = { id: 'e1', name: 'Raju Kumar', role: 'Helper', monthlySalaryPaise: 3000000, pfPct: 12, esiPct: 0.75, ptPaise: 20000, tdsPaise: 0 };
  const att = { employeeId: 'e1', month: '2026-11', presentDays: 15, totalDays: 30 };
  const slip = payroll.calcPayslip(emp, att, { advancePaise: 100000 });
  eq('payslip pro-rata gross half', slip.grossPaise, 1500000);
  eq('payslip pf user pct 12%', slip.pfPaise, 180000);
  eq('payslip esi user pct 0.75%', slip.esiPaise, 11250);
  eq('payslip pt as entered', slip.ptPaise, 20000);
  eq('payslip advance', slip.advancePaise, 100000);
  eq('payslip total deductions', slip.totalDeductionsPaise, 311250);
  eq('payslip net', slip.netPaise, 1188750);
  eq('payslip month + employee', { employeeId: slip.employeeId, month: slip.month }, { employeeId: 'e1', month: '2026-11' });

  // Full month, no deductions configured -> net == salary.
  const empPlain = { id: 'e2', name: 'Sita', monthlySalaryPaise: 2000000 };
  const slipFull = payroll.calcPayslip(empPlain, { employeeId: 'e2', month: '2026-11', presentDays: 30, totalDays: 30 });
  eq('payslip full month no deductions', slipFull, {
    employeeId: 'e2', month: '2026-11', grossPaise: 2000000, pfPaise: 0, esiPaise: 0,
    ptPaise: 0, tdsPaise: 0, advancePaise: 0, otherDeductionPaise: 0,
    otherDeductionNote: '', totalDeductionsPaise: 0, netPaise: 2000000,
  });

  // Half-up rounding: 10005 * 15/30 = 5002.5 -> 5003.
  const slipRound = payroll.calcPayslip(
    { id: 'e3', name: 'Mohan', monthlySalaryPaise: 10005 },
    { employeeId: 'e3', month: '2026-11', presentDays: 15, totalDays: 30 });
  eq('payslip gross rounds half-up', slipRound.grossPaise, 5003);

  // Zero present days -> gross 0, net 0 (koi deduction nahi).
  const slipZero = payroll.calcPayslip(empPlain, { employeeId: 'e2', month: '2026-11', presentDays: 0, totalDays: 30 });
  eq('payslip zero days net 0', slipZero.netPaise, 0);

  // ---------- payroll: deductions > gross throws ----------
  throws('deductions exceed gross', () => payroll.calcPayslip(
    { id: 'e4', name: 'Gita', monthlySalaryPaise: 100000, ptPaise: 500000 },
    { employeeId: 'e4', month: '2026-11', presentDays: 1, totalDays: 30 }));
  throws('advance alone exceeds gross', () => payroll.calcPayslip(
    empPlain, { employeeId: 'e2', month: '2026-11', presentDays: 1, totalDays: 30 },
    { advancePaise: 99999999 }));

  // ---------- payroll: attendance invalid ----------
  eq('attendance present > total', payroll.validateAttendance({ employeeId: 'e1', month: '2026-11', presentDays: 31, totalDays: 30 }), ['present-exceeds-total']);
  eq('attendance totalDays 0 invalid', payroll.validateAttendance({ employeeId: 'e1', month: '2026-11', presentDays: 0, totalDays: 0 }), ['totaldays-invalid']);
  eq('attendance bad month', payroll.validateAttendance({ employeeId: 'e1', month: '2026-13', presentDays: 1, totalDays: 30 }), ['month-invalid']);
  throws('calcPayslip bad attendance throws', () => payroll.calcPayslip(
    empPlain, { employeeId: 'e2', month: '2026-11', presentDays: 31, totalDays: 30 }));
  throws('calcPayslip employee mismatch throws', () => payroll.calcPayslip(
    empPlain, { employeeId: 'e9', month: '2026-11', presentDays: 5, totalDays: 30 }));

  // ---------- payroll: recordAdvance ----------
  const adv = payroll.recordAdvance('e1', '2026-11', 500000);
  eq('advance shape fields', { employeeId: adv.employeeId, month: adv.month, amountPaise: adv.amountPaise }, { employeeId: 'e1', month: '2026-11', amountPaise: 500000 });
  eq('advance date is today ISO', /^\d{4}-\d{2}-\d{2}$/.test(adv.date), true);
  throws('advance zero amount throws', () => payroll.recordAdvance('e1', '2026-11', 0));
  throws('advance bad month throws', () => payroll.recordAdvance('e1', 'Nov 2026', 1000));

  // ---------- payroll: payslipText ----------
  const textEn = payroll.payslipText(slip, emp, 'en');
  contains('payslip text has name', textEn, 'Raju Kumar');
  contains('payslip text has month', textEn, '2026-11');
  contains('payslip text has gross', textEn, 'Rs 15000.00');
  contains('payslip text has PF line', textEn, 'PF: Rs 1800.00');
  contains('payslip text has ESI line', textEn, 'ESI: Rs 112.50');
  contains('payslip text has net amount', textEn, 'Rs 11887.50');
  const textHi = payroll.payslipText(slip, emp, 'hi');
  contains('payslip hindi text has net', textHi, 'Rs 11887.50');
  contains('payslip hindi title', textHi, 'Vetan Parchi');
  const slipOther = payroll.calcPayslip(emp, att, { otherDeductionPaise: 5000, otherDeductionNote: 'Uniform' });
  contains('payslip text other deduction + note', payroll.payslipText(slipOther, emp, 'en'), 'Other Deduction (Uniform): Rs 50.00');

  // ---------- reports: salesSummary ----------
  const invA = makeInvoice({ date: new Date('2026-11-10') }); // 10x10000 @18% intra: taxable 100000, cgst 9000, sgst 9000, total 118000
  const invB = makeInvoice({
    date: new Date('2026-11-12'), buyerState: '27', partyName: 'Pune Traders',
    lines: [{ name: 'Rice', hsn: '1006', qty: 20, unitPricePaise: 5000, discountPct: 0, taxRatePct: 5 }],
  }); // inter: taxable 100000, igst 5000, total 105000
  const invOld = makeInvoice({ date: new Date('2026-10-05') });
  const sales = reports.salesSummary([invA, invB, invOld], { from: '2026-11-01', to: '2026-11-30' });
  eq('sales count in range', sales.count, 2);
  eq('sales taxable', sales.taxablePaise, 200000);
  eq('sales cgst', sales.cgstPaise, 9000);
  eq('sales sgst', sales.sgstPaise, 9000);
  eq('sales igst', sales.igstPaise, 5000);
  eq('sales total', sales.totalPaise, 223000);
  eq('sales byRate', sales.byRate, [
    { ratePct: 5, taxablePaise: 100000, taxPaise: 5000 },
    { ratePct: 18, taxablePaise: 100000, taxPaise: 18000 },
  ]);
  // Credit note ghata deta hai.
  const cn = inv.makeNoteDraft(invA, 'credit-note', goodProfile());
  const cnSaved = inv.finalizeInvoice(cn, goodProfile()).invoice;
  const salesNet = reports.salesSummary([invA, cnSaved], null);
  eq('sales net of credit note', salesNet.taxablePaise, 0);
  eq('sales net count includes note', salesNet.count, 2);

  // ---------- reports: gstSummary ----------
  const gstSum = reports.gstSummary([invA, invB, cnSaved]);
  eq('gst invoiceCount', gstSum.invoiceCount, 2);
  eq('gst noteCount', gstSum.noteCount, 1);
  eq('gst taxable net', gstSum.taxablePaise, 100000);
  eq('gst total net', gstSum.totalPaise, 105000);

  // ---------- reports: purchaseSummary ----------
  // party.js convention: supplier credit purchase NEGATIVE store hoti hai
  // (payable badha). purchaseSummary usko positive cost me badalta hai.
  const ledger = [
    { id: 'l1', date: '2026-11-02', kind: 'purchase', amountPaise: -8000000 },
    { id: 'l2', date: '2026-11-20', kind: 'purchase', amountPaise: -2000000 },
    { id: 'l3', date: '2026-10-15', kind: 'purchase', amountPaise: -5000000 },
    { id: 'l4', date: '2026-11-05', kind: 'sale', amountPaise: 118000 },
  ];
  eq('purchase summary in range', reports.purchaseSummary(ledger, { from: '2026-11-01', to: '2026-11-30' }), { count: 2, totalPaise: 10000000 });
  eq('purchase summary all', reports.purchaseSummary(ledger, null), { count: 3, totalPaise: 15000000 });

  // ---------- reports: expenseSummary ----------
  const expenses = [
    { id: 'x1', date: '2026-11-03', category: 'Rent', amountPaise: 1000000, note: '' },
    { id: 'x2', date: '2026-11-04', category: 'Electricity', amountPaise: 250000, note: '' },
    { id: 'x3', date: '2026-11-05', category: 'Rent', amountPaise: 500000, note: '' },
    { id: 'x4', date: '2026-10-01', category: 'Rent', amountPaise: 9000000, note: '' },
  ];
  eq('expense summary', reports.expenseSummary(expenses, { from: '2026-11-01', to: '2026-11-30' }), {
    totalPaise: 1750000,
    byCategory: [
      { category: 'Rent', totalPaise: 1500000 },
      { category: 'Electricity', totalPaise: 250000 },
    ],
  });

  // ---------- reports: profitLoss ----------
  eq('P&L math', reports.profitLoss({ sales: 22300000, purchases: 10000000, expenses: 1750000, payrollNetPaise: 1188750 }), {
    salesPaise: 22300000, purchasesPaise: 10000000, grossProfitPaise: 12300000,
    expensesPaise: 1750000, payrollPaise: 1188750, netProfitPaise: 9361250,
  });
  eq('P&L accepts summary objects', reports.profitLoss({ sales, purchases: reports.purchaseSummary(ledger, null), expenses: reports.expenseSummary(expenses, null), payrollNetPaise: 0 }).grossProfitPaise, 223000 - 15000000);
  eq('P&L loss goes negative honestly', reports.profitLoss({ sales: 100, purchases: 500, expenses: 0, payrollNetPaise: 0 }).netProfitPaise, -400);

  // ---------- reports: stockSummary ----------
  const items = [
    { id: 'it1', name: 'Sugar 1kg', purchasePricePaise: 4500 },
    { id: 'it2', name: 'Rice 1kg', purchasePricePaise: 6000 },
    { id: 'it3', name: 'Tea 100g', purchasePricePaise: 12000 },
  ];
  const movements = [
    { itemId: 'it1', qtyDelta: 100 }, { itemId: 'it1', qtyDelta: -30 },
    { itemId: 'it2', qtyDelta: 50 },
  ];
  eq('stock value', reports.stockSummary(items, movements), {
    lines: [
      { itemId: 'it1', qty: 70, valuePaise: 315000 },
      { itemId: 'it2', qty: 50, valuePaise: 300000 },
      { itemId: 'it3', qty: 0, valuePaise: 0 },
    ],
    totalValuePaise: 615000,
  });

  // ---------- reports: cashFlow (sign convention) ----------
  // Cash flow me sirf asli cash: udhaar sale/purchase count NAHI hote.
  const cashLedger = [
    { id: 'c1', date: '2026-11-02', kind: 'sale', amountPaise: 50000 },       // credit sale -> NOT cash, ignored
    { id: 'c2', date: '2026-11-03', kind: 'payment', amountPaise: -20000 },  // customer paid -> receipt
    { id: 'c3', date: '2026-11-04', kind: 'payment', amountPaise: 10000 },   // paid supplier -> payment
    { id: 'c4', date: '2026-11-05', kind: 'purchase', amountPaise: -30000 }, // credit purchase -> NOT cash, ignored
    { id: 'c5', date: '2026-10-01', kind: 'payment', amountPaise: -999999 }, // out of range, ignored
  ];
  const cashInv = Object.assign({}, makeInvoice({ date: new Date('2026-11-06') }), { paymentMode: 'cash' }); // 118000 cash
  const creditInv = makeInvoice({ date: new Date('2026-11-07') }); // no paymentMode -> NOT counted (ledger me hai)
  const cf = reports.cashFlow(cashLedger, [cashInv, creditInv], { from: '2026-11-01', to: '2026-11-30' });
  eq('cashflow receipts', cf.receiptsPaise, 20000 + 118000);
  eq('cashflow payments', cf.paymentsPaise, 10000);
  eq('cashflow net', cf.netPaise, 138000 - 10000);
  eq('cashflow empty', reports.cashFlow([], [], null), { receiptsPaise: 0, paymentsPaise: 0, netPaise: 0 });

  // ---------- reports: CSV ----------
  eq('toCSV plain', reports.toCSV([['a', 'b'], [1, 2]]), 'a,b\n1,2\n');
  eq('toCSV escaping comma+quote+newline', reports.toCSV([['Sharma, "Kirana" Store', 'line1\nline2']]),
    '"Sharma, ""Kirana"" Store","line1\nline2"\n');
  eq('toCSV null is empty', reports.toCSV([[null, undefined, 'x']]), ',,x\n');

  const trickyParty = 'Sharma, "Kirana" Store';
  const invTricky = makeInvoice({ partyName: trickyParty, date: new Date('2026-11-10') });
  const invCsv = reports.invoicesToCSV([invTricky]);
  contains('invoices CSV escapes party name', invCsv, '"Sharma, ""Kirana"" Store"');
  contains('invoices CSV header', invCsv, 'Date,Invoice No,Party,GSTIN,Taxable,CGST,SGST,IGST,Total');
  contains('invoices CSV rupees 2dp', invCsv, '1000.00,90.00,90.00,0.00,1180.00');

  const partiesCsv = reports.partiesToCSV(
    [{ id: 'p1', name: 'Ramesh, Traders', gstin: '22AAAAA0000A1ZC', phone: '9876543210' }],
    { p1: -250050 });
  contains('parties CSV balance negative rupees', partiesCsv, '"Ramesh, Traders",22AAAAA0000A1ZC,9876543210,-2500.50');

  const stockCsv = reports.stockToCSV(items, movements);
  contains('stock CSV line', stockCsv, 'Sugar 1kg,70,45.00,3150.00');

  // ---------- reports: tallyCsv ----------
  const tally = reports.tallyCsv([invA]);
  const tallyLines = tally.trimEnd().split('\n');
  eq('tally first line is BETA comment row', tallyLines[0].includes('BETA — CA pilot pending'), true);
  contains('tally beta comment full', tallyLines[0], 'BETA — CA pilot pending');
  notContains('tally must not claim CA-ready as done', tally, 'CA-ready hai');
  eq('tally header is line 2', tallyLines[1], 'Date,Voucher Type,Voucher No,Party,Debit Ledger,Debit Amount,Credit Ledger,Credit Amount,Narration');
  eq('tally 3 data rows per invoice', tallyLines.length, 5);
  contains('tally party debit row', tally, ',Ramesh Traders,1180.00,,,');
  contains('tally sales credit row', tally, ',,,Sales,1000.00,');
  contains('tally gst credit row', tally, ',,,CGST / SGST Payable,180.00,');
  const tally2 = reports.tallyCsv([invA, invB]);
  eq('tally 2 invoices = 2 header-ish + 6 data rows', tally2.trimEnd().split('\n').length, 8);

  // ---------- reports: exportBundle ----------
  const bundle = reports.exportBundle(
    { name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC' },
    { invoices: [invA], parties: [{ id: 'p1', name: 'Ramesh' }], ledgerEntries: ledger, items, movements, employees: [emp] });
  eq('bundle app + version', { app: bundle.app, version: bundle.version }, { app: 'UdyamSetu', version: '1.2' });
  eq('bundle profile', bundle.profile, { name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC' });
  eq('bundle counts', bundle.counts, { invoices: 1, parties: 1, ledgerEntries: 4, items: 3, movements: 3, employees: 1 });
  eq('bundle exportedAt ISO', /^\d{4}-\d{2}-\d{2}T/.test(bundle.exportedAt), true);
  eq('bundle data passthrough', bundle.data.invoices.length, 1);
  const bundleEmpty = reports.exportBundle({ name: 'X' }, {});
  eq('bundle empty counts', bundleEmpty.counts, { invoices: 0, parties: 0, ledgerEntries: 0, items: 0, movements: 0, employees: 0 });

  console.log('payroll-reports: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) {
    console.log('FAILURES:\n' + failures.join('\n---\n'));
    process.exit(1);
  }
}

main();
