'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, query, orderBy, getDoc, runTransaction, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeTurkish } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '@/components/providers/AdminProvider';
import { useTranslations } from 'next-intl';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { BUSINESS_TYPES, getBusinessType, getBusinessTypeIcon, getBusinessTypeLabel } from '@/lib/business-types';
import { useSectors } from '@/hooks/useSectors';
import { subscriptionService } from '@/services/subscriptionService';
import { formatCurrency } from '@/utils/currency';
// OpeningHoursEditor disabled - causing crashes

// Counter for unique business IDs (starts at 100001, never reused)
const BUSINESS_COUNTER_DOC = 'business_counter';
const STARTING_BUSINESS_NUMBER = 100001;

// Get next unique business number atomically
async function getNextBusinessNumber(): Promise<string> {
    const counterRef = doc(db, 'system_config', BUSINESS_COUNTER_DOC);

    const newNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let currentNumber: number;
        if (!counterDoc.exists()) {
            // Initialize counter if it doesn't exist
            currentNumber = STARTING_BUSINESS_NUMBER;
            transaction.set(counterRef, { lastNumber: currentNumber });
        } else {
            currentNumber = (counterDoc.data().lastNumber || STARTING_BUSINESS_NUMBER - 1) + 1;
            transaction.update(counterRef, { lastNumber: currentNumber });
        }

        return currentNumber;
    });

    return newNumber.toString();
}

type BusinessType = string;

interface Business {
    id: string;
    companyName: string;
    brand?: string;
    businessCategories?: string[];
    address?: {
        street?: string;
        city?: string;
        postalCode?: string;
        state?: string;
        country?: string;
        lat?: number;
        lng?: number;
    };
    currency?: string;
    contact?: {
        phone?: string;
        email?: string;
        website?: string;
    };
    services?: {
        delivery?: boolean;
        pickup?: boolean;
        dineIn?: boolean;
        reservation?: boolean;
    };
    deliveryConfig?: {
        enabled?: boolean;
        radiusKm?: number;
        fee?: number;
        minOrder?: number;
    };
    isActive?: boolean;
    createdAt?: any;
    orderCount?: number;
    googlePlaceId?: string;
    rating?: number;
    reviewCount?: number;
    lat?: number;
    lng?: number;
    imageUrl?: string;
    openingHours?: string;
    // Financial & Subscription Fields
    bankInfo?: {
        accountHolder?: string;
        iban?: string;
        bic?: string;
        bankName?: string;
    };
    subscription?: {
        planId?: string;
        planName?: string;
        startDate?: any;
        endDate?: any;
        status?: 'active' | 'cancelled' | 'paused' | 'trial';
        cancelledAt?: any;
        monthlyFee?: number;
        commissionRate?: number;
    };
    orderStats?: {
        totalOrders?: number;
        dailyAverage?: number;
        lastOrderDate?: any;
        totalRevenue?: number;
    };
    billing?: {
        lastPaymentDate?: any;
        lastPaymentAmount?: number;
        openBalance?: number;
        invoiceCount?: number;
    };
    // Brand Label (Super Admin Only)
    brandLabel?: 'tuna' | 'akdeniz_toros' | null;
    // Masa & Kapasite (Rezervasyon için)
    tableCount?: number;
    seatCapacity?: number;
}

export default function BusinessesPage() {
    const t = useTranslations('AdminBusiness');
    const { admin, loading: adminLoading } = useAdmin();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { getActiveSectors, getBusinessTypesList: getDynamicTypesList, loading: sectorsLoading } = useSectors();

    // RBAC Guard: Only super admins can access the platform-level business management page
    if (!adminLoading && admin && admin.adminType !== 'super') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="bg-card border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
                    <div className="text-5xl mb-4">&#128274;</div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Zugriff verweigert</h2>
                    <p className="text-muted-foreground mb-6">
                        Diese Seite ist nur fur Super-Administratoren zugänglich.
                    </p>
                    <button
                        onClick={() => router.push('/admin/settings')}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                        Zu den Einstellungen
                    </button>
                </div>
            </div>
        );
    }
    // Only show ACTIVE sectors in the UI, EXCLUDE kermes since it's now a separate module
    const businessTypes = getActiveSectors()
        .filter(s => s.id !== 'kermes') // Kermes is now accessed via Admin Header → 🎪 Kermes
        .map(s => ({
            value: s.id,
            label: s.label,
            icon: s.icon,
            color: s.color,
            description: s.description,
        }));
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [brandFilter, setBrandFilter] = useState<'all' | 'tuna' | 'akdeniz_toros' | 'none'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    // Review popup state
    const [reviewModal, setReviewModal] = useState<{ open: boolean; business: Business | null }>({ open: false, business: null });
    // ConfirmModal state
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        itemName?: string;
        variant?: 'warning' | 'danger';
        confirmText: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', confirmText: '', onConfirm: () => { } });

    // 📄 Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const BUSINESSES_PER_PAGE = 10;

    // 🆕 KERMES SEKTÖRÜ İÇİN - Organizations state (arka plan verisi)
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loadingOrganizations, setLoadingOrganizations] = useState(false);
    const [orgPage, setOrgPage] = useState(1);
    const ORGS_PER_PAGE = 10;

    // 🕐 Son Kullanılanlar - Recent businesses from localStorage
    const [recentBusinesses, setRecentBusinesses] = useState<any[]>([]);
    const [showRecent, setShowRecent] = useState(false);
    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('lokma_recent_businesses') || '[]');
            setRecentBusinesses(stored);
        } catch (e) {
            // Ignore
        }
    }, []);

    // 🆕 KERMES EVENTS - Ana liste
    const [kermesEvents, setKermesEvents] = useState<any[]>([]);
    const [loadingKermesEvents, setLoadingKermesEvents] = useState(false);

    // 🆕 Organizasyon arama modal'ı
    const [showOrgSearchModal, setShowOrgSearchModal] = useState(false);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');

    // 🆕 Dynamically loaded subscription plans from Firestore
    const [availablePlans, setAvailablePlans] = useState<{ code: string; name: string; color: string }[]>([]);
    useEffect(() => {
        subscriptionService.getAllPlans().then(plans => {
            setAvailablePlans(plans.map(p => ({
                code: p.code || p.id,
                name: p.name,
                color: p.color || 'bg-gray-600',
            })));
        }).catch(err => console.error('Error loading plans:', err));
    }, []);

    // Read type from URL query param on mount (e.g., ?type=restoran)
    useEffect(() => {
        if (searchParams) {
            const typeFromUrl = searchParams.get('type');
            // Check if type is valid in dynamic sectors (kermes excluded - it's a separate module)
            if (typeFromUrl && businessTypes.some(t => t.value === typeFromUrl)) {
                setTypeFilter(typeFromUrl);
            }
        }
    }, [businessTypes, searchParams]);

    // Google Places Import States
    const [activeTab, setActiveTab] = useState<'manual' | 'google'>('manual');
    const [searchQuery2, setSearchQuery2] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    // const [openingHoursSchedule, setOpeningHoursSchedule] = useState<any[]>([]); // Disabled - causing crashes
    const [isRefreshingHours, setIsRefreshingHours] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        companyName: '',
        brand: '',
        type: 'kasap' as BusinessType,
        street: '',
        city: '',
        postalCode: '',
        country: 'DE',
        currency: 'EUR',
        phone: '',
        email: '',
        website: '',
        delivery: true,
        pickup: true,
        dineIn: false,
        reservation: false,
        isActive: true,
        googlePlaceId: '',
        rating: 0,
        reviewCount: 0,
        lat: 0,
        lng: 0,
        imageUrl: '',
        openingHours: '',
        // Bank Info
        bankAccountHolder: '',
        bankIban: '',
        bankBic: '',
        bankName: '',
        // Subscription
        subscriptionPlan: 'none',
        subscriptionMonthlyFee: 0,
        subscriptionCommissionRate: 0,
        subscriptionStatus: 'active' as 'active' | 'cancelled' | 'paused' | 'trial',
        // Brand Label (Super Admin Only)
        brandLabel: null as 'tuna' | 'akdeniz_toros' | null,
        // Masa & Kapasite (Rezervasyon için)
        tableCount: 0,
        seatCapacity: 0,
    });

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Load all businesses
    const loadBusinesses = useCallback(async () => {
        // Defense-in-depth: Non-super admins should not load all businesses
        if (admin && admin.adminType !== 'super') {
            // If regular admin has a butcherId, only load that specific business
            if (admin.butcherId) {
                try {
                    const { getDoc, doc: docRef } = await import('firebase/firestore');
                    const bizDoc = await getDoc(docRef(db, 'businesses', admin.butcherId));
                    if (bizDoc.exists()) {
                        setBusinesses([{ id: bizDoc.id, ...bizDoc.data() } as Business]);
                    }
                } catch (error) {
                    console.error('Error loading business:', error);
                }
            }
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const q = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Business[];
            setBusinesses(data);
        } catch (error) {
            console.error('Error loading businesses:', error);
            showToast(t('isletmelerYuklenirkenHataOlustu'), 'error');
        } finally {
            setLoading(false);
        }
    }, [admin]);

    // 🆕 KERMES İÇİN - Organizations yükle
    const loadOrganizations = useCallback(async () => {
        setLoadingOrganizations(true);
        try {
            const q = query(collection(db, 'organizations'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setOrganizations(data);
            console.log('✅ Organizations loaded:', data.length);
        } catch (error) {
            console.error('Error loading organizations:', error);
        } finally {
            setLoadingOrganizations(false);
        }
    }, []);

    // 🆕 KERMES EVENTS - kermes_events koleksiyonunu yükle
    const loadKermesEvents = useCallback(async () => {
        setLoadingKermesEvents(true);
        try {
            const q = query(collection(db, 'kermes_events'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setKermesEvents(data);
            console.log('✅ Kermes events loaded:', data.length);
        } catch (error) {
            console.error('Error loading kermes events:', error);
        } finally {
            setLoadingKermesEvents(false);
        }
    }, []);

    useEffect(() => {
        loadBusinesses();
        loadKermesEvents(); // Kermes sayısını göstermek için başta yükle
    }, [loadBusinesses, loadKermesEvents]);

    // 🆕 Kermes seçildiğinde kermes_events VE organizations yükle
    useEffect(() => {
        if (typeFilter === 'kermes') {
            if (kermesEvents.length === 0) {
                loadKermesEvents();
            }
            if (organizations.length === 0) {
                loadOrganizations();
            }
        }
    }, [typeFilter, kermesEvents.length, organizations.length, loadKermesEvents, loadOrganizations]);

    // Filter businesses
    const filteredBusinesses = businesses.filter(b => {
        // 🆕 Multi-term search: Birden fazla kelime yazıldığında hepsini eşleştir
        // Örn: "41836 tuna" → postalCode 41836 VE isim/marka tuna içermeli
        const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

        const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => {
            const normalizedTerm = normalizeTurkish(term);
            return normalizeTurkish(b.companyName || '').includes(normalizedTerm) ||
                normalizeTurkish(b.brand || '').includes(normalizedTerm) ||
                normalizeTurkish(b.address?.city || '').includes(normalizedTerm) ||
                (b.address?.postalCode || '').toLowerCase().includes(term);
        });

        // Check multiple possible type fields for backwards compatibility
        const businessData = b as any;
        const matchesType = typeFilter === 'all' ||
            b.businessCategories?.includes(typeFilter) ||
            businessData.businessType === typeFilter ||
            businessData.type === typeFilter ||
            (b.businessCategories?.length === 0 && businessData.businessType === undefined && typeFilter === 'kasap'); // Legacy kasap fallback

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && b.isActive !== false && !(b as any).isArchived) ||
            (statusFilter === 'inactive' && b.isActive === false && !(b as any).isArchived) ||
            (statusFilter === 'archived' && (b as any).isArchived);

        // Brand/Label filter - check both brandLabel and brand fields
        const businessLabel = (b.brandLabel || (b as any).brand || '').toLowerCase();
        const matchesBrand = brandFilter === 'all' ||
            (brandFilter === 'tuna' && businessLabel === 'tuna') ||
            (brandFilter === 'akdeniz_toros' && businessLabel === 'akdeniz_toros') ||
            (brandFilter === 'none' && !businessLabel);

        return matchesSearch && matchesType && matchesStatus && matchesBrand;
    });

    // 📄 Pagination calculations
    const totalPages = Math.ceil(filteredBusinesses.length / BUSINESSES_PER_PAGE);
    const paginatedBusinesses = filteredBusinesses.slice(
        (currentPage - 1) * BUSINESSES_PER_PAGE,
        currentPage * BUSINESSES_PER_PAGE
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, typeFilter, statusFilter, brandFilter]);

    // 🆕 KERMES İÇİN - Organizations filtreleme
    const filteredOrganizations = organizations.filter(o => {
        const normalizedQuery = normalizeTurkish(searchQuery);
        const matchesSearch = searchQuery === '' ||
            normalizeTurkish(o.name || '').includes(normalizedQuery) ||
            normalizeTurkish(o.shortName || '').includes(normalizedQuery) ||
            normalizeTurkish(o.city || '').includes(normalizedQuery) ||
            (o.postalCode || '').includes(searchQuery);

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && o.isActive !== false) ||
            (statusFilter === 'inactive' && o.isActive === false);

        return matchesSearch && matchesStatus;
    });

    // 🆕 KERMES EVENTS filtreleme (ana liste için)
    const filteredKermesEvents = kermesEvents.filter(e => {
        const normalizedQuery = normalizeTurkish(searchQuery);
        const matchesSearch = searchQuery === '' ||
            normalizeTurkish(e.title || '').includes(normalizedQuery) ||
            normalizeTurkish(e.location || '').includes(normalizedQuery) ||
            normalizeTurkish(e.city || '').includes(normalizedQuery) ||
            normalizeTurkish(e.organizationName || '').includes(normalizedQuery);

        const matchesStatus = statusFilter === 'all' && !e.isArchived ||
            (statusFilter === 'active' && e.isActive !== false && !e.isArchived) ||
            (statusFilter === 'inactive' && e.isActive === false && !e.isArchived) ||
            (statusFilter === 'archived' && e.isArchived);

        return matchesSearch && matchesStatus;
    });

    // 🆕 Modal içi organizasyon arama
    const filteredOrgsForModal = organizations.filter(o => {
        if (!orgSearchQuery) return true;
        const nq = normalizeTurkish(orgSearchQuery);
        return normalizeTurkish(o.name || '').includes(nq) ||
            normalizeTurkish(o.city || '').includes(nq) ||
            (o.postalCode || '').includes(orgSearchQuery);
    });

    // Kermes modu mu kontrol et
    const isKermesMode = typeFilter === 'kermes';

    // Reset form
    const resetForm = () => {
        setFormData({
            companyName: '',
            brand: '',
            type: 'kasap',
            street: '',
            city: '',
            postalCode: '',
            country: 'DE',
            currency: 'EUR',
            phone: '',
            email: '',
            website: '',
            delivery: true,
            pickup: true,
            dineIn: false,
            reservation: false,
            isActive: true,
            googlePlaceId: '',
            rating: 0,
            reviewCount: 0,
            lat: 0,
            lng: 0,
            imageUrl: '',
            openingHours: '',
            // Bank Info
            bankAccountHolder: '',
            bankIban: '',
            bankBic: '',
            bankName: '',
            // Subscription
            subscriptionPlan: 'none',
            subscriptionMonthlyFee: 0,
            subscriptionCommissionRate: 0,
            subscriptionStatus: 'active',
            // Brand Label
            brandLabel: null,
            // Masa & Kapasite
            tableCount: 0,
            seatCapacity: 0,
        });
        setActiveTab('manual');
        setSearchQuery2('');
        setSearchResults([]);
    };

    // Open edit modal
    const handleEdit = (business: Business) => {
        setEditingBusiness(business);
        setFormData({
            companyName: business.companyName || '',
            brand: business.brand || '',
            type: (business.businessCategories?.[0] as BusinessType) || 'kasap',
            street: business.address?.street || '',
            city: business.address?.city || '',
            postalCode: business.address?.postalCode || '',
            country: business.address?.country || 'DE',
            currency: business.currency || 'EUR',
            phone: business.contact?.phone || '',
            email: business.contact?.email || '',
            website: business.contact?.website || '',
            delivery: business.services?.delivery ?? true,
            pickup: business.services?.pickup ?? true,
            dineIn: business.services?.dineIn ?? false,
            reservation: business.services?.reservation ?? false,
            isActive: business.isActive ?? true,
            googlePlaceId: business.googlePlaceId || '',
            rating: business.rating || 0,
            reviewCount: business.reviewCount || 0,
            lat: business.lat || 0,
            lng: business.lng || 0,
            imageUrl: business.imageUrl || '',
            openingHours: business.openingHours || '',
            // Bank Info
            bankAccountHolder: business.bankInfo?.accountHolder || '',
            bankIban: business.bankInfo?.iban || '',
            bankBic: business.bankInfo?.bic || '',
            bankName: business.bankInfo?.bankName || '',
            // Subscription
            subscriptionPlan: business.subscription?.planName || 'standard',
            subscriptionMonthlyFee: business.subscription?.monthlyFee || 0,
            subscriptionCommissionRate: business.subscription?.commissionRate || 0,
            subscriptionStatus: (business.subscription?.status as any) || 'active',
            // Brand Label
            brandLabel: business.brandLabel || null,
            // Masa & Kapasite
            tableCount: business.tableCount || 0,
            seatCapacity: business.seatCapacity || 0,
        });

        // Schedule parsing disabled - causing crashes
        // Opening hours now handled directly in formData.openingHours

        setActiveTab('manual');
        setShowAddModal(true);
    };

    // Google Places Search
    const handleGoogleSearch = async () => {
        if (!searchQuery2.trim()) return;
        setIsSearching(true);
        setSearchResults([]);
        try {
            const token = await auth.currentUser?.getIdToken()
            const res = await fetch(`/api/admin/google-place?action=search&query=${encodeURIComponent(searchQuery2)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.candidates && data.candidates.length > 0) {
                setSearchResults(data.candidates);
            } else {
                showToast(t('sonucBulunamadiTamIsimVeyaAdres'), 'error');
            }
        } catch (error) {
            console.error('Search error:', error);
            showToast(t('aramaSirasindaHataOlustu'), 'error');
        } finally {
            setIsSearching(false);
        }
    };

    // Google Places Fetch Details
    const handleFetchDetails = async (selectedPlaceId: string) => {
        setIsImporting(true);
        setSearchResults([]);
        try {
            const token = await auth.currentUser?.getIdToken()
            const res = await fetch(`/api/admin/google-place?placeId=${selectedPlaceId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Populate Form with Google data
            setFormData(prev => ({
                ...prev,
                companyName: data.name || prev.companyName,
                googlePlaceId: selectedPlaceId,
                street: data.address?.street || prev.street,
                postalCode: data.address?.postalCode || prev.postalCode,
                city: data.address?.city || prev.city,
                country: data.address?.country || 'DE',
                currency: prev.currency || 'EUR',
                phone: data.shopPhone || prev.phone,
                website: data.website || prev.website,
                imageUrl: data.photoUrl || prev.imageUrl,
                rating: data.rating || 0,
                reviewCount: data.userRatingsTotal || 0,
                lat: data.lat || 0,
                lng: data.lng || 0,
                openingHours: Array.isArray(data.openingHours) ? data.openingHours.join('\n') : (data.openingHours || ''),
                brand: data.name?.toLowerCase().includes('tuna') ? 'tuna' : prev.brand,
            }));

            // Schedule parsing disabled - handled via direct textarea editing

            showToast(t('bilgilerGoogledanCekildiKontrolEdipEksikleri'), 'success');
            setActiveTab('manual');
        } catch (error: any) {
            console.error(t('import_error'), error);
            showToast(t('iceAktarmaBasarisiz') + error.message, 'error');
        } finally {
            setIsImporting(false);
        }
    };

    // Refresh opening hours from Google
    const handleGoogleRefreshHours = async () => {
        if (!formData.googlePlaceId) {
            showToast(t('googlePlaceIdBulunamadi'), 'error');
            return;
        }

        setIsRefreshingHours(true);
        try {
            const token = await auth.currentUser?.getIdToken()
            const res = await fetch(`/api/admin/google-place?placeId=${formData.googlePlaceId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (data.openingHours && typeof data.openingHours === 'string') {
                setFormData(prev => ({ ...prev, openingHours: data.openingHours }));
                // Schedule parsing disabled - direct textarea editing used
                showToast(t('calismaSaatleriGoogledanGuncellendi'), 'success');
            } else {
                showToast(t('googledaCalismaSaatiBilgisiBulunamadi'), 'error');
            }
        } catch (error: any) {
            console.error('Refresh hours error:', error);
            showToast(t('guncellemeBasarisiz') + error.message, 'error');
        } finally {
            setIsRefreshingHours(false);
        }
    };

    // Save business
    const handleSave = async () => {
        if (!formData.companyName || !formData.city) {
            showToast(t('isletmeAdiVeSehirZorunludur'), 'error');
            return;
        }

        setSaving(true);
        try {
            const businessData = {
                companyName: formData.companyName,
                brand: formData.brand || null,
                businessCategories: [formData.type],
                address: {
                    street: formData.street || null,
                    city: formData.city,
                    postalCode: formData.postalCode || null,
                    country: formData.country,
                    lat: formData.lat || null,
                    lng: formData.lng || null,
                },
                currency: formData.currency,
                contact: {
                    phone: formData.phone || null,
                    email: formData.email || null,
                    website: formData.website || null,
                },
                services: {
                    delivery: formData.delivery,
                    pickup: formData.pickup,
                    dineIn: formData.dineIn,
                    reservation: formData.reservation,
                },
                isActive: formData.isActive,
                googlePlaceId: formData.googlePlaceId || null,
                rating: formData.rating || null,
                reviewCount: formData.reviewCount || null,
                lat: formData.lat || null,
                lng: formData.lng || null,
                imageUrl: formData.imageUrl || null,
                openingHours: formData.openingHours || null,
                updatedAt: new Date(),
                // Brand Label (Super Admin Only)
                brandLabel: formData.brandLabel || null,
                // Bank Info
                bankInfo: {
                    accountHolder: formData.bankAccountHolder || null,
                    iban: formData.bankIban || null,
                    bic: formData.bankBic || null,
                    bankName: formData.bankName || null,
                },
                // Subscription
                subscription: {
                    planName: formData.subscriptionPlan || 'standard',
                    monthlyFee: formData.subscriptionMonthlyFee || 0,
                    commissionRate: formData.subscriptionCommissionRate || 0,
                    status: formData.subscriptionStatus || 'active',
                },
                // Masa & Kapasite (Rezervasyon için)
                tableCount: formData.tableCount || 0,
                seatCapacity: formData.seatCapacity || 0,
            };

            if (editingBusiness) {
                // Update existing
                await updateDoc(doc(db, 'businesses', editingBusiness.id), businessData);
                showToast(t('isletmeGuncellendi'), 'success');
            } else {
                // Get unique business number (atomic, never reused)
                const customerId = await getNextBusinessNumber();

                // Create new with unique customerId
                await addDoc(collection(db, 'businesses'), {
                    ...businessData,
                    customerId, // Unique 6-digit business number
                    createdAt: new Date(),
                    createdBy: admin?.id,
                });
                showToast(`${t('isletmeOlusturulduNo')} ${customerId})`, 'success');
            }

            setShowAddModal(false);
            setEditingBusiness(null);
            resetForm();
            loadBusinesses();
        } catch (error) {
            console.error('Error saving business:', error);
            showToast(t('isletmeKaydedilirkenHataOlustu'), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Delete or Archive business (smart: checks for invoices/orders first)
    const handleDelete = async (business: Business) => {
        try {
            // Check for invoices
            const invoicesSnap = await getDocs(query(
                collection(db, 'invoices'),
                where('businessId', '==', business.id)
            ));
            const hasInvoices = invoicesSnap.size > 0;

            // Check for orders
            const ordersSnap = await getDocs(query(
                collection(db, 'meat_orders'),
                where('businessId', '==', business.id)
            ));
            const hasOrders = ordersSnap.size > 0;

            // Check for subscription
            const hasSubscription = business.subscription?.planName && business.subscription?.planName !== 'none';

            const hasHistory = hasInvoices || hasOrders || hasSubscription;

            if (hasHistory) {
                // Can only archive
                const details = [
                    hasInvoices ? `• ${invoicesSnap.size} fatura` : '',
                    hasOrders ? `• ${ordersSnap.size} ${t('siparis')}` : '',
                    hasSubscription ? `• Aktif abonelik: ${business.subscription?.planName}` : '',
                ].filter(Boolean).join('\n');

                setConfirmState({
                    isOpen: true,
                    title: t('isletmeyiArsivle'),
                    message: `${t('buIsletmeninGecmisiVarn')}${details}${t('nnbuIsletmeSilinemezSadeceArsiveAlinabilir')}`,
                    itemName: business.companyName,
                    variant: 'warning',
                    confirmText: t('evetArsivle'),
                    onConfirm: async () => {
                        setConfirmState(prev => ({ ...prev, isOpen: false }));
                        try {
                            await updateDoc(doc(db, 'businesses', business.id), {
                                isActive: false,
                                isArchived: true,
                                archivedAt: new Date(),
                                updatedAt: new Date(),
                            });
                            showToast(t('isletmeArsiveAlindi'), 'success');
                            loadBusinesses();
                        } catch (error) {
                            console.error('Error archiving business:', error);
                            showToast(t('islemSirasindaHataOlustu'), 'error');
                        }
                    },
                });
            } else {
                // No history - can delete completely
                setConfirmState({
                    isOpen: true,
                    title: t('isletmeyiKaliciSil'),
                    message: t('buIsletmeninHicFaturasiVeyaSiparisi'),
                    itemName: business.companyName,
                    variant: 'danger',
                    confirmText: t('evetKaliciSil'),
                    onConfirm: async () => {
                        setConfirmState(prev => ({ ...prev, isOpen: false }));
                        try {
                            await deleteDoc(doc(db, 'businesses', business.id));
                            showToast(t('isletmeTamamenSilindi'), 'success');
                            loadBusinesses();
                        } catch (error) {
                            console.error('Error deleting business:', error);
                            showToast(t('islemSirasindaHataOlustu'), 'error');
                        }
                    },
                });
            }
        } catch (error) {
            console.error('Error deleting/archiving business:', error);
            showToast(t('islemSirasindaHataOlustu'), 'error');
        }
    };

    // Toggle status
    const handleToggleStatus = async (business: Business) => {
        try {
            await updateDoc(doc(db, 'businesses', business.id), {
                isActive: !business.isActive,
                updatedAt: new Date(),
            });
            showToast(business.isActive ? t('isletmeDeaktifEdildi') : t('isletmeAktifEdildi'), 'success');
            loadBusinesses();
        } catch (error) {
            console.error('Error toggling status:', error);
            showToast(t('durumGuncellenirkenHataOlustu'), 'error');
        }
    };

    const getTypeInfo = (type: string) => {
        return businessTypes.find(t => t.value === type) || { icon: '🏪', label: t('isletme'), color: 'gray' };
    };

    if (adminLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                {/* Back Button */}
                <Link
                    href="/admin/dashboard"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition"
                >
                    <span>←</span>
                    <span>{t('admin_paneli')}</span>
                </Link>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            {isKermesMode ? t('kermesyonetimi') : t('isletme_yonetimi')}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {isKermesMode
                                ? `${t('aktifkermesleriyonetin')} ${filteredKermesEvents.length} kermes`
                                : `${t('tum_kayitli_isletmeleri_yonetin')} ${filteredBusinesses.length} ${t('isletme1')}`}
                        </p>
                    </div>
                    {isKermesMode ? (
                        <button
                            onClick={() => setShowOrgSearchModal(true)}
                            className="px-6 py-3 bg-pink-600 text-white rounded-xl font-medium hover:bg-pink-500 transition shadow-lg flex items-center gap-2"
                        >
                            <span>🎪</span>
                            {t('yeni_kermes_ekle')}
                        </button>
                    ) : (
                        <Link
                            href="/admin/business/new?tab=settings"
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition shadow-lg flex items-center gap-2"
                        >
                            <span>➕</span>
                            {t('yeni_isletme_ekle')}
                        </Link>
                    )}
                </div>
            </div>

            {/* Sector Modules */}
            <div className="max-w-7xl mx-auto mb-6">
                <h3 className="text-foreground font-medium mb-3 flex items-center gap-2">
                    {t('sektor_modulleri')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {businessTypes.map(type => {
                        // 🆕 Kermes için kermes events sayısını kullan (arşivlenmemiş olanlar)
                        const count = type.value === 'kermes'
                            ? kermesEvents.filter((k: any) => k.isArchived !== true).length
                            : businesses.filter(b => {
                                const bd = b as any;
                                return b.businessCategories?.includes(type.value) || bd.businessType === type.value || bd.type === type.value;
                            }).length;
                        return (
                            <button
                                key={type.value}
                                onClick={() => {
                                    setTypeFilter(typeFilter === type.value ? 'all' : type.value);
                                }}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${typeFilter === type.value
                                    ? type.value === 'kermes' ? 'bg-pink-600/30 border-pink-500 ring-2 ring-pink-500' : 'bg-blue-600/30 border-blue-500 ring-2 ring-blue-500'
                                    : 'bg-card border-border hover:bg-gray-700 hover:border-gray-600'
                                    }`}
                            >
                                <span className="text-3xl">{type.icon}</span>
                                <span className="text-foreground text-sm font-medium">{type.label}</span>
                                <span className="text-muted-foreground text-xs">
                                    {type.value === 'kermes' ? `${count} kermes` : `${count} ${t('isletme1')}`}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* 🕐 Son Kullanılanlar - Quick Access Chip */}
                {recentBusinesses.length > 0 && (
                    <div className="mt-4">
                        <button
                            onClick={() => setShowRecent(!showRecent)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm font-medium ${showRecent
                                ? 'bg-amber-600/30 border-amber-500 ring-2 ring-amber-500 text-amber-300'
                                : 'bg-card border-border hover:bg-gray-700 hover:border-gray-600 text-foreground'
                                }`}
                        >
                            <span>🕐</span>
                            {t('sonKullanilanlar')}
                            <span className="bg-amber-600/40 text-amber-200 text-xs px-2 py-0.5 rounded-full">{recentBusinesses.length}</span>
                            <span className={`transition-transform ${showRecent ? 'rotate-180' : ''}`}>▾</span>
                        </button>

                        {showRecent && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                {recentBusinesses.map((rb: any) => (
                                    <Link
                                        key={rb.id}
                                        href={`/admin/business/${rb.id}`}
                                        className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-gray-700 border border-border hover:border-amber-600/50 rounded-xl transition-all group"
                                    >
                                        <span className="text-xl">
                                            {businessTypes.find(t => t.value === rb.type)?.icon || '🏪'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-foreground text-sm font-medium truncate group-hover:text-amber-300 transition-colors">
                                                {rb.name}
                                            </div>
                                            {rb.city && (
                                                <div className="text-gray-500 text-xs truncate">{rb.city}</div>
                                            )}
                                        </div>
                                        <span className="text-gray-600 group-hover:text-amber-500 transition-colors">→</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-card rounded-xl p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setOrgPage(1); }}
                                placeholder={t('isletmeAdiSehirVeyaPostaKodu')}
                                className="w-full px-4 py-3 pl-12 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
                        </div>

                        {/* Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                        >
                            <option value="all">{t('tumTurler')}</option>
                            {businessTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.icon} {type.label}
                                </option>
                            ))}
                        </select>

                        {/* Brand/Label Filter */}
                        <select
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value as 'all' | 'tuna' | 'akdeniz_toros' | 'none')}
                            className="px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                        >
                            <option value="all">{t('tumMarkalar')}</option>
                            <option value="tuna">🔴 TUNA</option>
                            <option value="akdeniz_toros">🏔️ Akdeniz Toros</option>
                            <option value="none">{t('markasiz')}</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600"
                        >
                            <option value="all">{t('tumDurumlar')}</option>
                            <option value="active">{t('aktif')}</option>
                            <option value="inactive">{t('pasif')}</option>
                            <option value="archived">{t('arsiv')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Business List / Organizations List */}
            <div className="max-w-7xl mx-auto">
                <div className="bg-card rounded-xl overflow-hidden">
                    {/* 🆕 KERMES MODU - Kermes Events Listesi */}
                    {isKermesMode ? (
                        loadingKermesEvents ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
                                <p className="text-muted-foreground mt-4">{t('kermeslerYukleniyor')}</p>
                            </div>
                        ) : filteredKermesEvents.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-4xl mb-4">🎪</p>
                                <p className="text-muted-foreground">{t('henuzKermesOlusturulmamis')}</p>
                                <p className="text-gray-500 text-sm mt-2">
                                    {t('yeniKermesEkleButonunaTiklayarakIlk')}
                                </p>
                                <button
                                    onClick={() => setShowOrgSearchModal(true)}
                                    className="mt-4 px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-medium hover:from-pink-500 hover:to-purple-500 transition"
                                >
                                    {t('ilkKermesiOlustur')}
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-pink-900/30 text-pink-300 text-sm">
                                        <tr>
                                            <th className="px-4 py-3">🎪 Kermes</th>
                                            <th className="px-4 py-3">{t('tarih')}</th>
                                            <th className="px-4 py-3">📍 {t('konum')}</th>
                                            <th className="px-4 py-3">{t('menu')}</th>
                                            <th className="px-4 py-3">📊 {t('durum')}</th>
                                            <th className="px-4 py-3 text-center">{t('islemler')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredKermesEvents
                                            .slice((orgPage - 1) * ORGS_PER_PAGE, orgPage * ORGS_PER_PAGE)
                                            .map((event) => {
                                                // Format dates
                                                const startDate = event.date?.toDate?.() || (event.date ? new Date(event.date) : null);
                                                const endDate = event.endDate?.toDate?.() || (event.endDate ? new Date(event.endDate) : null);
                                                const formatDate = (d: Date | null) => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

                                                return (
                                                    <tr
                                                        key={event.id}
                                                        className="hover:bg-pink-900/10 transition cursor-pointer"
                                                        onClick={() => window.location.href = `/admin/kermes/${event.id}`}
                                                    >
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center text-lg text-white">
                                                                    🎪
                                                                </div>
                                                                <div>
                                                                    <p className="text-foreground font-medium">{event.title || t('isimsizKermes')}</p>
                                                                    {event.organizationName && (
                                                                        <p className="text-muted-foreground text-xs">🕌 {event.organizationName}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-foreground">{formatDate(startDate)}</p>
                                                            {endDate && (
                                                                <p className="text-muted-foreground text-xs">→ {formatDate(endDate)}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-foreground">{event.location || event.city || '-'}</p>
                                                            {event.address && (
                                                                <p className="text-muted-foreground text-xs">{event.address}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-sm">
                                                                {event.items?.length || 0} {t('oge')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${event.isActive !== false
                                                                ? 'bg-green-900/30 text-green-800 dark:text-green-400 border border-green-500/30'
                                                                : 'bg-red-900/30 text-red-800 dark:text-red-400 border border-red-500/30'
                                                                }`}>
                                                                {event.isActive !== false ? t('aktif') : '⏸️ Bitti'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Link
                                                                    href={`/admin/kermes/${event.id}`}
                                                                    className="px-3 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition text-sm"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {t('duzenle')}
                                                                </Link>
                                                                {event.isArchived ? (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setConfirmState({
                                                                                    isOpen: true,
                                                                                    title: t('kermesiArsivdenCikar'),
                                                                                    message: t('buKermesiArsivdenCikarmakIstiyorMusunuz'),
                                                                                    itemName: event.title,
                                                                                    variant: 'warning',
                                                                                    confirmText: t('evetCikar'),
                                                                                    onConfirm: async () => {
                                                                                        setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                                        try {
                                                                                            await updateDoc(doc(db, 'kermes_events', event.id), { isArchived: false });
                                                                                            loadKermesEvents();
                                                                                        } catch (error) {
                                                                                            console.error('Error:', error);
                                                                                        }
                                                                                    },
                                                                                });
                                                                            }}
                                                                            className="px-3 py-1.5 bg-blue-600/20 text-blue-800 dark:text-blue-400 rounded-lg hover:bg-blue-600/40 transition text-sm"
                                                                        >
                                                                            {t('cikar')}
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setConfirmState({
                                                                                    isOpen: true,
                                                                                    title: t('kermesiKaliciSil'),
                                                                                    message: t('dikkatBuKermesiKaliciOlarakSilmek'),
                                                                                    itemName: event.title,
                                                                                    variant: 'danger',
                                                                                    confirmText: t('evetKaliciSil'),
                                                                                    onConfirm: async () => {
                                                                                        setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                                        try {
                                                                                            await deleteDoc(doc(db, 'kermes_events', event.id));
                                                                                            loadKermesEvents();
                                                                                        } catch (error) {
                                                                                            console.error('Error:', error);
                                                                                        }
                                                                                    },
                                                                                });
                                                                            }}
                                                                            className="px-3 py-1.5 bg-red-600/20 text-red-800 dark:text-red-400 rounded-lg hover:bg-red-600/40 transition text-sm"
                                                                        >
                                                                            {t('sil')}
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setConfirmState({
                                                                                isOpen: true,
                                                                                title: t('kermesiArsivle'),
                                                                                message: t('buKermesiArsivlemekIstiyorMusunuz'),
                                                                                itemName: event.title,
                                                                                variant: 'warning',
                                                                                confirmText: t('evetArsivle'),
                                                                                onConfirm: async () => {
                                                                                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                                                                                    try {
                                                                                        await updateDoc(doc(db, 'kermes_events', event.id), { isArchived: true, isActive: false });
                                                                                        loadKermesEvents();
                                                                                    } catch (error) {
                                                                                        console.error('Error:', error);
                                                                                    }
                                                                                },
                                                                            });
                                                                        }}
                                                                        className="px-3 py-1.5 bg-yellow-600/20 text-yellow-800 dark:text-yellow-400 rounded-lg hover:bg-yellow-600/40 transition text-sm"
                                                                    >
                                                                        {t('arsivle')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>

                                {/* Pagination Controls */}
                                {filteredKermesEvents.length > ORGS_PER_PAGE && (
                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-700/50 border-t border-border">
                                        <div className="text-muted-foreground text-sm">
                                            {(orgPage - 1) * ORGS_PER_PAGE + 1} - {Math.min(orgPage * ORGS_PER_PAGE, filteredKermesEvents.length)} / {filteredKermesEvents.length} kermes
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setOrgPage(Math.max(1, orgPage - 1))}
                                                disabled={orgPage === 1}
                                                className="px-3 py-1.5 bg-pink-600/20 text-pink-300 rounded-lg hover:bg-pink-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t('onceki')}
                                            </button>
                                            <span className="px-3 py-1.5 text-white">
                                                {orgPage} / {Math.ceil(filteredKermesEvents.length / ORGS_PER_PAGE)}
                                            </span>
                                            <button
                                                onClick={() => setOrgPage(Math.min(Math.ceil(filteredKermesEvents.length / ORGS_PER_PAGE), orgPage + 1))}
                                                disabled={orgPage >= Math.ceil(filteredKermesEvents.length / ORGS_PER_PAGE)}
                                                className="px-3 py-1.5 bg-pink-600/20 text-pink-300 rounded-lg hover:bg-pink-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Sonraki →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        /* Normal İşletme Listesi */
                        loading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="text-muted-foreground mt-4">{t('isletmelerYukleniyor')}</p>
                            </div>
                        ) : filteredBusinesses.length === 0 ? (
                            <div className="p-12 text-center">
                                <p className="text-4xl mb-4">🏪</p>
                                <p className="text-muted-foreground">{t('isletmeBulunamadi')}</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-700/50 text-muted-foreground text-sm">
                                            <tr>
                                                <th className="px-4 py-3 w-20">{t('id')}</th>
                                                <th className="px-4 py-3">{t('isletme')}</th>
                                                <th className="px-4 py-3">{t('marka')}</th>
                                                <th className="px-4 py-3">{t('tur')}</th>
                                                <th className="px-4 py-3">{t('konum')}</th>
                                                <th className="px-4 py-3">{t('puan')}</th>
                                                <th className="px-4 py-3">{t('hizmetler')}</th>
                                                <th className="px-4 py-3">{t('durum')}</th>
                                                <th className="px-4 py-3 text-center">{t('islemler')}</th>

                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {paginatedBusinesses.map((business) => {
                                                // Get business type from multiple possible fields
                                                const businessData = business as any;
                                                const businessType = business.businessCategories?.[0] || businessData.businessType || businessData.type || 'kasap';
                                                const typeInfo = getTypeInfo(businessType);
                                                return (
                                                    <tr key={business.id} className="hover:bg-gray-700/30 transition cursor-pointer" onClick={() => window.location.href = `/admin/business/${business.id}`}>
                                                        {/* ID Column */}
                                                        <td className="px-4 py-4">
                                                            <span className="text-muted-foreground font-mono text-xs bg-gray-700/50 px-2 py-1 rounded">
                                                                {(business as any).customerId || business.id?.slice(-6).toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-foreground font-medium">{business.companyName}</p>
                                                        </td>
                                                        {/* Brand Label Column */}
                                                        <td className="px-4 py-4">
                                                            {((business.brandLabel || (business as any).brand) === 'tuna') && (
                                                                <span className="px-3 py-1.5 bg-red-600/30 text-red-800 dark:text-red-400 border border-red-500/50 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                                    🔴 TUNA
                                                                </span>
                                                            )}
                                                            {((business.brandLabel || (business as any).brand) === 'akdeniz_toros') && (
                                                                <span className="px-3 py-1.5 bg-card/50 text-foreground border border-gray-500/50 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                                    ⚫ TOROS
                                                                </span>
                                                            )}
                                                            {!business.brandLabel && !(business as any).brand && (
                                                                <span className="text-gray-500 text-sm">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-lg text-sm">
                                                                <span>{typeInfo.icon}</span>
                                                                <span className="text-foreground">{typeInfo.label}</span>
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-foreground">{business.address?.city || '-'}</p>
                                                            <p className="text-sm text-muted-foreground">{business.address?.postalCode}</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            {business.rating ? (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setReviewModal({ open: true, business }); }}
                                                                    className="px-2 py-1 bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 rounded text-xs font-medium hover:bg-yellow-500/30 transition"
                                                                >
                                                                    ⭐ {business.rating}{business.reviewCount ? ` (${business.reviewCount})` : ''}
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-500 text-xs">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex gap-1">
                                                                {business.services?.delivery && (
                                                                    <span title={t('teslimat')} className="px-2 py-1 bg-blue-600/20 text-blue-800 dark:text-blue-400 rounded text-xs">🛵</span>
                                                                )}
                                                                {business.services?.pickup && (
                                                                    <span title={t('gelAl')} className="px-2 py-1 bg-green-600/20 text-green-800 dark:text-green-400 rounded text-xs">🏃</span>
                                                                )}
                                                                {business.services?.dineIn && (
                                                                    <span title={t('yerinde')} className="px-2 py-1 bg-amber-600/20 text-amber-800 dark:text-amber-400 rounded text-xs">🍽️</span>
                                                                )}
                                                                {business.services?.reservation && (
                                                                    <span title={t('rezervasyon')} className="px-2 py-1 bg-purple-600/20 text-purple-800 dark:text-purple-400 rounded text-xs">📅</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(business); }}
                                                                className={`px-3 py-1 rounded-full text-xs font-medium ${business.isActive !== false
                                                                    ? 'bg-green-600/20 text-green-800 dark:text-green-400 hover:bg-green-600/30'
                                                                    : 'bg-red-600/20 text-red-800 dark:text-red-400 hover:bg-red-600/30'
                                                                    } transition`}
                                                            >
                                                                {business.isActive !== false ? t('aktif') : t('pasif')}
                                                            </button>
                                                        </td>
                                                        {/* Actions Column */}
                                                        <td className="px-4 py-4">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(business); }}
                                                                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${(business as any).isArchived
                                                                    ? 'bg-gray-600/20 text-muted-foreground cursor-not-allowed'
                                                                    : 'bg-red-600/20 text-red-800 dark:text-red-400 hover:bg-red-600/30'
                                                                    }`}
                                                                disabled={(business as any).isArchived}
                                                                title={(business as any).isArchived ? t('arsivde') : t('silArsivle')}
                                                            >
                                                                {(business as any).isArchived ? t('arsivde1') : t('sil')}
                                                            </button>
                                                        </td>

                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 px-4">
                                        <p className="text-sm text-muted-foreground">
                                            {t('toplam')} {filteredBusinesses.length} {t('isletmeden')} {(currentPage - 1) * BUSINESSES_PER_PAGE + 1}-{Math.min(currentPage * BUSINESSES_PER_PAGE, filteredBusinesses.length)} {t('gosteriliyor')}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                ←
                                            </button>
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
                                                        className={`px-3 py-1 rounded-lg ${currentPage === pageNum
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground mb-4">
                                {editingBusiness ? t('isletmeDuzenle') : t('yeniIsletmeEkle1')}
                            </h2>

                            {/* Tab Navigation - show for all (new and existing) */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveTab('manual')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'manual'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {t('manuelGiris')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('google')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'google'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    🌍 {editingBusiness ? t('googleGuncelle') : t('googledanCek')}
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Google Import Tab */}
                            {activeTab === 'google' && (
                                <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
                                    <h3 className="text-foreground font-medium mb-3">{t('googleMapstenIsletmeAra')}</h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        {t('isletmeAdiVeyaAdresiniGirinGoogledan')}
                                    </p>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery2}
                                            onChange={(e) => setSearchQuery2(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleGoogleSearch()}
                                            placeholder={t('ornTunaMetzgereiKolnVeyaVogelsanger')}
                                            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500"
                                        />
                                        <button
                                            onClick={handleGoogleSearch}
                                            disabled={isSearching}
                                            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium disabled:opacity-50"
                                        >
                                            {isSearching ? '🔄' : '🔍'} Ara
                                        </button>
                                    </div>

                                    {/* Search Results */}
                                    {searchResults.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-sm text-muted-foreground">{searchResults.length} {t('sonucBulundu')}</p>
                                            {searchResults.map((result: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className="bg-card rounded-lg p-3 flex items-center justify-between hover:bg-gray-750 transition"
                                                >
                                                    <div>
                                                        <p className="text-foreground font-medium">{result.name}</p>
                                                        <p className="text-muted-foreground text-sm">{result.formatted_address}</p>
                                                        {result.rating && (
                                                            <p className="text-yellow-800 dark:text-yellow-400 text-sm mt-1">
                                                                ⭐ {result.rating} ({result.user_ratings_total || 0} {t('degerlendirme')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleFetchDetails(result.place_id)}
                                                        disabled={isImporting}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
                                                    >
                                                        {isImporting ? '⏳' : '✓'} {t('sec')}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Manual Form - Basic Info */}
                            <div>
                                <h3 className="text-foreground font-medium mb-3">📋 {t('temel_bilgiler', { defaultValue: 'Temel Bilgiler' })}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('isletmeAdi')}</label>
                                        <input
                                            type="text"
                                            value={formData.companyName}
                                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            placeholder={t('ornTunaEt')}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-muted-foreground text-sm mb-1">{t('isletmeTuru')}</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {businessTypes.map(type => (
                                                <button
                                                    key={type.value}
                                                    onClick={() => setFormData({ ...formData, type: type.value })}
                                                    className={`px-3 py-2 rounded-lg border text-left flex items-center gap-2 ${formData.type === type.value
                                                        ? 'border-blue-500 bg-blue-600/20 text-white'
                                                        : 'border-gray-600 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
                                                        }`}
                                                >
                                                    <span>{type.icon}</span>
                                                    <span>{type.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Google Data Display (if imported) */}
                                    {formData.googlePlaceId && (
                                        <div className="col-span-2 bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-green-800 dark:text-green-400 text-sm font-medium">{t('google_verisi_aktif')}</span>
                                                {formData.rating > 0 && (
                                                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 rounded-full text-sm font-medium">
                                                        ⭐ {formData.rating} ({formData.reviewCount} {t('degerlendirme')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground text-xs">{t('place_id')} {formData.googlePlaceId}</p>
                                            {formData.openingHours && (
                                                <p className="text-muted-foreground text-xs mt-1">{t('calismaSaatleri')} {formData.openingHours.substring(0, 50)}...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <h3 className="text-foreground font-medium mb-3">📍 {t('adresBilgileri', { defaultValue: 'Adres Bilgileri' })}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-muted-foreground text-sm mb-1">{t('sokakCadde', { defaultValue: 'Sokak/Cadde' })}</label>
                                        <input
                                            type="text"
                                            value={formData.street}
                                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('sehir')}</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('postaKodu')}</label>
                                        <input
                                            type="text"
                                            value={formData.postalCode}
                                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('ulke')}</label>
                                        <select
                                            value={formData.country}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        >
                                            <option value="DE">🇩🇪 Almanya</option>
                                            <option value="TR">{t('turkiye')}</option>
                                            <option value="NL">🇳🇱 Hollanda</option>
                                            <option value="BE">{t('belcika')}</option>
                                            <option value="FR">🇫🇷 Fransa</option>
                                            <option value="AT">🇦🇹 Avusturya</option>
                                            <option value="CH">🇨🇭 İsviçre</option>
                                            <option value="GB">🇬🇧 Birleşik Krallık</option>
                                            <option value="US">🇺🇸 ABD</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('paraBirimi', { defaultValue: 'Para Birimi' })}</label>
                                        <select
                                            value={formData.currency}
                                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        >
                                            <option value="EUR">Euro (€)</option>
                                            <option value="TRY">Türk Lirası (₺)</option>
                                            <option value="USD">Dolar ($)</option>
                                            <option value="GBP">Sterlin (£)</option>
                                            <option value="CHF">Frank (CHF)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Contact */}
                            <div>
                                <h3 className="text-foreground font-medium mb-3">{t('iletisim')}</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('telefon')}</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                            placeholder="+49..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('eposta')}</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-muted-foreground text-sm mb-1">{t('website')}</label>
                                        <input
                                            type="url"
                                            value={formData.website}
                                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Services */}
                            <div>
                                <h3 className="text-foreground font-medium mb-3">🛎️ {t('hizmetler')}</h3>
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { key: 'delivery', label: `🛵 ${t('teslimat')}`, desc: t('kuryeIleGonderim') },
                                        { key: 'pickup', label: `🏃 ${t('gelAl', { defaultValue: 'Gel Al' })}`, desc: t('musteriAlir') },
                                        { key: 'dineIn', label: `🍽️ ${t('yerinde', { defaultValue: 'Yerinde' })}`, desc: t('masaServisi', { defaultValue: 'Masa servisi' }) },
                                        { key: 'reservation', label: `📅 ${t('rezervasyon', { defaultValue: 'Rezervasyon' })}`, desc: t('masaAyirtma') },
                                    ].map(service => (
                                        <button
                                            key={service.key}
                                            onClick={() => setFormData({
                                                ...formData,
                                                [service.key]: !formData[service.key as keyof typeof formData]
                                            })}
                                            className={`px-4 py-2 rounded-xl border flex flex-col ${formData[service.key as keyof typeof formData]
                                                ? 'border-green-500 bg-green-600/20'
                                                : 'border-gray-600 bg-gray-700'
                                                }`}
                                        >
                                            <span className="text-foreground">{service.label}</span>
                                            <span className="text-xs text-muted-foreground">{service.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Masa & Kapasite - Rezervasyon için */}
                            {(formData.reservation || formData.dineIn) && (
                                <div className="bg-card/50 rounded-xl border border-border p-4">
                                    <h3 className="text-foreground font-medium mb-3">🪑 Masa & Kapasite</h3>
                                    <p className="text-muted-foreground text-sm mb-3">{t('restorankafeIcinOturmaKapasitesi0Fastfoodtakeaway')}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-muted-foreground text-sm mb-1">{t('masaSayisi')}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.tableCount}
                                                onChange={(e) => setFormData({ ...formData, tableCount: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-muted-foreground text-sm mb-1">{t('toplam_koltuk_kapasitesi')}</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.seatCapacity}
                                                onChange={(e) => setFormData({ ...formData, seatCapacity: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Opening Hours - Editable */}
                            <div className="bg-card/50 rounded-xl border border-border p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-foreground font-medium">{t('calismaSaatleri1')}</h3>
                                    {formData.googlePlaceId && (
                                        <button
                                            onClick={handleGoogleRefreshHours}
                                            disabled={isRefreshingHours}
                                            type="button"
                                            className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-800 dark:text-green-400 rounded-lg text-sm font-medium flex items-center gap-2 transition disabled:opacity-50"
                                        >
                                            {isRefreshingHours ? t('yukleniyor') : '🌍 Google\'dan Tazele'}
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={typeof formData.openingHours === 'string'
                                        ? formData.openingHours.replace(/ \| /g, '\n')
                                        : ''}
                                    onChange={(e) => {
                                        const formatted = e.target.value.replace(/\n/g, ' | ');
                                        setFormData(prev => ({ ...prev, openingHours: formatted }));
                                    }}
                                    placeholder="Monday: 09:00 – 18:00\nTuesday: 09:00 – 18:00\n..."
                                    className="w-full bg-background/50 px-4 py-3 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none resize-none text-sm font-mono"
                                    rows={7}
                                />
                                <p className="text-gray-500 text-xs mt-2">
                                    {t('herSatiraBirGunYazinOrnek')}
                                </p>
                            </div>


                            {/* === FINANCIAL DETAILS SECTION === */}
                            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                                <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                                    💳 Finansal Bilgiler
                                </h3>

                                {/* Brand Label - SUPER ADMIN ONLY - Only for Kasap & Restoran */}
                                {(formData.type === 'kasap' || formData.type === t('restoran')) && (
                                    <div className="bg-card rounded-lg p-3 border border-border">
                                        <h4 className="text-foreground text-sm font-bold mb-2 flex items-center gap-2">
                                            🏷️ Marka Etiketi
                                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">{t('super_admin')}</span>
                                        </h4>
                                        <p className="text-muted-foreground text-xs mb-3">{t('buEtiketSadeceSuperAdminTarafindan')}</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, brandLabel: null })}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.brandLabel === null
                                                    ? 'bg-gray-600 text-white ring-2 ring-gray-400'
                                                    : 'bg-card text-muted-foreground hover:bg-gray-700'
                                                    }`}
                                            >
                                                ❌ Etiketsiz
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, brandLabel: 'tuna' })}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${formData.brandLabel === 'tuna'
                                                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg shadow-blue-500/30'
                                                    : 'bg-card text-muted-foreground hover:bg-blue-900/50'
                                                    }`}
                                            >
                                                🐟 TUNA <span className="text-xs opacity-70">(Avrupa)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, brandLabel: 'akdeniz_toros' })}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${formData.brandLabel === 'akdeniz_toros'
                                                    ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-lg shadow-amber-500/30'
                                                    : 'bg-card text-muted-foreground hover:bg-amber-900/50'
                                                    }`}
                                            >
                                                {t('akdenizToros')} <span className="text-xs opacity-70">{t('turkiye1')}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Bank Info - EDITABLE */}
                                <div className="bg-card/50 rounded-lg p-3">
                                    <h4 className="text-muted-foreground text-sm font-medium mb-2">🏦 {t('bankaBilgileri', { defaultValue: 'Banka Bilgileri' })}</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('hesap_sahibi')}</label>
                                            <input
                                                type="text"
                                                value={formData.bankAccountHolder}
                                                onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                                                placeholder={t('hesapSahibiAdi')}
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('banka', { defaultValue: 'Banka' })}</label>
                                            <input
                                                type="text"
                                                value={formData.bankName}
                                                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                                placeholder={t('bankaAdi')}
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none text-sm"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-gray-500 text-xs mb-1">{t('iban')}</label>
                                            <input
                                                type="text"
                                                value={formData.bankIban}
                                                onChange={(e) => setFormData({ ...formData, bankIban: e.target.value })}
                                                placeholder="DE89 3704 0044 0532 0130 00"
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none text-sm font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('bic_swift')}</label>
                                            <input
                                                type="text"
                                                value={formData.bankBic}
                                                onChange={(e) => setFormData({ ...formData, bankBic: e.target.value })}
                                                placeholder="COBADEFFXXX"
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Subscription Info - EDITABLE */}
                                <div className="bg-card/50 rounded-lg p-3">
                                    <h4 className="text-muted-foreground text-sm font-medium mb-2">📋 {t('abonelikBilgileri', { defaultValue: 'Abonelik Bilgileri' })}</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('plan', { defaultValue: 'Plan' })}</label>
                                            <select
                                                value={formData.subscriptionPlan}
                                                onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white border border-border focus:border-blue-500 focus:outline-none text-sm"
                                            >
                                                <option value="none">{t('plan_yok')}</option>
                                                {availablePlans.map(plan => (
                                                    <option key={plan.code} value={plan.code}>{plan.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('durum')}</label>
                                            <select
                                                value={formData.subscriptionStatus}
                                                onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value as any })}
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white border border-border focus:border-blue-500 focus:outline-none text-sm"
                                            >
                                                <option value="active">{t('aktif')}</option>
                                                <option value="trial">🎁 {t('deneme', { defaultValue: 'Deneme' })}</option>
                                                <option value="paused">⏸ {t('durduruldu', { defaultValue: 'Durduruldu' })}</option>
                                                <option value="cancelled">{t('iptal')}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('aylikUcret')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.subscriptionMonthlyFee}
                                                onChange={(e) => setFormData({ ...formData, subscriptionMonthlyFee: parseFloat(e.target.value) || 0 })}
                                                placeholder="0.00"
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 text-xs mb-1">{t('komisyonOrani')}</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={formData.subscriptionCommissionRate}
                                                onChange={(e) => setFormData({ ...formData, subscriptionCommissionRate: parseFloat(e.target.value) || 0 })}
                                                placeholder="0"
                                                className="w-full bg-background/50 px-3 py-2 rounded-lg text-white placeholder-gray-500 border border-border focus:border-blue-500 focus:outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>


                                {/* Order Stats - Only show when editing */}
                                {editingBusiness && (
                                    <div className="bg-card/50 rounded-lg p-3">
                                        <h4 className="text-muted-foreground text-sm font-medium mb-2">{t('siparisIstatistikleri')}</h4>
                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-foreground">{editingBusiness.orderStats?.totalOrders || editingBusiness.orderCount || 0}</p>
                                                <p className="text-gray-500 text-xs">{t('toplamSiparis')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-blue-800 dark:text-blue-400">{editingBusiness.orderStats?.dailyAverage?.toFixed(1) || '0.0'}</p>
                                                <p className="text-gray-500 text-xs">{t('gunlukOrtalama')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-green-800 dark:text-green-400">{formatCurrency(editingBusiness.orderStats?.totalRevenue || 0, editingBusiness.currency)}</p>
                                                <p className="text-gray-500 text-xs">{t('toplam_ciro')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm text-foreground">
                                                    {editingBusiness.orderStats?.lastOrderDate?.toDate?.()?.toLocaleDateString('de-DE') || '-'}
                                                </p>
                                                <p className="text-gray-500 text-xs">{t('sonSiparis')}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}


                                {/* Billing Summary - Only show when editing */}
                                {editingBusiness && (
                                    <div className="bg-card/50 rounded-lg p-3">
                                        <h4 className="text-muted-foreground text-sm font-medium mb-2">{t('fatura_durumu')}</h4>
                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="text-center">
                                                <p className="text-sm text-foreground">
                                                    {editingBusiness.billing?.lastPaymentDate?.toDate?.()?.toLocaleDateString('de-DE') || '-'}
                                                </p>
                                                <p className="text-gray-500 text-xs">{t('sonOdeme')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl font-bold text-foreground">{formatCurrency(editingBusiness.billing?.lastPaymentAmount || 0, editingBusiness.currency)}</p>
                                                <p className="text-gray-500 text-xs">{t('son_tutar')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className={`text-xl font-bold ${(editingBusiness.billing?.openBalance || 0) > 0 ? 'text-red-800 dark:text-red-400' : 'text-green-800 dark:text-green-400'}`}>
                                                    {formatCurrency(editingBusiness.billing?.openBalance || 0, editingBusiness.currency)}
                                                </p>
                                                <p className="text-gray-500 text-xs">{t('acikBakiye')}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xl font-bold text-foreground">{editingBusiness.billing?.invoiceCount || 0}</p>
                                                <p className="text-gray-500 text-xs">{t('faturaSayisi')}</p>
                                            </div>
                                        </div>
                                        {(editingBusiness.billing?.openBalance || 0) > 0 && (
                                            <div className="mt-3 p-2 bg-red-900/30 rounded-lg border border-red-500/30">
                                                <p className="text-red-800 dark:text-red-400 text-sm text-center">{t('acikFaturaMevcut')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5"
                                />
                                <label htmlFor="isActive" className="text-foreground">
                                    {t('isletmeAktifLokmadaGorunsun')}
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-border flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingBusiness(null);
                                    resetForm();
                                }}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600"
                                disabled={saving}
                            >
                                {t('iptal1')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : (editingBusiness ? t('guncelle') : t('olustur'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal Popup */}
            {reviewModal.open && reviewModal.business && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setReviewModal({ open: false, business: null })}>
                    <div className="bg-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-foreground">
                                ⭐ {reviewModal.business.companyName} {t('googlePuanlari')}
                            </h3>
                            <button onClick={() => setReviewModal({ open: false, business: null })} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
                        </div>

                        <div className="bg-yellow-500/20 rounded-xl p-4 mb-4 text-center">
                            <div className="text-4xl font-bold text-yellow-800 dark:text-yellow-400 mb-1">
                                ⭐ {reviewModal.business.rating}
                            </div>
                            <p className="text-muted-foreground">{reviewModal.business.reviewCount || 0} {t('degerlendirme1')}</p>
                        </div>

                        {(reviewModal.business as any).reviews && (reviewModal.business as any).reviews.length > 0 ? (
                            <div className="space-y-3">
                                {(reviewModal.business as any).reviews.slice(0, 10).map((review: any, idx: number) => (
                                    <div key={idx} className="bg-gray-700/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-foreground font-medium">{review.author_name || t('anonim', { defaultValue: 'Anonim' })}</span>
                                            <span className="text-yellow-800 dark:text-yellow-400 text-sm">{'⭐'.repeat(review.rating || 0)}</span>
                                        </div>
                                        <p className="text-foreground text-sm">{review.text || '-'}</p>
                                        {review.relative_time_description && (
                                            <p className="text-gray-500 text-xs mt-1">{review.relative_time_description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">{t('henuzYorumBulunmuyor')}</p>
                        )}

                        {reviewModal.business.googlePlaceId && (
                            <a
                                href={`https://search.google.com/local/reviews?placeid=${reviewModal.business.googlePlaceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-4 text-center bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg"
                            >
                                {t('googledaTumYorumlariGor')}
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* 🆕 ORGANİZASYON ARAMA MODALI */}
            {showOrgSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-card border-b border-border px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">{t('organizasyonSec')}</h2>
                                    <p className="text-pink-200 text-sm">{t('kermesAcmakIstediginizOrganizasyonuSecin')}</p>
                                </div>
                                <button
                                    onClick={() => { setShowOrgSearchModal(false); setOrgSearchQuery(''); }}
                                    className="text-white/80 hover:text-foreground text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Search Box */}
                        <div className="p-4 border-b border-border">
                            <input
                                type="text"
                                value={orgSearchQuery}
                                onChange={(e) => setOrgSearchQuery(e.target.value)}
                                placeholder={t('organizasyonAdiSehirVeyaPostaKodu')}
                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-pink-500 focus:ring-2 focus:ring-pink-500"
                                autoFocus
                            />
                        </div>

                        {/* Organization List */}
                        <div className="overflow-y-auto max-h-[50vh]">
                            {loadingOrganizations ? (
                                <div className="p-8 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                                    <p className="text-muted-foreground mt-3">{t('organizasyonlarYukleniyor')}</p>
                                </div>
                            ) : filteredOrgsForModal.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-4xl mb-3">🔍</p>
                                    <p className="text-muted-foreground">{t('aramaylaEslesenOrganizasyonBulunamadi')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredOrgsForModal.slice(0, 20).map((org) => (
                                        <Link
                                            key={org.id}
                                            href={`/admin/kermes/new?orgId=${org.id}`}
                                            className="flex items-center gap-4 p-4 hover:bg-pink-900/20 transition"
                                            onClick={() => setShowOrgSearchModal(false)}
                                        >
                                            <div className="w-12 h-12 bg-pink-900/30 rounded-full flex items-center justify-center text-xl">
                                                🕌
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-foreground font-medium">{org.name}</p>
                                                <p className="text-muted-foreground text-sm">
                                                    📍 {org.postalCode} {org.city} {org.address ? `• ${org.address}` : ''}
                                                </p>
                                            </div>
                                            <div className="text-pink-800 dark:text-pink-400">
                                                →
                                            </div>
                                        </Link>
                                    ))}
                                    {filteredOrgsForModal.length > 20 && (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                            +{filteredOrgsForModal.length - 20} {t('dahaAramayiDaraltin')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-card/50">
                            <button
                                onClick={() => { setShowOrgSearchModal(false); setOrgSearchQuery(''); }}
                                className="w-full py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition"
                            >
                                {t('iptal1')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ConfirmModal */}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                itemName={confirmState.itemName}
                variant={confirmState.variant}
                confirmText={confirmState.confirmText}
            />
        </div>
    );
}
