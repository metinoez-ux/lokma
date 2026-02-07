'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

interface ShopOrder {
    id: string;
    orderNumber: string;
    customerId?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
    };
    items: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
        image?: string;
    }[];
    subtotal: number;
    shippingCost: number;
    total: number;
    status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
    shipping?: {
        carrier: string;
        trackingNumber: string;
        shippedAt: any;
    };
    createdAt: any;
    confirmedAt?: any;
    shippedAt?: any;
    deliveredAt?: any;
    notes?: string;
}

const STATUS_OPTIONS = [
    { value: 'pending', label: '⏳ Bekliyor', color: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' },
    { value: 'confirmed', label: '✅ Onaylandı', color: 'bg-blue-600/20 text-blue-400 border-blue-600/30' },
    { value: 'preparing', label: '📦 Hazırlanıyor', color: 'bg-purple-600/20 text-purple-400 border-purple-600/30' },
    { value: 'shipped', label: '🚚 Kargoda', color: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30' },
    { value: 'delivered', label: '🎉 Teslim Edildi', color: 'bg-green-600/20 text-green-400 border-green-600/30' },
    { value: 'cancelled', label: '❌ İptal', color: 'bg-red-600/20 text-red-400 border-red-600/30' },
];

const CARRIER_OPTIONS = [
    { value: 'DHL', label: '🟡 DHL' },
    { value: 'UPS', label: '🟤 UPS' },
    { value: 'DPD', label: '🔴 DPD' },
    { value: 'Hermes', label: '🔵 Hermes' },
    { value: 'GLS', label: '🟢 GLS' },
    { value: 'Other', label: '📦 Diğer' },
];

export default function ShopOrdersPage() {
    const { admin, loading: adminLoading } = useAdmin();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<ShopOrder[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<ShopOrder[]>([]);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
    const [showShippingModal, setShowShippingModal] = useState(false);
    const [shippingCarrier, setShippingCarrier] = useState('DHL');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [saving, setSaving] = useState(false);

    const loadOrders = useCallback(async () => {
        if (!admin) return;
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'shop_orders'), orderBy('createdAt', 'desc')));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShopOrder));
            setOrders(data);
        } catch (error) {
            console.error('Error loading orders:', error);
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => {
        if (!adminLoading && admin) {
            loadOrders();
        }
    }, [adminLoading, admin, loadOrders]);

    // Filter orders
    useEffect(() => {
        let result = orders;
        if (selectedStatus !== 'all') {
            result = result.filter(o => o.status === selectedStatus);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.orderNumber?.toLowerCase().includes(q) ||
                o.customerName?.toLowerCase().includes(q) ||
                o.customerEmail?.toLowerCase().includes(q)
            );
        }
        setFilteredOrders(result);
    }, [orders, selectedStatus, searchQuery]);

    const updateOrderStatus = async (orderId: string, newStatus: ShopOrder['status']) => {
        try {
            const updateData: any = { status: newStatus };
            if (newStatus === 'confirmed') updateData.confirmedAt = new Date();
            if (newStatus === 'delivered') updateData.deliveredAt = new Date();

            await updateDoc(doc(db, 'shop_orders', orderId), updateData);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updateData } : o));

            // TODO: Send email notification
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const openShippingModal = (order: ShopOrder) => {
        setSelectedOrder(order);
        setShippingCarrier(order.shipping?.carrier || 'DHL');
        setTrackingNumber(order.shipping?.trackingNumber || '');
        setShowShippingModal(true);
    };

    const handleShipOrder = async () => {
        if (!selectedOrder || !trackingNumber) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'shop_orders', selectedOrder.id), {
                status: 'shipped',
                shipping: {
                    carrier: shippingCarrier,
                    trackingNumber: trackingNumber,
                    shippedAt: new Date()
                },
                shippedAt: new Date()
            });
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? {
                ...o,
                status: 'shipped' as const,
                shipping: { carrier: shippingCarrier, trackingNumber, shippedAt: new Date() }
            } : o));
            setShowShippingModal(false);

            // TODO: Send shipping notification email
        } catch (error) {
            console.error('Error shipping order:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusStyle = (status: string) => {
        return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-600/20 text-gray-400';
    };

    const getStatusLabel = (status: string) => {
        return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
        );
    }

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const confirmedCount = orders.filter(o => o.status === 'confirmed').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/shop" className="text-gray-400 hover:text-white">← E-Ticaret</Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">📋 Sipariş Yönetimi</h1>
                            <p className="text-gray-400 text-sm mt-1">{filteredOrders.length} sipariş</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {pendingCount > 0 && (
                            <span className="bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-lg text-sm">
                                ⏳ {pendingCount} Bekleyen
                            </span>
                        )}
                        {confirmedCount > 0 && (
                            <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg text-sm">
                                ✅ {confirmedCount} Hazırlanacak
                            </span>
                        )}
                        {shippedCount > 0 && (
                            <span className="bg-cyan-600/20 text-cyan-400 px-3 py-1 rounded-lg text-sm">
                                🚚 {shippedCount} Kargoda
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-wrap gap-3">
                    <input
                        type="text"
                        placeholder="🔍 Sipariş ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                    >
                        <option value="all">Tüm Durumlar</option>
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Orders List */}
            <div className="max-w-7xl mx-auto">
                {filteredOrders.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                        <div className="text-6xl mb-4">📭</div>
                        <h2 className="text-xl font-bold text-white mb-2">Sipariş Bulunamadı</h2>
                        <p className="text-gray-400">Henüz sipariş yok veya filtreye uygun sipariş bulunamadı.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                                {/* Order Header */}
                                <div className="p-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="text-white font-bold">{order.orderNumber || `#${order.id.slice(0, 6).toUpperCase()}`}</span>
                                            <span className="text-gray-500 text-sm ml-2">{formatDate(order.createdAt)}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-lg text-sm border ${getStatusStyle(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>
                                    <div className="text-emerald-400 font-bold text-lg">€{order.total?.toFixed(2) || '0.00'}</div>
                                </div>

                                {/* Order Content */}
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Customer */}
                                    <div>
                                        <h4 className="text-gray-400 text-sm mb-2">👤 Müşteri</h4>
                                        <div className="text-white font-medium">{order.customerName}</div>
                                        <div className="text-gray-400 text-sm">{order.customerEmail}</div>
                                        <div className="text-gray-400 text-sm">{order.customerPhone}</div>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <h4 className="text-gray-400 text-sm mb-2">📍 Teslimat Adresi</h4>
                                        <div className="text-white text-sm">
                                            {order.shippingAddress?.street}<br />
                                            {order.shippingAddress?.postalCode} {order.shippingAddress?.city}<br />
                                            {order.shippingAddress?.country}
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <div>
                                        <h4 className="text-gray-400 text-sm mb-2">📦 Ürünler ({order.items?.length || 0})</h4>
                                        <div className="space-y-1 text-sm">
                                            {order.items?.slice(0, 3).map((item, i) => (
                                                <div key={i} className="text-white flex justify-between">
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span className="text-gray-400">€{(item.price * item.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {(order.items?.length || 0) > 3 && (
                                                <div className="text-gray-500">+{order.items.length - 3} daha...</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Shipping Info (if shipped) */}
                                {order.shipping && (
                                    <div className="px-4 pb-2">
                                        <div className="bg-cyan-600/10 border border-cyan-600/30 rounded-lg p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-cyan-400">🚚</span>
                                                <div>
                                                    <span className="text-white font-medium">{order.shipping.carrier}</span>
                                                    <span className="text-cyan-400 ml-2 font-mono">{order.shipping.trackingNumber}</span>
                                                </div>
                                            </div>
                                            <a
                                                href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?idc=${order.shipping.trackingNumber}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-cyan-400 hover:text-cyan-300 text-sm"
                                            >
                                                Takip Et →
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="p-4 bg-gray-900/50 flex flex-wrap gap-2">
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
                                        >
                                            ✅ Onayla
                                        </button>
                                    )}
                                    {order.status === 'confirmed' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-sm font-medium"
                                        >
                                            📦 Hazırlanıyor
                                        </button>
                                    )}
                                    {(order.status === 'confirmed' || order.status === 'preparing') && (
                                        <button
                                            onClick={() => openShippingModal(order)}
                                            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-sm font-medium"
                                        >
                                            🚚 Kargoya Ver
                                        </button>
                                    )}
                                    {order.status === 'shipped' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm font-medium"
                                        >
                                            🎉 Teslim Edildi
                                        </button>
                                    )}
                                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 text-sm font-medium"
                                        >
                                            ❌ İptal
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Shipping Modal */}
            {showShippingModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">🚚 Kargoya Ver</h2>
                            <button onClick={() => setShowShippingModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-gray-700/50 rounded-lg p-3">
                                <div className="text-gray-400 text-sm">Sipariş</div>
                                <div className="text-white font-bold">{selectedOrder.orderNumber}</div>
                                <div className="text-gray-400 text-sm">{selectedOrder.customerName}</div>
                            </div>

                            <div>
                                <label className="text-gray-300 text-sm font-medium mb-2 block">Kargo Şirketi</label>
                                <select
                                    value={shippingCarrier}
                                    onChange={(e) => setShippingCarrier(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                                >
                                    {CARRIER_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-gray-300 text-sm font-medium mb-2 block">Takip Numarası *</label>
                                <input
                                    type="text"
                                    value={trackingNumber}
                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                    placeholder="JD1234567890"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowShippingModal(false)} className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
                                İptal
                            </button>
                            <button
                                onClick={handleShipOrder}
                                disabled={saving || !trackingNumber}
                                className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Gönderiliyor...' : '🚚 Kargoya Ver'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
