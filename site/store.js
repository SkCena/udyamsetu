// UdyamSetu Site — storage layer (no DOM, no tax math).
// One profile + one invoice list, under stable keys. The adapter is
// injectable so node tests can use the in-memory one.
// Browser order: IndexedDB first, localStorage fallback, memory last.
'use strict';

const PROFILE_KEY = 'udyamsetu.profile.v1';
const INVOICES_KEY = 'udyamsetu.invoices.v1';
// Phase 1.2 collections (added 2026-11-22). Same adapter, same db.
const PARTIES_KEY = 'udyamsetu.parties.v1';
const LEDGER_KEY = 'udyamsetu.ledger.v1';
const ITEMS_KEY = 'udyamsetu.items.v1';
const BATCHES_KEY = 'udyamsetu.batches.v1';
const MOVEMENTS_KEY = 'udyamsetu.movements.v1';
const EMPLOYEES_KEY = 'udyamsetu.employees.v1';
const ATTENDANCE_KEY = 'udyamsetu.attendance.v1';
const ADVANCES_KEY = 'udyamsetu.advances.v1';
const EXPENSES_KEY = 'udyamsetu.expenses.v1';

/** Default BusinessProfile — matches the shared data model. */
const DEFAULT_PROFILE = {
  name: '',
  gstin: null,
  phone: '',
  address: '',
  logoDataUrl: null,
  upiId: '',
  invoicePrefix: 'INV',
  nextSeq: 1,
  sellerState: '21', // Odisha
};

function clone(v) {
  return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v));
}

/** In-memory adapter (node tests + last-resort fallback). */
class MemoryAdapter {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.has(key) ? clone(this.map.get(key)) : null; }
  async set(key, value) { this.map.set(key, clone(value)); }
}

/** localStorage adapter (sync storage wrapped in promises). */
class LocalStorageAdapter {
  async get(key) {
    const raw = globalThis.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }
  async set(key, value) {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
  }
}

/** IndexedDB adapter — single db, single object store, key/value rows. */
class IndexedDBAdapter {
  constructor(dbName) {
    this.dbName = dbName || 'udyamsetu';
    this.storeName = 'kv';
    this._dbPromise = null;
  }
  _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(this.storeName); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
    return this._dbPromise;
  }
  async get(key) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const rq = tx.objectStore(this.storeName).get(key);
      rq.onsuccess = () => resolve(rq.result === undefined ? null : rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  async set(key, value) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(clone(value), key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/** Pick the best adapter available in this environment. */
function pickAdapter() {
  if (typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB) {
    return new IndexedDBAdapter();
  }
  if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage) {
    try {
      globalThis.localStorage.setItem('__udyamsetu_probe__', '1');
      globalThis.localStorage.removeItem('__udyamsetu_probe__');
      return new LocalStorageAdapter();
    } catch (e) { /* fall through to memory */ }
  }
  return new MemoryAdapter();
}

class Store {
  constructor(adapter) {
    this.adapter = adapter || pickAdapter();
  }

  async getProfile() {
    const raw = await this.adapter.get(PROFILE_KEY);
    if (!raw || typeof raw !== 'object') return clone(DEFAULT_PROFILE);
    return Object.assign(clone(DEFAULT_PROFILE), raw);
  }

  async saveProfile(profile) {
    await this.adapter.set(PROFILE_KEY, profile);
    return profile;
  }

  async listInvoices() {
    const raw = await this.adapter.get(INVOICES_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  /** Insert or replace by id. Newest first. */
  async saveInvoice(invoice) {
    const list = await this.listInvoices();
    const i = list.findIndex((x) => x.id === invoice.id);
    if (i >= 0) list[i] = invoice;
    else list.unshift(invoice);
    await this.adapter.set(INVOICES_KEY, list);
    return invoice;
  }

  async getInvoice(id) {
    const list = await this.listInvoices();
    return list.find((x) => x.id === id) || null;
  }

  // ---- Phase 1.2: generic list collections (upsert by id) ----
  async _list(key) {
    const raw = await this.adapter.get(key);
    return Array.isArray(raw) ? raw : [];
  }

  async _saveList(key, list) {
    await this.adapter.set(key, list);
    return list;
  }

  async _upsert(key, row) {
    const list = await this._list(key);
    const i = list.findIndex((x) => x.id === row.id);
    if (i >= 0) list[i] = row;
    else list.unshift(row);
    await this._saveList(key, list);
    return row;
  }

  async _get(key, id) {
    const list = await this._list(key);
    return list.find((x) => x.id === id) || null;
  }

  async _remove(key, id) {
    const list = await this._list(key);
    await this._saveList(key, list.filter((x) => x.id !== id));
  }

  // Parties + ledger entries (party.js shapes).
  listParties() { return this._list(PARTIES_KEY); }
  saveParty(p) { return this._upsert(PARTIES_KEY, p); }
  getParty(id) { return this._get(PARTIES_KEY, id); }
  listLedger() { return this._list(LEDGER_KEY); }
  saveLedgerEntry(e) { return this._upsert(LEDGER_KEY, e); }
  getLedgerEntry(id) { return this._get(LEDGER_KEY, id); }

  // Inventory: items, batches, movements (inventory.js shapes).
  listItems() { return this._list(ITEMS_KEY); }
  saveItem(it) { return this._upsert(ITEMS_KEY, it); }
  getItem(id) { return this._get(ITEMS_KEY, id); }
  listBatches() { return this._list(BATCHES_KEY); }
  saveBatch(b) { return this._upsert(BATCHES_KEY, b); }
  listMovements() { return this._list(MOVEMENTS_KEY); }
  saveMovement(m) { return this._upsert(MOVEMENTS_KEY, m); }
  async saveMovements(rows) {
    const list = await this._list(MOVEMENTS_KEY);
    for (const r of rows) {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r; else list.unshift(r);
    }
    await this._saveList(MOVEMENTS_KEY, list);
    return rows;
  }

  // Payroll-lite: employees, attendance, advances (payroll.js shapes).
  listEmployees() { return this._list(EMPLOYEES_KEY); }
  saveEmployee(e) { return this._upsert(EMPLOYEES_KEY, e); }
  getEmployee(id) { return this._get(EMPLOYEES_KEY, id); }
  listAttendance() { return this._list(ATTENDANCE_KEY); }
  saveAttendance(a) { return this._upsert(ATTENDANCE_KEY, a); }
  listAdvances() { return this._list(ADVANCES_KEY); }
  saveAdvance(a) { return this._upsert(ADVANCES_KEY, a); }

  // Expenses (reports.js shape).
  listExpenses() { return this._list(EXPENSES_KEY); }
  saveExpense(e) { return this._upsert(EXPENSES_KEY, e); }
  removeExpense(id) { return this._remove(EXPENSES_KEY, id); }
}

const storeApi = {
  PROFILE_KEY, INVOICES_KEY, DEFAULT_PROFILE,
  PARTIES_KEY, LEDGER_KEY, ITEMS_KEY, BATCHES_KEY, MOVEMENTS_KEY,
  EMPLOYEES_KEY, ATTENDANCE_KEY, ADVANCES_KEY, EXPENSES_KEY,
  MemoryAdapter, LocalStorageAdapter, IndexedDBAdapter, pickAdapter, Store,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = storeApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.store = storeApi;
}
