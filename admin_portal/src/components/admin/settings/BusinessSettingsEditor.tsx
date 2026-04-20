import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { normalizeTimeString, getScheduleForToday } from '@/utils/timeUtils';
import MultiLanguageInput from '@/components/ui/MultiLanguageInput';
import LockedModuleOverlay from '@/components/admin/LockedModuleOverlay';
import { BUSINESS_TYPES } from '@/lib/business-types';
import { GERMAN_LEGAL_FORM_LABELS } from '@/types';

// Format utility
function formatTo24h(timeStr: string): string {
    return normalizeTimeString(timeStr) || timeStr;
}

export default function BusinessSettingsEditor({ 
    businessId, 
    business, 
    isAdminPanel = false,
    showToast,
    onSuccess 
}: {
    businessId: string;
    business?: any;
    isAdminPanel?: boolean;
    showToast: (msg: string, type: string) => void;
    onSuccess?: () => void;
}) {
    const t = useTranslations('AdminBusiness');
    const { admin } = useAdmin();
    
    // UI State
    const [isEditing, setIsEditing] = useState(!business);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isletmeInternalTab, setIsletmeInternalTab] = useState<"bilgiler"|"fatura"|"zertifikalar"|"gorseller"|"saatler"|"teslimat">("bilgiler");
    const [saatlerSubTab, setSaatlerSubTab] = useState<"genel"|"kurye"|"gelal">("genel");
    const [settingsSubTab, setSettingsSubTab] = useState("isletme");
    const planFeatures = { delivery: true, pickup: true }; // Hardcode for now or pass as props if needed
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

    useEffect(() => {
        if (business) {
            setFormData(prev => ({ ...prev, ...business }));
            setIsEditing(false);
        }
    }, [business]);
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

    return (
        <div className="space-y-6">
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
 {settingsSubTab === "isletme" && (
 <>
 {/* Internal Tab Bar for İşletme */}
 <div className="flex gap-2 border-b border-border pb-3 mb-6 flex-wrap">
 {[
 { id: "bilgiler" as const, label: t('isletmeBilgileri') },
 { id: "fatura" as const, label: t('fatura_adresi') },
 { id: "zertifikalar" as const, label: t('sertifikalarLabel') },
 { id: "gorseller" as const, label: t('gorseller') },
 { id: "saatler" as const, label: t('acilisSaatleri') },
 { id: "teslimat" as const, label: t('teslimatAyarlari') },
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

 {/* ═══════ Tab 1: İşletme Bilgileri ═══════ */}
 {isletmeInternalTab === "bilgiler" && (
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
 <label className="text-muted-foreground text-sm block mb-2">{t('isletmeTurleri')}</label>
 <div className="flex flex-wrap gap-2">
 {dynamicSectorTypes.map((sector) => {
 const isSelected = formData.types?.includes(sector.id);
 return (
 <button key={sector.id} type="button" onClick={() => { if (!isEditing) return; const newTypes = isSelected ? formData.types.filter(t => t !== sector.id) : [...(formData.types || []), sector.id]; setFormData({ ...formData, types: newTypes }); }} disabled={!isEditing} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isSelected ? 'bg-blue-600 text-white ring-2 ring-white/50' : 'bg-muted text-muted-foreground hover:bg-muted border border-border text-foreground'} ${!isEditing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
 <span>{sector.icon}</span><span>{sector.label}</span>{isSelected && <span className="text-white/80">✓</span>}
 </button>
 );
 })}
 </div>
 {formData.types?.length > 0 && (<p className="text-xs text-green-800 dark:text-green-400 mt-2">{formData.types.length} {t('modulAktifHerModulAyriUcretlendirilir')}</p>)}
 </div>
 {/* Müşteri No */}
 <div>
 <label className="text-muted-foreground text-sm">{t('musteriNo')}</label>
 <input type="text" value={formData.customerId} readOnly disabled={true} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 opacity-50 cursor-not-allowed" />
 <p className="text-xs text-muted-foreground mt-1">{t('musteriNoDegistirilemez')}</p>
 </div>
 {/* Vergi UID */}
 <div>
 <label className="text-muted-foreground text-sm">{t('vergi_uid_nummer_vat')}</label>
 <input type="text" value={formData.vatNumber || ''} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} disabled={!isEditing} placeholder="DE123456789" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50 font-mono" />
 <p className="text-xs text-muted-foreground mt-1">{t('avrupaBirligiVergiNumarasiOrnDe123456789')}</p>
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
 <div>
 <label className="text-muted-foreground text-sm">{t('vertretungsberechtigter')}</label>
 <input type="text" value={formData.authorizedRepresentative || ''} onChange={(e) => setFormData({ ...formData, authorizedRepresentative: e.target.value })} disabled={!isEditing} placeholder="Falls abweichend vom Geschäftsführer" className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mt-1 disabled:opacity-50" />
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
 {/* Google Place */}
 <div className="space-y-4 pt-4 border-t border-border">
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
 </div>
 )}

 {/* ═══════ Tab 2: Fatura Adresi ═══════ */}
 {isletmeInternalTab === t(t('fatura')) && (
 <div className="space-y-6">
 <div className="bg-card/50 border border-border rounded-xl p-6">
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
 <div className="bg-card/50 border border-border rounded-xl p-6">
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
    <div className="bg-card/50 border border-border rounded-xl p-6 mt-6">
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
 <div className="bg-card/50 border border-border rounded-xl p-6 text-center">
 <p className="text-muted-foreground">{t('zertifikaAyarlariSadeceSuperAdminTarafindan')}</p>
 </div>
 )}
 </div>
 )}

 {/* ═══════ Tab 4: Görseller ═══════ */}
 {isletmeInternalTab === "gorseller" && (
 <div className="space-y-6">
 {/* İşletme Kart Görseli */}
 <div className="bg-card/50 border border-border rounded-xl p-6">
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
 {uploading && !imageFile ? (<span className="animate-spin mr-2"></span>) : (<span className="mr-2">🪄</span>)} Google'dan Bilgileri Doldur (Server)
 </button>
 {!formData.googlePlaceId && (<p className="text-xs text-red-800 dark:text-red-400">{t('google_id_gerekli')}</p>)}
 </div>
 )}
 </div>
 </div>
 {/* İşletme Logosu */}
 <div className="bg-card/50 border border-border rounded-xl p-6">
 <h4 className="text-foreground font-medium mb-4">{t('isletmeLogosuKare')}</h4>
 <div className="flex items-center gap-4">
 {formData.logoUrl ? (<img src={formData.logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-cover border border-border" />) : (<div className="w-20 h-20 rounded-lg bg-muted border border-dashed border-gray-500 flex items-center justify-center text-muted-foreground text-3xl">🏪</div>)}
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
 {isletmeInternalTab === "saatler" && (
 <div className="space-y-6">
 {/* Left Sidebar + Content Grid Layout */}
 <div className="flex gap-0 rounded-xl overflow-hidden border border-border">
 {/* Left Sidebar Navigation */}
 <div className="w-48 bg-card/80 border-r border-border flex-shrink-0">
 {[
 { id: "genel" as const, label: t('acilisSaatleri') },
 { id: "kurye" as const, label: t('kuryeSaatleri') },
 { id: "gelal" as const, label: t('gelAlSaatleri') },
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => setSaatlerSubTab(tab.id)}
 className={`w-full text-left px-4 py-3.5 text-sm font-medium transition border-b border-border/50 last:border-0 ${saatlerSubTab === tab.id
 ? "bg-blue-600/20 text-blue-800 dark:text-blue-400 border-l-2 border-l-blue-500"
 : "text-muted-foreground hover:bg-muted/50 hover:text-white border-l-2 border-l-transparent"
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>

 {/* Right Content Area */}
 <div className="flex-1 bg-card/30 p-6">
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

 {/* ═══════ Tab 6: Teslimat Ayarları ═══════ */}
 {isletmeInternalTab === "teslimat" && (
 <LockedModuleOverlay featureKey="delivery">
 <div className="space-y-6">
 <div className="bg-card/50 border border-border rounded-xl p-6">
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
 )}
 </>
 )}

        </div>
    );
}
