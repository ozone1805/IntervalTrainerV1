/**
 * Offline shell for the trainer.
 *
 * `__BUILD_ID__` and `__PRECACHE__` are placeholders rewritten by
 * `scripts/inject-sw-manifest.mjs` after every `vite build`, because the JS and
 * CSS filenames are content-hashed and so are not knowable when this is written.
 * Editing this file by hand is fine; editing `dist/sw.js` is not.
 */
const BUILD_ID = "3d207189b8f1";
const CACHE_NAME = `interval-trainer-${BUILD_ID}`;
const PRECACHE = [
  "./",
  "./apple-touch-icon.png",
  "./assets/index-BuDdudPv.js",
  "./assets/index-spZFgAQR.css",
  "./audio/salamander/A2.mp3",
  "./audio/salamander/A3.mp3",
  "./audio/salamander/A4.mp3",
  "./audio/salamander/A5.mp3",
  "./audio/salamander/C2.mp3",
  "./audio/salamander/C3.mp3",
  "./audio/salamander/C4.mp3",
  "./audio/salamander/C5.mp3",
  "./audio/salamander/C6.mp3",
  "./audio/salamander/Ds2.mp3",
  "./audio/salamander/Ds3.mp3",
  "./audio/salamander/Ds4.mp3",
  "./audio/salamander/Ds5.mp3",
  "./audio/salamander/Fs2.mp3",
  "./audio/salamander/Fs3.mp3",
  "./audio/salamander/Fs4.mp3",
  "./audio/salamander/Fs5.mp3",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Individually rather than cache.addAll, which rejects the whole install
      // if any single request fails. A missing piano sample should not cost the
      // user their offline app shell.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations go to the network first so a new deploy is picked up as soon as
  // there is a connection, with the cached shell as the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put("./", copy));
          return response;
        })
        // Keyed on "./" to match what install precached — the app is opened at
        // the scope root, not at an explicit /index.html.
        .catch(() => caches.match("./").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Everything else is content-hashed or an immutable sample, so cache wins and
  // anything new gets cached on the way past.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
