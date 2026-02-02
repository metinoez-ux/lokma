'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface SupplierOrder {
    id: string;
    supplierId: string;
    supplierName: string;
    items: { productName: string; quantity: number; unit: string }[];
    deliveryDate?: string;
    notes?: string;
    status: string;
    sendMethod: string;
    createdAt: Timestamp;
}

export default function SupplierOrderHistoryPage() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [orders, setOrders] = useState<SupplierOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);

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

    useEffect(() => {
        if (!businessId) return;

        const loadOrders = async () => {
            try {
                const q = query(
                    collection(db, 'businesses', businessId, 'supplier_orders'),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SupplierOrder[]);
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, [businessId]);

    const filteredOrders = orders.filter(o => filter === 'all' || o.status === filter);

    // Stats
    const thisMonth = orders.filter(o => {
        const date = o.createdAt?.toDate();
        const now = new Date();
        return date?.getMonth() === now.getMonth() && date?.getFullYear() === now.getFullYear();
    });

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">📋 Sipariş Geçmişi</h1>
                    <p className="text-gray-400">Toptancılara verilen siparişler</p>
                </div>
                <a
                    href="/vendor/suppliers/orders"
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl"
                >
                    ➕ Yeni Sipariş
                </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Toplam Sipariş</p>
                    <p className="text-2xl font-bold text-white">{orders.length}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Bu Ay</p>
                    <p className="text-2xl font-bold text-blue-400">{thisMonth.length}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm">Bekleyen</p>
                    <p className="text-2xl font-bold text-yellow-400">
                        {orders.filter(o => o.status === 'sent').length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-4 mb-6 flex gap-2">
                {['all', 'sent', 'confirmed', 'delivered', 'cancelled'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg ${filter === status ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                            }`}
                    >
                        {status === 'all' ? 'Tümü' :
                            status === 'sent' ? '📤 Gönderildi' :
                                status === 'confirmed' ? '✅ Onaylandı' :
                                    status === 'delivered' ? '📦 Teslim' : '❌ İptal'}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-4xl block mb-2">📋</span>
                    <p className="text-gray-400">Sipariş geçmişi boş</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-blue-500 cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🏭</span>
                                    <div>
                                        <p className="text-white font-bold">{order.supplierName}</p>
                                        <p className="text-gray-500 text-sm">
                                            {order.createdAt?.toDate().toLocaleDateString('tr-TR')} •{' '}
                                            {order.sendMethod === 'whatsapp' ? '💬 WhatsApp' : '✉️ E-posta'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm ${order.status === 'sent' ? 'bg-yellow-600/20 text-yellow-400' :
                                        order.status === 'confirmed' ? 'bg-blue-600/20 text-blue-400' :
                                            order.status === 'delivered' ? 'bg-green-600/20 text-green-400' :
                                                'bg-red-600/20 text-red-400'
                                    }`}>
                                    {order.status === 'sent' ? '📤 Gönderildi' :
                                        order.status === 'confirmed' ? '✅ Onaylandı' :
                                            order.status === 'delivered' ? '📦 Teslim' : '❌ İptal'}
                                </span>
                            </div>
                            <div className="text-gray-400 text-sm">
                                {order.items.slice(0, 3).map((item, i) => (
                                    <span key={i}>
                                        {item.quantity} {item.unit} {item.productName}
                                        {i < Math.min(order.items.length - 1, 2) ? ', ' : ''}
                                    </span>
                                ))}
                                {order.items.length > 3 && ` +${order.items.length - 3} daha`}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">📦 Sipariş Detayı</h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <p className="text-gray-400 text-sm">Toptancı</p>
                                <p className="text-white font-bold">{selectedOrder.supplierName}</p>
                            </div>

                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <p className="text-gray-400 text-sm mb-2">Ürünler</p>
                                <div className="space-y-2">
                                    {selectedOrder.items.map((item, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-white">{item.productName}</span>
                                            <span className="text-gray-400">{item.quantity} {item.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedOrder.deliveryDate && (
                                <div className="bg-gray-700/50 rounded-xl p-4">
                                    <p className="text-gray-400 text-sm">Teslimat Tarihi</p>
                                    <p className="text-white">{new Date(selectedOrder.deliveryDate).toLocaleDateString('tr-TR')}</p>
                                </div>
                            )}

                            {selectedOrder.notes && (
                                <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
                                    <p className="text-yellow-400 text-sm">Not</p>
                                    <p className="text-gray-300">{selectedOrder.notes}</p>
                                </div>
                            )}

                            <div className="text-gray-500 text-sm text-center">
                                📅 {selectedOrder.createdAt?.toDate().toLocaleString('tr-TR')}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
