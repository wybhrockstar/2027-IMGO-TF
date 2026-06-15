const CACHE = 'imgo-v1';

// 앱 껍데기 — 설치 시 미리 캐시
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon_192.png',
  './icons/icon_512.png',
  './icons/icon_192_maskable.png',
  './icons/icon_512_maskable.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

// 절대 캐시하지 않을 패턴 (항상 네트워크 직행)
const BYPASS = [
  /api\.github\.com/,
  /raw\.githubusercontent\.com/,
  /calendar\.googleapis\.com/,
  /accounts\.google\.com/
];

// ── install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── activate ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API 등 — 캐시 우회
  if (BYPASS.some(p => p.test(url))) return;

  // HTML — network-first (최신 우선, 오프라인 시 캐시 fallback)
  if (e.request.mode === 'navigate' || /\.html$/.test(url)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 정적 자원 — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          c.put(e.request, res.clone());
          return res;
        }).catch(() => {});
        return cached || network;
      })
    )
  );
});
