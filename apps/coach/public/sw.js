/*
 * 풀림 입시코치 — service worker (plain JS, served as-is from /sw.js).
 *
 * Strategy:
 *   - navigation requests (HTML): network-first, fall back to cache, then to
 *     the precached /offline page when fully offline.
 *   - static build assets (/_next/static, icons, fonts): stale-while-revalidate.
 *   - /api/*: NEVER cached — always go to the network (they're POST anyway).
 *
 * Bump CACHE_VERSION on shell changes; activate() prunes old caches.
 * No web push. No background sync.
 */
const CACHE_VERSION = 'v1'
const CACHE_NAME = `pullim-coach-${CACHE_VERSION}`
const OFFLINE_URL = '/offline'

// App shell + offline fallback precached on install.
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // addAll is atomic; tolerate individual misses (e.g. shell variants).
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {}),
        ),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('pullim-coach-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    /\.(?:png|svg|ico|woff2?|ttf|otf|css|js|mjs|webp|avif|jpg|jpeg)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // POST/PUT (incl. /api/*) always hit network

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // let cross-origin pass through
  if (url.pathname.startsWith('/api/')) return // never cache API

  // Navigation requests → network-first, cache fallback, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(CACHE_NAME)
          const cached = await cache.match(request)
          if (cached) return cached
          const offline = await cache.match(OFFLINE_URL)
          if (offline) return offline
          return new Response('오프라인입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
      })(),
    )
    return
  }

  // Static assets → stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone())
            return res
          })
          .catch(() => undefined)
        return cached || (await network) || Response.error()
      })(),
    )
  }
})
