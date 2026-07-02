const CACHE = 'uauu-inv-v52';

const ASSETS = [
  './',
  './index.html',
  './favicon.ico',
  './src/assets/css/app.css',
  './src/assets/css/base.css',
  './src/assets/css/layout.css',
  './src/assets/css/items.css',
  './src/assets/css/modal.css',
  './src/assets/css/stats.css',
  './src/assets/css/orders.css',
  './src/assets/css/screens.css',
  './src/assets/css/catalog.css',
  './src/assets/css/casaments.css',
  './src/main.js',
  './src/config.js',
  './src/helpers.js',
  './src/auth.js',
  './src/items.js',
  './src/catalog.js',
  './src/orders.js',
  './src/import.js',
  './src/users.js',
  './src/stats.js',
  './src/casaments.js',
  './src/estadistiques.js',
  './src/assets/css/estadistiques.css',
  './manifest.json',
  './src/assets/icons/icon.svg',
  './src/assets/icons/icon-maskable.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache same-origin assets; let external requests (GAS, Sheets, OFF API) go straight to network
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
