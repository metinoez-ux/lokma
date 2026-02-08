'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, deleteField, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

// Canonical Order Status Set (7 statuses)
// Synchronized with Mobile App OrderStatus enum
const orderStatuses = {
    pending: { label: 'Beklemede', color: 'yellow', icon: '⏳' },
    accepted: { label: 'Onaylandı', color: 'blue', icon: '✅' },
    preparing: { label: 'Hazırlanıyor', color: 'orange', icon: '👨‍🍳' },
    ready: { label: 'Hazır', color: 'green', icon: '📦' },
    onTheWay: { label: 'Yolda', color: 'indigo', icon: '🛵' },
    delivered: { label: 'Teslim Edildi', color: 'emerald', icon: '🎉' },
    cancelled: { label: 'İptal', color: 'red', icon: '❌' },
} as const;

type OrderStatus = keyof typeof orderStatuses;

const orderTypes = {
    pickup: { label: 'Gel Al', icon: '🏃', color: 'green' },
    delivery: { label: 'Kurye', icon: '🚚', color: 'blue' },
    dine_in: { label: 'Yerinde', icon: '🍽️', color: 'orange' },
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
                    type: d.orderType || d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup',
                    createdAt: d.createdAt,
                    scheduledAt: d.deliveryDate || d.scheduledDateTime,
                    address: d.deliveryAddress ? { street: d.deliveryAddress } : d.address,
                    notes: d.notes || d.orderNote || d.customerNote || '',
                };
            }) as Order[];
            setOrders(data);
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
    const inTransitOrders = filteredOrders.filter(o => o.status === 'onTheWay');
    const completedOrders = filteredOrders.filter(o => o.status === 'delivered');

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
    const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, cancellationReason?: string) => {
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

            // Add cancellation reason if provided
            if (newStatus === 'cancelled' && cancellationReason) {
                updateData.cancellationReason = cancellationReason;
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

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            📦 Sipariş Merkezi
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Tüm platformdaki siparişleri gerçek zamanlı takip edin
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex gap-3">
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
                            <p className="text-xs text-blue-300">Toplam</p>
                        </div>
                        <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                            <p className="text-xs text-yellow-300">Bekleyen</p>
                        </div>
                        <div className="bg-orange-600/20 border border-orange-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-orange-400">{stats.preparing}</p>
                            <p className="text-xs text-orange-300">Hazırlanan</p>
                        </div>
                        <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-4 py-2 text-center">
                            <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.revenue)}</p>
                            <p className="text-xs text-green-300">Ciro</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex flex-wrap gap-4">
                        {/* Date Filter */}
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                        >
                            <option value="today">📅 Bugün</option>
                            <option value="week">📅 Bu Hafta</option>
                            <option value="month">📅 Bu Ay</option>
                            <option value="all">📅 Tümü</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                        >
                            <option value="all">Tüm Durumlar</option>
                            {Object.entries(orderStatuses).map(([key, value]) => (
                                <option key={key} value={key}>{value.icon} {value.label}</option>
                            ))}
                        </select>

                        {/* Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
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
                                        className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 w-64"
                                    />
                                    {businessFilter !== 'all' && (
                                        <button
                                            onClick={() => {
                                                setBusinessFilter('all');
                                                setBusinessSearch('');
                                            }}
                                            className="ml-2 text-gray-400 hover:text-white"
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
                        <div className="flex-1 min-w-[100px] bg-orange-600/20 border border-orange-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-orange-400 text-3xl font-bold">
                                {stats.preparing}
                            </p>
                            <p className="text-gray-400 text-sm">👨‍🍳 Hazırlanıyor</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Hazır / Yolda */}
                        <div className="flex-1 min-w-[100px] bg-purple-600/20 border border-purple-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-purple-400 text-3xl font-bold">
                                {stats.ready + stats.inTransit}
                            </p>
                            <p className="text-gray-400 text-sm">🚚 Hazır/Yolda</p>
                        </div>

                        <div className="text-gray-500 text-xl">→</div>

                        {/* Tamamlanan */}
                        <div className="flex-1 min-w-[100px] bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                            <p className="text-green-400 text-3xl font-bold">
                                {stats.completed}
                            </p>
                            <p className="text-gray-400 text-sm">✓ Tamamlanan</p>
                        </div>
                    </div>

                    {/* Timeline line */}
                    <div className="relative mt-2 h-1 bg-gradient-to-r from-yellow-500 via-orange-500 via-purple-500 to-green-500 rounded-full opacity-50"></div>
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
                                    <OrderCard key={order.id} order={order} businesses={businesses} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {pendingOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{pendingOrders.length - 10} daha</p>
                                )}
                            </div>
                        </div>

                        {/* Preparing Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-orange-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-orange-400 rounded-full"></span>
                                Hazırlanıyor ({preparingOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {preparingOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} onClick={() => setSelectedOrder(order)} />
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
                                    <OrderCard key={order.id} order={order} businesses={businesses} onClick={() => setSelectedOrder(order)} />
                                ))}
                                {readyOrders.length > 10 && (
                                    <p className="text-gray-500 text-center text-sm">+{readyOrders.length - 10} daha</p>
                                )}
                            </div>
                        </div>

                        {/* In Transit Column */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="text-indigo-400 font-medium mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 bg-indigo-400 rounded-full"></span>
                                Yolda ({inTransitOrders.length})
                            </h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {inTransitOrders.slice(0, 10).map(order => (
                                    <OrderCard key={order.id} order={order} businesses={businesses} onClick={() => setSelectedOrder(order)} />
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
                                    <OrderCard key={order.id} order={order} businesses={businesses} onClick={() => setSelectedOrder(order)} />
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
                                <h4 className="text-white font-medium mb-2">Ürünler</h4>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-gray-300">
                                                {item.quantity}x {item.productName || item.name}
                                            </span>
                                            <span className="text-white">{formatCurrency(item.totalPrice ?? ((item.unitPrice || item.price || 0) * (item.quantity || 1)))}</span>
                                        </div>
                                    ))}
                                </div>
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
        </div>
    );
}

// Order Card Component
function OrderCard({
    order,
    businesses,
    onClick
}: {
    order: Order;
    businesses: Record<string, string>;
    onClick: () => void;
}) {
    const statusInfo = orderStatuses[order.status];
    const typeInfo = orderTypes[order.type];

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
            <div className="flex items-center justify-between">
                <span className="text-green-400 font-bold">€{order.total?.toFixed(2)}</span>
                <span className="text-gray-500 text-xs">
                    {order.createdAt?.toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </button>
    );
}
