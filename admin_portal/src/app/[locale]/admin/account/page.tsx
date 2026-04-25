'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, orderBy, getDocs, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency } from '@/utils/currency';
import AbonelikTabContent from '../business/[id]/AbonelikTabContent';
import { subscriptionService } from '@/services/subscriptionService';
import { toast } from 'react-hot-toast';

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

const statusColors: Record<string, string> = {
 auto_collected: 'bg-green-600',
 pending: 'bg-yellow-600',
 invoiced: 'bg-blue-600',
 paid: 'bg-emerald-600',
};

export default function HesabimPage() {
 const t = useTranslations('AdminAccount');
 const tSub = useTranslations('AdminBusiness');
 const locale = useLocale();

 const courierLabels: Record<string, string> = {
 click_collect: t('click_collect'),
 own_courier: t('kendi_kurye'),
 lokma_courier: t('lokma_kurye'),
 };

 const statusLabels: Record<string, string> = {
 auto_collected: t('otomatik_tahsil'),
 pending: t('bekleyen'),
 invoiced: t('faturalandi'),
 paid: t('odendi'),
 };

 const { admin, loading: adminLoading } = useAdmin();
 const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'billing'>('overview');
 const [records, setRecords] = useState<CommissionRecord[]>([]);
 const [businessDocData, setBusinessDocData] = useState<any | null>(null);
 const [availablePlans, setAvailablePlans] = useState<any[]>([]);
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

 // Load full business data & plans
 const loadBusinessData = useCallback(async () => {
 if (!businessId) return;
 try {
 const businessDoc = await getDoc(doc(db, 'businesses', businessId));
 if (businessDoc.exists()) {
 const data = businessDoc.data();
 setBusinessDocData({ id: businessDoc.id, ...data });

 // Fetch plans for this business category
 if (data.category) {
 const plans = await subscriptionService.getAllPlans(data.category);
 setAvailablePlans(plans);
 }
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

 const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
 if (type === 'success') toast.success(msg);
 else toast.error(msg);
 };

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
 const monthlyOrders = businessDocData?.usage?.orders?.[currentMonthKey] || 0;
 const monthlyCommission = businessDocData?.usage?.totalCommission?.[currentMonthKey] || 0;

 if (adminLoading || loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
 </div>
 );
 }

 if (!businessId) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="bg-card rounded-2xl p-8 max-w-md text-center">
 <span className="text-5xl mb-4 block">🏪</span>
 <h2 className="text-xl font-bold text-foreground mb-2">{t('i_sletme_bulunamadi')}</h2>
 <p className="text-muted-foreground">{t('hesabiniza_bagli_bir_isletme_bulunmuyor_')}</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background pb-20">
 <div className="max-w-7xl mx-auto px-4 py-6">
 {/* Page Header */}
 <div className="flex justify-between items-center mb-6">
 <div>
 <h1 className="text-2xl font-bold text-foreground">{t('hesabim')}</h1>
 <p className="text-muted-foreground text-sm">{businessName} {t('provizyon_ve_bakiye_takibi')}</p>
 </div>
 <button
 onClick={() => { loadRecords(); loadBusinessData(); }}
 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm transition"
 >
 🔄 {t('yenile')}
 </button>
 </div>

 {/* Navigation Tabs */}
 <div className="flex overflow-x-auto gap-2 mb-6 bg-card/50 p-1.5 rounded-xl border border-border">
 <button
 onClick={() => setActiveTab('overview')}
 className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-all rounded-lg ${
 activeTab === 'overview' ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-gray-700/50'
 }`}
 >
 📊 {t('provizyon_ozeti')}
 </button>
 <button
 onClick={() => setActiveTab('subscription')}
 className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-all rounded-lg ${
 activeTab === 'subscription' ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-gray-700/50'
 }`}
 >
 📋 {tSub('uyelikAbonelik') || 'Üyelik & Abonelik'}
 </button>
 <button
 onClick={() => setActiveTab('billing')}
 className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-all rounded-lg ${
 activeTab === 'billing' ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-gray-700/50'
 }`}
 >
 {t('fatura_ve_odeme')}
 </button>
 </div>

 {activeTab === 'overview' && (
 <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
 {/* Account Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 {/* Balance Card */}
 <div className="bg-gradient-to-br from-amber-600/30 to-amber-50 dark:to-amber-800/20 border border-amber-500/30 rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <span className="text-3xl">💰</span>
 <div>
 <p className="text-muted-foreground text-xs uppercase tracking-wider">{t('acik_bakiye')}</p>
 <p className={`text-3xl font-bold ${(businessDocData?.accountBalance || 0) > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-green-800 dark:text-green-400'}`}>
 {formatCurrency((businessDocData?.accountBalance || 0), businessDocData?.currency)}
 </p>
 </div>
 </div>
 <p className="text-muted-foreground text-xs">
 {(businessDocData?.accountBalance || 0) > 0
 ? t('odenmesi_gereken_nakit_provizyon_bakiyen')
 : t('bakiye_temiz')}
 </p>
 </div>

 {/* Plan Card */}
 <div className="bg-gradient-to-br from-indigo-600/30 to-indigo-50 dark:to-indigo-800/20 border border-indigo-500/30 rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <span className="text-3xl">📋</span>
 <div>
 <p className="text-muted-foreground text-xs uppercase tracking-wider">{t('mevcut_plan')}</p>
 <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-400 capitalize">
 {businessDocData?.subscriptionPlan || businessDocData?.plan || 'Free'}
 </p>
 </div>
 </div>
 <p className="text-muted-foreground text-xs">
 {t('aylik_ucret')}{formatCurrency(businessDocData?.monthlyFee || 0, businessDocData?.currency)}
 </p>
 </div>

 {/* Monthly Usage Card */}
 <div className="bg-gradient-to-br from-cyan-600/30 to-cyan-50 dark:to-cyan-800/20 border border-cyan-500/30 rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <span className="text-3xl">📊</span>
 <div>
 <p className="text-muted-foreground text-xs uppercase tracking-wider">{t('bu_ay')}</p>
 <p className="text-2xl font-bold text-cyan-800 dark:text-cyan-400">
 {monthlyOrders} {t('siparis')}
 </p>
 </div>
 </div>
 <p className="text-muted-foreground text-xs">
 {t('toplam_provizyon')}{formatCurrency(monthlyCommission, businessDocData?.currency)}
 </p>
 </div>
 </div>

 {/* Commission Stats */}
 <div className="bg-card rounded-2xl p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-bold text-foreground">{t('provizyon_ozeti')}</h2>
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
 <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
 <p className="text-muted-foreground text-xs">{t('siparisler')}</p>
 </div>
 <div className="bg-gray-700/50 rounded-xl p-4 text-center">
 <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalOrderAmount, businessDocData?.currency)}</p>
 <p className="text-muted-foreground text-xs">{t('toplam_ciro')}</p>
 </div>
 <div className="bg-amber-600/20 border border-amber-600/30 rounded-xl p-4 text-center">
 <p className="text-2xl font-bold text-amber-800 dark:text-amber-400">{formatCurrency(stats.totalCommission, businessDocData?.currency)}</p>
 <p className="text-muted-foreground text-xs">{t('provizyon')}</p>
 </div>
 <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 text-center">
 <p className="text-2xl font-bold text-green-800 dark:text-green-400">{formatCurrency(stats.collectedAmount, businessDocData?.currency)}</p>
 <p className="text-muted-foreground text-xs">{t('tahsil_edilen')}</p>
 </div>
 <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-xl p-4 text-center">
 <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-400">{formatCurrency(stats.pendingAmount, businessDocData?.currency)}</p>
 <p className="text-muted-foreground text-xs">{t('bekleyen')}</p>
 </div>
 <div className="bg-gray-700/50 rounded-xl p-4 text-center">
 <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.vatTotal, businessDocData?.currency)}</p>
 <p className="text-muted-foreground text-xs">{t('kdv')}</p>
 </div>
 </div>

 {/* Payment breakdown */}
 <div className="mt-4 flex gap-4">
 <div className="flex items-center gap-2 bg-blue-600/10 border border-blue-600/20 rounded-lg px-4 py-2">
 <span>💳</span>
 <span className="text-blue-800 dark:text-blue-400 text-sm font-medium">{stats.cardOrders} {t('kart')}</span>
 <span className="text-muted-foreground/80 text-sm">— {formatCurrency(stats.cardCommission, businessDocData?.currency)}</span>
 </div>
 <div className="flex items-center gap-2 bg-purple-600/10 border border-purple-600/20 rounded-lg px-4 py-2">
 <span>💵</span>
 <span className="text-purple-800 dark:text-purple-400 text-sm font-medium">{stats.cashOrders} {t('nakit')}</span>
 <span className="text-muted-foreground/80 text-sm">— {formatCurrency(stats.cashCommission, businessDocData?.currency)}</span>
 </div>
 </div>
 </div>

 {/* Detail Records Toggle */}
 <div className="bg-card rounded-2xl overflow-hidden mb-6">
 <button
 onClick={() => setShowDetail(!showDetail)}
 className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-700/50 transition"
 >
 <h2 className="text-lg font-bold text-foreground">{t('siparis_bazli_detay')}</h2>
 <span className={`text-muted-foreground text-2xl transition-transform ${showDetail ? 'rotate-180' : ''}`}>
 ▼
 </span>
 </button>

 {showDetail && (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-700">
 <tr>
 <th className="px-3 py-3 text-left text-foreground text-xs">{t('siparis')}</th>
 <th className="px-3 py-3 text-center text-foreground text-xs">{t('teslimat')}</th>
 <th className="px-3 py-3 text-right text-foreground text-xs">{t('tutar')}</th>
 <th className="px-3 py-3 text-right text-foreground text-xs">{t('oran')}</th>
 <th className="px-3 py-3 text-right text-foreground text-xs">{t('provizyon')}</th>
 <th className="px-3 py-3 text-right text-foreground text-xs">{t('net_kdv')}</th>
 <th className="px-3 py-3 text-center text-foreground text-xs">{t('odeme')}</th>
 <th className="px-3 py-3 text-center text-foreground text-xs">{t('durum')}</th>
 <th className="px-3 py-3 text-center text-foreground text-xs">{t('tarih')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {filteredRecords.length === 0 ? (
 <tr>
 <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground/80">
 {t('bu_donemde_provizyon_kaydi_bulunmuyor')}
 </td>
 </tr>
 ) : (
 filteredRecords.map((r) => (
 <tr key={r.id} className="hover:bg-gray-700/50 text-sm">
 <td className="px-3 py-2">
 <span className="text-foreground font-mono text-xs">#{r.orderNumber || r.orderId.slice(0, 6)}</span>
 </td>
 <td className="px-3 py-2 text-center">
 <span className="text-foreground text-xs">{courierLabels[r.courierType] || r.courierType}</span>
 </td>
 <td className="px-3 py-2 text-right text-white">{formatCurrency(r.orderTotal, businessDocData?.currency)}</td>
 <td className="px-3 py-2 text-right text-muted-foreground">%{r.commissionRate}</td>
 <td className="px-3 py-2 text-right">
 <span className="text-amber-800 dark:text-amber-400 font-bold">{formatCurrency(r.totalCommission, businessDocData?.currency)}</span>
 </td>
 <td className="px-3 py-2 text-right">
 <span className="text-foreground text-xs">
 {formatCurrency(r.netCommission, businessDocData?.currency)} + {formatCurrency(r.vatAmount, businessDocData?.currency)}
 </span>
 </td>
 <td className="px-3 py-2 text-center">
 <span className={`px-2 py-0.5 rounded text-xs ${r.paymentMethod === 'card' || r.paymentMethod === 'stripe' ? 'bg-blue-600/30 text-blue-300' : 'bg-purple-600/30 text-purple-300'}`}>
 {r.paymentMethod === 'card' || r.paymentMethod === 'stripe' ? `💳 ${t('kart')}` : `💵 ${t('nakit')}`}
 </span>
 </td>
 <td className="px-3 py-2 text-center">
 <span className={`px-2 py-0.5 rounded-full text-xs text-white ${statusColors[r.collectionStatus]}`}>
 {statusLabels[r.collectionStatus]}
 </span>
 </td>
 <td className="px-3 py-2 text-center text-muted-foreground text-xs">
 {r.createdAt.toLocaleDateString(locale)}
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 {/* Summary footer */}
 {filteredRecords.length > 0 && (
 <div className="bg-background border-t-2 border-gray-600 px-4 py-3 flex items-center justify-between">
 <span className="text-foreground font-bold text-sm">
 {t('toplam')} {filteredRecords.length} {t('siparis')}
 </span>
 <div className="flex gap-6">
 <span className="text-foreground text-sm">{t('ciro')}: <strong>{formatCurrency(stats.totalOrderAmount, businessDocData?.currency)}</strong></span>
 <span className="text-amber-800 dark:text-amber-400 text-sm">{t('provizyon')}: <strong>{formatCurrency(stats.totalCommission, businessDocData?.currency)}</strong></span>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Info Note */}
 <div className="bg-card/50 border border-border rounded-xl p-4">
 <p className="text-muted-foreground text-xs leading-relaxed">
 {t('kart_ile_yapilan_odemelerde_provizyon_ot')} <span className="text-blue-800 dark:text-blue-400">info@lokma.shop</span> {t('iletisim_son')}.
 </p>
 </div>
 </div>
 )}

 {activeTab === 'subscription' && (
 <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
 <AbonelikTabContent
 business={businessDocData}
 availablePlans={availablePlans}
 admin={admin}
 t={tSub}
 showToast={showToast}
 setBusiness={setBusinessDocData}
 />
 </div>
 )}

 {activeTab === 'billing' && (
 <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
 <div className="bg-card rounded-2xl p-8 mb-6 border border-border text-center flex flex-col items-center">
 <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
 <span className="text-3xl">🏦</span>
 </div>
 <h3 className="text-xl font-bold text-foreground mb-2">{t('odeme_alma_stripe')}</h3>
 <p className="text-muted-foreground text-sm max-w-lg mb-6">
 {t('stripe_aciklama')}
 </p>
 {businessDocData?.stripeAccountId ? (
 <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 w-full max-w-md">
 <p className="text-green-500 font-bold mb-1 flex items-center justify-center gap-2">
 <span>✅</span> {t('stripe_bagli')}
 </p>
 <p className="text-muted-foreground text-xs mb-3">{t('hesap_id')} {businessDocData.stripeAccountId}</p>
 <button className="px-4 py-2 bg-muted hover:bg-gray-700 text-foreground font-medium rounded-lg text-sm w-full transition">
 {t('stripe_panele_git')}
 </button>
 </div>
 ) : (
 <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-lg shadow-blue-500/20">
 {t('stripe_olustur_bagla')}
 </button>
 )}
 </div>

 <div className="bg-card rounded-2xl p-6 border border-border">
 <h3 className="text-lg font-bold text-foreground mb-4">{t('aylik_fatura_gecmisi')}</h3>
 <div className="text-center py-12 bg-background/50 rounded-xl border border-border/50">
 <span className="text-4xl block mb-3 opacity-50">🧾</span>
 <p className="text-muted-foreground text-sm">{t('henuz_fatura_yok')}</p>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
