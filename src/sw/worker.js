/* eslint-disable */
/**
 * Spelling Adventure 3D service worker (plain JS, served from /public).
 *
 * Strategy:
 * - The app shell ("/") is served from cache and refreshed in the background.
 * - Hashed build assets under /_next/static/ are cache-first (immutable).
 * - Other same-origin GETs (manifest, icons) are stale-while-revalidate.
 * - Everything else (non-GET, cross-origin, dev/HMR endpoints) passes through.
 *
 * The cache name includes the build id. The /sw.js route (src/app/sw.js)
 * stamps it into the script as self.__SA3D_BUILD__ so every build is a
 * byte-different worker and browsers notice the update; a ?v= query on the
 * script URL is accepted as a fallback. Old caches are removed only after the
 * new worker has installed its shell and activated.
 */
const VERSION = self.__SA3D_BUILD__ || new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "sa3d-";
const CACHE_NAME = CACHE_PREFIX + VERSION;
const SHELL_URL = "/";
const INSTALL_PRECACHE = [SHELL_URL, "/manifest.webmanifest"];

/** @returns {"ignore"|"shell"|"static"|"asset"} */
function classifyRequest(request, origin) {
  if (request.method !== "GET") return "ignore";
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return "ignore";
  }
  if (url.origin !== origin) return "ignore";
  if (request.mode === "navigate") return url.pathname === SHELL_URL ? "shell" : "ignore";
  if (url.pathname.startsWith("/_next/static/")) return "static";
  if (url.pathname.startsWith("/_next/")) return "ignore";
  if (url.pathname === "/sw.js") return "ignore";
  return "asset";
}

function cacheNameFor(version) {
  return CACHE_PREFIX + version;
}

async function putIfOk(cache, key, response) {
  if (response && response.ok) {
    try {
      await cache.put(key, response.clone());
    } catch {
      // Quota or opaque response: serve without caching.
    }
  }
  return response;
}

async function handleShell(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(SHELL_URL);
  const refresh = fetch(request)
    .then((response) => putIfOk(cache, SHELL_URL, response))
    .catch(() => undefined);
  if (cached) {
    // Keep the refresh alive without blocking the response.
    refresh.catch(() => undefined);
    return cached;
  }
  const fresh = await refresh;
  if (fresh) return fresh;
  return new Response("Offline and the game has not been cached yet.", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}

async function handleStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return putIfOk(cache, request, response);
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => putIfOk(cache, request, response))
    .catch(() => undefined);
  if (cached) return cached;
  const fresh = await refresh;
  return fresh || Response.error();
}

async function precache(urls) {
  const cache = await caches.open(CACHE_NAME);
  let cached = 0;
  const failed = [];
  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (existing) {
        cached += 1;
        continue;
      }
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      await cache.put(url, response);
      cached += 1;
    } catch (error) {
      failed.push(url);
    }
  }
  return { cached, failed };
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // The shell must succeed; the manifest is best effort.
      const shell = await fetch(SHELL_URL, { cache: "no-cache" });
      if (!shell.ok) throw new Error("shell fetch failed: " + shell.status);
      await cache.put(SHELL_URL, shell);
      for (const url of INSTALL_PRECACHE.slice(1)) {
        try {
          const response = await fetch(url, { cache: "no-cache" });
          await putIfOk(cache, url, response);
        } catch {
          // Optional.
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
      await broadcast({ type: "sw-activated", version: VERSION });
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const kind = classifyRequest(event.request, self.location.origin);
  if (kind === "shell") event.respondWith(handleShell(event.request));
  else if (kind === "static") event.respondWith(handleStatic(event.request));
  else if (kind === "asset") event.respondWith(handleAsset(event.request));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const reply = (message) => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(message);
    else if (event.source) event.source.postMessage(message);
  };
  if (data.type === "precache" && Array.isArray(data.urls)) {
    event.waitUntil(
      precache(data.urls).then(
        (result) =>
          reply({
            type: "precache-result",
            version: VERSION,
            ok: result.failed.length === 0,
            cached: result.cached,
            failed: result.failed,
          }),
        (error) =>
          reply({
            type: "precache-result",
            version: VERSION,
            ok: false,
            cached: 0,
            failed: data.urls,
            error: String(error),
          }),
      ),
    );
  } else if (data.type === "get-version") {
    reply({ type: "version", version: VERSION });
  }
});

// Exposed for unit tests that evaluate this file in a sandbox.
self.__sa3dServiceWorker = { classifyRequest, cacheNameFor, VERSION, CACHE_NAME };
