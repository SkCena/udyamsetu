// UdyamSetu GST core tests (Site/JS). Run: node core/gst.test.js
// Reads the shared vectors in core/gst-test-vectors.json — same file the
// Kotlin test uses, so a vector change tests both implementations.
'use strict';
const fs = require('fs');
const path = require('path');
const g = require('./gst.js');

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'gst-test-vectors.json'), 'utf8'));
let pass = 0, fail = 0;
const failures = [];

function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; failures.push(name + '\n  expected: ' + e + '\n  actual:   ' + a); }
}

function eqKeys(name, actual, expected) {
  for (const k of Object.keys(expected)) eq(name + '.' + k, actual[k], expected[k]);
}

// Line vectors (invoice vectors reference lines by id or inline object)
const byId = {};
for (const v of vectors.lineVectors) byId[v.id] = v;

for (const v of vectors.lineVectors) {
  const got = g.calcLine({ qty: v.qty, unitPricePaise: v.unitPricePaise, discountPct: v.discountPct, taxRatePct: v.taxRatePct, intraState: v.intraState });
  eqKeys('line ' + v.id, got, v.expected);
}

for (const v of vectors.invoiceVectors) {
  const lines = v.lines.map((l) => (typeof l === 'string' ? byId[l] : l));
  const got = g.calcInvoice(lines.map((x) => ({ qty: x.qty, unitPricePaise: x.unitPricePaise, discountPct: x.discountPct, taxRatePct: x.taxRatePct, intraState: x.intraState })));
  eqKeys('invoice ' + v.id, got, v.expected);
}

for (const v of vectors.gstinVectors) {
  eq('gstin ' + (v.gstin || '(empty)'), g.isValidGSTIN(v.gstin), v.valid);
}
for (const v of vectors.hsnVectors) {
  eq('hsn ' + JSON.stringify(v.hsn), g.isValidHSN(v.hsn), v.valid);
}
for (const v of vectors.invoiceNumberVectors) {
  eq('invNo ' + v.expected, g.invoiceNumber(v.prefix, v.fy, v.seq), v.expected);
}

// Format + financial year spot checks
eq('formatINR 23600', g.formatINR(23600), '₹236.00');
eq('formatINR 0', g.formatINR(0), '₹0.00');
eq('formatINR -550', g.formatINR(-550), '-₹5.50');
eq('formatINR 100800', g.formatINR(100800), '₹1008.00');
eq('FY 2026-11-22', g.financialYear(new Date(2026, 10, 22)), '2026-27');
eq('FY 2026-04-01', g.financialYear(new Date(2026, 3, 1)), '2026-27');
eq('FY 2026-03-31', g.financialYear(new Date(2026, 2, 31)), '2025-26');

// Error paths (must throw, not silently compute)
for (const [name, fn] of [
  ['bad rate 25', () => g.calcLine({ qty: 1, unitPricePaise: 100, discountPct: 0, taxRatePct: 25, intraState: true })],
  ['qty 0', () => g.calcLine({ qty: 0, unitPricePaise: 100, discountPct: 0, taxRatePct: 18, intraState: true })],
  ['discount 101', () => g.calcLine({ qty: 1, unitPricePaise: 100, discountPct: 101, taxRatePct: 18, intraState: true })],
  ['empty invoice', () => g.calcInvoice([])],
  ['bad prefix', () => g.invoiceNumber('inv', '2026-27', 1)],
]) {
  try { fn(); fail++; failures.push(name + ': expected throw, got a value'); }
  catch (e) { pass++; }
}

console.log(`GST JS tests: ${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
