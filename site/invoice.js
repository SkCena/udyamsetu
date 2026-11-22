// UdyamSetu Site — pure invoice logic (no DOM, no I/O).
// All tax math comes from core/gstCore.js — nothing is re-implemented here.
// All money in integer paise. Mirrors the Android data model field names.
'use strict';

let gstCore;
if (typeof module !== 'undefined' && module.exports) {
  gstCore = require('../core/gst.js');
} else {
  // Browser: core/gstCore.js is loaded as a classic script before this file,
  // so its top-level declarations are visible as globals here.
  gstCore = { GST_SLABS, isValidGSTIN, isValidHSN, calcInvoice, invoiceNumber, financialYear, formatINR };
}

/** Indian states / UTs by GST state code. Code drives intra/inter-state. */
const STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman and Diu (old)' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

function stateName(code) {
  const s = STATES.find((x) => x.code === code);
  return s ? s.name : code;
}

function isIntraState(sellerState, buyerState) {
  return sellerState === buyerState;
}

/**
 * Parse a rupee amount typed by the user ("1,000.50", "₹250.5", "100")
 * into integer paise. Throws on anything that is not a plain amount.
 * String parsing only — never float rupees — so 19.99 -> 1999 exactly.
 */
function rupeesToPaise(value) {
  if (value === null || value === undefined) throw new Error('bad amount');
  const s = String(value).trim().replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('bad amount: ' + value);
  const parts = s.split('.');
  const rupees = parseInt(parts[0], 10);
  // Pad the fraction to exactly 2 digits: "5" -> "50", "" -> "00".
  const frac = (parts[1] || '00').padEnd(2, '0').slice(0, 2);
  return rupees * 100 + parseInt(frac, 10);
}

/** Validate a BusinessProfile. Returns an array of error codes (empty = ok). */
function validateProfile(p) {
  const errors = [];
  if (!p || typeof p.name !== 'string' || !p.name.trim()) errors.push('name-required');
  if (p && p.gstin) {
    if (!gstCore.isValidGSTIN(String(p.gstin).trim().toUpperCase())) errors.push('gstin-invalid');
  }
  if (p && p.phone) {
    const digits = String(p.phone).replace(/[\s-]/g, '').replace(/^\+91/, '');
    if (!/^\d{10}$/.test(digits)) errors.push('phone-invalid');
  }
  if (!p || !/^[A-Z]{2,10}$/.test(p.invoicePrefix || '')) errors.push('prefix-invalid');
  if (!p || !Number.isInteger(p.nextSeq) || p.nextSeq < 1) errors.push('nextseq-invalid');
  if (!p || !STATES.some((s) => s.code === p.sellerState)) errors.push('sellerstate-required');
  return errors;
}

/** Validate one invoice line. Returns an array of error codes (empty = ok). */
function validateLine(line) {
  const errors = [];
  if (!line || typeof line.name !== 'string' || !line.name.trim()) errors.push('name-required');
  if (!line || !gstCore.isValidHSN(String(line.hsn || ''))) errors.push('hsn-invalid');
  if (!line || !Number.isInteger(line.qty) || line.qty <= 0) errors.push('qty-invalid');
  if (!line || !Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) errors.push('price-invalid');
  if (!line || typeof line.discountPct !== 'number' || line.discountPct < 0 || line.discountPct > 100) errors.push('discount-invalid');
  if (!line || !gstCore.GST_SLABS.includes(line.taxRatePct)) errors.push('rate-invalid');
  return errors;
}

/** Validate a draft invoice (before numbering). Error codes, empty = ok. */
function validateInvoiceDraft(draft) {
  const errors = [];
  if (!draft || typeof draft.partyName !== 'string' || !draft.partyName.trim()) errors.push('party-required');
  if (draft && draft.partyGstin) {
    if (!gstCore.isValidGSTIN(String(draft.partyGstin).trim().toUpperCase())) errors.push('party-gstin-invalid');
  }
  if (!draft || !STATES.some((s) => s.code === draft.buyerState)) errors.push('buyerstate-required');
  if (!draft || !Array.isArray(draft.lines) || draft.lines.length === 0) errors.push('need-line');
  if (draft && Array.isArray(draft.lines)) {
    draft.lines.forEach((l, i) => {
      for (const e of validateLine(l)) errors.push('line' + (i + 1) + '-' + e);
    });
  }
  return errors;
}

/** Totals for a set of lines, via core calcInvoice. No number assigned. */
function buildTotals(lines, intraState) {
  const calc = gstCore.calcInvoice(lines.map((l) => ({
    qty: l.qty,
    unitPricePaise: l.unitPricePaise,
    discountPct: l.discountPct || 0,
    taxRatePct: l.taxRatePct,
    intraState,
  })));
  return {
    taxablePaise: calc.taxablePaise,
    cgstPaise: calc.cgstPaise,
    sgstPaise: calc.sgstPaise,
    igstPaise: calc.igstPaise,
    totalPaise: calc.totalPaise,
    roundedTotalPaise: calc.roundedTotalPaise,
    roundOffPaise: calc.roundOffPaise,
  };
}

/** Negate every totals field — a credit note is the mirror of the original. */
function negateTotals(t) {
  return {
    taxablePaise: -t.taxablePaise,
    cgstPaise: -t.cgstPaise,
    sgstPaise: -t.sgstPaise,
    igstPaise: -t.igstPaise,
    totalPaise: -t.totalPaise,
    roundedTotalPaise: -t.roundedTotalPaise,
    roundOffPaise: -t.roundOffPaise,
  };
}

function newId() {
  return 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function todayISO(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/**
 * Build an unsaved invoice (status 'draft', number null).
 * Does NOT consume the invoice series — numbering happens in finalizeInvoice.
 * type: 'invoice' | 'credit-note' | 'debit-note'.
 * A credit note's totals are the negation of its lines' totals.
 */
function createInvoiceDraft(opts) {
  const date = opts.date instanceof Date ? opts.date : new Date(opts.date || Date.now());
  const intraState = isIntraState(opts.profile.sellerState, opts.buyerState);
  let totals = buildTotals(opts.lines, intraState);
  if (opts.type === 'credit-note') totals = negateTotals(totals);
  return {
    id: opts.id || newId(),
    number: null,
    fy: null,
    date: todayISO(date),
    type: opts.type || 'invoice',
    linkedInvoiceNumber: opts.linkedInvoiceNumber || null,
    partyName: opts.partyName,
    partyGstin: opts.partyGstin || null,
    buyerState: opts.buyerState,
    intraState,
    lines: opts.lines.map((l) => ({
      name: l.name,
      hsn: String(l.hsn),
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      discountPct: l.discountPct || 0,
      taxRatePct: l.taxRatePct,
    })),
    totals,
    status: 'draft',
  };
}

/**
 * Assign the next series number to a draft and bump the profile sequence.
 * Pure: returns new objects, does not mutate its inputs.
 * seq increments ONLY here — never on draft creation.
 */
function finalizeInvoice(draft, profile, date) {
  const d = date instanceof Date ? date : new Date(date || draft.date);
  const fy = gstCore.financialYear(d);
  const number = gstCore.invoiceNumber(profile.invoicePrefix, fy, profile.nextSeq);
  const invoice = Object.assign({}, draft, { number, fy, date: todayISO(d), status: 'saved' });
  const nextProfile = Object.assign({}, profile, { nextSeq: profile.nextSeq + 1 });
  return { invoice, profile: nextProfile };
}

/**
 * Start a credit/debit note against a saved invoice: same party, same
 * buyer state, same lines (user may edit them in the form before saving).
 * Credit-note totals come out negative via createInvoiceDraft.
 */
function makeNoteDraft(original, type, profile) {
  if (type !== 'credit-note' && type !== 'debit-note') throw new Error('bad note type: ' + type);
  if (!original.number) throw new Error('notes need a saved (numbered) invoice');
  return createInvoiceDraft({
    profile,
    type,
    linkedInvoiceNumber: original.number,
    partyName: original.partyName,
    partyGstin: original.partyGstin,
    buyerState: original.buyerState,
    lines: original.lines.map((l) => Object.assign({}, l)),
    date: new Date(),
  });
}

/** Plain-text invoice summary for the WhatsApp share link. */
function whatsappText(invoice, profile) {
  const kind = invoice.type === 'credit-note' ? 'Credit Note'
    : invoice.type === 'debit-note' ? 'Debit Note' : 'Invoice';
  const out = [
    kind + ' ' + (invoice.number || '(draft)') + ' — ' + (profile.name || ''),
    'Date: ' + invoice.date,
    'Party: ' + invoice.partyName,
    'Total: ' + gstCore.formatINR(invoice.totals.roundedTotalPaise),
  ];
  if (profile.upiId) out.push('Pay via UPI: ' + profile.upiId);
  if (invoice.linkedInvoiceNumber) out.push('Against invoice: ' + invoice.linkedInvoiceNumber);
  out.push('— via UdyamSetu');
  return out.join('\n');
}

function whatsappUrl(invoice, profile) {
  return 'https://wa.me/?text=' + encodeURIComponent(whatsappText(invoice, profile));
}

const invoiceApi = {
  STATES, stateName, isIntraState, rupeesToPaise,
  validateProfile, validateLine, validateInvoiceDraft,
  buildTotals, negateTotals, createInvoiceDraft, finalizeInvoice,
  makeNoteDraft, whatsappText, whatsappUrl, newId, todayISO,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = invoiceApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.invoice = invoiceApi;
}
