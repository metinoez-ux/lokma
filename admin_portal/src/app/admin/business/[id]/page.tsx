"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
} from "firebase/firestore";
import {
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { MASTER_PRODUCTS, MasterProduct } from "@/lib/master_products";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { auth, db, storage } from "@/lib/firebase";
import { Admin, ButcherPartner } from "@/types";
import { useAdmin } from "@/components/providers/AdminProvider";
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
  createdAt?: { toDate: () => Date };
}

// Turkish status labels for order display
const orderStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Beklemede", color: "bg-yellow-600" },
  accepted: { label: "Onaylandı", color: "bg-blue-600" },
  preparing: { label: "Hazırlanıyor", color: "bg-blue-600" },
  ready: { label: "Hazır", color: "bg-green-600" },
  onTheWay: { label: "Yolda", color: "bg-indigo-600" },
  delivered: { label: "Teslim Edildi", color: "bg-gray-600" },
  completed: { label: "Tamamlandı", color: "bg-gray-600" },
  cancelled: { label: "İptal", color: "bg-red-600" },
};

// Fallback plan labels for badge display (dynamic plans override these)
const defaultPlanLabels: Record<string, { label: string; color: string }> = {
  none: { label: "Yok", color: "bg-gray-800" },
};

// 🆕 Dynamic business type labels for UI - synced with /lib/business-types.ts
const businessTypeLabels: Record<string, { label: string; emoji: string; color: string }> = {
  // === MERKEZI TİPLER (business-types.ts ile uyumlu) ===
  kasap: { label: "Kasap", emoji: "🥩", color: "bg-red-600" },
  market: { label: "Market", emoji: "🛒", color: "bg-green-600" },
  restoran: { label: "Restoran", emoji: "🍽️", color: "bg-orange-600" },
  pastane: { label: "Pastane & Tatlıcı", emoji: "🎂", color: "bg-pink-600" },
  cicekci: { label: "Çiçekçi", emoji: "🌸", color: "bg-purple-600" },
  cigkofte: { label: "Çiğ Köfteci", emoji: "🥙", color: "bg-emerald-600" },
  cafe: { label: "Kafe", emoji: "☕", color: "bg-amber-600" },
  catering: { label: "Catering", emoji: "🎉", color: "bg-indigo-600" },
  firin: { label: "Fırın", emoji: "🥖", color: "bg-amber-700" },
  // === ESKİ KEY'LER (geriye uyumluluk için) ===
  cigkofteci: { label: "Çiğ Köfteci", emoji: "🥙", color: "bg-lime-600" },
  kafe: { label: "Kafe", emoji: "☕", color: "bg-amber-600" },
  kafeterya: { label: "Kafeterya", emoji: "☕", color: "bg-yellow-700" },
  baklava: { label: "Baklava", emoji: "🍯", color: "bg-amber-600" },
  doner: { label: "Döner", emoji: "🌯", color: "bg-yellow-600" },
  berber: { label: "Berber", emoji: "✂️", color: "bg-gray-600" },
};

// Helper to get business type display info (supports single type or array)
function getBusinessTypeLabel(type?: string | string[]) {
  const defaultLabel = { label: "İşletme", emoji: "🏪", color: "bg-gray-600" };

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

// Add global declaration for Google Maps
declare global {
  interface Window {
    google: any;
  }
}

function parseTime(timeStr: string) {
  if (!timeStr) return null;

  // Normalize time string (remove AM/PM spaces to simplify)
  const normalized = timeStr.toUpperCase().replace(/\./g, ":");

  let hours = 0;
  let minutes = 0;

  // Handle AM/PM
  const isPM = normalized.includes("PM");
  const isAM = normalized.includes("AM");

  // Extract numbers
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


// Helper to convert formatted time string (AM/PM) to 24h format (HH:MM)
function formatTo24h(timeStr: string): string {
  const dateObj = parseTime(timeStr);
  if (!dateObj) return timeStr; // Fallback if parse fails
  const h = dateObj.getHours().toString().padStart(2, '0');
  const m = dateObj.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function checkShopStatus(openingHours: string | string[]) {
  try {
    const hoursStr = Array.isArray(openingHours) ? openingHours.join("\n") : openingHours;
    if (!hoursStr) return { isOpen: false, text: "Kapalı", isClosed: true };

    const now = new Date();
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const currentDay = dayNames[now.getDay()];

    const todayLine = hoursStr.split("\n").find(l =>
      l.startsWith(currentDay + ":") || l.startsWith(currentDay + " ")
    );

    if (!todayLine) return { isOpen: false, text: "Kapalı", isClosed: true };

    // Check for explicit "Kapalı" or "Closed"
    const lowerLine = todayLine.toLowerCase();
    if (lowerLine.includes("kapalı") || lowerLine.includes("closed")) {
      return { isOpen: false, text: "Bugün Kapalı", isClosed: true };
    }

    // Parse range "07:30 - 20:00" or "7:30 AM - 8:00 PM"
    const timePart = todayLine.split(": ").slice(1).join(": ").trim(); // Get everything after first colon
    if (!timePart) return { isOpen: false, text: "Saat Bilgisi Yok", isClosed: false };

    // Standardize split by "-" or "–" (en dash)
    const ranges = timePart.includes("–") ? timePart.split("–") : timePart.includes("-") ? timePart.split("-") : [];

    if (ranges.length < 2) return { isOpen: false, text: "Saat Formatı Hatalı", isClosed: false };

    const start = parseTime(ranges[0]);
    const end = parseTime(ranges[1]);

    if (!start || !end) return { isOpen: false, text: "Saat Parse Hatası" };

    if (now >= start && now <= end) {
      return { isOpen: true, text: "Şu An Açık" };
    } else {
      return { isOpen: false, text: "Şu An Kapalı" };
    }

  } catch (e) {
    console.error("Status checking error", e);
    return { isOpen: false, text: "Hata" };
  }
}

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = params.id as string;
  const initialTab = searchParams.get('tab') as 'overview' | 'orders' | 'products' | 'settings' || 'overview';

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
    "overview" | "orders" | "settings" | "products" | "reservations" | "dineIn" | "sponsored"
  >(initialTab);

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
    if (tab && ['overview', 'orders', 'products', 'settings', 'reservations'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [products, setProducts] = useState<any[]>([]);
  // 🆕 Dynamically loaded subscription plans from Firestore
  const [availablePlans, setAvailablePlans] = useState<{ code: string; name: string; color: string }[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productMode, setProductMode] = useState<'standard' | 'custom'>('standard');
  const [selectedMasterId, setSelectedMasterId] = useState("");
  // 🆕 Firestore'dan yüklenen master ürünler (allowedBusinessTypes ile filtrelenecek)
  const [firestoreMasterProducts, setFirestoreMasterProducts] = useState<MasterProduct[]>([]);
  const [customProductForm, setCustomProductForm] = useState({
    name: "",
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
    // 🆕 Masa Rezervasyonu
    hasReservation: false,   // Masa rezervasyonu aktif mi?
    tableCapacity: 0,        // Toplam oturma kapasitesi (kişi)
    maxReservationTables: 0, // Aynı anda rezerve edilebilecek max masa sayısı
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
        showToast('✅ Google\'dan bilgiler çekildi!', 'success');
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
          // 🆕 Masa Rezervasyonu
          hasReservation: d.hasReservation || false,
          tableCapacity: d.tableCapacity || 0,
          maxReservationTables: d.maxReservationTables || 0,
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
        displayName: doc.data().displayName || "İsimsiz",
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
      title: 'Ürün Sil',
      message: 'Bu ürünü silmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sil',
      confirmColor: 'bg-red-600 hover:bg-red-500',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
          await deleteDoc(doc(db, `businesses/${businessId}/products`, productId));
          showToast("Ürün silindi", "success");
          loadProducts();
        } catch (error) {
          console.error("Error deleting product:", error);
          showToast("Ürün silinirken hata oluştu", "error");
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
      showToast(currentStatus ? "Ürün pasif yapıldı" : "Ürün aktif yapıldı", "success");
      loadProducts();
    } catch (error) {
      console.error("Error toggling product:", error);
      showToast("Ürün durumu değiştirilirken hata oluştu", "error");
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
      showToast("Ürün eklendi!", "success");
      setProductModalOpen(false);
      setSelectedMasterId('');
      setCustomProductForm({ name: '', price: '', unit: 'kg', imageFile: null });
      loadProducts();
    } catch (error) {
      console.error("Error adding product:", error);
      showToast("Ürün eklenirken hata oluştu", "error");
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
      alert("Hata: Google Place ID boş.");
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
        throw new Error(data.error || "Sunucu hatası");
      }

      console.log("Server API Response:", data);

      let successMsg = "";
      let updates: any = {};

      // 1. OPENING HOURS
      if (data.openingHours) {
        let hoursList = Array.isArray(data.openingHours) ? data.openingHours : data.openingHours.split("\n");

        // --- STANDARDIZATION LOGIC (Mirroring Mobile App) ---
        const enToTr: Record<string, string> = {
          'Monday': 'Pazartesi', 'Tuesday': 'Salı', 'Wednesday': 'Çarşamba',
          'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar'
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
          cleanLine = cleanLine.replace(/Closed/gi, 'Kapalı');

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
        successMsg += "Fotoğraf";
        try {
          // Try to fetch blob for upload
          const response = await fetch(data.photoUrl);
          if (!response.ok) throw new Error("Image fetch failed");

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
        showToast(`Başarılı: ${successMsg}`, "success");
      } else {
        showToast("Veri bulundu ama eksik (Foto/Saat yok).", "error");
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
            showToast(`⚠️ Bu işletme zaten sistemde var: "${existingBusiness.companyName}"`, 'error');
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
            showToast(`⚠️ Bu adres zaten sistemde kayıtlı: "${existingBusiness.companyName}"`, 'error');
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
                showToast(`Yükleniyor: %${Math.round(progress)}`, "success");
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

        console.log("Image uploaded successfully:", downloadURL);
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
          street: formData.billingStreet || "",
          postalCode: formData.billingPostalCode || "",
          city: formData.billingCity || "",
          country: formData.billingCountry || "DE",
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
        showToast(`İşletme oluşturuldu (No: ${newNumber})`, "success");
        router.push(`/admin/business/${newDocRef.id}?tab=settings`);
      } else {
        await updateDoc(doc(db, "businesses", business!.id), updatedData);

        // Update local state completely
        const newButcherState = { ...business, ...updatedData } as ButcherPartner;
        setBusiness(newButcherState);
        setFormData((prev) => ({ ...prev, imageUrl: downloadURL })); // Crucial: Update formData with real URL

        setIsEditing(false);
        setImageFile(null); // Reset file
        showToast("Değişiklikler başarıyla kaydedildi!", "success");
      }
    } catch (error: any) {
      console.error("Save error:", error);
      const errorMessage = error?.message || "Bilinmeyen bir hata.";
      // Show toast
      showToast(`Hata: ${errorMessage}`, "error");

      // Show detailed alert if it looks like a storage issue
      if (
        errorMessage.includes("storage") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("permission")
      ) {
        alert(
          `Depolama Hatası: ${errorMessage}\n\nLütfen Firebase Konsolundan "Storage" bölümünün etkinleştirildiğinden ve kuralların doğru olduğundan emin olun.`,
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
      title: newStatus ? "✅ Hesabı Aktif Et" : "🔴 Hesabı Deaktif Et",
      message: `Bu kasabı ${action} yapmak istediğinize emin misiniz?`,
      confirmText: newStatus ? "Aktif Et" : "Deaktif Et",
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
          showToast(`Kasap ${action} yapıldı.`, "success");
        } catch (error) {
          console.error("Toggle error:", error);
          showToast("Hata oluştu!", "error");
        }
        setSaving(false);
        setConfirmModal({ ...confirmModal, show: false });
      },
    });
  };

  // Invite staff via WhatsApp
  const handleInviteStaff = async () => {
    if (!invitePhone || invitePhone.length < 10) {
      showToast("Geçerli bir telefon numarası girin", "error");
      return;
    }
    if (!inviteFirstName.trim()) {
      showToast("İsim gerekli", "error");
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
        throw new Error(data.error || 'Kullanıcı oluşturulamadı');
      }

      setInviteResult({
        success: true,
        tempPassword,
        notifications: data.notifications,
      });

      showToast(`${inviteFirstName} başarıyla eklendi!`, "success");
      setInvitePhone("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      loadStaff();
    } catch (error: any) {
      console.error("Invite error:", error);
      const msg = error?.message || 'Davet gönderilemedi';
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
        <p>İşletme bulunamadı</p>
        <Link
          href="/admin/business"
          className="text-blue-400 hover:underline mt-4"
        >
          ← İşletme Listesi
        </Link>
      </div>
    );
  }

  // Build dynamic planLabels from loaded plans
  const planLabels: Record<string, { label: string; color: string }> = { ...defaultPlanLabels };
  availablePlans.forEach(p => {
    planLabels[p.code] = { label: `LOKMA ${p.name}`, color: p.color || 'bg-gray-600' };
  });
  const planInfo = planLabels[business?.subscriptionPlan || "none"] || { label: business?.subscriptionPlan || 'Yok', color: 'bg-gray-600' };

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
                  {businessId === 'new' ? '🆕 Yeni İşletme Ekle' : (business?.companyName || 'İşletme Detayı')}
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
                <>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${planInfo.color} text-white`}
                  >
                    {planInfo.label}
                  </span>
                  {planFeatures.dineInQR && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-600 text-white">📱 QR</span>
                  )}
                  {planFeatures.waiterOrder && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-teal-600 text-white">👨‍🍳 Garson</span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${business?.isActive ? "bg-green-600" : "bg-red-600"} text-white`}
                  >
                    {business?.isActive ? "✓ Aktif" : "✗ Pasif"}
                  </span>
                  {/* 🆕 Geçici Kurye Kapatma Toggle */}
                  {formData.supportsDelivery && (
                    <button
                      onClick={async () => {
                        const newValue = !formData.temporaryDeliveryPaused;
                        try {
                          // Update main field
                          await updateDoc(doc(db, "businesses", businessId), {
                            temporaryDeliveryPaused: newValue,
                          });
                          // 🆕 Log the action
                          await addDoc(collection(db, "businesses", businessId, "deliveryPauseLogs"), {
                            action: newValue ? "paused" : "resumed",
                            timestamp: serverTimestamp(),
                            adminEmail: admin?.email || "unknown",
                            adminId: admin?.id || "unknown",
                          });
                          setFormData({ ...formData, temporaryDeliveryPaused: newValue });
                          showToast(newValue ? "🚫 Kurye hizmeti durduruldu (loglandı)" : "✅ Kurye hizmeti aktif", "success");
                        } catch (e) {
                          showToast("Hata oluştu", "error");
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition ${formData.temporaryDeliveryPaused
                        ? "bg-orange-600 hover:bg-orange-500 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                    >
                      {formData.temporaryDeliveryPaused ? "⏸️ Kurye Durduruldu" : "🚚 Kurye Aktif"}
                    </button>
                  )}
                  {/* 📊 Performans Sayfası Linki */}
                  <Link
                    href={`/admin/business/${businessId}/performance`}
                    className="px-3 py-1 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition"
                  >
                    📊 Performans
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Tabs + Quick Actions */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {/* Navigation Tabs */}
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "overview" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              📊 Genel Bakış
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "orders" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              📦 Siparişler ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "settings" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              ⚙️ Ayarlar
            </button>
            {formData.hasReservation && (
              <button
                onClick={() => setActiveTab("reservations")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "reservations" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
              >
                🍽️ Rezervasyonlar
              </button>
            )}
            {(planFeatures.dineInQR || planFeatures.waiterOrder) && (
              <button
                onClick={() => setActiveTab("dineIn")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "dineIn" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
              >
                🪑 Masada Sipariş
              </button>
            )}
            {sponsoredSettings.enabled && (
              <button
                onClick={() => setActiveTab("sponsored")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "sponsored" ? "bg-orange-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
              >
                ⭐ Öne Çıkan
              </button>
            )}

            {/* Separator */}
            <div className="w-px h-8 bg-gray-600 mx-2" />

            {/* Quick Action Chips */}
            <a
              href={`/admin/business/${businessId}/categories`}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-sm font-medium transition"
            >
              📁 Kategoriler
            </a>
            <a
              href={`/admin/business/${businessId}/products`}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm font-medium transition"
            >
              📦 Ürünler
            </a>
            <button
              onClick={() => setShowStaffModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium transition"
            >
              👷 Personel Yönetimi
            </button>
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
                  👥 Aktif Personel & Kuryeler
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
                    🏪 Mağaza Çalışanları
                  </h4>
                  <div className="space-y-2">
                    {staffList.filter((s) => s.isActive !== false).length ===
                      0 ? (
                      <p className="text-gray-500 text-sm">
                        Henüz aktif personel yok
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
                    🏍️ Kuryeler (Dağıtımda)
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
                            className="flex items-center justify-between bg-orange-600/20 border border-orange-600/30 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🏍️</span>
                              <div>
                                <span className="text-white text-sm">
                                  {(order as any).driverName || (order as any).claimedByName || `Kurye ${idx + 1}`}
                                </span>
                                <p className="text-orange-400 text-xs">
                                  #{order.orderNumber || order.id.slice(0, 6)} → {order.customerName || 'Müşteri'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2 py-0.5 rounded ${order.status === 'onTheWay' ? 'bg-orange-600/50 text-orange-300' : 'bg-green-600/50 text-green-300'}`}>
                                {order.status === 'onTheWay' ? '🚚 Yolda' : '📦 Hazır'}
                              </span>
                            </div>
                          </div>
                        ));
                      }
                      return (
                        <div className="text-center py-4">
                          <p className="text-gray-500 text-sm">
                            🏍️ Şu an dağıtımda kurye yok
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            Teslimat başladığında burada görünecek
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
                  📊 Sipariş Durumları (Anlık)
                </h3>
                <span className="text-gray-400 text-sm">
                  Şu anki siparişler
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
                    🔔 Bekleyen
                  </p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Hazırlanıyor */}
                <div className="flex-1 min-w-[100px] bg-blue-600/20 border border-blue-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-blue-400 text-3xl font-bold">
                    {orders.filter((o) => o.status === "preparing").length}
                  </p>
                  <p className="text-gray-400 text-sm">👨‍🍳 Hazırlanıyor</p>
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
                  <p className="text-gray-400 text-sm">🚚 Hazır/Yolda</p>
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
              <h3 className="text-white font-bold mb-4">💰 Gelir Özeti</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-green-400 text-2xl font-bold">
                    €
                    {orders
                      .reduce((sum, o) => sum + (o.totalPrice || 0), 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-gray-400 text-sm">Toplam Ciro</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-blue-400 text-2xl font-bold">
                    {orders.length}
                  </p>
                  <p className="text-gray-400 text-sm">Toplam Sipariş</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-purple-400 text-2xl font-bold">
                    €
                    {orders.length > 0
                      ? (
                        orders.reduce(
                          (sum, o) => sum + (o.totalPrice || 0),
                          0,
                        ) / orders.length
                      ).toFixed(2)
                      : "0"}
                  </p>
                  <p className="text-gray-400 text-sm">Ortalama Sipariş</p>
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
                  📞 İletişim Bilgileri
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Yetkili Kişi</p>
                      <p className="text-white font-medium">
                        {business?.contactPerson?.name
                          ? `${business?.contactPerson?.name} ${business?.contactPerson?.surname || ""}`
                          : "Belirtilmemiş"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {business?.contactPerson?.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">İletişim</p>
                      <p className="text-white">
                        {business?.contactPerson?.phone ||
                          business?.shopPhone ||
                          "Belirtilmemiş"}
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
                      <p className="text-gray-400 text-sm">Çalışma Saatleri</p>
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
                          Bilgi yok
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
                  💳 Üyelik & Abonelik
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
                          ? `€${business?.monthlyFee}/ay`
                          : "Ücretsiz"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Durum</p>
                      <span
                        className={`inline-block mt-1 px-2 py-1 rounded text-xs ${business?.isActive ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}
                      >
                        {business?.isActive ? "Aktif Müşteri" : "Pasif Müşteri"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-700 pt-3">
                    <div>
                      <p className="text-gray-400 text-sm">Müşteri Tarihi</p>
                      <p className="text-white">
                        {(business as any).createdAt?.toDate
                          ? (business as any).createdAt
                            .toDate()
                            .toLocaleDateString("tr-TR")
                          : "Belirtilmemiş"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Plan Başlangıç</p>
                      <p className="text-white">
                        {(business?.subscriptionStartDate as any)?.toDate
                          ? (business?.subscriptionStartDate as any)
                            .toDate()
                            .toLocaleDateString("tr-TR")
                          : business?.subscriptionStartDate
                            ? new Date(
                              business?.subscriptionStartDate,
                            ).toLocaleDateString("tr-TR")
                            : "Belirtilmemiş"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-white font-bold text-xl">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).emoji} Ürün Kataloğu</h3>
                <p className="text-gray-400 text-sm">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).label} işletmenizde sergilenen ürünler</p>
              </div>
              <button
                onClick={() => {
                  setProductModalOpen(true);
                  setProductMode('standard');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 flex items-center gap-2"
              >
                <span className="text-lg">+</span> Ürün Ekle
              </button>
            </div>

            {/* Product List */}
            {products.length === 0 ? (
              <div className="py-12 text-center text-gray-500 border border-dashed border-gray-700 rounded-xl">
                <p className="text-4xl mb-2">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).emoji}</p>
                <p>Henüz ürün eklenmemiş.</p>
                <button
                  onClick={() => setProductModalOpen(true)}
                  className="mt-4 text-blue-400 hover:underline"
                >
                  İlk ürününü ekle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((prod) => (
                  <div key={prod.id} className="bg-gray-700/30 border border-gray-700 rounded-lg p-3 flex gap-3 relative group">
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-800 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {prod.isCustom && prod.imageUrl ? (
                        <img src={prod.imageUrl} className="w-full h-full object-cover" alt={prod.name} />
                      ) : (
                        // For standard products, show placeholder or name initial
                        <div className="text-2xl">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).emoji}</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="text-white font-medium truncate pr-6">{prod.name}</h4>
                      </div>
                      <p className="text-blue-400 font-bold mt-1">
                        €{prod.price} <span className="text-xs text-gray-500">/ {prod.unit}</span>
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${prod.isActive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                          {prod.isActive ? "Aktif" : "Pasif"}
                        </span>
                        {prod.isCustom && (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${prod.approvalStatus === 'approved' ? "bg-blue-900/50 text-blue-400" : "bg-yellow-900/50 text-yellow-400"}`}>
                            {prod.approvalStatus === 'approved' ? 'Onaylı' : 'Bekliyor'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="w-6 h-6 bg-red-600/20 text-red-400 rounded flex items-center justify-center hover:bg-red-600 hover:text-white"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => toggleProductActive(prod.id, prod.isActive)}
                        className="w-6 h-6 bg-gray-600/20 text-gray-400 rounded flex items-center justify-center hover:bg-white hover:text-black"
                      >
                        👁️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD PRODUCT MODAL */}
        {productModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden border border-gray-700">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-white font-bold">Ürün Ekle</h3>
                <button onClick={() => setProductModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setProductMode('standard')}
                  className={`flex-1 py-3 text-sm font-medium ${productMode === 'standard' ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-750"}`}
                >
                  🚀 Hızlı Seç (Standart)
                </button>
                <button
                  onClick={() => setProductMode('custom')}
                  className={`flex-1 py-3 text-sm font-medium ${productMode === 'custom' ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-750"}`}
                >
                  ✨ Özel Ürün (Talep)
                </button>
              </div>

              <div className="p-6">
                {productMode === 'standard' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Ürün Seçin</label>
                      <select
                        value={selectedMasterId}
                        onChange={(e) => {
                          setSelectedMasterId(e.target.value);
                        }}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      >
                        <option value="">Seçiniz...</option>
                        {/* 🆕 Firestore'dan filtrelenmiş ürünler, fallback hardcoded */}
                        {(firestoreMasterProducts.length > 0 ? firestoreMasterProducts : MASTER_PRODUCTS).map(mp => (
                          <option key={mp.id} value={mp.id}>
                            {mp.name} ({mp.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedMasterId && (
                      <div className="bg-blue-900/20 text-blue-300 p-3 rounded-lg text-sm">
                        <p>{(firestoreMasterProducts.length > 0 ? firestoreMasterProducts : MASTER_PRODUCTS).find(p => p.id === selectedMasterId)?.description}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Satış Fiyatı (€)</label>
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
                      <label className="text-gray-400 text-sm block mb-1">Ürün Adı</label>
                      <input
                        type="text"
                        value={customProductForm.name}
                        onChange={(e) => setCustomProductForm({ ...customProductForm, name: e.target.value })}
                        placeholder="Örn: Özel Marine Köfte"
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
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
                          <option value="ad">Adet</option>
                          <option value="pk">Paket</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Fotoğraf</label>
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
                      ⚠️ Özel ürünler admin onayından sonra yayına girer.
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-750 flex justify-end gap-3">
                <button
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddProduct}
                  disabled={addingProduct}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                >
                  {addingProduct ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-white font-bold">Son Siparişler</h3>
              <Link
                href={`/admin/butchers/${business?.id}/orders`}
                className="text-blue-400 hover:underline text-sm"
              >
                Tümünü Gör →
              </Link>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-4">📦</p>
                <p>Henüz sipariş yok</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-750 text-gray-400 text-sm">
                  <tr>
                    <th className="px-4 py-3">Sipariş No</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Tutar</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Tarih</th>
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
                        €{(order.totalPrice || 0).toFixed(2)}
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
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold text-xl">
                ⚙️ {getBusinessTypeLabel(formData.types?.length > 0 ? formData.types : (business as any)?.types || (business as any)?.type).label} Ayarları
              </h3>
              <div className="flex items-center gap-3">
                {/* Active/Deactive Toggle */}
                {business && (
                  <button
                    onClick={toggleActiveStatus}
                    className={`px-4 py-2 rounded-lg text-white font-medium ${business.isActive ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"}`}
                  >
                    {business.isActive ? "🔴 Deaktif Et" : "🟢 Aktif Et"}
                  </button>
                )}
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                  >
                    ✏️ Düzenle
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                    >
                      İptal
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

            <div className="grid md:grid-cols-2 gap-6">
              {/* Company Info */}
              <div className="space-y-4">
                <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                  🖼️ Görsel & Google (v2.0)
                </h4>

                {/* Image Upload & Google Fetch */}
                <div>
                  <label className="text-gray-400 text-sm block mb-1">
                    {getBusinessTypeLabel((business as any)?.types || (business as any)?.type).label} Görseli
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center border border-gray-600 shrink-0 relative">
                      {formData.imageUrl ? (
                        <img
                          src={formData.imageUrl}
                          alt="Butcher"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).emoji}</span>
                      )}
                    </div>

                    {isEditing && (
                      <div className="flex flex-col gap-2 w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="block w-full text-sm text-gray-400
                                                        file:mr-4 file:py-2 file:px-4
                                                        file:rounded-full file:border-0
                                                        file:text-sm file:font-semibold
                                                        file:bg-blue-600 file:text-white
                                                        hover:file:bg-blue-500
                                                        cursor-pointer"
                        />
                        <div className="flex items-center gap-2 my-1">
                          <span className="text-gray-600 text-xs">
                            - VEYA -
                          </span>
                        </div>

                        <button
                          onClick={fetchGoogleData}
                          disabled={!formData.googlePlaceId || uploading}
                          className="flex items-center justify-center px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >
                          {uploading && !imageFile ? (
                            <span className="animate-spin mr-2">⏳</span>
                          ) : (
                            <span className="mr-2">🪄</span>
                          )}
                          Google'dan Bilgileri Doldur (Server)
                        </button>
                        {!formData.googlePlaceId && (
                          <p className="text-xs text-red-400">
                            Google ID gerekli
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Place ID with Live Search */}
                <div className="relative">
                  <label className="text-gray-400 text-sm">
                    Google Place ID (Değerlendirmeler için)
                  </label>

                  {/* Search Input */}
                  {isEditing && (
                    <div className="flex gap-2 mt-1 mb-2">
                      <input
                        type="text"
                        value={googleSearchQuery}
                        onChange={(e) => setGoogleSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGooglePlacesSearch()}
                        placeholder="İşletme adı veya adresi ara..."
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleGooglePlacesSearch()}
                        disabled={googleSearchLoading || googleSearchQuery.length < 3}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {googleSearchLoading ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <span>🔍</span>
                        )}
                        Ara
                      </button>
                    </div>
                  )}

                  {/* Search Results Dropdown */}
                  {showGoogleDropdown && googleSearchResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {googleSearchResults.map((place, index) => (
                        <button
                          key={place.place_id || index}
                          type="button"
                          onClick={() => handleSelectGooglePlace(place)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700 last:border-0 transition"
                        >
                          <p className="text-white font-medium">{place.name}</p>
                          <p className="text-gray-400 text-sm">{place.formatted_address}</p>
                          {place.rating && (
                            <p className="text-yellow-400 text-xs mt-1">⭐ {place.rating} ({place.user_ratings_total || 0} değerlendirme)</p>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => { setShowGoogleDropdown(false); setGoogleSearchResults([]); }}
                        className="w-full px-4 py-2 bg-gray-700 text-gray-400 hover:text-white text-sm"
                      >
                        ✕ Kapat
                      </button>
                    </div>
                  )}

                  {/* Current Place ID (readonly display) */}
                  <input
                    type="text"
                    value={formData.googlePlaceId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        googlePlaceId: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    placeholder="ChIJ... (yukarıdan arayarak seçin)"
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 font-mono text-sm"
                  />
                  {formData.googlePlaceId && (
                    <p className="text-xs text-green-400 mt-1">
                      ✅ Google Place ID set
                    </p>
                  )}
                </div>

                <h4 className="text-white font-medium border-b border-gray-700 pb-2 pt-4">
                  🏪 Şirket Bilgileri
                </h4>
                <div>
                  <label className="text-gray-400 text-sm">Şirket Adı</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    disabled={!isEditing}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                  />
                </div>

                {/* 🆕 Mutfak Türü / Alt Başlık (Lieferando-style) */}
                <div>
                  <label className="text-gray-400 text-sm">Mutfak Türü / Alt Başlık</label>
                  <input
                    type="text"
                    value={formData.cuisineType}
                    onChange={(e) =>
                      setFormData({ ...formData, cuisineType: e.target.value })
                    }
                    disabled={!isEditing}
                    placeholder="Örn: Kebap, Döner, Türkisch"
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📝 Kartlarda işletme adı altında gösterilir
                  </p>
                </div>

                {/* 🆕 İşletme Logosu (Kare) */}
                <div>
                  <label className="text-gray-400 text-sm">İşletme Logosu (Kare)</label>
                  <div className="flex items-center gap-4 mt-2">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo"
                        className="w-16 h-16 rounded-lg object-cover border border-gray-600"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-700 border border-dashed border-gray-500 flex items-center justify-center text-gray-500 text-2xl">
                        🏪
                      </div>
                    )}
                    {isEditing && (
                      <div className="flex flex-col gap-2">
                        <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm">
                          📤 Logo Yükle
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                // Upload to Firebase Storage
                                const logoRef = ref(storage, `business_logos/${businessId}/logo_${Date.now()}.jpg`);
                                const uploadTask = uploadBytesResumable(logoRef, file);
                                uploadTask.on('state_changed',
                                  () => { },
                                  (error) => {
                                    console.error('Logo upload error:', error);
                                    showToast('Logo yüklenirken hata oluştu', 'error');
                                  },
                                  async () => {
                                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                                    setFormData({ ...formData, logoUrl: url });
                                    showToast('✅ Logo yüklendi!', 'success');
                                  }
                                );
                              }
                            }}
                          />
                        </label>
                        {formData.logoUrl && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, logoUrl: '' })}
                            className="text-red-400 text-xs hover:text-red-300"
                          >
                            🗑️ Logoyu Kaldır
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    📐 Önerilen boyut: 64x64 piksel (kare)
                  </p>
                </div>

                {/* 🆕 İşletme Türleri - Multi-Select (Firestore'dan dinamik) */}
                <div>
                  <label className="text-gray-400 text-sm block mb-2">İşletme Türleri</label>
                  <div className="flex flex-wrap gap-2">
                    {dynamicSectorTypes.map((sector) => {
                      const isSelected = formData.types?.includes(sector.id);
                      return (
                        <button
                          key={sector.id}
                          type="button"
                          onClick={() => {
                            if (!isEditing) return;
                            const newTypes = isSelected
                              ? formData.types.filter(t => t !== sector.id)
                              : [...(formData.types || []), sector.id];
                            setFormData({ ...formData, types: newTypes });
                          }}
                          disabled={!isEditing}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isSelected
                            ? 'bg-blue-600 text-white ring-2 ring-white/50'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            } ${!isEditing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span>{sector.icon}</span>
                          <span>{sector.label}</span>
                          {isSelected && <span className="text-white/80">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  {formData.types?.length > 0 && (
                    <p className="text-xs text-green-400 mt-2">
                      {formData.types.length} modül aktif • Her modül ayrı ücretlendirilir
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Müşteri No</label>
                  <input
                    type="text"
                    value={formData.customerId}
                    readOnly
                    disabled={true}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 opacity-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">🔒 Müşteri No değiştirilemez</p>
                </div>
                {/* Vergi UID Nummer (VAT) */}
                <div>
                  <label className="text-gray-400 text-sm">🇪🇺 Vergi UID Nummer (VAT)</label>
                  <input
                    type="text"
                    value={formData.vatNumber || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vatNumber: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    placeholder="DE123456789"
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">Avrupa Birliği vergi numarası (örn: DE123456789)</p>
                </div>
                {/* LOKMA Label - Sadece Super Admin görebilir ve değiştirebilir */}
                {admin?.adminType === 'super' && (
                  <div>
                    <label className="text-gray-400 text-sm">🏷️ LOKMA Label <span className="text-xs text-purple-400">(Super Admin)</span></label>
                    <select
                      value={formData.brand || ''}
                      onChange={(e) => {
                        const val = e.target.value as
                          | "tuna"
                          | "akdeniz_toros"
                          | "";
                        setFormData({
                          ...formData,
                          brand: val as any,
                          brandLabelActive: val !== "",
                        });
                      }}
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    >
                      <option value="">- Seçilmedi -</option>
                      <option value="tuna">🔴 TUNA</option>
                      <option value="akdeniz_toros">⚫ Akdeniz Toros</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">🔒 Bu ayar sadece Super Admin tarafından değiştirilebilir</p>
                  </div>
                )}

                {/* 🔴 Satılan Ürün Markaları - Filtreleme için */}
                {admin?.adminType === 'super' && (
                  <div className="mt-4">
                    <label className="text-gray-400 text-sm">🛒 Satılan Ürün Markaları <span className="text-xs text-blue-400">(Filtreleme için)</span></label>
                    <p className="text-xs text-gray-500 mb-2">Bu işletme hangi markaların ürünlerini satıyor?</p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {/* TUNA Ürünleri Checkbox */}
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${formData.sellsTunaProducts
                        ? 'bg-red-600/30 border-2 border-red-500 text-red-300'
                        : 'bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-600'
                        } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formData.sellsTunaProducts}
                          onChange={(e) => setFormData({ ...formData, sellsTunaProducts: e.target.checked })}
                          disabled={!isEditing}
                          className="w-4 h-4 accent-red-500"
                        />
                        <span className="text-lg">🔴</span>
                        <span className="font-medium">TUNA Ürünleri</span>
                      </label>

                      {/* Akdeniz Toros Ürünleri Checkbox */}
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${formData.sellsTorosProducts
                        ? 'bg-green-600/30 border-2 border-green-500 text-green-300'
                        : 'bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-600'
                        } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formData.sellsTorosProducts}
                          onChange={(e) => setFormData({ ...formData, sellsTorosProducts: e.target.checked })}
                          disabled={!isEditing}
                          className="w-4 h-4 accent-green-500"
                        />
                        <span className="text-lg">🟢</span>
                        <span className="font-medium">Akdeniz Toros Ürünleri</span>
                      </label>
                    </div>
                    {(formData.sellsTunaProducts || formData.sellsTorosProducts) && (
                      <p className="text-xs text-green-400 mt-2">
                        ✓ Seçilen markalar mobil uygulamada filtreleme için kullanılacak
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <label className="text-gray-400 text-sm block mb-1">
                  Çalışma Saatleri
                </label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      {[
                        { tr: "Pazartesi", en: "Monday" },
                        { tr: "Salı", en: "Tuesday" },
                        { tr: "Çarşamba", en: "Wednesday" },
                        { tr: "Perşembe", en: "Thursday" },
                        { tr: "Cuma", en: "Friday" },
                        { tr: "Cumartesi", en: "Saturday" },
                        { tr: "Pazar", en: "Sunday" },
                      ].map((dayObj) => {
                        // Extract time parts safely
                        // Expected format (internal): "Pazartesi: 08:00 - 18:00" OR "Pazartesi: Kapalı"
                        // Also handles Google format: "Monday: 8:00 AM – 6:00 PM"

                        const currentLine =
                          formData.openingHours
                            ?.split("\n")
                            .find(
                              (l) => {
                                // Strict match to support Pazar vs Pazartesi distinction
                                return l.startsWith(dayObj.tr + ":") || l.startsWith(dayObj.tr + " ") ||
                                  l.startsWith(dayObj.en + ":") || l.startsWith(dayObj.en + " ");
                              }
                            ) || "";

                        const isClosed = currentLine.toLowerCase().includes("kapalı") || currentLine.toLowerCase().includes("closed");

                        let startTime = "";
                        let endTime = "";

                        if (!isClosed && currentLine.includes(": ")) {
                          const timePart = currentLine.split(": ").slice(1).join(": ").trim();
                          // Handle en dash or hyphen
                          const separator = timePart.includes("–") ? "–" : "-";
                          const parts = timePart.split(separator).map(p => p.trim());

                          if (parts.length >= 2) {
                            // Convert to 24h format for display in input
                            const start24 = formatTo24h(parts[0]);
                            const end24 = formatTo24h(parts[1]);
                            startTime = start24;
                            endTime = end24;
                          }
                        }

                        // Helper to update specific day's hours
                        const updateHours = (newStart: string, newEnd: string, newClosed: boolean) => {
                          const newLines = [
                            "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
                          ].map((d) => {
                            // Find label for this day
                            const dObj = [
                              { tr: "Pazartesi", en: "Monday" },
                              { tr: "Salı", en: "Tuesday" },
                              { tr: "Çarşamba", en: "Wednesday" },
                              { tr: "Perşembe", en: "Thursday" },
                              { tr: "Cuma", en: "Friday" },
                              { tr: "Cumartesi", en: "Saturday" },
                              { tr: "Pazar", en: "Sunday" },
                            ].find((o) => o.tr === d);

                            const existingLine = formData.openingHours?.split("\n").find(
                              (l) => {
                                // Strict match: "Day:" or "Day " to avoid "Pazar" matching "Pazartesi"
                                const dayTR = dObj!.tr;
                                const dayEN = dObj!.en;
                                return l.startsWith(dayTR + ":") || l.startsWith(dayTR + " ") ||
                                  l.startsWith(dayEN + ":") || l.startsWith(dayEN + " ");
                              }
                            ) || "";

                            // If this is the day being updated
                            if (d === dayObj.tr) {
                              if (newClosed) return `${d}: Kapalı`;
                              return `${d}: ${newStart} - ${newEnd}`;
                            }

                            // Otherwise preserve existing logic (convert English to Turkish label if needed)
                            // If existing was English/Google format, we might want to normalize it too, but for now just keep as is or simple process
                            if (existingLine.startsWith(dObj!.en)) {
                              // It's in English (e.g. "Monday: ..."), convert label to Turkish
                              // Also we should ideally normalize the time to 24h here too if we want full consistency
                              const content = existingLine.split(": ").slice(1).join(": ");
                              return `${d}: ${content}`;
                            }

                            // Use existing line or default to closed if missing
                            return existingLine || `${d}: Kapalı`;
                          });

                          setFormData({
                            ...formData,
                            openingHours: newLines.join("\n"),
                          });
                        };

                        return (
                          <div
                            key={dayObj.tr}
                            className="flex items-center gap-3"
                          >
                            <span className="w-20 text-sm text-gray-400 font-medium">
                              {dayObj.tr}
                            </span>

                            {/* Start Time Input */}
                            <input
                              type="time"
                              value={formatTo24h(startTime)}
                              disabled={isClosed}
                              onChange={(e) => updateHours(e.target.value, endTime, false)}
                              className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                            />

                            <span className="text-gray-500 font-bold">-</span>

                            {/* End Time Input */}
                            <input
                              type="time"
                              value={formatTo24h(endTime)}
                              disabled={isClosed}
                              onChange={(e) => updateHours(startTime, e.target.value, false)}
                              className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                            />

                            {/* Closed Checkbox */}
                            <label className="flex items-center cursor-pointer ml-auto">
                              <input
                                type="checkbox"
                                checked={isClosed}
                                onChange={(e) => updateHours(startTime, endTime, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                              <span className="ml-2 text-xs text-gray-400 font-medium w-10">{isClosed ? "Kapalı" : "Açık"}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : formData.openingHours ? (
                    <ul className="space-y-1">
                      {formData.openingHours.split("\n").map((line, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-300 flex justify-between border-b border-gray-700/50 pb-1 last:border-0"
                        >
                          <span className="font-medium text-gray-400 w-24">
                            {line.split(": ")[0]}
                          </span>
                          <span className="font-mono">
                            {(() => {
                              const parts = line.split(": ");
                              const content = parts.length > 1 ? parts.slice(1).join(": ").trim() : "";
                              // Check for kapali or empty
                              if (content.toLowerCase().includes("kapalı") || content.toLowerCase().includes("closed")) return "Kapalı";
                              if (!content || content === "-" || content === "–") return "-";
                              return content;
                            })()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-gray-500 italic">
                      Bilgi yok
                    </span>
                  )}
                </div>
              </div>


              {/* LOKMA Contact Person (New Section inside Company Info block) */}
              <div className="pt-4 mt-2 border-t border-gray-700">
                <h4 className="text-blue-400 font-medium text-sm mb-3">
                  👤 LOKMA Yetkili İrtibat Kişisi
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Adı
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactName: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Soyadı
                    </label>
                    <input
                      type="text"
                      value={formData.contactSurname}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactSurname: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Kişisel Tel
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPhone: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Kişisel Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactEmail: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div >

            <div className="space-y-6">
              <div className="space-y-6">
                {/* Address Info & Google Data */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    📍 Adres & Google
                  </h4>
                  <div>
                    <label className="text-gray-400 text-sm">Sokak/Cadde</label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) =>
                        setFormData({ ...formData, street: e.target.value })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-400 text-sm">
                        Posta Kodu
                      </label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            postalCode: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Şehir</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        disabled={!isEditing}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Google Place ID & Hours */}
                  <div className="pt-2">
                    <label className="text-gray-400 text-xs block mb-1">
                      Google Place ID
                    </label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={formData.googlePlaceId || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            googlePlaceId: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        placeholder="ChIJ..."
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      />
                      {isEditing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            fetchGoogleData();
                          }}
                          disabled={uploading || !formData.googlePlaceId}
                          className="px-3 py-1.5 bg-blue-600/30 text-blue-300 text-xs rounded border border-blue-500/50 hover:bg-blue-600/50 transition-colors"
                        >
                          {uploading ? "..." : "Getir"}
                        </button>
                      )}
                    </div>


                  </div>
                </div>

                {/* Delivery Settings */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    🚚 Teslimat Ayarları
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
                    <span className="text-white">Kurye Desteği Var</span>
                  </div>
                  {formData.supportsDelivery && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-400 text-sm">
                          Min. Sipariş (€)
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
                          Teslimat Ücreti (€)
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
                    </div>
                  )}

                  {/* 🆕 Gelişmiş Sipariş Saatleri (Lieferando benzeri) */}
                  <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h5 className="text-white font-medium mb-3 flex items-center gap-2">
                      ⏰ Gelişmiş Sipariş Saatleri
                      <span className="text-xs text-gray-500">(Opsiyonel)</span>
                    </h5>
                    <p className="text-xs text-gray-400 mb-3">
                      İşletme açık olsa bile kurye/gel al hizmetinin başlama saatini belirleyebilirsiniz.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Kurye Başlangıç Saati */}
                      <div>
                        <label className="text-gray-400 text-sm flex items-center gap-1">
                          🚚 Kurye Başlangıç
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
                          placeholder="ör: 14:00"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Boş = açılış saati
                        </p>
                      </div>

                      {/* Kurye Bitiş Saati */}
                      <div>
                        <label className="text-gray-400 text-sm flex items-center gap-1">
                          🚚 Kurye Bitiş
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
                          placeholder="ör: 20:00"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Boş = kapanış saati
                        </p>
                      </div>

                      {/* Gel Al Başlangıç Saati */}
                      <div>
                        <label className="text-gray-400 text-sm flex items-center gap-1">
                          🏃 Gel Al Başlangıç
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
                          placeholder="ör: 12:00"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Boş = açılış saati
                        </p>
                      </div>

                      {/* Gel Al Bitiş Saati */}
                      <div>
                        <label className="text-gray-400 text-sm flex items-center gap-1">
                          🏃 Gel Al Bitiş
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
                          placeholder="ör: 21:00"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Boş = kapanış saati
                        </p>
                      </div>
                    </div>

                    {/* Ücretsiz Teslimat Eşiği */}
                    <div className="mt-3">
                      <label className="text-gray-400 text-sm flex items-center gap-1">
                        🎁 Ücretsiz Teslimat Eşiği (€)
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
                        <span className="text-gray-400 text-sm">€ üzeri siparişlerde teslimat ücretsiz</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        0 = her zaman teslimat ücreti uygulanır
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
                        className="w-5 h-5 accent-orange-500"
                      />
                      <div>
                        <span className="text-white">📅 Ön Sipariş Kabul Et</span>
                        <p className="text-xs text-gray-400">
                          İşletme kapalıyken de ertesi gün için sipariş alabilir
                        </p>
                      </div>
                    </div>

                    {/* Bilgi mesajı */}
                    {(formData.deliveryStartTime || formData.pickupStartTime) && (
                      <div className="mt-2 p-2 bg-blue-900/30 rounded border border-blue-700">
                        <p className="text-xs text-blue-300">
                          ℹ️ Mobil uygulamada işletme kartında &quot;Teslimat {formData.deliveryStartTime || "..."}&apos;ten sonra&quot; /
                          &quot;Gel Al {formData.pickupStartTime || "..."}&apos;dan itibaren&quot; şeklinde badge gösterilecek.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

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
                      className="w-5 h-5 accent-orange-500"
                    />
                    <div>
                      <span className="text-white">Masa Rezervasyonu Aktif</span>
                      <p className="text-xs text-gray-400">
                        Müşteriler mobil uygulamadan masa rezervasyonu yapabilir
                      </p>
                    </div>
                  </div>
                  {formData.hasReservation && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-400 text-sm">
                          Oturma Kapasitesi (Kişi)
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
                          placeholder="ör: 50"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Toplam oturma kapasitesi (kişi)
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
                          placeholder="ör: 10"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Aynı saat diliminde max rezervasyon
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 🍽️ Yerinde Sipariş Ayarları */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    🍽️ Yerinde Sipariş Ayarları
                  </h4>

                  {/* Ödeme Zamanlaması */}
                  <div>
                    <label className="text-gray-400 text-sm block mb-2">Ödeme Zamanlaması</label>
                    <div className="flex gap-3">
                      <label className={`flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer border transition ${formData.dineInPaymentMode === 'payFirst'
                        ? 'bg-orange-600/20 border-orange-500 text-orange-300'
                        : 'bg-gray-700 border-gray-600 text-gray-300'
                        } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          name="dineInPaymentMode"
                          value="payFirst"
                          checked={formData.dineInPaymentMode === 'payFirst'}
                          onChange={(e) => setFormData({ ...formData, dineInPaymentMode: e.target.value })}
                          disabled={!isEditing}
                          className="accent-orange-500"
                        />
                        <div>
                          <span className="font-medium">🍔 Hemen Öde</span>
                          <p className="text-xs text-gray-400">Fast food — sipariş öncesi ödeme zorunlu</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer border transition ${formData.dineInPaymentMode === 'payLater'
                        ? 'bg-orange-600/20 border-orange-500 text-orange-300'
                        : 'bg-gray-700 border-gray-600 text-gray-300'
                        } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          name="dineInPaymentMode"
                          value="payLater"
                          checked={formData.dineInPaymentMode === 'payLater'}
                          onChange={(e) => setFormData({ ...formData, dineInPaymentMode: e.target.value })}
                          disabled={!isEditing}
                          className="accent-orange-500"
                        />
                        <div>
                          <span className="font-medium">🍽️ Çıkışta Öde</span>
                          <p className="text-xs text-gray-400">Restoran — masada hesap isteme</p>
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
                      className="w-5 h-5 accent-orange-500"
                    />
                    <div>
                      <span className="text-white">Garson Servisi Aktif</span>
                      <p className="text-xs text-gray-400">
                        {formData.hasTableService
                          ? '✅ Sipariş hazır olunca müşteriye "Siparişiniz masanıza geliyor" bildirimi gider'
                          : '📱 Sipariş hazır olunca müşteriye "Gelip alabilirsiniz" bildirimi gider (self-service)'}
                      </p>
                    </div>
                  </div>
                </div>

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
                      <option value="none">Yok</option>
                      {availablePlans.map(plan => (
                        <option key={plan.code} value={plan.code}>{plan.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">
                      Aylık Ücret (€)
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

                {/* Bank Details (SEPA) */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    🏦 Banka Bilgileri (SEPA)
                  </h4>
                  <div>
                    <label className="text-gray-400 text-sm">
                      Hesap Sahibi
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
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Banka Adı</label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="Örn: Sparkasse"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-400 text-sm">IBAN</label>
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
                      <label className="text-gray-400 text-sm">BIC</label>
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

                {/* Reviews Section */}
                {formData.reviews && formData.reviews.length > 0 && (
                  <div className="pt-6 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <h3 className="font-semibold text-gray-200">
                          Google Yorumları
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

                {/* Subscription History */}
                {business && business.subscriptionHistory && business.subscriptionHistory.length > 0 && (
                  <div className="pt-6 border-t border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-gray-200">Abonelik Geçmişi</h3>
                    </div>
                    <div className="overflow-x-auto bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-gray-500 bg-gray-900/50 uppercase">
                          <tr>
                            <th className="px-4 py-2">Plan</th>
                            <th className="px-4 py-2">Başlangıç</th>
                            <th className="px-4 py-2">Bitiş</th>
                            <th className="px-4 py-2">Değiştiren</th>
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
          </div >
        )
        }


        {/* Staff Management Modal */}
        {
          showStaffModal && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      👷 Personel Yönetimi
                    </h2>
                    <p className="text-gray-400 text-sm">{business?.companyName}</p>
                  </div>
                  <button
                    onClick={() => setShowStaffModal(false)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Aktif / Arşivlenmiş Tabs */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setStaffStatusFilter('active')}
                      className={`px-4 py-2 rounded-lg font-medium transition ${staffStatusFilter === 'active'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                    >
                      ✅ Aktif ({staffList.filter(s => s.isActive !== false).length})
                    </button>
                    <button
                      onClick={() => setStaffStatusFilter('archived')}
                      className={`px-4 py-2 rounded-lg font-medium transition ${staffStatusFilter === 'archived'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                    >
                      📦 Arşivlenmiş ({staffList.filter(s => s.isActive === false).length})
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                      type="text"
                      placeholder="İsim, e-posta veya telefon ile ara..."
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
                        <p>Henüz personel yok</p>
                      </div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-gray-400 border-b border-gray-700">
                          <tr>
                            <th className="pb-3 py-2">Kullanıcı</th>
                            <th className="pb-3 py-2">Rol</th>
                            <th className="pb-3 py-2">Durum</th>
                            <th className="pb-3 py-2">İşlemler</th>
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
                                  <p>{staffStatusFilter === 'archived' ? 'Arşivlenmiş personel bulunamadı' : 'Personel bulunamadı'}</p>
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
                                  {staff.isActive !== false ? 'Aktif' : 'Pasif'}
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
                                        title: isActive ? 'Personel Arşivle' : 'Personel Aktifleştir',
                                        message: isActive
                                          ? `${staff.displayName} adlı personeli arşivlemek istediğinize emin misiniz?`
                                          : `${staff.displayName} adlı personeli tekrar aktifleştirmek istediğinize emin misiniz?`,
                                        confirmText: isActive ? 'Evet, Arşivle' : 'Evet, Aktifleştir',
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
                                                deactivationReason: 'İşletme panelinden arşivlendi',
                                              });
                                              showToast(`${staff.displayName} arşivlendi`, 'success');
                                            } else {
                                              await updateDoc(adminRef, {
                                                isActive: true,
                                                deactivatedAt: null,
                                                deactivationReason: null,
                                              });
                                              showToast(`${staff.displayName} tekrar aktifleştirildi`, 'success');
                                            }
                                            loadStaff();
                                          } catch (error) {
                                            console.error('Archive error:', error);
                                            showToast('İşlem başarısız', 'error');
                                          }
                                        },
                                      });
                                    }}
                                    className={`text-xs px-2 py-1 rounded ${staff.isActive !== false
                                      ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white'
                                      : 'bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white'}`}
                                  >
                                    {staff.isActive !== false ? '📦 Arşivle' : '✅ Aktifleştir'}
                                  </button>
                                  {/* Yetkiyi Kaldır */}
                                  <button
                                    onClick={() => {
                                      setConfirmModal({
                                        show: true,
                                        title: 'Yetkiyi Kaldır',
                                        message: `${staff.displayName} adlı personelin yetkisini kaldırmak istediğinize emin misiniz?`,
                                        confirmText: 'Evet, Kaldır',
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
                                              deactivationReason: 'Yetki kaldırıldı',
                                            });
                                            showToast(`${staff.displayName} yetkisi kaldırıldı`, 'success');
                                            loadStaff();
                                          } catch (error) {
                                            console.error('Remove permission error:', error);
                                            showToast('İşlem başarısız', 'error');
                                          }
                                        },
                                      });
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white"
                                  >
                                    🔓 Yetkiyi Kaldır
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
                  <div>
                    <h3 className="text-white font-medium mb-3">
                      ➕ Yeni Personel Ekle
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="İsim *"
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
                        placeholder="Telefon numarası *"
                        value={invitePhone}
                        onChange={(e) =>
                          setInvitePhone(e.target.value.replace(/\D/g, ""))
                        }
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="E-posta (opsiyonel, bildirim için)"
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
                        <option value="Admin">👑 İşletme Admin</option>
                      </select>
                    </div>
                    <button
                      onClick={handleInviteStaff}
                      disabled={staffLoading}
                      className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg hover:bg-green-500 disabled:opacity-50 font-medium"
                    >
                      {staffLoading
                        ? "Hesap oluşturuluyor..."
                        : "🚀 Hesap Oluştur & Davet Gönder"}
                    </button>

                    {/* Invite Result Feedback */}
                    {inviteResult && inviteResult.success && (
                      <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-3">
                        <p className="text-green-300 font-medium">✅ Personel başarıyla eklendi!</p>
                        <div className="bg-gray-800 p-3 rounded text-sm">
                          <p className="text-gray-400">Geçici Şifre:</p>
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
                          Kapat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* 🍽️ Reservations Tab */}
        {activeTab === "reservations" && formData.hasReservation && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
            <ReservationsPanel
              businessId={businessId}
              businessName={formData.companyName || ""}
              staffName={admin?.displayName || admin?.email || "Admin"}
            />
          </div>
        )}

        {/* 🪑 Dine-In Tab */}
        {activeTab === "dineIn" && (planFeatures.dineInQR || planFeatures.waiterOrder) && (
          <div className="space-y-6">
            {/* ── Header Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-orange-400">{formData.maxReservationTables || 0}</p>
                <p className="text-xs text-gray-400 mt-1">Toplam Masa</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-teal-400">{formData.tableCapacity || 0}</p>
                <p className="text-xs text-gray-400 mt-1">Oturma Kapasitesi</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-green-400">{planFeatures.dineInQR ? '✓' : '✕'}</p>
                <p className="text-xs text-gray-400 mt-1">QR Sipariş</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-blue-400">{planFeatures.waiterOrder ? '✓' : '✕'}</p>
                <p className="text-xs text-gray-400 mt-1">Garson Sipariş</p>
              </div>
            </div>

            {/* ── Table Count Configuration ── */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                🪑 Masa Sayısı Ayarı
              </h2>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Masa Adedi</label>
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
                    max="100"
                    className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none text-lg font-medium"
                    placeholder="ör: 20"
                  />
                  <p className="text-xs text-gray-500 mt-1">İşletmedeki toplam masa sayısı</p>
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Oturma Kapasitesi (Kişi)</label>
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
                    className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none text-lg font-medium"
                    placeholder="ör: 80"
                  />
                  <p className="text-xs text-gray-500 mt-1">Toplam müşteri kapasitesi</p>
                </div>
              </div>
            </div>

            {/* ── Table QR Codes — Compact Table Layout ── */}
            {planFeatures.dineInQR && (formData.maxReservationTables || 0) > 0 && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📱 Masa QR Kodları
                    <span className="text-sm font-normal text-gray-400">
                      · {formData.maxReservationTables} masa
                    </span>
                  </h2>
                  <button
                    onClick={() => {
                      const tableCount = formData.maxReservationTables || 0;
                      for (let i = 1; i <= tableCount; i++) {
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://lokma.web.app/dinein/${businessId}/table/${i}`)}`;
                        const link = document.createElement('a');
                        link.href = qrUrl;
                        link.download = `Masa_${i}_QR.png`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    📥 Tümünü İndir
                  </button>
                </div>

                {/* Compact grid — small QR thumbnails */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                  {Array.from({ length: formData.maxReservationTables || 0 }, (_, i) => {
                    const tableNum = i + 1;
                    const qrData = `https://lokma.web.app/dinein/${businessId}/table/${tableNum}`;
                    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
                    return (
                      <button
                        key={tableNum}
                        onClick={() => {
                          const downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
                          const link = document.createElement('a');
                          link.href = downloadUrl;
                          link.download = `Masa_${tableNum}_QR.png`;
                          link.target = '_blank';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-gray-800 rounded-lg border border-gray-700 p-2 flex flex-col items-center gap-1 hover:border-orange-500 hover:bg-gray-700/50 transition cursor-pointer group"
                        title={`Masa ${tableNum} QR kodunu indir`}
                      >
                        <div className="w-full aspect-square bg-white rounded flex items-center justify-center overflow-hidden">
                          <img
                            src={qrImageUrl}
                            alt={`Masa ${tableNum}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-300 group-hover:text-orange-400 transition">M{tableNum}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-3">💡 QR koduna tıklayarak tek tek indirebilirsiniz</p>
              </div>
            )}

            {/* ── Empty State ── */}
            {planFeatures.dineInQR && (formData.maxReservationTables || 0) === 0 && (
              <div className="bg-gray-900 rounded-2xl p-8 border border-dashed border-orange-700/50 text-center">
                <span className="text-4xl">🪑</span>
                <p className="text-white font-semibold mt-3">Henüz masa tanımlanmadı</p>
                <p className="text-gray-400 text-sm mt-1">
                  Yukarıdan masa sayısını girerek QR kodlarınızı oluşturun
                </p>
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
                    <h3 className="text-white font-semibold">Garson Sipariş Sistemi</h3>
                    <p className="text-xs text-gray-400">Personel tablet/telefon ile masada sipariş alır</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
                    ✓ AKTİF
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-teal-400 font-medium text-sm">1. Masa Seç</p>
                    <p className="text-gray-400 text-xs mt-1">Garson masayı seçer</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-teal-400 font-medium text-sm">2. Ürün Ekle</p>
                    <p className="text-gray-400 text-xs mt-1">Menüden ürün ekler</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-teal-400 font-medium text-sm">3. Sipariş Gönder</p>
                    <p className="text-gray-400 text-xs mt-1">Mutfağa iletilir</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Plan Info Footer ── */}
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
              <p className="text-sm text-gray-400">
                💡 Bu özellikler işletmenin <strong className="text-white">{business?.subscriptionPlan || 'basic'}</strong> planı üzerinden yönetilmektedir.
                Değişiklik yapmak için <a href="/admin/plans" className="text-blue-400 hover:underline">Plan Yönetimi</a> sayfasını ziyaret edin.
              </p>
            </div>
          </div>
        )}

        {/* ⭐ Sponsored Products Tab */}
        {activeTab === "sponsored" && sponsoredSettings.enabled && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">⭐</span>
                <div>
                  <h2 className="text-xl font-bold text-white">Öne Çıkan Ürünler</h2>
                  <p className="text-gray-400 text-sm">
                    Sepette "Bir şey mi unuttun?" bölümünde gösterilecek ürünleri seçin.
                    Sipariş başı <strong className="text-orange-400">{sponsoredSettings.feePerConversion.toFixed(2)} €</strong> ücret kesilir.
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                  <p className="text-2xl font-bold text-orange-400">{sponsoredProducts.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Seçili Ürün</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                  <p className="text-2xl font-bold text-gray-300">{sponsoredSettings.maxProductsPerBusiness}</p>
                  <p className="text-xs text-gray-400 mt-1">Max Ürün</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                  <p className="text-2xl font-bold text-green-400">{sponsoredSettings.feePerConversion.toFixed(2)} €</p>
                  <p className="text-xs text-gray-400 mt-1">Sipariş Başı</p>
                </div>
              </div>

              {/* Product Selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-300 mb-3">📦 Ürünleriniz</h3>
                {products.length === 0 ? (
                  <p className="text-gray-500 text-sm">Henüz ürün eklenmemiş.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {products
                      .filter((p: any) => p.isActive !== false)
                      .map((product: any) => {
                        const isSponsored = sponsoredProducts.includes(product.id);
                        const isAtLimit = sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness && !isSponsored;
                        return (
                          <label
                            key={product.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isSponsored
                                ? 'bg-orange-950/40 border-orange-600/50'
                                : isAtLimit
                                  ? 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed'
                                  : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSponsored}
                              disabled={isAtLimit}
                              onChange={() => {
                                if (isSponsored) {
                                  setSponsoredProducts(prev => prev.filter(id => id !== product.id));
                                } else if (!isAtLimit) {
                                  setSponsoredProducts(prev => [...prev, product.id]);
                                }
                              }}
                              className="accent-orange-500 w-5 h-5 flex-shrink-0"
                            />
                            {product.imageUrl && (
                              <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{product.name}</p>
                              <p className="text-gray-400 text-xs">
                                {product.price ? `${Number(product.price).toFixed(2)} €` : ''}
                                {product.unit ? ` / ${product.unit}` : ''}
                              </p>
                            </div>
                            {isSponsored && (
                              <span className="text-orange-400 text-xs font-bold">⭐</span>
                            )}
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Limit Warning */}
              {sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness && (
                <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700/40 rounded-xl">
                  <p className="text-yellow-300 text-sm">⚠️ Maksimum {sponsoredSettings.maxProductsPerBusiness} ürün seçebilirsiniz.</p>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={async () => {
                  if (!businessId) return;
                  setSponsoredSaving(true);
                  try {
                    await updateDoc(doc(db, 'businesses', businessId), {
                      sponsoredProducts,
                      hasSponsoredProducts: sponsoredProducts.length > 0,
                      sponsoredUpdatedAt: serverTimestamp(),
                    });
                    showToast('✅ Öne çıkan ürünler kaydedildi!', 'success');
                  } catch (error) {
                    console.error('Error saving sponsored products:', error);
                    showToast('Hata oluştu', 'error');
                  } finally {
                    setSponsoredSaving(false);
                  }
                }}
                disabled={sponsoredSaving}
                className="w-full mt-6 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-orange-900/20 disabled:opacity-50"
              >
                {sponsoredSaving ? 'Kaydediliyor...' : '⭐ Öne Çıkan Ürünleri Kaydet'}
              </button>
            </div>
          </div>
        )}

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
                  <label className="text-gray-400 text-sm">Yeni Rol Seç</label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1"
                  >
                    <option value="">-- Rol Seç --</option>
                    <option value="İşletme Admin">İşletme Admin</option>
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
                  İptal
                </button>
                <button
                  onClick={() => confirmModal.onConfirm(selectedNewRole)}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-medium ${confirmModal.confirmColor || "bg-red-600 hover:bg-red-500"}`}
                >
                  {confirmModal.confirmText || "Onayla"}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
