// UdyamSetu Site — e-invoice / e-way bill JSON (pure logic, no DOM, no I/O).
// JSON DRAFT ONLY — IRN/e-way bill portal/GSP se banta hai; app filing NAHI
// karta, credentials store NAHI karta. Thresholds (e-invoice Rs 5cr,
// e-way bill Rs 50k) plan me not-verified hain. Portal pe upload karke
// verify karein, CA pilot pending. Koi 'CA-ready' claim nahi.
// All money in integer paise inside; JSON amounts rupees (2 decimals).
'use strict';

let gstEi;
if (typeof module !== 'undefined' && module.exports) {
  gstEi = require('../core/gst.js');
} else {
  // Browser: core/gstEi.js loaded as a classic script before this file.
  gstEi = { calcLine };
}

/** Paise (integer) -> rupees as a 2-decimal number. */
function paiseToRupeesEi(paise) {
  return Number((paise / 100).toFixed(2));
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' (NIC / e-way bill format). */
function toDDMMYYYY(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) throw new Error('bad date: ' + isoDate);
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

/** Only a saved, type 'invoice' document may be exported. Notes are not invoices. */
function requireSavedInvoice(invoice) {
  if (!invoice) throw new Error('invoice required');
  if (invoice.type !== 'invoice') throw new Error('only type invoice can be exported, got: ' + invoice.type);
  if (invoice.status !== 'saved') throw new Error('only saved invoices can be exported, status: ' + invoice.status);
  if (!invoice.number) throw new Error('invoice has no number yet');
}

/** Per-line NIC item, with amounts in rupees (2 decimals). */
function einvoiceItems(invoice) {
  return (invoice.lines || []).map((line, i) => {
    const calc = gstEi.calcLine({
      qty: line.qty,
      unitPricePaise: line.unitPricePaise,
      discountPct: line.discountPct || 0,
      taxRatePct: line.taxRatePct,
      intraState: !!invoice.intraState,
    });
    const totAmt = paiseToRupeesEi(calc.grossPaise);
    const totItemVal = paiseToRupeesEi(calc.taxablePaise + calc.taxPaise);
    return {
      SlNo: String(i + 1),
      PrdDesc: line.name,
      IsServc: 'N',
      HsnCd: String(line.hsn),
      Qty: line.qty,
      Unit: 'PCS',
      UnitPrice: paiseToRupeesEi(line.unitPricePaise),
      TotAmt: totAmt,
      Discount: paiseToRupeesEi(calc.discountPaise),
      AssAmt: paiseToRupeesEi(calc.taxablePaise),
      GstRt: line.taxRatePct,
      IgstAmt: paiseToRupeesEi(calc.igstPaise),
      CgstAmt: paiseToRupeesEi(calc.cgstPaise),
      SgstAmt: paiseToRupeesEi(calc.sgstPaise),
      TotItemVal: totItemVal,
    };
  });
}

/**
 * NIC e-invoice schema v1.03 jaisa JSON.
 * Seller address/PIN profile se aate hain; jo profile me nahi hai wo '' /
 * null rehta hai — fake value NAHI bhari jati. Buyer GSTIN na ho to 'URP'.
 */
function einvoiceJson(invoice, profile) {
  requireSavedInvoice(invoice);
  const p = profile || {};
  const t = invoice.totals;
  return {
    version: '1.03',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: invoice.partyGstin ? 'B2B' : 'B2C',
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: invoice.number,
      Dt: toDDMMYYYY(invoice.date),
    },
    SellerDtls: {
      Gstin: p.gstin || null,
      LglNm: p.name || '',
      Addr1: p.address || '',
      Loc: p.city || '',
      Pin: p.pin != null ? p.pin : null,
      Stcd: p.sellerState || '',
    },
    BuyerDtls: {
      Gstin: invoice.partyGstin || 'URP',
      LglNm: invoice.partyName,
      Pos: invoice.buyerState,
      Addr1: '',
      Loc: '',
      Pin: null,
      Stcd: invoice.buyerState,
    },
    ItemList: einvoiceItems(invoice),
    ValDtls: {
      AssVal: paiseToRupeesEi(t.taxablePaise),
      CgstVal: paiseToRupeesEi(t.cgstPaise),
      SgstVal: paiseToRupeesEi(t.sgstPaise),
      IgstVal: paiseToRupeesEi(t.igstPaise),
      TotInvVal: paiseToRupeesEi(t.roundedTotalPaise),
      RndOffAmt: paiseToRupeesEi(t.roundOffPaise),
    },
  };
}

/**
 * E-way bill JSON (v1.0.0421 jaisa).
 * opts: {distanceKm, vehicleNo|null, transporterId|null} — jo nahi diya
 * wo null rehta hai, fake value NAHI bhari jati.
 */
function ewaybillJson(invoice, profile, opts) {
  requireSavedInvoice(invoice);
  const p = profile || {};
  const o = opts || {};
  const t = invoice.totals;
  return {
    version: '1.0.0421',
    billLists: [{
      userGstin: p.gstin || '',
      supplyType: 'O',
      subSupplyType: 1,
      docType: 'INV',
      docNo: invoice.number,
      docDate: toDDMMYYYY(invoice.date),
      fromGstin: p.gstin || '',
      fromTrdName: p.name || '',
      fromStateCode: p.sellerState || '',
      toGstin: invoice.partyGstin || 'URP',
      toTrdName: invoice.partyName,
      toStateCode: invoice.buyerState,
      totalValue: paiseToRupeesEi(t.taxablePaise),
      cgstValue: paiseToRupeesEi(t.cgstPaise),
      sgstValue: paiseToRupeesEi(t.sgstPaise),
      igstValue: paiseToRupeesEi(t.igstPaise),
      totInvValue: paiseToRupeesEi(t.roundedTotalPaise),
      transMode: '1',
      transDistance: o.distanceKm != null ? o.distanceKm : null,
      vehicleNo: o.vehicleNo || null,
      transporterId: o.transporterId || null,
      itemList: (invoice.lines || []).map((line) => {
        const calc = gstEi.calcLine({
          qty: line.qty,
          unitPricePaise: line.unitPricePaise,
          discountPct: line.discountPct || 0,
          taxRatePct: line.taxRatePct,
          intraState: !!invoice.intraState,
        });
        return {
          productName: line.name,
          productDesc: line.name,
          hsnCode: String(line.hsn),
          quantity: line.qty,
          qtyUnit: 'PCS',
          taxableAmount: paiseToRupeesEi(calc.taxablePaise),
        };
      }),
    }],
  };
}

const eiApi = { paiseToRupees: paiseToRupeesEi, einvoiceJson, ewaybillJson };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = eiApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.einvoice = eiApi;
}
