'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

interface ShopProduct {
    id: string;
    name: string;
    description: string;
    brand: string;
    category: string;
    price: number;
    discountPrice?: number;
    images: string[];
    weight?: string;
    stock: number;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

const BRAND_OPTIONS = [
    { value: 'monte_bueno', label: '🫒 Monte Bueno', color: 'bg-yellow-600' },
    { value: 'other', label: '📦 Diğer', color: 'bg-gray-600' },
];

const CATEGORY_OPTIONS = [
    { value: 'olive_oil', label: '🫒 Zeytinyağı', color: 'bg-yellow-600' },
    { value: 'olives', label: '🫒 Zeytin', color: 'bg-green-600' },
    { value: 'spices', label: '🌿 Baharat', color: 'bg-orange-600' },
    { value: 'honey', label: '🍯 Bal', color: 'bg-amber-600' },
    { value: 'jam', label: '🍓 Reçel', color: 'bg-red-600' },
    { value: 'other', label: '📦 Diğer', color: 'bg-gray-600' },
];

const emptyProduct: Omit<ShopProduct, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    description: '',
    brand: 'monte_bueno',
    category: 'olive_oil',
    price: 0,
    discountPrice: undefined,
    images: [],
    weight: '',
    stock: 0,
    isActive: true,
};

export default function ShopProductsPage() {
    const { admin, loading: adminLoading } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<ShopProduct[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<ShopProduct[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [brandFilter, setBrandFilter] = useState('all');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
    const [formData, setFormData] = useState(emptyProduct);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadProducts = useCallback(async () => {
        if (!admin) return;
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'shop_products'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShopProduct));
            setProducts(data);
            setFilteredProducts(data);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => {
        if (!adminLoading && admin) {
            loadProducts();
        }
    }, [adminLoading, admin, loadProducts]);

    // Filter products
    useEffect(() => {
        let result = products;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
        }
        if (categoryFilter !== 'all') {
            result = result.filter(p => p.category === categoryFilter);
        }
        if (brandFilter !== 'all') {
            result = result.filter(p => p.brand === brandFilter);
        }
        setFilteredProducts(result);
    }, [products, searchQuery, categoryFilter, brandFilter]);

    const openAddModal = () => {
        setEditingProduct(null);
        setFormData(emptyProduct);
        setShowModal(true);
    };

    const openEditModal = (product: ShopProduct) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            brand: product.brand,
            category: product.category,
            price: product.price,
            discountPrice: product.discountPrice,
            images: product.images || [],
            weight: product.weight || '',
            stock: product.stock || 0,
            isActive: product.isActive,
        });
        setShowModal(true);
    };

    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const uploadPromises = Array.from(files).slice(0, 5 - formData.images.length).map(async (file) => {
                const storageRef = ref(storage, `shop_products/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                return getDownloadURL(storageRef);
            });
            const urls = await Promise.all(uploadPromises);
            setFormData(prev => ({ ...prev, images: [...prev.images, ...urls] }));
        } catch (error) {
            console.error('Error uploading images:', error);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const handleSave = async () => {
        if (!formData.name || formData.price <= 0) return;
        setSaving(true);
        try {
            const productData = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            if (editingProduct) {
                await updateDoc(doc(db, 'shop_products', editingProduct.id), productData);
            } else {
                await addDoc(collection(db, 'shop_products'), {
                    ...productData,
                    createdAt: serverTimestamp(),
                });
            }
            setShowModal(false);
            loadProducts();
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
        try {
            await deleteDoc(doc(db, 'shop_products', id));
            loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const toggleActive = async (product: ShopProduct) => {
        try {
            await updateDoc(doc(db, 'shop_products', product.id), { isActive: !product.isActive });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !p.isActive } : p));
        } catch (error) {
            console.error('Error toggling active:', error);
        }
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/shop" className="text-gray-400 hover:text-white">← E-Ticaret</Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">📦 Ürün Yönetimi</h1>
                            <p className="text-gray-400 text-sm mt-1">{filteredProducts.length} ürün</p>
                        </div>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-500 hover:to-indigo-500 transition shadow-lg flex items-center gap-2"
                    >
                        <span>➕</span> Yeni Ürün
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-wrap gap-3">
                    <input
                        type="text"
                        placeholder="🔍 Ürün ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    >
                        <option value="all">Tüm Kategoriler</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    >
                        <option value="all">Tüm Markalar</option>
                        {BRAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto">
                {filteredProducts.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                        <div className="text-6xl mb-4">📦</div>
                        <h2 className="text-xl font-bold text-white mb-2">Henüz Ürün Yok</h2>
                        <p className="text-gray-400 mb-6">İlk ürününüzü ekleyin!</p>
                        <button onClick={openAddModal} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold">
                            Ürün Ekle
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map(product => (
                            <div key={product.id} className={`bg-gray-800 rounded-xl border ${product.isActive ? 'border-gray-700' : 'border-red-900/50'} overflow-hidden`}>
                                {/* Image */}
                                <div className="h-40 bg-gray-700 relative">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-4xl">🫒</div>
                                    )}
                                    {!product.isActive && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <span className="text-red-400 font-bold">PASİF</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <span className={`text-xs px-2 py-1 rounded ${BRAND_OPTIONS.find(b => b.value === product.brand)?.color || 'bg-gray-600'} text-white`}>
                                            {BRAND_OPTIONS.find(b => b.value === product.brand)?.label.replace(/[^\w\s]/gi, '') || product.brand}
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="text-white font-semibold truncate">{product.name}</h3>
                                    <p className="text-gray-400 text-sm truncate">{product.weight}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <div>
                                            {product.discountPrice ? (
                                                <>
                                                    <span className="text-gray-500 line-through text-sm">€{product.price.toFixed(2)}</span>
                                                    <span className="text-emerald-400 font-bold ml-2">€{product.discountPrice.toFixed(2)}</span>
                                                </>
                                            ) : (
                                                <span className="text-emerald-400 font-bold">€{product.price.toFixed(2)}</span>
                                            )}
                                        </div>
                                        <span className={`text-xs ${product.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {product.stock > 0 ? `${product.stock} adet` : 'Stokta yok'}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => openEditModal(product)} className="flex-1 bg-blue-600/20 text-blue-400 py-2 rounded-lg hover:bg-blue-600/30 text-sm">
                                            ✏️ Düzenle
                                        </button>
                                        <button onClick={() => toggleActive(product)} className={`px-3 py-2 rounded-lg text-sm ${product.isActive ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}>
                                            {product.isActive ? '🔴' : '🟢'}
                                        </button>
                                        <button onClick={() => handleDelete(product.id)} className="px-3 py-2 rounded-lg text-sm bg-gray-700/50 text-gray-400 hover:bg-gray-700">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                {editingProduct ? '✏️ Ürün Düzenle' : '➕ Yeni Ürün'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Images */}
                            <div>
                                <label className="text-gray-300 text-sm font-medium mb-2 block">Görseller (Max 5)</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formData.images.map((img, i) => (
                                        <div key={i} className="relative w-20 h-20">
                                            <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                                            <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs">×</button>
                                        </div>
                                    ))}
                                    {formData.images.length < 5 && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-20 h-20 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-500 hover:border-purple-500 hover:text-purple-500"
                                        >
                                            {uploading ? '...' : '➕'}
                                        </button>
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="text-gray-300 text-sm font-medium mb-2 block">Ürün Adı *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Monte Bueno Zeytinyağı Extra Virgin"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-gray-300 text-sm font-medium mb-2 block">Açıklama</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    rows={3}
                                    placeholder="Ürün açıklaması..."
                                />
                            </div>

                            {/* Brand & Category */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-300 text-sm font-medium mb-2 block">Marka</label>
                                    <select
                                        value={formData.brand}
                                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    >
                                        {BRAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm font-medium mb-2 block">Kategori</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    >
                                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Price, Discount, Weight, Stock */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-gray-300 text-sm font-medium mb-2 block">Fiyat (€) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm font-medium mb-2 block">İndirimli Fiyat</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.discountPrice || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discountPrice: parseFloat(e.target.value) || undefined }))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm font-medium mb-2 block">Ağırlık/Miktar</label>
                                    <input
                                        type="text"
                                        value={formData.weight}
                                        onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                        placeholder="500ml, 1L, 250g"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm font-medium mb-2 block">Stok</label>
                                    <input
                                        type="number"
                                        value={formData.stock || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                                />
                                <label className="text-gray-300">Ürün Aktif (Satışta)</label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name || formData.price <= 0}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
