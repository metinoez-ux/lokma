'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

interface ShopStats {
    totalProducts: number;
    activeProducts: number;
    pendingOrders: number;
    todayOrders: number;
    totalRevenue: number;
}

interface RecentOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: any;
}

export default function ShopDashboard() {
    const { admin, loading: adminLoading } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<ShopStats>({
        totalProducts: 0,
        activeProducts: 0,
        pendingOrders: 0,
        todayOrders: 0,
        totalRevenue: 0
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

    const loadDashboardData = useCallback(async () => {
        if (!admin) return;

        setLoading(true);
        try {
            // Load products stats
            const productsSnap = await getDocs(collection(db, 'shop_products'));
            const products = productsSnap.docs.map(d => d.data());
            const activeProducts = products.filter(p => p.isActive).length;

            // Load orders
            const ordersSnap = await getDocs(query(
                collection(db, 'shop_orders'),
                orderBy('createdAt', 'desc'),
                limit(10)
            ));
            const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as RecentOrder));

            // Calculate stats
            const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayOrders = orders.filter(o => {
                const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                return orderDate >= today;
            }).length;
            const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

            setStats({
                totalProducts: products.length,
                activeProducts,
                pendingOrders,
                todayOrders,
                totalRevenue
            });
            setRecentOrders(orders.slice(0, 5));
        } catch (error) {
            console.error('Error loading shop data:', error);
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => {
        if (!adminLoading && admin) {
            loadDashboardData();
        }
    }, [adminLoading, admin, loadDashboardData]);

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-600/20 text-yellow-400',
        confirmed: 'bg-blue-600/20 text-blue-400',
        preparing: 'bg-purple-600/20 text-purple-400',
        shipped: 'bg-cyan-600/20 text-cyan-400',
        delivered: 'bg-green-600/20 text-green-400',
        cancelled: 'bg-red-600/20 text-red-400'
    };

    const statusLabels: Record<string, string> = {
        pending: 'Bekliyor',
        confirmed: 'Onaylandı',
        preparing: 'Hazırlanıyor',
        shipped: 'Kargoda',
        delivered: 'Teslim Edildi',
        cancelled: 'İptal'
    };

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white">
                            ← Dashboard
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                🛍️ E-Ticaret / Online Shop
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">
                                Monte Bueno & Diğer Markalar
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/admin/shop/products"
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-500 hover:to-indigo-500 transition shadow-lg flex items-center gap-2"
                        >
                            <span>📦</span>
                            Ürünler
                        </Link>
                        <Link
                            href="/admin/shop/orders"
                            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-500 hover:to-emerald-500 transition shadow-lg flex items-center gap-2"
                        >
                            <span>📋</span>
                            Siparişler
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-3xl mb-2">📦</div>
                        <div className="text-2xl font-bold text-white">{stats.totalProducts}</div>
                        <div className="text-gray-400 text-sm">Toplam Ürün</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-3xl mb-2">✅</div>
                        <div className="text-2xl font-bold text-green-400">{stats.activeProducts}</div>
                        <div className="text-gray-400 text-sm">Aktif Ürün</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-3xl mb-2">⏳</div>
                        <div className="text-2xl font-bold text-yellow-400">{stats.pendingOrders}</div>
                        <div className="text-gray-400 text-sm">Bekleyen Sipariş</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-3xl mb-2">📅</div>
                        <div className="text-2xl font-bold text-blue-400">{stats.todayOrders}</div>
                        <div className="text-gray-400 text-sm">Bugün</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="text-3xl mb-2">💰</div>
                        <div className="text-2xl font-bold text-emerald-400">€{stats.totalRevenue.toFixed(2)}</div>
                        <div className="text-gray-400 text-sm">Ciro</div>
                    </div>
                </div>
            </div>

            {/* Quick Actions & Recent Orders */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        ⚡ Hızlı İşlemler
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <Link href="/admin/shop/products?action=add" className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-xl p-4 text-center transition">
                            <div className="text-2xl mb-2">➕</div>
                            <div className="text-purple-300 text-sm font-medium">Yeni Ürün Ekle</div>
                        </Link>
                        <Link href="/admin/shop/orders?status=pending" className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 rounded-xl p-4 text-center transition">
                            <div className="text-2xl mb-2">📋</div>
                            <div className="text-yellow-300 text-sm font-medium">Bekleyen Siparişler</div>
                        </Link>
                        <Link href="/admin/shop/orders?status=shipped" className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/30 rounded-xl p-4 text-center transition">
                            <div className="text-2xl mb-2">🚚</div>
                            <div className="text-cyan-300 text-sm font-medium">Kargodakiler</div>
                        </Link>
                        <Link href="/admin/shop/products" className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-xl p-4 text-center transition">
                            <div className="text-2xl mb-2">📊</div>
                            <div className="text-gray-300 text-sm font-medium">Stok Kontrolü</div>
                        </Link>
                    </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            📋 Son Siparişler
                        </h2>
                        <Link href="/admin/shop/orders" className="text-blue-400 hover:text-blue-300 text-sm">
                            Tümünü Gör →
                        </Link>
                    </div>
                    {recentOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3">📭</div>
                            <p className="text-gray-400">Henüz sipariş yok</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentOrders.map(order => (
                                <Link
                                    key={order.id}
                                    href={`/admin/shop/orders/${order.id}`}
                                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition"
                                >
                                    <div>
                                        <div className="text-white font-medium">{order.orderNumber}</div>
                                        <div className="text-gray-400 text-sm">{order.customerName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-400 font-medium">€{order.total?.toFixed(2) || '0.00'}</div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[order.status] || 'bg-gray-600 text-gray-300'}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Brand Cards */}
            <div className="max-w-7xl mx-auto mt-8">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    🏷️ Markalar
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border border-yellow-700/50 rounded-xl p-6 text-center">
                        <div className="text-4xl mb-3">🫒</div>
                        <h3 className="text-white font-bold">Monte Bueno</h3>
                        <p className="text-yellow-300/70 text-sm">Zeytinyağı & Zeytin</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 text-center opacity-50">
                        <div className="text-4xl mb-3">🌿</div>
                        <h3 className="text-gray-400 font-bold">Yeni Marka</h3>
                        <p className="text-gray-500 text-sm">Yakında...</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
