// UdyamSetu Site — service worker, cache-first, fully offline after first load.
// No network calls are made by the app itself; the cache only holds local files.
'use strict';

const CACHE = 'udyamsetu-site-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './app12.js',
  './store.js',
  './invoice.js',
  './party.js',
  './inventory.js',
  './gst-reports.js',
  './einvoice.js',
  './payroll.js',
  './reports.js',
  './i18n.js',
  './manifest.json',
  './icon.svg',
  '../core/gst.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
