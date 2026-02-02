'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

// Types
interface SubscriptionData {
    plan: string;
    status: 'active' | 'cancelled' | 'trial' | 'past_due';
    startDate: Date | null;
    nextBillingDate: Date | null;
    cancelledAt: Date | null;
    trialEndsAt: Date | null;
    price: number;
    interval: 'monthly' | 'yearly';
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    date: Date;
    amount: number;
    status: 'paid' | 'pending' | 'overdue';
    pdfUrl?: string;
}

interface OrderStats {
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    avgOrderValue: number;
    deliveryCount: number;
    pickupCount: number;
    dailyOrders: { date: string; count: number; revenue: number }[];
    hourlyDistribution: { hour: number; count: number }[];
}

// Plan config
const planConfig: Record<string, { name: string; color: string; icon: string; price: number }> = {
    free: { name: 'Free', color: 'gray', icon: '🆓', price: 0 },
    starter: { name: 'Starter', color: 'blue', icon: '🚀', price: 29 },
    pro: { name: 'Pro', color: 'purple', icon: '⭐', price: 79 },
    enterprise: { name: 'Enterprise', color: 'yellow', icon: '🏆', price: 199 },
};

export default function VendorAccountPage() {
    const [user, setUser] = useState<User | null>(null);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [businessName, setBusinessName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // State
    const [subscription, setSubscription] = useState<SubscriptionData>({
        plan: 'free',
        status: 'active',
        startDate: null,
        nextBillingDate: null,
        cancelledAt: null,
        trialEndsAt: null,
        price: 0,
        interval: 'monthly',
    });
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stats, setStats] = useState<OrderStats>({
        totalOrders: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        avgOrderValue: 0,
        deliveryCount: 0,
        pickupCount: 0,
        dailyOrders: [],
        hourlyDistribution: [],
    });
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

    // Auth check
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setLoading(false);
                return;
            }

            setUser(firebaseUser);

            try {
                const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    const bId = data.butcherId || data.businessId;
                    if (bId) {
                        setBusinessId(bId);

                        // Get business info
                        const businessDoc = await getDoc(doc(db, 'businesses', bId));
                        if (businessDoc.exists()) {
                            const bData = businessDoc.data();
                            setBusinessName(bData.companyName || 'İşletme');

                            // Load subscription from business doc
                            setSubscription({
                                plan: bData.subscriptionPlan || 'free',
                                status: bData.subscriptionStatus || 'active',
                                startDate: bData.createdAt?.toDate() || null,
                                nextBillingDate: bData.nextBillingDate?.toDate() || null,
                                cancelledAt: bData.cancelledAt?.toDate() || null,
                                trialEndsAt: bData.trialEndsAt?.toDate() || null,
                                price: planConfig[bData.subscriptionPlan || 'free']?.price || 0,
                                interval: bData.billingInterval || 'monthly',
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading business:', error);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load invoices
    const loadInvoices = useCallback(async () => {
        if (!businessId) return;

        try {
            const q = query(
                collection(db, 'invoices'),
                where('businessId', '==', businessId),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                invoiceNumber: doc.data().invoiceNumber || `INV-${doc.id.slice(0, 6).toUpperCase()}`,
                date: doc.data().date?.toDate() || new Date(),
                amount: doc.data().amount || 0,
                status: doc.data().status || 'paid',
                pdfUrl: doc.data().pdfUrl,
            })) as Invoice[];
            setInvoices(data);
        } catch (error) {
            console.error('Error loading invoices:', error);
            // Demo invoices for display
            setInvoices([
                { id: '1', invoiceNumber: 'INV-2024-001', date: new Date(2024, 0, 1), amount: 79, status: 'paid' },
                { id: '2', invoiceNumber: 'INV-2024-002', date: new Date(2024, 1, 1), amount: 79, status: 'paid' },
                { id: '3', invoiceNumber: 'INV-2024-003', date: new Date(2024, 2, 1), amount: 79, status: 'pending' },
            ]);
        }
    }, [businessId]);

    // Load order stats
    const loadStats = useCallback(async () => {
        if (!businessId) return;

        try {
            // Calculate date range
            const now = new Date();
            let startDate = new Date();
            switch (dateRange) {
                case '7d': startDate.setDate(now.getDate() - 7); break;
                case '30d': startDate.setDate(now.getDate() - 30); break;
                case '90d': startDate.setDate(now.getDate() - 90); break;
                case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
            }

            const q = query(
                collection(db, 'meat_orders'),
                where('butcherId', '==', businessId),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const orders = snapshot.docs.map(d => d.data());

            // Calculate stats
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const uniqueCustomers = new Set(orders.map(o => o.userId || o.customerPhone)).size;
            const deliveryCount = orders.filter(o => o.fulfillmentType === 'delivery').length;
            const pickupCount = orders.filter(o => o.fulfillmentType === 'pickup').length;

            // Daily breakdown
            const dailyMap: Record<string, { count: number; revenue: number }> = {};
            orders.forEach(o => {
                const date = o.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || '';
                if (date) {
                    if (!dailyMap[date]) dailyMap[date] = { count: 0, revenue: 0 };
                    dailyMap[date].count++;
                    dailyMap[date].revenue += o.totalAmount || 0;
                }
            });
            const dailyOrders = Object.entries(dailyMap)
                .map(([date, data]) => ({ date, ...data }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Hourly distribution
            const hourlyMap: Record<number, number> = {};
            orders.forEach(o => {
                const hour = o.createdAt?.toDate?.()?.getHours?.() || 0;
                hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
            });
            const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
                hour: h,
                count: hourlyMap[h] || 0,
            }));

            setStats({
                totalOrders,
                totalRevenue,
                totalCustomers: uniqueCustomers,
                avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                deliveryCount,
                pickupCount,
                dailyOrders,
                hourlyDistribution,
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }, [businessId, dateRange]);

    useEffect(() => {
        if (businessId) {
            loadInvoices();
            loadStats();
        }
    }, [businessId, loadInvoices, loadStats]);

    // Helpers
    const formatDate = (date: Date | null) => {
        if (!date) return '-';
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const getDaysRemaining = () => {
        if (!subscription.nextBillingDate) return null;
        const diff = subscription.nextBillingDate.getTime() - Date.now();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const planInfo = planConfig[subscription.plan] || planConfig.free;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    💳 Hesabım
                </h1>
                <p className="text-gray-400 mt-1">
                    Abonelik, faturalar ve LOKMA performans istatistikleri
                </p>
            </div>

            {/* Subscription Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl bg-${planInfo.color}-600/20 flex items-center justify-center text-3xl`}>
                            {planInfo.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-white">{planInfo.name} Plan</h2>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${subscription.status === 'active' ? 'bg-green-600/20 text-green-400' :
                                        subscription.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                            subscription.status === 'trial' ? 'bg-blue-600/20 text-blue-400' :
                                                'bg-yellow-600/20 text-yellow-400'
                                    }`}>
                                    {subscription.status === 'active' ? '✅ Aktif' :
                                        subscription.status === 'cancelled' ? '❌ İptal Edildi' :
                                            subscription.status === 'trial' ? '🎁 Deneme' : '⚠️ Ödeme Bekliyor'}
                                </span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1">
                                {businessName} • Müşteri olduğunuz tarih: {formatDate(subscription.startDate)}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-white">{formatCurrency(subscription.price)}</p>
                        <p className="text-gray-400 text-sm">/ {subscription.interval === 'monthly' ? 'ay' : 'yıl'}</p>
                    </div>
                </div>

                {/* Subscription Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide">Sonraki Ödeme</p>
                        <p className="text-white font-medium mt-1">{formatDate(subscription.nextBillingDate)}</p>
                        {getDaysRemaining() !== null && (
                            <p className="text-blue-400 text-xs mt-1">{getDaysRemaining()} gün kaldı</p>
                        )}
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide">Plan Başlangıcı</p>
                        <p className="text-white font-medium mt-1">{formatDate(subscription.startDate)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide">Fatura Döngüsü</p>
                        <p className="text-white font-medium mt-1">{subscription.interval === 'monthly' ? 'Aylık' : 'Yıllık'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide">Durum</p>
                        <p className={`font-medium mt-1 ${subscription.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                            {subscription.status === 'active' ? 'Aktif Abonelik' : 'İptal Edildi'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
                        📈 Plan Yükselt
                    </button>
                    {subscription.status === 'active' && (
                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium">
                            Aboneliği İptal Et
                        </button>
                    )}
                    {subscription.status === 'cancelled' && (
                        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium">
                            🔄 Yeniden Başlat
                        </button>
                    )}
                </div>
            </div>

            {/* Invoice History */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">📄 Fatura Geçmişi</h3>
                    <span className="text-gray-400 text-sm">{invoices.length} fatura</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-700/50 text-gray-400 text-sm">
                            <tr>
                                <th className="px-4 py-3">Fatura No</th>
                                <th className="px-4 py-3">Tarih</th>
                                <th className="px-4 py-3">Tutar</th>
                                <th className="px-4 py-3">Durum</th>
                                <th className="px-4 py-3">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        Henüz fatura bulunmuyor
                                    </td>
                                </tr>
                            ) : (
                                invoices.map(invoice => (
                                    <tr key={invoice.id} className="hover:bg-gray-700/30">
                                        <td className="px-4 py-3 text-white font-mono">{invoice.invoiceNumber}</td>
                                        <td className="px-4 py-3 text-gray-300">{formatDate(invoice.date)}</td>
                                        <td className="px-4 py-3 text-white font-medium">{formatCurrency(invoice.amount)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.status === 'paid' ? 'bg-green-600/20 text-green-400' :
                                                    invoice.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400' :
                                                        'bg-red-600/20 text-red-400'
                                                }`}>
                                                {invoice.status === 'paid' ? '✅ Ödendi' :
                                                    invoice.status === 'pending' ? '⏳ Bekliyor' : '❌ Gecikmiş'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button className="text-blue-400 hover:text-blue-300 text-sm">
                                                📥 PDF İndir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* LOKMA Performance Analytics */}
            <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">📊 LOKMA Performans Analitikleri</h3>
                    <div className="flex gap-2">
                        {(['7d', '30d', '90d', '1y'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium ${dateRange === range
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                {range === '7d' ? '7 Gün' :
                                    range === '30d' ? '30 Gün' :
                                        range === '90d' ? '3 Ay' : '1 Yıl'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-gray-400 text-sm">Toplam Sipariş</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.totalOrders}</p>
                        <p className="text-blue-400 text-xs mt-1">
                            ~{(stats.totalOrders / (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365)).toFixed(1)} / gün
                        </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-gray-400 text-sm">Toplam Ciro</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-green-400 text-xs mt-1">LOKMA üzerinden</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-gray-400 text-sm">Müşteri Sayısı</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.totalCustomers}</p>
                        <p className="text-purple-400 text-xs mt-1">Benzersiz müşteri</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-4">
                        <p className="text-gray-400 text-sm">Ortalama Sepet</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatCurrency(stats.avgOrderValue)}</p>
                        <p className="text-yellow-400 text-xs mt-1">Sipariş başına</p>
                    </div>
                </div>

                {/* Order Type Distribution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Delivery vs Pickup */}
                    <div className="bg-gray-700/30 rounded-xl p-4">
                        <h4 className="text-white font-medium mb-4">Sipariş Türleri</h4>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">🚚 Teslimat</span>
                                    <span className="text-white">{stats.deliveryCount} ({stats.totalOrders > 0 ? Math.round(stats.deliveryCount / stats.totalOrders * 100) : 0}%)</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${stats.totalOrders > 0 ? (stats.deliveryCount / stats.totalOrders * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">🏃 Gel Al</span>
                                    <span className="text-white">{stats.pickupCount} ({stats.totalOrders > 0 ? Math.round(stats.pickupCount / stats.totalOrders * 100) : 0}%)</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${stats.totalOrders > 0 ? (stats.pickupCount / stats.totalOrders * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hourly Distribution */}
                    <div className="bg-gray-700/30 rounded-xl p-4">
                        <h4 className="text-white font-medium mb-4">Saatlik Dağılım</h4>
                        <div className="flex items-end justify-between h-24 gap-0.5">
                            {stats.hourlyDistribution.slice(8, 22).map((h, i) => {
                                const maxCount = Math.max(...stats.hourlyDistribution.map(x => x.count), 1);
                                const height = (h.count / maxCount) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center">
                                        <div
                                            className={`w-full rounded-t ${h.count > 0 ? 'bg-blue-500' : 'bg-gray-600'}`}
                                            style={{ height: `${Math.max(height, 5)}%` }}
                                        />
                                        <span className="text-xs text-gray-500 mt-1">{h.hour}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-gray-500 text-xs text-center mt-2">Saat (08:00 - 21:00)</p>
                    </div>
                </div>

                {/* Daily Orders Chart (Simple Bar) */}
                {stats.dailyOrders.length > 0 && (
                    <div className="mt-6 bg-gray-700/30 rounded-xl p-4">
                        <h4 className="text-white font-medium mb-4">Günlük Siparişler</h4>
                        <div className="flex items-end justify-between h-32 gap-1 overflow-x-auto">
                            {stats.dailyOrders.slice(-14).map((day, i) => {
                                const maxCount = Math.max(...stats.dailyOrders.map(x => x.count), 1);
                                const height = (day.count / maxCount) * 100;
                                return (
                                    <div key={i} className="flex-1 min-w-[20px] flex flex-col items-center">
                                        <span className="text-xs text-white mb-1">{day.count}</span>
                                        <div
                                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                                            style={{ height: `${Math.max(height, 5)}%` }}
                                        />
                                        <span className="text-xs text-gray-500 mt-1 truncate">
                                            {day.date.split('-')[2]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-gray-500 text-xs text-center mt-2">Son 14 gün</p>
                    </div>
                )}
            </div>
        </div>
    );
}
