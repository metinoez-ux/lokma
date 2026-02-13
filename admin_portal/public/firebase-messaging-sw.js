// Firebase Messaging Service Worker
// Handles background push notifications when admin portal tab is not active

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyA-GSWm0DtaagUw5tvO4kTv085du53j_Wk',
    authDomain: 'aylar-a45af.firebaseapp.com',
    projectId: 'aylar-a45af',
    storageBucket: 'aylar-a45af.firebasestorage.app',
    messagingSenderId: '259070566992',
    appId: '1:259070566992:web:25b92a0015a33d921e2755',
});

const messaging = firebase.messaging();

// Handle background messages (when tab is not focused/active)
messaging.onBackgroundMessage((payload) => {
    console.log('📩 [SW] Background message received:', payload);

    const title = payload.notification?.title || '🔔 Yeni Bildirim';
    const body = payload.notification?.body || '';
    const icon = '/lokma_logo.png';
    const tag = payload.data?.orderId || `notification-${Date.now()}`;

    // Show notification with native OS sound
    self.registration.showNotification(title, {
        body,
        icon,
        tag,
        badge: '/lokma_logo.png',
        requireInteraction: true,
        silent: false,  // Enable native OS notification sound
        vibrate: [200, 100, 200, 100, 200],  // Vibrate pattern for mobile
        data: payload.data || {},
        actions: [
            { action: 'open', title: 'Görüntüle' },
        ],
    });

    // Post message to any open admin tab to play gong sound
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
            client.postMessage({
                type: 'PLAY_NOTIFICATION_SOUND',
                payload: payload.data,
            });
        });
    });
});

// Handle notification click — open admin portal
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ [SW] Notification clicked:', event);
    event.notification.close();

    const orderId = event.notification.data?.orderId;
    const targetUrl = orderId
        ? `/admin/dashboard?orderId=${orderId}`
        : '/admin/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if available
            for (const client of clientList) {
                if (client.url.includes('/admin') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new tab
            return clients.openWindow(targetUrl);
        })
    );
});
