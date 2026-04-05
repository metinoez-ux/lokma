'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, collectionGroup, getDocs, doc, updateDoc, deleteField, query, orderBy, where, onSnapshot, Timestamp, increment, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { ORDER_STATUSES, ORDER_TYPES, type Order, type OrderStatus, mapReservationToOrder } from '@/hooks/useOrders';
import OrderDetailsModal from '@/components/admin/OrderDetailsModal';
import OrderCard from '@/components/admin/OrderCard';
import KermesScannerModal from '@/components/admin/KermesScannerModal';

import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';
import {
 printOrder, testPrint, PrinterSettings, DEFAULT_PRINTER_SETTINGS,
 checkHealth, sendPrinterAlert, PrinterHealthState, DEFAULT_HEALTH_STATE,
 PrintRetryQueue, requestWakeLock,
} from '@/services/printerService';

// Order status/type constants imported from useOrders hook (i18n key-based)
const orderStatuses = ORDER_STATUSES;
const orderTypes = ORDER_TYPES;




export default function OrdersPage() {
 const t = useTranslations('AdminPortal.Orders');
 const locale = useLocale();
 // Map next-intl locale codes to BCP-47 locale tags for date/time formatting
 const dateLocale = locale === 'de' ? 'de-DE' : locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : locale === 'nl' ? 'nl-NL' : 'de-DE';
 const { admin, loading: adminLoading } = useAdmin();
 const adminBusinessId = useAdminBusinessId();

 const [meatOrders, setMeatOrders] = useState<Order[]>([]);
 const [resOrders, setResOrders] = useState<Order[]>([]);
 
 // Derived orders array from both canonical streams
 const orders = useMemo(() => {
 return [...meatOrders, ...resOrders].sort((a, b) => {
 const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
 const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
 return bTime - aTime;
 });
 }, [meatOrders, resOrders]);

 const [businesses, setBusinesses] = useState<Record<string, string>>({});
 const [loading, setLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [typeFilter, setTypeFilter] = useState<string>('all');
 // Business filter - auto-set for non-super admins
 const [businessFilter, setBusinessFilter] = useState<string>('all');
 const [businessSearch, setBusinessSearch] = useState<string>('');
 const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
 const businessSearchRef = useRef<HTMLDivElement>(null);
 const [dateFilter, setDateFilter] = useState<string>('all');
 const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
 const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [myPrepZones, setMyPrepZones] = useState<string[]>([]);
  const [showKermesScanner, setShowKermesScanner] = useState(false);

  // Pagination bounds limit to prevent infinite scroll memory issues (up to ~infinite)
  const MAX_ORDERS = 500;  const [allKermesPrepZones, setAllKermesPrepZones] = useState<string[]>([]);
  const [activeKdsMode, setActiveKdsMode] = useState<string>('auto'); // 'auto', 'expo', or specific prepZone name

  // ─── Fetch Kermes PrepZone Assignments & Settings ───
  useEffect(() => {
    if (!admin || !['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat'].includes(admin.adminType) || !adminBusinessId) {
      setMyPrepZones([]);
      setAllKermesPrepZones([]);
      return;
    }
    
    // Listen to Kermes events prepZoneAssignments and tableSectionsV2
    const unsub = onSnapshot(doc(db, 'kermes_events', adminBusinessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // 1) Current user's assigned zones
        const assignments = data.prepZoneAssignments || {};
        const zones: string[] = [];
        Object.entries(assignments).forEach(([zone, userIds]) => {
          if (Array.isArray(userIds) && userIds.includes(admin.id)) {
            zones.push(zone);
          }
        });
        setMyPrepZones(zones);
        
        // 2) All available prep zones from sections
        const sections = data.tableSectionsV2 || [];
        const allZones = sections.flatMap((s: any) => s.prepZones || []);
        // Remove duplicates and sort
        const uniqueZones = Array.from(new Set<string>(allZones)).filter(Boolean).sort();
        setAllKermesPrepZones(uniqueZones);
      }
    }, (error) => {
      console.error("Error fetching prep zones:", error);
    });
    
    return () => unsub();
  }, [admin, adminBusinessId]);

 // ─── Fetch Next Upcoming Reservation ───
 useEffect(() => {
 if (!admin) return;

 let qNext;
 const activeBusinessId = (businessFilter && businessFilter !== 'all') ? businessFilter : adminBusinessId;
 
 if (activeBusinessId) {
 qNext = query(
 collection(db, 'businesses', activeBusinessId, 'reservations'),
 where('status', 'in', ['pending', 'confirmed'])
 );
 } else {
 if (admin.adminType !== 'super') return; // Prevent unauthorized collectionGroup queries
 qNext = query(
 collectionGroup(db, 'reservations'),
 where('status', 'in', ['pending', 'confirmed'])
 );
 }

 const unsub = onSnapshot(qNext, (snapshot) => {
 const currentTime = new Date().getTime();
 let upcoming: any = null;

 for (const docSnap of snapshot.docs) {
 const data = docSnap.data();
 if (!data.reservationDate) continue;
 
 try {
 // Handle both Firestore Timestamp and plain js Date string formats
 const resMillis = data.reservationDate?.toMillis?.() || (data.reservationDate?.seconds ? data.reservationDate.seconds * 1000 : new Date(data.reservationDate).getTime());
 const resDate = new Date(resMillis);
 
 // Support legacy timeSlot or reservationTime string overriding
 const legacyTimeStr = data.timeSlot || data.reservationTime;
 if (legacyTimeStr && typeof legacyTimeStr === 'string' && legacyTimeStr.includes(':')) {
 const [hours, mins] = legacyTimeStr.split(':').map(Number);
 resDate.setHours(hours, mins, 0, 0);
 }
 
 if (resDate.getTime() < currentTime - 30 * 60000) continue;

 const candidate = { id: docSnap.id, businessId: docSnap.ref.parent?.parent?.id, ...data, computedTime: resDate.getTime(), resDateObject: resDate };
 
 if (!upcoming || candidate.computedTime < upcoming.computedTime) {
 upcoming = candidate;
 }
 } catch(e) {
 console.error("Error parsing reservation date for " + docSnap.id, e);
 }
 }
 setNextReservation(upcoming);
 });

 return () => unsub();
 }, [admin, adminBusinessId, businessFilter]);

 // Printer state
 const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
 const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

 // Cancel modal states
 const [showCancelModal, setShowCancelModal] = useState(false);
 const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
 const [cancelReason, setCancelReason] = useState('');
 const [showPrinterPanel, setShowPrinterPanel] = useState(false);
 const [testingPrint, setTestingPrint] = useState(false);
 // --- Auto-print refs & system ---
 const autoPrintedRef = useRef<Set<string>>(new Set()); // track auto-printed new orders
 const scheduledAutoPrintedRef = useRef<Set<string>>(new Set()); // track auto-printed scheduled orders
 const tabItemCountsRef = useRef<Record<string, number>>({}); // track item counts for reservation EK (additional) orders
 // Track both collections independently to prevent double auto-printing on load
 const initialLoadDoneRef = useRef({ meat: false, res: false }); // skip auto-print on first load
 const printerSettingsRef = useRef<PrinterSettings>(DEFAULT_PRINTER_SETTINGS); // ref mirror for closure
 const businessFilterRef = useRef<string>('all'); // ref mirror for closure

 // Printer health monitoring
 const [printerHealth, setPrinterHealth] = useState<PrinterHealthState>(DEFAULT_HEALTH_STATE);
 const printerHealthRef = useRef<PrinterHealthState>(DEFAULT_HEALTH_STATE);
 const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);
 const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
 const [alarmPlaying, setAlarmPlaying] = useState(false);
 const retryQueueRef = useRef(new PrintRetryQueue());
 const wakeLockReleaseRef = useRef<(() => Promise<void>) | null>(null);
 const [retryQueueSize, setRetryQueueSize] = useState(0);
 const lastPrintSuccessRef = useRef<string | null>(null);

 
 // KDS Checklist state
 const [checkedItems, setCheckedItems] = useState<Record<string, Record<number, boolean>>>({});

 // ─── Pause System State ───
 const [deliveryPaused, setDeliveryPaused] = useState(false);
 const [pickupPaused, setPickupPaused] = useState(false);
 const [deliveryPauseUntil, setDeliveryPauseUntil] = useState<Date | null>(null);
 const [pickupPauseUntil, setPickupPauseUntil] = useState<Date | null>(null);
 const [deliveryCountdown, setDeliveryCountdown] = useState('');
 const [pickupCountdown, setPickupCountdown] = useState('');
 const [showDeliveryTimerMenu, setShowDeliveryTimerMenu] = useState(false);
 const [showPickupTimerMenu, setShowPickupTimerMenu] = useState(false);
 const deliveryTimerRef = useRef<HTMLDivElement>(null);
 const pickupTimerRef = useRef<HTMLDivElement>(null);

 // ─── Next Upcoming Reservation State ───
 const [nextReservation, setNextReservation] = useState<any>(null);

  // Handle checking off items on KDS
  const updateCheckedItem = async (orderId: string, itemIdx: number) => {
    const orderChecks = checkedItems[orderId] || {};
    const newChecked = !orderChecks[itemIdx];
    const updated = { ...orderChecks, [itemIdx]: newChecked };
    setCheckedItems(prev => ({ ...prev, [orderId]: updated }));
    // Persist to Firestore
    try {
      const isKermesAdmin = ['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat'].includes(admin?.adminType || '');
      // Fallback search in our filtered array for businessId to be safe
      const orderMatch = [...meatOrders, ...resOrders].find(o => o.id === orderId);
      const bId = orderMatch?.businessId || adminBusinessId;
      
      const orderRef = isKermesAdmin 
        ? doc(db, 'kermes_events', bId as string, 'orders', orderId)
        : doc(db, 'meat_orders', orderId);

      await updateDoc(orderRef, {
        [`checkedItems.${itemIdx}`]: newChecked,
      });
    } catch (e) {
      console.error(t('error_updating_checkeditems'), e);
    }
  };

 
 // Filter businesses based on search
 const filteredBusinesses = Object.entries(businesses).filter(([id, name]) =>
 name.toLowerCase().includes(businessSearch.toLowerCase())
 );

 // Click outside handler for business dropdown
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (businessSearchRef.current && !businessSearchRef.current.contains(event.target as Node)) {
 setShowBusinessDropdown(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const showToast = (message: string, type: 'success' | 'error') => {
 setToast({ message, type });
 setTimeout(() => setToast(null), 3000);
 };

 // Load businesses for mapping
 useEffect(() => {
 const loadBusinesses = async () => {
 const snapshot = await getDocs(collection(db, 'businesses'));
 const map: Record<string, string> = {};
 snapshot.docs.forEach(doc => {
 map[doc.id] = doc.data().companyName || doc.id;
 });
 setBusinesses(map);
 };
 loadBusinesses();
 }, []);

 // Auto-set business filter for non-super admins (they can only see their own orders)
 useEffect(() => {
 if (admin && admin.adminType !== 'super' && adminBusinessId) {
 setBusinessFilter(adminBusinessId);
 }
 }, [admin, adminBusinessId]);

 // ─── Pause System: Firestore Listener ───
 useEffect(() => {
 if (businessFilter === 'all' || !businessFilter) return;
 const unsub = onSnapshot(doc(db, 'businesses', businessFilter), (snap) => {
 if (!snap.exists()) return;
 const d = snap.data();
 setDeliveryPaused(d.temporaryDeliveryPaused || false);
 setPickupPaused(d.temporaryPickupPaused || false);
 const dpUntil = d.deliveryPauseUntil?.toDate?.() || null;
 const ppUntil = d.pickupPauseUntil?.toDate?.() || null;
 setDeliveryPauseUntil(dpUntil);
 setPickupPauseUntil(ppUntil);
 });
 return () => unsub();
 }, [businessFilter]);

 // ─── Pause System: Countdown Timer ───
 useEffect(() => {
 const fmt = (target: Date | null): string => {
 if (!target) return '';
 const diff = target.getTime() - Date.now();
 if (diff <= 0) return '';
 const m = Math.floor(diff / 60000);
 const s = Math.floor((diff % 60000) / 1000);
 return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
 };

 const tick = () => {
 const dc = fmt(deliveryPauseUntil);
 const pc = fmt(pickupPauseUntil);
 setDeliveryCountdown(dc);
 setPickupCountdown(pc);
 // Auto-resume when timer expires
 if (deliveryPaused && deliveryPauseUntil && deliveryPauseUntil.getTime() <= Date.now()) {
 handleResumePause('delivery');
 }
 if (pickupPaused && pickupPauseUntil && pickupPauseUntil.getTime() <= Date.now()) {
 handleResumePause('pickup');
 }
 };

 tick();
 const interval = setInterval(tick, 1000);
 return () => clearInterval(interval);
 }, [deliveryPauseUntil, pickupPauseUntil, deliveryPaused, pickupPaused]);

 // ─── Pause System: Click Outside Handlers ───
 useEffect(() => {
 const handler = (e: MouseEvent) => {
 if (deliveryTimerRef.current && !deliveryTimerRef.current.contains(e.target as Node)) setShowDeliveryTimerMenu(false);
 if (pickupTimerRef.current && !pickupTimerRef.current.contains(e.target as Node)) setShowPickupTimerMenu(false);
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, []);

 // ─── Pause System: Pause / Resume Functions ───
 const handlePause = async (type: 'delivery' | 'pickup', minutes: number | null) => {
 if (businessFilter === 'all') return;
 const pauseField = type === 'delivery' ? 'temporaryDeliveryPaused' : 'temporaryPickupPaused';
 const untilField = type === 'delivery' ? 'deliveryPauseUntil' : 'pickupPauseUntil';

 const untilDate = minutes ? new Date(Date.now() + minutes * 60000) : null;
 try {
 await updateDoc(doc(db, 'businesses', businessFilter), {
 [pauseField]: true,
 [untilField]: untilDate ? Timestamp.fromDate(untilDate) : null,
 });
 await addDoc(collection(db, 'businesses', businessFilter, 'deliveryPauseLogs'), {
 action: 'paused',
 type,
 duration: minutes ? `${minutes}min` : 'indefinite',
 timestamp: serverTimestamp(),
 adminEmail: admin?.email || 'unknown',
 });
 showToast(t(type === 'delivery' ? 'pause_delivery' : 'pause_pickup') + (minutes ? ` (${minutes} Min.)` : ''), 'success');
 } catch (e) {
 showToast(t('pause_error'), 'error');
 }
 setShowDeliveryTimerMenu(false);
 setShowPickupTimerMenu(false);
 };

 const handleResumePause = async (type: 'delivery' | 'pickup') => {
 if (businessFilter === 'all') return;
 const pauseField = type === 'delivery' ? 'temporaryDeliveryPaused' : 'temporaryPickupPaused';
 const untilField = type === 'delivery' ? 'deliveryPauseUntil' : 'pickupPauseUntil';
 try {
 await updateDoc(doc(db, 'businesses', businessFilter), {
 [pauseField]: false,
 [untilField]: null,
 });
 await addDoc(collection(db, 'businesses', businessFilter, 'deliveryPauseLogs'), {
 action: 'resumed',
 type,
 timestamp: serverTimestamp(),
 adminEmail: admin?.email || 'unknown',
 });
 showToast(t(type === 'delivery' ? 'pause_resumed_delivery' : 'pause_resumed_pickup'), 'success');
 } catch (e) {
 showToast(t('pause_error'), 'error');
 }
 };

 const PAUSE_DURATIONS = [
 { label: '15 Min.', minutes: 15 },
 { label: '30 Min.', minutes: 30 },
 { label: '1 Std.', minutes: 60 },
 { label: '2 Std.', minutes: 120 },
 { label: 'Unbegrenzt', minutes: null },
 ] as const;

 // Load printer settings from localStorage (with admin fallback)
 useEffect(() => {
 const saved = localStorage.getItem('lokma_printer_settings');
 if (saved) {
 try {
 setPrinterSettings(JSON.parse(saved));
 } catch { /* ignore */ }
 } else if (admin?.printerSettings) {
 setPrinterSettings(admin.printerSettings as PrinterSettings);
 }
 }, [admin]);

 const savePrinterSettings = (newSettings: PrinterSettings) => {
 setPrinterSettings(newSettings);
 printerSettingsRef.current = newSettings;
 localStorage.setItem('lokma_printer_settings', JSON.stringify(newSettings));
 };

 // Sync refs for onSnapshot closure (avoid stale closures)
 useEffect(() => { printerSettingsRef.current = printerSettings; }, [printerSettings]);
 useEffect(() => { businessFilterRef.current = businessFilter; }, [businessFilter]);

 // ─── Printer Health Heartbeat (every 30s) ───────────────────
 useEffect(() => {
 if (!printerSettings.enabled || !printerSettings.printerIp || admin?.adminType === 'super') {
 // Reset health state if printer is not configured or user is super admin
 // Super admins browse remotely and cannot reach local printer IPs
 setPrinterHealth(DEFAULT_HEALTH_STATE);
 printerHealthRef.current = DEFAULT_HEALTH_STATE;
 return;
 }

 const runHealthCheck = async () => {
 const prev = printerHealthRef.current;
 const result = await checkHealth(printerSettings);

 const newState: PrinterHealthState = {
 status: result.online ? 'online' : 'offline',
 lastChecked: new Date(),
 lastOnline: result.online ? new Date() : prev.lastOnline,
 responseTimeMs: result.responseTimeMs,
 consecutiveFailures: result.online ? 0 : prev.consecutiveFailures + 1,
 error: result.error,
 };

 // Only declare offline after OFFLINE_THRESHOLD consecutive failures
 if (!result.online && newState.consecutiveFailures < 2) {
 newState.status = 'checking';
 }

 printerHealthRef.current = newState;
 setPrinterHealth(newState);

 // ─── Transition: online/checking → offline ───
 if (prev.status !== 'offline' && newState.status === 'offline') {
 // Play alarm
 try {
 if (!alarmAudioRef.current) {
 alarmAudioRef.current = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
 alarmAudioRef.current.loop = true;
 }
 // Construct a simple alarm beep using Web Audio API
 const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
 const playBeep = () => {
 const osc = audioCtx.createOscillator();
 const gain = audioCtx.createGain();
 osc.connect(gain);
 gain.connect(audioCtx.destination);
 osc.frequency.value = 880;
 osc.type = 'square';
 gain.gain.value = 0.3;
 osc.start();
 setTimeout(() => { osc.stop(); }, 200);
 };
 playBeep();
 setAlarmPlaying(true);
 // Repeat beeps every 5 seconds
 const alarmInterval = setInterval(playBeep, 5000);
 (alarmAudioRef.current as any)._alarmInterval = alarmInterval;
 } catch { /* Audio not available */ }

 // Send email alert
 const businessName = businessFilter !== 'all' && businesses[businessFilter]
 ? businesses[businessFilter]
 : 'LOKMA Marketplace';
 sendPrinterAlert({
 type: 'offline',
 businessName,
 printerIp: printerSettings.printerIp,
 printerPort: printerSettings.printerPort,
 errorDetails: result.error,
 lastSuccessfulPrint: lastPrintSuccessRef.current || undefined,
 adminEmail: admin?.email,
 });
 }

 // ─── Transition: offline → online ───
 if ((prev.status === 'offline') && newState.status === 'online') {
 // Stop alarm
 stopAlarm();

 // Send recovery email
 const businessName = businessFilter !== 'all' && businesses[businessFilter]
 ? businesses[businessFilter]
 : 'LOKMA Marketplace';
 sendPrinterAlert({
 type: 'online',
 businessName,
 printerIp: printerSettings.printerIp,
 printerPort: printerSettings.printerPort,
 adminEmail: admin?.email,
 });

 // Process retry queue
 if (retryQueueRef.current.size > 0) {
 const printed = await retryQueueRef.current.processQueue(
 printerSettings,
 (item) => showToast(t('print_reprinted', { id: item.id.slice(0, 6).toUpperCase() }), 'success'),
 (item, err) => showToast(t('print_failed', { id: item.id.slice(0, 6).toUpperCase() }), 'error')
 );
 setRetryQueueSize(retryQueueRef.current.size);
 if (printed > 0) {
 showToast(t('print_queue_done', { count: String(printed) }), 'success');
 }
 }
 }
 };

 // Initial check
 runHealthCheck();
 // Start interval
 healthIntervalRef.current = setInterval(runHealthCheck, 15000);

 return () => {
 if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [printerSettings.enabled, printerSettings.printerIp, printerSettings.printerPort, admin?.adminType]);

 // Stop alarm function
 const stopAlarm = useCallback(() => {
 if (alarmAudioRef.current) {
 const interval = (alarmAudioRef.current as any)._alarmInterval;
 if (interval) clearInterval(interval);
 try { alarmAudioRef.current.pause(); } catch { /* ignore */ }
 }
 setAlarmPlaying(false);
 }, []);

 // ─── Screen Wake Lock ────────────────────────────────────────
 useEffect(() => {
 if (!printerSettings.enabled || admin?.adminType === 'super') return;

 let cancelled = false;

 const acquireWakeLock = async () => {
 const result = await requestWakeLock();
 if (!cancelled && result.release) {
 wakeLockReleaseRef.current = result.release;
 }
 };

 acquireWakeLock();

 // Re-acquire on visibility change (tab comes back to foreground)
 const handleVisibilityChange = () => {
 if (document.visibilityState === 'visible' && !cancelled) {
 acquireWakeLock();
 }
 };
 document.addEventListener('visibilitychange', handleVisibilityChange);

 return () => {
 cancelled = true;
 document.removeEventListener('visibilitychange', handleVisibilityChange);
 if (wakeLockReleaseRef.current) {
 wakeLockReleaseRef.current();
 wakeLockReleaseRef.current = null;
 }
 };
 }, [printerSettings.enabled]);

 // Handle test print
 const handleTestPrint = async () => {
 setTestingPrint(true);
 try {
 const result = await testPrint(printerSettings, 'LOKMA Marketplace');
 if (result.success) {
 showToast(t('print_test_success'), 'success');
 } else {
 showToast(t('print_error', { message: result.message }), 'error');
 }
 } catch (err: any) {
 showToast(t('print_error', { message: err.message }), 'error');
 } finally {
 setTestingPrint(false);
 }
 };

 // Handle print order
 const handlePrintOrder = async (order: Order) => {
 // Use ref to avoid stale closure (especially when called from onSnapshot)
 const ps = printerSettingsRef.current;
 if (!ps.enabled || !ps.printerIp) {
 showToast(t('print_not_configured'), 'error');
 return;
 }
 setPrintingOrderId(order.id);
 try {
 const result = await printOrder(ps, {
 orderNumber: order.orderNumber || order.id.slice(0, 6).toUpperCase(),
 orderType: order.type,
 items: order.items?.map(item => ({
 name: (item as any).productName || item.name,
 quantity: item.quantity,
 price: item.price,
 unit: item.unit,
 selectedOptions: (item as any).selectedOptions || (item as any).options,
 note: (item as any).itemNote || (item as any).note,
 })),
 total: order.total,
 grandTotal: order.total,
 customerName: order.customerName,
 customerPhone: order.customerPhone,
 deliveryAddress: order.address,
 tableNumber: order.tableNumber,
 note: order.notes,
 paymentMethod: order.paymentMethod,
 scheduledAt: order.scheduledAt ? order.scheduledAt.toDate().toISOString() : undefined,
 }, order.businessName || businesses[order.businessId] || 'LOKMA');

 if (result.success) {
 showToast(t('print_success'), 'success');
 lastPrintSuccessRef.current = new Date().toLocaleString(dateLocale, { timeZone: 'Europe/Berlin' });
 } else {
 showToast(t('print_error', { message: result.message }), 'error');
 // Add to retry queue
 retryQueueRef.current.add(
 order,
 order.businessName || businesses[order.businessId] || 'LOKMA'
 );
 setRetryQueueSize(retryQueueRef.current.size);
 }
 } catch (err: any) {
 showToast(t('print_error', { message: err.message }), 'error');
 // Add to retry queue
 retryQueueRef.current.add(
 order,
 order.businessName || businesses[order.businessId] || 'LOKMA'
 );
 setRetryQueueSize(retryQueueRef.current.size);
 } finally {
 setPrintingOrderId(null);
 }
 };

 // --- Auto-print scheduled orders 15 min before ---
 useEffect(() => {
 const interval = setInterval(() => {
 if (!printerSettings.enabled || !printerSettings.printerIp || admin?.adminType === 'super') return;
 const now = new Date();

 orders.forEach((order) => {
 // Only scheduled orders that have been accepted/preparing
 if (!order.scheduledAt || !order.isScheduledOrder) return;
 if (order.status !== 'accepted' && order.status !== 'preparing' && order.status !== 'pending') return;
 if (scheduledAutoPrintedRef.current.has(order.id)) return;

 const schedTime = order.scheduledAt.toDate();
 const diffMs = schedTime.getTime() - now.getTime();
 const diffMin = diffMs / 60000;

 // Print when 0–15 minutes before scheduled time
 if (diffMin > 0 && diffMin <= 15) {
 scheduledAutoPrintedRef.current.add(order.id);
 handlePrintOrder(order);
 }
 });
 }, 60000);

 return () => clearInterval(interval);
 }, [orders, printerSettings, businesses]);

 // Real-time orders & reservations subscriptions
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(() => {
 setLoading(true);

 // Build query based on date filter
 let startDate = new Date();
 startDate.setHours(0, 0, 0, 0);

 if (dateFilter === 'week') {
 startDate.setDate(startDate.getDate() - 7);
 } else if (dateFilter === 'month') {
 startDate.setDate(startDate.getDate() - 30);
 } else if (dateFilter === 'all') {
 startDate = new Date(2020, 0, 1); // Far past
 }

 const effectBusinessId = adminBusinessId; // capture for closure

  const isKermesAdmin = ['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat'].includes(admin?.adminType || '');
  
  // 1. Listen to orders
  const qOrders = isKermesAdmin 
    ? query(
        collection(db, 'kermes_orders'),
        where('kermesId', '==', effectBusinessId as string),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'desc')
      )
    : query(
        collection(db, 'meat_orders'),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'desc')
      );

 const unsubOrders = onSnapshot(qOrders, (snapshot) => {
 const data = snapshot.docs.map(doc => {
 const d = doc.data();
 return {
 id: doc.id,
 orderNumber: d.orderNumber || doc.id.slice(0, 6).toUpperCase(),
 businessId: d.businessId || d.butcherId || d.kermesId || '',
 businessName: d.businessName || d.butcherName || d.kermesName || '',
 customerId: d.userId || d.customerId || '',
 customerName: d.customerName || d.userDisplayName || d.userName || '',
 customerPhone: d.customerPhone || d.userPhone || '',
 items: d.items || [],
 subtotal: d.subtotal || d.totalPrice || d.totalAmount || 0,
 deliveryFee: d.deliveryFee || 0,
 total: d.totalPrice || d.totalAmount || d.total || 0,
 status: d.status || 'pending',
 type: (() => {
 const raw = d.orderType || d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup';
 if (raw === 'dineIn') return 'dine_in';
 return raw;
 })(),
 createdAt: d.createdAt,
 scheduledAt: d.scheduledDeliveryTime || d.deliveryDate || d.scheduledDateTime || d.pickupTime,
 isScheduledOrder: !!d.isScheduledOrder,
 address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
 notes: d.notes || d.orderNote || d.customerNote || '',
 tableNumber: d.tableNumber,
 waiterName: d.waiterName,
 groupSessionId: d.groupSessionId,
 isGroupOrder: !!d.isGroupOrder,
 groupParticipantCount: d.groupParticipantCount || 0,
 paymentStatus: d.paymentStatus || 'unpaid',
 paymentMethod: d.paymentMethod,
 stripePaymentIntentId: d.stripePaymentIntentId,
 } as Order;
 });
 setMeatOrders(data);

 // Hydrate KDS checklist state from Firestore
 const checks: Record<string, Record<number, boolean>> = {};
 snapshot.docs.forEach(d => {
 const ci = d.data().checkedItems;
 if (ci && typeof ci === 'object') {
 checks[d.id] = {};
 Object.entries(ci).forEach(([k, v]) => { checks[d.id][Number(k)] = !!v; });
 }
 });
 setCheckedItems(prev => ({ ...prev, ...checks }));

 // --- Auto-print new orders ---
 const ps = printerSettingsRef.current;
 const bf = businessFilterRef.current;
 const changes = snapshot.docChanges();
 const addedChanges = changes.filter(change => change.type === 'added');
 
 if (initialLoadDoneRef.current.meat && ps.enabled && ps.autoPrint && ps.printerIp) {
 const newOrders = addedChanges
 .map(change => {
 const d = change.doc.data();
 return {
 id: change.doc.id,
 orderNumber: d.orderNumber || change.doc.id.slice(0, 6).toUpperCase(),
 businessId: d.businessId || d.butcherId || '',
 businessName: d.businessName || d.butcherName || '',
 items: d.items || [],
 total: d.totalPrice || d.totalAmount || d.total || 0,
 status: d.status || 'pending',
 type: (() => {
 const raw = d.orderType || d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup';
 if (raw === 'dineIn') return 'dine_in';
 return raw;
 })(),
 customerName: d.customerName || d.userDisplayName || d.userName || '',
 customerPhone: d.customerPhone || d.userPhone || '',
 address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
 notes: d.notes || d.orderNote || d.customerNote || '',
 tableNumber: d.tableNumber,
 paymentMethod: d.paymentMethod,
 scheduledAt: d.scheduledDeliveryTime || d.deliveryDate || d.scheduledDateTime || d.pickupTime,
 } as any;
 })
 .filter((o: any) => {
 if (autoPrintedRef.current.has(o.id)) return false;
 if (o.status !== 'pending') return false;
 if (bf !== 'all' && o.businessId !== bf) return false;
 if (o.scheduledAt) return false;
 return true;
 });

 for (const newOrder of newOrders) {
 autoPrintedRef.current.add(newOrder.id);
 handlePrintOrder(newOrder as any);
 }
 }
 if (!initialLoadDoneRef.current.meat) {
 initialLoadDoneRef.current.meat = true;
 if (initialLoadDoneRef.current.res) setLoading(false);
 }
 }, (error) => {
 console.error('Error loading meat_orders:', error);
 setLoading(false);
 });

 // 2. Listen to reservations
 // CRITICAL: collectionGroup + where(range) requires explicit Firestore index.
 // Solution: when we know the businessId, query the sub-collection directly
 // (collection scope — uses automatic single-field indexes, no explicit index needed).
 // Super admin has no fixed businessId, so we use collectionGroup without a range filter
 // and apply date filtering client-side.
 let qReservations;
 if (effectBusinessId) {
 // Business admin — direct sub-collection query (no index needed)
 qReservations = query(
 collection(db, 'businesses', effectBusinessId, 'reservations'),
 where('createdAt', '>=', Timestamp.fromDate(startDate)),
 orderBy('createdAt', 'desc')
 );
 } else {
 // Super admin — collectionGroup without range filter (Firestore auto-indexes single fields)
 // Date filtering handled client-side below
 qReservations = query(
 collectionGroup(db, 'reservations'),
 orderBy('createdAt', 'desc')
 );
 }

 const startMs = startDate.getTime();

 const unsubReservations = onSnapshot(qReservations, (snapshot) => {
 const relevantDocs = snapshot.docs.filter(d => {
 const data = d.data();
 // For super admin: apply date filter client-side
 if (!effectBusinessId) {
 const createdMs = data.createdAt?.toMillis?.() ?? (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
 if (createdMs < startMs) return false;
 }
 // Include pre-order/tab reservations (tabStatus set)
 if (data.tabStatus === 'pre_ordered' || data.tabStatus === 'seated' || data.tabStatus === 'closed') return true;
 // Also include plain reservations (no tabStatus) that are pending or confirmed
 if (!data.tabStatus && (data.status === 'pending' || data.status === 'confirmed')) return true;
 return false;
 });

 const mapped = relevantDocs
 .map(doc => mapReservationToOrder(doc.id, doc.data()))
 .sort((a, b) => {
 const aMs = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
 const bMs = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
 return bMs - aMs;
 });
 setResOrders(mapped);

 // --- Auto-print new reservation orders & Check-Ins ---
 const ps = printerSettingsRef.current;
 const bf = businessFilterRef.current;
 const changes = snapshot.docChanges();

 if (initialLoadDoneRef.current.res && ps.enabled && ps.autoPrint && ps.printerIp) {
 changes.forEach(change => {
 const data = change.doc.data();
 const currentCount = (data.tabItems || data.preOrderItems || []).length;
 const prevCount = tabItemCountsRef.current[change.doc.id] || 0;
 
 // Always update current item count
 tabItemCountsRef.current[change.doc.id] = currentCount;

 // Filter relevant reservations just like the main listener
 const isTab = data.tabStatus === 'pre_ordered' || data.tabStatus === 'seated' || data.tabStatus === 'closed';
 const isPlain = !data.tabStatus && (data.status === 'pending' || data.status === 'confirmed');
 if (!isTab && !isPlain) return;

 const mapped = mapReservationToOrder(change.doc.id, data);
 if (bf !== 'all' && mapped.businessId !== bf) return;
 if (mapped.scheduledAt) return; // Don't auto-print scheduled orders immediately

 if (change.type === 'added') {
 if (autoPrintedRef.current.has(mapped.id)) return;
 
 // Condition 1: Brand new pending reservation
 const isNewPending = mapped.status === 'pending';
 // Condition 2: Just checked in (entered query as 'seated' and has food items)
 const isNewlySeated = data.tabStatus === 'seated' && currentCount > 0;

 if (isNewPending || isNewlySeated) {
 autoPrintedRef.current.add(mapped.id);
 handlePrintOrder(mapped as any);
 }
 } else if (change.type === 'modified') {
 // EK SİPARİŞ (Added items to an already seated tab)
 if (data.tabStatus === 'seated' && currentCount > prevCount) {
 const ekOrder = {
 ...mapped,
 id: `${mapped.id}_ek_${currentCount}`, // Unique ID for print list
 orderNumber: `${mapped.orderNumber} (EK SİPARİŞ)`
 };
 handlePrintOrder(ekOrder as any);
 }
 } else if (change.type === 'removed') {
 delete tabItemCountsRef.current[change.doc.id];
 }
 });
 } else if (!initialLoadDoneRef.current.res) {
 // Initial load: populate tab item counts
 snapshot.docs.forEach(doc => {
 const data = doc.data();
 tabItemCountsRef.current[doc.id] = (data.tabItems || data.preOrderItems || []).length;
 });
 }

 if (!initialLoadDoneRef.current.res) {
 initialLoadDoneRef.current.res = true;
 if (initialLoadDoneRef.current.meat) setLoading(false);
 }
 }, (error) => {
 console.error('Error loading reservations:', error);
 setLoading(false);
 });

 return () => {
 unsubOrders();
 unsubReservations();
 };
 }, [dateFilter, adminBusinessId]);

 // Filter orders
 const filteredOrders = orders.filter(order => {
 if (statusFilter !== 'all' && order.status !== statusFilter) return false;
 if (typeFilter !== 'all' && order.type !== typeFilter) return false;
 if (businessFilter !== 'all' && order.businessId !== businessFilter) return false;

 // Prep Zone Assignment logic for Kermes workers
 let filterZones = myPrepZones;
  
 if (activeKdsMode === 'expo') {
   filterZones = []; // show all
 } else if (activeKdsMode !== 'auto') {
   filterZones = [activeKdsMode]; // strictly use selected prepZone
 }

 if (filterZones && filterZones.length > 0) {
   if (!order.items || order.items.length === 0) return false; // Hide orders with no items
   
   const hasMyItems = order.items.some((item: any) => {
     const itemZones = Array.isArray(item.prepZone) ? item.prepZone : [item.prepZone];
     return itemZones.some((z: string) => z && filterZones.includes(z));
   });
   
   if (!hasMyItems) return false;
 }

 return true;
 });

 // Helper: determine if an order is a future pre-order (scheduled >30 min from now)
 const isPreOrder = (order: Order): boolean => {
 if (!order.scheduledAt) return false;
 try {
 const scheduledTime = typeof order.scheduledAt.toDate === 'function'
 ? order.scheduledAt.toDate().getTime()
 : new Date(order.scheduledAt as any).getTime();

 if (isNaN(scheduledTime)) return false;

 // Ignore pre-orders created more than 2 days ago to prevent old orders from sticking at the top
 if (order.createdAt) {
 const createdTime = typeof order.createdAt.toDate === 'function'
 ? order.createdAt.toDate().getTime()
 : new Date(order.createdAt as any).getTime();
 if (!isNaN(createdTime)) {
 const daysOld = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);
 if (daysOld > 2) return false;
 }
 }

 const thirtyMinFromNow = Date.now() + 30 * 60 * 1000;
 return scheduledTime > thirtyMinFromNow;
 } catch (err) {
 console.error("Error parsing scheduledAt for order", order.id, err);
 return false;
 }
 };

 // Group orders by status for kanban view (using canonical statuses)
 const allPendingOrders = filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status));
 const immediatePendingOrders = allPendingOrders.filter(o => !isPreOrder(o));
 const preOrders = allPendingOrders.filter(o => isPreOrder(o));
 const pendingOrders = allPendingOrders; // Keep for stats
 const preparingOrders = filteredOrders.filter(o => o.status === 'preparing');
 const readyOrders = filteredOrders.filter(o => o.status === 'ready');
 // Note: 'served' orders (legacy dine-in) are included in completedOrders below
 const inTransitOrders = filteredOrders.filter(o => o.status === 'onTheWay');
 const completedOrders = filteredOrders.filter(o => ['delivered', 'served', 'completed'].includes(o.status));

 // Update order status
 // When status is reset backward (pending/preparing/ready), clear courier assignment
 // so the order appears in the driver's pending delivery queue again
 const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
 // If cancelling, show modal to get reason
 if (newStatus === 'cancelled') {
 setCancelOrderId(orderId);
 setCancelReason('');
 setShowCancelModal(true);
 return;
 }

 await updateOrderStatus(orderId, newStatus);
 };

 // Actual status update function
 const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, cancellationReason?: string, unavailableItemsList?: { idx: number; name: string; quantity: number; price: number }[]) => {
 try {
 // Find the order to get info
 const order = allPendingOrders.find(o => o.id === orderId);
 const isReservation = order?.type === 'dine_in_preorder' || order?.type === 'dine_in';

 // Statuses that should clear courier assignment when set
 const unclamedStatuses: OrderStatus[] = ['pending', 'preparing', 'ready'];
 const shouldClearCourier = unclamedStatuses.includes(newStatus);

 const updateData: Record<string, any> = {
 updatedAt: new Date(),
 };

 if (isReservation) {
 // Ensure independent food tracking (preparing -> ready -> served) without breaking reservation 'confirmed' status
 updateData.orderStatus = newStatus;
 updateData[`orderStatusHistory.${newStatus}`] = new Date();
 
 // For terminal states, sync fallback 'status' as well for clean UI filtering
 if (['cancelled', 'completed'].includes(newStatus)) {
 updateData.status = newStatus;
 updateData[`statusHistory.${newStatus}`] = new Date();
 }
 } else {
 updateData.status = newStatus;
 updateData[`statusHistory.${newStatus}`] = new Date();
 }

 if (shouldClearCourier) {
 updateData.courierId = deleteField();
 updateData.courierName = deleteField();
 updateData.courierPhone = deleteField();
 updateData.claimedAt = deleteField();
 }

 // Save who served the order when marking as served/delivered
 if (newStatus === 'served' || newStatus === 'delivered') {
 const currentUser = auth.currentUser;
 if (currentUser) {
 updateData.servedByName = currentUser.displayName || currentUser.email || 'Admin';
 updateData.servedById = currentUser.uid;
 updateData.servedAt = new Date();
 }
 }

 // Add cancellation reason if provided
 if (newStatus === 'cancelled' && cancellationReason) {
 updateData.cancellationReason = cancellationReason;
 }

 // Save unavailable items when accepting with missing items
 if (newStatus === 'accepted' && unavailableItemsList && unavailableItemsList.length > 0) {
 updateData.unavailableItems = unavailableItemsList.map(i => ({
 positionNumber: i.idx + 1,
 productName: i.name,
 quantity: i.quantity,
 price: i.price || 0,
 }));
 }

  // Route to correct collection
  const isKermesAdmin = ['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat'].includes(admin?.adminType || '');
  const orderRef = isReservation && order?.businessId
  ? doc(db, 'businesses', order.businessId, 'reservations', orderId)
  : isKermesAdmin
    ? doc(db, 'kermes_orders', orderId)
    : doc(db, 'meat_orders', orderId);

  await updateDoc(orderRef, updateData);

 // Send push notification to customer for cancellation
 if (newStatus === 'cancelled') {
 try {
 // Check if the order is part of a table group session
 if (order?.groupSessionId) {
 try {
 const sessionRef = doc(db, 'table_group_sessions', order.groupSessionId);
 await updateDoc(sessionRef, {
 status: 'cancelled',
 closedAt: Timestamp.now(),
 cancelledBy: auth.currentUser?.uid || 'Admin',
 cancelReason: cancellationReason || t('siparis_admin_panelden_iptal_edildi'),
 });
 } catch (sessionError) {
 console.warn('Could not clean up group session:', sessionError);
 // Non-critical, but should be noted
 }
 }

 if (order?.customerId) {
 // Fetch customer FCM token
 const { getDoc } = await import('firebase/firestore');
 const userDoc = await getDoc(doc(db, 'users', order.customerId));
 const fcmToken = userDoc.data()?.fcmToken;

 if (fcmToken) {
 await fetch('/api/orders/notify', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 orderId,
 type: 'order_cancelled',
 customerFcmToken: fcmToken,
 butcherName: order.businessName || businesses[order.businessId] || '',
 cancellationReason: cancellationReason || '',
 }),
 });
 }
 }
 } catch (notifyError) {
 console.error('Error sending cancellation notification or updating session:', notifyError);
 // Don't fail the status update if notification fails
 }
 }

 // Send push notification + partial refund when order is accepted with unavailable items
 if (newStatus === 'accepted' && unavailableItemsList && unavailableItemsList.length > 0) {
 try {
 const order = orders.find(o => o.id === orderId);
 let refundAmount = 0;
 let refundSucceeded = false;

 // Issue partial refund if customer paid by card
 if (order?.paymentMethod === 'card' && order?.paymentStatus === 'paid') {
 try {
 const refundRes = await fetch('/api/orders/partial-refund', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 orderId,
 unavailableItems: unavailableItemsList.map(i => ({
 positionNumber: i.idx + 1,
 productName: i.name,
 quantity: i.quantity,
 price: i.price || 0,
 })),
 }),
 });
 const refundData = await refundRes.json();
 if (refundData.refunded) {
 refundAmount = refundData.refundAmount;
 refundSucceeded = true;
 showToast(t('refund_success', { amount: formatCurrency(refundAmount, order?.currency) }), 'success');
 }
 } catch (refundError) {
 console.error('Error processing partial refund:', refundError);
 showToast(t('kismi_iade_islenemedi_manuel_kontrol_ger'), 'error');
 }
 }

 // Send push notification to customer
 if (order?.customerId) {
 const { getDoc } = await import('firebase/firestore');
 const userDoc = await getDoc(doc(db, 'users', order.customerId));
 const fcmToken = userDoc.data()?.fcmToken;

 if (fcmToken) {
 const unavailableNames = unavailableItemsList.map(i => i.name).join(', ');
 await fetch('/api/orders/notify', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 orderId,
 type: 'order_accepted_with_unavailable',
 customerFcmToken: fcmToken,
 butcherName: order.businessName || businesses[order.businessId] || '',
 unavailableItems: unavailableNames,
 refundAmount: refundSucceeded ? refundAmount : 0,
 }),
 });
 }
 }

 // Update business fulfillment score
 if (order?.businessId) {
 const bizRef = doc(db, 'businesses', order.businessId);
 await updateDoc(bizRef, {
 [`fulfillmentIssues`]: increment(unavailableItemsList.length),
 [`lastFulfillmentIssue`]: new Date(),
 });
 }
 } catch (notifyError) {
 console.error('Error sending unavailable items notification:', notifyError);
 }
 }

 // Send push notification to customer when order is ready
 if (newStatus === 'ready') {
 try {
 const order = orders.find(o => o.id === orderId);
 if (order?.customerId) {
 const { getDoc } = await import('firebase/firestore');
 const userDoc = await getDoc(doc(db, 'users', order.customerId));
 const fcmToken = userDoc.data()?.fcmToken;

 // Fetch business settings for hasTableService
 let hasTableService = false;
 if (order.businessId) {
 const bizDoc = await getDoc(doc(db, 'businesses', order.businessId));
 hasTableService = bizDoc.data()?.hasTableService || false;
 }

 if (fcmToken) {
 await fetch('/api/orders/notify', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 orderId,
 type: 'order_ready',
 customerFcmToken: fcmToken,
 butcherName: order.businessName || businesses[order.businessId] || '',
 hasTableService,
 isDineIn: order.type === 'dine_in',
 }),
 });
 }
 }
 } catch (notifyError) {
 console.error('Error sending ready notification:', notifyError);
 }
 }

 showToast(t('siparis_durumu_guncellendi'), 'success');
 setSelectedOrder(null);
 } catch (error) {
 console.error('Error updating order:', error);
 showToast(t('durum_guncellenirken_hata_olustu'), 'error');
 }
 };

 


 // Format date
 const formatDate = (timestamp: any) => {
 if (!timestamp) return '-';
 try {
 const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
 if (isNaN(date.getTime())) return '-';
 return date.toLocaleString(dateLocale, {
 day: '2-digit',
 month: '2-digit',
 hour: '2-digit',
 minute: '2-digit'
 });
 } catch (e) {
 return '-';
 }
 };

 // Use global formatCurrency
 const formatCurrency = (amount: number, currencyCode?: string) => {
 return globalFormatCurrency(amount, currencyCode);
 };

 // Calculate basic stats
 const stats = {
 total: filteredOrders.length,
 pending: pendingOrders.length,
 preparing: preparingOrders.length,
 ready: readyOrders.length,
 inTransit: inTransitOrders.length,
 completed: completedOrders.length,
 cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
 revenue: filteredOrders
 .filter(o => o.status === 'delivered')
 .reduce((sum, o) => sum + (o.total || 0), 0),
 avgOrderValue: 0,
 };
 stats.avgOrderValue = stats.completed > 0 ? stats.revenue / stats.completed : 0;

 if (adminLoading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
 </div>
 );
 }
return (
 <div className="min-h-screen bg-background p-6">
 {/* Toast */}
 {toast && (
 <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
 } text-white`}>
 <span>{toast.type === 'success' ? '✅' : '❌'}</span>
 <span>{toast.message}</span>
 </div>
 )}

 {/* Header + Filters in one compact row */}
 <div className="max-w-7xl mx-auto mb-6">
 <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
 <div className="flex flex-col gap-2">
 <div className="flex flex-wrap items-center gap-2 md:gap-4">
 <h1 className="text-xl font-bold text-foreground">
 {t('siparis_merkezi')}
 </h1>
 
 {/* QR Tahsilat Butonu (Başlıktan flex-wrap içerisine alındı) */}
 {(['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat', 'volunteer', 'kasa', 'vezne'].includes(admin?.adminType || '') || !!admin?.kermesId) && (
      <button
        onClick={() => setShowKermesScanner(true)}
        className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-full text-sm font-semibold shadow-lg transition-colors border border-emerald-400/30"
        title="QR veya Sipariş No ile Nakit Tahsilat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="7" height="7" x="7" y="7" rx="1"/><rect width="2" height="2" x="14" y="14"/><rect width="2" height="2" x="14" y="10"/><rect width="2" height="2" x="10" y="14"/></svg>
        QR Tahsilat
      </button>
  )}
 </div>
 {nextReservation && (() => {
 const dateObj = nextReservation.resDateObject;
 let timeDisplay = nextReservation.timeSlot || '-';
 if (dateObj) {
 const today = new Date();
 const tomorrow = new Date(today);
 tomorrow.setDate(tomorrow.getDate() + 1);
 
 const isToday = dateObj.getDate() === today.getDate() && dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
 const isTomorrow = dateObj.getDate() === tomorrow.getDate() && dateObj.getMonth() === tomorrow.getMonth() && dateObj.getFullYear() === tomorrow.getFullYear();
 const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
 
 if (isToday) timeDisplay = `Bugün ${timeStr}`;
 else if (isTomorrow) timeDisplay = `Yarın ${timeStr}`;
 else timeDisplay = `${dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} ${timeStr}`;
 }
 
 const hasPreOrder = nextReservation.items?.length > 0 || nextReservation.hasPreOrder || nextReservation.tabStatus === 'pre_ordered';
 const icon = hasPreOrder ? '🍽️' : '🪑';
 
 return (
 <Link 
 href={`/${locale}/admin/reservations`}
 className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/60 transition-colors shadow-sm cursor-pointer animate-in fade-in zoom-in duration-300"
 >
 <span>{icon}</span>
 <span className="font-semibold">Sıradaki Rzv:</span>
 <span>{timeDisplay} - {nextReservation.customerName || nextReservation.userName || 'Misafir'} ({nextReservation.partySize || '-'} Kişi)</span>
 </Link>
 );
 })()}
 </div>
 {/* Filters inline */}
 <div className="flex flex-wrap items-center gap-2">
 {allKermesPrepZones.length > 0 && admin?.adminType === 'kermes' && (
      <select
        value={activeKdsMode}
        onChange={(e) => setActiveKdsMode(e.target.value)}
        className="px-3 py-1.5 bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-bold text-sm rounded-lg border border-orange-500 shadow-sm"
        title="Tablet Görünümü (KDS)"
      >
        <option value="auto">⚙️ Oto ({myPrepZones.length ? myPrepZones.join(', ') : 'Tümü'})</option>
        <option value="expo">🌟 Expo (Tümü)</option>
        {allKermesPrepZones.map(z => (
          <option key={z} value={z}>👨‍🍳 {z}</option>
        ))}
      </select>
  )}

 <select
 value={dateFilter}
 onChange={(e) => setDateFilter(e.target.value)}
 title="Tarih Filtresi"
 className="px-3 py-1.5 bg-background text-foreground/90 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-border dark:border-gray-600 shadow-sm"
 >
 <option value="today">{t('bugun')}</option>
 <option value="week">📅 Bu Hafta</option>
 <option value="month">📅 Bu Ay</option>
 <option value="all">{t('tumu')}</option>
 </select>

 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="px-3 py-1.5 bg-background text-foreground/90 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-border dark:border-gray-600 shadow-sm"
 >
 <option value="all">{t('filters.allStatuses')}</option>
 {Object.entries(orderStatuses).map(([key, value]) => (
 <option key={key} value={key}>{t(value.labelKey)}</option>
 ))}
 </select>

 <select
 value={typeFilter}
 onChange={(e) => setTypeFilter(e.target.value)}
 className="px-3 py-1.5 bg-background text-foreground/90 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-border dark:border-gray-600 shadow-sm"
 >
 <option value="all">{t('filters.allTypes')}</option>
 {Object.entries(orderTypes).map(([key, value]) => (
 <option key={key} value={key}>{t(value.labelKey)}</option>
 ))}
 </select>

 {/* Business Filter - Only show to Super Admins */}
 {admin?.adminType === 'super' && (
 <div ref={businessSearchRef} className="relative">
 <div className="flex items-center">
 <input
 type="text"
 value={businessFilter === 'all' ? businessSearch : (businesses[businessFilter] || businessSearch)}
 onChange={(e) => {
 setBusinessSearch(e.target.value);
 setShowBusinessDropdown(true);
 if (e.target.value === '') {
 setBusinessFilter('all');
 }
 }}
 onFocus={() => setShowBusinessDropdown(true)}
 placeholder={t('i_sletme_ara')}
 className="px-3 py-1.5 bg-background text-foreground/90 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-border dark:border-gray-600 w-48 shadow-sm"
 />
 {businessFilter !== 'all' && (
 <button
 onClick={() => {
 setBusinessFilter('all');
 setBusinessSearch('');
 }}
 className="ml-1 text-muted-foreground hover:text-foreground text-sm"
 >
 ✕
 </button>
 )}
 </div>
 {showBusinessDropdown && (
 <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-background dark:bg-gray-800 border border-border/50 dark:border-gray-600 rounded-lg shadow-xl z-50">
 <div
 className="px-4 py-2 hover:bg-muted dark:hover:bg-gray-700 cursor-pointer text-green-900 dark:text-green-400 font-medium"
 onClick={() => {
 setBusinessFilter('all');
 setBusinessSearch('');
 setShowBusinessDropdown(false);
 }}
 >
 {t('tum_i_sletmeler')}
 </div>
 {filteredBusinesses.slice(0, 15).map(([id, name]) => (
 <div
 key={id}
 className={`px-4 py-2 hover:bg-muted dark:hover:bg-gray-700 cursor-pointer text-foreground/90 ${businessFilter === id ? 'bg-purple-100 dark:bg-purple-600/30 text-purple-700 dark:text-purple-300' : ''}`}
 onClick={() => {
 setBusinessFilter(id);
 setBusinessSearch('');
 setShowBusinessDropdown(false);
 }}
 >
 {name}
 </div>
 ))}
 {filteredBusinesses.length === 0 && businessSearch && (
 <div className="px-4 py-2 text-muted-foreground/80">
 {t('sonuc_bulunamadi')}
 </div>
 )}
 {filteredBusinesses.length > 15 && (
 <div className="px-4 py-2 text-muted-foreground/80 text-sm">
 +{filteredBusinesses.length - 15} {t('daha_aramayi_daraltin')}
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Printer Toggle + Pause Pills */}
 <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
 {/* Printer Toggle Pill (Hidden for non-super admins temporarily) */}
 {admin?.adminType === 'super' && (
 <button
 onClick={() => setShowPrinterPanel(!showPrinterPanel)}
 className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-lg ${
 !printerSettings.enabled || !printerSettings.printerIp
 ? 'bg-muted dark:bg-gray-800 text-muted-foreground/80 dark:text-gray-400 border border-border/50 dark:border-gray-700 hover:bg-muted/50 dark:hover:bg-gray-700'
 : printerHealth.status === 'online'
 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500'
 : printerHealth.status === 'offline'
 ? 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-400/50 animate-pulse'
 : printerHealth.status === 'checking'
 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-400 hover:to-yellow-500'
 : 'bg-muted dark:bg-gray-800 text-muted-foreground/80 dark:text-gray-400 border border-border/50 dark:border-gray-700'
 }`}
 title={`Drucker: ${printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Prüfe...' : 'Nicht konfiguriert'}${printerHealth.responseTimeMs ? ` (${printerHealth.responseTimeMs}ms)` : ''}`}
 >
 {/* Health Status Dot */}
 <span className={`w-2 h-2 rounded-full inline-block shadow-sm ${
 !printerSettings.enabled || !printerSettings.printerIp ? 'bg-gray-400' :
 printerHealth.status === 'online' ? 'bg-green-200' :
 printerHealth.status === 'offline' ? 'bg-red-200 animate-ping' :
 printerHealth.status === 'checking' ? 'bg-yellow-200 animate-pulse' :
 'bg-gray-400'
 }`} />
 <span>🖨️ {!printerSettings.enabled ? 'Drucker' : printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Prüfe...' : 'Aktiv'}</span>
 {/* Retry Queue Badge */}
 {retryQueueSize > 0 && (
 <span className="ml-1 bg-red-800 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center shadow-inner">
 {retryQueueSize}
 </span>
 )}
 </button>
 )}

 {/* ─── Pause Pill Buttons (only when business selected) ─── */}
 {businessFilter !== 'all' && (
 <div className="flex items-center gap-2">
 {/* Delivery Pause Pill */}
 <div ref={deliveryTimerRef} className="relative">
 <button
 onClick={() => deliveryPaused ? handleResumePause('delivery') : setShowDeliveryTimerMenu(!showDeliveryTimerMenu)}
 className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-lg ${deliveryPaused
 ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white ring-2 ring-amber-400/50 animate-pulse'
 : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500'
 }`}
 >
 <span>{t(deliveryPaused ? 'status_paused' : 'type_delivery')}</span>
 {deliveryPaused && deliveryCountdown && (
 <span className="ml-1 bg-card px-2 py-0.5 rounded-full text-xs font-mono">
 {deliveryCountdown}
 </span>
 )}
 </button>
 {/* Timer Selection Dropdown */}
 {showDeliveryTimerMenu && (
 <div className="absolute top-full left-0 mt-2 bg-background dark:bg-gray-800 border border-border/50 dark:border-gray-600 rounded-xl shadow-2xl z-50 p-2 min-w-[180px]">
 <p className="text-muted-foreground text-xs px-2 pb-2 border-b border-border mb-2">{t('kurye_sure_secin')}</p>
 <div className="flex flex-wrap gap-1.5">
 {PAUSE_DURATIONS.map(d => (
 <button
 key={d.label}
 onClick={() => handlePause('delivery', d.minutes)}
 className="px-3 py-1.5 bg-muted/50 dark:bg-gray-700 hover:bg-amber-500 dark:hover:bg-amber-600 text-foreground/90 hover:text-white text-xs rounded-lg transition font-medium"
 >
 {d.label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Pickup Pause Pill */}
 <div ref={pickupTimerRef} className="relative">
 <button
 onClick={() => pickupPaused ? handleResumePause('pickup') : setShowPickupTimerMenu(!showPickupTimerMenu)}
 className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-lg ${pickupPaused
 ? 'bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-400/50 animate-pulse'
 : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500'
 }`}
 >
 <span>{t(pickupPaused ? 'status_paused' : 'pickup_label')}</span>
 {pickupPaused && pickupCountdown && (
 <span className="ml-1 bg-card px-2 py-0.5 rounded-full text-xs font-mono">
 {pickupCountdown}
 </span>
 )}
 </button>
 {/* Timer Selection Dropdown */}
 {showPickupTimerMenu && (
 <div className="absolute top-full left-0 mt-2 bg-background dark:bg-gray-800 border border-border/50 dark:border-gray-600 rounded-xl shadow-2xl z-50 p-2 min-w-[180px]">
 <p className="text-muted-foreground text-xs px-2 pb-2 border-b border-border mb-2">{t('select_pause_duration')}</p>
 <div className="flex flex-wrap gap-1.5">
 {PAUSE_DURATIONS.map(d => (
 <button
 key={d.label}
 onClick={() => handlePause('pickup', d.minutes)}
 className="px-3 py-1.5 bg-muted/50 dark:bg-gray-700 hover:bg-red-500 dark:hover:bg-red-600 text-foreground/90 hover:text-white text-xs rounded-lg transition font-medium"
 >
 {d.label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Quick Stats */}
 <div className="flex gap-2">
 <div className="bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-blue-900 dark:text-blue-300">{stats.total}</p>
 <p className="text-[10px] font-semibold text-blue-900/80 dark:text-blue-400">{t('toplam')}</p>
 </div>
 <div className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-yellow-800 dark:text-yellow-300">{stats.pending}</p>
 <p className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">{t('bekleyen')}</p>
 </div>
 <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-amber-800 dark:text-amber-300">{stats.preparing}</p>
 <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{t('hazirlanan')}</p>
 </div>
 <div className="bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(stats.revenue, filteredOrders[0]?.currency)}</p>
 <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Ciro</p>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Printer Settings Panel */}
 {/* ─── PRINTER OFFLINE BANNER ─── */}
 {printerHealth.status === 'offline' && printerSettings.enabled && (
 <div className="max-w-7xl mx-auto mb-4">
 <div className="bg-red-900/50 border-2 border-red-500 rounded-xl p-4 flex items-center gap-4 animate-pulse">
 <span className="text-4xl">🚨</span>
 <div className="flex-1">
 <h3 className="text-red-300 font-bold text-lg">DRUCKER OFFLINE!</h3>
 <p className="text-red-200 text-sm">
 Der Bon-Drucker ({printerSettings.printerIp}:{printerSettings.printerPort}) ist nicht erreichbar.
 Neue Bestellungen können NICHT gedruckt werden!
 {printerHealth.error && <span className="block text-red-800 dark:text-red-400 text-xs mt-1">Fehler: {printerHealth.error}</span>}
 {retryQueueSize > 0 && <span className="block text-yellow-300 text-xs mt-1">📋 {retryQueueSize} Bon(s) in der Warteschlange</span>}
 </p>
 </div>
 {alarmPlaying && (
 <button
 onClick={stopAlarm}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
 title={t('alarm_mute_title')}
 >
 🔇 Alarm aus
 </button>
 )}
 </div>
 </div>
 )}

 {showPrinterPanel && (
 <div className="max-w-7xl mx-auto mb-4">
 <div className="bg-card rounded-xl p-5 border border-border">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-foreground font-bold flex items-center gap-2">
 🖨️ Bon-Drucker
 {/* Live Status Badge */}
 <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
 !printerSettings.enabled || !printerSettings.printerIp ? 'bg-muted dark:bg-gray-800 text-muted-foreground/80 dark:text-gray-400 border border-border/50 dark:border-gray-700' :
 printerHealth.status === 'online' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50' :
 printerHealth.status === 'offline' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50' :
 printerHealth.status === 'checking' ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50' :
 'bg-muted dark:bg-gray-800 text-muted-foreground/80 dark:text-gray-400 border border-border/50 dark:border-gray-700'
 }`}>
 {!printerSettings.enabled || !printerSettings.printerIp ? '● Nicht konfiguriert' :
 printerHealth.status === 'online' ? '● Online' :
 printerHealth.status === 'offline' ? '● Offline' :
 printerHealth.status === 'checking' ? '● Prüfe...' : '● Unbekannt'}
 {printerHealth.responseTimeMs && printerHealth.status === 'online' ? ` (${printerHealth.responseTimeMs}ms)` : ''}
 </span>
 </h3>
 <button onClick={() => setShowPrinterPanel(false)} className="text-muted-foreground hover:text-white" title={t('close_title')}>✕</button>
 </div>

 {/* Read-only printer info + Controls */}
 {(!printerSettings.enabled || !printerSettings.printerIp) ? (
 <div className="bg-background rounded-xl p-4 text-center">
 <p className="text-muted-foreground text-sm mb-3">Kein Drucker konfiguriert</p>
 <a
 href="/admin/settings/printer"
 className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
 >
 ⚙️ Drucker einrichten
 </a>
 </div>
 ) : (
 <>
 {/* Read-only config info */}
 <div className="bg-background rounded-xl p-3 mb-4 flex items-center justify-between">
 <div className="flex items-center gap-4 text-sm">
 <div>
 <span className="text-muted-foreground/80">Drucker:</span>
 <span className="ml-1 text-foreground font-mono">{printerSettings.printerIp}:{printerSettings.printerPort}</span>
 </div>
 {printerHealth.responseTimeMs > 0 && printerHealth.status === 'online' && (
 <div>
 <span className="text-muted-foreground/80">Latenz:</span>
 <span className="ml-1 text-green-900 dark:text-green-400">{printerHealth.responseTimeMs}ms</span>
 </div>
 )}
 {retryQueueSize > 0 && (
 <div>
 <span className="text-muted-foreground/80">Warteschlange:</span>
 <span className="ml-1 text-yellow-900 dark:text-yellow-400 font-medium">{retryQueueSize} Bon(s)</span>
 </div>
 )}
 </div>
 <a
 href="/admin/settings/printer"
 className="text-cyan-800 dark:text-cyan-400 hover:text-cyan-300 text-xs transition"
 >
 ⚙️ Einstellungen
 </a>
 </div>

 {/* Copies + Auto-Print + Test Print */}
 <div className="flex items-center justify-between flex-wrap gap-4">
 <div className="flex items-center gap-6">
 {/* Copies */}
 <div className="flex items-center gap-2">
 <label className="text-muted-foreground text-sm">Kopien:</label>
 <select
 value={printerSettings.printCopies}
 onChange={(e) => savePrinterSettings({ ...printerSettings, printCopies: parseInt(e.target.value) })}
 className="px-3 py-1.5 bg-muted/50 text-foreground/90 dark:bg-gray-700 dark:text-gray-100 text-sm rounded-lg border border-border dark:border-gray-600"
 title={t('copy_count_title')}
 >
 <option value={1}>1</option>
 <option value={2}>2</option>
 <option value={3}>3</option>
 </select>
 </div>
 {/* Auto-Print */}
 <div className="flex items-center gap-2">
 <label className="text-muted-foreground text-sm">Auto-Print</label>
 <button
 onClick={() => savePrinterSettings({ ...printerSettings, autoPrint: !printerSettings.autoPrint })}
 className={`relative w-12 h-6 rounded-full transition-colors ${printerSettings.autoPrint ? 'bg-amber-500' : 'bg-gray-600'}`}
 >
 <div className={`absolute top-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform ${printerSettings.autoPrint ? 'translate-x-6' : 'translate-x-0.5'}`} />
 </button>
 </div>
 </div>
 {/* Test Print */}
 <button
 onClick={handleTestPrint}
 disabled={testingPrint}
 className="px-4 py-2 bg-amber-600/20 border border-amber-500/50 text-amber-900 dark:text-amber-400 rounded-lg hover:bg-amber-600/30 transition text-sm disabled:opacity-50"
 >
 {testingPrint ? '⏳ Druckt...' : '🖨️ Test-Bon drucken'}
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 )}

 {/* Visual Order Status Workflow - Matching Super Admin Dashboard */}
 <div className="max-w-7xl mx-auto mb-6">
 <div className="bg-card rounded-xl p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <h3 className="text-foreground font-bold">
 {t('siparis_durumlari_anlik')}
 </h3>
 {/* Upcoming Reservation Chip */}
 {nextReservation ? (
 <Link
 href={`/admin/business/${nextReservation.businessId}?tab=reservations`}
 className="cursor-pointer flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 rounded-full text-white text-xs font-semibold shadow-sm transition-all transform hover:scale-[1.02] border border-red-500/30"
 >
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-background"></span>
 </span>
 <span>
 🍽️ {nextReservation.userName || nextReservation.customerName || 'Misafir'} - {(() => {
 const today = new Date();
 const resDate = new Date(nextReservation.resDateObject || nextReservation.computedTime);
 const isToday = resDate.getDate() === today.getDate() && resDate.getMonth() === today.getMonth() && resDate.getFullYear() === today.getFullYear();
 const dateStr = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(resDate);
 const timeStr = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(resDate);
 return isToday ? timeStr : `${dateStr} ${timeStr}`;
 })()}
 </span>
 </Link>
 ) : (
 <Link
 href={adminBusinessId ? `/admin/business/${adminBusinessId}?tab=reservations` : '#'}
 className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-muted/40 text-muted-foreground border border-border rounded-full text-xs font-medium hover:bg-muted/60 transition"
 >
 <span>🗓️</span>
 <span>Rezervasyon Yok</span>
 </Link>
 )}
 </div>
 <span className="text-muted-foreground text-sm">
 {t('su_anki_siparisler')}
 </span>
 </div>

 <div className="flex items-center gap-2 overflow-x-auto pb-2">
 {/* Bekleyen - Yanıp söner */}
 <div
 className={`flex-1 min-w-[100px] bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-600 rounded-xl p-4 text-center relative shadow-sm ${stats.pending > 0 ? "animate-pulse" : ""}`}
 >
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-400 dark:bg-yellow-500 rounded-full border-2 border-border shadow-sm"></div>
 <p
 className={`text-yellow-900 dark:text-yellow-400 text-3xl font-bold ${stats.pending > 0 ? "animate-bounce" : ""}`}
 >
 {stats.pending}
 </p>
 <p className="text-yellow-900/80 dark:text-yellow-300 text-sm font-semibold mt-1">
 🔔 {t('workflow.pending')}
 </p>
 </div>

 <div className="text-gray-400 dark:text-muted-foreground text-xl">→</div>

 {/* Hazırlanıyor */}
 <div className="flex-1 min-w-[100px] bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-400 dark:bg-amber-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-amber-900 dark:text-amber-400 text-3xl font-bold">
 {stats.preparing}
 </p>
 <p className="text-amber-900/80 dark:text-amber-300 text-sm font-semibold mt-1">👨‍🍳 {t('workflow.preparing')}</p>
 </div>

 <div className="text-gray-400 dark:text-muted-foreground text-xl">→</div>

 {/* Hazır */}
 <div className="flex-1 min-w-[100px] bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-400 dark:bg-green-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-green-900 dark:text-green-400 text-3xl font-bold">
 {stats.ready}
 </p>
 <p className="text-green-900/80 dark:text-green-300 text-sm font-semibold mt-1">📦 {t('workflow.ready')}</p>
 </div>

 <div className="text-gray-400 dark:text-muted-foreground text-xl">→</div>

 {/* Yolda */}
 <div className="flex-1 min-w-[100px] bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-400 dark:bg-indigo-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-indigo-900 dark:text-indigo-400 text-3xl font-bold">
 {stats.inTransit}
 </p>
 <p className="text-indigo-900/80 dark:text-indigo-300 text-sm font-semibold mt-1">🛵 {t('workflow.inTransit')}</p>
 </div>

 <div className="text-gray-400 dark:text-muted-foreground text-xl">→</div>

 {/* Tamamlanan */}
 <div className="flex-1 min-w-[100px] bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-400 dark:bg-emerald-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-emerald-900 dark:text-emerald-400 text-3xl font-bold">
 {stats.completed}
 </p>
 <p className="text-emerald-900/80 dark:text-emerald-300 text-sm font-semibold mt-1">✓ {t('workflow.completed')}</p>
 </div>
 </div>

 {/* Timeline line */}
 <div className="relative mt-2 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 via-green-500 via-indigo-500 to-emerald-500 rounded-full opacity-50"></div>
 </div>
 </div>

 {/* Orders Kanban View */}
 <div className="max-w-7xl mx-auto">
 {loading ? (
 <div className="bg-card rounded-xl p-12 text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
 <p className="text-muted-foreground mt-4">{t('siparisler_yukleniyor')}</p>
 </div>
 ) : filteredOrders.length === 0 ? (
 <div className="bg-card rounded-xl p-12 text-center">
 <p className="text-4xl mb-4">📭</p>
 <p className="text-muted-foreground">{t('siparis_bulunamadi')}</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
 {/* Pending Column */}
 <div className="bg-yellow-50/50 dark:bg-card rounded-xl p-4 border border-yellow-200/50 dark:border-transparent">
 <h3 className="text-yellow-900 dark:text-yellow-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
 {t('workflow.pending')} ({pendingOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto">
 {/* Immediate orders */}
 {immediatePendingOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {immediatePendingOrders.length > 10 && (
 <p className="text-muted-foreground/80 text-center text-sm">+{immediatePendingOrders.length - 10} {t('kanban.more')}</p>
 )}
 {/* Pre-orders separator */}
 {preOrders.length > 0 && (
 <>
 <div className="flex items-center gap-2 pt-3 pb-1">
 <div className="flex-1 h-px bg-purple-500/30"></div>
 <span className="text-purple-800 dark:text-purple-400 text-xs font-medium whitespace-nowrap">🕐 {t('preOrders')} ({preOrders.length})</span>
 <div className="flex-1 h-px bg-purple-500/30"></div>
 </div>
 {preOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} isPreOrder />
 ))}
 {preOrders.length > 10 && (
 <p className="text-muted-foreground/80 text-center text-sm">+{preOrders.length - 10} {t('kanban.more')}</p>
 )}
 </>
 )}
 </div>
 </div>

 {/* Preparing Column */}
 <div className="bg-amber-50/50 dark:bg-card rounded-xl p-4 border border-amber-200/50 dark:border-transparent">
 <h3 className="text-amber-900 dark:text-amber-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-amber-400 rounded-full"></span>
 {t('workflow.preparing')} ({preparingOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto">
 {preparingOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {preparingOrders.length > 10 && (
 <p className="text-muted-foreground/80 text-center text-sm">+{preparingOrders.length - 10} {t('kanban.more')}</p>
 )}
 </div>
 </div>

 {/* Ready Column */}
 <div className="bg-green-50/50 dark:bg-card rounded-xl p-4 border border-green-200/50 dark:border-transparent">
 <h3 className="text-green-900 dark:text-green-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-green-400 rounded-full"></span>
 {t('workflow.ready')} ({readyOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto">
 {readyOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {readyOrders.length > 10 && (
 <p className="text-muted-foreground/80 text-center text-sm">+{readyOrders.length - 10} {t('kanban.more')}</p>
 )}
 </div>
 </div>

 {/* Served Column (Dine-in only) */}
 {/* Servis Edildi column removed — dine-in orders now go directly to Tamamlanan */}

 {/* In Transit Column */}
 <div className="bg-indigo-50/50 dark:bg-card rounded-xl p-4 border border-indigo-200/50 dark:border-transparent">
 <h3 className="text-indigo-900 dark:text-indigo-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-indigo-400 rounded-full"></span>
 {t('workflow.inTransit')} ({inTransitOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto">
 {inTransitOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {inTransitOrders.length > 10 && (
 <p className="text-muted-foreground/80 text-center text-sm">+{inTransitOrders.length - 10} {t('kanban.more')}</p>
 )}
 </div>
 </div>

 {/* Completed Column */}
 <div className="bg-emerald-50/50 dark:bg-card rounded-xl p-4 border border-emerald-200/50 dark:border-transparent">
 <h3 className="text-emerald-900 dark:text-emerald-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-emerald-400 rounded-full"></span>
 {t('workflow.completed')} ({completedOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto">
 {completedOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {completedOrders.length > 10 && (
 <p className="text-muted-foreground/80 text-center text-sm">+{completedOrders.length - 10} {t('kanban.more')}</p>
 )}
 </div>
 </div>
 </div>
 )}
 </div>

 <KermesScannerModal
    isOpen={showKermesScanner}
    onClose={() => setShowKermesScanner(false)}
    kermesId={businessFilter}
  />

 {/* Order Detail Modal */}
 {selectedOrder && (
 <OrderDetailsModal
 order={selectedOrder}
 onClose={() => setSelectedOrder(null)}
 t={t}
 businesses={businesses}
 checkedItems={checkedItems[selectedOrder.id] || {}}
 dateLocale={dateLocale}
 onUpdateOrderStatus={updateOrderStatus}
 onToggleItemChecked={updateCheckedItem}
 printerSettings={printerSettings}
 printingOrderId={printingOrderId}
 onPrint={handlePrintOrder}
 onShowPrinterPanel={() => setShowPrinterPanel(true)}
 />
 )}
 </div>
 );
}

