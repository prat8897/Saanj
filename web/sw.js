// Offline shell + push. Bump VERSION on each deploy so users get fresh files.
const VERSION = 'saanj-v3';
const SHELL = ['/', '/index.html', '/css/app.css', '/fonts/fraunces.woff2', '/fonts/hanken.woff2', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Same-origin: network first, fall back to cache (so updates land immediately but the app opens offline).
// Firebase/Google/API traffic is never cached.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});

self.addEventListener('push', e => {
  let p = {}; try { p = e.data.json(); } catch { /* ignore */ }
  const d = p.data || p.notification || {};
  e.waitUntil(self.registration.showNotification(d.title || 'Saanj', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => cs[0] ? cs[0].focus() : clients.openWindow(e.notification.data?.url || '/')));
});
