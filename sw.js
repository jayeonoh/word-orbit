// sw.js — 오프라인에서도 앱이 열리도록 정적 파일을 캐시합니다. (AI 호출은 캐시하지 않음)
const CACHE = 'word-orbit-v3';
const ASSETS = ['./', './index.html', './css/app.css', './js/app.js', './js/db.js', './js/srs.js', './js/ai.js', './js/data.js', './js/books.js', './js/ocr.js', './vendor/tesseract/tesseract.min.js', './vendor/tesseract/worker.min.js', './vendor/tesseract/tesseract-core-simd-lstm.wasm.js', './vendor/tesseract/eng.traineddata.gz', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Gemini 등 외부 요청은 그대로
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
