'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    collection, getDocs, query, where, orderBy, Timestamp, onSnapshot, limit as fbLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StaffMember {
    id: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
    role: string;
    adminType?: string;
    isDriver: boolean;
    isActive: boolean;
    isPrimaryAdmin?: boolean;
    photoURL?: string;
    businessId?: string;
    businessName?: string;
    fcmToken?: string;
    createdAt?: Date;
    // Shift fields from admins doc
    isOnShift?: boolean;
    shiftStatus?: string; // 'active' | 'paused' | 'off'
    shiftStartedAt?: any;
    shiftAssignedTables?: number[];
    shiftStartLocation?: { address?: string; lat?: number; lng?: number };
    currentShiftId?: string;
}

interface StaffOrder {
    id: string;
    orderNumber?: string;
    status: string;
    courierId?: string;
    courierName?: string;
    courierPhone?: string;
    tableNumber?: string;
    claimedAt?: Date;
    startedAt?: Date;
    createdAt?: Date;
    completedAt?: Date;
    deliveredAt?: Date;
    deliveryType?: string;
    total?: number;
    items?: any[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRoleLabel(role: string): string {
    if (!role) return 'Belirsiz';
    if (role.includes('admin')) return 'Yönetici';
    if (role.includes('staff')) return 'Personel';
    if (role.includes('waiter')) return 'Garson';
    if (role === 'driver') return 'Sürücü';
    return role;
}

function getRoleBadgeClass(role: string): string {
    if (role.includes('admin')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (role.includes('staff')) return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (role.includes('waiter')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (role === 'driver') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)} dk`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function isThisWeek(date: Date): boolean {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    return date >= startOfWeek && date <= now;
}

function isThisMonth(date: Date): boolean {
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function StaffDashboardPage() {
    const { admin, loading: adminLoading } = useAdmin();

    // State
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [orders, setOrders] = useState<StaffOrder[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'all'>('active');
    const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

    // Resolve business ID
    const businessId = useMemo(() => {
        if (!admin) return null;
        return (admin as any).butcherId
            || (admin as any).restaurantId
            || (admin as any).marketId
            || (admin as any).kermesId
            || (admin as any).businessId;
    }, [admin]);

    // ─── Load Staff ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!businessId || adminLoading) return;

        const loadStaff = async () => {
            setLoadingStaff(true);
            try {
                // Query admins collection for this business
                const adminsRef = collection(db, 'admins');
                const q = query(adminsRef, where('businessId', '==', businessId));
                const snapshot = await getDocs(q);

                // Also check legacy butcherId field
                const q2 = query(adminsRef, where('butcherId', '==', businessId));
                const snapshot2 = await getDocs(q2);

                const staffMap = new Map<string, StaffMember>();

                const processDoc = (docSnap: any) => {
                    const d = docSnap.data();
                    if (staffMap.has(docSnap.id)) return;
                    staffMap.set(docSnap.id, {
                        id: docSnap.id,
                        displayName: d.displayName || (d.firstName
                            ? `${d.firstName || ''} ${d.lastName || ''}`.trim()
                            : d.email?.split('@')[0] || 'İsimsiz'),
                        firstName: d.firstName,
                        lastName: d.lastName,
                        email: d.email,
                        phone: d.phone || d.phoneNumber,
                        phoneNumber: d.phoneNumber,
                        role: d.role || d.adminType || '',
                        adminType: d.adminType,
                        isDriver: d.isDriver === true,
                        isActive: d.isActive !== false,
                        isPrimaryAdmin: d.isPrimaryAdmin === true,
                        photoURL: d.photoURL,
                        businessId: d.businessId || d.butcherId,
                        businessName: d.businessName || d.butcherName,
                        fcmToken: d.fcmToken,
                        createdAt: d.createdAt?.toDate?.() || null,
                        // Shift fields
                        isOnShift: d.isOnShift === true,
                        shiftStatus: d.shiftStatus || 'off',
                        shiftStartedAt: d.shiftStartedAt,
                        shiftAssignedTables: d.shiftAssignedTables || [],
                        shiftStartLocation: d.shiftStartLocation,
                        currentShiftId: d.currentShiftId,
                    });
                };

                snapshot.docs.forEach(processDoc);
                snapshot2.docs.forEach(processDoc);

                setStaff(Array.from(staffMap.values()));
            } catch (err) {
                console.error('Error loading staff:', err);
            }
            setLoadingStaff(false);
        };

        loadStaff();
    }, [businessId, adminLoading]);

    // ─── Real-time shift listener ────────────────────────────────────────
    useEffect(() => {
        if (!businessId || adminLoading) return;

        // Listen for admins who have an active shift for this business
        const adminsRef = collection(db, 'admins');
        const q1 = query(adminsRef, where('isOnShift', '==', true), where('shiftBusinessId', '==', businessId));
        const q2 = query(adminsRef, where('isOnShift', '==', true), where('businessId', '==', businessId));

        const mergeAndUpdate = (snap1Docs: any[], snap2Docs: any[]) => {
            const merged = new Map<string, any>();
            [...snap1Docs, ...snap2Docs].forEach((doc: any) => {
                merged.set(doc.id, doc.data());
            });

            setStaff(prev => prev.map(s => {
                const shiftData = merged.get(s.id);
                if (shiftData) {
                    return {
                        ...s,
                        isOnShift: true,
                        shiftStatus: shiftData.shiftStatus || 'active',
                        shiftStartedAt: shiftData.shiftStartedAt,
                        shiftAssignedTables: shiftData.shiftAssignedTables || [],
                        shiftStartLocation: shiftData.shiftStartLocation,
                        currentShiftId: shiftData.currentShiftId,
                    };
                } else {
                    // Clear shift if not in snapshot anymore
                    if (s.isOnShift) {
                        return { ...s, isOnShift: false, shiftStatus: 'off', shiftStartedAt: null, shiftAssignedTables: [], currentShiftId: undefined };
                    }
                    return s;
                }
            }));
        };

        let snap1Docs: any[] = [];
        let snap2Docs: any[] = [];

        const unsub1 = onSnapshot(q1, (snapshot) => {
            snap1Docs = snapshot.docs;
            mergeAndUpdate(snap1Docs, snap2Docs);
        });

        const unsub2 = onSnapshot(q2, (snapshot) => {
            snap2Docs = snapshot.docs;
            mergeAndUpdate(snap1Docs, snap2Docs);
        });

        return () => { unsub1(); unsub2(); };
    }, [businessId, adminLoading]);

    // ─── Load Shift History for working hours ─────────────────────────────
    const [shiftHistory, setShiftHistory] = useState<Map<string, any[]>>(new Map());

    useEffect(() => {
        if (!businessId || adminLoading || staff.length === 0) return;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);

        const shiftsRef = collection(db, 'businesses', businessId, 'shifts');
        const q = query(
            shiftsRef,
            where('startedAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('startedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyMap = new Map<string, any[]>();

            snapshot.docs.forEach(doc => {
                const d = doc.data();
                const staffId = d.staffId;
                if (!staffId) return;
                if (!historyMap.has(staffId)) historyMap.set(staffId, []);
                historyMap.get(staffId)!.push({
                    id: doc.id,
                    ...d,
                    startedAt: d.startedAt?.toDate?.() || null,
                    endedAt: d.endedAt?.toDate?.() || null,
                    totalMinutes: d.totalMinutes || 0,
                    pauseMinutes: d.pauseMinutes || 0,
                    assignedTables: d.assignedTables || [],
                    status: d.status || 'ended',
                });
            });

            setShiftHistory(historyMap);
        }, (error) => {
            console.error('Error loading shift history:', error);
        });

        return () => unsubscribe();
    }, [businessId, adminLoading, staff.length]);

    // ─── Load Orders (today/week/month) ──────────────────────────────────
    useEffect(() => {
        if (!businessId || adminLoading) return;

        setLoadingOrders(true);

        const startDate = new Date();
        if (dateRange === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (dateRange === 'week') {
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
        } else {
            startDate.setDate(startDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
        }

        const ordersRef = collection(db, 'meat_orders');
        const q = query(
            ordersRef,
            where('butcherId', '==', businessId),
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersList: StaffOrder[] = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    orderNumber: d.orderNumber || doc.id.slice(0, 6).toUpperCase(),
                    status: d.status || 'pending',
                    courierId: d.courierId,
                    courierName: d.courierName,
                    courierPhone: d.courierPhone,
                    tableNumber: d.tableNumber || d.tableNo,
                    claimedAt: d.claimedAt?.toDate?.(),
                    startedAt: d.startedAt?.toDate?.(),
                    createdAt: d.createdAt?.toDate?.(),
                    completedAt: d.completedAt?.toDate?.() || (d.status === 'delivered' ? d.updatedAt?.toDate?.() : null),
                    deliveredAt: d.deliveredAt?.toDate?.() || (d.status === 'delivered' ? d.updatedAt?.toDate?.() : null),
                    deliveryType: d.deliveryType || d.deliveryMethod || d.fulfillmentType || 'pickup',
                    total: d.totalPrice || d.totalAmount || d.total || 0,
                    items: d.items || [],
                };
            });
            setOrders(ordersList);
            setLoadingOrders(false);
        }, (error) => {
            console.error('Error loading orders:', error);
            setLoadingOrders(false);
        });

        return () => unsubscribe();
    }, [businessId, adminLoading, dateRange]);

    // ─── Computed Data ──────────────────────────────────────────────────

    const today = new Date();

    // Match orders to staff by courier name
    const staffWithActivity = useMemo(() => {
        return staff.map(s => {
            const staffName = s.displayName.toLowerCase().trim();
            const staffPhone = (s.phone || s.phoneNumber || '').replace(/\s/g, '');

            // Find orders this staff member is courier for
            // Primary: match by courierId (reliable UID match)
            // Fallback: match by courierName or phone (for legacy orders)
            const deliveryOrders = orders.filter(o => {
                // UID-based match (most reliable)
                if (o.courierId && o.courierId === s.id) return true;
                // Name/phone fallback for older orders without courierId
                if (!o.courierName) return false;
                const cn = o.courierName.toLowerCase().trim();
                const cp = (o.courierPhone || '').replace(/\s/g, '');
                return cn === staffName || (staffPhone && cp && cp.includes(staffPhone.slice(-6)));
            });

            // Find table orders this staff might be serving (dine-in orders)
            const tableOrders = orders.filter(o => o.tableNumber && o.deliveryType === 'dine_in');

            // Active delivery task
            const activeDelivery = deliveryOrders.find(o => ['onTheWay', 'out_for_delivery'].includes(o.status));

            // Today's deliveries
            const todayDeliveries = deliveryOrders.filter(o =>
                o.createdAt && isSameDay(o.createdAt, today) && o.status === 'delivered'
            );

            // ── Working hours from SHIFT HISTORY (primary source) ──
            const staffShifts = shiftHistory.get(s.id) || [];
            let todayHours = 0;
            let weekHours = 0;
            let monthHours = 0;

            staffShifts.forEach(shift => {
                const minutes = shift.totalMinutes || 0;
                if (shift.startedAt && isSameDay(shift.startedAt, today)) todayHours += minutes;
                if (shift.startedAt && isThisWeek(shift.startedAt)) weekHours += minutes;
                if (shift.startedAt && isThisMonth(shift.startedAt)) monthHours += minutes;
            });

            // If currently on active shift, add elapsed time
            if (s.isOnShift && s.shiftStatus === 'active' && s.shiftStartedAt) {
                const shiftStart = s.shiftStartedAt?.toDate?.() || (s.shiftStartedAt instanceof Date ? s.shiftStartedAt : null);
                if (shiftStart) {
                    const elapsedMin = (Date.now() - shiftStart.getTime()) / 60000;
                    if (elapsedMin > 0 && elapsedMin < 1440) { // max 24h sanity check
                        todayHours += elapsedMin;
                        weekHours += elapsedMin;
                        monthHours += elapsedMin;
                    }
                }
            }

            // Fallback: if no shift data, use order-based calculation
            if (todayHours === 0 && weekHours === 0 && monthHours === 0) {
                deliveryOrders.forEach(o => {
                    if (o.claimedAt && o.completedAt) {
                        const durationMin = (o.completedAt.getTime() - o.claimedAt.getTime()) / 60000;
                        if (durationMin > 0 && durationMin < 480) {
                            if (o.createdAt && isSameDay(o.createdAt, today)) todayHours += durationMin;
                            if (o.createdAt && isThisWeek(o.createdAt)) weekHours += durationMin;
                            if (o.createdAt && isThisMonth(o.createdAt)) monthHours += durationMin;
                        }
                    }
                });
            }

            // Tables: combine shift-assigned tables + order-served tables
            const shiftTables = (s.isOnShift && s.shiftAssignedTables?.length) ? s.shiftAssignedTables.map(String) : [];
            const orderTables = tableOrders
                .filter(o => o.createdAt && isSameDay(o.createdAt, today))
                .map(o => o.tableNumber)
                .filter(Boolean) as string[];
            const tablesServedToday = [...new Set([...shiftTables, ...orderTables])];

            // ── Determine activity status — SHIFT DATA TAKES PRIORITY ──
            let activityStatus: 'on_shift' | 'paused' | 'active' | 'delivering' | 'idle' | 'offline' = 'offline';
            if (s.isOnShift && s.shiftStatus === 'active') {
                activityStatus = 'on_shift';
            } else if (s.isOnShift && s.shiftStatus === 'paused') {
                activityStatus = 'paused';
            } else if (activeDelivery) {
                activityStatus = 'delivering';
            } else if (todayDeliveries.length > 0) {
                activityStatus = 'active';
            } else if (s.isActive) {
                activityStatus = 'idle';
            }

            // Override: if on shift + delivering, show delivering
            if (s.isOnShift && activeDelivery) {
                activityStatus = 'delivering';
            }

            return {
                ...s,
                deliveryOrders,
                todayDeliveries,
                activeDelivery,
                tablesServedToday,
                todayHours,
                weekHours,
                monthHours,
                activityStatus,
                totalDeliveries: deliveryOrders.filter(o => o.status === 'delivered' || o.deliveredAt).length,
                shiftCount: staffShifts.filter(sh => sh.startedAt && isSameDay(sh.startedAt, today)).length,
            };
        });
    }, [staff, orders, today, shiftHistory]);

    // Filter for active view
    const filteredStaff = useMemo(() => {
        if (viewMode === 'active') {
            return staffWithActivity.filter(s =>
                s.activityStatus !== 'offline' || s.todayDeliveries.length > 0 || s.isOnShift
            );
        }
        return staffWithActivity;
    }, [staffWithActivity, viewMode]);

    // Summary stats
    const stats = useMemo(() => {
        const onShiftNow = staffWithActivity.filter(s => s.activityStatus === 'on_shift' || s.activityStatus === 'delivering').length;
        const onBreakNow = staffWithActivity.filter(s => s.activityStatus === 'paused').length;
        const activeDrivers = staffWithActivity.filter(s => s.isDriver && s.activityStatus !== 'offline').length;
        const deliveringNow = staffWithActivity.filter(s => s.activityStatus === 'delivering').length;

        return {
            totalStaff: staff.length,
            onShiftNow,
            onBreakNow,
            activeDrivers,
            deliveringNow,
        };
    }, [staffWithActivity, staff]);

    // ─── Loading / Auth Guard ───────────────────────────────────────────

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin text-4xl">⏳</div>
            </div>
        );
    }

    if (!admin || !businessId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-3xl mb-2">🔒</p>
                    <p className="text-gray-400">Bu sayfaya erişim yetkiniz yok</p>
                </div>
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-900 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            👷 Personel Durumu
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            İşletmenize atanmış personelin aktüel durumu ve istatistikleri
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
                        <div className="text-3xl font-bold text-white">{stats.totalStaff}</div>
                        <div className="text-xs text-gray-400 mt-1">👥 Toplam Personel</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 rounded-xl p-4 border border-emerald-700/30">
                        <div className="text-3xl font-bold text-emerald-400">{stats.onShiftNow}</div>
                        <div className="text-xs text-emerald-400/60 mt-1">🟢 Vardiyada</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-950/40 rounded-xl p-4 border border-yellow-700/30">
                        <div className="text-3xl font-bold text-yellow-400">{stats.onBreakNow}</div>
                        <div className="text-xs text-yellow-400/60 mt-1">⏸️ Molada</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 rounded-xl p-4 border border-blue-700/30">
                        <div className="text-3xl font-bold text-blue-400">{stats.activeDrivers}</div>
                        <div className="text-xs text-blue-400/60 mt-1">🚗 Aktif Sürücü</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-900/40 to-amber-950/40 rounded-xl p-4 border border-amber-700/30">
                        <div className="text-3xl font-bold text-amber-400">{stats.deliveringNow}</div>
                        <div className="text-xs text-amber-400/60 mt-1">🛣️ Yolda Şu An</div>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2 mb-4">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${viewMode === 'active'
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        🟢 Aktif Personel ({staffWithActivity.filter(s => s.activityStatus !== 'offline' || s.todayDeliveries.length > 0 || s.isOnShift).length})
                    </button>
                    <button
                        onClick={() => setViewMode('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${viewMode === 'all'
                            ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        📋 Tüm Personel ({staff.length})
                    </button>
                </div>

                {/* Staff List */}
                {(loadingStaff || loadingOrders) ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
                        <span className="ml-4 text-gray-400">Personel bilgileri yükleniyor...</span>
                    </div>
                ) : filteredStaff.length === 0 ? (
                    <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-gray-400">
                            {viewMode === 'active'
                                ? 'Bugün aktif personel bulunamadı'
                                : 'Bu işletmeye atanmış personel bulunamadı'
                            }
                        </p>
                        {viewMode === 'active' && (
                            <button
                                onClick={() => setViewMode('all')}
                                className="mt-3 text-cyan-400 hover:text-cyan-300 text-sm underline"
                            >
                                Tüm personeli görüntüle →
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredStaff
                            .sort((a, b) => {
                                // Sort: on_shift > delivering > paused > active > idle > offline
                                const statusOrder: Record<string, number> = { on_shift: 0, delivering: 1, paused: 2, active: 3, idle: 4, offline: 5 };
                                const aOrder = statusOrder[a.activityStatus] ?? 5;
                                const bOrder = statusOrder[b.activityStatus] ?? 5;
                                if (aOrder !== bOrder) return aOrder - bOrder;
                                // Then by deliveries count
                                return b.totalDeliveries - a.totalDeliveries;
                            })
                            .map(member => (
                                <div
                                    key={member.id}
                                    className={`bg-gray-800 rounded-xl border transition-all ${member.activityStatus === 'on_shift'
                                        ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                        : member.activityStatus === 'delivering'
                                            ? 'border-amber-500/40 shadow-lg shadow-amber-500/10'
                                            : member.activityStatus === 'paused'
                                                ? 'border-yellow-500/30 shadow-md shadow-yellow-500/5'
                                                : member.activityStatus === 'active'
                                                    ? 'border-emerald-500/30'
                                                    : member.activityStatus === 'idle'
                                                        ? 'border-gray-600'
                                                        : 'border-gray-700/50 opacity-70'
                                        }`}
                                >
                                    {/* Main Card */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-gray-750/50 transition rounded-xl"
                                        onClick={() => setExpandedStaff(expandedStaff === member.id ? null : member.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Avatar */}
                                            <div className="relative">
                                                <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg ${member.activityStatus === 'on_shift'
                                                    ? 'bg-emerald-600'
                                                    : member.activityStatus === 'delivering'
                                                        ? 'bg-amber-600'
                                                        : member.activityStatus === 'paused'
                                                            ? 'bg-yellow-600'
                                                            : member.activityStatus === 'active'
                                                                ? 'bg-emerald-600'
                                                                : 'bg-gray-600'
                                                    }`}>
                                                    {member.photoURL ? (
                                                        <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        member.displayName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                {/* Status dot */}
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-gray-800 ${member.activityStatus === 'on_shift'
                                                    ? 'bg-emerald-400 animate-pulse'
                                                    : member.activityStatus === 'delivering'
                                                        ? 'bg-amber-400 animate-pulse'
                                                        : member.activityStatus === 'paused'
                                                            ? 'bg-yellow-400'
                                                            : member.activityStatus === 'active'
                                                                ? 'bg-emerald-400'
                                                                : member.activityStatus === 'idle'
                                                                    ? 'bg-gray-400'
                                                                    : 'bg-gray-600'
                                                    }`}></div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-white font-semibold truncate">{member.displayName}</h3>
                                                    {/* Role Badge */}
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.role)}`}>
                                                        {getRoleLabel(member.role)}
                                                    </span>
                                                    {/* Driver Badge */}
                                                    {member.isDriver && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                            🚗 Sürücü
                                                        </span>
                                                    )}
                                                    {/* Primary Admin Badge */}
                                                    {member.isPrimaryAdmin && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                            👑 İşletme Sahibi
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                    {member.phone && <span>📞 {member.phone}</span>}
                                                    {member.email && <span className="truncate">✉️ {member.email}</span>}
                                                </div>
                                            </div>

                                            {/* Right Side - Activity Info */}
                                            <div className="text-right shrink-0">
                                                {member.activityStatus === 'on_shift' && (
                                                    <div>
                                                        <div className="text-emerald-400 font-bold text-sm flex items-center justify-end gap-1">
                                                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                                            Vardiyada
                                                        </div>
                                                        {member.shiftStartedAt && (
                                                            <ShiftTimer startedAt={member.shiftStartedAt} />
                                                        )}
                                                        {member.shiftAssignedTables && member.shiftAssignedTables.length > 0 && (
                                                            <div className="text-cyan-400/70 text-xs mt-0.5">
                                                                🪑 Masa: {member.shiftAssignedTables.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {member.activityStatus === 'paused' && (
                                                    <div>
                                                        <div className="text-yellow-400 font-bold text-sm">⏸️ Mola</div>
                                                        {member.shiftStartedAt && (
                                                            <ShiftTimer startedAt={member.shiftStartedAt} />
                                                        )}
                                                    </div>
                                                )}
                                                {member.activityStatus === 'delivering' && member.activeDelivery && (
                                                    <div className="animate-pulse">
                                                        <div className="text-amber-400 font-bold text-sm">🛣️ Yolda</div>
                                                        <div className="text-amber-300/70 text-xs">
                                                            #{member.activeDelivery.orderNumber}
                                                        </div>
                                                        {member.activeDelivery.startedAt && (
                                                            <div className="text-amber-300/50 text-xs">
                                                                {member.activeDelivery.startedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} çıkış
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {member.activityStatus === 'active' && (
                                                    <div>
                                                        <div className="text-emerald-400 font-bold text-sm">✅ Aktif</div>
                                                        <div className="text-emerald-300/70 text-xs">
                                                            {member.todayDeliveries.length} teslimat
                                                        </div>
                                                    </div>
                                                )}
                                                {member.activityStatus === 'idle' && (
                                                    <div className="text-gray-400 text-sm">⏸️ Boşta</div>
                                                )}
                                                {member.activityStatus === 'offline' && (
                                                    <div className="text-gray-500 text-sm">⚫ Pasif</div>
                                                )}

                                                {/* Tables */}
                                                {member.tablesServedToday.length > 0 && (
                                                    <div className="mt-1 text-xs text-cyan-400">
                                                        🪑 Masa: {member.tablesServedToday.join(', ')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expand Arrow */}
                                            <span className={`text-gray-500 text-sm transition-transform ${expandedStaff === member.id ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </div>

                                        {/* Quick Stats Row */}
                                        {(member.isDriver || member.totalDeliveries > 0) && (
                                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700/50">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">📦 Bugün:</span>
                                                    <span className="text-white font-medium">{member.todayDeliveries.length}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">⏱️ Bugün:</span>
                                                    <span className="text-white font-medium">{formatDuration(member.todayHours)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">📅 Hafta:</span>
                                                    <span className="text-white font-medium">{formatDuration(member.weekHours)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">📆 Ay:</span>
                                                    <span className="text-white font-medium">{formatDuration(member.monthHours)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">📊 Toplam:</span>
                                                    <span className="text-white font-medium">{member.totalDeliveries} teslimat</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedStaff === member.id && (
                                        <div className="border-t border-gray-700 p-4 bg-gray-850/50">
                                            {/* Delivery History */}
                                            {member.deliveryOrders.length > 0 ? (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-300 mb-3">
                                                        📦 Teslimat Geçmişi ({dateRange === 'today' ? 'Bugün' : dateRange === 'week' ? 'Bu Hafta' : 'Bu Ay'})
                                                    </h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-left text-gray-500 border-b border-gray-700">
                                                                    <th className="pb-2 pr-4">Sipariş</th>
                                                                    <th className="pb-2 pr-4">Durum</th>
                                                                    <th className="pb-2 pr-4">Alış</th>
                                                                    <th className="pb-2 pr-4">Çıkış</th>
                                                                    <th className="pb-2 pr-4">Süre</th>
                                                                    <th className="pb-2">Tutar</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {member.deliveryOrders.slice(0, 20).map(order => {
                                                                    const duration = order.claimedAt && order.completedAt
                                                                        ? (order.completedAt.getTime() - order.claimedAt.getTime()) / 60000
                                                                        : null;
                                                                    return (
                                                                        <tr key={order.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                                                                            <td className="py-2 pr-4">
                                                                                <span className="text-cyan-400 font-mono">#{order.orderNumber}</span>
                                                                            </td>
                                                                            <td className="py-2 pr-4">
                                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300'
                                                                                    : order.status === 'onTheWay' ? 'bg-amber-500/20 text-amber-300'
                                                                                        : order.status === 'cancelled' ? 'bg-red-500/20 text-red-300'
                                                                                            : 'bg-gray-500/20 text-gray-300'
                                                                                    }`}>
                                                                                    {order.status === 'delivered' ? '✅ Teslim' :
                                                                                        order.status === 'onTheWay' ? '🛣️ Yolda' :
                                                                                            order.status === 'cancelled' ? '❌ İptal' :
                                                                                                order.status}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 pr-4 text-gray-400">
                                                                                {order.claimedAt?.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) || '-'}
                                                                            </td>
                                                                            <td className="py-2 pr-4 text-gray-400">
                                                                                {order.startedAt?.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) || '-'}
                                                                            </td>
                                                                            <td className="py-2 pr-4 text-gray-400">
                                                                                {duration ? formatDuration(duration) : '-'}
                                                                            </td>
                                                                            <td className="py-2 text-white font-medium">
                                                                                {order.total?.toFixed(2)} €
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6">
                                                    <p className="text-gray-500 text-sm">
                                                        {dateRange === 'today' ? 'Bugün' : dateRange === 'week' ? 'Bu hafta' : 'Bu ay'} teslimat kaydı yok
                                                    </p>
                                                </div>
                                            )}

                                            {/* Table Service History */}
                                            {member.tablesServedToday.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-700/50">
                                                    <h4 className="text-sm font-semibold text-gray-300 mb-2">
                                                        🪑 Bugün Servis Edilen Masalar
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {member.tablesServedToday.map((table, i) => (
                                                            <span
                                                                key={i}
                                                                className="px-3 py-1.5 bg-cyan-800/30 text-cyan-300 rounded-lg text-sm border border-cyan-600/30"
                                                            >
                                                                Masa {table}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Staff Info Footer */}
                                            <div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                                <span>🆔 {member.id.slice(0, 8)}...</span>
                                                {member.createdAt && (
                                                    <span>📅 Kayıt: {member.createdAt.toLocaleDateString('tr-TR')}</span>
                                                )}
                                                <span className={member.isActive ? 'text-emerald-400' : 'text-red-400'}>
                                                    {member.isActive ? '✅ Aktif Hesap' : '❌ Pasif Hesap'}
                                                </span>
                                                {member.fcmToken && (
                                                    <span className="text-emerald-500">📱 Bildirim Aktif</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── ShiftTimer Component ────────────────────────────────────────────────────

function ShiftTimer({ startedAt }: { startedAt: any }) {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        const start = startedAt?.toDate?.() || (startedAt instanceof Date ? startedAt : null);
        if (!start) return;

        const update = () => {
            const diff = Date.now() - start.getTime();
            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setElapsed(
                `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            );
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startedAt]);

    return (
        <div className="text-emerald-300/70 text-xs font-mono">
            ⏱️ {elapsed}
        </div>
    );
}
