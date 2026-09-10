/**
 * Service worker : rend l'application utilisable sans réseau une fois installée
 * sur l'écran d'accueil. Stratégie « cache d'abord, mise à jour en arrière-plan »
 * — la page s'ouvre instantanément et la version suivante est récupérée pour la
 * prochaine ouverture.
 *
 * Les données d'entraînement ne passent PAS par ici : elles vivent dans le
 * localStorage du navigateur et ne sont jamais mises en cache ni transmises.
 */

const VERSION = 'notesport-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // `reload` : ne jamais réinstaller depuis un cache HTTP périmé.
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));

      return cached || network;
    }),
  );
});
