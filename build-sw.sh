#!/bin/sh
# Regenerates sw.js with a precache list of every static file; bump VERSION on each deploy.
cd "$(dirname "$0")"
VERSION=$(date +%Y%m%d%H%M%S)
FILES=$(find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.webmanifest' -o -name '*.woff2' \) ! -path './test/*' ! -name sw.js ! -path './.git/*' | sed 's|^\./||' | sort | sed 's/.*/  "&",/')
cat > sw.js <<JS
const CACHE = 'penmaths-$VERSION';
const FILES = [
  "./",
$FILES
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok && new URL(e.request.url).origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return res; }).catch(() => caches.match('./index.html'))));
});
JS
