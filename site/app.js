// UdyamSetu Site — DOM layer only. All money math lives in core/gst.js,
// all pure invoice logic in invoice.js, all storage in store.js.
// This file only reads/writes the page.
'use strict';

(function () {
  const storeApi = window.UdyamSetu.store;
  const invApi = window.UdyamSetu.invoice;
  const store = new storeApi.Store();

  // ---------------- i18n: Hindi first, English toggle ----------------
  const I18N = {
    hi: {
      tagline: 'Chhoti dukaan ka GST billing — free, offline',
      tabSetup: 'Setup', tabBilling: 'Naya Bill', tabList: 'Bill List',
      setupTitle: 'Vyavsay Setup — Business Setup',
      setupHint: 'Ek baar bhar dein — har bill par yehi details aayengi. Badal bhi sakte hain.',
      bizName: 'Dukaan / Business ka naam *', bizNamePh: 'Jaise: Sharma Kirana Store',
      bizGstin: 'GSTIN (agar hai — optional)', bizGstinPh: '22AAAAA0000A1Z5',
      bizPhone: 'Phone (optional)', bizAddress: 'Pata / Address', bizAddressPh: 'Dukaan ka pata',
      logoLabel: 'Logo (optional)', logoRemove: 'Logo hatayein',
      upiLabel: 'UPI ID (payment ke liye, optional)',
      invPrefix: 'Bill series prefix', nextSeq: 'Agla bill number',
      sellerState: 'Aapka rajya / State (seller)',
      saveSetup: 'Setup Save Karein', setupSaved: 'Setup save ho gaya ✓',
      setupInvalid: 'Kuch galat hai — laal wale field check karein.',
      gstinError: 'GSTIN galat hai — 15 character, sahi format mein likhein.',
      billingTitle: 'Naya Bill — New Invoice',
      setupWarn: 'Pehle Setup mein dukaan ka naam bharein — phir bill banega.',
      partyName: 'Graahak / Party ka naam *', partyNamePh: 'Jaise: Ramesh Kumar',
      partyGstin: 'Party GSTIN (optional)',
      buyerState: 'Graahak ka rajya / State (buyer)',
      taxKind: 'Tax:', linesTitle: 'Samaan — Items', addLine: '+ Item jodein',
      taxable: 'Taxable', roundOff: 'Round off', grandTotal: 'Kul Total',
      saveDraft: 'Draft Save', saveInvoice: 'Bill Save Karein', clearForm: 'Form saaf karein',
      draftSaved: 'Draft save ho gaya ✓ (number abhi nahi laga)',
      invoiceSaved: 'Bill save ho gaya ✓',
      billInvalid: 'Bill mein kuch galat hai — check karein.',
      listTitle: 'Bill List — Saved Bills',
      listHint: 'Bill par tap karein — dekhein, print karein, WhatsApp par bhejein.',
      noInvoices: 'Abhi koi bill nahi hai. Pehla bill "Naya Bill" se banayein.',
      backToList: '← Bill List',
      printA4: 'Print — A4', printThermal: 'Print — 80mm',
      whatsapp: 'WhatsApp par bhejein',
      creditNote: 'Credit Note banayein', debitNote: 'Debit Note banayein',
      noteHint: 'Credit Note = wapas / kami (negative). Debit Note = extra charge (positive). Dono purane bill se judte hain.',
      footer: 'UdyamSetu — free, offline, aapka data aapke phone par hi rehta hai.',
      itemNamePh: 'Item ka naam', hsnPh: 'HSN (4/6/8 digit)',
      noteAgainst: 'Note ban raha hai — bill ',
      noteCredit: 'Credit Note', noteDebit: 'Debit Note', noteInvoice: 'Bill',
      draftBadge: 'DRAFT', against: 'Bill: ',
      savedInvoices: 'bills',
    },
    en: {
      tagline: 'GST billing for small shops — free, offline',
      tabSetup: 'Setup', tabBilling: 'New Bill', tabList: 'Bill List',
      setupTitle: 'Business Setup',
      setupHint: 'Fill once — these details appear on every bill. You can change them later.',
      bizName: 'Shop / Business name *', bizNamePh: 'e.g. Sharma Kirana Store',
      bizGstin: 'GSTIN (if you have one — optional)', bizGstinPh: '22AAAAA0000A1Z5',
      bizPhone: 'Phone (optional)', bizAddress: 'Address', bizAddressPh: 'Shop address',
      logoLabel: 'Logo (optional)', logoRemove: 'Remove logo',
      upiLabel: 'UPI ID (for payment, optional)',
      invPrefix: 'Bill series prefix', nextSeq: 'Next bill number',
      sellerState: 'Your state (seller)',
      saveSetup: 'Save Setup', setupSaved: 'Setup saved ✓',
      setupInvalid: 'Something is wrong — check the marked fields.',
      gstinError: 'GSTIN is wrong — 15 characters, correct format.',
      billingTitle: 'New Bill — Invoice',
      setupWarn: 'First fill the shop name in Setup — then make a bill.',
      partyName: 'Customer / Party name *', partyNamePh: 'e.g. Ramesh Kumar',
      partyGstin: 'Party GSTIN (optional)',
      buyerState: 'Customer state (buyer)',
      taxKind: 'Tax:', linesTitle: 'Items', addLine: '+ Add item',
      taxable: 'Taxable', roundOff: 'Round off', grandTotal: 'Grand Total',
      saveDraft: 'Save Draft', saveInvoice: 'Save Bill', clearForm: 'Clear form',
      draftSaved: 'Draft saved ✓ (no number yet)',
      invoiceSaved: 'Bill saved ✓',
      billInvalid: 'Something is wrong in the bill — please check.',
      listTitle: 'Bill List — Saved Bills',
      listHint: 'Tap a bill to view, print or share it on WhatsApp.',
      noInvoices: 'No bills yet. Make the first one from "New Bill".',
      backToList: '← Bill List',
      printA4: 'Print — A4', printThermal: 'Print — 80mm',
      whatsapp: 'Share on WhatsApp',
      creditNote: 'Make Credit Note', debitNote: 'Make Debit Note',
      noteHint: 'Credit Note = return / reduction (negative). Debit Note = extra charge (positive). Both link to the old bill.',
      footer: 'UdyamSetu — free, offline, your data stays on your phone.',
      itemNamePh: 'Item name', hsnPh: 'HSN (4/6/8 digits)',
      noteAgainst: 'Making a note against bill ',
      noteCredit: 'Credit Note', noteDebit: 'Debit Note', noteInvoice: 'Invoice',
      draftBadge: 'DRAFT', against: 'Against: ',
      savedInvoices: 'bills',
    },
  };
  let lang = 'hi';
  try { lang = localStorage.getItem('udyamsetu.lang') || 'hi'; } catch (e) { /* ignore */ }
  function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    const toggle = document.getElementById('langToggle');
    toggle.textContent = lang === 'hi' ? 'English' : 'हिंदी';
    try { localStorage.setItem('udyamsetu.lang', lang); } catch (e) { /* ignore */ }
    renderLines();
    updateTaxKind();
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
    ['setup', 'billing', 'list', 'detail'].forEach((n) => {
      $('tab-' + n).hidden = (n !== name);
    });
    if (name === 'list') renderList();
    if (name === 'billing') $('setupWarn').hidden = !!(profile && profile.name);
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
      const lines = collectLines();
      if (lines.length) totals = invApi.buildTotals(lines, intraState());
      if (totals && noteMode && noteMode.type === 'credit-note') totals = invApi.negateTotals(totals);
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
      type: noteMode ? noteMode.type : 'invoice',
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

  function invoiceHtml(inv, prof) {
    const kind = inv.type === 'credit-note' ? t('noteCredit')
      : inv.type === 'debit-note' ? t('noteDebit') : t('noteInvoice');
    const rows = inv.lines.map((l, i) => {
      const calc = { qty: l.qty, unitPricePaise: l.unitPricePaise, discountPct: l.discountPct || 0, taxRatePct: l.taxRatePct, intraState: inv.intraState };
      let lineTotal;
      try { lineTotal = calcLine(calc); } catch (e) { lineTotal = null; }
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.hsn) + '</td>' +
        '<td class="num">' + l.qty + '</td><td class="num">' + esc(formatINR(l.unitPricePaise)) + '</td>' +
        '<td class="num">' + (l.discountPct || 0) + '%</td><td class="num">' + l.taxRatePct + '%</td>' +
        '<td class="num">' + (lineTotal ? esc(formatINR(lineTotal.taxablePaise)) : '—') + '</td></tr>';
    }).join('');
    const tot = inv.totals;
    return '<div class="doc-head"><div><h3>' + esc(prof.name || 'UdyamSetu') + '</h3>' +
      '<div class="doc-meta">' +
      (prof.gstin ? 'GSTIN: ' + esc(prof.gstin) + '<br>' : '') +
      (prof.address ? esc(prof.address) + '<br>' : '') +
      (prof.phone ? 'Phone: ' + esc(prof.phone) + '<br>' : '') +
      '</div></div>' +
      (prof.logoDataUrl ? '<img src="' + esc(prof.logoDataUrl) + '" alt="logo">' : '') +
      '</div>' +
      '<h3>' + esc(kind) + (inv.status === 'draft' ? ' (' + esc(t('draftBadge')) + ')' : '') + '</h3>' +
      '<div class="doc-meta">' +
      (inv.number ? 'No: <strong>' + esc(inv.number) + '</strong><br>' : '') +
      'Date: ' + esc(inv.date) +
      (inv.fy ? ' · FY ' + esc(inv.fy) : '') + '<br>' +
      'Party: <strong>' + esc(inv.partyName) + '</strong><br>' +
      (inv.partyGstin ? 'Party GSTIN: ' + esc(inv.partyGstin) + '<br>' : '') +
      'Buyer state: ' + esc(invApi.stateName(inv.buyerState)) +
      ' · ' + (inv.intraState ? 'CGST + SGST' : 'IGST') + '<br>' +
      (inv.linkedInvoiceNumber ? esc(t('against')) + esc(inv.linkedInvoiceNumber) + '<br>' : '') +
      '</div>' +
      '<table class="doc-table"><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="num">Qty</th>' +
      '<th class="num">Rate</th><th class="num">Disc</th><th class="num">GST</th><th class="num">Taxable</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="doc-totals">' +
      '<div class="trow"><span>' + esc(t('taxable')) + '</span><strong>' + esc(formatINR(tot.taxablePaise)) + '</strong></div>' +
      (inv.intraState
        ? '<div class="trow"><span>CGST</span><strong>' + esc(formatINR(tot.cgstPaise)) + '</strong></div>' +
          '<div class="trow"><span>SGST</span><strong>' + esc(formatINR(tot.sgstPaise)) + '</strong></div>'
        : '<div class="trow"><span>IGST</span><strong>' + esc(formatINR(tot.igstPaise)) + '</strong></div>') +
      '<div class="trow"><span>' + esc(t('roundOff')) + '</span><strong>' + esc(formatINR(tot.roundOffPaise)) + '</strong></div>' +
      '<div class="trow grand"><span>' + esc(t('grandTotal')) + '</span><strong>' + esc(formatINR(tot.roundedTotalPaise)) + '</strong></div>' +
      '</div>' +
      (prof.upiId ? '<p class="doc-meta">Pay via UPI: ' + esc(prof.upiId) + '</p>' : '');
  }

  async function viewInvoice(id) {
    const inv = await store.getInvoice(id);
    if (!inv) return;
    currentInvoice = inv;
    $('detailBody').innerHTML = invoiceHtml(inv, profile);
    $('print-area').innerHTML = invoiceHtml(inv, profile);
    $('waShareBtn').href = invApi.whatsappUrl(inv, profile);
    const isSaved = inv.status === 'saved' && inv.number;
    $('creditNoteBtn').hidden = !isSaved;
    $('debitNoteBtn').hidden = !isSaved;
    showTab('detail');
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

  // ---------------- wire up ----------------
  document.addEventListener('DOMContentLoaded', async () => {
    profile = await store.getProfile();
    fillSetupForm();
    stateOptions($('buyerState'), profile.sellerState || '21');
    currentLines = [blankLine()];
    renderLines();
    updateTotals();
    applyLang();

    document.querySelectorAll('.tab').forEach((b) =>
      b.addEventListener('click', () => showTab(b.getAttribute('data-tab'))));
    $('langToggle').addEventListener('click', () => { lang = lang === 'hi' ? 'en' : 'hi'; applyLang(); });

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
    $('addLine').addEventListener('click', () => { currentLines.push(blankLine()); renderLines(); });
    $('billingForm').addEventListener('submit', (e) => { e.preventDefault(); saveBilling(true); });
    $('saveDraftBtn').addEventListener('click', () => saveBilling(false));
    $('clearFormBtn').addEventListener('click', resetBillingForm);

    $('backToList').addEventListener('click', () => showTab('list'));
    $('printA4Btn').addEventListener('click', () => printInvoice('a4'));
    $('printThermalBtn').addEventListener('click', () => printInvoice('thermal'));
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
