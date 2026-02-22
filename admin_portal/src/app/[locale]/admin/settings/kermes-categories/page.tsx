'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface MenuCategory {
    id: string;
    name: string;
    name_de?: string;
    icon: string;
    color: string;
    sortOrder: number;
    isActive: boolean;
}

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

const DEFAULT_ICONS = ['🍖', '🥗', '🍲', '🍰', '☕', '🥤', '🍕', '🥙', '🧁', '🍜', '🔥', '🍞', '🧀', '🥚'];
const DEFAULT_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function KermesCategoriesPage() {
    
  const t = useTranslations('AdminSettingsKermescategories');
const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        name_de: '',
        icon: '🍖',
        color: '#EF4444',
    });

    // Toast helper
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    useEffect(() => {
        if (!adminLoading && admin && admin.role !== 'super_admin') {
            router.push('/admin/kermes');
        }
    }, [admin, adminLoading, router]);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, 'kermes_settings', 'menu_categories');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setCategories(data.items || []);
            } else {
                // Initialize with defaults
                const defaultCategories: MenuCategory[] = [
                    { id: 'cat-1', name: 'Ana Yemek', icon: '🍖', color: '#EF4444', sortOrder: 0, isActive: true },
                    { id: 'cat-2', name: t('corba'), icon: '🍲', color: '#F59E0B', sortOrder: 1, isActive: true },
                    { id: 'cat-3', name: t('tatli'), icon: '🍰', color: '#EC4899', sortOrder: 2, isActive: true },
                    { id: 'cat-4', name: t('i_cecek'), icon: '☕', color: '#10B981', sortOrder: 3, isActive: true },
                    { id: 'cat-5', name: t('atistirmalik'), icon: '🥙', color: '#8B5CF6', sortOrder: 4, isActive: true },
                ];
                // Try to save defaults, but don't fail if it doesn't work
                try {
                    await setDoc(docRef, { items: defaultCategories });
                } catch {
                    // Ignore write error for defaults
                }
                setCategories(defaultCategories);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            showToast(t('kategoriler_yuklenemedi'), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!adminLoading && admin?.role === 'super_admin') {
            loadCategories();
        }
    }, [admin, adminLoading]);

    const saveCategories = async (updatedCategories: MenuCategory[]): Promise<boolean> => {
        setSaving(true);
        try {
            const docRef = doc(db, 'kermes_settings', 'menu_categories');
            await setDoc(docRef, {
                items: updatedCategories,
                updatedAt: new Date().toISOString(),
                updatedBy: admin?.email || 'unknown'
            });
            setCategories(updatedCategories);
            return true;
        } catch (error: unknown) {
            console.error('Error saving categories:', error);
            const errorMessage = error instanceof Error ? error.message : t('bilinmeyen_hata');
            showToast(`Kaydetme hatası: ${errorMessage}`, 'error');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = async () => {
        if (!formData.name.trim()) {
            showToast(t('lutfen_kategori_adi_girin'), 'error');
            return;
        }

        const newCategory: MenuCategory = {
            id: editingCategory?.id || `cat-${Date.now()}`,
            name: formData.name.trim(),
            // name_de sadece değer varsa ekle (Firestore undefined kabul etmez)
            ...(formData.name_de?.trim() ? { name_de: formData.name_de.trim() } : {}),
            icon: formData.icon,
            color: formData.color,
            sortOrder: editingCategory?.sortOrder ?? categories.length,
            isActive: editingCategory?.isActive ?? true,
        };

        let updatedCategories: MenuCategory[];
        if (editingCategory) {
            updatedCategories = categories.map(c => c.id === editingCategory.id ? newCategory : c);
        } else {
            updatedCategories = [...categories, newCategory];
        }

        const success = await saveCategories(updatedCategories);
        if (success) {
            showToast(editingCategory ? t('kategori_guncellendi') : t('yeni_kategori_eklendi'), 'success');
            setShowAddModal(false);
            setEditingCategory(null);
            resetForm();
        }
    };

    const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ id: string; name: string } | null>(null);

    const handleDeleteCategory = (id: string, name: string) => {
        setConfirmDeleteCategory({ id, name });
    };

    const handleDeleteCategoryConfirm = async () => {
        if (!confirmDeleteCategory) return;
        const success = await saveCategories(categories.filter(c => c.id !== confirmDeleteCategory.id));
        if (success) {
            showToast(t('kategori_silindi'), 'success');
        }
        setConfirmDeleteCategory(null);
    };

    const handleToggleActive = async (category: MenuCategory) => {
        const updatedCategories = categories.map(c =>
            c.id === category.id ? { ...c, isActive: !c.isActive } : c
        );
        const success = await saveCategories(updatedCategories);
        if (success) {
            showToast(category.isActive ? t('kategori_devre_disi') : t('kategori_aktif'), 'info');
        }
    };

    const moveCategory = async (index: number, direction: 'up' | 'down') => {
        const newCategories = [...categories];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newCategories.length) return;

        [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
        newCategories.forEach((c, i) => c.sortOrder = i);

        await saveCategories(newCategories);
    };

    const resetForm = () => {
        setFormData({ name: '', name_de: '', icon: '🍖', color: '#EF4444' });
    };

    const openEditModal = (category: MenuCategory) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            name_de: category.name_de || '',
            icon: category.icon,
            color: category.color,
        });
        setShowAddModal(true);
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!admin || admin.role !== 'super_admin') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">{t('erisim_reddedildi_sadece_super_admin')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Toast Notifications */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none flex flex-col gap-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-6 py-4 rounded-xl shadow-2xl text-white font-medium text-center animate-fade-in pointer-events-auto ${toast.type === 'success' ? 'bg-green-600' :
                            toast.type === 'error' ? 'bg-red-600' :
                                'bg-blue-600'
                            }`}
                        style={{
                            animation: t('fadeinup_0_3s_ease_out'),
                        }}
                    >
                        <span className="mr-2">
                            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        {toast.message}
                    </div>
                ))}
            </div>

            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>

            <div className="max-w-4xl mx-auto">
                <Link href="/admin/kermes" className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2">
                    {t('kermes_yonetimi')}
                </Link>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            {t('menu_kategorileri')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {t('kermes_menu_kategorilerini_yonetin')} {categories.length} {t('kategori')}
                        </p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setEditingCategory(null); setShowAddModal(true); }}
                        className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
                    >
                        <span>➕</span>
                        {t('yeni_kategori')}
                    </button>
                </div>

                {/* Categories List */}
                <div className="space-y-3">
                    {categories.map((category, index) => (
                        <div
                            key={category.id}
                            className={`bg-gray-800 rounded-xl p-4 border ${category.isActive ? 'border-gray-600' : 'border-red-500/50 opacity-60'} flex items-center gap-4`}
                        >
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => moveCategory(index, 'up')}
                                    disabled={index === 0 || saving}
                                    className="text-gray-400 hover:text-white disabled:opacity-30 text-sm"
                                >
                                    ▲
                                </button>
                                <button
                                    onClick={() => moveCategory(index, 'down')}
                                    disabled={index === categories.length - 1 || saving}
                                    className="text-gray-400 hover:text-white disabled:opacity-30 text-sm"
                                >
                                    ▼
                                </button>
                            </div>

                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                                style={{ backgroundColor: category.color + '30' }}
                            >
                                {category.icon}
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-white">{category.name}</h3>
                                {category.name_de && (
                                    <p className="text-gray-400 text-sm">{category.name_de}</p>
                                )}
                            </div>

                            <div
                                className="w-6 h-6 rounded-full border-2 border-white/30"
                                style={{ backgroundColor: category.color }}
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(category)}
                                    disabled={saving}
                                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition disabled:opacity-50"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleToggleActive(category)}
                                    disabled={saving}
                                    className={`px-3 py-2 rounded-lg text-sm transition disabled:opacity-50 ${category.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}
                                >
                                    {category.isActive ? '✓' : '✕'}
                                </button>
                                <button
                                    onClick={() => handleDeleteCategory(category.id, category.name)}
                                    disabled={saving}
                                    className="px-3 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg text-sm transition disabled:opacity-50"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {categories.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-4xl mb-4">📂</p>
                        <p>{t('henuz_kategori_yok')}</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingCategory ? t('kategori_duzenle') : t('yeni_kategori')}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{t('kategori_adi_tr')}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    placeholder="Ana Yemek"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">{t('kategori_adi_de')}</label>
                                <input
                                    type="text"
                                    value={formData.name_de}
                                    onChange={(e) => setFormData({ ...formData, name_de: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    placeholder="Hauptgericht"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">İkon</label>
                                <div className="flex flex-wrap gap-2">
                                    {DEFAULT_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon })}
                                            className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition ${formData.icon === icon ? 'bg-pink-500 ring-2 ring-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Renk</label>
                                <div className="flex flex-wrap gap-2">
                                    {DEFAULT_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={`w-10 h-10 rounded-lg transition ${formData.color === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={() => { setShowAddModal(false); setEditingCategory(null); }}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleAddCategory}
                                disabled={saving || !formData.name.trim()}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-500 hover:to-purple-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Kaydediliyor...
                                    </>
                                ) : t('kaydet')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmDeleteCategory}
                onClose={() => setConfirmDeleteCategory(null)}
                onConfirm={handleDeleteCategoryConfirm}
                title={t('kategori_sil')}
                message={t('bu_kategoriyi_silmek_istediginize_emin_m')}
                itemName={confirmDeleteCategory?.name}
                variant="danger"
                confirmText={t('evet_sil')}
                loadingText="Siliniyor..."
            />
        </div>
    );
}
