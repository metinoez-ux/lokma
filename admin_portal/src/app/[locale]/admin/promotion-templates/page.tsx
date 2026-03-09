'use client';

import { useState, useEffect, Suspense } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PromotionTemplate {
    id: string;
    name: string;
    nameTranslations: Record<string, string>;
    description: string;
    type: string;
    icon: string;
    defaultValue: number;
    defaultDurationDays: number;
    minPlanTier: string;
    allowedPopupFormats: string[];
    isActive: boolean;
    sortOrder: number;
    createdAt?: any;
}

const PROMOTION_TYPES = [
    { value: 'percentOff', label: 'Yüzde İndirim (%)', icon: '🔥' },
    { value: 'fixedOff', label: 'Sabit İndirim (€)', icon: '🎉' },
    { value: 'freeDelivery', label: 'Ücretsiz Teslimat', icon: '🚚' },
    { value: 'buyXGetY', label: '1 Al 1 Bedava (BOGO)', icon: '🎁' },
    { value: 'minOrderDiscount', label: 'Min. Sipariş İndirimi', icon: '💰' },
    { value: 'happyHour', label: 'Happy Hour', icon: '⏰' },
    { value: 'loyaltyCard', label: 'Puan Kartı', icon: '🎖️' },
];

const POPUP_FORMATS = [
    { value: 'bottomSheet', label: 'Bottom Sheet' },
    { value: 'centerModal', label: 'Center Modal' },
    { value: 'topBanner', label: 'Top Banner' },
    { value: 'snackbar', label: 'Snackbar' },
];

const PLAN_TIERS = [
    { value: 'basic', label: 'Basic', icon: '🌱' },
    { value: 'standard', label: 'Standard', icon: '⭐' },
    { value: 'premium', label: 'Premium', icon: '👑' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function PromotionTemplatesPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const isSuperAdmin = admin?.adminType === 'super';

    const [templates, setTemplates] = useState<PromotionTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<PromotionTemplate | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<PromotionTemplate | null>(null);

    const defaultForm = {
        name: '',
        nameTranslations: { tr: '', en: '', de: '' } as Record<string, string>,
        description: '',
        type: 'percentOff',
        icon: '🔥',
        defaultValue: 10,
        defaultDurationDays: 7,
        minPlanTier: 'basic',
        allowedPopupFormats: ['bottomSheet', 'centerModal', 'topBanner', 'snackbar'],
        isActive: true,
        sortOrder: 0,
    };

    const [formData, setFormData] = useState(defaultForm);

    // ─── Load ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (adminLoading) return;

        const load = async () => {
            try {
                const q = query(collection(db, 'promotionTemplates'), orderBy('sortOrder'));
                const snap = await getDocs(q);
                setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PromotionTemplate[]);
            } catch (error) {
                console.error('Error loading templates:', error);
            }
            setLoading(false);
        };

        load();
    }, [adminLoading]);

    // ─── Save ────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        setSaving(true);
        try {
            const saveData: Record<string, any> = {
                name: formData.name.trim(),
                nameTranslations: formData.nameTranslations,
                description: formData.description.trim(),
                type: formData.type,
                icon: formData.icon,
                defaultValue: Number(formData.defaultValue),
                defaultDurationDays: Number(formData.defaultDurationDays),
                minPlanTier: formData.minPlanTier,
                allowedPopupFormats: formData.allowedPopupFormats,
                isActive: formData.isActive,
                sortOrder: Number(formData.sortOrder),
                updatedAt: new Date(),
            };

            if (editing) {
                await updateDoc(doc(db, 'promotionTemplates', editing.id), saveData);
            } else {
                saveData.createdAt = new Date();
                await addDoc(collection(db, 'promotionTemplates'), saveData);
            }

            // Reload
            const q = query(collection(db, 'promotionTemplates'), orderBy('sortOrder'));
            const snap = await getDocs(q);
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PromotionTemplate[]);

            setShowModal(false);
            setEditing(null);
            setFormData(defaultForm);
        } catch (error) {
            console.error('Error saving template:', error);
        }
        setSaving(false);
    };

    // ─── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await deleteDoc(doc(db, 'promotionTemplates', confirmDelete.id));
            setTemplates(templates.filter(t => t.id !== confirmDelete.id));
            setConfirmDelete(null);
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    };

    // ─── Edit ────────────────────────────────────────────────────────────────

    const openEdit = (tpl: PromotionTemplate) => {
        setEditing(tpl);
        setFormData({
            name: tpl.name,
            nameTranslations: tpl.nameTranslations || { tr: '', en: '', de: '' },
            description: tpl.description,
            type: tpl.type,
            icon: tpl.icon || '🔥',
            defaultValue: tpl.defaultValue,
            defaultDurationDays: tpl.defaultDurationDays,
            minPlanTier: tpl.minPlanTier,
            allowedPopupFormats: tpl.allowedPopupFormats || POPUP_FORMATS.map(f => f.value),
            isActive: tpl.isActive,
            sortOrder: tpl.sortOrder,
        });
        setShowModal(true);
    };

    // ─── Toggle Active ──────────────────────────────────────────────────────

    const toggleActive = async (tpl: PromotionTemplate) => {
        try {
            await updateDoc(doc(db, 'promotionTemplates', tpl.id), { isActive: !tpl.isActive });
            setTemplates(templates.map(t => t.id === tpl.id ? { ...t, isActive: !t.isActive } : t));
        } catch (error) {
            console.error('Error toggling template:', error);
        }
    };

    // ─── Access check ────────────────────────────────────────────────────────

    if (!adminLoading && !isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Erişim Yok</h2>
                    <p className="text-gray-400 mt-2">Şablon yönetimi sadece süper admin tarafından yapılabilir.</p>
                </div>
            </div>
        );
    }

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-800 to-purple-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">📋</span>
                            <div>
                                <h1 className="text-xl font-bold">Kampanya Şablonları</h1>
                                <p className="text-purple-200 text-sm">
                                    {templates.length} şablon · {templates.filter(t => t.isActive).length} aktif
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setEditing(null); setFormData(defaultForm); setShowModal(true); }}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition"
                        >
                            + Yeni Şablon
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {templates.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <span className="text-5xl">📋</span>
                        <h3 className="text-lg font-medium text-white mt-4">Henüz şablon yok</h3>
                        <p className="text-gray-400 mt-2">İşletmelerin kullanabileceği kampanya şablonları oluşturun.</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                            + İlk Şablonu Oluştur
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {templates.map(tpl => {
                            const typeInfo = PROMOTION_TYPES.find(t => t.value === tpl.type);
                            const tierInfo = PLAN_TIERS.find(t => t.value === tpl.minPlanTier);

                            return (
                                <div key={tpl.id} className={`bg-gray-800 rounded-xl overflow-hidden border transition ${tpl.isActive ? 'border-gray-700' : 'border-red-900/50 opacity-60'
                                    }`}>
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{tpl.icon}</span>
                                                    <h3 className="text-white font-bold truncate">{tpl.name}</h3>
                                                </div>
                                                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{tpl.description}</p>

                                                <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
                                                    <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">
                                                        {typeInfo?.label}
                                                    </span>
                                                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                                        {tierInfo?.icon} {tierInfo?.label}+
                                                    </span>
                                                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                                        {tpl.defaultDurationDays} gün
                                                    </span>
                                                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                                        {tpl.type === 'percentOff' ? `%${tpl.defaultValue}` :
                                                            tpl.type === 'freeDelivery' ? '🚚' :
                                                                `${tpl.defaultValue}€`}
                                                    </span>
                                                </div>

                                                {/* Translations */}
                                                {tpl.nameTranslations && Object.keys(tpl.nameTranslations).filter(k => tpl.nameTranslations[k]).length > 0 && (
                                                    <div className="mt-2 text-xs text-gray-500 flex gap-1">
                                                        {Object.entries(tpl.nameTranslations).filter(([, v]) => v).map(([lang]) => (
                                                            <span key={lang} className="bg-gray-700/50 px-1.5 py-0.5 rounded uppercase">{lang}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <button
                                                    onClick={() => toggleActive(tpl)}
                                                    className={`p-1.5 rounded-lg transition text-sm ${tpl.isActive ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}
                                                >
                                                    {tpl.isActive ? '✅' : '⏸️'}
                                                </button>
                                                <button
                                                    onClick={() => openEdit(tpl)}
                                                    className="p-1.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition text-white text-sm"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(tpl)}
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
                            {editing ? 'Şablon Düzenle' : 'Yeni Şablon'}
                        </h2>

                        {/* Name */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Şablon Adı (System)</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="first_order_discount"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* Name Translations */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">İsim Çevirileri</label>
                            <div className="space-y-2">
                                {['tr', 'en', 'de'].map(lang => (
                                    <div key={lang} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 uppercase w-6">{lang}</span>
                                        <input
                                            type="text"
                                            value={formData.nameTranslations[lang] || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                nameTranslations: { ...formData.nameTranslations, [lang]: e.target.value }
                                            })}
                                            placeholder={lang === 'tr' ? 'İlk Sipariş İndirimi' : lang === 'en' ? 'First Order Discount' : 'Erstbestellungsrabatt'}
                                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Açıklama</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 resize-none"
                            />
                        </div>

                        {/* Type + Icon */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="col-span-2">
                                <label className="text-gray-400 text-sm mb-1 block">Kampanya Türü</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => {
                                        const typeInfo = PROMOTION_TYPES.find(t => t.value === e.target.value);
                                        setFormData({ ...formData, type: e.target.value, icon: typeInfo?.icon || '🔥' });
                                    }}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                >
                                    {PROMOTION_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">İkon</label>
                                <input
                                    type="text"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl"
                                />
                            </div>
                        </div>

                        {/* Default Value + Duration */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Varsayılan Değer</label>
                                <input
                                    type="number"
                                    value={formData.defaultValue}
                                    onChange={(e) => setFormData({ ...formData, defaultValue: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Süre (Gün)</label>
                                <input
                                    type="number"
                                    value={formData.defaultDurationDays}
                                    onChange={(e) => setFormData({ ...formData, defaultDurationDays: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                />
                            </div>
                        </div>

                        {/* Min Plan Tier */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">Minimum Plan</label>
                            <div className="flex gap-2">
                                {PLAN_TIERS.map(tier => (
                                    <button
                                        key={tier.value}
                                        onClick={() => setFormData({ ...formData, minPlanTier: tier.value })}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${formData.minPlanTier === tier.value
                                            ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                    >
                                        {tier.icon} {tier.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Allowed Popup Formats */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-1 block">İzin Verilen Popup Formatları</label>
                            <div className="flex flex-wrap gap-2">
                                {POPUP_FORMATS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => {
                                            const formats = formData.allowedPopupFormats.includes(f.value)
                                                ? formData.allowedPopupFormats.filter(v => v !== f.value)
                                                : [...formData.allowedPopupFormats, f.value];
                                            setFormData({ ...formData, allowedPopupFormats: formats });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition ${formData.allowedPopupFormats.includes(f.value)
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort Order + Active */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div>
                                <label className="text-gray-400 text-sm mb-1 block">Sıra No</label>
                                <input
                                    type="number"
                                    value={formData.sortOrder}
                                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                />
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-3 cursor-pointer pb-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-purple-500"
                                    />
                                    <span className="text-gray-300">Aktif</span>
                                </label>
                            </div>
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
                                disabled={saving || !formData.name.trim()}
                                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
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
                onConfirm={handleDelete}
                title="Şablonu Sil"
                message="Bu şablonu kalıcı olarak silmek istediğinizden emin misiniz?"
                itemName={confirmDelete?.name}
                variant="danger"
                confirmText="Evet, Sil"
                loadingText="Siliniyor..."
            />
        </div>
    );
}

export default function PromotionTemplatesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        }>
            <PromotionTemplatesPageContent />
        </Suspense>
    );
}
