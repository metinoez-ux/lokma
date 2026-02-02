'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface VendorOrder {
    id: string;
    orderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    totalPrice?: number;
    status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
    deliveryType?: 'pickup' | 'delivery';
    items?: { name: string; quantity: number; price: number }[];
    createdAt?: { toDate: () => Date };
    notes?: string;
}

const statusLabels: Record<string, { label: string; color: string; nextStatus?: string; nextLabel?: string }> = {
    pending: { label: '⏳ Bekliyor', color: 'bg-yellow-600', nextStatus: 'preparing', nextLabel: 'Hazırlamaya Başla' },
    preparing: { label: '👨‍🍳 Hazırlanıyor', color: 'bg-blue-600', nextStatus: 'ready', nextLabel: 'Hazır' },
    ready: { label: '✅ Hazır', color: 'bg-green-600', nextStatus: 'delivered', nextLabel: 'Teslim Edildi' },
    delivered: { label: '🚗 Teslim Edildi', color: 'bg-purple-600', nextStatus: 'completed', nextLabel: 'Tamamlandı' },
    completed: { label: '✓ Tamamlandı', color: 'bg-gray-600' },
    cancelled: { label: '✕ İptal', color: 'bg-red-600' },
};

export default function VendorOrdersPage() {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [loading, setLoading] = useState(true);
    const [vendorId, setVendorId] = useState<string | null>(null);
    const [vendorName, setVendorName] = useState<string>('');
    const [orders, setOrders] = useState<VendorOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
    const [updating, setUpdating] = useState(false);

    const loadOrders = useCallback((vId: string) => {
        const ordersQuery = query(
            collection(db, 'orders'),
            where('businessId', '==', vId),
            orderBy('createdAt', 'desc'),
            limit(200)
        );

        return onSnapshot(ordersQuery, (snapshot) => {
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as VendorOrder));
            setOrders(data);
        });
    }, []);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                const vendorAdminDoc = await getDoc(doc(db, 'vendor_admins', user.uid));
                if (vendorAdminDoc.exists()) {
                    const data = vendorAdminDoc.data();
                    setVendorId(data.vendorId);
                    const vendorDoc = await getDoc(doc(db, 'businesses', data.vendorId));
                    if (vendorDoc.exists()) {
                        setVendorName(vendorDoc.data().companyName);
                    }
                    loadOrders(data.vendorId);
                } else {
                    const { isSuperAdmin } = await import('@/lib/config');
                    if (isSuperAdmin(user.email)) {
                        const butchersQuery = query(collection(db, 'businesses'), limit(1));
                        const snapshot = await getDocs(butchersQuery);
                        if (!snapshot.empty) {
                            const butcher = snapshot.docs[0];
                            setVendorId(butcher.id);
                            setVendorName(butcher.data().companyName);
                            loadOrders(butcher.id);
                        }
                    } else {
                        router.push('/dashboard');
                        return;
                    }
                }
                setLoading(false);
            } catch (error) {
                console.error('Auth error:', error);
                router.push('/login');
            }
        });

        return () => unsubscribeAuth();
    }, [router, loadOrders]);

    // Update order status
    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        setUpdating(true);
        try {
            await updateDoc(doc(db, 'orders', orderId), {
                status: newStatus,
                updatedAt: new Date(),
            });
            setSelectedOrder(null);
        } catch (error) {
            console.error('Update status error:', error);
        }
        setUpdating(false);
    };

    // Cancel order
    const cancelOrder = async (orderId: string) => {
        if (!confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) return;
        await updateOrderStatus(orderId, 'cancelled');
    };

    // Filter orders
    const filteredOrders = statusFilter === 'all'
        ? orders
        : orders.filter(o => o.status === statusFilter);

    // Stats
    const stats = {
        pending: orders.filter(o => o.status === 'pending').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        ready: orders.filter(o => o.status === 'ready').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
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
            {/* Header */}
            <header className="bg-gradient-to-r from-red-800 to-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <Link href="/vendor-panel" className="flex items-center gap-2 text-red-100 hover:text-white">
                        <span className="text-xl">←</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-3xl">🧾</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{vendorName} - Siparişler</h1>
                                <p className="text-gray-400 text-sm mt-1">{orders.length} sipariş</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex gap-2 overflow-x-auto">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${statusFilter === 'all' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            Tümü ({orders.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap flex items-center gap-2 ${statusFilter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            ⏳ Bekleyen
                            {stats.pending > 0 && <span className="bg-yellow-500 text-white px-2 rounded-full text-xs animate-pulse">{stats.pending}</span>}
                        </button>
                        <button
                            onClick={() => setStatusFilter('preparing')}
                            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${statusFilter === 'preparing' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            👨‍🍳 Hazırlanıyor ({stats.preparing})
                        </button>
                        <button
                            onClick={() => setStatusFilter('ready')}
                            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${statusFilter === 'ready' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            ✅ Hazır ({stats.ready})
                        </button>
                        <button
                            onClick={() => setStatusFilter('delivered')}
                            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${statusFilter === 'delivered' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            🚗 Teslim ({stats.delivered})
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {filteredOrders.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="text-4xl mb-4">📦</div>
                        <h3 className="text-lg font-medium text-white mb-2">Sipariş bulunamadı</h3>
                        <p className="text-gray-400">Bu filtreye uygun sipariş yok.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredOrders.map(order => (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 transition"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-white font-bold">#{order.orderNumber || order.id.slice(0, 8)}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${statusLabels[order.status].color}`}>
                                                {statusLabels[order.status].label}
                                            </span>
                                            {order.deliveryType === 'delivery' && (
                                                <span className="text-orange-400 text-xs">🚗 Teslimat</span>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-sm">{order.customerName} • {order.customerPhone}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-400 font-bold text-lg">€{(order.totalPrice || 0).toFixed(2)}</p>
                                        <p className="text-gray-500 text-xs">
                                            {order.createdAt?.toDate?.()?.toLocaleString('de-DE', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Sipariş #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</h2>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${statusLabels[selectedOrder.status].color}`}>
                                        {statusLabels[selectedOrder.status].label}
                                    </span>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white text-2xl">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Customer Info */}
                            <div className="bg-gray-700 rounded-lg p-4">
                                <h3 className="text-gray-400 text-sm mb-2">Müşteri</h3>
                                <p className="text-white font-medium">{selectedOrder.customerName}</p>
                                <a href={`tel:${selectedOrder.customerPhone}`} className="text-blue-400 text-sm">{selectedOrder.customerPhone}</a>
                                {selectedOrder.customerAddress && (
                                    <p className="text-gray-300 text-sm mt-1">📍 {selectedOrder.customerAddress}</p>
                                )}
                            </div>

                            {/* Items */}
                            {selectedOrder.items && selectedOrder.items.length > 0 && (
                                <div className="bg-gray-700 rounded-lg p-4">
                                    <h3 className="text-gray-400 text-sm mb-2">Ürünler</h3>
                                    <div className="space-y-2">
                                        {selectedOrder.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm">
                                                <span className="text-white">{item.quantity}x {item.name}</span>
                                                <span className="text-gray-400">€{(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-gray-600 mt-3 pt-3 flex justify-between">
                                        <span className="text-white font-bold">Toplam</span>
                                        <span className="text-green-400 font-bold">€{(selectedOrder.totalPrice || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedOrder.notes && (
                                <div className="bg-gray-700 rounded-lg p-4">
                                    <h3 className="text-gray-400 text-sm mb-2">Not</h3>
                                    <p className="text-white">{selectedOrder.notes}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-2">
                                {statusLabels[selectedOrder.status].nextStatus && (
                                    <button
                                        onClick={() => updateOrderStatus(selectedOrder.id, statusLabels[selectedOrder.status].nextStatus!)}
                                        disabled={updating}
                                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                                    >
                                        {updating ? 'Güncelleniyor...' : `✓ ${statusLabels[selectedOrder.status].nextLabel}`}
                                    </button>
                                )}
                                {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && (
                                    <button
                                        onClick={() => cancelOrder(selectedOrder.id)}
                                        className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                    >
                                        ✕ Siparişi İptal Et
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
