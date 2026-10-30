// Offline support: network first so updates show up immediately, cached copy when offline.
// Bump VERSION when the list of app files changes.
const VERSION = 'autovalue-v21';
const APP_FILES = ['./', 'index.html', 'css/styles.css', 'js/i18n.js', 'js/data.js', 'js/core.js', 'js/app.js', 'privacy.html', 'js/legal.js', 'manifest.webmanifest', 'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/apple-touch-icon-v2.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only same-origin GETs for app files; the API and other sites always go to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }))
  );
});
