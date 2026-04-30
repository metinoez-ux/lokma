'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useAdminBusinessId } from '@/hooks/useAdminBusinessId';
import { useTranslations } from 'next-intl';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';
import { useOrdersStandalone, Order } from '@/hooks/useOrders';

// Order type is now imported from @/hooks/useOrders (canonical)

type CompareMode = 'none' | 'lastWeek' | 'lastMonth' | 'lastYear';

interface DeliveryPauseLog {
 id: string;
 action: 'paused' | 'resumed';
 timestamp: Date;
 adminEmail: string;
 adminId: string;
 adminName?: string;
}

interface PerfOrderStats {
 totalOrders: number;
 completedOrders: number;
 avgPreparationTime: number;
 avgDeliveryTime: number;
}

export default function StatisticsPage({ embedded = false, isKermesMode = false, kermesId, kermesStartDate, kermesEndDate }: { embedded?: boolean; isKermesMode?: boolean; kermesStartDate?: Date; kermesEndDate?: Date; kermesId?: string }) {

 const t = useTranslations('AdminStatistics');
 const { admin, loading: adminLoading } = useAdmin();
 const adminBusinessId = useAdminBusinessId();
 const effectiveBusinessId = isKermesMode && kermesId ? kermesId : adminBusinessId;
 // Orders from unified hook (single Firestore listener)
 const { orders, loading: ordersLoading } = useOrdersStandalone({ businessId: effectiveBusinessId, initialDateFilter: 'all' });
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

 // Staff Performance Data
 const [pauseLogs, setPauseLogs] = useState<DeliveryPauseLog[]>([]);
 const [perfStats, setPerfStats] = useState<PerfOrderStats>({ totalOrders: 0, completedOrders: 0, avgPreparationTime: 0, avgDeliveryTime: 0 });
 const [perfLoading, setPerfLoading] = useState(false);
 const [perfDateRange, setPerfDateRange] = useState<'7d' | '30d' | '90d'>('30d');
 const [periodTab, setPeriodTab] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
 const [isPauseLogsExpanded, setIsPauseLogsExpanded] = useState(false);

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

 const router = useRouter();

  // Auto-set business filter for non-super admins
  useEffect(() => {
    if (embedded) return;
    if (admin && admin.adminType !== 'super') {
      const isKermesContextOnly = admin.adminType === 'kermes_staff' || admin.adminType === 'kermes' || admin.businessType === 'kermes';
      const kTarget = admin.kermesId || ((admin as any).kermesAssignments && (admin as any).kermesAssignments[0] && (admin as any).kermesAssignments[0].kermesId) || ((admin as any).assignments?.find((a: any) => a.entityType === 'kermes')?.entityId);
      
      if (isKermesContextOnly && kTarget && kTarget !== 'NONE') {
        router.replace(`/admin/kermes/${kTarget}?tab=dashboard`);
      } else if (adminBusinessId) {
        setBusinessFilter(adminBusinessId);
      }
    }
  }, [admin, adminBusinessId, router, embedded]);

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

 // Orders are now provided by useOrdersStandalone hook (canonical field mapping)
 // Update loading based on hook state
 useEffect(() => {
 if (!ordersLoading) {
 setLoading(false);
 }
 }, [ordersLoading]);

 // Staff admin: Load delivery pause logs & order performance stats
 const staffBusinessId = admin?.adminType !== 'super'
 ? adminBusinessId
 : null;

 useEffect(() => {
 if (!staffBusinessId) return;
 setPerfLoading(true);
 const logsRef = collection(db, 'businesses', staffBusinessId, 'deliveryPauseLogs');
 const q2 = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
 const unsubLogs = onSnapshot(q2, (snapshot) => {
 setPauseLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate() || new Date() })) as DeliveryPauseLog[]);
 setPerfLoading(false);
 }, () => setPerfLoading(false));
 return () => unsubLogs();
 }, [staffBusinessId]);

 useEffect(() => {
 if (!staffBusinessId) return;
 const loadPerfStats = async () => {
 const daysAgo = perfDateRange === '7d' ? 7 : perfDateRange === '30d' ? 30 : 90;
 const startDate = new Date(); startDate.setDate(startDate.getDate() - daysAgo);
 const q3 = query(collection(db, 'meat_orders'), where('butcherId', '==', staffBusinessId), limit(500));
 const snap = await getDocs(q3);
 const allOrders = snap.docs.map(d => ({ ...d.data(), status: d.data().status || '', createdAt: d.data().createdAt?.toDate() || new Date(), updatedAt: d.data().updatedAt?.toDate() || null, completedAt: d.data().completedAt?.toDate() || null }));
 const filtered = allOrders.filter(o => o.createdAt >= startDate);
 const completed = filtered.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));
 let totalPrep = 0, prepN = 0, totalFulfill = 0, fulfillN = 0;
 completed.forEach(o => {
 if (o.updatedAt && o.createdAt) {
 const d = (o.updatedAt.getTime() - o.createdAt.getTime()) / 60000;
 if (d > 0 && d < 360) { totalPrep += d; prepN++; }
 }
 const end = o.completedAt || o.updatedAt;
 if (end && o.createdAt) {
 const d = (end.getTime() - o.createdAt.getTime()) / 60000;
 if (d > 0 && d < 360) { totalFulfill += d; fulfillN++; }
 }
 });
 setPerfStats({ totalOrders: filtered.length, completedOrders: completed.length, avgPreparationTime: prepN > 0 ? Math.round(totalPrep / prepN) : 0, avgDeliveryTime: fulfillN > 0 ? Math.round(totalFulfill / fulfillN) : 0 });
 };
 loadPerfStats();
 }, [staffBusinessId, perfDateRange]);

 const pauseStats = useMemo(() => {
 const daysAgo = perfDateRange === '7d' ? 7 : perfDateRange === '30d' ? 30 : 90;
 const start = new Date(); start.setDate(start.getDate() - daysAgo);
 const filtered = pauseLogs.filter(l => l.timestamp >= start);
 const THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
 let significantPauses = 0;
 let totalMs = 0;
 let pauseStart: Date | null = null;
 // Walk chronologically to pair pause/resume events
 [...filtered].reverse().forEach(l => {
 if (l.action === 'paused') {
 pauseStart = l.timestamp;
 } else if (l.action === 'resumed' && pauseStart) {
 const duration = l.timestamp.getTime() - pauseStart.getTime();
 if (duration >= THRESHOLD_MS) {
 significantPauses++;
 totalMs += duration;
 }
 pauseStart = null;
 }
 });
 // If currently paused, count from last pause to now
 if (pauseStart) {
 const duration = Date.now() - (pauseStart as Date).getTime();
 if (duration >= THRESHOLD_MS) {
 significantPauses++;
 totalMs += duration;
 }
 }
 const resumeCount = filtered.filter(l => l.action === 'resumed').length;
 return { pauseCount: significantPauses, resumeCount, totalPausedHours: Math.round(totalMs / 3600000) };
 }, [pauseLogs, perfDateRange]);

 const formatPerfDate = (date: Date) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);

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
 const formatCurrency = (amount: number, currencyCode?: string) => globalFormatCurrency(amount, currencyCode);

 // Calculate stats helper
 const calculateStats = (orderList: Order[]) => {
 const completed = orderList.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));
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
 const completedOrders = filteredOrders.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));

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
 const color = isPositive ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400';
 return (
 <span className={`text-xs ${color} ml-1`}>
 {icon} {Math.abs(change).toFixed(1)}%
 </span>
 );
 };

 // Advanced Analytics - All filtered by selected business
  const analytics = useMemo(() => {
    const hourlyDistribution = Array(24).fill(0).map((_, hour) => ({ hour, count: 0, revenue: 0 }));
    const dailyDistribution = ['Pazar', 'Pazartesi', t('sali'), t('carsamba'), t('persembe'), 'Cuma', 'Cumartesi'].map(day => ({ day, count: 0, revenue: 0 }));
    const kermesDailyMap = {};
    const typeBreakdown = { pickup: 0, delivery: 0, dineIn: 0 };
    const productCounts = {};
    const businessStats = {};

    // Use kermes dates if available
    let activeDates = [];
    if (isKermesMode && kermesStartDate) {
      const endD = kermesEndDate ? new Date(kermesEndDate) : new Date(kermesStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      let curr = new Date(kermesStartDate);
      while (curr <= endD) {
        activeDates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredOrders.forEach(o => {
      const date = o.createdAt?.toDate();
      const total = o.total || 0;

      if (date) {
        // Hourly
        const hour = date.getHours();
        hourlyDistribution[hour].count++;
        hourlyDistribution[hour].revenue += total;

        // Daily
        const day = date.getDay();
        dailyDistribution[day].count++;
        dailyDistribution[day].revenue += total;

        // Kermes Daily
        const dateStr = date.toISOString().split('T')[0];
        if (!kermesDailyMap[dateStr]) {
          kermesDailyMap[dateStr] = { count: 0, revenue: 0 };
        }
        kermesDailyMap[dateStr].count++;
        kermesDailyMap[dateStr].revenue += total;
      }

      // Type Breakdown
      const type = o.type || (o as any).deliveryMethod;
      if (type === 'pickup' || type === 'gelAl') typeBreakdown.pickup++;
      else if (type === 'delivery') typeBreakdown.delivery++;
      else if (type === 'dineIn' || type === 'dine_in' || type === 'masa') typeBreakdown.dineIn++;

      // Top Products
      o.items?.forEach((item) => {
        const itemName = item.productName || item.name || '';
        if (!itemName) return;
        if (!productCounts[itemName]) {
          productCounts[itemName] = { name: itemName, quantity: 0, revenue: 0 };
        }
        productCounts[itemName].quantity += item.quantity || 1;
        productCounts[itemName].revenue += (item.totalPrice || item.price || 0) * (item.quantity || 1);
      });

      // Business Stats
      const id = o.businessId;
      if (id) {
        if (!businessStats[id]) {
          businessStats[id] = { id, name: businesses[id] || o.businessName || id, orders: 0, revenue: 0, avgOrder: 0 };
        }
        businessStats[id].orders++;
        businessStats[id].revenue += total;
      }
    });

    const mockWeathers = [
      { icon: '☀️', temp: '22°C', label: 'Açık', wind: '12km/s', rain: '0mm' },
      { icon: '⛅', temp: '19°C', label: 'Parçalı Bulutlu', wind: '18km/s', rain: '0mm' },
      { icon: '🌧️', temp: '16°C', label: 'Yağmurlu', wind: '25km/s', rain: '12mm' },
      { icon: '☁️', temp: '18°C', label: 'Çok Bulutlu', wind: '15km/s', rain: '2mm' }
    ];

    // Combine activeDates and orders' dates
    let allDates = Array.from(new Set([...activeDates, ...Object.keys(kermesDailyMap)])).sort();
    
    const kermesDailyDistribution = allDates.map((dateStr, idx) => {
      const dateObj = new Date(dateStr);
      const dateFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(dateObj);
      return {
        day: `${idx + 1}. Gün (${dateFormatted})`,
        weather: mockWeathers[idx % mockWeathers.length],
        count: kermesDailyMap[dateStr]?.count || 0,
        revenue: kermesDailyMap[dateStr]?.revenue || 0,
      };
    });

    const topProducts = Object.values(productCounts)
      .filter(p => p.name && p.name !== t('urun'))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    Object.values(businessStats).forEach(b => {
      b.avgOrder = b.orders > 0 ? b.revenue / b.orders : 0;
    });
    const businessPerformance = Object.values(businessStats).sort((a, b) => b.revenue - a.revenue);

    const maxHourly = Math.max(...hourlyDistribution.map(h => h.count), 1);
    const peakHour = hourlyDistribution.find(h => h.count === maxHourly)?.hour || 12;

    const sortedDays = [...dailyDistribution].sort((a, b) => b.count - a.count);
    const busiestDay = sortedDays[0]?.day || 'Cumartesi';
    const slowestDay = sortedDays[sortedDays.length - 1]?.day || 'Pazartesi';

    return {
      hourlyDistribution,
      dailyDistribution,
      kermesDailyDistribution,
      typeBreakdown,
      topProducts,
      businessPerformance,
      peakHour,
      busiestDay,
      slowestDay
    };
  }, [filteredOrders, businesses, t, isKermesMode, kermesStartDate, kermesEndDate]);

 if (adminLoading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background p-6">
 {/* Header */}
 <div className="w-full mb-6">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
 📊 İstatistikler
 </h1>
 <p className="text-muted-foreground text-sm mt-1">
 {t('platform_siparis_ve_performans_analitigi')}
 </p>
 </div>
 </div>
 </div>

 {/* Global Filters */}
 <div className="w-full mb-6">
 <div className="bg-card rounded-xl p-4 space-y-4">
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
 <option value="today">{t('bugun')}</option>
 <option value="week">📅 Bu Hafta</option>
 <option value="month">📅 Bu Ay</option>
 <option value="year">{t('bu_yil')}</option>
 <option value="custom">{t('ozel_tarih_araligi')}</option>
 <option value="all">{t('tumu')}</option>
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
 <span className="text-muted-foreground">→</span>
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
 <option value="none">{t('karsilastirma_yok')}</option>
 <option value="lastWeek">{t('gecen_hafta_ile')}</option>
 <option value="lastMonth">{t('gecen_ay_ile')}</option>
 <option value="lastYear">{t('gecen_yil_ile')}</option>
 </select>

 {/* Business Filter - Only for Super Admin */}
 {admin?.adminType === 'super' && (
 <select
 value={businessFilter}
 onChange={(e) => setBusinessFilter(e.target.value)}
 className="px-4 py-2 bg-emerald-700 text-white rounded-lg border border-emerald-500 font-medium"
 >
 <option value="all">{t('tum_i_sletmeler')}</option>
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
 className="text-emerald-800 dark:text-emerald-400 hover:text-white"
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
 {t('karsilastirma_donemi')} {comparisonRange.startDate.toLocaleDateString('de-DE')} - {comparisonRange.endDate.toLocaleDateString('de-DE')}
 </span>
 <span className="text-muted-foreground text-sm">
 ({comparisonOrders.length} {t('siparis')}
 </span>
 </div>
 )}
 </div>
 </div>

 {loading ? (
 <div className="w-full bg-card rounded-xl p-12 text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
 <p className="text-muted-foreground mt-4">{t('veriler_yukleniyor')}</p>
 </div>
 ) : (
 <div className="w-full space-y-6">
 {/* Summary Cards */}
 {!isKermesMode && (
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
 <div className="bg-card rounded-xl p-4 text-center">
 <p className="text-3xl font-bold text-blue-800 dark:text-blue-400">
 {stats.total}
 {changes && formatChange(changes.total)}
 </p>
 <p className="text-xs text-muted-foreground mt-1">{t('toplam_siparis')}</p>
 {compStats && (
 <p className="text-xs text-muted-foreground/80">{t('onceki')} {compStats.total}</p>
 )}
 </div>
 <div className="bg-card rounded-xl p-4 text-center relative group">
 <p className="text-3xl font-bold text-green-800 dark:text-green-400">
 {formatCurrency(stats.revenue)}
 {changes && formatChange(changes.revenue)}
 </p>
 <p className="text-xs text-muted-foreground mt-1">{t('toplam_ciro')}</p>
 {compStats && (
 <p className="text-xs text-muted-foreground/80">{t('onceki')} {formatCurrency(compStats.revenue)}</p>
 )}

					{/* Orders Link Button */}
					{(adminBusinessId || (businessFilter !== 'all' ? businessFilter : null)) && (
						<Link
							href={`/admin/business/${adminBusinessId || businessFilter}?tab=orders`}
							className="absolute top-2 right-2 p-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors opacity-0 group-hover:opacity-100"
							title={t('siparisler') || 'Siparisler'}
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
						</Link>
					)}
 </div>
 <div className="bg-card rounded-xl p-4 text-center">
 <p className="text-3xl font-bold text-purple-800 dark:text-purple-400">
 {formatCurrency(stats.avgOrderValue)}
 {changes && formatChange(changes.avgOrderValue)}
 </p>
 <p className="text-xs text-muted-foreground mt-1">{t('ort_siparis')}</p>
 {compStats && (
 <p className="text-xs text-muted-foreground/80">{t('onceki')} {formatCurrency(compStats.avgOrderValue)}</p>
 )}
 </div>
 <div className="bg-card rounded-xl p-4 text-center">
 <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">
 {stats.completed}
 {changes && formatChange(changes.completed)}
 </p>
 <p className="text-xs text-muted-foreground mt-1">{t('completed_label')}</p>
 {compStats && (
 <p className="text-xs text-muted-foreground/80">{t('onceki')} {compStats.completed}</p>
 )}
 </div>
 <div className="bg-card rounded-xl p-4 text-center">
 <p className="text-3xl font-bold text-red-800 dark:text-red-400">
 {stats.cancelled}
 {changes && formatChange(changes.cancelled)}
 </p>
 <p className="text-xs text-muted-foreground mt-1">İptal</p>
 {compStats && (
 <p className="text-xs text-muted-foreground/80">{t('onceki')} {compStats.cancelled}</p>
 )}
 </div>
 <div className="bg-card rounded-xl p-4 text-center">
 <p className="text-3xl font-bold text-amber-800 dark:text-amber-400">{analytics.peakHour}:00</p>
 <p className="text-xs text-muted-foreground mt-1">{t('en_yogun_saat')}</p>
 </div>
 </div>
 )}

 {/* Insights Row */}
 <div className="grid md:grid-cols-3 gap-4">
 <div className="bg-gradient-to-br from-green-100 dark:from-green-900/30 to-green-50 dark:to-green-800/20 border border-green-200 dark:border-green-700/30 rounded-xl p-4">
 <p className="text-green-800 dark:text-green-400 text-sm font-medium mb-1">{t('en_yogun_gun')}</p>
 <p className="text-white text-xl font-bold">{analytics.busiestDay}</p>
 </div>
 <div className="bg-gradient-to-br from-blue-100 dark:from-blue-900/30 to-blue-50 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700/30 rounded-xl p-4">
 <p className="text-blue-800 dark:text-blue-400 text-sm font-medium mb-1">{t('en_durgun_gun')}</p>
 <p className="text-white text-xl font-bold">{analytics.slowestDay}</p>
 </div>
 <div className="bg-gradient-to-br from-purple-100 dark:from-purple-900/30 to-purple-50 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700/30 rounded-xl p-4">
 <p className="text-purple-800 dark:text-purple-400 text-sm font-medium mb-1">{t('siparis_orani')}</p>
 {filteredOrders.length > 0 ? (
 <div className="flex flex-wrap gap-2 mt-1">
 <span className="text-blue-800 dark:text-blue-400 font-bold text-sm">🚚 {Math.round((analytics.typeBreakdown.delivery / filteredOrders.length) * 100)}% {t('kurye')}</span>
 <span className="text-amber-800 dark:text-amber-400 font-bold text-sm">🪑 {Math.round((analytics.typeBreakdown.dineIn / filteredOrders.length) * 100)}% Masa</span>
 <span className="text-green-800 dark:text-green-400 font-bold text-sm">🛍️ {Math.round((analytics.typeBreakdown.pickup / filteredOrders.length) * 100)}% Gel Al</span>
 </div>
 ) : (
 <p className="text-muted-foreground/80 text-sm">{t('veri_yok')}</p>
 )}
 </div>
 </div>

 {/* Charts Row */}
 <div className="grid md:grid-cols-2 gap-6">
 {/* Hourly Distribution */}
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">{t('saatlik_siparis_dagilimi')}</h3>
 {(() => {
 const hourData = analytics.hourlyDistribution.slice(8, 22);
 const maxCount = Math.max(...hourData.map(h => h.count), 1);
 const chartH = 140; // px
 return (
 <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: `${chartH + 24}px`, paddingTop: '16px' }}>
 {hourData.map((h) => {
 const barH = h.count > 0 ? Math.max((h.count / maxCount) * chartH, 6) : 3;
 return (
 <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
 {h.count > 0 && (
 <span style={{ fontSize: '9px', color: '#93c5fd', fontWeight: 600, marginBottom: '2px' }}>{h.count}</span>
 )}
 <div
 style={{
 width: '100%',
 height: `${barH}px`,
 borderRadius: '4px 4px 0 0',
 background: h.count > 0 ? '#3b82f6' : '#374151',
 cursor: 'pointer',
 transition: 'background 0.2s',
 }}
 title={`${h.hour}:00 - ${h.count} sipariş, ${formatCurrency(h.revenue)}`}
 onMouseEnter={e => { if (h.count > 0) (e.target as HTMLDivElement).style.background = '#60a5fa'; }}
 onMouseLeave={e => { if (h.count > 0) (e.target as HTMLDivElement).style.background = '#3b82f6'; }}
 />
 <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{h.hour}</span>
 </div>
 );
 })}
 </div>
 );
 })()}
 </div>

 {/* Daily Distribution */}
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">{t('gunluk_siparis_dagilimi')}</h3>
 <div className="space-y-2">
 {analytics.dailyDistribution.map((d) => {
 const maxCount = Math.max(...analytics.dailyDistribution.map(d => d.count), 1);
 const width = (d.count / maxCount) * 100;
 return (
 <div key={d.day} className="flex items-center gap-3">
 <span className="text-muted-foreground text-sm w-20">{d.day.slice(0, 3)}</span>
 <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
 style={{ width: `${width}%` }}
 />
 </div>
 <span className="text-foreground font-medium w-12 text-right">{d.count}</span>
 </div>
 );
 })}
 </div>
 </div>
 </div>

 {/* Period Chart: Haftalık / Aylık / Yıllık */}
 {(() => {
 const now = new Date();
 const monthNames = ['Oca', t('sub'), 'Mar', 'Nis', 'May', 'Haz', 'Tem', t('agu'), 'Eyl', 'Eki', 'Kas', 'Ara'];

 let periodData: { label: string; count: number; revenue: number }[] = [];

 if (periodTab === 'weekly') {
 for (let i = 6; i >= 0; i--) {
 const d = new Date(now);
 d.setDate(d.getDate() - i);
 const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
 const dayOrders = orders.filter(o => {
 if (!o.createdAt) return false;
 const od = o.createdAt.toDate();
 return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
 });
 periodData.push({
 label: dayStr,
 count: dayOrders.length,
 revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
 });
 }
 } else if (periodTab === 'monthly') {
 const daysInMonth = now.getDate();
 for (let day = 1; day <= daysInMonth; day++) {
 const dayOrders = orders.filter(o => {
 if (!o.createdAt) return false;
 const od = o.createdAt.toDate();
 return od.getDate() === day && od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear();
 });
 periodData.push({
 label: `${day}`,
 count: dayOrders.length,
 revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
 });
 }
 } else {
 const currentMonth = now.getMonth();
 for (let m = 0; m <= currentMonth; m++) {
 const monthOrders = orders.filter(o => {
 if (!o.createdAt) return false;
 const od = o.createdAt.toDate();
 return od.getMonth() === m && od.getFullYear() === now.getFullYear();
 });
 periodData.push({
 label: monthNames[m],
 count: monthOrders.length,
 revenue: monthOrders.reduce((s, o) => s + (o.total || 0), 0),
 });
 }
 }

 const maxCount = Math.max(...periodData.map(d => d.count), 1);
 const maxRevenue = Math.max(...periodData.map(d => d.revenue), 1);

 return (
 <div className="bg-card rounded-xl p-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-foreground font-bold">{t('siparis_ciro_trendi')}</h3>
 <div className="flex bg-gray-700 rounded-lg overflow-hidden">
 {(['weekly', 'monthly', 'yearly'] as const).map(tab => (
 <button
 key={tab}
 onClick={() => setPeriodTab(tab)}
 className={`px-3 py-1 text-xs font-medium transition ${periodTab === tab
 ? 'bg-blue-600 text-white'
 : 'text-muted-foreground hover:text-white'
 }`}
 >
 {tab === 'weekly' ? t('haftalik') : tab === 'monthly' ? t('aylik') : t('yillik')}
 </button>
 ))}
 </div>
 </div>

 {/* Order Count Bars */}
 <div className="mb-4">
 <p className="text-muted-foreground text-xs mb-2">{t('siparis_sayisi')}</p>
 <div className="flex items-end gap-1" style={{ height: 120 }}>
 {periodData.map((d, i) => {
 const h = (d.count / maxCount) * 100;
 return (
 <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
 {d.count > 0 && (
 <span className="text-[9px] text-blue-300 mb-0.5">{d.count}</span>
 )}
 <div
 className="w-full bg-blue-500/80 rounded-t hover:bg-blue-400 transition-all"
 style={{ height: `${Math.max(h, 2)}%`, minHeight: d.count > 0 ? 4 : 2 }}
 title={`${d.label}: ${d.count} sipariş`}
 />
 </div>
 );
 })}
 </div>
 <div className="flex gap-1 mt-1">
 {periodData.map((d, i) => (
 <div key={i} className="flex-1 text-center">
 <span className="text-[8px] text-muted-foreground/80">{d.label}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Revenue Bars */}
 <div>
 <p className="text-muted-foreground text-xs mb-2">Ciro (€)</p>
 <div className="flex items-end gap-1" style={{ height: 120 }}>
 {periodData.map((d, i) => {
 const h = (d.revenue / maxRevenue) * 100;
 return (
 <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
 {d.revenue > 0 && (
 <span className="text-[9px] text-green-300 mb-0.5">€{d.revenue.toFixed(0)}</span>
 )}
 <div
 className="w-full bg-green-500/80 rounded-t hover:bg-green-400 transition-all"
 style={{ height: `${Math.max(h, 2)}%`, minHeight: d.revenue > 0 ? 4 : 2 }}
 title={`${d.label}: €${d.revenue.toFixed(2)}`}
 />
 </div>
 );
 })}
 </div>
 <div className="flex gap-1 mt-1">
 {periodData.map((d, i) => (
 <div key={i} className="flex-1 text-center">
 <span className="text-[8px] text-muted-foreground/80">{d.label}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 })()}

 {/* Tables Row */}
 <div className="grid md:grid-cols-2 gap-6">
 {/* Top Products */}
 <div className={`bg-card rounded-xl p-6 ${admin?.adminType !== 'super' ? 'md:col-span-2' : ''}`}>
 <h3 className="text-foreground font-bold mb-4">{t('en_cok_satan_urunler')}</h3>
 {analytics.topProducts.length === 0 ? (
 <p className="text-muted-foreground/80 text-center py-8">{t('urun_verisi_bulunamadi')}</p>
 ) : (
 <div className="space-y-2">
 {analytics.topProducts.slice(0, 5).map((p, idx) => (
 <div key={p.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
 <div className="flex items-center gap-3">
 <span className={`text-lg ${idx === 0 ? 'text-yellow-800 dark:text-yellow-400' : idx === 1 ? 'text-foreground' : idx === 2 ? 'text-amber-600' : 'text-muted-foreground/80'}`}>
 {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
 </span>
 <span className="text-foreground">{p.name}</span>
 </div>
 <div className="text-right">
 <p className="text-green-800 dark:text-green-400 font-medium">{formatCurrency(p.revenue)}</p>
 <p className="text-xs text-muted-foreground/80">{p.quantity} {t('adet')}</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Business Performance - ONLY for Super Admin when viewing all businesses */}
 {admin?.adminType === 'super' && (
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">{t('i_sletme_performansi')}</h3>
 {analytics.businessPerformance.length === 0 ? (
 <p className="text-muted-foreground/80 text-center py-8">{t('i_sletme_verisi_bulunamadi')}</p>
 ) : (
 <div className="space-y-2">
 {analytics.businessPerformance.slice(0, 5).map((b) => (
 <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
 <div>
 <p className="text-foreground font-medium">{b.name}</p>
 <p className="text-xs text-muted-foreground/80">{b.orders} {t('siparis')}</p>
 </div>
 <div className="text-right">
 <p className="text-green-800 dark:text-green-400 font-bold">{formatCurrency(b.revenue)}</p>
 <p className="text-xs text-muted-foreground/80">Ort: {formatCurrency(b.avgOrder)}</p>
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

 {/* 📊 STAFF PERFORMANCE SECTION — Only for non-super admins */}
 {admin?.adminType !== 'super' && staffBusinessId && (
 <div className="w-full mt-6">
 <div className="bg-card rounded-xl p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-foreground font-bold text-lg flex items-center gap-2">{t('i_sletme_performansi')}</h3>
 <select value={perfDateRange} onChange={e => setPerfDateRange(e.target.value as any)} className="bg-purple-600 text-white rounded-lg px-3 py-2 text-sm border-none">
 <option value="7d">{t('son_7_gun')}</option>
 <option value="30d">{t('son_30_gun')}</option>
 <option value="90d">{t('son_90_gun')}</option>
 </select>
 </div>

 {/* Performance Stats Grid */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
 <div className="bg-background rounded-lg p-4">
 <div className="text-3xl font-bold text-foreground">{perfStats.totalOrders}</div>
 <div className="text-sm text-muted-foreground">{t('toplam_siparis')}</div>
 </div>
 <div className="bg-green-600/20 rounded-lg p-4 border-l-4 border-green-500">
 <div className="text-3xl font-bold text-green-800 dark:text-green-400">{perfStats.completedOrders}</div>
 <div className="text-sm text-green-300">{t('completed_label')}</div>
 </div>
 <div className="bg-blue-600/20 rounded-lg p-4 border-l-4 border-blue-500">
 <div className="text-3xl font-bold text-blue-800 dark:text-blue-400">{perfStats.avgPreparationTime}<span className="text-lg">{t('minutes_short')}</span></div>
 <div className="text-sm text-blue-300">{t('ort_hazirlama')}</div>
 </div>
 <div className="bg-purple-600/20 rounded-lg p-4 border-l-4 border-purple-500">
 <div className="text-3xl font-bold text-purple-800 dark:text-purple-400">{perfStats.avgDeliveryTime}<span className="text-lg">{t('minutes_short')}</span></div>
 <div className="text-sm text-purple-300">{t('avg_delivery')}</div>
 </div>
 <div className="bg-amber-600/20 rounded-lg p-4 border-l-4 border-amber-500">
 <div className="text-3xl font-bold text-amber-800 dark:text-amber-400">{pauseStats.pauseCount}</div>
 <div className="text-sm text-amber-300">{t('kurye_durdurma')}</div>
 </div>
 </div>

 {/* Pause Statistics Row */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <div className="bg-background rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2"><span className="text-xl">⏸️</span><span className="text-muted-foreground">{t('durdurma_sayisi')}</span></div>
 <div className="text-2xl font-bold text-amber-800 dark:text-amber-400">{pauseStats.pauseCount}</div>
 </div>
 <div className="bg-background rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2"><span className="text-muted-foreground">{t('retention_label')}</span></div>
 <div className="text-2xl font-bold text-green-800 dark:text-green-400">{pauseStats.resumeCount}</div>
 </div>
 <div className="bg-background rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2"><span className="text-xl">⏱️</span><span className="text-muted-foreground">{t('toplam_durdurma_suresi')}</span></div>
 <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-400">{pauseStats.totalPausedHours} <span className="text-lg">{t('saat')}</span></div>
 </div>
 </div>

 {/* Delivery Pause Log Table */}
 <div className="bg-background rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-border">
 <h4 className="text-foreground font-bold flex items-center gap-2">{t('kurye_acma_kapama_gecmisi')}</h4>
 </div>
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-border">
 <thead className="bg-card">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('tarih')}</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('i_slem')}</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admin</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {pauseLogs.length === 0 ? (
 <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t('henuz_kurye_acma_kapama_kaydi_yok')}</td></tr>
 ) : (
 <>
 {pauseLogs.slice(0, isPauseLogsExpanded ? pauseLogs.length : 3).map(log => (
 <tr key={log.id} className={log.action === 'paused' ? 'bg-amber-900/20' : 'bg-green-900/20'}>
 <td className="px-4 py-3 text-sm text-foreground">{formatPerfDate(log.timestamp)}</td>
 <td className="px-4 py-3">
 {log.action === 'paused'
 ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-600 text-white text-[10px] font-medium leading-none">⏸️ Durduruldu</span>
 : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-600 text-white text-[10px] font-medium leading-none">▶️ Devam Etti</span>}
 </td>
 <td className="px-4 py-3 text-xs text-foreground truncate max-w-[100px]">{log.adminName || log.adminEmail}</td>
 </tr>
 ))}
 {pauseLogs.length > 3 && (
 <tr>
 <td colSpan={3} className="px-2 py-2 text-center bg-card">
 <button onClick={() => setIsPauseLogsExpanded(!isPauseLogsExpanded)} className="text-xs font-semibold text-blue-500 hover:text-blue-400 py-1 transition-colors">
 {isPauseLogsExpanded ? 'Daralt' : `+ Tümünü Göster (${pauseLogs.length})`}
 </button>
 </td>
 </tr>
 )}
 </>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
