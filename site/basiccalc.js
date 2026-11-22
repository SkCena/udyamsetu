// UdyamSetu Site — Basic calculator (standalone, NOT the GST calculator).
// A small keypad calculator: + - × ÷, %, backspace, clear, big display.
// Pure state machine + small DOM wiring. No data is saved; works offline.
// State: { entry, stored, op, fresh, error, history }.
//   entry   — the number being typed / the result, as a string.
//   stored  — the left operand of a pending operation, or null.
//   op      — pending operator ('+', '-', '×', '÷'), or null.
//   fresh   — true when the next digit should start a new entry.
//   error   — true after divide-by-zero; any digit key clears it.
//   history — one line shown above the display ("12 + 3 =").
'use strict';

function basicCalcNew() {
  return { entry: '0', stored: null, op: null, fresh: true, error: false, history: '' };
}

/** Format a number for the display: no 0.1+0.2 artefacts, no long tails. */
function basicCalcFormat(n) {
  if (!isFinite(n) || isNaN(n)) return 'Error';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e12 || Math.abs(n) < 1e-9) return parseFloat(n.toExponential(6)).toString();
  return parseFloat(n.toFixed(10)).toString();
}

function basicCalcCompute(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
}

function basicCalcPress(state, key) {
  const s = {
    entry: state.entry, stored: state.stored, op: state.op,
    fresh: state.fresh, error: state.error, history: state.history,
  };
  if (key === 'C') return basicCalcNew();
  if (s.error) {
    // Any key after an error starts over (except C, handled above).
    if (key === 'back' || key === '=' || key === '%' || key === '+' || key === '-' || key === '×' || key === '÷') return s;
    const fresh = basicCalcNew();
    return basicCalcPress(fresh, key);
  }
  if ((key >= '0' && key <= '9') || key === '00' || key === '.') {
    if (s.fresh) {
      s.entry = key === '.' ? '0.' : (key === '00' ? '0' : key);
      s.fresh = false;
      s.history = '';
    } else if (key === '.') {
      if (s.entry.indexOf('.') < 0) s.entry += '.';
    } else if (key === '00') {
      if (s.entry !== '0' && s.entry.replace(/[^0-9]/g, '').length < 12) s.entry += '00';
    } else {
      if (s.entry === '0') {
        s.entry = key;
      } else if (s.entry.replace(/[^0-9]/g, '').length < 12) {
        s.entry += key;
      }
    }
    return s;
  }
  if (key === 'back') {
    if (s.fresh) return s;
    s.entry = s.entry.length > 1 ? s.entry.slice(0, -1) : '0';
    if (s.entry === '-' || s.entry === '') s.entry = '0';
    return s;
  }
  if (key === '%') {
    const v = parseFloat(s.entry) / 100;
    s.entry = basicCalcFormat(v);
    s.fresh = true;
    return s;
  }
  if (key === '+' || key === '-' || key === '×' || key === '÷') {
    const current = parseFloat(s.entry);
    if (s.op !== null && s.stored !== null && !s.fresh) {
      const result = basicCalcCompute(s.stored, s.op, current);
      if (!isFinite(result) || isNaN(result)) {
        s.entry = 'Error'; s.error = true; s.stored = null; s.op = null; s.fresh = true; s.history = '';
        return s;
      }
      s.stored = result;
      s.entry = basicCalcFormat(result);
    } else {
      s.stored = current;
    }
    s.op = key;
    s.fresh = true;
    s.history = basicCalcFormat(s.stored) + ' ' + key;
    return s;
  }
  if (key === '=') {
    if (s.op === null || s.stored === null) return s;
    const current = parseFloat(s.entry);
    const result = basicCalcCompute(s.stored, s.op, current);
    if (!isFinite(result) || isNaN(result)) {
      s.entry = 'Error'; s.error = true; s.stored = null; s.op = null; s.fresh = true; s.history = '';
      return s;
    }
    s.history = basicCalcFormat(s.stored) + ' ' + s.op + ' ' + basicCalcFormat(current) + ' =';
    s.entry = basicCalcFormat(result);
    s.stored = null;
    s.op = null;
    s.fresh = true;
    return s;
  }
  return s;
}

const basicCalcApi = { basicCalcNew, basicCalcPress, basicCalcFormat };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = basicCalcApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.basicCalc = basicCalcApi;

  // ---------------- DOM wiring (browser only) ----------------
  document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('basicCalcDisplay');
    const historyEl = document.getElementById('basicCalcHistory');
    if (!display) return;
    let state = basicCalcNew();
    const render = () => {
      display.textContent = state.entry;
      if (historyEl) historyEl.textContent = state.history;
    };
    document.querySelectorAll('.calc-key').forEach((btn) => {
      btn.addEventListener('click', () => {
        state = basicCalcPress(state, btn.getAttribute('data-key'));
        render();
      });
    });
    render();
  });
}
