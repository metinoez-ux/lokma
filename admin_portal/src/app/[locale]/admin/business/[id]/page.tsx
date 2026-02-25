"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/utils/currency";
// Removing onAuthStateChanged import as it is no longer needed in this file
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  setDoc,
  addDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { MASTER_PRODUCTS, MasterProduct } from "@/lib/master_products";
import { getLocalizedText } from "@/lib/utils";
import MultiLanguageInput from '@/components/ui/MultiLanguageInput';
import { BUSINESS_TYPES } from "@/lib/business-types";
import { auth, db, storage } from "@/lib/firebase";
import { Admin, ButcherPartner } from "@/types";
import { useAdmin } from "@/components/providers/AdminProvider";
import { useTranslations } from "next-intl";
import { useSectors } from "@/hooks/useSectors";
import { subscriptionService } from "@/services/subscriptionService";

import { Star, History } from "lucide-react";
import ReservationsPanel from "./ReservationsPanel";

// Local interface for meat orders
interface MeatOrder {
  id: string;
  businessId: string;
  butcherId?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalPrice?: number;
  totalAmount?: number;
  total?: number;
  status:
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "onTheWay"
  | "delivered"
  | "completed"
  | "cancelled";
  createdAt?: { toDate: () => Date } | any;
  currency?: string;
}



// Add global declaration for Google Maps
declare global {
  interface Window {
    google: any;
  }
}



export default function BusinessDetailsPage() {
  const t = useTranslations('AdminBusiness');

  function parseTime(timeStr: string) {
    if (!timeStr) return null;
    const normalized = timeStr.toUpperCase().replace(/\./g, ":");
    let hours = 0;
    let minutes = 0;
    const isPM = normalized.includes("PM");
    const isAM = normalized.includes("AM");
    const timeParts = normalized.match(/(\d+):?(\d+)?/);
    if (timeParts) {
      hours = parseInt(timeParts[1]);
      minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  function formatTo24h(timeStr: string): string {
    const dateObj = parseTime(timeStr);
    if (!dateObj) return timeStr;
    const h = dateObj.getHours().toString().padStart(2, '0');
    const m = dateObj.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function checkShopStatus(openingHours: string | string[]) {
    try {
      const hoursStr = Array.isArray(openingHours) ? openingHours.join("\n") : openingHours;
      if (!hoursStr) return { isOpen: false, text: t('kapali'), isClosed: true };

      const now = new Date();

      // Support both Turkish and English day names similar to the mobile app
      const dayNamesTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
      const dayNamesEng = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      const dayIndex = now.getDay();
      const currentDayTr = dayNamesTr[dayIndex];
      const currentDayEng = dayNamesEng[dayIndex];
      // Also fallback to translated ones just in case
      const currentDayTransTr = ["Pazar", "Pazartesi", t('sali'), t('carsamba'), t('persembe'), "Cuma", "Cumartesi"][dayIndex];

      const todayLine = hoursStr.split("\n").find((l: string) => {
        const lowerLine = l.toLowerCase();
        return lowerLine.startsWith(currentDayTr.toLowerCase() + ":") ||
          lowerLine.startsWith(currentDayTr.toLowerCase() + " ") ||
          lowerLine.startsWith(currentDayEng.toLowerCase() + ":") ||
          lowerLine.startsWith(currentDayEng.toLowerCase() + " ") ||
          lowerLine.startsWith(currentDayTransTr.toLowerCase() + ":") ||
          lowerLine.startsWith(currentDayTransTr.toLowerCase() + " ");
      });

      if (!todayLine) return { isOpen: false, text: t('kapali'), isClosed: true };

      const lowerLine = todayLine.toLowerCase();
      if (lowerLine.includes(t('kapali1').toLowerCase()) || lowerLine.includes("kapalı") || lowerLine.includes("closed")) {
        return { isOpen: false, text: t('bugunKapali'), isClosed: true };
      }

      const timePart = todayLine.split(": ").slice(1).join(": ").trim();
      if (!timePart || timePart === '-') return { isOpen: false, text: t('saat_bilgisi_yok'), isClosed: false };
      if (lowerLine.includes('24 saat') || lowerLine.includes('open 24')) return { isOpen: true, text: t('suAnAcik') };

      const ranges = timePart.includes(",") ? timePart.split(",") : [timePart];

      for (let range of ranges) {
        range = range.replace('–', '-').replace('.', ':').trim();
        if (!range || range === '-') continue;

        const parts = range.split("-");
        if (parts.length < 2) continue;

        const start = parseTime(parts[0].trim());
        let end = parseTime(parts[1].trim());

        if (!start || !end) continue;

        // Overnight handling
        if (end <= start) {
          end.setDate(end.getDate() + 1);
        }

        if (now >= start && now <= end) {
          return { isOpen: true, text: t('suAnAcik') };
        }
      }
      return { isOpen: false, text: t('suAnKapali') };
    } catch (e) {
      console.error("Status checking error", e);
      return { isOpen: false, text: t('hata') };
    }
  }

  // Turkish status labels for order display
  const orderStatusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Beklemede", color: "bg-yellow-600" },
    accepted: { label: t('onaylandi'), color: "bg-blue-600" },
    preparing: { label: t('hazirlaniyor'), color: "bg-blue-600" },
    ready: { label: t('hazir'), color: "bg-green-600" },
    onTheWay: { label: "Yolda", color: "bg-indigo-600" },
    delivered: { label: "Teslim Edildi", color: "bg-gray-600" },
    completed: { label: t('tamamlandi'), color: "bg-gray-600" },
    cancelled: { label: t('iptal1'), color: "bg-red-600" },
  };

  // Fallback plan labels for badge display (dynamic plans override these)
  const defaultPlanLabels: Record<string, { label: string; color: string }> = {
    none: { label: t('yok'), color: "bg-gray-800" },
  };

  // 🆕 Dynamic business type labels for UI - synced with /lib/business-types.ts
  const businessTypeLabels: Record<string, { label: string; emoji: string; color: string }> = {
    // === MERKEZI TİPLER (business-types.ts ile uyumlu) ===
    kasap: { label: "Kasap", emoji: "🥩", color: "bg-red-600" },
    market: { label: "Market", emoji: "🛒", color: "bg-green-600" },
    restoran: { label: t('restoran'), emoji: "🍽️", color: "bg-amber-600" },
    pastane: { label: t('pastaneTatlici'), emoji: "🎂", color: "bg-pink-600" },
    cicekci: { label: t('cicekci'), emoji: "🌸", color: "bg-purple-600" },
    cigkofte: { label: t('cigKofteci'), emoji: "🥙", color: "bg-emerald-600" },
    cafe: { label: "Kafe", emoji: "☕", color: "bg-amber-600" },
    catering: { label: "Catering", emoji: "🎉", color: "bg-indigo-600" },
    firin: { label: t('firin'), emoji: "🥖", color: "bg-amber-700" },
    // === ESKİ KEY'LER (geriye uyumluluk için) ===
    cigkofteci: { label: t('cigKofteci'), emoji: "🥙", color: "bg-lime-600" },
    kafe: { label: "Kafe", emoji: "☕", color: "bg-amber-600" },
    kafeterya: { label: "Kafeterya", emoji: "☕", color: "bg-yellow-700" },
    baklava: { label: "Baklava", emoji: "🍯", color: "bg-amber-600" },
    doner: { label: t('doner'), emoji: "🌯", color: "bg-yellow-600" },
    berber: { label: "Berber", emoji: "✂️", color: "bg-gray-600" },
  };

  // Helper to get business type display info (supports single type or array)
  function getBusinessTypeLabel(type?: string | string[]) {
    const defaultLabel = { label: t('isletme'), emoji: "🏪", color: "bg-gray-600" };

    if (!type) return defaultLabel;

    // Handle array of types (multi-type business)
    if (Array.isArray(type)) {
      if (type.length === 0) return defaultLabel;
      if (type.length === 1) {
        return businessTypeLabels[type[0].toLowerCase()] || defaultLabel;
      }
      // Multiple types: combine labels
      const labels = type.map(t => businessTypeLabels[t.toLowerCase()]?.label || t).join(" & ");
      const firstType = businessTypeLabels[type[0].toLowerCase()];
      return {
        label: labels,
        emoji: firstType?.emoji || "🏪",
        color: firstType?.color || "bg-gray-600"
      };
    }

    // Single type (legacy)
    return businessTypeLabels[type.toLowerCase()] || defaultLabel;
  }

  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = params.id as string;
  const initialTab = searchParams.get('tab') as 'overview' | 'orders' | 'reservations' | 'settings' || 'overview';

  const { admin, loading: adminLoading } = useAdmin();
  const { getActiveSectors } = useSectors();
  const dynamicSectorTypes = getActiveSectors();
  const [loading, setLoading] = useState(true); // Data loading state
  const [business, setBusiness] = useState<ButcherPartner | null>(null);
  const [orders, setOrders] = useState<MeatOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [activeTab, setActiveTab] = useState<
    "overview" | "orders" | "reservations" | "settings"
  >(initialTab);
  const [settingsSubTab, setSettingsSubTab] = useState<
    "isletme" | "menu" | "personel" | "masa" | "abonelik" | "teslimat" | "odeme"
  >("isletme");
  const [menuInternalTab, setMenuInternalTab] = useState<"kategoriler" | "urunler">("kategoriler");
  const [isletmeInternalTab, setIsletmeInternalTab] = useState<"bilgiler" | "fatura" | "zertifikalar" | "gorseller" | "saatler">("bilgiler");
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  // 🆕 Inline Category Management
  const [inlineCategories, setInlineCategories] = useState<{ id: string; name: any; icon: string; order: number; isActive: boolean; productCount?: number }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: any; icon: string; order: number; isActive: boolean } | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ name: any, icon: string, isActive: boolean }>({ name: { tr: '' }, icon: '📦', isActive: true });
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const CATEGORY_ICONS = ['🥩', '🐑', '🐄', '🐔', '🥓', '📦', '🍖', '🌿', '🧈', '🥚', '🍕', '🍔', '🥗', '🍰', '🥤', '🧀', '🍗', '🌶️', '🫒', '🥖'];

  // 🆕 Inline Product Management
  const [inlineProducts, setInlineProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // 🌟 Sponsored Products state
  const [sponsoredProducts, setSponsoredProducts] = useState<string[]>([]);
  const [sponsoredSettings, setSponsoredSettings] = useState<{
    enabled: boolean;
    feePerConversion: number;
    maxProductsPerBusiness: number;
  }>({ enabled: false, feePerConversion: 0.40, maxProductsPerBusiness: 5 });
  const [sponsoredSaving, setSponsoredSaving] = useState(false);

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'orders', 'reservations', 'settings'].includes(tab)) {
      setActiveTab(tab as any);
    }
    const subTab = searchParams.get('subTab');
    if (subTab && ['isletme', 'menu', 'personel', 'masa', 'abonelik', 'teslimat', 'odeme'].includes(subTab)) {
      setSettingsSubTab(subTab as any);
      setActiveTab('settings');
    }
  }, [searchParams]);

  // Close settings dropdown when clicking outside
  useEffect(() => {
    if (!showSettingsDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.settings-dropdown-container')) {
        setShowSettingsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsDropdown]);
  const [products, setProducts] = useState<any[]>([]);
  // 🆕 Dynamically loaded subscription plans from Firestore
  const [availablePlans, setAvailablePlans] = useState<{ code: string; name: string; color: string }[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productMode, setProductMode] = useState<'standard' | 'custom'>('standard');
  const [selectedMasterId, setSelectedMasterId] = useState("");
  // 🆕 Firestore'dan yüklenen master ürünler (allowedBusinessTypes ile filtrelenecek)
  const [firestoreMasterProducts, setFirestoreMasterProducts] = useState<MasterProduct[]>([]);
  const [customProductForm, setCustomProductForm] = useState({
    name: { tr: "" } as any,
    price: "",
    unit: "kg",
    imageFile: null as File | null,
  });
  const [addingProduct, setAddingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Form state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    customerId: "",
    brand: "" as "tuna" | "akdeniz_toros" | "independent" | "",
    brandLabelActive: false,
    // 🔴 TUNA/Toros ürünleri satışı (Filtreleme için)
    sellsTunaProducts: false,
    sellsTorosProducts: false,
    // 🆕 Multi-type support: bir işletme birden fazla tür olabilir
    types: [] as string[],  // e.g. ["kasap", "market"]
    street: "",
    postalCode: "",
    city: "",
    country: "DE",
    shopPhone: "",
    shopEmail: "",
    openingHours: "",
    contactName: "",
    contactSurname: "",
    contactPhone: "",
    contactEmail: "",
    contactRole: "",
    hasDifferentBillingAddress: false,
    billingStreet: "",
    billingPostalCode: "",
    billingCity: "",
    billingCountry: "DE",
    subscriptionPlan: "none" as string,
    monthlyFee: 0,
    accountBalance: 0,
    notes: "",
    supportsDelivery: false,
    deliveryPostalCode: "",
    deliveryRadius: 5,
    minDeliveryOrder: 0,
    deliveryFee: 0,
    // 🆕 Gelişmiş Sipariş Saatleri (Lieferando benzeri)
    deliveryStartTime: "" as string,   // "HH:MM" - Kurye başlangıç saati
    deliveryEndTime: "" as string,     // "HH:MM" - Kurye bitiş saati
    pickupStartTime: "" as string,     // "HH:MM" - Gel Al başlangıç saati
    pickupEndTime: "" as string,       // "HH:MM" - Gel Al bitiş saati
    preOrderEnabled: false,            // Kapalıyken ön sipariş alabilir mi?
    freeDeliveryThreshold: 0,          // Bu tutarın üzerinde teslimat ücretsiz (€)
    // 🆕 Geçici Kurye Kapatma
    temporaryDeliveryPaused: false,    // Kurye hizmeti geçici olarak durduruldu mu?
    acceptsCardPayment: false,
    vatNumber: "",
    imageUrl: "",
    googlePlaceId: "",
    rating: 0,
    reviewCount: 0,
    reviews: [] as any[],
    bankIban: "",
    bankBic: "",
    bankAccountHolder: "",
    bankName: "",
    // 🆕 Lieferando-style fields
    cuisineType: "",      // "Kebap, Döner, Türkisch" - Mutfak türü/alt başlık
    logoUrl: "",          // Kare işletme logosu URL'i
    // 🆕 İletişim & Sosyal Medya
    website: "",
    instagram: "",
    facebook: "",
    whatsapp: "",
    tiktok: "",
    youtube: "",
    // 🆕 Fatura Bilgileri
    billingName: "",
    billingVatNumber: "",
    // 🆕 Masa Rezervasyonu
    hasReservation: false,   // Masa rezervasyonu aktif mi?
    tableCapacity: 0,        // Toplam oturma kapasitesi (kişi)
    maxReservationTables: 0, // Aynı anda rezerve edilebilecek max masa sayısı
    // 🆕 Gelişmiş Masa Yönetimi
    tables: [] as { label: string; section: string; sortOrder: number }[],
    tableSections: [] as string[],
    // 🆕 Yerinde Sipariş Ayarları
    dineInPaymentMode: 'payLater' as string,  // 'payFirst' = Hemen öde (fast food), 'payLater' = Çıkışta öde (restoran)
    hasTableService: false,   // Garson servisi var mı?
  });

  // Google Places search states
  const [googleSearchQuery, setGoogleSearchQuery] = useState("");
  const [googleSearchResults, setGoogleSearchResults] = useState<any[]>([]);
  const [googleSearchLoading, setGoogleSearchLoading] = useState(false);
  const [showGoogleDropdown, setShowGoogleDropdown] = useState(false);

  // Google Places search function
  const handleGooglePlacesSearch = async (searchQuery?: string) => {
    const queryToSearch = searchQuery || googleSearchQuery;
    if (!queryToSearch.trim() || queryToSearch.length < 3) {
      setGoogleSearchResults([]);
      setShowGoogleDropdown(false);
      return;
    }

    setGoogleSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/google-place?action=search&query=${encodeURIComponent(queryToSearch)}`);
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        setGoogleSearchResults(data.candidates);
        setShowGoogleDropdown(true);
      } else {
        setGoogleSearchResults([]);
        // Don't show toast on empty results during live search
      }
    } catch (error) {
      console.error('Google search error:', error);
    } finally {
      setGoogleSearchLoading(false);
    }
  };

  // Debounced live search - triggers as user types
  useEffect(() => {
    if (!googleSearchQuery || googleSearchQuery.length < 3) {
      setGoogleSearchResults([]);
      setShowGoogleDropdown(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      handleGooglePlacesSearch(googleSearchQuery);
    }, 400); // 400ms debounce

    return () => clearTimeout(debounceTimer);
  }, [googleSearchQuery]);

  // Select a Google Place result
  const handleSelectGooglePlace = async (place: any) => {
    setShowGoogleDropdown(false);
    setGoogleSearchResults([]);
    setGoogleSearchQuery("");

    // Set Place ID
    setFormData(prev => ({
      ...prev,
      googlePlaceId: place.place_id,
    }));

    // Fetch full details
    try {
      const res = await fetch(`/api/admin/google-place?placeId=${place.place_id}`);
      const data = await res.json();

      if (!data.error) {
        setFormData(prev => ({
          ...prev,
          companyName: data.name || prev.companyName,
          street: data.address?.street || prev.street,
          postalCode: data.address?.postalCode || prev.postalCode,
          city: data.address?.city || prev.city,
          shopPhone: data.shopPhone || prev.shopPhone,
          imageUrl: data.photoUrl || prev.imageUrl,
          rating: data.rating || prev.rating,
          reviewCount: data.userRatingsTotal || prev.reviewCount,
          openingHours: Array.isArray(data.openingHours) ? data.openingHours.join('\n') : (data.openingHours || prev.openingHours),
        }));
        showToast(t('googledanBilgilerCekildi'), 'success');
      }
    } catch (error) {
      console.error('Fetch place details error:', error);
    }
  };

  // Sub-admin (işçi) management state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState<
    {
      id: string;
      displayName: string;
      email?: string;
      phoneNumber?: string;
      adminType: string;
      isActive?: boolean;
    }[]
  >([]);
  const [staffStatusFilter, setStaffStatusFilter] = useState<'active' | 'archived'>('active');
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [activeShifts, setActiveShifts] = useState<{
    id: string;
    displayName?: string;
    email?: string;
    shiftStatus?: string;
    shiftStartedAt?: any;
    shiftAssignedTables?: string[];
    shiftStartLocation?: { address?: string; lat?: number; lng?: number };
  }[]>([]);
  const [staffSearchResults, setStaffSearchResults] = useState<
    { id: string; displayName?: string; email?: string; phoneNumber?: string }[]
  >([]);
  const [staffSearchLoading, setStaffSearchLoading] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteCountryCode, setInviteCountryCode] = useState("+49");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("Personel");
  const [staffLoading, setStaffLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    success: boolean;
    tempPassword?: string;
    notifications?: { email: { sent: boolean }; whatsapp: { sent: boolean }; sms: { sent: boolean } };
  } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: (selectedRole?: string) => void;
    confirmText?: string;
    confirmColor?: string;
    showRoleSelect?: boolean;
    currentRole?: string;
    staffId?: string;
    staffName?: string;
  }>({ show: false, title: "", message: "", onConfirm: () => { } });
  const [selectedNewRole, setSelectedNewRole] = useState("");

  // 🆕 Plan features resolved from subscription_plans collection
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>({});

  // Load admin data - REMOVED (Handled by AdminProvider)

  // Check if admin is ready to load data
  useEffect(() => {
    if (admin && !adminLoading) {
      // We can trigger data loading here if needed, but the individual load functions are called in another useEffect
    }
  }, [admin, adminLoading]);

  // Load butcher data
  const loadBusiness = useCallback(async () => {
    if (!businessId) return;

    // New business mode - start with empty form in edit mode
    if (businessId === 'new') {
      setBusiness(null);
      setIsEditing(true);
      setLoading(false);
      return;
    }

    try {
      const businessDoc = await getDoc(doc(db, "businesses", businessId));
      if (businessDoc.exists()) {
        const data = {
          id: businessDoc.id,
          ...businessDoc.data(),
        } as ButcherPartner;
        setBusiness(data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        // 🌟 Load sponsored products list
        setSponsoredProducts(d.sponsoredProducts || []);
        setFormData({
          companyName: d.companyName || "",
          customerId: d.customerId || "",
          brand: d.brand || "",
          brandLabelActive: d.brandLabelActive !== false,
          // 🔴 TUNA/Toros ürünleri satışı
          sellsTunaProducts: d.sellsTunaProducts ?? false,
          sellsTorosProducts: d.sellsTorosProducts ?? false,
          // 🆕 Multi-type support: yükle types array'i
          types: d.types || (d.type ? [d.type] : []),  // Legacy: single type'ı array'e çevir
          street: d.address?.street || "",
          postalCode: d.address?.postalCode || "",
          city: d.address?.city || "",
          country: d.address?.country || "DE",
          shopPhone: d.shopPhone || "",
          shopEmail: d.shopEmail || "",
          openingHours: Array.isArray(d.openingHours)
            ? d.openingHours.join("\n")
            : d.openingHours || "",
          contactName: d.contactPerson?.name || "",
          contactSurname: d.contactPerson?.surname || "",
          contactPhone: d.contactPerson?.phone || "",
          contactEmail: d.contactPerson?.email || "",
          contactRole: d.contactPerson?.role || "",
          hasDifferentBillingAddress: d.hasDifferentBillingAddress || false,
          billingStreet: d.billingAddress?.street || "",
          billingPostalCode: d.billingAddress?.postalCode || "",
          billingCity: d.billingAddress?.city || "",
          billingCountry: d.billingAddress?.country || "DE",
          subscriptionPlan: d.subscriptionPlan || "basic",
          monthlyFee: d.monthlyFee || 0,
          accountBalance: d.accountBalance || 0,
          notes: d.notes || "",
          supportsDelivery: d.supportsDelivery || false,
          deliveryPostalCode: d.deliveryPostalCode || "",
          deliveryRadius: d.deliveryRadius || 5,
          minDeliveryOrder: d.minDeliveryOrder || 0,
          deliveryFee: d.deliveryFee || 0,
          // 🆕 Gelişmiş Sipariş Saatleri
          deliveryStartTime: d.deliveryStartTime || "",
          deliveryEndTime: d.deliveryEndTime || "",
          pickupStartTime: d.pickupStartTime || "",
          pickupEndTime: d.pickupEndTime || "",
          preOrderEnabled: d.preOrderEnabled || false,
          freeDeliveryThreshold: d.freeDeliveryThreshold || 0,
          // 🆕 Geçici Kurye Kapatma
          temporaryDeliveryPaused: d.temporaryDeliveryPaused || false,
          acceptsCardPayment: d.acceptsCardPayment || false,
          vatNumber: d.vatNumber || "",
          imageUrl: d.imageUrl || "",
          googlePlaceId: d.googlePlaceId || "",
          rating: d.rating || 0,
          reviewCount: d.reviewCount || 0,
          reviews: d.reviews || [],
          bankIban: d.bankDetails?.iban || "",
          bankBic: d.bankDetails?.bic || "",
          bankAccountHolder: d.bankDetails?.accountHolder || "",
          bankName: d.bankDetails?.bankName || "",
          // 🆕 Lieferando-style fields
          cuisineType: d.cuisineType || "",
          logoUrl: d.logoUrl || "",
          // 🆕 İletişim & Sosyal Medya
          website: d.website || "",
          instagram: d.instagram || "",
          facebook: d.facebook || "",
          whatsapp: d.whatsapp || "",
          tiktok: d.tiktok || "",
          youtube: d.youtube || "",
          // 🆕 Fatura Bilgileri
          billingName: d.billingAddress?.name || "",
          billingVatNumber: d.billingAddress?.vatNumber || "",
          // 🆕 Masa Rezervasyonu
          hasReservation: d.hasReservation || false,
          tableCapacity: d.tableCapacity || 0,
          maxReservationTables: d.maxReservationTables || 0,
          // 🆕 Gelişmiş Masa Yönetimi
          tables: Array.isArray(d.tables) ? d.tables : [],
          tableSections: Array.isArray(d.tableSections) ? d.tableSections : [],
          // 🆕 Yerinde Sipariş Ayarları
          dineInPaymentMode: d.dineInPaymentMode || 'payLater',
          hasTableService: d.hasTableService || false,
        });

        // 🆕 Resolve plan features from subscription_plans collection
        const planCode = d.subscriptionPlan || 'basic';
        try {
          const plansQuery = query(
            collection(db, 'subscription_plans'),
            where('code', '==', planCode)
          );
          const planSnap = await getDocs(plansQuery);
          if (!planSnap.empty) {
            const planData = planSnap.docs[0].data();
            setPlanFeatures(planData.features || {});
          }
        } catch (e) {
          console.error('Error loading plan features:', e);
        }
      }
    } catch (error) {
      console.error("Error loading business:", error);
    }
    setLoading(false);
  }, [businessId]);

  // Load orders
  const loadOrders = useCallback(async () => {
    if (!businessId) return;
    try {
      // Query meat_orders collection with butcherId (matches main Orders page)
      // Note: removed orderBy to avoid index requirement - sorting client-side
      const ordersQuery = query(
        collection(db, "meat_orders"),
        where("butcherId", "==", businessId),
        limit(50),
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersData = ordersSnap.docs
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            // Normalize total price with fallbacks (matches main orders page)
            totalPrice: d.totalPrice || d.totalAmount || d.total || 0,
            customerName: d.customerName || d.userDisplayName || d.userName || '',
            customerPhone: d.customerPhone || d.userPhone || '',
            orderNumber: d.orderNumber || doc.id.slice(0, 6).toUpperCase(),
          } as MeatOrder;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
          return bTime - aTime; // DESC
        });
      setOrders(ordersData);
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  }, [businessId]);

  // Load staff
  const loadStaff = useCallback(async () => {
    if (!businessId) return;
    try {
      const staffQuery = query(
        collection(db, "admins"),
        where("businessId", "==", businessId),
      );
      const staffSnap = await getDocs(staffQuery);
      const staffData = staffSnap.docs.map((doc) => ({
        id: doc.id,
        displayName: doc.data().displayName || t('isimsiz'),
        email: doc.data().email,
        phoneNumber: doc.data().phoneNumber,
        adminType: doc.data().adminType || "Personel",
        isActive: doc.data().isActive,
      }));
      setStaffList(staffData);
    } catch (error) {
      console.error("Error loading staff:", error);
    }
  }, [businessId]);

  // Load products
  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    try {
      const productsQuery = collection(db, `businesses/${businessId}/products`);
      const productsSnap = await getDocs(productsQuery);
      const prods = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, [businessId]);

  // 🆕 Load Inline Categories & Products for Menü tab
  const loadInlineCategories = useCallback(async () => {
    if (!businessId) return;
    setLoadingCategories(true);
    try {
      const catRef = collection(db, `businesses/${businessId}/categories`);
      const q = query(catRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setInlineCategories(cats);
    } catch (error) {
      console.error('Error loading inline categories:', error);
    }
    setLoadingCategories(false);
  }, [businessId]);

  const loadInlineProducts = useCallback(async () => {
    if (!businessId) return;
    setLoadingProducts(true);
    try {
      const snapshot = await getDocs(collection(db, `businesses/${businessId}/products`));
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      prods.sort((a: any, b: any) => {
        const catA = a.category || '';
        const catB = b.category || '';
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.name || '').localeCompare(b.name || '');
      });
      setInlineProducts(prods);
    } catch (error) {
      console.error('Error loading inline products:', error);
    }
    setLoadingProducts(false);
  }, [businessId]);

  useEffect(() => {
    if (settingsSubTab === 'menu' && businessId) {
      loadInlineCategories();
      loadInlineProducts();
    }
  }, [settingsSubTab, businessId, loadInlineCategories, loadInlineProducts]);

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!businessId || !categoryForm.name.trim()) return;
    setSavingCategory(true);
    try {
      const catRef = collection(db, `businesses/${businessId}/categories`);
      if (editingCategory) {
        await updateDoc(doc(db, `businesses/${businessId}/categories`, editingCategory.id), {
          name: categoryForm.name,
          icon: categoryForm.icon,
          isActive: categoryForm.isActive,
          updatedAt: new Date(),
        });
      } else {
        await addDoc(catRef, {
          name: categoryForm.name,
          icon: categoryForm.icon,
          isActive: categoryForm.isActive,
          order: inlineCategories.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      await loadInlineCategories();
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: { tr: '' }, icon: '📦', isActive: true });
    } catch (error) {
      console.error('Error saving category:', error);
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!businessId) return;
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/categories`, catId));
      setInlineCategories(prev => prev.filter(c => c.id !== catId));
      setDeletingCategoryId(null);
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const moveCategoryInline = async (index: number, direction: 'up' | 'down') => {
    if (!businessId) return;
    const newCats = [...inlineCategories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCats.length) return;
    [newCats[index], newCats[targetIndex]] = [newCats[targetIndex], newCats[index]];
    try {
      for (let i = 0; i < newCats.length; i++) {
        await updateDoc(doc(db, `businesses/${businessId}/categories`, newCats[i].id), { order: i });
      }
      setInlineCategories(newCats.map((c, i) => ({ ...c, order: i })));
    } catch (error) {
      console.error('Error reordering:', error);
    }
  };



  // 🆕 Load Master Products from Firestore (filtered by business type)
  const loadMasterProducts = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "master_products"));
      const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MasterProduct);
      // Filter by business types if available
      const businessTypes = (business as any)?.types || [(business as any)?.type] || [];
      const filteredProducts = allProducts.filter(p => {
        // If no allowedBusinessTypes defined, show to all (backward compat)
        if (!p.allowedBusinessTypes || p.allowedBusinessTypes.length === 0) return true;
        // Check if any business type matches
        return businessTypes.some((bt: string) => p.allowedBusinessTypes?.includes(bt));
      });
      setFirestoreMasterProducts(filteredProducts);
    } catch (error) {
      console.error("Error loading master products:", error);
      // Fallback to hardcoded list if Firestore fails
      setFirestoreMasterProducts(MASTER_PRODUCTS);
    }
  }, [business]);

  // Handle Delete Product
  const handleDeleteProduct = (productId: string) => {
    if (!businessId) return;
    setConfirmModal({
      show: true,
      title: t('urunSil'),
      message: t('buUrunuSilmekIstediginizeEminMisiniz'),
      confirmText: t('evet_sil'),
      confirmColor: 'bg-red-600 hover:bg-red-500',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
          await deleteDoc(doc(db, `businesses/${businessId}/products`, productId));
          showToast(t('urunSilindi'), "success");
          loadProducts();
        } catch (error) {
          console.error("Error deleting product:", error);
          showToast(t('urunSilinirkenHataOlustu'), "error");
        }
      },
    });
  };

  // Toggle Product Active Status
  const toggleProductActive = async (productId: string, currentStatus: boolean) => {
    if (!businessId) return;
    try {
      await updateDoc(doc(db, `businesses/${businessId}/products`, productId), {
        isActive: !currentStatus,
        updatedAt: new Date(),
      });
      showToast(currentStatus ? t('urunPasifYapildi') : t('urunAktifYapildi'), "success");
      loadProducts();
    } catch (error) {
      console.error("Error toggling product:", error);
      showToast(t('urunDurumuDegistirilirkenHataOlustu'), "error");
    }
  };

  // Handle Add Product
  const handleAddProduct = async () => {
    if (!businessId) return;
    setAddingProduct(true);
    try {
      const productData: Record<string, unknown> = {
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (productMode === 'standard' && selectedMasterId) {
        // Standard product from master list (use Firestore with fallback)
        const masterProduct = (firestoreMasterProducts.length > 0 ? firestoreMasterProducts : MASTER_PRODUCTS).find(p => p.id === selectedMasterId);
        if (!masterProduct) throw new Error("Master product not found");

        productData.masterId = selectedMasterId;
        productData.name = masterProduct.name;
        productData.category = masterProduct.category;
        productData.unit = 'kg'; // Default unit
        productData.price = parseFloat(customProductForm.price) || 0;
        productData.isCustom = false;
        // Copy optionGroups from master product (Lieferando-style variants/extras)
        productData.optionGroups = (masterProduct as any).optionGroups || [];
      } else if (productMode === 'custom') {
        // Custom product
        productData.name = customProductForm.name;
        productData.price = parseFloat(customProductForm.price) || 0;
        productData.unit = customProductForm.unit || 'kg';
        productData.isCustom = true;
        productData.approvalStatus = 'pending';

        // Handle image upload if provided
        if (customProductForm.imageFile) {
          // TODO: Upload image to storage
          // For now, just skip image
        }
      }

      await addDoc(collection(db, `businesses/${businessId}/products`), productData);
      showToast(t('urunEklendi'), "success");
      setProductModalOpen(false);
      setSelectedMasterId('');
      setCustomProductForm({ name: { tr: '' }, price: '', unit: 'kg', imageFile: null });
      loadProducts();
    } catch (error) {
      console.error("Error adding product:", error);
      showToast(t('urunEklenirkenHataOlustu'), "error");
    } finally {
      setAddingProduct(false);
    }
  };

  useEffect(() => {
    if (admin) {
      loadBusiness();
      loadOrders();
      loadStaff();
      loadProducts(); // Load products when admin is ready
    }
  }, [admin, loadBusiness, loadOrders, loadStaff, loadProducts]);

  // 🔴 Real-time active shifts listener
  // Mobile writes shiftBusinessId (not businessId) — query both fields + merge
  useEffect(() => {
    if (!businessId || businessId === 'new') return;

    // Query 1: Staff assigned via shiftBusinessId (primary, written by shift_service.dart)
    const q1 = query(
      collection(db, "admins"),
      where("isOnShift", "==", true),
      where("shiftBusinessId", "==", businessId)
    );
    // Query 2: Staff assigned via assignedBusinesses array (legacy/driver support)
    const q2 = query(
      collection(db, "admins"),
      where("isOnShift", "==", true),
      where("assignedBusinesses", "array-contains", businessId)
    );

    let snap1Docs: any[] = [];
    let snap2Docs: any[] = [];

    const merge = () => {
      const seen = new Set<string>();
      const merged: any[] = [];
      [...snap1Docs, ...snap2Docs].forEach(d => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          merged.push(d);
        }
      });
      setActiveShifts(merged);
    };

    const unsub1 = onSnapshot(q1, (snap) => {
      snap1Docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      merge();
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      snap2Docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      merge();
    });

    return () => { unsub1(); unsub2(); };
  }, [businessId]);

  // 🕐 Record recent visit to localStorage for quick-access chip on list page
  useEffect(() => {
    if (business && businessId && businessId !== 'new') {
      try {
        const key = 'lokma_recent_businesses';
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        const bd = business as any;
        const entry = {
          id: businessId,
          name: bd.companyName || t('isimsiz'),
          city: bd.address?.city || bd.city || '',
          type: bd.businessCategories?.[0] || bd.types?.[0] || bd.type || '',
          visitedAt: Date.now(),
        };
        // Remove duplicate, prepend, keep max 5
        const updated = [entry, ...stored.filter((e: any) => e.id !== businessId)].slice(0, 5);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        // Ignore localStorage errors (private browsing etc.)
      }
    }
  }, [business, businessId]);

  // 🆕 Load master products when business is loaded (for type filtering)
  useEffect(() => {
    if (business) {
      loadMasterProducts();
      // 🌟 Load platform sponsored settings
      const loadSponsoredSettings = async () => {
        try {
          const sponsoredDoc = await getDoc(doc(db, 'platformSettings', 'sponsored'));
          if (sponsoredDoc.exists()) {
            const sData = sponsoredDoc.data();
            setSponsoredSettings({
              enabled: sData.enabled ?? false,
              feePerConversion: sData.feePerConversion ?? 0.40,
              maxProductsPerBusiness: sData.maxProductsPerBusiness ?? 5,
            });
          }
        } catch (e) {
          console.error('Error loading sponsored settings:', e);
        }
      };
      loadSponsoredSettings();
    }
  }, [business, loadMasterProducts]);

  // 🆕 Load subscription plans from Firestore when business is loaded
  useEffect(() => {
    const loadPlans = async () => {
      try {
        // Business stores type as specific value (e.g. 'restoran'), but plans use
        // the sector category (e.g. 'yemek'). Map via BUSINESS_TYPES config.
        const rawType = (business as any)?.types?.[0] || (business as any)?.type || '';
        const sectorCategory = rawType ? (BUSINESS_TYPES[rawType as keyof typeof BUSINESS_TYPES]?.category || rawType) : '';
        const plans = await subscriptionService.getAllPlans(sectorCategory || undefined);
        setAvailablePlans(plans.map(p => ({
          code: p.code || p.id,
          name: p.name,
          color: p.color || 'bg-gray-600',
        })));
      } catch (error) {
        console.error('Error loading subscription plans:', error);
      }
    };
    if (business) {
      loadPlans();
    }
  }, [business]);

  // Handle Image Selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setFormData({ ...formData, imageUrl: previewUrl });
    }
  };

  // Fetch data (Photo + Opening Hours) from Google Places
  // Fetch data (Photo + Opening Hours) from Google Places - SERVER SIDE
  const fetchGoogleData = async () => {
    if (!formData.googlePlaceId) {
      alert(t('hataGooglePlaceIdBos'));
      return;
    }

    setUploading(true);
    console.log(
      "Fetching Google Data from Server for:",
      formData.googlePlaceId,
    );

    try {
      const res = await fetch(
        `/api/admin/google-place?placeId=${formData.googlePlaceId}`,
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('sunucuHatasi'));
      }

      console.log(t('server_api_response'), data);

      let successMsg = "";
      let updates: any = {};

      // 1. OPENING HOURS
      if (data.openingHours) {
        let hoursList = Array.isArray(data.openingHours) ? data.openingHours : data.openingHours.split("\n");

        // --- STANDARDIZATION LOGIC (Mirroring Mobile App) ---
        const enToTr: Record<string, string> = {
          'Monday': 'Pazartesi', 'Tuesday': t('sali'), 'Wednesday': t('carsamba'),
          'Thursday': t('persembe'), 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar'
        };

        hoursList = hoursList.map((line: string) => {
          let cleanLine = line.trim();

          // 1. Check for English Day Names and Translate
          for (const [eng, tr] of Object.entries(enToTr)) {
            if (cleanLine.startsWith(eng)) {
              cleanLine = cleanLine.replace(eng, tr);
              break;
            }
          }

          // 2. Normalize Time Format (12h AM/PM -> 24h)
          // Regex: 8:00 AM, 8:00 PM, 7 PM etc.
          cleanLine = cleanLine.replace(/(\d{1,2})(:(\d{2}))?\s*([AP]M)/gi, (match, hStr, _, mStr, period) => {
            let h = parseInt(hStr);
            const m = mStr ? parseInt(mStr) : 0;
            period = period.toUpperCase();

            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;

            const hFormatted = h.toString().padStart(2, '0');
            const mFormatted = m.toString().padStart(2, '0');
            return `${hFormatted}:${mFormatted}`;
          });

          // 3. Normalize Separators
          cleanLine = cleanLine.replace(/–/g, '-').replace(/—/g, '-');

          // 4. Translate "Closed" -> "Kapalı"
          cleanLine = cleanLine.replace(/Closed/gi, t('kapali'));

          return cleanLine;
        });
        // ----------------------------------------------------

        updates.openingHours = hoursList.join("\n");
        successMsg += "Saatler (Normalize Edildi), ";
      }

      // 2. PHONE
      if (data.shopPhone && !formData.shopPhone) {
        updates.shopPhone = data.shopPhone;
        successMsg += "Telefon, ";
      }

      // 2.5 RATINGS & REVIEWS
      if (data.rating) {
        updates.rating = data.rating;
        updates.reviewCount = data.userRatingsTotal || data.reviewCount; // Use userRatingsTotal if available
        if (data.reviews) {
          updates.reviews = data.reviews; // Save full reviews array
        }
        successMsg += "Puan ve Yorumlar, ";
      }

      // 3. PHOTO (Async Fetch Blob)
      if (data.photoUrl) {
        successMsg += t('fotograf');
        try {
          // Try to fetch blob for upload
          const response = await fetch(data.photoUrl);
          if (!response.ok) throw new Error(t('image_fetch_failed'));

          const blob = await response.blob();
          const file = new File([blob], "google_place_photo.jpg", {
            type: "image/jpeg",
          });

          setImageFile(file);
          const previewUrl = URL.createObjectURL(file);
          // Use functional update to ensure we have latest updates
          setFormData((prev) => ({
            ...prev,
            ...updates,
            imageUrl: previewUrl,
          }));
        } catch (fetchErr) {
          console.warn(
            "Photo fetch failed (CORS?), using direct URL:",
            fetchErr,
          );
          setFormData((prev) => ({
            ...prev,
            ...updates,
            imageUrl: data.photoUrl,
          }));
        }
      } else {
        setFormData((prev) => ({ ...prev, ...updates }));
      }

      if (successMsg) {
        showToast(`${t('basarili')} ${successMsg}`, "success");
      } else {
        showToast(t('veri_bulundu_ama_eksik_foto_saat_yok'), "error");
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      alert(`Hata: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    const isNewBusiness = businessId === 'new';
    if (!isNewBusiness && !business) return;

    // 🆕 Duplicate detection for new businesses
    if (isNewBusiness) {
      try {
        // Check for duplicate Google Place ID
        if (formData.googlePlaceId) {
          const placeIdQuery = query(
            collection(db, 'businesses'),
            where('googlePlaceId', '==', formData.googlePlaceId)
          );
          const placeIdSnapshot = await getDocs(placeIdQuery);
          if (!placeIdSnapshot.empty) {
            const existingBusiness = placeIdSnapshot.docs[0].data();
            showToast(`${t('buIsletmeZatenSistemdeVar')}${existingBusiness.companyName}"`, 'error');
            return;
          }
        }

        // Check for duplicate address (street + postalCode + city)
        if (formData.street && formData.postalCode && formData.city) {
          const addressQuery = query(
            collection(db, 'businesses'),
            where('address.street', '==', formData.street),
            where('address.postalCode', '==', formData.postalCode),
            where('address.city', '==', formData.city)
          );
          const addressSnapshot = await getDocs(addressQuery);
          if (!addressSnapshot.empty) {
            const existingBusiness = addressSnapshot.docs[0].data();
            showToast(`${t('buAdresZatenSistemdeKayitli')}${existingBusiness.companyName}"`, 'error');
            return;
          }
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
        // Continue with save if check fails
      }
    }

    setSaving(true);
    try {
      let downloadURL = formData.imageUrl;

      // Check if we are trying to save a Blob URL without a file (should not happen, but safety first)
      if (downloadURL.startsWith("blob:") && !imageFile) {
        console.warn(
          "Attempted to save Blob URL without file. Reverting to previous image.",
        );
        downloadURL = isNewBusiness ? "" : (business?.imageUrl || ""); // Revert to old image
      }

      // Upload image if selected
      if (imageFile) {
        setUploading(true);
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const safeButcherId = isNewBusiness ? 'new_business' : (business?.id || "unknown_butcher");
        const storageRef = ref(
          storage,
          `butcher_images/${safeButcherId}/${fileName}`,
        );

        // Use resumable upload for better debugging and progress
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        downloadURL = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("Upload is " + progress + "% done");
              if (progress % 20 < 5) {
                // Show toast sparingly
                showToast(`${t('yukleniyor1')}${Math.round(progress)}`, "success");
              }
            },
            (error) => {
              console.error("Upload failed:", error);
              reject(error);
            },
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            },
          );
        });

        console.log(t('image_uploaded_successfully'), downloadURL);
        setUploading(false);
      }

      const updatedData: Record<string, any> = {
        companyName: formData.companyName || "",
        customerId: formData.customerId || "",
        brand: formData.brand || null,
        brandLabelActive: formData.brandLabelActive !== false,
        // 🔴 TUNA/Toros ürünleri satışı (Filtreleme için)
        sellsTunaProducts: formData.sellsTunaProducts ?? false,
        sellsTorosProducts: formData.sellsTorosProducts ?? false,
        // 🆕 Multi-type support: types array + legacy type field
        types: formData.types || [],
        type: formData.types?.[0] || "",  // Legacy: ilk tür backward compat için
        // 🆕 Lieferando-style fields
        cuisineType: formData.cuisineType || "",
        logoUrl: formData.logoUrl || "",
        // 🆕 İletişim & Sosyal Medya
        website: formData.website || "",
        instagram: formData.instagram || "",
        facebook: formData.facebook || "",
        whatsapp: formData.whatsapp || "",
        tiktok: formData.tiktok || "",
        youtube: formData.youtube || "",
        address: {
          street: formData.street || "",
          postalCode: formData.postalCode || "",
          city: formData.city || "",
          country: formData.country || "DE",
        },
        shopPhone: formData.shopPhone || "",
        shopEmail: formData.shopEmail || "",
        openingHours: formData.openingHours ? formData.openingHours.split("\n") : [],
        contactPerson: {
          name: formData.contactName || "",
          surname: formData.contactSurname || "",
          phone: formData.contactPhone || "",
          email: formData.contactEmail || "",
          role: formData.contactRole || "",
        },
        hasDifferentBillingAddress:
          formData.hasDifferentBillingAddress || false,
        subscriptionPlan: formData.subscriptionPlan || "basic",
        monthlyFee: Number(formData.monthlyFee) || 0,
        accountBalance: Number(formData.accountBalance) || 0,
        notes: formData.notes || "",
        supportsDelivery: formData.supportsDelivery || false,
        rating: formData.rating || 0,
        reviewCount: formData.reviewCount || 0,
        reviews: Array.isArray(formData.reviews) ? formData.reviews : [], // Ensure not undefined
        deliveryPostalCode: formData.deliveryPostalCode || "",
        deliveryRadius: Number(formData.deliveryRadius) || 0,
        minDeliveryOrder: Number(formData.minDeliveryOrder) || 0,
        deliveryFee: Number(formData.deliveryFee) || 0,
        // 🆕 Gelişmiş Sipariş Saatleri
        deliveryStartTime: formData.deliveryStartTime || null,
        deliveryEndTime: formData.deliveryEndTime || null,
        pickupStartTime: formData.pickupStartTime || null,
        pickupEndTime: formData.pickupEndTime || null,
        preOrderEnabled: formData.preOrderEnabled || false,
        freeDeliveryThreshold: Number(formData.freeDeliveryThreshold) || 0,
        // 🆕 Geçici Kurye Kapatma
        temporaryDeliveryPaused: formData.temporaryDeliveryPaused || false,
        // 🆕 Masa Rezervasyonu
        hasReservation: formData.hasReservation || false,
        tableCapacity: Number(formData.tableCapacity) || 0,
        maxReservationTables: Number(formData.maxReservationTables) || 0,
        // 🆕 Gelişmiş Masa Yönetimi
        tables: formData.tables || [],
        tableSections: formData.tableSections || [],
        // 🆕 Yerinde Sipariş Ayarları
        dineInPaymentMode: formData.dineInPaymentMode || 'payLater',
        hasTableService: formData.hasTableService || false,
        acceptsCardPayment: formData.acceptsCardPayment || false,
        vatNumber: formData.vatNumber || "", // Added missing vatNumber
        imageUrl: downloadURL || "",
        googlePlaceId: formData.googlePlaceId || "",
        bankDetails: {
          iban: formData.bankIban || "",
          bic: formData.bankBic || "",
          accountHolder: formData.bankAccountHolder || "",
          bankName: formData.bankName || "",
        },
      };

      // Only add billingAddress if it's enabled, otherwise remove it using deleteField() or null
      if (formData.hasDifferentBillingAddress) {
        updatedData.billingAddress = {
          name: formData.billingName || "",
          street: formData.billingStreet || "",
          postalCode: formData.billingPostalCode || "",
          city: formData.billingCity || "",
          country: formData.billingCountry || "DE",
          vatNumber: formData.billingVatNumber || "",
        };
      } else {
        updatedData.billingAddress = null;
      }

      // Check for plan change to update history - only if both plans are defined (skip for new businesses)
      if (!isNewBusiness && business) {
        const currentPlan = business.subscriptionPlan || 'basic';
        const newPlan = formData.subscriptionPlan || 'basic';
        if (newPlan !== currentPlan && currentPlan) {
          const historyEntry = {
            plan: currentPlan,
            startDate: business.subscriptionStartDate || new Date(),
            endDate: new Date(),
            reason: "admin_update",
            changedBy: admin?.email || "admin",
          };

          // Initialize history array if missing
          const currentHistory = Array.isArray(business.subscriptionHistory) ? business.subscriptionHistory : [];
          updatedData.subscriptionHistory = [...currentHistory, historyEntry];

          // Update start date for the new plan
          updatedData.subscriptionStartDate = new Date();
        }
      }

      // Create new or update existing
      if (isNewBusiness) {
        // Get unique business number
        const counterRef = doc(db, 'system_config', 'business_counter');
        const newNumber = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let currentNumber: number;
          if (!counterDoc.exists()) {
            currentNumber = 100001;
            transaction.set(counterRef, { lastNumber: currentNumber });
          } else {
            currentNumber = (counterDoc.data().lastNumber || 100000) + 1;
            transaction.update(counterRef, { lastNumber: currentNumber });
          }
          return currentNumber;
        });

        updatedData.customerId = newNumber.toString();
        updatedData.createdAt = new Date();
        updatedData.createdBy = admin?.id || 'admin';
        updatedData.isActive = true;

        const newDocRef = await addDoc(collection(db, "businesses"), updatedData);
        showToast(`${t('isletmeOlusturulduNo')} ${newNumber})`, "success");
        router.push(`/admin/business/${newDocRef.id}?tab=settings`);
      } else {
        await updateDoc(doc(db, "businesses", business!.id), updatedData);

        // Update local state completely
        const newButcherState = { ...business, ...updatedData } as ButcherPartner;
        setBusiness(newButcherState);
        setFormData((prev) => ({ ...prev, imageUrl: downloadURL })); // Crucial: Update formData with real URL

        setIsEditing(false);
        setImageFile(null); // Reset file
        showToast(t('degisikliklerBasariylaKaydedildi'), "success");
      }
    } catch (error: any) {
      console.error("Save error:", error);
      const errorMessage = error?.message || t('bilinmeyen_bir_hata');
      // Show toast
      showToast(`Hata: ${errorMessage}`, "error");

      // Show detailed alert if it looks like a storage issue
      if (
        errorMessage.includes("storage") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("permission")
      ) {
        alert(
          `${t('depolamaHatasi')} ${errorMessage}${t('nnlutfenFirebaseKonsolundanStorageBolumununEtkinlestirildiginden')}`,
        );
      }
      setUploading(false);
    }
    setSaving(false);
  };

  // Toggle active status
  const toggleActiveStatus = async () => {
    if (!business) return;
    const newStatus = !business.isActive;
    const action = newStatus ? "aktif" : "deaktif";

    setConfirmModal({
      show: true,
      title: newStatus ? t('hesabiAktifEt') : t('hesabiDeaktifEt'),
      message: `${t('buKasabi')} ${action} ${t('yapmakIstediginizeEminMisiniz')}`,
      confirmText: newStatus ? t('aktif_et') : "Deaktif Et",
      confirmColor: newStatus
        ? "bg-green-600 hover:bg-green-500"
        : "bg-red-600 hover:bg-red-500",
      onConfirm: async () => {
        setSaving(true);
        try {
          await updateDoc(doc(db, "businesses", business.id), {
            isActive: newStatus,
            updatedAt: new Date(),
          });
          setBusiness({ ...business, isActive: newStatus });
          showToast(`Kasap ${action} ${t('yapildi')}`, "success");
        } catch (error) {
          console.error("Toggle error:", error);
          showToast(t('hataOlustu'), "error");
        }
        setSaving(false);
        setConfirmModal({ ...confirmModal, show: false });
      },
    });
  };

  // Invite staff via WhatsApp
  const handleInviteStaff = async () => {
    if (!invitePhone || invitePhone.length < 10) {
      showToast(t('gecerliBirTelefonNumarasiGirin'), "error");
      return;
    }
    if (!inviteFirstName.trim()) {
      showToast(t('isimGerekli'), "error");
      return;
    }
    setStaffLoading(true);
    setInviteResult(null);
    try {
      const fullPhone = inviteCountryCode + invitePhone;
      const displayName =
        inviteFirstName + (inviteLastName ? " " + inviteLastName : "");

      // Auto-generate temporary password
      const tempPassword = `LOKMA${Math.floor(1000 + Math.random() * 9000)}`;

      // 🆕 KONSOLİDE: Tüm işletme türleri için genel rol değerleri kullan
      const adminType = inviteRole === 'Admin'
        ? 'isletme_admin'
        : 'isletme_staff';

      // Use the proper create-user API (Firebase Auth + users + admins + notifications)
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail || undefined,
          password: tempPassword,
          displayName,
          phone: fullPhone,
          dialCode: inviteCountryCode,
          firstName: inviteFirstName,
          lastName: inviteLastName || undefined,
          role: 'admin',
          adminType,
          businessId: businessId,
          businessName: business?.companyName,
          businessType: (business as any)?.types?.[0] || (business as any)?.type || 'kasap',
          createdBy: admin?.id || 'business_panel',
          createdBySource: 'business_detail_invite',
          assignerName: admin?.displayName || 'Admin',
          assignerEmail: admin?.email,
          assignerRole: admin?.adminType || 'super',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('kullaniciOlusturulamadi'));
      }

      setInviteResult({
        success: true,
        tempPassword,
        notifications: data.notifications,
      });

      showToast(`${inviteFirstName} ${t('basariylaEklendi')}`, "success");
      setInvitePhone("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      loadStaff();
    } catch (error: any) {
      console.error(t('invite_error'), error);
      const msg = error?.message || t('davetGonderilemedi');
      showToast(msg, "error");
    }
    setStaffLoading(false);
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // Show "not found" only if NOT creating new business
  if (!business && businessId !== 'new') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <p className="text-4xl mb-4">🔍</p>
        <p>{t('isletmeBulunamadi')}</p>
        <Link
          href="/admin/business"
          className="text-blue-400 hover:underline mt-4"
        >
          {t('isletmeListesi')}
        </Link>
      </div>
    );
  }

  // Build dynamic planLabels from loaded plans
  const planLabels: Record<string, { label: string; color: string }> = { ...defaultPlanLabels };
  availablePlans.forEach(p => {
    planLabels[p.code] = { label: `LOKMA ${p.name}`, color: p.color || 'bg-gray-600' };
  });
  const planInfo = planLabels[business?.subscriptionPlan || "none"] || { label: business?.subscriptionPlan || t('yok'), color: 'bg-gray-600' };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"} text-white`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/business"
                className="text-gray-400 hover:text-white"
              >
                ← Geri
              </Link>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {businessId === 'new' ? t('yeniIsletmeEkle2') : (business?.companyName || t('isletmeDetayi'))}
                </h1>
                {business && (
                  <p className="text-gray-400 text-sm">
                    {(business.shopPhone || business.contactPerson?.phone) && (
                      <span className="mr-3">📞 {business.shopPhone || business.contactPerson?.phone}</span>
                    )}
                    <span>{business.address?.city}, {business.address?.country}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {businessId !== 'new' && (
                <span
                  className={`px-3 py-1 rounded-full text-sm ${planInfo.color} text-white`}
                >
                  {planInfo.label}
                </span>
              )}
            </div>
          </div>

          {/* Tabs + Ayarlar Dropdown */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {/* Main Navigation Tabs */}
            <button
              onClick={() => { setActiveTab("overview"); setShowSettingsDropdown(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "overview" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              📊 Dashboard
            </button>
            {admin?.adminType === 'super' && (
              <Link
                href={`/admin/business/${businessId}/performance`}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition bg-purple-600 text-white hover:bg-purple-500"
              >
                📈 Performans
              </Link>
            )}
            <button
              onClick={() => { setActiveTab("orders"); setShowSettingsDropdown(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "orders" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              {t('siparisler')}{orders.length})
            </button>
            {formData.hasReservation && (
              <button
                onClick={() => { setActiveTab("reservations"); setShowSettingsDropdown(false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "reservations" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
              >
                {t('masaRezervasyonlari')}
              </button>
            )}

            {/* Ayarlar Dropdown */}
            <div className="relative settings-dropdown-container">
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${activeTab === "settings" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
              >
                ⚙️ Ayarlar
                <svg className={`w-3.5 h-3.5 transition-transform ${showSettingsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSettingsDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {[
                    { key: "isletme", icon: "🏢", label: t('isletme'), action: "tab" },
                    { key: "menu", icon: "📋", label: t('menuUrunler'), action: "tab" },
                    { key: "personel", icon: "👷", label: "Personel", action: "tab" },
                    { key: "masa", icon: "🪑", label: "Masa", action: "tab" },
                    { key: "abonelik", icon: "💳", label: t('abonelikPlani'), action: "tab" },
                    { key: "teslimat", icon: "🚚", label: "Teslimat", action: "tab" },
                    { key: "odeme", icon: "🏦", label: t('odemeBilgileri'), action: "tab" },
                  ].map((item) => {
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveTab("settings");
                          setSettingsSubTab(item.key as any);
                          setShowSettingsDropdown(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition w-full text-left ${activeTab === "settings" && settingsSubTab === item.key
                          ? "bg-red-600/20 text-red-400 font-medium"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            {/* Active Staff & Couriers Panel */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">
                  {t('aktif_personel_kuryeler')}
                </h3>
                <span className="text-green-400 text-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {staffList.filter((s) => s.isActive !== false).length} Online
                </span>
              </div>

              {/* Online Staff Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Mağaza Çalışanları */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
                    {t('magazaCalisanlari')}
                  </h4>
                  <div className="space-y-2">
                    {staffList.filter((s) => s.isActive !== false).length ===
                      0 ? (
                      <p className="text-gray-500 text-sm">
                        {t('henuzAktifPersonelYok')}
                      </p>
                    ) : (
                      staffList
                        .filter((s) => s.isActive !== false)
                        .map((staff) => (
                          <div
                            key={staff.id}
                            className="flex items-center justify-between bg-gray-600/50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                              <span className="text-white text-sm">
                                {staff.displayName}
                              </span>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${staff.adminType?.includes('admin') || (!staff.adminType?.includes('staff') && staff.adminType !== 'user') ? "bg-purple-600/50 text-purple-300" : "bg-blue-600/50 text-blue-300"}`}
                            >
                              {staff.adminType}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Aktif Kuryeler */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
                    {t('kuryelerDagitimda')}
                  </h4>
                  <div className="space-y-2">
                    {/* Gerçek kurye bilgileri - onTheWay veya claimedBy olan siparişler */}
                    {(() => {
                      const activeDeliveries = orders.filter(
                        (o) => o.status === "onTheWay" || (o.status === "ready" && (o as any).claimedBy)
                      );
                      if (activeDeliveries.length > 0) {
                        return activeDeliveries.slice(0, 5).map((order, idx) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between bg-amber-600/20 border border-amber-600/30 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🏍️</span>
                              <div>
                                <span className="text-white text-sm">
                                  {(order as any).driverName || (order as any).claimedByName || `Kurye ${idx + 1}`}
                                </span>
                                <p className="text-amber-400 text-xs">
                                  #{order.orderNumber || order.id.slice(0, 6)} → {order.customerName || t('musteri')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2 py-0.5 rounded ${order.status === 'onTheWay' ? 'bg-amber-600/50 text-amber-300' : 'bg-green-600/50 text-green-300'}`}>
                                {order.status === 'onTheWay' ? '🛵 Yolda' : t('hazir1')}
                              </span>
                            </div>
                          </div>
                        ));
                      }
                      return (
                        <div className="text-center py-4">
                          <p className="text-gray-500 text-sm">
                            {t('suAnDagitimdaKuryeYok')}
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            {t('teslimatBasladigindaBuradaGorunecek')}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Order Status Timeline */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold">
                  {t('siparisDurumlariAnlik')}
                </h3>
                <span className="text-gray-400 text-sm">
                  {t('suAnkiSiparisler')}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {/* Bekleyen - Yanıp söner */}
                <div
                  className={`flex-1 min-w-[100px] bg-yellow-600/20 border-2 border-yellow-500 rounded-lg p-4 text-center relative ${orders.filter((o) => o.status === "pending").length > 0 ? "animate-pulse" : ""}`}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rounded-full border-2 border-gray-800"></div>
                  <p
                    className={`text-yellow-400 text-3xl font-bold ${orders.filter((o) => o.status === "pending").length > 0 ? "animate-bounce" : ""}`}
                  >
                    {orders.filter((o) => o.status === "pending").length}
                  </p>
                  <p className="text-yellow-300 text-sm font-medium">
                    {t('bekleyen')}
                  </p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Hazırlanıyor */}
                <div className="flex-1 min-w-[100px] bg-blue-600/20 border border-blue-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-blue-400 text-3xl font-bold">
                    {orders.filter((o) => o.status === "preparing").length}
                  </p>
                  <p className="text-gray-400 text-sm">{t('hazirlaniyor1')}</p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Hazır / Yolda */}
                <div className="flex-1 min-w-[100px] bg-purple-600/20 border border-purple-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-purple-400 text-3xl font-bold">
                    {
                      orders.filter(
                        (o) => o.status === "ready" || o.status === "onTheWay",
                      ).length
                    }
                  </p>
                  <p className="text-gray-400 text-sm">{t('haziryolda')}</p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Tamamlanan */}
                <div className="flex-1 min-w-[100px] bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-green-400 text-3xl font-bold">
                    {orders.filter((o) => o.status === "completed" || o.status === "delivered").length}
                  </p>
                  <p className="text-gray-400 text-sm">✓ Tamamlanan</p>
                </div>
              </div>

              {/* Timeline line */}
              <div className="relative mt-2 h-1 bg-gradient-to-r from-yellow-500 via-blue-500 to-green-500 rounded-full opacity-50"></div>
            </div>

            {/* Revenue Summary */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-4">{t('gelirOzeti')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-green-400 text-2xl font-bold">
                    {formatCurrency(orders
                      .reduce((sum, o) => sum + (o.totalPrice || 0), 0), business?.currency)}
                  </p>
                  <p className="text-gray-400 text-sm">{t('toplam_ciro')}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-blue-400 text-2xl font-bold">
                    {orders.length}
                  </p>
                  <p className="text-gray-400 text-sm">{t('toplamSiparis')}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-purple-400 text-2xl font-bold">
                    {formatCurrency(orders.length > 0
                      ? (
                        orders.reduce(
                          (sum, o) => sum + (o.totalPrice || 0),
                          0,
                        ) / orders.length
                      )
                      : 0, business?.currency)}
                  </p>
                  <p className="text-gray-400 text-sm">{t('ortalamaSiparis')}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-yellow-400 text-2xl font-bold">
                    {staffList.length}
                  </p>
                  <p className="text-gray-400 text-sm">Personel</p>
                </div>
              </div>
            </div>

            {/* Contact Info & Membership Details */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Contact Info */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-bold mb-4">
                  {t('iletisimBilgileri')}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">{t('yetkiliKisi')}</p>
                      <p className="text-white font-medium">
                        {business?.contactPerson?.name
                          ? `${business?.contactPerson?.name} ${business?.contactPerson?.surname || ""}`
                          : t('belirtilmemis')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {business?.contactPerson?.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">{t('iletisim1')}</p>
                      <p className="text-white">
                        {business?.contactPerson?.phone ||
                          business?.shopPhone ||
                          t('belirtilmemis')}
                      </p>
                      <p className="text-xs text-blue-400 truncate">
                        {business?.contactPerson?.email ||
                          business?.shopEmail ||
                          ""}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-gray-400 text-sm">{t('calismaSaatleri2')}</p>
                      {(() => {
                        const status = checkShopStatus(business?.openingHours || "");
                        return (
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${status.isOpen
                              ? "bg-green-900/50 text-green-400 border border-green-800"
                              : "bg-red-900/50 text-red-400 border border-red-800"
                              }`}
                          >
                            {status.text}
                          </span>
                        );
                      })()}
                    </div>
                    {(() => {
                      const hoursData = business?.openingHours;
                      const hoursList = Array.isArray(hoursData)
                        ? hoursData
                        : (hoursData || "").split("\n");

                      return hoursList.length > 0 && hoursList[0] !== "" ? (
                        <ul className="space-y-1">
                          {hoursList.map((line: string, i: number) => {
                            const today = new Date().toLocaleDateString("tr-TR", { weekday: "long" });
                            const dayName = line.split(":")[0]?.trim();
                            // Simple match check, can be improved if needed
                            const isToday = dayName === today || (today === "Pazar" && dayName === "Pazar");

                            return (
                              <li
                                key={i}
                                className={`text-xs flex justify-between px-2 py-1 rounded ${isToday
                                  ? "bg-green-900/20 text-green-300 font-medium border border-green-800/30"
                                  : "text-gray-300"
                                  }`}
                              >
                                <span className={isToday ? "text-green-400" : "font-medium text-gray-400"}>
                                  {line.split(": ")[0]}
                                </span>
                                <span>{line.split(": ")[1]}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-500 italic">
                          {t('bilgi_yok')}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-gray-400 text-sm">Adres</p>
                    <p className="text-white">
                      {business?.address?.street}, {business?.address?.postalCode}{" "}
                      {business?.address?.city}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {business?.address?.country}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription & Membership Status */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-bold mb-4">
                  {t('uyelikAbonelik')}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Mevcut Plan</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`w-3 h-3 rounded-full ${planInfo.color}`}
                        ></span>
                        <span className="text-white font-medium">
                          {planInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {(business?.monthlyFee ?? 0) > 0
                          ? `${formatCurrency(business?.monthlyFee || 0, business?.currency)}/ay`
                          : t('ucretsiz')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">{t('durum')}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-1 rounded text-xs ${business?.isActive ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}
                      >
                        {business?.isActive ? t('aktifMusteri') : t('pasifMusteri')}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-700 pt-3">
                    <div>
                      <p className="text-gray-400 text-sm">{t('musteriTarihi')}</p>
                      <p className="text-white">
                        {(business as any).createdAt?.toDate
                          ? (business as any).createdAt
                            .toDate()
                            .toLocaleDateString("tr-TR")
                          : t('belirtilmemis')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">{t('planBaslangic')}</p>
                      <p className="text-white">
                        {(business?.subscriptionStartDate as any)?.toDate
                          ? (business?.subscriptionStartDate as any)
                            .toDate()
                            .toLocaleDateString("tr-TR")
                          : business?.subscriptionStartDate
                            ? new Date(
                              business?.subscriptionStartDate,
                            ).toLocaleDateString("tr-TR")
                            : t('belirtilmemis')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ADD PRODUCT MODAL */}
        {
          productModalOpen && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="text-white font-bold">{t('urunEkle')}</h3>
                  <button onClick={() => setProductModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                  <button
                    onClick={() => setProductMode('standard')}
                    className={`flex-1 py-3 text-sm font-medium ${productMode === 'standard' ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-750"}`}
                  >
                    {t('hizliSecStandart')}
                  </button>
                  <button
                    onClick={() => setProductMode('custom')}
                    className={`flex-1 py-3 text-sm font-medium ${productMode === 'custom' ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-750"}`}
                  >
                    {t('ozelUrunTalep')}
                  </button>
                </div>

                <div className="p-6">
                  {productMode === 'standard' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">{t('urunSecin')}</label>
                        <select
                          value={selectedMasterId}
                          onChange={(e) => {
                            setSelectedMasterId(e.target.value);
                          }}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                        >
                          <option value="">{t('seciniz')}</option>
                          {/* 🆕 Firestore'dan filtrelenmiş ürünler, fallback hardcoded */}
                          {(firestoreMasterProducts.length > 0 ? firestoreMasterProducts : MASTER_PRODUCTS).map(mp => (
                            <option key={mp.id} value={mp.id}>
                              {getLocalizedText(mp.name)} ({mp.category})
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedMasterId && (
                        <div className="bg-blue-900/20 text-blue-300 p-3 rounded-lg text-sm">
                          <p>{getLocalizedText((firestoreMasterProducts.length > 0 ? firestoreMasterProducts : MASTER_PRODUCTS).find(p => p.id === selectedMasterId)?.description)}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">{t('satisFiyati')}</label>
                        <input
                          type="number"
                          value={customProductForm.price}
                          onChange={(e) => setCustomProductForm({ ...customProductForm, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <MultiLanguageInput
                          label={t('urunAdi')}
                          value={customProductForm.name}
                          onChange={(val) => setCustomProductForm({ ...customProductForm, name: val })}
                          placeholder={t('ornOzelMarineKofte')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Fiyat (€)</label>
                          <input
                            type="number"
                            value={customProductForm.price}
                            onChange={(e) => setCustomProductForm({ ...customProductForm, price: e.target.value })}
                            placeholder="0.00"
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm block mb-1">Birim</label>
                          <select
                            value={customProductForm.unit}
                            onChange={(e) => setCustomProductForm({ ...customProductForm, unit: e.target.value })}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                          >
                            <option value="kg">Kg</option>
                            <option value="ad">{t('adet')}</option>
                            <option value="pk">Paket</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">{t('fotograf')}</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setCustomProductForm({ ...customProductForm, imageFile: e.target.files[0] });
                            }
                          }}
                          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                        />
                      </div>
                      <div className="bg-yellow-900/20 text-yellow-500 p-3 rounded-lg text-xs">
                        {t('ozelUrunlerAdminOnayindanSonraYayina')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-750 flex justify-end gap-3">
                  <button
                    onClick={() => setProductModalOpen(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white"
                  >
                    {t('iptal1')}
                  </button>
                  <button
                    onClick={handleAddProduct}
                    disabled={addingProduct}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                  >
                    {addingProduct ? "Kaydediliyor..." : t('kaydet')}
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Orders Tab */}
        {
          activeTab === "orders" && (
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-white font-bold">{t('sonSiparisler')}</h3>
                <Link
                  href={`/admin/butchers/${business?.id}/orders`}
                  className="text-blue-400 hover:underline text-sm"
                >
                  {t('tumunuGor')}
                </Link>
              </div>
              {orders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-4">📦</p>
                  <p>{t('henuzSiparisYok')}</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-750 text-gray-400 text-sm">
                    <tr>
                      <th className="px-4 py-3">{t('siparisNo')}</th>
                      <th className="px-4 py-3">{t('musteri')}</th>
                      <th className="px-4 py-3">{t('tutar')}</th>
                      <th className="px-4 py-3">{t('durum')}</th>
                      <th className="px-4 py-3">{t('tarih')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-white">
                    {orders.slice(0, 10).map((order) => (
                      <tr
                        key={order.id}
                        className="border-t border-gray-700 hover:bg-gray-750"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-blue-400">
                          {order.orderNumber || order.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <p>{order.customerName || "N/A"}</p>
                          <p className="text-xs text-gray-400">
                            {order.customerPhone}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(order.totalPrice || 0, order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${orderStatusLabels[order.status]?.color || "bg-gray-700"}`}
                          >
                            {orderStatusLabels[order.status]?.label || order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {order.createdAt
                            ?.toDate?.()
                            ?.toLocaleDateString("de-DE") || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        }

        {/* Settings Tab */}
        {
          activeTab === "settings" && (
            <div className="bg-gray-800 rounded-xl p-6">
              {/* Settings Sub-Tab Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold text-xl">
                  {settingsSubTab === "isletme" && t('isletmeAyarlari')}
                  {settingsSubTab === "menu" && t('menuUrunler1')}
                  {settingsSubTab === "personel" && t('personelYonetimi')}
                  {settingsSubTab === "masa" && t('masaAyarlari')}
                  {settingsSubTab === "abonelik" && t('abonelikPlani1')}
                  {settingsSubTab === "teslimat" && t('teslimatAyarlari')}
                  {settingsSubTab === "odeme" && t('odemeBilgileri1')}
                </h3>
                <div className="flex items-center gap-3">
                  {/* Kurye Aktif/Deaktif Toggle - only in Teslimat sub-tab */}
                  {settingsSubTab === "teslimat" && formData.supportsDelivery && (
                    <button
                      onClick={async () => {
                        const newValue = !formData.temporaryDeliveryPaused;
                        try {
                          await updateDoc(doc(db, "businesses", businessId), {
                            temporaryDeliveryPaused: newValue,
                          });
                          await addDoc(collection(db, "businesses", businessId, "deliveryPauseLogs"), {
                            action: newValue ? "paused" : "resumed",
                            timestamp: serverTimestamp(),
                            adminEmail: admin?.email || "unknown",
                            adminId: admin?.id || "unknown",
                            adminName: (admin as any)?.name || (admin as any)?.displayName || admin?.email || "unknown",
                          });
                          setFormData({ ...formData, temporaryDeliveryPaused: newValue });
                          showToast(newValue ? t('kurye_hizmeti_durduruldu') : t('kurye_hizmeti_aktif'), "success");
                        } catch (e) {
                          showToast(t('hataOlustu1'), "error");
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${formData.temporaryDeliveryPaused
                        ? "bg-amber-600 hover:bg-amber-500 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                    >
                      {formData.temporaryDeliveryPaused ? t('kurye_durduruldu') : t('kurye_aktif')}
                    </button>
                  )}
                  {/* Active/Deactive Toggle */}
                  {business && settingsSubTab === "isletme" && (
                    <button
                      onClick={toggleActiveStatus}
                      className={`px-4 py-2 rounded-lg text-white font-medium ${business.isActive ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"}`}
                    >
                      {business.isActive ? "🔴 Deaktif Et" : t('aktif_et')}
                    </button>
                  )}
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                      {t('duzenle')}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                      >
                        {t('iptal1')}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                      >
                        {saving ? "Kaydediliyor..." : "💾 Kaydet"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-Tab: İşletme */}
              {settingsSubTab === "isletme" && (
                <>
                  {/* Internal Tab Bar for İşletme */}
                  <div className="flex gap-2 border-b border-gray-700 pb-3 mb-6 flex-wrap">
                    {[
                      { id: "bilgiler" as const, label: t('isletmeBilgileri') },
                      { id: "fatura" as const, label: t('fatura_adresi') },
                      { id: "zertifikalar" as const, label: "🏷️ Zertifikalar" },
                      { id: "gorseller" as const, label: t('gorseller') },
                      { id: "saatler" as const, label: t('acilisSaatleri') },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setIsletmeInternalTab(tab.id)}
                        className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${isletmeInternalTab === tab.id
                          ? "bg-red-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ═══════ Tab 1: İşletme Bilgileri ═══════ */}
                  {isletmeInternalTab === "bilgiler" && (
                    <div className="space-y-6">
                      {/* Şirket Adı */}
                      <div>
                        <label className="text-gray-400 text-sm">{t('sirketAdi')}</label>
                        <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                      </div>
                      {/* Mutfak Türü */}
                      <div>
                        <label className="text-gray-400 text-sm">{t('mutfakTuruAltBaslik')}</label>
                        <input type="text" value={formData.cuisineType} onChange={(e) => setFormData({ ...formData, cuisineType: e.target.value })} disabled={!isEditing} placeholder={t('ornKebapDonerTurkisch')} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                        <p className="text-xs text-gray-500 mt-1">{t('kartlardaIsletmeAdiAltindaGosterilir')}</p>
                      </div>
                      {/* İşletme Türleri */}
                      <div>
                        <label className="text-gray-400 text-sm block mb-2">{t('isletmeTurleri')}</label>
                        <div className="flex flex-wrap gap-2">
                          {dynamicSectorTypes.map((sector) => {
                            const isSelected = formData.types?.includes(sector.id);
                            return (
                              <button key={sector.id} type="button" onClick={() => { if (!isEditing) return; const newTypes = isSelected ? formData.types.filter(t => t !== sector.id) : [...(formData.types || []), sector.id]; setFormData({ ...formData, types: newTypes }); }} disabled={!isEditing} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isSelected ? 'bg-blue-600 text-white ring-2 ring-white/50' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'} ${!isEditing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <span>{sector.icon}</span><span>{sector.label}</span>{isSelected && <span className="text-white/80">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                        {formData.types?.length > 0 && (<p className="text-xs text-green-400 mt-2">{formData.types.length} {t('modulAktifHerModulAyriUcretlendirilir')}</p>)}
                      </div>
                      {/* Müşteri No */}
                      <div>
                        <label className="text-gray-400 text-sm">{t('musteriNo')}</label>
                        <input type="text" value={formData.customerId} readOnly disabled={true} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 opacity-50 cursor-not-allowed" />
                        <p className="text-xs text-gray-500 mt-1">{t('musteriNoDegistirilemez')}</p>
                      </div>
                      {/* Vergi UID */}
                      <div>
                        <label className="text-gray-400 text-sm">{t('vergi_uid_nummer_vat')}</label>
                        <input type="text" value={formData.vatNumber || ''} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} disabled={!isEditing} placeholder="DE123456789" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 font-mono" />
                        <p className="text-xs text-gray-500 mt-1">{t('avrupaBirligiVergiNumarasiOrnDe123456789')}</p>
                      </div>
                      {/* Adres */}
                      <div className="space-y-4 pt-4 border-t border-gray-700">
                        <h4 className="text-white font-medium pb-2">📍 Adres</h4>
                        <div>
                          <label className="text-gray-400 text-sm">Sokak/Cadde</label>
                          <input type="text" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-gray-400 text-sm">Posta Kodu</label>
                            <input type="text" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">{t('sehir1')}</label>
                            <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                        </div>
                      </div>
                      {/* İletişim */}
                      <div className="space-y-4 pt-4 border-t border-gray-700">
                        <h4 className="text-white font-medium pb-2">{t('iletisim')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-gray-400 text-sm">Telefon</label>
                            <input type="tel" value={formData.shopPhone || ''} onChange={(e) => setFormData({ ...formData, shopPhone: e.target.value })} disabled={!isEditing} placeholder="+49..." className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">E-Mail</label>
                            <input type="email" value={formData.shopEmail || ''} onChange={(e) => setFormData({ ...formData, shopEmail: e.target.value })} disabled={!isEditing} placeholder="info@example.com" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm">Website</label>
                          <input type="url" value={formData.website || ''} onChange={(e) => setFormData({ ...formData, website: e.target.value })} disabled={!isEditing} placeholder="https://www.example.com" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                        </div>
                      </div>
                      {/* Sosyal Medya */}
                      <div className="space-y-4 pt-4 border-t border-gray-700">
                        <h4 className="text-white font-medium pb-2">📱 Sosyal Medya</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-gray-400 text-sm">{t('instagram')}</label>
                            <input type="text" value={formData.instagram || ''} onChange={(e) => setFormData({ ...formData, instagram: e.target.value })} disabled={!isEditing} placeholder="@kullaniciadi" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">📘 Facebook</label>
                            <input type="text" value={formData.facebook || ''} onChange={(e) => setFormData({ ...formData, facebook: e.target.value })} disabled={!isEditing} placeholder="facebook.com/..." className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">💬 WhatsApp</label>
                            <input type="tel" value={formData.whatsapp || ''} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} disabled={!isEditing} placeholder="+49..." className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">🎵 TikTok</label>
                            <input type="text" value={formData.tiktok || ''} onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })} disabled={!isEditing} placeholder="@kullaniciadi" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">▶️ YouTube</label>
                            <input type="text" value={formData.youtube || ''} onChange={(e) => setFormData({ ...formData, youtube: e.target.value })} disabled={!isEditing} placeholder="youtube.com/..." className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                          </div>
                        </div>
                      </div>
                      {/* İrtibat Kişisi */}
                      <div className="space-y-4 pt-4 border-t border-gray-700">
                        <h4 className="text-blue-400 font-medium text-sm">{t('lokmaYetkiliIrtibatKisisi')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-gray-400 text-xs block mb-1">{t('adi')}</label><input type="text" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50" /></div>
                          <div><label className="text-gray-400 text-xs block mb-1">{t('soyadi')}</label><input type="text" value={formData.contactSurname} onChange={(e) => setFormData({ ...formData, contactSurname: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-gray-400 text-xs block mb-1">{t('kisiselTel')}</label><input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50" /></div>
                          <div><label className="text-gray-400 text-xs block mb-1">{t('kisiselEmail')}</label><input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50" /></div>
                        </div>
                      </div>
                      {/* Google Place */}
                      <div className="space-y-4 pt-4 border-t border-gray-700">
                        <h4 className="text-white font-medium pb-2">🗺️ Google Place</h4>
                        <div className="relative">
                          <label className="text-gray-400 text-sm">{t('googlePlaceIdDegerlendirmelerIcin')}</label>
                          {isEditing && (
                            <div className="flex gap-2 mt-1 mb-2">
                              <input type="text" value={googleSearchQuery} onChange={(e) => setGoogleSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGooglePlacesSearch()} placeholder={t('isletmeAdiVeyaAdresiAra')} className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500" />
                              <button type="button" onClick={() => handleGooglePlacesSearch()} disabled={googleSearchLoading || googleSearchQuery.length < 3} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {googleSearchLoading ? (<span className="animate-spin">⏳</span>) : (<span>🔍</span>)} Ara
                              </button>
                            </div>
                          )}
                          {showGoogleDropdown && googleSearchResults.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                              {googleSearchResults.map((place, index) => (
                                <button key={place.place_id || index} type="button" onClick={() => handleSelectGooglePlace(place)} className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700 last:border-0 transition">
                                  <p className="text-white font-medium">{place.name}</p>
                                  <p className="text-gray-400 text-sm">{place.formatted_address}</p>
                                  {place.rating && (<p className="text-yellow-400 text-xs mt-1">⭐ {place.rating} ({place.user_ratings_total || 0} {t('degerlendirme')}</p>)}
                                </button>
                              ))}
                              <button type="button" onClick={() => { setShowGoogleDropdown(false); setGoogleSearchResults([]); }} className="w-full px-4 py-2 bg-gray-700 text-gray-400 hover:text-white text-sm">✕ Kapat</button>
                            </div>
                          )}
                          <input type="text" value={formData.googlePlaceId} onChange={(e) => setFormData({ ...formData, googlePlaceId: e.target.value })} disabled={!isEditing} placeholder={t('chijYukaridanArayarakSecin')} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 font-mono text-sm" />
                          {formData.googlePlaceId && (<p className="text-xs text-green-400 mt-1">{t('google_place_id_set')}</p>)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══════ Tab 2: Fatura Adresi ═══════ */}
                  {isletmeInternalTab === t(t('fatura')) && (
                    <div className="space-y-6">
                      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                          <input type="checkbox" checked={formData.hasDifferentBillingAddress || false} onChange={(e) => setFormData({ ...formData, hasDifferentBillingAddress: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-red-500" />
                          <span className="text-white font-medium">{t('faturaFarkliBirKisifirmaUzerineKesilsin')}</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-4">{t('geneldeIsletmeIsmiIleFaturaIsmi')}</p>
                        {formData.hasDifferentBillingAddress && (
                          <div className="space-y-4 pt-4 border-t border-gray-700">
                            <div>
                              <label className="text-gray-400 text-sm">{t('faturaFirmaKisiAdi')}</label>
                              <input type="text" value={formData.billingName || ''} onChange={(e) => setFormData({ ...formData, billingName: e.target.value })} disabled={!isEditing} placeholder={t('ornAbcGmbh')} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                            </div>
                            <div>
                              <label className="text-gray-400 text-sm">{t('fatura_adresi')}</label>
                              <input type="text" value={formData.billingStreet || ''} onChange={(e) => setFormData({ ...formData, billingStreet: e.target.value })} disabled={!isEditing} placeholder="Sokak / Cadde" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-gray-400 text-sm">Posta Kodu</label>
                                <input type="text" value={formData.billingPostalCode || ''} onChange={(e) => setFormData({ ...formData, billingPostalCode: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                              </div>
                              <div>
                                <label className="text-gray-400 text-sm">{t('sehir1')}</label>
                                <input type="text" value={formData.billingCity || ''} onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50" />
                              </div>
                            </div>
                            <div>
                              <label className="text-gray-400 text-sm">{t('fatura_vergi_no')}</label>
                              <input type="text" value={formData.billingVatNumber || ''} onChange={(e) => setFormData({ ...formData, billingVatNumber: e.target.value })} disabled={!isEditing} placeholder="DE..." className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 font-mono" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ═══════ Tab 3: Zertifikalar ═══════ */}
                  {isletmeInternalTab === "zertifikalar" && (
                    <div className="space-y-6">
                      {admin?.adminType === 'super' ? (
                        <>
                          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <label className="text-gray-400 text-sm">🏷️ LOKMA Label <span className="text-xs text-purple-400">(Super Admin)</span></label>
                            <select value={formData.brand || ''} onChange={(e) => { const val = e.target.value as "tuna" | "akdeniz_toros" | ""; setFormData({ ...formData, brand: val as any, brandLabelActive: val !== "" }); }} disabled={!isEditing} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50">
                              <option value="">{t('secilmedi')}</option>
                              <option value="tuna">🔴 TUNA</option>
                              <option value="akdeniz_toros">⚫ Akdeniz Toros</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">{t('buAyarSadeceSuperAdminTarafindan')}</p>
                          </div>
                          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <label className="text-gray-400 text-sm">{t('satilanUrunMarkalari')} <span className="text-xs text-blue-400">{t('filtrelemeIcin')}</span></label>
                            <p className="text-xs text-gray-500 mb-3 mt-1">{t('buIsletmeHangiMarkalarinUrunleriniSatiyor')}</p>
                            <div className="flex flex-wrap gap-3">
                              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${formData.sellsTunaProducts ? 'bg-red-600/30 border-2 border-red-500 text-red-300' : 'bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-600'} ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input type="checkbox" checked={formData.sellsTunaProducts} onChange={(e) => setFormData({ ...formData, sellsTunaProducts: e.target.checked })} disabled={!isEditing} className="w-4 h-4 accent-red-500" />
                                <span className="text-lg">🔴</span><span className="font-medium">{t('tunaUrunleri')}</span>
                              </label>
                              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${formData.sellsTorosProducts ? 'bg-green-600/30 border-2 border-green-500 text-green-300' : 'bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-600'} ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input type="checkbox" checked={formData.sellsTorosProducts} onChange={(e) => setFormData({ ...formData, sellsTorosProducts: e.target.checked })} disabled={!isEditing} className="w-4 h-4 accent-green-500" />
                                <span className="text-lg">🟢</span><span className="font-medium">{t('akdenizTorosUrunleri')}</span>
                              </label>
                            </div>
                            {(formData.sellsTunaProducts || formData.sellsTorosProducts) && (<p className="text-xs text-green-400 mt-2">{t('secilenMarkalarMobilUygulamadaFiltrelemeIcin')}</p>)}
                          </div>
                        </>
                      ) : (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
                          <p className="text-gray-400">{t('zertifikaAyarlariSadeceSuperAdminTarafindan')}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══════ Tab 4: Görseller ═══════ */}
                  {isletmeInternalTab === "gorseller" && (
                    <div className="space-y-6">
                      {/* İşletme Kart Görseli */}
                      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <h4 className="text-white font-medium mb-4">{t('isletmeKartGorseli')}</h4>
                        <div className="flex items-start gap-4">
                          <div className="w-32 h-32 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center border border-gray-600 shrink-0">
                            {formData.imageUrl ? (<img src={formData.imageUrl} alt="Business" className="w-full h-full object-cover" />) : (<span className="text-4xl">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).emoji}</span>)}
                          </div>
                          {isEditing && (
                            <div className="flex flex-col gap-2 w-full">
                              <input type="file" accept="image/*" onChange={handleImageSelect} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
                              <div className="flex items-center gap-2 my-1"><span className="text-gray-600 text-xs">{t('veya')}</span></div>
                              <button onClick={fetchGoogleData} disabled={!formData.googlePlaceId || uploading} className="flex items-center justify-center px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors">
                                {uploading && !imageFile ? (<span className="animate-spin mr-2">⏳</span>) : (<span className="mr-2">🪄</span>)} Google'dan Bilgileri Doldur (Server)
                              </button>
                              {!formData.googlePlaceId && (<p className="text-xs text-red-400">{t('google_id_gerekli')}</p>)}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* İşletme Logosu */}
                      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <h4 className="text-white font-medium mb-4">{t('isletmeLogosuKare')}</h4>
                        <div className="flex items-center gap-4">
                          {formData.logoUrl ? (<img src={formData.logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-cover border border-gray-600" />) : (<div className="w-20 h-20 rounded-lg bg-gray-700 border border-dashed border-gray-500 flex items-center justify-center text-gray-500 text-3xl">🏪</div>)}
                          {isEditing && (
                            <div className="flex flex-col gap-2">
                              <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm">
                                {t('logoYukle')}
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; const logoRef = ref(storage, `business_logos/${businessId}/logo_${Date.now()}.jpg`); const uploadTask = uploadBytesResumable(logoRef, file); uploadTask.on('state_changed', () => { }, (error) => { console.error('Logo upload error:', error); showToast(t('logoYuklenirkenHataOlustu'), 'error'); }, async () => { const url = await getDownloadURL(uploadTask.snapshot.ref); setFormData({ ...formData, logoUrl: url }); showToast(t('logoYuklendi'), 'success'); }); } }} />
                              </label>
                              {formData.logoUrl && (<button type="button" onClick={() => setFormData({ ...formData, logoUrl: '' })} className="text-red-400 text-xs hover:text-red-300">{t('logoyuKaldir')}</button>)}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{t('onerilenBoyut64x64PikselKare')}</p>
                      </div>
                    </div>
                  )}

                  {/* ═══════ Tab 5: Açılış Saatleri ═══════ */}
                  {isletmeInternalTab === "saatler" && (
                    <div className="space-y-6">
                      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <h4 className="text-white font-medium mb-4">{t('calismaSaatleri3')}</h4>
                        {isEditing ? (
                          <div className="space-y-2">
                            {[
                              { tr: "Pazartesi", en: "Monday" }, { tr: t('sali'), en: "Tuesday" }, { tr: t('carsamba'), en: "Wednesday" }, { tr: t('persembe'), en: "Thursday" }, { tr: "Cuma", en: "Friday" }, { tr: "Cumartesi", en: "Saturday" }, { tr: "Pazar", en: "Sunday" },
                            ].map((dayObj) => {
                              const currentLine = formData.openingHours?.split("\n").find((l) => { return l.startsWith(dayObj.tr + ":") || l.startsWith(dayObj.tr + " ") || l.startsWith(dayObj.en + ":") || l.startsWith(dayObj.en + " "); }) || "";
                              const isClosed = currentLine.toLowerCase().includes(t('kapali1')) || currentLine.toLowerCase().includes("closed");
                              let startTime = ""; let endTime = "";
                              if (!isClosed && currentLine.includes(": ")) { const timePart = currentLine.split(": ").slice(1).join(": ").trim(); const separator = timePart.includes("–") ? "–" : "-"; const parts = timePart.split(separator).map(p => p.trim()); if (parts.length >= 2) { startTime = formatTo24h(parts[0]); endTime = formatTo24h(parts[1]); } }
                              const updateHours = (newStart: string, newEnd: string, newClosed: boolean) => {
                                const newLines = ["Pazartesi", t('sali'), t('carsamba'), t('persembe'), "Cuma", "Cumartesi", "Pazar"].map((d) => {
                                  const dObj = [{ tr: "Pazartesi", en: "Monday" }, { tr: t('sali'), en: "Tuesday" }, { tr: t('carsamba'), en: "Wednesday" }, { tr: t('persembe'), en: "Thursday" }, { tr: "Cuma", en: "Friday" }, { tr: "Cumartesi", en: "Saturday" }, { tr: "Pazar", en: "Sunday" }].find((o) => o.tr === d);
                                  const existingLine = formData.openingHours?.split("\n").find((l) => { const dayTR = dObj!.tr; const dayEN = dObj!.en; return l.startsWith(dayTR + ":") || l.startsWith(dayTR + " ") || l.startsWith(dayEN + ":") || l.startsWith(dayEN + " "); }) || "";
                                  if (d === dayObj.tr) { if (newClosed) return `${d}${t('kapali2')}`; return `${d}: ${newStart} - ${newEnd}`; }
                                  if (existingLine.startsWith(dObj!.en)) { const content = existingLine.split(": ").slice(1).join(": "); return `${d}: ${content}`; }
                                  return existingLine || `${d}${t('kapali2')}`;
                                });
                                setFormData({ ...formData, openingHours: newLines.join("\n") });
                              };
                              return (
                                <div key={dayObj.tr} className="flex items-center gap-3">
                                  <span className="w-20 text-sm text-gray-400 font-medium">{dayObj.tr}</span>
                                  <input type="time" value={formatTo24h(startTime)} disabled={isClosed} onChange={(e) => updateHours(e.target.value, endTime, false)} className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
                                  <span className="text-gray-500 font-bold">-</span>
                                  <input type="time" value={formatTo24h(endTime)} disabled={isClosed} onChange={(e) => updateHours(startTime, e.target.value, false)} className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
                                  <label className="flex items-center cursor-pointer ml-auto">
                                    <input type="checkbox" checked={isClosed} onChange={(e) => updateHours(startTime, endTime, e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                                    <span className="ml-2 text-xs text-gray-400 font-medium w-10">{isClosed ? t('kapali') : t('acik')}</span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        ) : formData.openingHours ? (
                          <ul className="space-y-1">
                            {formData.openingHours.split("\n").map((line, i) => (
                              <li key={i} className="text-xs text-gray-300 flex justify-between border-b border-gray-700/50 pb-1 last:border-0">
                                <span className="font-medium text-gray-400 w-24">{line.split(": ")[0]}</span>
                                <span className="font-mono">{(() => { const parts = line.split(": "); const content = parts.length > 1 ? parts.slice(1).join(": ").trim() : ""; if (content.toLowerCase().includes(t('kapali1')) || content.toLowerCase().includes("closed")) return t('kapali'); if (!content || content === "-" || content === "–") return "-"; return content; })()}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (<span className="text-xs text-gray-500 italic">{t('bilgi_yok')}</span>)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Sub-Tab: Menü & Ürünler */}
              {
                settingsSubTab === "menu" && (
                  <div className="space-y-6">
                    {/* Internal Tab Bar */}
                    <div className="flex gap-2 border-b border-gray-700 pb-3">
                      <button
                        onClick={() => setMenuInternalTab("kategoriler")}
                        className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${menuInternalTab === "kategoriler"
                          ? "bg-red-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                      >
                        📂 Kategoriler ({inlineCategories.length})
                      </button>
                      <button
                        onClick={() => setMenuInternalTab("urunler")}
                        className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${menuInternalTab === "urunler"
                          ? "bg-red-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                      >
                        {t('urunler')}{inlineProducts.length})
                      </button>
                    </div>

                    {/* ==================== KATEGORİLER ==================== */}
                    {menuInternalTab === "kategoriler" && (
                      <div className="space-y-4">
                        {/* Header with Add button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">📂</span>
                            <div>
                              <h4 className="text-white font-bold">Kategoriler</h4>
                              <p className="text-gray-400 text-xs">{inlineCategories.length} {t('kategori')}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setEditingCategory(null);
                              setCategoryForm({ name: { tr: '' }, icon: '📦', isActive: true });
                              setShowCategoryModal(true);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
                          >
                            + Yeni Kategori
                          </button>
                        </div>

                        {/* Loading */}
                        {loadingCategories && (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
                          </div>
                        )}

                        {/* Empty state */}
                        {!loadingCategories && inlineCategories.length === 0 && (
                          <div className="bg-gray-900/50 rounded-xl p-8 text-center border border-gray-700">
                            <span className="text-4xl">🗂️</span>
                            <h4 className="text-white font-medium mt-3">{t('henuzKategoriEklenmemis')}</h4>
                            <p className="text-gray-400 text-sm mt-1">{t('urunleriniziDuzenlemekIcinKategoriEkleyin')}</p>
                            <button
                              onClick={() => {
                                setEditingCategory(null);
                                setCategoryForm({ name: { tr: '' }, icon: '📦', isActive: true });
                                setShowCategoryModal(true);
                              }}
                              className="mt-4 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
                            >
                              {t('ilkKategoriyiEkle')}
                            </button>
                          </div>
                        )}

                        {/* Category List */}
                        {!loadingCategories && inlineCategories.length > 0 && (
                          <div className="space-y-2">
                            {inlineCategories.map((cat, index) => (
                              <div
                                key={cat.id}
                                className={`bg-gray-800/80 rounded-xl p-3 border transition flex items-center gap-3 ${cat.isActive ? 'border-gray-700' : 'border-red-900/50 opacity-60'}`}
                              >
                                {/* Move buttons */}
                                <div className="flex flex-col items-center gap-0.5">
                                  <button
                                    onClick={() => moveCategoryInline(index, 'up')}
                                    disabled={index === 0}
                                    className="text-gray-500 hover:text-white disabled:opacity-20 text-xs"
                                  >▲</button>
                                  <span className="text-[10px] text-gray-600">{index + 1}</span>
                                  <button
                                    onClick={() => moveCategoryInline(index, 'down')}
                                    disabled={index === inlineCategories.length - 1}
                                    className="text-gray-500 hover:text-white disabled:opacity-20 text-xs"
                                  >▼</button>
                                </div>

                                {/* Icon */}
                                <span className="text-3xl">{cat.icon}</span>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-white font-bold text-sm">{cat.name}</h5>
                                  <p className="text-gray-500 text-xs">
                                    {inlineProducts.filter((p: any) => p.category === cat.name || p.categoryId === cat.id).length} {t('urun')} {cat.isActive ? '✅ Aktif' : t('pasif')}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingCategory(cat);
                                      setCategoryForm({ name: cat.name, icon: cat.icon, isActive: cat.isActive });
                                      setShowCategoryModal(true);
                                    }}
                                    className="p-1.5 bg-yellow-600/80 hover:bg-yellow-500 rounded-lg transition text-white text-xs"
                                    title={t('duzenle1')}
                                  >✏️</button>
                                  <button
                                    onClick={() => setDeletingCategoryId(cat.id)}
                                    className="p-1.5 bg-red-600/80 hover:bg-red-500 rounded-lg transition text-white text-xs"
                                    title={t('sil')}
                                  >🗑️</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Category Add/Edit Modal */}
                        {showCategoryModal && (
                          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                              <h2 className="text-xl font-bold text-white mb-4">
                                {editingCategory ? t('kategoriDuzenle') : t('yeni_kategori')}
                              </h2>

                              {/* Icon Selection */}
                              <div className="mb-4">
                                <label className="text-gray-400 text-sm mb-2 block">{t('ikon')}</label>
                                <div className="flex flex-wrap gap-2">
                                  {CATEGORY_ICONS.map(icon => (
                                    <button
                                      key={icon}
                                      onClick={() => setCategoryForm({ ...categoryForm, icon })}
                                      className={`w-10 h-10 text-2xl rounded-lg transition ${categoryForm.icon === icon
                                        ? 'bg-violet-600 ring-2 ring-violet-400'
                                        : 'bg-gray-700 hover:bg-gray-600'
                                        }`}
                                    >
                                      {icon}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Name */}
                              <div className="mb-4">
                                <MultiLanguageInput
                                  label={t('kategoriAdi')}
                                  value={categoryForm.name}
                                  onChange={(val) => setCategoryForm({ ...categoryForm, name: val })}
                                  placeholder={t('ornKebaplarIceceklerTatlilar')}
                                />
                              </div>

                              {/* Active Toggle */}
                              <div className="mb-6">
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={categoryForm.isActive}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-violet-500"
                                  />
                                  <span className="text-gray-300">{t('aktifUygulamadaGorunsun')}</span>
                                </label>
                              </div>

                              {/* Buttons */}
                              <div className="flex gap-3">
                                <button
                                  onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                                  className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
                                >{t('iptal1')}</button>
                                <button
                                  onClick={handleSaveCategory}
                                  disabled={savingCategory || !categoryForm.name.trim()}
                                  className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
                                >
                                  {savingCategory ? 'Kaydediliyor...' : t('kaydet')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Category Delete Confirmation */}
                        {deletingCategoryId && (
                          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm text-center">
                              <span className="text-4xl">⚠️</span>
                              <h3 className="text-lg font-bold text-white mt-3">{t('kategoriyi_sil')}</h3>
                              <p className="text-gray-400 text-sm mt-2">
                                {t('buKategoriyiKaliciOlarakSilmekIstediginizden')}
                              </p>
                              <div className="flex gap-3 mt-5">
                                <button
                                  onClick={() => setDeletingCategoryId(null)}
                                  className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                                >{t('iptal1')}</button>
                                <button
                                  onClick={() => handleDeleteCategory(deletingCategoryId)}
                                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500"
                                >{t('evet_sil')}</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ==================== ÜRÜNLER ==================== */}
                    {menuInternalTab === "urunler" && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">📦</span>
                            <div>
                              <h4 className="text-white font-bold">{t('urunler1')}</h4>
                              <p className="text-gray-400 text-xs">{inlineProducts.length} {t('urun1')}</p>
                            </div>
                          </div>
                          <a
                            href={`/admin/products?businessId=${businessId}`}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition inline-flex items-center gap-1"
                          >
                            {t('urunEkleDuzenle')}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>

                        {/* Loading */}
                        {loadingProducts && (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                          </div>
                        )}

                        {/* Empty state */}
                        {!loadingProducts && inlineProducts.length === 0 && (
                          <div className="bg-gray-900/50 rounded-xl p-8 text-center border border-gray-700">
                            <span className="text-4xl">📦</span>
                            <h4 className="text-white font-medium mt-3">{t('henuzUrunEklenmemis')}</h4>
                            <p className="text-gray-400 text-sm mt-1">{t('isletmeyeUrunAtamakIcinUrunYonetimine')}</p>
                            <a
                              href={`/admin/products?businessId=${businessId}`}
                              className="mt-4 inline-block px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                            >
                              {t('urunYonetimineGit')}
                            </a>
                          </div>
                        )}

                        {/* Product List grouped by category */}
                        {!loadingProducts && inlineProducts.length > 0 && (() => {
                          // Group products by category
                          const grouped: Record<string, any[]> = {};
                          inlineProducts.forEach((p: any) => {
                            const catName = p.category || 'Kategorisiz';
                            if (!grouped[catName]) grouped[catName] = [];
                            grouped[catName].push(p);
                          });
                          return (
                            <div className="space-y-4">
                              {Object.entries(grouped).map(([catName, prods]) => {
                                const catInfo = inlineCategories.find(c => c.name === catName);
                                return (
                                  <div key={catName} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
                                    {/* Category header */}
                                    <div className="px-4 py-2.5 bg-gray-700/50 flex items-center gap-2 border-b border-gray-700">
                                      <span className="text-lg">{catInfo?.icon || '📦'}</span>
                                      <span className="text-white font-bold text-sm">{catName}</span>
                                      <span className="text-gray-400 text-xs ml-auto">{prods.length} {t('urun1')}</span>
                                    </div>
                                    {/* Product rows */}
                                    <div className="divide-y divide-gray-700/50">
                                      {prods.map((product: any) => (
                                        <div key={product.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-700/30 transition">
                                          {/* Product image or placeholder */}
                                          {product.imageUrl || (product.images && product.images[0]) ? (
                                            <img
                                              src={product.imageUrl || product.images[0]}
                                              alt={product.name}
                                              className="w-10 h-10 rounded-lg object-cover"
                                            />
                                          ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500 text-lg">
                                              📷
                                            </div>
                                          )}
                                          {/* Name and details */}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{product.name}</p>
                                            <p className="text-gray-500 text-xs truncate">
                                              {getLocalizedText(product.description) || product.unit || ''}
                                            </p>
                                          </div>
                                          {/* Price */}
                                          <div className="text-right">
                                            {product.price != null && (
                                              <span className="text-green-400 font-bold text-sm">
                                                {formatCurrency(typeof product.price === 'number' ? product.price : parseFloat(product.price || '0'), business?.currency)}
                                              </span>
                                            )}
                                            {product.isActive === false && (
                                              <span className="block text-red-400 text-[10px]">{t('pasif')}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )
              }

              {/* Sub-Tab: Personel */}
              {
                settingsSubTab === "personel" && (
                  <div className="space-y-6">

                    {/* ═══════ Aktif Vardiyalar Panel ═══════ */}
                    {activeShifts.length > 0 && (
                      <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-600/30 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-2xl">🟢</span>
                          <h3 className="text-lg font-bold text-green-300">
                            {t('aktif_vardiyalar')}{activeShifts.length})
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-green-400/80 border-b border-green-700/50">
                              <tr>
                                <th className="pb-2 pr-3">👤 Personel</th>
                                <th className="pb-2 pr-3">{t('baslangic')}</th>
                                <th className="pb-2 pr-3">{t('sure')}</th>
                                <th className="pb-2 pr-3">📍 Konum</th>
                                <th className="pb-2 pr-3">📋 Masalar</th>
                                <th className="pb-2">{t('durum')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeShifts.map(shift => {
                                const startTime = shift.shiftStartedAt?.toDate?.() || shift.shiftStartedAt;
                                const startStr = startTime
                                  ? new Date(startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                                  : '—';
                                const elapsed = startTime
                                  ? Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)
                                  : 0;
                                const hrs = Math.floor(elapsed / 60);
                                const mins = elapsed % 60;
                                const elapsedStr = hrs > 0 ? `${hrs}sa ${mins}dk` : `${mins}dk`;
                                const isPaused = shift.shiftStatus === 'paused';
                                return (
                                  <tr key={shift.id} className="border-b border-green-800/30">
                                    <td className="py-2.5 pr-3 text-white font-medium">
                                      {shift.displayName || shift.email || t('isimsiz')}
                                    </td>
                                    <td className="py-2.5 pr-3 text-gray-300">{startStr}</td>
                                    <td className="py-2.5 pr-3 text-gray-300 font-mono">{elapsedStr}</td>
                                    <td className="py-2.5 pr-3 text-gray-400 max-w-[150px] truncate" title={shift.shiftStartLocation?.address}>
                                      {shift.shiftStartLocation?.address
                                        ? shift.shiftStartLocation.address.substring(0, 30) + (shift.shiftStartLocation.address.length > 30 ? '…' : '')
                                        : '—'}
                                    </td>
                                    <td className="py-2.5 pr-3 text-gray-300">
                                      {shift.shiftAssignedTables?.length
                                        ? shift.shiftAssignedTables.join(', ')
                                        : '—'}
                                    </td>
                                    <td className="py-2.5">
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isPaused
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-green-500/20 text-green-300 border border-green-500/30'
                                        }`}>
                                        {isPaused ? '⏸ Mola' : '✅ Aktif'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Aktif / Arşivlenmiş Tabs */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setStaffStatusFilter('active')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${staffStatusFilter === 'active'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                      >
                        {t('aktif')}{staffList.filter(s => s.isActive !== false).length})
                      </button>
                      <button
                        onClick={() => setStaffStatusFilter('archived')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${staffStatusFilter === 'archived'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                      >
                        {t('arsivlenmis')}{staffList.filter(s => s.isActive === false).length})
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                      <input
                        type="text"
                        placeholder={t('isimEpostaVeyaTelefonIleAra')}
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Staff Table */}
                    <div>
                      <h3 className="text-white font-medium mb-3">
                        Mevcut Personel ({staffList.filter(s => {
                          const matchesStatus = staffStatusFilter === 'active' ? s.isActive !== false : s.isActive === false;
                          const matchesSearch = !staffSearchQuery ||
                            s.displayName?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                            s.email?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                            s.phoneNumber?.includes(staffSearchQuery);
                          return matchesStatus && matchesSearch;
                        }).length})
                      </h3>

                      {staffList.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <p className="text-4xl mb-2">👥</p>
                          <p>{t('henuzPersonelYok')}</p>
                        </div>
                      ) : (
                        <table className="w-full text-left">
                          <thead className="text-gray-400 border-b border-gray-700">
                            <tr>
                              <th className="pb-3 py-2">{t('kullanici')}</th>
                              <th className="pb-3 py-2">Rol</th>
                              <th className="pb-3 py-2">{t('durum')}</th>
                              <th className="pb-3 py-2">{t('islemler')}</th>
                            </tr>
                          </thead>
                          <tbody className="text-white">
                            {staffList.filter(s => {
                              const matchesStatus = staffStatusFilter === 'active' ? s.isActive !== false : s.isActive === false;
                              const matchesSearch = !staffSearchQuery ||
                                s.displayName?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                                s.email?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                                s.phoneNumber?.includes(staffSearchQuery);
                              return matchesStatus && matchesSearch;
                            }).length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-gray-400">
                                    <p className="text-2xl mb-2">👥</p>
                                    <p>{staffStatusFilter === 'archived' ? t('arsivlenmisPersonelBulunamadi') : t('personelBulunamadi')}</p>
                                  </td>
                                </tr>
                              )}
                            {staffList.filter(s => {
                              const matchesStatus = staffStatusFilter === 'active' ? s.isActive !== false : s.isActive === false;
                              const matchesSearch = !staffSearchQuery ||
                                s.displayName?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                                s.email?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
                                s.phoneNumber?.includes(staffSearchQuery);
                              return matchesStatus && matchesSearch;
                            }).map((staff) => (
                              <tr key={staff.id} className="border-b border-gray-700 hover:bg-gray-750">
                                <td className="py-4">
                                  <div>
                                    <p className="font-medium">{staff.displayName}</p>
                                    <p className="text-gray-400 text-sm">{staff.email || '-'}</p>
                                    <p className="text-gray-500 text-xs">{staff.phoneNumber}</p>
                                  </div>
                                </td>
                                <td className="py-4">
                                  <span className={`px-2 py-1 rounded text-xs ${staff.adminType?.includes('Admin') || staff.adminType?.includes('_admin')
                                    ? 'bg-purple-600'
                                    : 'bg-blue-600'
                                    }`}>
                                    {staff.adminType || 'Personel'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <span className={`px-2 py-1 rounded text-xs ${staff.isActive !== false ? 'bg-green-600' : 'bg-red-600'}`}>
                                    {staff.isActive !== false ? t('aktif') : t('pasif')}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <div className="flex flex-wrap gap-2">
                                    {/* Arşivle / Aktifleştir toggle */}
                                    <button
                                      onClick={() => {
                                        const isActive = staff.isActive !== false;
                                        setConfirmModal({
                                          show: true,
                                          title: isActive ? t('personelArsivle') : t('personelAktiflestir'),
                                          message: isActive
                                            ? `${staff.displayName} ${t('adliPersoneliArsivlemekIstediginizeEminMisiniz')}`
                                            : `${staff.displayName} ${t('adliPersoneliTekrarAktiflestirmekIstediginizeEmin')}`,
                                          confirmText: isActive ? t('evetArsivle') : t('evetAktiflestir'),
                                          confirmColor: isActive ? 'bg-amber-600 hover:bg-amber-500' : 'bg-green-600 hover:bg-green-500',
                                          onConfirm: async () => {
                                            setConfirmModal(prev => ({ ...prev, show: false }));
                                            try {
                                              const adminRef = doc(db, 'admins', staff.id);
                                              const now = new Date();
                                              if (isActive) {
                                                await updateDoc(adminRef, {
                                                  isActive: false,
                                                  deactivatedAt: now,
                                                  deactivationReason: t('isletmePanelindenArsivlendi'),
                                                });
                                                showToast(`${staff.displayName} ${t('arsivlendi')}`, 'success');
                                              } else {
                                                await updateDoc(adminRef, {
                                                  isActive: true,
                                                  deactivatedAt: null,
                                                  deactivationReason: null,
                                                });
                                                showToast(`${staff.displayName} ${t('tekrarAktiflestirildi')}`, 'success');
                                              }
                                              loadStaff();
                                            } catch (error) {
                                              console.error('Archive error:', error);
                                              showToast(t('islemBasarisiz'), 'error');
                                            }
                                          },
                                        });
                                      }}
                                      className={`text-xs px-2 py-1 rounded ${staff.isActive !== false
                                        ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white'
                                        : 'bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white'}`}
                                    >
                                      {staff.isActive !== false ? t('arsivle1') : t('aktiflestir')}
                                    </button>
                                    {/* Yetkiyi Kaldır */}
                                    <button
                                      onClick={() => {
                                        setConfirmModal({
                                          show: true,
                                          title: t('yetkiyiKaldir'),
                                          message: `${staff.displayName} ${t('adliPersonelinYetkisiniKaldirmakIstediginizeEmin')}`,
                                          confirmText: t('evetKaldir'),
                                          confirmColor: 'bg-red-600 hover:bg-red-500',
                                          onConfirm: async () => {
                                            setConfirmModal(prev => ({ ...prev, show: false }));
                                            try {
                                              const adminRef = doc(db, 'admins', staff.id);
                                              await updateDoc(adminRef, {
                                                isActive: false,
                                                adminType: null,
                                                butcherId: null,
                                                butcherName: null,
                                                deactivatedAt: new Date(),
                                                deactivationReason: t('yetkiKaldirildi'),
                                              });
                                              showToast(`${staff.displayName} ${t('yetkisiKaldirildi')}`, 'success');
                                              loadStaff();
                                            } catch (error) {
                                              console.error('Remove permission error:', error);
                                              showToast(t('islemBasarisiz'), 'error');
                                            }
                                          },
                                        });
                                      }}
                                      className="text-xs px-2 py-1 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white"
                                    >
                                      {t('yetkiyiKaldir1')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Invite New Staff */}
                    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                      <h3 className="text-white font-bold text-lg mb-4">
                        {t('yeni_personel_ekle')}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder={t('isim')}
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          className="bg-gray-700 text-white px-3 py-2 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Soyisim (opsiyonel)"
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          className="bg-gray-700 text-white px-3 py-2 rounded-lg"
                        />
                      </div>
                      <div className="flex gap-2 mt-3">
                        <select
                          value={inviteCountryCode}
                          onChange={(e) => setInviteCountryCode(e.target.value)}
                          className="bg-gray-700 text-white px-3 py-2 rounded-lg w-24"
                        >
                          <option value="+49">🇩🇪 +49</option>
                          <option value="+90">🇹🇷 +90</option>
                          <option value="+43">🇦🇹 +43</option>
                        </select>
                        <input
                          type="tel"
                          placeholder={t('telefonNumarasi')}
                          value={invitePhone}
                          onChange={(e) =>
                            setInvitePhone(e.target.value.replace(/\D/g, ""))
                          }
                          className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg"
                        />
                      </div>
                      <input
                        type="email"
                        placeholder={t('epostaOpsiyonelBildirimIcin')}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full mt-3 bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                      <div className="mt-3">
                        <label className="text-gray-400 text-sm">Rol</label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1"
                        >
                          <option value="Personel">👤 Personel</option>
                          <option value="Admin">{t('isletmeAdmin')}</option>
                        </select>
                      </div>
                      <button
                        onClick={handleInviteStaff}
                        disabled={staffLoading}
                        className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg hover:bg-green-500 disabled:opacity-50 font-medium"
                      >
                        {staffLoading
                          ? t('hesapOlusturuluyor')
                          : t('hesapOlusturDavetGonder')}
                      </button>

                      {/* Invite Result Feedback */}
                      {inviteResult && inviteResult.success && (
                        <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-3">
                          <p className="text-green-300 font-medium">{t('personelBasariylaEklendi')}</p>
                          <div className="bg-gray-800 p-3 rounded text-sm">
                            <p className="text-gray-400">{t('geciciSifre')}</p>
                            <p className="text-white font-mono text-lg">{inviteResult.tempPassword}</p>
                          </div>
                          {inviteResult.notifications && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className={`px-2 py-1 rounded ${inviteResult.notifications.email?.sent ? 'bg-green-600' : 'bg-gray-600'}`}>
                                {inviteResult.notifications.email?.sent ? '✅' : '❌'} Email
                              </span>
                              <span className={`px-2 py-1 rounded ${inviteResult.notifications.whatsapp?.sent ? 'bg-green-600' : 'bg-gray-600'}`}>
                                {inviteResult.notifications.whatsapp?.sent ? '✅' : '❌'} WhatsApp
                              </span>
                              <span className={`px-2 py-1 rounded ${inviteResult.notifications.sms?.sent ? 'bg-green-600' : 'bg-gray-600'}`}>
                                {inviteResult.notifications.sms?.sent ? '✅' : '❌'} SMS
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => setInviteResult(null)}
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            {t('kapat')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              {/* Sub-Tab: Teslimat */}
              {
                settingsSubTab === "teslimat" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {/* Delivery Settings */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                          {t('teslimatAyarlari')}
                        </h4>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={formData.supportsDelivery}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                supportsDelivery: e.target.checked,
                              })
                            }
                            disabled={!isEditing}
                            className="w-5 h-5"
                          />
                          <span className="text-white">{t('kuryeDestegiVar')}</span>
                        </div>
                        {formData.supportsDelivery && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div>
                              <label className="text-gray-400 text-sm">
                                {t('minSiparis')}
                              </label>
                              <input
                                type="number"
                                value={formData.minDeliveryOrder}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    minDeliveryOrder: parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="text-gray-400 text-sm">
                                {t('teslimatUcreti')}
                              </label>
                              <input
                                type="number"
                                value={formData.deliveryFee}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    deliveryFee: parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="text-gray-400 text-sm">
                                Maks. Mesafe (km)
                              </label>
                              <input
                                type="number"
                                value={formData.deliveryRadius || 5}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    deliveryRadius: parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                              />
                            </div>
                          </div>
                        )}

                        {/* 🆕 Gelişmiş Sipariş Saatleri (Lieferando benzeri) */}
                        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                          <h5 className="text-white font-medium mb-3 flex items-center gap-2">
                            {t('gelismisSiparisSaatleri')}
                            <span className="text-xs text-gray-500">(Opsiyonel)</span>
                          </h5>
                          <p className="text-xs text-gray-400 mb-3">
                            {t('isletmeAcikOlsaBileKuryegelAl')}
                          </p>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Kurye Başlangıç Saati */}
                            <div>
                              <label className="text-gray-400 text-sm flex items-center gap-1">
                                {t('kuryeBaslangic')}
                              </label>
                              <input
                                type="time"
                                value={formData.deliveryStartTime || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    deliveryStartTime: e.target.value,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                placeholder={t('or1400')}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t('bosAcilisSaati')}
                              </p>
                            </div>

                            {/* Kurye Bitiş Saati */}
                            <div>
                              <label className="text-gray-400 text-sm flex items-center gap-1">
                                {t('kuryeBitis')}
                              </label>
                              <input
                                type="time"
                                value={formData.deliveryEndTime || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    deliveryEndTime: e.target.value,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                placeholder={t('or2000')}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t('bosKapanisSaati')}
                              </p>
                            </div>

                            {/* Gel Al Başlangıç Saati */}
                            <div>
                              <label className="text-gray-400 text-sm flex items-center gap-1">
                                {t('gelAlBaslangic')}
                              </label>
                              <input
                                type="time"
                                value={formData.pickupStartTime || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    pickupStartTime: e.target.value,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                placeholder={t('or1200')}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t('bosAcilisSaati')}
                              </p>
                            </div>

                            {/* Gel Al Bitiş Saati */}
                            <div>
                              <label className="text-gray-400 text-sm flex items-center gap-1">
                                {t('gelAlBitis')}
                              </label>
                              <input
                                type="time"
                                value={formData.pickupEndTime || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    pickupEndTime: e.target.value,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                placeholder={t('or2100')}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t('bosKapanisSaati')}
                              </p>
                            </div>
                          </div>

                          {/* Ücretsiz Teslimat Eşiği */}
                          <div className="mt-3">
                            <label className="text-gray-400 text-sm flex items-center gap-1">
                              {t('ucretsizTeslimatEsigi')}
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                value={formData.freeDeliveryThreshold || 0}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    freeDeliveryThreshold: parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={!isEditing}
                                className="w-32 bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                                min="0"
                                step="0.01"
                              />
                              <span className="text-gray-400 text-sm">{t('uzeriSiparislerdeTeslimatUcretsiz')}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {t('0HerZamanTeslimatUcretiUygulanir')}
                            </p>
                          </div>

                          {/* Ön Sipariş Checkbox */}
                          <div className="mt-3 flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={formData.preOrderEnabled}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  preOrderEnabled: e.target.checked,
                                })
                              }
                              disabled={!isEditing}
                              className="w-5 h-5 accent-amber-500"
                            />
                            <div>
                              <span className="text-white">{t('onSiparisKabulEt')}</span>
                              <p className="text-xs text-gray-400">
                                {t('isletmeKapaliykenDeErtesiGunIcin')}
                              </p>
                            </div>
                          </div>

                          {/* Bilgi mesajı */}
                          {(formData.deliveryStartTime || formData.pickupStartTime) && (
                            <div className="mt-2 p-2 bg-blue-900/30 rounded border border-blue-700">
                              <p className="text-xs text-blue-300">
                                {t('mobilUygulamadaIsletmeKartindaTeslimat')} {formData.deliveryStartTime || "..."}&apos;ten sonra&quot; /
                                &quot;Gel Al {formData.pickupStartTime || "..."}{t('danItibarenSeklindeBadgeGosterilecek')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )
              }

              {/* Sub-Tab: Masa */}
              {
                settingsSubTab === "masa" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {/* 🍽️ Masa Rezervasyonu */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                          🍽️ Masa Rezervasyonu
                        </h4>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={formData.hasReservation}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                hasReservation: e.target.checked,
                              })
                            }
                            disabled={!isEditing}
                            className="w-5 h-5 accent-amber-500"
                          />
                          <div>
                            <span className="text-white">{t('masa_rezervasyonu_aktif')}</span>
                            <p className="text-xs text-gray-400">
                              {t('musterilerMobilUygulamadanMasaRezervasyonuYapabilir')}
                            </p>
                          </div>
                        </div>
                        {formData.hasReservation && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-gray-400 text-sm">
                                {t('oturmaKapasitesiKisi')}
                              </label>
                              <input
                                type="number"
                                value={formData.tableCapacity}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    tableCapacity: parseInt(e.target.value) || 0,
                                  })
                                }
                                disabled={!isEditing}
                                min="0"
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                placeholder={t('or50')}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t('toplamOturmaKapasitesiKisi')}
                              </p>
                            </div>
                            <div>
                              <label className="text-gray-400 text-sm">
                                Max Masa Rezervasyonu
                              </label>
                              <input
                                type="number"
                                value={formData.maxReservationTables}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    maxReservationTables: parseInt(e.target.value) || 0,
                                  })
                                }
                                disabled={!isEditing}
                                min="0"
                                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                                placeholder={t('or10')}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t('ayniSaatDilimindeMaxRezervasyon')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 🍽️ Yerinde Sipariş Ayarları */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                          {t('yerindeSiparisAyarlari')}
                        </h4>

                        {/* Ödeme Zamanlaması */}
                        <div>
                          <label className="text-gray-400 text-sm block mb-2">{t('odemeZamanlamasi')}</label>
                          <div className="flex gap-3">
                            <label className={`flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer border transition ${formData.dineInPaymentMode === 'payFirst'
                              ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                              : 'bg-gray-700 border-gray-600 text-gray-300'
                              } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input
                                type="radio"
                                name="dineInPaymentMode"
                                value="payFirst"
                                checked={formData.dineInPaymentMode === 'payFirst'}
                                onChange={(e) => setFormData({ ...formData, dineInPaymentMode: e.target.value })}
                                disabled={!isEditing}
                                className="accent-amber-500"
                              />
                              <div>
                                <span className="font-medium">{t('hemenOde')}</span>
                                <p className="text-xs text-gray-400">{t('fastFoodSiparisOncesiOdemeZorunlu')}</p>
                              </div>
                            </label>
                            <label className={`flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer border transition ${formData.dineInPaymentMode === 'payLater'
                              ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                              : 'bg-gray-700 border-gray-600 text-gray-300'
                              } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <input
                                type="radio"
                                name="dineInPaymentMode"
                                value="payLater"
                                checked={formData.dineInPaymentMode === 'payLater'}
                                onChange={(e) => setFormData({ ...formData, dineInPaymentMode: e.target.value })}
                                disabled={!isEditing}
                                className="accent-amber-500"
                              />
                              <div>
                                <span className="font-medium">{t('cikistaOde')}</span>
                                <p className="text-xs text-gray-400">{t('restoran_masada_hesap_isteme')}</p>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Garson Servisi */}
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={formData.hasTableService}
                            onChange={(e) => setFormData({ ...formData, hasTableService: e.target.checked })}
                            disabled={!isEditing}
                            className="w-5 h-5 accent-amber-500"
                          />
                          <div>
                            <span className="text-white">{t('garson_servisi_aktif')}</span>
                            <p className="text-xs text-gray-400">
                              {formData.hasTableService
                                ? t('siparisHazirOluncaMusteriyeSiparisinizMasaniza')
                                : t('siparisHazirOluncaMusteriyeGelipAlabilirsiniz')}
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              }

              {/* Sub-Tab: Abonelik Planı */}
              {
                settingsSubTab === "abonelik" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {/* Subscription */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                          💳 Abonelik
                        </h4>
                        <div>
                          <label className="text-gray-400 text-sm">Plan</label>
                          <select
                            value={formData.subscriptionPlan}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                subscriptionPlan: e.target.value as string,
                              })
                            }
                            disabled={!isEditing}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                          >
                            <option value="none">{t('yok')}</option>
                            {availablePlans.map(plan => (
                              <option key={plan.code} value={plan.code}>{plan.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm">
                            {t('aylikUcret')}
                          </label>
                          <input
                            type="number"
                            value={formData.monthlyFee}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                monthlyFee: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={!isEditing}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                )
              }

              {/* Sub-Tab: Ödeme Bilgileri */}
              {
                settingsSubTab === "odeme" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {/* Bank Details (SEPA) */}
                      <div className="space-y-4">
                        <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                          🏦 Banka Bilgileri (SEPA)
                        </h4>
                        <div>
                          <label className="text-gray-400 text-sm">
                            {t('hesap_sahibi')}
                          </label>
                          <input
                            type="text"
                            value={formData.bankAccountHolder}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                bankAccountHolder: e.target.value,
                              })
                            }
                            disabled={!isEditing}
                            placeholder={t('ornAhmetYilmaz')}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-sm">{t('bankaAdi1')}</label>
                          <input
                            type="text"
                            value={formData.bankName}
                            onChange={(e) =>
                              setFormData({ ...formData, bankName: e.target.value })
                            }
                            disabled={!isEditing}
                            placeholder={t('ornSparkasse')}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-gray-400 text-sm">{t('iban')}</label>
                            <input
                              type="text"
                              value={formData.bankIban}
                              onChange={(e) =>
                                setFormData({ ...formData, bankIban: e.target.value })
                              }
                              disabled={!isEditing}
                              placeholder="DE..."
                              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <label className="text-gray-400 text-sm">{t('bic')}</label>
                            <input
                              type="text"
                              value={formData.bankBic}
                              onChange={(e) =>
                                setFormData({ ...formData, bankBic: e.target.value })
                              }
                              disabled={!isEditing}
                              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              }

              {/* Reviews Section - shown in İşletme sub-tab */}
              {
                settingsSubTab === "isletme" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {formData.reviews && formData.reviews.length > 0 && (
                        <div className="pt-6 border-t border-gray-700">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Star className="w-5 h-5 text-yellow-500" />
                              <h3 className="font-semibold text-gray-200">
                                {t('googleYorumlari')}
                              </h3>
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                                {formData.rating?.toFixed(1)} ({formData.reviewCount})
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {formData.reviews
                              .slice(0, 3)
                              .map((review: any, i: number) => (
                                <div
                                  key={i}
                                  className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <img
                                      src={review.profile_photo_url}
                                      alt={review.author_name}
                                      className="w-6 h-6 rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <label htmlFor="brandLabelActive" className="text-sm font-medium text-gray-400">
                                        App
                                      </label>
                                      <div className="text-xs font-medium text-gray-300 truncate">
                                        {review.author_name}
                                      </div>
                                      <div className="flex text-yellow-500 text-[10px]">
                                        {"★".repeat(Math.round(review.rating))}
                                        <span className="text-gray-600 ml-1">
                                          {review.relative_time_description}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-400 line-clamp-3 italic">
                                    "{review.text}"
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )
              }

              {/* Subscription History - shown in Abonelik sub-tab */}
              {
                settingsSubTab === "abonelik" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {business && business.subscriptionHistory && business.subscriptionHistory.length > 0 && (
                        <div className="pt-6 border-t border-gray-700">
                          <div className="flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold text-gray-200">{t('abonelikGecmisi')}</h3>
                          </div>
                          <div className="overflow-x-auto bg-gray-800/30 rounded-lg border border-gray-700/50">
                            <table className="w-full text-xs text-left text-gray-400">
                              <thead className="text-gray-500 bg-gray-900/50 uppercase">
                                <tr>
                                  <th className="px-4 py-2">Plan</th>
                                  <th className="px-4 py-2">{t('baslangic1')}</th>
                                  <th className="px-4 py-2">{t('bitis')}</th>
                                  <th className="px-4 py-2">{t('degistiren')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800">
                                {(business?.subscriptionHistory || []).map((h: any, i: number) => (
                                  <tr key={i} className="hover:bg-gray-800/30">
                                    <td className="px-4 py-2 font-medium text-white uppercase">{h.plan}</td>
                                    <td className="px-4 py-2">{h.startDate?.seconds ? new Date(h.startDate.seconds * 1000).toLocaleDateString('tr-TR') : new Date(h.startDate).toLocaleDateString('tr-TR')}</td>
                                    <td className="px-4 py-2">{h.endDate?.seconds ? new Date(h.endDate.seconds * 1000).toLocaleDateString('tr-TR') : new Date(h.endDate).toLocaleDateString('tr-TR')}</td>
                                    <td className="px-4 py-2 text-gray-500">{h.changedBy?.split('@')[0]}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
            </div >
          )
        }




        {/* 🍽️ Reservations Tab */}
        {
          activeTab === "reservations" && formData.hasReservation && (
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
              <ReservationsPanel
                businessId={businessId}
                businessName={formData.companyName || ""}
                staffName={admin?.displayName || admin?.email || "Admin"}
              />
            </div>
          )
        }

        {/* 🪑 Dine-In content — rendered within Masa sub-tab */}
        {
          activeTab === "settings" && settingsSubTab === "masa" && (planFeatures.dineInQR || planFeatures.waiterOrder) && (
            <div className="space-y-6">
              {/* ── Header Stats Row ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-2xl font-bold text-amber-400">{formData.maxReservationTables || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('toplam_masa')}</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-2xl font-bold text-teal-400">{formData.tableCapacity || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Oturma Kapasitesi</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-2xl font-bold text-green-400">{planFeatures.dineInQR ? '✓' : '✕'}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('qrSiparis')}</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-2xl font-bold text-blue-400">{planFeatures.waiterOrder ? '✓' : '✕'}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('garsonSiparis')}</p>
                </div>
              </div>

              {/* ── Table Management: Masa Yönetimi ── */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  {t('masaYonetimi')}
                </h2>

                {/* Quick setup row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">{t('toplam_masa_adedi')}</label>
                    <input
                      type="number"
                      value={formData.maxReservationTables}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxReservationTables: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      min="0"
                      max="200"
                      className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
                      placeholder={t('or20')}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">{t('oturmaKapasitesiKisi')}</label>
                    <input
                      type="number"
                      value={formData.tableCapacity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tableCapacity: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      min="0"
                      className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-lg font-medium"
                      placeholder={t('or80')}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        const count = formData.maxReservationTables || 0;
                        if (count <= 0) return;
                        // Generate tables 1..N with no sections
                        const newTables = Array.from({ length: count }, (_, i) => ({
                          label: String(i + 1),
                          section: '',
                          sortOrder: i,
                        }));
                        setFormData({ ...formData, tables: newTables });
                        showToast(`${count} ${t('masaOlusturuldu1')}${count})`, 'success');
                      }}
                      className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition"
                    >
                      🔄 1&apos;den {formData.maxReservationTables || 'N'}{t('eOlustur')}
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        // Add a single new table
                        const existingLabels = formData.tables.map((t: any) => t.label);
                        let nextNum = formData.tables.length + 1;
                        while (existingLabels.includes(String(nextNum))) nextNum++;
                        const newTable = { label: String(nextNum), section: '', sortOrder: formData.tables.length };
                        setFormData({ ...formData, tables: [...formData.tables, newTable], maxReservationTables: formData.tables.length + 1 });
                      }}
                      className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition"
                    >
                      {t('tek_masa_ekle')}
                    </button>
                  </div>
                </div>

                {/* Section management */}
                {formData.tables.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-300">{t('bolumler')}</h3>
                      <button
                        onClick={() => {
                          const name = prompt(t('yeniBolumAdiOr1Kat'));
                          if (!name?.trim()) return;
                          if (formData.tableSections.includes(name.trim())) {
                            showToast(t('buBolumZatenMevcut'), 'error');
                            return;
                          }
                          setFormData({ ...formData, tableSections: [...formData.tableSections, name.trim()] });
                        }}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition"
                      >
                        {t('bolumEkle')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tableSections.length === 0 && (
                        <span className="text-xs text-gray-500 italic">{t('henuzBolumYokTumMasalarTek')}</span>
                      )}
                      {formData.tableSections.map((section: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm">
                          <span className="text-white">{section}</span>
                          <span className="text-gray-500 text-xs ml-1">
                            ({formData.tables.filter((t: any) => t.section === section).length} masa)
                          </span>
                          <button
                            onClick={() => {
                              // Remove section and clear it from tables
                              const updated = formData.tables.map((t: any) =>
                                t.section === section ? { ...t, section: '' } : t
                              );
                              setFormData({
                                ...formData,
                                tableSections: formData.tableSections.filter((_: any, i: number) => i !== idx),
                                tables: updated,
                              });
                            }}
                            className="ml-1 text-red-400 hover:text-red-300 transition text-xs"
                            title={t('bolumuSil')}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table list — editable grid */}
                {formData.tables.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-300">
                        🪑 Masalar ({formData.tables.length})
                      </h3>
                    </div>

                    {/* Group by section */}
                    {(() => {
                      const sections = formData.tableSections.length > 0
                        ? [...formData.tableSections, '']  // named sections + unassigned
                        : [''];  // all in one group
                      return sections.map((sec: string) => {
                        const tablesInSection = formData.tables
                          .map((t: any, idx: number) => ({ ...t, _idx: idx }))
                          .filter((t: any) => t.section === sec);
                        if (tablesInSection.length === 0 && sec !== '') return null;
                        return (
                          <div key={sec || '__nosection'} className="mb-4">
                            {sec && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-amber-400 text-sm font-bold">📍 {sec}</span>
                                <span className="text-gray-500 text-xs">({tablesInSection.length} masa)</span>
                              </div>
                            )}
                            {!sec && formData.tableSections.length > 0 && tablesInSection.length > 0 && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-gray-400 text-sm font-bold">{t('bolumAtanmamis')}</span>
                                <span className="text-gray-500 text-xs">({tablesInSection.length} masa)</span>
                              </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {tablesInSection.map((table: any) => (
                                <div
                                  key={table._idx}
                                  className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex flex-col gap-2 hover:border-amber-500/50 transition"
                                >
                                  {/* Table label */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 text-xs">M</span>
                                    <input
                                      type="text"
                                      value={table.label}
                                      onChange={(e) => {
                                        const updated = [...formData.tables];
                                        updated[table._idx] = { ...updated[table._idx], label: e.target.value };
                                        setFormData({ ...formData, tables: updated });
                                      }}
                                      className="w-full bg-gray-700 text-white text-center px-2 py-1 rounded border border-gray-600 focus:border-amber-500 focus:outline-none text-sm font-bold"
                                      placeholder="#"
                                    />
                                  </div>
                                  {/* Section dropdown */}
                                  {formData.tableSections.length > 0 && (
                                    <select
                                      value={table.section || ''}
                                      onChange={(e) => {
                                        const updated = [...formData.tables];
                                        updated[table._idx] = { ...updated[table._idx], section: e.target.value };
                                        setFormData({ ...formData, tables: updated });
                                      }}
                                      className="w-full bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600 focus:border-amber-500 focus:outline-none text-xs"
                                    >
                                      <option value="">—</option>
                                      {formData.tableSections.map((s: string) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  )}
                                  {/* Delete button */}
                                  <button
                                    onClick={() => {
                                      const updated = formData.tables.filter((_: any, i: number) => i !== table._idx);
                                      setFormData({ ...formData, tables: updated, maxReservationTables: updated.length });
                                    }}
                                    className="text-red-500/60 hover:text-red-400 text-xs transition"
                                  >
                                    🗑
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Empty state */}
                {formData.tables.length === 0 && (
                  <div className="bg-gray-800/50 rounded-xl p-8 border border-dashed border-gray-600 text-center">
                    <span className="text-4xl">🪑</span>
                    <p className="text-white font-semibold mt-3">{t('henuzMasaTanimlanmadi')}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {t('yukaridanMasaSayisiniGirerekOtomatikOlusturun')}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Table QR Codes — Compact Table Layout ── */}
              {planFeatures.dineInQR && formData.tables.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {t('masaQrKodlari')}
                      <span className="text-sm font-normal text-gray-400">
                        · {formData.tables.length} masa
                      </span>
                    </h2>
                    <button
                      onClick={() => {
                        for (const table of formData.tables) {
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://lokma.web.app/dinein/${businessId}/table/${table.label}`)}`;
                          const link = document.createElement('a');
                          link.href = qrUrl;
                          link.download = `Masa_${table.label}_QR.png`;
                          link.target = '_blank';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                    >
                      {t('tumunuIndir')}
                    </button>
                  </div>

                  {/* Compact grid — small QR thumbnails */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                    {formData.tables.map((table: any, idx: number) => {
                      const qrData = `https://lokma.web.app/dinein/${businessId}/table/${table.label}`;
                      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = `Masa_${table.label}_QR.png`;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="bg-gray-800 rounded-lg border border-gray-700 p-2 flex flex-col items-center gap-1 hover:border-amber-500 hover:bg-gray-700/50 transition cursor-pointer group"
                          title={`Masa ${table.label} QR kodunu indir`}
                        >
                          <div className="w-full aspect-square bg-white rounded flex items-center justify-center overflow-hidden">
                            <img
                              src={qrImageUrl}
                              alt={`Masa ${table.label}`}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-300 group-hover:text-amber-400 transition">
                            M{table.label}
                            {table.section && <span className="text-gray-500 font-normal ml-0.5 text-[10px]">· {table.section}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">{t('qrKodunaTiklayarakTekTekIndirebilirsiniz')}</p>
                </div>
              )}

              {/* ── Garson Sipariş Card ── */}
              {planFeatures.waiterOrder && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-600/20 flex items-center justify-center">
                      <span className="text-xl">👨‍🍳</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{t('garsonSiparisSistemi')}</h3>
                      <p className="text-xs text-gray-400">{t('personelTablettelefonIleMasadaSiparisAlir')}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
                      {t('aktif')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <p className="text-teal-400 font-medium text-sm">{t('1MasaSec')}</p>
                      <p className="text-gray-400 text-xs mt-1">{t('garsonMasayiSecer')}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <p className="text-teal-400 font-medium text-sm">{t('2UrunEkle')}</p>
                      <p className="text-gray-400 text-xs mt-1">{t('menudenUrunEkler')}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <p className="text-teal-400 font-medium text-sm">{t('3SiparisGonder')}</p>
                      <p className="text-gray-400 text-xs mt-1">{t('mutfagaIletilir')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Plan Info Footer ── */}
              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <p className="text-sm text-gray-400">
                  {t('buOzelliklerIsletmenin')} <strong className="text-white">{business?.subscriptionPlan || 'basic'}</strong> {t('planiUzerindenYonetilmektedirDegisiklikYapmakIcin')} <a href="/admin/plans" className="text-blue-400 hover:underline">{t('planYonetimi')}</a> {t('sayfasiniZiyaretEdin')}
                </p>
              </div>
            </div>
          )
        }


      </main >

      {/* Confirmation Modal */}
      {
        confirmModal.show && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-white mb-2">
                {confirmModal.title}
              </h3>
              <p className="text-gray-300 mb-6">{confirmModal.message}</p>

              {confirmModal.showRoleSelect && (
                <div className="mb-4">
                  <label className="text-gray-400 text-sm">{t('yeniRolSec')}</label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1"
                  >
                    <option value="">{t('rolSec')}</option>
                    <option value={t('isletmeAdmin1')}>{t('isletmeAdmin1')}</option>
                    <option value="Personel">Personel</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setConfirmModal({ ...confirmModal, show: false })
                  }
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                >
                  {t('iptal1')}
                </button>
                <button
                  onClick={() => confirmModal.onConfirm(selectedNewRole)}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-medium ${confirmModal.confirmColor || "bg-red-600 hover:bg-red-500"}`}
                >
                  {confirmModal.confirmText || t('onayla')}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
