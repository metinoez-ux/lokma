'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy, Timestamp, where, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { KERMES_MENU_CATALOG, KermesMenuItemData } from '@/lib/kermes_menu_catalog';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import { MapLocationPicker, SelectedLocation } from '@/components/MapLocationPicker';

// Etkinlik özellikleri - Firestore'dan dinamik yüklenir
interface KermesFeature {
    id: string;
    label: string;
    icon: string;
    color: string;
    isActive: boolean;
}

// Fallback varsayılan özellikler (Firestore erişilemezse)
const DEFAULT_FEATURES: KermesFeature[] = [
    { id: 'family_area', label: 'Aile Bölümü', icon: '👨‍👩‍👧‍👦', color: '#E91E63', isActive: true },
    { id: 'parking', label: 'Otopark', icon: '🅿️', color: '#2196F3', isActive: true },
    { id: 'accessible', label: 'Engelli Erişimi', icon: '♿', color: '#9C27B0', isActive: true },
    { id: 'kids_area', label: 'Çocuk Alanı', icon: '🧒', color: '#4CAF50', isActive: true },
    { id: 'outdoor', label: 'Açık Alan', icon: '🌳', color: '#8BC34A', isActive: true },
    { id: 'indoor', label: 'Kapalı Alan', icon: '🏠', color: '#FF5722', isActive: true },
    { id: 'live_music', label: 'Canlı Müzik', icon: '🎵', color: '#607D8B', isActive: true },
    { id: 'prayer_room', label: 'Namaz Alanı', icon: '🕌', color: '#795548', isActive: true },
    { id: 'vegetarian', label: 'Vejetaryen', icon: '🥗', color: '#4CAF50', isActive: true },
    { id: 'halal', label: 'Helal', icon: '☪️', color: '#009688', isActive: true },
    { id: 'free_entry', label: 'Ücretsiz Giriş', icon: '🎟️', color: '#FF9800', isActive: true },
    { id: 'wifi', label: 'WiFi', icon: '📶', color: '#3F51B5', isActive: true },
];

// Varsayılan kategoriler (ilk yüklemede Firebase'e yazılacak)
const DEFAULT_CATEGORIES = ['Ana Yemek', 'Çorba', 'Tatlı', 'İçecek', 'Aperatif', 'Grill', 'Diğer'];

interface KermesEvent {
    id: string;
    title: string;
    // Bilingual - İkincil dil
    titleSecondary?: string;
    descriptionSecondary?: string;
    secondaryLanguage?: string; // de, tr, nl, fr, en
    description?: string;
    city?: string;
    address?: string;
    location?: string;
    // 2. Sokak Adı
    secondStreetName?: string;
    postalCode?: string;
    country?: string;
    date?: any;
    startDate?: any;
    endDate?: any;
    openingTime?: string;
    closingTime?: string;
    organizerId?: string;
    organizationName?: string;
    isActive?: boolean;
    sponsor?: 'tuna' | 'akdeniz_toros' | 'none';
    // Yetkili kişi - Ayrı alanlar
    contactName?: string;
    contactFirstName?: string;
    contactLastName?: string;
    contactPhone?: string;
    phoneCountryCode?: string;
    features?: string[];
    customCategories?: string[];
    // Nakliyat/Kurye
    hasDelivery?: boolean;
    deliveryFee?: number;
    minCartForFreeDelivery?: number;
    minOrderAmount?: number; // Minimum sipariş tutarı (kurye için)
    // Park imkanları
    parkingLocations?: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        note: string;
        images: string[]; // Max 3 resim URL'si
    }[];
    generalParkingNote?: string;
    // Dinamik özellikler (3 tane özel eklenebilir)
    customFeatures?: string[];
    // Pfand/Depozito sistemi
    hasPfandSystem?: boolean;
    pfandAmount?: number;
    // KDV sistemi
    showKdv?: boolean;
    kdvRate?: number;
    pricesIncludeKdv?: boolean;
    // Başlık görseli (Stok veya özel)
    headerImage?: string;
    headerImageId?: string; // Stok görsel ID'si (kullanım sayacı için)
}

interface KermesProduct {
    id: string;
    masterSku: string;
    name: string;
    secondaryName?: string;  // 2. isim
    price: number;
    costPrice?: number;  // Maliyet fiyatı
    category: string;
    description?: string;
    detailedDescription?: string;  // Detaylı açıklama
    isAvailable: boolean;
    isCustom?: boolean;
    sourceType?: 'master' | 'kermes_catalog' | 'custom';
    barcode?: string;
    unit?: 'adet' | 'porsiyon' | 'litre' | 'kg' | 'gr' | 'bardak' | 'kase';  // Birim
    allergens?: string[];  // Alerjenler
    ingredients?: string[];  // İçerikler
    imageUrls?: string[];  // Görseller (max 3)
}

interface MasterProduct {
    id: string;
    name: string;
    barcode?: string;
    category?: string;
    defaultPrice?: number;
    unit?: string;
}

export default function KermesDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { admin, loading: adminLoading } = useAdmin();
    const kermesId = params.id as string;

    const [kermes, setKermes] = useState<KermesEvent | null>(null);
    const [products, setProducts] = useState<KermesProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [activeTab, setActiveTab] = useState<'bilgi' | 'menu'>('bilgi');
    const [eventFeatures, setEventFeatures] = useState<KermesFeature[]>(DEFAULT_FEATURES);

    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        // Temel bilgiler
        title: '',
        titleSecondary: '',
        description: '',
        descriptionSecondary: '',
        secondaryLanguage: 'de',
        // Tarih/Saat
        date: '', endDate: '', openingTime: '', closingTime: '',
        // Konum
        address: '',
        secondStreetName: '',
        city: '',
        postalCode: '',
        country: '',
        // Yetkili kişi - Ayrı alanlar
        contactName: '',
        contactFirstName: '',
        contactLastName: '',
        contactPhone: '',
        phoneCountryCode: '+49',
        // Nakliyat/Kurye
        hasDelivery: false,
        deliveryFee: 0,
        minCartForFreeDelivery: 0,
        minOrderAmount: 0, // Minimum sipariş tutarı
        // Park imkanları
        parkingLocations: [] as { street: string; city: string; postalCode: string; country: string; note: string; images: string[] }[],
        generalParkingNote: '',
        // Pfand/Depozito sistemi
        hasPfandSystem: false,
        pfandAmount: 0.25,
        // KDV sistemi
        showKdv: false,
        kdvRate: 7,
        pricesIncludeKdv: true,
        // Başlık görseli
        headerImage: '',
        headerImageId: '',
    });
    const [editFeatures, setEditFeatures] = useState<string[]>([]);
    const [editCustomFeatures, setEditCustomFeatures] = useState<string[]>([]); // Max 3 özel özellik
    const [mapPickerOpen, setMapPickerOpen] = useState(false);
    const [mapPickerIndex, setMapPickerIndex] = useState<number | 'new'>('new'); // Hangi park alanı için

    // Categories - dinamik
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Add product modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalView, setModalView] = useState<'select' | 'catalog' | 'master' | 'custom'>('select');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [customProduct, setCustomProduct] = useState({ name: '', category: 'Ana Yemek', price: 0 });

    // Master katalog
    const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
    const [loadingMaster, setLoadingMaster] = useState(false);

    // Stok görseller
    const [stockImages, setStockImages] = useState<{ id: string; url: string; title: string; category: string }[]>([]);
    const [showStockImageModal, setShowStockImageModal] = useState(false);

    // Ürün ekleme öncesi düzenleme modalı
    const [editBeforeAdd, setEditBeforeAdd] = useState<{
        item: KermesMenuItemData | MasterProduct | null;
        type: 'catalog' | 'master';
        price: number;
        category: string;
    } | null>(null);

    // Mevcut ürün düzenleme modalı
    const [editProduct, setEditProduct] = useState<{
        product: KermesProduct;
        price: number;
        costPrice: number;
        category: string;
        unit: string;
        secondaryName: string;
        description: string;
        detailedDescription: string;
        allergens: string[];
        ingredients: string[];
        imageUrls: string[];
        newAllergen: string;
        newIngredient: string;
    } | null>(null);

    // Silme onay modalı
    const [deleteConfirm, setDeleteConfirm] = useState<KermesProduct | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadKermes = useCallback(async () => {
        if (!kermesId) return;
        setLoading(true);
        try {
            const kermesDoc = await getDoc(doc(db, 'kermes_events', kermesId));
            if (!kermesDoc.exists()) {
                showToast('Kermes bulunamadı', 'error');
                router.push('/admin/business');
                return;
            }
            const data = { id: kermesDoc.id, ...kermesDoc.data() } as KermesEvent;
            setKermes(data);

            // Dinamik kategorileri yükle
            if (data.customCategories && data.customCategories.length > 0) {
                setCategories([...DEFAULT_CATEGORIES, ...data.customCategories.filter(c => !DEFAULT_CATEGORIES.includes(c))]);
            }

            const startD = data.date?.toDate?.() || data.startDate?.toDate?.() || null;
            const endD = data.endDate?.toDate?.() || null;
            setEditForm({
                // Temel bilgiler
                title: data.title || '',
                titleSecondary: data.titleSecondary || '',
                description: data.description || '',
                descriptionSecondary: data.descriptionSecondary || '',
                secondaryLanguage: data.secondaryLanguage || 'de',
                // Tarih/Saat
                date: startD ? startD.toISOString().split('T')[0] : '',
                endDate: endD ? endD.toISOString().split('T')[0] : '',
                openingTime: data.openingTime || '',
                closingTime: data.closingTime || '',
                // Konum
                address: data.address || '',
                secondStreetName: data.secondStreetName || '',
                city: data.city || '',
                postalCode: data.postalCode || '',
                country: data.country || '',
                // Yetkili kişi
                contactName: data.contactName || '',
                contactFirstName: data.contactFirstName || '',
                contactLastName: data.contactLastName || '',
                contactPhone: data.contactPhone || '',
                phoneCountryCode: data.phoneCountryCode || '+49',
                // Nakliyat/Kurye
                hasDelivery: data.hasDelivery || false,
                deliveryFee: data.deliveryFee || 0,
                minCartForFreeDelivery: data.minCartForFreeDelivery || 0,
                minOrderAmount: data.minOrderAmount || 0,
                // Park imkanları
                parkingLocations: data.parkingLocations || [],
                generalParkingNote: data.generalParkingNote || '',
                // Pfand/Depozito
                hasPfandSystem: data.hasPfandSystem || false,
                pfandAmount: data.pfandAmount || 0.25,
                // KDV
                showKdv: data.showKdv || false,
                kdvRate: data.kdvRate || 7,
                pricesIncludeKdv: data.pricesIncludeKdv !== false,
                // Başlık görseli
                headerImage: data.headerImage || '',
                headerImageId: data.headerImageId || '',
            });
            setEditFeatures(data.features || []);
            setEditCustomFeatures(data.customFeatures || []);

            const productsQuery = query(collection(db, 'kermes_events', kermesId, 'products'), orderBy('name'));
            const productsSnapshot = await getDocs(productsQuery);
            setProducts(productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as KermesProduct)));
        } catch (error) {
            console.error('Error loading kermes:', error);
            showToast('Yükleme hatası', 'error');
        } finally {
            setLoading(false);
        }
    }, [kermesId, router]);

    // Master katalog ürünlerini yükle
    const loadMasterProducts = async () => {
        setLoadingMaster(true);
        try {
            const q = query(collection(db, 'products'), orderBy('name'));
            const snapshot = await getDocs(q);
            setMasterProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterProduct)));
        } catch (error) {
            console.error('Error loading master products:', error);
        } finally {
            setLoadingMaster(false);
        }
    };

    // Global kategorileri Firebase'den yükle
    const loadCategories = useCallback(async () => {
        try {
            const q = query(collection(db, 'kermes_categories'), orderBy('order'));
            const snapshot = await getDocs(q);
            const firebaseCats = snapshot.docs.map(d => d.data().name as string);

            // Default kategorileri Firebase'dekilerle birleştir
            const allCats = [...DEFAULT_CATEGORIES];
            firebaseCats.forEach(cat => {
                if (!allCats.includes(cat)) {
                    allCats.push(cat);
                }
            });
            setCategories(allCats);

            // Eğer Firebase'de kategori yoksa, default'ları kaydet
            if (snapshot.empty) {
                for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
                    const catName = DEFAULT_CATEGORIES[i];
                    const categoryId = catName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_ğüşöçı]/g, '');
                    await setDoc(doc(db, 'kermes_categories', categoryId), {
                        name: catName, id: categoryId, order: i, createdAt: new Date(),
                    });
                }
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }, []);

    useEffect(() => { loadKermes(); loadCategories(); }, [loadKermes, loadCategories]);

    // Kermes özelliklerini Firestore'dan yükle (Super Admin ayarlarından)
    useEffect(() => {
        const loadFeatures = async () => {
            try {
                const docRef = doc(db, 'settings', 'kermes_features');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const activeFeatures = (data.features || []).filter((f: KermesFeature) => f.isActive);
                    setEventFeatures(activeFeatures);
                }
            } catch (error) {
                console.error('Özellikler yüklenemedi:', error);
                // Hata durumunda varsayılan özellikleri kullan
            }
        };
        loadFeatures();
    }, []);

    // Stok görselleri yükle
    useEffect(() => {
        const loadStockImages = async () => {
            try {
                const imagesQuery = query(
                    collection(db, 'kermes_stock_images'),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(imagesQuery);
                const loadedImages = snapshot.docs.map(d => ({
                    id: d.id,
                    url: d.data().url,
                    title: d.data().title,
                    category: d.data().category || 'genel',
                }));
                setStockImages(loadedImages);
            } catch (error) {
                console.error('Stok görseller yüklenemedi:', error);
            }
        };
        loadStockImages();
    }, []);

    const toggleActiveStatus = async () => {
        if (!kermes) return;
        try {
            await updateDoc(doc(db, 'kermes_events', kermesId), { isActive: !kermes.isActive });
            setKermes({ ...kermes, isActive: !kermes.isActive });
            showToast(kermes.isActive ? 'Kermes kapatıldı' : 'Kermes aktif edildi');
        } catch (error) {
            showToast('Hata oluştu', 'error');
        }
    };

    const handleSaveEdits = async () => {
        if (!kermes) return;
        setSaving(true);
        try {
            const updateData: any = {
                // Temel bilgiler
                title: editForm.title,
                titleSecondary: editForm.titleSecondary || null,
                description: editForm.description || null,
                descriptionSecondary: editForm.descriptionSecondary || null,
                secondaryLanguage: editForm.secondaryLanguage || 'de',
                // Saat
                openingTime: editForm.openingTime || null,
                closingTime: editForm.closingTime || null,
                // Konum
                address: editForm.address || null,
                secondStreetName: editForm.secondStreetName || null,
                city: editForm.city || null,
                postalCode: editForm.postalCode || null,
                country: editForm.country || null,
                // Yetkili kişi
                contactName: editForm.contactName || `${editForm.contactFirstName} ${editForm.contactLastName}`.trim() || null,
                contactFirstName: editForm.contactFirstName || null,
                contactLastName: editForm.contactLastName || null,
                contactPhone: editForm.contactPhone || null,
                phoneCountryCode: editForm.phoneCountryCode || '+49',
                // Özellikler
                features: editFeatures,
                customFeatures: editCustomFeatures,
                // Nakliyat/Kurye
                hasDelivery: editForm.hasDelivery,
                deliveryFee: editForm.deliveryFee || 0,
                minCartForFreeDelivery: editForm.minCartForFreeDelivery || 0,
                minOrderAmount: editForm.minOrderAmount || 0,
                // Park alanları
                parkingLocations: editForm.parkingLocations || [],
                generalParkingNote: editForm.generalParkingNote || '',
                // Pfand/Depozito
                hasPfandSystem: editForm.hasPfandSystem,
                pfandAmount: editForm.pfandAmount || 0,
                // KDV
                showKdv: editForm.showKdv,
                kdvRate: editForm.kdvRate || 7,
                pricesIncludeKdv: editForm.pricesIncludeKdv,
                // Başlık görseli
                headerImage: editForm.headerImage || null,
                headerImageId: editForm.headerImageId || null,
                // Sistem
                updatedAt: new Date(),
            };
            // Tarih alanlarını senkronize et - hem date hem startDate aynı olmalı
            if (editForm.date) {
                const dateTimestamp = Timestamp.fromDate(new Date(editForm.date));
                updateData.date = dateTimestamp;
                updateData.startDate = dateTimestamp; // startDate'i de senkronize et
            }
            if (editForm.endDate) {
                updateData.endDate = Timestamp.fromDate(new Date(editForm.endDate));
            }
            await updateDoc(doc(db, 'kermes_events', kermesId), updateData);
            setKermes({ ...kermes, ...updateData });
            setIsEditing(false);
            showToast('✅ Kaydedildi');
        } catch (error) {
            showToast('Kaydetme hatası', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleFeature = (featureId: string) => {
        setEditFeatures(prev => prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]);
    };

    // Yeni kategori ekle - Firebase'e global olarak kaydet
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const catName = newCategoryName.trim();
        if (categories.includes(catName)) {
            showToast('Bu kategori zaten var', 'error');
            return;
        }

        try {
            // Firebase'e global kategori olarak kaydet
            const categoryId = catName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            await setDoc(doc(db, 'kermes_categories', categoryId), {
                name: catName,
                id: categoryId,
                createdAt: new Date(),
                createdBy: admin?.id,
                order: categories.length,
            });

            setCategories([...categories, catName]);
            setNewCategoryName('');
            setShowCategoryModal(false);
            showToast(`✅ "${catName}" kategorisi eklendi`);
        } catch (error) {
            console.error('Error adding category:', error);
            showToast('Kategori eklenemedi', 'error');
        }
    };

    // Katalogdan ürün seç ve düzenleme modalını aç
    const handleSelectFromCatalog = (item: KermesMenuItemData) => {
        if (products.some(p => p.masterSku === item.sku)) {
            showToast('Zaten menüde', 'error');
            return;
        }
        setEditBeforeAdd({
            item,
            type: 'catalog',
            price: item.defaultPrice,
            category: item.category,
        });
    };

    // Düzenleme modalından onaylanınca ekle
    const handleConfirmAdd = async () => {
        if (!editBeforeAdd?.item) return;
        setSaving(true);
        try {
            const item = editBeforeAdd.item;
            if (editBeforeAdd.type === 'catalog') {
                const catalogItem = item as KermesMenuItemData;
                const productData = {
                    masterSku: catalogItem.sku, name: catalogItem.name, description: catalogItem.description || null,
                    category: editBeforeAdd.category, price: editBeforeAdd.price, isAvailable: true,
                    isCustom: false, sourceType: 'kermes_catalog', createdAt: new Date(), createdBy: admin?.id,
                };
                const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
                setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
                showToast(`✅ ${catalogItem.name} eklendi`);
            } else {
                const masterItem = item as MasterProduct;
                const productData = {
                    masterSku: masterItem.id, name: masterItem.name, description: undefined,
                    category: editBeforeAdd.category, price: editBeforeAdd.price, isAvailable: true,
                    isCustom: false, sourceType: 'master' as const, barcode: masterItem.barcode || undefined,
                    createdAt: new Date(), createdBy: admin?.id,
                };
                const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
                setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
                showToast(`✅ ${masterItem.name} eklendi`);
            }
            setEditBeforeAdd(null);
        } catch (error) {
            showToast('Hata', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Master katalogdan ürün seç ve düzenleme modalını aç
    const handleSelectFromMaster = (item: MasterProduct) => {
        if (products.some(p => p.masterSku === item.id)) {
            showToast('Zaten menüde', 'error');
            return;
        }
        setEditBeforeAdd({
            item,
            type: 'master',
            price: item.defaultPrice || 0,
            category: item.category || 'Diğer',
        });
    };

    // Mevcut ürünü kaydet (tüm alanları güncelle)
    const handleSaveProduct = async () => {
        if (!editProduct) return;
        setSaving(true);
        try {
            const productRef = doc(db, 'kermes_events', kermesId, 'products', editProduct.product.id);
            const updateData: any = {
                price: editProduct.price,
                costPrice: editProduct.costPrice || null,
                category: editProduct.category,
                unit: editProduct.unit || 'adet',
                secondaryName: editProduct.secondaryName || null,
                description: editProduct.description || null,
                detailedDescription: editProduct.detailedDescription || null,
                allergens: editProduct.allergens || [],
                ingredients: editProduct.ingredients || [],
                imageUrls: editProduct.imageUrls || [],
                updatedAt: new Date(),
            };
            await updateDoc(productRef, updateData);
            // Local state güncelle
            setProducts(products.map(p =>
                p.id === editProduct.product.id
                    ? { ...p, ...updateData }
                    : p
            ));
            showToast(`✅ ${editProduct.product.name} güncellendi`);
            setEditProduct(null);
        } catch (error) {
            console.error('Error updating product:', error);
            showToast('Güncelleme hatası', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCustom = async () => {
        if (!customProduct.name.trim() || customProduct.price <= 0) {
            showToast('Ürün adı ve fiyat gerekli', 'error');
            return;
        }
        setSaving(true);
        try {
            const sku = `CUSTOM-${kermesId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
            const productData = {
                masterSku: sku, name: customProduct.name.trim(), category: customProduct.category,
                price: customProduct.price, isAvailable: true, isCustom: true, sourceType: 'custom',
                createdAt: new Date(), createdBy: admin?.id,
            };
            const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
            setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
            setCustomProduct({ name: '', category: 'Ana Yemek', price: 0 });
            setShowAddModal(false);
            showToast(`✅ "${customProduct.name}" oluşturuldu`);
        } catch (error) {
            showToast('Hata', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleAvailability = async (product: KermesProduct) => {
        try {
            await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), { isAvailable: !product.isAvailable });
            setProducts(products.map(p => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p));
        } catch (error) {
            showToast('Hata', 'error');
        }
    };

    // Silme butonuna basınca modal aç
    const handleDeleteProduct = (product: KermesProduct) => {
        setDeleteConfirm(product);
    };

    // Silme onaylandığında
    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteDoc(doc(db, 'kermes_events', kermesId, 'products', deleteConfirm.id));
            setProducts(products.filter(p => p.id !== deleteConfirm.id));
            showToast('Kaldırıldı');
            setDeleteConfirm(null);
        } catch (error) {
            showToast('Hata', 'error');
        }
    };

    const filteredCatalog = Object.values(KERMES_MENU_CATALOG).filter(item => {
        const matchesCat = !selectedCategory || item.category === selectedCategory;
        const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const filteredMaster = masterProducts.filter(item => {
        const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.barcode && item.barcode.includes(searchQuery));
        return matchesSearch;
    });

    const productsByCategory = products.reduce((acc, p) => {
        const cat = p.category || 'Diğer';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {} as Record<string, KermesProduct[]>);

    const getCategoryEmoji = (cat: string) => {
        const e: Record<string, string> = { 'Ana Yemek': '🍖', 'Çorba': '🍲', 'Tatlı': '🍰', 'İçecek': '🥤', 'Aperatif': '🥙', 'Diğer': '📦' };
        return e[cat] || '📦';
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const getFeatureLabel = (featureId: string) => {
        const f = eventFeatures.find(ef => ef.id === featureId);
        return f ? `${f.icon} ${f.label}` : featureId;
    };

    if (adminLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    if (!kermes) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-white">Kermes bulunamadı</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            {/* Toast */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
                    <div className={`px-8 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-lg font-medium border-2 ${toast.type === 'success'
                        ? 'bg-green-600 border-green-400 text-white'
                        : 'bg-red-600 border-red-400 text-white'
                        }`}>
                        <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/business?type=kermes" className="text-gray-400 hover:text-white">← Geri</Link>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">🎪 {kermes.title}</h1>
                            {kermes.organizationName && <p className="text-gray-400 text-sm">🕌 {kermes.organizationName}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {kermes.sponsor === 'tuna' && <span className="px-2 py-1 bg-blue-600/30 text-blue-400 rounded text-xs">🐟 TUNA</span>}
                        {kermes.sponsor === 'akdeniz_toros' && <span className="px-2 py-1 bg-orange-600/30 text-orange-400 rounded text-xs">🏔️ TOROS</span>}
                        <button onClick={toggleActiveStatus}
                            className={`px-3 py-1 rounded-lg text-sm font-medium ${kermes.isActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                            {kermes.isActive ? '✅ Aktif' : '⏸️ Kapalı'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-xl w-fit">
                    <button onClick={() => setActiveTab('bilgi')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'bilgi' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        📋 Bilgiler
                    </button>
                    <button onClick={() => setActiveTab('menu')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'menu' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        🍽️ Menü ({products.length})
                    </button>
                </div>

                {/* Tab Content - Bilgi */}
                {activeTab === 'bilgi' && (
                    <div className="space-y-6">
                        {/* Main Info Card */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-bold">📋 Kermes Bilgileri</h3>
                                {!isEditing ? (
                                    <button onClick={() => {
                                        setEditForm({
                                            title: kermes?.title || '',
                                            titleSecondary: kermes?.titleSecondary || '',
                                            description: kermes?.description || '',
                                            descriptionSecondary: kermes?.descriptionSecondary || '',
                                            secondaryLanguage: kermes?.secondaryLanguage || 'de',
                                            date: kermes?.date ? new Date((kermes.date as any).seconds * 1000).toISOString().split('T')[0] : '',
                                            endDate: kermes?.endDate ? new Date((kermes.endDate as any).seconds * 1000).toISOString().split('T')[0] : '',
                                            openingTime: kermes?.openingTime || '',
                                            closingTime: kermes?.closingTime || '',
                                            address: kermes?.address || '',
                                            secondStreetName: kermes?.secondStreetName || '',
                                            city: kermes?.city || '',
                                            postalCode: kermes?.postalCode || '',
                                            country: kermes?.country || '',
                                            contactName: kermes?.contactName || '',
                                            contactFirstName: kermes?.contactFirstName || '',
                                            contactLastName: kermes?.contactLastName || '',
                                            contactPhone: kermes?.contactPhone || '',
                                            phoneCountryCode: kermes?.phoneCountryCode || '+49',
                                            hasDelivery: kermes?.hasDelivery || false,
                                            deliveryFee: kermes?.deliveryFee || 0,
                                            minCartForFreeDelivery: kermes?.minCartForFreeDelivery || 0,
                                            minOrderAmount: kermes?.minOrderAmount || 0,
                                            parkingLocations: kermes?.parkingLocations || [],
                                            generalParkingNote: kermes?.generalParkingNote || '',
                                            hasPfandSystem: kermes?.hasPfandSystem || false,
                                            pfandAmount: kermes?.pfandAmount || 0.25,
                                            showKdv: kermes?.showKdv || false,
                                            kdvRate: kermes?.kdvRate || 7,
                                            pricesIncludeKdv: kermes?.pricesIncludeKdv !== false,
                                            headerImage: kermes?.headerImage || '',
                                            headerImageId: kermes?.headerImageId || '',
                                        });
                                        setEditFeatures(kermes?.features || []);
                                        setEditCustomFeatures(kermes?.customFeatures || []);
                                        setIsEditing(true);
                                    }} className="px-3 py-1 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600">
                                        ✏️ Düzenle
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditing(false)} className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm">İptal</button>
                                        <button onClick={handleSaveEdits} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
                                            {saving ? '...' : '✓ Kaydet'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-4">
                                    {/* Temel Bilgiler */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Kermes Adı (Türkçe) *</label>
                                            <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Kermes Adı (İkincil Dil)</label>
                                            <input type="text" value={editForm.titleSecondary} onChange={(e) => setEditForm({ ...editForm, titleSecondary: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                                placeholder="z.B. Ramadan Kermes 2026" />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Açıklama (Türkçe)</label>
                                            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" rows={2} />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Açıklama (İkincil Dil)</label>
                                            <textarea value={editForm.descriptionSecondary} onChange={(e) => setEditForm({ ...editForm, descriptionSecondary: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" rows={2} />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Başlangıç Tarihi</label>
                                            <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Bitiş Tarihi</label>
                                            <input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Açılış Saati</label>
                                            <input type="time" value={editForm.openingTime} onChange={(e) => setEditForm({ ...editForm, openingTime: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Kapanış Saati</label>
                                            <input type="time" value={editForm.closingTime} onChange={(e) => setEditForm({ ...editForm, closingTime: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                        </div>
                                    </div>

                                    {/* Konum Bilgileri */}
                                    <div className="pt-4 border-t border-gray-700">
                                        <h4 className="text-white font-medium mb-3">📍 Konum Bilgileri</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <label className="text-gray-400 text-xs block mb-1">Ana Adres <span className="text-blue-400">(Google ile ara)</span></label>
                                                <PlacesAutocomplete
                                                    value={editForm.address || ''}
                                                    onChange={(value) => setEditForm({ ...editForm, address: value })}
                                                    onPlaceSelect={(place) => {
                                                        // Ana adresi ve diğer bilgileri otomatik doldur
                                                        setEditForm({
                                                            ...editForm,
                                                            address: place.street,
                                                            city: place.city,
                                                            postalCode: place.postalCode,
                                                            country: place.country
                                                        });
                                                    }}
                                                    placeholder="Örn: Hauptstraße 10, Köln"
                                                    className="text-sm"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-gray-400 text-xs block mb-1">2. Sokak Adı (Opsiyonel)</label>
                                                <input type="text" value={editForm.secondStreetName} onChange={(e) => setEditForm({ ...editForm, secondStreetName: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                                    placeholder="İkinci sokak adresi varsa girin..." />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Şehir</label>
                                                <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Posta Kodu</label>
                                                <input type="text" value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Ülke</label>
                                                <input type="text" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Header Image Selection */}
                                    <div className="mt-4">
                                        <label className="text-gray-400 text-xs block mb-2">🖼️ Başlık Görseli</label>
                                        <div className="bg-gray-700/50 rounded-lg p-4">
                                            {editForm.headerImage ? (
                                                <div className="relative">
                                                    <img
                                                        src={editForm.headerImage}
                                                        alt="Başlık Görseli"
                                                        className="w-full h-32 object-cover rounded-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditForm({ ...editForm, headerImage: '', headerImageId: '' })}
                                                        className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white rounded text-xs"
                                                    >
                                                        ✕ Kaldır
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowStockImageModal(true)}
                                                    className="w-full h-32 border-2 border-dashed border-gray-500 rounded-lg hover:border-cyan-500 transition flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-cyan-400"
                                                >
                                                    <span className="text-3xl">🖼️</span>
                                                    <span className="text-sm">Stok Görsel Seç</span>
                                                </button>
                                            )}
                                            <p className="text-gray-500 text-xs mt-2 text-center">
                                                Önerilen: 1200×675px (16:9)
                                            </p>
                                        </div>
                                    </div>

                                    {/* Features in Edit Mode */}
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-2">Etkinlik Özellikleri (Sabit)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {eventFeatures.map(f => (
                                                <button key={f.id} type="button" onClick={() => toggleFeature(f.id)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${editFeatures.includes(f.id) ? 'bg-pink-600 text-white' : 'bg-gray-700 text-gray-400'
                                                        }`}
                                                    style={editFeatures.includes(f.id) ? { backgroundColor: f.color } : {}}
                                                >
                                                    {f.icon} {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Features - Max 3 */}
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-2">Özel Özellikler (Max 3)</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editCustomFeatures.map((cf, idx) => (
                                                <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white flex items-center gap-1">
                                                    {cf}
                                                    <button type="button" onClick={() => setEditCustomFeatures(editCustomFeatures.filter((_, i) => i !== idx))}
                                                        className="w-4 h-4 rounded-full bg-blue-800 hover:bg-blue-700 flex items-center justify-center text-xs">×</button>
                                                </span>
                                            ))}
                                        </div>
                                        {editCustomFeatures.length < 3 && (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Yeni özellik adı..."
                                                    id="custom-feature-input"
                                                    className="flex-1 px-3 py-1 bg-gray-700 text-white rounded-lg border border-gray-600 text-xs"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const input = e.target as HTMLInputElement;
                                                            if (input.value.trim() && editCustomFeatures.length < 3) {
                                                                setEditCustomFeatures([...editCustomFeatures, input.value.trim()]);
                                                                input.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const input = document.getElementById('custom-feature-input') as HTMLInputElement;
                                                        if (input?.value.trim() && editCustomFeatures.length < 3) {
                                                            setEditCustomFeatures([...editCustomFeatures, input.value.trim()]);
                                                            input.value = '';
                                                        }
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-500 transition">
                                                    + Ekle
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Yetkili Kişi Bilgileri */}
                                    <div className="pt-4 border-t border-gray-700">
                                        <h4 className="text-white font-medium mb-3">👤 Yetkili Kişi</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Ad *</label>
                                                <input type="text" value={editForm.contactFirstName} onChange={(e) => setEditForm({ ...editForm, contactFirstName: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Soyad *</label>
                                                <input type="text" value={editForm.contactLastName} onChange={(e) => setEditForm({ ...editForm, contactLastName: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Ülke Kodu</label>
                                                <select value={editForm.phoneCountryCode} onChange={(e) => setEditForm({ ...editForm, phoneCountryCode: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                                                    <option value="+49">🇩🇪 +49 (Almanya)</option>
                                                    <option value="+90">🇹🇷 +90 (Türkiye)</option>
                                                    <option value="+31">🇳🇱 +31 (Hollanda)</option>
                                                    <option value="+32">🇧🇪 +32 (Belçika)</option>
                                                    <option value="+33">🇫🇷 +33 (Fransa)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Telefon Numarası</label>
                                                <input type="tel" value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                                    placeholder="Örn: 17612345678" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Kurumsal Ayarlar (Pfand & KDV) */}
                                    <div className="pt-4 border-t border-gray-700">
                                        <h4 className="text-white font-medium mb-3">🏢 Kurumsal Ayarlar</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Pfand Sistemi */}
                                            <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-medium">🍶 Pfand (Depozito) Sistemi</span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={editForm.hasPfandSystem} onChange={(e) => setEditForm({ ...editForm, hasPfandSystem: e.target.checked })} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                    </label>
                                                </div>
                                                {editForm.hasPfandSystem && (
                                                    <div>
                                                        <label className="text-gray-400 text-xs block mb-1">Pfand Ücreti (€)</label>
                                                        <input type="number" step="0.01" value={editForm.pfandAmount} onChange={(e) => setEditForm({ ...editForm, pfandAmount: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* KDV Sistemi */}
                                            <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-medium">🧾 KDV Gösterimi</span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={editForm.showKdv} onChange={(e) => setEditForm({ ...editForm, showKdv: e.target.checked })} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {editForm.showKdv && (
                                                    <div className="space-y-2">
                                                        <div>
                                                            <label className="text-gray-400 text-xs block mb-1">KDV Oranı (%)</label>
                                                            <input type="number" value={editForm.kdvRate} onChange={(e) => setEditForm({ ...editForm, kdvRate: parseFloat(e.target.value) || 0 })}
                                                                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input type="checkbox" checked={editForm.pricesIncludeKdv} onChange={(e) => setEditForm({ ...editForm, pricesIncludeKdv: e.target.checked })}
                                                                className="w-4 h-4 rounded bg-gray-700 border-gray-600" />
                                                            <span className="text-gray-300 text-xs">Fiyatlara KDV Dahil</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nakliyat & Kurye */}
                                    <div className="pt-4 border-t border-gray-700">
                                        <h4 className="text-white font-medium mb-3">🚚 Hizmet Seçenekleri</h4>
                                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-white font-medium">Eve Teslimat (Kurye)</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={editForm.hasDelivery} onChange={(e) => setEditForm({ ...editForm, hasDelivery: e.target.checked })} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                                </label>
                                            </div>
                                            {editForm.hasDelivery && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="text-gray-400 text-xs block mb-1">Teslimat Ücreti (€)</label>
                                                        <input type="number" step="0.50" value={editForm.deliveryFee} onChange={(e) => setEditForm({ ...editForm, deliveryFee: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                                    </div>
                                                    <div>
                                                        <label className="text-gray-400 text-xs block mb-1">Min. Sipariş Tutarı (€)</label>
                                                        <input type="number" step="1.00" value={editForm.minOrderAmount} onChange={(e) => setEditForm({ ...editForm, minOrderAmount: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                                    </div>
                                                    <div>
                                                        <label className="text-gray-400 text-xs block mb-1">Ücretsiz Teslimat Limiti (€)</label>
                                                        <input type="number" step="5.00" value={editForm.minCartForFreeDelivery} onChange={(e) => setEditForm({ ...editForm, minCartForFreeDelivery: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Park İmkanları */}
                                    <div className="pt-4 border-t border-gray-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-white font-medium">🅿️ Park İmkanları</h4>
                                            <button type="button" onClick={() => setEditForm({ ...editForm, parkingLocations: [...editForm.parkingLocations, { street: '', city: '', postalCode: '', country: '', note: '', images: [] }] })}
                                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-500">
                                                + Park Alanı Ekle
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {editForm.parkingLocations.map((loc, idx) => (
                                                <div key={idx} className="bg-gray-800 p-3 rounded-lg border border-gray-600 relative">
                                                    <button type="button" onClick={() => {
                                                        const updated = [...editForm.parkingLocations];
                                                        updated.splice(idx, 1);
                                                        setEditForm({ ...editForm, parkingLocations: updated });
                                                    }} className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs">🗑️ Sil</button>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                                                        <div className="md:col-span-2">
                                                            <label className="text-gray-400 text-xs block mb-1">📍 Park Yeri Adresi / İsim <span className="text-blue-400">(Google ile ara)</span></label>
                                                            <PlacesAutocomplete
                                                                value={loc.street || ''}
                                                                onChange={(value) => {
                                                                    const updated = [...editForm.parkingLocations];
                                                                    updated[idx].street = value;
                                                                    setEditForm({ ...editForm, parkingLocations: updated });
                                                                }}
                                                                onPlaceSelect={(place) => {
                                                                    const updated = [...editForm.parkingLocations];
                                                                    updated[idx] = {
                                                                        ...updated[idx],
                                                                        street: place.street,
                                                                        city: place.city,
                                                                        postalCode: place.postalCode,
                                                                        country: place.country
                                                                    };
                                                                    setEditForm({ ...editForm, parkingLocations: updated });
                                                                }}
                                                                placeholder="Örn: Cami Otoparkı veya Sokak Adı"
                                                                className="text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-gray-400 text-xs block mb-1">Not / Açıklama</label>
                                                            <input type="text" value={loc.note} onChange={(e) => {
                                                                const updated = [...editForm.parkingLocations];
                                                                updated[idx].note = e.target.value;
                                                                setEditForm({ ...editForm, parkingLocations: updated });
                                                            }} className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 text-sm" placeholder="Örn: 50 araç kapasiteli, ücretsiz" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {editForm.parkingLocations.length === 0 && (
                                                <div className="text-gray-500 text-sm italic text-center py-4 bg-gray-800/50 rounded-lg">
                                                    Henüz park alanı eklenmemiş.
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Genel Park Notu (Tüm alanlar için)</label>
                                                <textarea value={editForm.generalParkingNote} onChange={(e) => setEditForm({ ...editForm, generalParkingNote: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm" rows={2} placeholder="Sürücüler için genel uyarılar..." />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">📅 Tarih:</span>
                                            <span className="text-white">{formatDate(kermes.date || kermes.startDate)}</span>
                                        </div>
                                        {kermes.endDate && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">📅 Bitiş:</span>
                                                <span className="text-white">{formatDate(kermes.endDate)}</span>
                                            </div>
                                        )}
                                        {kermes.openingTime && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">🕐 Saat:</span>
                                                <span className="text-white">{kermes.openingTime} - {kermes.closingTime || '?'}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm md:col-span-2">
                                            <span className="text-gray-500">📍 Adres:</span>
                                            <div className="text-right">
                                                <div className="text-white">{kermes.address || '-'}</div>
                                                {(kermes.secondStreetName) && <div className="text-gray-400 text-xs">{kermes.secondStreetName}</div>}
                                                <div className="text-gray-300 text-xs">{[kermes.postalCode, kermes.city, kermes.country].filter(Boolean).join(' ')}</div>
                                            </div>
                                        </div>

                                        {/* Bilingual Bilgiler */}
                                        {kermes.titleSecondary && (
                                            <div className="flex justify-between text-sm md:col-span-2 border-t border-gray-700 pt-2 mt-2">
                                                <span className="text-gray-500">🌍 {kermes.secondaryLanguage?.toUpperCase()} Başlık:</span>
                                                <div className="text-right">
                                                    <div className="text-white">{kermes.titleSecondary}</div>
                                                    {kermes.descriptionSecondary && <div className="text-gray-400 text-xs truncate max-w-[200px]">{kermes.descriptionSecondary}</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Yetkili Kişi */}
                                    {(kermes.contactFirstName || kermes.contactName) && (
                                        <div className="pt-4 border-t border-gray-700">
                                            <span className="text-gray-500 text-sm block mb-2">👤 Yetkili Kişi:</span>
                                            <div className="flex justify-between items-center text-sm">
                                                <div className="text-white">
                                                    {kermes.contactFirstName ? `${kermes.contactFirstName} ${kermes.contactLastName}` : kermes.contactName}
                                                </div>
                                                {kermes.contactPhone && (
                                                    <div className="text-gray-400">
                                                        {kermes.phoneCountryCode} {kermes.contactPhone}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Kurumsal Bilgiler */}
                                    {(kermes.hasPfandSystem || kermes.showKdv) && (
                                        <div className="pt-4 border-t border-gray-700">
                                            <h4 className="text-gray-500 text-sm font-medium mb-2">🏢 Kurumsal Bilgiler</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                {kermes.hasPfandSystem && (
                                                    <div className="bg-gray-800 p-2 rounded border border-gray-600">
                                                        <span className="text-gray-400 block text-xs">Pfand Sistemi</span>
                                                        <span className="text-green-400 font-medium">{kermes.pfandAmount}€</span>
                                                    </div>
                                                )}
                                                {kermes.showKdv && (
                                                    <div className="bg-gray-800 p-2 rounded border border-gray-600">
                                                        <span className="text-gray-400 block text-xs">KDV ({kermes.kdvRate}%)</span>
                                                        <span className="text-blue-400 font-medium">{kermes.pricesIncludeKdv ? 'Dahil' : 'Hariç'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lojistik & Park */}
                                    {(kermes.hasDelivery || (kermes.parkingLocations && kermes.parkingLocations.length > 0)) && (
                                        <div className="pt-4 border-t border-gray-700">
                                            <h4 className="text-gray-500 text-sm font-medium mb-2">🚚 Lojistik & Ulaşım</h4>
                                            <div className="space-y-3">
                                                {kermes.hasDelivery && (
                                                    <div className="flex items-center gap-2 text-sm text-orange-300 bg-gray-800 p-2 rounded border border-gray-600">
                                                        <span>🛵 Eve Teslimat Var</span>
                                                        <span className="text-xs text-gray-400">({kermes.deliveryFee}€, Min Sipariş: {kermes.minOrderAmount}€)</span>
                                                    </div>
                                                )}
                                                {kermes.parkingLocations && kermes.parkingLocations.length > 0 && (
                                                    <div>
                                                        <span className="text-gray-400 text-xs block mb-1">🅿️ Park Alanları ({kermes.parkingLocations.length})</span>
                                                        <div className="space-y-2">
                                                            {kermes.parkingLocations.map((loc, i) => (
                                                                <div key={i} className="text-xs text-gray-300 bg-gray-800 p-2 rounded border border-gray-600">
                                                                    <div className="font-medium text-white">{loc.street}</div>
                                                                    <div className="text-gray-500">{loc.note} {loc.city && `(${loc.city})`}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Features Display */}
                                    {kermes.features && kermes.features.length > 0 && (
                                        <div className="pt-4 border-t border-gray-700">
                                            <span className="text-gray-500 text-sm block mb-2">✨ Özellikler:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {kermes.features.map(fId => (
                                                    <span key={fId} className="px-3 py-1 bg-pink-600/20 text-pink-400 rounded-full text-xs">
                                                        {getFeatureLabel(fId)}
                                                    </span>
                                                ))}
                                                {/* Özel özellikler */}
                                                {kermes.customFeatures && kermes.customFeatures.map((cf: string, idx: number) => (
                                                    <span key={`custom-${idx}`} className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs">
                                                        {cf}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Contact Person Card */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="text-white font-bold mb-4">👤 Yetkili Kişi</h3>
                            {isEditing ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-1">Yetkili Adı</label>
                                        <input type="text" value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" placeholder="Kermesten sorumlu kişi" />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-1">Telefon Numarası</label>
                                        <input type="tel" value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" placeholder="+49 123 456 789" />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-gray-500">👤 İsim:</span>
                                        <span className="text-white">{kermes.contactName || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-gray-500">📞 Telefon:</span>
                                        <span className="text-white">{kermes.contactPhone || '-'}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Nakliyat/Kurye Servisi Card */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="text-white font-bold mb-4">🚚 Kurye / Nakliyat Servisi</h3>
                            {isEditing ? (
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={editForm.hasDelivery}
                                            onChange={(e) => setEditForm({ ...editForm, hasDelivery: e.target.checked })}
                                            className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500" />
                                        <span className="text-white">Kurye Servisi Mevcut</span>
                                    </label>
                                    {editForm.hasDelivery && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">Nakliyat Ücreti (€)</label>
                                                <input type="number" step="0.50" min="0" value={editForm.deliveryFee || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, deliveryFee: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" placeholder="3.00" />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs block mb-1">🚫 Minimum Sipariş Tutarı (€) <span className="text-yellow-400">(Bu tutarın altında kurye kabul edilmez)</span></label>
                                                <input type="number" step="1" min="0" value={editForm.minOrderAmount || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, minOrderAmount: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" placeholder="15" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${kermes.hasDelivery ? 'bg-green-600/30 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
                                            {kermes.hasDelivery ? '✓ Kurye Var' : '✕ Kurye Yok'}
                                        </span>
                                    </div>
                                    {kermes.hasDelivery && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-gray-500">💰 Nakliyat Ücreti:</span>
                                                <span className="text-white font-medium">{(kermes.deliveryFee || 0).toFixed(2)} €</span>
                                            </div>
                                            {(kermes.minOrderAmount || 0) > 0 && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-gray-500">🚫 Min. Sipariş:</span>
                                                    <span className="text-yellow-400 font-medium">{(kermes.minOrderAmount || 0).toFixed(2)} € altında kurye kabul edilmez</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Park İmkanları Card */}
                        <div className="bg-gray-800 rounded-xl p-6">
                            <h3 className="text-white font-bold mb-4">🅿️ Park İmkanları</h3>
                            {isEditing ? (
                                <div className="space-y-4">
                                    {/* Park Locations List */}
                                    {editForm.parkingLocations.map((loc, idx) => (
                                        <div key={idx} className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{idx + 1}</span>
                                                    <span className="text-white font-medium text-sm">Park İmkanı {idx + 1}</span>
                                                </div>
                                                <button onClick={() => {
                                                    const updated = [...editForm.parkingLocations];
                                                    updated.splice(idx, 1);
                                                    setEditForm({ ...editForm, parkingLocations: updated });
                                                }} className="text-red-400 hover:text-red-300 text-xs">🗑️ Sil</button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="md:col-span-2">
                                                    <label className="text-gray-400 text-xs block mb-1">📍 Sokak / Cadde Adresi <span className="text-blue-400">(Google ile ara)</span></label>
                                                    <PlacesAutocomplete
                                                        value={loc.street || ''}
                                                        onChange={(value) => {
                                                            const updated = [...editForm.parkingLocations];
                                                            updated[idx] = { ...updated[idx], street: value };
                                                            setEditForm({ ...editForm, parkingLocations: updated });
                                                        }}
                                                        onPlaceSelect={(place) => {
                                                            // Tüm adres bileşenlerini otomatik doldur
                                                            const updated = [...editForm.parkingLocations];
                                                            updated[idx] = {
                                                                ...updated[idx],
                                                                street: place.street,
                                                                city: place.city,
                                                                postalCode: place.postalCode,
                                                                country: place.country
                                                            };
                                                            setEditForm({ ...editForm, parkingLocations: updated });
                                                        }}
                                                        placeholder="Örn: Hauptstraße 10"
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-gray-400 text-xs block mb-1">Şehir</label>
                                                    <input type="text" value={loc.city || ''} placeholder="Örn: Hückelhoven"
                                                        onChange={(e) => {
                                                            const updated = [...editForm.parkingLocations];
                                                            updated[idx] = { ...updated[idx], city: e.target.value };
                                                            setEditForm({ ...editForm, parkingLocations: updated });
                                                        }}
                                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-gray-400 text-xs block mb-1">Posta Kodu</label>
                                                        <input type="text" value={loc.postalCode || ''} placeholder="41836"
                                                            onChange={(e) => {
                                                                const updated = [...editForm.parkingLocations];
                                                                updated[idx] = { ...updated[idx], postalCode: e.target.value };
                                                                setEditForm({ ...editForm, parkingLocations: updated });
                                                            }}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="text-gray-400 text-xs block mb-1">Ülke</label>
                                                        <input type="text" value={loc.country || ''} placeholder="Almanya"
                                                            onChange={(e) => {
                                                                const updated = [...editForm.parkingLocations];
                                                                updated[idx] = { ...updated[idx], country: e.target.value };
                                                                setEditForm({ ...editForm, parkingLocations: updated });
                                                            }}
                                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm" />
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-gray-400 text-xs block mb-1">Açıklama / Not</label>
                                                    <input type="text" value={loc.note || ''} placeholder="Örn: Caddenin sağ ve sol tarafına park edilebilir"
                                                        onChange={(e) => {
                                                            const updated = [...editForm.parkingLocations];
                                                            updated[idx] = { ...updated[idx], note: e.target.value };
                                                            setEditForm({ ...editForm, parkingLocations: updated });
                                                        }}
                                                        className="w-full px-3 py-2 bg-gray-600 text-gray-300 rounded-lg border border-gray-500 text-sm" />
                                                </div>
                                                {/* Resim Yükleme Bölümü */}
                                                <div className="md:col-span-2">
                                                    <label className="text-gray-400 text-xs block mb-2">📷 Park Resimleri (Max 3)</label>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {(loc.images || []).map((imgUrl, imgIdx) => (
                                                            <div key={imgIdx} className="relative w-20 h-20 bg-gray-700 rounded-lg overflow-hidden group">
                                                                <img src={imgUrl} alt={`Park ${idx + 1} Resim ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                                                <button onClick={() => {
                                                                    const updated = [...editForm.parkingLocations];
                                                                    updated[idx] = { ...updated[idx], images: (loc.images || []).filter((_, i) => i !== imgIdx) };
                                                                    setEditForm({ ...editForm, parkingLocations: updated });
                                                                }} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                                            </div>
                                                        ))}
                                                        {(loc.images || []).length < 3 && (
                                                            <label className="w-20 h-20 bg-gray-700 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors relative">
                                                                <span className="text-gray-400 text-2xl">+</span>
                                                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;

                                                                    // Loading göster
                                                                    const loadingToast = document.createElement('div');
                                                                    loadingToast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg z-50';
                                                                    loadingToast.textContent = '📤 Resim yükleniyor...';
                                                                    document.body.appendChild(loadingToast);

                                                                    try {
                                                                        console.log('🔄 Resim yükleme başlıyor...', file.name);

                                                                        // Firebase Storage'a yükle
                                                                        const fileName = `parking_${idx}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                                                                        const storageRef = ref(storage, `kermes/${kermesId}/parking/${fileName}`);

                                                                        console.log('📂 Storage path:', `kermes/${kermesId}/parking/${fileName}`);

                                                                        await uploadBytes(storageRef, file);
                                                                        console.log('✅ Upload tamamlandı');

                                                                        const downloadUrl = await getDownloadURL(storageRef);
                                                                        console.log('🔗 Download URL:', downloadUrl);

                                                                        const updated = [...editForm.parkingLocations];
                                                                        updated[idx] = { ...updated[idx], images: [...(loc.images || []), downloadUrl].slice(0, 3) };
                                                                        setEditForm({ ...editForm, parkingLocations: updated });

                                                                        loadingToast.textContent = '✅ Resim yüklendi!';
                                                                        loadingToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg z-50';
                                                                        setTimeout(() => loadingToast.remove(), 2000);
                                                                    } catch (error: unknown) {
                                                                        console.error('❌ Resim yükleme hatası:', error);
                                                                        loadingToast.textContent = `❌ Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`;
                                                                        loadingToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg z-50';
                                                                        setTimeout(() => loadingToast.remove(), 5000);
                                                                    }
                                                                }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Park Ekleme Seçenekleri */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Manuel Ekle */}
                                        <button onClick={() => setEditForm({ ...editForm, parkingLocations: [...editForm.parkingLocations, { street: '', city: '', postalCode: '', country: '', note: '', images: [] }] })}
                                            className="py-3 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-400 text-sm flex flex-col items-center gap-1">
                                            <span className="text-lg">✏️</span>
                                            <span>Manuel Ekle</span>
                                        </button>
                                        {/* GPS'den Ekle */}
                                        <button onClick={() => {
                                            setMapPickerIndex('new');
                                            setMapPickerOpen(true);
                                        }}
                                            className="py-3 border-2 border-dashed border-green-600/50 text-green-400 rounded-lg hover:border-green-500 hover:bg-green-900/20 text-sm flex flex-col items-center gap-1">
                                            <span className="text-lg">🛰️</span>
                                            <span>GPS / Harita</span>
                                        </button>
                                        {/* Kermes konumunu kullan */}
                                        <button onClick={() => {
                                            // Kermes'in ana konumunu kopyala
                                            const kermesAddress = kermes?.address || '';
                                            setEditForm({
                                                ...editForm,
                                                parkingLocations: [...editForm.parkingLocations, {
                                                    street: kermesAddress,
                                                    city: kermes?.city || '',
                                                    postalCode: '',
                                                    country: '',
                                                    note: 'Kermes adresi yakını',
                                                    images: []
                                                }]
                                            });
                                        }}
                                            className="py-3 border-2 border-dashed border-purple-600/50 text-purple-400 rounded-lg hover:border-purple-500 hover:bg-purple-900/20 text-sm flex flex-col items-center gap-1">
                                            <span className="text-lg">📍</span>
                                            <span>Kermes Konumu</span>
                                        </button>
                                    </div>

                                    {/* General Parking Note */}
                                    <div className="pt-4 border-t border-gray-700">
                                        <label className="text-gray-400 text-xs block mb-2">Genel Park Bilgisi Notu</label>
                                        <textarea value={editForm.generalParkingNote} placeholder="Ziyaretçilere gösterilecek genel park bilgisi..."
                                            onChange={(e) => setEditForm({ ...editForm, generalParkingNote: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm h-20 resize-none" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {kermes.parkingLocations && kermes.parkingLocations.length > 0 ? (
                                        <>
                                            {kermes.parkingLocations.map((loc: any, idx: number) => (
                                                <div key={idx} className="bg-gray-700/30 rounded-lg p-3">
                                                    <div className="flex items-start gap-3">
                                                        <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{idx + 1}</span>
                                                        <div className="flex-1">
                                                            <p className="text-white text-sm font-medium">
                                                                {loc.street || loc.address}{loc.city && `, ${loc.city}`}
                                                            </p>
                                                            {(loc.postalCode || loc.country) && (
                                                                <p className="text-gray-400 text-xs">{[loc.postalCode, loc.country].filter(Boolean).join(', ')}</p>
                                                            )}
                                                            {loc.note && <p className="text-gray-400 text-xs mt-1 italic">{loc.note}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <p className="text-gray-500 text-sm">Park imkanı bilgisi eklenmemiş</p>
                                    )}
                                    {kermes.generalParkingNote && (
                                        <div className="pt-3 border-t border-gray-700">
                                            <p className="text-gray-400 text-xs">ℹ️ {kermes.generalParkingNote}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Content - Menu */}
                {activeTab === 'menu' && (
                    <div className="bg-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold">🍽️ Kermes Menüsü</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setShowCategoryModal(true)}
                                    className="px-3 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-600/40">
                                    ➕ Kategori Ekle
                                </button>
                                <button onClick={() => { setShowAddModal(true); setModalView('select'); }}
                                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm font-medium">
                                    ➕ Ürün Ekle
                                </button>
                            </div>
                        </div>

                        {/* Kategori Tab'ları - TÜM Kategoriler */}
                        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-700">
                            <button
                                onClick={() => setSelectedCategory('')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedCategory === ''
                                    ? 'bg-pink-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}>
                                🍽️ Tümü ({products.length})
                            </button>
                            {categories.map(category => {
                                const count = productsByCategory[category]?.length || 0;
                                return (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedCategory === category
                                            ? 'bg-pink-600 text-white'
                                            : count > 0
                                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                : 'bg-gray-800 text-gray-500 hover:bg-gray-700 border border-gray-600 border-dashed'
                                            }`}>
                                        {getCategoryEmoji(category)} {category} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {products.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-4xl mb-3">🍽️</p>
                                <p className="text-gray-400 mb-4">Henüz menüde ürün yok</p>
                                <button onClick={() => { setShowAddModal(true); setModalView('select'); }}
                                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm">
                                    İlk Ürünü Ekle
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(productsByCategory)
                                    .filter(([category]) => !selectedCategory || category === selectedCategory)
                                    .map(([category, items]) => (
                                        <div key={category}>
                                            <h4 className="text-pink-400 text-sm font-medium mb-2">{getCategoryEmoji(category)} {category}</h4>
                                            <div className="space-y-2">
                                                {items.map((product) => (
                                                    <div key={product.id} className={`bg-gray-700 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-600 transition ${!product.isAvailable ? 'opacity-50' : ''}`}
                                                        onClick={() => setEditProduct({
                                                            product,
                                                            price: product.price,
                                                            costPrice: product.costPrice || 0,
                                                            category: product.category,
                                                            unit: product.unit || 'adet',
                                                            secondaryName: product.secondaryName || '',
                                                            description: product.description || '',
                                                            detailedDescription: product.detailedDescription || '',
                                                            allergens: product.allergens || [],
                                                            ingredients: product.ingredients || [],
                                                            imageUrls: product.imageUrls || [],
                                                            newAllergen: '',
                                                            newIngredient: '',
                                                        })}>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-white font-medium">{product.name}</span>
                                                            {product.isCustom && <span className="px-2 py-0.5 bg-purple-600/30 text-purple-400 rounded text-xs">Özel</span>}
                                                            {product.sourceType === 'master' && <span className="px-2 py-0.5 bg-blue-600/30 text-blue-400 rounded text-xs">Barkod</span>}
                                                            <span className="text-green-400 font-bold">{product.price.toFixed(2)} €</span>
                                                            <span className="text-gray-500 text-xs">✏️ düzenle</span>
                                                        </div>
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button onClick={() => handleToggleAvailability(product)}
                                                                className={`px-2 py-1 rounded text-xs ${product.isAvailable ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}`}>
                                                                {product.isAvailable ? '✓ Mevcut' : '✕ Tükendi'}
                                                            </button>
                                                            <button onClick={() => handleDeleteProduct(product)} className="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded text-xs">🗑️</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-white mb-4">➕ Yeni Kategori Ekle</h2>
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Kategori adı (örn: Salata)"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowCategoryModal(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg">İptal</button>
                            <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50">Ekle</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Product Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {modalView !== 'select' && <button onClick={() => setModalView('select')} className="text-gray-400 hover:text-white">←</button>}
                                <h2 className="text-lg font-bold text-white">
                                    {modalView === 'select' && '➕ Ürün Ekle'}
                                    {modalView === 'catalog' && '🎪 Kermes Kataloğu'}
                                    {modalView === 'master' && '📦 Master Katalog (Barkodlu)'}
                                    {modalView === 'custom' && '✨ Özel Ürün'}
                                </h2>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {modalView === 'select' && (
                                <div className="grid grid-cols-3 gap-4">
                                    <button onClick={() => setModalView('catalog')} className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 text-left">
                                        <div className="text-3xl mb-2">🎪</div>
                                        <h3 className="text-white font-bold">Kermes Kataloğu</h3>
                                        <p className="text-gray-400 text-sm">Hazır yemek listesi</p>
                                    </button>
                                    <button onClick={() => { setModalView('master'); loadMasterProducts(); }} className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 text-left">
                                        <div className="text-3xl mb-2">📦</div>
                                        <h3 className="text-white font-bold">Master Katalog</h3>
                                        <p className="text-gray-400 text-sm">Barkodlu ürünler</p>
                                    </button>
                                    <button onClick={() => setModalView('custom')} className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 text-left">
                                        <div className="text-3xl mb-2">✨</div>
                                        <h3 className="text-white font-bold">Özel Ürün</h3>
                                        <p className="text-gray-400 text-sm">Kendi ürününüzü ekleyin</p>
                                    </button>
                                </div>
                            )}

                            {modalView === 'catalog' && (
                                <>
                                    <div className="flex gap-2 mb-4">
                                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ara..."
                                            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm" />
                                        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm">
                                            <option value="">Tümü</option>
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {filteredCatalog.map((item) => {
                                            const isAdded = products.some(p => p.masterSku === item.sku);
                                            return (
                                                <div key={item.sku} className={`bg-gray-700 rounded-lg p-3 flex items-center justify-between ${isAdded ? 'opacity-50' : ''}`}>
                                                    <div>
                                                        <span className="text-white">{item.name}</span>
                                                        <span className="text-gray-500 text-sm ml-2">{item.category}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-green-400 font-bold">{item.defaultPrice.toFixed(2)} €</span>
                                                        {isAdded ? <span className="text-gray-400 text-xs">✓</span> : (
                                                            <button onClick={() => handleSelectFromCatalog(item)} disabled={saving}
                                                                className="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded text-sm disabled:opacity-50">Ekle</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {modalView === 'master' && (
                                <>
                                    <div className="mb-4">
                                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ürün adı veya barkod ile ara..."
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 text-sm" />
                                    </div>
                                    {loadingMaster ? (
                                        <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
                                    ) : filteredMaster.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            {masterProducts.length === 0 ? 'Master katalog boş' : 'Sonuç bulunamadı'}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {filteredMaster.map((item) => {
                                                const isAdded = products.some(p => p.masterSku === item.id);
                                                return (
                                                    <div key={item.id} className={`bg-gray-700 rounded-lg p-3 flex items-center justify-between ${isAdded ? 'opacity-50' : ''}`}>
                                                        <div>
                                                            <span className="text-white">{item.name}</span>
                                                            {item.barcode && <span className="text-gray-500 text-xs ml-2">#{item.barcode}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {item.defaultPrice && <span className="text-green-400 font-bold">{item.defaultPrice.toFixed(2)} €</span>}
                                                            {isAdded ? <span className="text-gray-400 text-xs">✓</span> : (
                                                                <button onClick={() => handleSelectFromMaster(item)} disabled={saving}
                                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm disabled:opacity-50">Ekle</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}

                            {modalView === 'custom' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-gray-400 text-sm block mb-1">Ürün Adı *</label>
                                        <input type="text" value={customProduct.name} onChange={(e) => setCustomProduct({ ...customProduct, name: e.target.value })}
                                            placeholder="örn: Ev Yapımı Baklava" className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm block mb-1">Kategori</label>
                                        <select value={customProduct.category} onChange={(e) => setCustomProduct({ ...customProduct, category: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm block mb-1">Fiyat (€) *</label>
                                        <input type="number" step="0.50" min="0" value={customProduct.price || ''} onChange={(e) => setCustomProduct({ ...customProduct, price: parseFloat(e.target.value) || 0 })}
                                            placeholder="0.00" className="w-full px-3 py-2 bg-gray-700 text-white text-xl font-bold rounded-lg border border-gray-600" />
                                    </div>
                                    <button onClick={handleCreateCustom} disabled={saving || !customProduct.name.trim() || customProduct.price <= 0}
                                        className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium disabled:opacity-50">
                                        {saving ? '⏳ Oluşturuluyor...' : '✨ Oluştur ve Ekle'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Ürün Ekleme Öncesi Düzenleme Modalı */}
            {editBeforeAdd && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-white mb-4">
                            ✏️ Ürün Ekle: {editBeforeAdd.type === 'catalog'
                                ? (editBeforeAdd.item as KermesMenuItemData).name
                                : (editBeforeAdd.item as MasterProduct).name}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-gray-400 text-sm block mb-2">Menü Kategorisi</label>
                                <select value={editBeforeAdd.category} onChange={(e) => setEditBeforeAdd({ ...editBeforeAdd, category: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600">
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-2">Kermes Fiyatı (€)</label>
                                <input type="number" step="0.50" min="0" value={editBeforeAdd.price || ''}
                                    onChange={(e) => setEditBeforeAdd({ ...editBeforeAdd, price: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-gray-700 text-white text-xl font-bold rounded-lg border border-gray-600" placeholder="0.00" />
                                <p className="text-gray-500 text-xs mt-1">
                                    Varsayılan: {editBeforeAdd.type === 'catalog'
                                        ? (editBeforeAdd.item as KermesMenuItemData).defaultPrice.toFixed(2)
                                        : ((editBeforeAdd.item as MasterProduct).defaultPrice || 0).toFixed(2)} €
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditBeforeAdd(null)} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium">İptal</button>
                            <button onClick={handleConfirmAdd} disabled={saving || editBeforeAdd.price <= 0}
                                className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium disabled:opacity-50">
                                {saving ? '⏳ Ekleniyor...' : '✅ Menüye Ekle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mevcut Ürün Düzenleme Modalı - Geliştirilmiş */}
            {editProduct && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">
                                ✏️ Düzenle: {editProduct.product.name}
                            </h2>
                            <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-white text-xl">×</button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Fiyat Bilgileri */}
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <h3 className="text-gray-300 text-sm font-medium mb-3">💰 Fiyat Bilgileri</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-1">Satış Fiyatı (€)</label>
                                        <input type="number" step="0.50" min="0" value={editProduct.price || ''}
                                            onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-gray-700 text-green-400 text-xl font-bold rounded-lg border border-gray-600" placeholder="0.00" />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-1">Maliyet Fiyatı (€)</label>
                                        <input type="number" step="0.10" min="0" value={editProduct.costPrice || ''}
                                            onChange={(e) => setEditProduct({ ...editProduct, costPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-gray-700 text-orange-400 text-lg font-medium rounded-lg border border-gray-600" placeholder="0.00" />
                                        {editProduct.costPrice > 0 && editProduct.price > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Kar: {(editProduct.price - editProduct.costPrice).toFixed(2)}€ ({((editProduct.price - editProduct.costPrice) / editProduct.costPrice * 100).toFixed(0)}%)
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Kategori ve Birim */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">Kategori</label>
                                    <select value={editProduct.category} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">Birim</label>
                                    <select value={editProduct.unit} onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600">
                                        <option value="adet">Adet</option>
                                        <option value="porsiyon">Porsiyon</option>
                                        <option value="bardak">Bardak</option>
                                        <option value="kase">Kase</option>
                                        <option value="litre">Litre</option>
                                        <option value="kg">Kilogram (kg)</option>
                                        <option value="gr">Gram (gr)</option>
                                    </select>
                                </div>
                            </div>

                            {/* 2. İsim */}
                            <div>
                                <label className="text-gray-400 text-xs block mb-1">2. İsim (Opsiyonel)</label>
                                <input type="text" value={editProduct.secondaryName || ''}
                                    onChange={(e) => setEditProduct({ ...editProduct, secondaryName: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="Örn: Türkçe veya Almanca alternatif isim" />
                            </div>

                            {/* Açıklama */}
                            <div>
                                <label className="text-gray-400 text-xs block mb-1">Kısa Açıklama</label>
                                <input type="text" value={editProduct.description || ''}
                                    onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                    placeholder="Menüde görünecek kısa açıklama" />
                            </div>

                            {/* Detaylı Açıklama */}
                            <div>
                                <label className="text-gray-400 text-xs block mb-1">Detaylı Tarif (Opsiyonel)</label>
                                <textarea value={editProduct.detailedDescription || ''}
                                    onChange={(e) => setEditProduct({ ...editProduct, detailedDescription: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 min-h-[80px]"
                                    placeholder="Detaylı bilgi, tarif veya ürün hakkında notlar..." />
                            </div>

                            {/* Alerjenler */}
                            <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-800/30">
                                <label className="text-orange-400 text-sm font-medium block mb-2">⚠️ Alerjenler</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editProduct.allergens.map((allergen, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-orange-600/30 text-orange-300 rounded-full text-xs flex items-center gap-1">
                                            {allergen}
                                            <button onClick={() => setEditProduct({ ...editProduct, allergens: editProduct.allergens.filter((_, i) => i !== idx) })}
                                                className="w-4 h-4 rounded-full bg-orange-700 hover:bg-orange-600 flex items-center justify-center">×</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={editProduct.newAllergen}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val && !editProduct.allergens.includes(val)) {
                                                setEditProduct({ ...editProduct, allergens: [...editProduct.allergens, val], newAllergen: '' });
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 bg-gray-700 text-white rounded-lg border border-gray-600 text-xs">
                                        <option value="">Alerjen seç...</option>
                                        <option value="Gluten">Gluten</option>
                                        <option value="Süt">Süt Ürünleri</option>
                                        <option value="Yumurta">Yumurta</option>
                                        <option value="Fındık">Fındık/Kabuklu Yemiş</option>
                                        <option value="Yer Fıstığı">Yer Fıstığı</option>
                                        <option value="Soya">Soya</option>
                                        <option value="Balık">Balık</option>
                                        <option value="Kabuklu Deniz">Kabuklu Deniz Ürünleri</option>
                                        <option value="Kereviz">Kereviz</option>
                                        <option value="Hardal">Hardal</option>
                                        <option value="Susam">Susam</option>
                                        <option value="Sülfür Dioksit">Sülfür Dioksit</option>
                                    </select>
                                    <input type="text" value={editProduct.newAllergen || ''}
                                        onChange={(e) => setEditProduct({ ...editProduct, newAllergen: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && editProduct.newAllergen?.trim()) {
                                                e.preventDefault();
                                                if (!editProduct.allergens.includes(editProduct.newAllergen.trim())) {
                                                    setEditProduct({ ...editProduct, allergens: [...editProduct.allergens, editProduct.newAllergen.trim()], newAllergen: '' });
                                                }
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 bg-gray-700 text-white rounded-lg border border-gray-600 text-xs"
                                        placeholder="veya özel alerjen yaz..." />
                                </div>
                            </div>

                            {/* İçerikler */}
                            <div className="bg-gray-700/30 rounded-xl p-4">
                                <label className="text-gray-300 text-sm font-medium block mb-2">🥘 İçerikler / Zutaten</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editProduct.ingredients.map((ingredient, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-gray-600 text-gray-200 rounded-full text-xs flex items-center gap-1">
                                            {ingredient}
                                            <button onClick={() => setEditProduct({ ...editProduct, ingredients: editProduct.ingredients.filter((_, i) => i !== idx) })}
                                                className="w-4 h-4 rounded-full bg-gray-500 hover:bg-gray-400 flex items-center justify-center">×</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" value={editProduct.newIngredient || ''}
                                        onChange={(e) => setEditProduct({ ...editProduct, newIngredient: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && editProduct.newIngredient?.trim()) {
                                                e.preventDefault();
                                                if (!editProduct.ingredients.includes(editProduct.newIngredient.trim())) {
                                                    setEditProduct({ ...editProduct, ingredients: [...editProduct.ingredients, editProduct.newIngredient.trim()], newIngredient: '' });
                                                }
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 bg-gray-700 text-white rounded-lg border border-gray-600 text-xs"
                                        placeholder="İçerik adı yazıp Enter'a basın" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (editProduct.newIngredient?.trim() && !editProduct.ingredients.includes(editProduct.newIngredient.trim())) {
                                                setEditProduct({ ...editProduct, ingredients: [...editProduct.ingredients, editProduct.newIngredient.trim()], newIngredient: '' });
                                            }
                                        }}
                                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs">+ Ekle</button>
                                </div>
                            </div>

                            {/* TODO: Görseller - Gelecekte eklenecek */}
                            {/* <div className="bg-gray-700/30 rounded-xl p-4">
                                <label className="text-gray-300 text-sm font-medium block mb-2">📷 Görseller (Max 3)</label>
                                ... Image upload will be added here ...
                            </div> */}
                        </div>

                        {/* Footer Buttons */}
                        <div className="sticky bottom-0 bg-gray-800 px-6 py-4 border-t border-gray-700 flex gap-3">
                            <button onClick={() => setEditProduct(null)} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium">İptal</button>
                            <button onClick={handleSaveProduct} disabled={saving || editProduct.price <= 0}
                                className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium disabled:opacity-50">
                                {saving ? '⏳ Kaydediliyor...' : '✅ Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Silme Onay Modalı */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-sm p-6 text-center">
                        <div className="text-4xl mb-4">🗑️</div>
                        <h2 className="text-lg font-bold text-white mb-2">Ürün Kaldırılsın mı?</h2>
                        <p className="text-gray-400 mb-6">
                            <span className="text-pink-400 font-medium">"{deleteConfirm.name}"</span> menüden kaldırılacak.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium">İptal</button>
                            <button onClick={handleConfirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium">🗑️ Kaldır</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Map Location Picker Modal */}
            {/* Stok Görsel Seçme Modalı */}
            {showStockImageModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">🖼️ Stok Görsel Seç</h2>
                            <button
                                onClick={() => setShowStockImageModal(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            {stockImages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">🖼️</div>
                                    <h3 className="text-lg font-medium text-white mb-2">Henüz Stok Görsel Yok</h3>
                                    <p className="text-gray-400 mb-4">
                                        Super Admin olarak "Stok Görseller" sayfasından görsel yükleyebilirsiniz.
                                    </p>
                                    <Link
                                        href="/admin/settings/kermes-stock-images"
                                        className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg"
                                    >
                                        ➕ Görsel Yükle
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {stockImages.map((img) => (
                                        <button
                                            key={img.id}
                                            onClick={() => {
                                                setEditForm({ ...editForm, headerImage: img.url, headerImageId: img.id });
                                                setShowStockImageModal(false);
                                            }}
                                            className="bg-gray-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-cyan-500 transition group"
                                        >
                                            <div className="aspect-video bg-gray-900 relative">
                                                <img
                                                    src={img.url}
                                                    alt={img.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                    <span className="text-white font-medium">✓ Seç</span>
                                                </div>
                                            </div>
                                            <div className="p-2">
                                                <p className="text-white text-sm truncate">{img.title}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                            <p className="text-gray-500 text-xs text-center">
                                📐 Önerilen boyut: 1200×675 piksel (16:9 oranı)
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <MapLocationPicker
                isOpen={mapPickerOpen}
                onClose={() => setMapPickerOpen(false)}
                onLocationSelect={(location: SelectedLocation) => {
                    // Yeni park alanı ekle veya mevcut olanı güncelle
                    if (mapPickerIndex === 'new') {
                        setEditForm({
                            ...editForm,
                            parkingLocations: [...editForm.parkingLocations, {
                                street: location.street || location.address,
                                city: location.city || '',
                                postalCode: location.postalCode || '',
                                country: location.country || '',
                                note: '',
                                images: []
                            }]
                        });
                    } else {
                        const updated = [...editForm.parkingLocations];
                        updated[mapPickerIndex] = {
                            ...updated[mapPickerIndex],
                            street: location.street || location.address,
                            city: location.city || '',
                            postalCode: location.postalCode || '',
                            country: location.country || ''
                        };
                        setEditForm({ ...editForm, parkingLocations: updated });
                    }
                }}
                initialLat={51.0}
                initialLng={9.0}
            />
        </div>
    );
}
