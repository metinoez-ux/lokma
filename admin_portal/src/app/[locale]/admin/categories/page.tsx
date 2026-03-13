'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useTranslations } from 'next-intl';

interface Business {
    id: string;
    name: string;
    city?: string;
    plz?: string;
}

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

function CategoriesPageContent() {
    const { admin, loading: adminLoading } = useAdmin();
    const searchParams = useSearchParams();
    const urlBusinessId = searchParams.get('businessId');

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

    // Business selector state for Super Admin
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(urlBusinessId);
    const [businessSearch, setBusinessSearch] = useState('');
    const [loadingBusinesses, setLoadingBusinesses] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        icon: '📦',
        isActive: true,
    });

    // Determine the active business ID
    const isSuperAdmin = admin?.adminType === 'super';
    const butcherId = isSuperAdmin ? selectedBusinessId : admin?.butcherId;

    // Load businesses for Super Admin
    useEffect(() => {
        if (!isSuperAdmin || adminLoading) return;

        const loadBusinesses = async () => {
            setLoadingBusinesses(true);
            try {
                const snapshot = await getDocs(collection(db, 'businesses'));
                const biz = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || doc.data().businessName || 'Unbenannt',
                    city: doc.data().city,
                    plz: doc.data().plz,
                })) as Business[];
                setBusinesses(biz.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (error) {
                console.error('Error loading businesses:', error);
            }
            setLoadingBusinesses(false);
        };

        loadBusinesses();
    }, [isSuperAdmin, adminLoading]);

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

    const handleDeleteConfirm = async () => {
        if (!butcherId || !confirmDelete) return;

        try {
            await deleteDoc(doc(db, `businesses/${butcherId}/categories`, confirmDelete.id));
            setCategories(categories.filter(c => c.id !== confirmDelete.id));
            setConfirmDelete(null);
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

    // Move category up or down
    const moveCategory = async (index: number, direction: 'up' | 'down') => {
        if (!butcherId) return;

        const newCategories = [...categories];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newCategories.length) return;

        // Swap
        [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];

        // Update order in Firestore
        try {
            for (let i = 0; i < newCategories.length; i++) {
                const catRef = doc(db, `businesses/${butcherId}/categories`, newCategories[i].id);
                await updateDoc(catRef, { order: i });
            }
            setCategories(newCategories.map((c, i) => ({ ...c, order: i })));
        } catch (error) {
            console.error('Error reordering:', error);
        }
    };

    // Check if admin has access - for Super Admin show business selector inline
    if (!adminLoading && !butcherId && !isSuperAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Kein Zugriff</h2>
                    <p className="text-gray-400 mt-2">
                        Sie müssen mit einem Unternehmen verbunden sein, um Kategorien zu verwalten.
                    </p>
                    <Link href="/admin/dashboard" className="mt-4 inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">
                        Zum Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Filter businesses by search
    const filteredBusinesses = businesses.filter(b =>
        b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
        (b.city && b.city.toLowerCase().includes(businessSearch.toLowerCase())) ||
        (b.plz && b.plz.includes(businessSearch))
    );

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
                                <h1 className="text-xl font-bold">Kategorieverwaltung</h1>
                                <p className="text-violet-200 text-sm">{categories.length} Kategorien</p>
                            </div>
                        </div>
                        <button
                            onClick={openAdd}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition"
                        >
                            + Neue Kategorie
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {categories.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <span className="text-5xl">🗂️</span>
                        <h3 className="text-lg font-medium text-white mt-4">Noch keine Kategorien vorhanden</h3>
                        <p className="text-gray-400 mt-2">Fügen Sie Kategorien hinzu, um Ihre Produkte zu organisieren.</p>
                        <button
                            onClick={openAdd}
                            className="mt-4 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition"
                        >
                            + Erste Kategorie hinzufügen
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {categories.map((category, index) => (
                            <div
                                key={category.id}
                                className={`bg-gray-800 rounded-xl p-4 border transition ${category.isActive ? 'border-gray-700' : 'border-red-900/50 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Move Up/Down Buttons */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button
                                            onClick={() => moveCategory(index, 'up')}
                                            disabled={index === 0}
                                            className="text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                                            title="Nach oben"
                                        >
                                            ▲
                                        </button>
                                        <span className="text-xs text-gray-600">{index + 1}</span>
                                        <button
                                            onClick={() => moveCategory(index, 'down')}
                                            disabled={index === categories.length - 1}
                                            className="text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                                            title="Nach unten"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    {/* Icon */}
                                    <span className="text-4xl">{category.icon}</span>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <h3 className="text-white font-bold text-lg">{category.name}</h3>
                                        <p className="text-gray-500 text-sm">
                                            {category.productCount || 0} Produkte • {category.isActive ? '✅ Aktiv' : '🔴 Inaktiv'}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEdit(category)}
                                            className="p-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition text-white"
                                            title="Bearbeiten"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(category)}
                                            className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition text-white"
                                            title="Löschen"
                                        >
                                            🗑️
                                        </button>
                                    </div>
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
                            {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
                        </h2>

                        {/* Icon Selection */}
                        <div className="mb-4">
                            <label className="text-gray-400 text-sm mb-2 block">Symbol</label>
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
                            <label className="text-gray-400 text-sm mb-2 block">Kategoriename</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="z.B. Rindfleisch, Lammfleisch..."
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
                                <span className="text-gray-300">Aktiv (in der App sichtbar)</span>
                            </label>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name.trim()}
                                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
                            >
                                {saving ? 'Wird gespeichert...' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Kategorie löschen"
                message="Sind Sie sicher, dass Sie diese Kategorie endgültig löschen möchten?"
                itemName={confirmDelete?.name}
                variant="danger"
                confirmText="Ja, löschen"
                loadingText="Wird gelöscht..."
            />
        </div>
    );
}

// Wrapper with Suspense for useSearchParams (Next.js 16 requirement)
export default function CategoriesPage() {
    
  const t = useTranslations('AdminCategories');
return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">{t('yukleniyor')}</div>
            </div>
        }>
            <CategoriesPageContent />
        </Suspense>
    );
}
