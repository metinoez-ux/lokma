'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { ButcherPartner } from '@/types';
import { doc, getDoc } from 'firebase/firestore';

export default function OrderListener() {
    const { admin } = useAdmin();
    const [butcherConfig, setButcherConfig] = useState<ButcherPartner['smartNotifications'] | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const firstLoad = useRef(true);

    // Load butcher config
    useEffect(() => {
        if (!admin?.butcherId) return;

        const loadConfig = async () => {
            // In a real app, this should probably be real-time too, or loaded from context
            // For now, we fetch once on mount
            try {
                const docRef = doc(db, 'businesses', admin.butcherId!);
                const snapshot = await getDoc(docRef);
                if (snapshot.exists()) {
                    const data = snapshot.data() as ButcherPartner;
                    setButcherConfig(data.smartNotifications || null);
                }
            } catch (e) {
                console.error("Error loading smart notifications config", e);
            }
        };
        loadConfig();
    }, [admin]);

    // Setup Audio
    useEffect(() => {
        audioRef.current = new Audio('/sounds/gong.mp3');
    }, []);

    // Listen for orders
    useEffect(() => {
        if (!admin?.butcherId) return;
        if (!butcherConfig?.enabled) return; // Don't listen if disabled

        // Query: Pending orders for this business, ordered by creation
        // We limit to recent to avoid pulling huge history
        const q = query(
            collection(db, 'meat_orders'),
            where('businessId', '==', admin.butcherId),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Skip the very first snapshot (initial load) to avoid alerting for existing orders
            if (firstLoad.current) {
                firstLoad.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    // NEW ORDER DETECTED!
                    triggerAlert(change.doc.data());
                }
            });
        });

        return () => unsubscribe();
    }, [admin?.butcherId, butcherConfig]);

    const triggerAlert = async (orderData: any) => {
        console.log("🔔 NEW ORDER ALERT!", orderData);

        // 1. Audio Alert
        if (butcherConfig?.soundEnabled && audioRef.current) {
            try {
                // User interaction usually required for audio, but often works if registered after interaction
                await audioRef.current.play();
            } catch (err) {
                console.warn("Audio play failed (browser policy?):", err);
            }
        }

        // 2. Webhook Alert
        if (butcherConfig?.webhookUrl) {
            try {
                // Fire and forget
                fetch(butcherConfig.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'new_order',
                        orderId: orderData.id || 'unknown',
                        amount: orderData.totalAmount || 0,
                        items: orderData.items?.length || 0,
                        timestamp: new Date().toISOString()
                    })
                }).catch(err => console.error("Webhook triggers failed:", err));
            } catch (e) {
                console.error("Webhook error:", e);
            }
        }

        // 3. Visual Flash (Screen)
        if (butcherConfig?.flashScreen) {
            document.body.classList.add('animate-flash-red');
            // Flash longer (5 seconds loop)
            setTimeout(() => document.body.classList.remove('animate-flash-red'), 5000);
        }

        // 4. Vibration (Mobile/Tablet)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            // Vibrate pattern: 200ms on, 100ms off, 200ms on...
            navigator.vibrate([200, 100, 200, 100, 200, 100, 500]);
        }

        // 5. Torch/Flashlight (Experimental - Phone/Tablet)
        // Requires camera permission to be granted previously
        try {
            // Check if we can access the flashlight
            // Note: This often requires a user gesture or active stream. 
            // In a real PWA context, we might keep a track open or request it here.
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as any; // Cast for TS

            if (capabilities.torch) {
                // Strobe effect: On/Off/On/Off
                const flash = async (on: boolean) => {
                    await track.applyConstraints({ advanced: [{ torch: on }] } as any);
                };

                await flash(true);
                setTimeout(async () => await flash(false), 500);
                setTimeout(async () => await flash(true), 1000);
                setTimeout(async () => await flash(false), 1500);
                setTimeout(async () => {
                    await flash(false);
                    track.stop(); // Release camera
                }, 2000);
            } else {
                track.stop();
            }
        } catch (e) {
            console.warn("Torch access denied or not available:", e);
        }
    };

    return null; // Invisible component
}
