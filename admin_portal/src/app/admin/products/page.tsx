"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    writeBatch,
    getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAdmin } from '@/components/providers/AdminProvider';
import { normalizeTurkish } from "@/lib/utils";
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
}

// İşletme türleri business-types.ts'den çekiliyor
const BUSINESS_TYPE_OPTIONS = getBusinessTypesList().map(bt => ({
    value: bt.value,
    label: `${bt.icon} ${bt.label}`,
    color: `bg-${bt.color}-600`,
}));

// Ürün türleri (sadece gıda/ürün kategorileri için)
const PRODUCT_TYPE_OPTIONS = [
    { value: 'dana', label: '🐄 Dana', color: 'bg-red-600' },
    { value: 'kuzu', label: '🐏 Kuzu', color: 'bg-green-600' },
    { value: 'tavuk', label: '🐔 Tavuk', color: 'bg-orange-600' },
    { value: 'icecek', label: '🥤 İçecek', color: 'bg-blue-600' },
    { value: 'tatli', label: '🍰 Tatlı', color: 'bg-pink-600' },
    { value: 'sebze', label: '🥬 Sebze/Meyve', color: 'bg-green-600' },
    // 🆕 KERMES KATEGORİLERİ
    { value: 'kermes_yemek', label: '🍲 Kermes Yemek', color: 'bg-purple-600' },
    { value: 'kermes_tatli', label: '🧁 Kermes Tatlı', color: 'bg-pink-500' },
    { value: 'kermes_icecek', label: '🧃 Kermes İçecek', color: 'bg-cyan-600' },
    { value: 'kermes_atistirmalik', label: '🥨 Kermes Atıştırmalık', color: 'bg-amber-600' },
    { value: 'diger', label: '📦 Diğer', color: 'bg-gray-600' },
];

// Marka Etiketleri (Kasap Zincirleri)
const BRAND_LABELS = [
    { value: 'tuna', label: 'TUNA', color: 'bg-red-600', icon: '🔴' },
    { value: 'akdeniz_toros', label: 'Akdeniz Toros', color: 'bg-gray-800', icon: '⚫' },
];

// Toptancı/Kaynak Filtreleri
const WHOLESALER_OPTIONS = [
    { value: 'all', label: 'Tüm Kaynaklar', icon: '📦' },
    { value: 'foodpaket', label: 'Foodpaket', icon: '🛒' },
    { value: 'asia_express', label: 'Asia Express', icon: '🌏' },
    { value: 'dovgan', label: 'Dovgan', icon: '🇷🇺' },
    { value: 'manual', label: 'Manuel', icon: '✏️' },
];

// Ülke Filtreleri
const COUNTRY_OPTIONS = [
    { value: 'all', label: 'Tüm Ülkeler', icon: '🌍' },
    { value: 'japan', label: 'Japonya', icon: '🇯🇵' },
    { value: 'korea', label: 'Kore', icon: '🇰🇷' },
    { value: 'china', label: 'Çin', icon: '🇨🇳' },
    { value: 'thailand', label: 'Tayland', icon: '🇹🇭' },
    { value: 'vietnam', label: 'Vietnam', icon: '🇻🇳' },
    { value: 'turkey', label: 'Türkiye', icon: '🇹🇷' },
    { value: 'germany', label: 'Almanya', icon: '🇩🇪' },
    { value: 'other', label: 'Diğer', icon: '🔸' },
];

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
    const [formData, setFormData] = useState<Partial<ExtendedProduct>>({
        id: "",
        name: "",
        category: "dana",
        categories: [],
        defaultUnit: "kg",
        description: "",
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
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return a.name.localeCompare(b.name);
            });
            setProducts(fetchedProducts);
        } catch (error) {
            console.error("Error fetching master products:", error);
            alert("Ürünler yüklenirken hata oluştu.");
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
                const catA = a.category || '';
                const catB = b.category || '';
                if (catA !== catB) return catA.localeCompare(catB);
                return (a.name || '').localeCompare(b.name || '');
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
                        companyName: data.companyName || data.name || data.brand || 'İşletme',
                        type: data.type || data.businessType,
                    });
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
            title: 'Varsayılan Ürünleri Yükle',
            message: 'Mevcut veritabanına varsayılan ürünler eklenecek. Devam edilsin mi?',
            variant: 'warning',
            confirmText: 'Evet, Yükle',
            loadingText: 'Yükleniyor...',
            onConfirm: async () => {
                setSeeding(true);
                try {
                    for (const product of MASTER_PRODUCTS) {
                        await setDoc(doc(db, "master_products", product.id), product);
                    }
                    alert("Varsayılan ürünler başarıyla eklendi!");
                    fetchProducts();
                } catch (error) {
                    console.error("Error seeding products:", error);
                    alert("Veri eklenirken hata oluştu.");
                } finally {
                    setSeeding(false);
                }
            },
        });
    };

    // Save (Add/Edit)
    const handleSave = async () => {
        // Validation - Only truly essential fields
        const errors: ValidationErrors = {};
        if (!formData.id?.trim()) errors.id = 'SKU (ID) zorunludur';
        if (!formData.name?.trim()) errors.name = 'Ürün adı zorunludur';

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
                name: formData.name!.trim(),
                category: formData.category,
                categories: (formData as any).categories || [],
                // 🆕 Hangi işletme türleri satabilir
                allowedBusinessTypes: (formData as any).allowedBusinessTypes || [],
                defaultUnit: formData.defaultUnit || 'kg',
                unit: formData.defaultUnit || 'kg', // 🆕 Mobile app reads 'unit' field
                description: formData.description || "",
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
                // ERP Fields
                barcode: (formData as any).barcode || null,
                productType: (formData as any).productType || 'fresh',
                supplierName: (formData as any).supplierName || null,
                batchNumber: (formData as any).batchNumber || null,
                purchasePrice: (formData as any).purchasePrice || null,
                sellingPrice: (formData as any).sellingPrice || null,
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
            setFormData({ id: "", name: "", category: "dana", defaultUnit: "kg", description: "" });
            fetchProducts();
            // Also refresh business products if in business context
            if (isBusinessContext) {
                fetchBusinessProducts();
            }
        } catch (error: any) {
            console.error("Error saving product:", error);
            alert(`Ürün kaydedilirken hata oluştu: ${error?.message || 'Bilinmeyen hata'}`);
        }
    };

    // Delete
    const handleDelete = (id: string) => {
        const product = products.find(p => p.id === id);
        setConfirmModal({
            isOpen: true,
            title: 'Ürün Sil',
            message: 'Bu ürünü silmek istediğinize emin misiniz? (Bu işlem kasapların mevcut listesini etkilemeyebilir ama yeni eklemelerde görünmez)',
            itemName: product?.name,
            variant: 'danger',
            confirmText: 'Evet, Sil',
            loadingText: 'Siliniyor...',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, "master_products", id));
                    fetchProducts();
                } catch (error) {
                    console.error("Error deleting product:", error);
                    alert("Ürün silinirken hata oluştu.");
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
            alert("Lütfen işlem yapılacak ürünleri seçin.");
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
            title: 'Toplu İşlem',
            message: `Seçili ${count} ürünü ${actionLabels[action]} yapmak istediğinize emin misiniz?`,
            variant: action === 'delete' ? 'danger' : 'warning',
            confirmText: `Evet, ${actionLabels[action]} Yap`,
            loadingText: 'İşleniyor...',
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
                    alert(`${count} ürün başarıyla ${actionLabels[action]} yapıldı.`);
                } catch (error) {
                    console.error("Bulk action error:", error);
                    alert("Toplu işlem sırasında hata oluştu.");
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // 🆕 Bulk Assign Business Types
    const handleBulkAssignBusinessType = (businessType: string) => {
        if (selectedProducts.size === 0) {
            alert("Lütfen işlem yapılacak ürünleri seçin.");
            return;
        }

        const typeLabel = BUSINESS_TYPE_OPTIONS.find(bt => bt.value === businessType)?.label || businessType;
        const count = selectedProducts.size;
        setConfirmModal({
            isOpen: true,
            title: 'İşletme Türü Ata',
            message: `Seçili ${count} ürüne "${typeLabel}" işletme türü eklensin mi?`,
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
                    alert(`${count} ürüne "${typeLabel}" türü başarıyla eklendi.`);
                } catch (error) {
                    console.error("Bulk assign error:", error);
                    alert("Toplu atama sırasında hata oluştu.");
                } finally {
                    setIsProcessingBulk(false);
                }
            },
        });
    };

    // 🔴 Bulk Assign Brand Labels (TUNA / Akdeniz Toros)
    const handleBulkAssignBrand = (brandValue: string) => {
        if (selectedProducts.size === 0) {
            alert("Lütfen işlem yapılacak ürünleri seçin.");
            return;
        }

        const brand = BRAND_LABELS.find(b => b.value === brandValue);
        const brandLabel = brand?.label || brandValue;
        const count = selectedProducts.size;

        if (brandValue === 'remove') {
            setConfirmModal({
                isOpen: true,
                title: 'Marka Etiketlerini Kaldır',
                message: `Seçili ${count} üründen marka etiketleri kaldırılsın mı?`,
                variant: 'warning',
                confirmText: 'Evet, Kaldır',
                loadingText: 'Kaldırılıyor...',
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
                        alert(`${count} üründen marka etiketleri kaldırıldı.`);
                    } catch (error) {
                        console.error("Bulk remove brand error:", error);
                        alert("Toplu işlem sırasında hata oluştu.");
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
            message: `Seçili ${count} ürüne "${brandLabel}" marka etiketi eklensin mi?`,
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
                    alert(`${count} ürüne "${brandLabel}" etiketi başarıyla eklendi.`);
                } catch (error) {
                    console.error("Bulk assign brand error:", error);
                    alert("Toplu marka atama sırasında hata oluştu.");
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
            alert("Maksimum 5 görsel ekleyebilirsiniz.");
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
            alert("Görsel yüklenirken hata oluştu.");
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
        setFormData({
            ...product,
            categories: product.categories || [product.category],
            images: product.images || [],
            brand: product.brand || '',
            isActive: product.isActive !== false,
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
        tavuk: "bg-orange-900/40 text-orange-200 border-orange-700",
        hazir: "bg-purple-900/40 text-purple-200 border-purple-700",
        diger: "bg-gray-700 text-gray-200 border-gray-600"
    };

    // Filter products with Turkish normalization
    const normalizedQuery = normalizeTurkish(searchQuery);
    const filteredProducts = products.filter(p => {
        const matchesSearch = !searchQuery ||
            normalizeTurkish(p.name).includes(normalizedQuery) ||
            normalizeTurkish(p.description || '').includes(normalizedQuery) ||
            normalizeTurkish(p.id).includes(normalizedQuery);
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
                                <Link href="/admin/business" className="hover:text-white transition-colors">← İşletme Listesi</Link>
                            ) : (
                                <Link href="/admin/dashboard" className="hover:text-white transition-colors">← Dashboard</Link>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            {isBusinessContext ? (
                                <>
                                    🏪 {businessInfo?.companyName || 'İşletme'} - Ürünler
                                </>
                            ) : (
                                <>📦 Master Ürün Kataloğu</>
                            )}
                        </h1>
                        <p className="text-gray-400 mt-1">
                            {isBusinessContext
                                ? `${businessInfo?.companyName || 'Bu işletme'} için ürün yönetimi.`
                                : 'Tüm işletmelerde geçerli olan genel ürün tanımları.'}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {!isBusinessContext && isSuperAdmin && (
                            <button
                                onClick={handleSeed}
                                disabled={seeding}
                                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                            >
                                {seeding ? "Ekleniyor..." : "📥 Varsayılanları Yükle (Seed)"}
                            </button>
                        )}
                        <button
                            onClick={openAdd}
                            className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white font-bold transition-colors flex items-center gap-2"
                        >
                            <span>+</span> Yeni Ürün {isBusinessContext ? 'Ekle' : 'Tanımla'}
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
                        📦 Master Ürünler
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
                            🎪 Kermes Menü Oluştur
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
                            🎪 Kermes Menü Oluşturma
                            <span className="text-sm font-normal text-pink-300">
                                (Belirli bir organizasyon için özel menü hazırla)
                            </span>
                        </h2>

                        {/* Organizasyon Seçimi */}
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">
                                🕌 Organizasyon Seçin (Kermes yapılacak cami/dernek)
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
                                        ✕ Değiştir
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {/* Arama */}
                                    <input
                                        type="text"
                                        value={kermesOrgSearch}
                                        onChange={(e) => setKermesOrgSearch(e.target.value)}
                                        placeholder="🔍 Cami adı, şehir veya posta kodu ara..."
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-pink-500 mb-3"
                                    />
                                    {/* Liste */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                                        {loadingOrganizations ? (
                                            <div className="col-span-full text-center py-8 text-gray-400">
                                                ⏳ Organizasyonlar yükleniyor...
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
                                            <p>Henüz organizasyon yok</p>
                                            <p className="text-sm">İlk önce İşletme Yönetimi → Kermes bölümünden organizasyon ekleyin</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Kermes Ürünleri Seçimi */}
                        {selectedOrganization && (
                            <div>
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    🍲 Kermes Menüsü Hazırla
                                    <span className="text-sm font-normal text-gray-400">
                                        (Mevcut kermes ürünlerinden seçin veya yeni ekleyin)
                                    </span>
                                </h3>

                                {/* Mevcut Kermes Ürünleri */}
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                                    {kermesProducts.length === 0 ? (
                                        <div className="col-span-full text-center py-8 bg-gray-700/50 rounded-xl">
                                            <p className="text-2xl mb-2">🍲</p>
                                            <p className="text-gray-400">Henüz kermes ürünü yok</p>
                                            <button
                                                onClick={() => {
                                                    setPageMode('products');
                                                    setCategoryFilter('kermes_yemek');
                                                }}
                                                className="mt-3 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500"
                                            >
                                                ➕ Kermes Ürünü Ekle
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
                                                    <p className="text-white text-sm font-medium line-clamp-2">{product.name}</p>
                                                    <p className="text-gray-400 text-xs mt-1">
                                                        {product.defaultUnit === 'adet' ? '🔢' : '⚖️'} {product.defaultUnit}
                                                    </p>
                                                    {isSelected && (
                                                        <span className="inline-block mt-2 px-2 py-0.5 bg-pink-600 text-white text-xs rounded-full">
                                                            ✓ Seçildi
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
                                                🎪 {selectedOrganization.shortName || selectedOrganization.name} Kermes Menüsü
                                            </h4>
                                            <span className="px-3 py-1 bg-pink-600 text-white rounded-full text-sm">
                                                {kermesMenuProducts.length} ürün
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {kermesMenuProducts.map(product => (
                                                <span
                                                    key={product.id}
                                                    className="px-3 py-1.5 bg-pink-800/50 text-pink-200 rounded-lg text-sm flex items-center gap-2"
                                                >
                                                    {product.name}
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
                                                            name: p.name,
                                                            category: p.category,
                                                            defaultUnit: p.defaultUnit,
                                                        })),
                                                        createdAt: new Date(),
                                                        updatedAt: new Date(),
                                                    };
                                                    await setDoc(doc(db, 'kermes_menus', selectedOrganization.id), menuData);
                                                    alert('✅ Kermes menüsü başarıyla kaydedildi!');
                                                } catch (error) {
                                                    console.error('Error saving kermes menu:', error);
                                                    alert('❌ Menü kaydedilirken hata oluştu');
                                                } finally {
                                                    setSavingKermesMenu(false);
                                                }
                                            }}
                                            disabled={savingKermesMenu}
                                            className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-bold hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 transition-all"
                                        >
                                            {savingKermesMenu ? '⏳ Kaydediliyor...' : '💾 Kermes Menüsünü Kaydet'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* NORMAL ÜRÜN LİSTESİ MODU */
                    <>
                        {/* 🆕 BUSINESS CONTEXT: Show business's own products FIRST */}
                        {isBusinessContext && (
                            <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-cyan-500/30">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        🏪 {businessInfo?.companyName || 'İşletme'} Ürünleri
                                        <span className="text-sm font-normal text-gray-400">
                                            ({businessProducts.length} ürün atanmış)
                                        </span>
                                    </h2>
                                    <button
                                        onClick={fetchBusinessProducts}
                                        className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm"
                                    >
                                        🔄 Yenile
                                    </button>
                                </div>

                                {loadingBusinessProducts ? (
                                    <div className="text-center py-8 text-gray-400">
                                        ⏳ Ürünler yükleniyor...
                                    </div>
                                ) : businessProducts.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-700/30 rounded-xl border border-dashed border-gray-600">
                                        <p className="text-3xl mb-2">📭</p>
                                        <p className="text-gray-400 mb-2">Bu işletmeye henüz ürün atanmamış</p>
                                        <p className="text-sm text-gray-500">Aşağıdan Master Katalogdan ürün ekleyebilirsiniz</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-400 border-b border-gray-700">
                                                    <th className="py-2 pr-2">Durum</th>
                                                    <th className="py-2 pr-2">SKU</th>
                                                    <th className="py-2 pr-4 min-w-[200px]">Ürün Adı</th>
                                                    <th className="py-2 pr-2">Kategoriler</th>
                                                    <th className="py-2 pr-2">Fiyat</th>
                                                    <th className="py-2 pr-2">Birim</th>
                                                    <th className="py-2">İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {businessProducts.map((product: any) => (
                                                    <tr key={product.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                                        <td className="py-3 pr-2">
                                                            <span className={`px-2 py-1 rounded-full text-xs ${product.isActive !== false ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                                                {product.isActive !== false ? '🟢 Aktif' : '⚫ Pasif'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 pr-2 text-gray-400 font-mono text-xs">
                                                            {product.id?.substring(0, 15)}...
                                                        </td>
                                                        <td className="py-3 pr-4">
                                                            <span className="text-white font-medium">{product.name}</span>
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
                                                            <span className="text-green-400 font-medium">
                                                                {product.price ? `${product.price}€` : '-'}
                                                            </span>
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
                                                                    ✏️ Düzenle
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Master Katalog Section Header (collapsible for business context) */}
                        {isBusinessContext && (
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-400">
                                    📦 Master Katalogdan Ürün Ekle
                                </h3>
                                <button
                                    onClick={() => setShowAllMasterProducts(!showAllMasterProducts)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${showAllMasterProducts
                                        ? 'bg-gray-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {showAllMasterProducts ? '📂 Listeyi Gizle' : '📁 Tüm Ürünleri Göster'}
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
                                                placeholder="🔍 Ürün ara (isim, SKU, açıklama)..."
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
                                                <option value="all">🏷️ Tüm Markalar</option>
                                                {BRAND_LABELS.map(brand => (
                                                    <option key={brand.value} value={brand.value}>{brand.icon} {brand.label}</option>
                                                ))}
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
                                                "{searchQuery}" için {filteredProducts.length} sonuç bulundu
                                            </p>
                                        ) : (
                                            <p className="text-gray-400 text-sm">
                                                Toplam {filteredProducts.length} ürün • Sayfa {currentPage}/{totalPages || 1} (sayfa başı {PRODUCTS_PER_PAGE})
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bulk Action Bar */}
                                {selectedProducts.size > 0 && (
                                    <div className="bg-blue-900/50 border border-blue-600 rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-white">
                                            <span className="font-bold">{selectedProducts.size}</span> ürün seçildi
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {/* 🆕 İşletme Türüne Ata Dropdown */}
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleBulkAssignBusinessType(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={isProcessingBulk}
                                                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer"
                                            >
                                                <option value="">🏪 İşletme Türüne Ata...</option>
                                                {BUSINESS_TYPE_OPTIONS.map(bt => (
                                                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                                                ))}
                                            </select>
                                            {/* 🔴 Marka Ata Dropdown (TUNA / Akdeniz Toros) */}
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleBulkAssignBrand(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={isProcessingBulk}
                                                className="px-3 py-2 bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer"
                                            >
                                                <option value="">🏷️ Marka Ata...</option>
                                                {BRAND_LABELS.map(brand => (
                                                    <option key={brand.value} value={brand.value}>{brand.icon} {brand.label}</option>
                                                ))}
                                                <option value="remove">❌ Marka Kaldır</option>
                                            </select>
                                            <button
                                                onClick={() => handleBulkAction('activate')}
                                                disabled={isProcessingBulk}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 text-sm font-medium"
                                            >
                                                ✓ Aktif Yap
                                            </button>
                                            <button
                                                onClick={() => handleBulkAction('deactivate')}
                                                disabled={isProcessingBulk}
                                                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 disabled:opacity-50 text-sm font-medium"
                                            >
                                                ⏸ Deaktif Yap
                                            </button>
                                            <button
                                                onClick={() => handleBulkAction('delete')}
                                                disabled={isProcessingBulk}
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 text-sm font-medium"
                                            >
                                                🗑️ Sil
                                            </button>
                                            <button
                                                onClick={() => setSelectedProducts(new Set())}
                                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 text-sm"
                                            >
                                                İptal
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                {loading ? (
                                    <div className="text-center py-20 text-gray-500">Yükleniyor...</div>
                                ) : products.length === 0 ? (
                                    <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                                        <p className="text-2xl mb-4">📭</p>
                                        <p className="text-xl font-bold mb-2">Henüz Ürün Yok</p>
                                        <p className="text-gray-400 mb-6">"Varsayılanları Yükle" butonuna basarak başlangıç verilerini ekleyebilirsiniz.</p>
                                        <button
                                            onClick={handleSeed}
                                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-500"
                                        >
                                            Verileri Yükle
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
                                                        <th className="px-4 py-4">Ürün Adı</th>
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
                                                            className="hover:bg-gray-700/50 transition-colors cursor-pointer"
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
                                                                {product.isActive !== false ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-400 border border-green-700">
                                                                        ● Aktif
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-900/50 text-red-400 border border-red-700">
                                                                        ○ Deaktif
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-4 font-mono text-sm text-gray-400">{product.id}</td>
                                                            <td className="px-4 py-4 font-bold text-white">{product.name}</td>
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
                                                        {startIndex + 1} - {Math.min(startIndex + PRODUCTS_PER_PAGE, filteredProducts.length)} / {filteredProducts.length} ürün gösteriliyor
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
                                                            ← Önceki
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
                                    <div className="bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 border border-gray-700 shadow-2xl">
                                        <h2 className="text-xl font-bold mb-4">{editingProduct ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}</h2>

                                        {/* Validation Errors Banner */}
                                        {Object.entries(validationErrors).filter(([, v]) => !!v).length > 0 && (
                                            <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-xl">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-red-400 text-lg">⚠️</span>
                                                    <h4 className="text-red-400 font-semibold">Lütfen aşağıdaki zorunlu alanları doldurun:</h4>
                                                </div>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {Object.entries(validationErrors).filter(([, v]) => !!v).map(([field, message]) => (
                                                        <li key={field} className="text-red-300 text-sm">{message}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* iPad-Optimized 2-Column Layout */}
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

                                            {/* Marka Etiketleri (TUNA / Akdeniz Toros) */}
                                            <div className="border-b border-gray-700 pb-4">
                                                <h3 className="text-sm font-medium text-yellow-400 mb-3">🏷️ Marka Etiketleri (Kasap Zincirleri)</h3>
                                                <p className="text-xs text-gray-500 mb-3">İşaretlediğiniz markalar uygulamada ürünün üzerinde badge olarak görünecektir.</p>
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

                                            {/* Ürün Detay */}
                                            <div className="border-b border-gray-700 pb-4">
                                                <h3 className="text-sm font-medium text-green-400 mb-3">📦 Ürün Detayları</h3>
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">
                                                                Ürün Adı <span className="text-red-500">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={formData.name}
                                                                onChange={e => { const v = e.target.value; setFormData(prev => ({ ...prev, name: v })); setValidationErrors(prev => { const next = { ...prev }; delete next.name; return next; }); }}
                                                                className={`w-full bg-gray-900 border rounded-lg px-4 py-2 ${validationErrors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-600'}`}
                                                            />
                                                            {validationErrors.name && <p className="text-red-400 text-xs mt-1">{validationErrors.name}</p>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Üretici Markası</label>
                                                            <input
                                                                type="text"
                                                                value={(formData as any).brand || ''}
                                                                onChange={e => setFormData({ ...formData, brand: e.target.value } as any)}
                                                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                                placeholder="Örn: Gazi, Pınar, Yayla"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Hangi İşletme Türleri Satabilir */}
                                                    <div className="border-b border-gray-700 pb-4">
                                                        <h3 className="text-sm font-medium text-purple-400 mb-3">🏪 Satış Yapabilecek İşletme Türleri</h3>
                                                        <p className="text-xs text-gray-500 mb-3">Bu ürünü hangi işletme türleri kendi kataloglarına ekleyebilir?</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {BUSINESS_TYPE_OPTIONS.map(bt => (
                                                                <button
                                                                    key={bt.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = (formData as any).allowedBusinessTypes || [];
                                                                        const updated = current.includes(bt.value)
                                                                            ? current.filter((t: string) => t !== bt.value)
                                                                            : [...current, bt.value];
                                                                        setFormData({ ...formData, allowedBusinessTypes: updated } as any);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${((formData as any).allowedBusinessTypes || []).includes(bt.value)
                                                                        ? 'bg-purple-600 text-white border-2 border-purple-400'
                                                                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                                        }`}
                                                                >
                                                                    {bt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Attributeler (Ürün Türü kaldırıldı) */}
                                                    <div className="flex flex-wrap items-center gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={(formData as any).isProcessed || false}
                                                                onChange={e => setFormData(prev => ({ ...prev, isProcessed: e.target.checked } as any))}
                                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600"
                                                            />
                                                            <span className="text-sm text-gray-300">Hazır/İşlenmiş</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={(formData as any).isPackaged || false}
                                                                onChange={e => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        isPackaged: e.target.checked,
                                                                        isLoose: e.target.checked ? false : (prev as any).isLoose
                                                                    } as any));
                                                                }}
                                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
                                                            />
                                                            <span className="text-sm text-gray-300">📦 Paketli</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={(formData as any).isLoose || false}
                                                                onChange={e => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        isLoose: e.target.checked,
                                                                        isPackaged: e.target.checked ? false : (prev as any).isPackaged
                                                                    } as any));
                                                                }}
                                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-600"
                                                            />
                                                            <span className="text-sm text-gray-300">🥬 Açık (Lose Ware)</span>
                                                        </label>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                                                            <label className="block text-sm text-gray-400 mb-1">Vergi Oranı</label>
                                                            <select
                                                                value={(formData as any).taxRate === undefined ? '7' : String((formData as any).taxRate)}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === 'custom') {
                                                                        const customRate = prompt('Vergi oranını girin (%):', '0');
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
                                                                <option value="7">%7 (İndirimli)</option>
                                                                <option value="19">%19 (Standart)</option>
                                                                <option value="custom">📝 Manuel Giriş</option>
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
                                                    <div>
                                                        <label className="block text-sm text-gray-400 mb-1">Açıklama</label>
                                                        <textarea
                                                            rows={2}
                                                            value={formData.description}
                                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Ürün Görselleri */}
                                            <div className="border-b border-gray-700 pb-4">
                                                <h3 className="text-sm font-medium text-purple-400 mb-3">🖼️ Ürün Görselleri (Max 5)</h3>
                                                <div className="space-y-3">
                                                    {/* Image Preview Grid */}
                                                    {((formData as any).images || []).length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {((formData as any).images || []).map((img: string, idx: number) => (
                                                                <div key={idx} className="relative group">
                                                                    <img
                                                                        src={img}
                                                                        alt={`Ürün ${idx + 1}`}
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
                                                                        Yükleniyor...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        📤 Görsel Yükle
                                                                    </>
                                                                )}
                                                            </button>
                                                            <p className="text-xs text-gray-500 mt-1">{5 - ((formData as any).images || []).length} görsel daha ekleyebilirsiniz</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tedarik & İzlenebilirlik (Collapsible) */}
                                            <div className="border-b border-gray-700 pb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, _tedarikOpen: !(prev as any)._tedarikOpen } as any))}
                                                    className="flex items-center justify-between w-full text-sm font-medium text-orange-400 mb-1 hover:text-orange-300 transition-colors"
                                                >
                                                    <span>🚚 Tedarik & İzlenebilirlik</span>
                                                    <span className="text-xs text-gray-500">{(formData as any)._tedarikOpen ? '▲ Kapat' : '▼ Aç'}</span>
                                                </button>
                                                {(formData as any)._tedarikOpen && <div className="grid grid-cols-2 gap-3 mt-3">
                                                    <div>
                                                        <label className="block text-sm text-gray-400 mb-1">Toptancı Adı</label>
                                                        <input
                                                            type="text"
                                                            value={(formData as any).supplierName || ''}
                                                            onChange={e => setFormData({ ...formData, supplierName: e.target.value } as any)}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                            placeholder="Örn: Metro, Selgros"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm text-gray-400 mb-1">Şarj Numarası</label>
                                                        <input
                                                            type="text"
                                                            value={(formData as any).batchNumber || ''}
                                                            onChange={e => setFormData({ ...formData, batchNumber: e.target.value } as any)}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                            placeholder="Lot/Batch No"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm text-gray-400 mb-1">Alış Fiyatı (€)</label>
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
                                                        <label className="block text-sm text-gray-400 mb-1">Satış Fiyatı (€)</label>
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

                                            {/* Tarihler */}
                                            <div className="border-b border-gray-700 pb-4">
                                                <h3 className="text-sm font-medium text-purple-400 mb-3">📅 Tarihler</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm text-gray-400 mb-1">Üretim Tarihi</label>
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

                                            {/* Görsel */}
                                            <div className="border-b border-gray-700 pb-4">
                                                <h3 className="text-sm font-medium text-cyan-400 mb-3">🖼️ Görsel</h3>
                                                <div>
                                                    <label className="block text-sm text-gray-400 mb-1">Görsel URL</label>
                                                    <input
                                                        type="text"
                                                        value={(formData as any).imageAsset || ''}
                                                        onChange={e => setFormData({ ...formData, imageAsset: e.target.value } as any)}
                                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2"
                                                        placeholder="https://... veya assets/images/..."
                                                    />
                                                </div>
                                            </div>

                                            {/* Stok Yönetimi */}
                                            <div>
                                                <h3 className="text-sm font-medium text-emerald-400 mb-3">📦 Stok Yönetimi</h3>
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
                                                        <label className="block text-sm text-gray-400 mb-1">Sipariş Noktası</label>
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
                                                            placeholder="Örn: Raf A-3, Soğuk Depo"
                                                        />
                                                    </div>
                                                </div>
                                                {/* Stok Uyarısı */}
                                                {(formData as any).currentStock > 0 && (formData as any).currentStock <= (formData as any).minStock && (
                                                    <div className="mt-3 bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                                                        <p className="text-red-300 text-sm">⚠️ Stok minimum seviyenin altında! Yeniden sipariş verin.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 🎛️ Ürün Seçenekleri (Lieferando-style Option Groups) */}
                                            <div className="lg:col-span-2 border-t border-gray-700 pt-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-medium text-amber-400">🎛️ Ürün Seçenekleri (Varyantlar / Ekstralar)</h3>
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
                                                        <p className="text-gray-500 text-sm">Henüz seçenek grubu yok</p>
                                                        <p className="text-gray-600 text-xs mt-1">Boyut seçimi, ekstralar veya Sonderwunsch eklemek için &quot;Grup Ekle&quot; butonuna tıklayın</p>
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
                                                                        placeholder="Grup adı (örn: Boyut Seçimi, Ekstralar, Sonderwunsch)"
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
                                                                        <option value="radio">🔘 Tek Seçim (Radio)</option>
                                                                        <option value="checkbox">☑️ Çoklu Seçim (Checkbox)</option>
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
                                                                                <span className="text-[10px] text-gray-600">(-1 = sınırsız)</span>
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
                                                                                placeholder="Seçenek adı (örn: Klein, Groß, mit Käse)"
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
                                                                            <label className="flex items-center gap-1 cursor-pointer" title="Varsayılan seçili">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={opt.defaultSelected || false}
                                                                                    onChange={e => {
                                                                                        const groups = [...(formData as any).optionGroups];
                                                                                        const opts = [...groups[groupIdx].options];
                                                                                        // For radio type, uncheck all others first
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
                                                                                <span className="text-[10px] text-gray-500">Varsayılan</span>
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
                                                                                title="Seçeneği Sil"
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
                                                                        + Seçenek Ekle
                                                                    </button>
                                                                </div>

                                                                {/* Group Summary Badge */}
                                                                {group.options && group.options.length > 0 && (
                                                                    <div className="mt-2 flex gap-2 text-[10px] text-gray-500">
                                                                        <span>{group.options.length} seçenek</span>
                                                                        <span>•</span>
                                                                        <span>{group.type === 'radio' ? 'Tek seçim' : 'Çoklu seçim'}</span>
                                                                        {group.required && <><span>•</span><span className="text-red-400">Zorunlu</span></>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-700">
                                            <button
                                                onClick={() => setShowModal(false)}
                                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                            >
                                                İptal
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
            {confirmModal && (
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
            )}
        </div>
    );
}

// Wrapper with Suspense for useSearchParams (Next.js 16 requirement)
export default function GlobalProductsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        }>
            <GlobalProductsPageContent />
        </Suspense>
    );
}
