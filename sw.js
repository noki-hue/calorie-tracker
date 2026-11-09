self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    // For now, just let the browser handle requests normally
});
