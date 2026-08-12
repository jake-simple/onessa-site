const IMAGE_CACHE_PREFIX = "kids-cafe-official-images-";
const IMAGE_CACHE_NAME = IMAGE_CACHE_PREFIX + "v1";
const MAX_CACHE_ENTRIES = 160;
const OFFICIAL_IMAGE_ORIGIN = "https://umppa.seoul.go.kr";
const OFFICIAL_IMAGE_PATH = "/icare/upload/fcltyInfoManage/";

function isOfficialFacilityImage(request) {
  if (request.method !== "GET" || request.destination !== "image") return false;
  const url = new URL(request.url);
  return url.origin === OFFICIAL_IMAGE_ORIGIN && url.pathname.startsWith(OFFICIAL_IMAGE_PATH);
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  const overflowCount = keys.length - MAX_CACHE_ENTRIES;
  if (overflowCount <= 0) return;
  await Promise.all(keys.slice(0, overflowCount).map((request) => cache.delete(request)));
}

async function cacheFirst(request) {
  let cache;
  try {
    cache = await caches.open(IMAGE_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    return fetch(request);
  }

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    try {
      await cache.put(request, response.clone());
      await trimImageCache(cache);
    } catch {
      // 저장 공간이나 응답 형식 문제로 캐싱하지 못해도 원본 이미지는 표시한다.
    }
  }
  return response;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName.startsWith(IMAGE_CACHE_PREFIX) && cacheName !== IMAGE_CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (!isOfficialFacilityImage(event.request)) return;
  event.respondWith(cacheFirst(event.request));
});
