/**
 * NeuroRecover service worker — conservative caching, no lockout risk.
 *
 * Strategy (chosen to make stale-cache bugs structurally impossible):
 *   • Navigations: NETWORK-FIRST. A fresh index.html (with its new hashed
 *     asset references) always wins when online; the cached shell is only
 *     an OFFLINE fallback. A deploy can therefore never be masked by SW
 *     cache — the classic self-inflicted PWA wound.
 *   • /assets/*: CACHE-FIRST. Vite content-hashes every filename, so a
 *     cached asset is immutable by construction.
 *   • Cross-origin (Supabase API, edge functions, TTS): NEVER touched —
 *     the SW passes them straight through.
 *
 * Bump CACHE_VERSION to force a clean sweep of old caches on activate.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {}) // offline install — fallback fills on first fetch
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs pass through untouched

  // Navigations: network-first, offline falls back to the cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only the app root may refresh the offline shell. Marketing routes
          // are prerendered to their OWN html, so caching any navigation here
          // would store (say) the worksheets page as the global offline
          // fallback and serve it in place of the app.
          if (res.ok && url.pathname === '/') {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(OFFLINE_URL, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then(
            (cached) =>
              cached ??
              new Response('You are offline. Please reconnect and try again.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
              })
          )
        )
    );
    return;
  }

  // Content-hashed build assets: cache-first (immutable by construction).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
  }
});
