'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface DashboardStats {
    todayOrders: number;
    pendingOrders: number;
    todayRevenue: number;
    totalProducts: number;
}

interface RecentOrder {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: Timestamp;
}

export default function VendorDashboard() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState('İşletme');
    const [stats, setStats] = useState<DashboardStats>({
        todayOrders: 0,
        pendingOrders: 0,
        todayRevenue: 0,
        totalProducts: 0,
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [loading, setLoading] = useState(true);

    // Get business ID from current user
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    const bId = data.butcherId || data.businessId;
                    setBusinessId(bId);

                    // Get business name
                    if (bId) {
                        const businessDoc = await getDoc(doc(db, 'businesses', bId));
                        if (businessDoc.exists()) {
                            setBusinessName(businessDoc.data().companyName || 'İşletme');
                        }
                    }
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Load dashboard data
    useEffect(() => {
        if (!businessId) return;

        const loadStats = async () => {
            try {
                // Get today's date range
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Get today's orders
                const ordersQuery = query(
                    collection(db, 'orders'),
                    where('businessId', '==', businessId),
                    where('createdAt', '>=', Timestamp.fromDate(today)),
                    where('createdAt', '<', Timestamp.fromDate(tomorrow))
                );
                const ordersSnapshot = await getDocs(ordersQuery);

                let todayRevenue = 0;
                let pendingCount = 0;
                ordersSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    todayRevenue += data.total || 0;
                    if (['pending_payment', 'confirmed', 'preparing'].includes(data.status)) {
                        pendingCount++;
                    }
                });

                // Get product count
                const productsQuery = query(
                    collection(db, 'businesses', businessId, 'products')
                );
                const productsSnapshot = await getDocs(productsQuery);

                setStats({
                    todayOrders: ordersSnapshot.size,
                    pendingOrders: pendingCount,
                    todayRevenue,
                    totalProducts: productsSnapshot.size,
                });

                setLoading(false);
            } catch (error) {
                console.error('Error loading stats:', error);
                setLoading(false);
            }
        };

        loadStats();

        // Real-time recent orders
        const ordersQuery = query(
            collection(db, 'orders'),
            where('businessId', '==', businessId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            const orders = snapshot.docs.slice(0, 5).map(doc => ({
                id: doc.id,
                orderNumber: doc.data().orderNumber || doc.id.slice(-6),
                total: doc.data().total || 0,
                status: doc.data().status || 'pending',
                createdAt: doc.data().createdAt,
            }));
            setRecentOrders(orders);
        });

        return () => unsubscribe();
    }, [businessId]);

    const statusLabels: Record<string, { label: string; color: string }> = {
        pending_payment: { label: 'Ödeme Bekleniyor', color: 'yellow' },
        confirmed: { label: 'Onaylandı', color: 'blue' },
        preparing: { label: 'Hazırlanıyor', color: 'orange' },
        ready_for_pickup: { label: 'Hazır', color: 'green' },
        ready_for_delivery: { label: 'Kurye Bekliyor', color: 'purple' },
        out_for_delivery: { label: 'Yolda', color: 'indigo' },
        delivered: { label: 'Teslim Edildi', color: 'emerald' },
        picked_up: { label: 'Teslim Alındı', color: 'emerald' },
        cancelled: { label: 'İptal', color: 'red' },
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">👋 Hoş Geldiniz!</h1>
                <p className="text-gray-400">{businessName} Dashboard</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-2xl">
                            📦
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Bugünkü Siparişler</p>
                            <p className="text-2xl font-bold text-white">{stats.todayOrders}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-yellow-600/20 rounded-xl flex items-center justify-center text-2xl">
                            ⏳
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Bekleyen</p>
                            <p className="text-2xl font-bold text-yellow-400">{stats.pendingOrders}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center text-2xl">
                            💰
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Bugünkü Ciro</p>
                            <p className="text-2xl font-bold text-green-400">€{stats.todayRevenue.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center text-2xl">
                            🍖
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Ürün Sayısı</p>
                            <p className="text-2xl font-bold text-white">{stats.totalProducts}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
                <h2 className="text-white font-bold mb-4">⚡ Hızlı İşlemler</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <a href="/vendor/orders" className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-4 text-center transition">
                        <span className="text-2xl block mb-1">📦</span>
                        <span className="text-sm">Siparişleri Gör</span>
                    </a>
                    <a href="/vendor/products" className="bg-green-600 hover:bg-green-500 text-white rounded-xl p-4 text-center transition">
                        <span className="text-2xl block mb-1">➕</span>
                        <span className="text-sm">Ürün Ekle</span>
                    </a>
                    <a href="/vendor/staff" className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl p-4 text-center transition">
                        <span className="text-2xl block mb-1">👥</span>
                        <span className="text-sm">Personel</span>
                    </a>
                    <a href="/vendor/settings" className="bg-gray-600 hover:bg-gray-500 text-white rounded-xl p-4 text-center transition">
                        <span className="text-2xl block mb-1">⚙️</span>
                        <span className="text-sm">Ayarlar</span>
                    </a>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-gray-800 rounded-xl border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-white font-bold">📋 Son Siparişler</h2>
                    <a href="/vendor/orders" className="text-blue-400 text-sm hover:underline">
                        Tümünü Gör →
                    </a>
                </div>
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    </div>
                ) : recentOrders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <span className="text-4xl block mb-2">📭</span>
                        Henüz sipariş yok
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {recentOrders.map((order) => {
                            const statusInfo = statusLabels[order.status] || { label: order.status, color: 'gray' };
                            return (
                                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-gray-700/50 transition">
                                    <div>
                                        <p className="text-white font-medium">#{order.orderNumber}</p>
                                        <p className="text-gray-500 text-sm">
                                            {order.createdAt?.toDate().toLocaleString('tr-TR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-400 font-bold">€{order.total.toFixed(2)}</p>
                                        <span className={`text-xs px-2 py-1 rounded-full bg-${statusInfo.color}-600/20 text-${statusInfo.color}-400`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
