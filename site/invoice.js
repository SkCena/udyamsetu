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

/** Document types the billing flow supports. 'invoice' is the GST bill.
 *  'non-gst' and 'receipt' carry no tax; 'estimate' is a quotation (tax
 *  shown as entered, never a tax invoice); credit/debit notes link to a
 *  saved bill (see makeNoteDraft). */
const DOC_TYPES = ['invoice', 'non-gst', 'estimate', 'receipt', 'credit-note', 'debit-note'];
const DOC_TYPE_LABELS = {
  'invoice': 'GST Bill',
  'non-gst': 'Non-GST Bill',
  'estimate': 'Estimate / Quotation',
  'receipt': 'Receipt',
  'credit-note': 'Credit Note',
  'debit-note': 'Debit Note',
};
const DOC_TYPE_PREFIX = { 'estimate': 'EST', 'receipt': 'RCT' };
function docTypeLabel(type) {
  return DOC_TYPE_LABELS[type] || DOC_TYPE_LABELS['invoice'];
}
function isDocType(type) { return DOC_TYPES.includes(type); }
/** non-gst + receipt carry no tax; the rest keep the rates as entered. */
function isTaxableDocType(type) {
  return type !== 'non-gst' && type !== 'receipt';
}
/** Zero the tax rate on every line for non-taxable doc types. Pure. */
function applyDocTypeToLines(lines, type) {
  if (isTaxableDocType(type)) return lines.map((l) => Object.assign({}, l));
  return lines.map((l) => Object.assign({}, l, { taxRatePct: 0 }));
}

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
 * type: 'invoice' | 'non-gst' | 'estimate' | 'receipt' | 'credit-note' | 'debit-note'.
 * A credit note's totals are the negation of its lines' totals.
 * Non-GST bills and receipts carry no tax (line rates forced to 0).
 */
function createInvoiceDraft(opts) {
  const date = opts.date instanceof Date ? opts.date : new Date(opts.date || Date.now());
  const type = isDocType(opts.type) ? opts.type : 'invoice';
  const intraState = isIntraState(opts.profile.sellerState, opts.buyerState);
  const lines = applyDocTypeToLines(opts.lines, type);
  let totals = buildTotals(lines, intraState);
  if (type === 'credit-note') totals = negateTotals(totals);
  return {
    id: opts.id || newId(),
    number: null,
    fy: null,
    date: todayISO(date),
    type,
    linkedInvoiceNumber: opts.linkedInvoiceNumber || null,
    partyName: opts.partyName,
    partyGstin: opts.partyGstin || null,
    buyerState: opts.buyerState,
    intraState,
    lines: lines.map((l) => ({
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
 * Estimates use the EST series and receipts the RCT series (same counter).
 */
function finalizeInvoice(draft, profile, date) {
  const d = date instanceof Date ? date : new Date(date || draft.date);
  const fy = gstCore.financialYear(d);
  const prefix = DOC_TYPE_PREFIX[draft.type] || profile.invoicePrefix;
  const number = gstCore.invoiceNumber(prefix, fy, profile.nextSeq);
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
  const kind = docTypeLabel(invoice.type);
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

/** Safe file name for an exported document, e.g. 'INV-2026-27-0001.doc'. */
function docFileName(invoice, ext) {
  const base = String(invoice.number || ('draft-' + invoice.id)).replace(/[^A-Za-z0-9._-]+/g, '-');
  return base + '.' + ext;
}

/** Escape text for the .doc (HTML) export. */
function escDoc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Word-compatible .doc export: plain HTML in a .doc file — Word / LibreOffice
 * open it directly. Pure: same numbers as the on-screen preview.
 */
function invoiceToDocHtml(invoice, profile) {
  const prof = profile || {};
  const kind = docTypeLabel(invoice.type);
  const rows = invoice.lines.map((l, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + escDoc(l.name) + '</td><td>' + escDoc(l.hsn) +
    '</td><td>' + l.qty + '</td><td>' + escDoc(gstCore.formatINR(l.unitPricePaise)) +
    '</td><td>' + l.taxRatePct + '%</td></tr>').join('');
  const tot = invoice.totals;
  const taxRows = invoice.intraState
    ? '<p>CGST: ' + escDoc(gstCore.formatINR(tot.cgstPaise)) + '<br>SGST: ' + escDoc(gstCore.formatINR(tot.sgstPaise)) + '</p>'
    : '<p>IGST: ' + escDoc(gstCore.formatINR(tot.igstPaise)) + '</p>';
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    '<head><meta charset="utf-8"><title>' + escDoc(kind) + ' ' + escDoc(invoice.number || '') + '</title></head><body>' +
    '<h2>' + escDoc(prof.name || 'UdyamSetu') + '</h2>' +
    (prof.gstin ? '<p>GSTIN: ' + escDoc(prof.gstin) + '</p>' : '') +
    (prof.address ? '<p>' + escDoc(prof.address) + '</p>' : '') +
    '<h3>' + escDoc(kind) + (invoice.status === 'draft' ? ' (DRAFT)' : '') + '</h3>' +
    '<p>No: ' + escDoc(invoice.number || '(draft)') + '<br>Date: ' + escDoc(invoice.date) +
    '<br>Party: ' + escDoc(invoice.partyName) +
    (invoice.partyGstin ? '<br>Party GSTIN: ' + escDoc(invoice.partyGstin) : '') +
    (invoice.linkedInvoiceNumber ? '<br>Against: ' + escDoc(invoice.linkedInvoiceNumber) : '') + '</p>' +
    '<table border="1" cellspacing="0" cellpadding="4"><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST</th></tr>' +
    rows + '</table>' +
    '<p>Taxable: ' + escDoc(gstCore.formatINR(tot.taxablePaise)) + '</p>' +
    taxRows +
    '<p>Round off: ' + escDoc(gstCore.formatINR(tot.roundOffPaise)) + '</p>' +
    '<p><b>Total: ' + escDoc(gstCore.formatINR(tot.roundedTotalPaise)) + '</b></p>' +
    (prof.upiId ? '<p>Pay via UPI: ' + escDoc(prof.upiId) + '</p>' : '') +
    '</body></html>';
}

/** Invoice templates — look only. Every template prints the SAME numbers\n *  from invoice.totals (shared core); nothing is re-computed per template. */
const INVOICE_TEMPLATES = ['classic', 'modern', 'minimal', 'thermal'];
function isInvoiceTemplate(name) { return INVOICE_TEMPLATES.indexOf(name) !== -1; }

/**
 * Full invoice HTML for one template. labels carries the display strings
 * ({kind, taxable, roundOff, grandTotal, draft, against}) so the Site can
 * pass translated labels while node tests pass English ones. Pure.
 */
function invoiceTemplateHtml(invoice, profile, template, labels) {
  const tpl = isInvoiceTemplate(template) ? template : 'classic';
  const prof = profile || {};
  const lb = labels || {};
  const kind = lb.kind || docTypeLabel(invoice.type);
  const rows = invoice.lines.map((l, i) => {
    const calc = { qty: l.qty, unitPricePaise: l.unitPricePaise, discountPct: l.discountPct || 0, taxRatePct: l.taxRatePct, intraState: invoice.intraState };
    let lineTotal;
    try { lineTotal = gstCore.calcLine(calc); } catch (e) { lineTotal = null; }
    return '<tr><td>' + (i + 1) + '</td><td>' + escDoc(l.name) + '</td><td>' + escDoc(l.hsn) + '</td>' +
      '<td class="num">' + l.qty + '</td><td class="num">' + escDoc(gstCore.formatINR(l.unitPricePaise)) + '</td>' +
      '<td class="num">' + (l.discountPct || 0) + '%</td><td class="num">' + l.taxRatePct + '%</td>' +
      '<td class="num">' + (lineTotal ? escDoc(gstCore.formatINR(lineTotal.taxablePaise)) : '—') + '</td></tr>';
  }).join('');
  const tot = invoice.totals;
  return '<div class="invoice-doc tpl-' + tpl + '"><div class="doc-head"><div><h3>' + escDoc(prof.name || 'UdyamSetu') + '</h3>' +
    '<div class="doc-meta">' +
    (prof.gstin ? 'GSTIN: ' + escDoc(prof.gstin) + '<br>' : '') +
    (prof.address ? escDoc(prof.address) + '<br>' : '') +
    (prof.phone ? 'Phone: ' + escDoc(prof.phone) + '<br>' : '') +
    '</div></div>' +
    (prof.logoDataUrl ? '<img src="' + escDoc(prof.logoDataUrl) + '" alt="logo">' : '') +
    '</div>' +
    '<h3>' + escDoc(kind) + (invoice.status === 'draft' ? ' (' + escDoc(lb.draft || 'DRAFT') + ')' : '') + '</h3>' +
    '<div class="doc-meta">' +
    (invoice.number ? 'No: <strong>' + escDoc(invoice.number) + '</strong><br>' : '') +
    'Date: ' + escDoc(invoice.date) +
    (invoice.fy ? ' · FY ' + escDoc(invoice.fy) : '') + '<br>' +
    'Party: <strong>' + escDoc(invoice.partyName) + '</strong><br>' +
    (invoice.partyGstin ? 'Party GSTIN: ' + escDoc(invoice.partyGstin) + '<br>' : '') +
    'Buyer state: ' + escDoc(stateName(invoice.buyerState)) +
    ' · ' + (invoice.intraState ? 'CGST + SGST' : 'IGST') + '<br>' +
    (invoice.linkedInvoiceNumber ? escDoc(lb.against || 'Against: ') + escDoc(invoice.linkedInvoiceNumber) + '<br>' : '') +
    '</div>' +
    '<table class="doc-table"><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="num">Qty</th>' +
    '<th class="num">Rate</th><th class="num">Disc</th><th class="num">GST</th><th class="num">Taxable</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<div class="doc-totals">' +
    '<div class="trow"><span>' + escDoc(lb.taxable || 'Taxable') + '</span><strong>' + escDoc(gstCore.formatINR(tot.taxablePaise)) + '</strong></div>' +
    (invoice.intraState
      ? '<div class="trow"><span>CGST</span><strong>' + escDoc(gstCore.formatINR(tot.cgstPaise)) + '</strong></div>' +
        '<div class="trow"><span>SGST</span><strong>' + escDoc(gstCore.formatINR(tot.sgstPaise)) + '</strong></div>'
      : '<div class="trow"><span>IGST</span><strong>' + escDoc(gstCore.formatINR(tot.igstPaise)) + '</strong></div>') +
    '<div class="trow"><span>' + escDoc(lb.roundOff || 'Round off') + '</span><strong>' + escDoc(gstCore.formatINR(tot.roundOffPaise)) + '</strong></div>' +
    '<div class="trow grand"><span>' + escDoc(lb.grandTotal || 'Grand Total') + '</span><strong>' + escDoc(gstCore.formatINR(tot.roundedTotalPaise)) + '</strong></div>' +
    '</div>' +
    (prof.upiId ? '<p class="doc-meta">Pay via UPI: ' + escDoc(prof.upiId) + '</p>' : '') +
    '</div>';
}

/** Share links for one document — all from the same plain-text summary. */
function invoiceShareUrls(invoice, profile) {
  const text = whatsappText(invoice, profile);
  const enc = encodeURIComponent(text);
  const subject = encodeURIComponent(docTypeLabel(invoice.type) + ' ' + (invoice.number || '(draft)') + ' — ' + (profile.name || ''));
  return {
    whatsapp: 'https://wa.me/?text=' + enc,
    sms: 'sms:?body=' + enc,
    email: 'mailto:?subject=' + subject + '&body=' + enc,
    telegram: 'https://t.me/share/url?url=' + encodeURIComponent('https://skcena.github.io/udyamsetu/') + '&text=' + enc,
  };
}

/** Plain text lines for the PNG image export — same numbers, no HTML. Pure. */
function invoiceImageLines(invoice, profile) {
  const prof = profile || {};
  const tot = invoice.totals;
  const lines = [
    { text: prof.name || 'UdyamSetu', bold: true },
    { text: docTypeLabel(invoice.type) + (invoice.number ? ' ' + invoice.number : ''), bold: true },
    { text: 'Date: ' + invoice.date },
    { text: 'Party: ' + invoice.partyName },
    { text: '----------------------------------------' },
  ];
  invoice.lines.forEach((l, i) => {
    lines.push({ text: (i + 1) + '. ' + l.name + ' x' + l.qty + '  ' + gstCore.formatINR(l.unitPricePaise) });
  });
  lines.push({ text: '----------------------------------------' });
  lines.push({ text: 'Taxable: ' + gstCore.formatINR(tot.taxablePaise) });
  if (invoice.intraState) {
    lines.push({ text: 'CGST: ' + gstCore.formatINR(tot.cgstPaise) });
    lines.push({ text: 'SGST: ' + gstCore.formatINR(tot.sgstPaise) });
  } else {
    lines.push({ text: 'IGST: ' + gstCore.formatINR(tot.igstPaise) });
  }
  lines.push({ text: 'Round off: ' + gstCore.formatINR(tot.roundOffPaise) });
  lines.push({ text: 'Total: ' + gstCore.formatINR(tot.roundedTotalPaise), bold: true });
  if (prof.upiId) lines.push({ text: 'Pay via UPI: ' + prof.upiId });
  return lines;
}

/**
 * Draw the invoice onto a <canvas> (browser only) and return the canvas.
 * The caller downloads it as PNG. Uses invoiceImageLines, so the image
 * carries the same numbers as the screen bill.
 */
function drawInvoicePng(invoice, profile, canvas) {
  const lines = invoiceImageLines(invoice, profile);
  const ctx = canvas.getContext('2d');
  const W = 760, rowH = 34, pad = 28;
  canvas.width = W;
  canvas.height = pad * 2 + lines.length * rowH + 12;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#16233d';
  lines.forEach((ln, i) => {
    ctx.font = (ln.bold ? 'bold ' : '') + (i === 0 ? '30px' : i === 1 ? '24px' : '20px') + ' sans-serif';
    ctx.fillText(ln.text, pad, pad + (i + 1) * rowH);
  });
  return canvas;
}

/** JSON export of one document (bill + seller details). Pure. */
function invoiceToExportJson(invoice, profile) {
  return JSON.stringify({
    app: 'UdyamSetu', version: 1,
    exportedOn: todayISO(new Date()),
    profile: profile ? { name: profile.name || null, gstin: profile.gstin || null, phone: profile.phone || null, address: profile.address || null, upiId: profile.upiId || null } : null,
    document: invoice,
  }, null, 2);
}

const invoiceApi = {
  STATES, stateName, isIntraState, rupeesToPaise,
  validateProfile, validateLine, validateInvoiceDraft,
  buildTotals, negateTotals, createInvoiceDraft, finalizeInvoice,
  makeNoteDraft, whatsappText, whatsappUrl, newId, todayISO,
  DOC_TYPES, DOC_TYPE_LABELS, DOC_TYPE_PREFIX, docTypeLabel, isDocType,
  isTaxableDocType, applyDocTypeToLines, docFileName, invoiceToDocHtml, invoiceToExportJson,
  INVOICE_TEMPLATES, isInvoiceTemplate, invoiceTemplateHtml,
  invoiceShareUrls, invoiceImageLines, drawInvoicePng,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = invoiceApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.invoice = invoiceApi;
}
