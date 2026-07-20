/* Service worker for the 14ers map. Must live at the repo root: a service
   worker's default scope is the directory it's served from, so anywhere else
   it could not control index.html, app.js, style.css or data.js at the root.

   Two caches, two strategies:
   - SHELL: the app's own files (this page, its CSS/JS/data, the manifest and
     icons). Network-first, so a deploy is picked up on the next successful
     load; falls back to cache when offline.
   - TILES: map tiles and the MapLibre library from other origins. These are
     effectively immutable, so cache-first -- once a tile has been seen, it
     works offline. Nothing is pre-fetched; only areas you've actually viewed
     are available offline. */

const VERSION = "v1";
const SHELL_CACHE = `14ers-shell-${VERSION}`;
const TILE_CACHE = `14ers-tiles-${VERSION}`;

const SHELL_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./pwa/icons/icon-192.png",
  "./pwa/icons/icon-512.png",
  "./pwa/icons/icon-maskable-512.png",
  "./pwa/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isShellRequest = (url) =>
  url.origin === self.location.origin &&
  (SHELL_URLS.some((p) => url.pathname.endsWith(p.replace("./", "/"))) ||
    url.pathname === new URL("./", self.location).pathname);

// Tiles (OpenFreeMap, Esri hillshade, OpenTopoMap) and the MapLibre CDN bundle.
const isCacheableCrossOrigin = (url) =>
  url.origin !== self.location.origin &&
  /(tile|tiles|unpkg\.com)/.test(url.hostname + url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isShellRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // clone() has to happen synchronously, right here: the moment `res`
          // is returned it starts streaming to the page, and cloning it later
          // inside the async .then() below throws "body already used".
          const copy = res.clone();
          // event.waitUntil, not a bare .then(): respondWith() only keeps the
          // worker alive until `res` is returned, so an unchained cache write
          // races the worker being torn down and silently never lands.
          event.waitUntil(
            // Keyed by path, not the full request: the deploy workflow stamps a
            // fresh ?v=<sha> on these URLs every push, and keying on the exact
            // request would pile up one cache entry per deploy forever instead
            // of the latest version replacing the last.
            caches.open(SHELL_CACHE).then((cache) => cache.put(url.pathname, copy))
          );
          return res;
        })
        .catch(() => caches.match(url.pathname))
    );
    return;
  }

  if (isCacheableCrossOrigin(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          // Only cache successful responses -- opaque (type "opaque", status 0)
          // ones can't be checked, so those are cached as-is; a real failure
          // otherwise gets locked in as a permanently broken tile.
          if (res.type === "opaque" || res.ok) {
            // clone() synchronously, before any async gap -- see the shell
            // branch above for why a lazily-cloned response throws.
            const copy = res.clone();
            event.waitUntil(caches.open(TILE_CACHE).then((cache) => cache.put(request, copy)));
          }
          return res;
        });
      })
    );
  }
});
