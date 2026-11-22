// UdyamSetu Site — basic calculator tests (standalone, not GST).
// Run: node site/basiccalc.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const api = require('./basiccalc.js');

let pass = 0;
let fail = 0;
const failures = [];
function eq(name, actual, expected) {
  if (actual === expected) pass++;
  else { fail++; failures.push(name + ': expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)); }
}
function pressSeq(keys) {
  let s = api.basicCalcNew();
  for (const k of keys) s = api.basicCalcPress(s, k);
  return s;
}

eq('starts at 0', api.basicCalcNew().entry, '0');
eq('type digits', pressSeq(['1', '2', '3']).entry, '123');
eq('leading zero replaced', pressSeq(['0', '5']).entry, '5');
eq('decimal point', pressSeq(['1', '.', '5']).entry, '1.5');
eq('one dot only', pressSeq(['1', '.', '.', '5']).entry, '1.5');
eq('add', pressSeq(['1', '2', '+', '3', '=']).entry, '15');
eq('subtract', pressSeq(['9', '-', '4', '=']).entry, '5');
eq('multiply', pressSeq(['6', '×', '7', '=']).entry, '42');
eq('divide', pressSeq(['8', '÷', '2', '=']).entry, '4');
eq('no 0.1+0.2 artefact', pressSeq(['0', '.', '1', '+', '0', '.', '2', '=']).entry, '0.3');
eq('chained ops', pressSeq(['2', '+', '3', '×', '4', '=']).entry, '20');
eq('percent of entry', pressSeq(['5', '0', '%']).entry, '0.5');
eq('percent after op', pressSeq(['2', '0', '0', '+', '1', '0', '%', '=']).entry, '200.1');
eq('backspace', pressSeq(['1', '2', '3', 'back']).entry, '12');
eq('backspace to zero', pressSeq(['5', 'back']).entry, '0');
eq('clear', pressSeq(['9', '+', '1', 'C']).entry, '0');
eq('divide by zero errors', pressSeq(['5', '÷', '0', '=']).entry, 'Error');
eq('digit after error restarts', pressSeq(['5', '÷', '0', '=', '7']).entry, '7');
eq('equals without op keeps entry', pressSeq(['4', '2', '=']).entry, '42');
eq('history shows the sum', pressSeq(['1', '2', '+', '3', '=']).history, '12 + 3 =');
eq('history shows pending op', pressSeq(['1', '2', '+']).history, '12 +');
eq('double zero key', pressSeq(['1', '00']).entry, '100');
eq('format trims float tail', api.basicCalcFormat(2 / 3), '0.6666666667');
eq('format zero', api.basicCalcFormat(0), '0');

// The keypad in index.html has every key the logic handles.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
for (const k of ['C', 'back', '%', '÷', '×', '-', '+', '=', '.']) {
  eq('keypad has key ' + k, html.includes('data-key="' + k + '"'), true);
}
for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00']) {
  eq('keypad has digit ' + d, html.includes('data-key="' + d + '"'), true);
}
eq('basic calc tab in HTML', /data-tab="basiccalc"/.test(html), true);
eq('basic calc section in HTML', /<section id="tab-basiccalc"/.test(html), true);
eq('basiccalc.js loaded in HTML', /basiccalc\.js/.test(html), true);

console.log(`basiccalc tests: ${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
