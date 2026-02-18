'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { subscriptionService } from '@/services/subscriptionService';
import { ButcherSubscriptionPlan } from '@/types';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useSectors } from '@/hooks/useSectors';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function PlansPage() {
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
        { label: 'Indigo', value: 'bg-indigo-600' },
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
            toast.error('Planlar yüklenirken hata oluştu.');
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
                toast.success('Plan güncellendi.');
            } else {
                if (!formData.code || !formData.name) {
                    toast.error('Kod ve İsim zorunludur.');
                    return;
                }
                const newPlan: ButcherSubscriptionPlan = {
                    ...(commonData as ButcherSubscriptionPlan),
                    id: formData.code!, // Use code as ID for simplicity
                    currency: 'EUR',
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
                toast.success('Yeni plan oluşturuldu.');
            }
            setIsModalOpen(false);
            loadPlans();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Bir hata oluştu.');
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
            toast.error('Silme işlemi başarısız.');
        } finally {
            setDeleting(false);
            setConfirmDelete(null);
        }
    };

    if (loading || adminLoading || sectorsLoading) return <div className="p-8 text-white">Yükleniyor...</div>;

    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-white">
            <div className="w-full max-w-4xl mx-auto px-6 py-8">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/admin/dashboard')}
                    className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors group"
                >
                    <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
                    Panela Geri Dön
                </button>

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Abonelik Paketleri</h1>
                        <p className="text-gray-400 mt-1">İşletme türüne göre abonelik planlarını yönetin.</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-medium shadow-lg hover:shadow-green-500/20 transition-all flex items-center gap-2 text-sm"
                    >
                        <span>+</span> Yeni Paket
                    </button>
                </div>

                {/* Business Type Selector */}
                <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg mb-6 w-fit">
                    {
                        sectorCategories.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setSelectedBusinessType(type.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedBusinessType === type.id
                                    ? 'bg-gray-700 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))
                    }
                </div>

                {/* Plan Rows */}
                <div className="space-y-3">
                    {
                        plans.map(plan => (
                            <div key={plan.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-500 transition-all group shadow-lg">
                                <div className="flex items-stretch">
                                    {/* Color Bar (vertical left) */}
                                    <div className={`w-1.5 shrink-0 ${plan.color}`}></div>

                                    {/* Main Content */}
                                    <div className="flex-1 px-5 py-4 flex items-center gap-6 min-w-0">
                                        {/* Name & Code */}
                                        <div className="w-36 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-base truncate">{plan.name}</h3>
                                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${plan.isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono mt-0.5">{plan.code}</p>
                                        </div>

                                        {/* Price */}
                                        <div className="w-28 shrink-0 text-center">
                                            <span className="text-xl font-bold text-white">€{plan.monthlyFee.toFixed(2)}</span>
                                            <span className="text-xs text-gray-500 ml-1">/ay</span>
                                        </div>

                                        {/* Features Chips */}
                                        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${plan.features?.clickAndCollect ? 'bg-green-900/40 text-green-400 border border-green-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {plan.features?.clickAndCollect ? '✓' : '·'} Gel-Al
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${plan.features?.delivery ? 'bg-blue-900/40 text-blue-400 border border-blue-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {plan.features?.delivery ? '✓' : '·'} Teslimat
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${plan.features?.campaigns ? 'bg-purple-900/40 text-purple-400 border border-purple-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {plan.features?.campaigns ? '✓' : '·'} Kampanya
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${plan.features?.onlinePayment ? 'bg-amber-900/40 text-amber-400 border border-amber-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {plan.features?.onlinePayment ? '✓' : '·'} Ödeme
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(plan.features as any)?.dineInQR ? 'bg-amber-900/40 text-amber-400 border border-amber-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {(plan.features as any)?.dineInQR ? '✓' : '·'} QR Sipariş
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(plan.features as any)?.waiterOrder ? 'bg-teal-900/40 text-teal-400 border border-teal-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {(plan.features as any)?.waiterOrder ? '✓' : '·'} Garson
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(plan.features as any)?.staffShiftTracking ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {(plan.features as any)?.staffShiftTracking ? '✓' : '·'} Vardiya
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(plan.features as any)?.sponsoredProducts ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/40' : 'bg-gray-700/30 text-gray-600 border border-gray-700/30'}`}>
                                                {(plan.features as any)?.sponsoredProducts ? '✓' : '·'} Öne Çıkan {(plan.features as any)?.sponsoredProducts && <span className="opacity-70">€{((plan as any).sponsoredFeePerConversion ?? 0.40).toFixed(2)}</span>}
                                            </span>
                                        </div>

                                        {/* Limits */}
                                        <div className="w-24 shrink-0 text-center">
                                            <p className="text-xs text-gray-500">Sipariş</p>
                                            <p className="text-sm font-bold text-gray-300">{plan.orderLimit === null ? '∞' : plan.orderLimit}/ay</p>
                                        </div>

                                        {/* Commission */}
                                        <div className="w-20 shrink-0 text-center">
                                            <p className="text-xs text-gray-500">Prov.</p>
                                            <p className="text-sm font-bold text-amber-400">%{plan.commissionClickCollect || 5}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1.5 shrink-0">
                                            <button
                                                onClick={() => handleEdit(plan)}
                                                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                title="Düzenle"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete({ id: plan.id, name: plan.name })}
                                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                                                title="Sil"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    }

                    {/* 'New Plan' Ghost Row */}
                    <button
                        onClick={handleCreate}
                        className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl px-5 py-4 flex items-center justify-center gap-3 text-gray-500 hover:text-gray-300 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-800 group-hover:bg-gray-700 flex items-center justify-center transition-colors">
                            <span className="text-lg font-light">+</span>
                        </div>
                        <span className="font-medium text-sm">Yeni Paket Ekle</span>
                    </button>
                </div>

                {/* Delete Confirmation Modal */}
                <ConfirmModal
                    isOpen={!!confirmDelete}
                    onClose={() => setConfirmDelete(null)}
                    onConfirm={handleDeleteConfirm}
                    title="Planı Sil"
                    message="Bu planı kalıcı olarak silmek istediğinizden emin misiniz?"
                    itemName={confirmDelete?.name}
                    variant="danger"
                    confirmText="Evet, Sil"
                    loadingText="Siliniyor..."
                />

                {/* Modal */}
                {
                    isModalOpen && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-gray-900 rounded-2xl w-full max-w-6xl border border-gray-700 shadow-2xl flex flex-col max-h-[95vh]">

                                {/* Modal Header */}
                                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 rounded-t-2xl">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{editingPlan ? 'Paketi Düzenle' : 'Yeni Paket Oluştur'}</h2>
                                        <p className="text-sm text-gray-400 mt-1">
                                            <span className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded text-xs border border-blue-800 uppercase tracking-wide mr-2">
                                                {(sectorCategories.find(t => t.id === formData.businessType)?.label || formData.businessType || selectedBusinessType)}
                                            </span>
                                            için abonelik detaylarını yapılandırın.
                                        </p>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
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
                                            <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700/50">
                                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                                    <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                                                    Paket Kimliği & Fiyatlandırma
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Paket Adı</label>
                                                        <input
                                                            type="text"
                                                            value={formData.name}
                                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                            placeholder="Örn: Gold Paket"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Kod (ID)</label>
                                                        <input
                                                            type="text"
                                                            value={formData.code}
                                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono"
                                                            placeholder="gold_pkg"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Renk</label>
                                                        <select
                                                            value={formData.color}
                                                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                                        >
                                                            {colorOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Aylık Ücret (€)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.monthlyFee}
                                                            onChange={e => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-bold"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Yıllık Ücret (€)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.yearlyFee || ''}
                                                            onChange={e => setFormData({ ...formData, yearlyFee: parseFloat(e.target.value) })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                                            placeholder="Opsiyonel"
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Açıklama</label>
                                                        <input
                                                            type="text"
                                                            value={formData.description || ''}
                                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                                            placeholder="Paket açıklaması..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. Limits & Rules */}
                                            <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700/50">
                                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                                    <span className="w-1 h-6 bg-yellow-500 rounded-full"></span>
                                                    Limitler & Hizmet Şartları
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Ürün Limiti</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="number"
                                                                value={formData.productLimit === null ? '' : formData.productLimit}
                                                                onChange={e => setFormData({ ...formData, productLimit: e.target.value ? parseInt(e.target.value) : null })}
                                                                placeholder="Sınırsız"
                                                                disabled={formData.productLimit === null}
                                                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData(p => ({ ...p, productLimit: p.productLimit === null ? 30 : null }))}
                                                                className={`px-3 rounded-lg border text-sm font-bold transition-colors ${formData.productLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                                                            >
                                                                ∞
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Sipariş Limiti (Ay)</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="number"
                                                                value={formData.orderLimit === null ? '' : formData.orderLimit}
                                                                onChange={e => setFormData({ ...formData, orderLimit: e.target.value ? parseInt(e.target.value) : null })}
                                                                placeholder="Sınırsız"
                                                                disabled={formData.orderLimit === null}
                                                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData(p => ({ ...p, orderLimit: p.orderLimit === null ? 100 : null }))}
                                                                className={`px-3 rounded-lg border text-sm font-bold transition-colors ${formData.orderLimit === null ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                                                            >
                                                                ∞
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Kurye Provizyon Sistemi */}
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-medium text-amber-400 mb-2">💰 Kurye Bazlı Provizyon Oranları (%)</label>
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="bg-gray-900 rounded-lg p-3 border border-green-600/40">
                                                                <label className="block text-xs text-green-400 mb-1">🛒 Gel-Al</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={(formData as any).commissionClickCollect ?? 5}
                                                                    onChange={e => setFormData({ ...formData, commissionClickCollect: parseFloat(e.target.value) } as any)}
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm font-bold text-center"
                                                                />
                                                            </div>
                                                            <div className="bg-gray-900 rounded-lg p-3 border border-blue-600/40">
                                                                <label className="block text-xs text-blue-400 mb-1">🚗 Kendi Kurye</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={(formData as any).commissionOwnCourier ?? 4}
                                                                    onChange={e => setFormData({ ...formData, commissionOwnCourier: parseFloat(e.target.value) } as any)}
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm font-bold text-center"
                                                                />
                                                            </div>
                                                            <div className="bg-gray-900 rounded-lg p-3 border border-purple-600/40">
                                                                <label className="block text-xs text-purple-400 mb-1">🛵 LOKMA Kurye</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={(formData as any).commissionLokmaCourier ?? 7}
                                                                    onChange={e => setFormData({ ...formData, commissionLokmaCourier: parseFloat(e.target.value) } as any)}
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm font-bold text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">🎁 Ücretsiz Sipariş (İlk X adet)</label>
                                                        <input
                                                            type="number"
                                                            value={(formData as any).freeOrderCount ?? 0}
                                                            onChange={e => setFormData({ ...formData, freeOrderCount: parseInt(e.target.value) || 0 } as any)}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Kampanya (Push) Gönderim Limiti</label>
                                                        <input
                                                            type="number"
                                                            value={formData.campaignLimit || ''}
                                                            onChange={e => setFormData({ ...formData, campaignLimit: e.target.value ? parseInt(e.target.value) : null })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                                            placeholder="Opsiyonel"
                                                        />
                                                    </div>

                                                    {/* Sipariş Başı Ücret */}
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-medium text-amber-400 mb-2">💵 Sipariş Başı Ücret</label>
                                                        <div className="flex gap-2">
                                                            <div className="flex bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                                                                {(['none', 'percentage', 'fixed'] as const).map(type => (
                                                                    <button
                                                                        key={type}
                                                                        type="button"
                                                                        onClick={() => setFormData({ ...formData, perOrderFeeType: type } as any)}
                                                                        className={`px-3 py-2 text-xs font-medium transition-colors ${(formData as any).perOrderFeeType === type ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                                                                    >
                                                                        {type === 'none' ? 'Yok' : type === 'percentage' ? '%' : '€'}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            {(formData as any).perOrderFeeType !== 'none' && (
                                                                <input
                                                                    type="number"
                                                                    step={(formData as any).perOrderFeeType === 'percentage' ? '0.1' : '0.01'}
                                                                    value={(formData as any).perOrderFeeAmount ?? 0}
                                                                    onChange={e => setFormData({ ...formData, perOrderFeeAmount: parseFloat(e.target.value) } as any)}
                                                                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                                                    placeholder={(formData as any).perOrderFeeType === 'percentage' ? '5%' : '1.00€'}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Masa Rezervasyonu */}
                                                    <div className="col-span-2">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="text-xs font-medium text-pink-400">🍽️ Masa Rezervasyonu</label>
                                                            <label className="flex items-center cursor-pointer">
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only"
                                                                        checked={formData.features?.tableReservation || false}
                                                                        onChange={e => setFormData({ ...formData, features: { ...formData.features!, tableReservation: e.target.checked } })}
                                                                    />
                                                                    <div className={`w-9 h-5 rounded-full transition-colors ${formData.features?.tableReservation ? 'bg-pink-600' : 'bg-gray-700'}`}>
                                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.features?.tableReservation ? 'left-4' : 'left-0.5'}`}></div>
                                                                    </div>
                                                                </div>
                                                                <span className="ml-2 text-xs text-gray-400">{formData.features?.tableReservation ? 'Aktif' : 'Kapalı'}</span>
                                                            </label>
                                                        </div>
                                                        {formData.features?.tableReservation && (
                                                            <div className="grid grid-cols-2 gap-3 bg-gray-900/50 p-3 rounded-lg border border-pink-900/30">
                                                                <div>
                                                                    <label className="block text-xs text-gray-500 mb-1">Dahil Masa Sayısı</label>
                                                                    <div className="flex gap-2">
                                                                        <input
                                                                            type="number"
                                                                            value={(formData as any).tableReservationLimit === null ? '' : (formData as any).tableReservationLimit}
                                                                            onChange={e => setFormData({ ...formData, tableReservationLimit: e.target.value ? parseInt(e.target.value) : null } as any)}
                                                                            disabled={(formData as any).tableReservationLimit === null}
                                                                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm disabled:opacity-50"
                                                                            placeholder="Limit"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setFormData(p => ({ ...p, tableReservationLimit: (p as any).tableReservationLimit === null ? 50 : null } as any))}
                                                                            className={`px-2 rounded border text-xs font-bold ${(formData as any).tableReservationLimit === null ? 'bg-pink-600 border-pink-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
                                                                        >
                                                                            ∞
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-gray-500 mb-1">Aşım Ücreti (€)</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={(formData as any).tableReservationOverageFee ?? 0}
                                                                        onChange={e => setFormData({ ...formData, tableReservationOverageFee: parseFloat(e.target.value) } as any)}
                                                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"
                                                                        placeholder="0.50"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Plan Durumu - Basitleştirilmiş */}
                                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                                <label className="flex items-center cursor-pointer p-3 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-500 transition-all">
                                                    <div className="mr-3">
                                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-gray-600'}`}>
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.isActive ? 'left-6' : 'left-1'}`}></div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-sm font-medium ${formData.isActive ? 'text-white' : 'text-gray-400'}`}>
                                                        {formData.isActive ? '✅ Plan Aktif' : '❌ Plan Pasif'}
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
                                            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 h-full">
                                                <h3 className="text-white font-semibold mb-6 flex items-center gap-2 border-b border-gray-700 pb-4">
                                                    <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                                                    Özellikler & Modüller
                                                </h3>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {[
                                                        { key: 'clickAndCollect', label: 'Click & Collect (Gel-Al)', color: 'text-purple-400' },
                                                        { key: 'delivery', label: 'Kurye / Teslimat', color: 'text-purple-400' },
                                                        { key: 'onlinePayment', label: 'Online Ödeme (Kart/Apple)', color: 'text-purple-400' },
                                                        { key: 'campaigns', label: 'Kampanya Yönetimi', color: 'text-purple-400' },
                                                        { key: 'marketing', label: 'Marketing (Banner/Vitrin)', color: 'text-purple-400' },
                                                        { key: 'liveCourierTracking', label: 'Canlı Kurye Takibi', color: 'text-purple-400' },
                                                        { key: 'dineInQR', label: '🪑 Masada Sipariş (QR Kod)', color: 'text-amber-400' },
                                                        { key: 'waiterOrder', label: '👨‍🍳 Garson Sipariş', color: 'text-teal-400' },
                                                        { key: 'staffShiftTracking', label: '⏱️ Vardiya Takibi & Export', color: 'text-cyan-400' },
                                                        { key: 'sponsoredProducts', label: '⭐ Öne Çıkan Ürünler', color: 'text-yellow-400', hasSubFields: true },
                                                        { key: 'basicStatsOnly', label: 'Sadece Temel Raporlar', color: 'text-gray-400', invert: true }, // Logic invert handled in render
                                                    ].map((feature) => (
                                                        <label key={feature.key} className="flex items-center p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 transition-all cursor-pointer group">
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
                                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                                            </div>
                                                            <span className={`ml-3 text-sm font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
                                                        </label>
                                                    ))}
                                                </div>

                                                {/* Sponsored Products Sub-Settings */}
                                                {(formData.features as any)?.sponsoredProducts && (
                                                    <div className="mt-4 bg-yellow-900/10 border border-yellow-700/30 rounded-xl p-4">
                                                        <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-3">⭐ Öne Çıkan Ürün Ayarları</h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs text-gray-400 mb-1.5">Sipariş Başı Ücret (€)</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={(formData as any).sponsoredFeePerConversion ?? 0.40}
                                                                    onChange={e => setFormData({ ...formData, sponsoredFeePerConversion: parseFloat(e.target.value) || 0 } as any)}
                                                                    className="w-full bg-gray-900 border border-yellow-700/40 rounded-lg px-3 py-2.5 text-white text-sm font-bold focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                                                                    placeholder="0.40"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-1">0 = Bedava (bu plan için sponsored ücretsiz)</p>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-400 mb-1.5">Max Ürün Sayısı</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="50"
                                                                    value={(formData as any).sponsoredMaxProducts ?? 5}
                                                                    onChange={e => setFormData({ ...formData, sponsoredMaxProducts: parseInt(e.target.value) || 5 } as any)}
                                                                    className="w-full bg-gray-900 border border-yellow-700/40 rounded-lg px-3 py-2.5 text-white text-sm font-bold focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                                                                    placeholder="5"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-1">Bu plandaki işletme kaç ürün öne çıkarabilir</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 bg-gray-900/50 rounded-lg px-3 py-2">
                                                            <p className="text-xs text-yellow-300/80">
                                                                📊 Bu plandaki işletmeler max <strong>{(formData as any).sponsoredMaxProducts ?? 5}</strong> ürün seçebilir.
                                                                {((formData as any).sponsoredFeePerConversion ?? 0.40) > 0
                                                                    ? <> Her sipariş başı <strong>€{((formData as any).sponsoredFeePerConversion ?? 0.40).toFixed(2)}</strong> ücretlendirilir.</>
                                                                    : <> Sponsored ürünler <strong className="text-green-400">ücretsiz</strong> olarak sunulur.</>
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-8">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 ml-1">Gelecek Entegrasyonlar</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {[
                                                            { key: 'eslIntegration', label: 'ESL Etiket Desteği', color: 'text-indigo-300' },
                                                            { key: 'posIntegration', label: 'POS Entegrasyonu', color: 'text-gray-400' },
                                                            { key: 'scaleIntegration', label: 'Akıllı Kantar', color: 'text-gray-400' },
                                                            { key: 'accountingIntegration', label: 'Muhasebe (Datev)', color: 'text-gray-400' },
                                                            { key: 'aiSupplierOrdering', label: 'B2B: AI Sipariş', color: 'text-green-400' },
                                                            { key: 'aiBestPrice', label: '🧠 AI Fiyat Önerisi', color: 'text-amber-400' },
                                                        ].map((feature) => (
                                                            <label key={feature.key} className="flex items-center p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 transition-all cursor-pointer group">
                                                                <div className="relative flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="peer sr-only"
                                                                        checked={(formData.features as any)?.[feature.key]}
                                                                        onChange={e => setFormData({ ...formData, features: { ...formData.features!, [feature.key]: e.target.checked } })}
                                                                    />
                                                                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                </div>
                                                                <span className={`ml-3 text-xs font-medium ${feature.color} group-hover:text-white transition-colors`}>{feature.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Stripe ID Section (Compact) */}
                                                <div className="mt-8 pt-6 border-t border-gray-700/50">
                                                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Teknik: Stripe IDs</h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <input
                                                            type="text"
                                                            value={formData.stripeProductId || ''}
                                                            onChange={e => setFormData({ ...formData, stripeProductId: e.target.value })}
                                                            className="bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs font-mono text-gray-400 focus:text-white focus:border-blue-500 outline-none"
                                                            placeholder="Product ID (prod_...)"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={formData.stripePriceId?.monthly || ''}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                stripePriceId: { ...formData.stripePriceId, monthly: e.target.value } as any
                                                            })}
                                                            className="bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-xs font-mono text-gray-400 focus:text-white focus:border-blue-500 outline-none"
                                                            placeholder="Monthly Price ID"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>

                                {/* Modal Footer */}
                                <div className="p-5 border-t border-gray-800 bg-gray-900 rounded-b-2xl flex justify-end gap-3 z-10">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-medium transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
                                    >
                                        Değişiklikleri Kaydet
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
