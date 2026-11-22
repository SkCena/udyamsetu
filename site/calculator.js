// UdyamSetu Site — GST calculator (pure math + small DOM wiring).
// All money in integer paise — never float rupees — so 19.99 -> 1999 exactly.
// No data is saved; the calculator works fully offline.
'use strict';

let calcGst;
if (typeof module !== 'undefined' && module.exports) {
  calcGst = require('../core/gst.js');
} else {
  calcGst = { GST_SLABS };
}

const GST_CALC_RATES = [0, 5, 12, 18, 28];

/** Round half-up for non-negative integers: round(n/d). */
function calcRoundDiv(n, d) {
  if (!Number.isInteger(n) || n < 0 || !Number.isInteger(d) || d <= 0) throw new Error('bad calc input');
  return Math.floor((n * 2 + d) / (2 * d));
}

/**
 * Parse a rupee amount typed by the user ("1,000.50", "₹250.5", "100")
 * into integer paise. Throws on anything that is not a plain amount.
 */
function calcParseRupees(value) {
  if (value === null || value === undefined) throw new Error('bad amount');
  const s = String(value).trim().replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('bad amount: ' + value);
  const parts = s.split('.');
  const rupees = parseInt(parts[0], 10);
  const frac = (parts[1] || '00').padEnd(2, '0').slice(0, 2);
  return rupees * 100 + parseInt(frac, 10);
}

function calcCheckRate(ratePct) {
  if (typeof ratePct !== 'number' || !calcGst.GST_SLABS.includes(ratePct)) throw new Error('bad GST rate: ' + ratePct);
}

/**
 * Exclusive: amount is WITHOUT GST. Returns { taxablePaise, gstPaise, totalPaise }.
 * Example: 1000.00 @ 18% -> gst 180.00, total 1180.00.
 */
function calcExclusive(amountPaise, ratePct) {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) throw new Error('bad amount');
  calcCheckRate(ratePct);
  const gstPaise = calcRoundDiv(amountPaise * ratePct, 100);
  return { taxablePaise: amountPaise, gstPaise, totalPaise: amountPaise + gstPaise };
}

/**
 * Inclusive: amount INCLUDES GST (reverse calc — total se GST alag karein).
 * Returns { taxablePaise, gstPaise, totalPaise }.
 * Example: 1180.00 @ 18% -> taxable 1000.00, gst 180.00.
 */
function calcInclusive(totalPaise, ratePct) {
  if (!Number.isInteger(totalPaise) || totalPaise < 0) throw new Error('bad amount');
  calcCheckRate(ratePct);
  const taxablePaise = calcRoundDiv(totalPaise * 100, 100 + ratePct);
  return { taxablePaise, gstPaise: totalPaise - taxablePaise, totalPaise };
}

/** One entry point for the UI: mode 'exclusive' | 'inclusive'. */
function calcGstAmount(amountPaise, ratePct, mode) {
  return mode === 'inclusive' ? calcInclusive(amountPaise, ratePct) : calcExclusive(amountPaise, ratePct);
}

const calculatorApi = {
  GST_CALC_RATES, calcRoundDiv, calcParseRupees, calcExclusive, calcInclusive, calcGstAmount,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = calculatorApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.calculator = calculatorApi;

  // ---------------- DOM wiring (browser only) ----------------
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const amountEl = $('calcAmount'), rateEl = $('calcRate'), modeEl = $('calcMode');
    const outTaxable = $('calcTaxableOut'), outGst = $('calcGstOut'), outTotal = $('calcTotalOut');
    const msgEl = $('calcMsg');
    if (!amountEl || !rateEl || !modeEl) return;
    rateEl.innerHTML = GST_CALC_RATES.map((r) => '<option value="' + r + '"' + (r === 18 ? ' selected' : '') + '>' + r + '%</option>').join('');
    const fmt = (paise) => {
      try { return formatINR(paise); } catch (e) { return '₹' + (paise / 100).toFixed(2); }
    };
    function render() {
      let result = null;
      try {
        const amount = calcParseRupees(amountEl.value === '' ? '0' : amountEl.value);
        result = calcGstAmount(amount, parseFloat(rateEl.value), modeEl.value);
        if (msgEl) msgEl.textContent = '';
      } catch (e) {
        if (msgEl) {
          try { msgEl.textContent = window.UdyamSetu.i18n.t('calcInvalid', window.UdyamSetu.i18n.getLang()); }
          catch (err) { msgEl.textContent = 'Enter a valid amount.'; }
        }
      }
      if (outTaxable) outTaxable.textContent = result ? fmt(result.taxablePaise) : '—';
      if (outGst) outGst.textContent = result ? fmt(result.gstPaise) : '—';
      if (outTotal) outTotal.textContent = result ? fmt(result.totalPaise) : '—';
    }
    amountEl.addEventListener('input', render);
    rateEl.addEventListener('change', render);
    modeEl.addEventListener('change', render);
    render();
  });
}
