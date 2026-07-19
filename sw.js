const CACHE_NAME = 'soscoop-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/audio-service.js',
  './js/geo-service.js',
  './js/network-service.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precargando assets PWA');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Limpiando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Manejo de eventos de clic en notificación push para traer la app al frente o abrirla
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la PWA ya está abierta (en segundo plano o pestaña), la enfocamos de inmediato
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Si estaba cerrada, abrimos la página principal en una nueva ventana/pestaña
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

// Manejo de recepción de Push remoto (cuando el servidor emite alerta)
self.addEventListener('push', (event) => {
  let data = { title: '🚨 SOSCOOP ALERTA POLICIAL', body: 'Alerta entrante en la unidad BICRIM SAN JAVIER.' };
  if (event.data) {
    try {
      const parsed = event.data.json();
      data.title = parsed.title || data.title;
      data.body = parsed.body || data.body;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './assets/icons/icon-192.svg',
    badge: './assets/icons/icon-192.svg',
    vibrate: [500, 200, 500, 200, 500, 200, 500],
    requireInteraction: true,
    tag: 'soscoop-emergency'
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

