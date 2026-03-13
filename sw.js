// Service Worker for Dynamic TX Entertainment
// Increment version on every deploy to bust the SW cache
const CACHE_VERSION = 'dtxent-v3.0.0';
const DYNAMIC_CACHE = 'dtxent-dynamic-v3';

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    self.skipWaiting();
});

// Activate event - clean ALL old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== DYNAMIC_CACHE)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - network first for everything, cache as offline fallback only
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Let cross-origin requests go straight to network (no SW interception)
    if (url.origin !== location.origin) return;

    // Network first, cache fallback for same-origin requests only
    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache successful same-origin responses for offline use
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
