// UdyamSetu Site logic tests (node). Run: node site/party-inventory.test.js
// Tests the pure layers only — site/party.js (Party/Udhaar ledger) and
// site/inventory.js (stock). No DOM, no store, no browser needed.
// Style mirrors site/app.test.js: pass/fail count, exit(1) on any fail.
'use strict';
const party = require('./party.js');
const inv = require('./inventory.js');

let pass = 0, fail = 0;
const failures = [];

function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}

function includes(name, arr, value) {
  if (arr.includes(value)) { pass++;
  } else { fail++; failures.push(name + ': expected ' + JSON.stringify(arr) + ' to include ' + JSON.stringify(value)); }
}

function notIncludes(name, arr, value) {
  if (!arr.includes(value)) { pass++; }
  else { fail++; failures.push(name + ': expected ' + JSON.stringify(arr) + ' NOT to include ' + JSON.stringify(value)); }
}

function goodParty(over) {
  return Object.assign({
    id: 'p1', name: 'Ramesh Kumar', type: 'customer', phone: '9876543210',
    gstin: null, state: '21', openingBalancePaise: 0,
  }, over || {});
}

function goodItem(over) {
  return Object.assign({
    id: 'i1', name: 'Basmati Rice 1kg', hsn: '1006', unit: 'kg', gstRatePct: 5,
    purchasePricePaise: 8000, salePricePaise: 11000, reorderLevel: 10, godown: 'Main',
  }, over || {});
}

function main() {
  // ---------- PARTY: validation ----------
  eq('party valid', party.validateParty(goodParty()), []);
  includes('party name-required', party.validateParty(goodParty({ name: '  ' })), 'name-required');
  includes('party type-invalid', party.validateParty(goodParty({ type: 'friend' })), 'type-invalid');
  includes('party phone-invalid', party.validateParty(goodParty({ phone: '12345' })), 'phone-invalid');
  includes('party gstin-invalid', party.validateParty(goodParty({ gstin: 'BADGSTIN' })), 'gstin-invalid');
  includes('party opening-invalid', party.validateParty(goodParty({ openingBalancePaise: 10.5 })), 'openingBalancePaise-invalid');
  includes('party state-invalid', party.validateParty(goodParty({ state: '99' })), 'state-invalid');
  eq('party valid gstin ok', party.validateParty(goodParty({ gstin: '22AAAAA0000A1ZC' })), []);

  eq('entry valid', party.validateEntry({ id: 'e1', partyId: 'p1', date: '2026-11-20', kind: 'udhaar', amountPaise: 50000, note: '', linkedInvoiceNumber: null }), []);
  includes('entry kind-invalid', party.validateEntry({ partyId: 'p1', date: '2026-11-20', kind: 'gift', amountPaise: 100 }), 'kind-invalid');
  includes('entry date-invalid', party.validateEntry({ partyId: 'p1', date: '20-11-2026', kind: 'udhaar', amountPaise: 100 }), 'date-invalid');
  includes('entry date-impossible', party.validateEntry({ partyId: 'p1', date: '2026-02-30', kind: 'udhaar', amountPaise: 100 }), 'date-invalid');
  includes('entry amount-invalid', party.validateEntry({ partyId: 'p1', date: '2026-11-20', kind: 'udhaar', amountPaise: 10.5 }), 'amountPaise-invalid');
  includes('entry partyId-required', party.validateEntry({ date: '2026-11-20', kind: 'udhaar', amountPaise: 100 }), 'partyId-required');

  // ---------- PARTY: balance ----------
  const p = goodParty({ openingBalancePaise: 10000 }); // ₹100 receivable
  const entries = [
    { id: 'e1', partyId: 'p1', date: '2026-11-10', kind: 'udhaar', amountPaise: 50000, note: 'credit sale', linkedInvoiceNumber: 'INV/2026-27/0001' },
    { id: 'e2', partyId: 'p1', date: '2026-11-15', kind: 'payment', amountPaise: -20000, note: 'cash received', linkedInvoiceNumber: null },
    { id: 'e3', partyId: 'p2', date: '2026-11-12', kind: 'udhaar', amountPaise: 99999, note: 'other party', linkedInvoiceNumber: null },
  ];
  eq('balance opening+entries', party.partyBalance(p, entries), 40000); // 10000+50000-20000
  eq('balance ignores other party', party.partyBalance(p, entries), 40000);
  eq('balance no entries', party.partyBalance(goodParty({ openingBalancePaise: 25000 }), []), 25000);
  eq('balance zero opening default', party.partyBalance({ id: 'p9', name: 'X', type: 'customer' }, []), 0);

  // Payment se balance ghata (customer se payment milna = negative delta)
  eq('payment reduces balance', party.partyBalance(
    goodParty({ openingBalancePaise: 50000 }),
    [{ id: 'e1', partyId: 'p1', date: '2026-11-20', kind: 'payment', amountPaise: -50000, note: '', linkedInvoiceNumber: null }]), 0);

  // Supplier payable sign: opening NEGATIVE = hum party ko dena hai;
  // supplier ko payment = payable kam (positive delta, balance 0 ki taraf)
  const supplier = goodParty({ id: 's1', name: 'Gupta Traders', type: 'supplier', openingBalancePaise: -80000 });
  eq('supplier payable opening', party.partyBalance(supplier, []), -80000);
  eq('supplier payment raises balance toward 0', party.partyBalance(supplier, [
    { id: 'e1', partyId: 's1', date: '2026-11-20', kind: 'payment', amountPaise: 30000, note: 'paid supplier', linkedInvoiceNumber: null },
  ]), -50000);
  eq('supplier purchase increases payable', party.partyBalance(supplier, [
    { id: 'e1', partyId: 's1', date: '2026-11-20', kind: 'purchase', amountPaise: -20000, note: 'credit purchase', linkedInvoiceNumber: null },
  ]), -100000);

  // ---------- PARTY: statement / running balance ----------
  const st = party.statement(p, entries);
  eq('statement opening', st.openingPaise, 10000);
  eq('statement closing', st.closingPaise, 40000);
  eq('statement rows count', st.rows.length, 2);
  eq('statement row1 running', st.rows[0].runningBalancePaise, 60000);
  eq('statement row2 running', st.rows[1].runningBalancePaise, 40000);
  eq('statement row keeps entry fields', st.rows[0].kind, 'udhaar');
  eq('statement is applyEntries alias', party.applyEntries(p, entries).closingPaise, 40000);
  // Out-of-order entries sort by date in the statement
  const st2 = party.statement(p, [entries[1], entries[0]]);
  eq('statement sorts by date', st2.rows[0].id, 'e1');
  eq('statement sorted closing', st2.closingPaise, 40000);

  // ---------- PARTY: due reminders ----------
  const parties = [
    goodParty({ id: 'p1', name: 'Ramesh', openingBalancePaise: 10000 }),
    goodParty({ id: 'p2', name: 'Suresh', openingBalancePaise: 0 }),
    goodParty({ id: 's1', name: 'Gupta Traders', type: 'supplier', openingBalancePaise: -80000 }),
    goodParty({ id: 'p3', name: 'Mohan', openingBalancePaise: 5000 }),
  ];
  const remEntries = [
    { id: 'e1', partyId: 'p1', date: '2026-11-01', kind: 'udhaar', amountPaise: 40000, note: '', linkedInvoiceNumber: null },
    { id: 'e2', partyId: 'p1', date: '2026-11-10', kind: 'udhaar', amountPaise: 10000, note: '', linkedInvoiceNumber: null },
    { id: 'e3', partyId: 'p2', date: '2026-11-05', kind: 'udhaar', amountPaise: 70000, note: '', linkedInvoiceNumber: null },
    { id: 'e4', partyId: 'p3', date: '2026-11-20', kind: 'udhaar', amountPaise: 15000, note: '', linkedInvoiceNumber: null },
  ];
  const rems = party.dueReminders(parties, remEntries, '2026-11-22');
  eq('reminders only positive count', rems.length, 3); // p1, p2, p3 — supplier (payable) excluded
  eq('reminders sorted balance desc', rems.map((r) => r.party.id), ['p2', 'p1', 'p3']);
  eq('reminder p2 balance', rems[0].balancePaise, 70000);
  eq('reminder p1 oldest date', rems[1].oldestUnpaidDate, '2026-11-01');
  eq('reminder p1 daysDue', rems[1].daysDue, 21);
  eq('reminder p3 daysDue', rems[2].daysDue, 2);
  eq('reminders empty when none due', party.dueReminders([goodParty({ openingBalancePaise: 0 })], [], '2026-11-22'), []);
  // Opening-only balance (no entries): oldest date null
  const remOpen = party.dueReminders([goodParty({ id: 'p5', name: 'Anil', openingBalancePaise: 9000 })], [], '2026-11-22');
  eq('reminder opening-only oldest null', remOpen[0].oldestUnpaidDate, null);

  // ---------- PARTY: reminder text ----------
  const hi = party.reminderText(goodParty({ name: 'Ramesh Kumar' }), 60000, 'hi');
  eq('reminder hi has name', hi.includes('Ramesh Kumar'), true);
  eq('reminder hi has amount', hi.includes('₹600.00'), true);
  eq('reminder hi is Hindi', /udhaar|baki|bhugtan/i.test(hi), true);
  const en = party.reminderText(goodParty({ name: 'Ramesh Kumar' }), 60000, 'en');
  eq('reminder en has amount', en.includes('₹600.00'), true);
  eq('reminder en is English', /pending|payment/i.test(en), true);
  eq('reminder default lang hi', party.reminderText(goodParty({ name: 'Ramesh' }), 10000).includes('₹100.00'), true);

  // ---------- INVENTORY: validation ----------
  eq('item valid', inv.validateItem(goodItem()), []);
  includes('item hsn-invalid', inv.validateItem(goodItem({ hsn: '123' })), 'hsn-invalid');
  includes('item rate-invalid', inv.validateItem(goodItem({ gstRatePct: 25 })), 'rate-invalid');
  eq('item rate 0 ok', inv.validateItem(goodItem({ gstRatePct: 0 })), []);
  includes('item unit-invalid', inv.validateItem(goodItem({ unit: 'dozen' })), 'unit-invalid');
  includes('item name-required', inv.validateItem(goodItem({ name: '' })), 'name-required');
  includes('item purchase-price-invalid', inv.validateItem(goodItem({ purchasePricePaise: -5 })), 'purchasePricePaise-invalid');
  includes('item reorder-invalid', inv.validateItem(goodItem({ reorderLevel: -1 })), 'reorderLevel-invalid');
  eq('item rate 18 ok', inv.validateItem(goodItem({ gstRatePct: 18 })), []);
  eq('item rate 0.1 ok', inv.validateItem(goodItem({ gstRatePct: 0.1 })), []);

  eq('batch valid', inv.validateBatch({ id: 'b1', itemId: 'i1', batchNo: 'B-101', godown: 'Main', qty: 50, expiryDate: '2027-01-31', purchasePricePaise: 8000 }), []);
  includes('batch qty-invalid', inv.validateBatch({ itemId: 'i1', batchNo: 'B1', godown: 'Main', qty: -1, expiryDate: null, purchasePricePaise: 100 }), 'qty-invalid');
  includes('batch expiry-invalid', inv.validateBatch({ itemId: 'i1', batchNo: 'B1', godown: 'Main', qty: 1, expiryDate: '31-01-2027', purchasePricePaise: 100 }), 'expiryDate-invalid');

  eq('movement valid', inv.validateMovement({ id: 'm1', itemId: 'i1', batchId: null, date: '2026-11-20', kind: 'purchase', qtyDelta: 10, godown: 'Main', note: '', linkedInvoiceNumber: null }), []);
  includes('movement kind-invalid', inv.validateMovement({ itemId: 'i1', date: '2026-11-20', kind: 'steal', qtyDelta: 1, godown: 'Main' }), 'kind-invalid');
  includes('movement qtyDelta-invalid', inv.validateMovement({ itemId: 'i1', date: '2026-11-20', kind: 'sale', qtyDelta: 0, godown: 'Main' }), 'qtyDelta-invalid');

  // ---------- INVENTORY: stock ----------
  const movs = [
    { id: 'm1', itemId: 'i1', batchId: 'b1', date: '2026-11-01', kind: 'purchase', qtyDelta: 100, godown: 'Main', note: '', linkedInvoiceNumber: null },
    { id: 'm2', itemId: 'i1', batchId: 'b1', date: '2026-11-05', kind: 'sale', qtyDelta: -30, godown: 'Main', note: '', linkedInvoiceNumber: 'INV/2026-27/0001' },
    { id: 'm3', itemId: 'i1', batchId: null, date: '2026-11-06', kind: 'adjust', qtyDelta: -2, godown: 'Main', note: 'damage', linkedInvoiceNumber: null },
    { id: 'm4', itemId: 'i1', batchId: null, date: '2026-11-07', kind: 'transfer', qtyDelta: 20, godown: 'Godown-2', note: 'in', linkedInvoiceNumber: null },
    { id: 'm5', itemId: 'i2', batchId: null, date: '2026-11-07', kind: 'purchase', qtyDelta: 999, godown: 'Main', note: '', linkedInvoiceNumber: null },
  ];
  eq('stockQty purchase-sale-adjust', inv.stockQty('i1', movs), 88); // 100-30-2+20
  eq('stockQty unknown item', inv.stockQty('iX', movs), 0);
  eq('stockByGodown', inv.stockByGodown('i1', movs), { Main: 68, 'Godown-2': 20 });
  eq('batchQty', inv.batchQty('b1', movs), 70);
  eq('batchQty unknown', inv.batchQty('bX', movs), 0);
  // Kg decimals: 0.1 + 0.2 must not become 0.30000000000000004
  eq('stockQty kg decimals', inv.stockQty('i1', [
    { id: 'm1', itemId: 'i1', batchId: null, date: '2026-11-01', kind: 'purchase', qtyDelta: 0.1, godown: 'Main', note: '', linkedInvoiceNumber: null },
    { id: 'm2', itemId: 'i1', batchId: null, date: '2026-11-02', kind: 'purchase', qtyDelta: 0.2, godown: 'Main', note: '', linkedInvoiceNumber: null },
  ]), 0.3);

  // ---------- INVENTORY: low stock ----------
  const items = [
    goodItem({ id: 'i1', name: 'Rice', reorderLevel: 10 }),
    goodItem({ id: 'i2', name: 'Dal', reorderLevel: 50 }),
    goodItem({ id: 'i3', name: 'Sugar', reorderLevel: 5 }),
  ];
  const lowMovs = [
    { id: 'm1', itemId: 'i1', batchId: null, date: '2026-11-01', kind: 'purchase', qtyDelta: 9, godown: 'Main', note: '', linkedInvoiceNumber: null },
    { id: 'm2', itemId: 'i2', batchId: null, date: '2026-11-01', kind: 'purchase', qtyDelta: 50, godown: 'Main', note: '', linkedInvoiceNumber: null },
    { id: 'm3', itemId: 'i3', batchId: null, date: '2026-11-01', kind: 'purchase', qtyDelta: 6, godown: 'Main', note: '', linkedInvoiceNumber: null },
  ];
  eq('lowStock only below threshold', inv.lowStock(items, lowMovs).map((x) => x.id), ['i1']); // i2 == level is NOT low, i3 above
  eq('lowStock empty', inv.lowStock(items, []).map((x) => x.id), ['i1', 'i2', 'i3']);

  // ---------- INVENTORY: expiring batches ----------
  const batches = [
    { id: 'b1', itemId: 'i1', batchNo: 'B1', godown: 'Main', qty: 10, expiryDate: '2026-11-25', purchasePricePaise: 100 },
    { id: 'b2', itemId: 'i1', batchNo: 'B2', godown: 'Main', qty: 5, expiryDate: '2026-11-20', purchasePricePaise: 100 },
    { id: 'b3', itemId: 'i2', batchNo: 'B3', godown: 'Main', qty: 8, expiryDate: '2026-12-25', purchasePricePaise: 100 },
    { id: 'b4', itemId: 'i2', batchNo: 'B4', godown: 'Main', qty: 3, expiryDate: null, purchasePricePaise: 100 },
  ];
  const exp = inv.expiringBatches(batches, 7, '2026-11-22');
  eq('expiring order expiry asc', exp.map((b) => b.id), ['b2', 'b1']); // b2 expired (-2d) first, then b1 (+3d); b3 far, b4 no expiry
  eq('expiring expired daysLeft negative', exp[0].daysLeft, -2);
  eq('expiring soon daysLeft', exp[1].daysLeft, 3);
  eq('expiring within 0 only expired', inv.expiringBatches(batches, 0, '2026-11-22').map((b) => b.id), ['b2']);

  // ---------- INVENTORY: applyInvoiceToStock ----------
  const invoice = {
    id: 'inv1', number: 'INV/2026-27/0005', date: '2026-11-22',
    lines: [
      { name: 'Basmati Rice 1kg', hsn: '1006', qty: 2, unitPricePaise: 11000, discountPct: 0, taxRatePct: 5 },
      { name: 'Toor Dal', hsn: '0713', qty: 5, unitPricePaise: 9000, discountPct: 0, taxRatePct: 5 },
      { name: 'Mystery Item XYZ', hsn: '9999', qty: 1, unitPricePaise: 100, discountPct: 0, taxRatePct: 18 },
    ],
  };
  const stockItems = [
    goodItem({ id: 'i1', name: 'Basmati Rice 1kg', hsn: '1006', godown: 'Main' }),
    goodItem({ id: 'i2', name: 'Toor Dal Premium', hsn: '0713', godown: 'Godown-2' }),
  ];
  const res = inv.applyInvoiceToStock(invoice, stockItems, movs);
  eq('applyInvoice movements count', res.movements.length, 2);
  eq('applyInvoice match by HSN (name differs)', res.movements[1].itemId, 'i2'); // name 'Toor Dal' vs 'Toor Dal Premium' — HSN matched
  eq('applyInvoice sale qtyDelta negative', res.movements[0].qtyDelta, -2);
  eq('applyInvoice kind sale', res.movements[0].kind, 'sale');
  eq('applyInvoice godown from item', res.movements[1].godown, 'Godown-2');
  eq('applyInvoice batchId null', res.movements[0].batchId, null);
  eq('applyInvoice linked invoice', res.movements[0].linkedInvoiceNumber, 'INV/2026-27/0005');
  eq('applyInvoice unmatched lines', res.unmatchedLines, ['Mystery Item XYZ']);
  eq('applyInvoice does not mutate inputs', movs.length, 5);
  // Name fallback: no HSN match, exact name (case-insensitive) matches
  const res2 = inv.applyInvoiceToStock({
    id: 'inv2', number: 'INV/2026-27/0006', date: '2026-11-22',
    lines: [{ name: 'basmati rice 1kg', hsn: '0000', qty: 1, unitPricePaise: 11000, discountPct: 0, taxRatePct: 5 }],
  }, stockItems, []);
  eq('applyInvoice match by name fallback', res2.movements.length, 1);
  eq('applyInvoice name fallback item', res2.movements[0].itemId, 'i1');
  eq('applyInvoice name fallback unmatched empty', res2.unmatchedLines, []);

  // newId uniqueness / shape
  eq('newId unique', party.newId() !== party.newId(), true);
  eq('newId inventory unique', inv.newId() !== inv.newId(), true);

  console.log('party-inventory: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) console.log(failures.join('\n---\n'));
  process.exit(fail ? 1 : 0);
}

main();
