// Service Worker for Dynamic TX Entertainment
// IMPORTANT: Increment this version on every deploy that changes JS/CSS
const CACHE_NAME = 'dtxent-v2.0.0';
const STATIC_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/assets/dtxent-logo.png'
];

// Dynamic cache for runtime requests
const DYNAMIC_CACHE = 'dtxent-dynamic-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests except for specific CDNs
    if (url.origin !== location.origin) {
        // Allow caching for specific CDNs
        if (!url.hostname.includes('gstatic.com') &&
            !url.hostname.includes('googleapis.com') &&
            !url.hostname.includes('cdnjs.cloudflare.com') &&
            !url.hostname.includes('cdn.jsdelivr.net')) {
            return;
        }
    }

    // Firebase Firestore - Network first, cache fallback
    if (url.hostname.includes('firestore.googleapis.com')) {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(request))
        );
        return;
    }

    // Static assets - Cache first, network fallback
    if (STATIC_CACHE.some(path => url.pathname === path || url.pathname.endsWith(path))) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetch(request))
        );
        return;
    }

    // Images - Cache first with network update
    if (request.destination === 'image') {
        event.respondWith(
            caches.open(DYNAMIC_CACHE).then(cache => {
                return cache.match(request).then(response => {
                    const fetchPromise = fetch(request).then(networkResponse => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => response);

                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // Everything else - Network first, cache fallback
    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache successful responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// Background sync for offline form submissions (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'newsletter-sync') {
        console.log('[SW] Syncing newsletter submissions...');
        // Could implement offline newsletter signup here
    }
});
