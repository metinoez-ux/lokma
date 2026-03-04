'use client';

import { useState, useEffect, Suspense } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface Coupon {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed' | 'free_delivery';
    discountValue: number;
    minOrderAmount: number;
    maxDiscount: number;
    usageLimit: number;
    usageCount: number;
    perUserLimit: number;
    couponType: 'promo' | 'welcome' | 'loyalty' | 'referral';
    validFrom: string;
    validUntil: string;
    businessId?: string;
    isActive: boolean;
    createdAt?: any;
}

const DISCOUNT_TYPES = [
    { value: 'percentage', label: 'Yüzde (%)', icon: '📊' },
    { value: 'fixed', label: 'Sabit (€)', icon: '💶' },
    { value: 'free_delivery', label: 'Ücretsiz Teslimat', icon: '🚚' },
];

const COUPON_TYPES = [
    { value: 'promo', label: 'Promosyon', icon: '🎯' },
    { value: 'welcome', label: 'Hoş Geldin', icon: '👋' },
    { value: 'loyalty', label: 'Sadakat', icon: '⭐' },
    { value: 'referral', label: 'Referans', icon: '🤝' },
];

function CouponsPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const isSuperAdmin = admin?.adminType === 'super';

    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const defaultForm: {
        code: string;
        discountType: 'percentage' | 'fixed' | 'free_delivery';
        discountValue: number;
        minOrderAmount: number;
        maxDiscount: number;
        usageLimit: number;
        perUserLimit: number;
        couponType: 'promo' | 'welcome' | 'loyalty' | 'referral';
        validFrom: string;
        validUntil: string;
        businessId: string;
        isActive: boolean;
    } = {
        code: '',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 0,
        maxDiscount: 0,
        usageLimit: 0,
        perUserLimit: 0,
        couponType: 'promo',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        businessId: '',
        isActive: true,
    };

    const [formData, setFormData] = useState(defaultForm);

    // Load coupons
    useEffect(() => {
        if (adminLoading) return;

        const loadCoupons = async () => {
            try {
                const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                    validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                })) as Coupon[];
                setCoupons(data);
            } catch (error) {
                console.error('Error loading coupons:', error);
            }
            setLoading(false);
        };

        loadCoupons();
    }, [adminLoading]);

    const handleSave = async () => {
        if (!formData.code.trim()) return;

        setSaving(true);
        try {
            const saveData: Record<string, any> = {
                code: formData.code.trim().toUpperCase(),
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),
                minOrderAmount: Number(formData.minOrderAmount),
                maxDiscount: Number(formData.maxDiscount),
                usageLimit: Number(formData.usageLimit),
                perUserLimit: Number(formData.perUserLimit),
                couponType: formData.couponType,
                isActive: formData.isActive,
                updatedAt: new Date(),
            };

            if (formData.validFrom) {
                saveData.validFrom = Timestamp.fromDate(new Date(formData.validFrom));
            }
            if (formData.validUntil) {
                saveData.validUntil = Timestamp.fromDate(new Date(formData.validUntil));
            }
            if (formData.businessId) {
                saveData.businessId = formData.businessId;
            }

            if (editingCoupon) {
                await updateDoc(doc(db, 'coupons', editingCoupon.id), saveData);
            } else {
                saveData.usageCount = 0;
                saveData.createdAt = new Date();
                await addDoc(collection(db, 'coupons'), saveData);
            }

            // Reload
            const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setCoupons(snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
            })) as Coupon[]);

            setShowModal(false);
            setEditingCoupon(null);
            setFormData(defaultForm);
        } catch (error) {
            console.error('Error saving coupon:', error);
        }
        setSaving(false);
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete) return;
        try {
            await deleteDoc(doc(db, 'coupons', confirmDelete.id));
            setCoupons(coupons.filter(c => c.id !== confirmDelete.id));
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting coupon:', error);
        }
    };

    const openEdit = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        setFormData({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minOrderAmount: coupon.minOrderAmount,
            maxDiscount: coupon.maxDiscount,
            usageLimit: coupon.usageLimit,
            perUserLimit: coupon.perUserLimit,
            couponType: coupon.couponType,
            validFrom: coupon.validFrom || '',
            validUntil: coupon.validUntil || '',
            businessId: coupon.businessId || '',
            isActive: coupon.isActive,
        });
        setShowModal(true);
    };

    const openAdd = () => {
        setEditingCoupon(null);
        setFormData(defaultForm);
        setShowModal(true);
    };

    const toggleActive = async (coupon: Coupon) => {
        try {
            await updateDoc(doc(db, 'coupons', coupon.id), { isActive: !coupon.isActive });
            setCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
        } catch (error) {
            console.error('Error toggling coupon:', error);
        }
    };

    // Access check
    if (!adminLoading && !isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Erişim Yok</h2>
                    <p className="text-gray-400 mt-2">Kupon yönetimi sadece süper admin tarafından yapılabilir.</p>
                </div>
            </div>
        );
    }

    const filteredCoupons = coupons.filter(c =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.couponType.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🎟️</span>
                            <div>
                                <h1 className="text-xl font-bold">Kupon Yönetimi</h1>
                                <p className="text-emerald-200 text-sm">{coupons.length} kupon</p>
                            </div>
                        </div>
                        <button
                            onClick={openAdd}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition"
                        >
                            + Yeni Kupon
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Search */}
                <div className="mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Kupon kodu veya türü ara..."
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {filteredCoupons.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <span className="text-5xl">🎟️</span>
                        <h3 className="text-lg font-medium text-white mt-4">Henüz kupon eklenmemiş</h3>
                        <p className="text-gray-400 mt-2">Müşterilerinize indirim sunmak için kupon ekleyin.</p>
                        <button
                            onClick={openAdd}
                            className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                        >
                            + İlk Kuponu Ekle
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredCoupons.map(coupon => {
                            const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
                            const usageFull = coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit;
                            const statusColor = !coupon.isActive ? 'border-red-900/50 opacity-60'
                                : isExpired ? 'border-yellow-900/50 opacity-70'
                                    : usageFull ? 'border-orange-900/50 opacity-70'
                                        : 'border-gray-700';

                            return (
                                <div key={coupon.id} className={`bg-gray-800 rounded-xl p-4 border transition ${statusColor}`}>
                                    <div className="flex items-center gap-4">
                                        {/* Type Icon */}
                                        <span className="text-3xl">{COUPON_TYPES.find(t => t.value === coupon.couponType)?.icon || '🎟️'}</span>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-white font-bold text-lg font-mono">{coupon.code}</h3>
                                                {isExpired && <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded">Süresi Dolmuş</span>}
                                                {usageFull && <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded">Limit Doldu</span>}
                                            </div>
                                            <p className="text-gray-400 text-sm">
                                                {coupon.discountType === 'percentage' ? `%${coupon.discountValue} indirim` :
                                                    coupon.discountType === 'fixed' ? `${coupon.discountValue}€ indirim` :
                                                        'Ücretsiz teslimat'}
                                                {coupon.minOrderAmount > 0 && ` • Min: ${coupon.minOrderAmount}€`}
                                                {coupon.usageLimit > 0 && ` • Kullanım: ${coupon.usageCount}/${coupon.usageLimit}`}
                                                {coupon.perUserLimit > 0 && ` • Kişi başı: ${coupon.perUserLimit}`}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1">
                                                {coupon.validFrom && `${coupon.validFrom}`}
                                                {coupon.validUntil && ` → ${coupon.validUntil}`}
                                                {coupon.businessId && ` • İşletme: ${coupon.businessId.substring(0, 8)}...`}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleActive(coupon)}
                                                className={`p-2 rounded-lg transition text-white ${coupon.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                                                title={coupon.isActive ? 'Deaktif Yap' : 'Aktif Yap'}
                                            >
                                                {coupon.isActive ? '✅' : '⏸️'}
                                            </button>
                                            <button
                                                onClick={() => openEdit(coupon)}
                                                className="p-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition text-white"
                                                title="Düzenle"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(coupon)}
                                                className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition text-white"
                                                title="Sil"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg my-8">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingCoupon ? 'Kupon Düzenle' : 'Yeni Kupon'}
                        </h2>

                        {/* Code */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Kupon Kodu</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="Örn: HOSGELDIN20"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Discount Type */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">İndirim Türü</label>
                            <div className="flex gap-2">
                                {DISCOUNT_TYPES.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setFormData({ ...formData, discountType: t.value as any })}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${formData.discountType === t.value
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Discount Value */}
                        {formData.discountType !== 'free_delivery' && (
                            <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-1 block">
                                    İndirim Değeri {formData.discountType === 'percentage' ? '(%)' : '(€)'}
                                </label>
                                <input
                                    type="number"
                                    value={formData.discountValue}
                                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        )}

                        {/* Row: Min Order + Max Discount */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Min. Sipariş (€)</label>
                                <input
                                    type="number"
                                    value={formData.minOrderAmount}
                                    onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Max İndirim (€)</label>
                                <input
                                    type="number"
                                    value={formData.maxDiscount}
                                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Row: Usage Limit + Per User Limit */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Toplam Kullanım Limiti</label>
                                <input
                                    type="number"
                                    value={formData.usageLimit}
                                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                                    placeholder="0 = Sınırsız"
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Kişi Başı Limit</label>
                                <input
                                    type="number"
                                    value={formData.perUserLimit}
                                    onChange={(e) => setFormData({ ...formData, perUserLimit: Number(e.target.value) })}
                                    placeholder="0 = Sınırsız"
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Coupon Type */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Kupon Türü</label>
                            <div className="grid grid-cols-2 gap-2">
                                {COUPON_TYPES.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setFormData({ ...formData, couponType: t.value as any })}
                                        className={`px-3 py-2 rounded-lg text-sm transition ${formData.couponType === t.value
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row: Valid From + Valid Until */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Başlangıç Tarihi</label>
                                <input
                                    type="date"
                                    value={formData.validFrom}
                                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Bitiş Tarihi</label>
                                <input
                                    type="date"
                                    value={formData.validUntil}
                                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Business ID (optional) */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">İşletme ID (Opsiyonel — boş bırakırsan tüm işletmelerde geçerli)</label>
                            <input
                                type="text"
                                value={formData.businessId}
                                onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                                placeholder="İşletme ID"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Active Toggle */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-gray-300">Aktif (kullanıcılar kullanabilir)</span>
                            </label>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.code.trim()}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Kuponu Sil"
                message="Bu kuponu kalıcı olarak silmek istediğinizden emin misiniz?"
                itemName={confirmDelete?.code}
                variant="danger"
                confirmText="Evet, Sil"
                loadingText="Siliniyor..."
            />
        </div>
    );
}

export default function CouponsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        }>
            <CouponsPageContent />
        </Suspense>
    );
}
