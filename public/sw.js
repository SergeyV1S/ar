const CACHE = "metrika-offline-v2";
const SCOPE = self.registration.scope;
const entry = new URL("./", SCOPE);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch(entry, { cache: "reload" });
      if (!page.ok) throw new Error("Application shell unavailable");
      await cache.put(entry, page.clone());
      const html = await page.text();
      const assets = new Set(
        ["./icon.svg", "./app.webmanifest", "./catalog-furniture.png"].map(
          (asset) => new URL(asset, entry).href
        )
      );
      for (const match of html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g))
        assets.add(new URL(match[1], entry).href);
      for (const url of [...assets]) {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok) throw new Error("Application asset unavailable");
        await cache.put(url, response.clone());
        if (url.endsWith(".css")) {
          const css = await response.text();
          for (const part of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
            const asset = new URL(part[2], url);
            if (asset.origin === entry.origin) assets.add(asset.href);
          }
        }
      }
      await Promise.all(
        [...assets].map(async (url) => {
          if (!(await cache.match(url))) await cache.add(url);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith("metrika-offline-") && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  )
);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== entry.origin || !url.href.startsWith(entry.href))
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(entry, response.clone());
          return response;
        } catch {
          return (await cache.match(entry)) ?? Response.error();
        }
      }
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })()
  );
});
