'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface Sector {
    id: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    category: 'yemek' | 'market' | 'kermes' | 'hizmet';
    isActive: boolean;
    sortOrder: number;
    features: string[];
}

const CATEGORY_OPTIONS = [
    { value: 'yemek', label: '🍽️ Yemek', description: 'Yemek sekmesinde gösterilir' },
    { value: 'market', label: '🛒 Marketler', description: 'Marketler sekmesinde gösterilir' },
    { value: 'kermes', label: '🎪 Kermes', description: 'Kermes sekmesinde gösterilir (4. ana kategori)' },
    { value: 'hizmet', label: '🔧 Hizmet', description: 'Ayrı sayfa olarak gösterilir' },
];

const COLOR_OPTIONS = [
    'red', 'amber', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
    'cyan', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose'
];

const EMOJI_OPTIONS = [
    '🍽️', '🥩', '🛒', '🎂', '☕', '🥙', '🥖', '🎉', '🌸', '🎪', '🛍️',
    '🍕', '🍔', '🌮', '🍜', '🍣', '🍰', '🧁', '🍪', '🥗', '🍝', '🍱',
    '🥤', '🧃', '🍺', '🍷', '🧀', '🥚', '🍞', '🥐', '🧈', '🍯', '🥛'
];

const DEFAULT_NEW_SECTOR: Omit<Sector, 'id'> = {
    label: '',
    icon: '🏪',
    color: 'gray',
    description: '',
    category: 'yemek',
    isActive: true,
    sortOrder: 100,
    features: ['products', 'orders', 'delivery'],
};

export default function SectorsPage() {
    
  const t = useTranslations('AdminSectors');
const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSector, setEditingSector] = useState<Sector | null>(null);
    const [isNewSector, setIsNewSector] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        fetchSectors();
    }, []);

    const fetchSectors = async () => {
        try {
            const res = await fetch('/api/admin/sectors');
            const data = await res.json();
            setSectors(data.sectors || []);
        } catch (error) {
            console.error('Failed to fetch sectors:', error);
            toast.error(t('sektorler_yuklenemedi'));
        } finally {
            setLoading(false);
        }
    };

    const seedSectors = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/sectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'seed' }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchSectors();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error(t('seed_islemi_basarisiz'));
        } finally {
            setSaving(false);
        }
    };

    const createSector = async () => {
        if (!editingSector) return;

        // Validate ID
        const sectorId = editingSector.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!sectorId || sectorId.length < 2) {
            toast.error(t('gecerli_bir_sektor_id_giriniz_en_az_2_ka'));
            return;
        }
        if (sectors.some(s => s.id === sectorId)) {
            toast.error(t('bu_id_zaten_kullaniliyor'));
            return;
        }
        if (!editingSector.label) {
            toast.error(t('sektor_adi_giriniz'));
            return;
        }

        try {
            setSaving(true);
            const res = await fetch('/api/admin/sectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    sector: { ...editingSector, id: sectorId }
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t('yeni_sektor_olusturuldu'));
                setEditingSector(null);
                setIsNewSector(false);
                fetchSectors();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error(t('olusturma_basarisiz'));
        } finally {
            setSaving(false);
        }
    };

    const updateSector = async (updates: Partial<Sector>) => {
        if (!editingSector) return;

        try {
            setSaving(true);
            const res = await fetch('/api/admin/sectors', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingSector.id, ...updates }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t('sektor_guncellendi'));
                setEditingSector(null);
                fetchSectors();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error(t('guncelleme_basarisiz'));
        } finally {
            setSaving(false);
        }
    };

    const deleteSector = async (id: string) => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/sectors', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t('sektor_silindi'));
                setDeleteConfirm(null);
                setEditingSector(null);
                fetchSectors();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error(t('silme_basarisiz'));
        } finally {
            setSaving(false);
        }
    };

    const openNewSectorModal = () => {
        setEditingSector({ id: '', ...DEFAULT_NEW_SECTOR } as Sector);
        setIsNewSector(true);
    };

    const getCategoryBadge = (category: string) => {
        const opt = CATEGORY_OPTIONS.find(c => c.value === category);
        const colors: Record<string, string> = {
            yemek: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            market: 'bg-green-500/20 text-green-400 border-green-500/30',
            kermes: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
            hizmet: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs border ${colors[category] || 'bg-gray-500/20'}`}>
                {opt?.label || category}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0f0f0f]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold">{t('sektor_yonetimi')}</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {t('sektorlerin_hangi_kategoride_gorunecegin')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {sectors.length === 0 && (
                            <button
                                onClick={seedSectors}
                                disabled={saving}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                                {saving ? t('yukleniyor') : t('varsayilan_sektorleri_yukle')}
                            </button>
                        )}
                        <button
                            onClick={openNewSectorModal}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            <span>➕</span> Yeni Sektör Ekle
                        </button>
                    </div>
                </div>

                {/* Category Legend */}
                <div className="flex gap-4 mb-6 flex-wrap">
                    {CATEGORY_OPTIONS.map(cat => (
                        <div key={cat.value} className="flex items-center gap-2 text-sm text-gray-400">
                            {getCategoryBadge(cat.value)}
                            <span>{cat.description}</span>
                        </div>
                    ))}
                </div>

                {/* Sectors Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sectors.map(sector => (
                        <div
                            key={sector.id}
                            className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-red-500/50 ${sector.isActive
                                ? 'bg-[#1a1a1a] border-gray-800'
                                : 'bg-[#1a1a1a]/50 border-gray-800/50 opacity-60'
                                }`}
                            onClick={() => { setEditingSector(sector); setIsNewSector(false); }}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{sector.icon}</span>
                                    <div>
                                        <h3 className="font-semibold">{sector.label}</h3>
                                        <p className="text-xs text-gray-500">{sector.description}</p>
                                    </div>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${sector.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
                            </div>
                            <div className="flex items-center justify-between">
                                {getCategoryBadge(sector.category)}
                                <span className="text-xs text-gray-500">{t('sira')} {sector.sortOrder}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Edit/Create Modal */}
                {editingSector && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg border border-gray-800 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">
                                    {isNewSector ? t('yeni_sektor_ekle') : `${editingSector.icon} ${editingSector.label}`}
                                </h2>
                                <button onClick={() => { setEditingSector(null); setIsNewSector(false); }} className="text-gray-500 hover:text-white">
                                    ✕
                                </button>
                            </div>

                            {/* ID (only for new) */}
                            {isNewSector && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('sektor_id_kucuk_harf_bosluksuz')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSector.id}
                                        onChange={(e) => setEditingSector({ ...editingSector, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                        placeholder="ornek: doner"
                                        className="w-full px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg focus:border-red-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Label */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('sektor_adi')}
                                </label>
                                <input
                                    type="text"
                                    value={editingSector.label}
                                    onChange={(e) => setEditingSector({ ...editingSector, label: e.target.value })}
                                    placeholder={t('donerci')}
                                    className="w-full px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg focus:border-red-500 outline-none"
                                />
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('aciklama')}
                                </label>
                                <input
                                    type="text"
                                    value={editingSector.description}
                                    onChange={(e) => setEditingSector({ ...editingSector, description: e.target.value })}
                                    placeholder={t('doner_kebap')}
                                    className="w-full px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg focus:border-red-500 outline-none"
                                />
                            </div>

                            {/* Icon Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    İkon
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {EMOJI_OPTIONS.map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => setEditingSector({ ...editingSector, icon: emoji })}
                                            className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${editingSector.icon === emoji
                                                ? 'bg-red-500/30 border-2 border-red-500'
                                                : 'bg-gray-800 hover:bg-gray-700'
                                                }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('kategori_mobil_app_sekmesi')}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CATEGORY_OPTIONS.map(cat => (
                                        <button
                                            key={cat.value}
                                            onClick={() => setEditingSector({ ...editingSector, category: cat.value as any })}
                                            className={`p-3 rounded-lg border text-center transition-all ${editingSector.category === cat.value
                                                ? 'border-red-500 bg-red-500/20'
                                                : 'border-gray-700 hover:border-gray-600'
                                                }`}
                                        >
                                            <div className="text-lg">{cat.label.split(' ')[0]}</div>
                                            <div className="text-xs text-gray-400">{cat.value}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sort Order */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('siralama')}
                                </label>
                                <input
                                    type="number"
                                    value={editingSector.sortOrder}
                                    onChange={(e) => setEditingSector({ ...editingSector, sortOrder: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg focus:border-red-500 outline-none"
                                />
                            </div>

                            {/* Active Toggle */}
                            <div className="mb-6">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-medium text-gray-400">{t('aktif')}</span>
                                    <div
                                        onClick={() => setEditingSector({ ...editingSector, isActive: !editingSector.isActive })}
                                        className={`w-12 h-6 rounded-full transition-colors ${editingSector.isActive ? 'bg-green-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform m-0.5 ${editingSector.isActive ? 'translate-x-6' : 'translate-x-0'
                                            }`} />
                                    </div>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                {!isNewSector && (
                                    <button
                                        onClick={() => setDeleteConfirm(editingSector.id)}
                                        className="px-4 py-2 border border-red-700 text-red-400 rounded-lg hover:bg-red-900/30"
                                    >
                                        {t('sil')}
                                    </button>
                                )}
                                <button
                                    onClick={() => { setEditingSector(null); setIsNewSector(false); }}
                                    className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={() => isNewSector ? createSector() : updateSector({
                                        label: editingSector.label,
                                        description: editingSector.description,
                                        icon: editingSector.icon,
                                        category: editingSector.category,
                                        sortOrder: editingSector.sortOrder,
                                        isActive: editingSector.isActive,
                                    })}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                                >
                                    {saving ? 'Kaydediliyor...' : (isNewSector ? t('olustur') : t('kaydet'))}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
                        <div className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm border border-red-800">
                            <h3 className="text-lg font-bold mb-4 text-red-400">{t('sektoru_sil')}</h3>
                            <p className="text-gray-400 mb-6">
                                {t('bu_sektoru_silmek_istediginizden_emin_mi')}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={() => deleteSector(deleteConfirm)}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                                >
                                    {saving ? 'Siliniyor...' : t('evet_sil')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
