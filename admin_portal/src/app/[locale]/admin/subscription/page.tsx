'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/utils/currency';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscriptionService } from '@/services/subscriptionService';
import { ButcherSubscriptionPlan } from '@/types';
import { BUSINESS_TYPES } from '@/lib/business-types';

export default function SubscriptionPage() {

 const t = useTranslations('AdminSubscription');
 const { admin, loading: adminLoading } = useAdmin();

 const [business, setBusiness] = useState<any>(null);
 const [plan, setPlan] = useState<ButcherSubscriptionPlan | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const loadData = async () => {
 if (!admin?.butcherId) {
 setLoading(false);
 return;
 }
 
 try {
 const businessDoc = await getDoc(doc(db, 'businesses', admin.butcherId));
 if (businessDoc.exists()) {
 const bData = businessDoc.data();
 setBusiness(bData);
 
 const rawType = bData.types?.[0] || bData.type || '';
 const sectorCategory = rawType ? (BUSINESS_TYPES[rawType as keyof typeof BUSINESS_TYPES]?.category || rawType) : '';
 
 // Fetch plans. Pass sectorCategory, but the service should handle fallbacks
 let plans = await subscriptionService.getAllPlans(sectorCategory || undefined);
 
 // Fallback if no plans found for the specific sector (e.g. 'retail')
 if (plans.length === 0) {
 plans = await subscriptionService.getAllPlans('butcher'); // Default seeded plans
 }
 
 // Handle legacy plan codes
 const legacyMap: Record<string, string> = {
 'planFree': 'free',
 'planBasic': 'basic',
 'planPro': 'pro',
 'planUltra': 'ultra'
 };
 
 let currentPlanCode = bData.subscriptionPlan || 'free';
 if (legacyMap[currentPlanCode]) {
 currentPlanCode = legacyMap[currentPlanCode];
 }
 
 const currentPlan = plans.find(p => p.code === currentPlanCode || p.id === currentPlanCode);
 setPlan(currentPlan || null);
 }
 } catch (error) {
 console.error('Error loading subscription data:', error);
 } finally {
 setLoading(false);
 }
 };
 
 if (!adminLoading) {
 loadData();
 }
 }, [admin, adminLoading]);

 if (adminLoading || loading) return <div className="p-8 text-white">{t('yukleniyor') || 'Yükleniyor...'}</div>;

 if (!admin?.butcherId) {
 return <div className="p-8 text-white">{t('bu_sayfaya_erisim_yetkiniz_yok')}</div>;
 }

 const currentPlanName = plan ? plan.name : (business?.subscriptionPlan || 'Free').toUpperCase();
 const monthlyFee = (business?.monthlyFee && business.monthlyFee > 0) ? business.monthlyFee : (plan ? plan.monthlyFee : 0);
 const planColor = plan?.color || 'bg-gray-600';
 const colorClass = planColor.includes('text-') ? planColor : planColor + ' text-white';

 // ESL Mock Data (Rent-to-Own)
 const eslEnabled = plan?.features?.eslIntegration || false;
 const eslCount = 150;
 const eslUnitCost = 0.50;
 const eslTotal = eslCount * eslUnitCost;
 const ownershipMonth = 4; // Month 4 of 24

 return (
 <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
 <div className="max-w-6xl mx-auto">
 <h1 className="text-3xl font-bold mb-2">{t('abonelik_ve_odemeler')}</h1>
 <p className="text-muted-foreground mb-8">{t('planinizi_ve_faturalarinizi_buradan_yone')}</p>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
 {/* CURRENT PLAN CARD */}
 <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-border rounded-2xl p-8 shadow-xl relative overflow-hidden">
 <div className={`absolute top-0 left-0 w-full h-2 ${planColor}`}></div>
 <div className="flex justify-between items-start mb-6 mt-2">
 <div>
 <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">MEVCUT PLAN</p>
 <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mt-2">
 {currentPlanName}
 </h2>
 </div>
 <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>AKTİF</span>
 </div>

 <div className="flex items-baseline gap-1 mb-6">
 <span className="text-3xl font-bold">{formatCurrency(monthlyFee, admin?.currency)}</span>
 <span className="text-muted-foreground">/ay</span>
 </div>

 <div className="space-y-3 mb-8">
 {plan?.description && (
 <div className="mb-4 text-sm font-medium text-muted-foreground">
 {plan.description}
 </div>
 )}
 <div className="flex items-center gap-3 text-sm text-foreground">
 <span className={plan?.orderLimit === null ? "text-green-800 dark:text-green-400" : "text-amber-500"}>✓</span> 
 {plan?.orderLimit === null ? t('sinirsiz_siparis') : `Aylık ${plan?.orderLimit} Sipariş`}
 </div>
 <div className="flex items-center gap-3 text-sm text-foreground">
 <span className={plan?.productLimit === null ? "text-green-800 dark:text-green-400" : "text-amber-500"}>✓</span> 
 {plan?.productLimit === null ? 'Sınırsız Ürün Ekleme' : `Maksimum ${plan?.productLimit} Ürün`}
 </div>
 <div className="flex items-center gap-3 text-sm text-foreground">
 <span className={plan?.features?.delivery ? "text-green-800 dark:text-green-400" : "text-gray-500"}>
 {plan?.features?.delivery ? '✓' : '✕'}
 </span> 
 Kurye ile Teslimat {plan?.features?.delivery ? 'Aktif' : 'Yok'}
 </div>
 {plan?.features?.posIntegration && (
 <div className="flex items-center gap-3 text-sm text-foreground">
 <span className="text-purple-800 dark:text-purple-400">★</span> POS & Terazi Entegrasyonu
 </div>
 )}
 {plan?.features?.marketing && (
 <div className="flex items-center gap-3 text-sm text-foreground">
 <span className="text-purple-800 dark:text-purple-400">★</span> Gelişmiş Pazarlama (Marketing)
 </div>
 )}
 </div>

 <Link href={`/${admin?.locale || 'tr'}/admin/business/${admin?.butcherId}?tab=settings&settingsSubTab=abonelik`} className="block w-full text-center bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white py-3 rounded-xl font-bold transition">
 {t('plani_degistir')}
 </Link>
 </div>

 {/* ESL HARDWARE RENTAL CARD */}
 <div className="bg-card border border-border rounded-2xl p-8 shadow-xl relative overflow-hidden">
 {/* Background Decoration */}
 <div className="absolute -right-8 -top-8 text-9xl text-foreground/80/20 rotate-12">🏷️</div>

 <div className="relative z-10">
 <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-2">{t('donanim_ki_ralama_esl')}</p>
 <h3 className="text-2xl font-bold mb-6">Elektronik Etiketler</h3>

 {eslEnabled ? (
 <>
 <div className="grid grid-cols-2 gap-4 mb-6">
 <div className="bg-background p-4 rounded-xl border border-border">
 <p className="text-xs text-muted-foreground/80 mb-1">{t('adet')}</p>
 <p className="text-2xl font-bold">{eslCount}</p>
 </div>
 <div className="bg-background p-4 rounded-xl border border-border">
 <p className="text-xs text-muted-foreground/80 mb-1">{t('aylik')}</p>
 <p className="text-2xl font-bold">{formatCurrency(eslTotal, admin?.currency)}</p>
 </div>
 </div>

 {/* Rent-to-Own Progress */}
 <div className="mb-6">
 <div className="flex justify-between text-xs mb-2">
 <span className="text-muted-foreground">Sahiplik İlerlemesi ({ownershipMonth}/24 Ay)</span>
 <span className="text-green-800 dark:text-green-400 font-bold">%16</span>
 </div>
 <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
 <div className="h-full bg-green-500 w-[16%] relative">
 <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-card "></div>
 </div>
 </div>
 <p className="text-xs text-muted-foreground/80 mt-2">
 {t('20_ay_sonra_bu_cihazlar_tamamen_sizin_ol')}
 </p>
 </div>
 </>
 ) : (
 <div className="text-center py-8">
 <p className="text-muted-foreground mb-4">{t('henuz_elektronik_etiket_kullanmiyorsunuz') || 'Bu plan Elektronik Etiket (ESL) içermemektedir.'}</p>
 <button className="text-green-800 dark:text-green-400 underline">ESL Paketlerini İncele</button>
 </div>
 )}
 </div>
 </div>

 {/* BILLING & INVOICES */}
 <div className="bg-card border border-border rounded-2xl p-8 shadow-xl flex flex-col">
 <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-2">{t('odeme_yontemi')}</p>
 <div className="flex items-center gap-4 mb-8 bg-background p-4 rounded-xl border border-border">
 <div className="bg-card p-2 rounded w-12 h-8 flex items-center justify-center">
 <div className="w-8 h-8 rounded-full bg-amber-500 translate-x-2 opacity-80"></div>
 <div className="w-8 h-8 rounded-full bg-red-500 -translate-x-2 opacity-80"></div>
 </div>
 <div>
 <p className="font-bold">Mastercard •••• 4242</p>
 <p className="text-xs text-muted-foreground">Son kullanma: 12/28</p>
 </div>
 <button className="ml-auto text-sm text-muted-foreground hover:text-white">{t('degistir')}</button>
 </div>

 <div className="flex-1">
 <h3 className="font-bold mb-4">Son Faturalar</h3>
 <div className="space-y-2">
 {[1, 2, 3].map(i => (
 <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-700 rounded-lg transition cursor-pointer group">
 <div className="flex items-center gap-3">
 <div className="bg-gray-700 group-hover:bg-gray-600 p-2 rounded text-foreground">📄</div>
 <div>
 <p className="font-bold text-sm">Ocak 2026</p>
 <p className="text-xs text-muted-foreground/80">{t('mira_2026_00')}{i}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="font-bold text-sm">{formatCurrency(monthlyFee + (eslEnabled ? eslTotal : 0), admin?.currency)}</p>
 <p className="text-xs text-green-800 dark:text-green-400">{t('odendi')}</p>
 </div>
 </div>
 ))}
 </div>
 <button className="w-full text-center text-sm text-muted-foreground/80 hover:text-foreground mt-4">{t('tumunu_gor')}</button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}

