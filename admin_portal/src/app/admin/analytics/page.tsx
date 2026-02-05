'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'lastYear' | 'all';

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

interface UserStats {
    total: number;
    new: number;
    admins: number;
    customers: number;
    owners: number;
    staff: number;
    superAdmins: number;
}

interface BusinessStats {
    total: number;
    active: number;
    byType: Record<string, number>;
}

export default function UnifiedAnalyticsPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();

    // Filters
    const [dateFilter, setDateFilter] = useState<DateFilter>('month');
    const [businessFilter, setBusinessFilter] = useState<string>('all');

    // Data
    const [orders, setOrders] = useState<Order[]>([]);
    const [businesses, setBusinesses] = useState<Record<string, string>>({});
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);
    const [masterProductCount, setMasterProductCount] = useState(0);
    const [technicalMetrics, setTechnicalMetrics] = useState<{
        firestoreReads: number;
        firestoreWrites: number;
        firestoreStorage: number;
        functionsInvocations: number;
        storageBandwidth: number;
        storageSize: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Get date range based on filter
    const getDateRange = (filter: DateFilter) => {
        const now = new Date();
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        let start = new Date(now);
        start.setHours(0, 0, 0, 0);

        switch (filter) {
            case 'today':
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start.setDate(start.getDate() - 30);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                break;
            case 'lastYear':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end.setFullYear(now.getFullYear() - 1, 11, 31);
                break;
            case 'all':
                start = new Date(2020, 0, 1);
                break;
        }
        return { start, end };
    };

    const getDateLabel = () => {
        switch (dateFilter) {
            case 'today': return 'Bugün';
            case 'yesterday': return 'Dün';
            case 'week': return 'Son 7 Gün';
            case 'month': return 'Son 30 Gün';
            case 'year': return `Bu Yıl (${new Date().getFullYear()})`;
            case 'lastYear': return `Geçen Yıl (${new Date().getFullYear() - 1})`;
            case 'all': return 'Tüm Zamanlar';
            default: return 'Son 30 Gün';
        }
    };

    // Load businesses
    useEffect(() => {
        const loadBusinesses = async () => {
            const snapshot = await getDocs(collection(db, 'businesses'));
            const map: Record<string, string> = {};
            const statsMap: Record<string, number> = {};
            let activeCount = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                map[doc.id] = data.companyName || doc.id;
                const type = data.businessType || data.type || 'other';
                statsMap[type] = (statsMap[type] || 0) + 1;
                if (data.isActive !== false) activeCount++;
            });

            setBusinesses(map);
            setBusinessStats({
                total: snapshot.size,
                active: activeCount,
                byType: statsMap
            });
        };
        loadBusinesses();
    }, []);

    // Load users & admins
    useEffect(() => {
        const loadUsers = async () => {
            const { start, end } = getDateRange(dateFilter);

            const usersSnap = await getDocs(collection(db, 'users'));
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const newUsers = allUsers.filter((u: any) => {
                if (!u.createdAt) return false;
                const created = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                return created >= start && created <= end;
            });

            const adminsSnap = await getDocs(collection(db, 'admins'));
            const adminsData = adminsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const adminIds = new Set(adminsData.map((a: any) => a.firebaseUid || a.id));

            const owners = adminsData.filter((a: any) => a.role === 'owner' || a.isPrimaryAdmin === true);
            const staff = adminsData.filter((a: any) => a.role === 'staff' || (a.role !== 'owner' && !a.isPrimaryAdmin && a.adminType !== 'super'));
            const superAdmins = adminsData.filter((a: any) => a.adminType === 'super');

            setUserStats({
                total: allUsers.length,
                new: newUsers.length,
                admins: adminsSnap.size,
                customers: allUsers.length - adminIds.size,
                owners: owners.length,
                staff: staff.length,
                superAdmins: superAdmins.length,
            });
        };
        loadUsers();
    }, [dateFilter]);

    // Load master products count
    useEffect(() => {
        const loadProducts = async () => {
            const snap = await getDocs(collection(db, 'master_products'));
            setMasterProductCount(snap.size);
        };
        loadProducts();
    }, []);

    // Fetch Cloud Monitoring metrics
    useEffect(() => {
        const fetchTechnicalMetrics = async () => {
            try {
                const response = await fetch('/api/metrics');
                if (response.ok) {
                    const data = await response.json();
                    setTechnicalMetrics({
                        firestoreReads: data.firestore?.reads?.today || 0,
                        firestoreWrites: data.firestore?.writes?.today || 0,
                        firestoreStorage: data.firestore?.storage?.current || 0,
                        functionsInvocations: data.functions?.invocations?.monthly || 0,
                        storageBandwidth: data.storage?.bandwidth?.monthly || 0,
                        storageSize: data.storage?.totalSize?.current || 0,
                    });
                }
            } catch (error) {
                console.error('Error fetching technical metrics:', error);
            }
        };
        fetchTechnicalMetrics();
        // Refresh every 5 minutes
        const interval = setInterval(fetchTechnicalMetrics, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Real-time orders subscription
    useEffect(() => {
        setLoading(true);
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
            setLastUpdate(new Date());
        });

        return () => unsubscribe();
    }, []);

    // Filter orders by date and business
    const { start: currentStart, end: currentEnd } = getDateRange(dateFilter);
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

    // Calculate stats
    const stats = useMemo(() => {
        const completed = filteredOrders.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));
        return {
            total: filteredOrders.length,
            completed: completed.length,
            cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
            revenue: completed.reduce((sum, o) => sum + (o.total || 0), 0),
            avgOrderValue: completed.length > 0
                ? completed.reduce((sum, o) => sum + (o.total || 0), 0) / completed.length
                : 0,
        };
    }, [filteredOrders]);

    // Analytics calculations
    const analytics = useMemo(() => {
        const hourlyDistribution = Array(24).fill(0).map((_, hour) => ({
            hour,
            count: filteredOrders.filter(o => o.createdAt?.toDate().getHours() === hour).length,
        }));

        const dailyDistribution = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'].map((day, idx) => ({
            day,
            count: filteredOrders.filter(o => o.createdAt?.toDate().getDay() === idx).length,
        }));

        const typeBreakdown = {
            pickup: filteredOrders.filter(o => o.type === 'pickup').length,
            delivery: filteredOrders.filter(o => o.type === 'delivery').length,
        };

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
        const topProducts = Object.values(productCounts).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

        const businessPerfMap: Record<string, { id: string; name: string; orders: number; revenue: number }> = {};
        filteredOrders.forEach(order => {
            const id = order.businessId;
            if (!businessPerfMap[id]) {
                businessPerfMap[id] = { id, name: businesses[id] || order.businessName || id, orders: 0, revenue: 0 };
            }
            businessPerfMap[id].orders++;
            businessPerfMap[id].revenue += order.total || 0;
        });
        const businessPerformance = Object.values(businessPerfMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        const maxHourly = Math.max(...hourlyDistribution.map(h => h.count), 1);
        const peakHour = hourlyDistribution.find(h => h.count === maxHourly)?.hour || 12;
        const sortedDays = [...dailyDistribution].sort((a, b) => b.count - a.count);
        const busiestDay = sortedDays[0]?.day || 'Cmt';
        const slowestDay = sortedDays[sortedDays.length - 1]?.day || 'Paz';
        const deliveryRate = filteredOrders.length > 0 ? Math.round((typeBreakdown.delivery / filteredOrders.length) * 100) : 0;

        return { hourlyDistribution, dailyDistribution, topProducts, businessPerformance, peakHour, busiestDay, slowestDay, deliveryRate };
    }, [filteredOrders, businesses]);

    // Auth check
    useEffect(() => {
        if (!adminLoading && !admin) router.push('/login');
    }, [admin, adminLoading, router]);

    useEffect(() => {
        if (!adminLoading && admin && admin.adminType !== 'super') router.push('/admin/dashboard');
    }, [admin, adminLoading, router]);

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!admin || admin.adminType !== 'super') return null;

    const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;

    return (
        <div className="min-h-screen bg-gray-900">
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">📊 Platform Analitik</h1>
                        <p className="text-gray-400 text-sm">
                            {lastUpdate && `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}`}
                        </p>
                    </div>
                    <button
                        onClick={() => setLastUpdate(new Date())}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium"
                    >
                        🔄 Yenile
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-xl p-4 mb-6">
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Date Filters */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'today', label: 'Bugün' },
                                { value: 'yesterday', label: 'Dün' },
                                { value: 'week', label: '7 Gün' },
                                { value: 'month', label: '30 Gün' },
                                { value: 'year', label: 'Bu Yıl' },
                                { value: 'all', label: 'Tümü' },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    onClick={() => setDateFilter(item.value as DateFilter)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateFilter === item.value
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Business Filter */}
                        <select
                            value={businessFilter}
                            onChange={(e) => setBusinessFilter(e.target.value)}
                            className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg border border-emerald-500 text-sm"
                        >
                            <option value="all">🏪 Tüm İşletmeler</option>
                            {Object.entries(businesses).map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Main Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-3 border border-blue-700/50">
                        <p className="text-2xl font-bold text-blue-400">{userStats?.total || 0}</p>
                        <p className="text-xs text-gray-400">Kullanıcı</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-3 border border-green-700/50">
                        <p className="text-2xl font-bold text-green-400">+{userStats?.new || 0}</p>
                        <p className="text-xs text-gray-400">Yeni Kayıt</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-3 border border-purple-700/50">
                        <p className="text-2xl font-bold text-purple-400">{businessStats?.total || 0}</p>
                        <p className="text-xs text-gray-400">İşletme</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-xl p-3 border border-orange-700/50">
                        <p className="text-2xl font-bold text-orange-400">{stats.total}</p>
                        <p className="text-xs text-gray-400">Sipariş</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 rounded-xl p-3 border border-emerald-700/50">
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.revenue)}</p>
                        <p className="text-xs text-gray-400">Ciro</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 rounded-xl p-3 border border-cyan-700/50">
                        <p className="text-2xl font-bold text-cyan-400">{formatCurrency(stats.avgOrderValue)}</p>
                        <p className="text-xs text-gray-400">Ort. Sipariş</p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 rounded-xl p-3 border border-pink-700/50">
                        <p className="text-2xl font-bold text-pink-400">{masterProductCount}</p>
                        <p className="text-xs text-gray-400">Ürün</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 rounded-xl p-3 border border-red-700/50">
                        <p className="text-2xl font-bold text-red-400">{stats.cancelled}</p>
                        <p className="text-xs text-gray-400">İptal</p>
                    </div>
                </div>

                {/* Insights Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-xl p-3">
                        <p className="text-green-400 text-xs font-medium mb-1">🔥 En Yoğun Gün</p>
                        <p className="text-white text-lg font-bold">{analytics.busiestDay}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl p-3">
                        <p className="text-blue-400 text-xs font-medium mb-1">😴 En Durgun Gün</p>
                        <p className="text-white text-lg font-bold">{analytics.slowestDay}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 border border-orange-700/30 rounded-xl p-3">
                        <p className="text-orange-400 text-xs font-medium mb-1">⏰ En Yoğun Saat</p>
                        <p className="text-white text-lg font-bold">{analytics.peakHour}:00</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/30 rounded-xl p-3">
                        <p className="text-purple-400 text-xs font-medium mb-1">🚚 Teslimat Oranı</p>
                        <p className="text-white text-lg font-bold">{analytics.deliveryRate}% Kurye</p>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Hourly Distribution */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">🕐 Saatlik Dağılım</h3>
                        <div className="flex items-end gap-1 h-24">
                            {analytics.hourlyDistribution.slice(8, 22).map((h) => {
                                const maxCount = Math.max(...analytics.hourlyDistribution.map(h => h.count), 1);
                                const height = (h.count / maxCount) * 100;
                                return (
                                    <div key={h.hour} className="flex-1 flex flex-col items-center">
                                        <div
                                            className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition cursor-pointer"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                            title={`${h.hour}:00 - ${h.count} sipariş`}
                                        />
                                        <span className="text-[9px] text-gray-500 mt-1">{h.hour}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Daily Distribution */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">📅 Günlük Dağılım</h3>
                        <div className="space-y-1.5">
                            {analytics.dailyDistribution.map((d) => {
                                const maxCount = Math.max(...analytics.dailyDistribution.map(d => d.count), 1);
                                const width = (d.count / maxCount) * 100;
                                return (
                                    <div key={d.day} className="flex items-center gap-2">
                                        <span className="text-gray-400 text-xs w-8">{d.day}</span>
                                        <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: `${width}%` }} />
                                        </div>
                                        <span className="text-white font-medium w-8 text-right text-sm">{d.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Details Row */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* User Breakdown */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">👥 Kullanıcı Dağılımı</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-400">Müşteriler</span><span className="text-blue-400 font-bold">{userStats?.customers}</span></div>
                            <div className="border-t border-gray-700 pt-2">
                                <div className="flex justify-between"><span className="text-gray-400">👑 Super Admin</span><span className="text-red-400 font-bold">{userStats?.superAdmins}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">🏪 İşletme Sahibi</span><span className="text-orange-400 font-bold">{userStats?.owners}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">👤 Personel</span><span className="text-purple-400 font-bold">{userStats?.staff}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Business Types */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">🏪 İşletme Türleri</h3>
                        <div className="space-y-2 text-sm">
                            {businessStats && Object.entries(businessStats.byType).slice(0, 5).map(([type, count]) => (
                                <div key={type} className="flex justify-between">
                                    <span className="text-gray-400 capitalize">{type}</span>
                                    <span className="text-cyan-400 font-bold">{count}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-700 pt-2">
                                <div className="flex justify-between"><span className="text-gray-300">Aktif</span><span className="text-green-400 font-bold">{businessStats?.active}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">🏆 En Çok Satan</h3>
                        <div className="space-y-2 text-sm">
                            {analytics.topProducts.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">Veri yok</p>
                            ) : analytics.topProducts.slice(0, 4).map((p, idx) => (
                                <div key={p.name} className="flex justify-between items-center">
                                    <span className="text-gray-400 truncate max-w-[60%]">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`} {p.name}
                                    </span>
                                    <span className="text-green-400 font-bold">{formatCurrency(p.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Business Performance */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">📈 İşletme Performansı</h3>
                        <div className="space-y-2 text-sm">
                            {analytics.businessPerformance.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">Veri yok</p>
                            ) : analytics.businessPerformance.slice(0, 4).map((b) => (
                                <div key={b.id} className="flex justify-between items-center">
                                    <div className="truncate max-w-[60%]">
                                        <p className="text-gray-300 truncate">{b.name}</p>
                                        <p className="text-xs text-gray-500">{b.orders} sipariş</p>
                                    </div>
                                    <span className="text-emerald-400 font-bold">{formatCurrency(b.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Technical Metrics - Cloud Monitoring */}
                {technicalMetrics && (
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-white mb-4">🔧 Teknik Metrikler (Cloud Monitoring)</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                <p className="text-xl font-bold text-white">{technicalMetrics.firestoreReads.toLocaleString()}</p>
                                <p className="text-xs text-gray-400">Firestore Reads</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                <p className="text-xl font-bold text-white">{technicalMetrics.firestoreWrites.toLocaleString()}</p>
                                <p className="text-xs text-gray-400">Firestore Writes</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                <p className="text-xl font-bold text-white">{technicalMetrics.firestoreStorage} GB</p>
                                <p className="text-xs text-gray-400">Firestore Storage</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                <p className="text-xl font-bold text-white">{technicalMetrics.functionsInvocations.toLocaleString()}</p>
                                <p className="text-xs text-gray-400">Functions Çağrısı</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                <p className="text-xl font-bold text-white">{technicalMetrics.storageBandwidth} GB</p>
                                <p className="text-xs text-gray-400">Storage Bandwidth</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                <p className="text-xl font-bold text-white">{technicalMetrics.storageSize} GB</p>
                                <p className="text-xs text-gray-400">Storage Boyutu</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3">
                    <p className="text-yellow-400 text-xs">
                        💡 Gösterilen dönem: <strong>{getDateLabel()}</strong> |
                        Veriler Firestore'dan gerçek zamanlı çekilmektedir.
                    </p>
                </div>
            </main>
        </div>
    );
}
