'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { KERMES_MENU_CATALOG, KERMES_MENU_CATEGORIES, KermesMenuItemData } from '@/lib/kermes_menu_catalog';

interface KermesEvent {
    id: string;
    title: string;
    city?: string;
}

interface KermesProduct {
    id: string;
    masterSku: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    isAvailable: boolean;
    isCustom?: boolean;
    sourceType?: 'master' | 'kermes_catalog' | 'custom';
    createdAt?: any;
    createdBy?: string;
    // New detail fields
    secondaryName?: string;
    allergens?: string;
    ingredients?: string;
    imageUrl?: string;
}

// Modal states
type ModalView = 'select_source' | 'master_catalog' | 'kermes_catalog' | 'custom_form';

export default function KermesProductsPage() {
    const params = useParams();
    const router = useRouter();
    const { admin, loading: adminLoading } = useAdmin();
    const kermesId = params.id as string;

    const [kermes, setKermes] = useState<KermesEvent | null>(null);
    const [products, setProducts] = useState<KermesProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalView, setModalView] = useState<ModalView>('select_source');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Master Catalog
    const [masterProducts, setMasterProducts] = useState<any[]>([]);
    const [loadingMaster, setLoadingMaster] = useState(false);

    // Custom Product Form
    const [customProduct, setCustomProduct] = useState({
        name: '',
        description: '',
        category: 'Ana Yemek',
        price: 0,
        unit: 'porsiyon' as 'adet' | 'porsiyon' | 'bardak' | 'kase',
    });

    // Edit product modal - Expanded with all detail fields
    const [editingProduct, setEditingProduct] = useState<KermesProduct | null>(null);
    const [newPrice, setNewPrice] = useState<number>(0);
    const [newCategory, setNewCategory] = useState<string>('');
    const [newSecondaryName, setNewSecondaryName] = useState<string>('');
    const [newAllergens, setNewAllergens] = useState<string>('');
    const [newIngredients, setNewIngredients] = useState<string>('');
    const [newImageUrl, setNewImageUrl] = useState<string>('');
    const [newDescription, setNewDescription] = useState<string>('');

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openModal = () => {
        setShowModal(true);
        setModalView('select_source');
        setSearchQuery('');
        setSelectedCategory('');
    };

    const closeModal = () => {
        setShowModal(false);
        setModalView('select_source');
    };

    // Load kermes and products
    const loadData = useCallback(async () => {
        if (!kermesId) return;

        setLoading(true);
        try {
            const kermesDoc = await getDoc(doc(db, 'kermes_events', kermesId));
            if (!kermesDoc.exists()) {
                showToast('Kermes bulunamadı', 'error');
                router.push('/admin/kermes');
                return;
            }
            setKermes({ id: kermesDoc.id, ...kermesDoc.data() } as KermesEvent);

            const productsQuery = query(
                collection(db, 'kermes_events', kermesId, 'products'),
                orderBy('name')
            );
            const productsSnapshot = await getDocs(productsQuery);
            setProducts(productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesProduct)));

        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Veri yüklenirken hata oluştu', 'error');
        } finally {
            setLoading(false);
        }
    }, [kermesId, router]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Load Master Products
    const loadMasterProducts = async () => {
        if (masterProducts.length > 0) return;

        setLoadingMaster(true);
        try {
            const masterQuery = query(collection(db, 'master_products'), orderBy('name'));
            const snapshot = await getDocs(masterQuery);
            setMasterProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error('Error loading master products:', error);
            showToast('Master katalog yüklenemedi', 'error');
        } finally {
            setLoadingMaster(false);
        }
    };

    // Add from Kermes Catalog
    const handleAddFromKermesCatalog = async (catalogItem: KermesMenuItemData) => {
        if (products.some(p => p.masterSku === catalogItem.sku)) {
            showToast('Bu ürün zaten menüde mevcut', 'error');
            return;
        }

        setSaving(true);
        try {
            const productData = {
                masterSku: catalogItem.sku,
                name: catalogItem.name,
                description: catalogItem.description || null,
                category: catalogItem.category,
                price: catalogItem.defaultPrice,
                isAvailable: true,
                isCustom: false,
                sourceType: 'kermes_catalog',
                createdAt: new Date(),
                createdBy: admin?.id,
            };

            const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
            setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
            showToast(`✅ ${catalogItem.name} menüye eklendi`);
        } catch (error) {
            console.error('Error adding product:', error);
            showToast('Ürün eklenirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Add from Master Catalog
    const handleAddFromMaster = async (masterProduct: any) => {
        if (products.some(p => p.masterSku === masterProduct.id || p.masterSku === masterProduct.sku)) {
            showToast('Bu ürün zaten menüde mevcut', 'error');
            return;
        }

        setSaving(true);
        try {
            const productData = {
                masterSku: masterProduct.id,
                name: masterProduct.name,
                description: masterProduct.description || null,
                category: masterProduct.category || 'Diğer',
                price: masterProduct.price || masterProduct.basePrice || 0,
                isAvailable: true,
                isCustom: false,
                sourceType: 'master',
                createdAt: new Date(),
                createdBy: admin?.id,
            };

            const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
            setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
            showToast(`✅ ${masterProduct.name} menüye eklendi`);
        } catch (error) {
            console.error('Error adding product:', error);
            showToast('Ürün eklenirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Create Custom Product
    const handleCreateCustomProduct = async () => {
        if (!customProduct.name.trim()) {
            showToast('Ürün adı giriniz', 'error');
            return;
        }
        if (customProduct.price <= 0) {
            showToast('Geçerli bir fiyat giriniz', 'error');
            return;
        }

        setSaving(true);
        try {
            const customSku = `KERMES-CUSTOM-${kermesId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

            const productData = {
                masterSku: customSku,
                name: customProduct.name.trim(),
                description: customProduct.description.trim() || null,
                category: customProduct.category,
                price: customProduct.price,
                unit: customProduct.unit,
                isAvailable: true,
                isCustom: true,
                sourceType: 'custom',
                createdAt: new Date(),
                createdBy: admin?.id,
                kermesId: kermesId,
            };

            const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
            setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
            showToast(`✅ "${customProduct.name}" özel ürün oluşturuldu`);

            setCustomProduct({ name: '', description: '', category: 'Ana Yemek', price: 0, unit: 'porsiyon' });
            closeModal();
        } catch (error) {
            console.error('Error creating custom product:', error);
            showToast('Ürün oluşturulurken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Update price
    const handleUpdateProduct = async () => {
        if (!editingProduct || newPrice <= 0) return;

        setSaving(true);
        try {
            const updateData: any = {
                price: newPrice,
                category: newCategory,
                updatedAt: new Date(),
            };
            // Optional fields - only update if provided
            if (newSecondaryName) updateData.secondaryName = newSecondaryName;
            if (newAllergens) updateData.allergens = newAllergens;
            if (newIngredients) updateData.ingredients = newIngredients;
            if (newImageUrl) updateData.imageUrl = newImageUrl;
            if (newDescription) updateData.description = newDescription;

            await updateDoc(doc(db, 'kermes_events', kermesId, 'products', editingProduct.id), updateData);

            setProducts(products.map(p => p.id === editingProduct.id ? {
                ...p,
                price: newPrice,
                category: newCategory,
                secondaryName: newSecondaryName || undefined,
                allergens: newAllergens || undefined,
                ingredients: newIngredients || undefined,
                imageUrl: newImageUrl || undefined,
                description: newDescription || undefined,
            } : p));
            setEditingProduct(null);
            showToast('✅ Ürün güncellendi');
        } catch (error) {
            console.error('Error updating product:', error);
            showToast('Ürün güncellenirken hata oluştu', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Toggle availability
    const handleToggleAvailability = async (product: KermesProduct) => {
        try {
            await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), {
                isAvailable: !product.isAvailable,
                updatedAt: new Date(),
            });

            setProducts(products.map(p => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p));
            showToast(product.isAvailable ? 'Ürün tükendi olarak işaretlendi' : 'Ürün mevcut olarak işaretlendi');
        } catch (error) {
            console.error('Error toggling availability:', error);
            showToast('Durum güncellenirken hata oluştu', 'error');
        }
    };

    // Delete product
    const handleDelete = async (product: KermesProduct) => {
        if (!confirm(`"${product.name}" ürününü menüden kaldırmak istediğinize emin misiniz?`)) return;

        try {
            await deleteDoc(doc(db, 'kermes_events', kermesId, 'products', product.id));
            setProducts(products.filter(p => p.id !== product.id));
            showToast('Ürün menüden kaldırıldı');
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('Ürün silinirken hata oluştu', 'error');
        }
    };

    // Filters
    const filteredKermesCatalog = Object.values(KERMES_MENU_CATALOG).filter(item => {
        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        const matchesSearch = !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const filteredMasterCatalog = masterProducts.filter(item => {
        const matchesSearch = !searchQuery ||
            item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Group products by category
    const productsByCategory = products.reduce((acc, product) => {
        const cat = product.category || 'Diğer';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, KermesProduct[]>);

    const getCategoryEmoji = (category: string) => {
        const emojis: Record<string, string> = {
            'Ana Yemek': '🍖', 'Çorba': '🍲', 'Tatlı': '🍰', 'İçecek': '🥤', 'Diğer': '📦',
        };
        return emojis[category] || '📦';
    };

    const getSourceBadge = (product: KermesProduct) => {
        if (product.isCustom || product.sourceType === 'custom') {
            return <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded text-xs">Özel</span>;
        }
        if (product.sourceType === 'master') {
            return <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">Master</span>;
        }
        return <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">Kermes</span>;
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href={`/admin/kermes/${kermesId}`} className="text-gray-400 hover:text-white">
                            ← Geri
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                🍽️ Kermes Menü Yönetimi
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">
                                {kermes?.title} • {products.length} ürün
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={openModal}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-500 hover:to-emerald-500 transition shadow-lg flex items-center gap-2"
                    >
                        <span>➕</span>
                        Menüye Ürün Ekle
                    </button>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-6xl mx-auto">
                {products.length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <p className="text-5xl mb-4">🍽️</p>
                        <h3 className="text-xl font-bold text-white mb-2">Menüde Ürün Yok</h3>
                        <p className="text-gray-400 mb-6">
                            Katalogdan veya özel ürün oluşturarak kermes menünüzü oluşturun
                        </p>
                        <button
                            onClick={openModal}
                            className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition"
                        >
                            ➕ İlk Ürünü Ekle
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(productsByCategory).map(([category, items]) => (
                            <div key={category} className="bg-gray-800 rounded-xl overflow-hidden">
                                <div className="bg-gray-700/50 px-6 py-3 border-b border-gray-700">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        {getCategoryEmoji(category)} {category} ({items.length})
                                    </h3>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {items.map((product) => (
                                        <div
                                            key={product.id}
                                            className={`bg-gray-700 rounded-xl p-4 border-2 transition ${product.isAvailable ? 'border-transparent' : 'border-red-500/50 opacity-60'}`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-white font-medium">{product.name}</h4>
                                                        {getSourceBadge(product)}
                                                    </div>
                                                    {product.description && (
                                                        <p className="text-gray-400 text-sm">{product.description}</p>
                                                    )}
                                                    <p className="text-gray-500 text-xs mt-1">SKU: {product.masterSku}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleAvailability(product)}
                                                    className={`px-2 py-1 rounded text-xs font-medium ${product.isAvailable ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}
                                                >
                                                    {product.isAvailable ? '✓ Mevcut' : '✕ Tükendi'}
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() => {
                                                        setEditingProduct(product);
                                                        setNewPrice(product.price);
                                                        setNewCategory(product.category);
                                                        setNewSecondaryName(product.secondaryName || '');
                                                        setNewAllergens(product.allergens || '');
                                                        setNewIngredients(product.ingredients || '');
                                                        setNewImageUrl(product.imageUrl || '');
                                                        setNewDescription(product.description || '');
                                                    }}
                                                    className="text-2xl font-bold text-green-400 hover:text-green-300 transition"
                                                >
                                                    {product.price.toFixed(2)} €
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product)}
                                                    className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg text-sm transition"
                                                >
                                                    🗑️ Kaldır
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {modalView !== 'select_source' && (
                                    <button
                                        onClick={() => setModalView('select_source')}
                                        className="text-gray-400 hover:text-white"
                                    >
                                        ← Geri
                                    </button>
                                )}
                                <h2 className="text-xl font-bold text-white">
                                    {modalView === 'select_source' && '📦 Menüye Ürün Ekle'}
                                    {modalView === 'master_catalog' && '📦 Master Katalog (Barkodlu Ürünler)'}
                                    {modalView === 'kermes_catalog' && '🎪 Kermes Yemek Kataloğu'}
                                    {modalView === 'custom_form' && '✨ Özel Ürün Oluştur'}
                                </h2>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white text-2xl">✕</button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* SOURCE SELECTION - 3 Big Cards */}
                            {modalView === 'select_source' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* 1. Master Katalog */}
                                    <button
                                        onClick={() => { setModalView('master_catalog'); loadMasterProducts(); }}
                                        className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-2 border-blue-600/30 hover:border-blue-500 rounded-2xl p-6 text-left transition group"
                                    >
                                        <div className="text-5xl mb-4">📦</div>
                                        <h3 className="text-xl font-bold text-white mb-2">Master Katalog</h3>
                                        <p className="text-blue-300 text-sm mb-4">Barkodlu Ürünler</p>
                                        <p className="text-gray-400 text-sm">
                                            Market ürünleri, paketli yiyecekler ve barkodu olan tüm ürünler için.
                                            EAN kodu ile tam izlenebilirlik.
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-blue-400 group-hover:text-blue-300">
                                            <span>Göster</span>
                                            <span>→</span>
                                        </div>
                                    </button>

                                    {/* 2. Kermes Kataloğu */}
                                    <button
                                        onClick={() => setModalView('kermes_catalog')}
                                        className="bg-gradient-to-br from-violet-900/50 to-violet-800/30 border-2 border-violet-600/30 hover:border-violet-500 rounded-2xl p-6 text-left transition group"
                                    >
                                        <div className="text-5xl mb-4">🎪</div>
                                        <h3 className="text-xl font-bold text-white mb-2">Kermes Yemek Kataloğu</h3>
                                        <p className="text-violet-300 text-sm mb-4">Hazır Menüler</p>
                                        <p className="text-gray-400 text-sm">
                                            Lahmacun, Döner, Adana, Mantı, Baklava...
                                            Daha önce hazırlanmış standart kermes ürünleri.
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-violet-400 group-hover:text-violet-300">
                                            <span>Göster</span>
                                            <span>→</span>
                                        </div>
                                    </button>

                                    {/* 3. Özel Ürün */}
                                    <button
                                        onClick={() => setModalView('custom_form')}
                                        className="bg-gradient-to-br from-purple-900/50 to-pink-800/30 border-2 border-purple-600/30 hover:border-purple-500 rounded-2xl p-6 text-left transition group"
                                    >
                                        <div className="text-5xl mb-4">✨</div>
                                        <h3 className="text-xl font-bold text-white mb-2">Kendi Ürününü Oluştur</h3>
                                        <p className="text-purple-300 text-sm mb-4">El Yapımı & Özel</p>
                                        <p className="text-gray-400 text-sm">
                                            Ev yapımı yemekler, barkodsuz ürünler.
                                            Sadece bu kermese özel, ama raporlarda tam izlenebilir.
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-purple-400 group-hover:text-purple-300">
                                            <span>Oluştur</span>
                                            <span>→</span>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* MASTER CATALOG */}
                            {modalView === 'master_catalog' && (
                                <>
                                    <div className="mb-4">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Ürün ara..."
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500"
                                        />
                                    </div>
                                    {loadingMaster ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                        </div>
                                    ) : filteredMasterCatalog.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            <p className="text-4xl mb-4">📦</p>
                                            <p>Master katalogda ürün bulunamadı</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredMasterCatalog.slice(0, 50).map((item) => {
                                                const isAdded = products.some(p => p.masterSku === item.id || p.masterSku === item.sku);
                                                return (
                                                    <div key={item.id} className={`bg-gray-700 rounded-xl p-4 flex items-center gap-4 ${isAdded ? 'opacity-50' : ''}`}>
                                                        <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center text-2xl overflow-hidden">
                                                            {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : '📦'}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-white font-medium">{item.name}</h4>
                                                            <p className="text-gray-400 text-sm">{item.category || 'Diğer'}</p>
                                                            {item.ean && <p className="text-gray-500 text-xs">EAN: {item.ean}</p>}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-green-400 font-bold">{(item.price || item.basePrice || 0).toFixed(2)} €</p>
                                                            {isAdded ? (
                                                                <span className="text-xs text-gray-400">✓ Eklendi</span>
                                                            ) : (
                                                                <button onClick={() => handleAddFromMaster(item)} disabled={saving} className="mt-1 px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                                                    ➕ Ekle
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* KERMES CATALOG */}
                            {modalView === 'kermes_catalog' && (
                                <>
                                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Ürün ara..."
                                            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-violet-500"
                                        />
                                        <select
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                                        >
                                            <option value="">Tüm Kategoriler</option>
                                            {KERMES_MENU_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredKermesCatalog.map((item) => {
                                            const isAdded = products.some(p => p.masterSku === item.sku);
                                            return (
                                                <div key={item.sku} className={`bg-gray-700 rounded-xl p-4 flex items-center gap-4 ${isAdded ? 'opacity-50' : ''}`}>
                                                    <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center text-2xl">
                                                        {getCategoryEmoji(item.category)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="text-white font-medium">{item.name}</h4>
                                                        <p className="text-gray-400 text-sm">{item.category}</p>
                                                        {item.description && <p className="text-gray-500 text-xs">{item.description}</p>}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-green-400 font-bold">{item.defaultPrice.toFixed(2)} €</p>
                                                        {isAdded ? (
                                                            <span className="text-xs text-gray-400">✓ Eklendi</span>
                                                        ) : (
                                                            <button onClick={() => handleAddFromKermesCatalog(item)} disabled={saving} className="mt-1 px-4 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                                                ➕ Ekle
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* CUSTOM FORM */}
                            {modalView === 'custom_form' && (
                                <div className="max-w-lg mx-auto">
                                    <div className="bg-gray-700 rounded-xl p-6">
                                        <div className="bg-purple-900/30 border border-purple-600/30 rounded-xl p-4 mb-6">
                                            <p className="text-purple-300 text-sm">
                                                ⚠️ Bu ürün <strong>sadece bu kermese</strong> özel olacak. Diğer kermesler veya işletmeler bu ürünü göremez.
                                                Ancak siparişlerde, raporlarda ve tüm sistemde aynı ID ile takip edilir.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-gray-400 text-sm mb-2">Ürün Adı *</label>
                                                <input
                                                    type="text"
                                                    value={customProduct.name}
                                                    onChange={(e) => setCustomProduct({ ...customProduct, name: e.target.value })}
                                                    placeholder="örn: Ev Yapımı Baklava"
                                                    className="w-full px-4 py-3 bg-gray-600 text-white rounded-xl border border-gray-500 focus:border-purple-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-gray-400 text-sm mb-2">Açıklama</label>
                                                <input
                                                    type="text"
                                                    value={customProduct.description}
                                                    onChange={(e) => setCustomProduct({ ...customProduct, description: e.target.value })}
                                                    placeholder="örn: Taze fıstıklı, 2 dilim"
                                                    className="w-full px-4 py-3 bg-gray-600 text-white rounded-xl border border-gray-500 focus:border-purple-500"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-gray-400 text-sm mb-2">Kategori</label>
                                                    <select
                                                        value={customProduct.category}
                                                        onChange={(e) => setCustomProduct({ ...customProduct, category: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-600 text-white rounded-xl border border-gray-500"
                                                    >
                                                        {KERMES_MENU_CATEGORIES.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-sm mb-2">Birim</label>
                                                    <select
                                                        value={customProduct.unit}
                                                        onChange={(e) => setCustomProduct({ ...customProduct, unit: e.target.value as any })}
                                                        className="w-full px-4 py-3 bg-gray-600 text-white rounded-xl border border-gray-500"
                                                    >
                                                        <option value="adet">Adet</option>
                                                        <option value="porsiyon">Porsiyon</option>
                                                        <option value="bardak">Bardak</option>
                                                        <option value="kase">Kase</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-gray-400 text-sm mb-2">Fiyat (€) *</label>
                                                <input
                                                    type="number"
                                                    step="0.50"
                                                    min="0"
                                                    value={customProduct.price || ''}
                                                    onChange={(e) => setCustomProduct({ ...customProduct, price: parseFloat(e.target.value) || 0 })}
                                                    placeholder="0.00"
                                                    className="w-full px-4 py-3 bg-gray-600 text-white text-2xl font-bold rounded-xl border border-gray-500 focus:border-purple-500"
                                                />
                                            </div>

                                            <button
                                                onClick={handleCreateCustomProduct}
                                                disabled={saving || !customProduct.name.trim() || customProduct.price <= 0}
                                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                                            >
                                                {saving ? '⏳ Oluşturuluyor...' : '✨ Özel Ürün Oluştur ve Menüye Ekle'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Product Modal - Full Product Details */}
            {editingProduct && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-lg p-6 my-8">
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            ✏️ Düzenle: {editingProduct.name}
                        </h2>
                        <p className="text-gray-400 text-sm mb-6">SKU: {editingProduct.masterSku}</p>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {/* Category */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Menü Kategorisi</label>
                                <select
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500"
                                >
                                    {KERMES_MENU_CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Price */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Kermes Fiyatı (€) *</label>
                                <input
                                    type="number"
                                    step="0.50"
                                    min="0"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-3 bg-gray-700 text-white text-xl font-bold rounded-xl border border-gray-600 focus:border-green-500"
                                />
                            </div>

                            <hr className="border-gray-600 my-4" />
                            <p className="text-gray-500 text-xs uppercase tracking-wide">Ek Bilgiler (Opsiyonel)</p>

                            {/* Secondary Name / 2. İsim */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">2. İsim / Almanca</label>
                                <input
                                    type="text"
                                    value={newSecondaryName}
                                    onChange={(e) => setNewSecondaryName(e.target.value)}
                                    placeholder="Örn: Ayran, Dönerteller, Lahmacun"
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Açıklama / Tarif</label>
                                <textarea
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="Ürün açıklaması veya tarifi..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 resize-none"
                                />
                            </div>

                            {/* Allergens */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">🚨 Alerjenler</label>
                                <input
                                    type="text"
                                    value={newAllergens}
                                    onChange={(e) => setNewAllergens(e.target.value)}
                                    placeholder="Örn: Gluten, Süt, Yumurta, Fındık"
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-orange-500"
                                />
                            </div>

                            {/* Ingredients / Zutaten */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">📋 İçerikler / Zutaten</label>
                                <textarea
                                    value={newIngredients}
                                    onChange={(e) => setNewIngredients(e.target.value)}
                                    placeholder="Örn: Un, su, tuz, maya, kuzu kıyma..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 resize-none"
                                />
                            </div>

                            {/* Image URL */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">🖼️ Görsel URL</label>
                                <input
                                    type="url"
                                    value={newImageUrl}
                                    onChange={(e) => setNewImageUrl(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500"
                                />
                                {newImageUrl && (
                                    <div className="mt-2 rounded-lg overflow-hidden">
                                        <img src={newImageUrl} alt="Preview" className="w-full h-32 object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditingProduct(null)} className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600">
                                İptal
                            </button>
                            <button onClick={handleUpdateProduct} disabled={saving || newPrice <= 0} className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving ? '⏳ Kaydediliyor...' : '✅ Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
