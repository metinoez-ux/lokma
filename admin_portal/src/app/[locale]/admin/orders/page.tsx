'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, deleteField, query, orderBy, where, onSnapshot, Timestamp, increment, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';

import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';
import {
    printOrder, testPrint, PrinterSettings, DEFAULT_PRINTER_SETTINGS,
    checkHealth, sendPrinterAlert, PrinterHealthState, DEFAULT_HEALTH_STATE,
    PrintRetryQueue, requestWakeLock,
} from '@/services/printerService';

// Canonical Order Status Set (7 statuses)
// Synchronized with Mobile App OrderStatus enum
const orderStatuses = {
    pending: { label: 'Ausstehend', color: 'yellow', icon: '⏳' },
    accepted: { label: 'Bestätigt', color: 'blue', icon: '✅' },
    preparing: { label: 'In Zubereitung', color: 'amber', icon: '👨‍🍳' },
    ready: { label: 'Bereit', color: 'green', icon: '📦' },
    served: { label: 'Serviert', color: 'teal', icon: '🍽️' },
    onTheWay: { label: 'Unterwegs', color: 'indigo', icon: '🛵' },
    delivered: { label: 'Geliefert', color: 'emerald', icon: '🎉' },
    completed: { label: 'Abgeschlossen', color: 'emerald', icon: '✔️' },
    cancelled: { label: 'Storniert', color: 'red', icon: '❌' },
} as const;

type OrderStatus = keyof typeof orderStatuses;

const orderTypes = {
    pickup: { label: 'Abholung', icon: '🏃', color: 'green' },
    delivery: { label: 'Lieferung', icon: '🛵', color: 'blue' },
    dine_in: { label: 'Vor Ort', icon: '🍽️', color: 'amber' },
} as const;

type OrderType = keyof typeof orderTypes;

interface OrderItem {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    unit?: string;
}

interface Order {
    id: string;
    orderNumber?: string;
    businessId: string;
    businessName?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    items: OrderItem[];
    subtotal: number;
    deliveryFee?: number;
    total: number;
    status: OrderStatus;
    type: OrderType;
    createdAt: Timestamp;
    scheduledAt?: Timestamp;
    eta?: Timestamp;
    currency?: string;
    courier?: {
        id: string;
        name: string;
        phone: string;
    };
    address?: {
        street?: string;
        city?: string;
        postalCode?: string;
    };
    notes?: string;
    // Dine-in fields
    tableNumber?: number;
    waiterName?: string;
    groupSessionId?: string;
    isGroupOrder?: boolean;
    groupParticipantCount?: number;
    paymentStatus?: string;
    paymentMethod?: string;
    stripePaymentIntentId?: string;
    // Served by waiter
    servedByName?: string;
    servedAt?: Timestamp;
    isScheduledOrder?: boolean;
}

export default function OrdersPage() {
    const t = useTranslations('AdminPortal.Orders');
    const locale = useLocale();
    // Map next-intl locale codes to BCP-47 locale tags for date/time formatting
    const dateLocale = locale === 'de' ? 'de-DE' : locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : locale === 'nl' ? 'nl-NL' : 'de-DE';
    const { admin, loading: adminLoading } = useAdmin();
    const [orders, setOrders] = useState<Order[]>([]);
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
    // Cancellation modal state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    // Printer state
    const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
    const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
    const [showPrinterPanel, setShowPrinterPanel] = useState(false);
    const [testingPrint, setTestingPrint] = useState(false);
    const scheduledAutoPrintedRef = useRef<Set<string>>(new Set()); // track auto-printed scheduled orders

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

    // Unavailable items modal state
    const [showUnavailableModal, setShowUnavailableModal] = useState(false);
    const [unavailableOrderId, setUnavailableOrderId] = useState<string | null>(null);
    const [unavailableItems, setUnavailableItems] = useState<{ idx: number; name: string; quantity: number; price: number }[]>([]);

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

    // Toggle item checked state and persist to Firestore
    const toggleItemChecked = async (orderId: string, itemIdx: number) => {
        const orderChecks = checkedItems[orderId] || {};
        const newChecked = !orderChecks[itemIdx];
        const updated = { ...orderChecks, [itemIdx]: newChecked };
        setCheckedItems(prev => ({ ...prev, [orderId]: updated }));
        // Persist to Firestore
        try {
            await updateDoc(doc(db, 'meat_orders', orderId), {
                [`checkedItems.${itemIdx}`]: newChecked,
            });
        } catch (e) {
            console.error(t('error_updating_checkeditems'), e);
        }
    };

    // Get checked count for an order
    const getCheckedCount = (orderId: string, totalItems: number) => {
        const orderChecks = checkedItems[orderId] || {};
        return Object.values(orderChecks).filter(Boolean).length;
    };

    const allItemsChecked = (orderId: string, totalItems: number) => {
        if (totalItems === 0) return false;
        return getCheckedCount(orderId, totalItems) >= totalItems;
    };

    // Get unchecked (unavailable) items for an order
    const getUncheckedItems = (orderId: string, items: any[]) => {
        const orderChecks = checkedItems[orderId] || {};
        return items
            .map((item, idx) => ({ idx, name: item.productName || item.name, quantity: item.quantity, price: item.price || 0, checked: !!orderChecks[idx] }))
            .filter(i => !i.checked);
    };

    // Get the next logical status action button config
    const getNextStatusAction = (order: Order) => {
        const status = order.status;
        const totalItems = order.items?.length || 0;
        const checkedCount = getCheckedCount(order.id, totalItems);
        const allChecked = allItemsChecked(order.id, totalItems);
        const hasItems = totalItems > 0;

        if (['pending', 'accepted'].includes(status) && status === 'pending') {
            if (hasItems && checkedCount > 0) {
                if (allChecked) {
                    return { label: t('siparisi_onayla'), action: 'accepted' as OrderStatus, style: 'bg-blue-600 hover:bg-blue-700', hasUnavailable: false };
                } else {
                    return { label: t('eksik_urunlerle_onayla'), action: 'accepted' as OrderStatus, style: 'bg-yellow-600 hover:bg-yellow-700', hasUnavailable: true };
                }
            }
            return null; // No action yet — need to check some items first
        }

        if (status === 'accepted') {
            return { label: t('hazirlamaya_basla'), action: 'preparing' as OrderStatus, style: 'bg-amber-600 hover:bg-amber-700', hasUnavailable: false };
        }

        if (status === 'preparing') {
            return { label: t('siparis_hazir'), action: 'ready' as OrderStatus, style: 'bg-green-600 hover:bg-green-700', hasUnavailable: false };
        }

        // For dine-in ready orders, mark as delivered (= completed)
        if (status === 'ready' && order.type === 'dine_in') {
            return { label: '🍽️ Serviert', action: 'delivered' as OrderStatus, style: 'bg-teal-600 hover:bg-teal-700', hasUnavailable: false };
        }

        return null; // No action for ready (non-dine-in), onTheWay, delivered, cancelled
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
    // Check all possible business ID fields based on admin type
    useEffect(() => {
        if (admin && admin.adminType !== 'super') {
            // Check for any business ID field - admins can only see their own business
            const businessId = (admin as any).butcherId
                || (admin as any).restaurantId
                || (admin as any).marketId
                || (admin as any).kermesId
                || (admin as any).businessId;

            if (businessId) {
                setBusinessFilter(businessId);
            }
        }
    }, [admin]);

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
            showToast(`${type === 'delivery' ? '🛵 Lieferung' : '🛍️ Abholung'} pausiert${minutes ? ` (${minutes} Min.)` : ''}`, 'success');
        } catch (e) {
            showToast('Fehler aufgetreten', 'error');
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
            showToast(`${type === 'delivery' ? '🛵 Lieferung' : '🛍️ Abholung'} wieder aktiv`, 'success');
        } catch (e) {
            showToast('Fehler aufgetreten', 'error');
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

    // Save printer settings to localStorage
    const savePrinterSettings = (newSettings: PrinterSettings) => {
        setPrinterSettings(newSettings);
        localStorage.setItem('lokma_printer_settings', JSON.stringify(newSettings));
    };

    // ─── Printer Health Heartbeat (every 30s) ───────────────────
    useEffect(() => {
        if (!printerSettings.enabled || !printerSettings.printerIp) {
            // Reset health state if printer is not configured
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

            // ─── Transition: online → offline ───
            if (prev.status === 'online' && newState.status === 'offline') {
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
                        (item) => showToast(`🔄 Nachgedruckt: #${item.id.slice(0, 6).toUpperCase()}`, 'success'),
                        (item, err) => showToast(`❌ Druck fehlgeschlagen: #${item.id.slice(0, 6).toUpperCase()}`, 'error')
                    );
                    setRetryQueueSize(retryQueueRef.current.size);
                    if (printed > 0) {
                        showToast(`🖨️ ${printed} Bon(s) aus Warteschlange gedruckt`, 'success');
                    }
                }
            }
        };

        // Initial check
        runHealthCheck();
        // Start interval
        healthIntervalRef.current = setInterval(runHealthCheck, 30000);

        return () => {
            if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [printerSettings.enabled, printerSettings.printerIp, printerSettings.printerPort]);

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
        if (!printerSettings.enabled) return;

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
                showToast('🖨️ Test-Bon gedruckt!', 'success');
            } else {
                showToast(`🖨️ Fehler: ${result.message}`, 'error');
            }
        } catch (err: any) {
            showToast(`🖨️ Fehler: ${err.message}`, 'error');
        } finally {
            setTestingPrint(false);
        }
    };

    // Handle print order
    const handlePrintOrder = async (order: Order) => {
        if (!printerSettings.enabled || !printerSettings.printerIp) {
            showToast('Drucker nicht konfiguriert. Einstellungen → IoT-Bereich.', 'error');
            return;
        }
        setPrintingOrderId(order.id);
        try {
            const result = await printOrder(printerSettings, {
                orderNumber: order.orderNumber || order.id.slice(0, 6).toUpperCase(),
                orderType: order.type,
                items: order.items?.map(item => ({
                    name: (item as any).productName || item.name,
                    quantity: item.quantity,
                    price: item.price,
                    unit: item.unit,
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
                showToast('🖨️ Bon gedruckt!', 'success');
                lastPrintSuccessRef.current = new Date().toLocaleString(dateLocale, { timeZone: 'Europe/Berlin' });
            } else {
                showToast(`🖨️ Druckfehler: ${result.message}`, 'error');
                // Add to retry queue
                retryQueueRef.current.add(
                    order,
                    order.businessName || businesses[order.businessId] || 'LOKMA'
                );
                setRetryQueueSize(retryQueueRef.current.size);
            }
        } catch (err: any) {
            showToast(`🖨️ Fehler: ${err.message}`, 'error');
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
            if (!printerSettings.enabled || !printerSettings.printerIp) return;
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

    // Real-time orders subscription
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

        // Query meat_orders (canonical collection for LOKMA/MIRA orders)
        const q = query(
            collection(db, 'meat_orders'),
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    orderNumber: d.orderNumber || doc.id.slice(0, 6).toUpperCase(),
                    businessId: d.businessId || d.butcherId || '',
                    businessName: d.businessName || d.butcherName || '',
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
                        // Normalize camelCase to snake_case (Dart stores 'dineIn', admin expects 'dine_in')
                        if (raw === 'dineIn') return 'dine_in';
                        return raw;
                    })(),
                    createdAt: d.createdAt,
                    scheduledAt: d.scheduledDeliveryTime || d.deliveryDate || d.scheduledDateTime || d.pickupTime,
                    isScheduledOrder: !!d.isScheduledOrder,
                    address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
                    notes: d.notes || d.orderNote || d.customerNote || '',
                    // Dine-in fields
                    tableNumber: d.tableNumber,
                    waiterName: d.waiterName,
                    groupSessionId: d.groupSessionId,
                    isGroupOrder: !!d.isGroupOrder,
                    groupParticipantCount: d.groupParticipantCount || 0,
                    paymentStatus: d.paymentStatus || 'unpaid',
                    paymentMethod: d.paymentMethod,
                    stripePaymentIntentId: d.stripePaymentIntentId,
                };
            }) as Order[];
            setOrders(data);
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
            setLoading(false);
        }, (error) => {
            console.error('Error loading orders:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [dateFilter]);

    // Filter orders
    const filteredOrders = orders.filter(order => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (typeFilter !== 'all' && order.type !== typeFilter) return false;
        if (businessFilter !== 'all' && order.businessId !== businessFilter) return false;
        return true;
    });

    // Helper: determine if an order is a future pre-order (scheduled >30 min from now)
    const isPreOrder = (order: Order): boolean => {
        if (!order.scheduledAt) return false;
        const scheduledTime = order.scheduledAt.toDate().getTime();
        const thirtyMinFromNow = Date.now() + 30 * 60 * 1000;
        return scheduledTime > thirtyMinFromNow;
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
    const completedOrders = filteredOrders.filter(o => ['delivered', 'served'].includes(o.status));

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
            // Statuses that should clear courier assignment when set
            const unclamedStatuses: OrderStatus[] = ['pending', 'preparing', 'ready'];
            const shouldClearCourier = unclamedStatuses.includes(newStatus);

            const updateData: Record<string, any> = {
                status: newStatus,
                [`statusHistory.${newStatus}`]: new Date(),
                updatedAt: new Date(),
            };

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

            await updateDoc(doc(db, 'meat_orders', orderId), updateData);

            // Send push notification to customer for cancellation
            if (newStatus === 'cancelled') {
                try {
                    // Find the order to get customer info and session info
                    const order = orders.find(o => o.id === orderId);

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
                                showToast(`${formatCurrency(refundAmount, order?.currency)} Teilrückerstattung verarbeitet`, 'success');
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

    // Handle cancellation with reason
    const handleCancelConfirm = async () => {
        if (!cancelOrderId || !cancelReason.trim()) {
            showToast(t('lutfen_iptal_sebebi_girin'), 'error');
            return;
        }
        await updateOrderStatus(cancelOrderId, 'cancelled', cancelReason.trim());
        setShowCancelModal(false);
        setCancelOrderId(null);
        setCancelReason('');
    };



    // Format date
    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        return date.toLocaleString(dateLocale, {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
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
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
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
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            {t('siparis_merkezi')}
                        </h1>
                        {/* Filters inline */}
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                            >
                                <option value="today">{t('bugun')}</option>
                                <option value="week">📅 Bu Hafta</option>
                                <option value="month">📅 Bu Ay</option>
                                <option value="all">{t('tumu')}</option>
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                            >
                                <option value="all">{t('filters.allStatuses')}</option>
                                {Object.entries(orderStatuses).map(([key, value]) => (
                                    <option key={key} value={key}>{value.icon} {value.label}</option>
                                ))}
                            </select>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                            >
                                <option value="all">{t('filters.allTypes')}</option>
                                {Object.entries(orderTypes).map(([key, value]) => (
                                    <option key={key} value={key}>{value.icon} {value.label}</option>
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
                                            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 w-48"
                                        />
                                        {businessFilter !== 'all' && (
                                            <button
                                                onClick={() => {
                                                    setBusinessFilter('all');
                                                    setBusinessSearch('');
                                                }}
                                                className="ml-1 text-gray-400 hover:text-white text-sm"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    {showBusinessDropdown && (
                                        <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
                                            <div
                                                className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-green-400 font-medium"
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
                                                    className={`px-4 py-2 hover:bg-gray-700 cursor-pointer text-white ${businessFilter === id ? 'bg-purple-600/30 text-purple-300' : ''}`}
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
                                                <div className="px-4 py-2 text-gray-500">
                                                    {t('sonuc_bulunamadi')}
                                                </div>
                                            )}
                                            {filteredBusinesses.length > 15 && (
                                                <div className="px-4 py-2 text-gray-500 text-sm">
                                                    +{filteredBusinesses.length - 15} {t('daha_aramayi_daraltin')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Printer Toggle + Pause Pills + Quick Stats */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Printer Toggle with Health Status */}
                        <button
                            onClick={() => setShowPrinterPanel(!showPrinterPanel)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                                !printerSettings.enabled || !printerSettings.printerIp
                                    ? 'bg-gray-700 border border-gray-600 text-gray-400'
                                    : printerHealth.status === 'online'
                                    ? 'bg-green-600/20 border border-green-500/50 text-green-400'
                                    : printerHealth.status === 'offline'
                                    ? 'bg-red-600/20 border border-red-500/50 text-red-400 animate-pulse'
                                    : printerHealth.status === 'checking'
                                    ? 'bg-yellow-600/20 border border-yellow-500/50 text-yellow-400'
                                    : 'bg-gray-700 border border-gray-600 text-gray-400'
                            }`}
                            title={`Drucker: ${printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Prüfe...' : 'Nicht konfiguriert'}${printerHealth.responseTimeMs ? ` (${printerHealth.responseTimeMs}ms)` : ''}`}
                        >
                            {/* Health Status Dot */}
                            <span className={`w-2 h-2 rounded-full inline-block ${
                                !printerSettings.enabled || !printerSettings.printerIp ? 'bg-gray-500' :
                                printerHealth.status === 'online' ? 'bg-green-400' :
                                printerHealth.status === 'offline' ? 'bg-red-500 animate-ping' :
                                printerHealth.status === 'checking' ? 'bg-yellow-400 animate-pulse' :
                                'bg-gray-500'
                            }`} />
                            🖨️ {!printerSettings.enabled ? 'Drucker' : printerHealth.status === 'online' ? 'Online' : printerHealth.status === 'offline' ? 'OFFLINE' : printerHealth.status === 'checking' ? 'Prüfe...' : 'Aktiv'}
                            {/* Retry Queue Badge */}
                            {retryQueueSize > 0 && (
                                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                    {retryQueueSize}
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
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
                                        <span>{deliveryPaused ? '⏸' : '🛵'}</span>
                                        <span>Kurye</span>
                                        {deliveryPaused && deliveryCountdown && (
                                            <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs font-mono">
                                                {deliveryCountdown}
                                            </span>
                                        )}
                                    </button>
                                    {/* Timer Selection Dropdown */}
                                    {showDeliveryTimerMenu && (
                                        <div className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 p-2 min-w-[180px]">
                                            <p className="text-gray-400 text-xs px-2 pb-2 border-b border-gray-700 mb-2">{t('kurye_sure_secin')}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {PAUSE_DURATIONS.map(d => (
                                                    <button
                                                        key={d.label}
                                                        onClick={() => handlePause('delivery', d.minutes)}
                                                        className="px-3 py-1.5 bg-gray-700 hover:bg-amber-600 text-white text-xs rounded-lg transition font-medium"
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
                                        <span>{pickupPaused ? '⏸' : '🛍️'}</span>
                                        <span>Gel-Al</span>
                                        {pickupPaused && pickupCountdown && (
                                            <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs font-mono">
                                                {pickupCountdown}
                                            </span>
                                        )}
                                    </button>
                                    {/* Timer Selection Dropdown */}
                                    {showPickupTimerMenu && (
                                        <div className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 p-2 min-w-[180px]">
                                            <p className="text-gray-400 text-xs px-2 pb-2 border-b border-gray-700 mb-2">Gel-Al süre seçin</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {PAUSE_DURATIONS.map(d => (
                                                    <button
                                                        key={d.label}
                                                        onClick={() => handlePause('pickup', d.minutes)}
                                                        className="px-3 py-1.5 bg-gray-700 hover:bg-red-600 text-white text-xs rounded-lg transition font-medium"
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
                            <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-3 py-1.5 text-center">
                                <p className="text-xl font-bold text-blue-400">{stats.total}</p>
                                <p className="text-[10px] text-blue-300">{t('toplam')}</p>
                            </div>
                            <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl px-3 py-1.5 text-center">
                                <p className="text-xl font-bold text-yellow-400">{stats.pending}</p>
                                <p className="text-[10px] text-yellow-300">{t('bekleyen')}</p>
                            </div>
                            <div className="bg-amber-600/20 border border-amber-500/30 rounded-xl px-3 py-1.5 text-center">
                                <p className="text-xl font-bold text-amber-400">{stats.preparing}</p>
                                <p className="text-[10px] text-amber-300">{t('hazirlanan')}</p>
                            </div>
                            <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-3 py-1.5 text-center">
                                <p className="text-xl font-bold text-green-400">{formatCurrency(stats.revenue, filteredOrders[0]?.currency)}</p>
                                <p className="text-[10px] text-green-300">Ciro</p>
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
                                {printerHealth.error && <span className="block text-red-400 text-xs mt-1">Fehler: {printerHealth.error}</span>}
                                {retryQueueSize > 0 && <span className="block text-yellow-300 text-xs mt-1">📋 {retryQueueSize} Bon(s) in der Warteschlange</span>}
                            </p>
                        </div>
                        {alarmPlaying && (
                            <button
                                onClick={stopAlarm}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                                title="Alarm stumm schalten"
                            >
                                🔇 Alarm aus
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showPrinterPanel && (
                <div className="max-w-7xl mx-auto mb-4">
                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                🖨️ Bon-Drucker
                                {/* Live Status Badge */}
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    !printerSettings.enabled || !printerSettings.printerIp ? 'bg-gray-600/20 text-gray-400 border border-gray-500/40' :
                                    printerHealth.status === 'online' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                                    printerHealth.status === 'offline' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                                    printerHealth.status === 'checking' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                                    'bg-gray-600/20 text-gray-400 border border-gray-500/40'
                                }`}>
                                    {!printerSettings.enabled || !printerSettings.printerIp ? '● Nicht konfiguriert' :
                                     printerHealth.status === 'online' ? '● Online' :
                                     printerHealth.status === 'offline' ? '● Offline' :
                                     printerHealth.status === 'checking' ? '● Prüfe...' : '● Unbekannt'}
                                    {printerHealth.responseTimeMs && printerHealth.status === 'online' ? ` (${printerHealth.responseTimeMs}ms)` : ''}
                                </span>
                            </h3>
                            <button onClick={() => setShowPrinterPanel(false)} className="text-gray-400 hover:text-white" title="Schließen">✕</button>
                        </div>

                        {/* Read-only printer info + Controls */}
                        {(!printerSettings.enabled || !printerSettings.printerIp) ? (
                            <div className="bg-gray-900 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm mb-3">Kein Drucker konfiguriert</p>
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
                                <div className="bg-gray-900 rounded-xl p-3 mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Drucker:</span>
                                            <span className="ml-1 text-white font-mono">{printerSettings.printerIp}:{printerSettings.printerPort}</span>
                                        </div>
                                        {printerHealth.responseTimeMs > 0 && printerHealth.status === 'online' && (
                                            <div>
                                                <span className="text-gray-500">Latenz:</span>
                                                <span className="ml-1 text-green-400">{printerHealth.responseTimeMs}ms</span>
                                            </div>
                                        )}
                                        {retryQueueSize > 0 && (
                                            <div>
                                                <span className="text-gray-500">Warteschlange:</span>
                                                <span className="ml-1 text-yellow-400 font-medium">{retryQueueSize} Bon(s)</span>
                                            </div>
                                        )}
                                    </div>
                                    <a
                                        href="/admin/settings/printer"
                                        className="text-cyan-400 hover:text-cyan-300 text-xs transition"
                                    >
                                        ⚙️ Einstellungen
                                    </a>
                                </div>

                                {/* Copies + Auto-Print + Test Print */}
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-6">
                                        {/* Copies */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-gray-400 text-sm">Kopien:</label>
                                            <select
                                                value={printerSettings.printCopies}
                                                onChange={(e) => savePrinterSettings({ ...printerSettings, printCopies: parseInt(e.target.value) })}
                                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                                                title="Anzahl der Kopien"
                                            >
                                                <option value={1}>1</option>
                                                <option value={2}>2</option>
                                                <option value={3}>3</option>
                                            </select>
                                        </div>
                                        {/* Auto-Print */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-gray-400 text-sm">Auto-Print</label>
                                            <button
                                                onClick={() => savePrinterSettings({ ...printerSettings, autoPrint: !printerSettings.autoPrint })}
                                                className={`relative w-12 h-6 rounded-full transition-colors ${printerSettings.autoPrint ? 'bg-amber-500' : 'bg-gray-600'}`}
                                            >
                                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${printerSettings.autoPrint ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Test Print */}
                                    <button
                                        onClick={handleTestPrint}
                                        disabled={testingPrint}
                                        className="px-4 py-2 bg-amber-600/20 border border-amber-500/50 text-amber-400 rounded-lg hover:bg-amber-600/30 transition text-sm disabled:opacity-50"
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
                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-white font-bold">
                            {t('siparis_durumlari_anlik')}
                        </h3>
                        <span className="text-gray-400 text-sm">
                            {t('su_anki_siparisler')}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {/* Bekleyen - Yanıp söner */}
                        <div
                            className={`flex-1 min-w-[100px] bg-yellow-600/20 border-2 border-yellow-500 rounded-lg p-4 text-center relative ${stats.pending > 0 ? "animate-pulse" : ""}`}
                        >
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rounded-full border-2 border-gray-800"></div>
                            <p
                                className={`text-yellow-400 text-3xl font-bold ${stats.pending > 0 ? "animate-bounce" : ""}`}
                            >
                                {stats.pending}
                            </p>
                            <p className="text-yellow-300 text-sm font-medium">
                                🔔 {t('workflow.pending')}
                            </p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Hazırlanıyor */}
                        <div className="flex-1 min-w-[100px] bg-amber-600/20 border border-amber-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-amber-400 text-3xl font-bold">
                                {stats.preparing}
                            </p>
                            <p className="text-gray-400 text-sm">👨‍🍳 {t('workflow.preparing')}</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Hazır */}
                        <div className="flex-1 min-w-[100px] bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-green-400 text-3xl font-bold">
                                {stats.ready}
                            </p>
                            <p className="text-gray-400 text-sm">📦 {t('workflow.ready')}</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Yolda */}
                        <div className="flex-1 min-w-[100px] bg-indigo-600/20 border border-indigo-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-indigo-400 text-3xl font-bold">
                                {stats.inTransit}
                            </p>
                            <p className="text-gray-400 text-sm">🛵 {t('workflow.inTransit')}</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Tamamlanan */}
                        <div className="flex-1 min-w-[100px] bg-emerald-600/20 border border-emerald-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-emerald-400 text-3xl font-bold">
                                {stats.completed}
                            </p>
                            <p className="text-gray-400 text-sm">✓ {t('workflow.completed')}</p>
                        </div>
                    </div>

                    {/* Timeline line */}
                    <div className="relative mt-2 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 via-green-500 via-indigo-500 to-emerald-500 rounded-full opacity-50"></div>
                </div>
            </div>

            {/* Orders Kanban View */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-gray-400 mt-4">{t('siparisler_yukleniyor')}</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <p className="text-4xl mb-4">📭</p>
                        <p className="text-gray-400">{t('siparis_bulunamadi')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Pending Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-yellow-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                                {t('workflow.pending')} ({pendingOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {/* Immediate orders */}
                                {immediatePendingOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
                                ))}
                                {immediatePendingOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{immediatePendingOrders.length - 10} {t('kanban.more')}</p>
                                )}
                                {/* Pre-orders separator */}
                                {preOrders.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2 pt-3 pb-1">
                                            <div className="flex-1 h-px bg-purple-500/30"></div>
                                            <span className="text-purple-400 text-xs font-medium whitespace-nowrap">🕐 {t('preOrders')} ({preOrders.length})</span>
                                            <div className="flex-1 h-px bg-purple-500/30"></div>
                                        </div>
                                        {preOrders.slice(0, 10).map(order => (
                                            <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} isPreOrder />
                                        ))}
                                        {preOrders.length > 10 && (
                                            <p className="text-gray-500 text-center text-sm">+{preOrders.length - 10} {t('kanban.more')}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Preparing Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-amber-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-amber-400 rounded-full"></span>
                                {t('workflow.preparing')} ({preparingOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {preparingOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
                                ))}
                                {preparingOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{preparingOrders.length - 10} {t('kanban.more')}</p>
                                )}
                            </div>
                        </div>

                        {/* Ready Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-green-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                                {t('workflow.ready')} ({readyOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {readyOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
                                ))}
                                {readyOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{readyOrders.length - 10} {t('kanban.more')}</p>
                                )}
                            </div>
                        </div>

                        {/* Served Column (Dine-in only) */}
                        {/* Servis Edildi column removed — dine-in orders now go directly to Tamamlanan */}

                        {/* In Transit Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-indigo-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-indigo-400 rounded-full"></span>
                                {t('workflow.inTransit')} ({inTransitOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {inTransitOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
                                ))}
                                {inTransitOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{inTransitOrders.length - 10} {t('kanban.more')}</p>
                                )}
                            </div>
                        </div>

                        {/* Completed Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-emerald-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-emerald-400 rounded-full"></span>
                                {t('workflow.completed')} ({completedOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {completedOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} t={t} />
                                ))}
                                {completedOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{completedOrders.length - 10} {t('kanban.more')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                📦 {t('modal.order')} #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 6).toUpperCase()}
                            </h2>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">{t('modal.status')}</span>
                                <span className={`px-3 py-1 rounded-full text-sm bg-${orderStatuses[selectedOrder.status].color}-600/20 text-${orderStatuses[selectedOrder.status].color}-400`}>
                                    {orderStatuses[selectedOrder.status].icon} {orderStatuses[selectedOrder.status].label}
                                </span>
                            </div>

                            {/* Business */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">{t('modal.business')}</span>
                                <Link href={`/admin/butchers/${selectedOrder.businessId}`} className="text-blue-400 hover:underline">
                                    {businesses[selectedOrder.businessId] || selectedOrder.businessId}
                                </Link>
                            </div>

                            {/* Type */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">{t('modal.type')}</span>
                                <span className="text-white">
                                    {orderTypes[selectedOrder.type]?.icon} {orderTypes[selectedOrder.type]?.label}
                                </span>
                            </div>

                            {/* Scheduled Pickup Time (Pre-order indicator) */}
                            {selectedOrder.scheduledAt && (() => {
                                const d = selectedOrder.scheduledAt!.toDate();
                                const isFuture = d.getTime() > Date.now() + 30 * 60 * 1000;
                                return (
                                    <div className={`flex items-center justify-between ${isFuture ? 'bg-purple-600/10 border border-purple-500/30 rounded-lg px-3 py-2' : ''}`}>
                                        <span className={isFuture ? 'text-purple-300 font-medium' : 'text-gray-400'}>
                                            {isFuture ? `🕐 ${t('scheduledPickup')}` : t('pickupTime')}
                                        </span>
                                        <span className={isFuture ? 'text-purple-200 font-bold' : 'text-white'}>
                                            {d.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })} · {d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })()}

                            {/* Dine-in Info */}
                            {selectedOrder.type === 'dine_in' && (
                                <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                                    <h4 className="text-amber-400 font-medium text-sm flex items-center gap-2">🍽️ {t('modal.dineInDetail')}</h4>
                                    {selectedOrder.tableNumber && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">{t('modal.table')}</span>
                                            <span className="text-white font-bold text-lg">#{selectedOrder.tableNumber}</span>
                                        </div>
                                    )}
                                    {selectedOrder.waiterName && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">{t('modal.waiter')}</span>
                                            <span className="text-white">{selectedOrder.waiterName}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">{t('modal.payment')}</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedOrder.paymentStatus === 'paid'
                                            ? 'bg-green-600/20 text-green-400'
                                            : 'bg-red-600/20 text-red-400'
                                            }`}>
                                            {selectedOrder.paymentStatus === 'paid'
                                                ? `✅ ${t('modal.paid')}${selectedOrder.paymentMethod === 'card' ? ` (${t('modal.card')})` : selectedOrder.paymentMethod === 'cash' ? ` (${t('modal.cash')})` : ''}`
                                                : `⏳ ${t('modal.unpaid')}`}
                                        </span>
                                    </div>
                                    {selectedOrder.servedByName && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">{t('modal.servedBy')}</span>
                                            <span className="text-teal-400 font-medium">🍽️ {selectedOrder.servedByName}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customer */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">{t('modal.customer')}</span>
                                <div className="text-right">
                                    <p className="text-white">{selectedOrder.customerName || t('modal.guest')}</p>
                                    {selectedOrder.customerPhone && (
                                        <a href={`tel:${selectedOrder.customerPhone}`} className="text-blue-400 text-sm">
                                            {selectedOrder.customerPhone}
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Address */}
                            {selectedOrder.address && (
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">{t('modal.address')}</span>
                                    <div className="text-right text-white text-sm">
                                        <p>{selectedOrder.address.street}</p>
                                        <p>{selectedOrder.address.postalCode} {selectedOrder.address.city}</p>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div className="border-t border-gray-700 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-white font-medium">{t('modal.products')}</h4>
                                    {selectedOrder.items?.length > 0 && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${allItemsChecked(selectedOrder.id, selectedOrder.items.length)
                                            ? 'bg-green-600/30 text-green-400'
                                            : 'bg-gray-700 text-gray-400'
                                            }`}>
                                            ✓ {getCheckedCount(selectedOrder.id, selectedOrder.items.length)}/{selectedOrder.items.length}
                                        </span>
                                    )}
                                </div>
                                {/* Group Order Kitchen Summary */}
                                {selectedOrder.isGroupOrder && selectedOrder.items?.length > 0 && (
                                    <div className="mb-4">
                                        <h5 className="text-amber-400 font-medium text-sm mb-2">👨‍🍳 {t('modal.kitchenSummary')}</h5>
                                        <div className="bg-gray-800 rounded-lg p-3 space-y-1 text-sm text-gray-200">
                                            {Object.values(
                                                selectedOrder.items.reduce((acc: any, item: any) => {
                                                    const opts = (item.selectedOptions || []).map((o: any) => o.optionName || o.name).join(', ');
                                                    const key = `${item.productId}-${opts}`;
                                                    if (!acc[key]) {
                                                        acc[key] = { name: item.productName || item.name, quantity: 0, opts: item.selectedOptions };
                                                    }
                                                    acc[key].quantity += (item.quantity || 1);
                                                    return acc;
                                                }, {})
                                            ).map((aggr: any, idx: number) => (
                                                <div key={idx}>
                                                    <span className="font-bold text-white">{aggr.quantity}x</span> {aggr.name}
                                                    {aggr.opts && aggr.opts.length > 0 && (
                                                        <span className="text-gray-400 ml-2 text-xs">({aggr.opts.map((o: any) => o.optionName || o.name).join(', ')})</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedOrder.isGroupOrder && (
                                    <h5 className="text-teal-400 font-medium text-sm mt-4 mb-2">🍽️ {t('modal.participantBreakdown')}</h5>
                                )}

                                <div className="space-y-4">
                                    {/* Render items (grouped by participant if group order, otherwise flat) */}
                                    {(() => {
                                        const renderItem = (item: any, originalIdx: number) => {
                                            const isChecked = checkedItems[selectedOrder.id]?.[originalIdx] || false;
                                            const posNum = item.positionNumber || (originalIdx + 1);
                                            return (
                                                <div key={originalIdx} className={`rounded-lg px-2 py-1.5 transition-all mb-1 ${isChecked ? 'bg-green-600/10' : 'hover:bg-gray-700/50'}`}>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <button
                                                            onClick={() => toggleItemChecked(selectedOrder.id, originalIdx)}
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked
                                                                ? 'bg-green-500 border-green-500 text-white'
                                                                : 'border-gray-500 hover:border-green-400'
                                                                }`}
                                                        >
                                                            {isChecked && <span className="text-xs">✓</span>}
                                                        </button>
                                                        <span className="bg-amber-500 text-white text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0">#{posNum}</span>
                                                        {/* 🥤 Free Drink Badge */}
                                                        {item.isFreeDrink && (
                                                            <span className="bg-emerald-500 text-white text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0 tracking-wide">{t('free')}</span>
                                                        )}
                                                        <span className={`flex-1 ${isChecked ? 'text-green-300 line-through opacity-70' : item.isFreeDrink ? 'text-emerald-300' : 'text-gray-300'}`}>
                                                            {item.quantity}x {item.productName || item.name}
                                                        </span>
                                                        <span className={`${isChecked ? 'text-green-400 opacity-70' : item.isFreeDrink ? 'text-emerald-400' : 'text-white'}`}>
                                                            {item.isFreeDrink ? (
                                                                <span className="flex items-center gap-1">
                                                                    <span className="line-through text-gray-500 text-xs">{formatCurrency(item.originalPrice || item.unitPrice || 0, selectedOrder?.currency)}</span>
                                                                    <span className="text-emerald-400 font-bold">0,00 €</span>
                                                                </span>
                                                            ) : (
                                                                formatCurrency(item.totalPrice ?? ((item.unitPrice || item.price || 0) * (item.quantity || 1)), selectedOrder?.currency)
                                                            )}
                                                        </span>
                                                    </div>
                                                    {/* Show selected options */}
                                                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                        <div className="pl-14 space-y-0.5 mt-0.5">
                                                            {item.selectedOptions.map((opt: any, optIdx: number) => (
                                                                <div key={optIdx} className="flex justify-between text-xs">
                                                                    <span className={`${isChecked ? 'text-green-300/50 line-through' : 'text-purple-300'}`}>↳ {opt.optionName || opt.name}</span>
                                                                    {(opt.priceModifier || opt.price) ? (
                                                                        <span className={`${isChecked ? 'text-green-400/50' : 'text-purple-400'}`}>+{formatCurrency(opt.priceModifier || opt.price, selectedOrder?.currency)}</span>
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Show item note */}
                                                    {item.itemNote && (
                                                        <div className="pl-14 mt-0.5">
                                                            <span className="text-xs text-amber-300">📝 {item.itemNote}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        };

                                        if (selectedOrder.isGroupOrder) {
                                            // Group by participantName
                                            const groupedByParticipant: Record<string, { item: any, index: number }[]> = {};
                                            selectedOrder.items?.forEach((item: any, idx: number) => {
                                                const pName = item.participantName || t('modal.guest');
                                                if (!groupedByParticipant[pName]) groupedByParticipant[pName] = [];
                                                groupedByParticipant[pName].push({ item, index: idx });
                                            });

                                            return Object.entries(groupedByParticipant).map(([pName, items]) => (
                                                <div key={pName} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-2">
                                                    <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-gray-700/50 rounded-lg">
                                                        <span className="text-purple-400 text-xs">👤</span>
                                                        <span className="text-white text-sm font-medium">{pName}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {items.map(info => renderItem(info.item, info.index))}
                                                    </div>
                                                </div>
                                            ));
                                        }

                                        // Regular order
                                        return (
                                            <div className="space-y-1">
                                                {selectedOrder.items?.map((item: any, idx: number) => renderItem(item, idx))}
                                            </div>
                                        );
                                    })()}
                                </div>
                                {/* Step-by-step status transition button */}
                                {(() => {
                                    const action = getNextStatusAction(selectedOrder);
                                    if (!action) return null;

                                    const handleClick = () => {
                                        if (action.hasUnavailable) {
                                            // Show unavailable items confirmation modal
                                            const unchecked = getUncheckedItems(selectedOrder.id, selectedOrder.items || []);
                                            setUnavailableItems(unchecked);
                                            setUnavailableOrderId(selectedOrder.id);
                                            setShowUnavailableModal(true);
                                        } else {
                                            updateOrderStatus(selectedOrder.id, action.action);
                                        }
                                    };

                                    return (
                                        <button
                                            onClick={handleClick}
                                            className={`w-full mt-3 px-4 py-3 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium ${action.style} ${action.hasUnavailable ? '' : 'animate-pulse'}`}
                                        >
                                            {action.label}
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-gray-700 pt-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">{t('modal.subtotal')}</span>
                                    <span className="text-white">{formatCurrency(selectedOrder.subtotal || 0, selectedOrder.currency)}</span>
                                </div>
                                {(selectedOrder.deliveryFee ?? 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">{t('modal.deliveryFee')}</span>
                                        <span className="text-white">{formatCurrency(selectedOrder.deliveryFee || 0, selectedOrder.currency)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-white">{t('modal.total')}</span>
                                    <span className="text-green-400">{formatCurrency(selectedOrder.total || 0, selectedOrder.currency)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedOrder.notes && (
                                <div className="border-t border-gray-700 pt-4">
                                    <h4 className="text-yellow-400 font-medium text-sm mb-1 flex items-center gap-1">📝 {t('modal.notes')}</h4>
                                    <p className="text-white bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3">{selectedOrder.notes}</p>
                                </div>
                            )}

                            {/* Status Actions */}
                            <div className="border-t border-gray-700 pt-4">
                                <h4 className="text-white font-medium mb-3">{t('modal.updateStatus')}</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(orderStatuses).map(([key, value]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleStatusChange(selectedOrder.id, key as OrderStatus)}
                                            disabled={selectedOrder.status === key}
                                            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${selectedOrder.status === key
                                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-700 text-white hover:bg-gray-600'
                                                }`}
                                        >
                                            <span>{value.icon}</span>
                                            <span>{value.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Print Action */}
                            <div className="border-t border-gray-700 pt-4">
                                <button
                                    onClick={() => printerSettings.enabled && printerSettings.printerIp ? handlePrintOrder(selectedOrder) : setShowPrinterPanel(true)}
                                    disabled={printingOrderId === selectedOrder.id}
                                    className={`w-full px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                                        !printerSettings.enabled || !printerSettings.printerIp
                                            ? 'bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-600'
                                            : 'bg-amber-600/20 border border-amber-500/50 text-amber-400 hover:bg-amber-600/30'
                                    }`}
                                >
                                    {!printerSettings.enabled || !printerSettings.printerIp
                                        ? '🖨️ Drucker einrichten'
                                        : printingOrderId === selectedOrder.id ? '⏳ Druckt...' : '🖨️ Bon drucken'}
                                </button>
                            </div>


                        </div>
                    </div>
                </div>
            )}

            {/* Cancellation Reason Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                ❌ {t('cancelModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelOrderId(null);
                                    setCancelReason('');
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-gray-400 text-sm">
                                {t('cancelModal.subtitle')}
                            </p>

                            {/* Quick Reason Buttons */}
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    t('cancelModal.reasons.outOfStock'),
                                    t('cancelModal.reasons.closed'),
                                    t('cancelModal.reasons.noDelivery'),
                                    t('cancelModal.reasons.duplicate'),
                                    t('cancelModal.reasons.customerRequest'),
                                ].map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => setCancelReason(reason)}
                                        className={`px-4 py-2 rounded-lg text-left text-sm ${cancelReason === reason
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Reason Input */}
                            <div>
                                <label className="text-gray-400 text-sm block mb-2">
                                    {t('cancelModal.customReason')}
                                </label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder={t('cancelModal.placeholder')}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            {/* Warning */}
                            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-3">
                                <p className="text-yellow-400 text-sm">
                                    ⚠️ {t('cancelModal.warning')}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false);
                                        setCancelOrderId(null);
                                        setCancelReason('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                                >
                                    {t('cancelModal.cancel')}
                                </button>
                                <button
                                    onClick={handleCancelConfirm}
                                    disabled={!cancelReason.trim()}
                                    className={`flex-1 px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${cancelReason.trim()
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    ❌ {t('cancelModal.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unavailable Items Confirmation Modal */}
            {showUnavailableModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                ⚠️ {t('missingModal.title')}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowUnavailableModal(false);
                                    setUnavailableOrderId(null);
                                    setUnavailableItems([]);
                                }}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {(() => {
                                const order = unavailableOrderId ? orders.find(o => o.id === unavailableOrderId) : null;
                                const refundTotal = unavailableItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);
                                const isCardPaid = order?.paymentMethod === 'card' && order?.paymentStatus === 'paid';

                                return (
                                    <>
                                        <p className="text-gray-400 text-sm">
                                            {t('missingModal.subtitle')}
                                        </p>

                                        {/* Unavailable items list */}
                                        <div className="space-y-2">
                                            {unavailableItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-red-600/10 border border-red-500/30 rounded-lg px-3 py-2">
                                                    <span className="text-red-400 font-bold">❌</span>
                                                    <span className="text-white flex-1">{item.quantity}x {item.name}</span>
                                                    <span className="text-gray-400 text-sm">{formatCurrency(((item.price || 0) * item.quantity), order?.currency)}</span>
                                                    <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full">{t('missingModal.unavailable')}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Refund info for card payments */}
                                        {isCardPaid && refundTotal > 0 && (
                                            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
                                                <p className="text-blue-400 text-sm">
                                                    💳 {t('missingModal.cardPaid')} <strong className="text-blue-300">{formatCurrency(refundTotal, order.currency)}</strong> {t('missingModal.partialRefund')}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Warning */}
                            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-3">
                                <p className="text-yellow-400 text-sm">
                                    ⚠️ {t('missingModal.warning')}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowUnavailableModal(false);
                                        setUnavailableOrderId(null);
                                        setUnavailableItems([]);
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                                >
                                    {t('missingModal.cancel')}
                                </button>
                                <button
                                    onClick={async () => {
                                        if (unavailableOrderId) {
                                            await updateOrderStatus(unavailableOrderId, 'accepted', undefined, unavailableItems);
                                        }
                                        setShowUnavailableModal(false);
                                        setUnavailableOrderId(null);
                                        setUnavailableItems([]);
                                    }}
                                    className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center justify-center gap-2"
                                >
                                    ⚠️ {t('missingModal.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Order Card Component
function OrderCard({
    order,
    businesses,
    checkedItems,
    onClick,
    t,
    isPreOrder = false,
}: {
    order: Order;
    businesses: Record<string, string>;
    checkedItems: Record<string, Record<number, boolean>>;
    onClick: () => void;
    t: any;
    isPreOrder?: boolean;
}) {
    const locale = useLocale();
    const dateLocale = locale === 'de' ? 'de-DE' : locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : locale === 'nl' ? 'nl-NL' : 'de-DE';
    const statusInfo = orderStatuses[order.status];
    const typeInfo = orderTypes[order.type];
    const itemCount = order.items?.length || 0;
    const checked = checkedItems[order.id] || {};
    const checkedCount = Object.values(checked).filter(Boolean).length;

    // Format scheduled time for pre-orders
    const formatScheduledTime = () => {
        if (!order.scheduledAt) return '';
        const d = order.scheduledAt.toDate();
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = d.toDateString() === tomorrow.toDateString();

        const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `${t('today')} ${time}`;
        if (isTomorrow) return `${t('tomorrow')} ${time}`;
        return d.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' }) + ` · ${time}`;
    };

    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl p-3 transition ${isPreOrder
                ? 'bg-purple-900/20 hover:bg-purple-900/30 border-l-3 border-purple-500'
                : 'bg-gray-700 hover:bg-gray-600'
                }`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">
                    #{order.orderNumber || order.id.slice(0, 6).toUpperCase()}
                </span>
                <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-xs bg-${typeInfo?.color || 'gray'}-600/30 text-${typeInfo?.color || 'gray'}-400`}>
                        {typeInfo?.icon} {typeInfo?.label}
                    </span>
                </div>
            </div>
            <p className="text-gray-400 text-xs mb-1">
                {businesses[order.businessId] || t('modal.business')}
            </p>
            {/* Pre-order scheduled time badge */}
            {isPreOrder && order.scheduledAt && (
                <div className="mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-purple-600/30 text-purple-300 text-xs font-medium">
                        🕐 {formatScheduledTime()}
                    </span>
                </div>
            )}
            {/* Dine-in table badge + source */}
            {order.type === 'dine_in' && (
                <div className="mb-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-xs font-medium">
                            🍽️ {t('kanban.table')} {order.tableNumber ? `#${order.tableNumber}` : ''}
                        </span>
                        {order.isGroupOrder && (
                            <span className="px-2 py-0.5 rounded bg-purple-600/30 text-purple-300 text-xs font-medium">
                                👥 {t('kanban.group')}{order.groupParticipantCount ? ` (${order.groupParticipantCount} ${t('kanban.person')})` : ''}
                            </span>
                        )}
                        {order.paymentStatus === 'paid' && (
                            <span className="px-1.5 py-0.5 rounded bg-green-600/30 text-green-400 text-xs">✓</span>
                        )}
                    </div>
                    <p className="text-gray-400 text-xs pl-0.5">
                        {order.waiterName ? `👤 ${order.waiterName}` : `📱 ${t('kanban.customerApp')}`}
                    </p>
                    {order.servedByName && (order.status === 'served' || order.status === 'delivered' || order.status === 'completed') && (
                        <p className="text-teal-400 text-xs pl-0.5">
                            🍽️ {order.servedByName} {t('kanban.servedBy')}
                        </p>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className="text-green-400 font-bold">{globalFormatCurrency(order.total || 0, order.currency)}</span>
                <div className="flex items-center gap-2">
                    {itemCount > 0 && (order.status === 'preparing' || order.status === 'accepted') && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${checkedCount >= itemCount ? 'bg-green-600/30 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
                            ✓{checkedCount}/{itemCount}
                        </span>
                    )}
                    <span className="text-gray-500 text-xs">
                        {order.createdAt?.toDate().toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        </button>
    );
}
