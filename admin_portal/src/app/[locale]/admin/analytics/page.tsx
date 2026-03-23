'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';
import { useOrdersStandalone, Order } from '@/hooks/useOrders';

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'lastYear' | 'all';

// Order type is now imported from @/hooks/useOrders (canonical)

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

    const t = useTranslations('AdminAnalytics');
    const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();

    // Filters
    const [dateFilter, setDateFilter] = useState<DateFilter>('month');
    const [businessFilter, setBusinessFilter] = useState<string>('all');

    // Orders from unified hook (single Firestore listener)
    const { orders, loading: ordersLoading } = useOrdersStandalone({ initialDateFilter: 'all' });

    // Data
    const [businesses, setBusinesses] = useState<Record<string, string>>({});
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);
    const [masterProductCount, setMasterProductCount] = useState(0);
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
            case 'today': return t('bugun');
            case 'yesterday': return t('dun');
            case 'week': return t('son_7_gun');
            case 'month': return t('son_30_gun');
            case 'year': return `${t('bu_yil')} (${new Date().getFullYear()})`;
            case 'lastYear': return `${new Date().getFullYear() - 1}`;
            case 'all': return t('tum_zamanlar');
            default: return t('son_30_gun');
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

    // Orders are now provided by useOrdersStandalone hook (canonical field mapping)
    // Update loading/lastUpdate based on hook state
    useEffect(() => {
        if (!ordersLoading) {
            setLoading(false);
            setLastUpdate(new Date());
        }
    }, [ordersLoading]);

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

        const dailyDistribution = [t('paz'), t('pzt'), t('sal'), t('car'), t('per'), t('cum'), t('cmt')].map((day, idx) => ({
            day,
            count: filteredOrders.filter(o => o.createdAt?.toDate().getDay() === idx).length,
        }));

        const typeBreakdown = {
            pickup: filteredOrders.filter(o => o.type === 'pickup' || o.type === 'gelAl').length,
            delivery: filteredOrders.filter(o => o.type === 'delivery' || o.type === 'kurye').length,
            dineIn: filteredOrders.filter(o => o.type === 'dineIn' || o.type === 'masa').length,
        };

        const productCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
        filteredOrders.forEach(order => {
            order.items?.forEach((item: any) => {
                const itemName = item.productName || item.name || '';
                if (!itemName) return; // Skip items with no name
                const key = itemName;
                if (!productCounts[key]) {
                    productCounts[key] = { name: itemName, quantity: 0, revenue: 0 };
                }
                productCounts[key].quantity += item.quantity || 1;
                productCounts[key].revenue += (item.totalPrice || item.price || 0) * (item.quantity || 1);
            });
        });
        const topProducts = Object.values(productCounts)
            .filter(p => p.name && p.name !== t('urun'))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

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
        const deliveryRaw = filteredOrders.length > 0 ? (typeBreakdown.delivery / filteredOrders.length) * 100 : 0;
        const dineInRaw = filteredOrders.length > 0 ? (typeBreakdown.dineIn / filteredOrders.length) * 100 : 0;
        const pickupRaw = filteredOrders.length > 0 ? (typeBreakdown.pickup / filteredOrders.length) * 100 : 0;
        // Ensure rates always total 100% by distributing rounding remainder
        let deliveryRate = Math.round(deliveryRaw);
        let dineInRate = Math.round(dineInRaw);
        let pickupRate = Math.round(pickupRaw);
        if (filteredOrders.length > 0) {
            const sum = deliveryRate + dineInRate + pickupRate;
            if (sum !== 100) {
                const diff = 100 - sum;
                // Add the difference to the largest category
                if (deliveryRate >= dineInRate && deliveryRate >= pickupRate) deliveryRate += diff;
                else if (dineInRate >= deliveryRate && dineInRate >= pickupRate) dineInRate += diff;
                else pickupRate += diff;
            }
        }

        return { hourlyDistribution, dailyDistribution, topProducts, businessPerformance, peakHour, busiestDay, slowestDay, deliveryRate, dineInRate, pickupRate };
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

    const formatCurrency = (amount: number, currencyCode?: string) => globalFormatCurrency(amount, currencyCode);

    return (
        <div className="min-h-screen bg-gray-900">
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
                        <p className="text-gray-400 text-sm">
                            {lastUpdate && `${t('son_guncelleme')}: ${lastUpdate.toLocaleTimeString()}`}
                        </p>
                    </div>
                    <button
                        onClick={() => setLastUpdate(new Date())}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition flex items-center gap-2 text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('yenile') || 'Yenile'}
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 rounded-xl p-4 mb-6">
                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Date Filters */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'today', label: t('bugun') },
                                { value: 'yesterday', label: t('dun') },
                                { value: 'week', label: t('7_gun') },
                                { value: 'month', label: t('30_gun') },
                                { value: 'year', label: t('bu_yil') },
                                { value: 'all', label: t('tumu') },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    onClick={() => setDateFilter(item.value as DateFilter)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateFilter === item.value
                                        ? 'bg-amber-600 text-white'
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
                            <option value="all">{t('tum_i_sletmeler')}</option>
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
                        <p className="text-xs text-gray-400">{t('kullanici')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-3 border border-green-700/50">
                        <p className="text-2xl font-bold text-green-400">+{userStats?.new || 0}</p>
                        <p className="text-xs text-gray-400">{t('yeni_kayit')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-3 border border-purple-700/50">
                        <p className="text-2xl font-bold text-purple-400">{businessStats?.total || 0}</p>
                        <p className="text-xs text-gray-400">{t('i_sletme')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 rounded-xl p-3 border border-amber-700/50">
                        <p className="text-2xl font-bold text-amber-400">{stats.total}</p>
                        <p className="text-xs text-gray-400">{t('siparis')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 rounded-xl p-3 border border-emerald-700/50">
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.revenue)}</p>
                        <p className="text-xs text-gray-400">{t('revenue')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 rounded-xl p-3 border border-cyan-700/50">
                        <p className="text-2xl font-bold text-cyan-400">{formatCurrency(stats.avgOrderValue)}</p>
                        <p className="text-xs text-gray-400">{t('ort_siparis')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 rounded-xl p-3 border border-pink-700/50">
                        <p className="text-2xl font-bold text-pink-400">{masterProductCount}</p>
                        <p className="text-xs text-gray-400">{t('urun')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 rounded-xl p-3 border border-red-700/50">
                        <p className="text-2xl font-bold text-red-400">{stats.cancelled}</p>
                        <p className="text-xs text-gray-400">{t('cancellation')}</p>
                    </div>
                </div>

                {/* Insights Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-xl p-3">
                        <p className="text-green-400 text-xs font-medium mb-1">{t('en_yogun_gun')}</p>
                        <p className="text-white text-lg font-bold">{analytics.busiestDay}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl p-3">
                        <p className="text-blue-400 text-xs font-medium mb-1">{t('en_durgun_gun')}</p>
                        <p className="text-white text-lg font-bold">{analytics.slowestDay}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 border border-amber-700/30 rounded-xl p-3">
                        <p className="text-amber-400 text-xs font-medium mb-1">{t('en_yogun_saat')}</p>
                        <p className="text-white text-lg font-bold">{analytics.peakHour}:00</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/30 rounded-xl p-3">
                        <p className="text-purple-400 text-xs font-medium mb-1">{t('siparis_orani')}</p>
                        <p className="text-white text-sm font-bold">{analytics.deliveryRate}% {t('kurye_label')} | {analytics.dineInRate}% {t('masa_label')} | {analytics.pickupRate}% {t('gel_al_label')}</p>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Hourly Distribution */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">{t('saatlik_dagilim')}</h3>
                        {(() => {
                            const hourData = analytics.hourlyDistribution.slice(8, 22);
                            const maxCount = Math.max(...hourData.map(h => h.count), 1);
                            const chartH = 80;
                            return (
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${chartH + 20}px`, paddingTop: '8px' }}>
                                    {hourData.map((h) => {
                                        const barH = h.count > 0 ? Math.max((h.count / maxCount) * chartH, 4) : 2;
                                        return (
                                            <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                                {h.count > 0 && (
                                                    <span style={{ fontSize: '8px', color: '#93c5fd', fontWeight: 600, marginBottom: '1px' }}>{h.count}</span>
                                                )}
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        height: `${barH}px`,
                                                        borderRadius: '3px 3px 0 0',
                                                        background: h.count > 0 ? '#3b82f6' : '#374151',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s',
                                                    }}
                                                    title={`${h.hour}:00 - ${h.count} ${t('siparis')}`}
                                                    onMouseEnter={e => { if (h.count > 0) (e.target as HTMLDivElement).style.background = '#60a5fa'; }}
                                                    onMouseLeave={e => { if (h.count > 0) (e.target as HTMLDivElement).style.background = '#3b82f6'; }}
                                                />
                                                <span style={{ fontSize: '9px', color: '#6b7280', marginTop: '1px' }}>{h.hour}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Daily Distribution */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">{t('gunluk_dagilim')}</h3>
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
                        <h3 className="text-white font-bold mb-3 text-sm">{t('kullanici_dagilimi')}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-400">{t('musteriler')}</span><span className="text-blue-400 font-bold">{userStats?.customers}</span></div>
                            <div className="border-t border-gray-700 pt-2">
                                <div className="flex justify-between"><span className="text-gray-400">👑 Super Admin</span><span className="text-red-400 font-bold">{userStats?.superAdmins}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">{t('i_sletme_sahibi')}</span><span className="text-amber-400 font-bold">{userStats?.owners}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">&#x1f464; {t('personel') || 'Personel'}</span><span className="text-purple-400 font-bold">{userStats?.staff}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Business Types */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">{t('i_sletme_turleri')}</h3>
                        {businessStats && (() => {
                            // Group business types into Yemek (Food) and Market categories
                            const yemekTypes = ['restoran', 'restaurant', 'firin', 'cigkofte', 'doener', 'pizza', 'cafe', 'baeckerei', 'kebap', 'lokanta'];
                            const marketTypes = ['market', 'kasap', 'metzgerei', 'supermarkt', 'online_shop', 'bakliyat', 'kuruyemis', 'sarkuteri', 'manav'];
                            
                            let yemekCount = 0;
                            let marketCount = 0;
                            const yemekSubs: [string, number][] = [];
                            const marketSubs: [string, number][] = [];
                            const otherSubs: [string, number][] = [];

                            Object.entries(businessStats.byType).forEach(([type, count]) => {
                                const lower = type.toLowerCase();
                                if (yemekTypes.some(yt => lower.includes(yt))) {
                                    yemekCount += count;
                                    yemekSubs.push([type, count]);
                                } else if (marketTypes.some(mt => lower.includes(mt))) {
                                    marketCount += count;
                                    marketSubs.push([type, count]);
                                } else {
                                    // Default to Yemek for unknown types
                                    yemekCount += count;
                                    yemekSubs.push([type, count]);
                                }
                            });

                            return (
                                <div className="space-y-2 text-sm">
                                    {/* Yemek */}
                                    <details className="group">
                                        <summary className="flex justify-between cursor-pointer list-none">
                                            <span className="text-orange-400 font-medium flex items-center gap-1">🍽 {t('yemek_segmenti') || 'Yemek'}</span>
                                            <span className="text-orange-400 font-bold">{yemekCount}</span>
                                        </summary>
                                        <div className="pl-4 mt-1 space-y-1 border-l border-gray-700 ml-2">
                                            {yemekSubs.sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                                <div key={type} className="flex justify-between">
                                                    <span className="text-gray-400 capitalize">{type}</span>
                                                    <span className="text-cyan-400 font-bold">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                    {/* Market */}
                                    <details className="group">
                                        <summary className="flex justify-between cursor-pointer list-none">
                                            <span className="text-green-400 font-medium flex items-center gap-1">🛒 {t('market_segmenti') || 'Market'}</span>
                                            <span className="text-green-400 font-bold">{marketCount}</span>
                                        </summary>
                                        <div className="pl-4 mt-1 space-y-1 border-l border-gray-700 ml-2">
                                            {marketSubs.sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                                <div key={type} className="flex justify-between">
                                                    <span className="text-gray-400 capitalize">{type}</span>
                                                    <span className="text-cyan-400 font-bold">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                    <div className="border-t border-gray-700 pt-2">
                                        <div className="flex justify-between"><span className="text-gray-300">{t('aktif')}</span><span className="text-green-400 font-bold">{businessStats?.active}</span></div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Top Products */}
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-bold mb-3 text-sm">{t('en_cok_satan')}</h3>
                        <div className="space-y-2 text-sm">
                            {analytics.topProducts.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">{t('veri_yok')}</p>
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
                        <h3 className="text-white font-bold mb-3 text-sm">{t('i_sletme_performansi')}</h3>
                        <div className="space-y-2 text-sm">
                            {analytics.businessPerformance.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">{t('veri_yok')}</p>
                            ) : analytics.businessPerformance.slice(0, 4).map((b) => (
                                <div key={b.id} className="flex justify-between items-center">
                                    <div className="truncate max-w-[60%]">
                                        <p className="text-gray-300 truncate">{b.name}</p>
                                        <p className="text-xs text-gray-500">{b.orders} {t('siparis')}</p>
                                    </div>
                                    <span className="text-emerald-400 font-bold">{formatCurrency(b.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Platform Özeti */}
                {(() => {
                    const completedOrders = filteredOrders.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));
                    const completionRate = filteredOrders.length > 0 ? Math.round((completedOrders.length / filteredOrders.length) * 100) : 0;
                    const { start: rangeStart, end: rangeEnd } = getDateRange(dateFilter);
                    const daysDiff = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));
                    const avgPerDay = filteredOrders.length > 0 ? (filteredOrders.length / daysDiff).toFixed(1) : '0';
                    const avgRevenuePerDay = completedOrders.length > 0 ? (stats.revenue / daysDiff).toFixed(2) : '0';
                    const uniqueBusinesses = new Set(filteredOrders.map(o => o.businessId)).size;
                    return (
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-white mb-4">{t('platform_ozeti')}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                    <p className="text-xl font-bold text-white">{orders.length.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{t('toplam_siparis_tum')}</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                    <p className="text-xl font-bold text-green-400">{completionRate}%</p>
                                    <p className="text-xs text-gray-400">{t('tamamlanma_orani')}</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                    <p className="text-xl font-bold text-emerald-400">€{Number(avgRevenuePerDay).toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{t('gunluk_ort_ciro')}</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                    <p className="text-xl font-bold text-cyan-400">{avgPerDay}</p>
                                    <p className="text-xs text-gray-400">{t('gunluk_ort_siparis')}</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                    <p className="text-xl font-bold text-purple-400">{uniqueBusinesses}</p>
                                    <p className="text-xs text-gray-400">{t('aktif_i_sletme')}</p>
                                </div>
                                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                                    <p className="text-xl font-bold text-blue-400">{userStats?.total || 0}</p>
                                    <p className="text-xs text-gray-400">{t('toplam_kullanici')}</p>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Info */}
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3">
                    <p className="text-yellow-400 text-xs">
                        {t('gosterilen_donem')} <strong>{getDateLabel()}</strong> {t('veriler_firestore_dan_gercek_zamanli_cek')}
                    </p>
                </div>
            </main>
        </div>
    );
}
