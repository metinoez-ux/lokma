'use client';

import { useEffect, useRef, useState } from 'react';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';

/**
 * Custom hook for FCM Web Push token management.
 * 
 * - Requests notification permission
 * - Registers service worker
 * - Gets FCM token with VAPID key
 * - Saves token to admin's Firestore document
 * - Listens for foreground messages
 */
export function useFcmToken(adminId: string | null | undefined) {
    const [token, setToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const messagingRef = useRef<Messaging | null>(null);
    const initialized = useRef(false);

    useEffect(() => {
        if (!adminId || initialized.current) return;
        initialized.current = true;

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.warn('⚠️ NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — web push disabled');
            return;
        }

        async function initFcm() {
            try {
                // Check browser support
                const supported = await isSupported();
                if (!supported) {
                    console.warn('⚠️ FCM not supported in this browser');
                    setPermissionStatus('unsupported');
                    return;
                }

                // Request permission
                const permission = await Notification.requestPermission();
                setPermissionStatus(permission);
                if (permission !== 'granted') {
                    console.log('🚫 Notification permission denied');
                    return;
                }

                // Register service worker
                const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('✅ SW registered:', swRegistration.scope);

                // Initialize messaging
                const messaging = getMessaging(app);
                messagingRef.current = messaging;

                // Get FCM token
                const fcmToken = await getToken(messaging, {
                    vapidKey: vapidKey!,
                    serviceWorkerRegistration: swRegistration,
                });

                if (fcmToken) {
                    console.log('✅ FCM Web Token:', fcmToken.substring(0, 30) + '...');
                    setToken(fcmToken);

                    // Save token to admin's Firestore document
                    await saveTokenToFirestore(adminId!, fcmToken);
                } else {
                    console.warn('⚠️ No FCM token received');
                }

                // Listen for foreground messages
                onMessage(messaging, (payload) => {
                    console.log('📩 [Foreground] FCM message:', payload);
                    // Foreground messages are handled by OrderListener's onSnapshot
                    // We still show a notification for messages from other sources
                    if (payload.notification) {
                        const { title, body } = payload.notification;
                        if (title) {
                            new Notification(title, {
                                body: body || '',
                                icon: '/lokma_logo.png',
                                tag: `fcm-${Date.now()}`,
                            });
                        }
                    }
                });

            } catch (error) {
                console.error('❌ FCM init error:', error);
            }
        }

        initFcm();
    }, [adminId]);

    return { token, permissionStatus };
}

/**
 * Save FCM web token to admin's Firestore document.
 * Uses arrayUnion to avoid duplicates.
 */
async function saveTokenToFirestore(adminId: string, token: string) {
    try {
        const adminRef = doc(db, 'admins', adminId);
        const adminDoc = await getDoc(adminRef);

        if (adminDoc.exists()) {
            const data = adminDoc.data();
            const existingTokens: string[] = data.webFcmTokens || [];

            // Only update if token is new
            if (!existingTokens.includes(token)) {
                await updateDoc(adminRef, {
                    webFcmTokens: arrayUnion(token),
                });
                console.log('✅ FCM token saved to Firestore');
            } else {
                console.log('ℹ️ FCM token already registered');
            }
        }
    } catch (error) {
        console.error('❌ Error saving FCM token:', error);
    }
}
