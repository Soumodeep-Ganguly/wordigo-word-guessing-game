/* Wordigo service worker — offline support + update flow for the built app.
 *
 * Strategies:
 *  - Precache the app shell at install (index.html).
 *  - Navigation requests: network-first, fall back to the cached shell so a
 *    reload with no internet still loads the app.
 *  - Hashed build assets (/assets/*): cache-first — they're immutable.
 *  - Everything else (sockets, APIs): network-only, never cached.
 *
 * Update flow:
 *  - A newly deployed index.html (different content) triggers PRECACHE_NEW.
 *  - The new SW version pre-caches the new deploy's assets in the background,
 *    then tells the app an update is available (message "update-available").
 *  - The SW does NOT skipWaiting automatically — the app shows a toast and
 *    only calls applyUpdate() when the user clicks Refresh.
 */
const CACHE_NAME = "wordigo-v1";

/** Returns the asset URLs referenced by an index.html document. */
async function assetsOf(html) {
  const urls = [];
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) urls.push(m[1]);
  return urls;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const res = await fetch("/index.html", { cache: "no-store" });
  cache.put("/index.html", res.clone());
  const assets = await assetsOf(await res.text());
  await Promise.all(
    assets.map((u) =>
      fetch(u)
        .then((r) => (r.ok ? cache.put(u, r.clone()) : undefined))
        .catch(() => undefined)
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell()
      .catch(() => undefined) // dev-mode or first-run races: runtime caching still works
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Refresh the offline shell in the background when a deploy changed it.
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match("/index.html");
      const cachedText = cached ? await cached.text() : "";
      try {
        const net = await fetch("/index.html", { cache: "no-store" });
        const netText = await net.text();
        if (netText !== cachedText) {
          await precacheShell();
          const clients = await self.clients.matchAll();
          clients.forEach((c) => c.postMessage({ type: "update-available" }));
        }
      } catch {
        // Offline activation — keep serving the cached shell.
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never touch socket.io / API traffic — it must fail fast when offline.
  if (url.pathname.startsWith("/socket.io") || url.pathname.includes("/api/")) {
    return;
  }

  // Cross-origin requests (e.g. CDNs) are bypassed — keep it simple.
  if (url.origin !== self.location.origin) return;

  // App shell / navigations: network-first, cache fallback.
  if (req.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Hashed build assets: cache-first (immutable content).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
      )
    );
  }
});

// Apply a pending update when the user accepts it in the app UI.
self.addEventListener("message", (event) => {
  if (event.data === "apply-update") {
    self.skipWaiting();
  }
});
