'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import Link from 'next/link';

// Master Catalog Product Interface
interface MasterCatalogProduct {
    id: string;
    sku: string;
    name: string;
    description?: string;
    category: string;
    defaultUnit: string;
    defaultPrice?: number;
    allowedBusinessTypes?: string[];
    isActive?: boolean;
}

// Business Category Interface
interface BusinessCategory {
    id: string;
    name: string;
    icon: string;
    order: number;
    isActive: boolean;
}

// Business Product Interface
interface BusinessProduct {
    id: string;
    productId: string;
    masterProductId?: string;
    sku?: string;
    name: string;
    customName?: string;
    description?: string;
    customDescription?: string;
    category: string;
    categoryId?: string;
    unit: string;
    price: number;
    isActive: boolean;
    stock?: number;
    offerPrice?: number | null;
    offerActive?: boolean;
    taxRate?: 0 | 7 | 19;
    availableForDelivery?: boolean;
    availableForPickup?: boolean;
}

// Business Info Interface
interface BusinessInfo {
    id: string;
    companyName: string;
    brand: string;
    type?: string;
    types?: string[];
    isActive?: boolean;
}

// Turkish character normalization for flexible search
const normalizeTurkish = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/İ/g, 'i');
};

const turkishMatch = (text: string, search: string): boolean => {
    return normalizeTurkish(text).includes(normalizeTurkish(search));
};

export default function ERPProductsPage() {
    const { admin, loading: adminLoading } = useAdmin();

    // Get butcherId from admin context - THIS IS THE KEY DIFFERENCE!
    const butcherId = admin?.butcherId;

    const [products, setProducts] = useState<BusinessProduct[]>([]);
    const [business, setBusiness] = useState<BusinessInfo | null>(null);
    const [loading, setLoading] = useState(true);

    // Master Catalog from Firestore
    const [masterCatalog, setMasterCatalog] = useState<MasterCatalogProduct[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    // Business Categories
    const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([]);

    // Search and Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Add Product State
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<MasterCatalogProduct | null>(null);
    const [salePrice, setSalePrice] = useState(0);
    const [saving, setSaving] = useState(false);

    // Inline Quick-Add State
    const [expandedProductSku, setExpandedProductSku] = useState<string | null>(null);
    const [inlinePrice, setInlinePrice] = useState<number>(0);

    // Load Master Catalog from Firestore
    useEffect(() => {
        const masterProductsRef = collection(db, 'master_products');
        const q = query(masterProductsRef, where('isActive', '!=', false));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const catalogData = snapshot.docs.map(doc => ({
                id: doc.id,
                sku: doc.data().id || doc.id,
                name: doc.data().name || 'Ürün',
                description: doc.data().description || '',
                category: doc.data().category || 'Diğer',
                defaultUnit: doc.data().defaultUnit || 'kg',
                defaultPrice: doc.data().defaultPrice || 0,
                allowedBusinessTypes: doc.data().allowedBusinessTypes || [],
                isActive: doc.data().isActive ?? true,
            })) as MasterCatalogProduct[];

            setMasterCatalog(catalogData);
            setLoadingCatalog(false);
        }, (error) => {
            console.error('Error loading master catalog:', error);
            setLoadingCatalog(false);
        });

        return () => unsubscribe();
    }, []);

    // Load Business Info
    useEffect(() => {
        if (!butcherId || adminLoading) return;

        const loadBusiness = async () => {
            try {
                const docRef = doc(db, 'businesses', butcherId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setBusiness({
                        id: docSnap.id,
                        companyName: data.companyName || 'İşletme',
                        brand: data.brand || '',
                        type: data.type || 'kasap',
                        types: data.types || [],
                        isActive: data.isActive ?? true,
                    });
                }
            } catch (error) {
                console.error('Error loading business:', error);
            }
        };
        loadBusiness();
    }, [butcherId, adminLoading]);

    // Load Business Categories
    useEffect(() => {
        if (!butcherId || adminLoading) return;

        const categoriesRef = collection(db, 'businesses', butcherId, 'categories');
        const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
            const categoriesData = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    name: doc.data().name || 'Kategori',
                    icon: doc.data().icon || '📦',
                    order: doc.data().order || 0,
                    isActive: doc.data().isActive ?? true,
                }))
                .filter(cat => cat.isActive)
                .sort((a, b) => a.order - b.order) as BusinessCategory[];

            setBusinessCategories(categoriesData);
        });

        return () => unsubscribe();
    }, [butcherId, adminLoading]);

    // Load Products - ONLY for this business (admin.butcherId)
    useEffect(() => {
        if (!butcherId || adminLoading) return;

        const productsRef = collection(db, 'businesses', butcherId, 'products');

        const unsubscribe = onSnapshot(productsRef, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as BusinessProduct[];

            setProducts(productsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [butcherId, adminLoading]);

    // Add product from catalog
    const addCatalogProduct = async (product: MasterCatalogProduct, price: number) => {
        if (!butcherId || price <= 0) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'businesses', butcherId, 'products'), {
                masterProductId: product.id,
                masterProductSku: product.sku,
                sku: product.sku,
                name: product.name,
                description: product.description,
                category: product.category,
                unit: product.defaultUnit,
                price: price,
                isActive: true,
                taxRate: 7, // Default VAT
                availableForDelivery: true,
                availableForPickup: true,
                createdAt: new Date(),
            });
            setExpandedProductSku(null);
            setInlinePrice(0);
        } catch (error) {
            console.error('Error adding product:', error);
        }
        setSaving(false);
    };

    // Update product price
    const updateProductPrice = async (productId: string, newPrice: number) => {
        if (!butcherId) return;
        try {
            await updateDoc(doc(db, 'businesses', butcherId, 'products', productId), {
                price: newPrice,
                updatedAt: new Date(),
            });
        } catch (error) {
            console.error('Error updating price:', error);
        }
    };

    // Update offer price
    const updateOfferPrice = async (productId: string, offerPrice: number | null) => {
        if (!butcherId) return;
        try {
            if (offerPrice && offerPrice > 0) {
                await updateDoc(doc(db, 'businesses', butcherId, 'products', productId), {
                    offerPrice: offerPrice,
                    offerActive: true,
                    updatedAt: new Date(),
                });
            } else {
                await updateDoc(doc(db, 'businesses', butcherId, 'products', productId), {
                    offerPrice: null,
                    offerActive: false,
                    updatedAt: new Date(),
                });
            }
        } catch (error) {
            console.error('Error updating offer price:', error);
        }
    };

    // Toggle product active status
    const toggleProductActive = async (productId: string, isActive: boolean) => {
        if (!butcherId) return;
        try {
            await updateDoc(doc(db, 'businesses', butcherId, 'products', productId), {
                isActive: !isActive,
                updatedAt: new Date(),
            });
        } catch (error) {
            console.error('Error toggling product:', error);
        }
    };

    // Remove product from listing
    const removeProduct = async (productId: string) => {
        if (!butcherId || !confirm('Bu ürünü listenizden kaldırmak istediğinize emin misiniz?')) return;
        try {
            await deleteDoc(doc(db, 'businesses', butcherId, 'products', productId));
        } catch (error) {
            console.error('Error removing product:', error);
        }
    };

    // Filter products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !searchQuery ||
                turkishMatch(p.name, searchQuery) ||
                turkishMatch(p.sku || '', searchQuery);
            const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, categoryFilter]);

    // Group products by category
    const groupedProducts = useMemo(() => {
        return filteredProducts.reduce((acc, product) => {
            const cat = product.category || 'Diğer';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(product);
            return acc;
        }, {} as Record<string, BusinessProduct[]>);
    }, [filteredProducts]);

    // Available catalog products (not yet added)
    const availableCatalogProducts = useMemo(() => {
        return masterCatalog.filter(
            mp => !products.some(p => p.masterProductId === mp.id || p.sku === mp.sku)
        );
    }, [masterCatalog, products]);

    // Search in catalog
    const catalogSearchResults = useMemo(() => {
        if (!searchQuery) return [];
        return masterCatalog.filter(p =>
            turkishMatch(p.name, searchQuery) ||
            turkishMatch(p.sku, searchQuery) ||
            turkishMatch(p.description || '', searchQuery)
        ).map(p => ({
            ...p,
            isExisting: products.some(existing => existing.masterProductId === p.id || existing.sku === p.sku),
            existingProduct: products.find(existing => existing.masterProductId === p.id || existing.sku === p.sku)
        }));
    }, [masterCatalog, products, searchQuery]);

    // Access check - must have butcherId
    if (!adminLoading && !butcherId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md border border-gray-700">
                    <span className="text-5xl">🔒</span>
                    <h2 className="text-xl font-bold text-white mt-4">Erişim Yok</h2>
                    <p className="text-gray-400 mt-2">
                        Ürün yönetimi için bir işletmeye bağlı olmanız gerekiyor.
                    </p>
                    <Link href="/admin/dashboard" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
                        Dashboard'a Git
                    </Link>
                </div>
            </div>
        );
    }

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    const getCategoryEmoji = (category: string) => {
        const emojis: Record<string, string> = {
            'Dana Eti': '🥩', 'dana': '🥩',
            'Kuzu Eti': '🐑', 'kuzu': '🐑',
            'Tavuk': '🍗', 'tavuk': '🍗',
            'İşlenmiş': '🥓', 'islenmis': '🥓',
        };
        return emojis[category] || '📦';
    };

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">📦</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Ürün Yönetimi</h1>
                                <p className="text-emerald-200 text-sm">
                                    {business?.companyName} • {products.length} Ürün
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/admin/categories"
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
                        >
                            🗂️ Kategoriler
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Search & Filter Bar */}
                <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl">🔍</span>
                            <input
                                type="text"
                                placeholder="Ürün ara... (isim, SKU)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {/* Category Filter */}
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="all">Tüm Kategoriler</option>
                            {Object.keys(groupedProducts).map(cat => (
                                <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mt-3 text-sm text-gray-400">
                        {filteredProducts.length} ürün gösteriliyor
                    </div>
                </div>

                {/* Catalog Search Results - For adding new products */}
                {searchQuery && catalogSearchResults.length > 0 && (
                    <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-emerald-600/30">
                        <h3 className="text-emerald-400 font-medium mb-3 flex items-center gap-2">
                            <span>📚</span> Katalogdan Ekle
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {catalogSearchResults.filter(p => !p.isExisting).slice(0, 5).map(product => (
                                <div
                                    key={product.sku}
                                    className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-emerald-500 transition"
                                >
                                    <span className="text-2xl">{getCategoryEmoji(product.category)}</span>
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{product.name}</p>
                                        <p className="text-gray-400 text-xs">{product.sku}</p>
                                    </div>
                                    {expandedProductSku === product.sku ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                placeholder="Fiyat €"
                                                value={inlinePrice || ''}
                                                onChange={(e) => setInlinePrice(parseFloat(e.target.value) || 0)}
                                                className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm text-center"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => addCatalogProduct(product, inlinePrice)}
                                                disabled={saving || inlinePrice <= 0}
                                                className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-full flex items-center justify-center text-white"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => setExpandedProductSku(null)}
                                                className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center text-white"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setExpandedProductSku(product.sku);
                                                setInlinePrice(product.defaultPrice || 0);
                                            }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-medium"
                                        >
                                            + Ekle
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Products List */}
                {Object.keys(groupedProducts).length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                        <span className="text-5xl">📦</span>
                        <h3 className="text-lg font-medium text-white mt-4">Henüz ürün eklenmemiş</h3>
                        <p className="text-gray-400 mt-2">Yukarıdaki arama kutusunu kullanarak katalogdan ürün ekleyin.</p>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                        <div key={category} className="bg-gray-800 rounded-xl mb-4 overflow-hidden border border-gray-700">
                            <div className="px-4 py-3 border-b border-gray-700 bg-gray-750 flex items-center gap-2">
                                <span className="text-xl">{getCategoryEmoji(category)}</span>
                                <h3 className="font-medium text-white">{category}</h3>
                                <span className="text-gray-500 text-sm ml-auto">{categoryProducts.length} ürün</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead className="bg-gray-750 text-gray-400 text-xs">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Durum</th>
                                            <th className="px-4 py-2 text-left">SKU</th>
                                            <th className="px-4 py-2 text-left">Ürün</th>
                                            <th className="px-4 py-2 text-left">Birim</th>
                                            <th className="px-4 py-2 text-left">Fiyat</th>
                                            <th className="px-4 py-2 text-left">İndirim</th>
                                            <th className="px-4 py-2 text-left">Aksiyon</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {categoryProducts.map(product => (
                                            <tr key={product.id} className={`hover:bg-gray-750 ${!product.isActive ? 'opacity-50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => toggleProductActive(product.id, product.isActive)}
                                                        className={`w-12 h-6 rounded-full relative transition-colors ${product.isActive ? 'bg-emerald-600' : 'bg-gray-600'
                                                            }`}
                                                    >
                                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${product.isActive ? 'left-7' : 'left-1'
                                                            }`}></span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-blue-400">{product.sku || '-'}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-white">
                                                    <div className="flex items-center gap-2">
                                                        {product.name}
                                                        {product.offerPrice && product.offerPrice > 0 && (
                                                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                                                                İNDİRİM
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-400">{product.unit}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={product.price}
                                                            onChange={(e) => updateProductPrice(product.id, parseFloat(e.target.value) || 0)}
                                                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                        <span className="text-gray-500 text-xs">€</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={product.offerPrice || ''}
                                                            onChange={(e) => updateOfferPrice(product.id, parseFloat(e.target.value) || null)}
                                                            placeholder="—"
                                                            className={`w-20 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-orange-500 ${product.offerPrice && product.offerPrice > 0
                                                                    ? 'bg-orange-900/50 border-2 border-orange-500 text-orange-300 font-bold'
                                                                    : 'bg-gray-700 border border-gray-600 text-gray-400'
                                                                }`}
                                                        />
                                                        <span className="text-orange-400 text-xs">€</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => removeProduct(product.id)}
                                                        className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 text-sm"
                                                        title="Listeden Kaldır"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}

                {/* Quick Add Section - When not searching */}
                {!searchQuery && availableCatalogProducts.length > 0 && (
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mt-6">
                        <h3 className="text-gray-300 font-medium mb-3 flex items-center gap-2">
                            <span>⚡</span> Hızlı Ekleme
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {availableCatalogProducts.slice(0, 8).map(product => (
                                <button
                                    key={product.sku}
                                    onClick={() => {
                                        setExpandedProductSku(product.sku);
                                        setInlinePrice(product.defaultPrice || 0);
                                        setSearchQuery(product.name);
                                    }}
                                    className="bg-gray-700/50 hover:bg-emerald-600/20 text-gray-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 border border-gray-600 hover:border-emerald-500 transition"
                                >
                                    <span className="text-emerald-400">+</span>
                                    <span>{product.name}</span>
                                </button>
                            ))}
                            {availableCatalogProducts.length > 8 && (
                                <span className="text-gray-500 text-sm px-3 py-1.5">
                                    +{availableCatalogProducts.length - 8} daha...
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
