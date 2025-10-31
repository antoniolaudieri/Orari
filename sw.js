const CACHE_NAME = 'orario-intelligente-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './index.js',
  './icon-192x192.png',
  './icon-512x512.png'
  // Aggiungi qui altre risorse statiche se necessario
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignora le richieste che non sono GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategia Cache-First, con fallback sulla rete
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Trovato nella cache, restituisci la risorsa salvata
          return response;
        }

        // Non trovato nella cache, effettua la richiesta di rete
        return fetch(event.request).then(
          response => {
            // Se la risposta non è valida, restituiscila così com'è
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta perché può essere letta una sola volta
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});