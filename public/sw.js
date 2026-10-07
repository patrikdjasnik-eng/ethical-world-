const cacheName = "ethical-world-__CACHE_VERSION__";
const appShell = __PRECACHE_JSON__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("ethical-world-") && key !== cacheName).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/health") return;
  if (!["document", "script", "style", "image", "font", "worker"].includes(request.destination)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => undefined));
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await caches.match("./");
        if (shell) return shell;
      }
      return new Response("Offline resource unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
