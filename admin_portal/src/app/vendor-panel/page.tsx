'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface VendorAdmin {
    id: string;
    userId: string;
    vendorType: 'butcher' | 'market' | 'restaurant';
    vendorId: string;
    role: 'owner' | 'manager' | 'staff';
    permissions: string[];
    isActive: boolean;
    companyName?: string;
}

interface VendorOrder {
    id: string;
    orderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    totalPrice?: number;
    status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
    createdAt?: { toDate: () => Date };
    deliveryType?: 'pickup' | 'delivery';
}

interface SubscriptionInfo {
    plan: 'basic' | 'standard' | 'premium' | 'ultra' | 'free';
    pushQuotaUsed: number;
    pushQuotaTotal: number;
}

const planLabels: Record<string, { label: string; color: string; pushQuota: number }> = {
    ultra: { label: 'MIRA Ultra', color: 'bg-gradient-to-r from-purple-600 to-pink-600', pushQuota: 999 },
    premium: { label: 'MIRA Premium', color: 'bg-purple-600', pushQuota: 10 },
    standard: { label: 'MIRA Standard', color: 'bg-blue-600', pushQuota: 3 },
    basic: { label: 'MIRA Basic', color: 'bg-gray-500', pushQuota: 0 },
    free: { label: 'MIRA Free', color: 'bg-gray-700', pushQuota: 0 },
};

export default function VendorPanelPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState<VendorAdmin | null>(null);
    const [orders, setOrders] = useState<VendorOrder[]>([]);
    const [subscription, setSubscription] = useState<SubscriptionInfo>({
        plan: 'basic',
        pushQuotaUsed: 0,
        pushQuotaTotal: 0,
    });
    const [activeFilter, setActiveFilter] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');

    // Load vendor info and orders
    const loadVendorData = useCallback(async (vendorId: string, vendorType: string) => {
        try {
            // Determine collection based on vendor type
            const collectionName = vendorType === 'butcher' ? 'businesses' :
                vendorType === 'market' ? 'markets' : 'restaurants';
            const orderCollectionName = vendorType === 'butcher' ? 'orders' :
                vendorType === 'market' ? 'market_orders' : 'restaurant_orders';

            // Load vendor details
            const vendorDoc = await getDoc(doc(db, collectionName, vendorId));
            if (vendorDoc.exists()) {
                const data = vendorDoc.data();
                setSubscription({
                    plan: data.subscriptionPlan || 'basic',
                    pushQuotaUsed: data.pushQuotaUsed || 0,
                    pushQuotaTotal: planLabels[data.subscriptionPlan || 'basic'].pushQuota,
                });
            }

            // Load orders with real-time listener
            const ordersQuery = query(
                collection(db, orderCollectionName),
                where('butcherId', '==', vendorId),
                orderBy('createdAt', 'desc'),
                limit(100)
            );

            const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
                const orderData = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                } as VendorOrder));
                setOrders(orderData);
            });

            return unsubscribe;
        } catch (error) {
            console.error('Load vendor data error:', error);
        }
    }, []);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // Check if user is a vendor admin
                const vendorAdminDoc = await getDoc(doc(db, 'vendor_admins', user.uid));

                if (vendorAdminDoc.exists()) {
                    const vendorData = { id: vendorAdminDoc.id, ...vendorAdminDoc.data() } as VendorAdmin;
                    setVendor(vendorData);
                    await loadVendorData(vendorData.vendorId, vendorData.vendorType);
                } else {
                    // For demo: Check if super admin with butcher access
                    const { isSuperAdmin } = await import('@/lib/config');
                    if (isSuperAdmin(user.email)) {
                        // Demo mode: Use first butcher
                        const butchersQuery = query(collection(db, 'businesses'), limit(1));
                        const butchersSnapshot = await getDocs(butchersQuery);
                        if (!butchersSnapshot.empty) {
                            const firstButcher = butchersSnapshot.docs[0];
                            const demoVendor: VendorAdmin = {
                                id: 'demo',
                                userId: user.uid,
                                vendorType: 'butcher',
                                vendorId: firstButcher.id,
                                role: 'owner',
                                permissions: ['all'],
                                isActive: true,
                                companyName: firstButcher.data().companyName,
                            };
                            setVendor(demoVendor);
                            await loadVendorData(firstButcher.id, 'butcher');
                        }
                    } else {
                        router.push('/dashboard');
                        return;
                    }
                }

                setLoading(false);
            } catch (error) {
                console.error('Auth check error:', error);
                router.push('/login');
            }
        });

        return () => unsubscribeAuth();
    }, [router, loadVendorData]);

    // Filter orders by date
    const getFilteredOrders = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        return orders.filter(order => {
            if (!order.createdAt?.toDate) return false;
            const orderDate = order.createdAt.toDate();

            switch (activeFilter) {
                case 'today':
                    return orderDate >= today;
                case 'yesterday':
                    return orderDate >= yesterday && orderDate < today;
                case 'week':
                    return orderDate >= weekAgo;
                case 'month':
                    return orderDate >= monthAgo;
                default:
                    return true;
            }
        });
    };

    const filteredOrders = getFilteredOrders();

    // Calculate statistics
    const stats = {
        pending: orders.filter(o => o.status === 'pending').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        ready: orders.filter(o => o.status === 'ready').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        completed: orders.filter(o => o.status === 'completed').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
        todayRevenue: filteredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0),
        todayOrders: filteredOrders.length,
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-red-800 to-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">
                                    {vendor?.vendorType === 'butcher' ? '🥩' :
                                        vendor?.vendorType === 'market' ? '🛒' : '🍽️'}
                                </span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">{vendor?.companyName || 'Vendor Panel'}</h1>
                                <p className="text-red-200 text-sm">
                                    {vendor?.vendorType === 'butcher' ? 'Kasap Yönetim Paneli' :
                                        vendor?.vendorType === 'market' ? 'Market Yönetim Paneli' : 'Restoran Yönetim Paneli'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-sm ${planLabels[subscription.plan].color}`}>
                                {planLabels[subscription.plan].label}
                            </span>
                            <Link href="/admin" className="text-red-200 hover:text-white text-sm">
                                Admin Panel →
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Navigation */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex gap-3">
                        <Link
                            href="/vendor-panel"
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium"
                        >
                            📊 Dashboard
                        </Link>
                        <Link
                            href="/vendor-panel/products"
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                        >
                            📦 Ürün Yönetimi
                        </Link>
                        <Link
                            href="/vendor-panel/orders"
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                        >
                            🧾 Siparişler
                        </Link>
                        <Link
                            href="/vendor-panel/campaigns"
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 flex items-center gap-2"
                        >
                            📢 Kampanya
                            {subscription.pushQuotaTotal > 0 && (
                                <span className="bg-green-600 text-xs px-2 py-0.5 rounded-full">
                                    {subscription.pushQuotaTotal - subscription.pushQuotaUsed} hak
                                </span>
                            )}
                        </Link>
                        <Link
                            href="/vendor-panel/offers"
                            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-medium flex items-center gap-2"
                        >
                            📣 İndirim İlanı
                        </Link>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Real-time Order Status Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-xl p-4 text-center">
                        <p className="text-yellow-400 text-3xl font-bold animate-pulse">{stats.pending}</p>
                        <p className="text-yellow-200 text-sm">⏳ Bekleyen</p>
                    </div>
                    <div className="bg-blue-600/20 border border-blue-600/30 rounded-xl p-4 text-center">
                        <p className="text-blue-400 text-3xl font-bold">{stats.preparing}</p>
                        <p className="text-blue-200 text-sm">👨‍🍳 Hazırlanıyor</p>
                    </div>
                    <div className="bg-purple-600/20 border border-purple-600/30 rounded-xl p-4 text-center">
                        <p className="text-purple-400 text-3xl font-bold">{stats.ready}</p>
                        <p className="text-purple-200 text-sm">✅ Hazır</p>
                    </div>
                    <div className="bg-orange-600/20 border border-orange-600/30 rounded-xl p-4 text-center">
                        <p className="text-orange-400 text-3xl font-bold">{stats.delivered}</p>
                        <p className="text-orange-200 text-sm">🚗 Yolda</p>
                    </div>
                    <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 text-center">
                        <p className="text-green-400 text-3xl font-bold">{stats.completed}</p>
                        <p className="text-green-200 text-sm">✓ Tamamlanan</p>
                    </div>
                    <div className="bg-red-600/20 border border-red-600/30 rounded-xl p-4 text-center">
                        <p className="text-red-400 text-3xl font-bold">{stats.cancelled}</p>
                        <p className="text-red-200 text-sm">✕ İptal</p>
                    </div>
                </div>

                {/* Date Filter */}
                <div className="flex gap-2 mb-6">
                    {(['today', 'yesterday', 'week', 'month'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeFilter === filter
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                        >
                            {filter === 'today' ? '📅 Bugün' :
                                filter === 'yesterday' ? '📆 Dün' :
                                    filter === 'week' ? '📊 7 Gün' : '📈 30 Gün'}
                        </button>
                    ))}
                </div>

                {/* Revenue Stats */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h3 className="text-gray-400 text-sm mb-2">
                            {activeFilter === 'today' ? 'Bugünkü' :
                                activeFilter === 'yesterday' ? 'Dünkü' :
                                    activeFilter === 'week' ? 'Haftalık' : 'Aylık'} Ciro
                        </h3>
                        <p className="text-green-400 text-4xl font-bold">€{stats.todayRevenue.toFixed(2)}</p>
                        <p className="text-gray-500 text-sm mt-1">{stats.todayOrders} sipariş</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h3 className="text-gray-400 text-sm mb-2">Push Kampanya Hakkı</h3>
                        <div className="flex items-center gap-4">
                            <p className="text-white text-4xl font-bold">
                                {subscription.pushQuotaTotal - subscription.pushQuotaUsed}
                                <span className="text-gray-500 text-lg">/{subscription.pushQuotaTotal === 999 ? '∞' : subscription.pushQuotaTotal}</span>
                            </p>
                            {subscription.pushQuotaTotal - subscription.pushQuotaUsed > 0 && (
                                <Link
                                    href="/vendor-panel/campaigns"
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                    📢 Kampanya Gönder
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Pending Orders - Requires Attention */}
                {stats.pending > 0 && (
                    <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-yellow-400 font-bold flex items-center gap-2">
                                <span className="animate-pulse">⚠️</span> Bekleyen Siparişler ({stats.pending})
                            </h3>
                            <Link
                                href="/vendor-panel/orders?status=pending"
                                className="text-yellow-400 hover:text-yellow-300 text-sm"
                            >
                                Tümünü Gör →
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {orders.filter(o => o.status === 'pending').slice(0, 5).map((order) => (
                                <div key={order.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{order.customerName || 'Müşteri'}</p>
                                        <p className="text-gray-400 text-sm">#{order.orderNumber || order.id.slice(0, 8)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-400 font-bold">€{(order.totalPrice || 0).toFixed(2)}</p>
                                        <p className="text-gray-500 text-xs">
                                            {order.createdAt?.toDate?.()?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid md:grid-cols-3 gap-4">
                    <Link
                        href="/vendor-panel/products"
                        className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition group"
                    >
                        <div className="text-4xl mb-3">📦</div>
                        <h3 className="text-white font-bold mb-1">Ürün Yönetimi</h3>
                        <p className="text-gray-400 text-sm">Ürün ekle, fiyat güncelle, stok yönet</p>
                        <span className="text-red-400 text-sm group-hover:underline mt-2 inline-block">Yönet →</span>
                    </Link>
                    <Link
                        href="/vendor-panel/orders"
                        className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition group"
                    >
                        <div className="text-4xl mb-3">🧾</div>
                        <h3 className="text-white font-bold mb-1">Sipariş Listesi</h3>
                        <p className="text-gray-400 text-sm">Tüm siparişleri görüntüle ve yönet</p>
                        <span className="text-red-400 text-sm group-hover:underline mt-2 inline-block">Görüntüle →</span>
                    </Link>
                    <Link
                        href="/vendor-panel/campaigns"
                        className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition group"
                    >
                        <div className="text-4xl mb-3">📢</div>
                        <h3 className="text-white font-bold mb-1">Kampanya Gönder</h3>
                        <p className="text-gray-400 text-sm">Müşterilerine indirim/aksiyon bildirimi</p>
                        <span className="text-red-400 text-sm group-hover:underline mt-2 inline-block">Kampanya Oluştur →</span>
                    </Link>
                </div>
            </main>
        </div>
    );
}
