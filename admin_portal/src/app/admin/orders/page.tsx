'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, deleteField, query, orderBy, where, onSnapshot, Timestamp, increment } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

// Canonical Order Status Set (7 statuses)
// Synchronized with Mobile App OrderStatus enum
const orderStatuses = {
    pending: { label: 'Beklemede', color: 'yellow', icon: '⏳' },
    accepted: { label: 'Onaylandı', color: 'blue', icon: '✅' },
    preparing: { label: 'Hazırlanıyor', color: 'amber', icon: '👨‍🍳' },
    ready: { label: 'Hazır', color: 'green', icon: '📦' },
    served: { label: 'Servis Edildi', color: 'teal', icon: '🍽️' },
    onTheWay: { label: 'Yolda', color: 'indigo', icon: '🛵' },
    delivered: { label: 'Teslim Edildi', color: 'emerald', icon: '🎉' },
    completed: { label: 'Tamamlandı', color: 'emerald', icon: '✔️' },
    cancelled: { label: 'İptal', color: 'red', icon: '❌' },
} as const;

type OrderStatus = keyof typeof orderStatuses;

const orderTypes = {
    pickup: { label: 'Gel Al', icon: '🏃', color: 'green' },
    delivery: { label: 'Kurye', icon: '🛵', color: 'blue' },
    dine_in: { label: 'Yerinde', icon: '🍽️', color: 'amber' },
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
    tableSessionId?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    stripePaymentIntentId?: string;
    // Served by waiter
    servedByName?: string;
    servedAt?: Timestamp;
}

export default function OrdersPage() {
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

    // Unavailable items modal state
    const [showUnavailableModal, setShowUnavailableModal] = useState(false);
    const [unavailableOrderId, setUnavailableOrderId] = useState<string | null>(null);
    const [unavailableItems, setUnavailableItems] = useState<{ idx: number; name: string; quantity: number; price: number }[]>([]);

    // KDS Checklist state
    const [checkedItems, setCheckedItems] = useState<Record<string, Record<number, boolean>>>({});

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
            console.error('Error updating checkedItems:', e);
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
                    return { label: '✅ Siparişi Onayla', action: 'accepted' as OrderStatus, style: 'bg-blue-600 hover:bg-blue-700', hasUnavailable: false };
                } else {
                    return { label: '⚠️ Eksik ürünlerle onayla', action: 'accepted' as OrderStatus, style: 'bg-yellow-600 hover:bg-yellow-700', hasUnavailable: true };
                }
            }
            return null; // No action yet — need to check some items first
        }

        if (status === 'accepted') {
            return { label: '👨‍🍳 Hazırlamaya Başla', action: 'preparing' as OrderStatus, style: 'bg-amber-600 hover:bg-amber-700', hasUnavailable: false };
        }

        if (status === 'preparing') {
            return { label: '📦 Sipariş Hazır', action: 'ready' as OrderStatus, style: 'bg-green-600 hover:bg-green-700', hasUnavailable: false };
        }

        // For dine-in ready orders, mark as delivered (= completed)
        if (status === 'ready' && order.type === 'dine_in') {
            return { label: '🍽️ Servis Edildi', action: 'delivered' as OrderStatus, style: 'bg-teal-600 hover:bg-teal-700', hasUnavailable: false };
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
                    scheduledAt: d.deliveryDate || d.scheduledDateTime,
                    address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
                    notes: d.notes || d.orderNote || d.customerNote || '',
                    // Dine-in fields
                    tableNumber: d.tableNumber,
                    waiterName: d.waiterName,
                    tableSessionId: d.tableSessionId,
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

    // Group orders by status for kanban view (using canonical statuses)
    const pendingOrders = filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status));
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
                    // Find the order to get customer info
                    const order = orders.find(o => o.id === orderId);
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
                    console.error('Error sending cancellation notification:', notifyError);
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
                                showToast(`€${refundAmount.toFixed(2)} kısmi iade işlendi`, 'success');
                            }
                        } catch (refundError) {
                            console.error('Error processing partial refund:', refundError);
                            showToast('Kısmi iade işlenemedi — manuel kontrol gerekli', 'error');
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

            showToast('Sipariş durumu güncellendi', 'success');
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error updating order:', error);
            showToast('Durum güncellenirken hata oluştu', 'error');
        }
    };

    // Handle cancellation with reason
    const handleCancelConfirm = async () => {
        if (!cancelOrderId || !cancelReason.trim()) {
            showToast('Lütfen iptal sebebi girin', 'error');
            return;
        }
        await updateOrderStatus(cancelOrderId, 'cancelled', cancelReason.trim());
        setShowCancelModal(false);
        setCancelOrderId(null);
        setCancelReason('');
    };

    // Delete order
    const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);
    const handleDeleteOrder = (orderId: string) => {
        setConfirmDeleteOrderId(orderId);
    };
    const handleDeleteOrderConfirm = async () => {
        if (!confirmDeleteOrderId) return;
        try {
            await deleteDoc(doc(db, 'meat_orders', confirmDeleteOrderId));
            showToast('Sipariş silindi', 'success');
            setSelectedOrder(null);
            setConfirmDeleteOrderId(null);
        } catch (error) {
            console.error('Error deleting order:', error);
            showToast('Sipariş silinirken hata oluştu', 'error');
        }
    };

    // Format date
    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return `€${amount.toFixed(2)}`;
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
                            📦 Sipariş Merkezi
                        </h1>
                        {/* Filters inline */}
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                            >
                                <option value="today">📅 Bugün</option>
                                <option value="week">📅 Bu Hafta</option>
                                <option value="month">📅 Bu Ay</option>
                                <option value="all">📅 Tümü</option>
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                            >
                                <option value="all">Tüm Durumlar</option>
                                {Object.entries(orderStatuses).map(([key, value]) => (
                                    <option key={key} value={key}>{value.icon} {value.label}</option>
                                ))}
                            </select>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
                            >
                                <option value="all">Tüm Tipler</option>
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
                                            placeholder="🔍 İşletme Ara..."
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
                                                ✓ Tüm İşletmeler
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
                                                    Sonuç bulunamadı
                                                </div>
                                            )}
                                            {filteredBusinesses.length > 15 && (
                                                <div className="px-4 py-2 text-gray-500 text-sm">
                                                    +{filteredBusinesses.length - 15} daha... (Aramayı daraltın)
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex gap-2 shrink-0">
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-blue-400">{stats.total}</p>
                            <p className="text-[10px] text-blue-300">Toplam</p>
                        </div>
                        <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-yellow-400">{stats.pending}</p>
                            <p className="text-[10px] text-yellow-300">Bekleyen</p>
                        </div>
                        <div className="bg-amber-600/20 border border-amber-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-amber-400">{stats.preparing}</p>
                            <p className="text-[10px] text-amber-300">Hazırlanan</p>
                        </div>
                        <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-xl font-bold text-green-400">{formatCurrency(stats.revenue)}</p>
                            <p className="text-[10px] text-green-300">Ciro</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Order Status Workflow - Matching Super Admin Dashboard */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-white font-bold">
                            📊 Sipariş Durumları (Anlık)
                        </h3>
                        <span className="text-gray-400 text-sm">
                            Şu anki siparişler
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
                                🔔 Bekleyen
                            </p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Hazırlanıyor */}
                        <div className="flex-1 min-w-[100px] bg-amber-600/20 border border-amber-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-amber-400 text-3xl font-bold">
                                {stats.preparing}
                            </p>
                            <p className="text-gray-400 text-sm">👨‍🍳 Hazırlanıyor</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Hazır */}
                        <div className="flex-1 min-w-[100px] bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-green-400 text-3xl font-bold">
                                {stats.ready}
                            </p>
                            <p className="text-gray-400 text-sm">📦 Hazır</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Yolda */}
                        <div className="flex-1 min-w-[100px] bg-indigo-600/20 border border-indigo-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-indigo-400 text-3xl font-bold">
                                {stats.inTransit}
                            </p>
                            <p className="text-gray-400 text-sm">🛵 Yolda</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Tamamlanan */}
                        <div className="flex-1 min-w-[100px] bg-emerald-600/20 border border-emerald-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-emerald-400 text-3xl font-bold">
                                {stats.completed}
                            </p>
                            <p className="text-gray-400 text-sm">✓ Tamamlanan</p>
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
                        <p className="text-gray-400 mt-4">Siparişler yükleniyor...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <p className="text-4xl mb-4">📭</p>
                        <p className="text-gray-400">Sipariş bulunamadı</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Pending Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-yellow-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                                Bekleyen ({pendingOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {pendingOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {pendingOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{pendingOrders.length - 10} daha</p>
                                )}
                            </div>
                        </div>

                        {/* Preparing Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-amber-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-amber-400 rounded-full"></span>
                                Hazırlanıyor ({preparingOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {preparingOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {preparingOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{preparingOrders.length - 10} daha</p>
                                )}
                            </div>
                        </div>

                        {/* Ready Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-green-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                                Hazır ({readyOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {readyOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {readyOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{readyOrders.length - 10} daha</p>
                                )}
                            </div>
                        </div>

                        {/* Served Column (Dine-in only) */}
                        {/* Servis Edildi column removed — dine-in orders now go directly to Tamamlanan */}

                        {/* In Transit Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-indigo-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-indigo-400 rounded-full"></span>
                                Yolda ({inTransitOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {inTransitOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {inTransitOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{inTransitOrders.length - 10} daha</p>
                                )}
                            </div>
                        </div>

                        {/* Completed Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-emerald-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-emerald-400 rounded-full"></span>
                                Tamamlanan ({completedOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {completedOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} checkedItems={checkedItems} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {completedOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{completedOrders.length - 10} daha</p>
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
                                📦 Sipariş #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 6).toUpperCase()}
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
                                <span className="text-gray-400">Durum</span>
                                <span className={`px-3 py-1 rounded-full text-sm bg-${orderStatuses[selectedOrder.status].color}-600/20 text-${orderStatuses[selectedOrder.status].color}-400`}>
                                    {orderStatuses[selectedOrder.status].icon} {orderStatuses[selectedOrder.status].label}
                                </span>
                            </div>

                            {/* Business */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">İşletme</span>
                                <Link href={`/admin/butchers/${selectedOrder.businessId}`} className="text-blue-400 hover:underline">
                                    {businesses[selectedOrder.businessId] || selectedOrder.businessId}
                                </Link>
                            </div>

                            {/* Type */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Tip</span>
                                <span className="text-white">
                                    {orderTypes[selectedOrder.type]?.icon} {orderTypes[selectedOrder.type]?.label}
                                </span>
                            </div>

                            {/* Dine-in Info */}
                            {selectedOrder.type === 'dine_in' && (
                                <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                                    <h4 className="text-amber-400 font-medium text-sm flex items-center gap-2">🍽️ Yerinde Sipariş Detayı</h4>
                                    {selectedOrder.tableNumber && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Masa</span>
                                            <span className="text-white font-bold text-lg">#{selectedOrder.tableNumber}</span>
                                        </div>
                                    )}
                                    {selectedOrder.waiterName && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Garson</span>
                                            <span className="text-white">{selectedOrder.waiterName}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Ödeme</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedOrder.paymentStatus === 'paid'
                                            ? 'bg-green-600/20 text-green-400'
                                            : 'bg-red-600/20 text-red-400'
                                            }`}>
                                            {selectedOrder.paymentStatus === 'paid'
                                                ? `✅ Ödendi${selectedOrder.paymentMethod === 'card' ? ' (Kart)' : selectedOrder.paymentMethod === 'cash' ? ' (Nakit)' : ''}`
                                                : '⏳ Ödenmedi'}
                                        </span>
                                    </div>
                                    {selectedOrder.servedByName && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Servis Eden</span>
                                            <span className="text-teal-400 font-medium">🍽️ {selectedOrder.servedByName}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customer */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Müşteri</span>
                                <div className="text-right">
                                    <p className="text-white">{selectedOrder.customerName || 'Misafir'}</p>
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
                                    <span className="text-gray-400">Adres</span>
                                    <div className="text-right text-white text-sm">
                                        <p>{selectedOrder.address.street}</p>
                                        <p>{selectedOrder.address.postalCode} {selectedOrder.address.city}</p>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div className="border-t border-gray-700 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-white font-medium">Ürünler</h4>
                                    {selectedOrder.items?.length > 0 && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${allItemsChecked(selectedOrder.id, selectedOrder.items.length)
                                            ? 'bg-green-600/30 text-green-400'
                                            : 'bg-gray-700 text-gray-400'
                                            }`}>
                                            ✓ {getCheckedCount(selectedOrder.id, selectedOrder.items.length)}/{selectedOrder.items.length}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {selectedOrder.items?.map((item: any, idx: number) => {
                                        const isChecked = checkedItems[selectedOrder.id]?.[idx] || false;
                                        const posNum = item.positionNumber || (idx + 1);
                                        return (
                                            <div key={idx} className={`rounded-lg px-2 py-1.5 transition-all ${isChecked ? 'bg-green-600/10' : 'hover:bg-gray-700/50'}`}>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <button
                                                        onClick={() => toggleItemChecked(selectedOrder.id, idx)}
                                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked
                                                            ? 'bg-green-500 border-green-500 text-white'
                                                            : 'border-gray-500 hover:border-green-400'
                                                            }`}
                                                    >
                                                        {isChecked && <span className="text-xs">✓</span>}
                                                    </button>
                                                    <span className="bg-amber-500 text-white text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0">#{posNum}</span>
                                                    <span className={`flex-1 ${isChecked ? 'text-green-300 line-through opacity-70' : 'text-gray-300'}`}>
                                                        {item.quantity}x {item.productName || item.name}
                                                    </span>
                                                    <span className={`${isChecked ? 'text-green-400 opacity-70' : 'text-white'}`}>
                                                        {formatCurrency(item.totalPrice ?? ((item.unitPrice || item.price || 0) * (item.quantity || 1)))}
                                                    </span>
                                                </div>
                                                {/* Show selected options */}
                                                {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                    <div className="pl-14 space-y-0.5 mt-0.5">
                                                        {item.selectedOptions.map((opt: any, optIdx: number) => (
                                                            <div key={optIdx} className="flex justify-between text-xs">
                                                                <span className={`${isChecked ? 'text-green-300/50 line-through' : 'text-purple-300'}`}>↳ {opt.optionName || opt.name}</span>
                                                                {(opt.priceModifier || opt.price) ? (
                                                                    <span className={`${isChecked ? 'text-green-400/50' : 'text-purple-400'}`}>+{formatCurrency(opt.priceModifier || opt.price)}</span>
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
                                    })}
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
                                    <span className="text-gray-400">Ara Toplam</span>
                                    <span className="text-white">{formatCurrency(selectedOrder.subtotal || 0)}</span>
                                </div>
                                {selectedOrder.deliveryFee && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Teslimat</span>
                                        <span className="text-white">{formatCurrency(selectedOrder.deliveryFee)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold">
                                    <span className="text-white">Toplam</span>
                                    <span className="text-green-400">{formatCurrency(selectedOrder.total || 0)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedOrder.notes && (
                                <div className="border-t border-gray-700 pt-4">
                                    <h4 className="text-yellow-400 font-medium text-sm mb-1 flex items-center gap-1">📝 Sipariş Notu</h4>
                                    <p className="text-white bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3">{selectedOrder.notes}</p>
                                </div>
                            )}

                            {/* Status Actions */}
                            <div className="border-t border-gray-700 pt-4">
                                <h4 className="text-white font-medium mb-3">Durumu Güncelle</h4>
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

                            {/* Delete Action */}
                            <div className="border-t border-gray-700 pt-4">
                                <button
                                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                                    className="w-full px-4 py-3 bg-red-600/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-600/30 transition flex items-center justify-center gap-2"
                                >
                                    🗑️ Siparişi Sil
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
                                ❌ Sipariş İptal Sebebi
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
                                Lütfen siparişin neden iptal edildiğini belirtin. Bu bilgi müşteriye iletilecektir.
                            </p>

                            {/* Quick Reason Buttons */}
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    'Ürün stokta kalmadı',
                                    'İşletme şu an kapalı',
                                    'Teslimat yapılamıyor',
                                    'Sipariş tekrarı',
                                    'Müşteri talebiyle',
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
                                    veya özel sebep yazın:
                                </label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="İptal sebebini girin..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            {/* Warning */}
                            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-3">
                                <p className="text-yellow-400 text-sm">
                                    ⚠️ İptal bildirimi müşteriye gönderilecek ve ödeme yapıldıysa iade bilgisi eklenecektir.
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
                                    Vazgeç
                                </button>
                                <button
                                    onClick={handleCancelConfirm}
                                    disabled={!cancelReason.trim()}
                                    className={`flex-1 px-4 py-3 rounded-lg transition flex items-center justify-center gap-2 ${cancelReason.trim()
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    ❌ İptal Et
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
                                ⚠️ Eksik Ürünler
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
                            <p className="text-gray-400 text-sm">
                                Aşağıdaki ürünler işaretlenmedi ve <strong className="text-yellow-400">mevcut değil</strong> olarak kaydedilecek. Müşteriye bildirim gönderilecektir.
                            </p>

                            {/* Unavailable items list */}
                            <div className="space-y-2">
                                {unavailableItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-red-600/10 border border-red-500/30 rounded-lg px-3 py-2">
                                        <span className="text-red-400 font-bold">❌</span>
                                        <span className="text-white flex-1">{item.quantity}x {item.name}</span>
                                        <span className="text-gray-400 text-sm">€{((item.price || 0) * item.quantity).toFixed(2)}</span>
                                        <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full">Mevcut Değil</span>
                                    </div>
                                ))}
                            </div>

                            {/* Refund info for card payments */}
                            {(() => {
                                const order = unavailableOrderId ? orders.find(o => o.id === unavailableOrderId) : null;
                                const refundTotal = unavailableItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);
                                const isCardPaid = order?.paymentMethod === 'card' && order?.paymentStatus === 'paid';
                                return (
                                    <>
                                        {isCardPaid && refundTotal > 0 && (
                                            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
                                                <p className="text-blue-400 text-sm">
                                                    💳 Müşteri kartla ödeme yapmış. <strong className="text-blue-300">€{refundTotal.toFixed(2)}</strong> kısmi iade aynı yoldan yapılacak.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Warning */}
                            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-3">
                                <p className="text-yellow-400 text-sm">
                                    ⚠️ Müşteriye eksik ürün bildirimi gönderilecek. Bu durum işletme performans puanına yansıyacaktır.
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
                                    Vazgeç
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
                                    ⚠️ Eksiklerle Onayla
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
    onClick
}: {
    order: Order;
    businesses: Record<string, string>;
    checkedItems: Record<string, Record<number, boolean>>;
    onClick: () => void;
}) {
    const statusInfo = orderStatuses[order.status];
    const typeInfo = orderTypes[order.type];
    const itemCount = order.items?.length || 0;
    const checked = checkedItems[order.id] || {};
    const checkedCount = Object.values(checked).filter(Boolean).length;

    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-gray-700 hover:bg-gray-600 rounded-xl p-3 transition"
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">
                    #{order.orderNumber || order.id.slice(0, 6).toUpperCase()}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs bg-${typeInfo?.color || 'gray'}-600/30 text-${typeInfo?.color || 'gray'}-400`}>
                    {typeInfo?.icon} {typeInfo?.label}
                </span>
            </div>
            <p className="text-gray-400 text-xs mb-1">
                {businesses[order.businessId] || 'İşletme'}
            </p>
            {/* Dine-in table badge + source */}
            {order.type === 'dine_in' && (
                <div className="mb-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-xs font-medium">
                            🍽️ Masa {order.tableNumber ? `#${order.tableNumber}` : ''}
                        </span>
                        {order.paymentStatus === 'paid' && (
                            <span className="px-1.5 py-0.5 rounded bg-green-600/30 text-green-400 text-xs">✓</span>
                        )}
                    </div>
                    <p className="text-gray-400 text-xs pl-0.5">
                        {order.waiterName ? `👤 ${order.waiterName}` : '📱 Müşteri-App'}
                    </p>
                    {order.servedByName && (order.status === 'served' || order.status === 'delivered' || order.status === 'completed') && (
                        <p className="text-teal-400 text-xs pl-0.5">
                            🍽️ {order.servedByName} tarafından servis edildi
                        </p>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className="text-green-400 font-bold">€{order.total?.toFixed(2)}</span>
                <div className="flex items-center gap-2">
                    {itemCount > 0 && (order.status === 'preparing' || order.status === 'accepted') && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${checkedCount >= itemCount ? 'bg-green-600/30 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
                            ✓{checkedCount}/{itemCount}
                        </span>
                    )}
                    <span className="text-gray-500 text-xs">
                        {order.createdAt?.toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        </button>
    );
}
