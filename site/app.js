// UdyamSetu Site — DOM layer only. All money math lives in core/gst.js,
// all pure invoice logic in invoice.js, all storage in store.js.
// This file only reads/writes the page.
'use strict';

(function () {
  const storeApi = window.UdyamSetu.store;
  const invApi = window.UdyamSetu.invoice;
  const store = new storeApi.Store();

  // ---------------- i18n: Language LOCK (2026-11-22) ----------------
  // Primary language is ENGLISH (default). Other Indian languages switch
  // via the language tab in the header. All strings live in site/i18n.js —
  // this file only uses them, never defines them.
  const i18nMod = window.UdyamSetu.i18n;
  let lang = i18nMod.getLang();
  function t(key) { return i18nMod.t(key, lang); }

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = i18nMod.dir(lang);
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    const sel = document.getElementById('langSelect');
    if (sel) sel.value = lang;
    // Guide cards are rendered by guide.js — re-render them in the new language.
    if (window.UdyamSetu && window.UdyamSetu.guide && window.UdyamSetu.guide.render) {
      window.UdyamSetu.guide.render();
    }
    renderLines();
    updateTaxKind();
  }

  // ---------------- theme: Light / Dark / System + colour schemes ------
  // The <head> inline script already sets data-theme + data-scheme before
  // first paint; this only wires the controls and keeps the saved choice
  // + the browser chrome colour in sync.
  const THEME_KEY = 'udyamsetu.theme';
  const THEME_MODES = ['system', 'light', 'dark'];
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function syncModeButtons(mode) {
    document.querySelectorAll('.mode-btn[data-mode]').forEach((b) =>
      b.classList.toggle('selected', b.getAttribute('data-mode') === mode));
  }
  function applyThemeMode(mode) {
    const saved = THEME_MODES.indexOf(mode) >= 0 ? mode : 'system';
    const next = saved === 'dark' ? 'dark'
      : saved === 'light' ? 'light'
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, saved); } catch (e) { /* private mode — theme still applies this session */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0F1B2E' : '#16233D');
    syncModeButtons(saved);
  }
  // Header toggle: flips explicit Light <-> Dark (System stays in About).
  function setTheme(mode) {
    applyThemeMode(mode === 'dark' ? 'dark' : 'light');
  }

  // Colour scheme: navy-gold (default) + midnight / indigo / copper /
  // amber — premium, no green. Saved, survives reload.
  const SCHEME_KEY = 'udyamsetu.scheme';
  const SCHEMES = ['navy-gold', 'midnight', 'indigo', 'copper', 'amber'];
  function currentScheme() {
    const s = document.documentElement.getAttribute('data-scheme');
    return SCHEMES.indexOf(s) >= 0 ? s : 'navy-gold';
  }
  function syncSchemeButtons(scheme) {
    document.querySelectorAll('.scheme-btn[data-scheme]').forEach((b) =>
      b.classList.toggle('selected', b.getAttribute('data-scheme') === scheme));
  }
  function setScheme(name) {
    const next = SCHEMES.indexOf(name) >= 0 ? name : 'navy-gold';
    document.documentElement.setAttribute('data-scheme', next);
    try { localStorage.setItem(SCHEME_KEY, next); } catch (e) { /* private mode */ }
    syncSchemeButtons(next);
  }

  // ---------------- helpers ----------------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function stateOptions(select, selected) {
    select.innerHTML = invApi.STATES.map((s) =>
      '<option value="' + s.code + '"' + (s.code === selected ? ' selected' : '') + '>' +
      esc(s.name) + ' (' + s.code + ')</option>').join('');
  }
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === name));
    ['home', 'setup', 'billing', 'list', 'detail', 'party', 'stock', 'gst', 'payroll', 'reports', 'calculator', 'basiccalc', 'guide', 'about'].forEach((n) => {
      $('tab-' + n).hidden = (n !== name);
    });
    if (name === 'home') renderHome();
    if (name === 'list') renderList();
    if (name === 'billing') $('setupWarn').hidden = !!(profile && profile.name);
    // Phase 1.2 tabs live in app12.js — render on show, if loaded.
    if (window.UdyamSetu && window.UdyamSetu.ui12 && window.UdyamSetu.ui12.onShow) {
      window.UdyamSetu.ui12.onShow(name);
    }
    window.scrollTo(0, 0);
  }

  // ---------------- state ----------------
  let profile = null;
  let currentLines = [];
  let editingDraftId = null;
  let noteMode = null; // null | { type: 'credit-note'|'debit-note', linked: 'INV/...' }
  let currentInvoice = null;
  let logoDataUrl = null;

  function blankLine() {
    return { name: '', hsn: '', qty: 1, price: '', discountPct: 0, taxRatePct: 18 };
  }

  // ---------------- setup ----------------
  function fillSetupForm() {
    $('bizName').value = profile.name || '';
    $('bizGstin').value = profile.gstin || '';
    $('bizPhone').value = profile.phone || '';
    $('bizAddress').value = profile.address || '';
    $('upiId').value = profile.upiId || '';
    $('invPrefix').value = profile.invoicePrefix || 'INV';
    $('nextSeq').value = profile.nextSeq || 1;
    stateOptions($('sellerState'), profile.sellerState || '21');
    logoDataUrl = profile.logoDataUrl || null;
    updateLogoPreview();
  }

  function updateLogoPreview() {
    const img = $('logoPreview');
    if (logoDataUrl) { img.src = logoDataUrl; img.hidden = false; $('logoRemove').hidden = false; }
    else { img.removeAttribute('src'); img.hidden = true; $('logoRemove').hidden = true; }
  }

  function gatherProfile() {
    const gstin = $('bizGstin').value.trim().toUpperCase();
    return {
      name: $('bizName').value.trim(),
      gstin: gstin || null,
      phone: $('bizPhone').value.trim(),
      address: $('bizAddress').value.trim(),
      logoDataUrl: logoDataUrl,
      upiId: $('upiId').value.trim(),
      invoicePrefix: $('invPrefix').value.trim().toUpperCase(),
      nextSeq: parseInt($('nextSeq').value, 10),
      sellerState: $('sellerState').value,
    };
  }

  // ---------------- billing: lines editor ----------------
  function renderLines() {
    const wrap = $('lines');
    wrap.innerHTML = '';
    currentLines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'line-row';
      row.innerHTML =
        '<input class="ln-name" type="text" placeholder="' + esc(t('itemNamePh')) + '" value="' + esc(line.name) + '">' +
        '<div class="line-grid">' +
        '<label>HSN<input class="ln-hsn" type="text" inputmode="numeric" maxlength="8" placeholder="' + esc(t('hsnPh')) + '" value="' + esc(line.hsn) + '"></label>' +
        '<label>Qty<input class="ln-qty" type="number" min="1" step="1" value="' + line.qty + '"></label>' +
        '<label>Price ₹<input class="ln-price" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(line.price) + '"></label>' +
        '<label>Disc %<input class="ln-disc" type="number" min="0" max="100" step="0.5" value="' + line.discountPct + '"></label>' +
        '<label>GST %<select class="ln-rate">' + GST_SLABS.map((r) =>
          '<option value="' + r + '"' + (r === line.taxRatePct ? ' selected' : '') + '>' + r + '%</option>').join('') + '</select></label>' +
        '</div>' +
        '<div class="line-foot"><span class="ln-amt"></span>' +
        (currentLines.length > 1 ? '<button class="ln-del" type="button" aria-label="Remove">✕</button>' : '') +
        '</div>';
      row.querySelector('.ln-name').addEventListener('input', (e) => { line.name = e.target.value; });
      row.querySelector('.ln-hsn').addEventListener('input', (e) => { line.hsn = e.target.value.trim(); });
      row.querySelector('.ln-qty').addEventListener('input', (e) => { line.qty = parseInt(e.target.value, 10) || 0; updateTotals(); });
      row.querySelector('.ln-price').addEventListener('input', (e) => { line.price = e.target.value; updateTotals(); });
      row.querySelector('.ln-disc').addEventListener('input', (e) => { line.discountPct = parseFloat(e.target.value) || 0; updateTotals(); });
      row.querySelector('.ln-rate').addEventListener('change', (e) => { line.taxRatePct = parseFloat(e.target.value); updateTotals(); });
      const del = row.querySelector('.ln-del');
      if (del) del.addEventListener('click', () => { currentLines.splice(i, 1); renderLines(); updateTotals(); });
      wrap.appendChild(row);
    });
  }

  function collectLines() {
    // Throws on a bad price so the caller can show the error.
    return currentLines
      .filter((l) => l.name.trim() || l.hsn.trim() || String(l.price).trim())
      .map((l) => ({
        name: l.name.trim(),
        hsn: l.hsn.trim(),
        qty: l.qty,
        unitPricePaise: invApi.rupeesToPaise(l.price === '' ? '0' : l.price),
        discountPct: l.discountPct || 0,
        taxRatePct: l.taxRatePct,
      }));
  }

  function intraState() {
    return profile && profile.sellerState === $('buyerState').value;
  }

  // Billing form's document type (GST bill by default). A credit/debit note
  // opened from the detail view overrides it via noteMode.
  function currentDocType() {
    const sel = $('docType');
    return sel && invApi.isDocType(sel.value) ? sel.value : 'invoice';
  }

  function updateTaxKind() {
    const intra = intraState();
    $('taxKindLabel').textContent = intra ? 'CGST + SGST' : 'IGST';
    $('rowCgst').hidden = !intra;
    $('rowSgst').hidden = !intra;
    $('rowIgst').hidden = intra;
  }

  function updateTotals() {
    updateTaxKind();
    let totals = null;
    try {
      let lines = collectLines();
      const type = noteMode ? noteMode.type : currentDocType();
      lines = invApi.applyDocTypeToLines(lines, type);
      if (lines.length) totals = invApi.buildTotals(lines, intraState());
      if (totals && type === 'credit-note') totals = invApi.negateTotals(totals);
    } catch (e) { totals = null; }
    const set = (id, v) => { $(id).textContent = v === null ? '—' : formatINR(v); };
    if (!totals) {
      set('tTaxable', null); set('tCgst', null); set('tSgst', null); set('tIgst', null);
      set('tRoundOff', null); set('tGrand', null);
      return;
    }
    set('tTaxable', totals.taxablePaise);
    set('tCgst', totals.cgstPaise);
    set('tSgst', totals.sgstPaise);
    set('tIgst', totals.igstPaise);
    set('tRoundOff', totals.roundOffPaise);
    set('tGrand', totals.roundedTotalPaise);
  }

  function gatherDraft() {
    return {
      partyName: $('partyName').value.trim(),
      partyGstin: $('partyGstin').value.trim().toUpperCase() || null,
      buyerState: $('buyerState').value,
      lines: collectLines(),
    };
  }

  function resetBillingForm() {
    editingDraftId = null;
    noteMode = null;
    const docSel = $('docType');
    if (docSel) docSel.value = 'invoice';
    $('noteBanner').hidden = true;
    $('partyName').value = '';
    $('partyGstin').value = '';
    stateOptions($('buyerState'), profile ? profile.sellerState : '21');
    currentLines = [blankLine()];
    renderLines();
    updateTotals();
    $('billingMsg').textContent = '';
    $('billingMsg').classList.remove('err');
  }

  function loadDraftIntoForm(draft) {
    editingDraftId = draft.id;
    noteMode = draft.type === 'invoice' ? null
      : { type: draft.type, linked: draft.linkedInvoiceNumber };
    if (noteMode) {
      $('noteBanner').hidden = false;
      $('noteBanner').textContent = t('noteAgainst') + noteMode.linked +
        ' — ' + (noteMode.type === 'credit-note' ? t('noteCredit') : t('noteDebit'));
    } else { $('noteBanner').hidden = true; }
    $('partyName').value = draft.partyName || '';
    $('partyGstin').value = draft.partyGstin || '';
    stateOptions($('buyerState'), draft.buyerState);
    currentLines = draft.lines.map((l) => ({
      name: l.name, hsn: l.hsn, qty: l.qty,
      price: (l.unitPricePaise / 100).toFixed(2).replace(/\.00$/, ''),
      discountPct: l.discountPct || 0, taxRatePct: l.taxRatePct,
    }));
    if (!currentLines.length) currentLines = [blankLine()];
    renderLines();
    updateTotals();
  }

  async function saveBilling(final) {
    const msg = $('billingMsg');
    msg.classList.remove('err');
    let data;
    try { data = gatherDraft(); }
    catch (e) { msg.textContent = t('billInvalid'); msg.classList.add('err'); return; }
    const draft = invApi.createInvoiceDraft({
      id: editingDraftId || undefined,
      profile,
      type: noteMode ? noteMode.type : currentDocType(),
      linkedInvoiceNumber: noteMode ? noteMode.linked : null,
      partyName: data.partyName,
      partyGstin: data.partyGstin,
      buyerState: data.buyerState,
      lines: data.lines,
      date: new Date(),
    });
    const errors = invApi.validateInvoiceDraft(draft);
    $('partyGstinError').hidden = !errors.includes('party-gstin-invalid');
    if (errors.length) { msg.textContent = t('billInvalid'); msg.classList.add('err'); return; }
    if (!final) {
      await store.saveInvoice(draft);
      msg.textContent = t('draftSaved');
      editingDraftId = draft.id;
      return;
    }
    const done = invApi.finalizeInvoice(draft, profile, new Date());
    await store.saveInvoice(done.invoice);
    await store.saveProfile(done.profile);
    // Phase 1.2: bill save hote hi stock ghatao (jo item HSN/naam se mile).
    if (window.UdyamSetu && window.UdyamSetu.ui12 && window.UdyamSetu.ui12.onInvoiceSaved) {
      try { await window.UdyamSetu.ui12.onInvoiceSaved(done.invoice); } catch (e) { /* stock hook fail != bill fail */ }
    }
    profile = done.profile;
    fillSetupForm();
    msg.textContent = t('invoiceSaved') + ' — ' + done.invoice.number;
    resetBillingForm();
    viewInvoice(done.invoice.id);
  }

  // ---------------- list + detail ----------------
  function typeBadge(inv) {
    if (inv.status === 'draft') return '<span class="badge draft">' + esc(t('draftBadge')) + '</span>';
    if (inv.type === 'credit-note') return '<span class="badge credit">' + esc(t('noteCredit')) + '</span>';
    if (inv.type === 'debit-note') return '<span class="badge debit">' + esc(t('noteDebit')) + '</span>';
    if (inv.type === 'estimate') return '<span class="badge estimate">' + esc(t('docEstimate')) + '</span>';
    if (inv.type === 'receipt') return '<span class="badge receipt">' + esc(t('docReceipt')) + '</span>';
    if (inv.type === 'non-gst') return '<span class="badge nongst">' + esc(t('docNonGst')) + '</span>';
    return '';
  }

  async function renderList() {
    const list = await store.listInvoices();
    const wrap = $('invoiceList');
    wrap.innerHTML = '';
    $('emptyList').hidden = list.length > 0;
    list.forEach((inv) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-item';
      b.innerHTML =
        '<span class="inv-top"><span>' + esc(inv.number || t('draftBadge')) + typeBadge(inv) + '</span>' +
        '<span>' + esc(formatINR(inv.totals.roundedTotalPaise)) + '</span></span>' +
        '<span class="inv-sub">' + esc(inv.date) + ' · ' + esc(inv.partyName) +
        (inv.linkedInvoiceNumber ? ' · ' + esc(t('against')) + esc(inv.linkedInvoiceNumber) : '') + '</span>';
      b.addEventListener('click', () => viewInvoice(inv.id));
      wrap.appendChild(b);
    });
  }

  // Bill template: look only — totals always come from the shared core.
  const TEMPLATE_KEY = 'udyamsetu.template';
  function currentTemplate() {
    try {
      const saved = localStorage.getItem(TEMPLATE_KEY);
      if (saved && invApi.isInvoiceTemplate(saved)) return saved;
    } catch (e) { /* storage unavailable — fall back to Classic */ }
    return 'classic';
  }
  function setTemplate(name) {
    if (!invApi.isInvoiceTemplate(name)) return;
    try { localStorage.setItem(TEMPLATE_KEY, name); } catch (e) { /* ignore */ }
    syncTemplatePicker();
    if (currentInvoice) {
      $('detailBody').innerHTML = invoiceHtml(currentInvoice, profile);
      $('print-area').innerHTML = invoiceHtml(currentInvoice, profile);
    }
  }
  function syncTemplatePicker() {
    const sel = $('tplSelect');
    if (sel) sel.value = currentTemplate();
  }

  function invoiceHtml(inv, prof) {
    const kind = inv.type === 'credit-note' ? t('noteCredit')
      : inv.type === 'debit-note' ? t('noteDebit')
      : inv.type === 'estimate' ? t('docEstimate')
      : inv.type === 'receipt' ? t('docReceipt')
      : inv.type === 'non-gst' ? t('docNonGst') : t('noteInvoice');
    return invApi.invoiceTemplateHtml(inv, prof, currentTemplate(), {
      kind, taxable: t('taxable'), roundOff: t('roundOff'),
      grandTotal: t('grandTotal'), draft: t('draftBadge'), against: t('against'),
    });
  }

  async function viewInvoice(id) {
    const inv = await store.getInvoice(id);
    if (!inv) return;
    currentInvoice = inv;
    $('detailBody').innerHTML = invoiceHtml(inv, profile);
    $('print-area').innerHTML = invoiceHtml(inv, profile);
    const urls = invApi.invoiceShareUrls(inv, profile);
    $('waShareBtn').href = urls.whatsapp;
    $('smsShareBtn').href = urls.sms;
    $('emailShareBtn').href = urls.email;
    $('tgShareBtn').href = urls.telegram;
    syncTemplatePicker();
    syncShareSheetBtn();
    const isSaved = inv.status === 'saved' && inv.number;
    $('creditNoteBtn').hidden = !isSaved;
    $('debitNoteBtn').hidden = !isSaved;
    showTab('detail');
  }

  // Web Share API exists on most phones; on a browser without it the button
  // shows the APK badge instead of failing silently.
  function syncShareSheetBtn() {
    const badge = $('sheetApkBadge');
    if (!badge) return;
    const ok = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    badge.hidden = ok;
  }

  async function copyShareText() {
    if (!currentInvoice) return;
    const text = invApi.whatsappText(currentInvoice, profile);
    const btn = $('copyShareBtn');
    const done = () => {
      if (!btn) return;
      const old = btn.textContent;
      btn.textContent = t('shareCopied');
      setTimeout(() => { btn.textContent = old; }, 2000);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      done();
    } catch (e) { /* clipboard blocked — user can still use the other share buttons */ }
  }

  function downloadInvoicePng() {
    if (!currentInvoice) return;
    const canvas = document.createElement('canvas');
    invApi.drawInvoicePng(currentInvoice, profile, canvas);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = invApi.docFileName(currentInvoice, 'png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  function downloadFile(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printInvoice(format) {
    if (!currentInvoice) return;
    document.body.setAttribute('data-print', format);
    const done = () => {
      document.body.removeAttribute('data-print');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  // ---------------- home: stats, FTU, language-first prompt ----------------
  const FTU_KEY = 'udyamsetu.ftu';

  // Home stats are best-effort — a stats failure must never break the Site.
  async function renderHome() {
    try {
      const today = todayISO(new Date());
      const invoices = await store.listInvoices();
      let salesToday = 0;
      let hasAny = false;
      invoices.forEach((inv) => {
        if (inv.status === 'saved') {
          hasAny = true;
          if (inv.date === today && inv.totals) salesToday += inv.totals.roundedTotalPaise;
        }
      });
      $('homeStatSales').textContent = formatINR(salesToday);
      let udhaar = 0;
      try {
        const partyApi = window.UdyamSetu.party;
        const parties = await store.listParties();
        const entries = await store.listLedger();
        parties.forEach((p) => { const b = partyApi.partyBalance(p, entries); if (b > 0) udhaar += b; });
      } catch (e) { /* udhaar stays 0 */ }
      $('homeStatUdhaar').textContent = formatINR(udhaar);
      let lowCount = 0;
      try {
        const invtApi = window.UdyamSetu.inventory;
        const items = await store.listItems();
        const movements = await store.listMovements();
        lowCount = invtApi.lowStock(items, movements).length;
      } catch (e) { /* stays 0 */ }
      $('homeStatLowStock').textContent = String(lowCount);
      // Guided first bill: show the 3-step card until the first bill is saved.
      $('firstBillGuide').hidden = hasAny;
    } catch (e) { /* home stats failed — site still works */ }
  }

  function loadFtu() {
    try {
      const raw = localStorage.getItem(FTU_KEY);
      if (!raw) return;
      const f = JSON.parse(raw);
      if (f.shopType) $('ftuShopType').value = f.shopType;
      if (f.gst) $('ftuGst').value = f.gst;
      if (f.sell) $('ftuSell').value = f.sell;
    } catch (e) { /* ignore — fresh FTU */ }
  }

  // Language pehle screen pe (REA §6.1): first visit par language poochho,
  // settings/header tab me chhupao mat. Choice ek baar save hote hi dobara nahi poochho.
  function showLangPromptIfNeeded() {
    const promptEl = $('langPrompt');
    if (!promptEl) return;
    if (i18nMod.hasChosenLang()) { promptEl.hidden = true; return; }
    const btnsWrap = $('langPromptBtns');
    btnsWrap.innerHTML = '';
    i18nMod.SUPPORTED_LANGS.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.native;
      if (l.code === lang) b.classList.add('selected');
      b.addEventListener('click', () => {
        lang = i18nMod.setLang(l.code);
        i18nMod.markLangChosen();
        applyLang();
        promptEl.hidden = true;
      });
      btnsWrap.appendChild(b);
    });
    promptEl.hidden = false;
  }

  // ---------------- wire up ----------------
  document.addEventListener('DOMContentLoaded', async () => {
    profile = await store.getProfile();
    fillSetupForm();
    stateOptions($('buyerState'), profile.sellerState || '21');
    currentLines = [blankLine()];
    renderLines();
    updateTotals();
    applyLang();
    loadFtu();
    renderHome();
    showLangPromptIfNeeded();
    // Theme: sync the browser chrome colour with the theme the <head>
    // script already applied, and wire the header toggle button.
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', currentTheme() === 'dark' ? '#0F1B2E' : '#16233D');
    const themeBtn = $('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
    // About: Light/Dark/System mode buttons + colour scheme swatches.
    // The saved mode/scheme are marked selected on load.
    try {
      const savedMode = localStorage.getItem(THEME_KEY);
      syncModeButtons(THEME_MODES.indexOf(savedMode) >= 0 ? savedMode : 'system');
    } catch (e) { syncModeButtons('system'); }
    syncSchemeButtons(currentScheme());
    document.querySelectorAll('.mode-btn[data-mode]').forEach((b) =>
      b.addEventListener('click', () => applyThemeMode(b.getAttribute('data-mode'))));
    document.querySelectorAll('.scheme-btn[data-scheme]').forEach((b) =>
      b.addEventListener('click', () => setScheme(b.getAttribute('data-scheme'))));
    // Star prompt (Home): dismissible — once dismissed it stays hidden.
    const starCard = $('starCard');
    const starDismissBtn = $('starDismiss');
    let starDismissed = false;
    try { starDismissed = localStorage.getItem('udyamsetu.starDismissed') === '1'; } catch (e) {}
    if (starCard) starCard.hidden = starDismissed;
    if (starDismissBtn) starDismissBtn.addEventListener('click', () => {
      try { localStorage.setItem('udyamsetu.starDismissed', '1'); } catch (e) {}
      if (starCard) starCard.hidden = true;
    });

    // Every [data-goto] element navigates on tap — including plain cards
    // like the first-bill guide (a card that looks tappable must work).
    // Non-button cards also answer Enter / Space on a keyboard.
    document.querySelectorAll('[data-goto]').forEach((b) => {
      b.addEventListener('click', () => showTab(b.getAttribute('data-goto')));
      if (b.tagName !== 'BUTTON' && b.tagName !== 'A') {
        b.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTab(b.getAttribute('data-goto')); }
        });
      }
    });
    $('langContinueBtn').addEventListener('click', () => {
      i18nMod.markLangChosen();
      $('langPrompt').hidden = true;
    });
    $('ftuForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = $('ftuMsg');
      msg.classList.remove('err');
      try {
        localStorage.setItem(FTU_KEY, JSON.stringify({
          shopType: $('ftuShopType').value,
          gst: $('ftuGst').value,
          sell: $('ftuSell').value.trim(),
        }));
        msg.textContent = t('setupSaved');
      } catch (err) {
        msg.textContent = t('setupInvalid');
        msg.classList.add('err');
      }
    });

    document.querySelectorAll('.tab').forEach((b) =>
      b.addEventListener('click', () => showTab(b.getAttribute('data-tab'))));
    const langSel = $('langSelect');
    langSel.innerHTML = i18nMod.SUPPORTED_LANGS.map((l) =>
      '<option value="' + l.code + '"' + (l.code === lang ? ' selected' : '') + '>' + esc(l.native) + '</option>').join('');
    langSel.addEventListener('change', () => { lang = i18nMod.setLang(langSel.value); applyLang(); });

    $('bizGstin').addEventListener('input', (e) => {
      const v = e.target.value.trim().toUpperCase();
      $('bizGstinError').hidden = v === '' || isValidGSTIN(v);
    });
    $('partyGstin').addEventListener('input', (e) => {
      const v = e.target.value.trim().toUpperCase();
      $('partyGstinError').hidden = v === '' || isValidGSTIN(v);
    });
    $('logoInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { logoDataUrl = reader.result; updateLogoPreview(); };
      reader.readAsDataURL(file);
    });
    $('logoRemove').addEventListener('click', () => { logoDataUrl = null; $('logoInput').value = ''; updateLogoPreview(); });

    $('setupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('setupMsg');
      msg.classList.remove('err');
      const p = gatherProfile();
      const errors = invApi.validateProfile(p);
      $('bizGstinError').hidden = !errors.includes('gstin-invalid');
      if (errors.length) { msg.textContent = t('setupInvalid'); msg.classList.add('err'); return; }
      profile = p;
      await store.saveProfile(profile);
      msg.textContent = t('setupSaved');
    });

    $('buyerState').addEventListener('change', updateTotals);
    $('docType').addEventListener('change', updateTotals);
    $('addLine').addEventListener('click', () => { currentLines.push(blankLine()); renderLines(); });
    $('billingForm').addEventListener('submit', (e) => { e.preventDefault(); saveBilling(true); });
    $('saveDraftBtn').addEventListener('click', () => saveBilling(false));
    $('clearFormBtn').addEventListener('click', resetBillingForm);

    $('backToList').addEventListener('click', () => showTab('list'));
    $('exportDocBtn').addEventListener('click', () => {
      if (!currentInvoice) return;
      downloadFile(invApi.docFileName(currentInvoice, 'doc'),
        invApi.invoiceToDocHtml(currentInvoice, profile), 'application/msword');
    });
    $('exportJsonBtn').addEventListener('click', () => {
      if (!currentInvoice) return;
      downloadFile(invApi.docFileName(currentInvoice, 'json'),
        invApi.invoiceToExportJson(currentInvoice, profile), 'application/json');
    });
    $('printA4Btn').addEventListener('click', () => printInvoice('a4'));
    $('printThermalBtn').addEventListener('click', () => printInvoice('thermal'));
    $('tplSelect').addEventListener('change', (e) => setTemplate(e.target.value));
    $('copyShareBtn').addEventListener('click', copyShareText);
    $('pdfShareBtn').addEventListener('click', () => printInvoice('a4'));
    $('pngShareBtn').addEventListener('click', downloadInvoicePng);
    $('sheetShareBtn').addEventListener('click', () => {
      if (!currentInvoice) return;
      if (navigator.share) {
        navigator.share({ title: 'UdyamSetu', text: invApi.whatsappText(currentInvoice, profile) }).catch(() => {});
      }
    });
    syncTemplatePicker();
    syncShareSheetBtn();
    $('creditNoteBtn').addEventListener('click', async () => {
      if (!currentInvoice) return;
      const note = invApi.makeNoteDraft(currentInvoice, 'credit-note', profile);
      loadDraftIntoForm(note);
      showTab('billing');
    });
    $('debitNoteBtn').addEventListener('click', async () => {
      if (!currentInvoice) return;
      const note = invApi.makeNoteDraft(currentInvoice, 'debit-note', profile);
      loadDraftIntoForm(note);
      showTab('billing');
    });

    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* file:// or no SW — site still works */ }
    }
  });
})();
