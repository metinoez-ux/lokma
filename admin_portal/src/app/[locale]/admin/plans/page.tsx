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
 eslSetupFee: formData.eslSetupFee ?? 199.00,
        eslMinimumRentMonths: formData.eslMinimumRentMonths ?? 12,
 yearlyFee: formData.yearlyFee || null,
 campaignLimit: (formData.campaignLimit === undefined || formData.campaignLimit === '') ? null : formData.campaignLimit,
 productLimit: (formData.productLimit === undefined || formData.productLimit === '') ? null : formData.productLimit,
 orderLimit: (formData.orderLimit === undefined || formData.orderLimit === '') ? null : formData.orderLimit,
 personnelLimit: (formData.personnelLimit === undefined || formData.personnelLimit === '') ? null : formData.personnelLimit,
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
 tableReservationLimit: ((formData as any).tableReservationLimit === undefined || (formData as any).tableReservationLimit === '') ? null : (formData as any).tableReservationLimit,
 tableReservationFreeQuota: ((formData as any).tableReservationFreeQuota === undefined || (formData as any).tableReservationFreeQuota === '') ? null : (formData as any).tableReservationFreeQuota,
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
 {/* Birleşik Promosyon Chip */}
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
 Promosyon {promoCount}/7
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
 onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
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
 value={formData.yearlyFee === '' || formData.yearlyFee === null ? '' : formData.yearlyFee}
 onChange={e => setFormData({ ...formData, yearlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
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



  {/* 3. Personel & Vardiya Yönetimi */}
  <div className="bg-card/50 p-5 rounded-xl border border-border/50">
    <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-cyan-500 rounded-full"></span>
      Personel & Vardiya Yönetimi
    </h3>
    <div className="grid grid-cols-2 gap-4">
       <div>
         <label className="block text-xs font-medium text-muted-foreground mb-1.5">Personel Limiti</label>
         <div className="flex gap-2">
            <input
               type="number"
               value={formData.personnelLimit === null ? '' : formData.personnelLimit}
               onChange={e => setFormData({ ...formData, personnelLimit: e.target.value ? parseInt(e.target.value) : null })}
               placeholder={t('sinirsiz')}
               disabled={formData.personnelLimit === null}
               className="w-full bg-background border border-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50 transition-colors"
            />
            <button
               type="button"
               onClick={() => setFormData(p => ({ ...p, personnelLimit: p.personnelLimit === null ? 3 : null }))}
               className={`px-3 py-2 shrink-0 rounded-lg border text-sm font-bold transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${formData.personnelLimit === null ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-card border-gray-600 text-muted-foreground hover:bg-gray-700'}`}
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
            value={formData.personnelOverageFee === '' ? '' : (formData.personnelOverageFee ?? 0)}
            onChange={e => setFormData({ ...formData, personnelOverageFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
            className="w-full bg-background border border-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
            placeholder="Opsiyonel"
         />
       </div>
       <div className="col-span-2 pt-2 border-t border-border/50 mt-2">
         <label className="flex items-center cursor-pointer group">
            <div className="relative flex items-center">
               <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={(formData.features as any)?.staffShiftTracking || false}
                  onChange={e => setFormData({ ...formData, features: { ...formData.features!, staffShiftTracking: e.target.checked } })}
               />
               <div className="w-10 h-5 bg-gray-700 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
            </div>
            <span className="ml-3 text-sm font-medium text-cyan-800 dark:text-cyan-400 group-hover:text-white transition-colors">Vardiya Takibi & Export</span>
         </label>
         <p className="text-[10px] text-muted-foreground/70 mt-1 ml-[52px]">İşletmenin kendi personellerinin vardiyalarını oluşturması ve saat bazlı takibini sağlar.</p>
       </div>
    </div>
  </div>

  {/* 4. Masa & Rezervasyon Modülü */}
  <div className="bg-card/50 p-5 rounded-xl border border-border/50">
    <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-pink-500 rounded-full"></span>
      Masa & Rezervasyon
    </h3>
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">
        {/* Masada Sipariş (QR Kod) */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={(formData.features as any)?.dineInQR || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, dineInQR: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-amber-800 dark:text-amber-400 group-hover:text-white transition-colors">{t('masada_siparis_qr_kod')}</span>
        </label>

        {/* Garson Siparişi */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={(formData.features as any)?.waiterOrder || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, waiterOrder: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-teal-400 group-hover:text-white transition-colors">{t('garson_siparis')}</span>
        </label>

        {/* Masada Grup Siparişi */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={(formData.features as any)?.groupOrderTable || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, groupOrderTable: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-orange-800 dark:text-orange-400 group-hover:text-white transition-colors">Masada Grup Siparişi</span>
        </label>

        {/* Masa Rezervasyonu Sistemi */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={formData.features?.tableReservation || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, tableReservation: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-pink-800 dark:text-pink-400 group-hover:text-white transition-colors">Masa Rezervasyonu Sistemi</span>
        </label>
      </div>

      {formData.features?.tableReservation && (
        <div className="bg-background/50 p-4 rounded-xl border border-pink-900/30">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fiyatlandırma Modeli (Sektör Standardı)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['free', 'per_cover', 'per_reservation'] as const).map(model => (
                <button
                  key={model}
                  type="button"
                  onClick={() => setFormData({ ...formData, tableReservationModel: model } as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${(formData as any).tableReservationModel === model || (model === 'free' && !(formData as any).tableReservationModel) ? 'bg-pink-600 text-white shadow-md' : 'bg-card text-muted-foreground border border-border hover:bg-pink-900/20'}`}
                >
                  {model === 'free' ? 'Ücretsiz (Sabit)' : model === 'per_cover' ? 'Kişi Başı Ücret' : 'Masa Başı Ücret'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {((formData as any).tableReservationModel || 'free') === 'free' ? 'Rezervasyonlar işletme planına dahildir, ekstra komisyon alınmaz.' : ((formData as any).tableReservationModel === 'per_cover' ? 'OpenTable ve TheFork standardı; rezerve edilen her misafir (cover) başına ücret alınır.' : 'Misafir sayısından bağımsız, oluşturulan her masa rezervasyonu için sabit ücret alınır.')}
            </p>
          </div>

          {((formData as any).tableReservationModel === 'per_cover' || (formData as any).tableReservationModel === 'per_reservation') && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 mt-4">
              <div>
                <label className="block text-xs text-muted-foreground/80 mb-1.5">Ücret Tutarı ({globalFormatCurrency(0, formData.currency || 'EUR').replace(/[\d.,]/g, '')})</label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData as any).tableReservationFee ?? 0.50}
                  onChange={e => setFormData({ ...formData, tableReservationFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                  className="w-full bg-card border border-pink-900/40 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
                  placeholder="0.50"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground/80 mb-1.5">Aylık Ücretsiz Kota</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={(formData as any).tableReservationFreeQuota === null ? '' : ((formData as any).tableReservationFreeQuota ?? 0)}
                    onChange={e => setFormData({ ...formData, tableReservationFreeQuota: e.target.value ? parseInt(e.target.value) : null } as any)}
                    disabled={(formData as any).tableReservationFreeQuota === null}
                    className="flex-1 min-w-0 bg-card border border-pink-900/40 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50 transition-colors"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, tableReservationFreeQuota: (p as any).tableReservationFreeQuota === null ? 0 : null } as any))}
                    className={`px-3 py-2 shrink-0 rounded-lg border text-xs font-bold transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${(formData as any).tableReservationFreeQuota === null ? 'bg-pink-600 border-pink-500 text-white' : 'bg-card border-gray-600 text-muted-foreground'}`}
                  >
                    ∞
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">İlk X {(formData as any).tableReservationModel === 'per_cover' ? 'kişi' : 'rezervasyon'} ücretsiz.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>




  {/* Plan Durumu - Basitleştirilmiş */}
 <div className="bg-card/50 p-4 rounded-xl border border-border/50">
 {(() => {
   const isFreePlan = formData.monthlyFee === 0 || formData.code?.toLowerCase().includes('free') || formData.id?.toLowerCase().includes('free');
   return (
     <label className={`flex items-center p-3 bg-background rounded-lg border border-border transition-all ${isFreePlan && formData.isActive ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-gray-500'}`}>
       <div className="mr-3">
         <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-gray-600'} ${isFreePlan && formData.isActive ? 'opacity-50' : ''}`}>
           <div className={`absolute top-1 w-3 h-3 bg-card rounded-full transition-all ${formData.isActive ? 'left-6' : 'left-1'}`}></div>
         </div>
       </div>
       <div className="flex flex-col">
         <span className={`text-sm font-medium ${formData.isActive ? 'text-white' : 'text-muted-foreground'}`}>
           {formData.isActive ? t('plan_aktif') : t('plan_pasif')}
         </span>
         {isFreePlan && (
           <span className="text-[10px] text-amber-500 mt-0.5">Ücretsiz/Temel planlar deaktif edilemez.</span>
         )}
       </div>
       <input
         type="checkbox"
         className="hidden"
         checked={formData.isActive}
         disabled={isFreePlan && formData.isActive}
         onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
       />
     </label>
   );
 })()}
 </div>
 </div>


 {/* RIGHT COLUMN: Features, Stripe, Integrations (7 cols) */}
 <div className="lg:col-span-12 xl:col-span-7 space-y-6">

 {/* 3. Features & Limits */}
 <div className="bg-card/50 p-6 rounded-xl border border-border/50">
 <h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 border-b border-border pb-4">
 <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
 {t('ozellikler_moduller')}
 </h3>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {[
 { key: 'clickAndCollect', label: 'Click & Collect (Gel-Al)', color: 'text-purple-800 dark:text-purple-400' },
 { key: 'onlinePayment', label: t('online_odeme_kart_apple'), color: 'text-purple-800 dark:text-purple-400' },
 { key: 'marketing', label: 'Marketing (Banner/Vitrin)', color: 'text-purple-800 dark:text-purple-400' },
 { key: 'groupOrderLink', label: 'Link ile Grup Siparişi', color: 'text-pink-800 dark:text-pink-400' },
 ].map((feature) => (
 <label key={feature.key} className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 hover:bg-card transition-all cursor-pointer group">
 <div className="relative flex items-center">
 <input
 type="checkbox"
 className="peer sr-only"
 checked={(formData.features as any)?.[feature.key]}
 onChange={e => setFormData({ ...formData, features: { ...formData.features!, [feature.key]: e.target.checked } })}
 />
 <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
 </div>
 <span className={`ml-3 text-sm font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
 </label>
 ))}
 </div>

          {/* Limits & Rules moved here */}
 <h3 className="text-foreground font-semibold mb-6 mt-8 pt-6 border-t border-border flex items-center gap-2">
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
 className="w-full bg-background border border-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50 transition-colors"
 />
 <button
 type="button"
 onClick={() => setFormData(p => ({ ...p, productLimit: p.productLimit === null ? 30 : null }))}
 className={`px-3 py-2 shrink-0 rounded-lg border text-sm font-bold transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 ${formData.productLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-card border-gray-600 text-muted-foreground hover:bg-gray-700'}`}
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
 className="w-full bg-background border border-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50 transition-colors"
 />
 <button
 type="button"
 onClick={() => setFormData(p => ({ ...p, orderLimit: p.orderLimit === null ? 100 : null }))}
 className={`px-3 py-2 shrink-0 rounded-lg border text-sm font-bold transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 ${formData.orderLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-card border-gray-600 text-muted-foreground hover:bg-gray-700'}`}
 >
 ∞
 </button>
 </div>
 </div>

 {/* Kurye Provizyon Sistemi */}
 <div className="col-span-2">
 <label className="block text-xs font-medium text-amber-800 dark:text-amber-400 mb-2">{t('kurye_bazli_provizyon_oranlari')}</label>
 <div className="grid grid-cols-3 gap-3">
 <div className="bg-background rounded-lg p-3 border border-green-600/40">
 <label className="block text-xs text-green-800 dark:text-green-400 mb-1">Gel-Al</label>
 <input
 type="number"
 step="0.1"
 value={(formData as any).commissionClickCollect === '' ? '' : ((formData as any).commissionClickCollect ?? 5)}
 onChange={e => setFormData({ ...formData, commissionClickCollect: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm font-bold text-center"
 />
 </div>
 <div className="bg-background rounded-lg p-3 border border-blue-600/40">
 <label className="block text-xs text-blue-800 dark:text-blue-400 mb-1">{t('kendi_kurye')}</label>
 <input
 type="number"
 step="0.1"
 value={(formData as any).commissionOwnCourier === '' ? '' : ((formData as any).commissionOwnCourier ?? 4)}
 onChange={e => setFormData({ ...formData, commissionOwnCourier: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm font-bold text-center"
 />
 </div>
 <div className="bg-background rounded-lg p-3 border border-purple-600/40">
 <label className="block text-xs text-purple-800 dark:text-purple-400 mb-1">{t('lokma_kurye')}</label>
 <input
 type="number"
 step="0.1"
 value={(formData as any).commissionLokmaCourier === '' ? '' : ((formData as any).commissionLokmaCourier ?? 7)}
 onChange={e => setFormData({ ...formData, commissionLokmaCourier: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
 className="w-full bg-card border border-border rounded px-2 py-1.5 text-foreground text-sm font-bold text-center"
 />
 </div>
 </div>
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
 value={(formData as any).perOrderFeeAmount === '' ? '' : ((formData as any).perOrderFeeAmount ?? 0)}
 onChange={e => setFormData({ ...formData, perOrderFeeAmount: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
 className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
 placeholder={(formData as any).perOrderFeeType === 'percentage' ? '5%' : `1.00 ${globalFormatCurrency(0, formData.currency || 'EUR').replace(/[\d.,]/g, '')}`}
 />
 )}
 </div>
 </div>

 </div>
          </div>

 {/* PROMOSYON & PAZARLAMA — Collapsible Section */}
 <div className="mt-6 bg-card/50 p-6 rounded-xl border border-border/50">
 
          <h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 border-b border-border pb-4">
            <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
            Promosyon & Pazarlama
          </h3>


 
 <div className="p-4 bg-background/50 space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {[
 { key: 'campaigns', label: 'Kampanya Yönetimi', color: 'text-purple-800 dark:text-purple-400', desc: 'İndirim/fırsat kampanyaları' },
 { key: 'sponsoredProducts', label: 'Sponsorlu Ürünler', color: 'text-yellow-800 dark:text-yellow-400', desc: 'Öne çıkan ürünler', hasSubFields: true },
 { key: 'couponSystem', label: 'Kupon Sistemi', color: 'text-blue-800 dark:text-blue-400', desc: 'Promo kodları & kuponlar' },
 { key: 'referralSystem', label: 'Referral (Davet Et)', color: 'text-pink-800 dark:text-pink-400', desc: 'Davet et kazan sistemi' },
 { key: 'firstOrderDiscount', label: 'İlk Sipariş İndirimi', color: 'text-green-800 dark:text-green-400', desc: 'Yeni müşteri teşviki' },
 { key: 'freeDrink', label: 'Gratis İçecek', color: 'text-cyan-800 dark:text-cyan-400', desc: 'Ücretsiz içecek modülü' },
 { key: 'donationRoundUp', label: 'Bağış Yuvarlama', color: 'text-emerald-800 dark:text-emerald-400', desc: 'Checkout bağış yuvarlama' },
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
 <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-400 uppercase tracking-widest mb-3">{t('one_cikan_urun_ayarlari')}</h4>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs text-muted-foreground mb-1.5">{t('siparis_basi_ucret')}</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={(formData as any).sponsoredFeePerConversion ?? 0.40}
 onChange={e => setFormData({ ...formData, sponsoredFeePerConversion: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
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

 {/* Campaigns Sub-Settings */}
 {(formData.features as any)?.campaigns && (
 <div className="bg-purple-900/10 border border-purple-200 dark:border-purple-700/30 rounded-xl p-4 mt-3">
 <h4 className="text-xs font-bold text-purple-800 dark:text-purple-400 uppercase tracking-widest mb-3">Kampanya Yönetimi Ayarları</h4>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('kampanya_push_gonderim_limiti')}</label>
 <input
 type="number"
 value={formData.campaignLimit || ''}
 onChange={e => setFormData({ ...formData, campaignLimit: e.target.value ? parseInt(e.target.value) : null })}
 className="w-full bg-background border border-purple-200 dark:border-purple-700/40 rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
 placeholder="Opsiyonel (Örn: 5)"
 />
 <p className="text-xs text-muted-foreground/80 mt-1">Bu işletme ayda en fazla kaç kez push bildirimli kampanya çıkabilir?</p>
 </div>
 </div>
 )}

 {/* Free Orders (First N Orders Commission Free) */}
 <div className="bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/30 rounded-xl p-4 mt-3">
 <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-3">Hoşgeldin Teşviki</h4>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ucretsiz_siparis_i_lk_x_adet')}</label>
 <input
 type="number"
 value={(formData as any).freeOrderCount ?? 0}
 onChange={e => setFormData({ ...formData, freeOrderCount: e.target.value === '' ? '' : parseInt(e.target.value) } as any)}
 className="w-full bg-background border border-emerald-200 dark:border-emerald-700/40 rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
 placeholder="0"
 />
 <p className="text-xs text-muted-foreground/80 mt-1">İşletme platforma katıldığında, ilk X adet siparişinden komisyon alınmaz.</p>
 </div>
 </div>
 </div>
 
 </div>

          {/* KURIERLIEFERUNGEN (Kurye Siparişleri) */}
          <div className="mt-6 bg-card/50 p-6 rounded-xl border border-border/50">
            <h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 border-b border-border pb-4">
              <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
              Kurierlieferungen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'delivery', label: 'Kurier / Lieferung', color: 'text-purple-800 dark:text-purple-400' },
                { key: 'liveCourierTracking', label: 'Live-Kurierverfolgung', color: 'text-purple-800 dark:text-purple-400', disabled: !(formData.features as any)?.delivery },
              ].map((feature) => (
                <label key={feature.key} className={`flex items-center p-3 rounded-lg border transition-all ${feature.disabled ? 'opacity-50 cursor-not-allowed bg-card/50 border-border/50' : 'bg-background border-border hover:border-gray-600 hover:bg-card cursor-pointer group'}`}>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      disabled={feature.disabled}
                      checked={feature.disabled ? false : (formData.features as any)?.[feature.key]}
                      onChange={e => {
                        if (feature.key === 'delivery' && !e.target.checked) {
                          setFormData({
                            ...formData,
                            features: {
                              ...formData.features!,
                              delivery: false,
                              liveCourierTracking: false
                            }
                          });
                        } else {
                          setFormData({ ...formData, features: { ...formData.features!, [feature.key]: e.target.checked } });
                        }
                      }}
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${feature.disabled ? 'bg-gray-800' : 'bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 peer-checked:bg-purple-600'}`}></div>
                  </div>
                  <span className={`ml-3 text-sm font-medium ${feature.color} ${!feature.disabled ? 'group-hover:text-white' : ''} transition-colors`}>{feature.label}</span>
                </label>
              ))}
            </div>


          {/* BUCHHALTUNG (Muhasebe) */}
          <div className="mt-6 border border-cyan-200 dark:border-cyan-700/30 rounded-xl overflow-hidden p-4 bg-card/50">
            <h4 className="text-xs font-bold text-cyan-800 dark:text-cyan-400 uppercase tracking-widest mb-4 ml-1">Buchhaltung</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'basicStatsOnly', label: 'Sadece Temel Raporlar', color: 'text-cyan-800 dark:text-cyan-400', invert: true },
                { key: 'accountingIntegration', label: 'Muhasebe (Datev)', color: 'text-cyan-800 dark:text-cyan-400' },
              ].map((feature) => (
                <label key={feature.key} className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 hover:bg-card transition-all cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={feature.invert ? !formData.features?.basicStatsOnly : (formData.features as any)?.[feature.key]}
                      onChange={e => {
                        const val = feature.invert ? !e.target.checked : e.target.checked;
                        setFormData({ ...formData, features: { ...formData.features!, [feature.key]: val } });
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </div>
                  <span className={`ml-3 text-sm font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ESL TAG ETIKETTEN */}
          <div className="mt-6 border border-indigo-200 dark:border-indigo-700/30 rounded-xl overflow-hidden p-4 bg-card/50">
            <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-widest mb-4 ml-1">ESL Tag Etiketten</h4>
            
            <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 hover:bg-card transition-all cursor-pointer group mb-4">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={(formData.features as any)?.eslIntegration}
                  onChange={e => setFormData({ ...formData, features: { ...formData.features!, eslIntegration: e.target.checked } })}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
              <span className={`ml-3 text-sm font-medium text-indigo-800 dark:text-indigo-400 group-hover:text-white transition-colors`}>ESL-Tag-Unterstützung</span>
            </label>

            {(formData.features as any)?.eslIntegration && (
              <div className="pt-4 border-t border-border/50">
                <div className="mb-6 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Aylık Sistem Ücreti (€ Netto) <span className="text-red-500 ml-1">+ 19% MwSt.</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={(formData as any).eslSystemMonthlyFee ?? 29.90}
                      onChange={e => setFormData({ ...formData, eslSystemMonthlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                      className="w-full min-w-0 bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
                      placeholder="29.90"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">SaaS & Base Station.</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Bir Seferlik Kurulum Ücreti (€ Netto) <span className="text-red-500 ml-1">+ 19% MwSt.</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={(formData as any).eslSetupFee ?? 199.00}
                      onChange={e => setFormData({ ...formData, eslSetupFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                      className="w-full min-w-0 bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
                      placeholder="199.00"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Saha Kurulum / Ağ Geçidi Aktivasyonu.</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Min. Kiralama Taahhüdü (Ay)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={(formData as any).eslMinimumRentMonths ?? 12}
                      onChange={e => setFormData({ ...formData, eslMinimumRentMonths: e.target.value === '' ? '' : parseInt(e.target.value) } as any)}
                      className="w-full min-w-0 bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
                      placeholder="12"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Donanım kiralama sözleşmesinin asgari süresi.</p>
                  </div>
                </div>

                <div className="space-y-3 mt-6 border-t border-indigo-900/40 pt-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-indigo-800 dark:text-indigo-400">ESL Etiketleri (Donanım)</h5>
                  </div>
                  <div className="bg-indigo-900/10 border border-indigo-200 dark:border-indigo-700/30 rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-3">
                      ESL etiketlerinin kiralama ve satın alma işlemleri tamamen ayrıştırılmıştır.<br/>
                      Restoran, etiket donanımlarını doğrudan <strong>Donanım Mağazası (DaaS)</strong> üzerinden sipariş edebilir.
                    </p>
                    <div className="inline-block px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-md text-xs font-semibold cursor-not-allowed">
                      Donanım Mağazası Modülünden Yönetilir
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* POS Kasse & Wawi */}
        <div className="mt-6 border border-emerald-200 dark:border-emerald-700/30 rounded-xl overflow-hidden p-4 bg-card/50">
          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-4 ml-1">POS Kasse & Wawi</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'posIntegration', label: 'POS Kasa', color: 'text-emerald-800 dark:text-emerald-400' },
              { key: 'scaleIntegration', label: 'Intelligente Waage', color: 'text-emerald-800 dark:text-emerald-400' },
              { key: 'wholesaleOrdering', label: 'Bestellwesen', color: 'text-emerald-800 dark:text-emerald-400' },
            ].map((feature) => (
              <label key={feature.key} className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 hover:bg-card transition-all cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={(formData.features as any)?.[feature.key] || false}
                    onChange={e => setFormData({ ...formData, features: { ...formData.features!, [feature.key]: e.target.checked } })}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </div>
                <span className={`ml-3 text-sm font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
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
 className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-muted-foreground focus:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
 placeholder={t('product_id_prod')}
 />
 <input
 type="text"
 value={formData.stripePriceId?.monthly || ''}
 onChange={e => setFormData({
 ...formData,
 stripePriceId: { ...formData.stripePriceId, monthly: e.target.value } as any
 })}
 className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-muted-foreground focus:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
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
