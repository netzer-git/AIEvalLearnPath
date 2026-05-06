// AIEvalLearnPath service worker.
//
// Strategy by resource type:
//   - Same-origin static assets (JS/CSS/SVG/font/image): cache-first.
//     Next.js prod builds hash these in the URL, so cached entries are
//     immutable per URL — no staleness risk.
//   - HTML page navigations (/, /lesson/N): network-first with cache
//     fallback. Online users always get fresh content; offline users
//     get the last cached version of any page they've already visited.
//   - /api/*: network-first with cache fallback. Same logic — fresh
//     when online, last-known-good when offline. /api/progress reads
//     the JSON file so a cached response is the previous progress
//     snapshot; writes (POST) bypass the SW (only GET is cached).
//
// Bump CACHE_VERSION to force a full re-cache on next activation.
// The activate handler also deletes any stale caches with the
// `aielearn-` prefix so old versions don't accumulate.

const CACHE_VERSION = "v1";
const CACHE_NAME = `aielearn-${CACHE_VERSION}`;

// Resources to pre-cache on install. Keep small — the rest is filled
// in cache-as-you-go on first access.
const PRECACHE = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(PRECACHE).catch(() => {
          /* tolerate missing entries on first install */
        }),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("aielearn-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs. POST and cross-origin pass through.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Don't cache Next.js dev HMR or Turbopack chunks identified by
  // _next/webpack-hmr — those need the live connection.
  if (url.pathname.includes("/_next/webpack-hmr")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets — cache-first.
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.type === "basic") {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    return offlineResponse();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    return cached || offlineResponse();
  }
}

function offlineResponse() {
  return new Response(
    "<h1>Offline</h1><p>This page hasn't been cached yet. Reconnect to load it.</p>",
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
