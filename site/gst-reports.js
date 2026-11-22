// UdyamSetu Site — GST reports + portal JSON (pure logic, no DOM, no I/O).
// DRAFT — portal pe upload karke verify karein, CA pilot pending. Koi
// 'CA-ready' claim nahi. App filing NAHI karta; ye JSON sirf portal ke
// offline tool / upload ke liye draft export hai.
// All money in integer paise inside summaries; portal JSON uses rupees
// (2 decimals). ITC app khud guess NAHI karta — user portal 2B se bharta hai.
'use strict';

let gstRep;
if (typeof module !== 'undefined' && module.exports) {
  gstRep = require('../core/gst.js');
} else {
  // Browser: core/gstRep.js loaded as a classic script before this file.
  gstRep = { calcLine };
}

/** Paise (integer) -> rupees as a 2-decimal number (portal format). */
function paiseToRupees(paise) {
  return Number((paise / 100).toFixed(2));
}

/** Zero tax-head bucket. */
function zeroHeads() {
  return { taxablePaise: 0, igstPaise: 0, cgstPaise: 0, sgstPaise: 0 };
}

function addHeads(a, b) {
  return {
    taxablePaise: a.taxablePaise + b.taxablePaise,
    igstPaise: a.igstPaise + b.igstPaise,
    cgstPaise: a.cgstPaise + b.cgstPaise,
    sgstPaise: a.sgstPaise + b.sgstPaise,
  };
}

function headsOf(inv) {
  const t = inv.totals || {};
  return {
    taxablePaise: t.taxablePaise || 0,
    igstPaise: t.igstPaise || 0,
    cgstPaise: t.cgstPaise || 0,
    sgstPaise: t.sgstPaise || 0,
  };
}

/** Saved invoices only, optional fy ('2026-27') and month ('YYYY-MM') filter. */
function filterSaved(invoices, opts) {
  const o = opts || {};
  return (invoices || []).filter((inv) => {
    if (!inv || inv.status !== 'saved') return false;
    if (o.fy && inv.fy !== o.fy) return false;
    if (o.month && typeof inv.date === 'string' && inv.date.slice(0, 7) !== o.month) return false;
    return true;
  });
}

function isNote(inv) {
  return inv.type === 'credit-note' || inv.type === 'debit-note';
}

/** First line's rate; only indicative when lines mix rates (JSON uses per-line rt). */
function invoiceRatePct(inv) {
  return inv.lines && inv.lines.length ? inv.lines[0].taxRatePct : 0;
}

/** B2CL threshold: rounded total above Rs 2,50,000 (2,50,00,000 paise). */
const B2CL_THRESHOLD_PAISE = 25000000;

/**
 * GSTR-1 summary.
 * B2B = partyGstin present. B2CL = B2C (no GSTIN) + inter-state + rounded
 * total > Rs 2,50,000. B2CS = baaki B2C, line-wise aggregated by state+rate
 * (har line ka rate alag ho sakta hai). Notes (credit/debit) -> cdnr only,
 * credit-note totals negative hote hain (invoice.js negateTotals).
 */
function gstr1Summary(invoices, opts) {
  const saved = filterSaved(invoices, opts);
  const b2bByCtin = {};
  const b2clByState = {};
  const b2csByKey = {};
  const cdnr = [];
  let totals = zeroHeads();
  let invoiceCount = 0;

  for (const inv of saved) {
    totals = addHeads(totals, headsOf(inv));
    if (isNote(inv)) {
      const taxPaise = (inv.totals.igstPaise || 0) + (inv.totals.cgstPaise || 0) + (inv.totals.sgstPaise || 0);
      cdnr.push({
        ctin: inv.partyGstin || null,
        party: inv.partyName,
        noteNumber: inv.number,
        date: inv.date,
        noteType: inv.type === 'credit-note' ? 'C' : 'D',
        taxablePaise: inv.totals.taxablePaise || 0,
        taxPaise,
        roundedTotalPaise: inv.totals.roundedTotalPaise || 0,
        // Kept so the portal JSON can split the note's tax per line
        // (was hardcoded to zeros before — a CA-pilot fixture caught it).
        intraState: !!inv.intraState,
        lines: (inv.lines || []).map((l) => Object.assign({}, l)),
      });
      continue;
    }
    if (inv.type !== 'invoice') continue;
    invoiceCount++;
    const entry = {
      number: inv.number,
      date: inv.date,
      buyerState: inv.buyerState,
      // Kept: portalItems splits each line's tax by it. Without this every
      // B2B item was reported as IGST (a CA-pilot fixture caught it).
      intraState: !!inv.intraState,
      taxablePaise: inv.totals.taxablePaise || 0,
      igstPaise: inv.totals.igstPaise || 0,
      cgstPaise: inv.totals.cgstPaise || 0,
      sgstPaise: inv.totals.sgstPaise || 0,
      roundedTotalPaise: inv.totals.roundedTotalPaise || 0,
      ratePct: invoiceRatePct(inv),
      lines: (inv.lines || []).map((l) => Object.assign({}, l)),
    };
    if (inv.partyGstin) {
      const ctin = inv.partyGstin;
      if (!b2bByCtin[ctin]) b2bByCtin[ctin] = { ctin, partyName: inv.partyName, invoices: [] };
      b2bByCtin[ctin].invoices.push(entry);
    } else if (!inv.intraState && (inv.totals.roundedTotalPaise || 0) > B2CL_THRESHOLD_PAISE) {
      const state = inv.buyerState;
      if (!b2clByState[state]) b2clByState[state] = { state, invoices: [] };
      b2clByState[state].invoices.push(entry);
    } else {
      // B2CS: aggregate line-wise by buyer state + line rate.
      for (const line of inv.lines || []) {
        const calc = gstRep.calcLine({
          qty: line.qty,
          unitPricePaise: line.unitPricePaise,
          discountPct: line.discountPct || 0,
          taxRatePct: line.taxRatePct,
          intraState: !!inv.intraState,
        });
        const key = inv.buyerState + '|' + line.taxRatePct;
        if (!b2csByKey[key]) {
          b2csByKey[key] = {
            state: inv.buyerState, ratePct: line.taxRatePct,
            taxablePaise: 0, igstPaise: 0, cgstPaise: 0, sgstPaise: 0, count: 0,
          };
        }
        const bucket = b2csByKey[key];
        bucket.taxablePaise += calc.taxablePaise;
        bucket.igstPaise += calc.igstPaise;
        bucket.cgstPaise += calc.cgstPaise;
        bucket.sgstPaise += calc.sgstPaise;
        bucket.count += 1; // count = lines aggregated into this bucket
      }
    }
  }

  return {
    b2b: Object.values(b2bByCtin),
    b2cl: Object.values(b2clByState),
    b2cs: Object.values(b2csByKey),
    cdnr,
    totals,
    invoiceCount,
  };
}

/**
 * GSTR-3B summary. Outward = saved invoices + notes (signed, so credit
 * notes reduce outward). ITC user-entered hai (portal 2B se) — app khud
 * ITC guess NAHI karta; default 0. Net payable = max(0, outward - ITC)
 * per tax head.
 */
function gstr3bSummary(invoices, itcInput, opts) {
  const saved = filterSaved(invoices, opts).filter((inv) => inv.type === 'invoice' || isNote(inv));
  let outward = zeroHeads();
  for (const inv of saved) outward = addHeads(outward, headsOf(inv));
  const itc = {
    igstPaise: (itcInput && itcInput.igstPaise) || 0,
    cgstPaise: (itcInput && itcInput.cgstPaise) || 0,
    sgstPaise: (itcInput && itcInput.sgstPaise) || 0,
  };
  const netPayable = {
    igstPaise: Math.max(0, outward.igstPaise - itc.igstPaise),
    cgstPaise: Math.max(0, outward.cgstPaise - itc.cgstPaise),
    sgstPaise: Math.max(0, outward.sgstPaise - itc.sgstPaise),
  };
  return { outward, itc, netPayable, note: 'ITC user-entered hai' };
}

/** In-range check on ISO dates ('YYYY-MM-DD'), bounds inclusive, either optional. */
function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function byDateThenNumber(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return String(a.number || '') < String(b.number || '') ? -1 : 1;
}

/** Sales register: saved invoices (+notes, signed) in a date range, sorted. */
function salesRegister(invoices, opts) {
  const o = opts || {};
  const rows = filterSaved(invoices, {})
    .filter((inv) => inRange(inv.date, o.from, o.to))
    .sort(byDateThenNumber)
    .map((inv) => ({
      date: inv.date,
      number: inv.number,
      partyName: inv.partyName,
      partyGstin: inv.partyGstin || null,
      taxablePaise: inv.totals.taxablePaise || 0,
      cgstPaise: inv.totals.cgstPaise || 0,
      sgstPaise: inv.totals.sgstPaise || 0,
      igstPaise: inv.totals.igstPaise || 0,
      totalPaise: inv.totals.roundedTotalPaise || 0,
    }));
  let totals = zeroHeads();
  let totalPaise = 0;
  for (const r of rows) {
    totals = addHeads(totals, r);
    totalPaise += r.totalPaise;
  }
  return { rows, totals: Object.assign(totals, { totalPaise, count: rows.length }) };
}

/**
 * Purchase register: ledger entries with kind 'purchase' in a date range.
 * amountPaise signed sum (returns / negative entries reduce the total).
 */
function purchaseRegister(ledgerEntries, opts) {
  const o = opts || {};
  const rows = (ledgerEntries || [])
    .filter((e) => e && e.kind === 'purchase' && inRange(e.date, o.from, o.to))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : 0))
    .map((e) => ({
      date: e.date, kind: e.kind, amountPaise: e.amountPaise || 0,
      partyId: e.partyId || null, note: e.note || '',
    }));
  let amountPaise = 0;
  for (const r of rows) amountPaise += r.amountPaise;
  return { rows, totals: { amountPaise, count: rows.length } };
}

/**
 * Reconcile own B2B invoices against portal 2B rows.
 * Match key: party GSTIN + invoice number. Sirf saved + B2B invoices.
 * mismatched: match hua par taxable ya kisi tax head me farak;
 * diffPaise = own taxable - portal taxable; taxDiffPaise = own tax - portal tax.
 */
function reconcile2A2B(ownInvoices, portal2B) {
  const own = (ownInvoices || []).filter(
    (inv) => inv && inv.status === 'saved' && inv.type === 'invoice' && inv.partyGstin
  );
  const portal = portal2B || [];
  const portalByKey = {};
  for (const p of portal) portalByKey[p.gstin + '|' + p.invoiceNumber] = p;
  const ownByKey = {};
  for (const inv of own) ownByKey[inv.partyGstin + '|' + inv.number] = inv;

  const matched = [];
  const missingInPortal = [];
  const mismatched = [];
  for (const inv of own) {
    const p = portalByKey[inv.partyGstin + '|' + inv.number];
    if (!p) { missingInPortal.push(inv); continue; }
    const ownTax = (inv.totals.igstPaise || 0) + (inv.totals.cgstPaise || 0) + (inv.totals.sgstPaise || 0);
    const portalTax = (p.igstPaise || 0) + (p.cgstPaise || 0) + (p.sgstPaise || 0);
    const diffPaise = (inv.totals.taxablePaise || 0) - (p.taxablePaise || 0);
    const taxDiffPaise = ownTax - portalTax;
    if (diffPaise !== 0 || taxDiffPaise !== 0) {
      mismatched.push({ own: inv, portal: p, diffPaise, taxDiffPaise });
    } else {
      matched.push({ own: inv, portal: p });
    }
  }
  const extraInPortal = portal.filter((p) => !ownByKey[p.gstin + '|' + p.invoiceNumber]);
  return { matched, missingInPortal, extraInPortal, mismatched };
}

/** Per-line portal items for one invoice (rupees, 2 decimals). */
function portalItems(inv, sign) {
  // sign -1 for credit notes (their totals are negated, so the items must
  // be too — otherwise itm_det won't reconcile with the note's val).
  const s = sign || 1;
  return (inv.lines || []).map((line, i) => {
    const calc = gstRep.calcLine({
      qty: line.qty,
      unitPricePaise: line.unitPricePaise,
      discountPct: line.discountPct || 0,
      taxRatePct: line.taxRatePct,
      intraState: !!inv.intraState,
    });
    return {
      num: i + 1,
      itm_det: {
        txval: s * paiseToRupees(calc.taxablePaise),
        rt: line.taxRatePct,
        iamt: s * paiseToRupees(calc.igstPaise),
        camt: s * paiseToRupees(calc.cgstPaise),
        samt: s * paiseToRupees(calc.sgstPaise),
      },
    };
  });
}

/**
 * GSTR-1 portal offline-tool jaisa JSON (amounts RUPEES, 2 decimals).
 * DRAFT — portal pe upload karke verify karein, CA pilot pending. Multi-rate
 * invoice ke items line-wise aate hain (summary me lines rakhi gayi hain).
 * Unregistered notes cdnr me ctin:null ke saath aate hain — portal ko
 * registered counterparty chahiye, upload se pehle check karein.
 */
function gstr1Json(profile, summary, opts) {
  const o = opts || {};
  const fp = o.fp || '';
  const b2b = (summary.b2b || []).map((party) => ({
    ctin: party.ctin,
    inv: party.invoices.map((inv) => ({
      inum: inv.number,
      idt: inv.date.split('-').reverse().join('/'), // DD/MM/YYYY
      val: paiseToRupees(inv.roundedTotalPaise != null ? inv.roundedTotalPaise
        : inv.taxablePaise + inv.igstPaise + inv.cgstPaise + inv.sgstPaise),
      pos: inv.buyerState,
      rchrg: 'N',
      inv_typ: 'R',
      itms: portalItems(inv),
    })),
  }));
  const b2cl = (summary.b2cl || []).map((group) => ({
    pos: group.state,
    inv: group.invoices.map((inv) => ({
      inum: inv.number,
      idt: inv.date.split('-').reverse().join('/'),
      val: paiseToRupees(inv.roundedTotalPaise != null ? inv.roundedTotalPaise
        : inv.taxablePaise + inv.igstPaise + inv.cgstPaise + inv.sgstPaise),
      itms: portalItems(inv),
    })),
  }));
  const b2cs = (summary.b2cs || []).map((b) => ({
    sply_ty: profile && profile.sellerState && b.state === profile.sellerState ? 'INTRA' : 'INTER',
    rt: b.ratePct,
    typ: 'OE',
    txval: paiseToRupees(b.taxablePaise),
    iamt: paiseToRupees(b.igstPaise),
    camt: paiseToRupees(b.cgstPaise),
    samt: paiseToRupees(b.sgstPaise),
    csamt: 0,
  }));
  const cdnrByCtin = {};
  for (const n of summary.cdnr || []) {
    const key = n.ctin || '__URP__';
    if (!cdnrByCtin[key]) cdnrByCtin[key] = { ctin: n.ctin, nt: [] };
    cdnrByCtin[key].nt.push({
      nt_num: n.noteNumber,
      nt_dt: n.date.split('-').reverse().join('/'),
      ntty: n.noteType,
      rsn: 'Others',
      val: paiseToRupees(n.roundedTotalPaise != null ? n.roundedTotalPaise : n.taxablePaise + n.taxPaise),
      itms: portalItems(n, n.noteType === 'C' ? -1 : 1),
    });
  }
  return {
    gstin: profile ? profile.gstin || null : null,
    fp,
    b2b,
    b2cl,
    b2cs,
    cdnr: Object.values(cdnrByCtin),
  };
}

/**
 * GSTR-3B portal jaisa JSON (amounts RUPEES, 2 decimals).
 * DRAFT — portal pe upload karke verify karein, CA pilot pending. Jo field
 * sure nahi ho usme guess nahi kiya: sirf outward supplies + ITC (ty 'OTH')
 * bhare hain; baaki sections zero rakhe hain — upload se pehle portal pe
 * check karein.
 */
function gstr3bJson(profile, summary3b, opts) {
  const o = opts || {};
  const out = summary3b.outward;
  const itc = summary3b.itc;
  const zero = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
  const headsRupees = (h) => ({
    txval: paiseToRupees(h.taxablePaise),
    iamt: paiseToRupees(h.igstPaise),
    camt: paiseToRupees(h.cgstPaise),
    samt: paiseToRupees(h.sgstPaise),
    csamt: 0,
  });
  return {
    gstin: profile ? profile.gstin || null : null,
    fp: o.fp || '',
    sup_details: {
      osup_det: headsRupees(out),
      osup_zero: Object.assign({}, zero),
      osup_nil_exmp: Object.assign({}, zero),
      isup_rev: Object.assign({}, zero),
      osup_nongst: Object.assign({}, zero),
    },
    itc_elg: {
      itc_avl: [{
        ty: 'OTH',
        iamt: paiseToRupees(itc.igstPaise),
        camt: paiseToRupees(itc.cgstPaise),
        samt: paiseToRupees(itc.sgstPaise),
        csamt: 0,
      }],
      itc_rev: [{ ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 }],
      itc_net: {
        iamt: paiseToRupees(itc.igstPaise),
        camt: paiseToRupees(itc.cgstPaise),
        samt: paiseToRupees(itc.sgstPaise),
        csamt: 0,
      },
      itc_inelg: [{ ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 }],
    },
  };
}

const gstRepApi = {
  B2CL_THRESHOLD_PAISE,
  paiseToRupees,
  gstr1Summary, gstr3bSummary,
  salesRegister, purchaseRegister, reconcile2A2B,
  gstr1Json, gstr3bJson,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = gstRepApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.gstReports = gstRepApi;
}
