/* Harita service worker — network-first, fallback offline. */
const CACHE = 'harita-v28';
const API_CACHE = 'harita-api-v1';
const SHELL = [
  '/',
  '/index.html',
  '/app.css',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.png',
  '/js/icons.js',
  '/js/auth.js',
  '/js/core.js',
  '/js/data.js',
  '/js/dashboard.js',
  '/js/tasks.js',
  '/js/calendar.js',
  '/js/academic-calendar.js',
  '/js/ambient.js',
  '/js/clock.js',
  '/js/competitions.js',
  '/js/notes.js',
  '/js/expenses.js',
  '/js/schedule.js',
  '/js/focus.js',
  '/js/device.js',
  '/js/music.js',
  '/js/streak.js',
  '/js/grades.js',
  '/js/palette.js',
  '/js/main.js',
  '/fonts/space-grotesk-latin.woff2',
  '/fonts/bricolage-grotesk-latin.woff2'
];

self.addEventListener('message', (event) => { if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API: network-first, fallback ke cache terakhir untuk GET
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(() =>
          caches.match(event.request).then((hit) =>
            hit || new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
          )
        )
      );
      return;
    }
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Static assets: network-first, fallback cache
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.ok && url.origin === location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
      }
      return res;
    }).catch(() => caches.match(event.request).then((hit) => hit || caches.match('/index.html')))
  );
});
