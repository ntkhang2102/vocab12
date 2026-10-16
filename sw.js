/* Service worker — Vocabulary 12
   - Phần khung app: lấy từ bộ nhớ đệm (chạy được khi không có mạng).
   - Nội dung (content/*.bin, đã mã hoá): ưu tiên mạng để nhận bản mới, mất mạng thì dùng bản đã lưu.
   Khi đổi phiên bản app: tăng VERSION bên dưới (khớp APP_VERSION trong js/core.js). */
const VERSION = '0.3.0';
const SHELL_CACHE = 'v12-shell-' + VERSION;
const CONTENT_CACHE = 'v12-content';
const FONT_CACHE = 'v12-fonts';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/auth.js', 'js/core.js', 'js/learn.js', 'js/review.js', 'js/read.js', 'js/practice.js', 'js/quiz.js',
  'js/notebook.js', 'js/speak.js', 'js/write.js', 'js/settings.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('v12-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting() });

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)) }

async function networkFirst(req) {
  const cache = await caches.open(CONTENT_CACHE);
  try {
    const res = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(5000)]);
    if (res && res.ok) cache.put(req.url.split('?')[0], res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req.url.split('?')[0]);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) { const c = await caches.open(SHELL_CACHE); c.put(req, res.clone()) }
  return res;
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).catch(() => caches.match('index.html')));
      return;
    }
    if (url.pathname.includes('/content/')) { e.respondWith(networkFirst(req)); return }
    e.respondWith(cacheFirst(req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
  }
});
