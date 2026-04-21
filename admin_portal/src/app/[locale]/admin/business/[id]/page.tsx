"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { normalizeTimeString, getScheduleForToday, parseOpeningHoursBlock } from "@/utils/timeUtils";
import { Store, Utensils, Users, CreditCard, Gift, Rocket, Wand2, Truck, Clock } from "lucide-react";
// Removing onAuthStateChanged import as it is no longer needed in this file
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
 writeBatch,
 Timestamp,
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
import { Admin, ButcherPartner, GERMAN_LEGAL_FORM_LABELS, GermanLegalForm } from "@/types";
import { useAdmin } from "@/components/providers/AdminProvider";
import { useTranslations } from "next-intl";
import { useSectors } from "@/hooks/useSectors";
import { subscriptionService } from "@/services/subscriptionService";

import { Star, History } from "lucide-react";
import OrderCard from "@/components/admin/OrderCard";
import { useOrdersStandalone, type Order } from "@/hooks/useOrders";
import OrderDetailsModal from "@/components/admin/OrderDetailsModal";
import { mapFirestoreOrder } from '@/lib/utils/orderMapper';
import ReservationsPanel from "./ReservationsPanel";
import ReservationCapacityConfig from "@/components/ReservationCapacityConfig";



/** 
 * Normalize order status from Firestore - handles legacy values.
 * Mirrors the mobile app's _parseOrderStatus logic in order_service.dart
 */
function normalizeOrderStatus(rawStatus: string | undefined): Order['status'] {
 const s = (rawStatus || 'pending').toString();
 switch (s) {
 case 'completed':
 case 'picked_up':
 return 'delivered';
 case 'out_for_delivery':
 return 'onTheWay';
 case 'confirmed':
 return 'accepted';
 case 'ready_for_pickup':
 case 'ready_for_delivery':
 return 'ready';
 case 'pending_payment':
 return 'pending';
 case 'refunded':
 return 'cancelled';
 case 'pending':
 case 'accepted':
 case 'preparing':
 case 'ready':
 case 'onTheWay':
 case 'served':
 case 'delivered':
 case 'cancelled':
 return s as Order['status'];
 default:
 console.warn('[ORDER STATUS] Unknown status:', s, '- defaulting to pending');
 return 'pending';
 }
}


// Add global declaration for Google Maps
declare global {
 interface Window {
 google: any;
 }
}



export default function BusinessDetailsPage() {
 const t = useTranslations('AdminBusiness');
 const tOrders = useTranslations('AdminPortal.Orders');

 // formatTo24h: paylasimli utility uzerinden -- AM/PM, 24h, nokta seperator hepsini handle eder
 function formatTo24h(timeStr: string): string {
 return normalizeTimeString(timeStr) || timeStr;
 }

 // checkShopStatus: paylasimli utility uzerinden -- tum gun ismi ve saat formati varyasyonlarini handle eder
 function checkShopStatus(openingHours: string | string[]) {
 try {
 const raw = Array.isArray(openingHours) ? openingHours.join('\n') : openingHours;
 if (!raw) return { isOpen: false, text: t('kapali'), isClosed: true };

 const result = getScheduleForToday(raw);
 if (result.isOpen) {
 return { isOpen: true, text: t('suAnAcik') };
 }
 // Bugun tamamen kapali mi yoksa saat disi mi?
 if (!result.todayOpen && !result.todayClose) {
 return { isOpen: false, text: t('bugunKapali'), isClosed: true };
 }
 return { isOpen: false, text: t('suAnKapali'), isClosed: false };
 } catch (e) {
 console.error('Status checking error', e);
 return { isOpen: false, text: t('hata') };
 }
 }

 // Localized status labels for order display
 const orderStatusLabels: Record<string, { label: string; color: string }> = {
 pending: { label: t('order_pending'), color: "bg-yellow-600" },
 accepted: { label: t('onaylandi'), color: "bg-blue-600" },
 preparing: { label: t('hazirlaniyor'), color: "bg-blue-600" },
 ready: { label: t('hazir'), color: "bg-green-600" },
 onTheWay: { label: t('order_onTheWay'), color: "bg-indigo-600" },
 delivered: { label: t('order_delivered'), color: "bg-muted border border-border text-foreground" },
 completed: { label: t('tamamlandi'), color: "bg-muted border border-border text-foreground" },
 cancelled: { label: t('iptal1'), color: "bg-red-600" },
 payment_failed: { label: t('order_payment_failed'), color: "bg-red-800" },
 };

 // Fallback plan labels for badge display (dynamic plans override these)
 const defaultPlanLabels: Record<string, { label: string; color: string }> = {
 none: { label: t('yok'), color: "bg-card" },
 };

 // 🆕 Dynamic business type labels for UI - synced with /lib/business-types.ts
 const businessTypeLabels: Record<string, { label: string; emoji: string; color: string }> = {
 // === MERKEZI TİPLER (business-types.ts ile uyumlu) ===
 kasap: { label: "Kasap", emoji: "🥩", color: "bg-red-600" },
 market: { label: "Market", emoji: "", color: "bg-green-600" },
 restoran: { label: t('restoran'), emoji: "", color: "bg-amber-600" },
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
 berber: { label: "Berber", emoji: "✂️", color: "bg-muted border border-border text-foreground" },
 };

 // Helper to get business type display info (supports single type or array)
 function getBusinessTypeLabel(type?: string | string[]) {
 const defaultLabel = { label: t('isletme'), emoji: "🏪", color: "bg-muted border border-border text-foreground" };

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
 color: firstType?.color || "bg-muted border border-border text-foreground"
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
	const initialSubTab = searchParams.get('settingsSubTab') as 'isletme' | 'menu' | 'personel' | 'masa' | 'abonelik' | 'odeme' | 'promosyon' | 'marketing' | 'teslimat' | 'saatler' || 'isletme';

 const { admin, loading: adminLoading } = useAdmin();
 const { getActiveSectors } = useSectors();
 const dynamicSectorTypes = getActiveSectors();
 const [loading, setLoading] = useState(true); // Data loading state
 const [business, setBusiness] = useState<ButcherPartner | null>(null);
 const [platformBrands, setPlatformBrands] = useState<any[]>([]);
 
 const {
 orders,
 loading: ordersLoading,
 dateFilter: orderDateFilter,
 setDateFilter: setOrderDateFilter,
 statusFilter: orderStatusFilter,
 setStatusFilter: setOrderStatusFilter,
 typeFilter: orderTypeFilter,
 setTypeFilter: setOrderTypeFilter,
 } = useOrdersStandalone({ businessId, initialDateFilter: 'all' });
 
 const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);
 const [toast, setToast] = useState<{
 message: string;
 type: "success" | "error";
 } | null>(null);

 const [activeTab, setActiveTab] = useState<
 "overview" | "orders" | "reservations" | "settings" | "procurement"
 >(initialTab);
 const [settingsSubTab, setSettingsSubTab] = useState<
 "isletme" | "menu" | "personel" | "masa" | "abonelik" | "odeme" | "promosyon" | "marketing" | "teslimat" | "saatler"
 >(initialSubTab);
 const [menuInternalTab, setMenuInternalTab] = useState<"kategoriler" | "urunler" | "sponsored">("kategoriler");
 const [isletmeInternalTab, setIsletmeInternalTab] = useState<"bilgiler" | "fatura" | "zertifikalar" | "gorseller" | "saatler" | "teslimat" | "saatler">("bilgiler");
 const [saatlerSubTab, setSaatlerSubTab] = useState<"genel" | "kurye" | "gelal">("genel");
 const [overviewHoursTab, setOverviewHoursTab] = useState<"genel" | "kurye" | "gelal">("genel");
 const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

 // Tedarik Sipariş Yönetimi (Procurement)
 const [procurementSubTab, setProcurementSubTab] = useState<'suppliers' | 'orders'>('orders');
 const [suppliers, setSuppliers] = useState<any[]>([]);
 const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
 const [loadingSuppliers, setLoadingSuppliers] = useState(false);
 const [loadingSupplierOrders, setLoadingSupplierOrders] = useState(false);
 const [showSupplierModal, setShowSupplierModal] = useState(false);
 const [editingSupplier, setEditingSupplier] = useState<any>(null);
 const [supplierForm, setSupplierForm] = useState<any>({
 name: '', contactPerson: '', phone: '', email: '', address: '',
 taxId: '', paymentTerms: '', deliveryDays: '', minOrderValue: '', notes: '', isActive: true
 });
 const [showOrderModal, setShowOrderModal] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState<any>(null);
 const [checkedItems, setCheckedItems] = useState<Record<string, Record<number, boolean>>>({});
 const [editingOrder, setEditingOrder] = useState<any>(null);
 const [orderForm, setOrderForm] = useState<any>({
 supplierId: '', supplierName: '', status: 'draft',
 expectedDeliveryDate: '', notes: '', invoiceNumber: '', items: []
 });
 const [showGoodsReceiptModal, setShowGoodsReceiptModal] = useState(false);
 const [goodsReceiptOrder, setGoodsReceiptOrder] = useState<any>(null);
 const [savingSupplier, setSavingSupplier] = useState(false);
 const [savingOrder, setSavingOrder] = useState(false);

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
 if (subTab && ['isletme', 'menu', 'personel', 'masa', 'abonelik', 'teslimat', 'odeme', 'promosyon', 'marketing'].includes(subTab)) {
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
 const [editingInlineProduct, setEditingInlineProduct] = useState<any>(null);
 const [editInlineTab, setEditInlineTab] = useState<'general' | 'pricing' | 'stock' | 'media' | 'contentCompliance' | 'app' | 'audit'>('general');
 const [editFormFull, setEditFormFull] = useState<any>({});
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
 const [isEditing, setIsEditing] = useState(true);
 const [formData, setFormData] = useState({
 companyName: "",
 customerId: "",
 brand: "" as "tuna" | "akdeniz_toros" | "independent" | "",
 activeBrandIds: [] as string[],
 brandLabelActive: false,
 // 🔴 TUNA/Toros ürünleri satışı (Filtreleme için)
 sellsTunaProducts: false,
 sellsTorosProducts: false,
 // 🆕 Multi-type support: bir işletme birden fazla tür olabilir
 types: [] as string[], // e.g. ["kasap", "market"]
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
 pickupEnabled: true, // Gel-Al fonksiyonu açık mı?
 deliveryPostalCode: "",
 deliveryRadius: 5,
 minDeliveryOrder: 0,
 deliveryFee: 0,
 // 🆕 {t('gelismis')} Sipariş Saatleri (Lieferando benzeri)
 deliveryStartTime: "" as string, // "HH:MM" - Kurye başlangıç saati
 deliveryEndTime: "" as string, // "HH:MM" - Kurye bitiş saati
 pickupStartTime: "" as string, // "HH:MM" - Gel Al başlangıç saati
 pickupEndTime: "" as string, // "HH:MM" - Gel Al bitiş saati
 deliveryHours: "" as string, // Per-day kurye saatleri (same format as openingHours)
 pickupHours: "" as string, // Per-day gel-al saatleri (same format as openingHours)
 preOrderEnabled: false, // Kapalıyken ön sipariş alabilir mi?
 freeDeliveryThreshold: 0, // Bu tutarın üzerinde teslimat ücretsiz (€)
 // 🆕 Geçici Kurye Kapatma
 temporaryDeliveryPaused: false, // Kurye hizmeti geçici olarak durduruldu mu?
 temporaryPickupPaused: false, // Gel-Al hizmeti geçici olarak durduruldu mu?
 deliveryPauseUntil: null as any, // Kurye pause bitiş zamanı
 pickupPauseUntil: null as any, // Gel-Al pause bitiş zamanı
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
 payoutBankIban: "",
	payoutBankBic: "",
	payoutBankAccountHolder: "",
	payoutBankName: "",
	bankName: "",
 // 🆕 Lieferando-style fields
 cuisineType: "", // "Kebap, Döner, Türkisch" - Mutfak türü/alt başlık
 logoUrl: "", // Kare işletme logosu URL'i
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
 // 🆕 Impressum / Rechtliche Angaben
 legalForm: "" as string,
 managingDirector: "",
 authorizedRepresentative: "",
 registerCourt: "",
 registerNumber: "",
 // 🆕 Masa Rezervasyonu
 hasReservation: false, // Masa rezervasyonu aktif mi?
 tableCapacity: 0, // Toplam oturma kapasitesi (kişi)
 maxReservationTables: 0, // Aynı anda rezerve edilebilecek max masa sayısı
 // 🆕 {t('gelismis')} Masa Yönetimi
 tables: [] as { label: string; section: string; sortOrder: number }[],
 tableSections: [] as string[],
 // 🆕 Yerinde Sipariş Ayarları
 dineInPaymentMode: 'payLater' as string, // 'payFirst' = Hemen öde (fast food), 'payLater' = Çıkışta öde (restoran)
 hasTableService: false, // Garson servisi var mı?
 // 🎁 Promosyon
 freeDrinkEnabled: true,
 freeDrinkProducts: [] as string[],
 freeDrinkMinimumOrder: 0, // 0 = her siparişte aktif, >0 = min. sipariş tutarında aktif
 // 🆕 Group Order Link
 groupOrderLinkEnabled: false,
 groupOrderTableEnabled: false,
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

 // 📢 Marketing Boost campaign state
 const [boostCampaigns, setBoostCampaigns] = useState<any[]>([]);
 const [loadingBoostCampaigns, setLoadingBoostCampaigns] = useState(false);
 const [showBoostForm, setShowBoostForm] = useState(false);
 const [boostSaving, setBoostSaving] = useState(false);
 const [boostForm, setBoostForm] = useState({
 campaignName: '',
 model: 'cpc' as 'cpc' | 'payPerOrder',
 bidAmount: '0.30',
 budgetType: 'weekly' as 'daily' | 'weekly' | 'total',
 budgetAmount: '50',
 activeDays: [0, 1, 2, 3, 4, 5, 6] as number[],
 activeHoursStart: '00:00',
 activeHoursEnd: '23:59',
 endDate: '',
 });

 // Upcoming Reservation State
 interface ReservationInfo {
 id: string;
 customerName: string;
 partySize: number;
 reservationDate: Date;
 timeSlot: string;
 status: string;
 tableCardNumbers?: number[];
 }
 const [upcomingReservation, setUpcomingReservation] = useState<ReservationInfo | null>(null);

 useEffect(() => {
 if (!businessId || activeTab !== 'orders') return;
 const today = new Date();
 today.setHours(0, 0, 0, 0);

 const q = query(
 collection(db, 'businesses', businessId, 'reservations'),
 where('reservationDate', '>=', Timestamp.fromDate(today)),
 orderBy('reservationDate', 'asc'),
 limit(5)
 );

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const now = new Date();
 const resList = snapshot.docs.map(d => {
 const data = d.data();
 return {
 id: d.id,
 customerName: data.customerName || '',
 partySize: data.partySize || 1,
 reservationDate: data.reservationDate?.toDate() || new Date(),
 timeSlot: data.timeSlot || '',
 status: data.status || 'pending',
 tableCardNumbers: data.tableCardNumbers || [],
 };
 }).filter(r => (r.status === 'pending' || r.status === 'confirmed'));

 const upcoming = resList.filter(r => {
 if (r.timeSlot) {
 const [hh, mm] = r.timeSlot.split(':').map(Number);
 const rTime = new Date(r.reservationDate);
 rTime.setHours(hh, mm, 0, 0);
 return rTime.getTime() > now.getTime() - 30 * 60000;
 }
 return r.reservationDate.getTime() > now.getTime() - 30 * 60000;
 });

 upcoming.sort((a, b) => {
 const aTime = a.timeSlot ? parseInt(a.timeSlot.replace(':', '')) : parseInt(`${a.reservationDate.getHours()}${a.reservationDate.getMinutes()}`);
 const bTime = b.timeSlot ? parseInt(b.timeSlot.replace(':', '')) : parseInt(`${b.reservationDate.getHours()}${b.reservationDate.getMinutes()}`);
 const aDate = new Date(a.reservationDate).setHours(0,0,0,0);
 const bDate = new Date(b.reservationDate).setHours(0,0,0,0);
 if (aDate !== bDate) return aDate - bDate;
 return aTime - bTime;
 });

 if (upcoming.length > 0) {
 setUpcomingReservation(upcoming[0]);
 } else {
 setUpcomingReservation(null);
 }
 });

 return () => unsubscribe();
 }, [businessId, activeTab]);

 // 📢 Load boost campaigns when Marketing tab is opened
 useEffect(() => {
 if (settingsSubTab !== 'marketing' || !businessId) return;
 const loadCampaigns = async () => {
 setLoadingBoostCampaigns(true);
 try {
 const q = query(collection(db, 'boost_campaigns'), where('businessId', '==', businessId));
 const snap = await getDocs(q);
 const campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
 setBoostCampaigns(campaigns);
 } catch (err) {
 console.error('Error loading boost campaigns:', err);
 }
 setLoadingBoostCampaigns(false);
 };
 loadCampaigns();
 }, [settingsSubTab, businessId]);

 // Reusable overlay for plan-gated modules -- always visible (teaser) but locked if not in plan
 // Super Admin bypass: Super admins can always access all features regardless of plan
 const LockedModuleOverlay = ({ featureKey, children }: { featureKey: string; children: React.ReactNode }) => {
 const isAvailable = planFeatures[featureKey] || admin?.adminType === 'super';
 if (isAvailable) return <>{children}</>;
 return (
 <div className="relative">
 <div className="opacity-40 pointer-events-none select-none filter blur-[0.5px]">
 {children}
 </div>
 <div className="absolute inset-0 flex items-center justify-center z-10">
 <div className="bg-card/95 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-6 text-center max-w-md shadow-2xl">
 <span className="text-4xl">🔒</span>
 <h3 className="text-foreground font-bold mt-3 text-lg">{t('buFonksiyonPlaninizdaMevcutDegil')}</h3>
 <p className="text-muted-foreground text-sm mt-2">
 {t('mevcutPlan')}: <strong className="text-foreground">{business?.subscriptionPlan || 'free'}</strong>
 </p>
 <a
 href={`/${params.locale}/admin/plans`}
 className="mt-4 inline-block px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-foreground font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition shadow-lg"
 >
 {t('planlariIncele')}
 </a>
 </div>
 </div>
 </div>
 );
 };

 // Template Selection Modal State
 const [showTemplateModal, setShowTemplateModal] = useState(false);
 const [templateProducts, setTemplateProducts] = useState<any[]>([]);
 const [selectedTemplateProducts, setSelectedTemplateProducts] = useState<Record<string, boolean>>({});
 const [templateCategoryMap, setTemplateCategoryMap] = useState<Record<string, string>>({});
 const [savingTemplate, setSavingTemplate] = useState(false);
 const [templateFilter, setTemplateFilter] = useState<string>('all');
 const [templateSearch, setTemplateSearch] = useState('');
 const [collapsedProductCategories, setCollapsedProductCategories] = useState<Record<string, boolean>>({});

 // 🆕 Inline Product Management State
 const [selectedInlineProducts, setSelectedInlineProducts] = useState<Set<string>>(new Set());
 const [inlineStatusFilter, setInlineStatusFilter] = useState<string>('all');
 const [inlineCategoryFilter, setInlineCategoryFilter] = useState<string>('all');
 const [productSearchQuery, setProductSearchQuery] = useState<string>('');
 const [productCurrentPage, setProductCurrentPage] = useState<number>(1);
 const [productsPerPage, setProductsPerPage] = useState<number>(20);

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
 activeBrandIds: d.activeBrandIds || [],
 brandLabelActive: d.brandLabelActive !== false,
 // 🔴 TUNA/Toros ürünleri satışı
 sellsTunaProducts: d.sellsTunaProducts ?? false,
 sellsTorosProducts: d.sellsTorosProducts ?? false,
 // 🆕 Multi-type support: yükle types array'i
 types: d.types || (d.type ? [d.type] : []), // Legacy: single type'ı array'e çevir
 street: d.address?.street || "",
 postalCode: d.address?.postalCode || "",
 city: d.address?.city || "",
 country: d.address?.country || "DE",
 shopPhone: d.shopPhone || "",
 shopEmail: d.shopEmail || "",
 openingHours: (() => {
 const raw = Array.isArray(d.openingHours)
 ? d.openingHours.join('\n')
 : d.openingHours || '';
 // Okunan veriyi 24h formatina normalize et (eski AM/PM verilerini duzeltir)
 return raw.split('\n').map((line: string) => {
 const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
 if (!match) return line.trim();
 const dayName = match[1].trim();
 const timePart = match[2].trim();
 const lower = timePart.toLowerCase();
 if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
 return `${dayName}: Closed`;
 }
 const sep = timePart.includes('\u2013') ? '\u2013' : '-';
 const parts = timePart.split(sep).map((p: string) => p.trim());
 if (parts.length >= 2) {
 return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
 }
 return line.trim();
 }).filter(Boolean).join('\n');
 })(),
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
 pickupEnabled: d.pickupEnabled !== false,
 deliveryPostalCode: d.deliveryPostalCode || "",
 deliveryRadius: d.deliveryRadius || 5,
 minDeliveryOrder: d.minDeliveryOrder || 0,
 deliveryFee: d.deliveryFee || 0,
 // 🆕 {t('gelismis')} Sipariş Saatleri
 deliveryStartTime: normalizeTimeString(d.deliveryStartTime || ''),
 deliveryEndTime: normalizeTimeString(d.deliveryEndTime || ''),
 pickupStartTime: normalizeTimeString(d.pickupStartTime || ''),
 pickupEndTime: normalizeTimeString(d.pickupEndTime || ''),
 deliveryHours: (() => {
 const raw = Array.isArray(d.deliveryHours) ? d.deliveryHours.join('\n') : (d.deliveryHours || '');
 return raw.split('\n').map((line: string) => {
 const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
 if (!match) return line.trim();
 const dayName = match[1].trim();
 const timePart = match[2].trim();
 const lower = timePart.toLowerCase();
 if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
 return `${dayName}: Closed`;
 }
 const sep = timePart.includes('\u2013') ? '\u2013' : '-';
 const parts = timePart.split(sep).map((p: string) => p.trim());
 if (parts.length >= 2) {
 return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
 }
 return line.trim();
 }).filter(Boolean).join('\n');
 })(),
 pickupHours: (() => {
 const raw = Array.isArray(d.pickupHours) ? d.pickupHours.join('\n') : (d.pickupHours || '');
 return raw.split('\n').map((line: string) => {
 const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
 if (!match) return line.trim();
 const dayName = match[1].trim();
 const timePart = match[2].trim();
 const lower = timePart.toLowerCase();
 if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
 return `${dayName}: Closed`;
 }
 const sep = timePart.includes('\u2013') ? '\u2013' : '-';
 const parts = timePart.split(sep).map((p: string) => p.trim());
 if (parts.length >= 2) {
 return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
 }
 return line.trim();
 }).filter(Boolean).join('\n');
 })(),
 preOrderEnabled: d.preOrderEnabled || false,
 freeDeliveryThreshold: d.freeDeliveryThreshold || 0,
 // 🆕 Geçici Kurye Kapatma
 temporaryDeliveryPaused: d.temporaryDeliveryPaused || false,
 temporaryPickupPaused: d.temporaryPickupPaused || false,
 deliveryPauseUntil: d.deliveryPauseUntil || null,
 pickupPauseUntil: d.pickupPauseUntil || null,
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
		payoutBankIban: d.payoutBankDetails?.iban || "",
		payoutBankBic: d.payoutBankDetails?.bic || "",
		payoutBankAccountHolder: d.payoutBankDetails?.accountHolder || "",
		payoutBankName: d.payoutBankDetails?.bankName || "",
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
 // 🆕 Impressum / Rechtliche Angaben
 legalForm: d.legalForm || "",
 managingDirector: d.managingDirector || d.ownerName || "",
 authorizedRepresentative: d.authorizedRepresentative || "",
 registerCourt: d.registerCourt || "",
 registerNumber: d.registerNumber || "",
 // 🆕 Fatura Bilgileri
 billingName: d.billingAddress?.name || "",
 billingVatNumber: d.billingAddress?.vatNumber || "",
 // 🆕 Masa Rezervasyonu
 hasReservation: d.hasReservation || false,
 tableCapacity: d.tableCapacity || 0,
 maxReservationTables: d.maxReservationTables || 0,
 // 🆕 {t('gelismis')} Masa Yönetimi
 tables: Array.isArray(d.tables) ? d.tables : [],
 tableSections: Array.isArray(d.tableSections) ? d.tableSections : [],
 // 🆕 Yerinde Sipariş Ayarları
 dineInPaymentMode: d.dineInPaymentMode || 'payLater',
 hasTableService: d.hasTableService || false,
 // 🎁 Promosyon
 freeDrinkEnabled: d.freeDrinkEnabled !== false,
 freeDrinkProducts: d.freeDrinkProducts ?? [],
 freeDrinkMinimumOrder: d.freeDrinkMinimumOrder ?? 0,
 groupOrderLinkEnabled: d.groupOrderLinkEnabled ?? false,
 groupOrderTableEnabled: d.groupOrderTableEnabled ?? false,
 });

 // Resolve plan features from subscription_plans collection
 const planCode = d.subscriptionPlan || 'basic';
 try {
 // Try matching by code first
 let plansQuery = query(
 collection(db, 'subscription_plans'),
 where('code', '==', planCode)
 );
 let planSnap = await getDocs(plansQuery);
 
 // If not found by code, try by document ID (e.g. free_pkg vs free)
 if (planSnap.empty) {
 const { getDoc, doc: docRef } = await import('firebase/firestore');
 const planDocSnap = await getDoc(docRef(db, 'subscription_plans', planCode));
 if (planDocSnap.exists()) {
 const planData = planDocSnap.data();
 setPlanFeatures(planData.features || {});
 if (planData.features?.sponsoredProducts) {
 setSponsoredSettings({
 enabled: true,
 feePerConversion: planData.sponsoredFeePerConversion ?? 0.40,
 maxProductsPerBusiness: planData.sponsoredMaxProducts ?? 5,
 });
 }
 } else {
 // Fallback: set sensible defaults so basic features work
 setPlanFeatures({
 clickAndCollect: true,
 reservations: true,
 dineInQR: true,
 waiterOrder: true,
 pickup: true,
 });
 }
 } else {
 const planData = planSnap.docs[0].data();
 setPlanFeatures(planData.features || {});
 if (planData.features?.sponsoredProducts) {
 setSponsoredSettings({
 enabled: true,
 feePerConversion: planData.sponsoredFeePerConversion ?? 0.40,
 maxProductsPerBusiness: planData.sponsoredMaxProducts ?? 5,
 });
 }
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


 // Load Suppliers
 const loadSuppliers = useCallback(async () => {
 if (!businessId) return;
 setLoadingSuppliers(true);
 try {
 const snap = await getDocs(collection(db, 'businesses', businessId, 'suppliers'));
 const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setSuppliers(data.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')));
 } catch (err) {
 console.error('Error loading suppliers:', err);
 } finally {
 setLoadingSuppliers(false);
 }
 }, [businessId]);

 // Load Supplier Orders
 const loadSupplierOrders = useCallback(async () => {
 if (!businessId) return;
 setLoadingSupplierOrders(true);
 try {
 const snap = await getDocs(collection(db, 'businesses', businessId, 'supplierOrders'));
 const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setSupplierOrders(data.sort((a: any, b: any) => {
 const aTime = a.orderDate?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
 const bTime = b.orderDate?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
 return bTime - aTime;
 }));
 } catch (err) {
 console.error('Error loading supplier orders:', err);
 } finally {
 setLoadingSupplierOrders(false);
 }
 }, [businessId]);

 // Save Supplier
 const saveSupplier = async () => {
 if (!businessId || !supplierForm.name.trim()) return;
 setSavingSupplier(true);
 try {
 const data = {
 ...supplierForm,
 deliveryDays: supplierForm.deliveryDays ? Number(supplierForm.deliveryDays) : null,
 minOrderValue: supplierForm.minOrderValue ? Number(supplierForm.minOrderValue) : null,
 updatedAt: serverTimestamp(),
 };
 if (editingSupplier) {
 await updateDoc(doc(db, 'businesses', businessId, 'suppliers', editingSupplier.id), data);
 showToast(t('supplier_updated'), 'success');
 } else {
 await addDoc(collection(db, 'businesses', businessId, 'suppliers'), { ...data, createdAt: serverTimestamp() });
 showToast(t('supplier_added'), 'success');
 }
 setShowSupplierModal(false);
 setEditingSupplier(null);
 loadSuppliers();
 } catch (err) {
 console.error('Error saving supplier:', err);
 showToast(t('error_occurred'), 'error');
 } finally {
 setSavingSupplier(false);
 }
 };

 // Save Supplier Order
 const saveSupplierOrder = async () => {
 if (!businessId || !orderForm.supplierId) return;
 setSavingOrder(true);
 try {
 const totalAmount = orderForm.items.reduce((sum: number, item: any) => sum + (Number(item.purchasePrice || 0) * Number(item.orderedQuantity || 0)), 0);
 const orderNumber = editingOrder?.orderNumber || `TED-${new Date().getFullYear()}-${String(supplierOrders.length + 1).padStart(3, '0')}`;
 const data = {
 ...orderForm,
 orderNumber,
 totalAmount,
 currency: (business as any)?.currency || 'EUR',
 orderDate: editingOrder?.orderDate || serverTimestamp(),
 updatedAt: serverTimestamp(),
 items: orderForm.items.map((item: any) => ({
 ...item,
 orderedQuantity: Number(item.orderedQuantity || 0),
 receivedQuantity: Number(item.receivedQuantity || 0),
 purchasePrice: Number(item.purchasePrice || 0),
 totalPrice: Number(item.purchasePrice || 0) * Number(item.orderedQuantity || 0),
 isFullyReceived: Number(item.receivedQuantity || 0) >= Number(item.orderedQuantity || 0),
 })),
 };
 if (editingOrder) {
 await updateDoc(doc(db, 'businesses', businessId, 'supplierOrders', editingOrder.id), data);
 showToast(t('order_updated'), 'success');
 } else {
 await addDoc(collection(db, 'businesses', businessId, 'supplierOrders'), { ...data, createdBy: admin?.email || '', createdAt: serverTimestamp() });
 showToast(t('order_created'), 'success');
 }
 setShowOrderModal(false);
 setEditingOrder(null);
 loadSupplierOrders();
 } catch (err) {
 console.error('Error saving order:', err);
 showToast(t('error_occurred'), 'error');
 } finally {
 setSavingOrder(false);
 }
 };

 // Goods Receipt (Mal Kabul)
 const processGoodsReceipt = async () => {
 if (!businessId || !goodsReceiptOrder) return;
 setSavingOrder(true);
 try {
 const allReceived = goodsReceiptOrder.items.every((item: any) => Number(item.receivedQuantity || 0) >= Number(item.orderedQuantity || 0));
 const anyReceived = goodsReceiptOrder.items.some((item: any) => Number(item.receivedQuantity || 0) > 0);
 const newStatus = allReceived ? 'delivered' : anyReceived ? 'partiallyDelivered' : goodsReceiptOrder.status;
 await updateDoc(doc(db, 'businesses', businessId, 'supplierOrders', goodsReceiptOrder.id), {
 items: goodsReceiptOrder.items.map((item: any) => ({
 ...item,
 receivedQuantity: Number(item.receivedQuantity || 0),
 isFullyReceived: Number(item.receivedQuantity || 0) >= Number(item.orderedQuantity || 0),
 })),
 status: newStatus,
 actualDeliveryDate: allReceived ? serverTimestamp() : null,
 updatedAt: serverTimestamp(),
 });
 showToast(allReceived ? t('procurement_full_delivery') : t('procurement_partial_delivery'), 'success');
 setShowGoodsReceiptModal(false);
 setGoodsReceiptOrder(null);
 loadSupplierOrders();
 } catch (err) {
 console.error('Error processing goods receipt:', err);
 showToast(t('error_occurred'), 'error');
 } finally {
 setSavingOrder(false);
 }
 };

 // Delete supplier
 const deleteSupplier = async (supplierId: string) => {
 if (!businessId || !confirm(t('confirm_delete_supplier'))) return;
 try {
 await deleteDoc(doc(db, 'businesses', businessId, 'suppliers', supplierId));
 showToast(t('supplier_deleted'), 'success');
 loadSuppliers();
 } catch (err) {
 console.error('Error deleting supplier:', err);
 showToast(t('delete_failed'), 'error');
 }
 };

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
 const catA = (typeof a.category === 'object' ? getLocalizedText(a.category) : a.category) || '';
 const catB = (typeof b.category === 'object' ? getLocalizedText(b.category) : b.category) || '';
 if (catA !== catB) return catA.localeCompare(catB);
 const nameA = (typeof a.name === 'object' ? getLocalizedText(a.name) : a.name) || '';
 const nameB = (typeof b.name === 'object' ? getLocalizedText(b.name) : b.name) || '';
 return nameA.localeCompare(nameB);
 });
 setInlineProducts(prods);
 } catch (error) {
 console.error('Error loading inline products:', error);
 }
 setLoadingProducts(false);
 }, [businessId]);

 useEffect(() => {
 if (businessId) {
 loadInlineCategories();
 loadInlineProducts();
 }
 }, [businessId, loadInlineCategories, loadInlineProducts]);

 // Category CRUD
 const handleSaveCategory = async () => {
 const nameStr = typeof categoryForm.name === 'object'
 ? (getLocalizedText(categoryForm.name) ?? '').trim()
 : (categoryForm.name ?? '').toString().trim();
 if (!businessId || !nameStr) return;
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
 setCategoryForm({ name: { tr: '' }, icon: '', isActive: true });
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

 // Default Menu Template: detect kasap-type business
 const isKasapType = (() => {
 const types = formData.types || [];
 const kasapTypes = ['kasap', 'market', 'balik', 'sarkuteri', 'manav', 'bakkal'];
 return types.some((t: string) => kasapTypes.includes(t.toLowerCase()));
 })();

 // Apply default kasap CATEGORY template from Firestore (categories only)
 const [applyingTemplate, setApplyingTemplate] = useState(false);
 const [applyingProductTemplate, setApplyingProductTemplate] = useState(false);

 const applyCategoryTemplate = async () => {
 if (!businessId) return;
 setApplyingTemplate(true);
 try {
 // Fetch template from Firestore (categories only)
 const templateDoc = await getDoc(doc(db, 'defaultMenuTemplates', 'kasap'));
 if (!templateDoc.exists()) {
 showToast(t('template_not_found'), 'error');
 setApplyingTemplate(false);
 return;
 }
 const template = templateDoc.data();
 const categories = template.categories || [];

 // Delete existing categories first to avoid duplicates
 const existingSnap = await getDocs(collection(db, `businesses/${businessId}/categories`));
 for (const d of existingSnap.docs) {
 await deleteDoc(d.ref);
 }

 // Create each category as a sub-document
 const catRef = collection(db, `businesses/${businessId}/categories`);
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

 await loadInlineCategories();
 showToast(t('categories_added_count', {count: categories.length}), 'success');
 } catch (error) {
 console.error('Error applying category template:', error);
 showToast(t('category_template_error'), 'error');
 }
 setApplyingTemplate(false);
 };

 // AI Category Mapping: product.category → business category name
 const suggestCategoryForProduct = (product: any, categories: any[]): string => {
 const name = typeof product.name === 'object'
 ? (product.name.tr || product.name.de || '').toLowerCase()
 : (product.name || '').toLowerCase();
 const cat = product.category || '';

 // Helper to find category by partial name match
 const findCat = (search: string): string => {
 const found = categories.find((c: any) => {
 const catName = typeof c.name === 'object'
 ? (c.name.tr || c.name.de || '').toLowerCase()
 : (c.name || '').toLowerCase();
 return catName.includes(search.toLowerCase());
 });
 return found ? (typeof found.name === 'object' ? getLocalizedText(found.name) : found.name) : '';
 };

 // Kuzu vs Dana distinction within 'et' category
 if (cat === 'et') {
 if (name.includes('kuzu') || name.includes('lamm')) return findCat('kuzu') || findCat('dana');
 if (name.includes('dana') || name.includes('rind') || name.includes('jungbulle') || name.includes('roast')) return findCat('dana') || findCat('kuzu');
 // Default: kıyma, işkembe, dil etc. → Dana
 return findCat('dana') || findCat('kuzu');
 }
 if (cat === 'tavuk') return findCat('tavuk') || findCat('geflügel');
 if (cat === 'dondurulmus') return findCat('dondur') || findCat('tiefkühl');
 // Feinkost: sucuk, wurst, wurstchen, pastirma, kavurma, salam
 if (['wurstchen', 'wurst', 'sucuk', 'pastirma', 'kavurma'].includes(cat)) {
 return findCat('feinkost') || findCat('şarküteri');
 }
 // Fallback: first category
 return categories.length > 0
 ? (typeof categories[0].name === 'object' ? getLocalizedText(categories[0].name) : categories[0].name)
 : t('uncategorized');
 };

 // Open Template Selection Modal (was: auto-add all)
 const applyProductTemplate = async () => {
 if (!businessId) return;
 setApplyingProductTemplate(true);
 try {
 // Fetch kasap master products
 const masterProductsSnap = await getDocs(collection(db, 'master_products'));
 const kasapProducts = masterProductsSnap.docs
 .map(d => ({ id: d.id, ...d.data() }))
 .filter((p: any) => {
 const types = p.allowedBusinessTypes || [];
 return types.includes('kasap');
 });

 // Pre-fill: all selected, AI category suggestions
 setTemplateProducts(kasapProducts);
 setSelectedTemplateProducts(
 Object.fromEntries(kasapProducts.map((p: any) => [p.id, true]))
 );
 setTemplateCategoryMap(
 Object.fromEntries(kasapProducts.map((p: any) => [
 p.id,
 suggestCategoryForProduct(p, inlineCategories)
 ]))
 );
 setTemplateFilter('all');
 setTemplateSearch('');
 setShowTemplateModal(true);
 } catch (error) {
 console.error('Error loading template products:', error);
 showToast(t('product_template_load_error'), 'error');
 }
 setApplyingProductTemplate(false);
 };

 // Batch Save Selected Template Products
 const saveSelectedTemplateProducts = async () => {
 if (!businessId) return;
 setSavingTemplate(true);
 try {
 const selectedProducts = templateProducts.filter((p: any) => selectedTemplateProducts[p.id]);
 let productCount = 0;

 for (const product of selectedProducts) {
 const p = product as any;
 const assignedCategory = templateCategoryMap[p.id] || p.category || 'dana';
 await setDoc(doc(db, `businesses/${businessId}/products`, p.id), {
 masterProductId: p.id,
 name: p.name,
 description: p.description || { tr: '' },
 category: assignedCategory,
 categories: [assignedCategory],
 defaultUnit: p.defaultUnit || 'kg',
 unit: p.unit || p.defaultUnit || 'kg',
 price: p.defaultPrice || 0,
 isActive: true,
 isAvailable: true,
 brandLabels: p.brandLabels || [],
 imageUrl: p.imageUrl || '',
 optionGroups: p.optionGroups || [],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 }, { merge: true });
 productCount++;
 }

 await loadInlineProducts();
 setShowTemplateModal(false);
 showToast(t('products_added_count', {count: productCount}), 'success');
 } catch (error) {
 console.error('Error saving template products:', error);
 showToast(t('product_template_save_error'), 'error');
 }
 setSavingTemplate(false);
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

 // 🆕 Inline Bulk Actions
 const handleInlineBulkDelete = async () => {
 if (!businessId || selectedInlineProducts.size === 0) return;
 const count = selectedInlineProducts.size;
 setConfirmModal({
 show: true,
 title: '️ Toplu Sil',
 message: `${count} ürün silinecek. Devam?`,
 confirmText: 'Evet, Sil',
 confirmColor: 'bg-red-600 hover:bg-red-500',
 onConfirm: async () => {
 setConfirmModal(prev => ({ ...prev, show: false }));
 try {
 const batch = writeBatch(db);
 for (const pid of selectedInlineProducts) {
 batch.delete(doc(db, `businesses/${businessId}/products`, pid));
 }
 await batch.commit();
 setSelectedInlineProducts(new Set());
 showToast(`${count} ürün silindi`, "success");
 loadProducts();
 } catch (error) {
 console.error("Bulk delete error:", error);
 showToast("Toplu silme hatası", "error");
 }
 },
 });
 };

 const handleInlineBulkStatus = async (makeActive: boolean) => {
 if (!businessId || selectedInlineProducts.size === 0) return;
 const count = selectedInlineProducts.size;
 try {
 const batch = writeBatch(db);
 for (const pid of selectedInlineProducts) {
 batch.update(doc(db, `businesses/${businessId}/products`, pid), {
 isActive: makeActive,
 updatedAt: new Date(),
 });
 }
 await batch.commit();
 setSelectedInlineProducts(new Set());
 showToast(`${count} ürün ${makeActive ? 'aktif' : 'pasif'} yapıldı`, "success");
 loadProducts();
 } catch (error) {
 console.error("Bulk status error:", error);
 showToast("Durum değiştirme hatası", "error");
 }
 };

 const handleInlineBulkStock = async (inStock: boolean) => {
 if (!businessId || selectedInlineProducts.size === 0) return;
 const count = selectedInlineProducts.size;
 try {
 const batch = writeBatch(db);
 for (const pid of selectedInlineProducts) {
 batch.update(doc(db, `businesses/${businessId}/products`, pid), {
 outOfStock: !inStock,
 updatedAt: new Date(),
 });
 }
 await batch.commit();
 setSelectedInlineProducts(new Set());
 showToast(`${count} ${t('procurement_stock_updated')}`, "success");
 loadProducts();
 } catch (error) {
 console.error("Bulk stock error:", error);
 showToast("Stok güncelleme hatası", "error");
 }
 };

 const handleInlineBulkFeatured = async () => {
 if (!businessId || selectedInlineProducts.size === 0) return;
 const count = selectedInlineProducts.size;
 try {
 const batch = writeBatch(db);
 for (const pid of selectedInlineProducts) {
 batch.update(doc(db, `businesses/${businessId}/products`, pid), {
 isFeatured: true,
 updatedAt: new Date(),
 });
 }
 await batch.commit();
 setSelectedInlineProducts(new Set());
 showToast(`${count} ürün öne çıkan olarak işaretlendi`, "success");
 loadProducts();
 } catch (error) {
 console.error("Bulk featured error:", error);
 showToast("Öne çıkan güncelleme hatası", "error");
 }
 };

 const handleInlineBulkCategoryMove = async (newCategory: string) => {
 if (!businessId || selectedInlineProducts.size === 0) return;
 try {
 const batch = writeBatch(db);
 for (const pid of selectedInlineProducts) {
 batch.update(doc(db, `businesses/${businessId}/products`, pid), {
 category: newCategory,
 categories: [newCategory],
 updatedAt: new Date(),
 });
 }
 await batch.commit();
 setSelectedInlineProducts(new Set());
 showToast(`${selectedInlineProducts.size} ürün "${newCategory}" kategorisine taşındı`, "success");
 loadProducts();
 } catch (error) {
 console.error("Bulk category move error:", error);
 showToast("Kategori taşıma hatası", "error");
 }
 };

 // Handle Add Product
 
 // Update order status
 const updateOrderStatus = async (orderId: string, newStatus: string, reason?: string) => {
 try {
 const updateData: Record<string, unknown> = {
 status: newStatus,
 updatedAt: new Date(),
 };
 if (reason) {
 updateData.rejectionReason = reason;
 }
 await updateDoc(doc(db, 'meat_orders', orderId), updateData);
 
 // We don't have the full order payload here easily to log activity, 
 // but status updates will be reflected in real-time.
 } catch (error) {
 console.error('Error updating order status:', error);
 }
 };

 const toggleItemChecked = async (orderId: string, itemIdx: number) => {
 const orderChecks = checkedItems[orderId] || {};
 const newChecked = !orderChecks[itemIdx];
 const updated = { ...orderChecks, [itemIdx]: newChecked };
 setCheckedItems(prev => ({ ...prev, [orderId]: updated }));
 try {
 await updateDoc(doc(db, 'meat_orders', orderId), {
 [`checkedItems.${itemIdx}`]: newChecked,
 });
 } catch (e) {
 console.error('Error updating checkeditems', e);
 }
 };

 const handleAddProduct = async () => {
 if (!businessId) return;
 setAddingProduct(true);
 try {
 // EDIT MODE: Update existing product
 if (editingInlineProduct) {
 const ef = editFormFull;
 const updateData: Record<string, unknown> = {
 name: ef.name || customProductForm.name,
 price: parseFloat(ef.sellingPrice ?? customProductForm.price) || 0,
 sellingPrice: parseFloat(ef.sellingPrice ?? customProductForm.price) || 0,
 unit: ef.unit || customProductForm.unit || 'kg',
 defaultUnit: ef.unit || customProductForm.unit || 'kg',
 updatedAt: new Date(),
 };
 // Optional fields
 if (ef.brand !== undefined) updateData.brand = ef.brand;
 if (ef.description !== undefined) updateData.description = ef.description;
 if (ef.taxRate !== undefined) updateData.taxRate = parseFloat(ef.taxRate) || 7;
 if (ef.purchasePrice !== undefined) updateData.purchasePrice = parseFloat(ef.purchasePrice) || 0;
 if (ef.discountedPrice !== undefined) updateData.discountedPrice = parseFloat(ef.discountedPrice) || 0;
 if (ef.isActive !== undefined) updateData.isActive = ef.isActive;
 if (ef.outOfStock !== undefined) updateData.outOfStock = ef.outOfStock;
 if (ef.barcode !== undefined) updateData.barcode = ef.barcode;
 if (ef.category !== undefined) updateData.category = ef.category;
 // Stock & Supply fields
 if (ef.currentStock !== undefined) updateData.currentStock = parseInt(ef.currentStock) || 0;
 if (ef.minStock !== undefined) updateData.minStock = parseInt(ef.minStock) || 0;
 if (ef.reorderPoint !== undefined) updateData.reorderPoint = parseInt(ef.reorderPoint) || 0;
 if (ef.stockLocation !== undefined) updateData.stockLocation = ef.stockLocation;
 if (ef.supplierName !== undefined) updateData.supplierName = ef.supplierName;
 if (ef.batchNumber !== undefined) updateData.batchNumber = ef.batchNumber;
 if (ef.stockUnit !== undefined) updateData.stockUnit = ef.stockUnit;
 // Compliance & Quality fields
 if (ef.productionDate !== undefined) updateData.productionDate = ef.productionDate;
 if (ef.expirationDate !== undefined) updateData.expirationDate = ef.expirationDate;
 if (ef.allergens !== undefined) updateData.allergens = ef.allergens;
 if (ef.containsAlcohol !== undefined) updateData.containsAlcohol = ef.containsAlcohol;
 if (ef.additives !== undefined) updateData.additives = ef.additives;
 if (ef.nutritionPer100g !== undefined) {
 // Parse nutrition values as numbers for Firestore
 const raw = ef.nutritionPer100g;
 const parsed: Record<string, number> = {};
 for (const [k, v] of Object.entries(raw)) {
 const num = parseFloat(v as string);
 if (!isNaN(num)) parsed[k] = num;
 }
 updateData.nutritionPer100g = Object.keys(parsed).length > 0 ? parsed : {};
 }
 if (ef.certifications !== undefined) updateData.certifications = ef.certifications;
 if (ef.origin !== undefined) {
 updateData.origin = ef.origin;
 updateData.originCountry = ef.origin; // Keep in sync for cross-page compat
 }
 // Audit fields
 if (ef.internalNotes !== undefined) updateData.internalNotes = ef.internalNotes;
 if (ef.tags !== undefined) updateData.tags = ef.tags;
 // Channel pricing
 if (ef.appPrice !== undefined) updateData.appPrice = parseFloat(ef.appPrice) || 0;
 if (ef.eslPrice !== undefined) updateData.eslPrice = parseFloat(ef.eslPrice) || 0;
 if (ef.courierPrice !== undefined) updateData.courierPrice = parseFloat(ef.courierPrice) || 0;
 // ESL = Dükkan = Gel-Al: storePrice always syncs with eslPrice
 if (ef.eslPrice !== undefined) updateData.storePrice = parseFloat(ef.eslPrice) || 0;
 else if (ef.storePrice !== undefined) updateData.storePrice = parseFloat(ef.storePrice) || 0;
 // Product details
 if (ef.ingredients !== undefined) updateData.ingredients = ef.ingredients;
 if (ef.consumptionInfo !== undefined) updateData.consumptionInfo = ef.consumptionInfo;
 if (ef.specialInfo !== undefined) updateData.specialInfo = ef.specialInfo;
 if (ef.weight !== undefined) updateData.weight = ef.weight;
 if (ef.mhd !== undefined) updateData.mhd = ef.mhd;
 if (ef.packung !== undefined) updateData.packung = ef.packung;
 if (ef.artikelnummer !== undefined) updateData.artikelnummer = ef.artikelnummer;
 if (ef.storageTemp !== undefined) updateData.storageTemp = ef.storageTemp;
 if (ef.isFeatured !== undefined) updateData.isFeatured = ef.isFeatured;
 if (ef.brandLabels !== undefined) updateData.brandLabels = ef.brandLabels;
 await updateDoc(doc(db, `businesses/${businessId}/products`, editingInlineProduct.id), updateData);
 showToast(t('product_updated'), 'success');
 setProductModalOpen(false);
 setEditingInlineProduct(null);
 setEditFormFull({});
 setEditInlineTab('general');
 setCustomProductForm({ name: { tr: '' }, price: '', unit: 'kg', imageFile: null });
 loadProducts();
 return;
 }

 // ADD MODE: Create new product
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

 // 🆕 Load Platform Brands
 const loadPlatformBrands = useCallback(async () => {
 try {
 const snap = await getDocs(query(collection(db, 'platform_brands'), where('isActive', '==', true)));
 setPlatformBrands(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 } catch (error) {
 console.error("Error loading platform brands:", error);
 }
 }, []);

 useEffect(() => {
 if (admin) {
 loadBusiness();
 loadStaff();
 loadProducts(); // Load products when admin is ready
 loadSuppliers();
 loadSupplierOrders();
 loadPlatformBrands();
 }
 }, [admin, loadBusiness, loadStaff, loadProducts, loadSuppliers, loadSupplierOrders, loadPlatformBrands]);

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
 color: p.color || 'bg-muted border border-border text-foreground',
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
 activeBrandIds: formData.activeBrandIds || [],
 brandLabelActive: formData.brandLabelActive !== false,
 // 🔴 TUNA senkronizasyon: brand'den türet — mobile badge'i doğru syncler
 isTunaPartner: formData.brand === 'tuna',
 brandLabel: formData.brand || null, // legacy field - mobile da okuyor
 // 🔴 TUNA/Toros ürünleri satışı (Filtreleme için)
 sellsTunaProducts: formData.sellsTunaProducts ?? false,
 sellsTorosProducts: formData.sellsTorosProducts ?? false,
 // 🆕 Multi-type support: types array + legacy type field
 types: formData.types || [],
 type: formData.types?.[0] || "", // Legacy: ilk tür backward compat için
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
 // 🆕 Impressum / Rechtliche Angaben
 legalForm: formData.legalForm || "",
 managingDirector: formData.managingDirector || "",
 authorizedRepresentative: formData.authorizedRepresentative || "",
 registerCourt: formData.registerCourt || "",
 registerNumber: formData.registerNumber || "",
 address: {
 street: formData.street || "",
 postalCode: formData.postalCode || "",
 city: formData.city || "",
 country: formData.country || "DE",
 },
 shopPhone: formData.shopPhone || "",
 shopEmail: formData.shopEmail || "",
 openingHours: formData.openingHours
 ? formData.openingHours.split("\n").map((line: string) => {
 // Her satiri 24h formatina normalize et
 const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
 if (!match) return line.trim();
 const dayName = match[1].trim();
 const timePart = match[2].trim();
 const lower = timePart.toLowerCase();
 if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
 return `${dayName}: Closed`;
 }
 const sep = timePart.includes('\u2013') ? '\u2013' : '-';
 const parts = timePart.split(sep).map((p: string) => p.trim());
 if (parts.length >= 2) {
 return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
 }
 return line.trim();
 }).filter(Boolean)
 : [],
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
 offersDelivery: formData.supportsDelivery || false, // mirror for mobile app compatibility
 pickupEnabled: formData.pickupEnabled !== false,
 offersPickup: formData.pickupEnabled !== false, // mirror for mobile app compatibility
 rating: formData.rating || 0,
 reviewCount: formData.reviewCount || 0,
 reviews: Array.isArray(formData.reviews) ? formData.reviews : [], // Ensure not undefined
 deliveryPostalCode: formData.deliveryPostalCode || "",
 deliveryRadius: Number(formData.deliveryRadius) || 0,
 minDeliveryOrder: Number(formData.minDeliveryOrder) || 0,
 deliveryFee: Number(formData.deliveryFee) || 0,
 // 🆕 {t('gelismis')} Sipariş Saatleri
 deliveryStartTime: formData.deliveryStartTime || null,
 deliveryEndTime: formData.deliveryEndTime || null,
 pickupStartTime: formData.pickupStartTime || null,
 pickupEndTime: formData.pickupEndTime || null,
 deliveryHours: formData.deliveryHours
 ? formData.deliveryHours.split("\n").map((line: string) => {
 const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
 if (!match) return line.trim();
 const dayName = match[1].trim();
 const timePart = match[2].trim();
 const lower = timePart.toLowerCase();
 if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
 return `${dayName}: Closed`;
 }
 const sep = timePart.includes('\u2013') ? '\u2013' : '-';
 const parts = timePart.split(sep).map((p: string) => p.trim());
 if (parts.length >= 2) {
 return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
 }
 return line.trim();
 }).filter(Boolean)
 : [],
 pickupHours: formData.pickupHours
 ? formData.pickupHours.split("\n").map((line: string) => {
 const match = line.match(/^([a-zA-Z\u00c0-\u024F\s]+):\s*(.*)/);
 if (!match) return line.trim();
 const dayName = match[1].trim();
 const timePart = match[2].trim();
 const lower = timePart.toLowerCase();
 if (lower.includes('closed') || lower.includes('kapal') || lower.includes('geschlossen') || !timePart) {
 return `${dayName}: Closed`;
 }
 const sep = timePart.includes('\u2013') ? '\u2013' : '-';
 const parts = timePart.split(sep).map((p: string) => p.trim());
 if (parts.length >= 2) {
 return `${dayName}: ${normalizeTimeString(parts[0])} - ${normalizeTimeString(parts[1])}`;
 }
 return line.trim();
 }).filter(Boolean)
 : [],
 preOrderEnabled: formData.preOrderEnabled || false,
 freeDeliveryThreshold: Number(formData.freeDeliveryThreshold) || 0,
 // 🆕 Geçici Kurye Kapatma
 temporaryDeliveryPaused: formData.temporaryDeliveryPaused || false,
 temporaryPickupPaused: formData.temporaryPickupPaused || false,
 deliveryPauseUntil: formData.deliveryPauseUntil || null,
 pickupPauseUntil: formData.pickupPauseUntil || null,
 // 🆕 Masa Rezervasyonu
 hasReservation: formData.hasReservation || false,
 tableCapacity: Number(formData.tableCapacity) || 0,
 maxReservationTables: Number(formData.maxReservationTables) || 0,
 // 🆕 {t('gelismis')} Masa Yönetimi
 tables: formData.tables || [],
 tableSections: formData.tableSections || [],
 // 🆕 Yerinde Sipariş Ayarları
 dineInPaymentMode: formData.dineInPaymentMode || 'payLater',
 hasTableService: formData.hasTableService || false,
 groupOrderLinkEnabled: formData.groupOrderLinkEnabled || false,
 groupOrderTableEnabled: formData.groupOrderTableEnabled || false,
 // 🎁 Promosyon
 freeDrinkEnabled: formData.freeDrinkEnabled !== false,
 freeDrinkProducts: (formData as any).freeDrinkProducts ?? [],
 freeDrinkMinimumOrder: (formData as any).freeDrinkMinimumOrder ?? 0,
 acceptsCardPayment: formData.acceptsCardPayment || false,
 vatNumber: formData.vatNumber || "", // Added missing vatNumber
 imageUrl: downloadURL || "",
 googlePlaceId: formData.googlePlaceId || "",
 bankDetails: {
 iban: formData.bankIban || "",
 bic: formData.bankBic || "",
 accountHolder: formData.bankAccountHolder || "",
 bankName: formData.bankName || "",
				payoutBankDetails: {
					iban: formData.payoutBankIban || "",
					bic: formData.payoutBankBic || "",
					accountHolder: formData.payoutBankAccountHolder || "",
					bankName: formData.payoutBankName || "",
				},
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
 showToast(`${t('hata_prefix')}: ${errorMessage}`, "error");

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
 confirmText: newStatus ? t('aktif_et') : t('deaktifEt'),
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
 showToast(t('isletmeDurumDegisti'), "success");
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
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
 </div>
 );
 }

 // Show "not found" only if NOT creating new business
 if (!business && businessId !== 'new') {
 return (
 <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white">
 <p className="text-4xl mb-4"></p>
 <p>{t('isletmeBulunamadi')}</p>
 <Link
 href="/admin/business"
 className="text-blue-800 dark:text-blue-400 hover:underline mt-4"
 >
 {t('isletmeListesi')}
 </Link>
 </div>
 );
 }

 // Build dynamic planLabels from loaded plans
 const planLabels: Record<string, { label: string; color: string }> = { ...defaultPlanLabels };
 availablePlans.forEach(p => {
 planLabels[p.code] = { label: `LOKMA ${p.name}`, color: p.color || 'bg-muted border border-border text-foreground' };
 });
 const planInfo = planLabels[business?.subscriptionPlan || "none"] || { label: business?.subscriptionPlan || t('yok'), color: 'bg-muted border border-border text-foreground' };

 return (
 <div className="min-h-screen bg-background">
 {/* Toast */}
 {toast && (
 <div
 className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl border ${toast.type === "success" ? "bg-green-600/95 border-green-500/50" : "bg-red-600/95 border-red-500/50"} text-foreground text-sm font-medium backdrop-blur-sm flex items-center gap-2`}
 >
 <span>{toast.type === "success" ? "✓" : "✗"}</span>
 {toast.message}
 </div>
 )}

 {/* Header - Only Super Admin needs to navigate these tabs globally from here */}
 {admin?.adminType === 'super' && (
 <header className="bg-card border-b border-border sticky top-0 z-30">
 <div className="max-w-6xl mx-auto px-4 py-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Link
 href="/admin/business"
 className="text-muted-foreground hover:text-white"
 >
 {t('geri_buton')}
 </Link>
 <div>
 <h1 className="text-lg font-bold text-foreground">
 {businessId === 'new' ? t('yeniIsletmeEkle2') : (business?.companyName || t('isletmeDetayi'))}
 </h1>
 {business && (
 <p className="text-muted-foreground text-sm">
 {(business.shopPhone || business.contactPerson?.phone) && (
 <span className="mr-3"> {business.shopPhone || business.contactPerson?.phone}</span>
 )}
 <span>{business.address?.city}, {business.address?.country}</span>
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3">
 <ThemeToggle />
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
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "overview" ? "bg-red-600 text-white" : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"}`}
 >
 {t('dashboard')}
 </button>
 {admin?.adminType === 'super' && (
 <Link
 href={`/admin/business/${businessId}/performance`}
 className="px-3 py-1.5 rounded-lg text-sm font-medium transition bg-purple-600 text-white hover:bg-purple-500"
 >
 📈 {t('performans')}
 </Link>
 )}
 <button
 onClick={() => { setActiveTab("orders"); setShowSettingsDropdown(false); }}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "orders" ? "bg-red-600 text-white" : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"}`}
 >
 {t('siparisler')}{orders.length})
 </button>
 <button
 onClick={() => { setActiveTab("procurement"); setShowSettingsDropdown(false); }}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "procurement" ? "bg-red-600 text-white" : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"}`}
 >
 {t('tedarik')} ({supplierOrders.length})
 </button>
 <button
 onClick={() => { setActiveTab("reservations"); setShowSettingsDropdown(false); }}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === "reservations" ? "bg-red-600 text-white" : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"}`}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
 {t('masaRezervasyonlari')}
 </button>

 {/* Ayarlar Tab (Unified) */}
 <button
 onClick={() => { setActiveTab("settings"); setShowSettingsDropdown(false); }}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "settings" ? "bg-red-600 text-white" : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"}`}
 >
 {t('ayarlar')}
 </button>
 </div>
 </div>
 </header>
 )}

 <main className="max-w-6xl mx-auto px-4 py-6">
 {/* Overview Tab */}
 {activeTab === "overview" && (
 <div className="space-y-6">

 {/* Active Staff & Couriers Panel */}
 <div className="bg-card rounded-xl shadow-sm border border-border p-5">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-foreground font-bold">
 {t('aktif_personel_kuryeler')}
 </h3>
 <span className="text-green-800 dark:text-green-400 text-sm flex items-center gap-1">
 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
 {staffList.filter((s) => s.isActive !== false).length} {t('online_label')}
 </span>
 </div>

 {/* Online Staff Grid */}
 <div className="grid md:grid-cols-2 gap-4">
 {/* Mağaza Çalışanları */}
 <div className="bg-muted/30 dark:bg-muted/10 border border-border rounded-lg p-4">
 <h4 className="text-foreground text-sm font-medium mb-3 flex items-center gap-2">
 {t('magazaCalisanlari')}
 </h4>
 <div className="space-y-2">
 {staffList.filter((s) => s.isActive !== false).length ===
 0 ? (
 <p className="text-muted-foreground text-sm">
 {t('henuzAktifPersonelYok')}
 </p>
 ) : (
 staffList
 .filter((s) => s.isActive !== false)
 .map((staff) => (
 <div
 key={staff.id}
 className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 shadow-sm"
 >
 <div className="flex items-center gap-2">
 <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
 <span className="text-foreground text-sm">
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
 <div className="bg-muted/30 dark:bg-muted/10 border border-border rounded-lg p-4">
 <h4 className="text-foreground text-sm font-medium mb-3 flex items-center gap-2">
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
 <span className="text-foreground text-sm">
 {(order as any).driverName || (order as any).claimedByName || `${t('kurye_label')} ${idx + 1}`}
 </span>
 <p className="text-amber-800 dark:text-amber-400 text-xs">
 #{order.orderNumber || order.id.slice(0, 6)} → {order.customerName || t('musteri')}
 </p>
 </div>
 </div>
 <div className="text-right">
 <span className={`text-xs px-2 py-0.5 rounded ${order.status === 'onTheWay' ? 'bg-amber-600/50 text-amber-300' : 'bg-green-600/50 text-green-300'}`}>
 {order.status === 'onTheWay' ? t('yoldaEmoji') : t('hazir1')}
 </span>
 </div>
 </div>
 ));
 }
 return (
 <div className="text-center py-4">
 <p className="text-muted-foreground text-sm">
 {t('suAnDagitimdaKuryeYok')}
 </p>
 <p className="text-muted-foreground text-xs mt-1">
 {t('teslimatBasladigindaBuradaGorunecek')}
 </p>
 </div>
 );
 })()}
 </div>
 </div>
 </div>
 </div>

 {/* 🔴 NEW: Super Admin Parity - Quick Stats & Visual Order Workflow */}
 {(() => {
 const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "accepted");
 const preparingOrders = orders.filter((o) => o.status === "preparing");
 const readyOrders = orders.filter((o) => o.status === "ready");
 const inTransitOrders = orders.filter((o) => o.status === "onTheWay");
 const completedOrders = orders.filter((o) => o.status === "delivered" || o.status === "served");
 
 const stats = {
 total: orders.length,
 pending: pendingOrders.length,
 preparing: preparingOrders.length,
 ready: readyOrders.length,
 inTransit: inTransitOrders.length,
 completed: completedOrders.length,
 revenue: orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + (o.total || 0), 0),
 };
 
 return (
 <div className="space-y-6">
 {/* Quick Stats */}
 <div className="flex gap-2">
 <div className="bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-blue-900 dark:text-blue-300">{stats.total}</p>
 <p className="text-[10px] font-semibold text-blue-900/80 dark:text-blue-400">{t('toplamSiparis')}</p>
 </div>
 <div className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-yellow-800 dark:text-yellow-300">{stats.pending}</p>
 <p className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">{t('bekleyen')}</p>
 </div>
 <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-amber-800 dark:text-amber-300">{stats.preparing}</p>
 <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{t('hazirlanan')}</p>
 </div>
 <div className="bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 rounded-xl px-3 py-1.5 text-center shadow-sm">
 <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(stats.revenue, business?.currency)}</p>
 <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">{t('toplam_ciro')}</p>
 </div>
 </div>

 {/* Visual Order Status Workflow - Matching Super Admin Dashboard */}
 <div className="bg-card rounded-xl shadow-sm border border-border p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-foreground font-bold">
 {t('siparis_durumlari_anlik')}
 </h3>
 <span className="text-muted-foreground text-sm">
 {t('su_anki_siparisler')}
 </span>
 </div>

 <div className="flex items-center gap-2 overflow-x-auto pb-2">
 {/* Bekleyen - Yanıp söner */}
 <div className={`flex-1 min-w-[100px] bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-600 rounded-xl p-4 text-center relative shadow-sm ${stats.pending > 0 ? "animate-pulse" : ""}`}>
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-400 dark:bg-yellow-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className={`text-yellow-900 dark:text-yellow-400 text-3xl font-bold ${stats.pending > 0 ? "animate-bounce" : ""}`}>
 {stats.pending}
 </p>
 <p className="text-yellow-900/80 dark:text-yellow-300 text-sm font-semibold mt-1">
 🔔 {tOrders('workflow.pending')}
 </p>
 </div>
 <div className="text-muted-foreground text-xl">→</div>
 {/* Hazırlanıyor */}
 <div className="flex-1 min-w-[100px] bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-400 dark:bg-amber-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-amber-900 dark:text-amber-400 text-3xl font-bold">
 {stats.preparing}
 </p>
 <p className="text-amber-900/80 dark:text-amber-300 text-sm font-semibold mt-1">👨‍🍳 {tOrders('workflow.preparing')}</p>
 </div>
 <div className="text-muted-foreground text-xl">→</div>
 {/* Hazır */}
 <div className="flex-1 min-w-[100px] bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-400 dark:bg-green-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-green-900 dark:text-green-400 text-3xl font-bold">
 {stats.ready}
 </p>
 <p className="text-green-900/80 dark:text-green-300 text-sm font-semibold mt-1">📦 {tOrders('workflow.ready')}</p>
 </div>
 <div className="text-muted-foreground text-xl">→</div>
 {/* Yolda */}
 <div className="flex-1 min-w-[100px] bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-400 dark:bg-indigo-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-indigo-900 dark:text-indigo-400 text-3xl font-bold">
 {stats.inTransit}
 </p>
 <p className="text-indigo-900/80 dark:text-indigo-300 text-sm font-semibold mt-1">🛵 {tOrders('workflow.inTransit')}</p>
 </div>
 <div className="text-muted-foreground text-xl">→</div>
 {/* Tamamlanan */}
 <div className="flex-1 min-w-[100px] bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700/50 rounded-xl p-4 text-center relative shadow-sm">
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-400 dark:bg-emerald-500 rounded-full border-2 border-border shadow-sm"></div>
 <p className="text-emerald-900 dark:text-emerald-400 text-3xl font-bold">
 {stats.completed}
 </p>
 <p className="text-emerald-900/80 dark:text-emerald-300 text-sm font-semibold mt-1">✓ {tOrders('workflow.completed')}</p>
 </div>
 </div>
 {/* Timeline line */}
 <div className="relative mt-2 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 via-green-500 via-indigo-500 to-emerald-500 rounded-full opacity-50"></div>
 </div>
 </div>
 );
 })()}

 {/* Kanban Board - matches partner Bestellzentrum layout */}
 <div className="bg-card rounded-xl shadow-sm border border-border p-5">
 <div className="flex flex-col gap-3 mb-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <h3 className="text-foreground font-bold text-lg">
 {t('bestellzentrum')}
 </h3>
 {/* Compact Upcoming Reservation Chip */}
 {upcomingReservation && (
 <div
 onClick={() => setActiveTab('reservations')}
 className="cursor-pointer flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 rounded-full text-white text-xs font-semibold shadow-sm transition-all transform hover:scale-[1.02] border border-red-500/30"
 >
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-background"></span>
 </span>
 <span>
 🍽️ {upcomingReservation.customerName} - {(() => {
 const today = new Date();
 const resDate = new Date(upcomingReservation.reservationDate);
 const isToday = resDate.getDate() === today.getDate() && resDate.getMonth() === today.getMonth() && resDate.getFullYear() === today.getFullYear();
 const dateStr = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(resDate);
 return isToday ? (upcomingReservation.timeSlot || 'Bugün') : `${dateStr} ${upcomingReservation.timeSlot || ''}`;
 })()}
 </span>
 </div>
 )}
 </div>
 <span className="text-muted-foreground text-sm">
 {t('suAnkiSiparisler')}
 </span>
 </div>
 {/* Filters - identical to Bestellzentrum */}
 <div className="flex flex-wrap items-center gap-2">
 <select
 value={orderDateFilter}
 onChange={(e) => setOrderDateFilter(e.target.value as any)}
 className="px-3 py-1.5 bg-background text-foreground text-sm rounded-lg border border-border focus:ring-2 focus:ring-red-500 outline-none hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
 >
 <option value="today">{t('filter_heute')}</option>
 <option value="week">{t('filter_diese_woche')}</option>
 <option value="month">{t('filter_dieser_monat')}</option>
 <option value="all">{t('filter_alle')}</option>
 </select>

 <select
 value={orderStatusFilter}
 onChange={(e) => setOrderStatusFilter(e.target.value)}
 className="px-3 py-1.5 bg-background text-foreground text-sm rounded-lg border border-border focus:ring-2 focus:ring-red-500 outline-none hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
 >
 <option value="all">{t('filter_alle_status')}</option>
 <option value="pending">{t('order_pending')}</option>
 <option value="accepted">{t('filter_bestaetigt')}</option>
 <option value="preparing">{t('filter_in_zubereitung')}</option>
 <option value="ready">{t('filter_bereit')}</option>
 <option value="served">{t('filter_serviert')}</option>
 <option value="onTheWay">{t('onTheWay')}</option>
 <option value="delivered">{t('delivered')}</option>
 <option value="cancelled">{t('filter_storniert')}</option>
 </select>

 <select
 value={orderTypeFilter}
 onChange={(e) => setOrderTypeFilter(e.target.value)}
 className="px-3 py-1.5 bg-background text-foreground text-sm rounded-lg border border-border focus:ring-2 focus:ring-red-500 outline-none hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
 >
 <option value="all">{t('filter_alle_typen')}</option>
 <option value="pickup">{t('pickup_label')}</option>
 <option value="delivery">{t('delivery_label')}</option>
 <option value="dine_in">{t('filter_vor_ort')}</option>
 </select>
 </div>
 </div>

 {/* Apply filters - same logic as Bestellzentrum's filteredOrders */}
 {(() => {
 const filteredOrders = orders.filter(order => {
 if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) return false;
 const orderType = (order as any).orderType || (order as any).deliveryMethod || (order as any).deliveryType || (order as any).fulfillmentType || 'pickup';
 const normalizedType = orderType === 'dineIn' ? 'dine_in' : orderType;
 if (orderTypeFilter !== 'all' && normalizedType !== orderTypeFilter) return false;
 return true;
 });

 const pendingOrders = filteredOrders.filter(o => ['pending', 'accepted'].includes(o.status));
 const preparingOrders = filteredOrders.filter(o => o.status === 'preparing');
 const readyOrders = filteredOrders.filter(o => o.status === 'ready');
 const inTransitOrders = filteredOrders.filter(o => o.status === 'onTheWay');
 const completedOrders = filteredOrders.filter(o => ['delivered', 'served'].includes(o.status));

 const preOrders = pendingOrders.filter(o => (o as any).isScheduledOrder || (o as any).isPreOrder);
 const immediatePendingOrders = pendingOrders.filter(o => !(o as any).isScheduledOrder && !(o as any).isPreOrder);

 return (
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4" style={{ minHeight: '300px' }}>
 {/* Pending Column */}
 <div className="bg-yellow-50/50 dark:bg-card rounded-xl p-4 border border-yellow-200/50 dark:border-transparent">
 <h3 className="text-yellow-900 dark:text-yellow-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
 {tOrders('workflow.pending')} ({pendingOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 pb-2">
 {/* Immediate orders */}
 {immediatePendingOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={{ [business?.id || '']: business?.companyName || '' }} checkedItems={{}} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {immediatePendingOrders.length > 10 && (
 <p className="text-muted-foreground text-center text-sm mb-2">+{immediatePendingOrders.length - 10} {tOrders('kanban.more')}</p>
 )}
 {/* Pre-orders separator */}
 {preOrders.length > 0 && (
 <>
 <div className="flex items-center gap-2 pt-3 mb-2">
 <div className="flex-1 h-px bg-purple-500/30"></div>
 <span className="text-purple-800 dark:text-purple-400 text-xs font-medium whitespace-nowrap">🕐 {tOrders('preOrders')} ({preOrders.length})</span>
 <div className="flex-1 h-px bg-purple-500/30"></div>
 </div>
 {preOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={{ [business?.id || '']: business?.companyName || '' }} checkedItems={{}} onClick={() => setSelectedOrder(order)} t={t} isPreOrder />
 ))}
 {preOrders.length > 10 && (
 <p className="text-muted-foreground text-center text-sm mt-2">+{preOrders.length - 10} {tOrders('kanban.more')}</p>
 )}
 </>
 )}
 </div>
 </div>

 {/* Preparing Column */}
 <div className="bg-amber-50/50 dark:bg-card rounded-xl p-4 border border-amber-200/50 dark:border-transparent">
 <h3 className="text-amber-900 dark:text-amber-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-amber-400 rounded-full"></span>
 {tOrders('workflow.preparing')} ({preparingOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 pb-2">
 {preparingOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={{ [business?.id || '']: business?.companyName || '' }} checkedItems={{}} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {preparingOrders.length > 10 && (
 <p className="text-muted-foreground text-center text-sm mt-2">+{preparingOrders.length - 10} {tOrders('kanban.more')}</p>
 )}
 </div>
 </div>

 {/* Ready Column */}
 <div className="bg-green-50/50 dark:bg-card rounded-xl p-4 border border-green-200/50 dark:border-transparent">
 <h3 className="text-green-900 dark:text-green-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-green-400 rounded-full"></span>
 {tOrders('workflow.ready')} ({readyOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 pb-2">
 {readyOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={{ [business?.id || '']: business?.companyName || '' }} checkedItems={{}} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {readyOrders.length > 10 && (
 <p className="text-muted-foreground text-center text-sm mt-2">+{readyOrders.length - 10} {tOrders('kanban.more')}</p>
 )}
 </div>
 </div>

 {/* In Transit Column */}
 <div className="bg-indigo-50/50 dark:bg-card rounded-xl p-4 border border-indigo-200/50 dark:border-transparent">
 <h3 className="text-indigo-900 dark:text-indigo-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-indigo-400 rounded-full"></span>
 {tOrders('workflow.inTransit')} ({inTransitOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 pb-2">
 {inTransitOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={{ [business?.id || '']: business?.companyName || '' }} checkedItems={{}} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {inTransitOrders.length > 10 && (
 <p className="text-muted-foreground text-center text-sm mt-2">+{inTransitOrders.length - 10} {tOrders('kanban.more')}</p>
 )}
 </div>
 </div>

 {/* Completed Column */}
 <div className="bg-emerald-50/50 dark:bg-card rounded-xl p-4 border border-emerald-200/50 dark:border-transparent">
 <h3 className="text-emerald-900 dark:text-emerald-400 font-medium mb-4 flex items-center gap-2">
 <span className="w-3 h-3 bg-emerald-400 rounded-full"></span>
 {tOrders('workflow.completed')} ({completedOrders.length})
 </h3>
 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 pb-2">
 {completedOrders.slice(0, 10).map(order => (
 <OrderCard key={order.id} order={order} businesses={{ [business?.id || '']: business?.companyName || '' }} checkedItems={{}} onClick={() => setSelectedOrder(order)} t={t} />
 ))}
 {completedOrders.length > 10 && (
 <p className="text-muted-foreground text-center text-sm mt-2">+{completedOrders.length - 10} {tOrders('kanban.more')}</p>
 )}
 </div>
 </div>
 </div>
 );
 })()}
 </div>



 {/* Contact Info & Membership Details */}
 <div className="grid md:grid-cols-2 gap-4">
 {/* Contact Info */}
 <div className="bg-card rounded-xl shadow-sm border border-border p-5">
 <h3 className="text-foreground font-bold mb-4">
 {t('iletisimBilgileri')}
 </h3>
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-muted-foreground text-sm">{t('yetkiliKisi')}</p>
 <p className="text-foreground font-medium">
 {business?.contactPerson?.name
 ? `${business?.contactPerson?.name} ${business?.contactPerson?.surname || ""}`
 : t('belirtilmemis')}
 </p>
 <p className="text-xs text-muted-foreground">
 {business?.contactPerson?.role}
 </p>
 </div>
 <div>
 <p className="text-muted-foreground text-sm">{t('iletisim1')}</p>
 <p className="text-foreground">
 {business?.contactPerson?.phone ||
 business?.shopPhone ||
 t('belirtilmemis')}
 </p>
 <p className="text-xs text-blue-800 dark:text-blue-400 truncate">
 {business?.contactPerson?.email ||
 business?.shopEmail ||
 ""}
 </p>
 </div>
 </div>
 <div className="border-t border-border pt-3">
 <div className="flex justify-between items-center mb-2">
 <p className="text-muted-foreground text-sm">{t('calismaSaatleri2')}</p>
 {(() => {
 const activeHours = overviewHoursTab === 'gelal' ? business?.pickupHours : (overviewHoursTab === 'kurye' ? business?.deliveryHours : business?.openingHours);
 const status = checkShopStatus(activeHours || "");
 return (
 <span
 className={`text-xs px-2 py-0.5 rounded font-medium ${status.isOpen
 ? "bg-green-900/50 text-green-800 dark:text-green-400 border border-green-800"
 : "bg-red-900/50 text-red-800 dark:text-red-400 border border-red-800"
 }`}
 >
 {status.text}
 </span>
 );
 })()}
 </div>
 {/* Tabs for Opening Hours */}
 {(() => {
 const hasPickup = (business?.pickupHours && business.pickupHours.length > 0) || business?.pickupStartTime;
 const hasDelivery = (business?.deliveryHours && business.deliveryHours.length > 0) || business?.deliveryStartTime;
 return (hasPickup || hasDelivery) ? (
 <div className="flex w-full bg-background/50 rounded-lg p-1 mb-3">
 <button
 onClick={() => setOverviewHoursTab('genel')}
 className={`flex-1 py-1 text-xs font-medium rounded-md transition ${overviewHoursTab === 'genel' ? 'bg-foreground text-background shadow-md shadow' : 'text-muted-foreground hover:text-foreground'}`}
 >
 Genel
 </button>
 {hasPickup && (
 <button
 onClick={() => setOverviewHoursTab('gelal')}
 className={`flex-1 py-1 text-xs font-medium rounded-md transition ${overviewHoursTab === 'gelal' ? 'bg-foreground text-background shadow-md shadow' : 'text-muted-foreground hover:text-foreground'}`}
 >
 Gel-Al
 </button>
 )}
 {hasDelivery && (
 <button
 onClick={() => setOverviewHoursTab('kurye')}
 className={`flex-1 py-1 text-xs font-medium rounded-md transition ${overviewHoursTab === 'kurye' ? 'bg-foreground text-background shadow-md shadow' : 'text-muted-foreground hover:text-foreground'}`}
 >
 Kurye
 </button>
 )}
 </div>
 ) : null;
 })()}
 {(() => {
 const activeHours = overviewHoursTab === 'gelal' ? business?.pickupHours : (overviewHoursTab === 'kurye' ? business?.deliveryHours : business?.openingHours);
 const hoursData = activeHours || (overviewHoursTab === 'genel' ? business?.openingHours : null);

 // For Gel-Al / Kurye tabs: if no per-day hours, show simple start-end time
 if (overviewHoursTab === 'gelal' && (!business?.pickupHours || business.pickupHours.length === 0)) {
 const start = business?.pickupStartTime || '';
 const end = business?.pickupEndTime || '';
 if (start || end) {
 return (
 <div className="text-xs text-foreground bg-card/50 rounded-lg p-3 space-y-1">
 <div className="flex justify-between"><span className="text-muted-foreground">{t('gelAlBaslangic')}:</span><span>{start || '-'}</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">{t('gelAlBitis')}:</span><span>{end || '-'}</span></div>
 <p className="text-muted-foreground italic mt-2">{t('acikSaatleriIcinAyarlaraGidin') || 'Detayli gun bazli saatler icin Ayarlar > Acilis Saatleri bolumune gidin'}</p>
 </div>
 );
 }
 }
 if (overviewHoursTab === 'kurye' && (!business?.deliveryHours || business.deliveryHours.length === 0)) {
 const start = business?.deliveryStartTime || '';
 const end = business?.deliveryEndTime || '';
 if (start || end) {
 return (
 <div className="text-xs text-foreground bg-card/50 rounded-lg p-3 space-y-1">
 <div className="flex justify-between"><span className="text-muted-foreground">{t('kuryeBaslangic')}:</span><span>{start || '-'}</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">{t('kuryeBitis')}:</span><span>{end || '-'}</span></div>
 <p className="text-muted-foreground italic mt-2">{t('acikSaatleriIcinAyarlaraGidin') || 'Detayli gun bazli saatler icin Ayarlar > Acilis Saatleri bolumune gidin'}</p>
 </div>
 );
 }
 }

 const hoursList = Array.isArray(hoursData)
 ? hoursData
 : (hoursData || "").split("\n");

 return hoursList.length > 0 && hoursList[0] !== "" ? (
 <ul className="space-y-1">
 {hoursList.map((line: string, i: number) => {
 const today = new Date().toLocaleDateString("de-DE", { weekday: "long" });
 const dayName = line.split(":")[0]?.trim();
 // Simple match check, can be improved if needed
 const isToday = dayName === today || (today === "Pazar" && dayName === "Pazar");

 return (
 <li
 key={i}
 className={`text-xs flex justify-between px-2 py-1 rounded ${isToday
 ? "bg-green-900/20 text-green-300 font-medium border border-green-800/30"
 : "text-foreground"
 }`}
 >
 <span className={isToday ? "text-green-800 dark:text-green-400" : "font-medium text-muted-foreground"}>
 {line.split(": ")[0]}
 </span>
 <span>{line.split(": ")[1]}</span>
 </li>
 );
 })}
 </ul>
 ) : (
 <span className="text-xs text-muted-foreground italic">
 {t('bilgi_yok')}
 </span>
 );
 })()}
 </div>
 <div className="border-t border-border pt-3">
 <p className="text-muted-foreground text-sm">{t('adres_label')}</p>
 <p className="text-foreground">
 {business?.address?.street}, {business?.address?.postalCode}{" "}
 {business?.address?.city}
 </p>
 <p className="text-muted-foreground text-xs mt-1">
 {business?.address?.country}
 </p>
 </div>
 </div>
 </div>

 {/* Subscription & Membership Status */}
 <div className="bg-card rounded-xl shadow-sm border border-border p-5">
 <h3 className="text-foreground font-bold mb-4">
 {t('uyelikAbonelik')}
 </h3>
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-muted-foreground text-sm">{t('mevcut_plan')}</p>
 <div className="flex items-center gap-2 mt-1">
 <span
 className={`w-3 h-3 rounded-full ${planInfo.color}`}
 ></span>
 <span className="text-foreground font-medium">
 {planInfo.label}
 </span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 {(business?.monthlyFee ?? 0) > 0
 ? `${formatCurrency(business?.monthlyFee || 0, business?.currency)}/ay`
 : t('ucretsiz')}
 </p>
 </div>
 <div>
 <p className="text-muted-foreground text-sm">{t('durum')}</p>
 <span
 className={`inline-block mt-1 px-2 py-1 rounded text-xs ${business?.isActive ? "bg-green-600/20 text-green-800 dark:text-green-400" : "bg-red-600/20 text-red-800 dark:text-red-400"}`}
 >
 {business?.isActive ? t('aktifMusteri') : t('pasifMusteri')}
 </span>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
 <div>
 <p className="text-muted-foreground text-sm">{t('musteriTarihi')}</p>
 <p className="text-foreground">
 {(business as any).createdAt?.toDate
 ? (business as any).createdAt
 .toDate()
 .toLocaleDateString("de-DE")
 : t('belirtilmemis')}
 </p>
 </div>
 <div>
 <p className="text-muted-foreground text-sm">{t('planBaslangic')}</p>
 <p className="text-foreground">
 {(business?.subscriptionStartDate as any)?.toDate
 ? (business?.subscriptionStartDate as any)
 .toDate()
 .toLocaleDateString("de-DE")
 : business?.subscriptionStartDate
 ? new Date(
 business?.subscriptionStartDate,
 ).toLocaleDateString("de-DE")
 : t('belirtilmemis')}
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}




 {/* ADD PRODUCT MODAL (add-only, not edit) */}
 {
 productModalOpen && !editingInlineProduct && (
 <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
 <div className="bg-card rounded-xl w-full max-w-lg overflow-hidden border border-border">
 <div className="p-4 border-b border-border flex justify-between items-center">
 <h3 className="text-foreground font-bold">{t('urunEkle')}</h3>
 <button onClick={() => setProductModalOpen(false)} className="text-muted-foreground hover:text-white">✕</button>
 </div>

 {/* Tabs */}
 <div className="flex border-b border-border">
 <button
 onClick={() => setProductMode('standard')}
 className={`flex-1 py-3 text-sm font-medium ${productMode === 'standard' ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:bg-muted/40 dark:bg-muted/10 border-border"}`}
 >
 {t('hizliSecStandart')}
 </button>
 <button
 onClick={() => setProductMode('custom')}
 className={`flex-1 py-3 text-sm font-medium ${productMode === 'custom' ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:bg-muted/40 dark:bg-muted/10 border-border"}`}
 >
 {t('ozelUrunTalep')}
 </button>
 </div>

 <div className="p-6">
 {productMode === 'standard' ? (
 <div className="space-y-4">
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('urunSecin')}</label>
 <select
 value={selectedMasterId}
 onChange={(e) => setSelectedMasterId(e.target.value)}
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
 >
 <option value="">{t('seciniz')}</option>
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
 <label className="text-muted-foreground text-sm block mb-1">{t('satisFiyati')}</label>
 <input
 type="number"
 value={customProductForm.price}
 onChange={(e) => setCustomProductForm({ ...customProductForm, price: e.target.value })}
 placeholder="0.00"
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
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
 <label className="text-muted-foreground text-sm block mb-1">{t('price_eur') || "Fiyat (€)"}</label>
 <input
 type="number"
 value={customProductForm.price}
 onChange={(e) => setCustomProductForm({ ...customProductForm, price: e.target.value })}
 placeholder="0.00"
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
 />
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('birim')}</label>
 <select
 value={customProductForm.unit}
 onChange={(e) => setCustomProductForm({ ...customProductForm, unit: e.target.value })}
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
 >
 <option value="kg">{t('kg') || "Kg"}</option>
 <option value="ad">{t('adet')}</option>
 <option value="pk">{t('paket')}</option>
 </select>
 </div>
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('fotograf')}</label>
 <input
 type="file"
 accept="image/*"
 onChange={(e) => {
 if (e.target.files?.[0]) {
 setCustomProductForm({ ...customProductForm, imageFile: e.target.files[0] });
 }
 }}
 className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
 />
 </div>
 <div className="bg-yellow-900/20 text-yellow-500 p-3 rounded-lg text-xs">
 {t('ozelUrunlerAdminOnayindanSonraYayina')}
 </div>
 </div>
 )}
 </div>

 <div className="p-4 bg-muted/40 dark:bg-muted/10 border-border flex justify-end gap-3">
 <button
 onClick={() => setProductModalOpen(false)}
 className="px-4 py-2 text-muted-foreground hover:text-white"
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
 <div className="bg-card rounded-xl overflow-hidden">
 <div className="p-4 border-b border-border flex justify-between items-center">
 <h3 className="text-foreground font-bold">{t('sonSiparisler')}</h3>
 <Link
 href={`/admin/business/${business?.id}/orders`}
 className="text-blue-800 dark:text-blue-400 hover:underline text-sm"
 >
 {t('tumunuGor')}
 </Link>
 </div>
 {orders.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <p className="text-4xl mb-4"></p>
 <p>{t('henuzSiparisYok')}</p>
 </div>
 ) : (
 <div className="space-y-3 p-4">
 {orders.slice(0, 10).map((order) => (
 <OrderCard
 key={order.id}
 order={order}
 businesses={{ [business?.id || '']: business?.companyName || '' }}
 checkedItems={{}}
 t={t}
 onClick={() => setSelectedOrder(order)}
 />
 ))}
 </div>
 )}
 </div>
 )
 }

 {/* Procurement Tab */}
 {
 activeTab === "procurement" && (
 <LockedModuleOverlay featureKey="supplyChain">
 <div className="space-y-4">
 {/* Sub-tabs */}
 <div className="flex gap-2 mb-4">
 <button
 onClick={() => setProcurementSubTab('orders')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${procurementSubTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm'}`}
 >
 {t('procurement_orders')} ({supplierOrders.length})
 </button>
 <button
 onClick={() => setProcurementSubTab('suppliers')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${procurementSubTab === 'suppliers' ? 'bg-blue-600 text-white' : 'bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm'}`}
 >
 {t('procurement_suppliers')} ({suppliers.length})
 </button>
 </div>

 {/* ═══ SUPPLIERS LIST ═══ */}
 {procurementSubTab === 'suppliers' && (
 <div className="bg-card rounded-xl overflow-hidden">
 <div className="p-4 border-b border-border flex justify-between items-center">
 <h3 className="text-foreground font-bold">{t('procurement_suppliers')}</h3>
 <button
 onClick={() => {
 setEditingSupplier(null);
 setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '', taxId: '', paymentTerms: '', deliveryDays: '', minOrderValue: '', notes: '', isActive: true });
 setShowSupplierModal(true);
 }}
 className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium"
 >
 {t('procurement_supplier_add')}
 </button>
 </div>
 {loadingSuppliers ? (
 <div className="text-center py-12 text-muted-foreground">
 <span className="animate-spin inline-block"></span> {t('procurement_loading')}
 </div>
 ) : suppliers.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <p className="text-4xl mb-4"></p>
 <p>{t('henuz_tedarikci_eklenmemis')}</p>
 <p className="text-sm mt-1">{t('toptancilari_ekleyerek_takip')}</p>
 </div>
 ) : (
 <div className="divide-y divide-border">
 {suppliers.map((supplier: any) => (
 <div key={supplier.id} className="p-4 hover:bg-muted/40 dark:bg-muted/10 border-border flex items-center justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-3">
 <span className="text-lg"></span>
 <div>
 <p className="text-foreground font-semibold">{supplier.name}</p>
 <div className="flex gap-4 text-xs text-muted-foreground mt-1">
 {supplier.contactPerson && <span>{supplier.contactPerson}</span>}
 {supplier.phone && <span>{supplier.phone}</span>}
 {supplier.email && <span>{supplier.email}</span>}
 {supplier.deliveryDays && <span>🚚 {supplier.deliveryDays} gün</span>}
 {supplier.paymentTerms && <span>💳 {supplier.paymentTerms}</span>}
 </div>
 </div>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 setEditingSupplier(supplier);
 setSupplierForm({
 name: supplier.name || '',
 contactPerson: supplier.contactPerson || '',
 phone: supplier.phone || '',
 email: supplier.email || '',
 address: supplier.address || '',
 taxId: supplier.taxId || '',
 paymentTerms: supplier.paymentTerms || '',
 deliveryDays: supplier.deliveryDays || '',
 minOrderValue: supplier.minOrderValue || '',
 notes: supplier.notes || '',
 isActive: supplier.isActive !== false,
 });
 setShowSupplierModal(true);
 }}
 className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
 >
 Düzenle
 </button>
 <button
 onClick={() => deleteSupplier(supplier.id)}
 className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-300 rounded text-xs"
 >
 
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* ═══ SUPPLIER ORDERS LIST ═══ */}
 {procurementSubTab === 'orders' && (
 <div className="bg-card rounded-xl overflow-hidden">
 <div className="p-4 border-b border-border flex justify-between items-center">
 <h3 className="text-foreground font-bold">{t('procurement_orders')}</h3>
 <button
 onClick={() => {
 if (suppliers.length === 0) {
 showToast(t('procurement_add_supplier_first'), 'error');
 setProcurementSubTab('suppliers');
 return;
 }
 setEditingOrder(null);
 setOrderForm({
 supplierId: suppliers[0]?.id || '',
 supplierName: suppliers[0]?.name || '',
 status: 'draft',
 expectedDeliveryDate: '',
 notes: '',
 invoiceNumber: '',
 items: [{ productId: '', productName: '', sku: '', orderedQuantity: 1, receivedQuantity: 0, unit: 'kg', purchasePrice: 0, batchNumber: '', productionDate: '', expirationDate: '' }]
 });
 setShowOrderModal(true);
 }}
 className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium"
 >
 {t('procurement_new_order')}
 </button>
 </div>
 {loadingSupplierOrders ? (
 <div className="text-center py-12 text-muted-foreground">
 <span className="animate-spin inline-block"></span> {t('procurement_loading')}
 </div>
 ) : supplierOrders.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <p className="text-4xl mb-4"></p>
 <p>{t('henuz_tedarik_siparisi_yok')}</p>
 <p className="text-sm mt-1">{t('toptancilardan_siparisleri_takip')}</p>
 </div>
 ) : (
 <table className="w-full text-left">
 <thead className="bg-muted/40 dark:bg-muted/10 border-border text-muted-foreground text-sm">
 <tr>
 <th className="px-4 py-3">{t('siparis_no')}</th>
 <th className="px-4 py-3">{t('tedarikci')}</th>
 <th className="px-4 py-3">{t('urunler_th')}</th>
 <th className="px-4 py-3">{t('tutar')}</th>
 <th className="px-4 py-3">{t('durum_th')}</th>
 <th className="px-4 py-3">{t('tarih_th')}</th>
 <th className="px-4 py-3">{t('islem_th')}</th>
 </tr>
 </thead>
 <tbody className="text-foreground">
 {supplierOrders.map((order: any) => {
 const statusColors: any = {
 draft: 'bg-muted border border-border text-foreground text-gray-200',
 ordered: 'bg-blue-600 text-blue-100',
 partiallyDelivered: 'bg-yellow-600 text-yellow-100',
 delivered: 'bg-green-600 text-green-100',
 cancelled: 'bg-red-600 text-red-100',
 };
 const statusLabels: any = {
 draft: t('procurement_status_draft'),
 ordered: t('procurement_status_ordered'),
 partiallyDelivered: t('procurement_status_partial'),
 delivered: t('procurement_status_delivered'),
 cancelled: ` ${t('iptal')}`,
 };
 return (
 <tr key={order.id} className="border-t border-border hover:bg-muted/40 dark:bg-muted/10 border-border">
 <td className="px-4 py-3 font-mono text-sm text-blue-800 dark:text-blue-400">{order.orderNumber}</td>
 <td className="px-4 py-3">{order.supplierName}</td>
 <td className="px-4 py-3 text-sm text-muted-foreground">{order.items?.length || 0} {t('procurement_items_count')}</td>
 <td className="px-4 py-3 font-semibold">{formatCurrency(order.totalAmount || 0, order.currency || 'EUR')}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded text-xs ${statusColors[order.status] || 'bg-muted border border-border text-foreground'}`}>
 {statusLabels[order.status] || order.status}
 </span>
 </td>
 <td className="px-4 py-3 text-muted-foreground text-sm">
 {order.orderDate?.toDate?.()?.toLocaleDateString('de-DE') || order.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || '—'}
 </td>
 <td className="px-4 py-3">
 <div className="flex gap-1">
 {(order.status === 'ordered' || order.status === 'partiallyDelivered') && (
 <button
 onClick={() => {
 setGoodsReceiptOrder({ ...order, items: order.items.map((it: any) => ({ ...it })) });
 setShowGoodsReceiptModal(true);
 }}
 className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs"
 >
 {t('procurement_goods_receipt')}
 </button>
 )}
 {order.status === 'draft' && (
 <button
 onClick={async () => {
 await updateDoc(doc(db, 'businesses', businessId, 'supplierOrders', order.id), { status: 'ordered', updatedAt: serverTimestamp() });
 showToast(t('procurement_order_marked'), 'success');
 loadSupplierOrders();
 }}
 className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
 >
 {t('procurement_place_order')}
 </button>
 )}
 <button
 onClick={() => {
 setEditingOrder(order);
 setOrderForm({
 supplierId: order.supplierId,
 supplierName: order.supplierName,
 status: order.status,
 expectedDeliveryDate: order.expectedDeliveryDate || '',
 notes: order.notes || '',
 invoiceNumber: order.invoiceNumber || '',
 items: order.items?.map((it: any) => ({ ...it })) || [],
 });
 setShowOrderModal(true);
 }}
 className="px-2 py-1 bg-muted border border-border text-foreground hover:bg-gray-500 text-white rounded text-xs"
 >
 
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 )}
 </div>
 )}
 </div>
 </LockedModuleOverlay>
 )
 }

 {/* Settings Tab (Unified Layout) */}
 {
 activeTab === "settings" && (
 <div className="flex flex-col md:flex-row gap-6 mt-4 w-full h-full">
 {/* Left Sidebar Menu */}
 <div className="w-full md:w-64 flex-shrink-0 bg-card rounded-xl border border-border p-3 h-fit sticky top-24 shadow-sm">
 <h3 className="text-lg font-bold text-foreground mb-4 px-3 flex items-center justify-between">
 {t('ayarlar')}
 </h3>
 <nav className="flex flex-col gap-1">
 {([
 { key: "isletme", label: t('isletme'), icon: <Store className="w-5 h-5"/> },
 { key: "menu", label: t('menuUrunler'), icon: <Utensils className="w-5 h-5"/> },
 // { key: "personel", label: t('personel_label'), icon: <Users className="w-5 h-5"/>, featureKey: "staffShiftTracking" },
 // "masa" (Table Mgmt) was moved to Reservations tab
 { key: "abonelik", label: t('abonelikPlani'), icon: <Star className="w-5 h-5"/> },
 { key: "odeme", label: t('odemeBilgileri'), icon: <CreditCard className="w-5 h-5"/> },
 { key: "promosyon", label: t('promosyon_label'), icon: <Gift className="w-5 h-5"/>, featureKey: "promotions" },
									{ key: "teslimat", label: t('teslimatAyarlari'), icon: <Truck className="w-5 h-5"/> },
									{ key: "saatler", label: t('acilisSaatleri'), icon: <Clock className="w-5 h-5"/> },
 
 ] as { key: string; label: string; icon: React.ReactNode; featureKey?: string }[]).map((item) => {
 const isGated = item.featureKey && !planFeatures[item.featureKey] && admin?.adminType !== 'super';
 if (isGated) return null; // Hide gated features in sidebar to keep UI clean, or show with lock
 return (
 <button
 key={item.key}
 onClick={() => setSettingsSubTab(item.key as any)}
 className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition text-left w-full ${
 settingsSubTab === item.key
 ? "bg-red-600/10 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium"
 : "text-foreground hover:bg-muted"
 }`}
 >
 <span className="opacity-80 flex items-center justify-center">{item.icon}</span>
 <span className="font-medium">{item.label}</span>
 </button>
 );
 })}
 </nav>
 </div>

 {/* Right Content Pane */}
 <div className="flex-1 w-full flex flex-col min-w-0">
 <div className="mb-6">
 {/* Settings Sub-Tab Header */}
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-foreground font-bold text-2xl flex items-center gap-3">
 {settingsSubTab === "isletme" && t('isletmeAyarlari')}
 {settingsSubTab === "menu" && t('menuUrunler')}
 {settingsSubTab === "personel" && t('personelYonetimi')}
 {settingsSubTab === "abonelik" && t('abonelikPlani1')}
 {settingsSubTab === "odeme" && t('odemeBilgileri1')}
 {settingsSubTab === "promosyon" && t('promosyonAyarlari')}
 {settingsSubTab === "marketing" && t('marketing_boost')}
 </h3>
 <div className="flex items-center gap-3">
 {/* Kurye Aktif/Deaktif Toggle - only in İşletme > Teslimat tab */}
 {settingsSubTab === "teslimat" && formData.supportsDelivery && (planFeatures.delivery || admin?.adminType === 'super') && (
 <button
 onClick={async () => {
 const newValue = !formData.temporaryDeliveryPaused;
 try {
 await updateDoc(doc(db, "businesses", businessId), {
 temporaryDeliveryPaused: newValue,
 deliveryPauseUntil: null,
 });
 await addDoc(collection(db, "businesses", businessId, "deliveryPauseLogs"), {
 action: newValue ? "paused" : "resumed",
 type: 'delivery',
 timestamp: serverTimestamp(),
 adminEmail: admin?.email || "unknown",
 adminId: admin?.id || "unknown",
 adminName: (admin as any)?.name || (admin as any)?.displayName || admin?.email || "unknown",
 });
 setFormData({ ...formData, temporaryDeliveryPaused: newValue, deliveryPauseUntil: null });
 showToast(newValue ? t('kurye_hizmeti_durduruldu') : t('kurye_hizmeti_aktif'), "success");
 } catch (e) {
 showToast(t('hataOlustu1'), "error");
 }
 }}
 className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 shadow-lg ${formData.temporaryDeliveryPaused
 ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white ring-2 ring-amber-400/50"
 : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500"
 }`}
 >
 🛵 {formData.temporaryDeliveryPaused ? t('kurye_durduruldu') : t('kurye_aktif')}
 </button>
 )}
 {settingsSubTab === "teslimat" && (planFeatures.pickup || admin?.adminType === 'super') && (
 <button
 onClick={async () => {
 const newValue = !formData.temporaryPickupPaused;
 try {
 await updateDoc(doc(db, "businesses", businessId), {
 temporaryPickupPaused: newValue,
 pickupPauseUntil: null,
 });
 await addDoc(collection(db, "businesses", businessId, "deliveryPauseLogs"), {
 action: newValue ? "paused" : "resumed",
 type: 'pickup',
 timestamp: serverTimestamp(),
 adminEmail: admin?.email || "unknown",
 });
 setFormData({ ...formData, temporaryPickupPaused: newValue, pickupPauseUntil: null });
 showToast(newValue ? t('gelAlDurduruldu') : t('gelAlAktifToast'), "success");
 } catch (e) {
 showToast(t('hataOlustu1'), "error");
 }
 }}
 className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 shadow-lg ${formData.temporaryPickupPaused
 ? "bg-gradient-to-r from-red-500 to-red-600 text-white ring-2 ring-red-400/50"
 : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500"
 }`}
 >
 🛍️ {formData.temporaryPickupPaused ? t('gelAlDurduruldu') : t('gelAlAktif')}
 </button>
 )}
 {/* İşletme Faaliyetlerini Durdur — Super Admin Only */}
 {business && settingsSubTab === "isletme" && admin?.adminType === 'super' && (
 <button
 onClick={toggleActiveStatus}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${business.isActive
 ? "bg-muted text-red-800 dark:text-red-400 border border-red-500/30 hover:bg-red-900/30 hover:border-red-500/60"
 : "bg-muted text-green-800 dark:text-green-400 border border-green-500/30 hover:bg-green-900/30 hover:border-green-500/60"
 }`}
 >
 {business.isActive ? t('tumFaaliyetleriDurdur') : t('aktif_et')}
 </button>
 )}
 {/* Tüm isletme tab'ları: Düzenle / İptal / Kaydet */}
 {settingsSubTab === 'isletme' && (
 <>
 {!isEditing ? (
 <button
 onClick={() => setIsEditing(true)}
 className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium transition flex items-center gap-2"
 >
 ✏️ {t('duzenle') || 'Düzenle'}
 </button>
 ) : (
 <>
 <button
 onClick={() => setIsEditing(false)}
 className="px-4 py-2 bg-muted border border-border text-foreground text-white rounded-lg hover:bg-gray-500 font-medium transition text-sm"
 >
 {t('iptal1') || 'İptal'}
 </button>
 <button
 onClick={handleSave}
 disabled={saving}
 className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 font-medium transition"
 >
 {saving ? '...' : t('kaydet')}
 </button>
 </>
 )}
 </>
 )}
 </div>
 </div>

 {/* Sub-Tab: İşletme */}
						{(settingsSubTab === "isletme" || settingsSubTab === "teslimat" || settingsSubTab === "saatler") && (
 <>
 {/* Internal Tab Bar for İşletme */}
 {settingsSubTab === "isletme" && (
							<div className="flex gap-2 border-b border-border pb-3 mb-6 flex-wrap">
 {[
 { id: "bilgiler" as const, label: t('isletmeBilgileri') },
 { id: "fatura" as const, label: t('fatura_adresi') },
 
 { id: "gorseller" as const, label: t('gorseller') },
 
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => setIsletmeInternalTab(tab.id)}
 className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${isletmeInternalTab === tab.id
 ? "bg-red-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>

       )}
 {/* ═══════ Tab 1: İşletme Bilgileri ═══════ */}
 {settingsSubTab === "isletme" && isletmeInternalTab === "bilgiler" && (
 <div className="space-y-6">
 {/* Şirket Adı */}
 <div>
 <label className="text-muted-foreground text-sm">{t('sirketAdi')}</label>
 <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 {/* Mutfak Türü */}
 <div>
 <label className="text-muted-foreground text-sm">{t('mutfakTuruAltBaslik')}</label>
 <input type="text" value={formData.cuisineType} onChange={(e) => setFormData({ ...formData, cuisineType: e.target.value })} disabled={!isEditing} placeholder={t('ornKebapDonerTurkisch')} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 <p className="text-xs text-muted-foreground mt-1">{t('kartlardaIsletmeAdiAltindaGosterilir')}</p>
 </div>
 {/* İşletme Türleri */}
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('isletmeTurleri')}</label>
 <select
 value={formData.types?.[0] || 'restaurant'}
 onChange={(e) => setFormData({ ...formData, types: [e.target.value] })}
 disabled={!isEditing}
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50"
 >
 {dynamicSectorTypes.map((sector) => (
 <option key={sector.id} value={sector.id}>{sector.label}</option>
 ))}
 </select>
 </div>
 {/* Müşteri No */}
 <div>
 <label className="text-muted-foreground text-sm">{t('musteriNo')}</label>
 <input type="text" value={formData.customerId} readOnly disabled={true} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 opacity-50 cursor-not-allowed" />
 <p className="text-xs text-muted-foreground mt-1">{t('musteriNoDegistirilemez')}</p>
 </div>
 
 {/* Adres */}
 <div className="space-y-4 pt-4 border-t border-border">
 <h4 className="text-foreground font-medium pb-2"> {t('adres_baslik')}</h4>
 <div>
 <label className="text-muted-foreground text-sm">{t('sokakCadde')}</label>
 <input type="text" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="text-muted-foreground text-sm">{t('postaKodu')}</label>
 <input type="text" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('sehir1')}</label>
 <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 <div className="mt-4">
 <label className="text-muted-foreground text-sm">{t('ulke') || 'Ülke'}</label>
 <select value={formData.country || 'DE'} onChange={(e) => setFormData({ ...formData, country: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50">
 <option value="DE">Deutschland</option>
 <option value="TR">Türkiye</option>
 <option value="AT">Österreich</option>
 <option value="CH">Schweiz</option>
 <option value="NL">Niederlande</option>
 <option value="FR">Frankreich</option>
 <option value="BE">Belgien</option>
 </select>
 </div>
 </div>
 {/* İletişim */}
 <div className="space-y-4 pt-4 border-t border-border">
 <h4 className="text-foreground font-medium pb-2">{t('iletisim')}</h4>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-sm">{t('telefon_label')}</label>
 <input type="tel" value={formData.shopPhone || ''} onChange={(e) => setFormData({ ...formData, shopPhone: e.target.value })} disabled={!isEditing} placeholder="+49..." className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('ePosta')}</label>
 <input type="email" value={formData.shopEmail || ''} onChange={(e) => setFormData({ ...formData, shopEmail: e.target.value })} disabled={!isEditing} placeholder="info@example.com" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('webSitesi')}</label>
 <input type="url" value={formData.website || ''} onChange={(e) => setFormData({ ...formData, website: e.target.value })} disabled={!isEditing} placeholder="https://www.example.com" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 {/* Sosyal Medya */}
 <div className="space-y-4 pt-4 border-t border-border">
 <h4 className="text-foreground font-medium pb-2">📱 {t('sosyalMedya')}</h4>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-sm">{t('instagram')}</label>
 <input type="text" value={formData.instagram || ''} onChange={(e) => setFormData({ ...formData, instagram: e.target.value })} disabled={!isEditing} placeholder="@kullaniciadi" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">📘 Facebook</label>
 <input type="text" value={formData.facebook || ''} onChange={(e) => setFormData({ ...formData, facebook: e.target.value })} disabled={!isEditing} placeholder="facebook.com/..." className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">💬 WhatsApp</label>
 <input type="tel" value={formData.whatsapp || ''} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} disabled={!isEditing} placeholder="+49..." className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">🎵 TikTok</label>
 <input type="text" value={formData.tiktok || ''} onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })} disabled={!isEditing} placeholder="@kullaniciadi" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">▶️ YouTube</label>
 <input type="text" value={formData.youtube || ''} onChange={(e) => setFormData({ ...formData, youtube: e.target.value })} disabled={!isEditing} placeholder="youtube.com/..." className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 </div>
 {/* İrtibat Kişisi */}
 <div className="space-y-4 pt-4 border-t border-border">
 <h4 className="text-blue-800 dark:text-blue-400 font-medium text-sm">{t('lokmaYetkiliIrtibatKisisi')}</h4>
 <div className="grid grid-cols-2 gap-4">
 <div><label className="text-muted-foreground text-xs block mb-1">{t('adi')}</label><input type="text" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50" /></div>
 <div><label className="text-muted-foreground text-xs block mb-1">{t('soyadi')}</label><input type="text" value={formData.contactSurname} onChange={(e) => setFormData({ ...formData, contactSurname: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50" /></div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div><label className="text-muted-foreground text-xs block mb-1">{t('kisiselTel')}</label><input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50" /></div>
 <div><label className="text-muted-foreground text-xs block mb-1">{t('kisiselEmail')}</label><input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50" /></div>
 </div>
 </div>
 {/* Impressum / Rechtliche Angaben */}
 <div className="space-y-4 pt-4 border-t border-border">
 <h4 className="text-foreground font-medium pb-2">📜 {t('impressumBaslik')}</h4>
 <p className="text-muted-foreground text-xs -mt-2">{t('impressumAciklama')}</p>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-sm">{t('rechtsform')}</label>
 <select value={formData.legalForm || ''} onChange={(e) => setFormData({ ...formData, legalForm: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50">
 <option value="">{t('bitteWaehlen')}</option>
 {Object.entries(GERMAN_LEGAL_FORM_LABELS).map(([key, label]) => (
 <option key={key} value={key}>{label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('geschaeftsfuehrer')}</label>
 <input type="text" value={formData.managingDirector || ''} onChange={(e) => setFormData({ ...formData, managingDirector: e.target.value })} disabled={!isEditing} placeholder="Vor- und Nachname" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('vertretungsberechtigter')}</label>
 <input type="text" value={formData.authorizedRepresentative || ''} onChange={(e) => setFormData({ ...formData, authorizedRepresentative: e.target.value })} disabled={!isEditing} placeholder="Falls abweichend vom Geschäftsführer" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('vergi_uid_nummer_vat') || 'Umsatzsteuer-ID (USt-IdNr.)'}</label>
 <input type="text" value={formData.vatNumber || ''} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} disabled={!isEditing} placeholder="DE123456789" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50 font-mono" />
 <p className="text-xs text-muted-foreground mt-1">{t('avrupaBirligiVergiNumarasiOrnDe123456789') || 'z.B. DE123456789'}</p>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-sm">{t('registergericht')}</label>
 <input type="text" value={formData.registerCourt || ''} onChange={(e) => setFormData({ ...formData, registerCourt: e.target.value })} disabled={!isEditing} placeholder="z.B. Amtsgericht Mönchengladbach" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('handelsregisternummer')}</label>
 <input type="text" value={formData.registerNumber || ''} onChange={(e) => setFormData({ ...formData, registerNumber: e.target.value })} disabled={!isEditing} placeholder="z.B. HRB 12345" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50 font-mono" />
 </div>
 </div>
 </div>
 {admin?.adminType === 'super' && (
 <div className="space-y-4 pt-4 border-t border-border mt-4">
 {/* Google Place */}
 <h4 className="text-foreground font-medium pb-2">🗺️ Google Place</h4>
 <div className="relative">
 <label className="text-muted-foreground text-sm">{t('googlePlaceIdDegerlendirmelerIcin')}</label>
 {isEditing && (
 <div className="flex gap-2 mt-1 mb-2">
 <input type="text" value={googleSearchQuery} onChange={(e) => setGoogleSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGooglePlacesSearch()} placeholder={t('isletmeAdiVeyaAdresiAra')} className="flex-1 bg-foreground text-background shadow-md px-3 py-2 rounded-lg border border-border focus:border-blue-500" />
 <button type="button" onClick={() => handleGooglePlacesSearch()} disabled={googleSearchLoading || googleSearchQuery.length < 3} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
 {googleSearchLoading ? (<span className="animate-spin"></span>) : (<span></span>)} {t('ara_button')}
 </button>
 </div>
 )}
 {showGoogleDropdown && googleSearchResults.length > 0 && (
 <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
 {googleSearchResults.map((place, index) => (
 <button key={place.place_id || index} type="button" onClick={() => handleSelectGooglePlace(place)} className="w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-0 transition">
 <p className="text-foreground font-medium">{place.name}</p>
 <p className="text-muted-foreground text-sm">{place.formatted_address}</p>
 {place.rating && (<p className="text-yellow-800 dark:text-yellow-400 text-xs mt-1">⭐ {place.rating} ({place.user_ratings_total || 0} {t('degerlendirme')}</p>)}
 </button>
 ))}
 <button type="button" onClick={() => { setShowGoogleDropdown(false); setGoogleSearchResults([]); }} className="w-full px-4 py-2 bg-muted text-muted-foreground hover:text-foreground text-sm">✕ {t('kapat_button')}</button>
 </div>
 )}
 <input type="text" value={formData.googlePlaceId} onChange={(e) => setFormData({ ...formData, googlePlaceId: e.target.value })} disabled={!isEditing} placeholder={t('chijYukaridanArayarakSecin')} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50 font-mono text-sm" />
 {formData.googlePlaceId && (<p className="text-xs text-green-800 dark:text-green-400 mt-1">{t('google_place_id_set')}</p>)}
 </div>
 </div>
 )}
 </div>
 )}

 {/* ═══════ Tab 2: Fatura Adresi ═══════ */}
 {isletmeInternalTab === t(t('fatura')) && (
 <div className="space-y-6">
 <div>
 <label className="flex items-center gap-3 cursor-pointer mb-4">
 <input type="checkbox" checked={formData.hasDifferentBillingAddress || false} onChange={(e) => setFormData({ ...formData, hasDifferentBillingAddress: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-red-500" />
 <span className="text-foreground font-medium">{t('faturaFarkliBirKisifirmaUzerineKesilsin')}</span>
 </label>
 <p className="text-xs text-muted-foreground mb-4">{t('geneldeIsletmeIsmiIleFaturaIsmi')}</p>
 {formData.hasDifferentBillingAddress && (
 <div className="space-y-4 pt-4 border-t border-border">
 <div>
 <label className="text-muted-foreground text-sm">{t('faturaFirmaKisiAdi')}</label>
 <input type="text" value={formData.billingName || ''} onChange={(e) => setFormData({ ...formData, billingName: e.target.value })} disabled={!isEditing} placeholder={t('ornAbcGmbh')} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('fatura_adresi')}</label>
 <input type="text" value={formData.billingStreet || ''} onChange={(e) => setFormData({ ...formData, billingStreet: e.target.value })} disabled={!isEditing} placeholder={t('sokakCadde')} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-sm">{t('postaKodu')}</label>
 <input type="text" value={formData.billingPostalCode || ''} onChange={(e) => setFormData({ ...formData, billingPostalCode: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('sehir1')}</label>
 <input type="text" value={formData.billingCity || ''} onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('fatura_vergi_no')}</label>
 <input type="text" value={formData.billingVatNumber || ''} onChange={(e) => setFormData({ ...formData, billingVatNumber: e.target.value })} disabled={!isEditing} placeholder="DE..." className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50 font-mono" />
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
 <div>
 <h4 className="text-foreground font-medium mb-4">LOKMA Platform Markaları & Rozetleri</h4>
 <p className="text-xs text-muted-foreground mb-4">Bu işletmenin listeleme sayfasında ve detaylarında görünmesini istediğiniz logoları seçin.</p>
 {platformBrands.length === 0 ? (
 <div className="text-sm text-amber-600 bg-amber-500/10 border border-amber-500 rounded p-4">
 Henüz sistemde aktif marka / logo bulunmuyor. Lütfen önce MIRA Yönetim Merkezi üzerinden Platform Markaları ekleyin.
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 {platformBrands.map(badge => {
 const isSelected = formData.activeBrandIds?.includes(badge.id);
 return (
 <label 
 key={badge.id}
 className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
 isSelected 
 ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500 shadow-sm' 
 : 'bg-muted/50 border-border hover:bg-muted'
 } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 <input 
 type="checkbox" 
 checked={isSelected}
 onChange={async (e) => {
 if (!isEditing) return;
 const newIds = e.target.checked 
 ? [...(formData.activeBrandIds || []), badge.id]
 : (formData.activeBrandIds || []).filter(id => id !== badge.id);
 
 setFormData({ 
  ...formData, 
  activeBrandIds: newIds
 });

 if (businessId && businessId !== 'new') {
    try {
       await updateDoc(doc(db, "businesses", businessId), {
           activeBrandIds: newIds
       });
       showToast(e.target.checked ? "Rozet eklendi (Anlık Yansıtıldı)" : "Rozet kaldırıldı (Anlık Yansıtıldı)", "success");
    } catch (error) {}
 }
 }}
 disabled={!isEditing}
 className="w-4 h-4 accent-blue-600"
 />
 <div className="flex items-center gap-2 overflow-hidden">
 {badge.iconUrl && (
 <img src={badge.iconUrl} alt={badge.name} className="w-8 h-8 object-contain rounded-md bg-white p-0.5 shrink-0 border border-border" />
 )}
 <span className="font-medium text-sm truncate text-foreground" title={badge.name}>
 {badge.name}
 </span>
 </div>
 </label>
 );
 })}
 </div>
 )}
 <p className="text-xs text-green-800 dark:text-green-400 mt-4 border-t border-border pt-4">
 Seçilen markalar, mobil uygulamada işletme detaylarında ve kartında gösterilecektir.
 </p>
 </div>
 
 
  {/* Hazır Ürün Filtreleri - SADECE MARKET & KASAPLARDA GÖRÜNSÜN */}
  {isKasapType && (
    <div className="mt-6">
    <h4 className="text-foreground font-medium mb-2">🛍️ Hazır Paket Ürün Satışı (Mobil Filtreleme)</h4>
    <p className="text-xs text-muted-foreground mb-4">
    Marketler veya bu ürünleri paketli satan işletmeler için işaretleyin. Bu sayede kasap/restoran (sertifikalı TUNA kullananlar) dışında da aramalarda çıkacaktır.
    </p>
    <div className="flex flex-wrap gap-4">
    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors border ${formData.sellsTunaProducts ? 'bg-red-600/10 border-red-600/50' : 'bg-background border-border hover:bg-muted'}`}>
    <input type="checkbox" checked={formData.sellsTunaProducts} onChange={async (e) => {
      const isChecked = e.target.checked;
      setFormData({ ...formData, sellsTunaProducts: isChecked });
      if (businessId && businessId !== 'new') {
          try {
              await updateDoc(doc(db, "businesses", businessId), { sellsTunaProducts: isChecked });
              showToast("Tuna Hazır Paket durumu güncellendi", "success");
          } catch(e){}
      }
    }} disabled={!isEditing} className="w-5 h-5 accent-red-600" />
    <span className="font-medium text-foreground">🔴 TUNA Ürünleri Satıyor</span>
    </label>
    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors border ${formData.sellsTorosProducts ? 'bg-green-600/10 border-green-600/50' : 'bg-background border-border hover:bg-muted'}`}>
    <input type="checkbox" checked={formData.sellsTorosProducts} onChange={async (e) => {
      const isChecked = e.target.checked;
      setFormData({ ...formData, sellsTorosProducts: isChecked });
      if (businessId && businessId !== 'new') {
          try {
              await updateDoc(doc(db, "businesses", businessId), { sellsTorosProducts: isChecked });
              showToast("Toros Hazır Paket durumu güncellendi", "success");
          } catch(e){}
      }
    }} disabled={!isEditing} className="w-5 h-5 accent-green-600" />
    <span className="font-medium text-foreground">🟢 Akdeniz Toros Ürünleri Satıyor</span>
    </label>
    </div>
    </div>
  )}

  </>
 ) : (
 <div className="text-center">
 <p className="text-muted-foreground">{t('zertifikaAyarlariSadeceSuperAdminTarafindan')}</p>
 </div>
 )}
 </div>
 )}

 {/* ═══════ Tab 4: Görseller ═══════ */}
 {settingsSubTab === "isletme" && isletmeInternalTab === "gorseller" && (
 <div className="space-y-6">
 {/* İşletme Kart Görseli */}
 <div>
 <h4 className="text-foreground font-medium mb-4">{t('isletmeKartGorseli')}</h4>
 <div className="flex items-start gap-4">
 <div className="w-32 h-32 bg-muted rounded-lg overflow-hidden flex items-center justify-center border border-border shrink-0">
 {formData.imageUrl ? (<img src={formData.imageUrl} alt="Business" className="w-full h-full object-cover" />) : (<span className="text-4xl">{getBusinessTypeLabel((business as any)?.types || (business as any)?.type).emoji}</span>)}
 </div>
 {isEditing && (
 <div className="flex flex-col gap-2 w-full">
 <input type="file" accept="image/*" onChange={handleImageSelect} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
 <div className="flex items-center gap-2 my-1"><span className="text-muted-foreground text-xs">{t('veya')}</span></div>
 <button onClick={fetchGoogleData} disabled={!formData.googlePlaceId || uploading} className="flex items-center justify-center px-4 py-2 bg-card text-foreground rounded-lg hover:bg-muted dark:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors">
 {uploading && !imageFile ? (<span className="animate-spin mr-2"></span>) : (<Wand2 className="w-4 h-4 mr-2" />)} Google'dan Bilgileri Doldur (Server)
 </button>
 {!formData.googlePlaceId && (<p className="text-xs text-red-800 dark:text-red-400">{t('google_id_gerekli')}</p>)}
 </div>
 )}
 </div>
 </div>
 {/* İşletme Logosu */}
 <div>
 <h4 className="text-foreground font-medium mb-4">{t('isletmeLogosuKare')}</h4>
 <div className="flex items-center gap-4">
 {formData.logoUrl ? (<img src={formData.logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-cover border border-border" />) : (<div className="w-20 h-20 rounded-lg bg-muted border border-dashed border-gray-500 flex items-center justify-center text-muted-foreground"><Store className="w-8 h-8 opacity-50" /></div>)}
 {isEditing && (
 <div className="flex flex-col gap-2">
 <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm">
 {t('logoYukle')}
 <input type="file" accept="image/*" className="hidden" onChange={async (e) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; const logoRef = ref(storage, `business_logos/${businessId}/logo_${Date.now()}.jpg`); const uploadTask = uploadBytesResumable(logoRef, file); uploadTask.on('state_changed', () => { }, (error) => { console.error('Logo upload error:', error); showToast(t('logoYuklenirkenHataOlustu'), 'error'); }, async () => { const url = await getDownloadURL(uploadTask.snapshot.ref); setFormData({ ...formData, logoUrl: url }); showToast(t('logoYuklendi'), 'success'); }); } }} />
 </label>
 {formData.logoUrl && (<button type="button" onClick={() => setFormData({ ...formData, logoUrl: '' })} className="text-red-800 dark:text-red-400 text-xs hover:text-red-300">{t('logoyuKaldir')}</button>)}
 </div>
 )}
 </div>
 <p className="text-xs text-muted-foreground mt-2">{t('onerilenBoyut64x64PikselKare')}</p>
 </div>
 </div>
 )}

 {/* ═══════ Tab 5: Açılış Saatleri (Genel / Kurye / Gel-Al) ═══════ */}
 {settingsSubTab === "saatler" && (
 <div className="space-y-6">
								{/* Horizontal Tab Navigation */}
								<div>
									{/* Tab Bar */}
									<div className="flex gap-2 border-b border-border pb-3 mb-6 flex-wrap mt-2">
										{[
											{ id: "genel" as const, label: t('acilisSaatleri') },
											{ id: "kurye" as const, label: t('kuryeSaatleri') },
											{ id: "gelal" as const, label: t('gelAlSaatleri') },
										].map((tab) => (
											<button
												key={tab.id}
												onClick={() => setSaatlerSubTab(tab.id)}
												className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
													saatlerSubTab === tab.id
														? "bg-red-600 text-white"
														: "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
												}`}
											>
												{tab.label}
											</button>
										))}
									</div>

									{/* Content Area */}
									<div className="flex-1">
 {/* === Genel Açılış Saatleri === */}
 {saatlerSubTab === "genel" && (
 <div>
 <h4 className="text-foreground font-medium mb-4">{t('calismaSaatleri3')}</h4>
 <div className="space-y-2">
 {(() => {
 const DAY_DEFS = [
 { display: t('pazartesi'), variants: ["Pazartesi", "Monday", "Montag", t('pazartesi')] },
 { display: t('sali'), variants: ["Salı", "Salı", "Tuesday", "Dienstag", t('sali')] },
 { display: t('carsamba'), variants: ["Çarşamba", "Çarşamba", "Wednesday", "Mittwoch", t('carsamba')] },
 { display: t('persembe'), variants: ["Perşembe", "Perşembe", "Thursday", "Donnerstag", t('persembe')] },
 { display: t('cuma'), variants: ["Cuma", "Friday", "Freitag", t('cuma')] },
 { display: t('cumartesi'), variants: ["Cumartesi", "Saturday", "Samstag", t('cumartesi')] },
 { display: t('pazar'), variants: ["Pazar", "Sunday", "Sonntag", t('pazar')] },
 ];
 const findLine = (data: string, variants: string[]) => data.split("\n").find((l) => variants.some(v => l.startsWith(v + ":") || l.startsWith(v + " "))) || "";
 return DAY_DEFS.map((day, dayIndex) => {
 const currentLine = findLine(formData.openingHours || "", day.variants);
 const isClosed = currentLine.toLowerCase().includes(t('kapali1')) || currentLine.toLowerCase().includes("closed") || currentLine.toLowerCase().includes("geschlossen");
 let startTime = ""; let endTime = "";
 if (!isClosed && currentLine.includes(": ")) { const timePart = currentLine.split(": ").slice(1).join(": ").trim(); const separator = timePart.includes("–") ? "–" : "-"; const parts = timePart.split(separator).map(p => p.trim()); if (parts.length >= 2) { startTime = formatTo24h(parts[0]); endTime = formatTo24h(parts[1]); } }
 const updateHours = (newStart: string, newEnd: string, newClosed: boolean) => {
 const newLines = DAY_DEFS.map((dd, i) => {
 if (i === dayIndex) { if (newClosed) return `${dd.display}${t('kapali2')}`; return `${dd.display}: ${newStart} - ${newEnd}`; }
 const existingLine = findLine(formData.openingHours || "", dd.variants);
 if (existingLine) { const content = existingLine.split(": ").slice(1).join(": "); return content ? `${dd.display}: ${content}` : `${dd.display}${t('kapali2')}`; }
 return `${dd.display}${t('kapali2')}`;
 });
 setFormData({ ...formData, openingHours: newLines.join("\n") });
 };
 return (
 <div key={day.display} className="flex items-center gap-3">
 <span className="w-24 text-sm text-muted-foreground font-medium">{day.display}</span>
 <input type="time" value={formatTo24h(startTime)} disabled={isClosed} onChange={(e) => updateHours(e.target.value, endTime, false)} className={`w-28 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
 <span className="text-muted-foreground font-bold">–</span>
 <input type="time" value={formatTo24h(endTime)} disabled={isClosed} onChange={(e) => updateHours(startTime, e.target.value, false)} className={`w-28 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
 <label className="flex items-center cursor-pointer ml-auto relative">
 <input type="checkbox" checked={isClosed} onChange={(e) => updateHours(startTime, endTime, e.target.checked)} className="sr-only peer" />
 <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
 <span className="ml-2 text-xs text-muted-foreground font-medium w-10">{isClosed ? t('kapali') : t('acik')}</span>
 </label>
 </div>
 );
 });
 })()}
 </div>
 </div>
 )}

 {/* === Kurye Saatleri (Per-Day) === */}
 {saatlerSubTab === "kurye" && (
 <div>
 <div className="flex items-center justify-between mb-4">
 <div>
 <h4 className="text-foreground font-medium">{t('kuryeAcilisSaatleri')}</h4>
 <p className="text-xs text-muted-foreground mt-1">{t('isletmeAcikOlsaBileKuryegelAl')}</p>
 </div>
 {formData.openingHours && (
 <button
 onClick={() => {
 if (formData.deliveryHours && !confirm(t('procurement_delivery_hours_confirm'))) return;
 setFormData({ ...formData, deliveryHours: formData.openingHours });
 }}
 className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-800 dark:text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition flex items-center gap-1.5"
 >
 <span>↻</span>
 {t('genelSaatleriKopyala')}
 </button>
 )}
 </div>
 {!formData.deliveryHours && !formData.deliveryStartTime && !formData.deliveryEndTime && formData.openingHours && (
 <div className="mb-4 p-2.5 bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
 <p className="text-xs text-amber-300">{t('henuzOzelKuryeSaati')}</p>
 </div>
 )}
 <div className="space-y-2">
 {(() => {
 const DAY_DEFS = [
 { display: t('pazartesi'), variants: ["Pazartesi", "Monday", "Montag", t('pazartesi')] },
 { display: t('sali'), variants: ["Salı", "Salı", "Tuesday", "Dienstag", t('sali')] },
 { display: t('carsamba'), variants: ["Çarşamba", "Çarşamba", "Wednesday", "Mittwoch", t('carsamba')] },
 { display: t('persembe'), variants: ["Perşembe", "Perşembe", "Thursday", "Donnerstag", t('persembe')] },
 { display: t('cuma'), variants: ["Cuma", "Friday", "Freitag", t('cuma')] },
 { display: t('cumartesi'), variants: ["Cumartesi", "Saturday", "Samstag", t('cumartesi')] },
 { display: t('pazar'), variants: ["Pazar", "Sunday", "Sonntag", t('pazar')] },
 ];
 const findLine = (data: string, variants: string[]) => data.split("\n").find((l) => variants.some(v => l.startsWith(v + ":") || l.startsWith(v + " "))) || "";
 return DAY_DEFS.map((day, dayIndex) => {
 const hoursData = formData.deliveryHours || formData.openingHours || "";
 const currentLine = findLine(hoursData, day.variants);
 const isClosed = currentLine.toLowerCase().includes(t('kapali1')) || currentLine.toLowerCase().includes("closed") || currentLine.toLowerCase().includes("geschlossen");
 let startTime = ""; let endTime = "";
 if (!isClosed && currentLine.includes(": ")) { const timePart = currentLine.split(": ").slice(1).join(": ").trim(); const separator = timePart.includes("–") ? "–" : "-"; const parts = timePart.split(separator).map(p => p.trim()); if (parts.length >= 2) { startTime = formatTo24h(parts[0]); endTime = formatTo24h(parts[1]); } }
 const updateDeliveryHours = (newStart: string, newEnd: string, newClosed: boolean) => {
 const baseHours = formData.deliveryHours || formData.openingHours || "";
 const newLines = DAY_DEFS.map((dd, i) => {
 if (i === dayIndex) { if (newClosed) return `${dd.display}${t('kapali2')}`; return `${dd.display}: ${newStart} - ${newEnd}`; }
 const existingLine = findLine(baseHours, dd.variants);
 if (existingLine) { const content = existingLine.split(": ").slice(1).join(": "); return content ? `${dd.display}: ${content}` : `${dd.display}${t('kapali2')}`; }
 return `${dd.display}${t('kapali2')}`;
 });
 setFormData({ ...formData, deliveryHours: newLines.join("\n") });
 };
 return (
 <div key={day.display} className="flex items-center gap-3">
 <span className="w-24 text-sm text-muted-foreground font-medium">{day.display}</span>
 <input type="time" value={formatTo24h(startTime)} disabled={isClosed} onChange={(e) => updateDeliveryHours(e.target.value, endTime, false)} className={`w-28 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
 <span className="text-muted-foreground font-bold">–</span>
 <input type="time" value={formatTo24h(endTime)} disabled={isClosed} onChange={(e) => updateDeliveryHours(startTime, e.target.value, false)} className={`w-28 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
 <label className="flex items-center cursor-pointer ml-auto relative">
 <input type="checkbox" checked={isClosed} onChange={(e) => updateDeliveryHours(startTime, endTime, e.target.checked)} className="sr-only peer" />
 <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
 <span className="ml-2 text-xs text-muted-foreground font-medium w-10">{isClosed ? t('kapali') : t('acik')}</span>
 </label>
 </div>
 );
 });
 })()}
 </div>
 </div>
 )}

 {/* === Gel-Al Saatleri (Per-Day) === */}
 {saatlerSubTab === "gelal" && (
 <div>
 <div className="flex items-center justify-between mb-4">
 <div>
 <h4 className="text-foreground font-medium">{t('gelAlAcilisSaatleri')}</h4>
 <p className="text-xs text-muted-foreground mt-1">{t('isletmeAcikOlsaBileKuryegelAl')}</p>
 </div>
 {formData.openingHours && (
 <button
 onClick={() => {
 if (formData.pickupHours && !confirm(t('procurement_pickup_hours_confirm'))) return;
 setFormData({ ...formData, pickupHours: formData.openingHours });
 }}
 className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-800 dark:text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition flex items-center gap-1.5"
 >
 <span>↻</span>
 {t('genelSaatleriKopyala')}
 </button>
 )}
 </div>
 {!formData.pickupHours && !formData.pickupStartTime && !formData.pickupEndTime && formData.openingHours && (
 <div className="mb-4 p-2.5 bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
 <p className="text-xs text-amber-300">{t('henuzOzelGelAlSaati')}</p>
 </div>
 )}
 <div className="space-y-2">
 {(() => {
 const DAY_DEFS = [
 { display: t('pazartesi'), variants: ["Pazartesi", "Monday", "Montag", t('pazartesi')] },
 { display: t('sali'), variants: ["Salı", "Salı", "Tuesday", "Dienstag", t('sali')] },
 { display: t('carsamba'), variants: ["Çarşamba", "Çarşamba", "Wednesday", "Mittwoch", t('carsamba')] },
 { display: t('persembe'), variants: ["Perşembe", "Perşembe", "Thursday", "Donnerstag", t('persembe')] },
 { display: t('cuma'), variants: ["Cuma", "Friday", "Freitag", t('cuma')] },
 { display: t('cumartesi'), variants: ["Cumartesi", "Saturday", "Samstag", t('cumartesi')] },
 { display: t('pazar'), variants: ["Pazar", "Sunday", "Sonntag", t('pazar')] },
 ];
 const findLine = (data: string, variants: string[]) => data.split("\n").find((l) => variants.some(v => l.startsWith(v + ":") || l.startsWith(v + " "))) || "";
 return DAY_DEFS.map((day, dayIndex) => {
 const hoursData = formData.pickupHours || formData.openingHours || "";
 const currentLine = findLine(hoursData, day.variants);
 const isClosed = currentLine.toLowerCase().includes(t('kapali1')) || currentLine.toLowerCase().includes("closed") || currentLine.toLowerCase().includes("geschlossen");
 let startTime = ""; let endTime = "";
 if (!isClosed && currentLine.includes(": ")) { const timePart = currentLine.split(": ").slice(1).join(": ").trim(); const separator = timePart.includes("–") ? "–" : "-"; const parts = timePart.split(separator).map(p => p.trim()); if (parts.length >= 2) { startTime = formatTo24h(parts[0]); endTime = formatTo24h(parts[1]); } }
 const updatePickupHours = (newStart: string, newEnd: string, newClosed: boolean) => {
 const baseHours = formData.pickupHours || formData.openingHours || "";
 const newLines = DAY_DEFS.map((dd, i) => {
 if (i === dayIndex) { if (newClosed) return `${dd.display}${t('kapali2')}`; return `${dd.display}: ${newStart} - ${newEnd}`; }
 const existingLine = findLine(baseHours, dd.variants);
 if (existingLine) { const content = existingLine.split(": ").slice(1).join(": "); return content ? `${dd.display}: ${content}` : `${dd.display}${t('kapali2')}`; }
 return `${dd.display}${t('kapali2')}`;
 });
 setFormData({ ...formData, pickupHours: newLines.join("\n") });
 };
 return (
 <div key={day.display} className="flex items-center gap-3">
 <span className="w-24 text-sm text-muted-foreground font-medium">{day.display}</span>
 <input type="time" value={formatTo24h(startTime)} disabled={isClosed} onChange={(e) => updatePickupHours(e.target.value, endTime, false)} className={`w-28 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
 <span className="text-muted-foreground font-bold">–</span>
 <input type="time" value={formatTo24h(endTime)} disabled={isClosed} onChange={(e) => updatePickupHours(startTime, e.target.value, false)} className={`w-28 bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`} />
 <label className="flex items-center cursor-pointer ml-auto relative">
 <input type="checkbox" checked={isClosed} onChange={(e) => updatePickupHours(startTime, endTime, e.target.checked)} className="sr-only peer" />
 <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
 <span className="ml-2 text-xs text-muted-foreground font-medium w-10">{isClosed ? t('kapali') : t('acik')}</span>
 </label>
 </div>
 );
 });
 })()}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 </>
 )}


							{/* ═══════ Tab 6: Teslimat Ayarları ═══════ */}
								{settingsSubTab === "teslimat" && (
							<div className="flex-1 bg-card rounded-xl border border-border p-6 shadow-sm h-auto">
 <LockedModuleOverlay featureKey="delivery">
 <div className="space-y-6">
 <div>
 <h4 className="text-foreground font-medium border-b border-border pb-2 mb-4">{t('teslimatAyarlari')}</h4>
 <div className="space-y-4">
 {/* Kurye Desteği Checkbox */}
 <div className="flex items-center gap-3">
 <input type="checkbox" checked={formData.supportsDelivery} onChange={(e) => setFormData({ ...formData, supportsDelivery: e.target.checked })} disabled={!isEditing} className="w-5 h-5" />
 <span className="text-foreground">{t('kuryeDestegiVar')}</span>
 </div>
 {formData.supportsDelivery && (
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 <div>
 <label className="text-muted-foreground text-sm">{t('minSiparis')}</label>
 <input type="number" value={formData.minDeliveryOrder} onChange={(e) => setFormData({ ...formData, minDeliveryOrder: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('teslimatUcreti')}</label>
 <input type="number" value={formData.deliveryFee} onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('maksMesafe')}</label>
 <input type="number" value={formData.deliveryRadius || 5} onChange={(e) => setFormData({ ...formData, deliveryRadius: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
 </div>
 </div>
 )}

 {/* Ücretsiz Teslimat Eşiği */}
 <div className="mt-3">
 <label className="text-muted-foreground text-sm flex items-center gap-1">{t('ucretsizTeslimatEsigi')}</label>
 <div className="flex items-center gap-2 mt-1">
 <input type="number" value={formData.freeDeliveryThreshold || 0} onChange={(e) => setFormData({ ...formData, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })} onFocus={(e) => e.target.select()} disabled={!isEditing} className="w-32 bg-foreground text-background shadow-md px-3 py-2 rounded-lg disabled:opacity-50" min="0" step="0.01" />
 <span className="text-muted-foreground text-sm">{t('uzeriSiparislerdeTeslimatUcretsiz')}</span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">{t('0HerZamanTeslimatUcretiUygulanir')}</p>
 </div>

 {/* Ön Sipariş Checkbox */}
 <div className="mt-3 flex items-center gap-3">
 <input type="checkbox" checked={formData.preOrderEnabled} onChange={(e) => setFormData({ ...formData, preOrderEnabled: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-amber-500" />
 <div>
 <span className="text-foreground">{t('onSiparisKabulEt')}</span>
 <p className="text-xs text-muted-foreground">{t('isletmeKapaliykenDeErtesiGunIcin')}</p>
 </div>
 </div>

 {/* Gel-Al (Pickup) Desteği Checkbox */}
 <div className="mt-3 flex items-center gap-3">
 <input type="checkbox" checked={formData.pickupEnabled !== false} onChange={(e) => setFormData({ ...formData, pickupEnabled: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-green-500" />
 <div>
 <span className="text-foreground">{t('gelAlDestegiVar')}</span>
 <p className="text-xs text-muted-foreground">{t('musterilerSiparisiKendisiAlabilir')}</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </LockedModuleOverlay>
							</div>
 )}
 {/* Sub-Tab: Menü & Ürünler */}
 {
 settingsSubTab === "menu" && (
 <div className="space-y-6">
 {/* Internal Tab Bar */}
 <div className="flex gap-2 border-b border-border pb-3">
 <button
 onClick={() => setMenuInternalTab("kategoriler")}
 className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${menuInternalTab === "kategoriler"
 ? "bg-red-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 }`}
 >
 {t('kategoriler')} ({inlineCategories.length})
 </button>
 <button
 onClick={() => setMenuInternalTab("urunler")}
 className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${menuInternalTab === "urunler"
 ? "bg-red-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 }`}
 >
 {t('urunler')}{inlineProducts.length})
 </button>
 <button
 onClick={() => setMenuInternalTab("sponsored")}
 className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${menuInternalTab === "sponsored"
 ? "bg-amber-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 } ${!planFeatures.sponsoredProducts && admin?.adminType !== 'super' ? 'opacity-60' : ''}`}
 >
 {!planFeatures.sponsoredProducts && admin?.adminType !== 'super' && '🔒 '}Sponsored Products ({sponsoredProducts.length})
 </button>
 </div>

 {/* ==================== KATEGORİLER ==================== */}
 {menuInternalTab === "kategoriler" && (
 <div className="space-y-4">
 {/* Header with Add button */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 
 <div>
 <h4 className="text-foreground font-bold">{t('kategoriler')}</h4>
 <p className="text-muted-foreground text-xs">{inlineCategories.length} {t('kategori')}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {isKasapType && (
 <>
 <button
 onClick={() => {
 if (inlineCategories.length > 0) {
 setConfirmModal({
 show: true,
 title: '📂 Kategori Şablonu Yükle',
 message: `Bu işletmede zaten ${inlineCategories.length} kategori var. Şablon uygulandığında 5 kategori mevcut olan kategorilerin ÜSTÜNE eklenecektir. Devam etmek istiyor musunuz?`,
 confirmText: 'Evet, Ekle',
 confirmColor: 'bg-emerald-600 hover:bg-emerald-500',
 onConfirm: async () => {
 setConfirmModal(prev => ({ ...prev, show: false }));
 await applyCategoryTemplate();
 },
 });
 } else {
 applyCategoryTemplate();
 }
 }}
 disabled={applyingTemplate}
 className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-foreground text-sm font-medium rounded-lg transition disabled:opacity-50"
 >
 {applyingTemplate ? ' Yükleniyor...' : '📂 Kategori Şablonu Yükle'}
 </button>
 </>
 )}
 <button
 onClick={() => {
 setEditingCategory(null);
 setCategoryForm({ name: { tr: '' }, icon: '', isActive: true });
 setShowCategoryModal(true);
 }}
 className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-foreground text-sm font-medium rounded-lg transition"
 >
 + Yeni Kategori
 </button>
 </div>
 </div>

 {/* Loading */}
 {loadingCategories && (
 <div className="flex justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
 </div>
 )}

 {/* Empty state */}
 {!loadingCategories && inlineCategories.length === 0 && (
 <div className="bg-background/50 rounded-xl p-8 text-center border border-border">
 
 <h4 className="text-foreground font-medium mt-3">{t('henuzKategoriEklenmemis')}</h4>
 <p className="text-muted-foreground text-sm mt-1">{t('urunleriniziDuzenlemekIcinKategoriEkleyin')}</p>
 <div className="flex items-center gap-3 mt-4">
 <button
 onClick={() => {
 setEditingCategory(null);
 setCategoryForm({ name: { tr: '' }, icon: '', isActive: true });
 setShowCategoryModal(true);
 }}
 className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
 >
 {t('ilkKategoriyiEkle')}
 </button>
 </div>
 </div>
 )}

 {/* Category List */}
 {!loadingCategories && inlineCategories.length > 0 && (
 <div className="space-y-2">
 {inlineCategories.map((cat, index) => (
 <div
 key={cat.id}
 className={`bg-card/80 rounded-xl p-3 border transition flex items-center gap-3 ${cat.isActive ? 'border-border' : 'border-red-900/50 opacity-60'}`}
 >
 {/* Move buttons */}
 <div className="flex flex-col items-center gap-0.5">
 <button
 onClick={() => moveCategoryInline(index, 'up')}
 disabled={index === 0}
 className="text-muted-foreground hover:text-white disabled:opacity-20 text-xs"
 >▲</button>
 <span className="text-[10px] text-muted-foreground">{index + 1}</span>
 <button
 onClick={() => moveCategoryInline(index, 'down')}
 disabled={index === inlineCategories.length - 1}
 className="text-muted-foreground hover:text-white disabled:opacity-20 text-xs"
 >▼</button>
 </div>

 

 {/* Info */}
 <div className="flex-1 min-w-0">
 <h5 className="text-foreground font-bold text-sm">{typeof cat.name === 'object' ? getLocalizedText(cat.name) : cat.name}</h5>
 <p className="text-muted-foreground text-xs">
 {inlineProducts.filter((p: any) => p.category === (typeof cat.name === 'object' ? getLocalizedText(cat.name) : cat.name) || p.categoryId === cat.id).length} {t('urun')} {cat.isActive ? ' Aktif' : t('pasif')}
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
 ></button>
 <button
 onClick={() => setDeletingCategoryId(cat.id)}
 className="p-1.5 bg-red-600/80 hover:bg-red-500 rounded-lg transition text-white text-xs"
 title={t('sil')}
 >️</button>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Category Add/Edit Modal */}
 {showCategoryModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
 <div className="bg-card rounded-xl p-6 w-full max-w-md">
 <h2 className="text-xl font-bold text-foreground mb-4">
 {editingCategory ? t('kategoriDuzenle') : t('yeni_kategori')}
 </h2>

 {/* Icon Selection */}
 <div className="mb-4">
 <label className="text-muted-foreground text-sm mb-2 block">{t('ikon')}</label>
 <div className="flex flex-wrap gap-2">
 {CATEGORY_ICONS.map(icon => (
 <button
 key={icon}
 onClick={() => setCategoryForm({ ...categoryForm, icon })}
 className={`w-10 h-10 text-2xl rounded-lg transition ${categoryForm.icon === icon
 ? 'bg-violet-600 ring-2 ring-violet-400'
 : 'bg-muted hover:bg-muted border border-border text-foreground'
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
 className="w-5 h-5 rounded bg-muted border-border text-violet-500"
 />
 <span className="text-foreground">{t('aktifUygulamadaGorunsun')}</span>
 </label>
 </div>

 {/* Buttons */}
 <div className="flex gap-3">
 <button
 onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
 className="flex-1 px-4 py-3 bg-accent text-foreground dark:bg-muted dark:text-gray-100 rounded-lg hover:bg-muted border border-border text-foreground transition"
 >{t('iptal1')}</button>
 <button
 onClick={handleSaveCategory}
 disabled={savingCategory || !(typeof categoryForm.name === 'object' ? getLocalizedText(categoryForm.name) : categoryForm.name)?.trim()}
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
 <div className="bg-card rounded-xl p-6 w-full max-w-sm text-center">
 <span className="text-4xl">⚠️</span>
 <h3 className="text-lg font-bold text-foreground mt-3">{t('kategoriyi_sil')}</h3>
 <p className="text-muted-foreground text-sm mt-2">
 {t('buKategoriyiKaliciOlarakSilmekIstediginizden')}
 </p>
 <div className="flex gap-3 mt-5">
 <button
 onClick={() => setDeletingCategoryId(null)}
 className="flex-1 px-4 py-2.5 bg-accent text-foreground dark:bg-muted dark:text-gray-100 rounded-lg hover:bg-muted border border-border text-foreground"
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
 <span className="text-2xl"></span>
 <div>
 <h4 className="text-foreground font-bold">Sponsored Products</h4>
 <p className="text-muted-foreground text-xs">{inlineProducts.length} {t('urun1')}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {isKasapType && (
 <button
 onClick={() => applyProductTemplate()}
 disabled={applyingProductTemplate}
 className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-foreground text-sm font-medium rounded-lg transition disabled:opacity-50"
 >
 {applyingProductTemplate ? ` ${t('yukleniyor')}` : `${t('urun_sablonu')} ${t('yukle')}`}
 </button>
 )}
 <button
 onClick={() => setProductModalOpen(true)}
 className="px-3 py-2 bg-green-600 hover:bg-green-500 text-foreground text-sm font-medium rounded-lg transition inline-flex items-center gap-1"
 >
 + Yeni Ürün Ekle
 </button>
 </div>
 </div>

 {/* Search Input */}
 {!loadingProducts && inlineProducts.length > 0 && (
 <div className="relative">
 <input
 type="text"
 value={productSearchQuery}
 onChange={(e) => {
 setProductSearchQuery(e.target.value);
 setProductCurrentPage(1);
 }}
 placeholder={t('urun_ara_placeholder')}
 className="w-full px-4 py-2.5 pl-10 bg-card border border-border rounded-lg text-foreground text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-ring focus:ring-offset-2 dark:focus:ring-offset-background transition"
 />
 <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 {productSearchQuery && (
 <button
 onClick={() => {
 setProductSearchQuery('');
 setProductCurrentPage(1);
 }}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition"
 >
 ✕
 </button>
 )}
 </div>
 )}

 {/* Category Filter Chips + Status Filter */}
 {!loadingProducts && inlineProducts.length > 0 && (() => {
 // Build category counts
 const catCounts: Record<string, number> = {};
 inlineProducts.forEach((p: any) => {
 const rawCat = p.category || 'Kategorisiz';
 const catName = typeof rawCat === 'object' ? getLocalizedText(rawCat) : rawCat;
 catCounts[catName] = (catCounts[catName] || 0) + 1;
 });
 const catNames = Object.keys(catCounts);

 return (
 <div className="flex flex-wrap items-center gap-2">
 {/* Category chips */}
 <button
 onClick={() => { setInlineCategoryFilter('all'); setProductCurrentPage(1); }}
 className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${inlineCategoryFilter === 'all'
 ? 'bg-green-600 text-white'
 : 'bg-muted/80 text-foreground hover:bg-muted border border-border text-foreground'
 }`}
 >
 Tümü {inlineProducts.length}
 </button>
 {catNames.map(cn => {
 const catInfo = inlineCategories.find((c: any) => (typeof c.name === 'object' ? getLocalizedText(c.name) : c.name) === cn);
 return (
 <button
 key={cn}
 onClick={() => { setInlineCategoryFilter(cn); setProductCurrentPage(1); }}
 className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${inlineCategoryFilter === cn
 ? 'bg-blue-600 text-white'
 : 'bg-muted/80 text-foreground hover:bg-muted border border-border text-foreground'
 }`}
 >
 {catInfo?.icon || ''} {cn} {catCounts[cn]}
 </button>
 );
 })}

 {/* Status filter dropdown — pushed right */}
 <div className="ml-auto flex items-center gap-2">
 <span className="text-muted-foreground text-xs">{t('status_filter') || "Durum Filtresi:"}</span>
 <select
 value={inlineStatusFilter}
 onChange={(e) => { setInlineStatusFilter(e.target.value); setProductCurrentPage(1); }}
 className="bg-foreground text-background shadow-md text-xs rounded-lg px-3 py-1.5 border border-border focus:border-blue-500 focus:outline-none"
 >
 <option value="all"> Tümü ({inlineProducts.length})</option>
 <option value="active">{t('aktif')}</option>
 <option value="passive">{t('pasif')}</option>
 <option value="outOfStock">{t('stokta_yok')}</option>
 </select>
 </div>
 </div>
 );
 })()}

 {/* Loading */}
 {loadingProducts && (
 <div className="flex justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
 </div>
 )}

 {/* Empty state */}
 {!loadingProducts && inlineProducts.length === 0 && (
 <div className="bg-background/50 rounded-xl p-8 text-center border border-border">
 <span className="text-4xl"></span>
 <h4 className="text-foreground font-medium mt-3">{t('henuzUrunEklenmemis')}</h4>
 <p className="text-muted-foreground text-sm mt-1">{t('isletmeyeUrunAtamakIcinUrunYonetimine')}</p>
 <button
 onClick={() => setProductModalOpen(true)}
 className="mt-4 inline-block px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
 >
 + Yeni Ürün Ekle
 </button>
 </div>
 )}

 {/* Product Table */}
 {!loadingProducts && inlineProducts.length > 0 && (() => {
 // Filter products
 let filtered = [...inlineProducts];

 // Category filter
 if (inlineCategoryFilter !== 'all') {
 filtered = filtered.filter((p: any) => {
 const rawCat = p.category || 'Kategorisiz';
 const catName = typeof rawCat === 'object' ? getLocalizedText(rawCat) : rawCat;
 return catName === inlineCategoryFilter;
 });
 }

 // Status filter
 if (inlineStatusFilter === 'active') {
 filtered = filtered.filter((p: any) => p.isActive !== false);
 } else if (inlineStatusFilter === 'passive') {
 filtered = filtered.filter((p: any) => p.isActive === false);
 } else if (inlineStatusFilter === 'outOfStock') {
 filtered = filtered.filter((p: any) => p.outOfStock === true);
 }

 // Search filter with Turkish/multi-language character normalization
 if (productSearchQuery.trim()) {
 const normalizeSearch = (str: string): string => {
 return str
 .replace(/İ/g, 'i') // Turkish capital İ → i
 .replace(/ı/g, 'i') // Turkish lowercase ı → i
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, ''); // strip combining diacritics (ö→o, ü→u, ç→c, ş→s, g→g, etc.)
 };
 const q = normalizeSearch(productSearchQuery);
 filtered = filtered.filter((p: any) => {
 const name = typeof p.name === 'object' ? getLocalizedText(p.name) : (p.name || '');
 const sku = p.id || p.sku || '';
 const cat = typeof p.category === 'object' ? getLocalizedText(p.category) : (p.category || '');
 const desc = typeof p.description === 'object' ? getLocalizedText(p.description) : (p.description || '');
 return normalizeSearch(name).includes(q) || normalizeSearch(sku).includes(q) || normalizeSearch(cat).includes(q) || normalizeSearch(desc).includes(q);
 });
 }

 // Pagination
 const totalFiltered = filtered.length;
 const totalPages = Math.max(1, Math.ceil(totalFiltered / productsPerPage));
 const safeCurrentPage = Math.min(productCurrentPage, totalPages);
 const startIdx = (safeCurrentPage - 1) * productsPerPage;
 const endIdx = startIdx + productsPerPage;
 const paginatedProducts = filtered.slice(startIdx, endIdx);

 const allSelected = paginatedProducts.length > 0 && paginatedProducts.every((p: any) => selectedInlineProducts.has(p.id));

 // Generate page numbers for display
 const getPageNumbers = () => {
 const pages: (number | '...')[] = [];
 if (totalPages <= 7) {
 for (let i = 1; i <= totalPages; i++) pages.push(i);
 } else {
 pages.push(1);
 if (safeCurrentPage > 3) pages.push('...');
 for (let i = Math.max(2, safeCurrentPage - 1); i <= Math.min(totalPages - 1, safeCurrentPage + 1); i++) {
 pages.push(i);
 }
 if (safeCurrentPage < totalPages - 2) pages.push('...');
 pages.push(totalPages);
 }
 return pages;
 };

 return (
 <div>
 {/* Bulk Action Bar — Above Table */}
 {selectedInlineProducts.size > 0 && (
 <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-amber-500/30 rounded-xl px-4 py-2.5 mb-2 flex items-center gap-2 flex-wrap shadow-lg">
 <span className="text-green-800 dark:text-green-400 text-sm font-bold flex items-center gap-1">
 ☑ {selectedInlineProducts.size} ürün seçili
 </span>
 <span className="w-px h-5 bg-muted border border-border text-foreground"></span>

 {/* Status */}
 <select
 value=""
 onChange={(e) => {
 const v = e.target.value;
 if (v === 'active') handleInlineBulkStatus(true);
 else if (v === 'passive') handleInlineBulkStatus(false);
 }}
 className="bg-orange-600 text-white text-xs rounded-lg px-3 py-1.5 font-medium cursor-pointer border-0 focus:outline-none"
 >
 <option value="" disabled> Durum</option>
 <option value="active">{t('aktif_yap')}</option>
 <option value="passive">{t('pasif_yap')}</option>
 </select>

 {/* Stock */}
 <select
 value=""
 onChange={(e) => {
 const v = e.target.value;
 if (v === 'in') handleInlineBulkStock(true);
 else if (v === 'out') handleInlineBulkStock(false);
 }}
 className="bg-yellow-600 text-white text-xs rounded-lg px-3 py-1.5 font-medium cursor-pointer border-0 focus:outline-none"
 >
 <option value="" disabled> Stok</option>
 <option value="in">{t('stokta')}</option>
 <option value="out">{t('stokta_yok')}</option>
 </select>

 {/* Featured */}
 <button
 onClick={() => handleInlineBulkFeatured()}
 className="bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg px-3 py-1.5 font-medium transition"
 >
 {t('one_cikan')}
 </button>

 {/* Category Move */}
 <select
 value=""
 onChange={(e) => {
 const v = e.target.value;
 if (v) handleInlineBulkCategoryMove(v);
 }}
 className="bg-blue-600 text-white text-xs rounded-lg px-3 py-1.5 font-medium cursor-pointer border-0 focus:outline-none"
 >
 <option value="" disabled>📂 Kategoriye Taşı...</option>
 {inlineCategories.map((cat: any) => {
 const cn = typeof cat.name === 'object' ? getLocalizedText(cat.name) : cat.name;
 return <option key={cat.id} value={cn}>{cn}</option>;
 })}
 </select>

 {/* Delete + Cancel — pushed right */}
 <div className="ml-auto flex items-center gap-2">
 <button
 onClick={() => handleInlineBulkDelete()}
 className="bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg px-3 py-1.5 font-medium transition"
 >
 ️ Sil
 </button>
 <button
 onClick={() => setSelectedInlineProducts(new Set())}
 className="bg-muted border border-border text-foreground hover:bg-gray-500 text-white text-xs rounded-lg px-3 py-1.5 font-medium transition"
 >
 {t('iptal')}
 </button>
 </div>
 </div>
 )}

 <div className="bg-card/60 rounded-xl border border-border overflow-hidden">
 {/* Table Header */}
 <div className="px-4 py-2.5 bg-muted/50 border-b border-border grid grid-cols-[36px_40px_1fr_120px_140px_70px_70px_100px] gap-2 items-center text-xs text-muted-foreground font-medium">
 <div className="flex justify-center">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={() => {
 if (allSelected) {
 setSelectedInlineProducts(new Set());
 } else {
 setSelectedInlineProducts(new Set(paginatedProducts.map((p: any) => p.id)));
 }
 }}
 className="w-4 h-4 rounded accent-green-500 cursor-pointer"
 />
 </div>
 <div></div>
 <div>{t('urun_adi')}</div>
 <div>{t('sku') || "SKU"}</div>
 <div>{t('price_netto_brutto') || "Fiyat (Netto / Brutto)"}</div>
 <div>{t('birim')}</div>
 <div>{t('durum_col')}</div>
 <div className="text-right">{t('islemler')}</div>
 </div>

 {/* Table Body */}
 <div className="divide-y divide-border/50">
 {paginatedProducts.map((product: any) => {
 const isSelected = selectedInlineProducts.has(product.id);
 const productName = typeof product.name === 'object' ? getLocalizedText(product.name) : product.name;
 const imageUrl = product.imageUrl || (product.images && product.images[0]) || null;
 const basePrice = product.sellingPrice || product.price || null;
 const appPrice = product.appSellingPrice || basePrice;
 const taxRate = product.taxRate || 7;
 const brutto = appPrice ? parseFloat((appPrice * (1 + taxRate / 100)).toFixed(2)) : null;
 const currSym = getCurrencySymbol(business?.currency);
 const unitSuffix = product.unit === 'kg' ? '/kg' : '';
 const isActive = product.isActive !== false;
 const sku = product.id || product.sku || '—';
 const rawCat = product.category || 'Kategorisiz';
 const catName = typeof rawCat === 'object' ? getLocalizedText(rawCat) : rawCat;

 return (
 <Fragment key={product.id}>
 <div
 className={`px-4 py-2 grid grid-cols-[36px_40px_1fr_120px_140px_70px_70px_100px] gap-2 items-center hover:bg-muted/30 transition cursor-pointer ${isSelected ? 'bg-blue-900/20' : ''} ${editingInlineProduct?.id === product.id ? 'bg-blue-900/30 border-l-2 border-blue-500' : ''} ${!isActive ? 'opacity-60' : ''}`}
 >
 {/* Checkbox */}
 <div className="flex justify-center">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => {
 const next = new Set(selectedInlineProducts);
 if (next.has(product.id)) next.delete(product.id);
 else next.add(product.id);
 setSelectedInlineProducts(next);
 }}
 className="w-4 h-4 rounded accent-green-500 cursor-pointer"
 />
 </div>
 {/* Thumbnail */}
 <div>
 {imageUrl ? (
 <img
 src={imageUrl}
 alt={productName}
 loading="lazy"
 className="w-9 h-9 rounded-lg object-cover"
 />
 ) : (
 <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
 📷
 </div>
 )}
 </div>
 {/* Name + Description */}
 <div className="min-w-0">
 <p className="text-foreground text-sm font-medium truncate">{productName}</p>
 <p className="text-muted-foreground text-xs truncate">
 {getLocalizedText(product.description) || ''}
 </p>
 </div>
 {/* SKU */}
 <div className="text-muted-foreground text-xs truncate font-mono">{sku.length > 16 ? sku.slice(0, 16) + '...' : sku}</div>
 {/* Price */}
 <div className="text-right">
 {appPrice ? (
 <div className="space-y-0.5">
 <div className="text-green-800 dark:text-green-400 font-bold text-xs">{brutto?.toFixed(2)}{currSym}{unitSuffix} <span className="text-muted-foreground text-[10px] font-normal">{t('brutto')}</span></div>
 <div className="text-muted-foreground text-[11px]">{appPrice.toFixed(2)}{currSym}{unitSuffix} <span className="text-muted-foreground text-[10px]">{t('netto')}</span></div>
 </div>
 ) : (
 <span className="text-muted-foreground text-xs">—</span>
 )}
 </div>
 {/* Unit */}
 <div className="text-foreground text-xs text-center">{product.unit === 'kg' ? 'kg' : 'Adet'}</div>
 {/* Status */}
 <div className="flex flex-col items-center gap-0.5">
 <span
 onClick={() => toggleProductActive(product.id, isActive)}
 className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer font-medium ${isActive ? 'bg-green-900/60 text-green-800 dark:text-green-400' : 'bg-red-900/60 text-red-800 dark:text-red-400'}`}
 title={isActive ? t('pasif_yap') : t('aktif_yap')}
 >
 {isActive ? t('aktif') : t('pasif')}
 </span>
 {product.outOfStock && (
 <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-900/60 text-yellow-800 dark:yellow-400 font-medium">
 {t('stokta_yok')}
 </span>
 )}
 </div>
 {/* Actions */}
 <div className="flex items-center justify-end gap-1">
 <button
 onClick={() => {
 // Full inline edit – populate all known fields
 setEditingInlineProduct(product);
 setEditInlineTab('general');
 setProductMode('custom');
 setCustomProductForm({
 name: product.name || { tr: '' },
 price: String(product.price || product.sellingPrice || ''),
 unit: product.unit || product.defaultUnit || 'kg',
 imageFile: null,
 });
 setEditFormFull({
 name: product.name || { tr: '' },
 unit: product.unit || product.defaultUnit || 'kg',
 brand: product.brand || '',
 barcode: product.barcode || '',
 category: product.category || '',
 isActive: product.isActive !== false,
 isFeatured: product.isFeatured || false,
 sellingPrice: String(product.price || product.sellingPrice || ''),
 purchasePrice: product.purchasePrice || '',
 discountedPrice: product.discountedPrice || '',
 appPrice: product.appPrice || '',
 eslPrice: product.eslPrice || '',
 courierPrice: product.courierPrice || '',
 storePrice: product.storePrice || '',
 taxRate: String(product.taxRate ?? '7'),
 outOfStock: product.outOfStock || false,
 description: product.description || { tr: '' },
 ingredients: product.ingredients || '',
 consumptionInfo: product.consumptionInfo || '',
 specialInfo: product.specialInfo || '',
 weight: product.weight || '',
 mhd: product.mhd || '',
 packung: product.packung || '',
 artikelnummer: product.artikelnummer || '',
 storageTemp: product.storageTemp || '',
 allergens: product.allergens || {},
 containsAlcohol: product.containsAlcohol || false,
 additives: product.additives || [],
 nutritionPer100g: product.nutritionPer100g || {},
 certifications: product.certifications || [],
 origin: product.origin || '',
 productionDate: product.productionDate || '',
 expirationDate: product.expirationDate || '',
 optionGroups: product.optionGroups || [],
 internalNotes: product.internalNotes || '',
 tags: product.tags || [],
 brandLabels: product.brandLabels || [],
 supplierName: product.supplierName || '',
 batchNumber: product.batchNumber || '',
 currentStock: product.currentStock || '',
 minStock: product.minStock || '',
 reorderPoint: product.reorderPoint || '',
 stockUnit: product.stockUnit || 'kg',
 stockLocation: product.stockLocation || '',
 });
 // Scroll to inline edit panel
 setTimeout(() => {
 document.getElementById('inline-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
 }, 100);
 }}
 className="text-xs px-2 py-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded transition"
 title={t('edit_title')}
 >
 Düzenle
 </button>
 <button
 onClick={() => handleDeleteProduct(product.id)}
 className="text-xs px-2 py-1 bg-red-600/80 hover:bg-red-500 text-white rounded transition"
 title={t('delete_title')}
 >
 Sil
 </button>
 </div>
 </div>
 {/* ═══ ACCORDION EDIT PANEL ═══ */}
 {editingInlineProduct?.id === product.id && (
 <div className="col-span-full bg-card/90 border-l-2 border-blue-500 rounded-b-lg overflow-hidden" style={{ backdropFilter: 'blur(8px)', minHeight: '420px' }}>
 <div id="inline-edit-panel" className="p-4">
 {/* Tab Navigation */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex gap-1 overflow-x-auto">
 {[
 { key: 'general', label: t('tab_general') },
 { key: 'pricing', label: t('tab_pricing') },
 { key: 'stock', label: t('tab_stock') },
 { key: 'media', label: t('tab_media') },
 { key: 'contentCompliance', label: t('tab_content_compliance') },
 { key: 'app', label: 'App' },
 ].map(tab => (
 <button
 key={tab.key}
 onClick={() => setEditInlineTab(tab.key as any)}
 className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition ${editInlineTab === tab.key
 ? 'bg-blue-500 text-white'
 : 'text-muted-foreground hover:text-white hover:bg-muted/50'
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>
 <button
 onClick={() => { setEditingInlineProduct(null); setEditFormFull({}); setEditInlineTab('general'); }}
 className="text-muted-foreground hover:text-white p-1 transition"
 >
 ✕
 </button>
 </div>

 {/* Tab Content */}
 <div className="max-h-[50vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
 {editInlineTab === 'general' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('sku_id') || "SKU (ID)"}</label>
 <input value={editFormFull.sku || editingInlineProduct?.id || ''} readOnly className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('barkod')}</label>
 <input value={editFormFull.barcode || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, barcode: e.target.value }))} placeholder="EAN/UPC" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('kategori_label')}</label>
 <select value={editFormFull.category || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, category: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none">
 <option value="">{t('kategori_secin')}</option>
 {inlineCategories.map((cat: any) => (
 <option key={cat.id || cat.name} value={typeof cat === 'string' ? cat : (cat.name?.tr || cat.name || cat.id)}>{typeof cat === 'string' ? cat : (cat.name?.tr || cat.name || cat.id)}</option>
 ))}
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="text-xs text-muted-foreground mb-1 block">{t('urun_adi')}</label>
 <MultiLanguageInput label={t('urun_adi_label')} value={editFormFull.name || customProductForm.name} onChange={(v: any) => { setEditFormFull((p: any) => ({ ...p, name: v })); setCustomProductForm((prev: any) => ({ ...prev, name: v })); }} />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('marka')}</label>
 <input value={editFormFull.brand || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, brand: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div className="flex gap-2">
 <div className="flex-1">
 <label className="text-xs text-muted-foreground mb-1 block">{t('birim')}</label>
 <select value={editFormFull.unit || 'kg'} onChange={e => setEditFormFull((p: any) => ({ ...p, unit: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="kg">{t('kg') || "Kg"}</option><option value="adet">{t('adet')}</option><option value="litre">{t('litre')}</option><option value="paket">{t('paket')}</option>
 </select>
 </div>
 <div className="flex-1">
 <label className="text-xs text-muted-foreground mb-1 block">{t('durum_label')}</label>
 <select value={editFormFull.isActive !== false ? 'active' : 'passive'} onChange={e => setEditFormFull((p: any) => ({ ...p, isActive: e.target.value === 'active' }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="active">{t('aktif')}</option><option value="passive">{t('pasif')}</option>
 </select>
 </div>
 <div className="flex-1">
 <label className="text-xs text-muted-foreground mb-1 block">{t('tax_vat') || "KDV"}</label>
 <select value={editFormFull.taxRate ?? '7'} onChange={e => setEditFormFull((p: any) => ({ ...p, taxRate: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="7">%7</option><option value="19">%19</option><option value="0">%0</option>
 </select>
 </div>
 </div>
 <div className="md:col-span-2 lg:col-span-3">
 <label className="text-xs text-muted-foreground mb-1 block">{t('aciklama')}</label>
 <MultiLanguageInput label="Açıklama" value={editFormFull.description || { tr: '' }} onChange={(v: any) => setEditFormFull((p: any) => ({ ...p, description: v }))} isTextArea />
 </div>
 </div>
 )}

 {editInlineTab === 'pricing' && (() => {
 const taxRate = editFormFull.taxRate === undefined ? 7 : parseFloat(editFormFull.taxRate || '7');
 const taxMultiplier = 1 + (taxRate / 100);
 const priceInputMode = editFormFull._priceInputMode || 'netto';
 const calcBrutto = (netto: number) => netto > 0 ? parseFloat((netto * taxMultiplier).toFixed(2)) : 0;
 const calcNetto = (brutto: number) => brutto > 0 ? parseFloat((brutto / taxMultiplier).toFixed(2)) : 0;

 const sp = parseFloat(editFormFull.sellingPrice || '0');
 const pp = parseFloat(editFormFull.purchasePrice || '0');
 const dp = parseFloat(editFormFull.discountedPrice || '0');
 const discountPct = sp > 0 && dp > 0 && dp < sp ? ((1 - dp / sp) * 100).toFixed(1) : null;

 return (
 <div className="space-y-6">
 {/* Vergi Oranı */}
 <div className="border-b border-border pb-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400">{t('vergi_orani')}</h3>
 <span className="text-xs text-muted-foreground">{t('netto_brutto_hint')}</span>
 </div>
 <div className="flex items-center gap-3">
 <select value={String(taxRate)} onChange={e => { const val = e.target.value; if (val === 'custom') { const customRate = prompt('Vergi oranını girin:', '0'); if (customRate !== null) { setEditFormFull((p: any) => ({ ...p, taxRate: String(parseFloat(customRate) || 0) })); } } else { setEditFormFull((p: any) => ({ ...p, taxRate: val })); } }} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
 <option value="0">{t('tax_zero')}</option>
 <option value="7">{t('tax_reduced')}</option>
 <option value="19">{t('tax_standard')}</option>
 <option value="custom">{t('manuel_giris')}</option>
 </select>
 {![0, 7, 19].includes(taxRate) && (
 <span className="px-3 py-1.5 bg-blue-900/50 text-blue-300 rounded-lg text-xs">{t('ozel_vergi', {rate: taxRate})}</span>
 )}
 </div>
 </div>

 {/* {t('fiyatlandirma')} + Netto/Brutto Toggle */}
 <div className="border-b border-border pb-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400"> {t('fiyatlandirma')}</h3>
 <div className="flex items-center bg-card rounded-lg p-0.5 border border-border">
 <button type="button" onClick={() => setEditFormFull((p: any) => ({ ...p, _priceInputMode: 'netto' }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${priceInputMode === 'netto' ? 'bg-amber-600 text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}>
 {t('netto_input')}
 </button>
 <button type="button" onClick={() => setEditFormFull((p: any) => ({ ...p, _priceInputMode: 'brutto' }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${priceInputMode === 'brutto' ? 'bg-amber-600 text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}>
 {t('brutto_input')}
 </button>
 </div>
 </div>

 {/* Alış Fiyatı */}
 <div className="mb-4">
 <label className="block text-sm text-foreground font-medium mb-2">{t('alis_fiyati')}</label>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('netto_eur') || "Netto (€)"}</label>
 {priceInputMode === 'netto' ? (
 <input type="number" step="0.01" value={editFormFull.purchasePrice || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, purchasePrice: e.target.value }))} className="w-full bg-background border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
 ) : (
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {pp > 0 ? `€${pp.toFixed(2)}` : <span className="text-muted-foreground">--</span>}
 </div>
 )}
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1">Brutto (€) <span className="text-muted-foreground">inkl. {taxRate}% MwSt.</span></label>
 {priceInputMode === 'brutto' ? (
 <input type="number" step="0.01" value={pp > 0 ? calcBrutto(pp) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; setEditFormFull((p: any) => ({ ...p, purchasePrice: String(calcNetto(brutto)) })); }} className="w-full bg-background border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
 ) : (
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {pp > 0 ? `€${calcBrutto(pp).toFixed(2)}` : <span className="text-muted-foreground">--</span>}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Satış Fiyatı */}
 <div className="mb-4">
 <label className="block text-sm text-foreground font-medium mb-2">{t('satis_fiyati')}</label>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('netto_eur') || "Netto (€)"}</label>
 {priceInputMode === 'netto' ? (
 <input type="number" step="0.01" value={editFormFull.sellingPrice || ''} onChange={e => { setEditFormFull((p: any) => ({ ...p, sellingPrice: e.target.value })); setCustomProductForm((prev: any) => ({ ...prev, price: e.target.value })); }} className="w-full bg-background border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
 ) : (
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {sp > 0 ? `€${sp.toFixed(2)}` : <span className="text-muted-foreground">--</span>}
 </div>
 )}
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1">Brutto (€) <span className="text-muted-foreground">inkl. {taxRate}% MwSt.</span></label>
 {priceInputMode === 'brutto' ? (
 <input type="number" step="0.01" value={sp > 0 ? calcBrutto(sp) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; const netto = calcNetto(brutto); setEditFormFull((p: any) => ({ ...p, sellingPrice: String(netto) })); setCustomProductForm((prev: any) => ({ ...prev, price: String(netto) })); }} className="w-full bg-background border border-amber-600/50 rounded-lg px-4 py-2 text-amber-200" placeholder="0.00" />
 ) : (
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {sp > 0 ? `€${calcBrutto(sp).toFixed(2)}` : <span className="text-muted-foreground">--</span>}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* İndirimli Fiyat */}
 <div className="mb-4">
 <label className="block text-sm text-foreground font-medium mb-2 flex items-center gap-2">
 {t('discounted_price')}
 {discountPct && (
 <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600/80 text-white animate-pulse">
 -%{discountPct}
 </span>
 )}
 </label>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('netto_eur') || "Netto (€)"}</label>
 {priceInputMode === 'netto' ? (
 <input type="number" step="0.01" value={editFormFull.discountedPrice || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, discountedPrice: e.target.value }))} className="w-full bg-background border border-red-600/50 rounded-lg px-4 py-2 text-red-200" placeholder="0.00 (opsiyonel)" />
 ) : (
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {dp > 0 ? `€${dp.toFixed(2)}` : <span className="text-muted-foreground">--</span>}
 </div>
 )}
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1">Brutto (€) <span className="text-muted-foreground">inkl. {taxRate}% MwSt.</span></label>
 {priceInputMode === 'brutto' ? (
 <input type="number" step="0.01" value={dp > 0 ? calcBrutto(dp) : ''} onChange={e => { const brutto = parseFloat(e.target.value) || 0; setEditFormFull((p: any) => ({ ...p, discountedPrice: String(calcNetto(brutto)) })); }} className="w-full bg-background border border-red-600/50 rounded-lg px-4 py-2 text-red-200" placeholder="0.00" />
 ) : (
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {dp > 0 ? `€${calcBrutto(dp).toFixed(2)}` : <span className="text-muted-foreground">--</span>}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Kar Marjı Özet */}
 <div className="bg-card/50 rounded-lg p-3 border border-border">
 <div className="grid grid-cols-3 gap-3 text-center">
 <div>
 <span className="block text-xs text-muted-foreground mb-1">{t('kar_marji')}</span>
 <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
 {sp > 0 && pp > 0 ? `%${(((sp - pp) / pp) * 100).toFixed(1)}` : '--'}
 </span>
 </div>
 <div>
 <span className="block text-xs text-muted-foreground mb-1">{t('vergi_tutari')}</span>
 <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
 {sp > 0 ? `€${(sp * taxRate / 100).toFixed(2)}` : '--'}
 </span>
 </div>
 <div>
 <span className="block text-xs text-muted-foreground mb-1">{t('brutto_satis')}</span>
 <span className="text-sm font-medium text-foreground">
 {sp > 0 ? `€${calcBrutto(sp).toFixed(2)}` : '--'}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* 📱 App Satış Fiyatı */}
 <div className="border-b border-border pb-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">{t('app_sales_price')}</h3>
 <label className="flex items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={!!(editFormFull.appPrice && parseFloat(editFormFull.appPrice) > 0)} onChange={e => { if (!e.target.checked) { setEditFormFull((p: any) => ({ ...p, appPrice: '' })); } else { setEditFormFull((p: any) => ({ ...p, appPrice: editFormFull.sellingPrice || '0' })); } }} className="w-4 h-4 rounded accent-blue-500" />
 <span className="text-xs text-muted-foreground">{t('farkli_fiyat_uygula')}</span>
 </label>
 </div>
 <p className="text-xs text-muted-foreground mb-3">{t('app_price_desc')}</p>
 {editFormFull.appPrice && parseFloat(editFormFull.appPrice) > 0 ? (
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('netto_eur') || "Netto (€)"}</label>
 <input type="number" step="0.01" value={editFormFull.appPrice || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, appPrice: e.target.value }))} className="w-full bg-background border border-blue-600/50 rounded-lg px-4 py-2 text-blue-200" placeholder="0.00" />
 </div>
 <div>
 <label className="block text-xs text-muted-foreground mb-1">{t('brutto')} <span className="text-muted-foreground">inkl. {taxRate}%</span></label>
 <div className="px-4 py-2 bg-background/60 border border-border rounded-lg text-sm text-foreground">
 {parseFloat(editFormFull.appPrice) > 0 ? `€${calcBrutto(parseFloat(editFormFull.appPrice)).toFixed(2)}` : '--'}
 </div>
 </div>
 </div>
 ) : (
 <div className="px-4 py-3 bg-card/40 border border-border rounded-lg text-center">
 <span className="text-sm text-muted-foreground">{t('same_as_selling_price')}{sp > 0 ? ` (€${sp.toFixed(2)})` : ''}</span>
 </div>
 )}
 </div>

 {/* Kanal Fiyatları (Konsolide) */}
 <div className="pb-4">
 <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-400 mb-3"> {t('kanal_fiyatlari')}</h3>
 <p className="text-xs text-muted-foreground mb-3">{t('esl_price_hint')}</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('esl_store_pickup_price')} (€)</label>
 <input type="number" step="0.01" value={editFormFull.eslPrice || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, eslPrice: e.target.value, storePrice: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-emerald-500 focus:outline-none" placeholder={t('esl_price_placeholder')} />
 <span className="text-[10px] text-muted-foreground mt-1 block">{t('esl_price_hint')}</span>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('courier_price_label')} (€)</label>
 <input type="number" step="0.01" value={editFormFull.courierPrice || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, courierPrice: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-emerald-500 focus:outline-none" placeholder={t('esl_price_placeholder')} />
 <span className="text-[10px] text-muted-foreground mt-1 block">{t('kurye_fiyat_aciklama')}</span>
 </div>
 </div>
 </div>
 </div>
 );
 })()}

 {editInlineTab === 'stock' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('stok_durumu')}</label>
 <select value={editFormFull.outOfStock ? 'out' : 'in'} onChange={e => setEditFormFull((p: any) => ({ ...p, outOfStock: e.target.value === 'out' }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="in">{t('stokta')}</option><option value="out">{t('stokta_degil')}</option>
 </select>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('mevcut_stok')}</label>
 <input type="number" value={editFormFull.currentStock || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, currentStock: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('min_stok')}</label>
 <input type="number" value={editFormFull.minStock || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, minStock: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('tedarikci_label')}</label>
 <input value={editFormFull.supplierName || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, supplierName: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('parti_no')}</label>
 <input value={editFormFull.batchNumber || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, batchNumber: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('depo_konumu')}</label>
 <input value={editFormFull.stockLocation || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, stockLocation: e.target.value }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 </div>
 )}

 {editInlineTab === 'media' && (
 <div className="space-y-4">
 {/* Mevcut Görseller */}
 <div>
 <label className="text-xs text-muted-foreground mb-2 block">{t('mevcut_gorseller')}</label>
 <div className="flex gap-2 flex-wrap">
 {editingInlineProduct?.imageUrl && (
 <div className="relative group">
 <img src={editingInlineProduct.imageUrl} alt="" className="w-20 h-20 rounded object-cover border border-border" />
 </div>
 )}
 {(editFormFull.images || editingInlineProduct?.images || []).map((img: string, i: number) => (
 <div key={i} className="relative group">
 <img src={img} alt="" className="w-20 h-20 rounded object-cover border border-border" />
 <button
 type="button"
 onClick={() => {
 setEditFormFull((p: any) => {
 const current = [...(p.images || editingInlineProduct?.images || [])];
 current.splice(i, 1);
 return { ...p, images: current };
 });
 }}
 className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
 >
 ✕
 </button>
 </div>
 ))}
 {!editingInlineProduct?.imageUrl && !(editFormFull.images || editingInlineProduct?.images || []).length && (
 <p className="text-muted-foreground text-sm">{t('gorsel_yok')}</p>
 )}
 </div>
 </div>

 {/* Dosyadan Yükle */}
 <div>
 <label className="text-xs text-muted-foreground mb-2 block">📤 Görsel Yükle (Dosya Seç)</label>
 <input
 type="file"
 accept="image/*"
 multiple
 onChange={async (e) => {
 if (!e.target.files || e.target.files.length === 0) return;
 const files = Array.from(e.target.files);
 for (const file of files) {
 try {
 const storageRef = ref(storage, `business_products/${businessId}/${Date.now()}_${file.name}`);
 const uploadTask = uploadBytesResumable(storageRef, file);
 uploadTask.on('state_changed', () => { }, (error) => {
 console.error('Image upload error:', error);
 showToast(t('image_upload_error'), 'error');
 }, async () => {
 const url = await getDownloadURL(uploadTask.snapshot.ref);
 setEditFormFull((p: any) => ({
 ...p,
 imageUrl: p.imageUrl || url,
 images: [...(p.images || []), url]
 }));
 showToast(t('image_uploaded'), 'success');
 });
 } catch (err) {
 console.error('Upload error:', err);
 }
 }
 e.target.value = '';
 }}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30"
 />
 <p className="text-xs text-muted-foreground mt-1">Birden fazla dosya seçebilirsiniz. JPG, PNG, WebP formatları desteklenir.</p>
 </div>

 {/* URL ile ekle */}
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">🔗 Görsel URL (opsiyonel)</label>
 <input value={editFormFull.imageUrl || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 </div>
 )}

 {editInlineTab === 'contentCompliance' && (
 <div className="space-y-6">

 {/* ═══ BÖLÜM 1: İÇERİK LİSTESİ ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('ingredients_title')}
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="md:col-span-2">
 <label className="text-xs text-muted-foreground mb-1 block">{t('ingredients_label')}</label>
 <textarea value={editFormFull.ingredients || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, ingredients: e.target.value }))} rows={3} placeholder="Hähnchenfleisch (60%), Zwiebeln, Paprika, Gewürze (Salz, Pfeffer, Kreuzkümmel), Sonnenblumenöl..." className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('consumption_info_label')}</label>
 <textarea value={editFormFull.consumptionInfo || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, consumptionInfo: e.target.value }))} rows={2} placeholder="Zum sofortigen Verzehr bestimmt. Kühl lagern bei +2°C bis +7°C." className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('additives_label')}</label>
 <input value={(editFormFull.additives || []).join(', ')} onChange={e => setEditFormFull((p: any) => ({ ...p, additives: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="E300, E330, E621..." className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('origin') || "Herkunft / Menşe"}</label>
 <input value={editFormFull.origin || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, origin: e.target.value }))} placeholder="z.B. Deutschland, Türkei, EU" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div className="flex items-center gap-3">
 <label className="inline-flex items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={editFormFull.containsAlcohol || false} onChange={e => setEditFormFull((p: any) => ({ ...p, containsAlcohol: e.target.checked }))} className="w-4 h-4 rounded border-border bg-card" />
 <span className="text-xs text-foreground">🍷 Alkol İçerir (Alkoholhaltig)</span>
 </label>
 </div>
 </div>
 </div>

 <hr className="border-border/50" />

 {/* ═══ BÖLÜM 2: EU 14 ALERJEN ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('allergens_title')}
 </h4>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
 {[
 { key: 'gluten', label: t('allergen_gluten'), emoji: '🌾' },
 { key: 'crustaceans', label: t('allergen_crustaceans'), emoji: '🦐' },
 { key: 'eggs', label: t('allergen_eggs'), emoji: '🥚' },
 { key: 'fish', label: t('allergen_fish'), emoji: '🐟' },
 { key: 'peanuts', label: t('allergen_peanuts'), emoji: '🥜' },
 { key: 'soy', label: t('allergen_soy'), emoji: '🫘' },
 { key: 'milk', label: t('allergen_milk'), emoji: '🥛' },
 { key: 'treeNuts', label: t('allergen_treeNuts'), emoji: '🌰' },
 { key: 'celery', label: t('allergen_celery'), emoji: '🥬' },
 { key: 'mustard', label: t('allergen_mustard'), emoji: '🟡' },
 { key: 'sesame', label: t('allergen_sesame'), emoji: '⚪' },
 { key: 'sulfites', label: t('allergen_sulfites'), emoji: '🧪' },
 { key: 'lupin', label: t('allergen_lupin'), emoji: '🌸' },
 { key: 'molluscs', label: t('allergen_molluscs'), emoji: '🐚' },
 ].map(allergen => {
 const checked = (editFormFull.allergens || {})[allergen.key] === true;
 return (
 <button
 key={allergen.key}
 type="button"
 onClick={() => setEditFormFull((p: any) => ({
 ...p,
 allergens: { ...(p.allergens || {}), [allergen.key]: !(p.allergens || {})[allergen.key] }
 }))}
 className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition ${checked
 ? 'bg-amber-500/20 border-amber-500 text-amber-300'
 : 'bg-card/50 border-border text-muted-foreground hover:border-gray-500'
 }`}
 >
 <span className="text-lg">{allergen.emoji}</span>
 <span className="text-[10px] font-medium leading-tight">{allergen.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 <hr className="border-border/50" />

 {/* ═══ BÖLÜM 3: BESİN DEĞERLERİ ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-green-800 dark:text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('nutrition_title')}
 </h4>
 <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
 {[
 { key: 'energie_kj', label: t('nutrition_energie'), unit: 'kJ', required: true },
 { key: 'energie_kcal', label: t('nutrition_energie'), unit: 'kcal', required: true },
 { key: 'fett', label: t('nutrition_fett'), unit: 'g', required: true },
 { key: 'gesaettigte_fettsaeuren', label: t('nutrition_ges_fetts'), unit: 'g', required: true },
 { key: 'kohlenhydrate', label: t('nutrition_kohlenh'), unit: 'g', required: true },
 { key: 'zucker', label: t('nutrition_zucker'), unit: 'g', required: true },
 { key: 'protein', label: t('nutrition_eiweiss'), unit: 'g', required: true },
 { key: 'salz', label: t('nutrition_salz'), unit: 'g', required: true },
 { key: 'ballaststoffe', label: t('nutrition_ballaststoffe'), unit: 'g', required: false },
 { key: 'einfach_unges_fett', label: t('nutrition_einf_ung_f'), unit: 'g', required: false },
 { key: 'mehrfach_unges_fett', label: t('nutrition_mehrf_ung_f'), unit: 'g', required: false },
 { key: 'staerke', label: t('nutrition_staerke'), unit: 'g', required: false },
 ].map(item => (
 <div key={item.key}>
 <span className={`text-[9px] block mb-0.5 ${item.required ? 'text-green-500 font-medium' : 'text-muted-foreground'}`}>
 {item.label} ({item.unit}){item.required ? ' *' : ''}
 </span>
 <input
 type="number"
 step="0.01"
 value={(editFormFull.nutritionPer100g || {})[item.key] ?? ''}
 onChange={e => setEditFormFull((p: any) => ({
 ...p,
 nutritionPer100g: { ...(p.nutritionPer100g || {}), [item.key]: e.target.value === '' ? undefined : parseFloat(e.target.value) }
 }))}
 className="w-full bg-background/50 text-white text-xs rounded px-2 py-1.5 border border-border focus:border-green-500 focus:outline-none"
 />
 </div>
 ))}
 </div>
 <p className="text-[10px] text-muted-foreground mt-1">{t('eu_big7_note')}</p>
 </div>

 <hr className="border-border/50" />

 {/* ═══ BÖLÜM 4: SERTİFİKALAR ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-purple-800 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('certificates_title')}
 </h4>
 <div className="flex flex-wrap gap-2">
 {[
 { key: 'cert_tuna', label: t('cert_tuna_label'), emoji: '🐟', color: 'blue' },
 { key: 'cert_akdeniz', label: t('cert_akdeniz_label'), emoji: '🌊', color: 'cyan' },
 { key: 'cert_halal', label: t('cert_halal_label'), emoji: '☪️', color: 'green' },
 { key: 'cert_bio', label: t('cert_bio_label'), emoji: '🌿', color: 'green' },
 { key: 'cert_vegan', label: t('cert_vegan_label'), emoji: '🌱', color: 'green' },
 { key: 'cert_vegetarian', label: t('cert_vegetarian_label'), emoji: '🥬', color: 'green' },
 { key: 'cert_glutenfree', label: t('cert_glutenfree_label'), emoji: '🚫', color: 'amber' },
 { key: 'cert_lactosefree', label: t('cert_lactosefree_label'), emoji: '🚫', color: 'amber' },
 { key: 'cert_ifs', label: t('cert_ifs_label'), emoji: '🛡️', color: 'purple' },
 { key: 'cert_haccp', label: t('cert_haccp_label'), emoji: '✅', color: 'purple' },
 { key: 'cert_msc', label: t('cert_msc_label'), emoji: '🔵', color: 'blue' },
 { key: 'cert_fairtrade', label: t('cert_fairtrade_label'), emoji: '🟢', color: 'green' },
 { key: 'cert_eigenmarke', label: t('cert_eigenmarke_label'), emoji: '🇩🇪', color: 'gray' },
 ].map(cert => {
 const selected = (editFormFull.certifications || []).includes(cert.key);
 return (
 <button
 key={cert.key}
 type="button"
 onClick={() => {
 setEditFormFull((p: any) => {
 const current = p.certifications || [];
 return {
 ...p,
 certifications: selected
 ? current.filter((c: string) => c !== cert.key)
 : [...current, cert.key]
 };
 });
 }}
 className={`px-3 py-2 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${selected
 ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm shadow-purple-500/10'
 : 'bg-card/50 border-border text-muted-foreground hover:border-gray-500'
 }`}
 >
 <span>{cert.emoji}</span>
 <span>{selected ? '✓ ' : ''}{cert.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 <hr className="border-border/50" />

 {/* ═══ BÖLÜM 5: DAHİLİ NOTLAR & ETİKETLER ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('internal_notes_title')}
 </h4>
 <div className="space-y-3">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">Dahili {t('notlar')}</label>
 <textarea value={editFormFull.internalNotes || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, internalNotes: e.target.value }))} rows={3} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-none" placeholder="Sadece admin panelinde görünür notlar..." />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('etiketler')}</label>
 <input value={(editFormFull.tags || []).join(', ')} onChange={e => setEditFormFull((p: any) => ({ ...p, tags: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="etiket1, etiket2" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 </div>
 </div>

 <hr className="border-border/50" />

 {/* ═══ BÖLÜM 6: DENETİM İZİ ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('audit_trail_title')}
 </h4>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
 <div className="bg-background/30 rounded p-3 border border-border/50">
 <p className="text-xs text-muted-foreground mb-1">{t('olusturulma')}</p>
 <p className="text-xs text-foreground">{editingInlineProduct?.createdAt?.toDate ? editingInlineProduct.createdAt.toDate().toLocaleDateString('de-DE') : '—'}</p>
 </div>
 <div className="bg-background/30 rounded p-3 border border-border/50">
 <p className="text-xs text-muted-foreground mb-1">{t('guncelleme')}</p>
 <p className="text-xs text-foreground">{editingInlineProduct?.updatedAt?.toDate ? editingInlineProduct.updatedAt.toDate().toLocaleDateString('de-DE') : '—'}</p>
 </div>
 <div className="bg-background/30 rounded p-3 border border-border/50">
 <p className="text-xs text-muted-foreground mb-1">{t('sku_master_id') || "SKU / Master ID"}</p>
 <p className="text-xs text-foreground">{editingInlineProduct?.id || '—'}</p>
 <p className="text-xs text-muted-foreground">{editingInlineProduct?.masterId ? `Master: ${editingInlineProduct.masterId}` : ''}</p>
 </div>
 </div>
 </div>

 <hr className="border-border/50" />

 {/* ═══ BÖLÜM 7: FİZİKSEL & SAKLAMA ═══ */}
 <div>
 <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
 <span></span> {t('physical_info_title')}
 </h4>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('weight') || "Gewicht (Ağırlık)"}</label>
 <input value={editFormFull.weight || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, weight: e.target.value }))} placeholder="500g, 1kg" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('packaging') || "Packung (Ambalaj)"}</label>
 <input value={editFormFull.packung || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, packung: e.target.value }))} placeholder="Vakuum, Schale" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('storage_temp') || "Gehäusetemperatur (Saklama)"}</label>
 <input value={editFormFull.storageTemp || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, storageTemp: e.target.value }))} placeholder="+2°C bis +7°C" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('mhd_label')}</label>
 <input value={editFormFull.mhd || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, mhd: e.target.value }))} placeholder="z.B. 14 Tage" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div className="col-span-2">
 <p className="text-xs text-amber-800 dark:text-amber-400/80 bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded px-3 py-2">
 {t('mhd_note')}
 </p>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('artikelnummer')}</label>
 <input value={editFormFull.artikelnummer || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, artikelnummer: e.target.value }))} placeholder="Ürün No" className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div className="col-span-2 md:col-span-3 lg:col-span-4">
 <label className="text-xs text-muted-foreground mb-1 block">{t('special_info_label')}</label>
 <textarea value={editFormFull.specialInfo || ''} onChange={e => setEditFormFull((p: any) => ({ ...p, specialInfo: e.target.value }))} rows={2} placeholder={t('ozel_uyarilar_placeholder')} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-none" />
 </div>
 </div>
 </div>

 </div>
 )}

 {editInlineTab === 'app' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('one_cikan_urun')}</label>
 <select value={editFormFull.isFeatured ? 'yes' : 'no'} onChange={e => setEditFormFull((p: any) => ({ ...p, isFeatured: e.target.value === 'yes' }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="no">{t('hayir')}</option>
 <option value="yes">Evet ⭐</option>
 </select>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('stock_status_app') || "Stok Durumu (App)"}</label>
 <select value={editFormFull.outOfStock ? 'out' : 'in'} onChange={e => setEditFormFull((p: any) => ({ ...p, outOfStock: e.target.value === 'out' }))} className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="in">{t('stokta')}</option>
 <option value="out">{t('stokta_yok')}</option>
 </select>
 </div>
 <div className="md:col-span-2 lg:col-span-3">
 <label className="text-xs text-muted-foreground mb-2 block">{t('option_groups') || "Seçenek Grupları (Opsiyonlar/Extras)"}</label>
 {(editFormFull.optionGroups || []).length > 0 ? (
 <div className="space-y-2">
 {(editFormFull.optionGroups || []).map((group: any, i: number) => (
 <div key={i} className="bg-background/30 rounded p-2 border border-border/50 text-sm text-foreground">
 <span className="font-medium text-foreground">{group.name || `Grup ${i + 1}`}</span>
 {group.options?.length > 0 && (
 <span className="text-muted-foreground ml-2">({group.options.length} seçenek)</span>
 )}
 </div>
 ))}
 </div>
 ) : (
 <p className="text-muted-foreground text-sm">{t('secenek_grubu_tanimlanmamis')}</p>
 )}
 </div>
 <div className="md:col-span-2 lg:col-span-3 bg-background/20 rounded p-3 border border-border/30">
 <p className="text-xs text-muted-foreground">💡 Mobil uygulamada bu ürünün nasıl görüneceğini buradan yönetebilirsiniz. {t('fiyatlandirma')} farklılıkları &quot;Fiyat &amp; Vergi&quot; sekmesindedir.</p>
 </div>
 </div>
 )}


 </div>

 {/* Footer */}
 <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-border/50">
 <button onClick={() => { setEditingInlineProduct(null); setEditFormFull({}); setEditInlineTab('general'); }} className="px-6 py-2 text-sm text-muted-foreground hover:text-white transition">
 {t('iptal')}
 </button>
 <button onClick={handleAddProduct} disabled={addingProduct} className="px-8 py-2 bg-blue-500 hover:bg-blue-600 text-foreground text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50">
 {addingProduct ? 'Kaydediliyor...' : 'Kaydet'}
 </button>
 </div>
 </div>
 </div>
 )}
 </Fragment>
 );
 })}
 </div>

 {/* Pagination Controls */}
 {
 totalPages > 1 && (
 <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between flex-wrap gap-2">
 {/* Left: Info */}
 <div className="text-muted-foreground text-xs">
 {startIdx + 1}–{Math.min(endIdx, totalFiltered)} / {totalFiltered} ürün
 {productSearchQuery.trim() && (
 <span className="text-blue-800 dark:text-blue-400 ml-1">({t('search_results') || "arama sonuçları"})</span>
 )}
 </div>

 {/* Center: Page Buttons */}
 <div className="flex items-center gap-1">
 <button
 onClick={() => setProductCurrentPage(1)}
 disabled={safeCurrentPage === 1}
 className="px-2 py-1 rounded text-xs bg-accent text-foreground dark:bg-muted dark:text-gray-100 hover:bg-muted border border-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
 >
 «
 </button>
 <button
 onClick={() => setProductCurrentPage(Math.max(1, safeCurrentPage - 1))}
 disabled={safeCurrentPage === 1}
 className="px-2 py-1 rounded text-xs bg-accent text-foreground dark:bg-muted dark:text-gray-100 hover:bg-muted border border-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
 >
 ‹
 </button>
 {getPageNumbers().map((pg, idx) => (
 pg === '...' ? (
 <span key={`dots-${idx}`} className="px-1 text-muted-foreground text-xs">…</span>
 ) : (
 <button
 key={pg}
 onClick={() => setProductCurrentPage(pg)}
 className={`px-2.5 py-1 rounded text-xs font-medium transition ${pg === safeCurrentPage
 ? 'bg-blue-600 text-white'
 : 'bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm'
 }`}
 >
 {pg}
 </button>
 )
 ))}
 <button
 onClick={() => setProductCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
 disabled={safeCurrentPage === totalPages}
 className="px-2 py-1 rounded text-xs bg-accent text-foreground dark:bg-muted dark:text-gray-100 hover:bg-muted border border-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
 >
 ›
 </button>
 <button
 onClick={() => setProductCurrentPage(totalPages)}
 disabled={safeCurrentPage === totalPages}
 className="px-2 py-1 rounded text-xs bg-accent text-foreground dark:bg-muted dark:text-gray-100 hover:bg-muted border border-border text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
 >
 »
 </button>
 </div>

 {/* Right: Per page selector */}
 <div className="flex items-center gap-2">
 <span className="text-muted-foreground text-xs">{t('per_page') || "Sayfa başı:"}</span>
 <select
 value={productsPerPage}
 onChange={(e) => {
 setProductsPerPage(Number(e.target.value));
 setProductCurrentPage(1);
 }}
 className="bg-foreground text-background shadow-md text-xs rounded px-2 py-1 border border-border focus:border-blue-500 focus:outline-none"
 >
 <option value={10}>10</option>
 <option value={20}>20</option>
 <option value={50}>50</option>
 <option value={100}>100</option>
 </select>
 </div>
 </div>
 )
 }

 {/* No results message for search */}
 {
 totalFiltered === 0 && productSearchQuery.trim() && (
 <div className="px-4 py-8 text-center">
 <p className="text-muted-foreground text-sm">{t('aranilan')} <span className="text-foreground font-medium">"{productSearchQuery}"</span> için sonuç bulunamadı.</p>
 <button
 onClick={() => {
 setProductSearchQuery('');
 setProductCurrentPage(1);
 }}
 className="mt-2 text-blue-800 dark:text-blue-400 hover:text-blue-300 text-sm transition"
 >
 Aramayı temizle
 </button>
 </div>
 )
 }
 </div>
 </div>
 );
 })()}
 </div>
 )}

 {/* ==================== SPONSORED PRODUCTS ==================== */}
 {menuInternalTab === "sponsored" && (
 <LockedModuleOverlay featureKey="sponsoredProducts">
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-2xl">⭐</span>
 <div>
 <h4 className="text-foreground font-bold">{t('one_cikan_urunler')}</h4>
 <p className="text-muted-foreground text-xs">{t('one_cikan_aciklama')}</p>
 </div>
 </div>
 </div>

 {/* Limit Progress Bar */}
 <div className="bg-card/60 rounded-xl border border-amber-500/30 p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-foreground font-medium">
 {t('sponsored_kullanim')}
 </span>
 <span className={`text-sm font-bold ${sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness
 ? 'text-red-800 dark:text-red-400'
 : 'text-amber-800 dark:text-amber-400'
 }`}>
 {sponsoredProducts.length} / {sponsoredSettings.maxProductsPerBusiness}
 </span>
 </div>
 <div className="w-full bg-muted rounded-full h-2.5">
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
 <p className="text-xs text-muted-foreground mt-2">
 {t('sponsored_donusum_ucret')} {sponsoredSettings.feePerConversion}€
 </p>
 )}
 </div>

 {/* Product List with Checkboxes */}
 {loadingProducts ? (
 <div className="flex justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
 </div>
 ) : inlineProducts.length === 0 ? (
 <div className="bg-background/50 rounded-xl p-8 text-center border border-border">
 <span className="text-4xl"></span>
 <h4 className="text-foreground font-medium mt-3">{t('henuz_urun_eklenmemis')}</h4>
 <p className="text-muted-foreground text-sm mt-1">{t('sponsored_urun_once_ekle')}</p>
 </div>
 ) : (
 <div className="space-y-1">
 {inlineProducts.filter((p: any) => p.isActive !== false).map((product: any) => {
 const isSponsored = sponsoredProducts.includes(product.id);
 const limitReached = sponsoredProducts.length >= sponsoredSettings.maxProductsPerBusiness;
 const disabled = !isSponsored && limitReached;
 return (
 <label
 key={product.id}
 className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${isSponsored
 ? 'bg-amber-900/20 border-amber-500/40 hover:border-amber-400/60'
 : disabled
 ? 'bg-card/30 border-border/50 opacity-50 cursor-not-allowed'
 : 'bg-card/40 border-border hover:border-gray-500'
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
 className="w-5 h-5 rounded bg-muted border-border text-amber-500 focus:ring-amber-500 accent-amber-500"
 />
 {/* Product image */}
 {product.imageUrl || (product.images && product.images[0]) ? (
 <img
 src={product.imageUrl || product.images[0]}
 alt={product.name}
 className="w-10 h-10 rounded-lg object-cover"
 />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-lg">
 📷
 </div>
 )}
 {/* Name */}
 <div className="flex-1 min-w-0">
 <p className="text-foreground text-sm font-medium truncate">
 {typeof product.name === 'object' ? getLocalizedText(product.name) : product.name}
 </p>
 <p className="text-muted-foreground text-xs truncate">
 {product.category || ''}
 </p>
 </div>
 {/* Price */}
 <div className="text-right">
 {product.price != null && (
 <span className="text-green-800 dark:text-green-400 font-bold text-sm">
 {typeof product.price === 'number' ? product.price.toFixed(2) : product.price}€
 </span>
 )}
 </div>
 {/* Star badge */}
 {isSponsored && (
 <span className="text-amber-800 dark:text-amber-400 text-lg">⭐</span>
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
 if (!businessId) return;
 setSponsoredSaving(true);
 try {
 await updateDoc(doc(db, 'businesses', businessId), {
 sponsoredProducts: sponsoredProducts,
 hasSponsoredProducts: sponsoredProducts.length > 0,
 });
 showToast(t('sponsored_kaydedildi'), 'success');
 } catch (error) {
 console.error('Error saving sponsored products:', error);
 showToast(t('sponsored_kaydetme_hatasi'), 'error');
 }
 setSponsoredSaving(false);
 }}
 disabled={sponsoredSaving}
 className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
 >
 {sponsoredSaving ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
 {t('sponsored_kaydediliyor')}
 </>
 ) : (
 <>
 {t('sponsored_kaydet')} ({sponsoredProducts.length} {t('sponsored_urun')})
 </>
 )}
 </button>
 </div>
 </div>
 </LockedModuleOverlay>
 )}
 </div>
 )
 }

 {/* Sub-Tab: Personel */}
 {
 settingsSubTab === "personel" && (
 <LockedModuleOverlay featureKey="staffShiftTracking">
 <div className="space-y-6">

 {/* ═══════ Aktif Vardiyalar Panel ═══════ */}
 {activeShifts.length > 0 && (
 <div className="bg-gradient-to-br from-green-100 dark:from-green-900/40 to-green-50 dark:to-green-800/20 border border-green-600/30 rounded-xl p-5">
 <div className="flex items-center gap-2 mb-4">
 <span className="text-2xl">🟢</span>
 <h3 className="text-lg font-bold text-green-300">
 {t('aktif_vardiyalar')}{activeShifts.length})
 </h3>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead className="text-green-800 dark:text-green-400/80 border-b border-green-200 dark:border-green-700/50">
 <tr>
 <th className="pb-2 pr-3">{t('personel_th')}</th>
 <th className="pb-2 pr-3">{t('baslangic')}</th>
 <th className="pb-2 pr-3">{t('sure')}</th>
 <th className="pb-2 pr-3">{t('konum_th')}</th>
 <th className="pb-2 pr-3">{t('masalar_th')}</th>
 <th className="pb-2">{t('durum')}</th>
 </tr>
 </thead>
 <tbody>
 {activeShifts.map(shift => {
 const startTime = shift.shiftStartedAt?.toDate?.() || shift.shiftStartedAt;
 const startStr = startTime
 ? new Date(startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
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
 <td className="py-2.5 pr-3 text-foreground font-medium">
 {shift.displayName || shift.email || t('isimsiz')}
 </td>
 <td className="py-2.5 pr-3 text-foreground">{startStr}</td>
 <td className="py-2.5 pr-3 text-foreground font-mono">{elapsedStr}</td>
 <td className="py-2.5 pr-3 text-muted-foreground max-w-[150px] truncate" title={shift.shiftStartLocation?.address}>
 {shift.shiftStartLocation?.address
 ? shift.shiftStartLocation.address.substring(0, 30) + (shift.shiftStartLocation.address.length > 30 ? '…' : '')
 : '—'}
 </td>
 <td className="py-2.5 pr-3 text-foreground">
 {shift.shiftAssignedTables?.length
 ? shift.shiftAssignedTables.join(', ')
 : '—'}
 </td>
 <td className="py-2.5">
 <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isPaused
 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
 : 'bg-green-500/20 text-green-300 border border-green-500/30'
 }`}>
 {isPaused ? t('mola') : t('aktif_status')}
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
 : 'bg-muted text-muted-foreground hover:bg-muted border border-border text-foreground'
 }`}
 >
 {t('aktif')}{staffList.filter(s => s.isActive !== false).length})
 </button>
 <button
 onClick={() => setStaffStatusFilter('archived')}
 className={`px-4 py-2 rounded-lg font-medium transition ${staffStatusFilter === 'archived'
 ? 'bg-amber-600 text-white'
 : 'bg-muted text-muted-foreground hover:bg-muted border border-border text-foreground'
 }`}
 >
 {t('arsivlenmis')}{staffList.filter(s => s.isActive === false).length})
 </button>
 </div>

 {/* Search */}
 <div className="relative">
 <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></span>
 <input
 type="text"
 placeholder={t('isimEpostaVeyaTelefonIleAra')}
 value={staffSearchQuery}
 onChange={(e) => setStaffSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:focus:ring-offset-background"
 />
 </div>

 {/* Staff Table */}
 <div>
 <h3 className="text-foreground font-medium mb-3">
 {t('personel_mevcut')} ({staffList.filter(s => {
 const matchesStatus = staffStatusFilter === 'active' ? s.isActive !== false : s.isActive === false;
 const matchesSearch = !staffSearchQuery ||
 s.displayName?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
 s.email?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
 s.phoneNumber?.includes(staffSearchQuery);
 return matchesStatus && matchesSearch;
 }).length})
 </h3>

 {staffList.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <p className="text-4xl mb-2"></p>
 <p>{t('henuzPersonelYok')}</p>
 </div>
 ) : (
 <table className="w-full text-left">
 <thead className="text-muted-foreground border-b border-border">
 <tr>
 <th className="pb-3 py-2">{t('kullanici')}</th>
 <th className="pb-3 py-2">{t('personel_rol')}</th>
 <th className="pb-3 py-2">{t('durum')}</th>
 <th className="pb-3 py-2">{t('islemler')}</th>
 </tr>
 </thead>
 <tbody className="text-foreground">
 {staffList.filter(s => {
 const matchesStatus = staffStatusFilter === 'active' ? s.isActive !== false : s.isActive === false;
 const matchesSearch = !staffSearchQuery ||
 s.displayName?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
 s.email?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
 s.phoneNumber?.includes(staffSearchQuery);
 return matchesStatus && matchesSearch;
 }).length === 0 && (
 <tr>
 <td colSpan={4} className="py-8 text-center text-muted-foreground">
 <p className="text-2xl mb-2"></p>
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
 <tr key={staff.id} className="border-b border-border hover:bg-muted/40 dark:bg-muted/10 border-border">
 <td className="py-4">
 <div>
 <p className="font-medium">{staff.displayName}</p>
 <p className="text-muted-foreground text-sm">{staff.email || '-'}</p>
 <p className="text-muted-foreground text-xs">{staff.phoneNumber}</p>
 </div>
 </td>
 <td className="py-4">
 <span className={`px-2 py-1 rounded text-xs ${staff.adminType?.includes('Admin') || staff.adminType?.includes('_admin')
 ? 'bg-purple-600'
 : 'bg-blue-600'
 }`}>
 {staff.adminType || t('personel_rol')}
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
 ? 'bg-amber-600/20 text-amber-800 dark:text-amber-400 hover:bg-amber-600 hover:text-white'
 : 'bg-green-600/20 text-green-800 dark:text-green-400 hover:bg-green-600 hover:text-white'}`}
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
 className="text-xs px-2 py-1 rounded bg-amber-600/20 text-amber-800 dark:text-amber-400 hover:bg-amber-600 hover:text-white"
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
 <div className="bg-background/50 rounded-xl p-6 border border-border">
 <h3 className="text-foreground font-bold text-lg mb-4">
 {t('yeni_personel_ekle')}
 </h3>
 <div className="grid grid-cols-2 gap-3">
 <input
 type="text"
 placeholder={t('isim')}
 value={inviteFirstName}
 onChange={(e) => setInviteFirstName(e.target.value)}
 className="bg-foreground text-background shadow-md px-3 py-2 rounded-lg"
 />
 <input
 type="text"
 placeholder={t('soyisim_opsiyonel')}
 value={inviteLastName}
 onChange={(e) => setInviteLastName(e.target.value)}
 className="bg-foreground text-background shadow-md px-3 py-2 rounded-lg"
 />
 </div>
 <div className="flex gap-2 mt-3">
 <select
 value={inviteCountryCode}
 onChange={(e) => setInviteCountryCode(e.target.value)}
 className="bg-foreground text-background shadow-md px-3 py-2 rounded-lg w-24"
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
 className="flex-1 bg-foreground text-background shadow-md px-3 py-2 rounded-lg"
 />
 </div>
 <input
 type="email"
 placeholder={t('epostaOpsiyonelBildirimIcin')}
 value={inviteEmail}
 onChange={(e) => setInviteEmail(e.target.value)}
 className="w-full mt-3 bg-foreground text-background shadow-md px-3 py-2 rounded-lg"
 />
 <div className="mt-3">
 <label className="text-muted-foreground text-sm">{t('rol')}</label>
 <select
 value={inviteRole}
 onChange={(e) => setInviteRole(e.target.value)}
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1"
 >
 <option value="Personel">{t('personel_rol')}</option>
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
 <div className="bg-card p-3 rounded text-sm">
 <p className="text-muted-foreground">{t('geciciSifre')}</p>
 <p className="text-foreground font-mono text-lg">{inviteResult.tempPassword}</p>
 </div>
 {inviteResult.notifications && (
 <div className="flex flex-col gap-2 text-xs">
 <div className="flex flex-wrap gap-2">
 <span title={(inviteResult.notifications.email as any)?.error} className={`px-2 py-1 rounded cursor-help ${inviteResult.notifications.email?.sent ? 'bg-green-600' : 'bg-red-900/50 border border-red-700 text-red-200'}`}>
 {inviteResult.notifications.email?.sent ? '✓' : '✗'} Email
 </span>
 <span title={(inviteResult.notifications.whatsapp as any)?.error} className={`px-2 py-1 rounded cursor-help ${inviteResult.notifications.whatsapp?.sent ? 'bg-green-600' : 'bg-red-900/50 border border-red-700 text-red-200'}`}>
 {inviteResult.notifications.whatsapp?.sent ? '✓' : '✗'} WhatsApp
 </span>
 <span title={(inviteResult.notifications.sms as any)?.error} className={`px-2 py-1 rounded cursor-help ${inviteResult.notifications.sms?.sent ? 'bg-green-600' : 'bg-red-900/50 border border-red-700 text-red-200'}`}>
 {inviteResult.notifications.sms?.sent ? '✓' : '✗'} SMS
 </span>
 </div>
 {(!inviteResult.notifications.email?.sent || !inviteResult.notifications.whatsapp?.sent || !inviteResult.notifications.sms?.sent) && (
 <p className="text-red-400 mt-1">⚠️ Bazı bildirimler gönderilemedi. Hata detayını görmek için üzerlerine gelin.</p>
 )}
 </div>
 )}
 <button
 onClick={() => setInviteResult(null)}
 className="text-xs text-muted-foreground hover:text-white"
 >
 {t('kapat')}
 </button>
 </div>
 )}
 </div>
 </div>
 </LockedModuleOverlay>
 )
 }





 {/* Sub-Tab: Abonelik Planı */}
 {
 settingsSubTab === "abonelik" && (
 <div className="space-y-6">
 <div className="space-y-6">
 {/* Current Plan Display */}
 <div className="space-y-4 pt-4 border-t border-border mt-4">
 <div className="flex items-center justify-between">
 <h4 className="text-foreground font-medium text-lg">{t('uyelikAbonelik')}</h4>
 <span className={`px-3 py-1 rounded-full text-xs font-bold ${
 (formData.subscriptionPlan === 'enterprise') ? 'bg-purple-600 text-white' :
 (formData.subscriptionPlan === 'premium') ? 'bg-amber-500 text-foreground' :
 (formData.subscriptionPlan === 'standard') ? 'bg-blue-500 text-white' :
 (formData.subscriptionPlan === 'basic') ? 'bg-green-600 text-white' :
 (formData.subscriptionPlan === 'free') ? 'bg-gray-500 text-white' :
 'bg-muted border border-border text-foreground text-foreground'
 }`}>
 {formData.subscriptionPlan?.toUpperCase() || 'NONE'}
 </span>
 </div>

 {/* Plan Selection */}
 <div>
 <label className="text-muted-foreground text-sm block mb-2">{t('plan') || "Plan"}</label>
 <select
 value={formData.subscriptionPlan}
 onChange={async (e) => {
 const newPlan = e.target.value as string;
 setFormData({
 ...formData,
 subscriptionPlan: newPlan,
 });
 if (!business?.id) return;
 setSaving(true);
 try {
 const { updateDoc, doc } = await import('firebase/firestore');
 const { db } = await import('@/lib/firebase');
 await updateDoc(doc(db, 'businesses', business.id), {
 subscriptionPlan: newPlan,
 });
 showToast(`Plan '${newPlan}' olarak guncellendi`, 'success');
 setBusiness((prev: any) => prev ? { ...prev, subscriptionPlan: newPlan } : prev);
 } catch (err: any) {
 console.error('Plan update error:', err);
 showToast('Plan guncellenemedi: ' + err.message, 'error');
 } finally {
 setSaving(false);
 }
 }}
 className="w-full bg-foreground text-background shadow-md px-3 py-2.5 rounded-lg border border-border focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
 >
 <option value="none">{t('yok')}</option>
 <option value="free">LOKMA Free</option>
 <option value="basic">LOKMA Basic</option>
 <option value="standard">LOKMA Standard</option>
 <option value="premium">LOKMA Premium</option>
 <option value="enterprise">LOKMA Enterprise</option>
 {/* Also show dynamic plans if available */}
 {availablePlans
 .filter(p => !['none','free','basic','standard','premium','enterprise'].includes(p.code))
 .map(plan => (
 <option key={plan.code} value={plan.code}>{plan.name}</option>
 ))
 }
 </select>
 </div>

 {/* Quick Save Button */}
 <button
 type="button"
 disabled={saving}
 onClick={async () => {
 if (!business?.id) return;
 setSaving(true);
 try {
 const { updateDoc, doc } = await import('firebase/firestore');
 const { db } = await import('@/lib/firebase');
 await updateDoc(doc(db, 'businesses', business.id), {
 subscriptionPlan: formData.subscriptionPlan || 'none',
 });
 showToast(`Plan '${formData.subscriptionPlan}' olarak kaydedildi`, 'success');
 setBusiness((prev: any) => prev ? { ...prev, subscriptionPlan: formData.subscriptionPlan } : prev);
 } catch (err: any) {
 console.error('Plan update error:', err);
 showToast('Plan guncellenemedi: ' + err.message, 'error');
 } finally {
 setSaving(false);
 }
 }}
 className={`${saving ? 'bg-muted border border-border text-foreground cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} w-full text-foreground font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-4`}
 >
 {saving ? 'Kaydediliyor...' : 'Plan Kaydet'}
 </button>
 </div>

 {/* Plan Features Info */}
 <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-3">
 <h5 className="text-foreground text-sm font-medium">{t('plan_features') || "Plan Özellikleri"}</h5>
 <div className="grid grid-cols-2 gap-3 text-xs">
 <div className="bg-card/50 rounded-lg p-3">
 <span className="text-muted-foreground font-bold">FREE</span>
 <p className="text-muted-foreground mt-1">Temel profil, sinirli siparis</p>
 </div>
 <div className="bg-card/50 rounded-lg p-3">
 <span className="text-green-800 dark:text-green-400 font-bold">BASIC</span>
 <p className="text-muted-foreground mt-1">Siparis yonetimi, temel istatistik</p>
 </div>
 <div className="bg-card/50 rounded-lg p-3">
 <span className="text-blue-800 dark:text-blue-400 font-bold">STANDARD</span>
 <p className="text-muted-foreground mt-1">Tam ERP, kurye, promosyon</p>
 </div>
 <div className="bg-card/50 rounded-lg p-3">
 <span className="text-amber-800 dark:text-amber-400 font-bold">PREMIUM</span>
 <p className="text-muted-foreground mt-1">AI analiz, sponsorlu gosterim</p>
 </div>
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
 <h4 className="text-foreground font-medium border-b border-border pb-2">
 {t('banka_bilgileri_rechnungen', { defaultValue: "Bankverbindung für Rechnungen" })}
 </h4>
 <div>
 <label className="text-muted-foreground text-sm">
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
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
 />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('bankaAdi1')}</label>
 <input
 type="text"
 value={formData.bankName}
 onChange={(e) =>
 setFormData({ ...formData, bankName: e.target.value })
 }
 disabled={!isEditing}
 placeholder={t('ornSparkasse')}
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
 />
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="text-muted-foreground text-sm">{t('iban')}</label>
 <input
 type="text"
 value={formData.bankIban}
 onChange={(e) =>
 setFormData({ ...formData, bankIban: e.target.value })
 }
 disabled={!isEditing}
 placeholder="DE..."
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
 />
 </div>
 <div>
 <label className="text-muted-foreground text-sm">{t('bic')}</label>
 <input
												type="text"
												value={formData.bankBic}
												onChange={(e) =>
													setFormData({ ...formData, bankBic: e.target.value })
												}
												disabled={!isEditing}
												className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
											/>
										</div>
									</div>
								</div>
								{/* Bank Details (Auszahlungen) */}
								<div className="space-y-4 pt-6 border-t border-border mt-6">
									<h4 className="text-foreground font-medium border-b border-border pb-2">
										{t('banka_bilgileri_payouts', { defaultValue: "Bankverbindung für Auszahlungen (Payouts)" })}
									</h4>
									<div>
										<label className="text-muted-foreground text-sm">
											{t('hesap_sahibi')}
										</label>
										<input
											type="text"
											value={formData.payoutBankAccountHolder || ''}
											onChange={(e) =>
												setFormData({
													...formData,
													payoutBankAccountHolder: e.target.value,
												})
											}
											disabled={!isEditing}
											placeholder={t('ornAhmetYilmaz')}
											className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
										/>
									</div>
									<div>
										<label className="text-muted-foreground text-sm">{t('bankaAdi1')}</label>
										<input
											type="text"
											value={formData.payoutBankName || ''}
											onChange={(e) =>
												setFormData({ ...formData, payoutBankName: e.target.value })
											}
											disabled={!isEditing}
											placeholder={t('ornSparkasse')}
											className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
										/>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label className="text-muted-foreground text-sm">{t('iban')}</label>
											<input
												type="text"
												value={formData.payoutBankIban || ''}
												onChange={(e) =>
													setFormData({ ...formData, payoutBankIban: e.target.value })
												}
												disabled={!isEditing}
												placeholder="DE..."
												className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
											/>
										</div>
										<div>
											<label className="text-muted-foreground text-sm">{t('bic')}</label>
											<input
												type="text"
												value={formData.payoutBankBic || ''}
												onChange={(e) =>
													setFormData({ ...formData, payoutBankBic: e.target.value })
												}
												disabled={!isEditing}
												className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50"
											/>
										</div>
									</div>
								</div>

 </div>
 </div>
 )
 }


 {/* 🎁 Promosyon Sub-Tab → direkt yönlendirme */}
 {
 settingsSubTab === "promosyon" && (
 <LockedModuleOverlay featureKey="promotions">
 {(() => {
 // Promosyon sekmesi açılınca direkt promotions sayfasına git — only if feature available
 if ((planFeatures.promotions || admin?.adminType === 'super') && typeof window !== 'undefined') {
 window.location.href = `/${params.locale}/admin/promotions?businessId=${businessId}`;
 }
 return (
 <div className="flex items-center justify-center py-12">
 <div className="text-center">
 <span className="text-4xl">🎁</span>
 <p className="text-muted-foreground mt-3 text-sm">{t('promosyonAyarlari')}</p>
 <p className="text-muted-foreground text-xs mt-1">{t('kampanyaOlusturVeYonet')}</p>
 </div>
 </div>
 );
 })()}
 </LockedModuleOverlay>
 )
 }


 {/* 📢 Marketing Boost Sub-Tab */}
 {
 settingsSubTab === "marketing" && (
 <LockedModuleOverlay featureKey="marketing">
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 
 <div>
 
 <p className="text-sm text-muted-foreground">{t('marketingBoostAciklama')}</p>
 </div>
 </div>
 <button
 onClick={() => setShowBoostForm(!showBoostForm)}
 className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
 >
 {showBoostForm ? t('boost_kapat') : t('boost_yeni_kampanya_btn')}
 </button>
 </div>

 {/* How It Works Info Card */}
 <div className="bg-gradient-to-br from-purple-100 dark:from-purple-900/30 to-indigo-900/20 border border-purple-500/30 rounded-xl p-5">
 <h4 className="text-purple-300 font-bold text-sm mb-3 flex items-center gap-2">
  {t('nasil_calisir')}
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="text-center">
 
 <p className="text-white text-xs font-medium mt-1">{t('boost_step1')}</p>
 <p className="text-muted-foreground text-[10px] mt-0.5">{t('boost_step1_desc')}</p>
 </div>
 <div className="text-center">
 
 <p className="text-white text-xs font-medium mt-1">{t('boost_step2')}</p>
 <p className="text-muted-foreground text-[10px] mt-0.5">{t('boost_step2_desc')}</p>
 </div>
 <div className="text-center">
 
 <p className="text-white text-xs font-medium mt-1">{t('boost_step3')}</p>
 <p className="text-muted-foreground text-[10px] mt-0.5">{t('boost_step3_desc')}</p>
 </div>
 </div>
 </div>

 {/* Ranking Algorithm Explanation */}
 <div className="bg-card/40 border border-border rounded-xl p-4">
 <h4 className="text-foreground font-bold text-sm mb-2 flex items-center gap-2">
  {t('boost_ranking')}
 </h4>
 <div className="flex flex-wrap gap-2">
 {[
 { label: t('boost_rank_bid'), pct: 40, color: 'bg-purple-500' },
 { label: t('boost_rank_rating'), pct: 20, color: 'bg-yellow-500' },
 { label: t('boost_rank_ctr'), pct: 20, color: 'bg-blue-500' },
 { label: t('boost_rank_distance'), pct: 10, color: 'bg-green-500' },
 { label: t('boost_rank_volume'), pct: 10, color: 'bg-orange-500' },
 ].map(f => (
 <div key={f.label} className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1.5 rounded-lg">
 <div className={`w-2 h-2 rounded-full ${f.color}`} />
 <span className="text-foreground text-xs">{f.label}</span>
 <span className="text-muted-foreground text-[10px] font-bold">%{f.pct}</span>
 </div>
 ))}
 </div>
 </div>

 {/* ==== New Campaign Form ==== */}
 {showBoostForm && (
 <div className="bg-card/60 border border-purple-500/30 rounded-xl p-5 space-y-5">
 <h4 className="text-foreground font-bold flex items-center gap-2">
 <span>🆕</span> {t('boost_yeni_kampanya')}
 </h4>

 {/* Campaign Name */}
 <div>
 <label className="text-sm text-muted-foreground mb-1 block">{t('boost_kampanya_adi')}</label>
 <input
 type="text"
 placeholder={t('boost_kampanya_adi_placeholder')}
 value={boostForm.campaignName}
 onChange={e => setBoostForm(p => ({ ...p, campaignName: e.target.value }))}
 className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
 />
 </div>

 {/* Model Selection */}
 <div>
 <label className="text-sm text-muted-foreground mb-2 block">{t('boost_fiyatlandirma_modeli')}</label>
 <div className="grid grid-cols-2 gap-3">
 <button
 type="button"
 onClick={() => setBoostForm(p => ({ ...p, model: 'cpc' }))}
 className={`p-4 rounded-xl border-2 transition-all text-left ${
 boostForm.model === 'cpc'
 ? 'border-blue-500 bg-blue-900/20'
 : 'border-border bg-background/40 hover:border-gray-500'
 }`}
 >
 <div className="flex items-center gap-2 mb-1">
 <span className="text-lg">🔵</span>
 <span className="text-foreground font-bold text-sm">CPC</span>
 </div>
 <p className="text-muted-foreground text-xs">{t('boost_cpc_aciklama')}</p>
 <p className="text-blue-800 dark:text-blue-400 text-[10px] mt-1 font-medium">{t('boost_cpc_model_label')}</p>
 </button>
 <button
 type="button"
 onClick={() => setBoostForm(p => ({ ...p, model: 'payPerOrder' }))}
 className={`p-4 rounded-xl border-2 transition-all text-left ${
 boostForm.model === 'payPerOrder'
 ? 'border-green-500 bg-green-900/20'
 : 'border-border bg-background/40 hover:border-gray-500'
 }`}
 >
 <div className="flex items-center gap-2 mb-1">
 <span className="text-lg">🟢</span>
 <span className="text-foreground font-bold text-sm">Pay-per-Order</span>
 </div>
 <p className="text-muted-foreground text-xs">{t('boost_ppo_aciklama')}</p>
 <p className="text-green-800 dark:text-green-400 text-[10px] mt-1 font-medium">{t('boost_ppo_model_label')}</p>
 </button>
 </div>
 </div>

 {/* Bid Amount + Budget */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-sm text-muted-foreground mb-1 block">
 {boostForm.model === 'cpc' ? t('boost_tiklama_basina') : t('boost_siparis_basina')}
 </label>
 <div className="relative">
 <input
 type="number"
 step="0.05"
 min="0.10"
 value={boostForm.bidAmount}
 onChange={e => setBoostForm(p => ({ ...p, bidAmount: e.target.value }))}
 className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 outline-none"
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
 </div>
 <p className="text-muted-foreground text-[10px] mt-1">{t('boost_min_bid')}</p>
 </div>
 <div>
 <label className="text-sm text-muted-foreground mb-1 block">{t('boost_butce')}</label>
 <div className="flex gap-2">
 <select
 value={boostForm.budgetType}
 onChange={e => setBoostForm(p => ({ ...p, budgetType: e.target.value as any }))}
 className="bg-background border border-border rounded-lg px-2 py-2.5 text-white text-xs focus:border-purple-500 outline-none"
 title={t('boost_butce_turu')}
 >
 <option value="daily">{t('boost_gunluk')}</option>
 <option value="weekly">{t('boost_haftalik')}</option>
 <option value="total">{t('boost_toplam')}</option>
 </select>
 <input
 type="number"
 min="5"
 value={boostForm.budgetAmount}
 onChange={e => setBoostForm(p => ({ ...p, budgetAmount: e.target.value }))}
 className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 outline-none"
 />
 </div>
 {boostForm.model === 'cpc' && parseFloat(boostForm.bidAmount) > 0 && (
 <p className="text-purple-800 dark:text-purple-400 text-[10px] mt-1">
 ≈ {Math.floor(parseFloat(boostForm.budgetAmount) / parseFloat(boostForm.bidAmount))} {t('boost_per_tiklama')} / {boostForm.budgetType === 'daily' ? t('boost_gun') : boostForm.budgetType === 'weekly' ? t('boost_hafta') : t('boost_toplam_label')}
 </p>
 )}
 </div>
 </div>

 {/* Active Days */}
 <div>
 <label className="text-sm text-muted-foreground mb-2 block">{t('boost_aktif_gunler')}</label>
 <div className="flex gap-1.5">
 {[t('boost_day_mon'), t('boost_day_tue'), t('boost_day_wed'), t('boost_day_thu'), t('boost_day_fri'), t('boost_day_sat'), t('boost_day_sun')].map((day, i) => {
 const dayIdx = i === 6 ? 0 : i + 1; // Mon=1,...,Sat=6,Sun=0
 const isActive = boostForm.activeDays.includes(dayIdx);
 return (
 <button
 key={day}
 type="button"
 onClick={() => {
 setBoostForm(p => ({
 ...p,
 activeDays: isActive
 ? p.activeDays.filter(d => d !== dayIdx)
 : [...p.activeDays, dayIdx]
 }));
 }}
 className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
 isActive
 ? 'bg-purple-600 text-white'
 : 'bg-card text-muted-foreground hover:bg-muted'
 }`}
 >
 {day}
 </button>
 );
 })}
 </div>
 </div>

 {/* Active Hours */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-sm text-muted-foreground mb-1 block">{t('boost_baslangic_saati')}</label>
 <input
 type="time"
 value={boostForm.activeHoursStart}
 onChange={e => setBoostForm(p => ({ ...p, activeHoursStart: e.target.value }))}
 className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 outline-none"
 />
 </div>
 <div>
 <label className="text-sm text-muted-foreground mb-1 block">{t('boost_bitis_saati')}</label>
 <input
 type="time"
 value={boostForm.activeHoursEnd}
 onChange={e => setBoostForm(p => ({ ...p, activeHoursEnd: e.target.value }))}
 className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 outline-none"
 />
 </div>
 </div>

 {/* Campaign End Date */}
 <div>
 <label className="text-sm text-muted-foreground mb-1 block">{t('boost_bitis_tarihi')}</label>
 <input
 type="date"
 value={boostForm.endDate}
 onChange={e => setBoostForm(p => ({ ...p, endDate: e.target.value }))}
 className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-purple-500 outline-none"
 placeholder={t('boost_bitis_placeholder')}
 />
 <p className="text-muted-foreground text-[10px] mt-1">{t('boost_bitis_aciklama')}</p>
 </div>

 {/* Summary Card */}
 {boostForm.campaignName && (
 <div className="bg-gradient-to-r from-purple-100 dark:from-purple-900/40 to-indigo-900/30 border border-purple-500/40 rounded-xl p-4">
 <h5 className="text-purple-300 font-bold text-sm mb-2">{t('boost_kampanya_ozeti')}</h5>
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div><span className="text-muted-foreground">{t('boost_ozet_ad')}</span> <span className="text-foreground">{boostForm.campaignName}</span></div>
 <div><span className="text-muted-foreground">{t('boost_ozet_model')}</span> <span className="text-foreground">{boostForm.model === 'cpc' ? t('boost_cpc_label') : t('boost_ppo_label')}</span></div>
 <div><span className="text-muted-foreground">{t('boost_ozet_bid')}</span> <span className="text-foreground">{boostForm.bidAmount}€ / {boostForm.model === 'cpc' ? t('boost_per_tiklama') : t('boost_per_siparis')}</span></div>
 <div><span className="text-muted-foreground">{t('boost_ozet_butce')}</span> <span className="text-foreground">{boostForm.budgetAmount}€ / {boostForm.budgetType === 'daily' ? t('boost_gun') : boostForm.budgetType === 'weekly' ? t('boost_hafta') : t('boost_toplam_label')}</span></div>
 <div><span className="text-muted-foreground">{t('boost_ozet_gunler')}</span> <span className="text-foreground">{boostForm.activeDays.length === 7 ? t('boost_her_gun') : `${boostForm.activeDays.length} ${t('boost_gun')}`}</span></div>
 <div><span className="text-muted-foreground">{t('boost_ozet_saatler')}</span> <span className="text-foreground">{boostForm.activeHoursStart} - {boostForm.activeHoursEnd}</span></div>
 </div>
 </div>
 )}

 {/* Save Button */}
 <div className="flex justify-end gap-3">
 <button
 type="button"
 onClick={() => setShowBoostForm(false)}
 className="px-4 py-2.5 bg-accent hover:bg-gray-300 text-foreground dark:bg-muted dark:hover:bg-muted border border-border text-foreground dark:text-gray-100 rounded-xl text-sm transition-all"
 >
 {t('boost_iptal')}
 </button>
 <button
 type="button"
 disabled={!boostForm.campaignName || boostSaving}
 onClick={async () => {
 if (!businessId || !boostForm.campaignName) return;
 setBoostSaving(true);
 try {
 const campaignData = {
 businessId,
 businessName: formData.companyName || '',
 campaignName: boostForm.campaignName,
 model: boostForm.model,
 bidAmount: parseFloat(boostForm.bidAmount) || 0.30,
 budgetType: boostForm.budgetType,
 budgetAmount: parseFloat(boostForm.budgetAmount) || 50,
 budgetSpent: 0,
 activeDays: boostForm.activeDays,
 activeHoursStart: boostForm.activeHoursStart,
 activeHoursEnd: boostForm.activeHoursEnd,
 startDate: new Date().toISOString().split('T')[0],
 endDate: boostForm.endDate || null,
 status: 'active',
 metrics: { impressions: 0, clicks: 0, orders: 0, ctr: 0, roas: 0, totalSpent: 0 },
 targetZipCodes: [],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 const docRef = await addDoc(collection(db, 'boost_campaigns'), campaignData);
 setBoostCampaigns(prev => [...prev, { id: docRef.id, ...campaignData }]);
 await updateDoc(doc(db, 'businesses', businessId), {
 hasActiveBoost: true,
 activeBoostCampaignId: docRef.id,
 });
 setShowBoostForm(false);
 setBoostForm({
 campaignName: '', model: 'cpc', bidAmount: '0.30',
 budgetType: 'weekly', budgetAmount: '50',
 activeDays: [0, 1, 2, 3, 4, 5, 6],
 activeHoursStart: '00:00', activeHoursEnd: '23:59', endDate: '',
 });
 showToast(t('boost_olusturuldu'), 'success');
 } catch (error) {
 console.error('Error creating boost campaign:', error);
 showToast(t('boost_olusturma_hatasi'), 'error');
 }
 setBoostSaving(false);
 }}
 className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
 >
 {boostSaving ? (
 <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> {t('boost_olusturuluyor')}</>
 ) : (
 <>{t('boost_kampanya_baslat')}</>
 )}
 </button>
 </div>
 </div>
 )}

 {/* ==== Active Campaigns List ==== */}
 <div>
 <h4 className="text-foreground font-bold text-sm mb-3 flex items-center gap-2">
 <span></span> {t('boost_aktif_kampanyalar')}
 </h4>
 {loadingBoostCampaigns ? (
 <div className="flex justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
 </div>
 ) : boostCampaigns.length === 0 ? (
 <div className="bg-background/50 rounded-xl p-8 text-center border border-border">
 <span className="text-4xl">📭</span>
 <h4 className="text-foreground font-medium mt-3">{t('boost_kampanya_yok')}</h4>
 <p className="text-muted-foreground text-sm mt-1">{t('boost_kampanya_yok_aciklama')}</p>
 </div>
 ) : (
 <div className="space-y-3">
 {boostCampaigns.map((campaign: any) => {
 const budgetPct = campaign.budgetAmount > 0 ? (campaign.budgetSpent / campaign.budgetAmount) * 100 : 0;
 return (
 <div key={campaign.id} className={`bg-card/60 rounded-xl p-4 border transition-all ${
 campaign.status === 'active' ? 'border-purple-500/40' : 'border-border'
 }`}>
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className={`w-2.5 h-2.5 rounded-full ${
 campaign.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
 }`} />
 <h5 className="text-foreground font-bold text-sm">{campaign.campaignName}</h5>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
 campaign.model === 'cpc'
 ? 'bg-blue-900/50 text-blue-800 dark:text-blue-400 border border-blue-500/30'
 : 'bg-green-900/50 text-green-800 dark:text-green-400 border border-green-500/30'
 }`}>
 {campaign.model === 'cpc' ? 'CPC' : 'Pay-per-Order'}
 </span>
 </div>
 <button
 onClick={async () => {
 if (!campaign.id) return;
 const newStatus = campaign.status === 'active' ? 'paused' : 'active';
 try {
 await updateDoc(doc(db, 'boost_campaigns', campaign.id), { status: newStatus, updatedAt: new Date().toISOString() });
 setBoostCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
 if (newStatus === 'paused') {
 await updateDoc(doc(db, 'businesses', businessId!), { hasActiveBoost: false });
 } else {
 await updateDoc(doc(db, 'businesses', businessId!), { hasActiveBoost: true, activeBoostCampaignId: campaign.id });
 }
 showToast(newStatus === 'active' ? t('boost_aktiflestirildi') : t('boost_duraklatildi'), 'success');
 } catch (err) {
 showToast(t('boost_guncelleme_hatasi'), 'error');
 }
 }}
 className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
 campaign.status === 'active'
 ? 'bg-yellow-600/20 text-yellow-800 dark:text-yellow-400 hover:bg-yellow-600/40'
 : 'bg-green-600/20 text-green-800 dark:text-green-400 hover:bg-green-600/40'
 }`}
 >
 {campaign.status === 'active' ? t('boost_duraklat') : t('boost_aktiflestir')}
 </button>
 </div>
 {/* Stats Row */}
 <div className="grid grid-cols-4 gap-3 mb-3">
 <div className="bg-background/60 rounded-lg p-2 text-center">
 <p className="text-muted-foreground text-[10px]">Bid</p>
 <p className="text-foreground font-bold text-sm">{campaign.bidAmount}€</p>
 </div>
 <div className="bg-background/60 rounded-lg p-2 text-center">
 <p className="text-muted-foreground text-[10px]">{t('boost_gosterim')}</p>
 <p className="text-foreground font-bold text-sm">{campaign.metrics?.impressions || 0}</p>
 </div>
 <div className="bg-background/60 rounded-lg p-2 text-center">
 <p className="text-muted-foreground text-[10px]">{campaign.model === 'cpc' ? t('boost_tiklama') : t('boost_siparis')}</p>
 <p className="text-foreground font-bold text-sm">{campaign.model === 'cpc' ? (campaign.metrics?.clicks || 0) : (campaign.metrics?.orders || 0)}</p>
 </div>
 <div className="bg-background/60 rounded-lg p-2 text-center">
 <p className="text-muted-foreground text-[10px]">ROAS</p>
 <p className="text-foreground font-bold text-sm">{campaign.metrics?.roas ? `${campaign.metrics.roas}x` : '—'}</p>
 </div>
 </div>
 {/* Budget Progress */}
 <div>
 <div className="flex justify-between text-[10px] mb-1">
 <span className="text-muted-foreground">{t('boost_harcanan')} {campaign.budgetSpent?.toFixed(2) || '0.00'}€</span>
 <span className="text-muted-foreground">{t('boost_butce_label')} {campaign.budgetAmount}€ ({campaign.budgetType === 'daily' ? t('boost_gunluk_label') : campaign.budgetType === 'weekly' ? t('boost_haftalik_label') : t('boost_toplam_label')})</span>
 </div>
 <div className="w-full bg-muted rounded-full h-1.5">
 <div
 className={`h-1.5 rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-yellow-500' : 'bg-purple-500'}`}
 style={{ width: `${Math.min(budgetPct, 100)}%` }}
 />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Competitor Comparison */}
 <div className="bg-card/30 border border-border/50 rounded-xl p-4">
 <h4 className="text-muted-foreground font-bold text-xs mb-3">{t('boost_platform_karsilastirma')}</h4>
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="text-muted-foreground border-b border-border">
 <th className="text-left pb-2">{t('boost_platform')}</th>
 <th className="text-left pb-2">{t('boost_model')}</th>
 <th className="text-left pb-2">{t('boost_ort_maliyet')}</th>
 <th className="text-left pb-2">{t('boost_sonuc')}</th>
 </tr>
 </thead>
 <tbody className="text-foreground">
 <tr className="border-b border-border"><td className="py-1.5">🔵 Uber Eats</td><td>CPC</td><td>{t('boost_uber_cost')}</td><td>{t('boost_uber_result')}</td></tr>
 <tr className="border-b border-border"><td className="py-1.5">🟢 Wolt</td><td>Pay-per-Order</td><td>{t('boost_wolt_cost')}</td><td>{t('boost_wolt_result')}</td></tr>
 <tr className="border-b border-border"><td className="py-1.5">🟠 Lieferando</td><td>TopRank</td><td>{t('boost_lieferando_cost')}</td><td>{t('boost_lieferando_result')}</td></tr>
 <tr className="border-b border-border"><td className="py-1.5">🟣 Yemeksepeti</td><td>Hybrid</td><td>{t('boost_yemeksepeti_cost')}</td><td>{t('boost_yemeksepeti_result')}</td></tr>
 <tr className="bg-purple-900/20"><td className="py-1.5 font-bold text-purple-300">🟣 LOKMA</td><td className="text-purple-300">CPC + PPO</td><td className="text-purple-300">{t('boost_lokma_cost')}</td><td className="text-purple-300">{t('boost_lokma_result')}</td></tr>
 </tbody>
 </table>
 </div>
 </div>

 </div>
 </LockedModuleOverlay>
 )
 }



 {/* Reviews Section - shown in İşletme sub-tab */}
 {
 settingsSubTab === "isletme" && (
 <div className="space-y-6">
 <div className="space-y-6">
 {formData.reviews && formData.reviews.length > 0 && (
 <div className="pt-6 border-t border-border">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Star className="w-5 h-5 text-yellow-500" />
 <h3 className="font-semibold text-gray-200">
 {t('googleYorumlari')}
 </h3>
 <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border">
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
 className="bg-card/50 rounded-lg p-3 border border-border/50"
 >
 <div className="flex items-center gap-2 mb-2">
 <img
 src={review.profile_photo_url}
 alt={review.author_name}
 className="w-6 h-6 rounded-full"
 />
 <div className="flex-1 min-w-0">
 <label htmlFor="brandLabelActive" className="text-sm font-medium text-muted-foreground">
 App
 </label>
 <div className="text-xs font-medium text-foreground truncate">
 {review.author_name}
 </div>
 <div className="flex text-yellow-500 text-[10px]">
 {"★".repeat(Math.round(review.rating))}
 <span className="text-muted-foreground ml-1">
 {review.relative_time_description}
 </span>
 </div>
 </div>
 </div>
 <p className="text-xs text-muted-foreground line-clamp-3 italic">
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
 <div className="pt-6 border-t border-border">
 <div className="flex items-center gap-2 mb-4">
 <History className="w-5 h-5 text-purple-800 dark:text-purple-400" />
 <h3 className="font-semibold text-gray-200">{t('abonelikGecmisi')}</h3>
 </div>
 <div className="overflow-x-auto bg-card/30 rounded-lg border border-border/50">
 <table className="w-full text-xs text-left text-muted-foreground">
 <thead className="text-muted-foreground bg-background/50 uppercase">
 <tr>
 <th className="px-4 py-2">{t('plan') || "Plan"}</th>
 <th className="px-4 py-2">{t('baslangic1')}</th>
 <th className="px-4 py-2">{t('bitis')}</th>
 <th className="px-4 py-2">{t('degistiren')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {(business?.subscriptionHistory || []).map((h: any, i: number) => (
 <tr key={i} className="hover:bg-card/30">
 <td className="px-4 py-2 font-medium text-foreground uppercase">{h.plan}</td>
 <td className="px-4 py-2">{h.startDate?.seconds ? new Date(h.startDate.seconds * 1000).toLocaleDateString('de-DE') : new Date(h.startDate).toLocaleDateString('de-DE')}</td>
 <td className="px-4 py-2">{h.endDate?.seconds ? new Date(h.endDate.seconds * 1000).toLocaleDateString('de-DE') : new Date(h.endDate).toLocaleDateString('de-DE')}</td>
 <td className="px-4 py-2 text-muted-foreground">{h.changedBy?.split('@')[0]}</td>
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
 </div>
 </div>
 </div>
 )
 }




 {/* Reservations Tab */}
 {
 activeTab === "reservations" && (
 <div className="space-y-6">
 {/* Capacity Management Config */}
 <div className="bg-background rounded-2xl p-6 border border-border">
 <ReservationCapacityConfig businessId={businessId} />
 </div>
 {/* Reservations List */}
 <div className="bg-background rounded-2xl p-6 border border-border">
 <ReservationsPanel
 businessId={businessId}
 businessName={formData.companyName || ""}
 staffName={admin?.displayName || admin?.email || "Admin"}
 />
 </div>
 </div>
 )
 }

 {/* 🪑 Dine-In content — rendered within reservations tab */}
 {
 activeTab === "reservations" && (
 <div className="space-y-6">
 {/* ── Header Stats Row ── */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-background rounded-xl p-4 border border-border text-center">
 <p className="text-2xl font-bold text-amber-800 dark:text-amber-400">{formData.maxReservationTables || 0}</p>
 <p className="text-xs text-muted-foreground mt-1">{t('toplam_masa')}</p>
 </div>
 <div className="bg-background rounded-xl p-4 border border-border text-center">
 <p className="text-2xl font-bold text-teal-400">{formData.tableCapacity || 0}</p>
 <p className="text-xs text-muted-foreground mt-1">{t('oturma_kapasitesi')}</p>
 </div>
 <div className="bg-background rounded-xl p-4 border border-border text-center">
 <p className="text-2xl font-bold text-green-800 dark:text-green-400">{planFeatures.dineInQR ? '✓' : '✕'}</p>
 <p className="text-xs text-muted-foreground mt-1">{t('qrSiparis')}</p>
 </div>
 <div className="bg-background rounded-xl p-4 border border-border text-center">
 <p className="text-2xl font-bold text-blue-800 dark:text-blue-400">{planFeatures.waiterOrder ? '✓' : '✕'}</p>
 <p className="text-xs text-muted-foreground mt-1">{t('garsonSiparis')}</p>
 </div>
 </div>

 {/* ── Table Management: Masa Yönetimi ── */}
 <div className="bg-background rounded-2xl p-6 border border-border">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
 {t('masaYonetimi')}
 </h2>
 <button
 onClick={handleSave}
 disabled={saving}
 className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition disabled:opacity-50"
 >
 {saving ? '...' : t('kaydet')}
 </button>
 </div>

 {/* Masa & Yerinde Sipariş Ayarları (Consolidated from hidden Masa tab) */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 p-5 border-t border-border mt-6">
 <div className="space-y-4">
 <h3 className="font-semibold text-foreground border-b border-border pb-2">{t('masa_rezervasyonu') || 'Masa Rezervasyonu'}</h3>
 <label className="flex items-start gap-3 cursor-pointer">
 <input
 type="checkbox"
 checked={formData.hasReservation}
 onChange={(e) => setFormData({ ...formData, hasReservation: e.target.checked })}
 className="mt-1 w-5 h-5 accent-amber-500"
 />
 <div>
 <span className="text-foreground font-medium">{t('masa_rezervasyonu_aktif') || 'Masa Rezervasyonu Aktif'}</span>
 <p className="text-xs text-muted-foreground">{t('musterilerMobilUygulamadanMasaRezervasyonuYapabilir')}</p>
 </div>
 </label>
 </div>
 <div className="space-y-4">
 <h3 className="font-semibold text-foreground border-b border-border pb-2">{t('yerindeSiparisAyarlari') || 'Yerinde Sipariş Ayarları'}</h3>
 <label className="flex items-start gap-3 cursor-pointer mb-3">
 <input
 type="checkbox"
 checked={formData.hasTableService}
 onChange={(e) => setFormData({ ...formData, hasTableService: e.target.checked })}
 className="mt-1 w-5 h-5 accent-amber-500"
 />
 <div>
 <span className="text-foreground font-medium">{t('garson_servisi_aktif') || 'Masa Servisi (Garson)'}</span>
 <p className="text-xs text-muted-foreground">
 {formData.hasTableService
 ? t('siparisHazirOluncaMusteriyeSiparisinizMasaniza')
 : t('siparisHazirOluncaMusteriyeGelipAlabilirsiniz')}
 </p>
 </div>
 </label>
 <div>
 <span className="text-sm font-medium text-foreground block mb-2">{t('odemeZamanlamasi') || 'Ödeme Zamanlaması'}</span>
 <div className="flex gap-3">
 <label className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-colors ${formData.dineInPaymentMode === 'payFirst' ? 'bg-amber-600/10 border-amber-500 text-amber-600' : 'bg-background border-border text-foreground hover:bg-muted'}`}>
 <input type="radio" value="payFirst" checked={formData.dineInPaymentMode === 'payFirst'} onChange={(e) => setFormData({ ...formData, dineInPaymentMode: e.target.value })} className="hidden" />
 <span className="text-sm font-medium">{t('hemenOde') || 'Önce Öde'}</span>
 </label>
 <label className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-colors ${formData.dineInPaymentMode === 'payLater' ? 'bg-amber-600/10 border-amber-500 text-amber-600' : 'bg-background border-border text-foreground hover:bg-muted'}`}>
 <input type="radio" value="payLater" checked={formData.dineInPaymentMode === 'payLater'} onChange={(e) => setFormData({ ...formData, dineInPaymentMode: e.target.value })} className="hidden" />
 <span className="text-sm font-medium">{t('cikistaOde') || 'Sonra Öde'}</span>
 </label>
 </div>
 </div>
 </div>
 </div>

 {/* Quick setup row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('toplam_masa_adedi')}</label>
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
 className="w-full bg-foreground text-background shadow-md px-4 py-2.5 rounded-lg border border-border focus:border-amber-500 focus:outline-none text-lg font-medium"
 placeholder={t('or20')}
 />
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('oturmaKapasitesiKisi')}</label>
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
 className="w-full bg-foreground text-background shadow-md px-4 py-2.5 rounded-lg border border-border focus:border-amber-500 focus:outline-none text-lg font-medium"
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
 <h3 className="text-sm font-semibold text-foreground">{t('bolumler')}</h3>
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
 className="px-2 py-1 text-xs bg-accent hover:bg-gray-300 text-foreground dark:bg-muted dark:hover:bg-muted border border-border text-foreground dark:text-gray-100 rounded-md transition"
 >
 {t('bolumEkle')}
 </button>
 </div>
 <div className="flex flex-wrap gap-2">
 {formData.tableSections.length === 0 && (
 <span className="text-xs text-muted-foreground italic">{t('henuzBolumYokTumMasalarTek')}</span>
 )}
 {formData.tableSections.map((section: string, idx: number) => (
 <div key={idx} className="flex items-center gap-1 bg-muted rounded-lg px-3 py-1.5 text-sm">
 <span className="text-foreground">{section}</span>
 <span className="text-muted-foreground text-xs ml-1">
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
 className="ml-1 text-red-800 dark:text-red-400 hover:text-red-300 transition text-xs"
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
 <h3 className="text-sm font-semibold text-foreground">
 🪑 Masalar ({formData.tables.length})
 </h3>
 </div>

 {/* Group by section */}
 {(() => {
 const sections = formData.tableSections.length > 0
 ? [...formData.tableSections, ''] // named sections + unassigned
 : ['']; // all in one group
 return sections.map((sec: string) => {
 const tablesInSection = formData.tables
 .map((t: any, idx: number) => ({ ...t, _idx: idx }))
 .filter((t: any) => t.section === sec);
 if (tablesInSection.length === 0 && sec !== '') return null;
 return (
 <div key={sec || '__nosection'} className="mb-4">
 {sec && (
 <div className="flex items-center gap-2 mb-2">
 <span className="text-amber-800 dark:text-amber-400 text-sm font-bold"> {sec}</span>
 <span className="text-muted-foreground text-xs">({tablesInSection.length} masa)</span>
 </div>
 )}
 {!sec && formData.tableSections.length > 0 && tablesInSection.length > 0 && (
 <div className="flex items-center gap-2 mb-2">
 <span className="text-muted-foreground text-sm font-bold">{t('bolumAtanmamis')}</span>
 <span className="text-muted-foreground text-xs">({tablesInSection.length} masa)</span>
 </div>
 )}
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
 {tablesInSection.map((table: any) => (
 <div
 key={table._idx}
 className="bg-card rounded-lg border border-border p-3 flex flex-col gap-2 hover:border-amber-500/50 transition"
 >
 {/* Table label */}
 <div className="flex items-center gap-1">
 <span className="text-muted-foreground text-xs">M</span>
 <input
 type="text"
 value={table.label}
 onChange={(e) => {
 const updated = [...formData.tables];
 updated[table._idx] = { ...updated[table._idx], label: e.target.value };
 setFormData({ ...formData, tables: updated });
 }}
 className="w-full bg-foreground text-background shadow-md text-center px-2 py-1 rounded border border-border focus:border-amber-500 focus:outline-none text-sm font-bold"
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
 className="w-full bg-accent text-foreground dark:bg-muted dark:text-gray-100 px-2 py-1 rounded border border-border focus:border-amber-500 focus:outline-none text-xs"
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
 className="text-red-500/60 hover:text-red-800 dark:text-red-400 text-xs transition"
 >
 
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
 <div className="bg-card/50 rounded-xl p-8 border border-dashed border-border text-center">
 <span className="text-4xl">&#x1FA91;</span>
 <p className="text-foreground font-semibold mt-3">{t('henuzMasaTanimlanmadi')}</p>
 <p className="text-muted-foreground text-sm mt-1">
 {t('yukaridanMasaSayisiniGirerekOtomatikOlusturun')}
 </p>
 </div>
 )}
 </div>

 {/* ── Table QR Codes — Compact Table Layout ── */}
 {formData.tables.length > 0 && (
 <div className="bg-background rounded-2xl p-6 border border-border">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
 {t('masaQrKodlari')}
 <span className="text-sm font-normal text-muted-foreground">
 · {formData.tables.length} masa
 </span>
 </h2>
 <div className="flex items-center gap-2">
 <button
 onClick={async () => {
 const { downloadAllTableCardsAsSinglePDF } = await import('@/utils/tableCardPdfGenerator');
 await downloadAllTableCardsAsSinglePDF(formData.tables, businessId, formData.companyName || 'Isletme');
 }}
 className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
 >
 PDF Kart (Tek PDF)
 </button>
 <button
 onClick={async () => {
 const { downloadAllTableCardPDFs } = await import('@/utils/tableCardPdfGenerator');
 await downloadAllTableCardPDFs(formData.tables, businessId, formData.companyName || 'Isletme');
 }}
 className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
 >
 PDF Kartlar (Ayri)
 </button>
 <button
 onClick={() => {
 for (const table of formData.tables) {
 const tableQrTarget = `https://lokma.web.app/dinein/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
 const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableQrTarget)}`;
 const link = document.createElement('a');
 link.href = qrUrl;
 link.download = `Masa_${table.label}_QR.png`;
 link.target = '_blank';
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }
 }}
 className="px-4 py-2 bg-muted hover:bg-muted border border-border text-foreground text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
 >
 QR PNG
 </button>
 </div>
 </div>

 {/* Compact grid — small QR thumbnails */}
 <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
 {formData.tables.map((table: any, idx: number) => {
 const qrData = `https://lokma.web.app/dinein/${businessId}/table/${table.label}${table.section ? `?section=${encodeURIComponent(table.section)}` : ''}`;
 const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;
 return (
 <div key={idx} className="flex flex-col gap-1">
 <button
 onClick={async () => {
 const { downloadTableCardPDF } = await import('@/utils/tableCardPdfGenerator');
 await downloadTableCardPDF(table.label, businessId, formData.companyName || 'Isletme');
 }}
 className="bg-card rounded-lg border border-border p-2 flex flex-col items-center gap-1 hover:border-red-500 hover:bg-muted/50 transition cursor-pointer group"
 title={`Masa ${table.label} PDF kart indir`}
 >
 <div className="w-full aspect-square bg-card rounded flex items-center justify-center overflow-hidden">
 <img
 src={qrImageUrl}
 alt={`Masa ${table.label}`}
 className="w-full h-full object-contain"
 loading="lazy"
 />
 </div>
 <span className="text-xs font-bold text-foreground group-hover:text-red-800 dark:text-red-400 transition">
 M{table.label}
 {table.section && <span className="text-muted-foreground font-normal ml-0.5 text-[10px]">· {table.section}</span>}
 </span>
 </button>
 </div>
 );
 })}
 </div>
 <p className="text-xs text-muted-foreground mt-3">Masa kartina tiklayarak A6 PDF kart indirebilirsiniz. Ustteki butonlarla toplu indirme yapabilirsiniz.</p>
 </div>
 )}

 {/* ── Garson Sipariş Card ── */}
 <div className="bg-background rounded-2xl p-6 border border-border">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-lg bg-teal-600/20 flex items-center justify-center">
 <span className="text-xl">👨‍🍳</span>
 </div>
 <div className="flex-1">
 <h3 className="text-foreground font-semibold">{t('garsonSiparisSistemi')}</h3>
 <p className="text-xs text-muted-foreground">{t('personelTablettelefonIleMasadaSiparisAlir')}</p>
 </div>
 <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-600 text-white">
 {t('aktif')}
 </span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
 <div className="bg-card rounded-lg p-3 border border-border">
 <p className="text-teal-400 font-medium text-sm">{t('1MasaSec')}</p>
 <p className="text-muted-foreground text-xs mt-1">{t('garsonMasayiSecer')}</p>
 </div>
 <div className="bg-card rounded-lg p-3 border border-border">
 <p className="text-teal-400 font-medium text-sm">{t('2UrunEkle')}</p>
 <p className="text-muted-foreground text-xs mt-1">{t('menudenUrunEkler')}</p>
 </div>
 <div className="bg-card rounded-lg p-3 border border-border">
 <p className="text-teal-400 font-medium text-sm">{t('3SiparisGonder')}</p>
 <p className="text-muted-foreground text-xs mt-1">{t('mutfagaIletilir')}</p>
 </div>
 </div>
 </div>
 {/* ── Link İle Grup Siparişi Card ── */}
 <div className="bg-background rounded-2xl p-6 border border-border mt-6">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
 <span className="text-xl">🔗</span>
 </div>
 <div>
 <h3 className="text-foreground font-semibold">{t('linkIleGrupSiparisi')}</h3>
 <p className="text-xs text-muted-foreground">{t('musterilerSiparisLinkiniPaylasarakOrtakSiparisVerebilir')}</p>
 </div>
 </div>
 <div>
 {isEditing ? (
 <label className="flex items-center cursor-pointer">
 <div className="relative">
 <input 
 type="checkbox" 
 className="sr-only" 
 checked={!!formData.groupOrderLinkEnabled}
 onChange={async (e) => {
 const newVal = e.target.checked;
 setFormData({ ...formData, groupOrderLinkEnabled: newVal });
 // Auto-save to Firestore
 try {
 await updateDoc(doc(db, 'businesses', businessId), { groupOrderLinkEnabled: newVal });
 setBusiness(prev => prev ? { ...prev, groupOrderLinkEnabled: newVal } as any : prev);
 } catch (err) {
 console.error('Failed to save groupOrderLinkEnabled:', err);
 }
 }}
 />
 <div className={`block w-10 h-6 rounded-full transition ${formData.groupOrderLinkEnabled ? 'bg-green-500' : 'bg-muted border border-border text-foreground'}`}></div>
 <div className={`absolute left-1 top-1 bg-card w-4 h-4 rounded-full transition ${formData.groupOrderLinkEnabled ? 'transform translate-x-4' : ''}`}></div>
 </div>
 <span className="ml-3 text-sm font-medium text-foreground">
 {formData.groupOrderLinkEnabled ? t('aktif') : t('kapali')}
 </span>
 </label>
 ) : (
 <span className={`px-3 py-1 rounded-full text-xs font-bold text-foreground ${business?.groupOrderLinkEnabled ? 'bg-green-600' : 'bg-muted border border-border text-foreground'}`}>
 {business?.groupOrderLinkEnabled ? t('aktif') : t('kapali')}
 </span>
 )}
 </div>
 </div>
 </div>
 {/* ── Masada Grup Siparişi Card ── */}
 <div className="bg-background rounded-2xl p-6 border border-border mt-6">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
 <span className="text-xl">👥</span>
 </div>
 <div>
 <h3 className="text-foreground font-semibold">{t('masadaGrupSiparisi')}</h3>
 <p className="text-xs text-muted-foreground">{t('masadakiMusterilerQrOkutarakAyniSipariseUrunEkleyebilir')}</p>
 </div>
 </div>
 <div>
 {isEditing ? (
 <label className="flex items-center cursor-pointer">
 <div className="relative">
 <input 
 type="checkbox" 
 className="sr-only" 
 checked={!!formData.groupOrderTableEnabled}
 onChange={async (e) => {
 const newVal = e.target.checked;
 setFormData({ ...formData, groupOrderTableEnabled: newVal });
 // Auto-save to Firestore
 try {
 await updateDoc(doc(db, 'businesses', businessId), { groupOrderTableEnabled: newVal });
 setBusiness(prev => prev ? { ...prev, groupOrderTableEnabled: newVal } as any : prev);
 } catch (err) {
 console.error('Failed to save groupOrderTableEnabled:', err);
 }
 }}
 />
 <div className={`block w-10 h-6 rounded-full transition ${formData.groupOrderTableEnabled ? 'bg-green-500' : 'bg-muted border border-border text-foreground'}`}></div>
 <div className={`absolute left-1 top-1 bg-card w-4 h-4 rounded-full transition ${formData.groupOrderTableEnabled ? 'transform translate-x-4' : ''}`}></div>
 </div>
 <span className="ml-3 text-sm font-medium text-foreground">
 {formData.groupOrderTableEnabled ? t('aktif') : t('kapali')}
 </span>
 </label>
 ) : (
 <span className={`px-3 py-1 rounded-full text-xs font-bold text-foreground ${business?.groupOrderTableEnabled ? 'bg-green-600' : 'bg-muted border border-border text-foreground'}`}>
 {business?.groupOrderTableEnabled ? t('aktif') : t('kapali')}
 </span>
 )}
 </div>
 </div>
 </div>

 {/* ── Plan Info Footer ── */}
 <div className="p-4 bg-card/50 rounded-xl border border-border mt-6">
 <p className="text-sm text-muted-foreground">
 {t('buOzelliklerIsletmenin')} <strong className="text-foreground">{business?.subscriptionPlan || 'basic'}</strong> {t('planiUzerindenYonetilmektedirDegisiklikYapmakIcin')} <a href="/admin/plans" className="text-blue-800 dark:text-blue-400 hover:underline">{t('planYonetimi')}</a> {t('sayfasiniZiyaretEdin')}
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
 <div className="bg-card rounded-2xl max-w-md w-full p-6">
 <h3 className="text-xl font-bold text-foreground mb-2">
 {confirmModal.title}
 </h3>
 <p className="text-foreground mb-6">{confirmModal.message}</p>

 {confirmModal.showRoleSelect && (
 <div className="mb-4">
 <label className="text-muted-foreground text-sm">{t('yeniRolSec')}</label>
 <select
 value={selectedNewRole}
 onChange={(e) => setSelectedNewRole(e.target.value)}
 className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1"
 >
 <option value="">{t('rolSec')}</option>
 <option value={t('isletmeAdmin1')}>{t('isletmeAdmin1')}</option>
 <option value="Personel">{t('personel_rol')}</option>
 </select>
 </div>
 )}

 <div className="flex gap-3">
 <button
 onClick={() =>
 setConfirmModal({ ...confirmModal, show: false })
 }
 className="flex-1 px-4 py-3 bg-foreground text-background shadow-md rounded-lg hover:bg-muted border border-border text-foreground font-medium"
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

 {/* ═══════════════════════════════════════════════════════════════ */}
 {/* TEMPLATE SELECTION MODAL — Full-Screen Product Picker */}
 {/* ═══════════════════════════════════════════════════════════════ */}
 {
 showTemplateModal && (
 <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
 <div className="bg-background rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-border shadow-2xl">
 {/* Header */}
 <div className="p-5 border-b border-border flex-shrink-0">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
 {t('urun_sablonu')} — Ürün Seçimi
 </h2>
 <p className="text-muted-foreground text-sm mt-1">
 {templateProducts.length} ürün mevcut · {Object.values(selectedTemplateProducts).filter(Boolean).length} seçili
 </p>
 </div>
 <button
 onClick={() => setShowTemplateModal(false)}
 className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-white"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Controls: Select All / None + Search + Category Filter */}
 <div className="mt-4 flex flex-wrap items-center gap-3">
 <button
 onClick={() => setSelectedTemplateProducts(Object.fromEntries(templateProducts.map((p: any) => [p.id, true])))}
 className="px-3 py-1.5 bg-green-600/20 text-green-800 dark:text-green-400 text-xs font-medium rounded-lg hover:bg-green-600/30 transition border border-green-600/30"
 >
 Hepsini Seç
 </button>
 <button
 onClick={() => setSelectedTemplateProducts(Object.fromEntries(templateProducts.map((p: any) => [p.id, false])))}
 className="px-3 py-1.5 bg-red-600/20 text-red-800 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-600/30 transition border border-red-600/30"
 >
 Hiçbirini Seçme
 </button>
 <div className="flex-1 min-w-[200px]">
 <input
 type="text"
 value={templateSearch}
 onChange={(e) => setTemplateSearch(e.target.value)}
 placeholder="{t('urun_ara')}"
 className="w-full px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-amber-500 focus:border-transparent"
 />
 </div>
 <select
 value={templateFilter}
 onChange={(e) => setTemplateFilter(e.target.value)}
 className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-amber-500"
 >
 <option value="all"> {t('tum_kategoriler')}</option>
 {[...new Set(templateProducts.map((p: any) => p.category))].sort().map(cat => (
 <option key={cat} value={cat}>
 {cat === 'et' ? '🥩 Et' : cat === 'tavuk' ? '🐔 Tavuk' : cat === 'dondurulmus' ? '🧊 Dondurulmuş' :
 cat === 'wurstchen' ? '🌭 Sosis' : cat === 'wurst' ? '🥓 Salam' : cat === 'sucuk' ? '🧄 Sucuk' :
 cat === 'pastirma' ? '🥓 Pastırma' : cat === 'kavurma' ? '🍖 Kavurma' : cat}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Product List */}
 <div className="flex-1 overflow-y-auto p-4">
 <div className="space-y-2">
 {templateProducts
 .filter((p: any) => templateFilter === 'all' || p.category === templateFilter)
 .filter((p: any) => {
 if (!templateSearch.trim()) return true;
 const search = templateSearch.toLowerCase();
 const name = typeof p.name === 'object' ? (p.name.tr || p.name.de || '') : p.name;
 return name.toLowerCase().includes(search);
 })
 .map((product: any) => {
 const prodName = typeof product.name === 'object' ? getLocalizedText(product.name) : product.name;
 const isSelected = selectedTemplateProducts[product.id] ?? false;
 const assignedCategory = templateCategoryMap[product.id] || '';
 const categoryIcon = product.category === 'et' ? '🥩' : product.category === 'tavuk' ? '🐔' :
 product.category === 'dondurulmus' ? '🧊' : product.category === 'wurstchen' ? '🌭' :
 product.category === 'wurst' ? '🥓' : product.category === 'sucuk' ? '🧄' :
 product.category === 'pastirma' ? '🥓' : product.category === 'kavurma' ? '🍖' : '';

 return (
 <div
 key={product.id}
 className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer
 ${isSelected
 ? 'bg-amber-900/20 border-amber-600/40 hover:bg-amber-900/30'
 : 'bg-card/50 border-border hover:bg-card opacity-60'
 }`}
 onClick={() => setSelectedTemplateProducts(prev => ({ ...prev, [product.id]: !prev[product.id] }))}
 >
 {/* Checkbox */}
 <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition
 ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-500 bg-transparent'}`}
 >
 {isSelected && (
 <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </div>

 {/* Thumbnail */}
 {product.imageUrl ? (
 <img
 src={product.imageUrl}
 alt={prodName}
 className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
 />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg">
 {categoryIcon}
 </div>
 )}

 {/* Product Info */}
 <div className="flex-1 min-w-0">
 <p className="text-foreground text-sm font-medium truncate">{prodName}</p>
 <p className="text-muted-foreground text-xs">
 {categoryIcon} {product.category} · {product.defaultUnit === 'kg' ? '⚖️ kg' : ' Adet'}
 {product.defaultPrice ? ` · €${product.defaultPrice.toFixed(2)}` : ''}
 </p>
 </div>

 {/* Category Dropdown */}
 <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
 <select
 value={assignedCategory}
 onChange={(e) => setTemplateCategoryMap(prev => ({ ...prev, [product.id]: e.target.value }))}
 className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition
 ${isSelected
 ? 'bg-card border-amber-600/50 text-amber-300 focus:ring-2 focus:ring-amber-500'
 : 'bg-card/50 border-border text-muted-foreground'
 }`}
 disabled={!isSelected}
 >
 {inlineCategories.map((cat: any) => {
 const catName = typeof cat.name === 'object' ? getLocalizedText(cat.name) : cat.name;
 return (
 <option key={cat.id} value={catName}>
 {catName}
 </option>
 );
 })}
 <option value="Kategorisiz">❓ Kategorisiz</option>
 </select>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-border flex items-center justify-between flex-shrink-0">
 <div className="text-muted-foreground text-sm">
 🤖 <span className="text-amber-800 dark:text-amber-400">AI</span> kategorileri otomatik önerdi — istediğinizi değiştirebilirsiniz
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => setShowTemplateModal(false)}
 className="px-4 py-2.5 bg-foreground text-background shadow-md rounded-lg hover:bg-muted border border-border text-foreground font-medium text-sm transition"
 >
 {t('iptal')}
 </button>
 <button
 onClick={saveSelectedTemplateProducts}
 disabled={savingTemplate || Object.values(selectedTemplateProducts).filter(Boolean).length === 0}
 className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
 >
 {savingTemplate ? (
 <>
 <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
 Kaydediliyor...
 </>
 ) : (
 <>
 {Object.values(selectedTemplateProducts).filter(Boolean).length} Ürünü Kaydet
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )
 }
 {/* ═══════════════════════════════════════════════════════ */}
 {/* ═══ SUPPLIER MODAL ═══ */}
 {/* ═══════════════════════════════════════════════════════ */}
 {
 showSupplierModal && (
 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowSupplierModal(false)}>
 <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="p-6 border-b border-border flex justify-between items-center">
 <h2 className="text-xl font-bold text-foreground">{editingSupplier ? t('tedarikci_duzenle', { defaultValue: 'Tedarikçi Düzenle' }) : t('yeni_tedarikci_ekle', { defaultValue: 'Yeni Tedarikçi Ekle' })}</h2>
 <button onClick={() => setShowSupplierModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="md:col-span-2">
 <label className="text-xs text-muted-foreground mb-1 block">{t('firma_adi', { defaultValue: 'Firma Adı *' })}</label>
 <input value={supplierForm.name} onChange={e => setSupplierForm((p: any) => ({ ...p, name: e.target.value }))}
 placeholder={t('tedarikci_adi_placeholder')}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('yetkili_kisi')}</label>
 <input value={supplierForm.contactPerson} onChange={e => setSupplierForm((p: any) => ({ ...p, contactPerson: e.target.value }))}
 placeholder={t('isim_soyisim_placeholder')}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('telefon')}</label>
 <input value={supplierForm.phone} onChange={e => setSupplierForm((p: any) => ({ ...p, phone: e.target.value }))}
 placeholder="+49 ..."
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('email') || "E-Posta"}</label>
 <input value={supplierForm.email} onChange={e => setSupplierForm((p: any) => ({ ...p, email: e.target.value }))}
 placeholder="info@firma.de"
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('vergi_no', { defaultValue: 'Vergi No (USt-IdNr)' })}</label>
 <input value={supplierForm.taxId} onChange={e => setSupplierForm((p: any) => ({ ...p, taxId: e.target.value }))}
 placeholder="DE123456789"
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div className="md:col-span-2">
 <label className="text-xs text-muted-foreground mb-1 block">{t('adres')}</label>
 <input value={supplierForm.address} onChange={e => setSupplierForm((p: any) => ({ ...p, address: e.target.value }))}
 placeholder={t('adres_placeholder')}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('odeme_kosullari')}</label>
 <input value={supplierForm.paymentTerms} onChange={e => setSupplierForm((p: any) => ({ ...p, paymentTerms: e.target.value }))}
 placeholder={t('odeme_kosullari_placeholder')}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('teslimat_suresi_gun', { defaultValue: 'Teslimat Süresi (gün)' })}</label>
 <input type="number" value={supplierForm.deliveryDays} onChange={e => setSupplierForm((p: any) => ({ ...p, deliveryDays: e.target.value }))}
 placeholder="2"
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('min_siparis_tutari', { defaultValue: 'Min. Sipariş Tutarı (€)' })}</label>
 <input type="number" value={supplierForm.minOrderValue} onChange={e => setSupplierForm((p: any) => ({ ...p, minOrderValue: e.target.value }))}
 placeholder="100"
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('durum_label')}</label>
 <select value={supplierForm.isActive ? 'active' : 'inactive'} onChange={e => setSupplierForm((p: any) => ({ ...p, isActive: e.target.value === 'active' }))}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="active">{t('aktif')}</option>
 <option value="inactive">{t('pasif')}</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="text-xs text-muted-foreground mb-1 block">{t('notlar')}</label>
 <textarea value={supplierForm.notes} onChange={e => setSupplierForm((p: any) => ({ ...p, notes: e.target.value }))}
 rows={2} placeholder={t('ozel_kosullar_placeholder')}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-none" />
 </div>
 </div>
 </div>
 <div className="p-6 border-t border-border flex justify-end gap-3">
 <button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 bg-foreground text-background shadow-md rounded-lg text-sm">{t('iptal')}</button>
 <button onClick={saveSupplier} disabled={savingSupplier || !supplierForm.name.trim()}
 className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
 {savingSupplier ? t('kaydediliyor', { defaultValue: ' Kaydediliyor...' }) : editingSupplier ? t('guncelle', { defaultValue: ' Güncelle' }) : t('kaydet', { defaultValue: ' Kaydet' })}
 </button>
 </div>
 </div>
 </div>
 )
 }

 {/* ═══════════════════════════════════════════════════════ */}
 {/* ═══ ORDER CREATION MODAL ═══ */}
 {/* ═══════════════════════════════════════════════════════ */}
 {
 showOrderModal && (
 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowOrderModal(false)}>
 <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="p-6 border-b border-border flex justify-between items-center">
 <h2 className="text-xl font-bold text-foreground">{editingOrder ? t('siparis_duzenle', { defaultValue: 'Sipariş Düzenle' }) : t('yeni_tedarik_siparisi', { defaultValue: 'Yeni Tedarik Siparişi' })}</h2>
 <button onClick={() => setShowOrderModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
 </div>
 <div className="p-6 space-y-5">
 {/* Supplier Selection */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('supplier') || "Tedarikçi"} *</label>
 <select
 value={orderForm.supplierId}
 onChange={e => {
 const s = suppliers.find((s: any) => s.id === e.target.value);
 setOrderForm((p: any) => ({ ...p, supplierId: e.target.value, supplierName: s?.name || '' }));
 }}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border">
 {suppliers.map((s: any) => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('beklenen_teslimat')}</label>
 <input type="date" value={orderForm.expectedDeliveryDate} onChange={e => setOrderForm((p: any) => ({ ...p, expectedDeliveryDate: e.target.value }))}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('fatura_no')}</label>
 <input value={orderForm.invoiceNumber} onChange={e => setOrderForm((p: any) => ({ ...p, invoiceNumber: e.target.value }))}
 placeholder="RE-2026-001"
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none" />
 </div>
 </div>

 {/* Order Lines */}
 <div>
 <div className="flex justify-between items-center mb-3">
 <h3 className="text-sm font-semibold text-foreground"> {t('siparis_kalemleri')}</h3>
 <button
 onClick={() => setOrderForm((p: any) => ({
 ...p,
 items: [...p.items, { productId: '', productName: '', sku: '', orderedQuantity: 1, receivedQuantity: 0, unit: 'kg', purchasePrice: 0, batchNumber: '', productionDate: '', expirationDate: '' }]
 }))}
 className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium"
 >
 + Kalem Ekle
 </button>
 </div>
 <div className="space-y-3">
 {orderForm.items.map((item: any, idx: number) => (
 <div key={idx} className="bg-background/50 rounded-lg p-4 border border-border">
 <div className="flex items-center justify-between mb-3">
 <span className="text-xs text-muted-foreground font-semibold">Kalem #{idx + 1}</span>
 {orderForm.items.length > 1 && (
 <button
 onClick={() => setOrderForm((p: any) => ({ ...p, items: p.items.filter((_: any, i: number) => i !== idx) }))}
 className="text-red-800 dark:text-red-400 hover:text-red-300 text-xs"
 >
 Kaldır
 </button>
 )}
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <div className="col-span-2">
 <label className="text-xs text-muted-foreground mb-1 block">{t('urun_adi_label')} *</label>
 <div className="relative">
 <input
 value={item.productName}
 onChange={e => {
 const newItems = [...orderForm.items];
 newItems[idx] = { ...newItems[idx], productName: e.target.value };
 setOrderForm((p: any) => ({ ...p, items: newItems }));
 }}
 placeholder={t('urun_adi_sec_placeholder')}
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
 list={`product-list-${idx}`}
 />
 <datalist id={`product-list-${idx}`}>
 {inlineProducts.map((prod: any) => (
 <option key={prod.id} value={typeof prod.name === 'object' ? (prod.name.tr || prod.name.de || Object.values(prod.name)[0]) : prod.name}>
 {prod.id}
 </option>
 ))}
 </datalist>
 </div>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('sku_artikelnr', { defaultValue: 'SKU / Artikelnr' })}</label>
 <input
 value={item.sku || ''}
 onChange={e => {
 const newItems = [...orderForm.items];
 newItems[idx] = { ...newItems[idx], sku: e.target.value };
 setOrderForm((p: any) => ({ ...p, items: newItems }));
 }}
 placeholder="Art.Nr."
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
 />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('birim_label')}</label>
 <select
 value={item.unit}
 onChange={e => {
 const newItems = [...orderForm.items];
 newItems[idx] = { ...newItems[idx], unit: e.target.value };
 setOrderForm((p: any) => ({ ...p, items: newItems }));
 }}
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border">
 <option value="kg">{t('kg') || "kg"}</option>
 <option value="adet">{t('pieces') || "Adet (Stück)"}</option>
 <option value="paket">{t('paket')}</option>
 <option value="kutu">{t('box_carton') || "Kutu (Karton)"}</option>
 <option value="lt">{t('litre')}</option>
 </select>
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('siparis_miktari', { defaultValue: 'Sipariş Miktarı *' })}</label>
 <input
 type="number"
 min="0" step="0.1"
 value={item.orderedQuantity}
 onChange={e => {
 const newItems = [...orderForm.items];
 newItems[idx] = { ...newItems[idx], orderedQuantity: e.target.value };
 setOrderForm((p: any) => ({ ...p, items: newItems }));
 }}
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
 />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('birim_fiyat_ek')} *</label>
 <input
 type="number"
 min="0" step="0.01"
 value={item.purchasePrice}
 onChange={e => {
 const newItems = [...orderForm.items];
 newItems[idx] = { ...newItems[idx], purchasePrice: e.target.value };
 setOrderForm((p: any) => ({ ...p, items: newItems }));
 }}
 placeholder="€"
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
 />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('satir_toplam')}</label>
 <p className="text-foreground text-sm font-semibold py-2">
 {formatCurrency(Number(item.purchasePrice || 0) * Number(item.orderedQuantity || 0), (business as any)?.currency || 'EUR')}
 </p>
 </div>
 </div>
 </div>
 ))}
 </div>
 {/* Total */}
 <div className="mt-4 text-right">
 <span className="text-muted-foreground text-sm">{t('toplam', { defaultValue: 'Toplam: ' })}</span>
 <span className="text-foreground text-lg font-bold">
 {formatCurrency(
 orderForm.items.reduce((sum: number, item: any) => sum + (Number(item.purchasePrice || 0) * Number(item.orderedQuantity || 0)), 0),
 (business as any)?.currency || 'EUR'
 )}
 </span>
 </div>
 </div>

 {/* Notes */}
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('notlar')}</label>
 <textarea value={orderForm.notes} onChange={e => setOrderForm((p: any) => ({ ...p, notes: e.target.value }))}
 rows={2} placeholder={t('siparis_notlari_placeholder')}
 className="w-full bg-background/50 text-foreground text-sm rounded px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-none" />
 </div>
 </div>
 <div className="p-6 border-t border-border flex justify-end gap-3">
 <button onClick={() => setShowOrderModal(false)} className="px-4 py-2 bg-foreground text-background shadow-md rounded-lg text-sm">{t('iptal')}</button>
 <button onClick={saveSupplierOrder} disabled={savingOrder || !orderForm.supplierId}
 className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
 {savingOrder ? t('kaydediliyor', { defaultValue: ' Kaydediliyor...' }) : editingOrder ? t('guncelle', { defaultValue: ' Güncelle' }) : t('siparis_olustur', { defaultValue: ' Sipariş Oluştur' })}
 </button>
 </div>
 </div>
 </div>
 )
 }

 {/* ═══════════════════════════════════════════════════════ */}
 {/* ═══ GOODS RECEIPT MODAL (Wareneingang / Mal Kabul) ═══ */}
 {/* ═══════════════════════════════════════════════════════ */}
 {
 showGoodsReceiptModal && goodsReceiptOrder && (
 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowGoodsReceiptModal(false)}>
 <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="p-6 border-b border-border">
 <h2 className="text-xl font-bold text-foreground">📥 {t('mal_kabul', { defaultValue: 'Mal Kabul (Wareneingang)' })}</h2>
 <p className="text-muted-foreground text-sm mt-1">
 Sipariş: <span className="text-blue-800 dark:text-blue-400 font-mono">{goodsReceiptOrder.orderNumber}</span> — {goodsReceiptOrder.supplierName}
 </p>
 </div>
 <div className="p-6 space-y-4">
 {goodsReceiptOrder.items.map((item: any, idx: number) => (
 <div key={idx} className={`rounded-lg p-4 border ${item.isFullyReceived ? 'bg-green-900/20 border-green-200 dark:border-green-700/50' : 'bg-background/50 border-border'}`}>
 <div className="flex items-center justify-between mb-3">
 <div>
 <span className="text-foreground font-semibold">{item.productName}</span>
 {item.sku && <span className="text-muted-foreground text-xs ml-2">(#{item.sku})</span>}
 </div>
 <span className="text-muted-foreground text-sm">
 Sipariş: <strong className="text-foreground">{item.orderedQuantity} {item.unit}</strong>
 </span>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('teslim_alinan_miktar')}</label>
 <input
 type="number" min="0" step="0.1"
 value={item.receivedQuantity || ''}
 onChange={e => {
 const newItems = [...goodsReceiptOrder.items];
 newItems[idx] = { ...newItems[idx], receivedQuantity: e.target.value };
 setGoodsReceiptOrder({ ...goodsReceiptOrder, items: newItems });
 }}
 placeholder="0"
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-green-500 focus:outline-none"
 />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('batch_no') || "Parti / Charge No"}</label>
 <input
 value={item.batchNumber || ''}
 onChange={e => {
 const newItems = [...goodsReceiptOrder.items];
 newItems[idx] = { ...newItems[idx], batchNumber: e.target.value };
 setGoodsReceiptOrder({ ...goodsReceiptOrder, items: newItems });
 }}
 placeholder="LOT-001"
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-green-500 focus:outline-none"
 />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('uretim_tarihi')}</label>
 <input
 type="date"
 value={item.productionDate || ''}
 onChange={e => {
 const newItems = [...goodsReceiptOrder.items];
 newItems[idx] = { ...newItems[idx], productionDate: e.target.value };
 setGoodsReceiptOrder({ ...goodsReceiptOrder, items: newItems });
 }}
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-green-500 focus:outline-none"
 />
 </div>
 <div>
 <label className="text-xs text-muted-foreground mb-1 block">{t('expiration_date') || "Son Kullanma (MHD)"}</label>
 <input
 type="date"
 value={item.expirationDate || ''}
 onChange={e => {
 const newItems = [...goodsReceiptOrder.items];
 newItems[idx] = { ...newItems[idx], expirationDate: e.target.value };
 setGoodsReceiptOrder({ ...goodsReceiptOrder, items: newItems });
 }}
 className="w-full bg-card text-foreground text-sm rounded px-3 py-2 border border-border focus:border-green-500 focus:outline-none"
 />
 </div>
 <div className="flex items-end">
 <div className={`w-full text-center py-2 rounded text-xs font-semibold ${Number(item.receivedQuantity || 0) >= Number(item.orderedQuantity)
 ? 'bg-green-600/30 text-green-300'
 : Number(item.receivedQuantity || 0) > 0
 ? 'bg-yellow-600/30 text-yellow-300'
 : 'bg-muted text-muted-foreground'
 }`}>
 {Number(item.receivedQuantity || 0) >= Number(item.orderedQuantity)
 ? ' Tam'
 : Number(item.receivedQuantity || 0) > 0
 ? ` Kısmi (${item.receivedQuantity}/${item.orderedQuantity})`
 : ' Bekliyor'}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 <div className="p-6 border-t border-border flex justify-between items-center">
 <div className="text-sm text-muted-foreground">
 {goodsReceiptOrder.items.filter((it: any) => Number(it.receivedQuantity || 0) >= Number(it.orderedQuantity)).length} / {goodsReceiptOrder.items.length} kalem tam teslim
 </div>
 <div className="flex gap-3">
 <button onClick={() => setShowGoodsReceiptModal(false)} className="px-4 py-2 bg-foreground text-background shadow-md rounded-lg text-sm">{t('iptal')}</button>
 <button onClick={processGoodsReceipt} disabled={savingOrder}
 className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
 {savingOrder ? t('kaydediliyor', { defaultValue: ' Kaydediliyor...' }) : '📥 ' + t('mal_kabulu_kaydet', { defaultValue: 'Mal Kabulü Kaydet'})}
 </button>
 </div>
 </div>
 </div>
 
 {/* (Kapanıs uyarilarindan dolayi bilerek alta alindi) */}
 </div>
 )}

 {/* Order Details Modal */}
 {selectedOrder && (
 <OrderDetailsModal
 order={selectedOrder}
 onClose={() => setSelectedOrder(null)}
 t={t}
 businesses={{ [business?.id || '']: business?.companyName || '' }}
 checkedItems={checkedItems[selectedOrder.id] || {}}
 dateLocale="de-DE"
 onUpdateOrderStatus={updateOrderStatus}
 onToggleItemChecked={toggleItemChecked}
 disableBusinessLink={true}
 />
 )}

 </div >
 );
}
