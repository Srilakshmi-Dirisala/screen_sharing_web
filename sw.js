// Service Worker for Screen Share App
// Provides offline capabilities and caching

const CACHE_NAME = 'screen-share-v2'; // Updated version
const urlsToCache = [
    '/',
    '/index.html',
    '/viewer.html',
    '/styles.css',
    '/script.js',
    '/viewer_fixed.js',
    '/firebase-config.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache)
                    .catch(error => {
                        console.error('Failed to cache some resources:', error);
                    });
            })
    );
    // Activate the new service worker immediately
    self.skipWaiting();
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and chrome-extension requests
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('sockjs') ||
        event.request.url.includes('hot-update')) {
        return;
    }

    // Handle API requests
    if (event.request.url.includes('/api/')) {
        // Try network first, then cache for API requests
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache the API response for offline use
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseToCache));
                    return response;
                })
                .catch(() => {
                    // If network fails, try to get from cache
                    return caches.match(event.request);
                })
        );
    } else {
        // For static assets, try cache first, then network
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Return cached response if found
                    if (response) {
                        return response;
                    }
                    // Otherwise fetch from network
                    return fetch(event.request)
                        .then(response => {
                            // Cache the response for future use
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, responseToCache));
                            return response;
                        });
                })
        );
    }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            // Take control of all clients
            return self.clients.claim();
        })
    );
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
