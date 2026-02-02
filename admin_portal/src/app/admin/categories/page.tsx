'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

interface Category {
    id: string;
    name: string;
    icon: string;
    order: number;
    isActive: boolean;
    productCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

const DEFAULT_ICONS = ['🥩', '🐑', '🐄', '🐔', '🥓', '📦', '🍖', '🌿', '🧈', '🥚'];

export default function CategoriesPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        icon: '📦',
        isActive: true,
    });

    // Get butcherId from admin context
    const butcherId = admin?.butcherId;

    // Load categories
    useEffect(() => {
        if (!butcherId || adminLoading) return;

        const loadCategories = async () => {
            try {
                const categoriesRef = collection(db, `businesses/${butcherId}/categories`);
                const q = query(categoriesRef, orderBy('order', 'asc'));
                const snapshot = await getDocs(q);

                const cats = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Category[];

                setCategories(cats);
            } catch (error) {
                console.error('Error loading categories:', error);
            }
            setLoading(false);
        };

        loadCategories();
    }, [butcherId, adminLoading]);

    const handleSave = async () => {
        if (!butcherId || !formData.name.trim()) return;

        setSaving(true);
        try {
            const categoriesRef = collection(db, `businesses/${butcherId}/categories`);

            if (editingCategory) {
                // Update existing
                await updateDoc(doc(db, `businesses/${butcherId}/categories`, editingCategory.id), {
                    name: formData.name,
                    icon: formData.icon,
                    isActive: formData.isActive,
                    updatedAt: new Date(),
                });
            } else {
                // Add new
                await addDoc(categoriesRef, {
                    name: formData.name,
                    icon: formData.icon,
                    isActive: formData.isActive,
                    order: categories.length,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            // Reload categories
            const q = query(categoriesRef, orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[]);

            setShowModal(false);
            setEditingCategory(null);
            setFormData({ name: '', icon: '📦', isActive: true });
        } catch (error) {
            console.error('Error saving category:', error);
        }
        setSaving(false);
    };

    const handleDelete = async (categoryId: string) => {
        if (!butcherId || !confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;

        try {
            await deleteDoc(doc(db, `businesses/${butcherId}/categories`, categoryId));
            setCategories(categories.filter(c => c.id !== categoryId));
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    const openEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            icon: category.icon,
            isActive: category.isActive,
        });
        setShowModal(true);
    };

    const openAdd = () => {
        setEditingCategory(null);
        setFormData({ name: '', icon: '📦', isActive: true });
        setShowModal(true);
    };

    // Check if admin has access
    if (!adminLoading && !butcherId) {
        // Super Admin can access by selecting a business first
        const isSuperAdmin = admin?.adminType === 'super';

        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">{isSuperAdmin ? '📂' : '🔒'}</span>
                    <h2 className="text-xl font-bold text-white mt-4">
                        {isSuperAdmin ? 'İşletme Seçin' : 'Erişim Yok'}
                    </h2>
                    <p className="text-gray-400 mt-2">
                        {isSuperAdmin
                            ? 'Kategori yönetimi için önce bir işletme seçmelisiniz.'
                            : 'Kategori yönetimi için bir işletmeye bağlı olmanız gerekiyor.'
                        }
                    </p>
                    <div className="flex gap-3 mt-4 justify-center">
                        <Link href="/admin/dashboard" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">
                            Dashboard'a Git
                        </Link>
                        {isSuperAdmin && (
                            <Link href="/admin/butchers" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
                                İşletmelere Git
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-violet-800 to-violet-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🗂️</span>
                            <div>
                                <h1 className="text-xl font-bold">Kategori Yönetimi</h1>
                                <p className="text-violet-200 text-sm">{categories.length} kategori</p>
                            </div>
                        </div>
                        <button
                            onClick={openAdd}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition"
                        >
                            + Yeni Kategori
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {categories.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <span className="text-5xl">🗂️</span>
                        <h3 className="text-lg font-medium text-white mt-4">Henüz kategori eklenmemiş</h3>
                        <p className="text-gray-400 mt-2">Ürünlerinizi düzenlemek için kategori ekleyin.</p>
                        <button
                            onClick={openAdd}
                            className="mt-4 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition"
                        >
                            + İlk Kategoriyi Ekle
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((category, index) => (
                            <div
                                key={category.id}
                                className={`bg-gray-800 rounded-xl p-4 border-2 transition ${category.isActive ? 'border-gray-700' : 'border-gray-700/50 opacity-60'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{category.icon}</span>
                                        <div>
                                            <h3 className="text-white font-medium">{category.name}</h3>
                                            <p className="text-gray-500 text-sm">
                                                Sıra: {index + 1} • {category.productCount || 0} ürün
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEdit(category)}
                                            className="p-2 text-gray-400 hover:text-white transition"
                                            title="Düzenle"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(category.id)}
                                            className="p-2 text-gray-400 hover:text-red-400 transition"
                                            title="Sil"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {/* Active Toggle */}
                                <div className="mt-3 flex items-center justify-between">
                                    <span className={`text-xs px-2 py-1 rounded ${category.isActive
                                        ? 'bg-green-600/30 text-green-400'
                                        : 'bg-gray-600/30 text-gray-400'
                                        }`}>
                                        {category.isActive ? '✓ Aktif' : 'Pasif'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
                        </h2>

                        {/* Icon Selection */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-2 block">İkon</label>
                            <div className="flex flex-wrap gap-2">
                                {DEFAULT_ICONS.map(icon => (
                                    <button
                                        key={icon}
                                        onClick={() => setFormData({ ...formData, icon })}
                                        className={`w-10 h-10 text-2xl rounded-lg transition ${formData.icon === icon
                                            ? 'bg-violet-600 ring-2 ring-violet-400'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                            }`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name Input */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-2 block">Kategori Adı</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Örn: Dana Eti, Kuzu Eti..."
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        {/* Active Toggle */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-violet-500 focus:ring-violet-500"
                                />
                                <span className="text-gray-300">Aktif (uygulamada görünsün)</span>
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
                                disabled={saving || !formData.name.trim()}
                                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
