// UdyamSetu Site — Google Drive backup (optional, encrypted).
// Sign-in is OPTIONAL — the whole site works without it. When signed in,
// the backup is encrypted in the browser (WebCrypto AES-GCM, key from the
// user's passphrase via PBKDF2) and stored in the user's own Drive
// appDataFolder — only this app can see it, and the passphrase is NEVER
// stored anywhere. OAuth client id comes from drive-config.js (empty
// placeholder by default); without it the section shows "Setup pending"
// and everything else keeps working. GIS loads from CDN; offline, the
// section shows an offline note instead of failing.
'use strict';

function getSubtle() {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
  if (typeof require === 'function') {
    try { return require('node:crypto').webcrypto.subtle; } catch (e) { return null; }
  }
  return null;
}
function getCryptoRandom() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto;
  if (typeof require === 'function') {
    try { return require('node:crypto').webcrypto; } catch (e) { return null; }
  }
  return null;
}

const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_PREFIX = 'udyamsetu-backup-';

/** 'missing' when no client id is configured, 'ready' otherwise. Pure. */
function driveConfigStatus(config) {
  if (!config || typeof config.clientId !== 'string' || !config.clientId.trim()) return 'missing';
  return 'ready';
}

/** Backup file name for a date, e.g. 'udyamsetu-backup-2026-11-22.json.enc'. Pure. */
function driveBackupFileName(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return DRIVE_FILE_PREFIX + d.getFullYear() + '-' + m + '-' + day + '.json.enc';
}

function bytesToB64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}
function b64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function textToBytes(s) {
  return new TextEncoder().encode(s);
}
function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

async function deriveKey(passphrase, saltBytes) {
  const subtle = getSubtle();
  if (!subtle) throw new Error('WebCrypto is not available in this browser');
  if (!passphrase || typeof passphrase !== 'string' || passphrase.length < 4) {
    throw new Error('passphrase too short');
  }
  const base = await subtle.importKey('raw', textToBytes(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypt a backup object with the passphrase.
 * Returns { v: 1, salt, iv, data } — all base64. The passphrase is not in it.
 */
async function encryptBackup(obj, passphrase) {
  const rnd = getCryptoRandom();
  if (!rnd) throw new Error('secure random is not available');
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  rnd.getRandomValues(salt);
  rnd.getRandomValues(iv);
  const key = await deriveKey(passphrase, salt);
  const plain = textToBytes(JSON.stringify(obj));
  const cipher = new Uint8Array(await getSubtle().encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { v: 1, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(cipher) };
}

/** Decrypt what encryptBackup produced. Throws on a wrong passphrase. */
async function decryptBackup(enc, passphrase) {
  if (!enc || enc.v !== 1 || !enc.salt || !enc.iv || !enc.data) throw new Error('bad backup file');
  const key = await deriveKey(passphrase, b64ToBytes(enc.salt));
  const plain = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(enc.iv) }, key, b64ToBytes(enc.data));
  return JSON.parse(bytesToText(new Uint8Array(plain)));
}

/**
 * Collect everything worth backing up from the store. Best-effort: a
 * missing collection is skipped, never fatal. Pure shape, async store.
 */
async function collectBackupData(store) {
  const data = { app: 'UdyamSetu', version: 1, exportedOn: new Date().toISOString().slice(0, 10) };
  const jobs = [
    ['profile', 'getProfile'], ['invoices', 'listInvoices'], ['parties', 'listParties'],
    ['ledger', 'listLedger'], ['items', 'listItems'], ['movements', 'listMovements'],
    ['batches', 'listBatches'], ['employees', 'listEmployees'],
    ['attendance', 'listAttendance'], ['advances', 'listAdvances'], ['expenses', 'listExpenses'],
  ];
  for (const [key, method] of jobs) {
    try {
      if (store && typeof store[method] === 'function') data[key] = await store[method]();
    } catch (e) { /* skip — backup keeps the rest */ }
  }
  return data;
}

/**
 * Restore a decrypted backup into the store. Best-effort per collection;
 * returns { imported: { invoices: n, ... } }. Never wipes existing data
 * first — records are upserted by id, so a restore adds, it does not erase.
 */
async function restoreBackupData(store, data) {
  const imported = {};
  const jobs = [
    ['invoices', 'saveInvoice'], ['parties', 'saveParty'], ['ledger', 'saveLedgerEntry'],
    ['items', 'saveItem'], ['movements', 'saveMovement'], ['batches', 'saveBatch'],
    ['employees', 'saveEmployee'], ['attendance', 'saveAttendance'],
    ['advances', 'saveAdvance'], ['expenses', 'saveExpense'],
  ];
  try {
    if (data && data.profile && typeof store.saveProfile === 'function') {
      await store.saveProfile(data.profile);
      imported.profile = 1;
    }
  } catch (e) { /* skip */ }
  for (const [key, method] of jobs) {
    let n = 0;
    try {
      if (store && typeof store[method] === 'function' && Array.isArray(data[key])) {
        for (const rec of data[key]) { await store[method](rec); n++; }
      }
    } catch (e) { /* keep the count so far */ }
    if (n) imported[key] = n;
  }
  return { imported };
}

const driveApi = {
  DRIVE_SCOPES, DRIVE_FILE_PREFIX, driveConfigStatus, driveBackupFileName,
  encryptBackup, decryptBackup, collectBackupData, restoreBackupData,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = driveApi;
} else {
  window.UdyamSetu = window.UdyamSetu || {};
  window.UdyamSetu.drive = driveApi;

  // ---------------- DOM wiring (browser only) ----------------
  // Drive API calls use the GIS access token; list/upload/download live
  // here because they need fetch + the token client, not in the pure part.
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const section = $('driveSection');
    if (!section) return;
    const i18n = window.UdyamSetu.i18n;
    const t = (k) => i18n.t(k, i18n.getLang());
    const statusEl = $('driveStatus'), msgEl = $('driveMsg');
    const config = window.UdyamSetuDriveConfig || {};
    const say = (key) => { if (msgEl) msgEl.textContent = t(key); };

    if (driveConfigStatus(config) === 'missing') {
      if (statusEl) statusEl.textContent = t('driveSetupPending');
      ['driveSignInBtn', 'driveBackupBtn', 'driveRestoreBtn', 'drivePassphrase', 'driveFileList'].forEach((id) => {
        const el = $(id); if (el) el.hidden = true;
      });
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      if (statusEl) statusEl.textContent = t('driveOffline');
      return;
    }

    let tokenClient = null;
    let accessToken = null;
    const store = window.UdyamSetu.store ? new window.UdyamSetu.store.Store() : null;

    function setSignedIn(signedIn) {
      const signIn = $('driveSignInBtn'), signOut = $('driveSignOutBtn');
      const backup = $('driveBackupBtn'), restore = $('driveRestoreBtn');
      const pass = $('drivePassphrase'), list = $('driveFileList');
      if (signIn) signIn.hidden = signedIn;
      if (signOut) signOut.hidden = !signedIn;
      if (backup) backup.hidden = !signedIn;
      if (restore) restore.hidden = !signedIn;
      if (pass) pass.hidden = !signedIn;
      if (list) list.hidden = !signedIn;
      if (statusEl) statusEl.textContent = signedIn ? t('driveSignedIn') : '';
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: DRIVE_SCOPES,
      callback: async (resp) => {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          setSignedIn(true);
          await refreshList();
        } else { say('driveFailed'); }
      },
    });

    async function driveFetch(path, opts) {
      const res = await fetch('https://www.googleapis.com' + path, Object.assign({}, opts, {
        headers: Object.assign({}, (opts && opts.headers) || {}, { Authorization: 'Bearer ' + accessToken }),
      }));
      if (!res.ok) throw new Error('Drive request failed: ' + res.status);
      return res;
    }

    async function refreshList() {
      const list = $('driveFileList');
      if (!list) return;
      try {
        const res = await driveFetch('/drive/v3/files?q=' + encodeURIComponent("name contains 'udyamsetu-backup-'") +
          '&spaces=appDataFolder&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=10');
        const json = await res.json();
        const files = (json.files || []);
        list.innerHTML = '';
        if (!files.length) {
          list.innerHTML = '<p class="hint">' + t('driveNoBackups') + '</p>';
          return;
        }
        files.forEach((f) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'inv-item';
          b.textContent = f.name + ' · ' + String(f.modifiedTime || '').slice(0, 10);
          b.addEventListener('click', () => restoreFile(f.id));
          list.appendChild(b);
        });
      } catch (e) { say('driveFailed'); }
    }

    async function restoreFile(fileId) {
      const pass = $('drivePassphrase');
      if (!pass || pass.value.length < 4) { say('driveNeedPass'); return; }
      try {
        const res = await driveFetch('/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media');
        const enc = JSON.parse(await res.text());
        const data = await decryptBackup(enc, pass.value);
        const result = await restoreBackupData(store, data);
        const n = Object.values(result.imported).reduce((a, b) => a + b, 0);
        say('driveRestored');
        if (statusEl) statusEl.textContent = t('driveRestored') + ' (' + n + ')';
        await refreshList();
      } catch (e) { say('driveFailed'); }
    }

    const signInBtn = $('driveSignInBtn');
    if (signInBtn) signInBtn.addEventListener('click', () => tokenClient.requestAccessToken({ prompt: '' }));
    const signOutBtn = $('driveSignOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', () => {
      if (accessToken && window.google.accounts.oauth2.revoke) {
        window.google.accounts.oauth2.revoke(accessToken, () => {});
      }
      accessToken = null; setSignedIn(false); say('driveSignedOut');
    });
    const backupBtn = $('driveBackupBtn');
    if (backupBtn) backupBtn.addEventListener('click', async () => {
      const pass = $('drivePassphrase');
      if (!pass || pass.value.length < 4) { say('driveNeedPass'); return; }
      try {
        const data = await collectBackupData(store);
        const enc = await encryptBackup(data, pass.value);
        const boundary = 'udyamsetu-' + Date.now();
        const meta = { name: driveBackupFileName(new Date()), parents: ['appDataFolder'] };
        const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
          JSON.stringify(enc) + '\r\n--' + boundary + '--';
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
          body,
        });
        if (!res.ok) throw new Error('upload failed: ' + res.status);
        say('driveSaved');
        await refreshList();
      } catch (e) { say('driveFailed'); }
    });
    const restoreBtn = $('driveRestoreBtn');
    if (restoreBtn) restoreBtn.addEventListener('click', () => {
      const list = $('driveFileList');
      const first = list && list.querySelector('button');
      if (first) first.click();
      else say('driveNoBackups');
    });

    setSignedIn(false);
  });
}
