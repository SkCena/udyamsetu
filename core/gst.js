// UdyamSetu shared GST core — Site (JS) implementation.
// Pure functions only. All money in integer paise. No I/O, no DOM here.
// Mirror: core/gst.kt must produce identical results for the same inputs.
// Test vectors: core/gst-test-vectors.json
'use strict';

const GST_SLABS = [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28];

/** Round half-up for non-negative integers: round(n/d). */
function roundDiv(n, d) {
  if (n < 0) throw new Error('roundDiv: negative input');
  return Math.floor((n * 2 + d) / (2 * d));
}

/** Validate a GST rate (percent). */
function isValidRate(ratePct) {
  return GST_SLABS.includes(ratePct);
}

/**
 * One invoice line.
 * @param {qty, unitPricePaise, discountPct (0-100), taxRatePct, intraState}
 * @returns {grossPaise, discountPaise, taxablePaise, taxPaise, cgstPaise, sgstPaise, igstPaise}
 * Discount is applied BEFORE tax. Tax is rounded half-up to the paise.
 * Intra-state: tax splits CGST/SGST (CGST gets the half paise on odd tax).
 * Inter-state: full tax is IGST.
 */
function calcLine(line) {
  const qty = line.qty;
  const unit = line.unitPricePaise;
  const discPct = line.discountPct || 0;
  const rate = line.taxRatePct;
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');
  if (!Number.isInteger(unit) || unit < 0) throw new Error('unitPricePaise must be a non-negative integer');
  if (discPct < 0 || discPct > 100) throw new Error('discountPct must be 0..100');
  if (!isValidRate(rate)) throw new Error('unsupported GST rate: ' + rate);
  const gross = qty * unit;
  const discount = roundDiv(gross * discPct, 100);
  const taxable = gross - discount;
  // Rate in basis points (integer) so the division stays exact: 18% -> 1800, 0.1% -> 10.
  const rateBps = Math.round(rate * 100);
  const tax = roundDiv(taxable * rateBps, 10000);
  let cgst = 0, sgst = 0, igst = 0;
  if (line.intraState) {
    cgst = roundDiv(tax, 2);
    sgst = tax - cgst;
  } else {
    igst = tax;
  }
  return { grossPaise: gross, discountPaise: discount, taxablePaise: taxable, taxPaise: tax, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst };
}

/** Sum lines into an invoice total; round the grand total to the nearest rupee. */
function calcInvoice(lines) {
  if (!lines.length) throw new Error('invoice needs at least one line');
  const calc = lines.map(calcLine);
  let taxable = 0, cgst = 0, sgst = 0, igst = 0;
  for (const l of calc) {
    taxable += l.taxablePaise; cgst += l.cgstPaise; sgst += l.sgstPaise; igst += l.igstPaise;
  }
  const total = taxable + cgst + sgst + igst;
  const rounded = Math.round(total / 100) * 100;
  return {
    lines: calc,
    taxablePaise: taxable, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst,
    totalPaise: total, roundedTotalPaise: rounded, roundOffPaise: rounded - total,
  };
}

/** Format paise as Indian rupees, e.g. 23600 -> "₹236.00". */
function formatINR(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = String(abs % 100).padStart(2, '0');
  return sign + '₹' + rupees + '.' + p;
}

/** GSTIN: 15 chars, state 01-37, PAN, entity, 'Z', base36-mod36 check digit. */
function isValidGSTIN(gstin) {
  if (typeof gstin !== 'string') return false;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
  const state = parseInt(gstin.slice(0, 2), 10);
  if (state < 1 || state > 37) return false;
  const val = (c) => (c >= '0' && c <= '9') ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 55;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const f = (i % 2 === 0) ? 1 : 2;
    const p = val(gstin[i]) * f;
    sum += Math.floor(p / 36) + (p % 36);
  }
  const check = (36 - (sum % 36)) % 36;
  const expected = check < 10 ? String(check) : String.fromCharCode(check + 55);
  return gstin[14] === expected;
}

/** HSN code: 4, 6 or 8 digits. */
function isValidHSN(hsn) {
  return typeof hsn === 'string' && /^\d{4}$|^\d{6}$|^\d{8}$/.test(hsn);
}

/** Invoice number: PREFIX/FY/0001, sequence zero-padded to 4. */
function invoiceNumber(prefix, fy, seq) {
  if (!/^[A-Z]{2,10}$/.test(prefix)) throw new Error('bad invoice prefix');
  if (!/^\d{4}-\d{2}$/.test(fy)) throw new Error('bad financial year');
  if (!Number.isInteger(seq) || seq < 1) throw new Error('bad sequence');
  return prefix + '/' + fy + '/' + String(seq).padStart(4, '0');
}

/** Financial year for a date: Apr 1 – Mar 31, e.g. 2026-11-22 -> "2026-27". */
function financialYear(d) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based; Apr = 3
  const start = m >= 3 ? y : y - 1;
  return start + '-' + String((start + 1) % 100).padStart(2, '0');
}

if (typeof module !== 'undefined') {
  module.exports = { GST_SLABS, roundDiv, isValidRate, calcLine, calcInvoice, formatINR, isValidGSTIN, isValidHSN, invoiceNumber, financialYear };
}
