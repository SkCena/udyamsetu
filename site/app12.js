// UdyamSetu Site — Phase 1.2 DOM layer (Party, Stock, GST, Payroll, Reports).
// Pure logic lives in party.js / inventory.js / gst-reports.js / einvoice.js /
// payroll.js / reports.js; this file only reads/writes the page.
// Sign convention (party.js): balance POSITIVE = party ko dena hai
// (receivable), NEGATIVE = humko dena hai (payable). Entry form me user
// hamesha POSITIVE rashi bharta hai — sign kind + party type se lagta hai.
'use strict';

(function () {
  const storeApi = window.UdyamSetu.store;
  const invApi = window.UdyamSetu.invoice;
  const partyApi = window.UdyamSetu.party;
  const invtApi = window.UdyamSetu.inventory;
  const gstRep = window.UdyamSetu.gstReports;
  const eiApi = window.UdyamSetu.einvoice;
  const payApi = window.UdyamSetu.payroll;
  const repApi = window.UdyamSetu.reports;
  const store = new storeApi.Store();

  let profile = null;
  let selectedPartyId = null;
  let selectedEmpId = null;
  let lastPayslipText = null;
  let lastGstr1 = null, lastGstr3b = null, lastFp = '';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function monthNow() { return todayISO().slice(0, 7); }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function parseRupees(str) {
    try { return invApi.rupeesToPaise(str); } catch (e) { return null; }
  }
  function stateOptions(select, selected) {
    select.innerHTML = invApi.STATES.map((s) =>
      '<option value="' + s.code + '"' + (s.code === selected ? ' selected' : '') + '>' +
      esc(s.name) + ' (' + s.code + ')</option>').join('');
  }
  function setMsg(id, text, isErr) {
    const el = $(id);
    el.textContent = text;
    el.classList.toggle('err', !!isErr);
  }

  // ---------------- PARTY / UDHAAR ----------------
  function entryKindsFor(type) {
    if (type === 'supplier') {
      return [
        { v: 'purchase', label: 'Purchase (udhaar) — dena badhega' },
        { v: 'payment', label: 'Payment diya — dena ghatega' },
        { v: 'adjustment', label: 'Adjustment' },
      ];
    }
    return [
      { v: 'udhaar', label: 'Udhaar diya — lena badhega' },
      { v: 'payment', label: 'Payment mila — lena ghatega' },
      { v: 'adjustment', label: 'Adjustment' },
    ];
  }
  /** User ki positive rashi -> ledger sign (party.js convention). */
  function signedAmount(party, kind, amountPaise) {
    if (kind === 'payment') return party.type === 'supplier' ? amountPaise : -amountPaise;
    if (kind === 'purchase') return -amountPaise;
    return amountPaise; // udhaar / adjustment: balance badhta hai
  }

  async function renderParties() {
    const parties = await store.listParties();
    const entries = await store.listLedger();
    const wrap = $('partyList');
    wrap.innerHTML = '';
    parties.forEach((p) => {
      const bal = partyApi.partyBalance(p, entries);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-item';
      b.innerHTML = '<span class="inv-top"><span>' + esc(p.name) +
        ' <span class="badge">' + esc(p.type === 'supplier' ? 'Supplier' : 'Customer') + '</span></span>' +
        '<span>' + esc(formatINR(bal)) + '</span></span>' +
        '<span class="inv-sub">' + (bal > 0 ? 'Lena hai' : bal < 0 ? 'Dena hai' : 'Clear') +
        (p.phone ? ' · ' + esc(p.phone) : '') + '</span>';
      b.addEventListener('click', () => selectParty(p.id));
      wrap.appendChild(b);
    });
    // Due reminders.
    const dues = partyApi.dueReminders(parties, entries, todayISO());
    const dueWrap = $('dueList');
    dueWrap.innerHTML = '';
    if (!dues.length) dueWrap.innerHTML = '<p class="hint">Koi udhaar baki nahi hai. Sab clear hai ✓</p>';
    dues.forEach((d) => {
      const text = partyApi.reminderText(d.party, d.balancePaise);
      const row = document.createElement('div');
      row.className = 'inv-item';
      row.innerHTML = '<span class="inv-top"><span>' + esc(d.party.name) + '</span>' +
        '<span>' + esc(formatINR(d.balancePaise)) + '</span></span>' +
        '<span class="inv-sub">' + (d.daysDue !== null ? d.daysDue + ' din se baki' : 'Opening balance') + '</span>' +
        '<div class="btn-row"><a class="btn btn-whatsapp" href="https://wa.me/?text=' +
        encodeURIComponent(text) + '" target="_blank" rel="noopener">WhatsApp Reminder</a></div>';
      // The whole row opens the party (tap anywhere except the WhatsApp link).
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      const openParty = (e) => { if (e.target && e.target.closest && e.target.closest('a')) return; selectParty(d.party.id); };
      row.addEventListener('click', openParty);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectParty(d.party.id); } });
      dueWrap.appendChild(row);
    });
  }

  async function selectParty(id) {
    selectedPartyId = id;
    const party = await store.getParty(id);
    if (!party) return;
    const entries = await store.listLedger();
    const st = partyApi.statement(party, entries);
    $('partyDetail').hidden = false;
    $('pdName').textContent = party.name + ' — Balance: ' + formatINR(st.closingPaise);
    const rows = st.rows.map((e) =>
      '<tr><td>' + esc(e.date) + '</td><td>' + esc(e.kind) + '</td><td>' + esc(e.note || '') + '</td>' +
      '<td class="num">' + esc(formatINR(e.amountPaise)) + '</td>' +
      '<td class="num">' + esc(formatINR(e.runningBalancePaise)) + '</td></tr>').join('');
    $('pdStatement').innerHTML =
      '<p class="doc-meta">Opening: ' + esc(formatINR(st.openingPaise)) +
      ' · Closing: <strong>' + esc(formatINR(st.closingPaise)) + '</strong></p>' +
      (st.rows.length
        ? '<table class="doc-table"><thead><tr><th>Date</th><th>Kind</th><th>Note</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p class="hint">Abhi koi entry nahi hai.</p>');
    const kindSel = $('eKind');
    kindSel.innerHTML = entryKindsFor(party.type).map((k) =>
      '<option value="' + k.v + '">' + esc(k.label) + '</option>').join('');
    $('eDate').value = todayISO();
  }

  async function saveParty(e) {
    e.preventDefault();
    const openingAmt = parseRupees($('pOpening').value || '0');
    if (openingAmt === null) { setMsg('partyMsg', 'Opening balance galat hai — sahi rashi likhein.', true); return; }
    const dir = $('pOpeningDir').value;
    const opening = dir === 'receivable' ? openingAmt : dir === 'payable' ? -openingAmt : 0;
    const party = {
      id: partyApi.newId('pty'),
      name: $('pName').value.trim(),
      type: $('pType').value,
      phone: $('pPhone').value.trim(),
      gstin: $('pGstin').value.trim().toUpperCase() || null,
      state: $('pState').value,
      openingBalancePaise: opening,
    };
    const errors = partyApi.validateParty(party);
    if (errors.length) { setMsg('partyMsg', 'Kuch galat hai: ' + errors.join(', '), true); return; }
    await store.saveParty(party);
    setMsg('partyMsg', 'Party save ho gaya ✓');
    $('partyForm').reset();
    $('pOpening').value = '0';
    await renderParties();
  }

  async function saveEntry(e) {
    e.preventDefault();
    const party = await store.getParty(selectedPartyId);
    if (!party) return;
    const amt = parseRupees($('eAmount').value);
    if (amt === null || amt <= 0) { setMsg('entryMsg', 'Rashi galat hai — 0 se zyada likhein.', true); return; }
    const kind = $('eKind').value;
    const entry = {
      id: partyApi.newId('led'),
      partyId: party.id,
      date: $('eDate').value || todayISO(),
      kind,
      amountPaise: signedAmount(party, kind, amt),
      note: $('eNote').value.trim(),
      linkedInvoiceNumber: $('eLinked').value.trim() || null,
    };
    const errors = partyApi.validateEntry(entry);
    if (errors.length) { setMsg('entryMsg', 'Kuch galat hai: ' + errors.join(', '), true); return; }
    await store.saveLedgerEntry(entry);
    setMsg('entryMsg', 'Entry jud gayi ✓');
    $('entryForm').reset();
    $('eDate').value = todayISO();
    await renderParties();
    await selectParty(party.id);
  }

  // ---------------- STOCK ----------------
  function rateOptions(select, selected) {
    select.innerHTML = GST_SLABS.map((r) =>
      '<option value="' + r + '"' + (r === selected ? ' selected' : '') + '>' + r + '%</option>').join('');
  }
  function fillItemSelects() {
    return store.listItems().then((items) => {
      const opts = items.map((it) => '<option value="' + esc(it.id) + '">' + esc(it.name) + '</option>').join('');
      ['mItem', 'bItem'].forEach((id) => { $(id).innerHTML = opts; });
    });
  }

  async function renderStock() {
    const items = await store.listItems();
    const movements = await store.listMovements();
    const batches = await store.listBatches();
    const wrap = $('itemList');
    wrap.innerHTML = '';
    if (!items.length) wrap.innerHTML = '<p class="hint">Abhi koi item nahi hai. Upar se pehla item jodein.</p>';
    items.forEach((it) => {
      const qty = invtApi.stockQty(it.id, movements);
      const low = qty < it.reorderLevel;
      // A real button, not a look-alike div: tap picks this item in the
      // movement / batch forms below, so the row always does something.
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-item';
      b.innerHTML = '<span class="inv-top"><span>' + esc(it.name) +
        (low ? ' <span class="badge credit">LOW STOCK</span>' : '') + '</span>' +
        '<span>' + qty + ' ' + esc(it.unit) + '</span></span>' +
        '<span class="inv-sub">HSN ' + esc(it.hsn) + ' · GST ' + it.gstRatePct + '% · Sale ₹' +
        (it.salePricePaise / 100).toFixed(2) + ' · Godown ' + esc(it.godown || 'Main') + '</span>';
      b.addEventListener('click', () => {
        const mSel = $('mItem'), bSel = $('bItem');
        if (mSel) mSel.value = it.id;
        if (bSel) bSel.value = it.id;
        const form = $('moveForm');
        if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      wrap.appendChild(b);
    });
    const lowItems = invtApi.lowStock(items, movements);
    const expiring = invtApi.expiringBatches(batches, 30, todayISO());
    $('stockAlerts').innerHTML =
      '<p class="hint">Low stock: ' + (lowItems.length ? lowItems.map((i) => esc(i.name)).join(', ') : 'koi nahi ✓') + '</p>' +
      '<p class="hint">30 din me expire hone wale batch: ' +
      (expiring.length ? expiring.map((x) => esc(x.batchNo) + ' (' + x.daysLeft + ' din)') .join(', ') : 'koi nahi ✓') + '</p>';
    await fillItemSelects();
  }

  async function saveItem(e) {
    e.preventDefault();
    const item = {
      id: invtApi.newId('itm'),
      name: $('iName').value.trim(),
      hsn: $('iHsn').value.trim(),
      unit: $('iUnit').value,
      gstRatePct: parseFloat($('iRate').value),
      purchasePricePaise: parseRupees($('iPurchase').value || '0'),
      salePricePaise: parseRupees($('iSale').value || '0'),
      reorderLevel: parseInt($('iReorder').value, 10) || 0,
      godown: $('iGodown').value.trim() || 'Main',
    };
    if (item.purchasePricePaise === null || item.salePricePaise === null) {
      setMsg('itemMsg', 'Price galat hai — sahi rashi likhein.', true); return;
    }
    const errors = invtApi.validateItem(item);
    if (errors.length) { setMsg('itemMsg', 'Kuch galat hai: ' + errors.join(', '), true); return; }
    await store.saveItem(item);
    setMsg('itemMsg', 'Item save ho gaya ✓');
    $('itemForm').reset();
    $('iReorder').value = '0';
    $('iGodown').value = 'Main';
    await renderStock();
  }

  async function saveMovement(e) {
    e.preventDefault();
    const qty = parseFloat($('mQty').value);
    if (!Number.isFinite(qty) || qty === 0) { setMsg('moveMsg', 'Qty galat hai.', true); return; }
    const kind = $('mKind').value;
    // purchase: +qty, sale: -qty, adjust: qty jaisi typed (negative allowed).
    const qtyDelta = kind === 'purchase' ? Math.abs(qty) : kind === 'sale' ? -Math.abs(qty) : qty;
    const mv = {
      id: invtApi.newId('mov'),
      itemId: $('mItem').value,
      batchId: null,
      date: todayISO(),
      kind,
      qtyDelta,
      godown: $('mGodown').value.trim() || 'Main',
      note: $('mNote').value.trim(),
      linkedInvoiceNumber: null,
    };
    const errors = invtApi.validateMovement(mv);
    if (errors.length) { setMsg('moveMsg', 'Kuch galat hai: ' + errors.join(', '), true); return; }
    await store.saveMovement(mv);
    setMsg('moveMsg', 'Movement save ho gaya ✓');
    $('moveForm').reset();
    $('mGodown').value = 'Main';
    await renderStock();
  }

  async function saveBatch(e) {
    e.preventDefault();
    const qty = parseFloat($('bQty').value);
    const price = parseRupees($('bPrice').value || '0');
    if (!Number.isFinite(qty) || qty <= 0 || price === null) {
      setMsg('batchMsg', 'Qty / price galat hai.', true); return;
    }
    const batch = {
      id: invtApi.newId('bat'),
      itemId: $('bItem').value,
      batchNo: $('bNo').value.trim(),
      godown: $('bGodown').value.trim() || 'Main',
      qty,
      expiryDate: $('bExpiry').value || null,
      purchasePricePaise: price,
    };
    const errors = invtApi.validateBatch(batch);
    if (errors.length) { setMsg('batchMsg', 'Kuch galat hai: ' + errors.join(', '), true); return; }
    await store.saveBatch(batch);
    // Batch ka stock bhi judta hai — purchase movement ke roop me.
    await store.saveMovement({
      id: invtApi.newId('mov'),
      itemId: batch.itemId,
      batchId: batch.id,
      date: todayISO(),
      kind: 'purchase',
      qtyDelta: qty,
      godown: batch.godown,
      note: 'Batch ' + batch.batchNo,
      linkedInvoiceNumber: null,
    });
    setMsg('batchMsg', 'Batch save ho gaya ✓ (stock me bhi jud gaya)');
    $('batchForm').reset();
    $('bGodown').value = 'Main';
    await renderStock();
  }

  // Bill save hote hi stock ghatao — app.js se call hota hai.
  async function onInvoiceSaved(invoice) {
    const items = await store.listItems();
    const movements = await store.listMovements();
    const applied = invtApi.applyInvoiceToStock(invoice, items, movements);
    if (applied.movements.length) await store.saveMovements(applied.movements);
  }

  // ---------------- GST ----------------
  function fpOf(monthStr) {
    // 'YYYY-MM' -> portal FP 'MMYYYY'
    const parts = monthStr.split('-');
    return parts[1] + parts[0];
  }
  function fyOf(monthStr) {
    const parts = monthStr.split('-');
    return financialYear(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
  }
  function headsHtml(h) {
    return '<div class="trow"><span>Taxable</span><strong>' + esc(formatINR(h.taxablePaise)) + '</strong></div>' +
      '<div class="trow"><span>CGST</span><strong>' + esc(formatINR(h.cgstPaise)) + '</strong></div>' +
      '<div class="trow"><span>SGST</span><strong>' + esc(formatINR(h.sgstPaise)) + '</strong></div>' +
      '<div class="trow"><span>IGST</span><strong>' + esc(formatINR(h.igstPaise)) + '</strong></div>';
  }

  async function renderGstLists() {
    const invoices = await store.listInvoices();
    const saved = invoices.filter((i) => i.status === 'saved' && i.type === 'invoice');
    $('eiInvoice').innerHTML = saved.map((i) =>
      '<option value="' + esc(i.id) + '">' + esc(i.number || i.id) + ' — ' + esc(i.partyName) + '</option>').join('');
    if (!$('gMonth').value) $('gMonth').value = monthNow();
  }

  async function showGstr1() {
    const month = $('gMonth').value || monthNow();
    const invoices = await store.listInvoices();
    lastGstr1 = gstRep.gstr1Summary(invoices, { fy: fyOf(month), month });
    lastFp = fpOf(month);
    $('gstOut').innerHTML = '<h3>GSTR-1 — ' + esc(month) + ' (DRAFT)</h3>' +
      '<p class="doc-meta">B2B parties: ' + lastGstr1.b2b.length + ' · B2CL invoices: ' +
      lastGstr1.b2cl.reduce((n, g) => n + g.invoices.length, 0) + ' · B2CS buckets: ' + lastGstr1.b2cs.length +
      ' · Notes (CDNR): ' + lastGstr1.cdnr.length + ' · Bills: ' + lastGstr1.invoiceCount + '</p>' +
      headsHtml(lastGstr1.totals);
    setMsg('gstMsg', 'GSTR-1 summary taiyaar — download karke portal pe verify karein.');
  }

  async function showGstr3b() {
    const month = $('gMonth').value || monthNow();
    const itc = {
      igstPaise: parseRupees($('itcIgst').value || '0') || 0,
      cgstPaise: parseRupees($('itcCgst').value || '0') || 0,
      sgstPaise: parseRupees($('itcSgst').value || '0') || 0,
    };
    const invoices = await store.listInvoices();
    lastGstr3b = gstRep.gstr3bSummary(invoices, itc, { fy: fyOf(month), month });
    lastFp = fpOf(month);
    $('gstOut').innerHTML = '<h3>GSTR-3B — ' + esc(month) + ' (DRAFT)</h3>' +
      '<p class="doc-meta">Outward supplies:</p>' + headsHtml(lastGstr3b.outward) +
      '<p class="doc-meta">ITC (aapne bhara — portal 2B se):</p>' + headsHtml(lastGstr3b.itc) +
      '<p class="doc-meta">Net payable:</p>' +
      '<div class="trow"><span>IGST</span><strong>' + esc(formatINR(lastGstr3b.netPayable.igstPaise)) + '</strong></div>' +
      '<div class="trow"><span>CGST</span><strong>' + esc(formatINR(lastGstr3b.netPayable.cgstPaise)) + '</strong></div>' +
      '<div class="trow"><span>SGST</span><strong>' + esc(formatINR(lastGstr3b.netPayable.sgstPaise)) + '</strong></div>';
    setMsg('gstMsg', 'GSTR-3B summary taiyaar — ITC aapka bhara hua hai, app guess nahi karta.');
  }

  function downloadGstr(kind) {
    if (kind === 'gstr1') {
      if (!lastGstr1) { setMsg('gstMsg', 'Pehle "GSTR-1 Dekhein" dabayein.', true); return; }
      download('gstr1-' + lastFp + '.json', JSON.stringify(gstRep.gstr1Json(profile, lastGstr1, { fp: lastFp }), null, 2));
    } else {
      if (!lastGstr3b) { setMsg('gstMsg', 'Pehle "GSTR-3B Dekhein" dabayein.', true); return; }
      download('gstr3b-' + lastFp + '.json', JSON.stringify(gstRep.gstr3bJson(profile, lastGstr3b, { fp: lastFp }), null, 2));
    }
    setMsg('gstMsg', 'JSON download ho gaya — portal pe upload karke verify karein.');
  }

  async function reconcile() {
    let portal;
    try {
      portal = JSON.parse($('portal2b').value || '[]');
      if (!Array.isArray(portal)) throw new Error('array chahiye');
    } catch (e) {
      setMsg('gstMsg', '2B JSON galat hai — sahi JSON array paste karein.', true); return;
    }
    const invoices = await store.listInvoices();
    const r = gstRep.reconcile2A2B(invoices, portal);
    $('reconOut').innerHTML =
      '<p class="doc-meta">Matched: ' + r.matched.length + ' · Portal me missing: ' + r.missingInPortal.length +
      ' · Portal me extra: ' + r.extraInPortal.length + ' · Amount mismatch: ' + r.mismatched.length + '</p>' +
      (r.missingInPortal.length ? '<p class="hint">Portal me missing: ' + r.missingInPortal.map((i) => esc(i.number)).join(', ') + '</p>' : '') +
      (r.extraInPortal.length ? '<p class="hint">Portal me extra: ' + r.extraInPortal.map((p) => esc(p.invoiceNumber)).join(', ') + '</p>' : '') +
      (r.mismatched.length ? '<p class="hint">Mismatch: ' + r.mismatched.map((m) => esc(m.own.number) + ' (diff ' + esc(formatINR(m.diffPaise)) + ')').join(', ') + '</p>' : '');
    setMsg('gstMsg', 'Reconciliation ho gaya ✓');
  }

  async function downloadEi(kind) {
    const id = $('eiInvoice').value;
    const inv = await store.getInvoice(id);
    if (!inv) { setMsg('gstMsg', 'Pehle ek saved bill chunein.', true); return; }
    try {
      if (kind === 'einvoice') {
        download('einvoice-' + (inv.number || inv.id).replace(/\//g, '-') + '.json', JSON.stringify(eiApi.einvoiceJson(inv, profile), null, 2));
      } else {
        const dist = parseInt($('eiDistance').value, 10);
        download('ewaybill-' + (inv.number || inv.id).replace(/\//g, '-') + '.json',
          JSON.stringify(eiApi.ewaybillJson(inv, profile, { distanceKm: Number.isFinite(dist) ? dist : null }), null, 2));
      }
      setMsg('gstMsg', 'JSON download ho gaya (DRAFT — filing portal/GSP se hoti hai).');
    } catch (e) {
      setMsg('gstMsg', 'Export nahi hua: ' + e.message, true);
    }
  }

  // ---------------- PAYROLL ----------------
  async function renderEmployees() {
    const emps = await store.listEmployees();
    const wrap = $('empList');
    wrap.innerHTML = '';
    if (!emps.length) wrap.innerHTML = '<p class="hint">Abhi koi employee nahi hai.</p>';
    emps.forEach((e) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-item';
      b.innerHTML = '<span class="inv-top"><span>' + esc(e.name) + '</span>' +
        '<span>₹' + (e.monthlySalaryPaise / 100).toFixed(2) + '/mahina</span></span>' +
        '<span class="inv-sub">' + esc(e.role || '') + ' · PF ' + e.pfPct + '% · ESI ' + e.esiPct + '%</span>';
      b.addEventListener('click', () => selectEmployee(e.id));
      wrap.appendChild(b);
    });
  }

  async function selectEmployee(id) {
    selectedEmpId = id;
    const emp = await store.getEmployee(id);
    if (!emp) return;
    $('payrollDetail').hidden = false;
    $('pdEmpName').textContent = emp.name + ' — Payslip';
    if (!$('aMonth').value) $('aMonth').value = monthNow();
    if (!$('aTotal').value) $('aTotal').value = '30';
  }

  async function saveEmployee(e) {
    e.preventDefault();
    const emp = {
      id: payApi.newId ? payApi.newId('emp') : 'emp_' + Date.now().toString(36),
      name: $('emName').value.trim(),
      role: $('emRole').value.trim(),
      monthlySalaryPaise: parseRupees($('emSalary').value),
      pfPct: parseFloat($('emPf').value) || 0,
      esiPct: parseFloat($('emEsi').value) || 0,
      ptPaise: parseRupees($('emPt').value || '0') || 0,
      tdsPaise: parseRupees($('emTds').value || '0') || 0,
    };
    if (emp.monthlySalaryPaise === null) { setMsg('empMsg', 'Salary galat hai.', true); return; }
    const errors = payApi.validateEmployee(emp);
    if (errors.length) { setMsg('empMsg', 'Kuch galat hai: ' + errors.join(', '), true); return; }
    await store.saveEmployee(emp);
    setMsg('empMsg', 'Employee save ho gaya ✓');
    $('empForm').reset();
    $('emPf').value = '0'; $('emEsi').value = '0'; $('emPt').value = '0'; $('emTds').value = '0';
    await renderEmployees();
  }

  async function makePayslip(e) {
    e.preventDefault();
    const emp = await store.getEmployee(selectedEmpId);
    if (!emp) return;
    const att = {
      employeeId: emp.id,
      month: $('aMonth').value,
      presentDays: parseInt($('aPresent').value, 10),
      totalDays: parseInt($('aTotal').value, 10),
    };
    const errors = payApi.validateAttendance(att);
    if (errors.length) { setMsg('attMsg', 'Attendance galat hai: ' + errors.join(', '), true); return; }
    const advance = parseRupees($('aAdvance').value || '0');
    if (advance === null) { setMsg('attMsg', 'Advance rashi galat hai.', true); return; }
    let slip;
    try {
      slip = payApi.calcPayslip(emp, att, { advancePaise: advance });
    } catch (err) {
      setMsg('attMsg', 'Payslip nahi bana: ' + err.message, true); return;
    }
    await store.saveAttendance(att);
    if (advance > 0) {
      await store.saveAdvance({ employeeId: emp.id, month: att.month, amountPaise: advance, date: todayISO() });
    }
    lastPayslipText = payApi.payslipText(slip, emp, 'hi');
    $('payslipOut').textContent = lastPayslipText;
    setMsg('attMsg', 'Payslip ban gaya ✓ — Net: ' + formatINR(slip.netPaise));
  }

  function printPayslip() {
    if (!lastPayslipText) { setMsg('attMsg', 'Pehle payslip banayein.', true); return; }
    $('print-area').innerHTML = '<div class="invoice-doc"><h3>Payslip</h3><pre style="white-space:pre-wrap;font-family:inherit">' +
      esc(lastPayslipText) + '</pre></div>';
    document.body.setAttribute('data-print', 'a4');
    const done = () => {
      document.body.removeAttribute('data-print');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  // ---------------- REPORTS ----------------
  function monthsInRange(from, to) {
    if (!from || !to) return [];
    const out = [];
    let y = parseInt(from.slice(0, 4), 10), m = parseInt(from.slice(5, 7), 10);
    const endY = parseInt(to.slice(0, 4), 10), endM = parseInt(to.slice(5, 7), 10);
    while (y < endY || (y === endY && m <= endM)) {
      out.push(y + '-' + String(m).padStart(2, '0'));
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  async function payrollNetInRange(from, to) {
    const months = monthsInRange(from, to);
    if (!months.length) return 0;
    const emps = await store.listEmployees();
    const atts = await store.listAttendance();
    const advs = await store.listAdvances();
    let total = 0;
    for (const emp of emps) {
      for (const a of atts) {
        if (a.employeeId !== emp.id || !months.includes(a.month)) continue;
        const adv = advs.filter((x) => x.employeeId === emp.id && x.month === a.month)
          .reduce((s, x) => s + (x.amountPaise || 0), 0);
        try { total += payApi.calcPayslip(emp, a, { advancePaise: adv }).netPaise; } catch (e) { /* skip bad */ }
      }
    }
    return total;
  }

  async function showReports() {
    const from = $('rFrom').value || null;
    const to = $('rTo').value || null;
    const range = (from || to) ? { from, to } : null;
    const invoices = await store.listInvoices();
    const entries = await store.listLedger();
    const expenses = await store.listExpenses();
    const items = await store.listItems();
    const movements = await store.listMovements();
    const sales = repApi.salesSummary(invoices, range);
    const purchases = repApi.purchaseSummary(entries, range);
    const exp = repApi.expenseSummary(expenses, range);
    const gst = repApi.gstSummary(invoices);
    const stock = repApi.stockSummary(items, movements);
    const cf = repApi.cashFlow(entries, invoices, range);
    const payrollNet = await payrollNetInRange(from, to);
    const pl = repApi.profitLoss({ sales, purchases, expenses: exp, payrollNetPaise: payrollNet });
    $('repOut').innerHTML =
      '<h3>Sales / Kharid / Kharcha</h3>' +
      '<div class="trow"><span>Sales (' + sales.count + ' bills)</span><strong>' + esc(formatINR(sales.totalPaise)) + '</strong></div>' +
      '<div class="trow"><span>Kharid (' + purchases.count + ')</span><strong>' + esc(formatINR(purchases.totalPaise)) + '</strong></div>' +
      '<div class="trow"><span>Kharcha</span><strong>' + esc(formatINR(exp.totalPaise)) + '</strong></div>' +
      '<h3>Profit &amp; Loss</h3>' +
      '<div class="trow"><span>Gross profit</span><strong>' + esc(formatINR(pl.grossProfitPaise)) + '</strong></div>' +
      '<div class="trow"><span>Salary (is range me)</span><strong>' + esc(formatINR(payrollNet)) + '</strong></div>' +
      '<div class="trow grand"><span>Net profit</span><strong>' + esc(formatINR(pl.netProfitPaise)) + '</strong></div>' +
      '<h3>GST Summary (sab bills)</h3>' + headsHtml(gst) +
      '<div class="trow"><span>Bills / Notes</span><strong>' + gst.invoiceCount + ' / ' + gst.noteCount + '</strong></div>' +
      '<h3>Stock Value</h3>' +
      '<div class="trow"><span>Stock value (kharid price se)</span><strong>' + esc(formatINR(stock.totalValuePaise)) + '</strong></div>' +
      '<h3>Cash Flow</h3>' +
      '<div class="trow"><span>Cash aaya</span><strong>' + esc(formatINR(cf.receiptsPaise)) + '</strong></div>' +
      '<div class="trow"><span>Cash gaya</span><strong>' + esc(formatINR(cf.paymentsPaise)) + '</strong></div>' +
      '<div class="trow"><span>Net cash</span><strong>' + esc(formatINR(cf.netPaise)) + '</strong></div>';
  }

  async function saveExpense(e) {
    e.preventDefault();
    const amt = parseRupees($('xAmount').value);
    if (amt === null || amt <= 0) { setMsg('expMsg', 'Rashi galat hai.', true); return; }
    const exp = {
      id: 'exp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      date: $('xDate').value || todayISO(),
      category: $('xCategory').value.trim() || 'Other',
      amountPaise: amt,
      note: $('xNote').value.trim(),
    };
    await store.saveExpense(exp);
    setMsg('expMsg', 'Expense save ho gaya ✓');
    $('expForm').reset();
    await showReports();
  }

  async function exportCsv(kind) {
    const invoices = await store.listInvoices();
    if (kind === 'inv') download('invoices.csv', repApi.invoicesToCSV(invoices), 'text/csv');
    else if (kind === 'party') {
      const parties = await store.listParties();
      const entries = await store.listLedger();
      const balances = {};
      parties.forEach((p) => { balances[p.id] = partyApi.partyBalance(p, entries); });
      download('parties.csv', repApi.partiesToCSV(parties, balances), 'text/csv');
    } else if (kind === 'stock') {
      download('stock.csv', repApi.stockToCSV(await store.listItems(), await store.listMovements()), 'text/csv');
    } else if (kind === 'tally') {
      download('tally-export.csv', repApi.tallyCsv(invoices), 'text/csv');
    } else if (kind === 'bundle') {
      const bundle = repApi.exportBundle(profile, {
        invoices,
        parties: await store.listParties(),
        ledgerEntries: await store.listLedger(),
        items: await store.listItems(),
        movements: await store.listMovements(),
        employees: await store.listEmployees(),
      });
      download('udyamsetu-backup.json', JSON.stringify(bundle, null, 2));
    }
  }

  // ---------------- INIT + HOOKS ----------------
  async function onShow(name) {
    if (name === 'party') await renderParties();
    else if (name === 'stock') await renderStock();
    else if (name === 'gst') await renderGstLists();
    else if (name === 'payroll') await renderEmployees();
    else if (name === 'reports') await showReports();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    profile = await store.getProfile();
    stateOptions($('pState'), '21');
    rateOptions($('iRate'), 18);
    $('eDate').value = todayISO();
    $('xDate').value = todayISO();
    $('gMonth').value = monthNow();
    const first = todayISO().slice(0, 8) + '01';
    $('rFrom').value = first;
    $('rTo').value = todayISO();

    $('partyForm').addEventListener('submit', saveParty);
    $('entryForm').addEventListener('submit', saveEntry);
    $('itemForm').addEventListener('submit', saveItem);
    $('moveForm').addEventListener('submit', saveMovement);
    $('batchForm').addEventListener('submit', saveBatch);
    $('gGstr1Btn').addEventListener('click', showGstr1);
    $('gGstr3bBtn').addEventListener('click', showGstr3b);
    $('dlGstr1').addEventListener('click', () => downloadGstr('gstr1'));
    $('dlGstr3b').addEventListener('click', () => downloadGstr('gstr3b'));
    $('reconBtn').addEventListener('click', reconcile);
    $('dlEinvoice').addEventListener('click', () => downloadEi('einvoice'));
    $('dlEway').addEventListener('click', () => downloadEi('eway'));
    $('empForm').addEventListener('submit', saveEmployee);
    $('attForm').addEventListener('submit', makePayslip);
    $('printPayslipBtn').addEventListener('click', printPayslip);
    $('repBtn').addEventListener('click', showReports);
    $('expForm').addEventListener('submit', saveExpense);
    $('expInvCsv').addEventListener('click', () => exportCsv('inv'));
    $('expPartyCsv').addEventListener('click', () => exportCsv('party'));
    $('expStockCsv').addEventListener('click', () => exportCsv('stock'));
    $('expTallyCsv').addEventListener('click', () => exportCsv('tally'));
    $('expBundle').addEventListener('click', () => exportCsv('bundle'));
  });

  // app.js (Phase 1.1) ke hooks — tab switch aur bill-save par.
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.ui12 = { onShow, onInvoiceSaved };
})();
