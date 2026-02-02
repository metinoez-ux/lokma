'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    unit?: string;
}

interface Order {
    id: string;
    orderNumber: string;
    customerName?: string;
    customerPhone?: string;
    items: OrderItem[];
    subtotal: number;
    deliveryFee?: number;
    total: number;
    status: string;
    type: 'pickup' | 'delivery' | 'dine_in';
    createdAt: Timestamp;
    notes?: string;
    address?: {
        street?: string;
        postalCode?: string;
        city?: string;
    };
}

const orderStatuses = {
    pending_payment: { label: 'Ödeme Bekleniyor', color: 'yellow', icon: '💳' },
    confirmed: { label: 'Onaylandı', color: 'blue', icon: '✅' },
    preparing: { label: 'Hazırlanıyor', color: 'orange', icon: '👨‍🍳' },
    ready_for_pickup: { label: 'Hazır', color: 'green', icon: '📦' },
    ready_for_delivery: { label: 'Kurye Bekliyor', color: 'purple', icon: '🚚' },
    out_for_delivery: { label: 'Yolda', color: 'indigo', icon: '🛵' },
    delivered: { label: 'Teslim Edildi', color: 'emerald', icon: '🎉' },
    picked_up: { label: 'Teslim Alındı', color: 'emerald', icon: '✔️' },
    cancelled: { label: 'İptal', color: 'red', icon: '❌' },
};

const orderTypes = {
    pickup: { label: 'Gel Al', icon: '🏃' },
    delivery: { label: 'Kurye', icon: '🚚' },
    dine_in: { label: 'Yerinde', icon: '🍽️' },
};

export default function VendorOrdersPage() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Get business ID
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    setBusinessId(data.butcherId || data.businessId);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Load orders - TENANT SCOPED
    useEffect(() => {
        if (!businessId) return;

        const q = query(
            collection(db, 'orders'),
            where('businessId', '==', businessId), // ← TENANT ISOLATION
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                orderNumber: doc.data().orderNumber || doc.id.slice(-6),
            })) as Order[];
            setOrders(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    // Filter orders
    const filteredOrders = orders.filter(order => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'active') {
            return !['delivered', 'picked_up', 'cancelled'].includes(order.status);
        }
        return order.status === statusFilter;
    });

    // Update order status
    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'orders', orderId), {
                status: newStatus,
                [`statusHistory.${newStatus}`]: new Date(),
                updatedAt: new Date(),
            });
            showToast('Sipariş durumu güncellendi', 'success');
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error:', error);
            showToast('Durum güncellenirken hata oluştu', 'error');
        }
    };

    // Calculate active order count
    const activeCount = orders.filter(o =>
        !['delivered', 'picked_up', 'cancelled'].includes(o.status)
    ).length;

    return (
        <div className="p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">📦 Siparişler</h1>
                    <p className="text-gray-400">
                        {activeCount} aktif sipariş • Toplam {orders.length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-2">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 rounded-lg ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    Tümü ({orders.length})
                </button>
                <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 rounded-lg ${statusFilter === 'active' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    🔥 Aktif ({activeCount})
                </button>
                {Object.entries(orderStatuses).slice(0, 5).map(([key, info]) => (
                    <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`px-4 py-2 rounded-lg ${statusFilter === key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                            }`}
                    >
                        {info.icon} {info.label}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-4xl block mb-2">📭</span>
                    <p className="text-gray-400">Sipariş bulunamadı</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => {
                        const statusInfo = orderStatuses[order.status as keyof typeof orderStatuses] || { label: order.status, color: 'gray', icon: '❓' };
                        const typeInfo = orderTypes[order.type] || { label: order.type, icon: '📦' };

                        return (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-blue-500 cursor-pointer transition"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{statusInfo.icon}</div>
                                        <div>
                                            <p className="text-white font-bold">#{order.orderNumber}</p>
                                            <p className="text-gray-400 text-sm">
                                                {order.customerName || 'Misafir'} • {typeInfo.icon} {typeInfo.label}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-400 font-bold text-lg">€{order.total?.toFixed(2)}</p>
                                        <p className="text-gray-500 text-xs">
                                            {order.createdAt?.toDate().toLocaleString('tr-TR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                                {/* Items preview */}
                                <div className="mt-3 text-gray-400 text-sm">
                                    {order.items?.slice(0, 3).map((item, i) => (
                                        <span key={i}>
                                            {item.quantity}x {item.name}{i < Math.min(order.items.length - 1, 2) ? ', ' : ''}
                                        </span>
                                    ))}
                                    {order.items?.length > 3 && <span> +{order.items.length - 3} daha</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                📦 Sipariş #{selectedOrder.orderNumber}
                            </h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Customer Info */}
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <h3 className="text-white font-medium mb-2">👤 Müşteri</h3>
                                <p className="text-white">{selectedOrder.customerName || 'Misafir'}</p>
                                {selectedOrder.customerPhone && (
                                    <a href={`tel:${selectedOrder.customerPhone}`} className="text-blue-400 text-sm">
                                        📞 {selectedOrder.customerPhone}
                                    </a>
                                )}
                            </div>

                            {/* Address (if delivery) */}
                            {selectedOrder.type === 'delivery' && selectedOrder.address && (
                                <div className="bg-gray-700/50 rounded-xl p-4">
                                    <h3 className="text-white font-medium mb-2">📍 Adres</h3>
                                    <p className="text-gray-300">{selectedOrder.address.street}</p>
                                    <p className="text-gray-300">{selectedOrder.address.postalCode} {selectedOrder.address.city}</p>
                                </div>
                            )}

                            {/* Items */}
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <h3 className="text-white font-medium mb-2">🍖 Ürünler</h3>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-gray-300">{item.quantity}x {item.name}</span>
                                            <span className="text-white">€{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-gray-600 mt-3 pt-3 flex justify-between font-bold">
                                    <span className="text-white">Toplam</span>
                                    <span className="text-green-400">€{selectedOrder.total?.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedOrder.notes && (
                                <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
                                    <h3 className="text-yellow-400 font-medium mb-1">📝 Not</h3>
                                    <p className="text-gray-300">{selectedOrder.notes}</p>
                                </div>
                            )}

                            {/* Status Update */}
                            <div>
                                <h3 className="text-white font-medium mb-3">🔄 Durumu Güncelle</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(orderStatuses).map(([key, info]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleStatusChange(selectedOrder.id, key)}
                                            disabled={selectedOrder.status === key}
                                            className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 ${selectedOrder.status === key
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                        >
                                            <span>{info.icon}</span>
                                            <span>{info.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
