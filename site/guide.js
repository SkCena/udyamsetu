// UdyamSetu Site — GST Guide (simple facts, clean cards).
// Only verified facts are written here. Anything that changes often
// (due dates, turnover limits) says "check the GST portal" instead of
// stating a number that may be out of date. Bodies live in i18n.js
// (guideBody1..6, English + Hindi; other languages fall back to English).
// Slabs come from the app's own GST core (0/5/12/18/28).
'use strict';

const GUIDE_SECTIONS = [
  { id: 'what', titleKey: 'guideS1Title', bodyKey: 'guideBody1' },
  { id: 'slabs', titleKey: 'guideS2Title', bodyKey: 'guideBody2' },
  { id: 'gstr', titleKey: 'guideS3Title', bodyKey: 'guideBody3' },
  { id: 'einvoice', titleKey: 'guideS4Title', bodyKey: 'guideBody4' },
  { id: 'gstr9', titleKey: 'guideS5Title', bodyKey: 'guideBody5' },
  { id: 'mistakes', titleKey: 'guideS6Title', bodyKey: 'guideBody6' },
];

const guideApi = { GUIDE_SECTIONS };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = guideApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.guide = guideApi;

  // ---------------- DOM wiring: accordion cards (browser only) ----------------
  function escGuide(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderGuide() {
    const wrap = document.getElementById('guideList');
    if (!wrap) return;
    const i18n = window.UdyamSetu.i18n;
    const lang = i18n.getLang();
    wrap.innerHTML = '';
    GUIDE_SECTIONS.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'guide-card guide-toggle';
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      const toggle = () => card.classList.toggle('collapsed');
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
      const title = i18n.t(s.titleKey, lang);
      const body = i18n.t(s.bodyKey, lang);
      card.innerHTML = '<h3>' + escGuide(title) + '</h3><p class="guide-step">' + escGuide(body) + '</p>';
      wrap.appendChild(card);
    });
  }
  guideApi.render = renderGuide;
  document.addEventListener('DOMContentLoaded', renderGuide);
}
