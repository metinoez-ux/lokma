'use client';

import { useState, useEffect, Suspense } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface Deal {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    discountType: 'percentage' | 'fixed' | 'free_delivery';
    discountValue: number;
    businessIds: string[];
    validFrom: string;
    validUntil: string;
    targetAudience: 'all' | 'new_users' | 'returning';
    isActive: boolean;
    createdAt?: any;
}

interface Business {
    id: string;
    name: string;
}

const AUDIENCE_OPTIONS = [
    { value: 'all', label: 'Tüm Kullanıcılar', icon: '👥' },
    { value: 'new_users', label: 'Yeni Kullanıcılar', icon: '🆕' },
    { value: 'returning', label: 'Geri Dönenler', icon: '🔄' },
];

function DealsPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const isSuperAdmin = admin?.adminType === 'super';

    const [deals, setDeals] = useState<Deal[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [bizSearch, setBizSearch] = useState('');

    const defaultForm: {
        title: string;
        description: string;
        imageUrl: string;
        discountType: 'percentage' | 'fixed' | 'free_delivery';
        discountValue: number;
        businessIds: string[];
        validFrom: string;
        validUntil: string;
        targetAudience: 'all' | 'new_users' | 'returning';
        isActive: boolean;
    } = {
        title: '',
        description: '',
        imageUrl: '',
        discountType: 'percentage',
        discountValue: 10,
        businessIds: [],
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        targetAudience: 'all',
        isActive: true,
    };

    const [formData, setFormData] = useState(defaultForm);

    // Load deals + businesses
    useEffect(() => {
        if (adminLoading) return;

        const load = async () => {
            try {
                // Load deals
                const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                    validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                })) as Deal[];
                setDeals(data);

                // Load businesses for selector
                const bizSnapshot = await getDocs(collection(db, 'businesses'));
                const biz = bizSnapshot.docs.map(d => ({
                    id: d.id,
                    name: d.data().companyName || d.data().name || d.data().businessName || 'İsimsiz',
                })).sort((a, b) => a.name.localeCompare(b.name));
                setBusinesses(biz);
            } catch (error) {
                console.error('Error loading deals:', error);
            }
            setLoading(false);
        };

        load();
    }, [adminLoading]);

    const handleSave = async () => {
        if (!formData.title.trim()) return;

        setSaving(true);
        try {
            const saveData: Record<string, any> = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                imageUrl: formData.imageUrl.trim(),
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),
                businessIds: formData.businessIds,
                // Keep backward compat: also save businessId as first item
                businessId: formData.businessIds.length > 0 ? formData.businessIds[0] : '',
                targetAudience: formData.targetAudience,
                isActive: formData.isActive,
                updatedAt: new Date(),
            };

            if (formData.validFrom) {
                saveData.validFrom = Timestamp.fromDate(new Date(formData.validFrom));
            }
            if (formData.validUntil) {
                saveData.validUntil = Timestamp.fromDate(new Date(formData.validUntil));
            }

            if (editingDeal) {
                await updateDoc(doc(db, 'deals', editingDeal.id), saveData);
            } else {
                saveData.createdAt = new Date();
                await addDoc(collection(db, 'deals'), saveData);
            }

            // Reload
            const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setDeals(snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                validFrom: d.data().validFrom?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
                validUntil: d.data().validUntil?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
            })) as Deal[]);

            setShowModal(false);
            setEditingDeal(null);
            setFormData(defaultForm);
        } catch (error) {
            console.error('Error saving deal:', error);
        }
        setSaving(false);
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete) return;
        try {
            await deleteDoc(doc(db, 'deals', confirmDelete.id));
            setDeals(deals.filter(d => d.id !== confirmDelete.id));
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting deal:', error);
        }
    };

    const openEdit = (deal: Deal) => {
        setEditingDeal(deal);
        setFormData({
            title: deal.title,
            description: deal.description,
            imageUrl: deal.imageUrl,
            discountType: deal.discountType,
            discountValue: deal.discountValue,
            businessIds: deal.businessIds || ((deal as any).businessId ? [(deal as any).businessId] : []),
            validFrom: deal.validFrom || '',
            validUntil: deal.validUntil || '',
            targetAudience: deal.targetAudience,
            isActive: deal.isActive,
        });
        setBizSearch('');
        setShowModal(true);
    };

    const openAdd = () => {
        setEditingDeal(null);
        setFormData(defaultForm);
        setBizSearch('');
        setShowModal(true);
    };

    const toggleBusiness = (bizId: string) => {
        setFormData(prev => {
            const ids = prev.businessIds.includes(bizId)
                ? prev.businessIds.filter(id => id !== bizId)
                : prev.businessIds.length < 10
                    ? [...prev.businessIds, bizId]
                    : prev.businessIds;
            return { ...prev, businessIds: ids };
        });
    };

    const toggleActive = async (deal: Deal) => {
        try {
            await updateDoc(doc(db, 'deals', deal.id), { isActive: !deal.isActive });
            setDeals(deals.map(d => d.id === deal.id ? { ...d, isActive: !d.isActive } : d));
        } catch (error) {
            console.error('Error toggling deal:', error);
        }
    };

    // Access check
    if (!adminLoading && !isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Erişim Yok</h2>
                    <p className="text-gray-400 mt-2">Fırsat yönetimi sadece süper admin tarafından yapılabilir.</p>
                </div>
            </div>
        );
    }

    const filteredDeals = deals.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-amber-800 to-amber-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🔥</span>
                            <div>
                                <h1 className="text-xl font-bold">Fırsat Yönetimi</h1>
                                <p className="text-amber-200 text-sm">{deals.length} fırsat</p>
                            </div>
                        </div>
                        <button
                            onClick={openAdd}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition"
                        >
                            + Yeni Fırsat
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
                        placeholder="Fırsat adı veya açıklaması ara..."
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                {filteredDeals.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <span className="text-5xl">🔥</span>
                        <h3 className="text-lg font-medium text-white mt-4">Henüz fırsat eklenmemiş</h3>
                        <p className="text-gray-400 mt-2">Müşterilerinize özel fırsatlar sunun.</p>
                        <button
                            onClick={openAdd}
                            className="mt-4 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                        >
                            + İlk Fırsatı Ekle
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {filteredDeals.map(deal => {
                            const isExpired = deal.validUntil && new Date(deal.validUntil) < new Date();
                            const dealBizIds = deal.businessIds || ((deal as any).businessId ? [(deal as any).businessId] : []);
                            const businessNames = dealBizIds.map((id: string) => businesses.find(b => b.id === id)?.name).filter(Boolean);

                            return (
                                <div key={deal.id} className={`bg-gray-800 rounded-xl overflow-hidden border transition ${!deal.isActive ? 'border-red-900/50 opacity-60' :
                                    isExpired ? 'border-yellow-900/50 opacity-70' :
                                        'border-gray-700'
                                    }`}>
                                    {/* Image */}
                                    {deal.imageUrl && (
                                        <div className="h-32 bg-gray-700 overflow-hidden">
                                            <img
                                                src={deal.imageUrl}
                                                alt={deal.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    )}

                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-white font-bold text-lg truncate">{deal.title}</h3>
                                                    {isExpired && <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded shrink-0">Süresi Dolmuş</span>}
                                                </div>
                                                {deal.description && (
                                                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{deal.description}</p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                                                    <span className="bg-gray-700 px-2 py-1 rounded">
                                                        {deal.discountType === 'percentage' ? `%${deal.discountValue}` :
                                                            deal.discountType === 'fixed' ? `${deal.discountValue}€` : '🚚 Ücretsiz'}
                                                    </span>
                                                    <span className="bg-gray-700 px-2 py-1 rounded">
                                                        {AUDIENCE_OPTIONS.find(a => a.value === deal.targetAudience)?.icon}{' '}
                                                        {AUDIENCE_OPTIONS.find(a => a.value === deal.targetAudience)?.label}
                                                    </span>
                                                    {businessNames.length > 0 && (
                                                        <span className="bg-gray-700 px-2 py-1 rounded">🏪 {businessNames.length <= 2 ? businessNames.join(', ') : `${businessNames.length} işletme`}</span>
                                                    )}
                                                    {deal.validFrom && (
                                                        <span>{deal.validFrom}{deal.validUntil ? ` → ${deal.validUntil}` : ''}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => toggleActive(deal)}
                                                    className={`p-1.5 rounded-lg transition text-white text-sm ${deal.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                                                >
                                                    {deal.isActive ? '✅' : '⏸️'}
                                                </button>
                                                <button
                                                    onClick={() => openEdit(deal)}
                                                    className="p-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition text-white text-sm"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(deal)}
                                                    className="p-1.5 bg-red-600 hover:bg-red-500 rounded-lg transition text-white text-sm"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
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
                            {editingDeal ? 'Fırsat Düzenle' : 'Yeni Fırsat'}
                        </h2>

                        {/* Title */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Fırsat Başlığı</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Örn: İlk Siparişte %20 İndirim"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Açıklama</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Fırsatın detaylarını yazın..."
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 resize-none"
                            />
                        </div>

                        {/* Image URL */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Görsel URL (Opsiyonel)</label>
                            <input
                                type="text"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        {/* Discount Type + Value */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">İndirim Türü</label>
                                <select
                                    value={formData.discountType}
                                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="percentage">Yüzde (%)</option>
                                    <option value="fixed">Sabit (€)</option>
                                    <option value="free_delivery">Ücretsiz Teslimat</option>
                                </select>
                            </div>
                            {formData.discountType !== 'free_delivery' && (
                                <div>
                                    <label className="text-gray-400 text-sm mb-1 block">
                                        Değer {formData.discountType === 'percentage' ? '(%)' : '(€)'}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.discountValue}
                                        onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Business Multi-Selector */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">
                                İşletmeler ({formData.businessIds.length}/10 seçili)
                                {formData.businessIds.length === 0 && <span className="text-amber-400 ml-2">Boş = Tüm İşletmeler</span>}
                            </label>
                            {/* Selected tags */}
                            {formData.businessIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {formData.businessIds.map(id => {
                                        const biz = businesses.find(b => b.id === id);
                                        return (
                                            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600/30 text-amber-300 text-xs rounded-lg border border-amber-600/40">
                                                {biz?.name || id.slice(0, 8)}
                                                <button
                                                    onClick={() => toggleBusiness(id)}
                                                    className="hover:text-white text-amber-400 font-bold ml-0.5"
                                                >×</button>
                                            </span>
                                        );
                                    })}
                                    <button
                                        onClick={() => setFormData({ ...formData, businessIds: [] })}
                                        className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
                                    >Temizle</button>
                                </div>
                            )}
                            {/* Search */}
                            <input
                                type="text"
                                value={bizSearch}
                                onChange={(e) => setBizSearch(e.target.value)}
                                placeholder="İşletme adı ara..."
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-t-lg text-white text-sm focus:ring-2 focus:ring-amber-500"
                            />
                            {/* List */}
                            <div className="max-h-40 overflow-y-auto bg-gray-700 border border-t-0 border-gray-600 rounded-b-lg">
                                {businesses
                                    .filter(b => b.name.toLowerCase().includes(bizSearch.toLowerCase()))
                                    .map(b => (
                                        <label
                                            key={b.id}
                                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-600 text-sm transition ${formData.businessIds.includes(b.id) ? 'bg-amber-900/30 text-amber-300' : 'text-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.businessIds.includes(b.id)}
                                                onChange={() => toggleBusiness(b.id)}
                                                className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-amber-500 focus:ring-amber-500"
                                            />
                                            {b.name}
                                        </label>
                                    ))}
                                {businesses.filter(b => b.name.toLowerCase().includes(bizSearch.toLowerCase())).length === 0 && (
                                    <p className="px-3 py-2 text-gray-500 text-sm">Sonuç bulunamadı</p>
                                )}
                            </div>
                        </div>

                        {/* Target Audience */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Hedef Kitle</label>
                            <div className="flex gap-2">
                                {AUDIENCE_OPTIONS.map(a => (
                                    <button
                                        key={a.value}
                                        onClick={() => setFormData({ ...formData, targetAudience: a.value as any })}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${formData.targetAudience === a.value
                                            ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                    >
                                        {a.icon} {a.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Başlangıç</label>
                                <input
                                    type="date"
                                    value={formData.validFrom}
                                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Bitiş</label>
                                <input
                                    type="date"
                                    value={formData.validUntil}
                                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        {/* Active */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-500"
                                />
                                <span className="text-gray-300">Aktif (kullanıcılara gösterilsin)</span>
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
                                disabled={saving || !formData.title.trim()}
                                className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
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
                title="Fırsatı Sil"
                message="Bu fırsatı kalıcı olarak silmek istediğinizden emin misiniz?"
                itemName={confirmDelete?.title}
                variant="danger"
                confirmText="Evet, Sil"
                loadingText="Siliniyor..."
            />
        </div>
    );
}

export default function DealsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        }>
            <DealsPageContent />
        </Suspense>
    );
}
