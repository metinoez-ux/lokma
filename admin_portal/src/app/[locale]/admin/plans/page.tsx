'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { subscriptionService } from '@/services/subscriptionService';
import { ButcherSubscriptionPlan } from '@/types';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useSectors } from '@/hooks/useSectors';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';
import { formatCurrency as globalFormatCurrency } from '@/lib/utils/currency';

export default function PlansPage() {

 const t = useTranslations('AdminPlans');
 const { admin, loading: adminLoading } = useAdmin();
 const router = useRouter();
 const { sectors, loading: sectorsLoading } = useSectors();

 // Derive unique categories from sectors (e.g. yemek, market, kermes)
 const sectorCategories = useMemo(() => {
 const categoryMap = new Map<string, string>();
 const categoryLabels: Record<string, string> = {
 yemek: 'Yemek',
 market: 'Marketler',
 kermes: 'Kermes',
 hizmet: 'Hizmet',
 };
 sectors
 .filter(s => s.isActive)
 .forEach(s => {
 if (!categoryMap.has(s.category)) {
 categoryMap.set(s.category, categoryLabels[s.category] || s.category);
 }
 });
 return Array.from(categoryMap.entries()).map(([id, label]) => ({ id, label }));
 }, [sectors]);

 const [selectedBusinessType, setSelectedBusinessType] = useState<string>('');
 const [plans, setPlans] = useState<ButcherSubscriptionPlan[]>([]);
 const [loading, setLoading] = useState(true);
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingPlan, setEditingPlan] = useState<ButcherSubscriptionPlan | null>(null);
 const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
 const [deleting, setDeleting] = useState(false);



 // Form State
 const [formData, setFormData] = useState<Partial<ButcherSubscriptionPlan>>({
 code: '',
 name: '',
 monthlyFee: 0,
 color: 'bg-gray-600',
 order: 99,
 isActive: true,
 businessType: selectedBusinessType || 'yemek',
 currency: 'EUR',
 features: {} as any,
 miraAppConnected: false,
 commissionClickCollect: 5,
 commissionOwnCourier: 4,
 commissionLokmaCourier: 7,
 perOrderFeeType: 'none',
 perOrderFeeAmount: 0,
 orderLimit: null,
 freeOrderCount: 0,
 tableReservationLimit: null,
 tableReservationOverageFee: 0,
 personnelLimit: null,
 personnelOverageFee: 0,
 sponsoredFeePerConversion: 0.40,
 sponsoredMaxProducts: 5,
 });

 const colorOptions = [
 { label: 'Gray', value: 'bg-gray-600' },
 { label: 'Blue', value: 'bg-blue-600' },
 { label: 'Green', value: 'bg-green-600' },
 { label: 'Yellow (Gold)', value: 'bg-yellow-600' },
 { label: 'Purple', value: 'bg-purple-600' },
 { label: 'Red', value: 'bg-red-600' },
 { label: 'Pink', value: 'bg-pink-600' },
 { label: t('indigo'), value: 'bg-indigo-600' },
 ];

 // Set default selected business type from sectors
 useEffect(() => {
 if (sectorCategories.length > 0 && !selectedBusinessType) {
 setSelectedBusinessType(sectorCategories[0].id);
 }
 }, [sectorCategories, selectedBusinessType]);

 useEffect(() => {
 if (!adminLoading && (!admin || admin.role !== 'super_admin')) {
 router.push('/admin');
 return;
 }
 if (admin?.role === 'super_admin' && selectedBusinessType) {
 loadPlans();
 }
 }, [admin, adminLoading, router, selectedBusinessType]);

 const loadPlans = async () => {
 setLoading(true);
 try {
 const data = await subscriptionService.getAllPlans(selectedBusinessType);
 setPlans(data);
 } catch (error) {
 console.error('Failed to load plans', error);
 toast.error(t('planlar_yuklenirken_hata_olustu'));
 } finally {
 setLoading(false);
 }
 };

 const handleEdit = (plan: ButcherSubscriptionPlan) => {
 setEditingPlan(plan);
 setFormData({
 ...plan,
 commissionClickCollect: plan.commissionClickCollect ?? 5,
 commissionOwnCourier: plan.commissionOwnCourier ?? 4,
 commissionLokmaCourier: plan.commissionLokmaCourier ?? 7,
 freeOrderCount: plan.freeOrderCount ?? 0,
 sponsoredFeePerConversion: (plan as any).sponsoredFeePerConversion ?? 0.40,
 sponsoredMaxProducts: (plan as any).sponsoredMaxProducts ?? 5,
 });
 setIsModalOpen(true);
 };

 const handleCreate = () => {
 setEditingPlan(null);
 setFormData({
 code: '',
 name: '',
 monthlyFee: 0,
 color: 'bg-gray-600',
 order: plans.length + 1,
 isActive: true,
 businessType: selectedBusinessType,
 currency: 'EUR',
 features: {} as any // Features editing not implemented in simple form yet
 });
 setIsModalOpen(true);
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 // Transform form data to include nested Price IDs properly and sanitize undefined
 const commonData: any = {
 ...formData,
 stripeProductId: formData.stripeProductId || null,
 eslStripePriceId: formData.eslStripePriceId || null,
 yearlyFee: formData.yearlyFee || null,
 campaignLimit: formData.campaignLimit === undefined ? null : formData.campaignLimit,
 productLimit: formData.productLimit === undefined ? null : formData.productLimit,
 orderLimit: formData.orderLimit === undefined ? null : formData.orderLimit,
 personnelLimit: formData.personnelLimit === undefined ? null : formData.personnelLimit,
 personnelOverageFee: formData.personnelOverageFee === undefined ? 0 : formData.personnelOverageFee,
 // Kurye bazlı provizyon
 commissionClickCollect: (formData as any).commissionClickCollect ?? 5,
 commissionOwnCourier: (formData as any).commissionOwnCourier ?? 4,
 commissionLokmaCourier: (formData as any).commissionLokmaCourier ?? 7,
 freeOrderCount: (formData as any).freeOrderCount ?? 0,
 // Sipariş başı ücret
 perOrderFeeType: (formData as any).perOrderFeeType ?? 'none',
 perOrderFeeAmount: (formData as any).perOrderFeeAmount ?? 0,
 // Masa rezervasyonu
 tableReservationLimit: (formData as any).tableReservationLimit ?? null,
 tableReservationOverageFee: (formData as any).tableReservationOverageFee ?? 0,
 // Sponsored Products
 sponsoredFeePerConversion: (formData as any).sponsoredFeePerConversion ?? 0.40,
 sponsoredMaxProducts: (formData as any).sponsoredMaxProducts ?? 5,
 stripePriceId: {
 monthly: formData.stripePriceId?.monthly || '',
 yearly: formData.stripePriceId?.yearly || '',
 }
 };

 // Remove undefined fields if any sneak through (Firestore rejects undefined)
 Object.keys(commonData).forEach(key => commonData[key] === undefined && delete commonData[key]);

 if (editingPlan) {
 await subscriptionService.updatePlan(editingPlan.id, commonData);
 toast.success(t('plan_guncellendi'));
 } else {
 if (!formData.code || !formData.name) {
 toast.error(t('kod_ve_i_sim_zorunludur'));
 return;
 }
 const newPlan: ButcherSubscriptionPlan = {
 ...(commonData as ButcherSubscriptionPlan),
 id: formData.code!, // Use code as ID for simplicity
 currency: formData.currency || 'EUR',
 billingCycle: 'monthly',
 trialDays: 30, // Default
 orderOverageFee: formData.orderOverageFee || 0,
 eslMonthlyPrice: formData.eslMonthlyPrice || 0,
 eslOwnershipMonths: formData.eslOwnershipMonths || 0,
 highlighted: false,
 features: { ...formData.features } as any,
 businessType: formData.businessType || selectedBusinessType,
 createdAt: new Date(),
 updatedAt: new Date()
 };
 await subscriptionService.createPlan(newPlan);
 toast.success(t('yeni_plan_olusturuldu'));
 }
 setIsModalOpen(false);
 loadPlans();
 } catch (error: any) {
 console.error(error);
 toast.error(error.message || t('bir_hata_olustu'));
 }
 };



 const handleDeleteConfirm = async () => {
 if (!confirmDelete) return;
 setDeleting(true);
 try {
 await subscriptionService.deletePlan(confirmDelete.id);
 loadPlans();
 toast.success('Plan silindi.');
 } catch (error) {
 toast.error(t('silme_islemi_basarisiz'));
 } finally {
 setDeleting(false);
 setConfirmDelete(null);
 }
 };

 if (loading || adminLoading || sectorsLoading) return <div className="p-8 text-white">{t('yukleniyor')}</div>;

 return (
 <div className="flex flex-col min-h-screen bg-background text-foreground">
 <div className="w-full max-w-4xl mx-auto px-6 py-8">
 {/* Back Button */}
 <button
 onClick={() => router.push('/admin/dashboard')}
 className="flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors group"
 >
 <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
 {t('panela_geri_don')}
 </button>

 <div className="flex justify-between items-center mb-8">
 <div>
 <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Abonelik Paketleri</h1>
 <p className="text-muted-foreground mt-1">{t('i_sletme_turune_gore_abonelik_planlarini')}</p>
 </div>
 <button
 onClick={handleCreate}
 className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-medium shadow-lg hover:shadow-green-500/20 transition-all flex items-center gap-2 text-sm"
 >
 <span>+</span> {t('yeni_paket')}
 </button>
 </div>

 {/* Business Type Selector */}
 <div className="flex space-x-1 bg-card p-1 rounded-lg mb-6 w-fit">
 {
 sectorCategories.map(type => (
 <button
 key={type.id}
 onClick={() => setSelectedBusinessType(type.id)}
 className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedBusinessType === type.id
 ? 'bg-gray-700 text-white shadow-sm'
 : 'text-muted-foreground hover:text-white hover:bg-gray-700/50'
 }`}
 >
 {type.label}
 </button>
 ))
 }
 </div>

 {/* Plan Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
 {
 plans.map(plan => (
 <div key={plan.id} className="bg-card rounded-xl border border-border overflow-hidden hover:border-gray-500 transition-all group shadow-lg flex flex-col relative">
 {/* Top Color Bar */}
 <div className={`h-1.5 w-full ${plan.color}`}></div>

 <div className="p-5 flex-1 flex flex-col">
 {/* Header & Actions */}
 <div className="flex justify-between items-start mb-4">
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-bold text-foreground text-lg tracking-tight">{plan.name}</h3>
 <div className={`w-2 h-2 rounded-full shrink-0 ${plan.isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
 </div>
 <p className="text-xs text-muted-foreground font-mono mt-1 bg-background/50 inline-block px-1.5 py-0.5 rounded-md">{plan.code}</p>
 </div>

 <div className="flex gap-0.5 -mt-1 -mr-2 bg-background/60 p-1 rounded-lg border border-border/50 opacity-80 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() => handleEdit(plan)}
 className="p-1.5 text-blue-800 dark:text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-md transition-colors"
 title={t('duzenle')}
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 <button
 onClick={() => setConfirmDelete({ id: plan.id, name: plan.name })}
 className="p-1.5 text-red-800 dark:text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors"
 title={t('sil')}
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </div>
 </div>

 {/* Price */}
 <div className="mb-6 flex items-baseline gap-1">
 <span className="text-3xl font-extrabold text-foreground">{globalFormatCurrency(plan.monthlyFee, plan.currency || 'EUR')}</span>
 <span className="text-base font-medium text-muted-foreground/80">/ay</span>
 </div>

 {/* Features Chips */}
 <div className="flex flex-wrap gap-1.5 mb-8 flex-1 content-start">
 {plan.features?.clickAndCollect && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-green-900/20 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-700/30">
 ✓ Gel-Al
 </span>
 )}
 {plan.features?.delivery && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-900/20 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30">
 ✓ Teslimat
 </span>
 )}
 {/* 🎯 Birleşik Promosyon Chip */}
 {(() => {
 const promoCount = [
 plan.features?.campaigns,
 (plan.features as any)?.sponsoredProducts,
 (plan.features as any)?.couponSystem,
 (plan.features as any)?.referralSystem,
 (plan.features as any)?.firstOrderDiscount,
 (plan.features as any)?.freeDrink,
 (plan.features as any)?.donationRoundUp,
 ].filter(Boolean).length;
 return promoCount > 0 ? (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-orange-900/20 text-orange-800 dark:text-orange-400 border border-orange-200 dark:border-orange-700/30">
 🎯 Promosyon {promoCount}/7
 </span>
 ) : null;
 })()}
 {plan.features?.onlinePayment && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-900/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-700/30">
 ✓ {t('odeme')}
 </span>
 )}
 {(plan.features as any)?.dineInQR && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-900/20 text-amber-500 border border-amber-200 dark:border-amber-700/30">
 ✓ {t('qr_siparis')}
 </span>
 )}
 {(plan.features as any)?.waiterOrder && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-teal-900/20 text-teal-400 border border-teal-700/30">
 ✓ Garson
 </span>
 )}
 {(plan.features as any)?.groupOrderLink && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-pink-900/20 text-pink-800 dark:text-pink-400 border border-pink-200 dark:border-pink-700/30">
 ✓ Grup (L)
 </span>
 )}
 {(plan.features as any)?.groupOrderTable && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-orange-900/20 text-orange-800 dark:text-orange-400 border border-orange-200 dark:border-orange-700/30">
 ✓ Grup (M)
 </span>
 )}
 {(plan.features as any)?.staffShiftTracking && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-cyan-900/20 text-cyan-800 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700/30">
 ✓ Vardiya
 </span>
 )}
 </div>

 {/* Limits Info Box */}
 <div className="grid grid-cols-3 gap-0 bg-background/40 rounded-xl border border-border/50 p-1">
 <div className="text-center py-2">
 <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold mb-1">{t('siparis')}</p>
 <p className="text-sm font-bold text-foreground">{plan.orderLimit === null || plan.orderLimit === undefined ? '∞' : plan.orderLimit}</p>
 </div>
 <div className="text-center py-2 border-l border-r border-border/50">
 <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold mb-1">Personel</p>
 <p className="text-sm font-bold text-foreground">{plan.personnelLimit === null || plan.personnelLimit === undefined ? '∞' : plan.personnelLimit}</p>
 </div>
 <div className="text-center py-2">
 <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold mb-1">Prov.</p>
 <p className="text-sm font-bold text-amber-500">%{plan.commissionClickCollect || 5}</p>
 </div>
 </div>
 </div>
 </div>
 ))
 }

 {/* 'New Plan' Ghost Card */}
 <button
 onClick={handleCreate}
 className="min-h-[300px] border-2 border-dashed border-border hover:border-gray-500 hover:text-white rounded-xl flex flex-col items-center justify-center gap-4 text-muted-foreground/80 transition-all group bg-card/10 hover:bg-card/40"
 >
 <div className="w-12 h-12 rounded-full bg-card group-hover:bg-gray-700 group-hover:scale-110 flex items-center justify-center transition-all shadow-sm">
 <span className="text-xl font-medium">+</span>
 </div>
 <span className="font-semibold text-sm transition-colors">{t('yeni_paket_ekle')}</span>
 </button>
 </div>

 {/* Delete Confirmation Modal */}
 <ConfirmModal
 isOpen={!!confirmDelete}
 onClose={() => setConfirmDelete(null)}
 onConfirm={handleDeleteConfirm}
 title={t('plani_sil')}
 message={t('bu_plani_kalici_olarak_silmek_istedigini')}
 itemName={confirmDelete?.name}
 variant="danger"
 confirmText={t('evet_sil')}
 loadingText="Siliniyor..."
 />

 {/* Modal */}
 {
 isModalOpen && (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-background rounded-2xl w-full max-w-6xl border border-border shadow-2xl flex flex-col max-h-[95vh]">

 {/* Modal Header */}
 <div className="p-6 border-b border-border flex justify-between items-center bg-background rounded-t-2xl">
 <div>
 <h2 className="text-2xl font-bold text-foreground">{editingPlan ? t('paketi_duzenle') : t('yeni_paket_olustur')}</h2>
 <p className="text-sm text-muted-foreground mt-1">
 <span className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded text-xs border border-blue-800 uppercase tracking-wide mr-2">
 {(sectorCategories.find(t => t.id === formData.businessType)?.label || formData.businessType || selectedBusinessType)}
 </span>
 {t('icin_abonelik_detaylarini_yapilandirin')}
 </p>
 </div>
 <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground/80 hover:text-white transition-colors">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Modal Body - Scrollable */}
 <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

 {/* LEFT COLUMN: Identity, Pricing, Limits (5 cols) */}
 <div className="lg:col-span-12 xl:col-span-5 space-y-6">

 {/* 1. Identity & Pricing */}
 <div className="bg-card/50 p-5 rounded-xl border border-border/50">
 <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
 <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
 {t('paket_kimligi_fiyatlandirma')}
 </h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2">
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('paket_adi')}</label>
 <input
 type="text"
 value={formData.name}
 onChange={e => setFormData({ ...formData, name: e.target.value })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
 placeholder={t('orn_gold_paket')}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('kod_id')}</label>
 <input
 type="text"
 value={formData.code}
 onChange={e => setFormData({ ...formData, code: e.target.value })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm font-mono"
 placeholder="gold_pkg"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">Renk</label>
 <select
 value={formData.color}
 onChange={e => setFormData({ ...formData, color: e.target.value })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
 >
 {colorOptions.map(opt => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('aylik_ucret')}</label>
 <input
 type="number"
 step="0.01"
 value={formData.monthlyFee}
 onChange={(e) => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })}
 className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
 placeholder="29.00"
 min="0"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">Para Birimi</label>
 <select
 value={formData.currency || 'EUR'}
 onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
 className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
 >
 <option value="EUR">Euro (€)</option>
 <option value="TRY">Türk Lirası (₺)</option>
 <option value="USD">Dolar ($)</option>
 <option value="GBP">Sterlin (£)</option>
 <option value="CHF">Frank (CHF)</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('yillik_ucret')}</label>
 <input
 type="number"
 step="0.01"
 value={formData.yearlyFee || ''}
 onChange={e => setFormData({ ...formData, yearlyFee: parseFloat(e.target.value) })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
 placeholder="Opsiyonel"
 />
 </div>
 <div className="col-span-2">
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('aciklama')}</label>
 <input
 type="text"
 value={formData.description || ''}
 onChange={e => setFormData({ ...formData, description: e.target.value })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
 placeholder={t('paket_aciklamasi')}
 />
 </div>
 </div>
 </div>

 {/* 2. Limits & Rules */}
 <div className="bg-card/50 p-5 rounded-xl border border-border/50">
 <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
 <span className="w-1 h-6 bg-yellow-500 rounded-full"></span>
 {t('limitler_hizmet_sartlari')}
 </h3>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('urun_limiti')}</label>
 <div className="flex gap-2">
 <input
 type="number"
 value={formData.productLimit === null ? '' : formData.productLimit}
 onChange={e => setFormData({ ...formData, productLimit: e.target.value ? parseInt(e.target.value) : null })}
 placeholder={t('sinirsiz')}
 disabled={formData.productLimit === null}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50"
 />
 <button
 type="button"
 onClick={() => setFormData(p => ({ ...p, productLimit: p.productLimit === null ? 30 : null }))}
 className={`px-3 rounded-lg border text-sm font-bold transition-colors ${formData.productLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-card border-gray-600 text-muted-foreground hover:bg-gray-700'}`}
 >
 ∞
 </button>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('siparis_limiti_ay')}</label>
 <div className="flex gap-2">
 <input
 type="number"
 value={formData.orderLimit === null ? '' : formData.orderLimit}
 onChange={e => setFormData({ ...formData, orderLimit: e.target.value ? parseInt(e.target.value) : null })}
 placeholder={t('sinirsiz')}
 disabled={formData.orderLimit === null}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50"
 />
 <button
 type="button"
 onClick={() => setFormData(p => ({ ...p, orderLimit: p.orderLimit === null ? 100 : null }))}
 className={`px-3 rounded-lg border text-sm font-bold transition-colors ${formData.orderLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-card border-gray-600 text-muted-foreground hover:bg-gray-700'}`}
 >
 ∞
 </button>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">Personel Limiti</label>
 <div className="flex gap-2">
 <input
 type="number"
 value={formData.personnelLimit === null ? '' : formData.personnelLimit}
 onChange={e => setFormData({ ...formData, personnelLimit: e.target.value ? parseInt(e.target.value) : null })}
 placeholder={t('sinirsiz')}
 disabled={formData.personnelLimit === null}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50"
 />
 <button
 type="button"
 onClick={() => setFormData(p => ({ ...p, personnelLimit: p.personnelLimit === null ? 3 : null }))}
 className={`px-3 rounded-lg border text-sm font-bold transition-colors ${formData.personnelLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-card border-gray-600 text-muted-foreground hover:bg-gray-700'}`}
 >
 ∞
 </button>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">Personel Aşım Ücreti ({globalFormatCurrency(0, formData.currency || 'EUR').replace(/[\d.,]/g, '')})</label>
 <input
 type="number"
 step="0.01"
 value={formData.personnelOverageFee ?? 0}
 onChange={e => setFormData({ ...formData, personnelOverageFee: parseFloat(e.target.value) || 0 })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
 placeholder="Opsiyonel"
 />
 </div>
 {/* Kurye Provizyon Sistemi */}
 <div className="col-span-2">
 <label className="block text-xs font-medium text-amber-800 dark:text-amber-400 mb-2">{t('kurye_bazli_provizyon_oranlari')}</label>
 <div className="grid grid-cols-3 gap-3">
 <div className="bg-background rounded-lg p-3 border border-green-600/40">
 <label className="block text-xs text-green-800 dark:text-green-400 mb-1">🛒 Gel-Al</label>
 <input
 type="number"
 step="0.1"
 value={(formData as any).commissionClickCollect ?? 5}
 onChange={e => setFormData({ ...formData, commissionClickCollect: parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm font-bold text-center"
 />
 </div>
 <div className="bg-background rounded-lg p-3 border border-blue-600/40">
 <label className="block text-xs text-blue-800 dark:text-blue-400 mb-1">{t('kendi_kurye')}</label>
 <input
 type="number"
 step="0.1"
 value={(formData as any).commissionOwnCourier ?? 4}
 onChange={e => setFormData({ ...formData, commissionOwnCourier: parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm font-bold text-center"
 />
 </div>
 <div className="bg-background rounded-lg p-3 border border-purple-600/40">
 <label className="block text-xs text-purple-800 dark:text-purple-400 mb-1">{t('lokma_kurye')}</label>
 <input
 type="number"
 step="0.1"
 value={(formData as any).commissionLokmaCourier ?? 7}
 onChange={e => setFormData({ ...formData, commissionLokmaCourier: parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm font-bold text-center"
 />
 </div>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ucretsiz_siparis_i_lk_x_adet')}</label>
 <input
 type="number"
 value={(formData as any).freeOrderCount ?? 0}
 onChange={e => setFormData({ ...formData, freeOrderCount: parseInt(e.target.value) || 0 } as any)}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
 placeholder="0"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('kampanya_push_gonderim_limiti')}</label>
 <input
 type="number"
 value={formData.campaignLimit || ''}
 onChange={e => setFormData({ ...formData, campaignLimit: e.target.value ? parseInt(e.target.value) : null })}
 className="w-full bg-background border border-gray-600 rounded-lg px-3 py-2 text-foreground text-sm"
 placeholder="Opsiyonel"
 />
 </div>

 {/* Sipariş Başı Ücret */}
 <div className="col-span-2">
 <label className="block text-xs font-medium text-amber-800 dark:text-amber-400 mb-2">{t('siparis_basi_ucret')}</label>
 <div className="flex gap-2">
 <div className="relative flex bg-background rounded-lg border border-border overflow-hidden">
 {(['none', 'percentage', 'fixed'] as const).map(type => (
 <button
 key={type}
 type="button"
 onClick={() => setFormData({ ...formData, perOrderFeeType: type } as any)}
 className={`px-3 py-2 text-xs font-medium transition-colors ${(formData as any).perOrderFeeType === type ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:bg-card'}`}
 >
 {type === 'none' ? t('yok') : type === 'percentage' ? '%' : globalFormatCurrency(0, formData.currency || 'EUR').replace(/[\d.,]/g, '')}
 </button>
 ))}
 </div>
 {(formData as any).perOrderFeeType !== 'none' && (
 <input
 type="number"
 step={(formData as any).perOrderFeeType === 'percentage' ? '0.1' : '0.01'}
 value={(formData as any).perOrderFeeAmount ?? 0}
 onChange={e => setFormData({ ...formData, perOrderFeeAmount: parseFloat(e.target.value) } as any)}
 className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
 placeholder={(formData as any).perOrderFeeType === 'percentage' ? '5%' : `1.00 ${globalFormatCurrency(0, formData.currency || 'EUR').replace(/[\d.,]/g, '')}`}
 />
 )}
 </div>
 </div>

 {/* Masa Rezervasyonu */}
 <div className="col-span-2">
 <div className="flex items-center justify-between mb-2">
 <label className="text-xs font-medium text-pink-800 dark:text-pink-400">🍽️ Masa Rezervasyonu</label>
 <label className="flex items-center cursor-pointer">
 <div className="relative">
 <input
 type="checkbox"
 className="sr-only"
 checked={formData.features?.tableReservation || false}
 onChange={e => setFormData({ ...formData, features: { ...formData.features!, tableReservation: e.target.checked } })}
 />
 <div className={`w-9 h-5 rounded-full transition-colors ${formData.features?.tableReservation ? 'bg-pink-600' : 'bg-gray-700'}`}>
 <div className={`absolute top-0.5 w-4 h-4 bg-card rounded-full transition-all ${formData.features?.tableReservation ? 'left-4' : 'left-0.5'}`}></div>
 </div>
 </div>
 <span className="ml-2 text-xs text-muted-foreground">{formData.features?.tableReservation ? t('aktif') : t('kapali')}</span>
 </label>
 </div>
 {formData.features?.tableReservation && (
 <div className="grid grid-cols-2 gap-3 bg-background/50 p-3 rounded-lg border border-pink-900/30">
 <div>
 <label className="block text-xs text-muted-foreground/80 mb-1">{t('dahil_masa_sayisi')}</label>
 <div className="flex gap-2">
 <input
 type="number"
 value={(formData as any).tableReservationLimit === null ? '' : (formData as any).tableReservationLimit}
 onChange={e => setFormData({ ...formData, tableReservationLimit: e.target.value ? parseInt(e.target.value) : null } as any)}
 disabled={(formData as any).tableReservationLimit === null}
 className="flex-1 bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm disabled:opacity-50"
 placeholder="Limit"
 />
 <button
 type="button"
 onClick={() => setFormData(p => ({ ...p, tableReservationLimit: (p as any).tableReservationLimit === null ? 50 : null } as any))}
 className={`px-2 rounded border text-xs font-bold ${(formData as any).tableReservationLimit === null ? 'bg-pink-600 border-pink-500 text-white' : 'bg-card border-gray-600 text-muted-foreground'}`}
 >
 ∞
 </button>
 </div>
 </div>
 <div>
 <label className="block text-xs text-muted-foreground/80 mb-1">{t('asim_ucreti')}</label>
 <input
 type="number"
 step="0.01"
 value={(formData as any).tableReservationOverageFee ?? 0}
 onChange={e => setFormData({ ...formData, tableReservationOverageFee: parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm"
 placeholder="0.50"
 />
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Plan Durumu - Basitleştirilmiş */}
 <div className="bg-card/50 p-4 rounded-xl border border-border/50">
 <label className="flex items-center cursor-pointer p-3 bg-background rounded-lg border border-border hover:border-gray-500 transition-all">
 <div className="mr-3">
 <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-gray-600'}`}>
 <div className={`absolute top-1 w-3 h-3 bg-card rounded-full transition-all ${formData.isActive ? 'left-6' : 'left-1'}`}></div>
 </div>
 </div>
 <span className={`text-sm font-medium ${formData.isActive ? 'text-white' : 'text-muted-foreground'}`}>
 {formData.isActive ? t('plan_aktif') : t('plan_pasif')}
 </span>
 <input
 type="checkbox"
 className="hidden"
 checked={formData.isActive}
 onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
 />
 </label>
 </div>
 </div>


 {/* RIGHT COLUMN: Features, Stripe, Integrations (7 cols) */}
 <div className="lg:col-span-12 xl:col-span-7 space-y-6">

 {/* 3. Features Grid */}
 <div className="bg-card/50 p-6 rounded-xl border border-border/50 h-full">
 <h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 border-b border-border pb-4">
 <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
 {t('ozellikler_moduller')}
 </h3>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {[
 { key: 'clickAndCollect', label: 'Click & Collect (Gel-Al)', color: 'text-purple-800 dark:text-purple-400' },
 { key: 'delivery', label: t('kurye_teslimat'), color: 'text-purple-800 dark:text-purple-400' },
 { key: 'onlinePayment', label: t('online_odeme_kart_apple'), color: 'text-purple-800 dark:text-purple-400' },
 { key: 'marketing', label: 'Marketing (Banner/Vitrin)', color: 'text-purple-800 dark:text-purple-400' },
 { key: 'liveCourierTracking', label: t('canli_kurye_takibi'), color: 'text-purple-800 dark:text-purple-400' },
 { key: 'dineInQR', label: t('masada_siparis_qr_kod'), color: 'text-amber-800 dark:text-amber-400' },
 { key: 'waiterOrder', label: t('garson_siparis'), color: 'text-teal-400' },
 { key: 'groupOrderLink', label: '🔗 Link ile Grup Siparişi', color: 'text-pink-800 dark:text-pink-400' },
 { key: 'groupOrderTable', label: '🪑 Masada Grup Siparişi', color: 'text-orange-800 dark:text-orange-400' },
 { key: 'staffShiftTracking', label: '⏱️ Vardiya Takibi & Export', color: 'text-cyan-800 dark:text-cyan-400' },
 { key: 'basicStatsOnly', label: 'Sadece Temel Raporlar', color: 'text-muted-foreground', invert: true },
 ].map((feature) => (
 <label key={feature.key} className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 hover:bg-card transition-all cursor-pointer group">
 <div className="relative flex items-center">
 <input
 type="checkbox"
 className="peer sr-only"
 checked={feature.key === 'basicStatsOnly' ? !formData.features?.basicStatsOnly : (formData.features as any)?.[feature.key]}
 onChange={e => {
 const val = feature.key === 'basicStatsOnly' ? !e.target.checked : e.target.checked;
 setFormData({ ...formData, features: { ...formData.features!, [feature.key]: val } });
 }}
 />
 <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
 </div>
 <span className={`ml-3 text-sm font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
 </label>
 ))}
 </div>

 {/* 🎯 PROMOSYON & PAZARLAMA — Collapsible Section */}
 <div className="mt-6 border border-orange-200 dark:border-orange-700/30 rounded-xl overflow-hidden">
 <button
 type="button"
 onClick={() => setFormData({ ...formData, _promoExpanded: !(formData as any)._promoExpanded } as any)}
 className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-100 dark:from-orange-900/20 to-amber-900/10 hover:from-orange-100 dark:from-orange-900/30 transition-all"
 >
 <div className="flex items-center gap-3">
 <span className="text-lg">🎯</span>
 <span className="text-sm font-bold text-orange-300 uppercase tracking-wide">Promosyon & Pazarlama</span>
 <span className="text-xs px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-800 dark:text-orange-400 border border-orange-200 dark:border-orange-700/30">
 {[
 (formData.features as any)?.campaigns,
 (formData.features as any)?.sponsoredProducts,
 (formData.features as any)?.couponSystem,
 (formData.features as any)?.referralSystem,
 (formData.features as any)?.firstOrderDiscount,
 (formData.features as any)?.freeDrink,
 (formData.features as any)?.donationRoundUp,
 ].filter(Boolean).length}/7 aktif
 </span>
 </div>
 <span className={`text-orange-800 dark:text-orange-400 text-sm transition-transform ${(formData as any)._promoExpanded ? 'rotate-180' : ''}`}>▼</span>
 </button>

 {(formData as any)._promoExpanded !== false && (
 <div className="p-4 bg-background/50 space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {[
 { key: 'campaigns', label: '📢 Kampanya Yönetimi', color: 'text-purple-800 dark:text-purple-400', desc: 'İndirim/fırsat kampanyaları' },
 { key: 'sponsoredProducts', label: '⭐ Sponsorlu Ürünler', color: 'text-yellow-800 dark:text-yellow-400', desc: 'Öne çıkan ürünler', hasSubFields: true },
 { key: 'couponSystem', label: '🎟️ Kupon Sistemi', color: 'text-blue-800 dark:text-blue-400', desc: 'Promo kodları & kuponlar' },
 { key: 'referralSystem', label: '🤝 Referral (Davet Et)', color: 'text-pink-800 dark:text-pink-400', desc: 'Davet et kazan sistemi' },
 { key: 'firstOrderDiscount', label: '🎁 İlk Sipariş İndirimi', color: 'text-green-800 dark:text-green-400', desc: 'Yeni müşteri teşviki' },
 { key: 'freeDrink', label: '🍺 Gratis İçecek', color: 'text-cyan-800 dark:text-cyan-400', desc: 'Ücretsiz içecek modülü' },
 { key: 'donationRoundUp', label: '💚 Bağış Yuvarlama', color: 'text-emerald-800 dark:text-emerald-400', desc: 'Checkout bağış yuvarlama' },
 ].map((promo) => (
 <label key={promo.key} className="flex items-start p-3 rounded-lg bg-card/50 border border-border/50 hover:border-orange-200 dark:border-orange-700/30 hover:bg-card transition-all cursor-pointer group">
 <div className="relative flex items-center mt-0.5">
 <input
 type="checkbox"
 className="peer sr-only"
 checked={(formData.features as any)?.[promo.key]}
 onChange={e => setFormData({ ...formData, features: { ...formData.features!, [promo.key]: e.target.checked } })}
 />
 <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
 </div>
 <div className="ml-3">
 <span className={`text-sm font-medium ${promo.color} group-hover:text-white transition-colors`}>{promo.label}</span>
 <p className="text-[10px] text-muted-foreground/80 mt-0.5">{promo.desc}</p>
 </div>
 </label>
 ))}
 </div>

 {/* Sponsored Products Sub-Settings — inside promo accordion */}
 {(formData.features as any)?.sponsoredProducts && (
 <div className="bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700/30 rounded-xl p-4">
 <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-400 uppercase tracking-widest mb-3">⭐ {t('one_cikan_urun_ayarlari')}</h4>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">{t('siparis_basi_ucret')}</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={(formData as any).sponsoredFeePerConversion ?? 0.40}
 onChange={e => setFormData({ ...formData, sponsoredFeePerConversion: parseFloat(e.target.value) || 0 } as any)}
 className="w-full bg-background border border-yellow-200 dark:border-yellow-700/40 rounded-lg px-3 py-2.5 text-foreground text-sm font-bold focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
 placeholder="0.40"
 />
 <p className="text-xs text-muted-foreground/80 mt-1">{t('0_bedava_bu_plan_icin_sponsored_ucretsiz')}</p>
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">{t('max_urun_sayisi')}</label>
 <input
 type="number"
 min="1"
 max="50"
 value={(formData as any).sponsoredMaxProducts ?? 5}
 onChange={e => setFormData({ ...formData, sponsoredMaxProducts: parseInt(e.target.value) || 5 } as any)}
 className="w-full bg-background border border-yellow-200 dark:border-yellow-700/40 rounded-lg px-3 py-2.5 text-foreground text-sm font-bold focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
 placeholder="5"
 />
 <p className="text-xs text-muted-foreground/80 mt-1">{t('bu_plandaki_isletme_kac_urun_one_cikarab')}</p>
 </div>
 </div>
 <div className="mt-3 bg-background/50 rounded-lg px-3 py-2">
 <p className="text-xs text-yellow-300/80">
 {t('bu_plandaki_isletmeler_max')} <strong>{(formData as any).sponsoredMaxProducts ?? 5}</strong> {t('urun_secebilir')}
 {((formData as any).sponsoredFeePerConversion ?? 0.40) > 0
 ? <> {t('her_siparis_basi')} <strong>{globalFormatCurrency((formData as any).sponsoredFeePerConversion ?? 0.40, formData.currency || 'EUR')}</strong> {t('ucretlendirilir')}</>
 : <> {t('sponsored_urunler')} <strong className="text-green-800 dark:text-green-400">{t('ucretsiz')}</strong> olarak sunulur.</>
 }
 </p>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 <div className="mt-8">
 <h4 className="text-xs font-bold text-muted-foreground/80 uppercase tracking-widest mb-4 ml-1">Gelecek Entegrasyonlar</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {[
 { key: 'eslIntegration', label: t('esl_etiket_destegi'), color: 'text-indigo-300' },
 { key: 'posIntegration', label: 'POS Entegrasyonu', color: 'text-muted-foreground' },
 { key: 'scaleIntegration', label: t('akilli_kantar'), color: 'text-muted-foreground' },
 { key: 'accountingIntegration', label: 'Muhasebe (Datev)', color: 'text-muted-foreground' },
 { key: 'aiSupplierOrdering', label: t('b2b_ai_siparis'), color: 'text-green-800 dark:text-green-400' },
 { key: 'aiBestPrice', label: t('ai_fiyat_onerisi'), color: 'text-amber-800 dark:text-amber-400' },
 ].map((feature) => (
 <label key={feature.key} className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 hover:bg-card transition-all cursor-pointer group">
 <div className="relative flex items-center">
 <input
 type="checkbox"
 className="peer sr-only"
 checked={(formData.features as any)?.[feature.key]}
 onChange={e => setFormData({ ...formData, features: { ...formData.features!, [feature.key]: e.target.checked } })}
 />
 <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
 </div>
 <span className={`ml-3 text-xs font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Stripe ID Section (Compact) */}
 <div className="mt-8 pt-6 border-t border-border/50">
 <h4 className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-widest mb-3">{t('teknik_stripe_ids')}</h4>
 <div className="grid grid-cols-2 gap-3">
 <input
 type="text"
 value={formData.stripeProductId || ''}
 onChange={e => setFormData({ ...formData, stripeProductId: e.target.value })}
 className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-muted-foreground focus:text-white focus:border-blue-500 outline-none"
 placeholder={t('product_id_prod')}
 />
 <input
 type="text"
 value={formData.stripePriceId?.monthly || ''}
 onChange={e => setFormData({
 ...formData,
 stripePriceId: { ...formData.stripePriceId, monthly: e.target.value } as any
 })}
 className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-muted-foreground focus:text-white focus:border-blue-500 outline-none"
 placeholder={t('monthly_price_id')}
 />
 </div>
 </div>
 </div>
 </div>
 </div>
 </form>

 {/* Modal Footer */}
 <div className="p-5 border-t border-border bg-background rounded-b-2xl flex justify-end gap-3 z-10">
 <button
 type="button"
 onClick={() => setIsModalOpen(false)}
 className="px-5 py-2.5 bg-card hover:bg-gray-700 rounded-xl text-foreground font-medium transition-colors"
 >
 İptal
 </button>
 <button
 onClick={handleSave}
 className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
 >
 {t('degisiklikleri_kaydet')}
 </button>
 </div>
 </div >
 </div >
 )
 }
 </div >
 </div>
 );
}
