'use client';

import { useEffect, useRef, useCallback } from 'react';
import { collection, collectionGroup, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useTranslations } from 'next-intl';

/**
 * OrderListener — Global browser notification component
 * 
 * Sits in the admin layout and listens for new orders in real-time.
 * When a new order arrives:
 * 🔔 Plays a gong/bell sound
 * 🚨 Flashes the screen red
 * 📱 Shows browser push notification
 * 📳 Vibrates (mobile/tablet)
 * 
 * Also registers FCM Web Push token for background notifications
 * (when tab is closed or browser is in background).
 * 
 * Controlled by admin.smartNotifications settings from the Settings page.
 */
export default function OrderListener() {
 
 const t = useTranslations('AdminComponentOrderListener');
const { admin } = useAdmin();
 const audioRef = useRef<HTMLAudioElement | null>(null);
 const firstLoad = useRef(true);
 const firstLoadTabs = useRef(true);
 const tabItemCounts = useRef<Record<string, number>>({});
 const notificationPermissionAsked = useRef(false);

 // Register FCM web push token for background notifications
 useFcmToken(admin?.id);

 // Resolve the business ID via shared hook
 const businessId = useAdminBusinessId();

 // Get smart notification settings (with sensible defaults)
 const settings = admin?.smartNotifications || {};
 const enabled = settings.enabled !== false; // Default: on
 const soundEnabled = settings.soundEnabled !== false; // Default: on
 const flashScreen = settings.flashScreen !== false; // Default: on

 // Pre-load audio
 useEffect(() => {
 audioRef.current = new Audio('/sounds/gong.wav');
 audioRef.current.volume = 1.0;
 // Pre-load to avoid delay on first play
 audioRef.current.load();
 }, []);

 // Request notification permission on first interaction
 useEffect(() => {
 if (notificationPermissionAsked.current) return;
 if (typeof Notification === 'undefined') return;
 if (Notification.permission === 'default') {
 // We'll ask for permission when the first order comes in,
 // or the user can grant it via browser
 const askPermission = () => {
 Notification.requestPermission();
 notificationPermissionAsked.current = true;
 document.removeEventListener('click', askPermission);
 };
 document.addEventListener('click', askPermission, { once: true });
 }
 }, []);

 // Trigger all alert mechanisms
 const triggerAlert = useCallback((orderData: any) => {
 const orderNum = orderData.orderNumber || t('yeni');
 const total = orderData.totalPrice || orderData.totalAmount || orderData.total || 0;
 const customerName = orderData.customerName || orderData.userDisplayName || '';

 console.log(t('yeni_si_pari_s'), { orderNum, total, customerName });

 // 1. 🔔 GONG SOUND
 if (soundEnabled && audioRef.current) {
 // Clone the audio so multiple rapid orders don't overlap awkwardly
 const sound = audioRef.current.cloneNode() as HTMLAudioElement;
 sound.volume = 1.0;
 sound.play().catch(err => {
 console.warn('Audio play failed (browser policy?):', err);
 });
 }

 // 2. 🚨 SCREEN FLASH (red pulsing overlay)
 if (flashScreen) {
 // Create a full-screen overlay for the flash effect
 const overlay = document.createElement('div');
 overlay.id = 'order-flash-overlay';
 overlay.style.cssText = `
 position: fixed; inset: 0; z-index: 9999;
 background: rgba(239, 68, 68, 0.4);
 pointer-events: none;
 animation: flash-red 0.8s ease-in-out 4;
 `;
 document.body.appendChild(overlay);
 // Remove after animation
 setTimeout(() => {
 overlay.remove();
 }, 3500);
 }

 // 3. 📱 BROWSER NOTIFICATION
 if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
 try {
 new Notification(t('yeni_siparis'), {
 body: `${customerName ? customerName + ' — ' : ''}€${Number(total).toFixed(2)} • #${orderNum}`,
 icon: '/lokma_logo.png',
 tag: `order-${orderData.id || Date.now()}`, // Prevent duplicate notifications
 requireInteraction: true, // Keep notification visible until dismissed
 });
 } catch (err) {
 console.warn('Browser notification failed:', err);
 }
 }

 // 4. 📳 VIBRATION (mobile/tablet)
 if (typeof navigator !== 'undefined' && navigator.vibrate) {
 navigator.vibrate([300, 100, 300, 100, 500]);
 }
 }, [soundEnabled, flashScreen]);

 // Listen for new orders AND reservation check-ins (Normal Admin)
 useEffect(() => {
 if (!businessId) return;
 if (!enabled) return;

 // Reset firstLoad flags when businessId or enabled changes
 firstLoad.current = true;
 firstLoadTabs.current = true;

  // 1. Listen for new pending orders
  const isKermesAdmin = admin?.businessType === 'kermes' || !!admin?.kermesId || ['kermes', 'kermes_staff', 'kermes_admin', 'mutfak', 'garson', 'teslimat'].includes(admin?.adminType || '');
  const qOrders = isKermesAdmin
    ? query(
        collection(db, 'kermes_orders'),
        where('kermesId', '==', businessId),
        where('status', '==', 'pending')
      )
    : query(
        collection(db, 'meat_orders'),
        where('businessId', '==', businessId),
        where('status', '==', 'pending')
      );

  const unsubOrders = onSnapshot(qOrders, (snapshot) => {
 if (firstLoad.current) {
 firstLoad.current = false;
 return;
 }

 snapshot.docChanges().forEach((change) => {
 if (change.type === 'added') {
 triggerAlert({ id: change.doc.id, ...change.doc.data() });
 }
 });
 }, (err) => { console.error("Firestore onSnapshot Error:", err); });

 // 2. Listen for reservation check-ins (tabStatus === 'seated')
 const qTabs = query(
 collection(db, 'businesses', businessId, 'reservations'),
 where('tabStatus', '==', 'seated')
 );

 const unsubTabs = onSnapshot(qTabs, (snapshot) => {
 if (firstLoadTabs.current) {
 firstLoadTabs.current = false;
 snapshot.docs.forEach((doc) => {
 const data = doc.data();
 tabItemCounts.current[doc.id] = (data.tabItems || data.preOrderItems || []).length;
 });
 return;
 }

 snapshot.docChanges().forEach((change) => {
 const data = change.doc.data();
 const currentCount = (data.tabItems || data.preOrderItems || []).length;
 const prevCount = tabItemCounts.current[change.doc.id] || 0;

 if (change.type === 'added') {
 // It just checked in (transitioned to 'seated')
 tabItemCounts.current[change.doc.id] = currentCount;
 if (currentCount > 0) {
 triggerAlert({
 id: change.doc.id,
 orderNumber: `R-${change.doc.id.substring(0, 5).toUpperCase()}`,
 totalPrice: data.pendingBalance || data.preOrderTotal || 0,
 customerName: data.userName || data.customerName,
 ...data
 });
 }
 } else if (change.type === 'modified') {
 // Added more items to an already seated tab
 if (currentCount > prevCount) {
 tabItemCounts.current[change.doc.id] = currentCount;
 triggerAlert({
 id: change.doc.id,
 orderNumber: `R-${change.doc.id.substring(0, 5).toUpperCase()} (EK SİPARİŞ)`,
 totalPrice: data.pendingBalance || data.preOrderTotal || 0,
 customerName: data.userName || data.customerName,
 ...data
 });
 }
 } else if (change.type === 'removed') {
 delete tabItemCounts.current[change.doc.id];
 }
 });
 }, (err) => { console.error("Firestore onSnapshot Error:", err); });

 return () => {
 unsubOrders();
 unsubTabs();
 };
 }, [businessId, enabled, triggerAlert, t]);

 // Also listen for super admins (all businesses)
 useEffect(() => {
 if (admin?.adminType !== 'super') return;
 if (!enabled) return;

 firstLoad.current = true;
 firstLoadTabs.current = true;

 // 1. All pending meat_orders
  const qOrders = query(
    collection(db, 'meat_orders'),
    where('status', '==', 'pending')
  );

 const unsubOrders = onSnapshot(qOrders, (snapshot) => {
 if (firstLoad.current) {
 firstLoad.current = false;
 return;
 }

 snapshot.docChanges().forEach((change) => {
 if (change.type === 'added') {
 triggerAlert({ id: change.doc.id, ...change.doc.data() });
 }
 });
 }, (err) => { console.error("Firestore onSnapshot Error:", err); });

 // 2. All seated reservations
 const qTabs = query(
 collectionGroup(db, 'reservations'),
 where('tabStatus', '==', 'seated')
 );

 const unsubTabs = onSnapshot(qTabs, (snapshot) => {
 if (firstLoadTabs.current) {
 firstLoadTabs.current = false;
 snapshot.docs.forEach((doc) => {
 const data = doc.data();
 tabItemCounts.current[doc.id] = (data.tabItems || data.preOrderItems || []).length;
 });
 return;
 }

 snapshot.docChanges().forEach((change) => {
 const data = change.doc.data();
 const currentCount = (data.tabItems || data.preOrderItems || []).length;
 const prevCount = tabItemCounts.current[change.doc.id] || 0;

 if (change.type === 'added') {
 tabItemCounts.current[change.doc.id] = currentCount;
 if (currentCount > 0) {
 triggerAlert({
 id: change.doc.id,
 orderNumber: `R-${change.doc.id.substring(0, 5).toUpperCase()}`,
 totalPrice: data.pendingBalance || data.preOrderTotal || 0,
 customerName: data.userName || data.customerName,
 ...data
 });
 }
 } else if (change.type === 'modified') {
 if (currentCount > prevCount) {
 tabItemCounts.current[change.doc.id] = currentCount;
 triggerAlert({
 id: change.doc.id,
 orderNumber: `R-${change.doc.id.substring(0, 5).toUpperCase()} (EK SİPARİŞ)`,
 totalPrice: data.pendingBalance || data.preOrderTotal || 0,
 customerName: data.userName || data.customerName,
 ...data
 });
 }
 } else if (change.type === 'removed') {
 delete tabItemCounts.current[change.doc.id];
 }
 });
 }, (err) => { console.error("Firestore onSnapshot Error:", err); });

 return () => {
 unsubOrders();
 unsubTabs();
 };
 }, [admin?.adminType, enabled, triggerAlert]);

 return null; // Invisible component — renders nothing
}
