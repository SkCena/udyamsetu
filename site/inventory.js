// UdyamSetu Site — pure Inventory / stock logic (no DOM, no I/O).
// All money in integer paise; quantities are plain numbers and MAY be
// decimal (kg/ltr), rounded to 3 decimals on summation. GST rates are
// validated against core/gstInv.js GST_SLABS — never a hardcoded list.
// Pattern follows site/invoice.js: Node module.exports + browser global fallback.
'use strict';

let gstInv;
if (typeof module !== 'undefined' && module.exports) {
  gstInv = require('../core/gst.js');
} else {
  // Browser: core/gstInv.js is loaded as a classic script before this file,
  // so its top-level declarations are visible as globals here.
  gstInv = { GST_SLABS, isValidHSN };
}

const UNITS = ['pcs', 'kg', 'ltr', 'box', 'mtr'];
const MOVEMENT_KINDS = ['purchase', 'sale', 'adjust', 'transfer'];

/** Date string 'YYYY-MM-DD' that is a real calendar date. */
function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(5, 7), 10);
  const d = parseInt(s.slice(8, 10), 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Whole days from date a to date b (b - a), both 'YYYY-MM-DD'. */
function daysBetweenInv(a, b) {
  const pa = Date.parse(a + 'T00:00:00Z');
  const pb = Date.parse(b + 'T00:00:00Z');
  return Math.round((pb - pa) / 86400000);
}

/** Sum quantities, rounded to 3 decimals (kills 0.1+0.2 float dust). */
function roundQty(n) {
  const r = Math.round(n * 1000) / 1000;
  return r === 0 ? 0 : r; // never return -0
}

function newInvId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Validate an Item. Returns an array of error codes (empty = ok).
 * Item: {id, name, hsn, unit, gstRatePct, purchasePricePaise,
 *        salePricePaise, reorderLevel, godown}
 * gstRatePct must be one of core GST_SLABS.
 */
function validateItem(item) {
  const errors = [];
  if (!item || typeof item.name !== 'string' || !item.name.trim()) errors.push('name-required');
  if (!item || !gstInv.isValidHSN(String(item.hsn || ''))) errors.push('hsn-invalid');
  if (!item || !UNITS.includes(item.unit)) errors.push('unit-invalid');
  if (!item || !gstInv.GST_SLABS.includes(item.gstRatePct)) errors.push('rate-invalid');
  if (!item || !Number.isInteger(item.purchasePricePaise) || item.purchasePricePaise < 0) errors.push('purchasePricePaise-invalid');
  if (!item || !Number.isInteger(item.salePricePaise) || item.salePricePaise < 0) errors.push('salePricePaise-invalid');
  if (!item || typeof item.reorderLevel !== 'number' || !Number.isFinite(item.reorderLevel) || item.reorderLevel < 0) errors.push('reorderLevel-invalid');
  if (item && item.godown !== undefined && item.godown !== null) {
    if (typeof item.godown !== 'string' || !item.godown.trim()) errors.push('godown-invalid');
  }
  return errors;
}

/**
 * Validate a Batch. Returns an array of error codes (empty = ok).
 * Batch: {id, itemId, batchNo, godown, qty (>=0), expiryDate|null,
 *         purchasePricePaise}
 */
function validateBatch(b) {
  const errors = [];
  if (!b || typeof b.itemId !== 'string' || !b.itemId.trim()) errors.push('itemId-required');
  if (!b || typeof b.batchNo !== 'string' || !b.batchNo.trim()) errors.push('batchNo-required');
  if (!b || typeof b.godown !== 'string' || !b.godown.trim()) errors.push('godown-required');
  if (!b || typeof b.qty !== 'number' || !Number.isFinite(b.qty) || b.qty < 0) errors.push('qty-invalid');
  if (b && b.expiryDate !== undefined && b.expiryDate !== null) {
    if (!isValidDateStr(b.expiryDate)) errors.push('expiryDate-invalid');
  }
  if (!b || !Number.isInteger(b.purchasePricePaise) || b.purchasePricePaise < 0) errors.push('purchasePricePaise-invalid');
  return errors;
}

/**
 * Validate a Movement. Returns an array of error codes (empty = ok).
 * Movement: {id, itemId, batchId|null, date, kind, qtyDelta (signed,
 *   non-zero), godown, note, linkedInvoiceNumber|null}
 * qtyDelta sign is the movement itself: purchase/transfer-in positive,
 * sale/transfer-out negative, adjust either way.
 */
function validateMovement(m) {
  const errors = [];
  if (!m || typeof m.itemId !== 'string' || !m.itemId.trim()) errors.push('itemId-required');
  if (!m || !isValidDateStr(m.date)) errors.push('date-invalid');
  if (!m || !MOVEMENT_KINDS.includes(m.kind)) errors.push('kind-invalid');
  if (!m || typeof m.qtyDelta !== 'number' || !Number.isFinite(m.qtyDelta) || m.qtyDelta === 0) errors.push('qtyDelta-invalid');
  if (!m || typeof m.godown !== 'string' || !m.godown.trim()) errors.push('godown-required');
  return errors;
}

/** Total stock of one item across all godowns: sum of qtyDelta (3 decimals). */
function stockQty(itemId, movements) {
  let sum = 0;
  for (const m of movements || []) {
    if (m.itemId === itemId) sum += m.qtyDelta;
  }
  return roundQty(sum);
}

/** Stock per godown for one item: {godown: qty}. */
function stockByGodown(itemId, movements) {
  const out = {};
  for (const m of movements || []) {
    if (m.itemId !== itemId) continue;
    out[m.godown] = roundQty((out[m.godown] || 0) + m.qtyDelta);
  }
  return out;
}

/** Stock in one batch: sum of qtyDelta where batchId matches. */
function batchQty(batchId, movements) {
  let sum = 0;
  for (const m of movements || []) {
    if (m.batchId === batchId) sum += m.qtyDelta;
  }
  return roundQty(sum);
}

/** Items whose stock is strictly below their reorderLevel. */
function lowStock(items, movements) {
  return (items || []).filter((it) => stockQty(it.id, movements) < it.reorderLevel);
}

/**
 * Batches expiring within `withinDays` days of asOfDate ('YYYY-MM-DD'),
 * sorted by expiryDate ascending. Expired batches are included with a
 * negative daysLeft. Batches with no expiryDate are excluded.
 * Returns each batch plus a `daysLeft` field (negative = already expired).
 */
function expiringBatches(batches, withinDays, asOfDate) {
  const asOf = asOfDate || new Date().toISOString().slice(0, 10);
  return (batches || [])
    .filter((b) => b.expiryDate)
    .map((b) => Object.assign({}, b, { daysLeft: daysBetweenInv(asOf, b.expiryDate) }))
    .filter((b) => b.daysLeft <= withinDays)
    .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0));
}

/**
 * Turn a saved invoice's lines into sale movements (stock goes out).
 * Match each line to an item by HSN first, then by exact name
 * (case-insensitive, trimmed). A sale movement has qtyDelta = -line.qty,
 * kind 'sale', godown = the matched item's godown, batchId null.
 * Returns {movements: [new movements], unmatchedLines: [line names that
 * matched no item]}. Inputs are not mutated; the caller appends the new
 * movements to its own movement list.
 */
function applyInvoiceToStock(invoice, items, movements) {
  const byHsn = new Map();
  const byName = new Map();
  for (const it of items || []) {
    if (it.hsn && !byHsn.has(String(it.hsn))) byHsn.set(String(it.hsn), it);
    const key = typeof it.name === 'string' ? it.name.trim().toLowerCase() : '';
    if (key && !byName.has(key)) byName.set(key, it);
  }
  const outMovements = [];
  const unmatchedLines = [];
  for (const line of (invoice && invoice.lines) || []) {
    const item = byHsn.get(String(line.hsn)) ||
      byName.get(typeof line.name === 'string' ? line.name.trim().toLowerCase() : '');
    if (!item) {
      unmatchedLines.push(line.name);
      continue;
    }
    outMovements.push({
      id: newInvId('mov'),
      itemId: item.id,
      batchId: null,
      date: invoice.date,
      kind: 'sale',
      qtyDelta: -line.qty,
      godown: item.godown || 'Main',
      note: 'Sale ' + (invoice.number || ''),
      linkedInvoiceNumber: invoice.number || null,
    });
  }
  return { movements: outMovements, unmatchedLines };
}

const invApi = {
  UNITS, MOVEMENT_KINDS,
  isValidDateString: isValidDateStr, daysBetween: daysBetweenInv,
  newId: newInvId, validateItem, validateBatch, validateMovement,
  stockQty, stockByGodown, batchQty, lowStock, expiringBatches,
  applyInvoiceToStock,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = invApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.inventory = invApi;
}
