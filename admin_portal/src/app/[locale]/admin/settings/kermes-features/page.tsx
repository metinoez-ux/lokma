'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface KermesFeature {
    id: string;
    label: string;
    icon: string;
    color: string;
    isActive: boolean;
}

const DEFAULT_FEATURES: KermesFeature[] = [
    { id: 'family_area', label: 'Aile Bölümü', icon: '👨‍👩‍👧‍👦', color: '#E91E63', isActive: true },
    { id: 'parking', label: 'Otopark', icon: '🅿️', color: '#2196F3', isActive: true },
    { id: 'accessible', label: 'Engelli Erişimi', icon: '♿', color: '#9C27B0', isActive: true },
    { id: 'kids_area', label: 'Çocuk Alanı', icon: '🧒', color: '#4CAF50', isActive: true },
    { id: 'outdoor', label: 'Açık Alan', icon: '🌳', color: '#8BC34A', isActive: true },
    { id: 'indoor', label: 'Kapalı Alan', icon: '🏠', color: '#FF5722', isActive: true },
    { id: 'live_music', label: 'Canlı Müzik', icon: '🎵', color: '#607D8B', isActive: true },
    { id: 'prayer_room', label: 'Namaz Alanı', icon: '🕌', color: '#795548', isActive: true },
    { id: 'vegetarian', label: 'Vejetaryen', icon: '🥗', color: '#4CAF50', isActive: true },
    { id: 'halal', label: 'Helal', icon: '☪️', color: '#009688', isActive: true },
    { id: 'free_entry', label: 'Ücretsiz Giriş', icon: '🎟️', color: '#FF9800', isActive: true },
    { id: 'wifi', label: 'WiFi', icon: '📶', color: '#3F51B5', isActive: true },
    { id: 'atm', label: 'ATM', icon: '🏧', color: '#00BCD4', isActive: true },
    { id: 'first_aid', label: 'İlk Yardım', icon: '🏥', color: '#F44336', isActive: true },
    { id: 'security', label: 'Güvenlik', icon: '👮', color: '#455A64', isActive: true },
];

const ICON_OPTIONS = ['👨‍👩‍👧‍👦', '🅿️', '♿', '🧒', '🌳', '🏠', '🎵', '🕌', '🥗', '☪️', '🎟️', '📶', '🏧', '🏥', '👮', '🎪', '🎭', '🎨', '🍽️', '☕', '🚻', '🚼', '🛒', '📸', '🎁', '💳', '🔌', '❄️', '🌡️'];

const COLOR_OPTIONS = ['#E91E63', '#2196F3', '#9C27B0', '#4CAF50', '#8BC34A', '#FF5722', '#607D8B', '#795548', '#009688', '#FF9800', '#3F51B5', '#00BCD4', '#F44336', '#455A64', '#673AB7', '#CDDC39'];

export default function KermesFeaturesPage() {
    
  const t = useTranslations('AdminSettingsKermesfeatures');
const { admin, loading: authLoading } = useAdmin();
    const router = useRouter();
    const [features, setFeatures] = useState<KermesFeature[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newFeature, setNewFeature] = useState({ label: '', icon: '🎪', color: '#E91E63' });
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && (!admin || admin.role !== 'super_admin')) {
            router.push('/admin');
            return;
        }
        loadFeatures();
    }, [admin, authLoading, router]);

    const loadFeatures = async () => {
        try {
            const docRef = doc(db, 'settings', 'kermes_features');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setFeatures(docSnap.data().features || []);
            } else {
                // İlk kez - varsayılan özellikleri kaydet
                await setDoc(docRef, { features: DEFAULT_FEATURES });
                setFeatures(DEFAULT_FEATURES);
            }
        } catch (error) {
            console.error(t('ozellikler_yuklenemedi'), error);
            setFeatures(DEFAULT_FEATURES);
        } finally {
            setLoading(false);
        }
    };

    const saveFeatures = async (updatedFeatures: KermesFeature[]) => {
        setSaving(true);
        try {
            const docRef = doc(db, 'settings', 'kermes_features');
            await setDoc(docRef, { features: updatedFeatures });
            setFeatures(updatedFeatures);
        } catch (error) {
            console.error(t('kaydetme_hatasi'), error);
            alert(t('kaydetme_basarisiz'));
        } finally {
            setSaving(false);
        }
    };

    const addFeature = async () => {
        if (!newFeature.label.trim()) return;

        const id = newFeature.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const feature: KermesFeature = {
            id,
            label: newFeature.label,
            icon: newFeature.icon,
            color: newFeature.color,
            isActive: true,
        };

        const updated = [...features, feature];
        await saveFeatures(updated);
        setNewFeature({ label: '', icon: '🎪', color: '#E91E63' });
    };

    const toggleFeature = async (id: string) => {
        const updated = features.map(f =>
            f.id === id ? { ...f, isActive: !f.isActive } : f
        );
        await saveFeatures(updated);
    };

    const [confirmDeleteFeatureId, setConfirmDeleteFeatureId] = useState<string | null>(null);

    const deleteFeature = (id: string) => {
        setConfirmDeleteFeatureId(id);
    };

    const handleDeleteFeatureConfirm = async () => {
        if (!confirmDeleteFeatureId) return;
        const updated = features.filter(f => f.id !== confirmDeleteFeatureId);
        await saveFeatures(updated);
        setConfirmDeleteFeatureId(null);
    };

    const updateFeature = async (id: string, updates: Partial<KermesFeature>) => {
        const updated = features.map(f =>
            f.id === id ? { ...f, ...updates } : f
        );
        await saveFeatures(updated);
        setEditingId(null);
    };

    // Özellik sırasını değiştirme (yukarı/aşağı)
    const moveFeature = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= features.length) return;

        const updated = [...features];
        const [moved] = updated.splice(index, 1);
        updated.splice(newIndex, 0, moved);
        await saveFeatures(updated);
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
            </div>
        );
    }

    if (admin?.role !== 'super_admin') {
        return null;
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('kermes_ozellikleri')}</h1>
                        <p className="text-muted-foreground mt-1">{t('tum_kermeslerde_kullanilacak_etkinlik_oz')}</p>
                    </div>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        ← Geri
                    </button>
                </div>

                {/* Yeni Özellik Ekle */}
                <div className="bg-card rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4">{t('yeni_ozellik_ekle')}</h2>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm text-muted-foreground mb-1">{t('ozellik_adi')}</label>
                            <input
                                type="text"
                                value={newFeature.label}
                                onChange={(e) => setNewFeature({ ...newFeature, label: e.target.value })}
                                placeholder={t('orn_cay_bahcesi')}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">İkon</label>
                            <select
                                value={newFeature.icon}
                                onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
                                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-2xl focus:border-red-500 focus:outline-none"
                            >
                                {ICON_OPTIONS.map(icon => (
                                    <option key={icon} value={icon}>{icon}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">Renk</label>
                            <input
                                type="color"
                                value={newFeature.color}
                                onChange={(e) => setNewFeature({ ...newFeature, color: e.target.value })}
                                className="w-12 h-10 rounded-lg cursor-pointer border border-gray-600"
                            />
                        </div>
                        <button
                            onClick={addFeature}
                            disabled={!newFeature.label.trim() || saving}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                        >
                            {saving ? '...' : t('ekle')}
                        </button>
                    </div>
                </div>

                {/* Mevcut Özellikler */}
                <div className="bg-card rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">{t('mevcut_ozellikler')}{features.length})</h2>

                    <div className="space-y-3">
                        {features.map((feature, index) => (
                            <div
                                key={feature.id}
                                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${feature.isActive
                                    ? 'bg-gray-700/50 border-gray-600'
                                    : 'bg-card/50 border-border opacity-50'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Sıralama Butonları */}
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => moveFeature(index, 'up')}
                                            disabled={index === 0 || saving}
                                            className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title={t('yukari_tasi')}
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => moveFeature(index, 'down')}
                                            disabled={index === features.length - 1 || saving}
                                            className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title={t('asagi_tasi')}
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    {/* Sıra Numarası */}
                                    <span className="text-xs text-gray-500 font-mono w-6">{index + 1}</span>

                                    {/* Toggle */}
                                    <button
                                        onClick={() => toggleFeature(feature.id)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${feature.isActive ? 'bg-green-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${feature.isActive ? 'left-7' : 'left-1'
                                            }`} />
                                    </button>

                                    {/* İkon ve Renk */}
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                        style={{ backgroundColor: feature.color + '20' }}
                                    >
                                        {feature.icon}
                                    </div>

                                    {/* Etiket */}
                                    {editingId === feature.id ? (
                                        <input
                                            type="text"
                                            value={feature.label}
                                            onChange={(e) => {
                                                const updated = features.map(f =>
                                                    f.id === feature.id ? { ...f, label: e.target.value } : f
                                                );
                                                setFeatures(updated);
                                            }}
                                            onBlur={() => updateFeature(feature.id, { label: feature.label })}
                                            onKeyDown={(e) => e.key === 'Enter' && updateFeature(feature.id, { label: feature.label })}
                                            className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="text-white font-medium">{feature.label}</span>
                                    )}

                                    <span className="text-xs text-gray-500 font-mono">{feature.id}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Renk Düzenle */}
                                    <input
                                        type="color"
                                        value={feature.color}
                                        onChange={(e) => updateFeature(feature.id, { color: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                                    />

                                    {/* İkon Değiştir */}
                                    <select
                                        value={feature.icon}
                                        onChange={(e) => updateFeature(feature.id, { icon: e.target.value })}
                                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xl focus:outline-none"
                                    >
                                        {ICON_OPTIONS.map(icon => (
                                            <option key={icon} value={icon}>{icon}</option>
                                        ))}
                                    </select>

                                    {/* Düzenle */}
                                    <button
                                        onClick={() => setEditingId(editingId === feature.id ? null : feature.id)}
                                        className="p-2 text-muted-foreground hover:text-white transition-colors"
                                        title={t('duzenle')}
                                    >
                                        ✏️
                                    </button>

                                    {/* Sil */}
                                    <button
                                        onClick={() => deleteFeature(feature.id)}
                                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                        title={t('sil')}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {features.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            {t('henuz_ozellik_eklenmemis')}
                        </div>
                    )}
                </div>

                {/* Bilgi */}
                <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                    <p className="text-blue-300 text-sm">
                        💡 <strong>İpucu:</strong> {t('bu_ozellikler_tum_kermeslerde_kullanilac')}
                    </p>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmDeleteFeatureId}
                onClose={() => setConfirmDeleteFeatureId(null)}
                onConfirm={handleDeleteFeatureConfirm}
                title={t('ozellik_sil')}
                message={t('bu_ozelligi_silmek_istediginize_emin_mis')}
                itemName={features.find(f => f.id === confirmDeleteFeatureId)?.label}
                variant="danger"
                confirmText={t('evet_sil')}
                loadingText="Siliniyor..."
            />
        </div>
    );
}
