// UdyamSetu Site — storage layer (no DOM, no tax math).
// One profile + one invoice list, under stable keys. The adapter is
// injectable so node tests can use the in-memory one.
// Browser order: IndexedDB first, localStorage fallback, memory last.
'use strict';

const PROFILE_KEY = 'udyamsetu.profile.v1';
const INVOICES_KEY = 'udyamsetu.invoices.v1';

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
}

const api = {
  PROFILE_KEY, INVOICES_KEY, DEFAULT_PROFILE,
  MemoryAdapter, LocalStorageAdapter, IndexedDBAdapter, pickAdapter, Store,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.store = api;
}
