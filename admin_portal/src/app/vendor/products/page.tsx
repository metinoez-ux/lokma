'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    unit: string;
    category?: string;
    stock?: number;
    isAvailable: boolean;
    imageUrl?: string;
}

export default function VendorProductsPage() {
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        unit: 'kg',
        category: '',
        stock: '',
        isAvailable: true,
    });

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Get business ID
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                if (adminDoc.exists()) {
                    const data = adminDoc.data();
                    setBusinessId(data.butcherId || data.businessId);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Load products - TENANT SCOPED
    useEffect(() => {
        if (!businessId) return;

        const loadProducts = async () => {
            try {
                const q = query(collection(db, 'businesses', businessId, 'products'));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Product[];
                setProducts(data);
            } catch (error) {
                console.error('Error loading products:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProducts();
    }, [businessId]);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: '',
            unit: 'kg',
            category: '',
            stock: '',
            isAvailable: true,
        });
        setEditingProduct(null);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            unit: product.unit || 'kg',
            category: product.category || '',
            stock: product.stock?.toString() || '',
            isAvailable: product.isAvailable ?? true,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!businessId || !formData.name || !formData.price) {
            showToast('Ad ve fiyat zorunludur', 'error');
            return;
        }

        setSaving(true);
        try {
            const productData = {
                name: formData.name,
                description: formData.description || null,
                price: parseFloat(formData.price.replace(',', '.')),
                unit: formData.unit,
                category: formData.category || null,
                stock: formData.stock ? parseInt(formData.stock) : null,
                isAvailable: formData.isAvailable,
                updatedAt: new Date(),
            };

            if (editingProduct) {
                await updateDoc(doc(db, 'businesses', businessId, 'products', editingProduct.id), productData);
                showToast('Ürün güncellendi', 'success');
            } else {
                await addDoc(collection(db, 'businesses', businessId, 'products'), {
                    ...productData,
                    createdAt: new Date(),
                });
                showToast('Ürün eklendi', 'success');
            }

            setShowModal(false);
            resetForm();

            // Reload
            const q = query(collection(db, 'businesses', businessId, 'products'));
            const snapshot = await getDocs(q);
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
        } catch (error) {
            console.error('Error:', error);
            showToast('Kaydedilirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (product: Product) => {
        if (!businessId || !confirm(`"${product.name}" ürününü silmek istiyor musunuz?`)) return;

        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'products', product.id));
            setProducts(products.filter(p => p.id !== product.id));
            showToast('Ürün silindi', 'success');
        } catch (error) {
            console.error('Error:', error);
            showToast('Silinirken hata oluştu', 'error');
        }
    };

    const handleToggleAvailable = async (product: Product) => {
        if (!businessId) return;

        try {
            await updateDoc(doc(db, 'businesses', businessId, 'products', product.id), {
                isAvailable: !product.isAvailable,
                updatedAt: new Date(),
            });
            setProducts(products.map(p =>
                p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p
            ));
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <div className="p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">🍖 Ürünlerim</h1>
                    <p className="text-gray-400">{products.length} ürün</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium"
                >
                    ➕ Ürün Ekle
                </button>
            </div>

            {/* Search */}
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ürün ara..."
                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                />
            </div>

            {/* Products Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                    <span className="text-4xl block mb-2">📦</span>
                    <p className="text-gray-400">Ürün bulunamadı</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            {product.imageUrl && (
                                <img src={product.imageUrl} alt={product.name} className="w-full h-40 object-cover" />
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <h3 className="text-white font-bold">{product.name}</h3>
                                        {product.category && (
                                            <span className="text-xs text-gray-400">{product.category}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleToggleAvailable(product)}
                                        className={`px-2 py-1 rounded text-xs ${product.isAvailable
                                                ? 'bg-green-600/20 text-green-400'
                                                : 'bg-red-600/20 text-red-400'
                                            }`}
                                    >
                                        {product.isAvailable ? '✓ Aktif' : '✗ Pasif'}
                                    </button>
                                </div>

                                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{product.description}</p>

                                <div className="flex items-center justify-between">
                                    <span className="text-green-400 font-bold text-lg">
                                        €{product.price?.toFixed(2)} / {product.unit}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(product)}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">
                                {editingProduct ? '✏️ Ürün Düzenle' : '➕ Yeni Ürün'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Ürün Adı *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Açıklama</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Fiyat (€) *</label>
                                    <input
                                        type="text"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="12,99"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Birim</label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    >
                                        <option value="kg">kg</option>
                                        <option value="adet">Adet</option>
                                        <option value="porsiyon">Porsiyon</option>
                                        <option value="paket">Paket</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Kategori</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        placeholder="Dana, Kuzu..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Stok</label>
                                    <input
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isAvailable"
                                    checked={formData.isAvailable}
                                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                                />
                                <label htmlFor="isAvailable" className="text-white">Ürün satışta</label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-700 flex gap-3">
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl"
                                disabled={saving}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : (editingProduct ? 'Güncelle' : 'Ekle')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
