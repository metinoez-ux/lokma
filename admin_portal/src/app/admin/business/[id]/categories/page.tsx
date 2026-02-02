"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    query,
    orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/components/providers/AdminProvider";
import { ArrowLeft, Plus, GripVertical, Pencil, Trash2, Save, X, FolderOpen } from "lucide-react";

interface BusinessCategory {
    id: string;
    name: string;
    icon: string;
    order: number;
    isActive: boolean;
    createdAt?: string;
}

interface Business {
    id: string;
    companyName: string;
    businessType?: string;
}

const CATEGORY_ICONS = [
    { value: '🍽️', label: 'Yemek' },
    { value: '🥤', label: 'İçecek' },
    { value: '🍰', label: 'Tatlı' },
    { value: '🥗', label: 'Salata' },
    { value: '🍕', label: 'Pizza' },
    { value: '🍔', label: 'Burger' },
    { value: '🌯', label: 'Wrap' },
    { value: '🥙', label: 'Kebap' },
    { value: '🍖', label: 'Et' },
    { value: '🐔', label: 'Tavuk' },
    { value: '🐟', label: 'Balık' },
    { value: '🥬', label: 'Vegan' },
    { value: '☕', label: 'Sıcak İçecek' },
    { value: '🧃', label: 'Soğuk İçecek' },
    { value: '🎂', label: 'Pasta' },
    { value: '🍦', label: 'Dondurma' },
    { value: '📦', label: 'Paket' },
    { value: '⭐', label: 'Özel' },
];

export default function BusinessCategoriesPage() {
    const params = useParams();
    const router = useRouter();
    const businessId = params.id as string;

    const { admin, loading: adminLoading } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [business, setBusiness] = useState<Business | null>(null);
    const [categories, setCategories] = useState<BusinessCategory[]>([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<BusinessCategory | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        icon: '🍽️',
        isActive: true
    });

    // Toast
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Load business info
    const loadBusiness = useCallback(async () => {
        if (!businessId) return;
        try {
            const businessDoc = await getDoc(doc(db, "businesses", businessId));
            if (businessDoc.exists()) {
                setBusiness({
                    id: businessDoc.id,
                    ...businessDoc.data()
                } as Business);
            }
        } catch (error) {
            console.error("Error loading business:", error);
        }
    }, [businessId]);

    // Load categories
    const loadCategories = useCallback(async () => {
        if (!businessId) return;
        setLoading(true);
        try {
            const categoriesRef = collection(db, `businesses/${businessId}/categories`);
            const q = query(categoriesRef, orderBy("order", "asc"));
            const snapshot = await getDocs(q);
            const cats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BusinessCategory[];
            setCategories(cats);
        } catch (error) {
            console.error("Error loading categories:", error);
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        if (!adminLoading && admin) {
            loadBusiness();
            loadCategories();
        }
    }, [adminLoading, admin, loadBusiness, loadCategories]);

    // Open add modal
    const openAddModal = () => {
        setEditingCategory(null);
        setFormData({
            name: '',
            icon: '🍽️',
            isActive: true
        });
        setShowModal(true);
    };

    // Open edit modal
    const openEditModal = (category: BusinessCategory) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            icon: category.icon,
            isActive: category.isActive
        });
        setShowModal(true);
    };

    // Save category
    const handleSave = async () => {
        if (!formData.name.trim()) {
            showToast("Kategori adı gerekli!", "error");
            return;
        }

        setSaving(true);
        try {
            const categoryId = editingCategory?.id || `cat_${Date.now()}`;
            const categoryRef = doc(db, `businesses/${businessId}/categories`, categoryId);

            const categoryData: BusinessCategory = {
                id: categoryId,
                name: formData.name.trim(),
                icon: formData.icon,
                order: editingCategory?.order ?? categories.length,
                isActive: formData.isActive,
                createdAt: editingCategory?.createdAt || new Date().toISOString()
            };

            await setDoc(categoryRef, categoryData);
            showToast(editingCategory ? "Kategori güncellendi!" : "Kategori oluşturuldu!", "success");
            setShowModal(false);
            loadCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            showToast("Kategori kaydedilemedi!", "error");
        } finally {
            setSaving(false);
        }
    };

    // Delete category
    const handleDelete = async (categoryId: string) => {
        if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;

        try {
            await deleteDoc(doc(db, `businesses/${businessId}/categories`, categoryId));
            showToast("Kategori silindi!", "success");
            loadCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            showToast("Kategori silinemedi!", "error");
        }
    };

    // Move category up/down
    const moveCategory = async (index: number, direction: 'up' | 'down') => {
        const newCategories = [...categories];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newCategories.length) return;

        // Swap
        [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];

        // Update order
        try {
            for (let i = 0; i < newCategories.length; i++) {
                const catRef = doc(db, `businesses/${businessId}/categories`, newCategories[i].id);
                await setDoc(catRef, { ...newCategories[i], order: i }, { merge: true });
            }
            setCategories(newCategories.map((c, i) => ({ ...c, order: i })));
        } catch (error) {
            console.error("Error reordering:", error);
        }
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Toast */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                        {toast.message}
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link
                            href={`/admin/business/${businessId}`}
                            className="flex items-center gap-2 text-gray-400 hover:text-white mb-2 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{business?.companyName || 'İşletme'}</span>
                        </Link>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <FolderOpen className="w-8 h-8 text-purple-400" />
                            Ürün/Menü Kategorileri
                        </h1>
                        <p className="text-gray-400 mt-1">
                            Kendi kategorilerinizi oluşturun ve sıralayın
                        </p>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Yeni Kategori
                    </button>
                </div>

                {/* Categories List */}
                {categories.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                        <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Henüz Kategori Yok</h2>
                        <p className="text-gray-400 mb-6">
                            Ürünlerinizi organize etmek için kategoriler oluşturun
                        </p>
                        <button
                            onClick={openAddModal}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors"
                        >
                            İlk Kategorini Oluştur
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {categories.map((category, index) => (
                            <div
                                key={category.id}
                                className={`bg-gray-800 rounded-xl p-4 border transition-all ${category.isActive ? 'border-gray-700' : 'border-red-900/50 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Drag Handle & Order */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button
                                            onClick={() => moveCategory(index, 'up')}
                                            disabled={index === 0}
                                            className="text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            ▲
                                        </button>
                                        <GripVertical className="w-5 h-5 text-gray-600" />
                                        <button
                                            onClick={() => moveCategory(index, 'down')}
                                            disabled={index === categories.length - 1}
                                            className="text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    {/* Icon */}
                                    <div className="text-4xl">{category.icon}</div>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold">{category.name}</h3>
                                        <p className="text-sm text-gray-400">
                                            Sıra: {index + 1} • {category.isActive ? '✅ Aktif' : '🔴 Pasif'}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEditModal(category)}
                                            className="p-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(category.id)}
                                            className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info Box */}
                <div className="mt-8 bg-purple-900/30 border border-purple-700 rounded-xl p-4">
                    <h3 className="font-semibold text-purple-300 mb-2">💡 Nasıl Çalışır?</h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                        <li>• Kategoriler, mobil uygulamada üst sekmeler olarak görünür</li>
                        <li>• Sıralama, mobil uygulamadaki sekme sırasını belirler</li>
                        <li>• Pasif kategoriler müşterilere gösterilmez</li>
                        <li>• Ürünleri kategorilere atamak için &quot;Ürünler&quot; sayfasını kullanın</li>
                    </ul>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">
                                {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Kategori Adı *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Örn: Menüler, İçecekler, Tatlılar"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                />
                            </div>

                            {/* Icon */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">İkon</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORY_ICONS.map(icon => (
                                        <button
                                            key={icon.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon: icon.value })}
                                            className={`w-12 h-12 rounded-lg text-2xl transition-all ${formData.icon === icon.value
                                                    ? 'bg-purple-600 border-2 border-purple-400'
                                                    : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                                                }`}
                                            title={icon.label}
                                        >
                                            {icon.value}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">Aktif</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`w-12 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-gray-600'
                                        }`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-0.5'
                                        }`} />
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
