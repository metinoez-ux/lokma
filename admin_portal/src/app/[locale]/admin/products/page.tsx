"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { getCurrencySymbol } from "@/utils/currency";
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    writeBatch,
    getDoc,
    addDoc,
    query,
    orderBy,
    where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';
import { normalizeTurkish, getLocalizedText } from "@/lib/utils";
import MultiLanguageInput from '@/components/ui/MultiLanguageInput';
import { MASTER_PRODUCTS, MasterProduct } from "@/lib/master_products";
import { getBusinessTypesList, BusinessTypeConfig } from "@/lib/business-types";
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';

// Extended product type with new fields
interface ExtendedProduct extends MasterProduct {
    categories?: string[];
    allowedBusinessTypes?: string[];  // Hangi işletme TÜRLERİ satabilir
    brand?: string;
    images?: string[];
    isActive?: boolean;
    // Ürün Attributeleri
    isProcessed?: boolean;   // Hazır/İşlenmiş
    isPackaged?: boolean;    // Paketli
    isLoose?: boolean;       // 🆕 Lose Ware / Açık Ürün (paketlenmemiş)
    isOrganic?: boolean;     // Organik
    // 🧪 Alerjenler & Katkı Maddeleri (EU LMIV 1169/2011)
    allergens?: string[];           // Alerjen listesi
    additives?: string[];           // Katkı maddesi listesi
    allergensConfirmed?: boolean;   // Satıcı tarafından onaylandı mı?
    additivesConfirmed?: boolean;   // Satıcı tarafından onaylandı mı?
    // 🆕 Besin Değerleri (EU LMIV 1169/2011 Nutrition Facts per 100g)
    nutritionPer100g?: {
        energy_kcal?: number;
        energy_kj?: number;
        fat?: number;
        saturatedFat?: number;
        carbohydrates?: number;
        sugar?: number;
        protein?: number;
        salt?: number;
    };
    // 🆕 ERP Extended Fields
    originCountry?: string;          // Menşe ülke
    chargeNumber?: string;           // Charge/Lot numarası
    internalNotes?: string;          // Dahili admin notları
    tags?: string[];                 // Etiketler/Tags
    createdAt?: string;              // ISO timestamp
    updatedAt?: string;              // ISO timestamp
    lastModifiedBy?: string;         // Admin email
    // 🆕 Stok Durumu
    outOfStock?: boolean;              // Geçici olarak stokta yok
}

// Product Edit Tab Type
type ProductEditTab = 'general' | 'pricing' | 'stock' | 'media' | 'compliance' | 'audit' | 'app';

// İşletme türleri business-types.ts'den çekiliyor
const BUSINESS_TYPE_OPTIONS = getBusinessTypesList().map(bt => ({
    value: bt.value,
    label: `${bt.icon} ${bt.label}`,
    color: `bg-${bt.color}-600`,
}));

// Removed options to be placed inside the component

// Validation Errors Type
interface ValidationErrors {
    id?: string;
    name?: string;
    category?: string;
    defaultUnit?: string;
}

// 🆕 KERMES MODU TİPİ
type PageMode = 'products' | 'kermes' | 'business';

// Business Info interface for context-aware product management
interface BusinessInfo {
    id: string;
    companyName: string;
    type?: string;
}

function GlobalProductsPageContent() {
    const t = useTranslations('AdminProducts');

    // Ürün türleri (sadece gıda/ürün kategorileri için)
    const PRODUCT_TYPE_OPTIONS = [
        { value: 'dana', label: '🐄 Dana', color: 'bg-red-600' },
        { value: 'kuzu', label: '🐏 Kuzu', color: 'bg-green-600' },
        { value: 'tavuk', label: '🐔 Tavuk', color: 'bg-amber-600' },
        { value: 'icecek', label: t('icecek'), color: 'bg-blue-600' },
        { value: 'tatli', label: t('tatli'), color: 'bg-pink-600' },
        { value: 'sebze', label: '🥬 Sebze/Meyve', color: 'bg-green-600' },
        // 🆕 KERMES KATEGORİLERİ
        { value: 'kermes_yemek', label: '🍲 Kermes Yemek', color: 'bg-purple-600' },
        { value: 'kermes_tatli', label: t('kermesTatli'), color: 'bg-pink-500' },
        { value: 'kermes_icecek', label: t('kermesIcecek'), color: 'bg-cyan-600' },
        { value: 'kermes_atistirmalik', label: t('kermesAtistirmalik'), color: 'bg-amber-600' },
        { value: 'diger', label: t('diger'), color: 'bg-gray-600' },
    ];

    // Marka Etiketleri (Kasap Zincirleri)
    const BRAND_LABELS = [
        { value: 'tuna', label: 'TUNA', color: 'bg-red-600', icon: '🔴' },
        { value: 'akdeniz_toros', label: 'Akdeniz Toros', color: 'bg-gray-800', icon: '⚫' },
    ];

    // Toptancı/Kaynak Filtreleri
    const WHOLESALER_OPTIONS = [
        { value: 'all', label: t('tumKaynaklar'), icon: '📦' },
        { value: 'foodpaket', label: 'Foodpaket', icon: '🛒' },
        { value: 'asia_express', label: 'Asia Express', icon: '🌏' },
        { value: 'dovgan', label: 'Dovgan', icon: '🇷🇺' },
        { value: 'manual', label: 'Manuel', icon: '✏️' },
    ];

    // Ülke Filtreleri
    const COUNTRY_OPTIONS = [
        { value: 'all', label: t('tumUlkeler'), icon: '🌍' },
        { value: 'japan', label: 'Japonya', icon: '🇯🇵' },
        { value: 'korea', label: 'Kore', icon: '🇰🇷' },
        { value: 'china', label: t('cin'), icon: '🇨🇳' },
        { value: 'thailand', label: 'Tayland', icon: '🇹🇭' },
        { value: 'vietnam', label: 'Vietnam', icon: '🇻🇳' },
        { value: 'turkey', label: t('turkiye'), icon: '🇹🇷' },
        { value: 'germany', label: 'Almanya', icon: '🇩🇪' },
        { value: 'other', label: t('diger1'), icon: '🔸' },
    ];
    // 🆕 Context-awareness: Support for businessId query parameter
    const { admin, loading: adminLoading } = useAdmin();
    const searchParams = useSearchParams();
    const urlBusinessId = searchParams.get('businessId');
    const urlKermesId = searchParams.get('kermesId');

    // Determine the active business context
    const isSuperAdmin = admin?.adminType === 'super';
    const contextBusinessId = isSuperAdmin ? urlBusinessId : admin?.butcherId;
    const isBusinessContext = !!contextBusinessId;

    // Business info state
    const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
    const [loadingBusiness, setLoadingBusiness] = useState(false);

    const [products, setProducts] = useState<ExtendedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ExtendedProduct | null>(null);
    const [productEditTab, setProductEditTab] = useState<ProductEditTab>('general');
    const [formData, setFormData] = useState<Partial<ExtendedProduct>>({
        id: "",
        name: { tr: "" },
        category: "dana",
        categories: [],
        defaultUnit: "kg",
        description: { tr: "" },
        brand: "",
        images: [],
        isActive: true
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [wholesalerFilter, setWholesalerFilter] = useState('all');
    const [countryFilter, setCountryFilter] = useState('all');
    const [brandFilter, setBrandFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const PRODUCTS_PER_PAGE = 10;

    // Bulk selection
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);

    // Image upload
    const [uploadingImages, setUploadingImages] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Validation errors
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    // 🆕 KERMES MODU STATE'LERİ
    const [pageMode, setPageMode] = useState<PageMode>('products');
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
    const [kermesMenuProducts, setKermesMenuProducts] = useState<any[]>([]);
    const [savingKermesMenu, setSavingKermesMenu] = useState(false);
    const [kermesOrgSearch, setKermesOrgSearch] = useState('');

    // 🆕 BUSINESS PRODUCTS STATE - Show business's assigned products first
    const [businessProducts, setBusinessProducts] = useState<any[]>([]);
    const [loadingBusinessProducts, setLoadingBusinessProducts] = useState(false);

    // 🆕 BUSINESS CATEGORIES STATE - Category tabs for filtering
    const [businessCategories, setBusinessCategories] = useState<{ id: string; name: string; icon: string; order: number; isActive: boolean }[]>([]);
    const [loadingBusinessCategories, setLoadingBusinessCategories] = useState(false);
    const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
    const [bizStatusFilter, setBizStatusFilter] = useState<string>('all'); // all | active | passive | outOfStock | inStock | discounted

    // 🆕 DUAL VIEW: Kategoriler vs Ürünler vs Sponsored toggle
    const [businessViewMode, setBusinessViewMode] = useState<'products' | 'categories' | 'sponsored'>('products');

    // 🌟 SPONSORED PRODUCTS STATE
    const [sponsoredProducts, setSponsoredProducts] = useState<string[]>([]);
    const [sponsoredSettings, setSponsoredSettings] = useState<{
        enabled: boolean;
        feePerConversion: number;
        maxProductsPerBusiness: number;
    }>({ enabled: false, feePerConversion: 0.40, maxProductsPerBusiness: 5 });
    const [sponsoredSaving, setSponsoredSaving] = useState(false);

    // 📂📦 TEMPLATE APPLY STATE
    const [applyingCategoryTemplate, setApplyingCategoryTemplate] = useState(false);
    const [applyingProductTemplate, setApplyingProductTemplate] = useState(false);

    // 🆕 BUSINESS PRODUCT MULTI-SELECT & PAGINATION
    const [selectedBusinessProducts, setSelectedBusinessProducts] = useState<Set<string>>(new Set());
    const [businessProductPage, setBusinessProductPage] = useState(1);
    const BUSINESS_PRODUCTS_PER_PAGE = 20;

    // 🆕 INLINE CATEGORY MANAGEMENT
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategoryItem, setEditingCategoryItem] = useState<{ id: string; name: any; icon: string; order: number; isActive: boolean } | null>(null);
    const [categoryFormData, setCategoryFormData] = useState<{ name: any, icon: string, isActive: boolean }>({ name: { tr: '' }, icon: '📦', isActive: true });
    const [savingCategory, setSavingCategory] = useState(false);
    const CATEGORY_ICONS = ['🥩', '🐑', '🐄', '🐔', '🥓', '📦', '🍖', '🌿', '🧈', '🥚', '🍕', '🌯', '🥗', '🍰', '🥤', '🍔', '🌭', '🥙'];
    const [showAllMasterProducts, setShowAllMasterProducts] = useState(false);

    // Generic confirm modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        itemName?: string;
        variant: 'danger' | 'warning';
        confirmText: string;
        loadingText: string;
        onConfirm: () => Promise<void>;
    } | null>(null);

    // Kermes ürünlerini filtrele
    const kermesProducts = products.filter(p =>
        p.category?.startsWith('kermes_') ||
        (p.categories || []).some(c => c.startsWith('kermes_'))
    );

    // Fetch Products
    const fetchProducts = async () => {
        setLoading(true);
        try {
            // Simple query without orderBy to avoid index requirement
            const snapshot = await getDocs(collection(db, "master_products"));
            const fetchedProducts = snapshot.docs.map(doc => doc.data() as MasterProduct);
            // Sort client-side
            fetchedProducts.sort((a, b) => {
                const nameA = getLocalizedText(a.name);
                const nameB = getLocalizedText(b.name);
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return nameA.localeCompare(nameB);
            });
            setProducts(fetchedProducts);
        } catch (error) {
            console.error("Error fetching master products:", error);
            alert(t('urunlerYuklenirkenHataOlustu'));
        } finally {
            setLoading(false);
        }
    };

    // 🆕 KERMES - Organizations yükle
    const fetchOrganizations = async () => {
        setLoadingOrganizations(true);
        try {
            const snapshot = await getDocs(collection(db, "organizations"));
            const orgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setOrganizations(orgs);
            console.log('✅ Organizations loaded:', orgs.length);
        } catch (error) {
            console.error("Error fetching organizations:", error);
        } finally {
            setLoadingOrganizations(false);
        }
    };

    // 🆕 Fetch Business-specific Products (from businesses/{id}/products subcollection)
    const fetchBusinessProducts = async () => {
        if (!contextBusinessId) return;
        setLoadingBusinessProducts(true);
        try {
            const snapshot = await getDocs(collection(db, `businesses/${contextBusinessId}/products`));
            const prods = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
            }));
            // Sort by category then name
            prods.sort((a: any, b: any) => {
                const nameA = getLocalizedText(a.name);
                const nameB = getLocalizedText(b.name);
                const catA = a.category || '';
                const catB = b.category || '';
                if (catA !== catB) return catA.localeCompare(catB);
                return nameA.localeCompare(nameB);
            });
            setBusinessProducts(prods);
            console.log('✅ Business products loaded:', prods.length);
        } catch (error) {
            console.error('Error fetching business products:', error);
        }
        setLoadingBusinessProducts(false);
    };

    useEffect(() => {
        // Load business info if in business context
        const loadBusinessInfo = async () => {
            if (!contextBusinessId || adminLoading) return;

            setLoadingBusiness(true);
            try {
                const businessDoc = await getDoc(doc(db, 'businesses', contextBusinessId));
                if (businessDoc.exists()) {
                    const data = businessDoc.data();
                    setBusinessInfo({
                        id: businessDoc.id,
                        companyName: data.companyName || data.name || data.brand || t('isletme'),
                        type: data.type || data.businessType,
                    });
                    // 🌟 Load sponsored products from business doc
                    setSponsoredProducts(data.sponsoredProducts || []);

                    // 🌟 Load sponsored limits from subscription plan
                    const planCode = data.subscriptionPlan || 'basic';
                    try {
                        const plansQuery = query(
                            collection(db, 'subscription_plans'),
                            where('code', '==', planCode)
                        );
                        const planSnap = await getDocs(plansQuery);
                        if (!planSnap.empty) {
                            const planData = planSnap.docs[0].data();
                            if (planData.features?.sponsoredProducts) {
                                setSponsoredSettings({
                                    enabled: true,
                                    feePerConversion: planData.sponsoredFeePerConversion ?? 0.40,
                                    maxProductsPerBusiness: planData.sponsoredMaxProducts ?? 5,
                                });
                            }
                        }
                    } catch (planError) {
                        console.error('Error loading plan for sponsored settings:', planError);
                    }
                }
            } catch (error) {
                console.error('Error loading business info:', error);
            }
            setLoadingBusiness(false);
        };

        loadBusinessInfo();
    }, [contextBusinessId, adminLoading]);

    useEffect(() => {
        if (!adminLoading) {
            fetchProducts();
        }
    }, [adminLoading]);

    // 🆕 Load business products when in business context
    useEffect(() => {
        if (isBusinessContext && !adminLoading) {
            fetchBusinessProducts();
        }
    }, [contextBusinessId, adminLoading]);

    // 🆕 Load business categories for tab display
    // Helper: reload categories from Firestore
    const reloadBusinessCategories = async () => {
        if (!contextBusinessId) return;
        setLoadingBusinessCategories(true);
        try {
            const categoriesRef = collection(db, `businesses/${contextBusinessId}/categories`);
            const q = query(categoriesRef, orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const cats = snapshot.docs.map(d => ({
                id: d.id,
                name: (() => {
                    const n = d.data().name;
                    if (!n) return '';
                    if (typeof n === 'string') return n;
                    if (typeof n === 'object') return n.tr || n.de || n.en || Object.values(n)[0] || '';
                    return String(n);
                })(),
                icon: d.data().icon || '📦',
                order: d.data().order || 0,
                isActive: d.data().isActive !== false,
            }));
            setBusinessCategories(cats);
        } catch (error) {
            console.error('Error loading business categories:', error);
        }
        setLoadingBusinessCategories(false);
    };

    // 📂 Apply CATEGORY template to this business
    const applyCategoryTemplate = async () => {
        if (!contextBusinessId) return;
        setApplyingCategoryTemplate(true);
        try {
            const templateDoc = await getDoc(doc(db, 'defaultMenuTemplates', 'kasap'));
            if (!templateDoc.exists()) {
                alert('Şablon bulunamadı!');
                setApplyingCategoryTemplate(false);
                return;
            }
            const template = templateDoc.data();
            const categories = template.categories || [];

            // Delete existing categories first
            const existingSnap = await getDocs(collection(db, `businesses/${contextBusinessId}/categories`));
            for (const d of existingSnap.docs) {
                await deleteDoc(d.ref);
            }

            // Create each category
            const catRef = collection(db, `businesses/${contextBusinessId}/categories`);
            for (let i = 0; i < categories.length; i++) {
                const cat = categories[i];
                await addDoc(catRef, {
                    name: cat.name,
                    icon: cat.icon,
                    isActive: true,
                    order: i,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            await reloadBusinessCategories();
            alert(`${categories.length} kategori başarıyla yüklendi ✅`);
        } catch (error) {
            console.error('Error applying category template:', error);
            alert('Kategori şablonu uygulanırken hata oluştu');
        }
        setApplyingCategoryTemplate(false);
    };

    // 📦 Apply PRODUCT template to this business
    const applyProductTemplate = async () => {
        if (!contextBusinessId) return;
        setApplyingProductTemplate(true);
        try {
            const masterProductsSnap = await getDocs(collection(db, 'master_products'));
            const kasapProducts = masterProductsSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((p: any) => (p.allowedBusinessTypes || []).includes('kasap'));

            let productCount = 0;
            for (const product of kasapProducts) {
                const p = product as any;
                await setDoc(doc(db, `businesses/${contextBusinessId}/products`, p.id), {
                    masterProductId: p.id,
                    name: p.name,
                    description: p.description || { tr: '' },
                    category: p.category || 'dana',
                    categories: p.categories || [p.category || 'dana'],
                    defaultUnit: p.defaultUnit || 'kg',
                    unit: p.unit || p.defaultUnit || 'kg',
                    price: p.defaultPrice || 0,
                    isActive: true,
                    isAvailable: true,
                    brandLabels: p.brandLabels || [],
                    imageUrl: p.imageUrl || '',
                    images: p.imageUrl ? [p.imageUrl] : (p.images || []),
                    optionGroups: p.optionGroups || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
                productCount++;
            }

            await fetchBusinessProducts();
            alert(`${productCount} ürün başarıyla yüklendi ✅`);
        } catch (error) {
            console.error('Error applying product template:', error);
            alert('Ürün şablonu uygulanırken hata oluştu');
        }
        setApplyingProductTemplate(false);
    };

    useEffect(() => {
        if (!contextBusinessId || adminLoading) return;
        reloadBusinessCategories();
    }, [contextBusinessId, adminLoading]);

    // 🆕 Category CRUD handlers
    const handleCategorySave = async () => {
        const catNameStr = getLocalizedText(categoryFormData.name);
        if (!contextBusinessId || !catNameStr.trim()) return;
        setSavingCategory(true);
        try {
            const categoriesRef = collection(db, `businesses/${contextBusinessId}/categories`);
            if (editingCategoryItem) {
                await updateDoc(doc(db, `businesses/${contextBusinessId}/categories`, editingCategoryItem.id), {
                    name: categoryFormData.name,
                    icon: categoryFormData.icon,
                    isActive: categoryFormData.isActive,
                    updatedAt: new Date(),
                });
            } else {
                await addDoc(categoriesRef, {
                    name: categoryFormData.name,
                    icon: categoryFormData.icon,
                    isActive: categoryFormData.isActive,
                    order: businessCategories.length,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
            await reloadBusinessCategories();
            setShowCategoryModal(false);
            setEditingCategoryItem(null);
            setCategoryFormData({ name: '', icon: '📦', isActive: true });
        } catch (error) {
            console.error('Error saving category:', error);
            alert(t('kategoriKaydedilirkenHataOlustu'));
        }
        setSavingCategory(false);
    };

    const handleCategoryDelete = async (cat: { id: string; name: any }) => {
        if (!contextBusinessId) return;
        const catNameStr = getLocalizedText(cat.name);
        if (!window.confirm(`"${catNameStr}${t('kategorisiniSilmekIstediginizeEminMisiniz')}`)) return;
        try {
            await deleteDoc(doc(db, `businesses/${contextBusinessId}/categories`, cat.id));
            await reloadBusinessCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert(t('kategoriSilinirkenHataOlustu'));
        }
    };

    const handleCategoryMove = async (index: number, direction: 'up' | 'down') => {
        if (!contextBusinessId) return;
        const newCats = [...businessCategories];
        const targetIdx = direction === 'up' ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= newCats.length) return;
        [newCats[index], newCats[targetIdx]] = [newCats[targetIdx], newCats[index]];
        try {
            for (let i = 0; i < newCats.length; i++) {
                await updateDoc(doc(db, `businesses/${contextBusinessId}/categories`, newCats[i].id), { order: i });
            }
            setBusinessCategories(newCats.map((c, i) => ({ ...c, order: i })));
        } catch (error) {
            console.error('Error reordering categories:', error);
        }
    };

    const openCategoryEdit = (cat: { id: string; name: any; icon: string; order: number; isActive: boolean }) => {
        setEditingCategoryItem(cat);
        setCategoryFormData({ name: cat.name, icon: cat.icon, isActive: cat.isActive });
        setShowCategoryModal(true);
    };

    const openCategoryAdd = () => {
        setEditingCategoryItem(null);
        setCategoryFormData({ name: { tr: '' }, icon: '📦', isActive: true });
        setShowCategoryModal(true);
    };

    // Active categories for filtering
    const activeBusinessCategories = businessCategories.filter(c => c.isActive);

    // Kermes modu seçildiğinde organizations yükle
    useEffect(() => {
        if (pageMode === 'kermes' && organizations.length === 0) {
            fetchOrganizations();
        }
    }, [pageMode]);

    // Seed Data
    const handleSeed = () => {
        setConfirmModal({
            isOpen: true,
            title: t('varsayilanUrunleriYukle'),
            message: t('mevcutVeritabaninaVarsayilanUrunlerEklenecekDevam'),
            variant: 'warning',
            confirmText: t('evetYukle'),
            loadingText: t('yukleniyor'),
            onConfirm: async () => {
                setSeeding(true);
                try {
                    for (const product of MASTER_PRODUCTS) {
                        await setDoc(doc(db, "master_products", product.id), {
                            ...product,
                            images: product.imageUrl ? [product.imageUrl] : [],
                        });
                    }
                    alert(t('varsayilanUrunlerBasariylaEklendi'));
                    fetchProducts();
                } catch (error) {
                    console.error("Error seeding products:", error);
                    alert(t('veriEklenirkenHataOlustu'));
                } finally {
                    setSeeding(false);
                }
            },
        });
    };

    // Save (Add/Edit)
    const handleSave = async () => {
        // Validation - Only truly essential fields
        const nameStr = getLocalizedText(formData.name);
        const errors: ValidationErrors = {};
        if (!formData.id?.trim()) errors.id = 'SKU (ID) zorunludur';
        if (!nameStr.trim()) errors.name = t('urunAdiZorunludur');

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }
        setValidationErrors({});

        try {
            const productId = formData.id!.trim();
            const productRef = doc(db, "master_products", productId);

            const productData = {
                id: productId,
                name: formData.name, // Localized map OR string
                category: formData.category,
                categories: (formData as any).categories || [],
                // 🆕 Hangi işletme türleri satabilir
                allowedBusinessTypes: (formData as any).allowedBusinessTypes || [],
                defaultUnit: formData.defaultUnit || 'adet',
                unit: formData.defaultUnit || 'adet', // 🆕 Mobile app reads 'unit' field
                description: formData.description || { tr: "" },
                // Brand & Labels
                brand: (formData as any).brand || null,
                brandLabels: (formData as any).brandLabels || [], // TUNA, Akdeniz Toros
                // Images
                images: (formData as any).images || [],
                isActive: (formData as any).isActive !== false,
                // 🆕 Ürün Attributeleri
                isProcessed: (formData as any).isProcessed || false,
                isPackaged: (formData as any).isPackaged || false,
                isLoose: (formData as any).isLoose || false,  // Açık/Lose Ware
                isOrganic: (formData as any).isOrganic || false,
                // 🧪 Alerjenler & Katkı Maddeleri
                allergens: (formData as any).allergens || [],
                additives: (formData as any).additives || [],
                allergensConfirmed: (formData as any).allergensConfirmed || false,
                additivesConfirmed: (formData as any).additivesConfirmed || false,
                // ERP Fields
                barcode: (formData as any).barcode || null,
                productType: (formData as any).productType || 'fresh',
                supplierName: (formData as any).supplierName || null,
                batchNumber: (formData as any).batchNumber || null,
                purchasePrice: (formData as any).purchasePrice || null,
                sellingPrice: (formData as any).sellingPrice || null,
                appSellingPrice: (formData as any).appSellingPrice || null,
                inStorePrice: (formData as any).inStorePrice || null,
                productionDate: (formData as any).productionDate || null,
                expirationDate: (formData as any).expirationDate || null,
                imageAsset: (formData as any).imageAsset || null,
                imageUrl: (formData as any).imageAsset || (formData as any).imageUrl || ((formData as any).images || [])[0] || null, // 🆕 Mobile app reads 'imageUrl' field
                // Stock Management (Stok Yönetimi)
                currentStock: (formData as any).currentStock || 0,
                minStock: (formData as any).minStock || 0, // Minimum stok seviyesi
                reorderPoint: (formData as any).reorderPoint || 0, // Yeniden sipariş noktası
                stockUnit: (formData as any).stockUnit || 'kg', // Stok birimi
                stockLocation: (formData as any).stockLocation || '', // Depo/Raf konumu
                lastStockUpdate: new Date().toISOString(),
                // 🎛️ Ürün Seçenekleri (Lieferando-style Option Groups)
                optionGroups: (formData as any).optionGroups || [],
                // 🆕 Besin Değerleri (EU LMIV Nutrition per 100g)
                nutritionPer100g: (formData as any).nutritionPer100g || null,
                // 🆕 ERP Extended Fields
                originCountry: (formData as any).originCountry || null,
                chargeNumber: (formData as any).chargeNumber || null,
                internalNotes: (formData as any).internalNotes || null,
                tags: (formData as any).tags || [],
                // 🆕 Stok Durumu
                outOfStock: (formData as any).outOfStock || false,
                // 🆕 Audit Trail
                taxRate: (formData as any).taxRate ?? 7,
                createdAt: editingProduct ? ((formData as any).createdAt || new Date().toISOString()) : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastModifiedBy: auth.currentUser?.email || 'unknown',
            };

            await setDoc(productRef, productData, { merge: true });

            // 🆕 If in business context, ALSO update the business product subcollection
            if (isBusinessContext && contextBusinessId) {
                try {
                    const businessProductRef = doc(db, `businesses/${contextBusinessId}/products`, productId);
                    await setDoc(businessProductRef, productData, { merge: true });
                } catch (bizErr) {
                    console.warn('Business product update failed (may not exist in subcollection):', bizErr);
                }
            }

            setShowModal(false);
            setEditingProduct(null);
            setProductEditTab('general');
            setFormData({ id: "", name: { tr: "" }, category: "dana", defaultUnit: "kg", description: { tr: "" } });
            fetchProducts();
            // Also refresh business products if in business context
            if (isBusinessContext) {
                fetchBusinessProducts();
            }
        } catch (error: any) {
            console.error("Error saving product:", error);
            alert(`${t('urunKaydedilirkenHataOlustu')} ${error?.message || 'Bilinmeyen hata'}`);
        }
    };

    // Delete
    const handleDelete = (id: string) => {
        const product = products.find(p => p.id === id);
        setConfirmModal({
            isOpen: true,
            title: t('urunSil'),
            message: t('buUrunuSilmekIstediginizeEminMisiniz'),
            itemName: getLocalizedText(product?.name),
            variant: 'danger',
            confirmText: 'Evet, Sil',
            loadingText: 'Siliniyor...',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, "master_products", id));
                    fetchProducts();
                } catch (error) {
                    console.error("Error deleting product:", error);
                    alert(t('urunSilinirkenHataOlustu'));
                }
            },
        });
    };

    // Bulk Actions
    const toggleSelectAll = () => {
        if (selectedProducts.size === paginatedProducts.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(paginatedProducts.map(p => p.id)));
        }
    };

    const toggleSelectProduct = (id: string) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedProducts(newSelected);
    };

    const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
        if (selectedProducts.size === 0) {
            alert(t('lutfenIslemYapilacakUrunleriSecin'));
            return;
        }

        const actionLabels = {
            activate: 'aktif',
            deactivate: 'deaktif',
            delete: 'silmek'
        };

        const count = selectedProducts.size;
        setConfirmModal({
            isOpen: true,
            title: t('topluIslem'),
            message: `${t('secili')} ${count} ${t('urunu')} ${actionLabels[action]} ${t('yapmakIstediginizeEminMisiniz')}`,
            variant: action === 'delete' ? 'danger' : 'warning',
            confirmText: `Evet, ${actionLabels[action]} Yap`,
            loadingText: t('isleniyor'),
            onConfirm: async () => {
                setIsProcessingBulk(true);
                try {
                    const batch = writeBatch(db);

                    selectedProducts.forEach(id => {
                        const productRef = doc(db, "master_products", id);
                        if (action === 'delete') {
                            batch.delete(productRef);
                        } else {
                            batch.update(productRef, { isActive: action === 'activate' });
                        }
                    });

                    await batch.commit();
                    setSelectedProducts(new Set());
                    fetchProducts();
                    alert(`${count} ${t('urunBasariyla')} ${actionLabels[action]} ${t('yapildi')}`);
                } catch (error) {
                    console.error("Bulk action error:", error);
                    alert(t('topluIslemSirasindaHataOlustu'));
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // 🆕 Bulk Assign Business Types
    const handleBulkAssignBusinessType = (businessType: string) => {
        if (selectedProducts.size === 0) {
            alert(t('lutfenIslemYapilacakUrunleriSecin'));
            return;
        }

        const typeLabel = BUSINESS_TYPE_OPTIONS.find(bt => bt.value === businessType)?.label || businessType;
        const count = selectedProducts.size;
        setConfirmModal({
            isOpen: true,
            title: t('isletmeTuruAta'),
            message: `${t('secili')} ${count} ${t('urune')}${typeLabel}${t('isletmeTuruEklensinMi')}`,
            variant: 'warning',
            confirmText: 'Evet, Ekle',
            loadingText: 'Ekleniyor...',
            onConfirm: async () => {
                setIsProcessingBulk(true);
                try {
                    const batch = writeBatch(db);

                    for (const productId of selectedProducts) {
                        const product = products.find(p => p.id === productId);
                        const currentTypes = product?.allowedBusinessTypes || [];
                        if (!currentTypes.includes(businessType)) {
                            const productRef = doc(db, "master_products", productId);
                            batch.update(productRef, {
                                allowedBusinessTypes: [...currentTypes, businessType]
                            });
                        }
                    }

                    await batch.commit();
                    setSelectedProducts(new Set());
                    fetchProducts();
                    alert(`${count} ${t('urune')}${typeLabel}${t('turuBasariylaEklendi')}`);
                } catch (error) {
                    console.error("Bulk assign error:", error);
                    alert(t('topluAtamaSirasindaHataOlustu'));
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // 🆕 Bu İşletmeye Ata: Copy selected master products to business products subcollection
    const handleAssignToThisBusiness = () => {
        if (!isBusinessContext || !contextBusinessId || selectedProducts.size === 0) {
            alert('Lütfen işletmeye atamak istediğiniz ürünleri seçin.');
            return;
        }

        const count = selectedProducts.size;
        setConfirmModal({
            isOpen: true,
            title: '📥 Bu İşletmeye Ata',
            message: `Seçili ${count} ürün bu işletmenin menüsüne eklensin mi?\n\nÜrünler aktif olarak eklenecek ve mobil uygulamada görünecektir.`,
            variant: 'warning',
            confirmText: 'Evet, Ekle',
            loadingText: 'Ekleniyor...',
            onConfirm: async () => {
                setIsProcessingBulk(true);
                try {
                    const batch = writeBatch(db);
                    let addedCount = 0;

                    for (const productId of selectedProducts) {
                        const product = products.find(p => p.id === productId);
                        if (!product) continue;

                        const businessProductRef = doc(db, `businesses/${contextBusinessId}/products`, productId);

                        // Copy essential product data to business subcollection
                        batch.set(businessProductRef, {
                            masterProductId: productId,
                            name: product.name,
                            description: (product as any).description || { tr: '' },
                            category: product.category || 'diger',
                            categories: product.categories || [product.category || 'diger'],
                            defaultUnit: product.defaultUnit || 'kg',
                            price: (product as any).price || 0,
                            isActive: true,
                            isAvailable: true,
                            brandLabels: (product as any).brandLabels || [],
                            imageUrl: (product as any).imageUrl || '',
                            optionGroups: (product as any).optionGroups || [],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        }, { merge: true });

                        addedCount++;
                    }

                    await batch.commit();
                    setSelectedProducts(new Set());
                    fetchBusinessProducts();
                    alert(`✅ ${addedCount} ürün başarıyla bu işletmeye eklendi!`);
                } catch (error) {
                    console.error("Assign to business error:", error);
                    alert('İşletmeye atama sırasında hata oluştu!');
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // 🆕 Toplu Kategori Değiştir: Change category of selected products in business subcollection
    const handleBulkChangeCategory = (newCategoryName: string) => {
        if (!isBusinessContext || !contextBusinessId || selectedProducts.size === 0) {
            alert('Lütfen kategori değiştirilecek ürünleri seçin.');
            return;
        }

        const count = selectedProducts.size;
        setConfirmModal({
            isOpen: true,
            title: '📂 Kategori Değiştir',
            message: `Seçili ${count} ürünün kategorisi "${newCategoryName}" olarak değiştirilsin mi?`,
            variant: 'warning',
            confirmText: 'Evet, Değiştir',
            loadingText: 'Değiştiriliyor...',
            onConfirm: async () => {
                setIsProcessingBulk(true);
                try {
                    const batch = writeBatch(db);
                    let updatedCount = 0;

                    for (const productId of selectedProducts) {
                        const businessProductRef = doc(db, `businesses/${contextBusinessId}/products`, productId);
                        batch.update(businessProductRef, {
                            category: newCategoryName,
                            categories: [newCategoryName],
                            updatedAt: new Date().toISOString(),
                        });
                        updatedCount++;
                    }

                    await batch.commit();
                    setSelectedProducts(new Set());
                    fetchBusinessProducts();
                    alert(`✅ ${updatedCount} ürünün kategorisi "${newCategoryName}" olarak değiştirildi!`);
                } catch (error) {
                    console.error("Bulk category change error:", error);
                    alert('Kategori değiştirme sırasında hata oluştu!');
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // 🔴 Bulk Assign Brand Labels (TUNA / Akdeniz Toros)
    const handleBulkAssignBrand = (brandValue: string) => {
        if (selectedProducts.size === 0) {
            alert(t('lutfenIslemYapilacakUrunleriSecin'));
            return;
        }

        const brand = BRAND_LABELS.find(b => b.value === brandValue);
        const brandLabel = brand?.label || brandValue;
        const count = selectedProducts.size;

        if (brandValue === 'remove') {
            setConfirmModal({
                isOpen: true,
                title: t('markaEtiketleriniKaldir'),
                message: `${t('secili')} ${count} ${t('urundenMarkaEtiketleriKaldirilsinMi')}`,
                variant: 'warning',
                confirmText: t('evetKaldir'),
                loadingText: t('kaldiriliyor'),
                onConfirm: async () => {
                    setIsProcessingBulk(true);
                    try {
                        const batch = writeBatch(db);
                        selectedProducts.forEach(productId => {
                            const productRef = doc(db, "master_products", productId);
                            batch.update(productRef, { brandLabels: [] });
                        });
                        await batch.commit();
                        setSelectedProducts(new Set());
                        fetchProducts();
                        alert(`${count} ${t('urundenMarkaEtiketleriKaldirildi')}`);
                    } catch (error) {
                        console.error("Bulk remove brand error:", error);
                        alert(t('topluIslemSirasindaHataOlustu'));
                    } finally {
                        setIsProcessingBulk(false);
                    }
                },
            });
            return;
        }

        // Add brand label to selected products
        setConfirmModal({
            isOpen: true,
            title: 'Marka Etiketi Ekle',
            message: `${t('secili')} ${count} ${t('urune')}${brandLabel}" marka etiketi eklensin mi?`,
            variant: 'warning',
            confirmText: 'Evet, Ekle',
            loadingText: 'Ekleniyor...',
            onConfirm: async () => {
                setIsProcessingBulk(true);
                try {
                    const batch = writeBatch(db);

                    for (const productId of selectedProducts) {
                        const product = products.find(p => p.id === productId);
                        const currentLabels = (product as any)?.brandLabels || [];
                        if (!currentLabels.includes(brandValue)) {
                            const productRef = doc(db, "master_products", productId);
                            batch.update(productRef, {
                                brandLabels: [...currentLabels, brandValue]
                            });
                        }
                    }

                    await batch.commit();
                    setSelectedProducts(new Set());
                    fetchProducts();
                    alert(`${count} ${t('urune')}${brandLabel}${t('etiketiBasariylaEklendi')}`);
                } catch (error) {
                    console.error("Bulk assign brand error:", error);
                    alert(t('topluMarkaAtamaSirasindaHataOlustu'));
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // Image Upload Handler
    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const maxImages = 5;
        const currentImages = formData.images || [];
        const remainingSlots = maxImages - currentImages.length;

        if (remainingSlots <= 0) {
            alert(t('maksimum5GorselEkleyebilirsiniz'));
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);
        setUploadingImages(true);

        try {
            const uploadPromises = filesToUpload.map(async (file) => {
                const fileName = `products/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, fileName);
                await uploadBytes(storageRef, file);
                return getDownloadURL(storageRef);
            });

            const newUrls = await Promise.all(uploadPromises);
            setFormData({ ...formData, images: [...currentImages, ...newUrls] });
        } catch (error) {
            console.error("Image upload error:", error);
            alert(t('gorselYuklenirkenHataOlustu'));
        } finally {
            setUploadingImages(false);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...(formData.images || [])];
        newImages.splice(index, 1);
        setFormData({ ...formData, images: newImages });
    };

    // Toggle category in multi-select
    const toggleCategory = (categoryValue: string) => {
        const currentCategories = formData.categories || [];
        if (currentCategories.includes(categoryValue)) {
            setFormData({ ...formData, categories: currentCategories.filter(c => c !== categoryValue) });
        } else {
            setFormData({ ...formData, categories: [...currentCategories, categoryValue] });
        }
    };

    // Open Edit Modal
    const openEdit = (product: ExtendedProduct) => {
        setEditingProduct(product);
        setValidationErrors({});
        const resolvedUnit = (product as any).defaultUnit || (product as any).unit || 'adet';
        setFormData({
            ...product,
            categories: product.categories || [product.category],
            images: product.images || [],
            brand: product.brand || '',
            isActive: product.isActive !== false,
            defaultUnit: resolvedUnit,
            brandLabels: (product as any).brandLabels || [],
            optionGroups: (product as any).optionGroups || []
        } as any);
        setShowModal(true);
    };

    // Open Add Modal
    const openAdd = () => {
        setEditingProduct(null);
        setValidationErrors({});
        setFormData({
            id: `LK-${Date.now()}`,
            name: "",
            category: "dana",
            categories: [],
            defaultUnit: "kg",
            description: "",
            brand: "",
            brandLabels: [],
            images: [],
            isActive: true,
            optionGroups: []
        } as any);
        setShowModal(true);
    };

    const categoryColors: Record<string, string> = {
        dana: "bg-red-900/40 text-red-200 border-red-700",
        kuzu: "bg-green-900/40 text-green-200 border-green-700",
        tavuk: "bg-amber-900/40 text-amber-200 border-amber-700",
        hazir: "bg-purple-900/40 text-purple-200 border-purple-700",
        diger: "bg-gray-700 text-gray-200 border-gray-600"
    };

    // Filter products with Turkish normalization
    const normalizedQuery = normalizeTurkish(searchQuery);
    const filteredProducts = products.filter(p => {
        const nameStr = getLocalizedText(p.name);
        const descStr = getLocalizedText(p.description);
        const matchesSearch = normalizedQuery === '' ||
            normalizeTurkish(nameStr).includes(normalizedQuery) ||
            normalizeTurkish(p.id).includes(normalizedQuery) ||
            (descStr && normalizeTurkish(descStr).includes(normalizedQuery));
        const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
        // Yeni filtre: Toptan Kaynak
        const matchesWholesaler = wholesalerFilter === 'all' ||
            (p as any).sourcePlatform === wholesalerFilter ||
            (wholesalerFilter === 'manual' && !(p as any).sourcePlatform);
        // Yeni filtre: Ülke
        const matchesCountry = countryFilter === 'all' ||
            (p as any).countryOfOrigin === countryFilter ||
            (countryFilter === 'other' && !(p as any).countryOfOrigin);
        // Yeni filtre: Marka (TUNA / Akdeniz Toros)
        const matchesBrand = brandFilter === 'all' ||
            ((p as any).brandLabels || []).includes(brandFilter);
        return matchesSearch && matchesCategory && matchesWholesaler && matchesCountry && matchesBrand;
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const paginatedProducts = searchQuery
        ? filteredProducts // Show all when searching
        : filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [categoryFilter, wholesalerFilter, countryFilter, brandFilter, searchQuery]);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
            <div className="max-w-7xl mx-auto">

                {/* Header - Context Aware */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                            {isBusinessContext ? (
                                <Link href="/admin/business" className="hover:text-white transition-colors">{t('isletmeListesi')}</Link>
                            ) : (
                                <Link href="/admin/dashboard" className="hover:text-white transition-colors">← Dashboard</Link>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            {isBusinessContext ? (
                                <>
                                    🏪 {businessInfo?.companyName || t('isletme')} {t('urunler')}
                                </>
                            ) : (
                                <>{t('masterUrunKatalogu')}</>
                            )}
                        </h1>
                        <p className="text-gray-400 mt-1">
                            {isBusinessContext
                                ? `${businessInfo?.companyName || t('buIsletme')} ${t('icinUrunYonetimi')}`
                                : t('tumIsletmelerdeGecerliOlanGenelUrun')}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {!isBusinessContext && isSuperAdmin && (
                            <button
                                onClick={handleSeed}
                                disabled={seeding}
                                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                            >
                                {seeding ? "Ekleniyor..." : t('varsayilanlariYukleSeed')}
                            </button>
                        )}
                        <button
                            onClick={openAdd}
                            className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white font-bold transition-colors flex items-center gap-2"
                        >
                            <span>+</span> {t('yeniUrun')} {isBusinessContext ? 'Ekle' : t('tanimla')}
                        </button>
                    </div>
                </div>

                {/* 🆕 MOD SEÇİMİ - ÜRÜNLER / KERMES MENÜ - Only show Kermes for Kermes businesses or Super Admin global view */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setPageMode('products')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${pageMode === 'products'
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {t('masterUrunler')}
                    </button>
                    {/* Kermes button: Only show if Super Admin without business context OR business type is kermes */}
                    {((!isBusinessContext && isSuperAdmin) || businessInfo?.type === 'kermes') && (
                        <button
                            onClick={() => setPageMode('kermes')}
                            className={`px-6 py-3 rounded-xl font-medium transition-all ${pageMode === 'kermes'
                                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {t('kermesMenuOlustur')}
                            {!isBusinessContext && (
                                <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                                    SUPER ADMIN
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* 🆕 KERMES MODU */}
                {pageMode === 'kermes' ? (
                    <div className="bg-gray-800 rounded-xl border border-pink-500/30 p-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            {t('kermesMenuOlusturma')}
                            <span className="text-sm font-normal text-pink-300">
                                {t('belirliBirOrganizasyonIcinOzelMenu')}
                            </span>
                        </h2>

                        {/* Organizasyon Seçimi */}
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">
                                {t('organizasyonSecinKermesYapilacakCamidernek')}
                            </label>
                            {selectedOrganization ? (
                                <div className="flex items-center gap-3 p-4 bg-pink-900/30 border border-pink-500 rounded-xl">
                                    <div className="text-3xl">🕌</div>
                                    <div className="flex-1">
                                        <p className="text-white font-bold">{selectedOrganization.shortName || selectedOrganization.name}</p>
                                        <p className="text-gray-400 text-sm">📍 {selectedOrganization.city} • {selectedOrganization.postalCode}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedOrganization(null);
                                            setKermesMenuProducts([]);
                                        }}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                    >
                                        {t('degistir')}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {/* Arama */}
                                    <input
                                        type="text"
                                        value={kermesOrgSearch}
                                        onChange={(e) => setKermesOrgSearch(e.target.value)}
                                        placeholder={t('camiAdiSehirVeyaPostaKodu')}
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-pink-500 mb-3"
                                    />
                                    {/* Liste */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                                        {loadingOrganizations ? (
                                            <div className="col-span-full text-center py-8 text-gray-400">
                                                {t('organizasyonlarYukleniyor')}
                                            </div>
                                        ) : (
                                            organizations
                                                .filter(o => {
                                                    const search = kermesOrgSearch.toLowerCase();
                                                    return !search ||
                                                        o.name?.toLowerCase().includes(search) ||
                                                        o.shortName?.toLowerCase().includes(search) ||
                                                        o.city?.toLowerCase().includes(search) ||
                                                        o.postalCode?.includes(search); // 🆕 Posta kodu
                                                })
                                                .slice(0, 12)
                                                .map(org => (
                                                    <button
                                                        key={org.id}
                                                        onClick={() => {
                                                            setSelectedOrganization(org);
                                                            setKermesOrgSearch('');
                                                        }}
                                                        className="p-3 bg-gray-700 hover:bg-pink-900/30 border border-gray-600 hover:border-pink-500 rounded-xl text-left transition-all"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">🕌</span>
                                                            <div>
                                                                <p className="text-white font-medium text-sm">{org.shortName || org.name}</p>
                                                                <p className="text-gray-400 text-xs">📍 {org.city}</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                        )}
                                    </div>
                                    {organizations.length === 0 && !loadingOrganizations && (
                                        <div className="text-center py-8 text-gray-500">
                                            <p className="text-3xl mb-2">🕌</p>
                                            <p>{t('henuzOrganizasyonYok')}</p>
                                            <p className="text-sm">{t('ilkOnceIsletmeYonetimiKermesBolumunden')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Kermes Ürünleri Seçimi */}
                        {selectedOrganization && (
                            <div>
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    {t('kermesMenusuHazirla')}
                                    <span className="text-sm font-normal text-gray-400">
                                        {t('mevcutKermesUrunlerindenSecinVeyaYeni')}
                                    </span>
                                </h3>

                                {/* Mevcut Kermes Ürünleri */}
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                                    {kermesProducts.length === 0 ? (
                                        <div className="col-span-full text-center py-8 bg-gray-700/50 rounded-xl">
                                            <p className="text-2xl mb-2">🍲</p>
                                            <p className="text-gray-400">{t('henuzKermesUrunuYok')}</p>
                                            <button
                                                onClick={() => {
                                                    setPageMode('products');
                                                    setCategoryFilter('kermes_yemek');
                                                }}
                                                className="mt-3 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500"
                                            >
                                                {t('kermesUrunuEkle')}
                                            </button>
                                        </div>
                                    ) : (
                                        kermesProducts.map(product => {
                                            const isSelected = kermesMenuProducts.some(p => p.id === product.id);
                                            return (
                                                <button
                                                    key={product.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setKermesMenuProducts(prev => prev.filter(p => p.id !== product.id));
                                                        } else {
                                                            setKermesMenuProducts(prev => [...prev, product]);
                                                        }
                                                    }}
                                                    className={`p-3 rounded-xl border transition-all text-left ${isSelected
                                                        ? 'bg-pink-900/50 border-pink-500 ring-2 ring-pink-500'
                                                        : 'bg-gray-700 border-gray-600 hover:border-pink-400'
                                                        }`}
                                                >
                                                    <p className="text-white text-sm font-medium line-clamp-2">{getLocalizedText(product.name)}</p>
                                                    <p className="text-gray-400 text-xs mt-1">
                                                        {product.defaultUnit === 'adet' ? '🔢' : '⚖️'} {product.defaultUnit}
                                                    </p>
                                                    {isSelected && (
                                                        <span className="inline-block mt-2 px-2 py-0.5 bg-pink-600 text-white text-xs rounded-full">
                                                            {t('secildi')}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Seçili Ürünler Özeti */}
                                {kermesMenuProducts.length > 0 && (
                                    <div className="bg-pink-900/30 border border-pink-500/50 rounded-xl p-4 mt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-white font-bold">
                                                🎪 {selectedOrganization.shortName || selectedOrganization.name} {t('kermesMenusu')}
                                            </h4>
                                            <span className="px-3 py-1 bg-pink-600 text-white rounded-full text-sm">
                                                {kermesMenuProducts.length} {t('urun')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {kermesMenuProducts.map(product => (
                                                <span
                                                    key={product.id}
                                                    className="px-3 py-1.5 bg-pink-800/50 text-pink-200 rounded-lg text-sm flex items-center gap-2"
                                                >
                                                    {getLocalizedText(product.name)}
                                                    <button
                                                        onClick={() => setKermesMenuProducts(prev => prev.filter(p => p.id !== product.id))}
                                                        className="text-pink-400 hover:text-white"
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setSavingKermesMenu(true);
                                                try {
                                                    // Organizasyona kermes menüsü kaydet
                                                    const menuData = {
                                                        organizationId: selectedOrganization.id,
                                                        organizationName: selectedOrganization.shortName || selectedOrganization.name,
                                                        products: kermesMenuProducts.map(p => ({
                                                            id: p.id,
                                                            name: getLocalizedText(p.name),
                                                            category: p.category,
                                                            defaultUnit: p.defaultUnit,
                                                        })),
                                                        createdAt: new Date(),
                                                        updatedAt: new Date(),
                                                    };
                                                    await setDoc(doc(db, 'kermes_menus', selectedOrganization.id), menuData);
                                                    alert(t('kermesMenusuBasariylaKaydedildi'));
                                                } catch (error) {
                                                    console.error('Error saving kermes menu:', error);
                                                    alert(t('menuKaydedilirkenHataOlustu'));
                                                } finally {
                                                    setSavingKermesMenu(false);
                                                }
                                            }}
                                            disabled={savingKermesMenu}
                                            className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-bold hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 transition-all"
                                        >
                                            {savingKermesMenu ? '⏳ Kaydediliyor...' : t('kermesMenusunuKaydet')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* NORMAL ÜRÜN LİSTESİ MODU */
                    <>
                        {/* 🆕 BUSINESS CONTEXT: Dual-Tab Kategoriler & Ürünler */}
                        {isBusinessContext && (
                            <div className="bg-gray-800 rounded-xl p-5 mb-6 border border-cyan-500/30">
                                {/* Section Header with Title + View Mode Toggle */}
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        {t('menuUrunler')}
                                        <span className="text-sm font-normal text-gray-400">
                                            — {businessInfo?.companyName || t('isletme')}
                                        </span>
                                    </h2>
                                    <button
                                        onClick={fetchBusinessProducts}
                                        className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm"
                                    >
                                        🔄 Yenile
                                    </button>
                                </div>

                                {/* Kategoriler / Ürünler Tab Toggle */}
                                <div className="flex items-center gap-2 mb-5">
                                    <button
                                        onClick={() => setBusinessViewMode('categories')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${businessViewMode === 'categories'
                                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/40'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                            }`}
                                    >
                                        🗂️ Kategoriler ({businessCategories.length})
                                    </button>
                                    <button
                                        onClick={() => setBusinessViewMode('products')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${businessViewMode === 'products'
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                            }`}
                                    >
                                        {t('urunler1')}{businessProducts.length})
                                    </button>
                                    <button
                                        onClick={() => setBusinessViewMode('sponsored')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${businessViewMode === 'sponsored'
                                            ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                            }`}
                                    >
                                        ⭐ Öne Çıkan ({sponsoredProducts.length})
                                    </button>
                                </div>

                                {/* ═══════════════════════════════════════════ */}
                                {/* CATEGORIES VIEW                            */}
                                {/* ═══════════════════════════════════════════ */}
                                {businessViewMode === 'categories' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="text-gray-400 text-sm">
                                                {t('kategorileriSiralayinDuzenleyinVeyaYeniEkleyin')}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {businessInfo?.type === 'kasap' && (
                                                    <button
                                                        onClick={() => {
                                                            if (businessCategories.length > 0) {
                                                                if (confirm(`Mevcut ${businessCategories.length} kategori silinip 5 şablon kategorisi yüklenecek. Devam?`)) {
                                                                    applyCategoryTemplate();
                                                                }
                                                            } else {
                                                                applyCategoryTemplate();
                                                            }
                                                        }}
                                                        disabled={applyingCategoryTemplate}
                                                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                                                    >
                                                        {applyingCategoryTemplate ? '⏳ Yükleniyor...' : '📂 Kategori Şablonu Yükle'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={openCategoryAdd}
                                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-all"
                                                >
                                                    + Yeni Kategori
                                                </button>
                                            </div>
                                        </div>

                                        {loadingBusinessCategories ? (
                                            <div className="text-center py-8 text-gray-400">{t('kategorilerYukleniyor')}</div>
                                        ) : businessCategories.length === 0 ? (
                                            <div className="text-center py-12 bg-gray-700/30 rounded-xl border border-dashed border-gray-600">
                                                <p className="text-4xl mb-3">🗂️</p>
                                                <p className="text-gray-300 font-medium mb-1">{t('henuzKategoriEklenmemis')}</p>
                                                <p className="text-sm text-gray-500 mb-4">{t('urunleriniziDuzenlemekIcinKategoriEkleyin')}</p>
                                                <button
                                                    onClick={openCategoryAdd}
                                                    className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition font-medium"
                                                >
                                                    {t('ilkKategoriyiEkle')}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {businessCategories.map((cat, index) => {
                                                    const productCount = businessProducts.filter((p: any) => {
                                                        const cats = p.categories || [p.category];
                                                        return cats.some((c: string) => c?.toLowerCase() === getLocalizedText(cat.name).toLowerCase());
                                                    }).length;
                                                    return (
                                                        <div
                                                            key={cat.id}
                                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${cat.isActive
                                                                ? 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                                                                : 'bg-gray-800/50 border-red-900/40 opacity-60'
                                                                }`}
                                                        >
                                                            {/* Up/Down Arrows */}
                                                            <div className="flex flex-col gap-0.5">
                                                                <button
                                                                    onClick={() => handleCategoryMove(index, 'up')}
                                                                    disabled={index === 0}
                                                                    className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition text-xs px-1"
                                                                    title={t('yukariTasi')}
                                                                >▲</button>
                                                                <span className="text-[10px] text-gray-600 text-center">{index + 1}</span>
                                                                <button
                                                                    onClick={() => handleCategoryMove(index, 'down')}
                                                                    disabled={index === businessCategories.length - 1}
                                                                    className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition text-xs px-1"
                                                                    title={t('asagiTasi')}
                                                                >▼</button>
                                                            </div>

                                                            {/* Icon */}
                                                            <span className="text-3xl">{cat.icon}</span>

                                                            {/* Name + Meta */}
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-white font-bold text-base">{getLocalizedText(cat.name)}</h3>
                                                                <p className="text-gray-500 text-xs">
                                                                    {productCount} {t('urun1')} {cat.isActive ? '✅ Aktif' : '🔴 Pasif'}
                                                                </p>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => openCategoryEdit(cat)}
                                                                    className="p-2 bg-yellow-600/80 hover:bg-yellow-500 rounded-lg transition text-white text-sm"
                                                                    title={t('duzenle')}
                                                                >✏️</button>
                                                                <button
                                                                    onClick={() => handleCategoryDelete(cat)}
                                                                    className="p-2 bg-red-600/80 hover:bg-red-500 rounded-lg transition text-white text-sm"
                                                                    title="Sil"
                                                                >🗑️</button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ═══════════════════════════════════════════ */}
                                {/* PRODUCTS VIEW                              */}
                                {/* ═══════════════════════════════════════════ */}
                                {businessViewMode === 'products' && (
                                    <div>
                                        {/* Ürün Şablonu Yükle Button */}
                                        {businessInfo?.type === 'kasap' && (
                                            <div className="flex items-center justify-end mb-4">
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Kasap ürün şablonu yüklenecek. Mevcut ürünlerin üstüne eklenecektir. Devam?')) {
                                                            applyProductTemplate();
                                                        }
                                                    }}
                                                    disabled={applyingProductTemplate}
                                                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                                                >
                                                    {applyingProductTemplate ? '⏳ Yükleniyor...' : '📦 Ürün Şablonu Yükle'}
                                                </button>
                                            </div>
                                        )}
                                        {/* Category Filter Tabs */}
                                        {activeBusinessCategories.length > 0 && (
                                            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600">
                                                <button
                                                    onClick={() => setActiveCategoryTab('all')}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategoryTab === 'all'
                                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                                                        }`}
                                                >
                                                    {t('tumu')}
                                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeCategoryTab === 'all' ? 'bg-emerald-500/50' : 'bg-gray-600'
                                                        }`}>{businessProducts.length}</span>
                                                </button>
                                                {activeBusinessCategories.map(cat => {
                                                    const count = businessProducts.filter((p: any) => {
                                                        const cats = p.categories || [p.category];
                                                        return cats.some((c: string) => c?.toLowerCase() === getLocalizedText(cat.name).toLowerCase());
                                                    }).length;
                                                    return (
                                                        <button
                                                            key={cat.id}
                                                            onClick={() => setActiveCategoryTab(cat.id)}
                                                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategoryTab === cat.id
                                                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                                                                }`}
                                                        >
                                                            {cat.icon} {getLocalizedText(cat.name)}
                                                            {count > 0 && (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeCategoryTab === cat.id ? 'bg-emerald-500/50' : 'bg-gray-600'
                                                                    }`}>{count}</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                                <button
                                                    onClick={() => setActiveCategoryTab('uncategorized')}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategoryTab === 'uncategorized'
                                                        ? 'bg-gray-600 text-white shadow-lg'
                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                                                        }`}
                                                >
                                                    ❓ Kategorisiz
                                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeCategoryTab === 'uncategorized' ? 'bg-gray-500/50' : 'bg-gray-600'
                                                        }`}>
                                                        {businessProducts.filter((p: any) => {
                                                            const cats = p.categories || [p.category];
                                                            return !cats.some((c: string) =>
                                                                activeBusinessCategories.some(bc => getLocalizedText(bc.name).toLowerCase() === c?.toLowerCase())
                                                            );
                                                        }).length}
                                                    </span>
                                                </button>
                                            </div>
                                        )}

                                        {/* 🆕 Status Filter Dropdown */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <label className="text-gray-400 text-xs font-medium">Durum Filtresi:</label>
                                            <select
                                                value={bizStatusFilter}
                                                onChange={(e) => { setBizStatusFilter(e.target.value); setBusinessProductPage(1); }}
                                                className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none cursor-pointer"
                                            >
                                                {[
                                                    { key: 'all', label: `📦 Tümü (${businessProducts.length})` },
                                                    { key: 'active', label: `🟢 Aktif (${businessProducts.filter((p: any) => p.isActive !== false).length})` },
                                                    { key: 'passive', label: `🔴 Pasif (${businessProducts.filter((p: any) => p.isActive === false).length})` },
                                                    { key: 'outOfStock', label: `🚫 Stokta Yok (${businessProducts.filter((p: any) => p.outOfStock === true).length})` },
                                                    { key: 'inStock', label: `✅ Stokta Var (${businessProducts.filter((p: any) => !p.outOfStock).length})` },
                                                    { key: 'discounted', label: `🌟 İndirimde (${businessProducts.filter((p: any) => p.discountedPrice && p.discountedPrice > 0).length})` },
                                                ].map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Product Table */}
                                        {loadingBusinessProducts ? (
                                            <div className="text-center py-8 text-gray-400">{t('urunlerYukleniyor')}</div>
                                        ) : businessProducts.length === 0 ? (
                                            <div className="text-center py-8 bg-gray-700/30 rounded-xl border border-dashed border-gray-600">
                                                <p className="text-3xl mb-2">📭</p>
                                                <p className="text-gray-400 mb-2">{t('buIsletmeyeHenuzUrunAtanmamis')}</p>
                                                <p className="text-sm text-gray-500">{t('asagidanMasterKatalogdanUrunEkleyebilirsiniz')}</p>
                                            </div>
                                        ) : (() => {
                                            // Filter products by category
                                            const filteredBizProducts = businessProducts.filter((product: any) => {
                                                // Status filter
                                                if (bizStatusFilter === 'active' && product.isActive === false) return false;
                                                if (bizStatusFilter === 'passive' && product.isActive !== false) return false;
                                                if (bizStatusFilter === 'outOfStock' && !product.outOfStock) return false;
                                                if (bizStatusFilter === 'inStock' && product.outOfStock) return false;
                                                if (bizStatusFilter === 'discounted' && !(product.discountedPrice && product.discountedPrice > 0)) return false;

                                                // Category filter
                                                if (activeCategoryTab === 'all') return true;
                                                const cats = product.categories || [product.category];
                                                if (activeCategoryTab === 'uncategorized') {
                                                    return !cats.some((c: string) =>
                                                        activeBusinessCategories.some(bc => getLocalizedText(bc.name).toLowerCase() === c?.toLowerCase())
                                                    );
                                                }
                                                const selectedCat = activeBusinessCategories.find(bc => bc.id === activeCategoryTab);
                                                if (!selectedCat) return true;
                                                return cats.some((c: string) => c?.toLowerCase() === getLocalizedText(selectedCat.name).toLowerCase());
                                            });

                                            // Pagination
                                            const totalBizPages = Math.ceil(filteredBizProducts.length / BUSINESS_PRODUCTS_PER_PAGE);
                                            const safeBizPage = Math.min(businessProductPage, totalBizPages || 1);
                                            const paginatedBizProducts = filteredBizProducts.slice(
                                                (safeBizPage - 1) * BUSINESS_PRODUCTS_PER_PAGE,
                                                safeBizPage * BUSINESS_PRODUCTS_PER_PAGE
                                            );
                                            const allPageSelected = paginatedBizProducts.length > 0 && paginatedBizProducts.every((p: any) => selectedBusinessProducts.has(p.id));

                                            return (
                                                <div className="space-y-3">
                                                    {/* 🆕 BULK ACTION BAR */}
                                                    {selectedBusinessProducts.size > 0 && (
                                                        <div className="p-3 bg-gradient-to-r from-cyan-900/40 to-blue-900/30 rounded-xl border border-cyan-500/30 animate-in fade-in">
                                                            {/* Row 1: Count + Actions */}
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-cyan-300 text-sm font-bold mr-1">
                                                                    ✅ {selectedBusinessProducts.size} ürün seçili
                                                                </span>

                                                                {/* Durum (Active/Passive) Dropdown */}
                                                                <select
                                                                    onChange={async (e) => {
                                                                        if (!e.target.value) return;
                                                                        const newActive = e.target.value === 'active';
                                                                        e.target.value = '';
                                                                        const batch = writeBatch(db);
                                                                        selectedBusinessProducts.forEach(id => {
                                                                            batch.update(doc(db, `businesses/${contextBusinessId}/products`, id), { isActive: newActive });
                                                                        });
                                                                        try {
                                                                            await batch.commit();
                                                                            setBusinessProducts(prev => prev.map(p =>
                                                                                selectedBusinessProducts.has(p.id) ? { ...p, isActive: newActive } : p
                                                                            ));
                                                                            setSelectedBusinessProducts(new Set());
                                                                        } catch (err) { console.error(err); }
                                                                    }}
                                                                    className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-green-500 outline-none"
                                                                    defaultValue=""
                                                                >
                                                                    <option value="" disabled>🔘 Durum</option>
                                                                    <option value="active">🟢 Aktif Et</option>
                                                                    <option value="passive">🔴 Pasif Et</option>
                                                                </select>

                                                                {/* Stok Dropdown */}
                                                                <select
                                                                    onChange={async (e) => {
                                                                        if (!e.target.value) return;
                                                                        const newOutOfStock = e.target.value === 'outOfStock';
                                                                        e.target.value = '';
                                                                        const batch = writeBatch(db);
                                                                        selectedBusinessProducts.forEach(id => {
                                                                            batch.update(doc(db, `businesses/${contextBusinessId}/products`, id), { outOfStock: newOutOfStock });
                                                                        });
                                                                        try {
                                                                            await batch.commit();
                                                                            setBusinessProducts(prev => prev.map(p =>
                                                                                selectedBusinessProducts.has(p.id) ? { ...p, outOfStock: newOutOfStock } : p
                                                                            ));
                                                                            setSelectedBusinessProducts(new Set());
                                                                        } catch (err) { console.error(err); }
                                                                    }}
                                                                    className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-orange-500 outline-none"
                                                                    defaultValue=""
                                                                >
                                                                    <option value="" disabled>📦 Stok</option>
                                                                    <option value="inStock">✅ Stokta Var</option>
                                                                    <option value="outOfStock">🚫 Stokta Yok</option>
                                                                </select>

                                                                {/* Sponsored */}
                                                                <button
                                                                    onClick={async () => {
                                                                        const productsWithoutImages: string[] = [];
                                                                        selectedBusinessProducts.forEach(id => {
                                                                            const product = businessProducts.find((p: any) => p.id === id);
                                                                            if (product && (!product.imageUrl || product.imageUrl === '')) {
                                                                                const pName = typeof product.name === 'object' ? (product.name?.tr || product.name?.de || Object.values(product.name)[0] || product.id) : (product.name || product.id);
                                                                                productsWithoutImages.push(pName as string);
                                                                            }
                                                                        });
                                                                        if (productsWithoutImages.length > 0) {
                                                                            alert(`⚠️ Aşağıdaki ürünlerin resmi yok! Öne çıkan ürünlerde resim zorunludur:\n\n${productsWithoutImages.map(n => `• ${n}`).join('\n')}\n\nLütfen önce bu ürünlere resim ekleyin.`);
                                                                            return;
                                                                        }
                                                                        const newSponsored = [...sponsoredProducts];
                                                                        let added = 0;
                                                                        selectedBusinessProducts.forEach(id => {
                                                                            if (!newSponsored.includes(id) && newSponsored.length < sponsoredSettings.maxProductsPerBusiness) {
                                                                                newSponsored.push(id);
                                                                                added++;
                                                                            }
                                                                        });
                                                                        if (added === 0) {
                                                                            alert(`Limit doldu (${sponsoredSettings.maxProductsPerBusiness} max) veya ürünler zaten öne çıkan.`);
                                                                            return;
                                                                        }
                                                                        try {
                                                                            await updateDoc(doc(db, 'businesses', contextBusinessId!), { sponsoredProducts: newSponsored, hasSponsoredProducts: newSponsored.length > 0 });
                                                                            setSponsoredProducts(newSponsored);
                                                                            setSelectedBusinessProducts(new Set());
                                                                            alert(`⭐ ${added} ürün öne çıkan olarak eklendi!`);
                                                                        } catch (err) {
                                                                            console.error('Sponsored update error:', err);
                                                                            alert('Hata oluştu!');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition"
                                                                >
                                                                    ⭐ Öne Çıkan
                                                                </button>

                                                                {/* Kategoriye Taşı */}
                                                                {activeBusinessCategories.length > 0 && (
                                                                    <select
                                                                        onChange={(e) => {
                                                                            if (!e.target.value || selectedBusinessProducts.size === 0) return;
                                                                            const newCategory = e.target.value;
                                                                            const count = selectedBusinessProducts.size;
                                                                            e.target.value = '';
                                                                            setConfirmModal({
                                                                                isOpen: true,
                                                                                title: '📂 Kategori Değiştir',
                                                                                message: `Seçili ${count} ürünün kategorisi "${newCategory}" olarak değiştirilsin mi?`,
                                                                                variant: 'warning',
                                                                                confirmText: 'Evet, Değiştir',
                                                                                loadingText: 'Değiştiriliyor...',
                                                                                onConfirm: async () => {
                                                                                    try {
                                                                                        const batch = writeBatch(db);
                                                                                        selectedBusinessProducts.forEach(id => {
                                                                                            batch.update(doc(db, `businesses/${contextBusinessId}/products`, id), {
                                                                                                category: newCategory,
                                                                                                categories: [newCategory],
                                                                                                updatedAt: new Date().toISOString(),
                                                                                            });
                                                                                        });
                                                                                        await batch.commit();
                                                                                        setBusinessProducts(prev => prev.map(p =>
                                                                                            selectedBusinessProducts.has(p.id)
                                                                                                ? { ...p, category: newCategory, categories: [newCategory] }
                                                                                                : p
                                                                                        ));
                                                                                        setSelectedBusinessProducts(new Set());
                                                                                    } catch (err) {
                                                                                        console.error('Category change error:', err);
                                                                                        throw err;
                                                                                    }
                                                                                },
                                                                            });
                                                                        }}
                                                                        className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-cyan-500 outline-none"
                                                                    >
                                                                        <option value="">📂 Kategoriye Taşı...</option>
                                                                        {activeBusinessCategories.map(cat => (
                                                                            <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                                                                        ))}
                                                                    </select>
                                                                )}

                                                                <div className="flex-1" />

                                                                {/* Sil */}
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!window.confirm(`${selectedBusinessProducts.size} ürünü silmek istediğinize emin misiniz?`)) return;
                                                                        const batch = writeBatch(db);
                                                                        selectedBusinessProducts.forEach(id => {
                                                                            batch.delete(doc(db, `businesses/${contextBusinessId}/products`, id));
                                                                        });
                                                                        try {
                                                                            await batch.commit();
                                                                            setBusinessProducts(prev => prev.filter(p => !selectedBusinessProducts.has(p.id)));
                                                                            setSponsoredProducts(prev => prev.filter(id => !selectedBusinessProducts.has(id)));
                                                                            setSelectedBusinessProducts(new Set());
                                                                        } catch (err) {
                                                                            console.error(err);
                                                                            alert('Silme hatası!');
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition"
                                                                >
                                                                    🗑 Sil
                                                                </button>

                                                                {/* İptal */}
                                                                <button
                                                                    onClick={() => setSelectedBusinessProducts(new Set())}
                                                                    className="px-2.5 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-xs font-medium transition"
                                                                >
                                                                    ✕ İptal
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Product Table */}
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-left text-gray-400 border-b border-gray-700">
                                                                    <th className="py-2 pr-2 w-8">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={allPageSelected}
                                                                            onChange={() => {
                                                                                if (allPageSelected) {
                                                                                    setSelectedBusinessProducts(prev => {
                                                                                        const next = new Set(prev);
                                                                                        paginatedBizProducts.forEach((p: any) => next.delete(p.id));
                                                                                        return next;
                                                                                    });
                                                                                } else {
                                                                                    setSelectedBusinessProducts(prev => {
                                                                                        const next = new Set(prev);
                                                                                        paginatedBizProducts.forEach((p: any) => next.add(p.id));
                                                                                        return next;
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-cyan-500"
                                                                        />
                                                                    </th>
                                                                    <th className="py-2 pr-2">Durum</th>
                                                                    <th className="py-2 pr-2">SKU</th>
                                                                    <th className="py-2 pr-4 min-w-[200px]">{t('urunAdi')}</th>
                                                                    <th className="py-2 pr-2">Kategoriler</th>
                                                                    <th className="py-2 pr-2">Fiyat (Netto / Brutto)</th>
                                                                    <th className="py-2 pr-2">Birim</th>
                                                                    <th className="py-2">{t('islemler')}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {paginatedBizProducts.map((product: any) => {
                                                                    const isSelected = selectedBusinessProducts.has(product.id);
                                                                    const isSponsoredProduct = sponsoredProducts.includes(product.id);
                                                                    return (
                                                                        <tr key={product.id} className={`border-b border-gray-700/50 transition ${isSelected ? 'bg-cyan-900/20' : 'hover:bg-gray-700/30'} ${product.outOfStock ? 'opacity-60' : ''}`}>
                                                                            <td className="py-3 pr-2">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={() => {
                                                                                        setSelectedBusinessProducts(prev => {
                                                                                            const next = new Set(prev);
                                                                                            if (next.has(product.id)) next.delete(product.id);
                                                                                            else next.add(product.id);
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-cyan-500"
                                                                                />
                                                                            </td>
                                                                            <td className="py-3 pr-2">
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        const newStatus = product.isActive === false ? true : false;
                                                                                        try {
                                                                                            await updateDoc(doc(db, `businesses/${contextBusinessId}/products`, product.id), { isActive: newStatus });
                                                                                            setBusinessProducts(prev => prev.map(p =>
                                                                                                p.id === product.id ? { ...p, isActive: newStatus } : p
                                                                                            ));
                                                                                        } catch (err) {
                                                                                            console.error('Toggle error:', err);
                                                                                        }
                                                                                    }}
                                                                                    className={`px-2 py-0.5 rounded text-xs font-medium transition ${product.isActive === false
                                                                                        ? 'bg-red-600/30 text-red-300 hover:bg-red-600/50'
                                                                                        : 'bg-green-600/30 text-green-300 hover:bg-green-600/50'
                                                                                        }`}
                                                                                >
                                                                                    {product.isActive === false ? '🔴 Pasif' : '🟢 Aktif'}
                                                                                </button>
                                                                                {product.outOfStock && (
                                                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-600/30 text-orange-300">🚫 Stokta Yok</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="py-3 pr-2 text-gray-400 font-mono text-xs">
                                                                                {product.id?.substring(0, 15)}...
                                                                            </td>
                                                                            <td className="py-3 pr-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-white font-medium">{getLocalizedText(product.name)}</span>
                                                                                    {isSponsoredProduct && <span className="text-amber-400 text-xs" title="Öne Çıkan">⭐</span>}
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-3 pr-2">
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {(product.categories || [product.category]).filter(Boolean).slice(0, 2).map((cat: string) => {
                                                                                        const categoryConfig = PRODUCT_TYPE_OPTIONS.find(c => c.value === cat);
                                                                                        return (
                                                                                            <span key={cat} className={`px-2 py-0.5 rounded text-xs ${categoryConfig?.color || 'bg-gray-600'} text-white`}>
                                                                                                {categoryConfig?.label || cat}
                                                                                            </span>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-3 pr-2">
                                                                                {(() => {
                                                                                    const nettoPrice = product.sellingPrice || product.price || null;
                                                                                    const taxRate = product.taxRate || 7;
                                                                                    const brutto = nettoPrice ? parseFloat((nettoPrice * (1 + taxRate / 100)).toFixed(2)) : null;
                                                                                    if (!nettoPrice) return <span className="text-gray-500">-</span>;
                                                                                    return (
                                                                                        <div className="space-y-0.5">
                                                                                            <div className="text-green-400 font-medium text-sm">{brutto?.toFixed(2)}€ <span className="text-gray-500 text-[10px] font-normal">brutto</span></div>
                                                                                            <div className="text-gray-400 text-xs">{nettoPrice.toFixed(2)}€ <span className="text-gray-500 text-[10px]">netto</span></div>
                                                                                        </div>
                                                                                    );
                                                                                })()}
                                                                            </td>
                                                                            <td className="py-3 pr-2 text-gray-300">
                                                                                {product.defaultUnit || product.unit || 'adet'}
                                                                            </td>
                                                                            <td className="py-3">
                                                                                <div className="flex gap-2">
                                                                                    <button
                                                                                        onClick={() => openEdit(product)}
                                                                                        className="px-2 py-1 bg-blue-600/30 text-blue-300 rounded hover:bg-blue-600/50 text-xs"
                                                                                    >
                                                                                        {t('duzenle1')}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            const prodNameStr = getLocalizedText(product.name);
                                                                                            if (!window.confirm(`"${prodNameStr}${t('urununuSilmekIstediginizeEminMisiniz')}`)) return;
                                                                                            try {
                                                                                                await deleteDoc(doc(db, `businesses/${contextBusinessId}/products`, product.id));
                                                                                                setBusinessProducts(prev => prev.filter(p => p.id !== product.id));
                                                                                            } catch (err) {
                                                                                                console.error('Delete error:', err);
                                                                                                alert(t('urunSilinirkenHataOlustu'));
                                                                                            }
                                                                                        }}
                                                                                        className="px-2 py-1 bg-red-600/30 text-red-300 rounded hover:bg-red-600/50 text-xs"
                                                                                        title={t('urunuSil')}
                                                                                    >
                                                                                        🗑
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* PAGINATION */}
                                                    {totalBizPages > 1 && (
                                                        <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                                                            <span className="text-gray-400 text-sm">
                                                                {filteredBizProducts.length} üründen {((safeBizPage - 1) * BUSINESS_PRODUCTS_PER_PAGE) + 1}-{Math.min(safeBizPage * BUSINESS_PRODUCTS_PER_PAGE, filteredBizProducts.length)} gösteriliyor
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => setBusinessProductPage(p => Math.max(1, p - 1))}
                                                                    disabled={safeBizPage <= 1}
                                                                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition"
                                                                >
                                                                    ← Önceki
                                                                </button>
                                                                {Array.from({ length: totalBizPages }, (_, i) => i + 1).map(page => (
                                                                    <button
                                                                        key={page}
                                                                        onClick={() => setBusinessProductPage(page)}
                                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${page === safeBizPage
                                                                            ? 'bg-emerald-600 text-white'
                                                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                                            }`}
                                                                    >
                                                                        {page}
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    onClick={() => setBusinessProductPage(p => Math.min(totalBizPages, p + 1))}
                                                                    disabled={safeBizPage >= totalBizPages}
                                                                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition"
                                                                >
                                                                    Sonraki →
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* ═══════════════════════════════════════════ */}
                                {/* SPONSORED PRODUCTS VIEW                     */}
                                {/* ═══════════════════════════════════════════ */}
                                {businessViewMode === 'sponsored' && (
                                    <div className="space-y-4">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">⭐</span>
                                                <div>
                                                    <h4 className="text-white font-bold">Öne Çıkan Ürünler</h4>
                                                    <p className="text-gray-400 text-xs">Müşterilere öne çıkan olarak gösterilecek ürünler</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Limit Progress Bar */}
                                        <div className="bg-gray-700/50 rounded-xl border border-amber-500/30 p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-gray-300 font-medium">
                                                    Sponsored Ürün Kullanımı
                                                </span>
                                                <span className={`text-sm font-bold ${sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness
                                                    ? 'text-red-400'
                                                    : 'text-amber-400'
                                                    }`}>
                                                    {sponsoredProducts.length} / {sponsoredSettings.maxProductsPerBusiness}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-600 rounded-full h-2.5">
                                                <div
                                                    className={`h-2.5 rounded-full transition-all duration-500 ${sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness
                                                        ? 'bg-red-500'
                                                        : sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness * 0.8
                                                            ? 'bg-amber-500'
                                                            : 'bg-emerald-500'
                                                        }`}
                                                    style={{ width: `${Math.min((sponsoredProducts.length / Math.max(sponsoredSettings.maxProductsPerBusiness, 1)) * 100, 100)}%` }}
                                                />
                                            </div>
                                            {sponsoredSettings.feePerConversion > 0 && (
                                                <p className="text-xs text-gray-500 mt-2">
                                                    💰 Dönüşüm başına ücret: {sponsoredSettings.feePerConversion}€
                                                </p>
                                            )}
                                        </div>

                                        {/* Product List with Checkboxes */}
                                        {loadingBusinessProducts ? (
                                            <div className="flex justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                                            </div>
                                        ) : businessProducts.length === 0 ? (
                                            <div className="text-center py-8 bg-gray-700/30 rounded-xl border border-dashed border-gray-600">
                                                <p className="text-3xl mb-2">📦</p>
                                                <p className="text-gray-400 mb-2">Henüz ürün atanmamış</p>
                                                <p className="text-sm text-gray-500">Önce işletmeye ürün atayın, sonra öne çıkan olarak seçin.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {businessProducts.filter((p: any) => p.isActive !== false).map((product: any) => {
                                                    const isSponsored = sponsoredProducts.includes(product.id);
                                                    const limitReached = sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness;
                                                    const disabled = !isSponsored && limitReached;
                                                    return (
                                                        <label
                                                            key={product.id}
                                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${isSponsored
                                                                ? 'bg-amber-900/20 border-amber-500/40 hover:border-amber-400/60'
                                                                : disabled
                                                                    ? 'bg-gray-800/30 border-gray-700/50 opacity-50 cursor-not-allowed'
                                                                    : 'bg-gray-800/40 border-gray-700 hover:border-gray-500'
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSponsored}
                                                                disabled={disabled}
                                                                onChange={() => {
                                                                    if (isSponsored) {
                                                                        setSponsoredProducts(prev => prev.filter(id => id !== product.id));
                                                                    } else if (!limitReached) {
                                                                        setSponsoredProducts(prev => [...prev, product.id]);
                                                                    }
                                                                }}
                                                                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-500 accent-amber-500"
                                                            />
                                                            {/* Product image */}
                                                            {product.imageUrl || (product.images && product.images[0]) ? (
                                                                <img
                                                                    src={product.imageUrl || product.images[0]}
                                                                    alt={getLocalizedText(product.name)}
                                                                    className="w-10 h-10 rounded-lg object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500 text-lg">
                                                                    📷
                                                                </div>
                                                            )}
                                                            {/* Name */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-white text-sm font-medium truncate">
                                                                    {getLocalizedText(product.name)}
                                                                </p>
                                                                <p className="text-gray-500 text-xs truncate">
                                                                    {(product.categories || [product.category]).filter(Boolean).join(', ')}
                                                                </p>
                                                            </div>
                                                            {/* Price */}
                                                            <div className="text-right">
                                                                {product.price != null && (
                                                                    <span className="text-green-400 font-bold text-sm">
                                                                        {product.price}€
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Star badge */}
                                                            {isSponsored && (
                                                                <span className="text-amber-400 text-lg">⭐</span>
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Save Button */}
                                        <div className="flex justify-end pt-2">
                                            <button
                                                onClick={async () => {
                                                    if (!contextBusinessId) return;
                                                    setSponsoredSaving(true);
                                                    try {
                                                        await updateDoc(doc(db, 'businesses', contextBusinessId), {
                                                            sponsoredProducts: sponsoredProducts,
                                                            hasSponsoredProducts: sponsoredProducts.length > 0,
                                                        });
                                                        alert('⭐ Öne çıkan ürünler kaydedildi!');
                                                    } catch (error) {
                                                        console.error('Error saving sponsored products:', error);
                                                        alert('Kaydetme hatası!');
                                                    }
                                                    setSponsoredSaving(false);
                                                }}
                                                disabled={sponsoredSaving}
                                                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {sponsoredSaving ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        Kaydediliyor...
                                                    </>
                                                ) : (
                                                    <>
                                                        💾 Kaydet ({sponsoredProducts.length} ürün)
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 🆕 CATEGORY ADD/EDIT MODAL */}
                        {showCategoryModal && (
                            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                                    <h2 className="text-xl font-bold text-white mb-4">
                                        {editingCategoryItem ? t('kategoriDuzenle') : '+ Yeni Kategori'}
                                    </h2>

                                    {/* Icon Selection */}
                                    <div className="mb-4">
                                        <label className="text-gray-400 text-sm mb-2 block">{t('ikon')}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {CATEGORY_ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    onClick={() => setCategoryFormData({ ...categoryFormData, icon })}
                                                    className={`w-10 h-10 text-2xl rounded-lg transition ${categoryFormData.icon === icon
                                                        ? 'bg-violet-600 ring-2 ring-violet-400'
                                                        : 'bg-gray-700 hover:bg-gray-600'
                                                        }`}
                                                >{icon}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Name Input */}
                                    <div className="mb-4">
                                        <MultiLanguageInput
                                            label={t('kategoriAdi')}
                                            value={categoryFormData.name}
                                            onChange={(val) => setCategoryFormData({ ...categoryFormData, name: val })}
                                            required
                                        />
                                    </div>

                                    {/* Active Toggle */}
                                    <div className="mb-6">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={categoryFormData.isActive}
                                                onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                                                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-violet-500 focus:ring-violet-500"
                                            />
                                            <span className="text-gray-300">{t('aktifUygulamadaGorunsun')}</span>
                                        </label>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setShowCategoryModal(false); setEditingCategoryItem(null); }}
                                            className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                                        >{t('iptal')}</button>
                                        <button
                                            onClick={handleCategorySave}
                                            disabled={savingCategory || !getLocalizedText(categoryFormData.name).trim()}
                                            className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition disabled:opacity-50"
                                        >
                                            {savingCategory ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Master Katalog Section Header (collapsible for business context) */}
                        {isBusinessContext && (
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-400">
                                    {t('masterKatalogdanUrunEkle')}
                                </h3>
                                <button
                                    onClick={() => setShowAllMasterProducts(!showAllMasterProducts)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${showAllMasterProducts
                                        ? 'bg-gray-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {showAllMasterProducts ? '📂 Listeyi Gizle' : t('tumUrunleriGoster')}
                                </button>
                            </div>
                        )}

                        {/* Show search/filters and product list: always for global, or when search active / showAll for business */}
                        {(!isBusinessContext || showAllMasterProducts || searchQuery) && (
                            <>
                                <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex-1 min-w-[200px]">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder={t('urunAraIsimSkuAciklama')}
                                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Toptan Kaynak Filtresi */}
                                            <select
                                                value={wholesalerFilter}
                                                onChange={(e) => setWholesalerFilter(e.target.value)}
                                                className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${wholesalerFilter !== 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                            >
                                                {WHOLESALER_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                                ))}
                                            </select>
                                            {/* Ülke Filtresi */}
                                            <select
                                                value={countryFilter}
                                                onChange={(e) => setCountryFilter(e.target.value)}
                                                className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${countryFilter !== 'all' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                            >
                                                {COUNTRY_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                                ))}
                                            </select>
                                            {/* Marka Filtresi (TUNA / Akdeniz Toros) */}
                                            <select
                                                value={brandFilter}
                                                onChange={(e) => setBrandFilter(e.target.value)}
                                                className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${brandFilter !== 'all' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                            >
                                                <option value="all">{t('tumMarkalar')}</option>
                                                {BRAND_LABELS.map(brand => (
                                                    <option key={brand.value} value={brand.value}>{brand.icon} {brand.label}</option>
                                                ))}
                                                <option value="remove">{t('markaKaldir')}</option>
                                            </select>
                                            {/* Aktif Filtreleri Sıfırla */}
                                            {(wholesalerFilter !== 'all' || countryFilter !== 'all' || brandFilter !== 'all') && (
                                                <button
                                                    onClick={() => {
                                                        setWholesalerFilter('all');
                                                        setCountryFilter('all');
                                                        setBrandFilter('all');
                                                    }}
                                                    className="px-3 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 font-medium"
                                                >
                                                    ✕ Filtreleri Temizle
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        {searchQuery ? (
                                            <p className="text-gray-400 text-sm">
                                                "{searchQuery}{t('icin')} {filteredProducts.length} {t('sonucBulundu')}
                                            </p>
                                        ) : (
                                            <p className="text-gray-400 text-sm">
                                                Toplam {filteredProducts.length} {t('urunSayfa')} {currentPage}/{totalPages || 1} {t('sayfaBasi')} {PRODUCTS_PER_PAGE})
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bulk Action Bar */}
                                {selectedProducts.size > 0 && (
                                    <div className="bg-blue-900/50 border border-blue-600 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-white">
                                            <span className="font-bold">{selectedProducts.size}</span> {t('urunSecildi')}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {/* 🆕 Bu İşletmeye Ata - Only in business context */}
                                            {isBusinessContext && (
                                                <button
                                                    onClick={handleAssignToThisBusiness}
                                                    disabled={isProcessingBulk}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 transition-all"
                                                >
                                                    📥 Bu İşletmeye Ata ({selectedProducts.size})
                                                </button>
                                            )}

                                            {/* Durum (Active/Passive) Dropdown */}
                                            <select
                                                onChange={(e) => {
                                                    if (!e.target.value) return;
                                                    const action = e.target.value === 'active' ? 'activate' : 'deactivate';
                                                    e.target.value = '';
                                                    handleBulkAction(action);
                                                }}
                                                disabled={isProcessingBulk}
                                                className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>🔘 Durum</option>
                                                <option value="active">🟢 Aktif Et</option>
                                                <option value="passive">🔴 Pasif Et</option>
                                            </select>

                                            {/* Stok Dropdown */}
                                            <select
                                                onChange={async (e) => {
                                                    if (!e.target.value) return;
                                                    const newOutOfStock = e.target.value === 'outOfStock';
                                                    e.target.value = '';
                                                    const count = selectedProducts.size;
                                                    if (!confirm(`${count} ürünü '${newOutOfStock ? 'Stokta Yok' : 'Stokta Var'}' olarak işaretlemek istediğinizden emin misiniz?`)) return;
                                                    try {
                                                        for (const productId of selectedProducts) {
                                                            const ref = doc(db, 'products', productId);
                                                            await setDoc(ref, { outOfStock: newOutOfStock, updatedAt: new Date().toISOString() }, { merge: true });
                                                            if (isBusinessContext && contextBusinessId) {
                                                                const bizRef = doc(db, `businesses/${contextBusinessId}/products`, productId);
                                                                await setDoc(bizRef, { outOfStock: newOutOfStock, updatedAt: new Date().toISOString() }, { merge: true });
                                                            }
                                                        }
                                                        alert(`${count} ürün ${newOutOfStock ? 'stokta yok' : 'stokta var'} olarak işaretlendi!`);
                                                        fetchProducts();
                                                        if (isBusinessContext) fetchBusinessProducts();
                                                        setSelectedProducts(new Set());
                                                    } catch (err) { console.error(err); alert('Hata oluştu'); }
                                                }}
                                                disabled={isProcessingBulk}
                                                className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>📦 Stok</option>
                                                <option value="inStock">✅ Stokta Var</option>
                                                <option value="outOfStock">🚫 Stokta Yok</option>
                                            </select>

                                            {/* Kategoriye Taşı - Only in business context */}
                                            {isBusinessContext && activeBusinessCategories.length > 0 && (
                                                <select
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleBulkChangeCategory(e.target.value);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    disabled={isProcessingBulk}
                                                    className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-cyan-500 outline-none disabled:opacity-50"
                                                >
                                                    <option value="">📂 Kategoriye Taşı...</option>
                                                    {activeBusinessCategories.map(cat => (
                                                        <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {/* İşletme Türüne Ata Dropdown */}
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleBulkAssignBusinessType(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={isProcessingBulk}
                                                className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50"
                                            >
                                                <option value="">{t('isletmeTuruneAta')}</option>
                                                {BUSINESS_TYPE_OPTIONS.map(bt => (
                                                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                                                ))}
                                            </select>

                                            {/* Marka Ata Dropdown */}
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleBulkAssignBrand(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={isProcessingBulk}
                                                className="bg-gray-700 text-white border border-gray-500 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50"
                                            >
                                                <option value="">🏷️ Marka Ata...</option>
                                                {BRAND_LABELS.map(brand => (
                                                    <option key={brand.value} value={brand.value}>{brand.icon} {brand.label}</option>
                                                ))}
                                                <option value="remove">{t('markaKaldir')}</option>
                                            </select>

                                            {/* Sil */}
                                            <button
                                                onClick={() => handleBulkAction('delete')}
                                                disabled={isProcessingBulk}
                                                className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 text-xs font-medium transition"
                                            >
                                                🗑️ Sil
                                            </button>

                                            {/* İptal */}
                                            <button
                                                onClick={() => setSelectedProducts(new Set())}
                                                className="px-2.5 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 text-xs"
                                            >
                                                {t('iptal')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                {loading ? (
                                    <div className="text-center py-20 text-gray-500">{t('yukleniyor')}</div>
                                ) : products.length === 0 ? (
                                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                                        <p className="text-2xl mb-4">📭</p>
                                        <p className="text-xl font-bold mb-2">{t('henuzUrunYok')}</p>
                                        <p className="text-gray-400 mb-6">{t('varsayilanlariYukleButonunaBasarakBaslangicVerilerini')}</p>
                                        <button
                                            onClick={handleSeed}
                                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-500"
                                        >
                                            {t('verileriYukle')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-900/50 text-gray-400 text-sm">
                                                    <tr>
                                                        <th className="px-4 py-4 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0}
                                                                onChange={toggleSelectAll}
                                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500"
                                                            />
                                                        </th>
                                                        <th className="px-4 py-4">Durum</th>
                                                        <th className="px-4 py-4">SKU (ID)</th>
                                                        <th className="px-4 py-4">{t('urunAdi')}</th>
                                                        <th className="px-4 py-4">Kaynak</th>
                                                        <th className="px-4 py-4">Marka</th>
                                                        <th className="px-4 py-4">Kategoriler</th>
                                                        <th className="px-4 py-4">Birim</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700">
                                                    {paginatedProducts.map(product => (
                                                        <tr
                                                            key={product.id}
                                                            className={`hover:bg-gray-700/50 transition-colors cursor-pointer ${(product as any).outOfStock ? 'opacity-50 bg-gray-800/50' : ''}`}
                                                            onClick={(e) => {
                                                                // Don't open edit if clicking on checkbox
                                                                if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                                                    openEdit(product);
                                                                }
                                                            }}
                                                        >
                                                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProducts.has(product.id)}
                                                                    onChange={() => toggleSelectProduct(product.id)}
                                                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    {product.isActive !== false ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-400 border border-green-700">
                                                                            ● Aktif
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/50 text-red-400 border border-red-700">
                                                                            ○ Deaktif
                                                                        </span>
                                                                    )}
                                                                    {(product as any).outOfStock && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-orange-900/50 text-orange-400 border border-orange-700">
                                                                            🚫 Stokta Yok
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 font-mono text-sm text-gray-400">{product.id}</td>
                                                            <td className="px-4 py-4 font-bold text-white">{getLocalizedText(product.name)}</td>
                                                            <td className="px-4 py-4">
                                                                {(() => {
                                                                    const source = (product as any).sourcePlatform;
                                                                    const opt = WHOLESALER_OPTIONS.find(w => w.value === source);
                                                                    if (opt && source !== 'all') {
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-900/50 text-blue-300 border border-blue-700">
                                                                                {opt.icon} {opt.label}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return <span className="text-gray-500">Manuel</span>;
                                                                })()}
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                {((product as any).brandLabels || []).length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {((product as any).brandLabels || []).map((label: string) => {
                                                                            const brand = BRAND_LABELS.find(b => b.value === label);
                                                                            return (
                                                                                <span
                                                                                    key={label}
                                                                                    className={`px-2 py-0.5 rounded text-xs font-bold text-white ${brand?.color || 'bg-gray-600'}`}
                                                                                    title={brand?.label || label}
                                                                                >
                                                                                    {brand?.icon} {brand?.label || label}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-500">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(product.categories || [product.category]).map(cat => (
                                                                        <span key={cat} className={`px-2 py-0.5 rounded text-xs border ${categoryColors[cat] || categoryColors.diger}`}>
                                                                            {cat.toUpperCase()}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-gray-300">{product.defaultUnit}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination Controls */}
                                        {
                                            !searchQuery && totalPages > 1 && (
                                                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900/30">
                                                    <div className="text-sm text-gray-400">
                                                        {startIndex + 1} - {Math.min(startIndex + PRODUCTS_PER_PAGE, filteredProducts.length)} / {filteredProducts.length} {t('urunGosteriliyor')}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setCurrentPage(1)}
                                                            disabled={currentPage === 1}
                                                            className="px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            ⟨⟨
                                                        </button>
                                                        <button
                                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                            disabled={currentPage === 1}
                                                            className="px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            {t('onceki')}
                                                        </button>

                                                        {/* Page Numbers */}
                                                        <div className="flex gap-1">
                                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                                let pageNum;
                                                                if (totalPages <= 5) {
                                                                    pageNum = i + 1;
                                                                } else if (currentPage <= 3) {
                                                                    pageNum = i + 1;
                                                                } else if (currentPage >= totalPages - 2) {
                                                                    pageNum = totalPages - 4 + i;
                                                                } else {
                                                                    pageNum = currentPage - 2 + i;
                                                                }
                                                                return (
                                                                    <button
                                                                        key={pageNum}
                                                                        onClick={() => setCurrentPage(pageNum)}
                                                                        className={`w-8 h-8 rounded text-sm font-medium ${currentPage === pageNum
                                                                            ? 'bg-green-600 text-white'
                                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                                            }`}
                                                                    >
                                                                        {pageNum}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <button
                                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                            disabled={currentPage === totalPages}
                                                            className="px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            Sonraki →
                                                        </button>
                                                        <button
                                                            onClick={() => setCurrentPage(totalPages)}
                                                            disabled={currentPage === totalPages}
                                                            className="px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            ⟩⟩
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    </div>
                                )
                                }
                            </>
                        )}

                        {/* Modal */}
                        {
                            showModal && (
                                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                                    <div className="bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-700 shadow-2xl">
                                        {/* Sticky Header */}
                                        <div className="flex-shrink-0 p-6 pb-0 border-b border-gray-700">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-xl font-bold">{editingProduct ? t('urunuDuzenle') : t('yeniUrunEkle')}</h2>
                                                <button onClick={() => { setShowModal(false); setProductEditTab('general'); }} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                                            </div>

                                            {/* Validation Errors Banner */}
                                            {Object.entries(validationErrors).filter(([, v]) => !!v).length > 0 && (
                                                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-red-400">⚠️</span>
                                                        <h4 className="text-red-400 font-semibold text-sm">{t('lutfenAsagidakiZorunluAlanlariDoldurun')}</h4>
                                                    </div>
                                                    <ul className="list-disc list-inside space-y-0.5">
                                                        {Object.entries(validationErrors).filter(([, v]) => !!v).map(([field, message]) => (
                                                            <li key={field} className="text-red-300 text-xs">{message}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Tab Bar */}
                                            <div className="flex gap-1 overflow-x-auto pb-0 -mb-px">
                                                {([
                                                    { key: 'general' as ProductEditTab, label: '📋 Genel', icon: '📋' },
                                                    { key: 'pricing' as ProductEditTab, label: '💰 Fiyat & Vergi', icon: '💰' },
                                                    { key: 'stock' as ProductEditTab, label: '📦 Stok & Tedarik', icon: '📦' },
                                                    { key: 'media' as ProductEditTab, label: '🖼️ Medya', icon: '🖼️' },
                                                    { key: 'compliance' as ProductEditTab, label: '🧪 Uyum & Kalite', icon: '🧪' },
                                                    { key: 'app' as ProductEditTab, label: '📱 App', icon: '📱' },
                                                    { key: 'audit' as ProductEditTab, label: '📊 Denetim', icon: '📊' },
                                                ] as const).map(tab => (
                                                    <button
                                                        key={tab.key}
                                                        type="button"
                                                        onClick={() => setProductEditTab(tab.key)}
                                                        className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all border-b-2 ${productEditTab === tab.key
                                                            ? 'bg-gray-700/80 text-white border-blue-500'
                                                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 border-transparent'
                                                            }`}
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Scrollable Tab Content */}
                                        <div className="flex-1 overflow-y-auto p-6">

                                            {/* ═══════════ TAB 1: GENEL ═══════════ */}
                                            {productEditTab === 'general' && (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    {/* Temel Bilgiler */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-blue-400 mb-3">📋 Temel Bilgiler</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">
                                                                    SKU (ID) <span className="text-red-500">*</span>
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={formData.id}
                                                                    onChange={e => { const v = e.target.value; setFormData(prev => ({ ...prev, id: v })); setValidationErrors(prev => { const next = { ...prev }; delete next.id; return next; }); }}
                                                                    className={`w-full bg-gray-900 border rounded-lg px-4 py-2 font-mono text-sm ${validationErrors.id ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-600'}`}
                                                                    placeholder="MIRA-MEAT-..."
                                                                />
                                                                {validationErrors.id && <p className="text-red-400 text-xs mt-1">{validationErrors.id}</p>}
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Barkod</label>
                                                                <input
                                                                    type="text"
                                                                    value={(formData as any).barcode || ''}
                                                                    onChange={e => setFormData({ ...formData, barcode: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="EAN/UPC"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>


                                                    {/* Ürün Detay */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-green-400 mb-4">🛍️ {t('urunDetaylari')}</h3>

                                                        {/* Row 1: Ürün Adı + Üretici Markası */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                            <div className="md:col-span-2">
                                                                <MultiLanguageInput
                                                                    label={t('urunAdi')}
                                                                    value={formData.name || { tr: '' }}
                                                                    onChange={(val) => {
                                                                        setFormData(prev => ({ ...prev, name: val }));
                                                                        setValidationErrors(prev => { const next = { ...prev }; delete next.name; return next; });
                                                                    }}
                                                                    error={validationErrors.name}
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('ureticiMarkasi')}</label>
                                                                <input
                                                                    type="text"
                                                                    value={(formData as any).brand || ''}
                                                                    onChange={e => setFormData({ ...formData, brand: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder={t('ornGaziPinarYayla')}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Row 2: Birim + Durum + Vergi Oranı */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Birim *</label>
                                                                <select
                                                                    value={formData.defaultUnit}
                                                                    onChange={e => setFormData({ ...formData, defaultUnit: e.target.value as any })}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2"
                                                                >
                                                                    <option value="kg">KG</option>
                                                                    <option value="adet">Adet</option>
                                                                    <option value="porsiyon">Porsiyon</option>
                                                                    <option value="paket">Paket</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Durum</label>
                                                                <select
                                                                    value={(formData as any).isActive !== false ? 'true' : 'false'}
                                                                    onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2"
                                                                >
                                                                    <option value="true">✓ Aktif</option>
                                                                    <option value="false">✗ Deaktif</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('vergiOrani')}</label>
                                                                <select
                                                                    value={(formData as any).taxRate === undefined ? '7' : String((formData as any).taxRate)}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        if (val === 'custom') {
                                                                            const customRate = prompt(t('vergiOraniniGirin'), '0');
                                                                            if (customRate !== null) {
                                                                                setFormData({ ...formData, taxRate: parseFloat(customRate) || 0 } as any);
                                                                            }
                                                                        } else {
                                                                            setFormData({ ...formData, taxRate: parseFloat(val) } as any);
                                                                        }
                                                                    }}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2"
                                                                >
                                                                    <option value="0">%0 (Vergisiz)</option>
                                                                    <option value="7">{t('7Indirimli')}</option>
                                                                    <option value="19">%19 (Standart)</option>
                                                                    <option value="custom">{t('manuelGiris')}</option>
                                                                </select>
                                                            </div>
                                                            {/* Show current custom rate if not 0, 7, or 19 */}
                                                            {(formData as any).taxRate !== undefined &&
                                                                ![0, 7, 19].includes((formData as any).taxRate) && (
                                                                    <div className="flex items-end">
                                                                        <span className="px-3 py-2 bg-blue-900/50 text-blue-300 rounded-lg text-sm">
                                                                            Vergi: %{(formData as any).taxRate}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                        </div>

                                                        {/* Row 3: Açıklama */}
                                                        <div>
                                                            <MultiLanguageInput
                                                                label={t('aciklama')}
                                                                value={formData.description || { tr: "" }}
                                                                onChange={val => setFormData({ ...formData, description: val })}
                                                                isTextArea={true}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ═══════════ TAB 4: MEDYA ═══════════ */}
                                            {productEditTab === 'media' && (
                                                <div className="space-y-6">
                                                    {/* Ürün Görselleri */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-purple-400 mb-3">{t('urunGorselleriMax5')}</h3>
                                                        <div className="space-y-3">
                                                            {/* Image Preview Grid */}
                                                            {((formData as any).images || []).length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {((formData as any).images || []).map((img: string, idx: number) => (
                                                                        <div key={idx} className="relative group">
                                                                            <img
                                                                                src={img}
                                                                                alt={`${t('urun2')} ${idx + 1}`}
                                                                                className="w-20 h-20 object-cover rounded-lg border border-gray-600"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeImage(idx)}
                                                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Upload Button */}
                                                            {((formData as any).images || []).length < 5 && (
                                                                <div>
                                                                    <input
                                                                        ref={fileInputRef}
                                                                        type="file"
                                                                        accept="image/*"
                                                                        multiple
                                                                        onChange={(e) => handleImageUpload(e.target.files)}
                                                                        className="hidden"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => fileInputRef.current?.click()}
                                                                        disabled={uploadingImages}
                                                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                                                                    >
                                                                        {uploadingImages ? (
                                                                            <>
                                                                                <span className="animate-spin">⏳</span>
                                                                                {t('yukleniyor')}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                {t('gorselYukle')}
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                    <p className="text-xs text-gray-500 mt-1">{5 - ((formData as any).images || []).length} {t('gorselDahaEkleyebilirsiniz')}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Tedarik & İzlenebilirlik (Collapsible) */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, _tedarikOpen: !(prev as any)._tedarikOpen } as any))}
                                                            className="flex items-center justify-between w-full text-sm font-medium text-amber-400 mb-1 hover:text-amber-300 transition-colors"
                                                        >
                                                            <span>{t('tedarikIzlenebilirlik')}</span>
                                                            <span className="text-xs text-gray-500">{(formData as any)._tedarikOpen ? '▲ Kapat' : t('ac')}</span>
                                                        </button>
                                                        {(formData as any)._tedarikOpen && <div className="grid grid-cols-2 gap-3 mt-3">
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('toptanciAdi')}</label>
                                                                <input
                                                                    type="text"
                                                                    value={(formData as any).supplierName || ''}
                                                                    onChange={e => setFormData({ ...formData, supplierName: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder={t('ornMetroSelgros')}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('sarjNumarasi')}</label>
                                                                <input
                                                                    type="text"
                                                                    value={(formData as any).batchNumber || ''}
                                                                    onChange={e => setFormData({ ...formData, batchNumber: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="Lot/Batch No"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('alisFiyati')}</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={(formData as any).purchasePrice || ''}
                                                                    onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('satisFiyati')}</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={(formData as any).sellingPrice || ''}
                                                                    onChange={e => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ═══════════ TAB 5: UYUM & KALİTE ═══════════ */}
                                            {productEditTab === 'compliance' && (
                                                <div className="space-y-6">
                                                    {/* Tarihler */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-purple-400 mb-3">📅 Tarihler</h3>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('uretimTarihi')}</label>
                                                                <input
                                                                    type="date"
                                                                    value={(formData as any).productionDate || ''}
                                                                    onChange={e => setFormData({ ...formData, productionDate: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Son Kullanma Tarihi (SKT)</label>
                                                                <input
                                                                    type="date"
                                                                    value={(formData as any).expirationDate || ''}
                                                                    onChange={e => setFormData({ ...formData, expirationDate: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 🧪 Alerjenler & Katkı Maddeleri (EU LMIV 1169/2011) */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-orange-400 mb-3">🧪 Alerjenler & Katkı Maddeleri</h3>
                                                        <p className="text-xs text-gray-500 mb-3">EU LMIV 1169/2011 uyarınca 14 zorunlu alerjen bildirimi</p>

                                                        {/* Alerjenler */}
                                                        <div className="mb-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-sm text-gray-300 font-medium">Alerjenler</label>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(formData as any).allergensConfirmed || false}
                                                                        onChange={e => setFormData(prev => ({ ...prev, allergensConfirmed: e.target.checked } as any))}
                                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-600"
                                                                    />
                                                                    <span className="text-xs text-gray-400">✓ Satıcı tarafından onaylandı</span>
                                                                </label>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {[
                                                                    { key: 'gluten', label: '🌾 Gluten', emoji: '🌾' },
                                                                    { key: 'crustaceans', label: '🦐 Krebstiere', emoji: '🦐' },
                                                                    { key: 'eggs', label: '🥚 Eier', emoji: '🥚' },
                                                                    { key: 'fish', label: '🐟 Fisch', emoji: '🐟' },
                                                                    { key: 'peanuts', label: '🥜 Erdnüsse', emoji: '🥜' },
                                                                    { key: 'soybeans', label: '🫘 Soja', emoji: '🫘' },
                                                                    { key: 'milk', label: '🥛 Milch', emoji: '🥛' },
                                                                    { key: 'nuts', label: '🌰 Schalenfrüchte', emoji: '🌰' },
                                                                    { key: 'celery', label: '🥬 Sellerie', emoji: '🥬' },
                                                                    { key: 'mustard', label: '🟡 Senf', emoji: '🟡' },
                                                                    { key: 'sesame', label: '⚪ Sesam', emoji: '⚪' },
                                                                    { key: 'sulphites', label: '🧪 Sulfite', emoji: '🧪' },
                                                                    { key: 'lupin', label: '🌸 Lupine', emoji: '🌸' },
                                                                    { key: 'molluscs', label: '🐚 Weichtiere', emoji: '🐚' },
                                                                ].map(allergen => {
                                                                    const isSelected = ((formData as any).allergens || []).includes(allergen.key);
                                                                    return (
                                                                        <button
                                                                            key={allergen.key}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const current = (formData as any).allergens || [];
                                                                                const updated = isSelected
                                                                                    ? current.filter((a: string) => a !== allergen.key)
                                                                                    : [...current, allergen.key];
                                                                                setFormData({ ...formData, allergens: updated } as any);
                                                                            }}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                                                                                ? 'bg-orange-600 text-white border-2 border-orange-400 shadow-lg'
                                                                                : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                                                }`}
                                                                        >
                                                                            {allergen.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Katkı Maddeleri */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-sm text-gray-300 font-medium">Katkı Maddeleri</label>
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(formData as any).additivesConfirmed || false}
                                                                        onChange={e => setFormData(prev => ({ ...prev, additivesConfirmed: e.target.checked } as any))}
                                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-600"
                                                                    />
                                                                    <span className="text-xs text-gray-400">✓ Satıcı tarafından onaylandı</span>
                                                                </label>
                                                            </div>
                                                            <div className="flex gap-2 items-center">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Katkı maddesi ekle (Enter ile)"
                                                                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            const value = (e.target as HTMLInputElement).value.trim();
                                                                            if (value) {
                                                                                const current = (formData as any).additives || [];
                                                                                if (!current.includes(value)) {
                                                                                    setFormData({ ...formData, additives: [...current, value] } as any);
                                                                                }
                                                                                (e.target as HTMLInputElement).value = '';
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            {((formData as any).additives || []).length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    {((formData as any).additives || []).map((additive: string, idx: number) => (
                                                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-teal-900/50 text-teal-300 border border-teal-700">
                                                                            {additive}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const current = [...((formData as any).additives || [])];
                                                                                    current.splice(idx, 1);
                                                                                    setFormData({ ...formData, additives: current } as any);
                                                                                }}
                                                                                className="text-teal-400 hover:text-red-400 ml-1"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 🥗 Besin Değerleri (EU LMIV per 100g) */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-green-400 mb-3">🥗 Besin Değerleri (per 100g)</h3>
                                                        <p className="text-xs text-gray-500 mb-3">EU LMIV 1169/2011 uyarınca zorunlu besin değerleri bildirimi</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {[
                                                                { key: 'energy_kcal', label: 'Enerji (kcal)', unit: 'kcal' },
                                                                { key: 'energy_kj', label: 'Enerji (kJ)', unit: 'kJ' },
                                                                { key: 'fat', label: 'Yağ', unit: 'g' },
                                                                { key: 'saturatedFat', label: 'Doymuş Yağ', unit: 'g' },
                                                                { key: 'carbohydrates', label: 'Karbonhidrat', unit: 'g' },
                                                                { key: 'sugar', label: 'Şeker', unit: 'g' },
                                                                { key: 'protein', label: 'Protein', unit: 'g' },
                                                                { key: 'salt', label: 'Tuz', unit: 'g' },
                                                            ].map(field => (
                                                                <div key={field.key}>
                                                                    <label className="block text-xs text-gray-400 mb-1">{field.label} ({field.unit})</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={((formData as any).nutritionPer100g || {} as any)[field.key] || ''}
                                                                        onChange={e => {
                                                                            const nutrition = { ...((formData as any).nutritionPer100g || {}) };
                                                                            (nutrition as any)[field.key] = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, nutritionPer100g: nutrition } as any);
                                                                        }}
                                                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                                                                        placeholder="0.0"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ═══════════ TAB 3: STOK & TEDARİK ═══════════ */}
                                            {productEditTab === 'stock' && (
                                                <div className="space-y-6">
                                                    {/* Stok Durumu - Hızlı Toggle */}
                                                    <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-4 mb-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-orange-400">🚫 Stokta Yok İşareti</h3>
                                                                <p className="text-xs text-gray-400 mt-1">Aktif edildiğinde ürün uygulamada gri tonla gösterilir, silinmez.</p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(formData as any).outOfStock || false}
                                                                    onChange={e => setFormData({ ...formData, outOfStock: e.target.checked } as any)}
                                                                    className="sr-only peer"
                                                                />
                                                                <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                                                <span className={`ml-2 text-sm font-medium ${(formData as any).outOfStock ? 'text-orange-400' : 'text-gray-400'}`}>
                                                                    {(formData as any).outOfStock ? 'Stokta Yok' : 'Stokta'}
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                    {/* Stok Yönetimi */}
                                                    <div>
                                                        <h3 className="text-sm font-medium text-emerald-400 mb-3">{t('stokYonetimi')}</h3>
                                                        <div className="grid grid-cols-3 gap-3 mb-3">
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Mevcut Stok</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={(formData as any).currentStock || ''}
                                                                    onChange={e => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Min. Stok</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={(formData as any).minStock || ''}
                                                                    onChange={e => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">{t('siparisNoktasi')}</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={(formData as any).reorderPoint || ''}
                                                                    onChange={e => setFormData({ ...formData, reorderPoint: parseFloat(e.target.value) || 0 } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Stok Birimi</label>
                                                                <select
                                                                    value={(formData as any).stockUnit || 'kg'}
                                                                    onChange={e => setFormData({ ...formData, stockUnit: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2"
                                                                >
                                                                    <option value="kg">KG</option>
                                                                    <option value="adet">Adet</option>
                                                                    <option value="kutu">Kutu</option>
                                                                    <option value="koli">Koli</option>
                                                                    <option value="paket">Paket</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm text-gray-400 mb-1">Depo/Raf Konumu</label>
                                                                <input
                                                                    type="text"
                                                                    value={(formData as any).stockLocation || ''}
                                                                    onChange={e => setFormData({ ...formData, stockLocation: e.target.value } as any)}
                                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                    placeholder={t('ornRafA3SogukDepo')}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Stok Uyarısı */}
                                                        {(formData as any).currentStock > 0 && (formData as any).currentStock <= (formData as any).minStock && (
                                                            <div className="mt-3 bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                                                                <p className="text-red-300 text-sm">{t('stokMinimumSeviyeninAltindaYenidenSiparis')}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>
                                            )}

                                            {/* ═══════════ TAB 7: APP (Mobil Uygulama) ═══════════ */}
                                            {productEditTab === 'app' && (
                                                <div className="space-y-6">
                                                    {/* App Ayarları Başlık */}
                                                    <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl p-4">
                                                        <h3 className="text-sm font-medium text-indigo-400 mb-1">📱 Mobil Uygulama Ayarları</h3>
                                                        <p className="text-xs text-gray-400">Bu bölümdeki ayarlar doğrudan mobil uygulama görünümünü etkiler.</p>
                                                    </div>

                                                    {/* 🎛️ Ürün Seçenekleri (Lieferando-style Option Groups) */}
                                                    <div className="lg:col-span-2 border-t border-gray-700 pt-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h3 className="text-sm font-medium text-amber-400">{t('urunSecenekleriVaryantlarEkstralar')}</h3>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const groups = (formData as any).optionGroups || [];
                                                                    const newGroup = {
                                                                        id: `grp_${Date.now()}`,
                                                                        name: '',
                                                                        type: 'radio',
                                                                        required: false,
                                                                        minSelect: 0,
                                                                        maxSelect: 1,
                                                                        options: []
                                                                    };
                                                                    setFormData({ ...formData, optionGroups: [...groups, newGroup] } as any);
                                                                }}
                                                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                                            >
                                                                ➕ Grup Ekle
                                                            </button>
                                                        </div>

                                                        {((formData as any).optionGroups || []).length === 0 ? (
                                                            <div className="bg-gray-900/50 border border-dashed border-gray-600 rounded-xl p-6 text-center">
                                                                <p className="text-gray-500 text-sm">{t('henuzSecenekGrubuYok')}</p>
                                                                <p className="text-gray-600 text-xs mt-1">{t('boyutSecimiEkstralarVeyaSonderwunschEklemek')}</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {((formData as any).optionGroups || []).map((group: any, groupIdx: number) => (
                                                                    <div key={group.id} className="bg-gray-900/60 border border-gray-600 rounded-xl p-4">
                                                                        {/* Group Header */}
                                                                        <div className="flex items-center gap-3 mb-3">
                                                                            <span className="text-gray-500 font-mono text-xs">#{groupIdx + 1}</span>
                                                                            <input
                                                                                type="text"
                                                                                value={group.name}
                                                                                onChange={e => {
                                                                                    const groups = [...(formData as any).optionGroups];
                                                                                    groups[groupIdx] = { ...groups[groupIdx], name: e.target.value };
                                                                                    setFormData({ ...formData, optionGroups: groups } as any);
                                                                                }}
                                                                                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm font-semibold"
                                                                                placeholder={t('grupAdiOrnBoyutSecimiEkstralar')}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const groups = [...(formData as any).optionGroups];
                                                                                    groups.splice(groupIdx, 1);
                                                                                    setFormData({ ...formData, optionGroups: groups } as any);
                                                                                }}
                                                                                className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                                                                                title="Grubu Sil"
                                                                            >
                                                                                🗑️
                                                                            </button>
                                                                        </div>

                                                                        {/* Group Settings */}
                                                                        <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-gray-700">
                                                                            <select
                                                                                value={group.type}
                                                                                onChange={e => {
                                                                                    const groups = [...(formData as any).optionGroups];
                                                                                    const newType = e.target.value;
                                                                                    groups[groupIdx] = {
                                                                                        ...groups[groupIdx],
                                                                                        type: newType,
                                                                                        maxSelect: newType === 'radio' ? 1 : -1
                                                                                    };
                                                                                    setFormData({ ...formData, optionGroups: groups } as any);
                                                                                }}
                                                                                className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs"
                                                                            >
                                                                                <option value="radio">{t('tekSecimRadio')}</option>
                                                                                <option value="checkbox">{t('cokluSecimCheckbox')}</option>
                                                                            </select>

                                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={group.required}
                                                                                    onChange={e => {
                                                                                        const groups = [...(formData as any).optionGroups];
                                                                                        groups[groupIdx] = {
                                                                                            ...groups[groupIdx],
                                                                                            required: e.target.checked,
                                                                                            minSelect: e.target.checked ? 1 : 0
                                                                                        };
                                                                                        setFormData({ ...formData, optionGroups: groups } as any);
                                                                                    }}
                                                                                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-red-500"
                                                                                />
                                                                                <span className="text-xs text-gray-400">Zorunlu</span>
                                                                            </label>

                                                                            {group.type === 'checkbox' && (
                                                                                <>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-xs text-gray-500">Min:</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            value={group.minSelect}
                                                                                            onChange={e => {
                                                                                                const groups = [...(formData as any).optionGroups];
                                                                                                groups[groupIdx] = { ...groups[groupIdx], minSelect: parseInt(e.target.value) || 0 };
                                                                                                setFormData({ ...formData, optionGroups: groups } as any);
                                                                                            }}
                                                                                            className="w-14 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-center"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-xs text-gray-500">Max:</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="-1"
                                                                                            value={group.maxSelect}
                                                                                            onChange={e => {
                                                                                                const groups = [...(formData as any).optionGroups];
                                                                                                groups[groupIdx] = { ...groups[groupIdx], maxSelect: parseInt(e.target.value) || -1 };
                                                                                                setFormData({ ...formData, optionGroups: groups } as any);
                                                                                            }}
                                                                                            className="w-14 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-center"
                                                                                        />
                                                                                        <span className="text-[10px] text-gray-600">{t('1Sinirsiz')}</span>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>

                                                                        {/* Options List */}
                                                                        <div className="space-y-2">
                                                                            {(group.options || []).map((opt: any, optIdx: number) => (
                                                                                <div key={opt.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                                                                                    <span className="text-gray-600 text-xs w-4">{optIdx + 1}.</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={opt.name}
                                                                                        onChange={e => {
                                                                                            const groups = [...(formData as any).optionGroups];
                                                                                            const opts = [...groups[groupIdx].options];
                                                                                            opts[optIdx] = { ...opts[optIdx], name: e.target.value };
                                                                                            groups[groupIdx] = { ...groups[groupIdx], options: opts };
                                                                                            setFormData({ ...formData, optionGroups: groups } as any);
                                                                                        }}
                                                                                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                                                                                        placeholder={t('secenekAdiOrnKleinGroMit')}
                                                                                    />
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className="text-xs text-gray-500">+€</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.10"
                                                                                            min="0"
                                                                                            value={opt.priceModifier || ''}
                                                                                            onChange={e => {
                                                                                                const groups = [...(formData as any).optionGroups];
                                                                                                const opts = [...groups[groupIdx].options];
                                                                                                opts[optIdx] = { ...opts[optIdx], priceModifier: parseFloat(e.target.value) || 0 };
                                                                                                groups[groupIdx] = { ...groups[groupIdx], options: opts };
                                                                                                setFormData({ ...formData, optionGroups: groups } as any);
                                                                                            }}
                                                                                            className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-right"
                                                                                            placeholder="0.00"
                                                                                        />
                                                                                    </div>
                                                                                    <label className="flex items-center gap-1 cursor-pointer" title={t('varsayilanSecili')}>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={opt.defaultSelected || false}
                                                                                            onChange={e => {
                                                                                                const groups = [...(formData as any).optionGroups];
                                                                                                const opts = [...groups[groupIdx].options];
                                                                                                if (group.type === 'radio' && e.target.checked) {
                                                                                                    opts.forEach((o: any, i: number) => {
                                                                                                        opts[i] = { ...o, defaultSelected: i === optIdx };
                                                                                                    });
                                                                                                } else {
                                                                                                    opts[optIdx] = { ...opts[optIdx], defaultSelected: e.target.checked };
                                                                                                }
                                                                                                groups[groupIdx] = { ...groups[groupIdx], options: opts };
                                                                                                setFormData({ ...formData, optionGroups: groups } as any);
                                                                                            }}
                                                                                            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-amber-500"
                                                                                        />
                                                                                        <span className="text-[10px] text-gray-500">{t('varsayilan')}</span>
                                                                                    </label>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const groups = [...(formData as any).optionGroups];
                                                                                            const opts = [...groups[groupIdx].options];
                                                                                            opts.splice(optIdx, 1);
                                                                                            groups[groupIdx] = { ...groups[groupIdx], options: opts };
                                                                                            setFormData({ ...formData, optionGroups: groups } as any);
                                                                                        }}
                                                                                        className="text-red-400 hover:text-red-300 text-xs px-1"
                                                                                        title={t('secenegiSil')}
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </div>
                                                                            ))}

                                                                            {/* Add Option Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const groups = [...(formData as any).optionGroups];
                                                                                    const newOption = {
                                                                                        id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                                                                        name: '',
                                                                                        priceModifier: 0,
                                                                                        defaultSelected: false
                                                                                    };
                                                                                    groups[groupIdx] = {
                                                                                        ...groups[groupIdx],
                                                                                        options: [...(groups[groupIdx].options || []), newOption]
                                                                                    };
                                                                                    setFormData({ ...formData, optionGroups: groups } as any);
                                                                                }}
                                                                                className="w-full py-1.5 border border-dashed border-gray-600 hover:border-amber-500 rounded-lg text-xs text-gray-500 hover:text-amber-400 transition-colors"
                                                                            >
                                                                                {t('secenekEkle')}
                                                                            </button>
                                                                        </div>

                                                                        {/* Group Summary Badge */}
                                                                        {group.options && group.options.length > 0 && (
                                                                            <div className="mt-2 flex gap-2 text-[10px] text-gray-500">
                                                                                <span>{group.options.length} {t('secenek')}</span>
                                                                                <span>•</span>
                                                                                <span>{group.type === 'radio' ? t('tekSecim') : t('cokluSecim')}</span>
                                                                                {group.required && <><span>•</span><span className="text-red-400">Zorunlu</span></>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ═══════════ TAB 2: FİYAT & VERGİ ═══════════ */}
                                            {productEditTab === 'pricing' && (() => {
                                                const taxRate = (formData as any).taxRate === undefined ? 7 : (formData as any).taxRate;
                                                const taxMultiplier = 1 + (taxRate / 100);
                                                const priceInputMode = (formData as any)._priceInputMode || 'netto';

                                                const calcBrutto = (netto: number) => netto > 0 ? parseFloat((netto * taxMultiplier).toFixed(2)) : 0;
                                                const calcNetto = (brutto: number) => brutto > 0 ? parseFloat((brutto / taxMultiplier).toFixed(2)) : 0;

                                                return (
                                                    <div className="space-y-6">
                                                        {/* Vergi Oranı — Üstte */}
                                                        <div className="border-b border-gray-700 pb-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h3 className="text-sm font-medium text-amber-400">🏦 Vergi Oranı</h3>
                                                                <span className="text-xs text-gray-500">Netto/Brutto hesaplaması bu orana göre yapılır</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <select value={String(taxRate)} onChange={e => { const val = e.target.value; if (val === 'custom') { const customRate = prompt('Vergi oranını girin:', '0'); if (customRate !== null) { setFormData({ ...formData, taxRate: parseFloat(customRate) || 0 } as any); } } else { setFormData({ ...formData, taxRate: parseFloat(val) } as any); } }} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                                                                    <option value="0">%0 (Vergisiz)</option>
                                                                    <option value="7">%7 (İndirimli)</option>
                                                                    <option value="19">%19 (Standart)</option>
                                                                    <option value="custom">Manuel Giriş</option>
                                                                </select>
                                                                {![0, 7, 19].includes(taxRate) && (
                                                                    <span className="px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded-lg text-xs">Özel: %{taxRate}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Fiyatlandırma + Netto/Brutto Toggle */}
                                                        <div className="border-b border-gray-700 pb-4">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="text-sm font-medium text-amber-400">💰 Fiyatlandırma</h3>
                                                                <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-600">
                                                                    <button type="button" onClick={() => setFormData({ ...formData, _priceInputMode: 'netto' } as any)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${priceInputMode === 'netto' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                                                                        Netto girişi
                                                                    </button>
                                                                    <button type="button" onClick={() => setFormData({ ...formData, _priceInputMode: 'brutto' } as any)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${priceInputMode === 'brutto' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>
                                                                        Brutto girişi
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Alış Fiyatı */}
                                                            <div className="mb-4">
                                                                <label className="block text-sm text-gray-300 font-medium mb-2">Alış Fiyatı</label>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs text-gray-500 mb-1">Netto (€)</label>
                                                                        {priceInputMode === 'netto' ? (
                                                                            <input type="number" step="0.01" value={(formData as any).purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 } as any)} className="w-full bg-gray-900 border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
                                                                        ) : (
                                                                            <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                {(formData as any).purchasePrice ? `€${((formData as any).purchasePrice).toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-gray-500 mb-1">Brutto (€) <span className="text-gray-600">inkl. %{taxRate} MwSt.</span></label>
                                                                        {priceInputMode === 'brutto' ? (
                                                                            <input type="number" step="0.01" value={(formData as any).purchasePrice ? calcBrutto((formData as any).purchasePrice) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; setFormData({ ...formData, purchasePrice: calcNetto(brutto) } as any); }} className="w-full bg-gray-900 border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
                                                                        ) : (
                                                                            <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                {(formData as any).purchasePrice ? `€${calcBrutto((formData as any).purchasePrice).toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Satış Fiyatı */}
                                                            <div className="mb-4">
                                                                <label className="block text-sm text-gray-300 font-medium mb-2">Satış Fiyatı</label>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs text-gray-500 mb-1">Netto (€)</label>
                                                                        {priceInputMode === 'netto' ? (
                                                                            <input type="number" step="0.01" value={(formData as any).sellingPrice || ''} onChange={e => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 } as any)} className="w-full bg-gray-900 border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
                                                                        ) : (
                                                                            <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                {(formData as any).sellingPrice ? `€${((formData as any).sellingPrice).toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-gray-500 mb-1">Brutto (€) <span className="text-gray-600">inkl. %{taxRate} MwSt.</span></label>
                                                                        {priceInputMode === 'brutto' ? (
                                                                            <input type="number" step="0.01" value={(formData as any).sellingPrice ? calcBrutto((formData as any).sellingPrice) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; setFormData({ ...formData, sellingPrice: calcNetto(brutto) } as any); }} className="w-full bg-gray-900 border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
                                                                        ) : (
                                                                            <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                {(formData as any).sellingPrice ? `€${calcBrutto((formData as any).sellingPrice).toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Kar Marjı Özet */}
                                                            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                                                                <div className="grid grid-cols-3 gap-3 text-center">
                                                                    <div>
                                                                        <span className="block text-xs text-gray-500 mb-1">Kar Marjı</span>
                                                                        <span className="text-sm font-medium text-emerald-400">
                                                                            {(formData as any).sellingPrice && (formData as any).purchasePrice && (formData as any).purchasePrice > 0
                                                                                ? `%${(((((formData as any).sellingPrice - (formData as any).purchasePrice) / (formData as any).purchasePrice) * 100)).toFixed(1)}`
                                                                                : '--'}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-xs text-gray-500 mb-1">Vergi Tutarı</span>
                                                                        <span className="text-sm font-medium text-amber-400">
                                                                            {(formData as any).sellingPrice ? `€${((formData as any).sellingPrice * taxRate / 100).toFixed(2)}` : '--'}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-xs text-gray-500 mb-1">Brutto Satış</span>
                                                                        <span className="text-sm font-medium text-white">
                                                                            {(formData as any).sellingPrice ? `€${calcBrutto((formData as any).sellingPrice).toFixed(2)}` : '--'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* 📱 App Satış Fiyatı (Kurye + Gel-Al) */}
                                                            <div className="border-b border-gray-700 pb-4">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h3 className="text-sm font-medium text-blue-400">📱 App Satış Fiyatı</h3>
                                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!(formData as any).appSellingPrice}
                                                                            onChange={e => {
                                                                                if (!e.target.checked) {
                                                                                    setFormData({ ...formData, appSellingPrice: null } as any);
                                                                                } else {
                                                                                    setFormData({ ...formData, appSellingPrice: (formData as any).sellingPrice || 0 } as any);
                                                                                }
                                                                            }}
                                                                            className="w-4 h-4 rounded accent-blue-500"
                                                                        />
                                                                        <span className="text-xs text-gray-400">Farklı fiyat uygula</span>
                                                                    </label>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mb-3">Kurye ve Gel-Al siparişlerinde gösterilen fiyat</p>
                                                                {(formData as any).appSellingPrice ? (
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-xs text-gray-500 mb-1">Netto</label>
                                                                            {priceInputMode === 'netto' ? (
                                                                                <input type="number" step="0.01" value={(formData as any).appSellingPrice || ''} onChange={e => setFormData({ ...formData, appSellingPrice: parseFloat(e.target.value) || 0 } as any)} className="w-full bg-gray-900 border border-blue-600/50 rounded-lg px-4 py-2 text-blue-200" placeholder="0.00" />
                                                                            ) : (
                                                                                <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                    {(formData as any).appSellingPrice ? `${(formData as any).appSellingPrice.toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs text-gray-500 mb-1">Brutto <span className="text-gray-600">inkl. %{taxRate} MwSt.</span></label>
                                                                            {priceInputMode === 'brutto' ? (
                                                                                <input type="number" step="0.01" value={(formData as any).appSellingPrice ? calcBrutto((formData as any).appSellingPrice) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; setFormData({ ...formData, appSellingPrice: calcNetto(brutto) } as any); }} className="w-full bg-gray-900 border border-blue-600/50 rounded-lg px-4 py-2 text-blue-200" placeholder="0.00" />
                                                                            ) : (
                                                                                <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                    {(formData as any).appSellingPrice ? `${calcBrutto((formData as any).appSellingPrice).toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="px-4 py-3 bg-gray-800/40 border border-gray-700 rounded-lg text-center">
                                                                        <span className="text-sm text-gray-500">💡 Satış fiyatı ile aynı{(formData as any).sellingPrice ? ` (${(formData as any).sellingPrice.toFixed(2)})` : ''}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* 🏪 Market İçi Fiyatı (ESL) */}
                                                            <div className="pb-4">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h3 className="text-sm font-medium text-emerald-400">🏪 Market İçi Fiyatı <span className="text-xs text-gray-500">(ESL)</span></h3>
                                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!(formData as any).inStorePrice}
                                                                            onChange={e => {
                                                                                if (!e.target.checked) {
                                                                                    setFormData({ ...formData, inStorePrice: null } as any);
                                                                                } else {
                                                                                    setFormData({ ...formData, inStorePrice: (formData as any).sellingPrice || 0 } as any);
                                                                                }
                                                                            }}
                                                                            className="w-4 h-4 rounded accent-emerald-500"
                                                                        />
                                                                        <span className="text-xs text-gray-400">Farklı fiyat uygula</span>
                                                                    </label>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mb-3">Mağaza içi raf/ESL etiketlerinde gösterilecek fiyat</p>
                                                                {(formData as any).inStorePrice ? (
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-xs text-gray-500 mb-1">Netto</label>
                                                                            {priceInputMode === 'netto' ? (
                                                                                <input type="number" step="0.01" value={(formData as any).inStorePrice || ''} onChange={e => setFormData({ ...formData, inStorePrice: parseFloat(e.target.value) || 0 } as any)} className="w-full bg-gray-900 border border-emerald-600/50 rounded-lg px-4 py-2 text-emerald-200" placeholder="0.00" />
                                                                            ) : (
                                                                                <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                    {(formData as any).inStorePrice ? `${(formData as any).inStorePrice.toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs text-gray-500 mb-1">Brutto <span className="text-gray-600">inkl. %{taxRate} MwSt.</span></label>
                                                                            {priceInputMode === 'brutto' ? (
                                                                                <input type="number" step="0.01" value={(formData as any).inStorePrice ? calcBrutto((formData as any).inStorePrice) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; setFormData({ ...formData, inStorePrice: calcNetto(brutto) } as any); }} className="w-full bg-gray-900 border border-emerald-600/50 rounded-lg px-4 py-2 text-emerald-200" placeholder="0.00" />
                                                                            ) : (
                                                                                <div className="px-4 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-300">
                                                                                    {(formData as any).inStorePrice ? `${calcBrutto((formData as any).inStorePrice).toFixed(2)}` : <span className="text-gray-500">--</span>}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="px-4 py-3 bg-gray-800/40 border border-gray-700 rounded-lg text-center">
                                                                        <span className="text-sm text-gray-500">💡 Satış fiyatı ile aynı{(formData as any).sellingPrice ? ` (${(formData as any).sellingPrice.toFixed(2)})` : ''}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* ═══════════ TAB 6: DENETİM ═══════════ */}
                                            {productEditTab === 'audit' && (
                                                <div className="space-y-6">
                                                    {/* Dahili Notlar */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-indigo-400 mb-3">📝 Dahili Notlar</h3>
                                                        <textarea
                                                            value={(formData as any).internalNotes || ''}
                                                            onChange={e => setFormData({ ...formData, internalNotes: e.target.value } as any)}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-sm min-h-[100px]"
                                                            placeholder="Sadece admin panelinde görünür notlar..."
                                                        />
                                                    </div>

                                                    {/* Etiketler */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-indigo-400 mb-3">🏷️ Etiketler</h3>
                                                        <div className="flex gap-2 items-center mb-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Etiket ekle (Enter ile)"
                                                                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        const value = (e.target as HTMLInputElement).value.trim();
                                                                        if (value) {
                                                                            const current = (formData as any).tags || [];
                                                                            if (!current.includes(value)) {
                                                                                setFormData({ ...formData, tags: [...current, value] } as any);
                                                                            }
                                                                            (e.target as HTMLInputElement).value = '';
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        {((formData as any).tags || []).length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {((formData as any).tags || []).map((tag: string, idx: number) => (
                                                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-700">
                                                                        {tag}
                                                                        <button type="button" onClick={() => { const current = [...((formData as any).tags || [])]; current.splice(idx, 1); setFormData({ ...formData, tags: current } as any); }} className="text-indigo-400 hover:text-red-400 ml-1">✕</button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Marka Etiketleri (TUNA / Akdeniz Toros) */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-yellow-400 mb-3">🏷️ Marka Etiketleri (Kasap Zincirleri)</h3>
                                                        <p className="text-xs text-gray-500 mb-3">{t('isaretlediginizMarkalarUygulamadaUrununUzerindeBadge')}</p>
                                                        <div className="flex flex-wrap gap-3">
                                                            {BRAND_LABELS.map(brand => (
                                                                <button
                                                                    key={brand.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const currentLabels = (formData as any).brandLabels || [];
                                                                        const newLabels = currentLabels.includes(brand.value)
                                                                            ? currentLabels.filter((l: string) => l !== brand.value)
                                                                            : [...currentLabels, brand.value];
                                                                        setFormData({ ...formData, brandLabels: newLabels } as any);
                                                                    }}
                                                                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${((formData as any).brandLabels || []).includes(brand.value)
                                                                        ? `${brand.color} text-white border-2 border-white/50 shadow-lg`
                                                                        : 'bg-gray-700 text-gray-400 border border-gray-600 hover:bg-gray-600'
                                                                        }`}
                                                                >
                                                                    {brand.icon}
                                                                    <span>{brand.label}</span>
                                                                    {((formData as any).brandLabels || []).includes(brand.value) && (
                                                                        <span className="ml-1">✓</span>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Denetim İzi */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-indigo-400 mb-3">🕒 Denetim İzi</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Oluşturulma</label>
                                                                <div className="text-sm text-gray-300 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700">
                                                                    {(formData as any).createdAt ? new Date((formData as any).createdAt).toLocaleString('tr-TR') : <span className="text-gray-500">Henüz kaydedilmedi</span>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Son Güncelleme</label>
                                                                <div className="text-sm text-gray-300 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700">
                                                                    {(formData as any).updatedAt ? new Date((formData as any).updatedAt).toLocaleString('tr-TR') : <span className="text-gray-500">--</span>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Son Düzenleyen</label>
                                                                <div className="text-sm text-gray-300 bg-gray-900 rounded-lg px-3 py-2 border border-gray-700">
                                                                    {(formData as any).lastModifiedBy || <span className="text-gray-500">--</span>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Menşe Ülke</label>
                                                                <input type="text" value={(formData as any).originCountry || ''} onChange={e => setFormData({ ...formData, originCountry: e.target.value } as any)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm" placeholder="örn: Almanya, Türkiye" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                        </div>{/* End Scrollable Tab Content */}

                                        {/* Sticky Footer */}
                                        <div className="flex-shrink-0 flex justify-end gap-3 p-6 pt-4 border-t border-gray-700">
                                            <button
                                                onClick={() => { setShowModal(false); setProductEditTab('general'); }}
                                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                            >
                                                {t('iptal')}
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors"
                                            >
                                                Kaydet
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </>
                )}
            </div>

            {/* Generic Confirm Modal */}
            {
                confirmModal && (
                    <ConfirmModal
                        isOpen={confirmModal.isOpen}
                        onClose={() => setConfirmModal(null)}
                        onConfirm={async () => {
                            await confirmModal.onConfirm();
                            setConfirmModal(null);
                        }}
                        title={confirmModal.title}
                        message={confirmModal.message}
                        itemName={confirmModal.itemName}
                        variant={confirmModal.variant}
                        confirmText={confirmModal.confirmText}
                        loadingText={confirmModal.loadingText}
                    />
                )
            }
        </div >
    );
}

// Wrapper with Suspense for useSearchParams (Next.js 16 requirement)
export default function GlobalProductsPage() {
    const t = useTranslations('AdminProducts');
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">{t('yukleniyor')}</div>
            </div>
        }>
            <GlobalProductsPageContent />
        </Suspense>
    );
}
