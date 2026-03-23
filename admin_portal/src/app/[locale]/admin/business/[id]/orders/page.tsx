'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type Order } from '@/hooks/useOrders';
import { mapFirestoreOrder } from '@/lib/utils/orderMapper';
import OrderDetailsModal from '@/components/admin/OrderDetailsModal';

interface MeatOrderItem {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
}


interface BusinessInfo {
    id: string;
    companyName: string;
    brand: string;
    phone?: string;
}

export default function OrdersPage() {
    
  const t = useTranslations('AdminOrders');
const params = useParams();
    const businessId = params.id as string;

    const [orders, setOrders] = useState<Order[]>([]);
    const [butcher, setBusiness] = useState<BusinessInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [isVendorUser, setIsVendorUser] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [amountMin, setAmountMin] = useState('');
    const [amountMax, setAmountMax] = useState('');

    // Expanded order for inline detail (replaces modal)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [checkedItems, setCheckedItems] = useState<Record<string, Record<number, boolean>>>({});

    // Auto-hide completed orders (McDonald's style: hide after 10 min)
    const [showCompletedOrders, setShowCompletedOrders] = useState(false);

    // Reject order modal
    const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Edit order modal
    const [editingOrderItems, setEditingOrderItems] = useState<Order | null>(null);

    // Check if user is vendor admin (for smart back link)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const vendorAdminDoc = await getDoc(doc(db, 'vendor_admins', user.uid));
                setIsVendorUser(vendorAdminDoc.exists());
            }
        });
        return () => unsubscribe();
    }, []);

    // Load butcher info
    useEffect(() => {
        const loadBusiness = async () => {
            try {
                const docRef = doc(db, 'businesses', businessId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setBusiness({
                        id: docSnap.id,
                        companyName: docSnap.data().companyName || 'Kasap',
                        brand: docSnap.data().brand || '',
                        phone: docSnap.data().phone || docSnap.data().phoneNumber || '',
                    });
                }
            } catch (error) {
                console.error('Error loading butcher:', error);
            }
        };
        loadBusiness();
    }, [businessId]);

    // Load orders with real-time listener
    useEffect(() => {
        // Use meat_orders collection (canonical for LOKMA/MIRA - matches mobile app)
        const ordersRef = collection(db, 'meat_orders');
        // Filter by butcherId (legacy field name used across the system)
        const q = query(
            ordersRef,
            where('butcherId', '==', businessId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersData = snapshot.docs.map(doc => mapFirestoreOrder(doc));

            // Sort client-side by createdAt desc
            ordersData.sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0));

            setOrders(ordersData);
            setLoading(false);
        }, (error) => {
            console.error('Error loading orders:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    // Filtered orders
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            // AUTO-HIDE: Hide completed orders older than 10 minutes (unless user wants to see them)
            if (!showCompletedOrders && order.status === 'completed') {
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                const completedAt = order._raw?.updatedAt?.toDate?.() || order.createdAt?.toDate?.() || new Date(0);
                if (completedAt < tenMinutesAgo) {
                    return false;
                }
            }

            // Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    order.orderNumber?.toLowerCase().includes(q) ||
                    order.customerName?.toLowerCase().includes(q) ||
                    order.customerPhone?.includes(q);
                if (!matchesSearch) return false;
            }

            // Status filter
            if (statusFilter !== 'all' && order.status !== statusFilter) {
                return false;
            }

            // Date range filter
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                if (order.createdAt < fromDate) return false;
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59);
                if (order.createdAt > toDate) return false;
            }

            // Amount range filter
            if (amountMin && order.total < parseFloat(amountMin)) {
                return false;
            }
            if (amountMax && order.total > parseFloat(amountMax)) {
                return false;
            }

            return true;
        });
    }, [orders, searchQuery, statusFilter, dateFrom, dateTo, amountMin, amountMax, showCompletedOrders]);

    // Stats
    const stats = useMemo(() => {
        // Calculate hidden completed orders (older than 10 min)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const hiddenCompleted = orders.filter(o => {
            if (o.status !== 'completed') return false;
            const completedAt = o._raw?.updatedAt?.toDate?.() || o.createdAt?.toDate?.() || new Date(0);
            return completedAt < tenMinutesAgo;
        }).length;

        return {
            total: orders.length,
            pending: orders.filter(o => o.status === 'pending').length,
            preparing: orders.filter(o => o.status === 'preparing').length,
            ready: orders.filter(o => o.status === 'ready').length,
            completed: orders.filter(o => o.status === 'completed').length,
            hiddenCompleted,
        };
    }, [orders]);

    // Log activity helper
    const logActivity = async (action: string, orderId: string, orderNumber: string, customerName: string, customerPhone: string, details?: Record<string, unknown>) => {
        try {
            await addDoc(collection(db, 'activity_logs'), {
                actorId: businessId,
                actorType: 'vendor',
                actorName: butcher?.companyName || 'Kasap',
                actorPhone: butcher?.phone || '',
                action: action,
                actionCategory: 'order',
                targetType: 'order',
                targetId: orderId,
                targetName: orderNumber,
                vendorId: businessId,
                vendorName: butcher?.companyName || '',
                customerId: '',
                customerName: customerName,
                details: details || {},
                timestamp: Timestamp.now(),
            });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    };

    // Update order status
    const updateOrderStatus = async (orderId: string, newStatus: string, reason?: string) => {
        // Find the order for logging
        const order = orders.find(o => o.id === orderId);

        try {
            const updateData: Record<string, unknown> = {
                status: newStatus,
                updatedAt: new Date(),
            };
            if (reason) {
                updateData.rejectionReason = reason;
                updateData.butcherPhone = butcher?.phone || '';
            }
            await updateDoc(doc(db, 'meat_orders', orderId), updateData);

            // Log the activity
            if (order) {
                const actionMap: Record<string, string> = {
                    'preparing': 'order.preparing',
                    'ready': 'order.ready',
                    'completed': 'order.completed',
                    'rejected': 'order.rejected',
                    'cancelled': 'order.cancelled',
                };
                await logActivity(
                    actionMap[newStatus] || `order.${newStatus}`,
                    orderId,
                    order.orderNumber,
                    order.customerName,
                    order.customerPhone,
                    reason ? { reason } : undefined
                );
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    };

    // Reject order with reason
    const handleRejectOrder = async () => {
        if (!rejectingOrder) return;
        await updateOrderStatus(rejectingOrder.id, 'rejected', rejectReason || t('i_stediginiz_urun_su_an_mevcut_degil'));
        setRejectingOrder(null);
        setRejectReason('');
    };

    const toggleItemChecked = async (orderId: string, itemIdx: number) => {
        const orderChecks = checkedItems[orderId] || {};
        const newChecked = !orderChecks[itemIdx];
        const updated = { ...orderChecks, [itemIdx]: newChecked };
        setCheckedItems(prev => ({ ...prev, [orderId]: updated }));
        try {
            await updateDoc(doc(db, 'meat_orders', orderId), {
                [`checkedItems.${itemIdx}`]: newChecked,
            });
        } catch (e) {
            console.error('Error updating checkeditems', e);
        }
    };

    // Update order items (alternative products)
    const updateOrderItems = async (orderId: string, items: MeatOrderItem[], newTotal: number) => {
        const order = orders.find(o => o.id === orderId);

        try {
            await updateDoc(doc(db, 'meat_orders', orderId), {
                items: items.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    weightKg: item.weightKg,
                    pricePerKg: item.pricePerKg,
                })),
                totalAmount: newTotal,
                updatedAt: new Date(),
                isEdited: true,
            });

            // Log the edit activity
            if (order) {
                await logActivity(
                    'order.edited',
                    orderId,
                    order.orderNumber,
                    order.customerName,
                    order.customerPhone,
                    {
                        oldTotal: order.total,
                        newTotal,
                        itemCount: items.length
                    }
                );
            }

            setEditingOrderItems(null);
        } catch (error) {
            console.error('Error updating order items:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-600 text-white',
            preparing: 'bg-blue-600 text-white',
            ready: 'bg-green-600 text-white',
            completed: 'bg-gray-600 text-white',
            cancelled: 'bg-red-600 text-white',
        };
        const labels: Record<string, string> = {
            pending: t('hazirlanmayi_bekliyor'),
            preparing: t('hazirlaniyor'),
            ready: t('hazir'),
            completed: t('tamamlandi'),
            cancelled: 'İptal',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header - Red Bar like Businesss Page */}
            <header className="bg-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Link
                            href={isVendorUser ? '/admin/businesses' : '/admin/businesses'}
                            className="text-red-200 hover:text-foreground text-sm"
                        >
                            ← {isVendorUser ? 'Dashboard' : t('i_sletmelere_don')}
                        </Link>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <span className="text-2xl">📦</span>
                        </div>
                        <div>
                            <h1 className="font-bold">{butcher?.companyName || 'Kasap'} {t('siparisler')}</h1>
                            <p className="text-xs text-red-200">
                                {butcher?.brand === 'tuna' && <span className="bg-red-600 px-2 py-0.5 rounded text-xs mr-2">TUNA</span>}
                                {t('toplam')} {stats.total} {t('siparis')}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-card rounded-lg p-4">
                        <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                        <div className="text-sm text-muted-foreground">{t('toplam')}</div>
                    </div>
                    <div className="bg-yellow-600/20 rounded-lg p-4 border-l-4 border-yellow-500">
                        <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-400">{stats.pending}</div>
                        <div className="text-sm text-yellow-300">{t('waiting')}</div>
                    </div>
                    <div className="bg-blue-600/20 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="text-2xl font-bold text-blue-800 dark:text-blue-400">{stats.preparing}</div>
                        <div className="text-sm text-blue-300">{t('hazirlaniyor')}</div>
                    </div>
                    <div className="bg-green-600/20 rounded-lg p-4 border-l-4 border-green-500">
                        <div className="text-2xl font-bold text-green-800 dark:text-green-400">{stats.ready}</div>
                        <div className="text-sm text-green-300">{t('hazir')}</div>
                    </div>
                    {/* Completed card with toggle for hidden orders */}
                    <button
                        onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                        className={`rounded-lg p-4 border-l-4 text-left transition-all ${showCompletedOrders
                            ? 'bg-purple-600/30 border-purple-500'
                            : 'bg-gray-700/50 border-gray-500'
                            }`}
                    >
                        <div className="text-2xl font-bold text-foreground">
                            {stats.completed}
                            {stats.hiddenCompleted > 0 && !showCompletedOrders && (
                                <span className="text-xs ml-1 text-yellow-800 dark:text-yellow-400">+{stats.hiddenCompleted} gizli</span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {showCompletedOrders ? t('tumunu_goster_aktif') : '📦 Tamamlandı'}
                        </div>
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-card rounded-lg p-4 mb-4 md:mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
                        {/* Search */}
                        <div className="col-span-2">
                            <label className="block text-xs text-muted-foreground mb-1">{t('search')}</label>
                            <input
                                type="text"
                                placeholder={t('siparis_no_musteri_adi')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 border-none outline-none"
                            />
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('durum')}</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                            >
                                <option value="all">{t('tumu')}</option>
                                <option value="pending">{t('pending')}</option>
                                <option value="preparing">{t('hazirlaniyor')}</option>
                                <option value="ready">{t('hazir')}</option>
                                <option value="completed">{t('tamamlandi')}</option>
                                <option value="cancelled">{t('cancelled')}</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('baslangic')}</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('bitis')}</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        {/* Amount Range */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{t('tutar')}</label>
                            <div className="flex gap-1">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={amountMin}
                                    onChange={(e) => setAmountMin(e.target.value)}
                                    className="w-1/2 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-red-500"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={amountMax}
                                    onChange={(e) => setAmountMax(e.target.value)}
                                    className="w-1/2 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-card rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-gray-750">
                                <tr>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        No
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {t('musteri')}
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                                        {t('tarih')}
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                                        Teslim
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {t('tutar')}
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {t('durum')}
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">

                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                            {orders.length === 0 ? t('henuz_siparis_yok') : t('filtreye_uygun_siparis_bulunamadi')}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order, index) => {
                                        // Status-based row background color
                                        const getRowBgColor = () => {
                                            switch (order.status) {
                                                case 'pending': return 'bg-yellow-900/30 border-l-4 border-yellow-500';
                                                case 'preparing': return 'bg-blue-900/30 border-l-4 border-blue-500';
                                                case 'ready': return 'bg-green-900/30 border-l-4 border-green-500';
                                                case 'completed': return 'bg-gray-700/50 border-l-4 border-gray-500';
                                                case 'cancelled': return 'bg-red-900/30 border-l-4 border-red-500';
                                                default: return index % 2 === 0 ? 'bg-card' : 'bg-gray-750';
                                            }
                                        };

                                        return (
                                            <React.Fragment key={order.id}>
                                                <tr className={`hover:bg-gray-700 cursor-pointer ${getRowBgColor()}`}>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <span className="font-mono font-bold text-red-800 dark:text-red-400">{order.orderNumber}</span>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <div className="text-sm font-medium text-foreground">{order.customerName}</div>
                                                        {/* Phone: Only visible during active orders */}
                                                        <div className="text-sm text-muted-foreground">
                                                            {['pending', 'preparing', 'ready'].includes(order.status)
                                                                ? order.customerPhone
                                                                : '🔒 Gizli'}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-foreground hidden md:table-cell"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        {formatDate(order.createdAt)}
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <div className="text-sm">
                                                            {order.type === 'pickup' ? (
                                                                <span className="text-blue-800 dark:text-blue-400">🏪 Gel Al</span>
                                                            ) : (
                                                                <span className="text-amber-800 dark:text-amber-400">{t('kurye')}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">{formatDate(order.scheduledAt?.toDate())}</div>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <span className="text-sm font-semibold text-green-800 dark:text-green-400">
                                                            {formatPrice(order.total)}
                                                        </span>
                                                        <div className="text-xs mt-1">
                                                            {order.paymentMethod === 'card' && <span className="text-blue-800 dark:text-blue-400">💳 Kart</span>}
                                                            {order.paymentMethod === 'cash' && <span className="text-yellow-800 dark:text-yellow-400">💵 Nakit</span>}
                                                            {order.paymentMethod === 'online' && <span className="text-purple-800 dark:text-purple-400">📱 Online</span>}
                                                            {!order.paymentMethod && <span className="text-gray-500">💵 Nakit</span>}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        {getStatusBadge(order.status)}
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                                        {/* McDonald's KDS Style: One prominent action button per status */}
                                                        <div className="flex items-center gap-2">

                                                            {/* MAIN ACTION - Single large button based on status */}
                                                            {order.status === 'pending' && (
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                                    className="flex-1 bg-green-600 hover:bg-green-500 text-foreground font-bold py-3 px-4 rounded-lg text-sm transition-all active:scale-95"
                                                                >
                                                                    {t('si_pari_si_baslat')}
                                                                </button>
                                                            )}
                                                            {order.status === 'preparing' && (
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'ready')}
                                                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-foreground font-bold py-3 px-4 rounded-lg text-sm transition-all active:scale-95"
                                                                >
                                                                    {t('hazir')}
                                                                </button>
                                                            )}
                                                            {order.status === 'ready' && (
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'completed')}
                                                                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-foreground font-bold py-3 px-4 rounded-lg text-sm transition-all active:scale-95"
                                                                >
                                                                    🎉 TESLİM EDİLDİ
                                                                </button>
                                                            )}
                                                            {order.status === 'completed' && (
                                                                <span className="flex-1 text-center text-muted-foreground py-3 text-sm">{t('tamamlandi')}</span>
                                                            )}
                                                            {order.status === 'cancelled' && (
                                                                <span className="flex-1 text-center text-red-800 dark:text-red-400 py-3 text-sm">❌ İptal</span>
                                                            )}

                                                            {/* Secondary actions - small icons, only for pending */}
                                                            {order.status === 'pending' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setEditingOrderItems(order)}
                                                                        className="w-8 h-8 rounded-full bg-gray-600 hover:bg-yellow-600 flex items-center justify-center text-white"
                                                                        title={t('duzenle')}
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setRejectingOrder(order)}
                                                                        className="w-8 h-8 rounded-full bg-gray-600 hover:bg-red-600 flex items-center justify-center text-white"
                                                                        title={t('reject_title')}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>


                {/* Reject Order Modal */}
                {rejectingOrder && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
                            <div className="p-6">
                                <h2 className="text-lg font-bold text-red-600 mb-4">
                                    {t('siparis_reddet')} {rejectingOrder.orderNumber}
                                </h2>

                                <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>⚠️ Dikkat:</strong> {t('siparisi_reddettiginizde_musteriye_bildi')}
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('rejection_reason')}</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                                        rows={3}
                                        placeholder={t('i_stediginiz_urun_su_an_mevcut_degil')}
                                    />
                                </div>

                                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>📞 Kasap Telefon:</strong> {butcher?.phone || t('belirtilmemis')}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">
                                        {t('bu_numara_musteriye_gosterilecek')}
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setRejectingOrder(null); setRejectReason(''); }}
                                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={handleRejectOrder}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        {t('siparisi_reddet')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Order Items Modal */}
                {editingOrderItems && (
                    <EditOrderModal
                        order={editingOrderItems}
                        onClose={() => setEditingOrderItems(null)}
                        onSave={(items, total) => updateOrderItems(editingOrderItems.id, items, total)}
                        formatPrice={formatPrice}
                    />
                )}

                {/* Order Detail Modal */}
                {selectedOrder && (
                    <OrderDetailsModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        t={t}
                        businesses={{ [butcher?.id || '']: butcher?.companyName || '' }}
                        checkedItems={checkedItems[selectedOrder.id] || {}}
                        dateLocale="de-DE"
                        onUpdateOrderStatus={updateOrderStatus}
                        onToggleItemChecked={toggleItemChecked}
                    />
                )}
            </main>
        </div>
    );
}

// Separate component for editing order items
function EditOrderModal({
    order,
    onClose,
    onSave,
    formatPrice
}: {
    order: Order;
    onClose: () => void;
    onSave: (items: MeatOrderItem[], total: number) => void;
    formatPrice: (n: number) => string;
}) {
    const t = useTranslations('AdminOrders');
    const [items, setItems] = useState<MeatOrderItem[]>(order.items.map(item => ({
        productId: item.productId || `new_${Date.now()}`,
        productName: item.productName || item.name || '',
        weightKg: item.weightKg || item.quantity || 0,
        pricePerKg: item.pricePerKg || item.price || 0,
    })));

    const updateItem = (index: number, field: keyof MeatOrderItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const addItem = () => {
        setItems([...items, {
            productId: `new_${Date.now()}`,
            productName: '',
            weightKg: 0,
            pricePerKg: 0,
        }]);
    };

    const total = items.reduce((sum, item) => sum + (item.weightKg * item.pricePerKg), 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-900">
                            ✏️ Sipariş Düzenle - {order.orderNumber}
                        </h2>
                        <button onClick={onClose} className="text-muted-foreground hover:text-gray-600">✕</button>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-purple-800">
                            <strong>💡 İpucu:</strong> Telefonda alternatif ürün konuştuktan sonra burada güncelleyebilirsiniz.
                        </p>
                    </div>

                    <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('product')}</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('quantity_kg')}</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('price_kg')}</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">{t('total')}</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={item.productName}
                                            onChange={(e) => updateItem(index, 'productName', e.target.value)}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                            placeholder="Ürün adı"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={item.weightKg}
                                            onChange={(e) => updateItem(index, 'weightKg', parseFloat(e.target.value) || 0)}
                                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.pricePerKg}
                                            onChange={(e) => updateItem(index, 'pricePerKg', parseFloat(e.target.value) || 0)}
                                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-sm font-medium">
                                        {formatPrice(item.weightKg * item.pricePerKg)}
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => removeItem(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td colSpan={3} className="px-3 py-2 text-sm font-bold text-right">{t('new_total')}</td>
                                <td className="px-3 py-2 text-sm font-bold text-red-600">{formatPrice(total)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>

                    <button
                        onClick={addItem}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-500 hover:text-purple-500 mb-4"
                    >
                        + Yeni Ürün Ekle
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            İptal
                        </button>
                        <button
                            onClick={() => onSave(items, total)}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            ✓ Değişiklikleri Kaydet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
