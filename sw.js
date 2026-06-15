const CACHE_VERSION = 'imgo-v1';
const PRECACHE = [
  './index.html',
  './admin.html',
  './manifest.json',
  './manifest-admin.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/icon-admin-192.png',
  './icons/icon-admin-512.png',
  './icons/icon-admin-192-maskable.png',
  './icons/icon-admin-512-maskable.png'
];

// 캐시하지 않고 항상 네트워크로 직접 보내야 하는 요청 (API, 인증 등)
const NETWORK_ONLY_HOSTS = [
  'api.github.com',
  'www.googleapis.com',
  'accounts.google.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // GET 요청만 처리
  if (req.method !== 'GET') return;

  // GitHub / Google API 등은 캐시하지 않고 네트워크로 직행
  if (NETWORK_ONLY_HOSTS.includes(url.hostname)) return;

  // HTML 문서: network-first (최신 버전 우선, 오프라인 시 캐시로 대체)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 정적 자원: cache-first, 백그라운드에서 갱신 (stale-while-revalidate)
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
