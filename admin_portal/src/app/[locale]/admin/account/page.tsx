'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, orderBy, getDocs, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';

// Types
interface CommissionRecord {
    id: string;
    orderId: string;
    businessId: string;
    businessName: string;
    planId: string;
    planName: string;
    orderTotal: number;
    courierType: 'click_collect' | 'own_courier' | 'lokma_courier';
    commissionRate: number;
    commissionAmount: number;
    perOrderFee: number;
    totalCommission: number;
    netCommission: number;
    vatAmount: number;
    vatRate: number;
    paymentMethod: string;
    collectionStatus: 'auto_collected' | 'pending' | 'invoiced' | 'paid';
    period: string;
    createdAt: Date;
    orderNumber?: string;
}

interface BusinessUsage {
    accountBalance: number;
    subscriptionPlan: string;
    monthlyFee: number;
    usage?: {
        orders?: Record<string, number>;
        totalCommission?: Record<string, number>;
    };
}

const courierLabels: Record<string, string> = {
    click_collect: '🛒 Gel-Al',
    own_courier: '🏪 Kendi Kurye',
    lokma_courier: '🚗 LOKMA Kurye',
};

const statusColors: Record<string, string> = {
    auto_collected: 'bg-green-600',
    pending: 'bg-yellow-600',
    invoiced: 'bg-blue-600',
    paid: 'bg-emerald-600',
};

const statusLabels: Record<string, string> = {
    auto_collected: 'Otomatik Tahsil',
    pending: 'Bekliyor',
    invoiced: 'Faturalandı',
    paid: 'Ödendi',
};

export default function HesabimPage() {
    
  const t = useTranslations('AdminAccount');
const { admin, loading: adminLoading } = useAdmin();
    const [records, setRecords] = useState<CommissionRecord[]>([]);
    const [businessData, setBusinessData] = useState<BusinessUsage | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterPeriod, setFilterPeriod] = useState<string>('');
    const [showDetail, setShowDetail] = useState(false);

    // Determine business ID from admin (universal or legacy)
    const businessId = admin?.businessId || admin?.butcherId || admin?.restaurantId;
    const businessName = admin?.businessName || admin?.butcherName || admin?.restaurantName || '';

    // Load commission records for this business
    const loadRecords = useCallback(async () => {
        if (!businessId) return;
        try {
            const q = query(
                collection(db, 'commission_records'),
                where('businessId', '==', businessId),
                orderBy('createdAt', 'desc'),
                limit(200)
            );
            const snapshot = await getDocs(q);
            const list: CommissionRecord[] = [];
            snapshot.forEach((d) => {
                const data = d.data();
                list.push({
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                } as CommissionRecord);
            });
            setRecords(list);
        } catch (error) {
            console.error('Commission records loading error:', error);
        }
    }, [businessId]);

    // Load business data (balance, plan, usage)
    const loadBusinessData = useCallback(async () => {
        if (!businessId) return;
        try {
            const businessDoc = await getDoc(doc(db, 'businesses', businessId));
            if (businessDoc.exists()) {
                const data = businessDoc.data();
                setBusinessData({
                    accountBalance: data.accountBalance || 0,
                    subscriptionPlan: data.subscriptionPlan || data.plan || 'free',
                    monthlyFee: data.monthlyFee || 0,
                    usage: data.usage || {},
                });
            }
        } catch (error) {
            console.error('Business data loading error:', error);
        }
    }, [businessId]);

    useEffect(() => {
        if (!adminLoading && businessId) {
            Promise.all([loadRecords(), loadBusinessData()]).then(() => setLoading(false));
        } else if (!adminLoading) {
            setLoading(false);
        }
    }, [adminLoading, businessId, loadRecords, loadBusinessData]);

    // Set default period to current month
    useEffect(() => {
        const now = new Date();
        setFilterPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }, []);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filterPeriod && r.period !== filterPeriod) return false;
            return true;
        });
    }, [records, filterPeriod]);

    // Stats
    const stats = useMemo(() => {
        const totalCommission = filteredRecords.reduce((s, r) => s + r.totalCommission, 0);
        const totalOrders = filteredRecords.length;
        const totalOrderAmount = filteredRecords.reduce((s, r) => s + r.orderTotal, 0);
        const pendingAmount = filteredRecords
            .filter(r => r.collectionStatus === 'pending')
            .reduce((s, r) => s + r.totalCommission, 0);
        const collectedAmount = filteredRecords
            .filter(r => r.collectionStatus === 'auto_collected' || r.collectionStatus === 'paid')
            .reduce((s, r) => s + r.totalCommission, 0);
        const cardOrders = filteredRecords.filter(r => r.paymentMethod === 'card' || r.paymentMethod === 'stripe');
        const cashOrders = filteredRecords.filter(r => r.paymentMethod === 'cash');
        const vatTotal = filteredRecords.reduce((s, r) => s + r.vatAmount, 0);

        return {
            totalCommission,
            totalOrders,
            totalOrderAmount,
            pendingAmount,
            collectedAmount,
            cardOrders: cardOrders.length,
            cashOrders: cashOrders.length,
            cardCommission: cardOrders.reduce((s, r) => s + r.totalCommission, 0),
            cashCommission: cashOrders.reduce((s, r) => s + r.totalCommission, 0),
            vatTotal,
        };
    }, [filteredRecords]);

    // Current month usage from business doc
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const monthlyOrders = businessData?.usage?.orders?.[currentMonthKey] || 0;
    const monthlyCommission = businessData?.usage?.totalCommission?.[currentMonthKey] || 0;

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (!businessId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
                    <span className="text-5xl mb-4 block">🏪</span>
                    <h2 className="text-xl font-bold text-white mb-2">{t('i_sletme_bulunamadi')}</h2>
                    <p className="text-gray-400">{t('hesabiniza_bagli_bir_isletme_bulunmuyor_')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Page Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('hesabim')}</h1>
                        <p className="text-gray-400 text-sm">{businessName} {t('provizyon_ve_bakiye_takibi')}</p>
                    </div>
                    <button
                        onClick={() => { loadRecords(); loadBusinessData(); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm transition"
                    >
                        🔄 Yenile
                    </button>
                </div>

                {/* Account Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Balance Card */}
                    <div className="bg-gradient-to-br from-amber-600/30 to-amber-800/20 border border-amber-500/30 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">💰</span>
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider">{t('acik_bakiye')}</p>
                                <p className={`text-3xl font-bold ${(businessData?.accountBalance || 0) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                                    €{(businessData?.accountBalance || 0).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <p className="text-gray-400 text-xs">
                            {(businessData?.accountBalance || 0) > 0
                                ? t('odenmesi_gereken_nakit_provizyon_bakiyen')
                                : '✅ Bakiyeniz temiz'}
                        </p>
                    </div>

                    {/* Plan Card */}
                    <div className="bg-gradient-to-br from-indigo-600/30 to-indigo-800/20 border border-indigo-500/30 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">📋</span>
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Mevcut Plan</p>
                                <p className="text-2xl font-bold text-indigo-400 capitalize">
                                    {businessData?.subscriptionPlan || 'Free'}
                                </p>
                            </div>
                        </div>
                        <p className="text-gray-400 text-xs">
                            {t('aylik_ucret')}{(businessData?.monthlyFee || 0).toFixed(2)}
                        </p>
                    </div>

                    {/* Monthly Usage Card */}
                    <div className="bg-gradient-to-br from-cyan-600/30 to-cyan-800/20 border border-cyan-500/30 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">📊</span>
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Bu Ay</p>
                                <p className="text-2xl font-bold text-cyan-400">
                                    {monthlyOrders} {t('siparis')}
                                </p>
                            </div>
                        </div>
                        <p className="text-gray-400 text-xs">
                            {t('toplam_provizyon')}{monthlyCommission.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Commission Stats */}
                <div className="bg-gray-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">{t('provizyon_ozeti')}</h2>
                        <div className="flex items-center gap-3">
                            <input
                                type="month"
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value)}
                                className="px-3 py-1.5 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm"
                            />
                            <button
                                onClick={() => setFilterPeriod('')}
                                className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 text-xs"
                            >
                                {t('tumu')}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                            <p className="text-gray-400 text-xs">Sipariş</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">€{stats.totalOrderAmount.toFixed(0)}</p>
                            <p className="text-gray-400 text-xs">{t('toplam_ciro')}</p>
                        </div>
                        <div className="bg-amber-600/20 border border-amber-600/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-amber-400">€{stats.totalCommission.toFixed(2)}</p>
                            <p className="text-gray-400 text-xs">Provizyon</p>
                        </div>
                        <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-green-400">€{stats.collectedAmount.toFixed(2)}</p>
                            <p className="text-gray-400 text-xs">Tahsil Edilen</p>
                        </div>
                        <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-yellow-400">€{stats.pendingAmount.toFixed(2)}</p>
                            <p className="text-gray-400 text-xs">{t('bekleyen')}</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-gray-300">€{stats.vatTotal.toFixed(2)}</p>
                            <p className="text-gray-400 text-xs">KDV</p>
                        </div>
                    </div>

                    {/* Payment breakdown */}
                    <div className="mt-4 flex gap-4">
                        <div className="flex items-center gap-2 bg-blue-600/10 border border-blue-600/20 rounded-lg px-4 py-2">
                            <span>💳</span>
                            <span className="text-blue-400 text-sm font-medium">{stats.cardOrders} kart</span>
                            <span className="text-gray-500 text-sm">— €{stats.cardCommission.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-purple-600/10 border border-purple-600/20 rounded-lg px-4 py-2">
                            <span>💵</span>
                            <span className="text-purple-400 text-sm font-medium">{stats.cashOrders} nakit</span>
                            <span className="text-gray-500 text-sm">— €{stats.cashCommission.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Detail Records Toggle */}
                <div className="bg-gray-800 rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowDetail(!showDetail)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-700/50 transition"
                    >
                        <h2 className="text-lg font-bold text-white">{t('siparis_bazli_detay')}</h2>
                        <span className={`text-gray-400 text-2xl transition-transform ${showDetail ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </button>

                    {showDetail && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-gray-300 text-xs">Sipariş</th>
                                        <th className="px-3 py-3 text-center text-gray-300 text-xs">Teslimat</th>
                                        <th className="px-3 py-3 text-right text-gray-300 text-xs">{t('tutar')}</th>
                                        <th className="px-3 py-3 text-right text-gray-300 text-xs">Oran</th>
                                        <th className="px-3 py-3 text-right text-gray-300 text-xs">Provizyon</th>
                                        <th className="px-3 py-3 text-right text-gray-300 text-xs">Net + KDV</th>
                                        <th className="px-3 py-3 text-center text-gray-300 text-xs">{t('odeme')}</th>
                                        <th className="px-3 py-3 text-center text-gray-300 text-xs">{t('durum')}</th>
                                        <th className="px-3 py-3 text-center text-gray-300 text-xs">{t('tarih')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                                {t('bu_donemde_provizyon_kaydi_bulunmuyor')}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((r) => (
                                            <tr key={r.id} className="hover:bg-gray-700/50 text-sm">
                                                <td className="px-3 py-2">
                                                    <span className="text-white font-mono text-xs">#{r.orderNumber || r.orderId.slice(0, 6)}</span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="text-gray-300 text-xs">{courierLabels[r.courierType] || r.courierType}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-white">€{r.orderTotal.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right text-gray-400">%{r.commissionRate}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <span className="text-amber-400 font-bold">€{r.totalCommission.toFixed(2)}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <span className="text-gray-300 text-xs">
                                                        €{r.netCommission.toFixed(2)} + €{r.vatAmount.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${r.paymentMethod === 'card' || r.paymentMethod === 'stripe' ? 'bg-blue-600/30 text-blue-300' : 'bg-purple-600/30 text-purple-300'}`}>
                                                        {r.paymentMethod === 'card' || r.paymentMethod === 'stripe' ? '💳 Kart' : '💵 Nakit'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusColors[r.collectionStatus]}`}>
                                                        {statusLabels[r.collectionStatus]}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center text-gray-400 text-xs">
                                                    {r.createdAt.toLocaleDateString('de-DE')}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {/* Summary footer */}
                            {filteredRecords.length > 0 && (
                                <div className="bg-gray-900 border-t-2 border-gray-600 px-4 py-3 flex items-center justify-between">
                                    <span className="text-white font-bold text-sm">
                                        {t('toplam')} {filteredRecords.length} {t('siparis')}
                                    </span>
                                    <div className="flex gap-6">
                                        <span className="text-white text-sm">Ciro: <strong>€{stats.totalOrderAmount.toFixed(2)}</strong></span>
                                        <span className="text-amber-400 text-sm">Provizyon: <strong>€{stats.totalCommission.toFixed(2)}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Info Note */}
                <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <p className="text-gray-400 text-xs leading-relaxed">
                        {t('kart_ile_yapilan_odemelerde_provizyon_ot')} <span className="text-blue-400">info@lokma.shop</span> adresine yazabilirsiniz.
                    </p>
                </div>
            </div>
        </div>
    );
}
