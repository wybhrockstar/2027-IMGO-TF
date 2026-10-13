const CACHE = 'imgo-v3';

// 앱 껍데기 — 설치 시 미리 캐시 (하나가 실패해도 설치는 계속됨)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon_192.png',
  './icons/icon_512.png',
  './icons/icon_192_maskable.png',
  './icons/icon_512_maskable.png',
  './fonts/neolli.woff2',
  './fonts/cocoa.woff2'
];
// 외부 파일 (CORS 없이 저장)
const PRECACHE_EXT = [
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// 절대 캐시하지 않을 패턴 (항상 네트워크 직행)
const BYPASS = [
  /api\.github\.com/,
  /raw\.githubusercontent\.com/,
  /calendar\.googleapis\.com/,
  /accounts\.google\.com/,
  /script\.google\.com/,          // 뽀개기·모의고사 동기화 (Apps Script)
  /googleusercontent\.com/        // Apps Script 리다이렉트 응답
];

const okRes = res => res && (res.ok || res.type === 'opaque');

// ── install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled([
        ...PRECACHE.map(u => c.add(u)),
        ...PRECACHE_EXT.map(u => c.add(new Request(u, { mode: 'no-cors' })))
      ]))
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
  const req = e.request, url = req.url;
  if (req.method !== 'GET') return;

  // API 등 — 캐시 우회
  if (BYPASS.some(p => p.test(url))) return;

  // HTML — network-first (최신 우선, 오프라인 시 캐시 fallback)
  if (req.mode === 'navigate' || /\.html(\?|$)/.test(url)) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (okRes(res)) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then(r => r || caches.match('./index.html', { ignoreSearch: true }))
            .then(r => r || caches.match('./'))
            .then(r => r || Response.error())
        )
    );
    return;
  }

  // data.json — network-first, 주소 뒤 ?v=시각 은 떼고 하나로 저장 (오프라인 fallback)
  if (/\/data\.json(\?|$)/.test(url)) {
    const key = url.split('?')[0];
    e.respondWith(
      fetch(req)
        .then(res => {
          if (okRes(res)) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(key, clone)); }
          return res;
        })
        .catch(() => caches.match(key).then(r => r || Response.error()))
    );
    return;
  }

  // 정적 자원 — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (okRes(res)) c.put(req, res.clone());
          return res;
        }).catch(() => null);
        return cached || network.then(r => r || Response.error());
      })
    )
  );
});
