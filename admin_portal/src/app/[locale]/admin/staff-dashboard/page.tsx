'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocale } from 'next-intl';
import {
    collection, getDocs, query, where, orderBy, Timestamp, onSnapshot, limit as fbLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { checkLimit, type LimitCheckResult } from '@/services/limitService';

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

function getRoleLabel(role: string, t: (key: string) => string): string {
    if (!role) return t('belirsiz_rol');
    if (role.includes('admin')) return t('yonetici_rol');
    if (role.includes('staff')) return t('personel_rol');
    if (role.includes('waiter')) return t('garson_rol');
    if (role === 'driver') return t('surucu_rol');
    return role;
}

function getRoleBadgeClass(role: string): string {
    if (role.includes('admin')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (role.includes('staff')) return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (role.includes('waiter')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (role === 'driver') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-gray-500/20 text-foreground border-gray-500/30';
}

function formatDurationRaw(minutes: number, minLabel: string, hourLabel: string): string {
    if (minutes < 60) return `${Math.round(minutes)} ${minLabel}`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h} ${hourLabel} ${m} ${minLabel}` : `${h} ${hourLabel}`;
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

// Generate a secure random password
function generateSecurePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;
    // Ensure at least one from each category
    let pw = '';
    pw += upper[Math.floor(Math.random() * upper.length)];
    pw += lower[Math.floor(Math.random() * lower.length)];
    pw += digits[Math.floor(Math.random() * digits.length)];
    pw += special[Math.floor(Math.random() * special.length)];
    for (let i = 4; i < 12; i++) {
        pw += all[Math.floor(Math.random() * all.length)];
    }
    // Shuffle
    return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export default function StaffDashboardPage() {
    
  const t = useTranslations('AdminStaffdashboard');
  const locale = useLocale();
const { admin, loading: adminLoading } = useAdmin();

    // State
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [orders, setOrders] = useState<StaffOrder[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'all'>('active');
    const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

    // Create Staff Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [createPhone, setCreatePhone] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
    const [createRole, setCreateRole] = useState('kasap_staff');

    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [personnelQuota, setPersonnelQuota] = useState<LimitCheckResult | null>(null);

    // Resolve business ID via shared hook
    const businessId = useAdminBusinessId();

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
                            : d.email?.split('@')[0] || ''),
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

    // ─── Personnel Quota Check ───────────────────────────────────────────
    useEffect(() => {
        if (!businessId || adminLoading) return;
        checkLimit(businessId, 'personnel').then(setPersonnelQuota).catch(console.error);
    }, [businessId, adminLoading, staff.length]);

    // ─── Create Staff Handler ────────────────────────────────────────────
    const handleCreateStaff = useCallback(async () => {
        if (!createName) { setCreateError(t('zorunlu_alan')); return; }
        if (!createEmail && !createPhone) { setCreateError(t('zorunlu_alan')); return; }
        if (!createPassword || createPassword.length < 6) { setCreateError(t('min_sifre_uzunlugu')); return; }
        if (createPassword !== createPasswordConfirm) { setCreateError(t('sifreler_uyusmuyor')); return; }

        // Check quota
        if (personnelQuota && !personnelQuota.allowed && personnelQuota.overageAction === 'block') {
            setCreateError(t('quota_dolu'));
            return;
        }

        setCreating(true);
        setCreateError('');

        try {
            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: createEmail || undefined,
                    password: createPassword,
                    displayName: createName,
                    phone: createPhone || undefined,
                    role: 'admin',
                    adminType: createRole,
                    isDriver: createRole === 'teslimat',
                    driverType: createRole === 'teslimat' ? 'business' : undefined,
                    businessId: businessId,
                    butcherName: admin?.butcherName || admin?.businessName || '',
                    isPrimaryAdmin: false,
                    createdBy: admin?.email || admin?.id,
                    createdBySource: 'business_admin',
                    assignerName: admin?.displayName || '',
                    assignerEmail: admin?.email || '',
                    assignerPhone: admin?.phone || '',
                    assignerRole: admin?.adminType || 'admin',
                    locale: locale || 'de',
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setCreateError(data.error || t('olusturma_hatasi'));
                setCreating(false);
                return;
            }

            let successMsg = t('kullanici_olusturuldu');
            if (data.notifications) {
                const { email, sms } = data.notifications;
                const parts: string[] = [];

                if (email?.sent) {
                    parts.push(t('email_gonderildi'));
                } else if (email?.address && !email?.sent) {
                    parts.push(`${t('email_gonderilemedi')}: ${email.error || '?'}`);
                }

                if (sms?.sent) {
                    parts.push(t('sms_gonderildi'));
                } else if (sms?.address && !sms?.sent) {
                    parts.push(`${t('sms_gonderilemedi')}: ${sms.error || '?'}`);
                }

                if (parts.length > 0) {
                    successMsg += '\n\n' + parts.join('\n');
                }
            }
            alert(successMsg);

            // Success - reset and close
            setShowCreateModal(false);
            setCreateName('');
            setCreateEmail('');
            setCreatePhone('');
            setCreatePassword('');
            setCreatePasswordConfirm('');
            setCreateRole('kasap_staff');

            setCreateError('');

            // Refresh staff list
            const adminsRef = collection(db, 'admins');
            const q = query(adminsRef, where('businessId', '==', businessId));
            const snapshot = await getDocs(q);
            const q2Snap = await getDocs(query(adminsRef, where('butcherId', '==', businessId)));
            const staffMap = new Map<string, StaffMember>();
            const processDoc = (docSnap: any) => {
                const d = docSnap.data();
                if (staffMap.has(docSnap.id)) return;
                staffMap.set(docSnap.id, {
                    id: docSnap.id,
                    displayName: d.displayName || d.firstName ? `${d.firstName || ''} ${d.lastName || ''}`.trim() : d.email?.split('@')[0] || '',
                    firstName: d.firstName, lastName: d.lastName, email: d.email,
                    phone: d.phone || d.phoneNumber, phoneNumber: d.phoneNumber,
                    role: d.role || d.adminType || '', adminType: d.adminType,
                    isDriver: d.isDriver === true, isActive: d.isActive !== false,
                    isPrimaryAdmin: d.isPrimaryAdmin === true, photoURL: d.photoURL,
                    businessId: d.businessId || d.butcherId, businessName: d.businessName || d.butcherName,
                    fcmToken: d.fcmToken, createdAt: d.createdAt?.toDate?.() || null,
                    isOnShift: d.isOnShift === true, shiftStatus: d.shiftStatus || 'off',
                    shiftStartedAt: d.shiftStartedAt, shiftAssignedTables: d.shiftAssignedTables || [],
                    shiftStartLocation: d.shiftStartLocation, currentShiftId: d.currentShiftId,
                });
            };
            snapshot.docs.forEach(processDoc);
            q2Snap.docs.forEach(processDoc);
            setStaff(Array.from(staffMap.values()));

            // Refresh quota
            if (businessId) {
                checkLimit(businessId, 'personnel').then(setPersonnelQuota).catch(console.error);
            }
        } catch (error) {
            console.error('Create staff error:', error);
            setCreateError(t('olusturma_hatasi'));
        }
        setCreating(false);
    }, [createName, createEmail, createPhone, createPassword, createPasswordConfirm, createRole, businessId, admin, personnelQuota, t]);

    // ─── Available Roles for Staff Creation ────────────────────────────────
    const availableRoles = useMemo(() => {
        const adminType = admin?.adminType || '';
        if (adminType.includes('kasap')) return [
            { value: 'kasap_staff', label: t('kasap_personeli') },
            { value: 'garson', label: t('garson_rolu') },
            { value: 'teslimat', label: t('teslimat_rolu') },
        ];
        if (adminType.includes('restoran')) return [
            { value: 'restoran_staff', label: t('restoran_personeli') },
            { value: 'garson', label: t('garson_rolu') },
            { value: 'teslimat', label: t('teslimat_rolu') },
        ];
        if (adminType.includes('market')) return [
            { value: 'market_staff', label: t('market_personeli') },
            { value: 'teslimat', label: t('teslimat_rolu') },
        ];
        return [
            { value: 'kasap_staff', label: t('isletme_personeli') },
            { value: 'garson', label: t('garson_rolu') },
            { value: 'teslimat', label: t('teslimat_rolu') },
        ];
    }, [admin, t]);

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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin text-4xl">⏳</div>
            </div>
        );
    }

    if (!admin || !businessId) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <p className="text-3xl mb-2">🔒</p>
                    <p className="text-muted-foreground">{t('bu_sayfaya_erisim_yetkiniz_yok')}</p>
                </div>
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background p-4 md:p-6">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                            {t('personel_durumu')}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('i_sletmenize_atanmis_personelin_aktuel_d')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Quota Indicator */}
                        {personnelQuota && (
                            <div className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border">
                                {personnelQuota.limit !== null
                                    ? `${personnelQuota.currentUsage}/${personnelQuota.limit}`
                                    : `${personnelQuota.currentUsage} / ${t('quota_sinirsiz')}`
                                }
                            </div>
                        )}
                        {/* Create Staff Button */}
                        <button
                            onClick={() => { setShowCreateModal(true); setCreateError(''); }}
                            disabled={personnelQuota?.allowed === false && personnelQuota?.overageAction === 'block'}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                                personnelQuota?.allowed === false && personnelQuota?.overageAction === 'block'
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                        >
                            + {t('yeni_personel_ekle')}
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-border">
                        <div className="text-3xl font-bold text-foreground">{stats.totalStaff}</div>
                        <div className="text-xs text-muted-foreground mt-1">{t('toplam_personel')}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-100 dark:from-emerald-900/40 to-emerald-950/40 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700/30">
                        <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">{stats.onShiftNow}</div>
                        <div className="text-xs text-emerald-800 dark:text-emerald-400/60 mt-1">{t('vardiyada')}</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-100 dark:from-yellow-900/40 to-yellow-950/40 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700/30">
                        <div className="text-3xl font-bold text-yellow-800 dark:text-yellow-400">{stats.onBreakNow}</div>
                        <div className="text-xs text-yellow-800 dark:text-yellow-400/60 mt-1">{t('molada')}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-100 dark:from-blue-900/40 to-blue-950/40 rounded-xl p-4 border border-blue-200 dark:border-blue-700/30">
                        <div className="text-3xl font-bold text-blue-800 dark:text-blue-400">{stats.activeDrivers}</div>
                        <div className="text-xs text-blue-800 dark:text-blue-400/60 mt-1">{t('aktif_surucu')}</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-100 dark:from-amber-900/40 to-amber-950/40 rounded-xl p-4 border border-amber-200 dark:border-amber-700/30">
                        <div className="text-3xl font-bold text-amber-800 dark:text-amber-400">{stats.deliveringNow}</div>
                        <div className="text-xs text-amber-800 dark:text-amber-400/60 mt-1">{t('yolda_su_an')}</div>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2 mb-4">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${viewMode === 'active'
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-card border-border text-muted-foreground hover:bg-gray-700'
                            }`}
                    >
                        {t('aktif_personel')}{staffWithActivity.filter(s => s.activityStatus !== 'offline' || s.todayDeliveries.length > 0 || s.isOnShift).length})
                    </button>
                    <button
                        onClick={() => setViewMode('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${viewMode === 'all'
                            ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-card border-border text-muted-foreground hover:bg-gray-700'
                            }`}
                    >
                        {t('tum_personel')}{staff.length})
                    </button>
                </div>

                {/* Staff List */}
                {(loadingStaff || loadingOrders) ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
                        <span className="ml-4 text-muted-foreground">{t('personel_bilgileri_yukleniyor')}</span>
                    </div>
                ) : filteredStaff.length === 0 ? (
                    <div className="text-center py-16 bg-card/30 rounded-xl border border-dashed border-border">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-muted-foreground">
                            {viewMode === 'active'
                                ? t('bugun_aktif_personel_bulunamadi')
                                : t('bu_isletmeye_atanmis_personel_bulunamadi')
                            }
                        </p>
                        {viewMode === 'active' && (
                            <button
                                onClick={() => setViewMode('all')}
                                className="mt-3 text-cyan-800 dark:text-cyan-400 hover:text-cyan-300 text-sm underline"
                            >
                                {t('tum_personeli_goruntule')}
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
                                    className={`bg-card rounded-xl border transition-all ${member.activityStatus === 'on_shift'
                                        ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                        : member.activityStatus === 'delivering'
                                            ? 'border-amber-500/40 shadow-lg shadow-amber-500/10'
                                            : member.activityStatus === 'paused'
                                                ? 'border-yellow-500/30 shadow-md shadow-yellow-500/5'
                                                : member.activityStatus === 'active'
                                                    ? 'border-emerald-500/30'
                                                    : member.activityStatus === 'idle'
                                                        ? 'border-gray-600'
                                                        : 'border-border/50 opacity-70'
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
                                                <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-foreground font-bold text-lg ${member.activityStatus === 'on_shift'
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
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-border ${member.activityStatus === 'on_shift'
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
                                                    <h3 className="text-foreground font-semibold truncate">{member.displayName}</h3>
                                                    {/* Role Badge */}
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.role)}`}>
                                                        {getRoleLabel(member.role, t)}
                                                    </span>
                                                    {/* Driver Badge */}
                                                    {member.isDriver && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                            {t('surucu')}
                                                        </span>
                                                    )}
                                                    {/* Primary Admin Badge */}
                                                    {member.isPrimaryAdmin && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                            {t('i_sletme_sahibi')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                    {member.phone && <span>📞 {member.phone}</span>}
                                                    {member.email && <span className="truncate">✉️ {member.email}</span>}
                                                </div>
                                            </div>

                                            {/* Right Side - Activity Info */}
                                            <div className="text-right shrink-0">
                                                {member.activityStatus === 'on_shift' && (
                                                    <div>
                                                        <div className="text-emerald-800 dark:text-emerald-400 font-bold text-sm flex items-center justify-end gap-1">
                                                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                                            {t('vardiyada')}
                                                        </div>
                                                        {member.shiftStartedAt && (
                                                            <ShiftTimer startedAt={member.shiftStartedAt} />
                                                        )}
                                                        {member.shiftAssignedTables && member.shiftAssignedTables.length > 0 && (
                                                            <div className="text-cyan-800 dark:text-cyan-400/70 text-xs mt-0.5">
                                                                {t('masa_label')}: {member.shiftAssignedTables.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {member.activityStatus === 'paused' && (
                                                    <div>
                                                        <div className="text-yellow-800 dark:text-yellow-400 font-bold text-sm">{t('mola')}</div>
                                                        {member.shiftStartedAt && (
                                                            <ShiftTimer startedAt={member.shiftStartedAt} />
                                                        )}
                                                    </div>
                                                )}
                                                {member.activityStatus === 'delivering' && member.activeDelivery && (
                                                    <div className="animate-pulse">
                                                        <div className="text-amber-800 dark:text-amber-400 font-bold text-sm">{t('yolda')}</div>
                                                        <div className="text-amber-300/70 text-xs">
                                                            #{member.activeDelivery.orderNumber}
                                                        </div>
                                                        {member.activeDelivery.startedAt && (
                                                            <div className="text-amber-300/50 text-xs">
                                                                {member.activeDelivery.startedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {t('cikis_saati')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {member.activityStatus === 'active' && (
                                                    <div>
                                                        <div className="text-emerald-800 dark:text-emerald-400 font-bold text-sm">{t('aktif')}</div>
                                                        <div className="text-emerald-300/70 text-xs">
                                                            {member.todayDeliveries.length} {t('teslimat_kaydi_yok').split(' ')[0] || 'delivery'}
                                                        </div>
                                                    </div>
                                                )}
                                                {member.activityStatus === 'idle' && (
                                                    <div className="text-muted-foreground text-sm">{t('bosta')}</div>
                                                )}
                                                {member.activityStatus === 'offline' && (
                                                    <div className="text-gray-500 text-sm">{t('pasif')}</div>
                                                )}

                                                {/* Tables */}
                                                {member.tablesServedToday.length > 0 && (
                                                    <div className="mt-1 text-xs text-cyan-800 dark:text-cyan-400">
                                                        {t('masa_label')}: {member.tablesServedToday.join(', ')}
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
                                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">{t('bugun_teslimat')}</span>
                                                    <span className="text-foreground font-medium">{member.todayDeliveries.length}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">{t('bugun_calisma')}</span>
                                                    <span className="text-foreground font-medium">{formatDurationRaw(member.todayHours, t('dk_kisaltma'), t('sa_kisaltma'))}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">{t('hafta_label')}</span>
                                                    <span className="text-foreground font-medium">{formatDurationRaw(member.weekHours, t('dk_kisaltma'), t('sa_kisaltma'))}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">{t('ay_label')}</span>
                                                    <span className="text-foreground font-medium">{formatDurationRaw(member.monthHours, t('dk_kisaltma'), t('sa_kisaltma'))}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-gray-500">{t('toplam')}</span>
                                                    <span className="text-foreground font-medium">{member.totalDeliveries}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedStaff === member.id && (
                                        <div className="border-t border-border p-4 bg-gray-850/50">
                                            {/* Delivery History */}
                                            {member.deliveryOrders.length > 0 ? (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-foreground mb-3">
                                                        {t('teslimat_gecmisi')}{dateRange === 'today' ? t('bugun') : dateRange === 'week' ? t('bu_hafta') : t('bu_ay')})
                                                    </h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-left text-gray-500 border-b border-border">
                                                                    <th className="pb-2 pr-4">{t('siparis')}</th>
                                                                    <th className="pb-2 pr-4">{t('durum')}</th>
                                                                    <th className="pb-2 pr-4">{t('alis')}</th>
                                                                    <th className="pb-2 pr-4">{t('cikis')}</th>
                                                                    <th className="pb-2 pr-4">{t('sure')}</th>
                                                                    <th className="pb-2">{t('tutar')}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {member.deliveryOrders.slice(0, 20).map(order => {
                                                                    const duration = order.claimedAt && order.completedAt
                                                                        ? (order.completedAt.getTime() - order.claimedAt.getTime()) / 60000
                                                                        : null;
                                                                    return (
                                                                        <tr key={order.id} className="border-b border-border/30 hover:bg-gray-700/20">
                                                                            <td className="py-2 pr-4">
                                                                                <span className="text-cyan-800 dark:text-cyan-400 font-mono">#{order.orderNumber}</span>
                                                                            </td>
                                                                            <td className="py-2 pr-4">
                                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300'
                                                                                    : order.status === 'onTheWay' ? 'bg-amber-500/20 text-amber-300'
                                                                                        : order.status === 'cancelled' ? 'bg-red-500/20 text-red-300'
                                                                                            : 'bg-gray-500/20 text-foreground'
                                                                                    }`}>
                                                                                    {order.status === 'delivered' ? t('teslim_edildi') :
                                                                                        order.status === 'onTheWay' ? t('yolda') :
                                                                                            order.status === 'cancelled' ? t('iptal_edildi') :
                                                                                                order.status}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 pr-4 text-muted-foreground">
                                                                                {order.claimedAt?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '-'}
                                                                            </td>
                                                                            <td className="py-2 pr-4 text-muted-foreground">
                                                                                {order.startedAt?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) || '-'}
                                                                            </td>
                                                                            <td className="py-2 pr-4 text-muted-foreground">
                                                                                {duration ? formatDurationRaw(duration, t('dk_kisaltma'), t('sa_kisaltma')) : '-'}
                                                                            </td>
                                                                            <td className="py-2 text-foreground font-medium">
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
                                                        {dateRange === 'today' ? t('bugun') : dateRange === 'week' ? t('bu_hafta') : t('bu_ay')} {t('teslimat_kaydi_yok')}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Table Service History */}
                                            {member.tablesServedToday.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-border/50">
                                                    <h4 className="text-sm font-semibold text-foreground mb-2">
                                                        {t('bugun_servis_edilen_masalar')}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {member.tablesServedToday.map((table, i) => (
                                                            <span
                                                                key={i}
                                                                className="px-3 py-1.5 bg-cyan-800/30 text-cyan-300 rounded-lg text-sm border border-cyan-600/30"
                                                            >
                                                                {t('masa_label')} {table}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Staff Info Footer */}
                                            <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                                <span>🆔 {member.id.slice(0, 8)}...</span>
                                                {member.createdAt && (
                                                    <span>{t('kayit')} {member.createdAt.toLocaleDateString('de-DE')}</span>
                                                )}
                                                <span className={member.isActive ? 'text-emerald-800 dark:text-emerald-400' : 'text-red-800 dark:text-red-400'}>
                                                    {member.isActive ? t('aktif_hesap') : t('pasif_hesap')}
                                                </span>
                                                {member.fcmToken && (
                                                    <span className="text-emerald-500">{t('bildirim_aktif')}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* ═══ Create Staff Modal ═══ */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-background border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-border">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-foreground">{t('yeni_personel_ekle')}</h2>
                                <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
                            </div>
                            {/* Quota Info */}
                            {personnelQuota && (
                                <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
                                    personnelQuota.allowed
                                        ? 'bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/30 text-emerald-300'
                                        : 'bg-red-900/30 border border-red-200 dark:border-red-700/30 text-red-300'
                                }`}>
                                    {personnelQuota.limit !== null
                                        ? t('personel_quota').replace('{current}', String(personnelQuota.currentUsage)).replace('{limit}', String(personnelQuota.limit))
                                        : `${personnelQuota.currentUsage} / ${t('quota_sinirsiz')}`
                                    }
                                    {!personnelQuota.allowed && personnelQuota.overageAction === 'block' && (
                                        <div className="mt-1 text-xs opacity-70">{t('upgrade_mesaji')}</div>
                                    )}
                                    {!personnelQuota.allowed && personnelQuota.overageAction === 'overage_fee' && personnelQuota.overageFee > 0 && (
                                        <div className="mt-1 text-xs text-amber-300">+{personnelQuota.overageFee}EUR</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-muted-foreground text-xs block mb-1">{t('ad_soyad')} *</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    className="w-full bg-card border border-gray-600 rounded-lg px-4 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:outline-none transition"
                                    placeholder="Max Mustermann"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-muted-foreground text-xs block mb-1">{t('eposta_adresi')}</label>
                                <input
                                    type="email"
                                    value={createEmail}
                                    onChange={(e) => setCreateEmail(e.target.value)}
                                    className="w-full bg-card border border-gray-600 rounded-lg px-4 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:outline-none transition"
                                    placeholder="staff@example.com"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="text-muted-foreground text-xs block mb-1">{t('telefon_numarasi')}</label>
                                <input
                                    type="tel"
                                    value={createPhone}
                                    onChange={(e) => setCreatePhone(e.target.value)}
                                    className="w-full bg-card border border-gray-600 rounded-lg px-4 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:outline-none transition"
                                    placeholder="+49 170 1234567"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-muted-foreground text-xs">{t('sifre_belirle')} *</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-gray-500 hover:text-foreground text-xs transition"
                                        >
                                            {showPassword ? t('sifre_gizle') : t('sifre_goster')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const pw = generateSecurePassword();
                                                setCreatePassword(pw);
                                                setCreatePasswordConfirm(pw);
                                                setShowPassword(true);
                                            }}
                                            className="px-2.5 py-1 bg-blue-600/20 text-blue-800 dark:text-blue-400 border border-blue-500/30 rounded-md text-xs font-medium hover:bg-blue-600/30 transition flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                            {t('sifre_olustur')}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={createPassword}
                                            onChange={(e) => setCreatePassword(e.target.value)}
                                            className="w-full bg-card border border-gray-600 rounded-lg px-4 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:outline-none transition font-mono"
                                            placeholder="******"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-muted-foreground text-xs block mb-1">{t('sifre_tekrar')} *</label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={createPasswordConfirm}
                                            onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                                            className="w-full bg-card border border-gray-600 rounded-lg px-4 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:outline-none transition font-mono"
                                            placeholder="******"
                                        />
                                    </div>
                                </div>
                                {showPassword && createPassword && (
                                    <p className="text-xs text-amber-800 dark:text-amber-400/80 mt-1.5">
                                        {t('sifre_gonderilecek')}
                                    </p>
                                )}
                            </div>

                            {/* Role */}
                            <div>
                                <label className="text-muted-foreground text-xs block mb-1">{t('rol_sec')} *</label>
                                <select
                                    value={createRole}
                                    onChange={(e) => setCreateRole(e.target.value)}
                                    className="w-full bg-card border border-gray-600 rounded-lg px-4 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:outline-none transition"
                                >
                                    {availableRoles.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Driver info - auto-detected from role */}
                            {createRole === 'teslimat' && (
                                <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-lg px-4 py-3">
                                    <span className="text-emerald-800 dark:text-emerald-400 text-sm">{t('surucu_otomatik')}</span>
                                </div>
                            )}

                            {/* Error */}
                            {createError && (
                                <div className="bg-red-900/30 border border-red-200 dark:border-red-700/30 text-red-300 text-sm px-4 py-3 rounded-lg">
                                    {createError}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-border flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2.5 bg-card border border-gray-600 text-foreground rounded-lg text-sm font-medium hover:bg-gray-700 transition"
                            >
                                {t('iptal')}
                            </button>
                            <button
                                onClick={handleCreateStaff}
                                disabled={creating || (personnelQuota?.allowed === false && personnelQuota?.overageAction === 'block')}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                                    creating || (personnelQuota?.allowed === false && personnelQuota?.overageAction === 'block')
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                            >
                                {creating ? t('olusturuluyor') : t('personel_olustur')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
