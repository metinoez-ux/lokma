'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { limitService } from '@/services/limitService';
import { invoiceService } from '@/services/invoiceService';
import { subscriptionService } from '@/services/subscriptionService';
import { ButcherSubscriptionPlan } from '@/types';

// Helper: Generate display features list from a Firestore plan
function getPlanFeatures(plan: ButcherSubscriptionPlan): string[] {
    const features: string[] = [];
    if (plan.orderLimit) features.push(`${plan.orderLimit} sipariş/ay`);
    else features.push('Sınırsız sipariş');
    if (plan.features?.delivery) features.push('Kurye hizmeti');
    if (plan.features?.onlinePayment) features.push('Online ödeme');
    if (plan.features?.campaigns) features.push('Kampanyalar');
    if (plan.features?.prioritySupport) features.push('Öncelikli destek');
    if (plan.features?.liveCourierTracking) features.push('Canlı kurye takibi');
    return features;
}

// Helper: Get plan icon from plan code/name
function getPlanIcon(plan: ButcherSubscriptionPlan): string {
    const code = (plan.code || plan.id || '').toLowerCase();
    if (code.includes('free') || code.includes('market')) return '🆓';
    if (code.includes('basic') || code.includes('entry')) return '📦';
    if (code.includes('pro')) return '🚀';
    if (code.includes('ultra') || code.includes('enterprise')) return '👑';
    if (code.includes('premium')) return '💎';
    if (code.includes('standard') || code.includes('starter')) return '⭐';
    return '📋';
}

export default function AccountPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [admin, setAdmin] = useState<any>(null);
    const [business, setBusiness] = useState<any>(null);
    const [livePlan, setLivePlan] = useState<ButcherSubscriptionPlan | null>(null); // Firestore'dan gelen aktif plan
    const [allPlans, setAllPlans] = useState<ButcherSubscriptionPlan[]>([]); // All active plans for modal
    const [usageStats, setUsageStats] = useState<any>(null); // limitService'den
    const [estimatedInvoice, setEstimatedInvoice] = useState<any>(null); // invoiceService'den
    const [stats, setStats] = useState({
        totalOrders: 0,
        monthlyOrders: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        accruedCommission: 0,
        paidCommission: 0,
        pushUsed: 0,
    });
    const [invoices, setInvoices] = useState<any[]>([]);
    const [commissionRecords, setCommissionRecords] = useState<any[]>([]);
    const [commissionSummary, setCommissionSummary] = useState({
        totalCommission: 0,
        cardCommission: 0,
        cashCommission: 0,
        pendingAmount: 0,
        collectedAmount: 0,
        orderCount: 0,
    });
    const [showBankModal, setShowBankModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [bankForm, setBankForm] = useState({
        iban: '',
        bic: '',
        accountHolder: '',
        bankName: '',
    });
    const [saving, setSaving] = useState(false);

    // ═══════════════════════════════════════════════════════════════════
    // AUTH & DATA LOADING
    // ═══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // Admin bilgisi
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (!adminDoc.exists()) {
                    router.push('/login');
                    return;
                }
                const adminData = { id: adminDoc.id, ...adminDoc.data() };
                setAdmin(adminData);

                // İşletme bilgisi
                if ((adminData as any).butcherId) {
                    const businessDoc = await getDoc(doc(db, 'businesses', (adminData as any).butcherId));
                    if (businessDoc.exists()) {
                        const businessData = { id: businessDoc.id, ...businessDoc.data() };
                        setBusiness(businessData);

                        // Banka formu doldur
                        const bankInfo = (businessData as any).bankInfo || {};
                        setBankForm({
                            iban: bankInfo.iban || '',
                            bic: bankInfo.bic || '',
                            accountHolder: bankInfo.accountHolder || '',
                            bankName: bankInfo.bankName || '',
                        });

                        // İstatistikleri yükle
                        await loadStats((adminData as any).butcherId, businessData);

                        // ═══ YENİ: Canlı Servislerden Veri Al ═══
                        // Aktif plan bilgisi
                        const planId = (businessData as any).subscriptionPlan || (businessData as any).plan || 'free';
                        const plans = await subscriptionService.getAllPlans();
                        setAllPlans(plans.filter(p => p.isActive));
                        const activePlan = plans.find(p => p.id === planId || p.code === planId);
                        if (activePlan) setLivePlan(activePlan);

                        // Kullanım istatistikleri (limitService)
                        const usage = await limitService.getUsageStats(businessDoc.id);
                        setUsageStats(usage);

                        // Tahmini fatura (invoiceService)
                        const estimated = await invoiceService.getEstimatedInvoice(businessDoc.id);
                        setEstimatedInvoice(estimated);
                    }
                }

                // Son faturalar + komisyon kayıtları
                await loadInvoices((adminData as any).butcherId);
                await loadCommissionRecords((adminData as any).butcherId);
            } catch (error) {
                console.error('Veri yükleme hatası:', error);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const loadStats = async (butcherId: string, businessData: any) => {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const ordersRef = collection(db, 'meat_orders');
            const ordersQuery = query(ordersRef, where('businessId', '==', butcherId));
            const ordersSnap = await getDocs(ordersQuery);

            let totalRevenue = 0;
            let monthlyRevenue = 0;
            let monthlyOrders = 0;

            ordersSnap.forEach(doc => {
                const data = doc.data();
                const orderDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
                const orderTotal = data.total || data.grandTotal || 0;

                totalRevenue += orderTotal;

                if (orderDate >= startOfMonth) {
                    monthlyOrders++;
                    monthlyRevenue += orderTotal;
                }
            });

            const plan = businessData?.plan || 'free';
            const commissionRate = livePlan?.commissionClickCollect || 5.0;
            const accruedCommission = totalRevenue * (commissionRate / 100);

            setStats({
                totalOrders: ordersSnap.size,
                monthlyOrders,
                totalRevenue,
                monthlyRevenue,
                accruedCommission,
                paidCommission: businessData?.paidCommission || 0,
                pushUsed: businessData?.pushUsed || 0,
            });
        } catch (error) {
            console.error('Stats yükleme hatası:', error);
        }
    };

    const loadInvoices = async (butcherId: string) => {
        try {
            const invoicesQuery = query(
                collection(db, 'invoices'),
                where('businessId', '==', butcherId),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const invoicesSnap = await getDocs(invoicesQuery);
            setInvoices(invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch {
            // Index yoksa boş bırak
            setInvoices([]);
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // KOMİSYON KAYITLARI
    // ═══════════════════════════════════════════════════════════════════
    const loadCommissionRecords = async (butcherId: string) => {
        try {
            const now = new Date();
            const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const commQuery = query(
                collection(db, 'commission_records'),
                where('businessId', '==', butcherId),
                where('period', '==', currentPeriod),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(commQuery);
            const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCommissionRecords(records);

            // Summary
            let totalCommission = 0, cardCommission = 0, cashCommission = 0, pendingAmount = 0, collectedAmount = 0;
            records.forEach((r: any) => {
                totalCommission += r.totalCommission || 0;
                const isCard = r.paymentMethod === 'card' || r.paymentMethod === 'stripe';
                if (isCard) {
                    cardCommission += r.totalCommission || 0;
                    collectedAmount += r.totalCommission || 0;
                } else {
                    cashCommission += r.totalCommission || 0;
                    if (r.collectionStatus === 'pending') {
                        pendingAmount += r.totalCommission || 0;
                    } else {
                        collectedAmount += r.totalCommission || 0;
                    }
                }
            });
            setCommissionSummary({ totalCommission, cardCommission, cashCommission, pendingAmount, collectedAmount, orderCount: records.length });
        } catch (error) {
            console.error('Komisyon kayıtları yükleme hatası:', error);
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    // BANKA BİLGİSİ KAYDET
    // ═══════════════════════════════════════════════════════════════════
    const handleSaveBank = async () => {
        if (!business?.id) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'businesses', business.id), {
                bankInfo: bankForm,
                updatedAt: new Date(),
            });
            setBusiness({ ...business, bankInfo: bankForm });
            setShowBankModal(false);
            alert('Banka bilgileri kaydedildi!');
        } catch (error) {
            console.error('Banka kaydetme hatası:', error);
            alert('Kaydetme hatası!');
        }
        setSaving(false);
    };

    // ═══════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const currentPlan = business?.subscriptionPlan || business?.plan || 'free';
    // Derive display info from livePlan (Firestore) instead of hardcoded PLANS
    const planName = livePlan?.name || currentPlan;
    const planPrice = livePlan?.monthlyFee ?? 0;
    const planOrderLimit = livePlan?.orderLimit ?? usageStats?.orderLimit ?? 50;
    const planColor = livePlan?.color?.replace('bg-', '').replace('-600', '') || 'gray';
    const planIcon = livePlan ? getPlanIcon(livePlan) : '🆓';
    const planFeatures = livePlan ? getPlanFeatures(livePlan) : ['Temel özellikler'];
    const pushLimit = usageStats?.pushLimit ?? 0;
    const pushRemaining = pushLimit === 0 ? '∞' : Math.max(0, pushLimit - stats.pushUsed);
    const orderProgress = planOrderLimit === null ? 0 : (stats.monthlyOrders / (planOrderLimit || 1)) * 100;

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* ═══════════════════════════════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            💼 Hesabım
                        </h1>
                        <p className="text-gray-400 mt-1">
                            {business?.companyName || business?.brand || 'İşletme'} - Plan ve fatura yönetimi
                        </p>
                    </div>
                    <Link href="/admin/orders" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                        ← Panele Dön
                    </Link>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    AKTİF PLAN KARTI
                ═══════════════════════════════════════════════════════════════════ */}
                <div className={`bg-gradient-to-r from-${planColor}-900/60 to-${planColor}-800/40 border border-${planColor}-500/40 rounded-2xl p-6 mb-6`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Aktif Planınız</p>
                            <h2 className="text-4xl font-bold text-white flex items-center gap-3">
                                <span>{planIcon}</span>
                                {planName}
                            </h2>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {planFeatures.map((f, i) => (
                                    <span key={i} className="px-3 py-1 bg-white/10 text-white/90 text-sm rounded-full">
                                        ✓ {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-400 text-sm">Aylık Ücret</p>
                            <p className="text-4xl font-bold text-white">
                                €{planPrice.toFixed(2)}
                            </p>
                            <button
                                onClick={() => setShowPlanModal(true)}
                                className="mt-3 px-5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition"
                            >
                                🔄 Plan Değiştir
                            </button>
                        </div>
                    </div>

                    {/* Kullanım Barları */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                        {/* Sipariş Kullanımı */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300">Bu Ay Sipariş</span>
                                <span className="text-white font-bold">
                                    {stats.monthlyOrders} / {planOrderLimit === null ? '∞' : planOrderLimit}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3">
                                <div
                                    className={`h-3 rounded-full transition-all ${orderProgress > 90 ? 'bg-red-500' : orderProgress > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(100, orderProgress)}%` }}
                                />
                            </div>
                        </div>
                        {/* Push Kullanımı */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300">Push Bildirim</span>
                                <span className="text-white font-bold">
                                    {stats.pushUsed} / {pushLimit === 0 ? '∞' : pushLimit}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3">
                                <div
                                    className="h-3 rounded-full bg-blue-500 transition-all"
                                    style={{ width: pushLimit === 0 ? '5%' : `${Math.min(100, (stats.pushUsed / pushLimit) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    İSTATİSTİK KARTLARI
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">Bu Ay Sipariş</p>
                        <p className="text-3xl font-bold text-white">{stats.monthlyOrders}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">Toplam Sipariş</p>
                        <p className="text-3xl font-bold text-white">{stats.totalOrders}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">Bu Ay Ciro</p>
                        <p className="text-3xl font-bold text-green-400">€{stats.monthlyRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">Toplam Ciro</p>
                        <p className="text-3xl font-bold text-green-400">€{stats.totalRevenue.toFixed(2)}</p>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    PROVİZYON & TAHMİNİ FATURA
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Provizyon - Dinamik Kurye Bazlı */}
                    <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-amber-200 mb-4 flex items-center gap-2">
                            💰 Kurye Bazlı Provizyon
                        </h3>
                        <div className="space-y-3">
                            {livePlan ? (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-green-900/40 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-400">🛒 Gel-Al</p>
                                            <p className="text-xl font-bold text-green-400">%{livePlan.commissionClickCollect || 5}</p>
                                        </div>
                                        <div className="bg-blue-900/40 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-400">🚗 Kendi</p>
                                            <p className="text-xl font-bold text-blue-400">%{livePlan.commissionOwnCourier || 4}</p>
                                        </div>
                                        <div className="bg-purple-900/40 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-400">🛵 LOKMA</p>
                                            <p className="text-xl font-bold text-purple-400">%{livePlan.commissionLokmaCourier || 7}</p>
                                        </div>
                                    </div>
                                    {livePlan.freeOrderCount > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-900/30 rounded-lg px-3 py-2">
                                            🎁 İlk {livePlan.freeOrderCount} sipariş ücretsiz!
                                        </div>
                                    )}
                                    {livePlan.perOrderFeeType && livePlan.perOrderFeeType !== 'none' && livePlan.perOrderFeeAmount > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-amber-400">
                                            💵 Sipariş başı: {livePlan.perOrderFeeType === 'percentage' ? `%${livePlan.perOrderFeeAmount}` : `€${livePlan.perOrderFeeAmount}`}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">Provizyon Oranı</span>
                                    <span className="text-xl font-bold text-white">%5</span>
                                </div>
                            )}
                            <hr className="border-amber-700/50" />
                            {(() => {
                                // Derive commission data from estimatedInvoice for consistency
                                const commLine = estimatedInvoice?.lineItems?.find((item: any) => item.type === 'commission');
                                const commOrderCount = commLine?.quantity || commissionSummary.orderCount;
                                const commTotal = commLine?.total || commissionSummary.totalCommission;
                                return (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-300">Bu Ay Komisyon ({commOrderCount} sipariş)</span>
                                            <span className="text-xl font-bold text-amber-400">€{commTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">💳 Kart</span>
                                                <span className="text-blue-400">€{commissionSummary.cardCommission.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">💵 Nakit</span>
                                                <span className="text-purple-400">€{commissionSummary.cashCommission.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            {(business?.accountBalance || 0) > 0 && (
                                <div className="bg-red-900/40 border border-red-600/40 rounded-lg p-3 flex justify-between items-center">
                                    <span className="text-red-300 text-sm">📌 Açık Bakiye (Nakit Komisyon)</span>
                                    <span className="text-xl font-bold text-red-400">€{(business?.accountBalance || 0).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tahmini Fatura Önizleme */}
                    <div className="bg-indigo-900/30 border border-indigo-600/40 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-indigo-200 mb-4 flex items-center gap-2">
                            🧾 Tahmini Aylık Fatura
                        </h3>
                        {estimatedInvoice ? (
                            <div className="space-y-2">
                                {estimatedInvoice.lineItems?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-300">{item.description}</span>
                                        <span className="text-white font-medium">€{item.total.toFixed(2)}</span>
                                    </div>
                                ))}
                                <hr className="border-indigo-700/50" />
                                <div className="flex justify-between">
                                    <span className="text-gray-300">Ara Toplam</span>
                                    <span className="text-white font-bold">€{estimatedInvoice.subtotal?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">KDV (%{estimatedInvoice.taxRate})</span>
                                    <span className="text-gray-300">€{estimatedInvoice.tax?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-indigo-700/50">
                                    <span className="text-lg font-bold text-white">TOPLAM</span>
                                    <span className="text-2xl font-bold text-indigo-400">€{estimatedInvoice.total?.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-gray-400">Bu ay henüz işlem yok</p>
                                <p className="text-3xl font-bold text-indigo-400 mt-2">€0.00</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    STRIPE CONNECT - BANKA HESABI
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/40 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            💳 Ödeme Alma - Stripe Connect
                        </h3>
                        {business?.stripeAccountStatus === 'active' && (
                            <span className="px-3 py-1 bg-green-500/30 text-green-300 text-sm rounded-full">
                                ✓ Aktif
                            </span>
                        )}
                    </div>

                    {business?.stripeAccountId && business?.stripeAccountStatus === 'active' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/5 rounded-lg p-4">
                                    <p className="text-gray-400 text-xs mb-1">Stripe Hesap ID</p>
                                    <p className="text-white font-mono">{business.stripeAccountId}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4">
                                    <p className="text-gray-400 text-xs mb-1">Durum</p>
                                    <p className="text-green-400 font-semibold">🟢 Ödemeler Aktif</p>
                                </div>
                            </div>
                            <p className="text-gray-400 text-sm">
                                Müşterilerden online ödeme alabilir, kazançlarınız otomatik olarak banka hesabınıza aktarılır.
                            </p>
                        </div>
                    ) : business?.stripeAccountId && business?.stripeAccountStatus === 'pending' ? (
                        <div className="text-center py-4">
                            <div className="animate-pulse text-yellow-400 text-4xl mb-3">⏳</div>
                            <p className="text-yellow-200 font-semibold">Doğrulama Bekliyor</p>
                            <p className="text-gray-400 text-sm mt-2">
                                Stripe hesabınız oluşturuldu. Banka bilgilerinizi tamamlayın.
                            </p>
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/stripe-connect', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                businessId: business.id,
                                                email: admin?.email || business.email,
                                                businessName: business.companyName || business.brand || 'İşletme',
                                            })
                                        });
                                        const data = await res.json();
                                        if (data.onboardingUrl) {
                                            window.location.href = data.onboardingUrl;
                                        }
                                    } catch (err) {
                                        console.error('Stripe Connect error:', err);
                                    }
                                }}
                                className="mt-4 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium"
                            >
                                📝 Doğrulamayı Tamamla
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="text-5xl mb-4">🏦</div>
                            <h4 className="text-xl font-bold text-white mb-2">Online Ödeme Almaya Başlayın</h4>
                            <p className="text-gray-400 mb-6 max-w-md mx-auto">
                                Stripe ile banka hesabınızı bağlayın. Müşterilerinizden güvenli online ödeme alın,
                                kazançlarınız otomatik olarak hesabınıza aktarılsın.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button
                                    onClick={async () => {
                                        try {
                                            setSaving(true);
                                            const res = await fetch('/api/stripe-connect', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    businessId: business?.id,
                                                    email: admin?.email || business?.email,
                                                    businessName: business?.companyName || business?.brand || 'İşletme',
                                                })
                                            });
                                            const data = await res.json();
                                            if (data.onboardingUrl) {
                                                window.location.href = data.onboardingUrl;
                                            } else {
                                                alert(data.error || 'Bir hata oluştu');
                                            }
                                        } catch (err) {
                                            console.error('Stripe Connect error:', err);
                                            alert('Bağlantı hatası');
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                    disabled={saving}
                                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50"
                                >
                                    {saving ? '⏳ Bağlanıyor...' : '🚀 Stripe ile Banka Bağla'}
                                </button>
                            </div>
                            <p className="text-gray-500 text-xs mt-4">
                                🔒 256-bit SSL şifrelemesi ile güvende. Stripe'ın güvenli altyapısı.
                            </p>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    SON FATURALAR
                ═══════════════════════════════════════════════════════════════════ */}
                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">📄 Son Faturalar</h3>
                        <Link href="/admin/invoices" className="text-blue-400 hover:text-blue-300 text-sm">
                            Tümünü Gör →
                        </Link>
                    </div>

                    {invoices.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Henüz fatura bulunmuyor.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="text-left text-gray-400 text-sm border-b border-gray-700">
                                    <tr>
                                        <th className="pb-3">Fatura No</th>
                                        <th className="pb-3">Dönem</th>
                                        <th className="pb-3 text-right">Tutar</th>
                                        <th className="pb-3 text-center">Durum</th>
                                        <th className="pb-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {invoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-700/30">
                                            <td className="py-3 text-white font-mono">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                                            <td className="py-3 text-gray-300">{inv.period || '-'}</td>
                                            <td className="py-3 text-right text-white font-bold">€{(inv.grandTotal || 0).toFixed(2)}</td>
                                            <td className="py-3 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs ${inv.status === 'paid' ? 'bg-green-600/30 text-green-400' :
                                                    inv.status === 'pending' ? 'bg-yellow-600/30 text-yellow-400' :
                                                        'bg-gray-600/30 text-gray-400'
                                                    }`}>
                                                    {inv.status === 'paid' ? 'Ödendi' : inv.status === 'pending' ? 'Bekliyor' : inv.status}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                {inv.pdfUrl && (
                                                    <a href={inv.pdfUrl} target="_blank" className="text-blue-400 hover:text-blue-300 text-sm">
                                                        PDF
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                BANKA BİLGİSİ MODAL
            ═══════════════════════════════════════════════════════════════════ */}
            {showBankModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">🏦 Banka Bilgileri</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">IBAN *</label>
                                <input
                                    type="text"
                                    value={bankForm.iban}
                                    onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
                                    placeholder="DE89 3704 0044 0532 0130 00"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">BIC / SWIFT</label>
                                <input
                                    type="text"
                                    value={bankForm.bic}
                                    onChange={(e) => setBankForm({ ...bankForm, bic: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
                                    placeholder="COBADEFFXXX"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Hesap Sahibi *</label>
                                <input
                                    type="text"
                                    value={bankForm.accountHolder}
                                    onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="Firma GmbH"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Banka Adı</label>
                                <input
                                    type="text"
                                    value={bankForm.bankName}
                                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="Commerzbank"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowBankModal(false)}
                                className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSaveBank}
                                disabled={saving || !bankForm.iban || !bankForm.accountHolder}
                                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                PLAN DEĞİŞTİRME MODAL
            ═══════════════════════════════════════════════════════════════════ */}
            {showPlanModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl my-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">🔄 Plan Değiştir</h2>
                            <button onClick={() => setShowPlanModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {allPlans.length > 0 ? allPlans.map((plan) => {
                                const isCurrentPlan = livePlan?.id === plan.id || currentPlan === plan.id || currentPlan === plan.code;
                                const icon = getPlanIcon(plan);
                                const features = getPlanFeatures(plan);
                                return (
                                    <div
                                        key={plan.id}
                                        className={`rounded-xl p-5 border-2 transition-all ${isCurrentPlan
                                            ? 'border-green-500 bg-green-900/20'
                                            : 'border-gray-700 hover:border-gray-500 bg-gray-700/30'
                                            }`}
                                    >
                                        <div className="text-center mb-4">
                                            <span className="text-3xl">{icon}</span>
                                            <h3 className="text-xl font-bold text-white mt-2">{plan.name}</h3>
                                            <p className="text-3xl font-bold text-white mt-2">
                                                €{plan.monthlyFee.toFixed(2)}
                                                <span className="text-sm text-gray-400">/ay</span>
                                            </p>
                                        </div>
                                        <ul className="space-y-2 mb-4 text-sm">
                                            {features.map((f, i) => (
                                                <li key={i} className="text-gray-300 flex items-center gap-2">
                                                    <span className="text-green-400">✓</span> {f}
                                                </li>
                                            ))}
                                            <li className="text-gray-400 flex items-center gap-2">
                                                <span>💰</span> %{plan.commissionClickCollect} provizyon
                                            </li>
                                        </ul>
                                        {isCurrentPlan ? (
                                            <div className="text-center py-2 bg-green-600/30 text-green-400 rounded-lg font-medium">
                                                ✓ Mevcut Plan
                                            </div>
                                        ) : (
                                            <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">
                                                Seç
                                            </button>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="col-span-3 text-center text-gray-400 py-8">
                                    Yükleniyor...
                                </div>
                            )}
                        </div>

                        <p className="text-gray-500 text-sm text-center mt-6">
                            Plan değişikliği bir sonraki fatura döneminde geçerli olur.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
