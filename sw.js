// MoneyOS offline shell cache. Only static app files are cached — all
// financial data lives in localStorage on-device, so the dashboard, budget,
// goals, etc. keep working with no network at all. /api/* calls (AI Coach,
// receipt scanner) still require a connection.
const CACHE = 'moneyos-shell-v1';
const SHELL_FILES = [
  '/', '/index.html', '/manifest.json',
  '/css/style.css',
  '/js/crypto.js', '/js/webauthn.js', '/js/voice.js', '/js/app.js', '/js/app-pages.js', '/js/app-init.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache API calls
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone));
      return res;
    }).catch(() => cached))
  );
});
