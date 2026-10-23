const CACHE = 'penmaths-20261023122243';
const FILES = [
  "./",
  "css/style.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "js/app.js",
  "js/content.js",
  "js/db.js",
  "js/ink.js",
  "js/mathcheck.js",
  "js/recognizer.js",
  "manifest.webmanifest",
  "vendor/fonts/KaTeX_AMS-Regular.woff2",
  "vendor/fonts/KaTeX_Caligraphic-Bold.woff2",
  "vendor/fonts/KaTeX_Caligraphic-Regular.woff2",
  "vendor/fonts/KaTeX_Fraktur-Bold.woff2",
  "vendor/fonts/KaTeX_Fraktur-Regular.woff2",
  "vendor/fonts/KaTeX_Main-Bold.woff2",
  "vendor/fonts/KaTeX_Main-BoldItalic.woff2",
  "vendor/fonts/KaTeX_Main-Italic.woff2",
  "vendor/fonts/KaTeX_Main-Regular.woff2",
  "vendor/fonts/KaTeX_Math-BoldItalic.woff2",
  "vendor/fonts/KaTeX_Math-Italic.woff2",
  "vendor/fonts/KaTeX_SansSerif-Bold.woff2",
  "vendor/fonts/KaTeX_SansSerif-Italic.woff2",
  "vendor/fonts/KaTeX_SansSerif-Regular.woff2",
  "vendor/fonts/KaTeX_Script-Regular.woff2",
  "vendor/fonts/KaTeX_Size1-Regular.woff2",
  "vendor/fonts/KaTeX_Size2-Regular.woff2",
  "vendor/fonts/KaTeX_Size3-Regular.woff2",
  "vendor/fonts/KaTeX_Size4-Regular.woff2",
  "vendor/fonts/KaTeX_Typewriter-Regular.woff2",
  "vendor/katex.min.css",
  "vendor/katex.min.js",
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok && new URL(e.request.url).origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return res; }).catch(() => caches.match('./index.html'))));
});
