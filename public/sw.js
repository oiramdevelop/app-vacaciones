// Service worker mínimo. Sólo hace que la app sea instalable y muestre una pantalla "sin conexión"
// cuando falla una navegación. NO cachea páginas ni datos: los saldos y solicitudes son datos personales
// que siempre deben venir del servidor. Si se cambia /offline.html, subir la versión de CACHE.
const CACHE = "vacaciones-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // el resto va siempre a red
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
