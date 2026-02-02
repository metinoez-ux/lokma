'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, addDoc, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Master Catalog
const MASTER_CATALOG = [
    // Dana Eti
    { sku: 'TM-D001', name: 'Dana Antrikot', category: 'dana', unitType: 'kg', defaultPrice: 44.99 },
    { sku: 'TM-D002', name: 'Dana Bonfile', category: 'dana', unitType: 'kg', defaultPrice: 54.99 },
    { sku: 'TM-D003', name: 'Dana Kıyma', category: 'dana', unitType: 'kg', defaultPrice: 18.99 },
    { sku: 'TM-D004', name: 'Dana Kuşbaşı', category: 'dana', unitType: 'kg', defaultPrice: 32.99 },
    { sku: 'TM-D005', name: 'Dana Kaburga', category: 'dana', unitType: 'kg', defaultPrice: 21.99 },
    { sku: 'TM-D006', name: 'Dana Ciğer', category: 'dana', unitType: 'kg', defaultPrice: 16.99 },
    { sku: 'TM-D007', name: 'Dana But', category: 'dana', unitType: 'kg', defaultPrice: 28.99 },
    // Kuzu Eti
    { sku: 'TM-K001', name: 'Kuzu Pirzola', category: 'kuzu', unitType: 'kg', defaultPrice: 35.99 },
    { sku: 'TM-K002', name: 'Kuzu But', category: 'kuzu', unitType: 'kg', defaultPrice: 29.99 },
    { sku: 'TM-K003', name: 'Kuzu Kıyma', category: 'kuzu', unitType: 'kg', defaultPrice: 24.99 },
    { sku: 'TM-K004', name: 'Kuzu Kaburga', category: 'kuzu', unitType: 'kg', defaultPrice: 26.99 },
    // Tavuk
    { sku: 'TM-T001', name: 'Tavuk Göğsü', category: 'tavuk', unitType: 'kg', defaultPrice: 11.99 },
    { sku: 'TM-T002', name: 'Bütün Tavuk', category: 'tavuk', unitType: 'adet', defaultPrice: 12.99 },
    { sku: 'TM-T003', name: 'Tavuk But', category: 'tavuk', unitType: 'kg', defaultPrice: 8.99 },
    // İşlenmiş
    { sku: 'TM-I001', name: 'Dana Sucuk', category: 'islenmis', unitType: 'kg', defaultPrice: 26.99 },
    { sku: 'TM-I002', name: 'Pastırma', category: 'islenmis', unitType: 'kg', defaultPrice: 49.99 },
    { sku: 'TM-I003', name: 'Kasap Köfte', category: 'islenmis', unitType: 'kg', defaultPrice: 22.99 },
    // Paketler
    { sku: 'TM-P001', name: 'Kurban Paketi', category: 'ozel', unitType: 'paket', defaultPrice: 299.99 },
    { sku: 'TM-P002', name: 'Mangal Paketi', category: 'ozel', unitType: 'paket', defaultPrice: 89.99 },
    { sku: 'TM-P003', name: 'Aile Paketi', category: 'ozel', unitType: 'paket', defaultPrice: 149.99 },
];

interface VendorProduct {
    id: string;
    sku: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    isActive: boolean;
    inStock: boolean;
}

export default function VendorProductsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [vendorId, setVendorId] = useState<string | null>(null);
    const [vendorName, setVendorName] = useState<string>('');
    const [products, setProducts] = useState<VendorProduct[]>([]);
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<typeof MASTER_CATALOG[0] | null>(null);
    const [salePrice, setSalePrice] = useState('');
    const [saving, setSaving] = useState(false);

    const loadProducts = useCallback((vId: string) => {
        const productsQuery = query(
            collection(db, 'products'),
            where('businessId', '==', vId)
        );

        return onSnapshot(productsQuery, (snapshot) => {
            const data = snapshot.docs.map(d => ({
                id: d.id,
                sku: d.data().sku || d.data().productId,
                name: d.data().name,
                category: d.data().category,
                unit: d.data().unit,
                price: d.data().price,
                isActive: d.data().isActive ?? true,
                inStock: d.data().inStock ?? true,
            } as VendorProduct));
            setProducts(data);
        });
    }, []);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // Check vendor_admins first
                const vendorAdminDoc = await getDoc(doc(db, 'vendor_admins', user.uid));
                if (vendorAdminDoc.exists()) {
                    const data = vendorAdminDoc.data();
                    setVendorId(data.vendorId);
                    // Get vendor name
                    const vendorDoc = await getDoc(doc(db, 'businesses', data.vendorId));
                    if (vendorDoc.exists()) {
                        setVendorName(vendorDoc.data().companyName);
                    }
                    loadProducts(data.vendorId);
                } else {
                    // Demo: Super admin gets first butcher
                    const { isSuperAdmin } = await import('@/lib/config');
                    if (isSuperAdmin(user.email)) {
                        const butchersQuery = query(collection(db, 'businesses'), limit(1));
                        const snapshot = await getDocs(butchersQuery);
                        if (!snapshot.empty) {
                            const butcher = snapshot.docs[0];
                            setVendorId(butcher.id);
                            setVendorName(butcher.data().companyName);
                            loadProducts(butcher.id);
                        }
                    } else {
                        router.push('/dashboard');
                        return;
                    }
                }
                setLoading(false);
            } catch (error) {
                console.error('Auth error:', error);
                router.push('/login');
            }
        });

        return () => unsubscribeAuth();
    }, [router, loadProducts]);

    // Update price
    const updatePrice = async (productId: string, newPrice: number) => {
        try {
            await updateDoc(doc(db, 'products', productId), { price: newPrice });
        } catch (error) {
            console.error('Update price error:', error);
        }
    };

    // Toggle stock
    const toggleStock = async (productId: string, currentStock: boolean) => {
        try {
            await updateDoc(doc(db, 'products', productId), { inStock: !currentStock });
        } catch (error) {
            console.error('Toggle stock error:', error);
        }
    };

    // Toggle active
    const toggleActive = async (productId: string, currentActive: boolean) => {
        try {
            await updateDoc(doc(db, 'products', productId), { isActive: !currentActive });
        } catch (error) {
            console.error('Toggle active error:', error);
        }
    };

    // Delete product
    const deleteProduct = async (productId: string) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
        try {
            await deleteDoc(doc(db, 'products', productId));
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    // Add product from catalog
    const addCatalogProduct = async () => {
        if (!selectedProduct || !vendorId || !salePrice) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'products'), {
                butcherId: vendorId,
                productId: selectedProduct.sku,
                sku: selectedProduct.sku,
                name: selectedProduct.name,
                category: selectedProduct.category,
                unit: selectedProduct.unitType,
                price: parseFloat(salePrice),
                isActive: true,
                inStock: true,
                createdAt: new Date(),
            });
            setShowCatalogModal(false);
            setSelectedProduct(null);
            setSalePrice('');
        } catch (error) {
            console.error('Add product error:', error);
        }
        setSaving(false);
    };

    // Get category label
    const getCategoryLabel = (cat: string) => {
        const labels: Record<string, string> = {
            dana: '🐄 Dana Eti',
            kuzu: '🐑 Kuzu Eti',
            tavuk: '🐔 Tavuk',
            islenmis: '🥓 İşlenmiş',
            ozel: '📦 Özel Paketler',
        };
        return labels[cat] || cat;
    };

    // Filter catalog
    const filteredCatalog = MASTER_CATALOG.filter(p =>
        !products.some(ep => ep.sku === p.sku) &&
        (p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(catalogSearch.toLowerCase()))
    );

    // Group products by category
    const groupedProducts = products.reduce((acc, p) => {
        if (!acc[p.category]) acc[p.category] = [];
        acc[p.category].push(p);
        return acc;
    }, {} as Record<string, VendorProduct[]>);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-red-800 to-red-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <Link href="/vendor-panel" className="flex items-center gap-2 text-red-100 hover:text-white">
                        <span className="text-xl">←</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-3xl">📦</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{vendorName} - Ürün Yönetimi</h1>
                                <p className="text-gray-400 text-sm mt-1">{products.length} ürün kayıtlı</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCatalogModal(true)}
                            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                        >
                            📦 Ürün Ekle
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Products List */}
                {Object.keys(groupedProducts).length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="text-4xl mb-4">🥩</div>
                        <h3 className="text-lg font-medium text-white mb-2">Henüz ürün eklenmemiş</h3>
                        <p className="text-gray-400 mb-4">Katalogdan ürün ekleyerek başlayın.</p>
                        <button
                            onClick={() => setShowCatalogModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            📦 Ürün Ekle
                        </button>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                        <div key={category} className="bg-gray-800 rounded-xl mb-4 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-700 bg-gray-750">
                                <h3 className="font-medium text-white">{getCategoryLabel(category)}</h3>
                            </div>
                            <div className="divide-y divide-gray-700">
                                {categoryProducts.map(product => (
                                    <div key={product.id} className={`p-4 flex items-center justify-between ${!product.isActive ? 'opacity-50' : ''}`}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-blue-400">{product.sku}</span>
                                                <span className="text-white font-medium">{product.name}</span>
                                            </div>
                                            <span className="text-gray-500 text-sm">{product.unit}</span>
                                        </div>

                                        {/* Price Input */}
                                        <div className="flex items-center gap-2 mr-4">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={product.price}
                                                onChange={(e) => updatePrice(product.id, parseFloat(e.target.value) || 0)}
                                                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white text-right"
                                            />
                                            <span className="text-gray-500 text-sm">€/{product.unit}</span>
                                        </div>

                                        {/* Stock Toggle */}
                                        <button
                                            onClick={() => toggleStock(product.id, product.inStock)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium mr-2 ${product.inStock
                                                ? 'bg-green-600/30 text-green-400'
                                                : 'bg-red-600/30 text-red-400'
                                                }`}
                                        >
                                            {product.inStock ? '✓ Stokta' : '✕ Tükendi'}
                                        </button>

                                        {/* Active Toggle */}
                                        <button
                                            onClick={() => toggleActive(product.id, product.isActive)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium mr-2 ${product.isActive
                                                ? 'bg-blue-600/30 text-blue-400'
                                                : 'bg-gray-600/30 text-gray-400'
                                                }`}
                                        >
                                            {product.isActive ? 'Aktif' : 'Pasif'}
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => deleteProduct(product.id)}
                                            className="text-red-400 hover:text-red-300 p-2"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </main>

            {/* Catalog Modal */}
            {showCatalogModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-700">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-bold text-white">📦 Katalogdan Ürün Ekle</h2>
                                <button onClick={() => { setShowCatalogModal(false); setSelectedProduct(null); }} className="text-gray-400 hover:text-white text-xl">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {!selectedProduct ? (
                                <>
                                    <input
                                        type="text"
                                        value={catalogSearch}
                                        onChange={(e) => setCatalogSearch(e.target.value)}
                                        placeholder="Ürün adı veya SKU ara..."
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white mb-4"
                                        autoFocus
                                    />
                                    <div className="max-h-80 overflow-y-auto space-y-2">
                                        {filteredCatalog.map(product => (
                                            <button
                                                key={product.sku}
                                                onClick={() => {
                                                    setSelectedProduct(product);
                                                    setSalePrice(product.defaultPrice.toString());
                                                }}
                                                className="w-full bg-gray-700 hover:bg-gray-650 rounded-lg p-3 flex items-center justify-between text-left"
                                            >
                                                <div>
                                                    <span className="text-xs font-mono text-blue-400 mr-2">{product.sku}</span>
                                                    <span className="text-white">{product.name}</span>
                                                </div>
                                                <span className="text-gray-400">{product.defaultPrice}€</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-gray-700 rounded-lg p-4">
                                        <p className="text-xs font-mono text-blue-400">{selectedProduct.sku}</p>
                                        <p className="text-white text-lg font-bold">{selectedProduct.name}</p>
                                        <p className="text-gray-400 text-sm">Önerilen: {selectedProduct.defaultPrice}€/{selectedProduct.unitType}</p>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">Satış Fiyatı (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={salePrice}
                                            onChange={(e) => setSalePrice(e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-xl"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSelectedProduct(null)}
                                            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                                        >
                                            ← Geri
                                        </button>
                                        <button
                                            onClick={addCatalogProduct}
                                            disabled={saving || !salePrice}
                                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {saving ? 'Ekleniyor...' : '✓ Ürünü Ekle'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
