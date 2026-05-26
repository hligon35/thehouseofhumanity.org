// Service Worker for The House of Humanity
// Provides offline functionality and caching for better performance

const CACHE_NAME = 'thoh-v1.5';
const CORE_ASSETS = [
    '/website/index.html',
    '/website/contact-us.html',
    '/website/styles.css',
    '/website/script.js',
    '/website/site-content.js',
    '/website/images/THOHlogo-320.webp',
    '/website/images/THOHlogo.png',
    '/website/site.webmanifest',
];
const OFFLINE_FALLBACK_URL = '/website/index.html';

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await Promise.all(
                CORE_ASSETS.map((url) => cache.add(url).catch(() => undefined))
            );
            self.skipWaiting();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache).catch(() => undefined);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request).then((response) => response || caches.match(OFFLINE_FALLBACK_URL)))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache).catch(() => undefined);
                });

                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : undefined))
            );
            self.clients.claim();
        })()
    );
});