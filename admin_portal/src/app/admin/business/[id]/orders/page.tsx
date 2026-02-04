'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

interface OrderItem {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
}

interface BusinessOrder {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    items: OrderItem[];
    totalAmount: number;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    fulfillmentType: 'pickup' | 'delivery';
    paymentMethod?: 'cash' | 'card' | 'online';
    scheduledDateTime: Date;
    createdAt: Date;
    updatedAt?: Date;
    notes?: string;
}

interface BusinessInfo {
    id: string;
    companyName: string;
    brand: string;
    phone?: string;
}

export default function BusinessOrdersPage() {
    const params = useParams();
    const businessId = params.id as string;

    const [orders, setOrders] = useState<BusinessOrder[]>([]);
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
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // Auto-hide completed orders (McDonald's style: hide after 10 min)
    const [showCompletedOrders, setShowCompletedOrders] = useState(false);

    // Reject order modal
    const [rejectingOrder, setRejectingOrder] = useState<BusinessOrder | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Edit order modal
    const [editingOrderItems, setEditingOrderItems] = useState<BusinessOrder | null>(null);

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
            const ordersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                scheduledDateTime: doc.data().scheduledDateTime?.toDate() || new Date(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as BusinessOrder[];

            // Sort client-side by createdAt desc
            ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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
                const completedAt = order.updatedAt || order.createdAt;
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
            if (amountMin && order.totalAmount < parseFloat(amountMin)) {
                return false;
            }
            if (amountMax && order.totalAmount > parseFloat(amountMax)) {
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
            const completedAt = o.updatedAt || o.createdAt;
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
            await updateDoc(doc(db, 'orders', orderId), updateData);

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
        await updateOrderStatus(rejectingOrder.id, 'rejected', rejectReason || 'İstediğiniz ürün şu an mevcut değil');
        setRejectingOrder(null);
        setRejectReason('');
    };

    // Update order items (alternative products)
    const updateOrderItems = async (orderId: string, items: OrderItem[], newTotal: number) => {
        const order = orders.find(o => o.id === orderId);

        try {
            await updateDoc(doc(db, 'orders', orderId), {
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
                        oldTotal: order.totalAmount,
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
            pending: 'Hazırlanmayı Bekliyor',
            preparing: 'Hazırlanıyor',
            ready: 'Hazır',
            completed: 'Tamamlandı',
            cancelled: 'İptal',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('tr-TR', {
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
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header - Red Bar like Businesss Page */}
            <header className="bg-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Link 
                            href={isVendorUser ? '/vendor-panel' : '/admin/businesses'} 
                            className="text-red-200 hover:text-white text-sm"
                        >
                            ← {isVendorUser ? 'Dashboard' : 'İşletmelere Dön'}
                        </Link>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                            <span className="text-2xl">📦</span>
                        </div>
                        <div>
                            <h1 className="font-bold">{butcher?.companyName || 'Kasap'} - Siparişler</h1>
                            <p className="text-xs text-red-200">
                                {butcher?.brand === 'tuna' && <span className="bg-red-600 px-2 py-0.5 rounded text-xs mr-2">TUNA</span>}
                                Toplam {stats.total} sipariş
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-2xl font-bold text-white">{stats.total}</div>
                        <div className="text-sm text-gray-400">Toplam</div>
                    </div>
                    <div className="bg-yellow-600/20 rounded-lg p-4 border-l-4 border-yellow-500">
                        <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                        <div className="text-sm text-yellow-300">Bekliyor</div>
                    </div>
                    <div className="bg-blue-600/20 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="text-2xl font-bold text-blue-400">{stats.preparing}</div>
                        <div className="text-sm text-blue-300">Hazırlanıyor</div>
                    </div>
                    <div className="bg-green-600/20 rounded-lg p-4 border-l-4 border-green-500">
                        <div className="text-2xl font-bold text-green-400">{stats.ready}</div>
                        <div className="text-sm text-green-300">Hazır</div>
                    </div>
                    {/* Completed card with toggle for hidden orders */}
                    <button
                        onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                        className={`rounded-lg p-4 border-l-4 text-left transition-all ${showCompletedOrders
                            ? 'bg-purple-600/30 border-purple-500'
                            : 'bg-gray-700/50 border-gray-500'
                            }`}
                    >
                        <div className="text-2xl font-bold text-gray-300">
                            {stats.completed}
                            {stats.hiddenCompleted > 0 && !showCompletedOrders && (
                                <span className="text-xs ml-1 text-yellow-400">+{stats.hiddenCompleted} gizli</span>
                            )}
                        </div>
                        <div className="text-sm text-gray-400">
                            {showCompletedOrders ? '📑 Tümünü Göster (Aktif)' : '📦 Tamamlandı'}
                        </div>
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-lg p-4 mb-4 md:mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
                        {/* Search */}
                        <div className="col-span-2">
                            <label className="block text-xs text-gray-400 mb-1">Ara</label>
                            <input
                                type="text"
                                placeholder="Sipariş No, Müşteri Adı..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 border-none outline-none"
                            />
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Durum</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                            >
                                <option value="all">Tümü</option>
                                <option value="pending">Bekliyor</option>
                                <option value="preparing">Hazırlanıyor</option>
                                <option value="ready">Hazır</option>
                                <option value="completed">Tamamlandı</option>
                                <option value="cancelled">İptal</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Başlangıç</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Bitiş</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        {/* Amount Range */}
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Tutar (€)</label>
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
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-750">
                                <tr>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        No
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Müşteri
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">
                                        Tarih
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                                        Teslim
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Tutar
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Durum
                                    </th>
                                    <th className="px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">

                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                            {orders.length === 0 ? 'Henüz sipariş yok' : 'Filtreye uygun sipariş bulunamadı'}
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
                                                default: return index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750';
                                            }
                                        };

                                        return (
                                            <React.Fragment key={order.id}>
                                                <tr className={`hover:bg-gray-700 cursor-pointer ${getRowBgColor()}`}>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap"
                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                    >
                                                        <span className="font-mono font-bold text-red-400">{order.orderNumber}</span>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4"
                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                    >
                                                        <div className="text-sm font-medium text-white">{order.customerName}</div>
                                                        {/* Phone: Only visible during active orders */}
                                                        <div className="text-sm text-gray-400">
                                                            {['pending', 'preparing', 'ready'].includes(order.status)
                                                                ? order.customerPhone
                                                                : '🔒 Gizli'}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell"
                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                    >
                                                        {formatDate(order.createdAt)}
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell"
                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                    >
                                                        <div className="text-sm">
                                                            {order.fulfillmentType === 'pickup' ? (
                                                                <span className="text-blue-400">🏪 Gel Al</span>
                                                            ) : (
                                                                <span className="text-orange-400">🚚 Kurye</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400">{formatDate(order.scheduledDateTime)}</div>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap"
                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                    >
                                                        <span className="text-sm font-semibold text-green-400">
                                                            {formatPrice(order.totalAmount)}
                                                        </span>
                                                        <div className="text-xs mt-1">
                                                            {order.paymentMethod === 'card' && <span className="text-blue-400">💳 Kart</span>}
                                                            {order.paymentMethod === 'cash' && <span className="text-yellow-400">💵 Nakit</span>}
                                                            {order.paymentMethod === 'online' && <span className="text-purple-400">📱 Online</span>}
                                                            {!order.paymentMethod && <span className="text-gray-500">💵 Nakit</span>}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-4 md:px-6 py-4 whitespace-nowrap"
                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
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
                                                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg text-sm transition-all active:scale-95"
                                                                >
                                                                    ▶ SİPARİŞİ BAŞLAT
                                                                </button>
                                                            )}
                                                            {order.status === 'preparing' && (
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'ready')}
                                                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg text-sm transition-all active:scale-95"
                                                                >
                                                                    ✓ HAZIR
                                                                </button>
                                                            )}
                                                            {order.status === 'ready' && (
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'completed')}
                                                                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-lg text-sm transition-all active:scale-95"
                                                                >
                                                                    🎉 TESLİM EDİLDİ
                                                                </button>
                                                            )}
                                                            {order.status === 'completed' && (
                                                                <span className="flex-1 text-center text-gray-400 py-3 text-sm">✓ Tamamlandı</span>
                                                            )}
                                                            {order.status === 'cancelled' && (
                                                                <span className="flex-1 text-center text-red-400 py-3 text-sm">❌ İptal</span>
                                                            )}

                                                            {/* Secondary actions - small icons, only for pending */}
                                                            {order.status === 'pending' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setEditingOrderItems(order)}
                                                                        className="w-8 h-8 rounded-full bg-gray-600 hover:bg-yellow-600 flex items-center justify-center text-white"
                                                                        title="Düzenle"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setRejectingOrder(order)}
                                                                        className="w-8 h-8 rounded-full bg-gray-600 hover:bg-red-600 flex items-center justify-center text-white"
                                                                        title="Reddet"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Expanded Detail Row */}
                                                {expandedOrderId === order.id && (
                                                    <tr className="bg-gray-700/50">
                                                        <td colSpan={7} className="px-4 py-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {/* Customer Info */}
                                                                <div className="bg-gray-800 rounded-lg p-4">
                                                                    <h4 className="text-sm font-medium text-gray-400 mb-2">👤 Müşteri</h4>
                                                                    <p className="text-white font-medium">{order.customerName}</p>
                                                                    {/* Phone: Only visible and clickable during active orders */}
                                                                    {['pending', 'preparing', 'ready'].includes(order.status) ? (
                                                                        <a href={`tel:${order.customerPhone}`} className="text-blue-400 hover:underline text-sm">{order.customerPhone}</a>
                                                                    ) : (
                                                                        <span className="text-gray-500 text-sm">🔒 Teslimattan sonra gizli</span>
                                                                    )}
                                                                </div>
                                                                {/* Delivery Info */}
                                                                <div className="bg-gray-800 rounded-lg p-4">
                                                                    <h4 className="text-sm font-medium text-gray-400 mb-2">📦 Teslim</h4>
                                                                    <p className="text-white">{order.fulfillmentType === 'pickup' ? '🏪 Gel Al' : '🚚 Kurye'}</p>
                                                                    <p className="text-gray-400 text-sm">{formatDate(order.scheduledDateTime)}</p>
                                                                </div>
                                                                {/* Order Total */}
                                                                <div className="bg-gray-800 rounded-lg p-4">
                                                                    <h4 className="text-sm font-medium text-gray-400 mb-2">💰 Toplam</h4>
                                                                    <p className="text-2xl font-bold text-green-400">{formatPrice(order.totalAmount)}</p>
                                                                </div>
                                                            </div>
                                                            {/* Items */}
                                                            <div className="mt-4 bg-gray-800 rounded-lg p-4">
                                                                <h4 className="text-sm font-medium text-gray-400 mb-3">🥩 Ürünler</h4>
                                                                <div className="space-y-2">
                                                                    {order.items.map((item: OrderItem, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-center text-sm">
                                                                            <span className="text-white">{item.productName}</span>
                                                                            <span className="text-gray-400">{item.weightKg} kg × {item.pricePerKg}€</span>
                                                                            <span className="text-green-400 font-medium">{(item.weightKg * item.pricePerKg).toFixed(2)}€</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {order.notes && (
                                                                <div className="mt-4 bg-yellow-900/30 rounded-lg p-4 border border-yellow-600/50">
                                                                    <h4 className="text-sm font-medium text-yellow-400 mb-1">📝 Not</h4>
                                                                    <p className="text-yellow-200">{order.notes}</p>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
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
                                    ❌ Sipariş Reddet - {rejectingOrder.orderNumber}
                                </h2>

                                <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>⚠️ Dikkat:</strong> Siparişi reddettiğinizde müşteriye bildirim gidecek.
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Red Nedeni</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                                        rows={3}
                                        placeholder="İstediğiniz ürün şu an mevcut değil..."
                                    />
                                </div>

                                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>📞 Kasap Telefon:</strong> {butcher?.phone || 'Belirtilmemiş'}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">
                                        Bu numara müşteriye gösterilecek
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
                                        ❌ Siparişi Reddet
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
    order: BusinessOrder;
    onClose: () => void;
    onSave: (items: OrderItem[], total: number) => void;
    formatPrice: (n: number) => string;
}) {
    const [items, setItems] = useState<OrderItem[]>(order.items || []);

    const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
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
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-purple-800">
                            <strong>💡 İpucu:</strong> Telefonda alternatif ürün konuştuktan sonra burada güncelleyebilirsiniz.
                        </p>
                    </div>

                    <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ürün</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Miktar (kg)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fiyat (€/kg)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Toplam</th>
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
                                <td colSpan={3} className="px-3 py-2 text-sm font-bold text-right">Yeni Toplam:</td>
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
