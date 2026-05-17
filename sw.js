/**
 * studyPro Service Worker — Cache First Strategy
 * Version: studyPro-v5
 * Description: Caches the app shell for offline use. Ignores Firebase & API calls.
 */

const CACHE_NAME = 'studyPro-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: Pre-cache the app shell
self.addEventListener('install', (event) => {
  console.log('[SW] studyPro-v5 installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Cache failed:', err);
      })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] studyPro-v5 activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated and controlling clients');
      return self.clients.claim();
    })
  );
});

// Helper: Should we ignore this request?
function shouldIgnore(request) {
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') return true;

  // Ignore Firebase
  if (url.hostname.includes('firebase')) return true;
  if (url.hostname.includes('googleapis.com')) return true;
  if (url.hostname.includes('gstatic.com')) return true;
  if (url.pathname.includes('/firestore')) return true;

  // Ignore Google Auth / Identity
  if (url.hostname.includes('accounts.google.com')) return true;

  // Ignore analytics / tracking
  if (url.pathname.includes('analytics')) return true;
  if (url.pathname.includes('gtag')) return true;

  // Ignore YouTube API
  if (url.hostname.includes('youtube.com') && url.pathname.includes('/youtube/v3')) return true;
  if (url.hostname.includes('youtube.googleapis.com')) return true;

  // Ignore external HTTP (non-HTTPS) for security
  if (url.protocol === 'http:' && url.hostname !== 'localhost') return true;

  return false;
}

// Fetch: Cache-first strategy for app shell, network for everything else
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore Firebase, APIs, and non-GET requests
  if (shouldIgnore(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(request)
        .then((networkResponse) => {
          // Only cache successful same-origin responses
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }

          // Clone and cache the response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Network failed — serve offline fallback if available
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline — No cached content available.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
    })
  );
});

// Background sync (optional enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'studyPro-sync') {
    console.log('[SW] Background sync triggered');
  }
});

// Push notification support (future-proofing)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'New notification from studyPro',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'studyPro-notification',
    requireInteraction: false,
    silent: false,
    data: data.payload || {}
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'studyPro', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
