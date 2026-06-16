/**
 * EcoTrace Service Worker
 * Strategy: Cache-first for app shell assets, network-only for Gemini API calls.
 * Version the cache name so deploys trigger fresh installs automatically.
 */

const CACHE_NAME = 'ecotrace-v1';

/** Assets that make up the offline-capable app shell */
const SHELL_ASSETS = [
  './',
  './ecotrace.html',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.9.0/dist/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
];

/** Origins that must always go to the network (live API calls) */
const NETWORK_ONLY_ORIGINS = [
  'generativelanguage.googleapis.com',
];

// ── Install: pre-cache app shell ────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting()) // activate immediately
  );
});

// ── Activate: delete stale caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first with network fallback ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for Gemini API requests
  if (NETWORK_ONLY_ORIGINS.some((origin) => url.hostname.includes(origin))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful same-origin or CDN responses
        if (response.ok && (url.origin === self.location.origin || url.hostname.includes('cdn'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback for navigation requests when offline
      if (event.request.mode === 'navigate') {
        return caches.match('./ecotrace.html');
      }
    })
  );
});
