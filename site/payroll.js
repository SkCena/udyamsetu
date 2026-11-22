// UdyamSetu Site — Payroll-lite pure logic (no DOM, no I/O, no storage).
// All money in integer paise. Pure functions only.
//
// PF/ESI/PT/TDS rates user + CA se confirm karein — app koi statutory rate
// assume NAHI karta. PF/ESI percentages user-configured hain (default 0);
// PT aur TDS user-entered monthly amounts hain (default 0). Koi bhi rate
// is file me hardcode nahi hai — galat statutory assumption se galat
// payslip banne se behtar hai ki user/CA khud rate daalein.
//
// Pro-rata: gross = monthlySalary * presentDays / totalDays, half-up paise.
// PF/ESI pro-rata gross par lagte hain. PT/TDS jaise user ne enter kiye
// waise hi liye jaate hain (pro-rata nahi — user/CA decide karein).
// Deductions kabhi gross se zyada nahi ho sakte — zyada hon to throw.
'use strict';

function isNonNegInt(v) {
  return Number.isInteger(v) && v >= 0;
}

function isPosInt(v) {
  return Number.isInteger(v) && v > 0;
}

/** Round half-up for non-negative integers: round(n/d). */
function roundDivPay(n, d) {
  if (n < 0) throw new Error('roundDivPay: negative input');
  return Math.floor((n * 2 + d) / (2 * d));
}

/** Percent (e.g. 12 or 12.5) ko basis points me badlo, phir round half-up. */
function pctOf(amountPaise, pct) {
  const bps = Math.round(pct * 100);
  return roundDivPay(amountPaise * bps, 10000);
}

/** 'YYYY-MM' format check. */
function isMonthStr(s) {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return false;
  const month = parseInt(m[2], 10);
  return month >= 1 && month <= 12;
}

function todayISODate() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/** Format paise as plain rupees with 2 decimals, e.g. 23600 -> "236.00". */
function rupees2dp(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}

/**
 * Validate an Employee. Returns an array of error codes (empty = ok).
 * Missing pfPct/esiPct/ptPaise/tdsPaise are treated as 0 (user-configured,
 * koi statutory default nahi).
 */
function validateEmployee(e) {
  const errors = [];
  if (!e || typeof e.id !== 'string' || !e.id.trim()) errors.push('id-required');
  if (!e || typeof e.name !== 'string' || !e.name.trim()) errors.push('name-required');
  if (!e || !isNonNegInt(e.monthlySalaryPaise)) errors.push('salary-invalid');
  if (e && e.pfPct !== undefined && (typeof e.pfPct !== 'number' || e.pfPct < 0 || e.pfPct > 100)) errors.push('pf-invalid');
  if (e && e.esiPct !== undefined && (typeof e.esiPct !== 'number' || e.esiPct < 0 || e.esiPct > 100)) errors.push('esi-invalid');
  if (e && e.ptPaise !== undefined && !isNonNegInt(e.ptPaise)) errors.push('pt-invalid');
  if (e && e.tdsPaise !== undefined && !isNonNegInt(e.tdsPaise)) errors.push('tds-invalid');
  return errors;
}

/**
 * Validate Attendance. Returns an array of error codes (empty = ok).
 * presentDays 0..totalDays, totalDays 1..31.
 */
function validateAttendance(a) {
  const errors = [];
  if (!a || typeof a.employeeId !== 'string' || !a.employeeId.trim()) errors.push('employee-required');
  if (!a || !isMonthStr(a.month)) errors.push('month-invalid');
  if (!a || !Number.isInteger(a.totalDays) || a.totalDays < 1 || a.totalDays > 31) errors.push('totaldays-invalid');
  if (!a || !Number.isInteger(a.presentDays) || a.presentDays < 0) errors.push('presentdays-invalid');
  if (a && Number.isInteger(a.presentDays) && Number.isInteger(a.totalDays) && a.presentDays > a.totalDays) errors.push('present-exceeds-total');
  return errors;
}

function pctOrZero(v) {
  return v === undefined || v === null ? 0 : v;
}

function paiseOrZero(v) {
  return v === undefined || v === null ? 0 : v;
}

/**
 * Payslip banao. opts: {advancePaise=0, otherDeductionPaise=0,
 * otherDeductionNote=''}.
 * Throws: invalid employee/attendance, negative advance/other deduction,
 * ya total deductions > gross.
 */
function calcPayslip(employee, attendance, opts) {
  const empErrors = validateEmployee(employee);
  if (empErrors.length) throw new Error('invalid employee: ' + empErrors.join(','));
  const attErrors = validateAttendance(attendance);
  if (attErrors.length) throw new Error('invalid attendance: ' + attErrors.join(','));
  if (attendance.employeeId !== employee.id) throw new Error('attendance employee mismatch');
  const o = opts || {};
  const advancePaise = paiseOrZero(o.advancePaise);
  const otherDeductionPaise = paiseOrZero(o.otherDeductionPaise);
  const otherDeductionNote = o.otherDeductionNote || '';
  if (!isNonNegInt(advancePaise)) throw new Error('advancePaise must be a non-negative integer');
  if (!isNonNegInt(otherDeductionPaise)) throw new Error('otherDeductionPaise must be a non-negative integer');

  const grossPaise = roundDivPay(employee.monthlySalaryPaise * attendance.presentDays, attendance.totalDays);
  const pfPaise = pctOf(grossPaise, pctOrZero(employee.pfPct));
  const esiPaise = pctOf(grossPaise, pctOrZero(employee.esiPct));
  const ptPaise = paiseOrZero(employee.ptPaise);
  const tdsPaise = paiseOrZero(employee.tdsPaise);
  const totalDeductionsPaise = pfPaise + esiPaise + ptPaise + tdsPaise + advancePaise + otherDeductionPaise;
  if (totalDeductionsPaise > grossPaise) throw new Error('deductions exceed gross salary');
  return {
    employeeId: employee.id,
    month: attendance.month,
    grossPaise,
    pfPaise,
    esiPaise,
    ptPaise,
    tdsPaise,
    advancePaise,
    otherDeductionPaise,
    otherDeductionNote,
    totalDeductionsPaise,
    netPaise: grossPaise - totalDeductionsPaise,
  };
}

/**
 * Salary advance ka record — sirf shape + validate, koi storage nahi.
 * Ledger jaisa plain object; store karna caller ka kaam hai.
 * date = aaj ki date (YYYY-MM-DD).
 */
function recordAdvance(employeeId, month, amountPaise) {
  if (typeof employeeId !== 'string' || !employeeId.trim()) throw new Error('employeeId required');
  if (!isMonthStr(month)) throw new Error('month must be YYYY-MM');
  if (!isPosInt(amountPaise)) throw new Error('amountPaise must be a positive integer');
  return { employeeId, month, amountPaise, date: todayISODate() };
}

const PAYSLIP_LABELS = {
  en: {
    title: 'Payslip', gross: 'Gross Salary', pf: 'PF', esi: 'ESI', pt: 'Professional Tax',
    tds: 'TDS', advance: 'Salary Advance', other: 'Other Deduction', totalDed: 'Total Deductions',
    net: 'Net Salary', month: 'Month', footer: '— via UdyamSetu',
  },
  hi: {
    title: 'Vetan Parchi', gross: 'Kul Vetan', pf: 'PF', esi: 'ESI', pt: 'Professional Tax',
    tds: 'TDS', advance: 'Vetan Agrim (Advance)', other: 'Anya Katauti', totalDed: 'Kul Katauti',
    net: 'Shuddh Vetan (Net)', month: 'Mahina', footer: '— UdyamSetu se',
  },
};

/**
 * Print/WhatsApp ke liye plain-text payslip.
 * lang: 'hi' (Roman Hindi labels) ya 'en'. Har deduction alag line par.
 * Note: ye sirf ek payslip text hai — statutory payslip format nahi;
 * PF/ESI/PT/TDS rates user + CA se confirm karein.
 */
function payslipText(payslip, employee, lang) {
  const L = PAYSLIP_LABELS[lang === 'en' ? 'en' : 'hi'];
  const name = (employee && employee.name) || payslip.employeeId;
  const lines = [
    L.title + ' — ' + name,
    L.month + ': ' + payslip.month,
    L.gross + ': Rs ' + rupees2dp(payslip.grossPaise),
    L.pf + ': Rs ' + rupees2dp(payslip.pfPaise),
    L.esi + ': Rs ' + rupees2dp(payslip.esiPaise),
    L.pt + ': Rs ' + rupees2dp(payslip.ptPaise),
    L.tds + ': Rs ' + rupees2dp(payslip.tdsPaise),
    L.advance + ': Rs ' + rupees2dp(payslip.advancePaise),
  ];
  if (payslip.otherDeductionPaise) {
    const note = payslip.otherDeductionNote ? ' (' + payslip.otherDeductionNote + ')' : '';
    lines.push(L.other + note + ': Rs ' + rupees2dp(payslip.otherDeductionPaise));
  }
  lines.push(L.totalDed + ': Rs ' + rupees2dp(payslip.totalDeductionsPaise));
  lines.push(L.net + ': Rs ' + rupees2dp(payslip.netPaise));
  lines.push(L.footer);
  return lines.join('\n');
}

const payApi = {
  validateEmployee, validateAttendance, calcPayslip, recordAdvance,
  payslipText, rupees2dp, roundDiv: roundDivPay, isMonthStr,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = payApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.payroll = payApi;
}
