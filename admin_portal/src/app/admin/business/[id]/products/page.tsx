'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { MEAT_CATEGORIES, formatDualPrice, type MasterProduct } from '@/types';

// 🆕 Business Type Labels for dynamic UI
const businessTypeLabels: Record<string, { label: string; emoji: string; color: string }> = {
    kasap: { label: 'Kasap', emoji: '🥩', color: 'bg-red-600' },
    restoran: { label: 'Restoran', emoji: '🍽️', color: 'bg-orange-600' },
    market: { label: 'Market', emoji: '🛒', color: 'bg-green-600' },
    baklava: { label: 'Baklava', emoji: '🍯', color: 'bg-amber-600' },
    kafeterya: { label: 'Kafeterya', emoji: '☕', color: 'bg-brown-600' },
    doner: { label: 'Döner', emoji: '🌯', color: 'bg-yellow-600' },
    pastane: { label: 'Pastane', emoji: '🧁', color: 'bg-pink-600' },
    cicekci: { label: 'Çiçekçi', emoji: '💐', color: 'bg-rose-600' },
    cigkofte: { label: 'Çiğ Köfte', emoji: '🥙', color: 'bg-lime-600' },
    kafe: { label: 'Kafe', emoji: '☕', color: 'bg-cyan-600' },
    catering: { label: 'Catering', emoji: '🍱', color: 'bg-indigo-600' },
    berber: { label: 'Berber', emoji: '✂️', color: 'bg-gray-600' },
};

const getBusinessTypeLabel = (type?: string | string[]): { label: string; emoji: string; color: string } => {
    if (!type) return { label: 'İşletme', emoji: '🏪', color: 'bg-gray-600' };
    if (Array.isArray(type)) {
        if (type.length === 0) return { label: 'İşletme', emoji: '🏪', color: 'bg-gray-600' };
        if (type.length === 1) return businessTypeLabels[type[0]] || { label: 'İşletme', emoji: '🏪', color: 'bg-gray-600' };
        const labels = type.map(t => businessTypeLabels[t]?.label || t).join(' & ');
        const emoji = businessTypeLabels[type[0]]?.emoji || '🏪';
        return { label: labels, emoji, color: 'bg-gradient-to-r from-red-600 to-blue-600' };
    }
    return businessTypeLabels[type] || { label: 'İşletme', emoji: '🏪', color: 'bg-gray-600' };
};

// 🆕 Interface for Firestore Master Products
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

// 🆕 Interface for Business Categories
interface BusinessCategory {
    id: string;
    name: string;
    icon: string;
    order: number;
    isActive: boolean;
}

interface BusinessProduct {
    id: string;
    productId: string;
    masterProductId?: string;
    sku?: string;
    name: string;
    customName?: string;      // 🆕 İşletme custom ismi
    description?: string;
    customDescription?: string; // 🆕 İşletme custom açıklaması
    category: string;
    categoryId?: string;      // 🆕 İşletme kategori ID'si
    unit: string;
    price: number;
    isActive: boolean;
    stock?: number;
    offerPrice?: number | null;
    offerActive?: boolean;
    offerStartDate?: Date | null;
    offerEndDate?: Date | null;
}

interface BusinessInfo {
    id: string;
    companyName: string;
    brand: string;
    type?: string;            // 🆕 Business type (kasap, restoran, etc.)
    types?: string[];          // 🆕 Multi-type support
    isActive?: boolean;
    customerId?: string;
    shopPhone?: string;
    openingHours?: string;
    closingHours?: string;
    brandLabelActive?: boolean;
    address?: {
        street?: string;
        city?: string;
        postalCode?: string;
        country?: string;
    };
}

export default function BusinessProductsPage() {
    const params = useParams();
    const businessId = params.id as string;

    const [products, setProducts] = useState<BusinessProduct[]>([]);
    const [butcher, setBusiness] = useState<BusinessInfo | null>(null);
    const [loading, setLoading] = useState(true);

    // 🆕 Master Catalog from Firestore (not hardcoded)
    const [masterCatalog, setMasterCatalog] = useState<MasterCatalogProduct[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    // 🆕 Business Categories from Firestore subcollection
    const [businessCategories, setBusinessCategories] = useState<BusinessCategory[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<BusinessProduct | null>(null);

    // Catalog selection state
    const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<MasterCatalogProduct | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');  // 🆕 Selected category for adding
    const [customName, setCustomName] = useState<string>('');                  // 🆕 Custom product name
    const [customDescription, setCustomDescription] = useState<string>('');   // 🆕 Custom description
    const [catalogSearch, setCatalogSearch] = useState('');
    const [salePrice, setSalePrice] = useState(0);
    const [saving, setSaving] = useState(false);

    // 🆕 Inline Quick-Add State (popup yerine inline form)
    const [expandedProductSku, setExpandedProductSku] = useState<string | null>(null);
    const [inlinePrice, setInlinePrice] = useState<number>(0);
    const [inlineBarcode, setInlineBarcode] = useState<string>('');

    // Price history state
    const [priceHistoryModal, setPriceHistoryModal] = useState<{ show: boolean; productId: string; productName: string }>({ show: false, productId: '', productName: '' });
    const [priceHistory, setPriceHistory] = useState<Array<{ id: string; timestamp: Date; userId: string; userName: string; oldPrice: number | null; newPrice: number | null; oldOfferPrice: number | null; newOfferPrice: number | null; changeType: 'price' | 'offer' | 'both' }>>([]);
    const [historyFilter, setHistoryFilter] = useState<'7d' | '30d' | 'month' | '3mo' | '1yr'>('30d');
    const [loadingHistory, setLoadingHistory] = useState(false);

    // New product form
    const [newProduct, setNewProduct] = useState({
        productId: '',
        name: '',
        category: 'kuzu',
        unit: 'kg',
        price: 0,
    });

    // 🆕 Load Master Catalog from Firestore
    useEffect(() => {
        const masterProductsRef = collection(db, 'master_products');
        const q = query(masterProductsRef, where('isActive', '!=', false));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const catalogData = snapshot.docs.map(doc => ({
                id: doc.id,
                sku: doc.data().sku || doc.id,
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

    // 🆕 Load Business Categories from Firestore subcollection
    useEffect(() => {
        const categoriesRef = collection(db, 'businesses', businessId, 'categories');

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
            setLoadingCategories(false);
        }, (error) => {
            console.error('Error loading business categories:', error);
            setLoadingCategories(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    // Load butcher info
    useEffect(() => {
        const loadBusiness = async () => {
            try {
                const docRef = doc(db, 'businesses', businessId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setBusiness({
                        id: docSnap.id,
                        companyName: data.companyName || 'İşletme',
                        brand: data.brand || '',
                        type: data.type || (data.types?.[0]) || 'kasap',
                        types: data.types || (data.type ? [data.type] : ['kasap']),
                        isActive: data.isActive ?? true,
                        customerId: data.customerId || '',
                        shopPhone: data.shopPhone || '',
                        openingHours: data.openingHours || '',
                        closingHours: data.closingHours || '',
                        brandLabelActive: data.brandLabelActive ?? true,
                        address: data.address || {},
                    });
                }
            } catch (error) {
                console.error('Error loading butcher:', error);
            }
        };
        loadBusiness();
    }, [businessId]);

    // Load products from businesses/{businessId}/products subcollection
    useEffect(() => {
        const productsRef = collection(db, 'businesses', businessId, 'products');

        const unsubscribe = onSnapshot(productsRef, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as BusinessProduct[];

            setProducts(productsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    // Open catalog modal to select product
    const openCatalogModal = () => {
        setCatalogSearch('');
        setSelectedCatalogProduct(null);
        setSalePrice(0);
        setShowCatalogModal(true);
    };

    // Select a catalog product (shows price input)
    const selectCatalogProduct = (product: MasterCatalogProduct) => {
        setSelectedCatalogProduct(product);
        setSalePrice(product.defaultPrice || 0);
        setCustomName(product.name);
        setCustomDescription(product.description || '');
        // Default to first category
        if (businessCategories.length > 0) {
            setSelectedCategoryId(businessCategories[0].id);
        }
    };

    // Add catalog product to butcher's shop with custom price and category
    const addCatalogProductWithPrice = async () => {
        if (!selectedCatalogProduct || salePrice <= 0) return;

        try {
            // Find selected category name
            const selectedCategory = businessCategories.find(c => c.id === selectedCategoryId);

            await addDoc(collection(db, 'businesses', businessId, 'products'), {
                masterProductId: selectedCatalogProduct.id,
                masterProductSku: selectedCatalogProduct.sku,
                sku: selectedCatalogProduct.sku,
                name: customName || selectedCatalogProduct.name,
                customName: customName !== selectedCatalogProduct.name ? customName : null,
                description: customDescription || selectedCatalogProduct.description,
                customDescription: customDescription !== selectedCatalogProduct.description ? customDescription : null,
                category: selectedCategory?.name || selectedCatalogProduct.category,
                categoryId: selectedCategoryId || null,  // 🆕 İşletme kategori ID'si
                unit: selectedCatalogProduct.defaultUnit,
                price: salePrice,
                isActive: true,
                createdAt: new Date(),
            });
            setShowCatalogModal(false);
            setSelectedCatalogProduct(null);
            setSelectedCategoryId('');
            setCustomName('');
            setCustomDescription('');
            setSalePrice(0);
        } catch (error) {
            console.error('Error adding product:', error);
        }
    };

    // Expand inline form for quick add (no popup)
    const expandInlineAdd = (product: MasterCatalogProduct) => {
        setExpandedProductSku(product.sku);
        setInlinePrice(product.defaultPrice || 0);
        setInlineBarcode('');
    };

    // Add product directly from inline form (no popup!)
    const addProductInline = async (product: MasterCatalogProduct) => {
        if (inlinePrice <= 0) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'businesses', businessId, 'products'), {
                masterProductId: product.id,
                masterProductSku: product.sku,
                sku: product.sku,
                barcode: inlineBarcode || null,  // 🆕 Barkod desteği
                name: product.name,
                description: product.description,
                category: product.category,
                unit: product.defaultUnit,
                price: inlinePrice,
                isActive: true,
                createdAt: new Date(),
            });
            // Reset inline form
            setExpandedProductSku(null);
            setInlinePrice(0);
            setInlineBarcode('');
        } catch (error) {
            console.error('Error adding product:', error);
        }
        setSaving(false);
    };

    // Add custom product
    const addCustomProduct = async () => {
        if (!newProduct.name || newProduct.price <= 0) return;

        try {
            await addDoc(collection(db, 'businesses', businessId, 'products'), {
                masterProductId: `custom_${Date.now()}`,
                masterProductSku: `custom_${Date.now()}`,
                name: newProduct.name,
                category: newProduct.category,
                unit: newProduct.unit,
                price: newProduct.price,
                isActive: true,
                createdAt: new Date(),
            });
            setNewProduct({ productId: '', name: '', category: 'kuzu', unit: 'kg', price: 0 });
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding custom product:', error);
        }
    };

    // Log price change to subcollection
    const logPriceChange = async (
        productId: string,
        changeType: 'price' | 'offer' | 'both',
        oldPrice: number | null,
        newPrice: number | null,
        oldOfferPrice?: number | null,
        newOfferPrice?: number | null
    ) => {
        try {
            // Get current admin user info (from localStorage or context)
            const adminEmail = localStorage.getItem('adminEmail') || 'admin@miraportal.com';
            const adminName = localStorage.getItem('adminName') || 'Admin';

            await addDoc(collection(db, 'businesses', businessId, 'products', productId, 'price_logs'), {
                timestamp: new Date(),
                userId: adminEmail,
                userName: adminName,
                changeType,
                oldPrice,
                newPrice,
                oldOfferPrice: oldOfferPrice || null,
                newOfferPrice: newOfferPrice || null,
            });
        } catch (error) {
            console.error('Error logging price change:', error);
        }
    };

    // Load price history for a product
    const loadPriceHistory = async (productId: string) => {
        setLoadingHistory(true);
        try {
            const now = new Date();
            let startDate: Date;

            switch (historyFilter) {
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case '3mo':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case '1yr':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            const logsQuery = query(
                collection(db, 'businesses', businessId, 'products', productId, 'price_logs'),
                where('timestamp', '>=', startDate),
                orderBy('timestamp', 'desc')
            );

            const snapshot = await getDocs(logsQuery);
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                timestamp: doc.data().timestamp?.toDate() || new Date(),
                userId: doc.data().userId || '',
                userName: doc.data().userName || '',
                oldPrice: doc.data().oldPrice,
                newPrice: doc.data().newPrice,
                oldOfferPrice: doc.data().oldOfferPrice,
                newOfferPrice: doc.data().newOfferPrice,
                changeType: doc.data().changeType || 'price',
            }));

            setPriceHistory(logs);
        } catch (error) {
            console.error('Error loading price history:', error);
            setPriceHistory([]);
        }
        setLoadingHistory(false);
    };

    // Update product price with logging
    const updateProductPrice = async (productId: string, newPrice: number) => {
        try {
            // Get old price first
            const product = products.find(p => p.id === productId);
            const oldPrice = product?.price || null;

            await updateDoc(doc(db, 'businesses', businessId, 'products', productId), {
                price: newPrice,
                updatedAt: new Date(),
            });

            // Log the change
            if (oldPrice !== newPrice) {
                await logPriceChange(productId, 'price', oldPrice, newPrice);
            }
        } catch (error) {
            console.error('Error updating price:', error);
        }
    };

    // Update offer price (İndirim) with start/end dates and logging
    const updateOfferPrice = async (productId: string, offerPrice: number | null, startDate?: Date | null, endDate?: Date | null) => {
        try {
            // Get old offer price first
            const product = products.find(p => p.id === productId);
            const oldOfferPrice = product?.offerPrice || null;

            if (offerPrice && offerPrice > 0) {
                await updateDoc(doc(db, 'businesses', businessId, 'products', productId), {
                    offerPrice: offerPrice,
                    offerActive: true,
                    offerStartDate: startDate || new Date(),
                    offerEndDate: endDate || null,
                    updatedAt: new Date(),
                });

                // Log the offer change
                if (oldOfferPrice !== offerPrice) {
                    await logPriceChange(productId, 'offer', product?.price || null, product?.price || null, oldOfferPrice, offerPrice);
                }
            } else {
                await updateDoc(doc(db, 'businesses', businessId, 'products', productId), {
                    offerPrice: null,
                    offerActive: false,
                    offerStartDate: null,
                    offerEndDate: null,
                    updatedAt: new Date(),
                });

                // Log offer removal
                if (oldOfferPrice) {
                    await logPriceChange(productId, 'offer', product?.price || null, product?.price || null, oldOfferPrice, null);
                }
            }
        } catch (error) {
            console.error('Error updating offer price:', error);
        }
    };

    // Toggle product active status
    const toggleProductActive = async (productId: string, isActive: boolean) => {
        try {
            await updateDoc(doc(db, 'businesses', businessId, 'products', productId), {
                isActive: !isActive,
                updatedAt: new Date(),
            });
        } catch (error) {
            console.error('Error toggling product:', error);
        }
    };

    // Deactivate/Delete confirmation modal state
    const [deactivateModal, setDeactivateModal] = useState<{ show: boolean; productId: string; productName: string }>({
        show: false,
        productId: '',
        productName: '',
    });

    // Show deactivate confirmation
    const showDeactivateConfirm = (productId: string, productName: string) => {
        setDeactivateModal({ show: true, productId, productName });
    };

    // Confirm deactivation (actually deletes from list)
    const confirmDeactivate = async () => {
        try {
            await deleteDoc(doc(db, 'businesses', businessId, 'products', deactivateModal.productId));
            setDeactivateModal({ show: false, productId: '', productName: '' });
        } catch (error) {
            console.error('Error deactivating product:', error);
        }
    };

    // 🆕 Edit Product Modal State
    const [editProductModal, setEditProductModal] = useState<{
        show: boolean;
        product: BusinessProduct | null;
        editName: string;
        editDescription: string;
        editCategoryId: string;
        editUnit: string;
    }>({
        show: false,
        product: null,
        editName: '',
        editDescription: '',
        editCategoryId: '',
        editUnit: 'kg',
    });

    // 🆕 Open edit modal for a product
    const openEditProductModal = (product: BusinessProduct) => {
        setEditProductModal({
            show: true,
            product,
            editName: product.customName || product.name,
            editDescription: product.customDescription || product.description || '',
            editCategoryId: product.category || '',
            editUnit: product.unit || 'kg',
        });
    };

    // 🆕 Update product details (name, description, category, unit)
    const updateProductDetails = async () => {
        if (!editProductModal.product) return;
        setSaving(true);
        try {
            // 🆕 editCategoryId now stores the category NAME directly
            const categoryName = editProductModal.editCategoryId || editProductModal.product.category;
            await updateDoc(doc(db, 'businesses', businessId, 'products', editProductModal.product.id), {
                customName: editProductModal.editName !== editProductModal.product.name ? editProductModal.editName : null,
                name: editProductModal.editName,
                customDescription: editProductModal.editDescription !== (editProductModal.product.description || '') ? editProductModal.editDescription : null,
                description: editProductModal.editDescription,
                category: categoryName,
                unit: editProductModal.editUnit,
                updatedAt: new Date(),
            });
            setEditProductModal({ show: false, product: null, editName: '', editDescription: '', editCategoryId: '', editUnit: 'kg' });
        } catch (error) {
            console.error('Error updating product:', error);
        }
        setSaving(false);
    };

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

    // Check if search matches with Turkish flexibility
    const turkishMatch = (text: string, search: string): boolean => {
        return normalizeTurkish(text).includes(normalizeTurkish(search));
    };

    const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
            kuzu: '🐑 Kuzu',
            dana: '🐄 Dana',
            tavuk: '🐔 Tavuk',
            islenmis: '🥓 İşlenmiş',
            diger: '📦 Diğer',
        };
        return labels[category] || category;
    };

    // Group products by category
    const groupedProducts = products.reduce((acc, product) => {
        const cat = product.category || 'Diğer';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, BusinessProduct[]>);

    // 🆕 Extract unique categories from existing products (for edit modal dropdown)
    const existingProductCategories = [...new Set(products.map(p => p.category || 'Diğer'))]
        .filter(cat => cat)
        .sort()
        .map(cat => ({ id: cat, name: cat, icon: getCategoryLabel(cat).includes(' ') ? getCategoryLabel(cat).split(' ')[0] : '📦' }));

    // Check which catalog products are not yet added to this shop
    const availableCatalogProducts = masterCatalog.filter(
        product => !products.some(p => p.productId === product.sku || p.sku === product.sku)
    );

    // For search: show ALL matching catalog products (with existing status)
    const getSearchResults = () => {
        if (!catalogSearch) return [];
        return masterCatalog.filter(p =>
            turkishMatch(p.name, catalogSearch) ||
            turkishMatch(p.sku, catalogSearch) ||
            turkishMatch(p.description || '', catalogSearch)
        ).map(p => ({
            ...p,
            isExisting: products.some(existing => existing.productId === p.sku || existing.sku === p.sku),
            existingProduct: products.find(existing => existing.productId === p.sku || existing.sku === p.sku)
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header - Dynamic based on business type */}
            <header className={`${getBusinessTypeLabel(butcher?.types || butcher?.type).color} bg-gradient-to-r text-white shadow-lg`}>
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <Link href={`/admin/business/${businessId}`} className="flex items-center gap-2 text-white/80 hover:text-white">
                        <span className="text-xl">←</span>
                        <span className="text-sm font-medium">{getBusinessTypeLabel(butcher?.types || butcher?.type).label} Detayı</span>
                    </Link>
                </div>
            </header>

            {/* Business Name Hero Section - Simplified */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 ${getBusinessTypeLabel(butcher?.types || butcher?.type).color} bg-gradient-to-br rounded-2xl flex items-center justify-center shadow-lg`}>
                                <span className="text-3xl">{getBusinessTypeLabel(butcher?.types || butcher?.type).emoji}</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-2xl font-bold text-white">{butcher?.companyName || 'İşletme'} - Ürünler</h1>
                                    <span className={`w-3 h-3 rounded-full ${butcher?.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                                </div>
                                {/* Row 1: Kundennummer + Brand + Product Count */}
                                <div className="flex items-center gap-3 text-sm mb-2">
                                    {butcher?.customerId && (
                                        <span className="bg-gray-700 px-2 py-0.5 rounded font-mono text-gray-300" title="Kundennummer">
                                            🏷️ {butcher.customerId}
                                        </span>
                                    )}
                                    {butcher?.brand === 'tuna' && butcher?.brandLabelActive && (
                                        <span className="bg-red-600 px-2 py-0.5 rounded text-xs font-bold text-white animate-pulse">
                                            ✓ Original TUNA
                                        </span>
                                    )}
                                    {butcher?.brand === 'akdeniz_toros' && butcher?.brandLabelActive && (
                                        <span className="bg-green-600 px-2 py-0.5 rounded text-xs font-bold text-white">
                                            ✓ Akdeniz Toros
                                        </span>
                                    )}
                                    <span className="text-green-400 font-medium">{products.length} Ürün</span>
                                </div>
                                {/* Row 2: City (prominent) + Phone + Today's Hours + Open/Closed Status */}
                                <div className="flex items-center gap-4">
                                    {butcher?.address?.city && (
                                        <span className="text-lg font-bold text-white">📍 {butcher.address.city}</span>
                                    )}
                                    {butcher?.shopPhone && (
                                        <a href={`tel:${butcher.shopPhone}`} className="flex items-center gap-1 text-blue-400 hover:underline text-sm">
                                            📞 {butcher.shopPhone}
                                        </a>
                                    )}
                                    {/* Today's Hours + Open/Closed Badge */}
                                    {butcher?.openingHours && (() => {
                                        try {
                                            const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                                            const today = dayNames[new Date().getDay()];
                                            // Support both string and array formats - use any to handle Firestore type variance
                                            const hours = butcher.openingHours as any;
                                            const hoursStr = typeof hours === 'string'
                                                ? hours
                                                : Array.isArray(hours)
                                                    ? hours.join('\n')
                                                    : '';
                                            if (!hoursStr) return null;
                                            const hoursArray = hoursStr.split('\n');
                                            const todayLine = hoursArray.find(line => line.startsWith(today));
                                            const todayHours = todayLine?.split(': ')[1] || null;

                                            // Check if currently open (simple logic)
                                            let isOpen = false;
                                            if (todayHours && !todayHours.toLowerCase().includes('kapalı')) {
                                                const now = new Date();
                                                const currentTime = now.getHours() * 60 + now.getMinutes();
                                                const timeMatch = todayHours.match(/(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/);
                                                if (timeMatch) {
                                                    const openHour = parseInt(timeMatch[1]) * 60 + (parseInt(timeMatch[2]) || 0);
                                                    const closeHour = parseInt(timeMatch[3]) * 60 + (parseInt(timeMatch[4]) || 0);
                                                    isOpen = currentTime >= openHour && currentTime <= closeHour;
                                                }
                                            }

                                            return (
                                                <div className="flex items-center gap-2">
                                                    {todayHours && (
                                                        <span className="text-gray-400 text-sm">
                                                            🕐 {todayHours}
                                                        </span>
                                                    )}
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isOpen ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                                        {isOpen ? '✓ Açık' : '✗ Kapalı'}
                                                    </span>
                                                </div>
                                            );
                                        } catch (e) {
                                            console.error('Error parsing opening hours:', e);
                                            return null;
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Inline Product Search & Add Section */}
                {availableCatalogProducts.length > 0 && (
                    <div className="bg-gray-800 rounded-xl p-5 mb-6 border border-gray-700">
                        {/* Search Field + Add Button - PROMINENT */}
                        <div className="mb-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Ürün ara... (örn: Dana Kıyma, Kuzu Pirzola)"
                                        value={catalogSearch}
                                        onChange={(e) => setCatalogSearch(e.target.value)}
                                        className="w-full pl-14 pr-4 py-4 bg-gray-700 border-2 border-gray-600 rounded-xl text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        title="Ürün Ara"
                                    />
                                    {catalogSearch && (
                                        <button
                                            onClick={() => setCatalogSearch('')}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 px-3 py-1 text-gray-400 hover:text-white"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {/* Quick Add Button next to search - visual only */}
                                <div
                                    className="px-5 py-4 bg-green-600 text-white rounded-xl flex items-center gap-2 font-medium whitespace-nowrap opacity-70 cursor-default"
                                >
                                    ➕ Ekle
                                </div>
                            </div>
                        </div>

                        {/* Inline Filtered Products OR Quick Access */}
                        {catalogSearch ? (
                            // Show filtered products when searching
                            <div className="max-h-[400px] overflow-y-auto space-y-2">
                                <p className="text-xs text-gray-500 mb-2">
                                    {getSearchResults().length} sonuç bulundu
                                </p>
                                {getSearchResults().map(product => {
                                    const categoryEmoji = product.category === 'dana' ? '🥩' :
                                        product.category === 'kuzu' ? '🐑' :
                                            product.category === 'tavuk' ? '🍗' :
                                                product.category === 'islenmis' ? '🥓' : '📦';

                                    return (
                                        <div
                                            key={product.sku}
                                            className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${product.isExisting
                                                ? 'bg-blue-900/20 border-blue-600/50'
                                                : 'bg-gray-700/50 border-gray-600 hover:bg-green-600/20 hover:border-green-500'
                                                }`}
                                        >
                                            <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                                                {categoryEmoji}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{product.sku}</span>
                                                    <span className="font-medium text-white truncate">{product.name}</span>
                                                    {product.isExisting && (
                                                        <span className="text-xs bg-blue-600/50 text-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            ✓ Mevcut
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-400 truncate">{product.description}</p>
                                                {product.isExisting && product.existingProduct && (
                                                    <p className="text-xs text-blue-300 mt-1">
                                                        Satış: {product.existingProduct.price?.toFixed(2) || '—'}€
                                                        {product.existingProduct.offerPrice && (
                                                            <span className="text-orange-400 ml-2">İndirim: {product.existingProduct.offerPrice.toFixed(2)}€</span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs text-gray-500">Alış Fiyatı</p>
                                                <p className="text-sm font-bold text-green-400">{(product.defaultPrice || 0).toFixed(2)}€/{product.defaultUnit || 'kg'}</p>
                                            </div>
                                            {/* Inline Quick-Add Form */}
                                            {!product.isExisting ? (
                                                expandedProductSku === product.sku ? (
                                                    // Expanded inline form
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                type="number"
                                                                placeholder="Fiyat €"
                                                                value={inlinePrice || ''}
                                                                onChange={(e) => setInlinePrice(parseFloat(e.target.value) || 0)}
                                                                className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm text-center focus:ring-2 focus:ring-green-500"
                                                                autoFocus
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Barkod"
                                                                value={inlineBarcode}
                                                                onChange={(e) => setInlineBarcode(e.target.value)}
                                                                className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs text-center focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => addProductInline(product)}
                                                            disabled={saving || inlinePrice <= 0}
                                                            className="w-10 h-10 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all"
                                                            title="Kaydet"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => setExpandedProductSku(null)}
                                                            className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center text-white text-sm"
                                                            title="İptal"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    // Collapsed + button
                                                    <button
                                                        onClick={() => expandInlineAdd(product)}
                                                        className="w-10 h-10 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all hover:scale-110"
                                                        title="Ürünü Ekle"
                                                    >
                                                        +
                                                    </button>
                                                )
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        if (product.existingProduct) {
                                                            setDeactivateModal({
                                                                show: true,
                                                                productId: product.existingProduct.id,
                                                                productName: product.name
                                                            });
                                                        }
                                                    }}
                                                    className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all hover:scale-110"
                                                    title="Ürünü Listeden Kaldır"
                                                >
                                                    −
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Products by Category */}
                {Object.keys(groupedProducts).length === 0 ? (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="text-4xl mb-4">🥩</div>
                        <h3 className="text-lg font-medium text-white mb-2">Henüz ürün eklenmemiş</h3>
                        <p className="text-gray-400 mb-4">Yukarıdaki katalogdan ürün ekleyerek başlayın.</p>
                        <button
                            onClick={openCatalogModal}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            📦 Katalogdan Ürün Ekle
                        </button>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, categoryProducts]) => (
                        <div key={category} className="bg-gray-800 rounded-xl mb-4 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-700 bg-gray-750">
                                <h3 className="font-medium text-white">{getCategoryLabel(category)}</h3>
                            </div>
                            <table className="min-w-full">
                                <thead className="bg-gray-750">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">SKU</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Ürün</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Birim</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Fiyat</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                                            <span className="flex items-center gap-1">
                                                🏷️ İndirim
                                            </span>
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Durum</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Aksiyon</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {categoryProducts.map(product => (
                                        <tr key={product.id} className={`hover:bg-gray-750 ${!product.isActive ? 'opacity-50' : ''}`}>
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
                                                    {product.offerPrice && product.offerPrice > 0 ? (
                                                        <span className="line-through text-gray-500 text-sm">{product.price.toFixed(2)}€</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={product.price}
                                                            onChange={(e) => updateProductPrice(product.id, parseFloat(e.target.value) || 0)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-red-500"
                                                            title="Fiyat"
                                                        />
                                                    )}
                                                    <span className="text-gray-500 text-xs">€/{product.unit}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {/* Dual Discount Mode: € + % */}
                                                <div className="flex flex-col gap-1">
                                                    {/* Row 1: € Amount Input */}
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={product.offerPrice || ''}
                                                            onChange={(e) => updateOfferPrice(product.id, parseFloat(e.target.value) || null)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            placeholder="—"
                                                            className={`w-20 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-orange-500 ${product.offerPrice && product.offerPrice > 0
                                                                ? 'bg-orange-900/50 border-2 border-orange-500 text-orange-300 font-bold'
                                                                : 'bg-gray-700 border border-gray-600 text-gray-400'
                                                                }`}
                                                            title="İndirimli Fiyat (€)"
                                                        />
                                                        <span className="text-gray-500 text-xs">€</span>
                                                    </div>
                                                    {/* Row 2: % Percentage Input */}
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            min="0"
                                                            max="99"
                                                            value={product.offerPrice && product.offerPrice > 0
                                                                ? Math.round((1 - product.offerPrice / product.price) * 100)
                                                                : ''}
                                                            onChange={(e) => {
                                                                const percent = parseFloat(e.target.value) || 0;
                                                                if (percent > 0 && percent < 100) {
                                                                    const calculatedPrice = product.price * (1 - percent / 100);
                                                                    updateOfferPrice(product.id, Math.round(calculatedPrice * 100) / 100);
                                                                } else if (percent === 0) {
                                                                    updateOfferPrice(product.id, null);
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            placeholder="—"
                                                            className={`w-14 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-orange-500 ${product.offerPrice && product.offerPrice > 0
                                                                ? 'bg-orange-900/50 border-2 border-orange-500 text-orange-300 font-bold'
                                                                : 'bg-gray-700 border border-gray-600 text-gray-400'
                                                                }`}
                                                            title="İndirim Yüzdesi (%)"
                                                        />
                                                        <span className="text-orange-400 text-xs font-bold">%</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {/* iOS-style Toggle Switch */}
                                                <button
                                                    onClick={() => toggleProductActive(product.id, product.isActive)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${product.isActive
                                                        ? 'bg-green-500 focus:ring-green-500'
                                                        : 'bg-red-500 focus:ring-red-500'
                                                        }`}
                                                    title={product.isActive ? 'Aktif - Pasif yapmak için tıkla' : 'Pasif - Aktif yapmak için tıkla'}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${product.isActive ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 flex gap-2">
                                                <button
                                                    onClick={() => openEditProductModal(product)}
                                                    className="text-green-400 hover:text-green-300 text-sm"
                                                    title="Ürünü Düzenle"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setPriceHistoryModal({ show: true, productId: product.id, productName: product.name });
                                                        loadPriceHistory(product.id);
                                                    }}
                                                    className="text-blue-400 hover:text-blue-300 text-sm"
                                                    title="Fiyat Geçmişi"
                                                >
                                                    📊
                                                </button>
                                                <button
                                                    onClick={() => showDeactivateConfirm(product.id, product.name)}
                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                    title="Ürünü listeden kaldır"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))
                )}
            </main>

            {/* Catalog Product Selection Modal */}
            {showCatalogModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-hidden">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-gray-900">📦 Katalogdan Ürün Ekle</h2>
                                <button onClick={() => setShowCatalogModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                                    ✕
                                </button>
                            </div>

                            {/* If no product selected, show search */}
                            {!selectedCatalogProduct ? (
                                <>
                                    <input
                                        type="text"
                                        value={catalogSearch}
                                        onChange={(e) => setCatalogSearch(e.target.value)}
                                        placeholder="Ürün adı veya SKU ara... (örn: antrikot, TM-D001)"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-red-500"
                                        autoFocus
                                    />

                                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                                        {masterCatalog
                                            .filter(p => !products.some(bp => bp.sku === p.sku || bp.productId === p.sku))
                                            .filter(p =>
                                                catalogSearch === '' ||
                                                p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                                p.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                                (p.description || '').toLowerCase().includes(catalogSearch.toLowerCase())
                                            )
                                            .map(product => {
                                                const imageMap: Record<string, string> = {
                                                    'TM-D001': '/images/products/dana_antrikot.png',
                                                    'TM-D002': '/images/products/dana_bonfile.png',
                                                    'TM-D003': '/images/products/dana_kiyma.png',
                                                    'TM-D004': '/images/products/dana_kusbasi.png',
                                                    'TM-D005': '/images/products/dana_kaburga.png',
                                                    'TM-D006': '/images/products/dana_ciger.png',
                                                    'TM-D007': '/images/products/dana_but.png',
                                                    'TM-D008': '/images/products/dana_dil.png',
                                                    'TM-D009': '/images/products/dana_biftek.png',
                                                    'TM-K001': '/images/products/kuzu_pirzola.png',
                                                    'TM-K002': '/images/products/kuzu_but.png',
                                                    'TM-K003': '/images/products/kuzu_kiyma.png',
                                                    'TM-K004': '/images/products/kuzu_kaburga.png',
                                                    'TM-K005': '/images/products/kuzu_kol.png',
                                                    'TM-K006': '/images/products/kuzu_incik.png',
                                                    'TM-K007': '/images/products/kuzu_paca.png',
                                                    'TM-T001': '/images/products/tavuk_gogsu.png',
                                                    'TM-T002': '/images/products/butun_tavuk.png',
                                                    'TM-T003': '/images/products/tavuk_but.png',
                                                    'TM-T004': '/images/products/tavuk_kanat.png',
                                                    'TM-T005': '/images/products/tavuk_pirzola.png',
                                                    'TM-I001': '/images/products/dana_sucuk.png',
                                                    'TM-I002': '/images/products/pastirma.png',
                                                    'TM-I003': '/images/products/kasap_kofte.png',
                                                    'TM-I004': '/images/products/kavurma.png',
                                                    'TM-I005': '/images/products/burger_kofte.png',
                                                    'TM-I006': '/images/products/sigir_sosis.png',
                                                    'TM-P001': '/images/products/kurban_paketi.png',
                                                    'TM-P002': '/images/products/mangal_paketi.png',
                                                    'TM-P003': '/images/products/aile_paketi.png',
                                                    'TM-P004': '/images/products/ogrenci_paketi.png',
                                                };
                                                const categoryEmoji = product.category === 'dana' ? '🥩' :
                                                    product.category === 'kuzu' ? '🐑' :
                                                        product.category === 'tavuk' ? '🍗' :
                                                            product.category === 'islenmis' ? '🥓' : '📦';

                                                return (
                                                    <button
                                                        key={product.sku}
                                                        onClick={() => selectCatalogProduct(product)}
                                                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all flex items-center gap-3"
                                                    >
                                                        {/* Product Image */}
                                                        <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                                            {imageMap[product.sku] ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={imageMap[product.sku]}
                                                                    alt={product.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        if (e.currentTarget.nextElementSibling) {
                                                                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                                                        }
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <span className="text-2xl" style={{ display: imageMap[product.sku] ? 'none' : 'flex' }}>{categoryEmoji}</span>
                                                        </div>

                                                        {/* Product Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{product.sku}</span>
                                                                <span className="font-medium text-gray-900 truncate">{product.name}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-500 truncate">{product.description}</p>
                                                        </div>

                                                        {/* Price */}
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-xs text-gray-400">Alış Fiyatı</p>
                                                            <p className="text-sm font-bold text-green-600">{(product.defaultPrice || 0).toFixed(2)}€/{product.defaultUnit || 'kg'}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        }
                                    </div>
                                </>
                            ) : (
                                /* Product selected - show price input with image */
                                <div className="flex gap-6">
                                    {/* Left side - Product info and price */}
                                    <div className="flex-1 space-y-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-mono text-blue-600 bg-blue-100 px-2 py-1 rounded">{selectedCatalogProduct.sku}</span>
                                                <span className="font-bold text-gray-900 text-lg">{selectedCatalogProduct.name}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-2">{selectedCatalogProduct.description}</p>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Önerilen fiyat: <span className="font-semibold text-green-600">{(selectedCatalogProduct.defaultPrice || 0).toFixed(2)}€/{selectedCatalogProduct.defaultUnit || "kg"}</span>
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Satış Fiyatı (€/{selectedCatalogProduct.defaultUnit || "kg"})
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={salePrice || ''}
                                                onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                                                className="w-full border-2 border-red-400 rounded-lg px-4 py-3 text-2xl font-bold text-center text-gray-900 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-red-300"
                                                placeholder={(selectedCatalogProduct.defaultPrice || 0).toFixed(2)}
                                                autoFocus
                                                title="Satış Fiyatı"
                                            />
                                            <p className="text-xs text-gray-500 mt-1 text-center">
                                                Tavsiye: {(selectedCatalogProduct.defaultPrice || 0).toFixed(2)}€
                                            </p>
                                        </div>

                                        <div className="flex gap-3 pt-4">
                                            <button
                                                onClick={() => setSelectedCatalogProduct(null)}
                                                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
                                            >
                                                ← Geri
                                            </button>
                                            <button
                                                onClick={addCatalogProductWithPrice}
                                                disabled={!salePrice || salePrice <= 0 || saving}
                                                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {saving ? 'Ekleniyor...' : '✓ Aktifleştir'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right side - Product image */}
                                    <div className="w-48 h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
                                        {(() => {
                                            const imageMap: Record<string, string> = {
                                                'TM-D001': '/images/products/dana_antrikot.png',
                                                'TM-D002': '/images/products/dana_bonfile.png',
                                                'TM-D003': '/images/products/dana_kiyma.png',
                                                'TM-D004': '/images/products/dana_kusbasi.png',
                                                'TM-D005': '/images/products/dana_kaburga.png',
                                                'TM-D006': '/images/products/dana_ciger.png',
                                                'TM-D007': '/images/products/dana_but.png',
                                                'TM-D008': '/images/products/dana_dil.png',
                                                'TM-D009': '/images/products/dana_biftek.png',
                                                'TM-K001': '/images/products/kuzu_pirzola.png',
                                                'TM-K002': '/images/products/kuzu_but.png',
                                                'TM-K003': '/images/products/kuzu_kiyma.png',
                                                'TM-K004': '/images/products/kuzu_kaburga.png',
                                                'TM-K005': '/images/products/kuzu_kol.png',
                                                'TM-K006': '/images/products/kuzu_incik.png',
                                                'TM-K007': '/images/products/kuzu_paca.png',
                                                'TM-T001': '/images/products/tavuk_gogsu.png',
                                                'TM-T002': '/images/products/butun_tavuk.png',
                                                'TM-T003': '/images/products/tavuk_but.png',
                                                'TM-T004': '/images/products/tavuk_kanat.png',
                                                'TM-T005': '/images/products/tavuk_pirzola.png',
                                                'TM-I001': '/images/products/dana_sucuk.png',
                                                'TM-I002': '/images/products/pastirma.png',
                                                'TM-I003': '/images/products/kasap_kofte.png',
                                                'TM-I004': '/images/products/kavurma.png',
                                                'TM-I005': '/images/products/burger_kofte.png',
                                                'TM-I006': '/images/products/sigir_sosis.png',
                                                'TM-P001': '/images/products/kurban_paketi.png',
                                                'TM-P002': '/images/products/mangal_paketi.png',
                                                'TM-P003': '/images/products/aile_paketi.png',
                                                'TM-P004': '/images/products/ogrenci_paketi.png',
                                            };
                                            const imageSrc = imageMap[selectedCatalogProduct.sku];
                                            if (imageSrc) {
                                                return (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={imageSrc}
                                                        alt={selectedCatalogProduct.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                );
                                            }
                                            return null;
                                        })()}
                                        <div className={`text-6xl ${selectedCatalogProduct.category === 'dana' ? '' : selectedCatalogProduct.category === 'kuzu' ? '' : selectedCatalogProduct.category === 'tavuk' ? '' : ''}`}>
                                            {selectedCatalogProduct.category === 'dana' ? '🥩' :
                                                selectedCatalogProduct.category === 'kuzu' ? '🐑' :
                                                    selectedCatalogProduct.category === 'tavuk' ? '🍗' :
                                                        selectedCatalogProduct.category === 'islenmis' ? '🥓' : '📦'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Deactivate Confirmation Modal */}
            {deactivateModal.show && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-700">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-4xl">⚠️</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Ürünü Kaldır</h3>
                            <p className="text-gray-300 mb-2">
                                <span className="font-semibold text-white">&quot;{deactivateModal.productName}&quot;</span>
                            </p>
                            <p className="text-gray-400 text-sm mb-6">
                                Bu ürünü LOKMA uygulamasından kaldırmak istiyor musunuz?
                                <br />
                                <span className="text-gray-500">Ürün, katalogdan tekrar eklenebilir.</span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeactivateModal({ show: false, productId: '', productName: '' })}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 font-medium transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={confirmDeactivate}
                                    className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium transition"
                                >
                                    Evet, Kaldır
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Price History Modal */}
            {priceHistoryModal.show && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">📊 Fiyat Geçmişi</h3>
                                <p className="text-gray-400 text-sm mt-1">{priceHistoryModal.productName}</p>
                            </div>
                            <button
                                onClick={() => setPriceHistoryModal({ show: false, productId: '', productName: '' })}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Time Filter Buttons */}
                        <div className="p-4 border-b border-gray-700 flex gap-2 flex-wrap">
                            {(['7d', '30d', 'month', '3mo', '1yr'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => {
                                        setHistoryFilter(filter);
                                        loadPriceHistory(priceHistoryModal.productId);
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${historyFilter === filter
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {filter === '7d' ? 'Son 7 Gün' :
                                        filter === '30d' ? 'Son 30 Gün' :
                                            filter === 'month' ? 'Bu Ay' :
                                                filter === '3mo' ? 'Son 3 Ay' : 'Son 1 Yıl'}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loadingHistory ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                                </div>
                            ) : priceHistory.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <p className="text-4xl mb-3">📭</p>
                                    <p>Bu dönemde fiyat değişikliği yok</p>
                                </div>
                            ) : (
                                <>
                                    {/* Simple Chart */}
                                    <div className="bg-gray-900 rounded-xl p-4">
                                        <h4 className="text-sm font-medium text-gray-400 mb-4">Fiyat Grafiği</h4>
                                        <div className="h-48 relative">
                                            {(() => {
                                                const sortedHistory = [...priceHistory].reverse();
                                                const prices = sortedHistory.map(h => h.newPrice || h.oldPrice || 0);
                                                const maxPrice = Math.max(...prices, 1);
                                                const minPrice = Math.min(...prices);
                                                const range = maxPrice - minPrice || 1;

                                                if (sortedHistory.length < 2) {
                                                    return (
                                                        <div className="flex items-center justify-center h-full text-gray-500">
                                                            En az 2 veri noktası gerekli
                                                        </div>
                                                    );
                                                }

                                                const points = sortedHistory.map((h, i) => {
                                                    const x = (i / (sortedHistory.length - 1)) * 100;
                                                    const y = 100 - (((h.newPrice || h.oldPrice || 0) - minPrice) / range) * 80 - 10;
                                                    return `${x},${y}`;
                                                }).join(' ');

                                                return (
                                                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                        {/* Grid lines */}
                                                        <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                                                        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                                                        <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

                                                        {/* Line */}
                                                        <polyline
                                                            points={points}
                                                            fill="none"
                                                            stroke="#3b82f6"
                                                            strokeWidth="2"
                                                            vectorEffect="non-scaling-stroke"
                                                        />

                                                        {/* Points */}
                                                        {sortedHistory.map((h, i) => {
                                                            const x = (i / (sortedHistory.length - 1)) * 100;
                                                            const y = 100 - (((h.newPrice || h.oldPrice || 0) - minPrice) / range) * 80 - 10;
                                                            return (
                                                                <circle
                                                                    key={h.id}
                                                                    cx={x}
                                                                    cy={y}
                                                                    r="2"
                                                                    fill="#3b82f6"
                                                                />
                                                            );
                                                        })}
                                                    </svg>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                            <span>{priceHistory[priceHistory.length - 1]?.timestamp.toLocaleDateString('tr-TR')}</span>
                                            <span>{priceHistory[0]?.timestamp.toLocaleDateString('tr-TR')}</span>
                                        </div>
                                    </div>

                                    {/* Log List */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-3">Değişiklik Geçmişi</h4>
                                        <div className="space-y-2">
                                            {priceHistory.map(log => (
                                                <div key={log.id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400">
                                                        {log.changeType === 'offer' ? '🏷️' : '💰'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-white font-medium">
                                                                {log.changeType === 'offer' ? 'İndirim Fiyatı' : 'Fiyat'}
                                                            </span>
                                                            {log.changeType === 'price' ? (
                                                                <>
                                                                    <span className="text-red-400 line-through">{log.oldPrice?.toFixed(2) || '—'}€</span>
                                                                    <span className="text-gray-500">→</span>
                                                                    <span className="text-green-400 font-bold">{log.newPrice?.toFixed(2) || '—'}€</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-orange-400 line-through">{log.oldOfferPrice?.toFixed(2) || '—'}€</span>
                                                                    <span className="text-gray-500">→</span>
                                                                    <span className="text-orange-300 font-bold">{log.newOfferPrice?.toFixed(2) || 'Kaldırıldı'}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500">
                                                            {log.userName} • {log.timestamp.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🆕 Edit Product Modal */}
            {editProductModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto border border-gray-700">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">✏️ Ürün Düzenle</h2>
                                <button
                                    onClick={() => setEditProductModal({ show: false, product: null, editName: '', editDescription: '', editCategoryId: '', editUnit: 'kg' })}
                                    className="text-gray-400 hover:text-white text-2xl"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* SKU/Master Info (Read-only) */}
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">SKU</p>
                                    <p className="text-sm font-mono text-blue-400">{editProductModal.product?.sku || editProductModal.product?.masterProductId || '-'}</p>
                                </div>

                                {/* Ürün Adı */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Ürün Adı</label>
                                    <input
                                        type="text"
                                        value={editProductModal.editName}
                                        onChange={(e) => setEditProductModal({ ...editProductModal, editName: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Ürün adı"
                                    />
                                </div>

                                {/* Açıklama */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama</label>
                                    <textarea
                                        value={editProductModal.editDescription}
                                        onChange={(e) => setEditProductModal({ ...editProductModal, editDescription: e.target.value })}
                                        rows={3}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                        placeholder="Ürün açıklaması"
                                    />
                                </div>

                                {/* Kategori */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Kategori (Menü Başlığı)</label>
                                    {/* 🆕 Combine businessCategories with existingProductCategories */}
                                    {(() => {
                                        // Merge business categories and existing product categories
                                        const allCategories = [
                                            ...businessCategories,
                                            ...existingProductCategories.filter(ec =>
                                                !businessCategories.some(bc => bc.id === ec.id || bc.name === ec.name)
                                            )
                                        ];

                                        return allCategories.length > 0 ? (
                                            <select
                                                value={editProductModal.editCategoryId}
                                                onChange={(e) => setEditProductModal({ ...editProductModal, editCategoryId: e.target.value })}
                                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Kategori Seç...</option>
                                                {allCategories.map(cat => (
                                                    <option key={cat.id} value={cat.name}>
                                                        {cat.icon} {cat.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <input
                                                    type="text"
                                                    value={editProductModal.editCategoryId}
                                                    onChange={(e) => setEditProductModal({ ...editProductModal, editCategoryId: e.target.value })}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    placeholder="Kategori adı yazın..."
                                                />
                                                <p className="text-gray-500 text-xs mt-1">Henüz kategori yok. Yeni bir kategori adı yazabilirsiniz.</p>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Birim */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Birim</label>
                                    <select
                                        value={editProductModal.editUnit}
                                        onChange={(e) => setEditProductModal({ ...editProductModal, editUnit: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    >
                                        <option value="kg">Kilogram (kg)</option>
                                        <option value="adet">Adet</option>
                                        <option value="porsiyon">Porsiyon</option>
                                        <option value="Liter">Litre</option>
                                        <option value="paket">Paket</option>
                                        <option value="kutu">Kutu</option>
                                        <option value="dilim">Dilim</option>
                                        <option value="kişilik">Kişilik</option>
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                                <button
                                    onClick={() => setEditProductModal({ show: false, product: null, editName: '', editDescription: '', editCategoryId: '', editUnit: 'kg' })}
                                    className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={updateProductDetails}
                                    disabled={saving || !editProductModal.editName}
                                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-medium transition"
                                >
                                    {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
