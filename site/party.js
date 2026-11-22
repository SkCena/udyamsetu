// UdyamSetu Site — pure Party / Udhaar ledger logic (no DOM, no I/O).
// All money in integer paise. Mirrors the Android data model field names.
// Pattern follows site/invoice.js: Node module.exports + browser global fallback.
//
// SIGN CONVENTION (openingBalancePaise and every balance):
//   POSITIVE = party humko dena hai (receivable — customer owes us).
//   NEGATIVE = hum party ko dena hai (payable — we owe the supplier).
//   ZERO     = hisaab clear.
//
// SIGN RULES FOR LedgerEntry.amountPaise (signed delta to the balance):
//   - Customer se udhaar / credit sale  -> balance BADHTA hai (positive delta).
//   - Customer se payment milna         -> balance GHATTA hai (negative delta).
//   - Supplier se credit purchase       -> payable BADHTA hai (negative delta).
//   - Supplier ko payment               -> payable KAM hota hai, balance 0 ki
//     taraf badhta hai (positive delta).
//   These rules are the CALLER's responsibility: validateEntry does NOT
//   enforce a sign per kind, and partyBalance/statement only SUM amountPaise.
//   A wrong sign is a caller bug, not a validation error — the ledger must
//   never silently flip a sign the user entered.
'use strict';

let gstParty;
if (typeof module !== 'undefined' && module.exports) {
  gstParty = require('../core/gst.js');
} else {
  // Browser: core/gstParty.js is loaded as a classic script before this file,
  // so its top-level declarations are visible as globals here.
  gstParty = { isValidGSTIN, formatINR };
}

const PARTY_TYPES = ['customer', 'supplier'];
const ENTRY_KINDS = ['udhaar', 'payment', 'purchase', 'sale', 'adjustment'];

/** Date string 'YYYY-MM-DD' that is a real calendar date. */
function isValidDateString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(5, 7), 10);
  const d = parseInt(s.slice(8, 10), 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Whole days from date a to date b (b - a), both 'YYYY-MM-DD'. */
function daysBetween(a, b) {
  const pa = Date.parse(a + 'T00:00:00Z');
  const pb = Date.parse(b + 'T00:00:00Z');
  return Math.round((pb - pa) / 86400000);
}

/** Indian mobile: 10 digits, optional +91 / spaces / dashes. */
function isValidPhone(phone) {
  const digits = String(phone).replace(/[\s-]/g, '').replace(/^\+91/, '');
  return /^\d{10}$/.test(digits);
}

/** GST state code '01'..'37'. */
function isValidStateCode(state) {
  if (typeof state !== 'string' || !/^\d{2}$/.test(state)) return false;
  const n = parseInt(state, 10);
  return n >= 1 && n <= 37;
}

function newPartyId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Validate a Party. Returns an array of error codes (empty = ok).
 * Party: {id, name, type:'customer'|'supplier', phone, gstin|null,
 *         state, openingBalancePaise}
 */
function validateParty(p) {
  const errors = [];
  if (!p || typeof p.name !== 'string' || !p.name.trim()) errors.push('name-required');
  if (!p || !PARTY_TYPES.includes(p.type)) errors.push('type-invalid');
  if (p && p.phone) {
    if (!isValidPhone(p.phone)) errors.push('phone-invalid');
  }
  if (p && p.gstin) {
    if (!gstParty.isValidGSTIN(String(p.gstin).trim().toUpperCase())) errors.push('gstin-invalid');
  }
  if (!p || !isValidStateCode(p.state)) errors.push('state-invalid');
  if (p && p.openingBalancePaise !== undefined && p.openingBalancePaise !== null) {
    if (!Number.isInteger(p.openingBalancePaise)) errors.push('openingBalancePaise-invalid');
  }
  return errors;
}

/**
 * Validate a LedgerEntry. Returns an array of error codes (empty = ok).
 * Entry: {id, partyId, date:'YYYY-MM-DD', kind, amountPaise (signed),
 *         note, linkedInvoiceNumber|null}
 * NOTE: the sign of amountPaise is NOT checked here — see the file header.
 */
function validateEntry(e) {
  const errors = [];
  if (!e || typeof e.partyId !== 'string' || !e.partyId.trim()) errors.push('partyId-required');
  if (!e || !isValidDateString(e.date)) errors.push('date-invalid');
  if (!e || !ENTRY_KINDS.includes(e.kind)) errors.push('kind-invalid');
  if (!e || !Number.isInteger(e.amountPaise)) errors.push('amountPaise-invalid');
  return errors;
}

/** Entries belonging to one party, in date order (id breaks ties). */
function entriesFor(partyId, entries) {
  return (entries || [])
    .filter((e) => e.partyId === partyId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}

/**
 * Current balance in paise: openingBalancePaise + sum of the party's entries.
 * Positive = receivable, negative = payable (see file header).
 */
function partyBalance(party, entries) {
  const opening = party && Number.isInteger(party.openingBalancePaise) ? party.openingBalancePaise : 0;
  let sum = opening;
  for (const e of entriesFor(party.id, entries)) sum += e.amountPaise;
  return sum;
}

/**
 * Full statement for one party.
 * Returns {party, openingPaise, rows:[entry + runningBalancePaise], closingPaise}.
 * Rows are in date order; runningBalancePaise is the balance after that entry.
 * Pure: inputs are not mutated.
 */
function statement(party, entries) {
  const opening = party && Number.isInteger(party.openingBalancePaise) ? party.openingBalancePaise : 0;
  let running = opening;
  const rows = entriesFor(party.id, entries).map((e) => {
    running += e.amountPaise;
    return Object.assign({}, e, { runningBalancePaise: running });
  });
  return { party, openingPaise: opening, rows, closingPaise: running };
}

/** Alias kept for the task's wording — same as statement(). */
function applyEntries(party, entries) {
  return statement(party, entries);
}

/**
 * Who owes us, as of a date. Only parties with balance > 0 (receivable).
 * Returns [{party, balancePaise, oldestUnpaidDate, daysDue}] sorted by
 * balancePaise descending. oldestUnpaidDate is the earliest entry date for
 * that party (null when the balance comes from opening only); daysDue is
 * whole days from that date to asOfDate (null when there is no entry date).
 * asOfDate: 'YYYY-MM-DD' (defaults to today).
 */
function dueReminders(parties, entries, asOfDate) {
  const asOf = asOfDate || new Date().toISOString().slice(0, 10);
  const out = [];
  for (const p of parties || []) {
    const balance = partyBalance(p, entries);
    if (balance <= 0) continue; // payable / settled parties never get a reminder
    const mine = entriesFor(p.id, entries);
    const oldest = mine.length ? mine[0].date : null;
    out.push({
      party: p,
      balancePaise: balance,
      oldestUnpaidDate: oldest,
      daysDue: oldest === null ? null : daysBetween(oldest, asOf),
    });
  }
  out.sort((a, b) => b.balancePaise - a.balancePaise);
  return out;
}

/**
 * Short reminder text for WhatsApp. lang 'hi' (default) or 'en'.
 * Amount is formatted with core formatINR (₹X.XX).
 */
function reminderText(party, balancePaise, lang) {
  const name = party && party.name ? party.name : '';
  const amount = gstParty.formatINR(balancePaise);
  if (lang === 'en') {
    return 'Hello ' + name + ', your pending balance of ' + amount +
      ' is due. Please pay at the earliest. Thank you! — UdyamSetu';
  }
  return 'Namaste ' + name + ' ji, aapka ' + amount +
    ' udhaar baki hai. Kripya jald se jald bhugtan karein. Dhanyavaad! — UdyamSetu';
}

const partyApi = {
  PARTY_TYPES, ENTRY_KINDS,
  isValidDateString, daysBetween, isValidPhone, isValidStateCode,
  newId: newPartyId, validateParty, validateEntry,
  partyBalance, statement, applyEntries, dueReminders, reminderText,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = partyApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.party = partyApi;
}
