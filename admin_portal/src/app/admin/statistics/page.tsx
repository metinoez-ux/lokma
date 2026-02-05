'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';

interface OrderItem {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    unit?: string;
}

interface Order {
    id: string;
    businessId: string;
    businessName?: string;
    items: OrderItem[];
    total: number;
    status: string;
    type: string;
    createdAt: Timestamp;
}

type CompareMode = 'none' | 'lastWeek' | 'lastMonth' | 'lastYear';

export default function StatisticsPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [orders, setOrders] = useState<Order[]>([]);
    const [businesses, setBusinesses] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<string>('all');
    // Custom date range
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    // Comparison mode
    const [compareMode, setCompareMode] = useState<CompareMode>('none');
    // Global business filter for super admin
    const [businessFilter, setBusinessFilter] = useState<string>('all');

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

    // Auto-set business filter for non-super admins
    useEffect(() => {
        if (admin && admin.adminType !== 'super') {
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

    // Calculate date range based on filter
    const getDateRange = (filter: string, customStart?: string, customEnd?: string) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        let endDate = today;

        switch (filter) {
            case 'today':
                // startDate is already today at 00:00
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1); // Jan 1st of current year
                break;
            case 'custom':
                if (customStart) startDate = new Date(customStart);
                if (customEnd) {
                    endDate = new Date(customEnd);
                    endDate.setHours(23, 59, 59, 999);
                }
                break;
            case 'all':
            default:
                startDate = new Date(2020, 0, 1);
                break;
        }

        return { startDate, endDate };
    };

    // Calculate comparison date range
    const getComparisonDateRange = (filter: string, mode: CompareMode, customStart?: string, customEnd?: string) => {
        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);
        const duration = endDate.getTime() - startDate.getTime();

        let compStartDate = new Date(startDate);
        let compEndDate = new Date(endDate);

        switch (mode) {
            case 'lastWeek':
                compStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                compEndDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'lastMonth':
                compStartDate = new Date(startDate);
                compStartDate.setMonth(compStartDate.getMonth() - 1);
                compEndDate = new Date(endDate);
                compEndDate.setMonth(compEndDate.getMonth() - 1);
                break;
            case 'lastYear':
                compStartDate = new Date(startDate);
                compStartDate.setFullYear(compStartDate.getFullYear() - 1);
                compEndDate = new Date(endDate);
                compEndDate.setFullYear(compEndDate.getFullYear() - 1);
                break;
            default:
                return null;
        }

        return { startDate: compStartDate, endDate: compEndDate };
    };

    // Real-time orders subscription - load all orders for comparison support
    useEffect(() => {
        setLoading(true);

        // Always load from 2020 to support any comparison
        const q = query(
            collection(db, 'meat_orders'),
            where('createdAt', '>=', Timestamp.fromDate(new Date(2020, 0, 1))),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    businessId: d.butcherId || d.businessId || '',
                    businessName: d.butcherName || d.businessName || '',
                    items: d.items || [],
                    total: d.totalPrice || d.totalAmount || d.total || 0,
                    status: d.status || 'pending',
                    type: d.deliveryMethod || d.deliveryType || d.fulfillmentType || 'pickup',
                    createdAt: d.createdAt,
                };
            }) as Order[];
            setOrders(data);
            setLoading(false);
        }, (error) => {
            console.error('Error loading orders:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter orders by date range and business
    const { startDate: currentStart, endDate: currentEnd } = getDateRange(dateFilter, customStartDate, customEndDate);
    const filteredOrders = useMemo(() => {
        let filtered = orders.filter(o => {
            if (!o.createdAt) return false;
            const orderDate = o.createdAt.toDate();
            return orderDate >= currentStart && orderDate <= currentEnd;
        });
        if (businessFilter !== 'all') {
            filtered = filtered.filter(o => o.businessId === businessFilter);
        }
        return filtered;
    }, [orders, currentStart, currentEnd, businessFilter]);

    // Comparison orders
    const comparisonRange = getComparisonDateRange(dateFilter, compareMode, customStartDate, customEndDate);
    const comparisonOrders = useMemo(() => {
        if (!comparisonRange || compareMode === 'none') return [];
        let filtered = orders.filter(o => {
            if (!o.createdAt) return false;
            const orderDate = o.createdAt.toDate();
            return orderDate >= comparisonRange.startDate && orderDate <= comparisonRange.endDate;
        });
        if (businessFilter !== 'all') {
            filtered = filtered.filter(o => o.businessId === businessFilter);
        }
        return filtered;
    }, [orders, comparisonRange, compareMode, businessFilter]);

    // Format currency
    const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;

    // Calculate stats helper
    const calculateStats = (orderList: Order[]) => {
        const completed = orderList.filter(o => ['delivered', 'picked_up'].includes(o.status));
        return {
            total: orderList.length,
            completed: completed.length,
            cancelled: orderList.filter(o => o.status === 'cancelled').length,
            revenue: completed.reduce((sum, o) => sum + (o.total || 0), 0),
            avgOrderValue: completed.length > 0
                ? completed.reduce((sum, o) => sum + (o.total || 0), 0) / completed.length
                : 0,
        };
    };

    // Current period stats
    const stats = calculateStats(filteredOrders);
    const completedOrders = filteredOrders.filter(o => ['delivered', 'picked_up'].includes(o.status));

    // Comparison period stats
    const compStats = compareMode !== 'none' ? calculateStats(comparisonOrders) : null;

    // Calculate percentage change
    const getChange = (current: number, previous: number | undefined) => {
        if (!previous || previous === 0) return null;
        return ((current - previous) / previous) * 100;
    };

    const changes = compStats ? {
        total: getChange(stats.total, compStats.total),
        completed: getChange(stats.completed, compStats.completed),
        cancelled: getChange(stats.cancelled, compStats.cancelled),
        revenue: getChange(stats.revenue, compStats.revenue),
        avgOrderValue: getChange(stats.avgOrderValue, compStats.avgOrderValue),
    } : null;

    // Format change indicator
    const formatChange = (change: number | null | undefined) => {
        if (change === null || change === undefined) return null;
        const isPositive = change >= 0;
        const icon = isPositive ? '↑' : '↓';
        const color = isPositive ? 'text-green-400' : 'text-red-400';
        return (
            <span className={`text-xs ${color} ml-1`}>
                {icon} {Math.abs(change).toFixed(1)}%
            </span>
        );
    };

    // Advanced Analytics - All filtered by selected business
    const analytics = {
        // Orders by hour of day
        hourlyDistribution: Array(24).fill(0).map((_, hour) => ({
            hour,
            count: filteredOrders.filter(o => o.createdAt?.toDate().getHours() === hour).length,
            revenue: filteredOrders.filter(o => o.createdAt?.toDate().getHours() === hour)
                .reduce((sum, o) => sum + (o.total || 0), 0),
        })),

        // Orders by day of week
        dailyDistribution: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, idx) => ({
            day,
            count: filteredOrders.filter(o => o.createdAt?.toDate().getDay() === idx).length,
            revenue: filteredOrders.filter(o => o.createdAt?.toDate().getDay() === idx)
                .reduce((sum, o) => sum + (o.total || 0), 0),
        })),

        // Orders by type
        typeBreakdown: {
            pickup: filteredOrders.filter(o => o.type === 'pickup').length,
            delivery: filteredOrders.filter(o => o.type === 'delivery').length,
            dineIn: filteredOrders.filter(o => o.type === 'dine_in').length,
        },

        // Top products
        topProducts: (() => {
            const productCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
            filteredOrders.forEach(order => {
                order.items?.forEach(item => {
                    const key = item.name || item.productId;
                    if (!productCounts[key]) {
                        productCounts[key] = { name: item.name || 'Ürün', quantity: 0, revenue: 0 };
                    }
                    productCounts[key].quantity += item.quantity || 1;
                    productCounts[key].revenue += (item.price || 0) * (item.quantity || 1);
                });
            });
            return Object.values(productCounts)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);
        })(),

        // Business performance (only for super admin when viewing all)
        businessPerformance: (() => {
            const businessStats: Record<string, { id: string; name: string; orders: number; revenue: number; avgOrder: number }> = {};
            filteredOrders.forEach(order => {
                const id = order.businessId;
                if (!businessStats[id]) {
                    businessStats[id] = {
                        id,
                        name: businesses[id] || order.businessName || id,
                        orders: 0,
                        revenue: 0,
                        avgOrder: 0
                    };
                }
                businessStats[id].orders++;
                businessStats[id].revenue += order.total || 0;
            });
            Object.values(businessStats).forEach(b => {
                b.avgOrder = b.orders > 0 ? b.revenue / b.orders : 0;
            });
            return Object.values(businessStats).sort((a, b) => b.revenue - a.revenue);
        })(),

        peakHour: 0,
        slowestDay: '',
        busiestDay: '',
    };

    // Find peak hour
    const maxHourly = Math.max(...analytics.hourlyDistribution.map(h => h.count), 1);
    analytics.peakHour = analytics.hourlyDistribution.find(h => h.count === maxHourly)?.hour || 12;

    // Find busiest/slowest days
    const sortedDays = [...analytics.dailyDistribution].sort((a, b) => b.count - a.count);
    analytics.busiestDay = sortedDays[0]?.day || 'Cumartesi';
    analytics.slowestDay = sortedDays[sortedDays.length - 1]?.day || 'Pazartesi';

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            📊 İstatistikler
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Platform sipariş ve performans analitiği
                        </p>
                    </div>
                </div>
            </div>

            {/* Global Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-gray-800 rounded-xl p-4 space-y-4">
                    {/* First Row - Date & Business Filters */}
                    <div className="flex flex-wrap gap-4 items-center">
                        {/* Date Filter */}
                        <select
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                if (e.target.value === 'custom') {
                                    setShowCustomDatePicker(true);
                                }
                            }}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                        >
                            <option value="today">📅 Bugün</option>
                            <option value="week">📅 Bu Hafta</option>
                            <option value="month">📅 Bu Ay</option>
                            <option value="year">📅 Bu Yıl</option>
                            <option value="custom">📅 Özel Tarih Aralığı</option>
                            <option value="all">📅 Tümü</option>
                        </select>

                        {/* Custom Date Picker */}
                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-600">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    max={customEndDate || new Date().toISOString().split('T')[0]}
                                    className="bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600"
                                />
                                <span className="text-gray-400">→</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    min={customStartDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600"
                                />
                            </div>
                        )}

                        {/* Comparison Mode */}
                        <select
                            value={compareMode}
                            onChange={(e) => setCompareMode(e.target.value as CompareMode)}
                            className="px-4 py-2 bg-purple-700/50 text-white rounded-lg border border-purple-500"
                        >
                            <option value="none">📊 Karşılaştırma Yok</option>
                            <option value="lastWeek">📊 Geçen Hafta ile</option>
                            <option value="lastMonth">📊 Geçen Ay ile</option>
                            <option value="lastYear">📊 Geçen Yıl ile</option>
                        </select>

                        {/* Business Filter - Only for Super Admin */}
                        {admin?.adminType === 'super' && (
                            <select
                                value={businessFilter}
                                onChange={(e) => setBusinessFilter(e.target.value)}
                                className="px-4 py-2 bg-emerald-700 text-white rounded-lg border border-emerald-500 font-medium"
                            >
                                <option value="all">🏪 Tüm İşletmeler</option>
                                {Object.entries(businesses).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        )}

                        {/* Selected Business Badge */}
                        {businessFilter !== 'all' && (
                            <div className="flex items-center gap-2 bg-emerald-600/30 border border-emerald-500 px-3 py-2 rounded-lg">
                                <span className="text-emerald-300 text-sm">
                                    📍 {businesses[businessFilter] || businessFilter}
                                </span>
                                {admin?.adminType === 'super' && (
                                    <button
                                        onClick={() => setBusinessFilter('all')}
                                        className="text-emerald-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Comparison Period Info */}
                    {compareMode !== 'none' && comparisonRange && (
                        <div className="flex items-center gap-3 px-3 py-2 bg-purple-900/30 border border-purple-600 rounded-lg">
                            <span className="text-purple-300 text-sm">
                                📊 Karşılaştırma Dönemi: {comparisonRange.startDate.toLocaleDateString('tr-TR')} - {comparisonRange.endDate.toLocaleDateString('tr-TR')}
                            </span>
                            <span className="text-gray-400 text-sm">
                                ({comparisonOrders.length} sipariş)
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="max-w-7xl mx-auto bg-gray-800 rounded-xl p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-400 mt-4">Veriler yükleniyor...</p>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-blue-400">
                                {stats.total}
                                {changes && formatChange(changes.total)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Toplam Sipariş</p>
                            {compStats && (
                                <p className="text-xs text-gray-500">Önceki: {compStats.total}</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-green-400">
                                {formatCurrency(stats.revenue)}
                                {changes && formatChange(changes.revenue)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Toplam Ciro</p>
                            {compStats && (
                                <p className="text-xs text-gray-500">Önceki: {formatCurrency(compStats.revenue)}</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-purple-400">
                                {formatCurrency(stats.avgOrderValue)}
                                {changes && formatChange(changes.avgOrderValue)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Ort. Sipariş</p>
                            {compStats && (
                                <p className="text-xs text-gray-500">Önceki: {formatCurrency(compStats.avgOrderValue)}</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-400">
                                {stats.completed}
                                {changes && formatChange(changes.completed)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Tamamlanan</p>
                            {compStats && (
                                <p className="text-xs text-gray-500">Önceki: {compStats.completed}</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-red-400">
                                {stats.cancelled}
                                {changes && formatChange(changes.cancelled)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">İptal</p>
                            {compStats && (
                                <p className="text-xs text-gray-500">Önceki: {compStats.cancelled}</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-orange-400">{analytics.peakHour}:00</p>
                            <p className="text-xs text-gray-400 mt-1">En Yoğun Saat</p>
                        </div>
                    </div>

                    {/* Insights Row */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-xl p-4">
                            <p className="text-green-400 text-sm font-medium mb-1">🔥 En Yoğun Gün</p>
                            <p className="text-white text-xl font-bold">{analytics.busiestDay}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl p-4">
                            <p className="text-blue-400 text-sm font-medium mb-1">😴 En Durgun Gün</p>
                            <p className="text-white text-xl font-bold">{analytics.slowestDay}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/30 rounded-xl p-4">
                            <p className="text-purple-400 text-sm font-medium mb-1">🚚 Teslimat Oranı</p>
                            <p className="text-white text-xl font-bold">
                                {filteredOrders.length > 0 ? Math.round((analytics.typeBreakdown.delivery / filteredOrders.length) * 100) : 0}% Kurye
                            </p>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Hourly Distribution */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="text-white font-bold mb-4">🕐 Saatlik Sipariş Dağılımı</h3>
                            <div className="flex items-end gap-1 h-40">
                                {analytics.hourlyDistribution.slice(8, 22).map((h) => {
                                    const maxCount = Math.max(...analytics.hourlyDistribution.map(h => h.count), 1);
                                    const height = (h.count / maxCount) * 100;
                                    return (
                                        <div key={h.hour} className="flex-1 flex flex-col items-center">
                                            <div
                                                className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition cursor-pointer"
                                                style={{ height: `${Math.max(height, 4)}%` }}
                                                title={`${h.hour}:00 - ${h.count} sipariş, ${formatCurrency(h.revenue)}`}
                                            />
                                            <span className="text-[10px] text-gray-500 mt-1">{h.hour}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Daily Distribution */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="text-white font-bold mb-4">📅 Günlük Sipariş Dağılımı</h3>
                            <div className="space-y-2">
                                {analytics.dailyDistribution.map((d) => {
                                    const maxCount = Math.max(...analytics.dailyDistribution.map(d => d.count), 1);
                                    const width = (d.count / maxCount) * 100;
                                    return (
                                        <div key={d.day} className="flex items-center gap-3">
                                            <span className="text-gray-400 text-sm w-20">{d.day.slice(0, 3)}</span>
                                            <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            <span className="text-white font-medium w-12 text-right">{d.count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Tables Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Top Products */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="text-white font-bold mb-4">🏆 En Çok Satan Ürünler</h3>
                            {analytics.topProducts.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Ürün verisi bulunamadı</p>
                            ) : (
                                <div className="space-y-2">
                                    {analytics.topProducts.slice(0, 5).map((p, idx) => (
                                        <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-lg ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                </span>
                                                <span className="text-white">{p.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-green-400 font-medium">{formatCurrency(p.revenue)}</p>
                                                <p className="text-xs text-gray-500">{p.quantity} adet</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Business Performance - ONLY for Super Admin when viewing all businesses */}
                        {admin?.adminType === 'super' && (
                            <div className="bg-gray-800 rounded-xl p-6">
                                <h3 className="text-white font-bold mb-4">🏪 İşletme Performansı</h3>
                                {analytics.businessPerformance.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">İşletme verisi bulunamadı</p>
                                ) : (
                                    <div className="space-y-2">
                                        {analytics.businessPerformance.slice(0, 5).map((b) => (
                                            <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                                                <div>
                                                    <p className="text-white font-medium">{b.name}</p>
                                                    <p className="text-xs text-gray-500">{b.orders} sipariş</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-green-400 font-bold">{formatCurrency(b.revenue)}</p>
                                                    <p className="text-xs text-gray-500">Ort: {formatCurrency(b.avgOrder)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
