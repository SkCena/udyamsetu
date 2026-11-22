// UdyamSetu Phase 1.2 integration tests (node). Run: node site/integration.test.js
// Store (new 1.2 collections) + cross-module flows: billing -> stock,
// party ledger -> reports, payroll -> payslip, invoices -> GSTR-1/export.
// No DOM, no browser — MemoryAdapter only.
'use strict';
const storeMod = require('./store.js');
const inv = require('./invoice.js');
const partyApi = require('./party.js');
const invApi = require('./inventory.js');
const gstRep = require('./gst-reports.js');
const payrollApi = require('./payroll.js');
const rep = require('./reports.js');

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}
function includes(name, arr, value) {
  if (arr.includes(value)) { pass++; }
  else { fail++; failures.push(name + ': expected ' + JSON.stringify(arr) + ' to include ' + JSON.stringify(value)); }
}

function goodProfile() {
  return {
    name: 'Sharma Kirana Store', gstin: '22AAAAA0000A1ZC', phone: '9876543210',
    address: 'Main Road, Bhubaneswar', logoDataUrl: null, upiId: 'sharma@upi',
    invoicePrefix: 'INV', nextSeq: 1, sellerState: '21',
  };
}

async function main() {
  const adapter = new storeMod.MemoryAdapter();
  const store = new storeMod.Store(adapter);

  // --- 1.2 collections: empty by default, round-trip, second store sees them ---
  eq('parties empty', await store.listParties(), []);
  eq('ledger empty', await store.listLedger(), []);
  eq('items empty', await store.listItems(), []);
  eq('batches empty', await store.listBatches(), []);
  eq('movements empty', await store.listMovements(), []);
  eq('employees empty', await store.listEmployees(), []);
  eq('attendance empty', await store.listAttendance(), []);
  eq('advances empty', await store.listAdvances(), []);
  eq('expenses empty', await store.listExpenses(), []);

  const party1 = { id: 'p1', name: 'Ramesh Kumar', type: 'customer', phone: '9876543210', gstin: null, state: '21', openingBalancePaise: 0 };
  const party2 = { id: 'p2', name: 'Wholesale Traders', type: 'supplier', phone: '', gstin: '27AAAPL1234C1ZE', state: '27', openingBalancePaise: 0 };
  eq('party validate p1', partyApi.validateParty(party1), []);
  eq('party validate p2', partyApi.validateParty(party2), []);
  await store.saveParty(party1);
  await store.saveParty(party2);
  eq('party round-trip', await store.getParty('p1'), party1);
  const store2 = new storeMod.Store(adapter);
  eq('second store sees parties', (await store2.listParties()).length, 2);

  // Ledger: customer udhaar +50000, payment -20000 => balance 30000.
  const e1 = { id: 'e1', partyId: 'p1', date: '2026-11-02', kind: 'udhaar', amountPaise: 50000, note: 'Rice', linkedInvoiceNumber: null };
  const e2 = { id: 'e2', partyId: 'p1', date: '2026-11-05', kind: 'payment', amountPaise: -20000, note: 'Cash mila', linkedInvoiceNumber: null };
  eq('entry validate', partyApi.validateEntry(e1), []);
  await store.saveLedgerEntry(e1);
  await store.saveLedgerEntry(e2);
  const entries = await store.listLedger();
  eq('party balance via stored entries', partyApi.partyBalance(party1, entries), 30000);
  eq('statement closing', partyApi.statement(party1, entries).closingPaise, 30000);
  const dues = partyApi.dueReminders(await store.listParties(), entries, '2026-11-22');
  eq('due reminders count', dues.length, 1);
  eq('due reminder balance', dues[0].balancePaise, 30000);
  includes('reminder text has amount', [partyApi.reminderText(party1, 30000).includes('₹300.00')], true);

  // Supplier credit purchase: NEGATIVE entry (payable), purchaseSummary -> positive cost.
  const e3 = { id: 'e3', partyId: 'p2', date: '2026-11-03', kind: 'purchase', amountPaise: -1000000, note: 'Stock khareeda', linkedInvoiceNumber: null };
  await store.saveLedgerEntry(e3);
  const entries2 = await store.listLedger();
  eq('supplier balance negative (payable)', partyApi.partyBalance(party2, entries2), -1000000);
  eq('purchase summary positive cost', rep.purchaseSummary(entries2, null), { count: 1, totalPaise: 1000000 });
  // Supplier payment +400000 -> payable kam.
  await store.saveLedgerEntry({ id: 'e4', partyId: 'p2', date: '2026-11-06', kind: 'payment', amountPaise: 400000, note: 'Payment diya', linkedInvoiceNumber: null });
  eq('supplier balance after payment', partyApi.partyBalance(party2, await store.listLedger()), -600000);

  // --- Inventory: item + purchase movement + billing sale decrements stock ---
  const item = { id: 'it1', name: 'Rice 1kg', hsn: '1001', unit: 'kg', gstRatePct: 5, purchasePricePaise: 4500, salePricePaise: 6000, reorderLevel: 10, godown: 'Main' };
  eq('item validate', invApi.validateItem(item), []);
  await store.saveItem(item);
  const mv1 = { id: 'm1', itemId: 'it1', batchId: null, date: '2026-11-01', kind: 'purchase', qtyDelta: 100, godown: 'Main', note: 'Opening', linkedInvoiceNumber: null };
  eq('movement validate', invApi.validateMovement(mv1), []);
  await store.saveMovement(mv1);
  eq('stock after purchase', invApi.stockQty('it1', await store.listMovements()), 100);

  // Batch with expiry.
  const batch = { id: 'b1', itemId: 'it1', batchNo: 'B-101', godown: 'Main', qty: 100, expiryDate: '2026-12-15', purchasePricePaise: 4500 };
  eq('batch validate', invApi.validateBatch(batch), []);
  await store.saveBatch(batch);
  const exp = invApi.expiringBatches(await store.listBatches(), 30, '2026-11-22');
  eq('expiring batch found', exp.length, 1);
  eq('expiring daysLeft', exp[0].daysLeft, 23);

  // Real invoice via invoice.js -> stock sale applied.
  const profile = goodProfile();
  const draft = inv.createInvoiceDraft({
    profile, partyName: 'Ramesh Kumar', partyGstin: null, buyerState: '21',
    lines: [{ name: 'Rice 1kg', hsn: '1001', qty: 5, unitPricePaise: 6000, discountPct: 0, taxRatePct: 5 }],
    date: new Date(2026, 10, 22),
  });
  const done = inv.finalizeInvoice(draft, profile, new Date(2026, 10, 22));
  await store.saveInvoice(done.invoice);
  eq('invoice number', done.invoice.number, 'INV/2026-27/0001');
  const applied = invApi.applyInvoiceToStock(done.invoice, await store.listItems(), await store.listMovements());
  eq('applyInvoice matched, none unmatched', applied.unmatchedLines, []);
  eq('applyInvoice one sale movement', applied.movements.length, 1);
  eq('sale movement qty', applied.movements[0].qtyDelta, -5);
  eq('sale movement linked invoice', applied.movements[0].linkedInvoiceNumber, 'INV/2026-27/0001');
  await store.saveMovements(applied.movements);
  eq('stock after sale', invApi.stockQty('it1', await store.listMovements()), 95);
  eq('low stock not triggered at 95', invApi.lowStock(await store.listItems(), await store.listMovements()).length, 0);

  // --- GST reports from stored invoices ---
  const invoices = await store.listInvoices();
  const s1 = gstRep.gstr1Summary(invoices, {});
  eq('gstr1 invoice count', s1.invoiceCount, 1);
  eq('gstr1 totals taxable', s1.totals.taxablePaise, 30000);
  const s3b = gstRep.gstr3bSummary(invoices, { igstPaise: 0, cgstPaise: 750, sgstPaise: 750 }, {});
  eq('gstr3b net cgst 0 after ITC', s3b.netPayable.cgstPaise, 0);
  const reg = gstRep.salesRegister(invoices, {});
  eq('sales register count', reg.totals.count, 1);
  eq('sales register total', reg.totals.totalPaise, 31500);

  // --- Payroll from stored employee + attendance ---
  const emp = { id: 'emp1', name: 'Raju', role: 'Helper', monthlySalaryPaise: 1200000, pfPct: 0, esiPct: 0, ptPaise: 0, tdsPaise: 0 };
  eq('employee validate', payrollApi.validateEmployee(emp), []);
  await store.saveEmployee(emp);
  const att = { employeeId: 'emp1', month: '2026-11', presentDays: 30, totalDays: 30 };
  eq('attendance validate', payrollApi.validateAttendance(att), []);
  await store.saveAttendance(att);
  await store.saveAdvance({ employeeId: 'emp1', month: '2026-11', amountPaise: 200000, date: '2026-11-10' });
  const slip = payrollApi.calcPayslip(emp, att, { advancePaise: 200000 });
  eq('payslip net after advance', slip.netPaise, 1000000);
  eq('payslip text has net', payrollApi.payslipText(slip, emp, 'hi').includes('10000.00'), true);

  // --- Expenses + P&L + export bundle from stored data ---
  await store.saveExpense({ id: 'x1', date: '2026-11-04', category: 'Rent', amountPaise: 500000, note: 'Shop rent' });
  const sales = rep.salesSummary(invoices, null);
  const pl = rep.profitLoss({ sales, purchases: rep.purchaseSummary(await store.listLedger(), null), expenses: rep.expenseSummary(await store.listExpenses(), null), payrollNetPaise: slip.netPaise });
  eq('P&L sales', pl.salesPaise, 31500);
  eq('P&L purchases', pl.purchasesPaise, 1000000);
  eq('P&L net negative honestly', pl.netProfitPaise, 31500 - 1000000 - 500000 - 1000000);
  const bundle = rep.exportBundle(profile, {
    invoices: await store.listInvoices(), parties: await store.listParties(),
    ledgerEntries: await store.listLedger(), items: await store.listItems(),
    movements: await store.listMovements(), employees: await store.listEmployees(),
  });
  eq('bundle counts invoices', bundle.counts.invoices, 1);
  eq('bundle counts parties', bundle.counts.parties, 2);
  eq('bundle counts movements', bundle.counts.movements, 2);
  eq('bundle app', bundle.app, 'UdyamSetu');
  const tally = rep.tallyCsv(invoices);
  includes('tally csv beta line', [tally.includes('BETA')], true);
  // CSV escaping doubles the inner quotes: ""CA-ready"" NAHI hai.
  includes('tally csv no CA-ready claim', [tally.includes('CA-ready') && tally.includes('NAHI')], true);

  console.log(`Integration tests: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFAILURES:\n' + failures.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error('TEST CRASH: ' + (e && e.stack || e)); process.exit(1); });
