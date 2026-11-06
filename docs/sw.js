// ZOR service worker (build 87f4b99af5). Network first: a new version is always fetched when online; the cache is only the offline fallback.
const CACHE = 'zor-87f4b99af5';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-store' }).then((res) => { if (res.ok && !u.pathname.endsWith('version.json')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r.mode === 'navigate' ? './' : r, copy)); } return res; })
    .catch(() => caches.match(r.mode === 'navigate' ? './' : r, { ignoreSearch: true }).then((m) => m || caches.match('./'))));
});
