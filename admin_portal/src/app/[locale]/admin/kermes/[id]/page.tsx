'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy, Timestamp, where, setDoc, documentId, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { KERMES_MENU_CATALOG, KermesMenuItemData } from '@/lib/kermes_menu_catalog';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';
import { MapLocationPicker, SelectedLocation } from '@/components/MapLocationPicker';
import OrganizationSearchModal from '@/components/OrganizationSearchModal';
import { useTranslations, useLocale } from 'next-intl';
import { normalizeTimeString } from '@/utils/timeUtils';
import { getLocalizedText } from '@/lib/utils';
import TableManagementPanel from '@/components/TableManagementPanel';
import KermesTahsilatTab from './KermesTahsilatTab';
import KermesSiparislerTab from './KermesSiparislerTab';
import KermesRosterTab from './KermesRosterTab';
import KermesTedarikTab from './KermesTedarikTab';
import CategoryManagementModal from '@/components/admin/CategoryManagementModal';

// Etkinlik özellikleri - Firestore'dan dinamik yüklenir
interface KermesFeature {
 id: string;
 label: string;
 labelKey?: string;
 icon?: string;
 iconUrl?: string;
 storagePath?: string;
 color: string;
 isActive: boolean;
}

// Fallback varsayılan özellikler (Firestore erişilemezse)
const DEFAULT_FEATURES: KermesFeature[] = [
 { id: 'family_area', label: 'Aile Bölümü', labelKey: 'feature_family_area', icon: '👨‍👩‍👧‍👦', color: '#E91E63', isActive: true },
 { id: 'parking', label: 'Otopark', labelKey: 'feature_parking', icon: '🅿️', color: '#2196F3', isActive: true },
 { id: 'accessible', label: 'Engelli Erişimi', labelKey: 'feature_accessible', icon: '♿', color: '#9C27B0', isActive: true },
 { id: 'kids_area', label: 'Çocuk Alanı', labelKey: 'feature_kids_area', icon: '🧒', color: '#4CAF50', isActive: true },
 { id: 'outdoor', label: 'Açık Alan', labelKey: 'feature_outdoor', icon: '🌳', color: '#8BC34A', isActive: true },
 { id: 'indoor', label: 'Kapalı Alan', labelKey: 'feature_indoor', icon: '🏠', color: '#FF5722', isActive: true },
 { id: 'live_music', label: 'Canlı Müzik', labelKey: 'feature_live_music', icon: '🎵', color: '#607D8B', isActive: true },
 { id: 'prayer_room', label: 'Namaz Alanı', labelKey: 'feature_prayer_room', icon: '🕌', color: '#795548', isActive: true },
 { id: 'vegetarian', label: 'Vejetaryen', labelKey: 'feature_vegetarian', icon: '🥗', color: '#4CAF50', isActive: true },
 { id: 'halal', label: 'Helal', labelKey: 'feature_halal', icon: '☪️', color: '#009688', isActive: true },
 { id: 'free_entry', label: 'Ücretsiz Giriş', labelKey: 'feature_free_entry', icon: '🎟️', color: '#FF9800', isActive: true },
 { id: 'wifi', label: 'WiFi', labelKey: 'feature_wifi', icon: '📶', color: '#3F51B5', isActive: true },
];

// Varsayılan kategoriler (ilk yüklemede Firebase'e yazılacak)
const DEFAULT_CATEGORIES = ['Ana Yemek', 'Çorba', 'Tatlı', 'İçecek', 'Aperatif', 'Grill', 'Diğer'];

const DEFAULT_PREP_ZONES = ["Kadinlar Standi", "Erkekler Standi", "Icecek Standi", "Tatli Standi", "Doner Standi"];

interface SectionDefForPZ {
  name: string;
  genderRestriction: string;
  prepZones?: string[];
  hasDineIn?: boolean;
}

function PrepZoneSelector({ value, onChange, products, sectionDefs }: { value: string[], onChange: (val: string[]) => void, products: KermesProduct[], sectionDefs?: SectionDefForPZ[] }) {
    const hasDynamic = sectionDefs && sectionDefs.length > 0 && sectionDefs.some(s => (s.prepZones || []).length > 0);

    const toggleZone = (zone: string) => {
        if (value.includes(zone)) onChange(value.filter(v => v !== zone));
        else onChange([...value, zone]);
    };

    if (hasDynamic) {
        const allDynamicZones = sectionDefs!.flatMap(s => (s.prepZones || []).map(z => ({ zone: z, section: s.name })));
        const allZoneNames = allDynamicZones.map(d => d.zone);
        const customValues = value.filter(v => !allZoneNames.includes(v));
        return (
            <div className="space-y-3">
            {sectionDefs!.filter(s => (s.prepZones || []).length > 0).map(section => (
                <div key={section.name} className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{section.name}</p>
                <div className="flex flex-wrap gap-2">
                {(section.prepZones || []).map(zone => (
                    <label key={zone} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition ${value.includes(zone) ? 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800' : 'bg-muted/30 border-border hover:bg-muted'}`}>
                        <input type="checkbox" checked={value.includes(zone)} onChange={() => toggleZone(zone)} className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 w-4 h-4" />
                        <span className={`text-sm ${value.includes(zone) ? 'font-medium text-pink-700 dark:text-pink-300' : 'text-foreground'}`}>{zone}</span>
                    </label>
                ))}
                </div>
                </div>
            ))}
            {customValues.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg">
                    <p className="text-[10px] text-red-600 dark:text-red-400 mb-2 font-medium">Sistemde tanımlı olmayan alanlar (Lütfen kaldırın):</p>
                    <div className="flex flex-wrap gap-2">
                        {customValues.map(zone => (
                            <label key={zone} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-800 cursor-pointer transition hover:bg-red-200/50">
                                <input type="checkbox" checked={true} onChange={() => toggleZone(zone)} className="rounded border-red-400 text-red-600 focus:ring-red-500 w-4 h-4" />
                                <span className="text-sm font-medium text-red-800 dark:text-red-300">{zone}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
            </div>
        );
    }

    // Fallback: hardcoded defaults
    const allZones = Array.from(new Set([...DEFAULT_PREP_ZONES, ...products.flatMap(p => p.prepZone || [])])).filter(Boolean).sort();
    const customValues = value.filter(v => !allZones.includes(v));
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {allZones.map(zone => (
                    <label key={zone} className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer transition ${value.includes(zone) ? 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800' : 'bg-muted/30 border-border hover:bg-muted'}`}>
                        <input type="checkbox" checked={value.includes(zone)} onChange={() => toggleZone(zone)} className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 w-4 h-4" />
                        <span className={`text-sm ${value.includes(zone) ? 'font-medium text-pink-700 dark:text-pink-300' : 'text-foreground'}`}>{zone}</span>
                    </label>
                ))}
            </div>
            {customValues.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg">
                    <p className="text-[10px] text-red-600 dark:text-red-400 mb-2 font-medium">Sistemde tanımlı olmayan alanlar (Lütfen kaldırın):</p>
                    <div className="flex flex-wrap gap-2">
                        {customValues.map(zone => (
                            <label key={zone} className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-800 cursor-pointer transition hover:bg-red-200/50">
                                <input type="checkbox" checked={true} onChange={() => toggleZone(zone)} className="rounded border-red-400 text-red-600 focus:ring-red-500 w-4 h-4" />
                                <span className="text-sm font-medium text-red-800 dark:text-red-300">{zone}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


export interface KermesCustomRole {
  id: string; // e.g. role_1234
  name: string; // e.g. Temizlik Görevlisi
  icon: string; // Emoji
  color: string; // Tailwind class
}

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
 latitude?: number | null;
 longitude?: number | null;
 date?: any;
 startDate?: any;
 endDate?: any;
 deliveryZones?: any[];
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
 isMenuOnly?: boolean;
 hasTakeaway?: boolean;
 hasDineIn?: boolean;
 hasDelivery?: boolean;
 deliveryFee?: number;
 minCartForFreeDelivery?: number;
 minOrderAmount?: number; // Minimum sipariş tutarı (kurye için)
 // Personel Atamaları
 assignedStaff?: any[];
 assignedDrivers?: any[];
 assignedWaiters?: any[];
 customRoles?: KermesCustomRole[];
 customRoleAssignments?: Record<string, string[]>;
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
  // Fiyat Ayarlari
  currency?: string;
  pricingMode?: 'net' | 'brut';
  foodTaxRate?: number;
  nonFoodTaxRate?: number;
 // Başlık görseli (Stok veya özel)
 headerImage?: string;
 headerImageId?: string; // Stok görsel ID'si (kullanım sayacı için)
 // Badges / Sertifikalar
 activeBadgeIds?: string[];
 // Yuvarlama ile Destek
 acceptsDonations?: boolean;
 selectedDonationFundId?: string;
 selectedDonationFundName?: string;
 // Sila Yolu
 isSilaYolu?: boolean;
}

interface KermesProduct {
 id: string;
 masterSku: string;
 name: string;
 secondaryName?: string; // 2. isim
 price: number;
 costPrice?: number; // Maliyet fiyatı
 discountPrice?: number; // Akşam pazarı indirimli fiyatı
 category: string;
 description?: string;
 detailedDescription?: string; // Detaylı açıklama
 isAvailable: boolean;
 isSoldOut?: boolean;
 isCustom?: boolean;
 sourceType?: 'master' | 'kermes_catalog' | 'custom';
 barcode?: string;
 unit?: 'adet' | 'porsiyon' | 'litre' | 'kg' | 'gr' | 'bardak' | 'kase'; // Birim
 allergens?: string[]; // Alerjenler
 ingredients?: string[]; // Icerikler
 imageUrls?: string[]; // Gorseller (max 3)
 prepZone?: string[];
 // Mutfak operasyonu
 serviceType?: 'instant' | 'prepped'; // instant=sicak/aninda, prepped=onceden hazir
 counterAvailability?: 'all' | 'source'; // all=her tezgahta, source=sadece hazirlandigi yerde
 // Stok takip
  stockEnabled?: boolean;
  initialStock?: number;
  currentStock?: number;
  lowStockThreshold?: number;
  lastStockUpdateBy?: string;
  lastStockUpdateAt?: any;
  optionGroups?: any[];
}

export const EXTENDED_SYSTEM_ROLES: KermesCustomRole[] = [
  { id: 'role_temizlik', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  { id: 'role_park', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { id: 'role_cocuk', name: 'Çocuk Görevlisi', icon: '👶', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
  { id: 'role_vip', name: 'Özel Misafir (VIP)', icon: '⭐', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
];

interface MasterProduct {
 id: string;
 name: string;
 barcode?: string;
 category?: string;
 defaultPrice?: number;
 unit?: string;
}

export default function KermesDetailPage() {

 const t = useTranslations('AdminKermesDetail');
 const tFeatures = useTranslations('KermesFeatures');
 const locale = useLocale();
 const params = useParams();
 const router = useRouter();
 const { admin, loading: adminLoading } = useAdmin();
 const isSuperAdmin = admin?.adminType === 'super';
 const kermesId = params.id as string;
 // Kermes Admin: bu kermes icin admin yetkisi olan kullanici

 const getLocalizedFeatureLabel = (f: KermesFeature) => {
   try {
     return (tFeatures as any).has(f.id) ? tFeatures(f.id) : (f.labelKey ? t(f.labelKey) : f.label);
   } catch {
     return f.labelKey ? t(f.labelKey) : f.label;
   }
 };
 const adminUid = (admin as any)?.firebaseUid || admin?.id || '';
 const [isKermesAdminOfThis, setIsKermesAdminOfThis] = useState(false);
 const canManageStaff = isSuperAdmin || isKermesAdminOfThis;

 const [kermes, setKermes] = useState<KermesEvent | null>(null);
 const [products, setProducts] = useState<KermesProduct[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
 const [activeTab, setActiveTab] = useState<'bilgi' | 'menu' | 'personel' | 'vardiya' | 'gorevler' | 'mutfak' | 'masalar' | 'siparisler' | 'tahsilat' | 'bildirimler' | 'tedarik'>('bilgi');
  const [bilgiSubTab, setBilgiSubTab] = useState<'genel' | 'marka' | 'ozellikler' | 'teslimat' | 'fiyat' | 'imkanlar'>('genel');
 // Mutfak: PrepZone -> Personel atamalari
 const [prepZoneAssignments, setPrepZoneAssignments] = useState<Record<string, string[]>>({});
 const [eventFeatures, setEventFeatures] = useState<KermesFeature[]>(DEFAULT_FEATURES);
 const [availableBadges, setAvailableBadges] = useState<any[]>([]);
 const [donationFunds, setDonationFunds] = useState<{ id: string; name: string; description?: string }[]>([]);

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
 latitude: null as number | null,
 longitude: null as number | null,
 // Yetkili kişi - Ayrı alanlar
 contactName: '',
 contactFirstName: '',
 contactLastName: '',
 contactPhone: '',
 phoneCountryCode: '+49',
 // Sipariş Yöntemleri ve İstisnalar
 isMenuOnly: false,
 hasTakeaway: true,
 hasDineIn: true,
 hasDelivery: false,
 deliveryFee: 0,
 minCartForFreeDelivery: 0,
 minOrderAmount: 0, // Minimum sipariş tutarı
 // Park imkanları
 parkingLocations: [] as { street: string; city: string; postalCode: string; country: string; note: string; images: string[]; status?: string | null; lat?: number; lng?: number }[],
 generalParkingNote: '',
 // Pfand/Depozito sistemi
 hasPfandSystem: false,
 pfandAmount: 0.25,
 // KDV sistemi
 showKdv: false,
 kdvRate: 7,
 pricesIncludeKdv: true,
 // Fiyat Ayarlari
 currency: 'EUR',
 pricingMode: 'brut' as 'net' | 'brut',
 foodTaxRate: 7,
 nonFoodTaxRate: 19,
 // Başlık görseli
 headerImage: '',
 headerImageId: '',
 sponsor: 'none' as 'tuna' | 'akdeniz_toros' | 'none',
 activeBadgeIds: [] as string[],
 // Bagis
 acceptsDonations: false,
 selectedDonationFundId: '',
 selectedDonationFundName: '',
 isSilaYolu: false,
 // Roles
 customRoles: [] as KermesCustomRole[],
 });
 const [editFeatures, setEditFeatures] = useState<string[]>([]);
 const [editCustomFeatures, setEditCustomFeatures] = useState<string[]>([]); // Max 3 özel özellik
 const [mapPickerOpen, setMapPickerOpen] = useState(false);
 const [mapPickerIndex, setMapPickerIndex] = useState<number | 'new'>('new'); // Hangi park alanı için
 const [mainMapOpen, setMainMapOpen] = useState(false); // Yeni Ana Adres icin
 const [showOrgSearchModal, setShowOrgSearchModal] = useState(false); // Dernek Sec modal
 
 // Personel & Sürücü & Garson Yönetimi
 const [assignedStaff, setAssignedStaff] = useState<string[]>([]);
 const [assignedDrivers, setAssignedDrivers] = useState<string[]>([]);
 const [assignedWaiters, setAssignedWaiters] = useState<string[]>([]);
 const [customRoleAssignments, setCustomRoleAssignments] = useState<Record<string, string[]>>({});
 const [kermesAdmins, setKermesAdmins] = useState<string[]>([]); // Kermes Admin UIDs
 const [staffSearchQuery, setStaffSearchQuery] = useState('');
 const [driverSearchQuery, setDriverSearchQuery] = useState('');
 const [staffResults, setStaffResults] = useState<any[]>([]);
 const [driverResults, setDriverResults] = useState<any[]>([]);
 const [searchingStaff, setSearchingStaff] = useState(false);
 const [searchingDriver, setSearchingDriver] = useState(false);

 // Akilli eslestirme - mevcut kullanici bulunca
 const [matchedUser, setMatchedUser] = useState<any | null>(null);
 const [isMatchSearching, setIsMatchSearching] = useState(false);
 // Rol checkboxlari (yeni olusturma + mevcut atama icin)
 const [newStaffRoles, setNewStaffRoles] = useState({
 isStaff: true,
 isDriver: false,
 isWaiter: false,
 isKermesAdmin: false,
 });

 // Edit Person Modal State
 const [editPersonData, setEditPersonData] = useState<any>(null);
 const [isSavingPerson, setIsSavingPerson] = useState(false);

 // Bolum tanimlari (PrepZone + Tezgah hiyerarsisi)
 const [kermesSectionDefs, setKermesSectionDefs] = useState<SectionDefForPZ[]>([]);
 const [showNewKitchenPanel, setShowNewKitchenPanel] = useState(false);
 const [newKitchenName, setNewKitchenName] = useState('');
 const [newKitchenGender, setNewKitchenGender] = useState<'mixed'|'women_only'|'men_only'>('women_only');

   // Otomatik kadro kaydetme fonksiyonu
  const saveTeamToDb = async (newStaff: string[], newDrivers: string[], newWaiters?: string[], newKermesAdmins?: string[], newCustomRoleAssignments?: Record<string, string[]>) => {
  if (!kermesId) return;
  try {
  const updatePayload: any = {
  assignedStaff: newStaff,
  assignedDrivers: newDrivers,
  };
  
  const sendNotif = async (uid: string, title: string, body: string) => {
     try {
       await fetch('/api/admin/notify-staff', {
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ userId: uid, title, body, type: 'kermes_assignment' })
       });
     } catch(e) {}
  };

  const toNotify: {uid: string, role: string}[] = [];

  // Drivers
  if (newDrivers) {
      newDrivers.forEach(uid => { if (!assignedDrivers.includes(uid)) toNotify.push({uid, role: 'Sürücü'}); });
  }

  // Waiters
  if (newWaiters !== undefined) {
      updatePayload.assignedWaiters = newWaiters;
      newWaiters.forEach(uid => { if (!assignedWaiters.includes(uid)) toNotify.push({uid, role: 'Garson'}); });
  } else updatePayload.assignedWaiters = assignedWaiters;
  
  if (newKermesAdmins !== undefined) updatePayload.kermesAdmins = newKermesAdmins;
  else updatePayload.kermesAdmins = kermesAdmins;
  
  // Custom Roles - hem atamalari hem de rol tanimi kaydet
  if (newCustomRoleAssignments !== undefined) {
      updatePayload.customRoleAssignments = newCustomRoleAssignments;
      updatePayload.customRoles = editForm.customRoles || [];
      Object.entries(newCustomRoleAssignments).forEach(([roleId, uids]) => {
          const oldUids = customRoleAssignments[roleId] || [];
          const roleName = (editForm.customRoles || []).find((r:any) => r.id === roleId)?.name || 'Özel Görev';
          uids.forEach(uid => { if (!oldUids.includes(uid)) toNotify.push({uid, role: roleName}); });
      });
  } else updatePayload.customRoleAssignments = customRoleAssignments;
  
  // Clean updatePayload from undefined values just in case to prevent Firebase errors
  Object.keys(updatePayload).forEach(key => {
    if (updatePayload[key] === undefined) {
      delete updatePayload[key];
    }
  });
  
  await updateDoc(doc(db, 'kermes_events', kermesId as string), updatePayload);
  showToast(t('kaydedildi') || 'Kadro güncellendi', 'success');

  // Trigger Notifications
  for (const n of toNotify) {
      await sendNotif(n.uid, 'Yeni Görev Ataması', `"${kermes?.title || editForm.title || 'Kermes'}" kermesinde "${n.role}" görevine atandınız.`);
  }

  } catch (error) {
  console.error('Kadro güncellenirken hata:', error);
  showToast(t('hata_olustu') || 'Kadro kaydedilemedi', 'error');
  }
  };
 
 const [assignedStaffDetails, setAssignedStaffDetails] = useState<any[]>([]);
 const [authProviderMap, setAuthProviderMap] = useState<Record<string, string[]>>({});
 const [assignedDriverDetails, setAssignedDriverDetails] = useState<any[]>([]);
 
 // Yeni Personel & Sürücü Ekleme
 const [isAddingStaff, setIsAddingStaff] = useState(false);
 const [isAddingDriver, setIsAddingDriver] = useState(false);
 const [newStaffForm, setNewStaffForm] = useState({ name: '', phone: '', email: '', countryCode: '+49', gender: '' });
 const [newDriverForm, setNewDriverForm] = useState({ name: '', phone: '', email: '', countryCode: '+49', gender: '' });
 const [isCreatingUser, setIsCreatingUser] = useState(false);


 // Categories - dinamik
 const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
 const [showCategoryModal, setShowCategoryModal] = useState(false);
 const [newCategoryName, setNewCategoryName] = useState('');

 // Add product modal
 const [showAddModal, setShowAddModal] = useState(false);
 const [showFlashSaleModal, setShowFlashSaleModal] = useState(false);
 const [isSendingFlashSale, setIsSendingFlashSale] = useState(false);
 const [flashSaleRadius, setFlashSaleRadius] = useState<number>(2);
 const [flashTargetFavorites, setFlashTargetFavorites] = useState(true);
 const [flashTargetStaff, setFlashTargetStaff] = useState(true);
 const [flashTargetNearby, setFlashTargetNearby] = useState(true);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [isSendingParking, setIsSendingParking] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleImageUrl, setVehicleImageUrl] = useState('');
  const [parkRadius, setParkRadius] = useState<number>(1);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [manualTargetFavorites, setManualTargetFavorites] = useState(true);
  const [manualTargetStaff, setManualTargetStaff] = useState(true);
  const [manualTargetNearby, setManualTargetNearby] = useState(true);
  const [manualRadius, setManualRadius] = useState<number>(5);
  const [notifHistory, setNotifHistory] = useState<any[]>([]);
 const [modalView, setModalView] = useState<'select' | 'catalog' | 'master' | 'custom'>('select');
 const [selectedCategory, setSelectedCategory] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [customProduct, setCustomProduct] = useState({ name: '', category: 'Ana Yemek', price: 0, prepZone: [] as string[], serviceType: 'prepped' as 'instant' | 'prepped', counterAvailability: 'all' as 'all' | 'source' });

 // Master katalog
 const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
 const [loadingMaster, setLoadingMaster] = useState(false);

 // Stok görseller
 const [stockImages, setStockImages] = useState<{ id: string; url: string; title: string; category: string }[]>([]);
 const [showStockImageModal, setShowStockImageModal] = useState(false);

 // Ürün ekleme öncesi düzenleme modalı
 const [editingCustomRole, setEditingCustomRole] = useState<{ id: string; name: string; icon: string; color: string; } | null>(null);
 const [isUploadingRoleIcon, setIsUploadingRoleIcon] = useState(false);

 const [editBeforeAdd, setEditBeforeAdd] = useState<{
 item: KermesMenuItemData | MasterProduct | null;
 type: 'catalog' | 'master';
 price: number;
 category: string;
 prepZone?: string[];
 serviceType?: 'instant' | 'prepped';
 counterAvailability?: 'all' | 'source';
 } | null>(null);

 // Mevcut ürün düzenleme modalı
 const [editProduct, setEditProduct] = useState<{
 product: KermesProduct;
 price: number;
 costPrice: number;
 discountPrice?: number;
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
 prepZone?: string[];
 serviceType?: 'instant' | 'prepped';
 counterAvailability?: 'all' | 'source';
  optionGroups?: any[];
 } | null>(null);

 const [editProductTab, setEditProductTab] = useState<'genel' | 'detay' | 'secenekler'>('genel');

 // Silme onay modali
 const [deleteConfirm, setDeleteConfirm] = useState<KermesProduct | null>(null);

 // Stok takip
 const [editingStockId, setEditingStockId] = useState<string | null>(null);
 const [editingStockValue, setEditingStockValue] = useState<string>('');
 const [salesHistoryProduct, setSalesHistoryProduct] = useState<KermesProduct | null>(null);
 const [salesHistoryData, setSalesHistoryData] = useState<any[]>([]);
 const [loadingSalesHistory, setLoadingSalesHistory] = useState(false);
 const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);

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
 showToast(t('kermes_bulunamadi'), 'error');
 router.push('/admin/business');
 return;
 }
      const data = { id: kermesDoc.id, ...kermesDoc.data() } as KermesEvent;
      setKermes(data);

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
 date: startD ? (startD as Date).toISOString().split('T')[0] : '',
 endDate: endD ? (endD as Date).toISOString().split('T')[0] : '',
 openingTime: normalizeTimeString(data.openingTime || '') || '',
 closingTime: normalizeTimeString(data.closingTime || '') || '',
 // Konum
 address: data.address || '',
 secondStreetName: data.secondStreetName || '',
 city: data.city || '',
 postalCode: data.postalCode || '',
 country: data.country || '',
 latitude: data.latitude || null,
 longitude: data.longitude || null,
 // Yetkili kişi
 contactName: data.contactName || '',
 contactFirstName: data.contactFirstName || '',
 contactLastName: data.contactLastName || '',
 contactPhone: data.contactPhone || '',
 phoneCountryCode: data.phoneCountryCode || '+49',
 // Sipariş Yöntemleri ve Nakliyat
 isMenuOnly: data.isMenuOnly || false,
 hasTakeaway: data.hasTakeaway !== false,
 hasDineIn: data.hasDineIn ?? true,
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
    currency: data.currency || (data.country === 'Turkiye' || data.country === 'Turkey' ? 'TRY' : 'EUR'),
    pricingMode: data.pricingMode || (data.pricesIncludeKdv !== false ? 'brut' : 'net'),
    foodTaxRate: data.foodTaxRate ?? 7,
    nonFoodTaxRate: data.nonFoodTaxRate ?? 19,
 // Başlık görseli
 headerImage: data.headerImage || '',
 headerImageId: data.headerImageId || '',
 sponsor: data.sponsor || 'none',
 activeBadgeIds: data.activeBadgeIds || [],
 acceptsDonations: data.acceptsDonations || false,
 selectedDonationFundId: data.selectedDonationFundId || '',
 selectedDonationFundName: data.selectedDonationFundName || '',
 isSilaYolu: data.isSilaYolu || false,
 customRoles: (() => {
  const roles = [...(data.customRoles || [])];
  if (!roles.some((r: any) => r.name === 'Park Görevlisi')) {
      roles.unshift({ id: 'role_park_system', name: 'Park Görevlisi', icon: '🅿️', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' });
  }
  if (!roles.some((r: any) => r.name === 'Temizlik Görevlisi')) {
      roles.unshift({ id: 'role_temizlik_system', name: 'Temizlik Görevlisi', icon: '🧹', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' });
  }
  return roles;
 })(),
 });
 setEditFeatures(Array.isArray(data.features) ? data.features : []);
 setEditCustomFeatures(Array.isArray(data.customFeatures) ? data.customFeatures : []);
 setAssignedStaff(Array.isArray(data.assignedStaff) ? data.assignedStaff : []);
 setAssignedDrivers(Array.isArray(data.assignedDrivers) ? data.assignedDrivers : []);
 setAssignedWaiters(Array.isArray(data.assignedWaiters) ? data.assignedWaiters : []);
 setCustomRoleAssignments(data.customRoleAssignments && typeof data.customRoleAssignments === 'object' ? data.customRoleAssignments : {});
 setKermesAdmins(Array.isArray((data as any).kermesAdmins) ? (data as any).kermesAdmins : []);
 // Kermes Admin kontrolu: mevcut admin bu kermes'in admin listesinde mi?
 const loadedKermesAdmins = Array.isArray((data as any).kermesAdmins) ? (data as any).kermesAdmins : [];
 if (adminUid && loadedKermesAdmins.includes(adminUid)) {
 setIsKermesAdminOfThis(true);
 }

 // Bolum tanimlarini yukle (PrepZone hiyerarsisi)
 const rawSections = kermesDoc.data()?.tableSectionsV2;
 if (Array.isArray(rawSections)) {
 setKermesSectionDefs(rawSections.map((s: any) => ({
 name: s.name || '',
 genderRestriction: s.genderRestriction || 'mixed',
 prepZones: Array.isArray(s.prepZones) ? s.prepZones : [],
  hasDineIn: s.hasDineIn !== false,
 })));
 }
 // Mutfak: PrepZone personel atamalarini yukle
 const rawAssignments = kermesDoc.data()?.prepZoneAssignments;
 if (rawAssignments && typeof rawAssignments === 'object') {
 setPrepZoneAssignments(rawAssignments as Record<string, string[]>);
 }

 const productsQuery = query(collection(db, 'kermes_events', kermesId, 'products'), orderBy('name'));
 const productsSnapshot = await getDocs(productsQuery);
 setProducts(productsSnapshot.docs.map(d => {
            const data = d.data();
            let parsedPrepZone: string[] = [];
            if (data.prepZone) {
                if (Array.isArray(data.prepZone)) parsedPrepZone = data.prepZone;
                else parsedPrepZone = [String(data.prepZone)];
            }
            return { id: d.id, ...data, prepZone: parsedPrepZone } as KermesProduct;
        }));
 } catch (error) {
 console.error('Error loading kermes:', error);
 showToast(t('yukleme_hatasi'), 'error');
 } finally {
 setLoading(false);
 }
 }, [kermesId, router, locale]);

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
      
      let finalCats = [];
      if (snapshot.empty) {
        // Eğer Firebase'de kategori yoksa, default'ları kaydet ve göster
        finalCats = [...DEFAULT_CATEGORIES];
        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
          const catName = DEFAULT_CATEGORIES[i];
          const categoryId = catName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_ğüşöçı]/g, '');
          await setDoc(doc(db, 'kermes_categories', categoryId), {
            name: catName, id: categoryId, order: i, createdAt: new Date(),
          });
        }
      } else {
        // Firebase'den gelen kategorileri çevirileriyle beraber al
        finalCats = snapshot.docs.map(d => {
          const name = d.data().name;
          return typeof name === "object" ? getLocalizedText(name, locale) : String(name || "");
        });
      }
      setCategories(finalCats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [locale]);

 useEffect(() => { loadKermes(); loadCategories(); }, [loadKermes, loadCategories]);

 // Auth provider bilgilerini cek
 useEffect(() => {
  fetch('/api/admin/auth-providers')
   .then(r => r.json())
   .then(d => { if (d.providerMap) setAuthProviderMap(d.providerMap); })
   .catch(e => console.error('Auth providers fetch error:', e));
 }, []);

 useEffect(() => {
 const fetchTeamData = async () => {
 const allIds = [...new Set([...assignedStaff, ...assignedDrivers, ...assignedWaiters])];
 if (allIds.length === 0) {
 setAssignedStaffDetails([]);
 setAssignedDriverDetails([]);
 return;
 }
 try {
 const usersMap = new Map<string, any>();
 const adminsMap = new Map<string, any>();
 for (let i = 0; i < allIds.length; i += 10) {
 const chunk = allIds.slice(i, i + 10);
 const qUsers = query(collection(db, 'users'), where(documentId(), 'in', chunk));
 const qAdmins = query(collection(db, 'admins'), where(documentId(), 'in', chunk));
 
 const [snapUsers, snapAdmins] = await Promise.all([getDocs(qUsers), getDocs(qAdmins)]);
 
 snapUsers.docs.forEach(d => usersMap.set(d.id, { id: d.id, ...d.data() }));
 snapAdmins.docs.forEach(d => adminsMap.set(d.id, { id: d.id, ...d.data() }));
 }
 
 // Merge users + admins: users doc has identity (name/email/phone),
 // admins doc has role/shift fields. Merge so neither blanks the other.
 const mergedMap = new Map<string, any>();
 for (const id of allIds) {
 const userDoc = usersMap.get(id);
 const adminDoc = adminsMap.get(id);
 if (userDoc && adminDoc) {
  // Start with adminDoc, overlay non-empty userDoc fields for identity
  const merged = { ...adminDoc };
  for (const [key, val] of Object.entries(userDoc)) {
   if (val !== null && val !== undefined && val !== '') {
    merged[key] = val;
   }
  }
  mergedMap.set(id, merged);
 } else {
  mergedMap.set(id, userDoc || adminDoc || { id });
 }
 }
 const uniqueTeamData = Array.from(mergedMap.values());

 setAssignedStaffDetails(uniqueTeamData);
 setAssignedDriverDetails(uniqueTeamData.filter(u => assignedDrivers.includes(u.id)));
 } catch (error) {
 console.error('Error fetching team data:', error);
 }
 };
 fetchTeamData();
 }, [assignedStaff, assignedDrivers, assignedWaiters]);

 // Kermes özelliklerini ve Rozetleri Firestore'dan yükle
 useEffect(() => {
 const loadFeaturesAndBadges = async () => {
 try {
 const docRef = doc(db, 'settings', 'kermes_features');
 const docSnap = await getDoc(docRef);
 if (docSnap.exists()) {
 const data = docSnap.data();
 const activeFeatures = (Array.isArray(data.features) ? data.features : []).filter((f: KermesFeature) => f.isActive);
 setEventFeatures(activeFeatures);
 }

 // Rozetleri yükle
 const badgesQ = query(collection(db, 'platform_brands'), where('isActive', '==', true));
 const badgesSnap = await getDocs(badgesQ);
 const loadedBadges = badgesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 loadedBadges.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
 setAvailableBadges(loadedBadges);

 // Bagis fonlarini yukle
 const fundsQ = query(collection(db, 'donation_funds'), where('isActive', '==', true));
 const fundsSnap = await getDocs(fundsQ);
 setDonationFunds(fundsSnap.docs.map(d => ({ id: d.id, name: d.data().name, description: d.data().description })));
 } catch (error) {
 console.error('Özellikler veya rozetler yüklenemedi:', error);
 }
 };
 loadFeaturesAndBadges();
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
 console.error(t('stok_gorseller_yuklenemedi'), error);
 }
 };
 loadStockImages();
 }, []);

 const toggleActiveStatus = async () => {
 if (!kermes) return;
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId), { isActive: !kermes.isActive });
 setKermes({ ...kermes, isActive: !kermes.isActive });
 showToast(kermes.isActive ? t('kermes_kapatildi') : t('kermes_aktif_edildi'));
 } catch (error) {
 showToast(t('hata_olustu'), 'error');
 }
 };

 // Personel Arama (super admin dropdown) - hem users hem admins koleksiyonunda
 const searchStaff = async (q: string) => {
 setStaffSearchQuery(q);
 if (q.length < 2) {
 setStaffResults([]);
 return;
 }
 setSearchingStaff(true);
 try {
 const qLower = q.toLowerCase();
 const matchUser = (user: any) => {
 const vals = [
 user.name, user.displayName, user.firstName, user.lastName,
 user.email, user.phone, user.phoneNumber
 ].filter(Boolean).map(v => String(v).toLowerCase());
 return vals.some(val => val.includes(qLower));
 };

 const [snapUsers, snapAdmins] = await Promise.all([
 getDocs(collection(db, 'users')),
 getDocs(collection(db, 'admins')),
 ]);

 const allUsers = new Map<string, any>();
 snapAdmins.docs.forEach(d => allUsers.set(d.id, { id: d.id, _src: 'admin', ...d.data() }));
 snapUsers.docs.forEach(d => {
 if (!allUsers.has(d.id)) allUsers.set(d.id, { id: d.id, _src: 'user', ...d.data() });
 });

 const alreadyInTeam = new Set([...assignedStaff, ...assignedDrivers, ...assignedWaiters]);

 const results = Array.from(allUsers.values())
 .filter(user => matchUser(user) && !alreadyInTeam.has(user.id))
 .slice(0, 8);

 setStaffResults(results);
 } catch (error) {
 console.error('Error searching staff:', error);
 } finally {
 setSearchingStaff(false);
 }
 };

 // Akilli eslestirme: telefon veya email ile users+admins koleksiyonunda ara
 const lookupUserByPhoneOrEmail = async (phone: string, email: string) => {
 const phoneClean = phone.replace(/[^0-9]/g, '');
 if (phoneClean.length < 6 && email.length < 5) {
 setMatchedUser(null);
 return;
 }
 setIsMatchSearching(true);
 try {
 // Hem users hem admins koleksiyonunda ara
 const checks: Promise<any>[] = [];

 if (phoneClean.length >= 6) {
 checks.push(
 getDocs(query(collection(db, 'users'), where('phone', '>=', phoneClean), limit(3))),
 getDocs(query(collection(db, 'admins'), where('phone', '>=', phoneClean), limit(3))),
 getDocs(query(collection(db, 'users'), where('phoneNumber', '>=', `+${phoneClean}`), limit(3))),
 getDocs(query(collection(db, 'admins'), where('phoneNumber', '>=', `+${phoneClean}`), limit(3)))
 );
 }
 if (email.length >= 5) {
 checks.push(
 getDocs(query(collection(db, 'users'), where('email', '==', email.toLowerCase()), limit(1))),
 getDocs(query(collection(db, 'admins'), where('email', '==', email.toLowerCase()), limit(1)))
 );
 }

 const snapshots = await Promise.all(checks);
 const allDocs: any[] = [];
 snapshots.forEach(snap => snap.docs.forEach((d: any) => allDocs.push({ id: d.id, ...d.data() })));

 // Telefon eslesme - tam uyan bul
 let found: any = null;
 if (phoneClean.length >= 6) {
 found = allDocs.find(u => {
 const uPhone = (u.phone || u.phoneNumber || '').replace(/[^0-9]/g, '');
 return uPhone.endsWith(phoneClean) || phoneClean.endsWith(uPhone.slice(-8));
 });
 }
 // Email eslesme
 if (!found && email.length >= 5) {
 found = allDocs.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
 }

 setMatchedUser(found || null);
 } catch (e) {
 console.error('User lookup error:', e);
 setMatchedUser(null);
 } finally {
 setIsMatchSearching(false);
 }
 };

 // Sürücü Arama
 const searchDriver = async (q: string) => {
 setDriverSearchQuery(q);
 if (q.length < 2) {
 setDriverResults([]);
 return;
 }
 setSearchingDriver(true);
 try {
 const usersRef = collection(db, 'admins');
 const snapshot = await getDocs(usersRef);
 const results = snapshot.docs
 .map(doc => ({ id: doc.id, ...doc.data() } as any))
 .filter(user => {
 const qLower = q.toLowerCase();
 const searchValues = [
 user.name, user.displayName, user.firstName, user.lastName, 
 user.email, user.phone, user.phoneNumber
 ].filter(Boolean).map(v => String(v).toLowerCase());
 
 return (user.isDriver === true || user.role === 'driver') && 
 searchValues.some(val => val.includes(qLower)) && 
 !assignedDrivers.includes(user.id);
 })
 .slice(0, 5);
 setDriverResults(results);
 } catch (error) {
 console.error('Error searching drivers:', error);
 } finally {
 setSearchingDriver(false);
 }
 };

 const handleSaveEditPerson = async () => {
 if (!editPersonData?.id) return;
 if (!editPersonData.gender) {
 showToast('Cinsiyet secimi zorunludur', 'error');
 return;
 }
 setIsSavingPerson(true);
 try {
 // Check if user is in 'admins' or 'users' collection
 const adminRef = doc(db, 'admins', editPersonData.id);
 const userRef = doc(db, 'users', editPersonData.id);
 
 const adminSnap = await getDoc(adminRef);
 if (adminSnap.exists()) {
 await updateDoc(adminRef, {
 firstName: editPersonData.firstName || editPersonData.name?.split(' ')[0] || '',
 lastName: editPersonData.lastName || editPersonData.name?.split(' ').slice(1).join(' ') || '',
 displayName: editPersonData.name,
 phone: editPersonData.phone,
 email: editPersonData.email,
 ...(editPersonData.gender ? { gender: editPersonData.gender } : {}),
 });
 } else {
 const userSnap = await getDoc(userRef);
 if (userSnap.exists()) {
 await updateDoc(userRef, {
 firstName: editPersonData.firstName || editPersonData.name?.split(' ')[0] || '',
 lastName: editPersonData.lastName || editPersonData.name?.split(' ').slice(1).join(' ') || '',
 displayName: editPersonData.name,
 name: editPersonData.name,
 phone: editPersonData.phone,
 email: editPersonData.email,
 ...(editPersonData.gender ? { gender: editPersonData.gender } : {}),
 });
 }
 }

 // Update local state directly to reflect changes instantly
 const updateDetails = (list: any[]) => list.map(u => u.id === editPersonData.id ? { ...u, ...editPersonData } : u);
 setAssignedStaffDetails(prev => updateDetails(prev));
 setAssignedDriverDetails(prev => updateDetails(prev));
 
 showToast(t('kaydedildi') || 'Kullanıcı bilgileri güncellendi', 'success');
 setEditPersonData(null);
 } catch (e) {
 console.error(e);
 showToast(t('hata_olustu') || 'Kullanıcı güncellenemedi', 'error');
 } finally {
 setIsSavingPerson(false);
 }
 };
  const handleRemovePersonFromKermes = async (personId: string) => {
    if (!confirm('Bu personeli KERMESTEN çıkarmak istediğinize emin misiniz?')) return;
    
    try {
      const newStaff = assignedStaff.filter(id => id !== personId);
      const newDrivers = assignedDrivers.filter(id => id !== personId);
      const newWaiters = assignedWaiters.filter(id => id !== personId);
      const newKAdmins = kermesAdmins.filter(id => id !== personId);
      
      setAssignedStaff(newStaff);
      setAssignedDrivers(newDrivers);
      setAssignedWaiters(newWaiters);
      setKermesAdmins(newKAdmins);
      
      const newCustomRoles = { ...customRoleAssignments };
      Object.keys(newCustomRoles).forEach(roleId => {
        newCustomRoles[roleId] = newCustomRoles[roleId].filter(id => id !== personId);
      });
      setCustomRoleAssignments(newCustomRoles);

      await saveTeamToDb(newStaff, newDrivers, newWaiters, newKAdmins, newCustomRoles);

      // Deep sync user registry
      const staffRef = doc(db, 'admins', personId);
      const staffSnap = await getDoc(staffRef);
      if (staffSnap.exists()) {
        const curAssignments = staffSnap.data()?.kermesAssignments || [];
        await updateDoc(staffRef, { kermesAssignments: curAssignments.filter((k: any) => k.kermesId !== kermes?.id) });
      }
      
      const userRef = doc(db, 'users', personId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const curAssignments = userSnap.data()?.kermesAssignments || [];
        await updateDoc(userRef, { kermesAssignments: curAssignments.filter((k: any) => k.kermesId !== kermes?.id) });
      }
      
      showToast('Personel başarıyla kermesten çıkarıldı', 'success');
      setEditPersonData(null);
    } catch (e) {
      console.error('Görevden çıkarma hatası', e);
      showToast('Personel çıkarılırken hata oluştu', 'error');
    }
  };

 const handleDeletePersonCompletely = async (personId: string) => {
  const answer = prompt('Bu personeli sistemden TAMAMEN silmek istediğinize emin misiniz?\nİşlemi onaylamak için büyük harflerle EVET yazın:');
  if (answer !== 'EVET') { showToast('Silme işlemi iptal edildi', 'info'); return; }
 
 try {
 // Remove from assignments first
 const newStaff = assignedStaff.filter(id => id !== personId);
 const newDrivers = assignedDrivers.filter(id => id !== personId);
 const newWaiters = assignedWaiters.filter(id => id !== personId);
 const newKAdmins = kermesAdmins.filter(id => id !== personId);
 setAssignedStaff(newStaff);
 setAssignedDrivers(newDrivers);
 setAssignedWaiters(newWaiters);
 setKermesAdmins(newKAdmins);
 
 // First save the team to remove references in Kermes
 await saveTeamToDb(newStaff, newDrivers, newWaiters, newKAdmins);
 
 // Delete from admins database 
 try {
 await deleteDoc(doc(db, 'admins', personId));
 } catch (adminErr) {
 console.error('Admins doc deletion error:', adminErr);
 }
 
 // Also attempt to delete from users just in case
 try {
 await deleteDoc(doc(db, 'users', personId));
 } catch (userErr) {
 console.error('Users doc deletion error (might be restricted):', userErr);
 }
 
 // Firebase Auth'tan da sil
 try {
 await fetch('/api/admin/delete-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid: personId }),
 });
 } catch (authErr) {
 console.error('Firebase Auth deletion error:', authErr);
 }
 
 showToast(t('personel_silindi') || 'Personel sistemden tamamen silindi', 'success');
 setEditPersonData(null);
 } catch (e) {
 console.error(e);
 showToast(t('personel_silinirken_hata') || 'Personel silinirken hata', 'error');
 }
 };

 // Park alanlari icin geocoding helper
 const geocodeParkingLocations = async (locations: any[]) => {
  const results = [];
  for (const loc of locations) {
   if (loc.lat && loc.lng) { results.push(loc); continue; }
   const addrParts = [loc.street, loc.postalCode, loc.city, loc.country || 'Deutschland'].filter(Boolean);
   const q = addrParts.join(', ');
   if (!q.trim()) { results.push(loc); continue; }
   try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
     headers: { 'User-Agent': 'LOKMA-Admin/1.0' },
    });
    const geoData = await geoRes.json();
    if (geoData && geoData.length > 0) {
     console.log(`[PARK-GEO] ${q} -> lat=${geoData[0].lat}, lon=${geoData[0].lon}`);
     results.push({ ...loc, lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) });
    } else {
     results.push(loc);
    }
    // Nominatim rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1100));
   } catch (geoErr) {
    console.error('[PARK-GEO] Geocoding error:', geoErr);
    results.push(loc);
   }
  }
  return results;
 };

 const handleSaveEdits = async () => {
 if (!kermes) return;
 setSaving(true);
 try {
 // Adres degistiyse ve koordinatlar Places ile guncellenmemisse, otomatik geocode yap
 const addressChanged = editForm.address !== (kermes.address || '') || editForm.city !== (kermes.city || '') || editForm.postalCode !== (kermes.postalCode || '');
 const coordsUnchanged = editForm.latitude === (kermes.latitude || null) && editForm.longitude === (kermes.longitude || null);
 if (addressChanged && coordsUnchanged && editForm.address) {
   try {
     const geoQuery = [editForm.address, editForm.postalCode, editForm.city, editForm.country || 'Deutschland'].filter(Boolean).join(', ');
     const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(geoQuery)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`);
     const geoData = await geoRes.json();
     if (geoData.status === 'OK' && geoData.results?.[0]) {
       editForm.latitude = geoData.results[0].geometry.location.lat;
       editForm.longitude = geoData.results[0].geometry.location.lng;
       console.log('[AUTO-GEOCODE] Adres degisti, koordinatlar guncellendi:', editForm.latitude, editForm.longitude);
     }
   } catch (geoErr) {
     console.warn('[AUTO-GEOCODE] Geocode basarisiz, eski koordinatlar korunuyor:', geoErr);
   }
 }
 const updateData: any = {
 // Temel bilgiler
 title: editForm.title,
 titleSecondary: editForm.titleSecondary || null,
 description: editForm.description || null,
 descriptionSecondary: editForm.descriptionSecondary || null,
 secondaryLanguage: editForm.secondaryLanguage || 'de',
 // Saat -- normalize before save
 openingTime: normalizeTimeString(editForm.openingTime || '') || null,
 closingTime: normalizeTimeString(editForm.closingTime || '') || null,
 // Konum
 address: editForm.address || null,
 secondStreetName: editForm.secondStreetName || null,
 city: editForm.city || null,
 postalCode: editForm.postalCode || null,
 country: editForm.country || null,
 latitude: editForm.latitude || null,
 longitude: editForm.longitude || null,
 // Yetkili kişi
 contactName: editForm.contactName || `${editForm.contactFirstName} ${editForm.contactLastName}`.trim() || null,
 contactFirstName: editForm.contactFirstName || null,
 contactLastName: editForm.contactLastName || null,
 contactPhone: editForm.contactPhone || null,
 phoneCountryCode: editForm.phoneCountryCode || '+49',
 // Özellikler
 features: editFeatures,
 customFeatures: editCustomFeatures,
 // Sipariş Yöntemleri ve Nakliyat
 isMenuOnly: editForm.isMenuOnly || false,
 hasTakeaway: editForm.isMenuOnly ? false : editForm.hasTakeaway,
 hasDineIn: editForm.isMenuOnly ? false : editForm.hasDineIn,
 hasDelivery: editForm.isMenuOnly ? false : editForm.hasDelivery,
 deliveryFee: editForm.hasDelivery ? (editForm.deliveryFee || 0) : 0,
 minCartForFreeDelivery: editForm.hasDelivery ? (editForm.minCartForFreeDelivery || 0) : 0,
 minOrderAmount: editForm.hasDelivery ? (editForm.minOrderAmount || 0) : 0,
 // Park alanlari -- geocode ile koordinat ekle
 parkingLocations: await geocodeParkingLocations(editForm.parkingLocations || []),
 generalParkingNote: editForm.generalParkingNote || '',
 // Pfand/Depozito
 hasPfandSystem: editForm.hasPfandSystem,
 pfandAmount: editForm.pfandAmount || 0,
 // KDV
 pricingMode: editForm.pricingMode || 'brut',
 showKdv: editForm.showKdv,
 kdvRate: editForm.kdvRate || 7,
 pricesIncludeKdv: editForm.pricingMode === 'brut',
 // Başlık görseli
 headerImage: editForm.headerImage || null,
 headerImageId: editForm.headerImageId || null,
 sponsor: editForm.sponsor !== 'none' ? editForm.sponsor : null,
 activeBadgeIds: Array.isArray(editForm.activeBadgeIds) ? editForm.activeBadgeIds : [],
 acceptsDonations: editForm.acceptsDonations || false,
 selectedDonationFundId: editForm.selectedDonationFundId || null,
 selectedDonationFundName: editForm.selectedDonationFundName || null,
 customRoles: editForm.customRoles || [],
 // Sila Yolu
 isSilaYolu: editForm.isSilaYolu || false,
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
 // Taze veri ile local state guncelle (stale closure sorununu onler)
 const freshDoc = await getDoc(doc(db, 'kermes_events', kermesId));
 if (freshDoc.exists()) {
 setKermes({ id: freshDoc.id, ...freshDoc.data() } as KermesEvent);
 }
 setIsEditing(false);
 showToast('✅ Kaydedildi');
 } catch (error: any) {
 console.error('Kermes error:', error);
 showToast(`${t('kaydetme_hatasi')}: ${error.message || 'Bilinmeyen hata'}`, 'error');
 } finally {
 setSaving(false);
 }
 };

 const toggleFeature = (featureId: string) => {
 setEditFeatures(prev => prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]);
 };

 const handleDeleteKermes = async () => {
 if (!kermes) return;
 if (!confirm('DİKKAT! Bu Kermes tamamen silinecek. İlgili tüm ürünleri ve verileri kaybolacaktır. Onaylıyor musunuz?')) return;
 setSaving(true);
 try {
 await deleteDoc(doc(db, 'kermes_events', kermesId));
 showToast('✅ Kermes silindi');
 router.push('/admin/kermes');
 } catch (error) {
 console.error('Error deleting kermes:', error);
 showToast('Silinirken hata oluştu', 'error');
 setSaving(false);
 }
 };

 // Yeni kategori ekle - Firebase'e global olarak kaydet
 const handleAddCategory = async () => {
 if (!newCategoryName.trim()) return;
 const catName = newCategoryName.trim();
 if (categories.includes(catName)) {
 showToast(t('bu_kategori_zaten_var'), 'error');
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
 showToast(t('kategori_eklenemedi'), 'error');
 }
 };

 // Katalogdan ürün seç ve düzenleme modalını aç
 const handleSelectFromCatalog = (item: KermesMenuItemData) => {
 if (products.some(p => p.masterSku === item.sku)) {
 showToast(t('zaten_menude'), 'error');
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
 prepZone: editBeforeAdd.prepZone || [],
 serviceType: editBeforeAdd.serviceType || 'prepped',
 counterAvailability: editBeforeAdd.counterAvailability || 'all',
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
 prepZone: editBeforeAdd.prepZone || [],
 serviceType: editBeforeAdd.serviceType || 'prepped',
 counterAvailability: editBeforeAdd.counterAvailability || 'all',
 isCustom: false, sourceType: 'master' as const, barcode: masterItem.barcode || undefined,
 createdAt: new Date(), createdBy: admin?.id,
 };
 const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
 setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
 showToast(`✅ ${masterItem.name} eklendi`);
 }
 setEditBeforeAdd(null);
 } catch (error) {
 showToast(t('hata'), 'error');
 } finally {
 setSaving(false);
 }
 };

 // Master katalogdan ürün seç ve düzenleme modalını aç
 const handleSelectFromMaster = (item: MasterProduct) => {
 if (products.some(p => p.masterSku === item.id)) {
 showToast(t('zaten_menude'), 'error');
 return;
 }
 setEditBeforeAdd({
 item,
 type: 'master',
 price: item.defaultPrice || 0,
 category: item.category || t('diger'),
 });
 };

 // Yeni Personel Olustur (eslesen kullanici yoksa)
 const handleCreateUser = async (type: 'kermes_staff' | 'kermes_driver' | 'kermes_waiter') => {
 if (!kermes?.id) {
 showToast(t('isletme_bilgisi_bulunamadi') || 'Işletme bilgisi bulunamadı.', 'error');
 return;
 }
 
 const form = type === 'kermes_staff' ? newStaffForm : newDriverForm;
 if (!form.name || (!form.phone && !form.email) || !form.gender) {
 showToast(t('isim_telefon_cinsiyet_zorunlu') || 'Isim, telefon veya e-posta ve cinsiyet zorunludur.', 'error');
 return;
 }

 // Rol listesi build
 const roles: string[] = [];
 if (newStaffRoles.isStaff) roles.push('kermes_staff');
 if (newStaffRoles.isDriver) roles.push('kermes_driver');
 if (newStaffRoles.isWaiter) roles.push('kermes_waiter');
 if (newStaffRoles.isKermesAdmin && isSuperAdmin) roles.push('kermes_admin');

 setIsCreatingUser(true);
 try {
 const generatePassword = () => {
 const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%*+';
 let pass = '';
 for(let i=0; i<10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
 pass = pass.replace(/./, chars.charAt(Math.floor(Math.random() * 26) + 26));
 pass = pass.replace(/.$/, chars.charAt(Math.floor(Math.random() * 10) + 52));
 return pass;
 };
 const tempPassword = generatePassword();
 
 const response = await fetch('/api/admin/create-user', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 email: form.email || undefined,
 password: tempPassword,
 displayName: form.name.trim(),
 phone: form.phone.replace(/[^0-9+]/g, ''),
 dialCode: form.countryCode,
 gender: form.gender,
 role: 'admin',
 adminType: type,
 businessId: kermes.id,
 businessName: kermes.title,
 businessType: 'kermes',
 kermesId: kermes.id,
 kermesName: kermes.title,
 kermesRoles: roles,
 isKermesAdmin: newStaffRoles.isKermesAdmin && isSuperAdmin,
 createdBy: (admin as any)?.firebaseUid || 'admin_panel',
 locale: params.locale || 'de',
 assignerName: admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.displayName : undefined,
 assignerEmail: admin?.email,
 assignerRole: admin?.adminType || admin?.role,
 }),
 });

 const data = await response.json();
 if (!response.ok) {
 if (data.error?.includes('zaten kullan') || data.error?.includes('kullan')) {
 throw new Error(
 t('personel_zaten_var_uyari') || 
 'Bu e-posta veya telefon ile kayıtlı kullanıcı var. Arama ile bulup atayın.'
 );
 }
 throw new Error(data.error || t('bir_hata_olustu'));
 }

 const newUid = data.user?.uid || data.uid;
 // Roller guncelle
 const newStaff = newStaffRoles.isStaff ? [...assignedStaff, newUid] : [...assignedStaff];
 const newDrivers = newStaffRoles.isDriver ? [...assignedDrivers, newUid] : [...assignedDrivers];
 const newWaiters = newStaffRoles.isWaiter ? [...assignedWaiters, newUid] : [...assignedWaiters];
 const newKAdmins = (newStaffRoles.isKermesAdmin && isSuperAdmin) ? [...kermesAdmins, newUid] : [...kermesAdmins];

 setAssignedStaff(newStaff);
 setAssignedDrivers(newDrivers);
 setAssignedWaiters(newWaiters);
 setKermesAdmins(newKAdmins);
 saveTeamToDb(newStaff, newDrivers, newWaiters, newKAdmins);

 setIsAddingStaff(false);
 setNewStaffForm({ name: '', phone: '', email: '', countryCode: '+49', gender: '' });
 setMatchedUser(null);
 setNewStaffRoles({ isStaff: true, isDriver: false, isWaiter: false, isKermesAdmin: false });

 // Sifreyi ve email'i hemen goster
 const loginEmail = data.user?.email || form.email || (form.phone ? `${form.countryCode?.replace('+','') || '49'}${form.phone}@lokma.shop` : '');
 setTimeout(() => {
   alert(`Personel başarıyla oluşturuldu!\n\nLütfen giriş bilgilerini kopyalayıp personele iletin:\n\nLogin/Benutzername: ${loginEmail}\nŞifre/Passwort: ${tempPassword}\nLink: https://lokma.web.app/kermes-login`);
 }, 500);

 showToast(t('personel_olusturuldu') || 'Personel oluşturuldu ve atandı', 'success');
 } catch (error: any) {
 console.error('Create user error:', error);
 showToast(error.message, 'error');
 } finally {
 setIsCreatingUser(false);
 }
 };

 // Mevcut kullaniciyi kermes personeli olarak ata (eslestirme butonu)
 const handleAssignExistingUser = async (user: any) => {
 if (!kermes?.id || !user?.id) return;
 setIsCreatingUser(true);
 try {
 const newStaff = newStaffRoles.isStaff && !assignedStaff.includes(user.id) ? [...assignedStaff, user.id] : [...assignedStaff];
 const newDrivers = newStaffRoles.isDriver && !assignedDrivers.includes(user.id) ? [...assignedDrivers, user.id] : [...assignedDrivers];
 const newWaiters = newStaffRoles.isWaiter && !assignedWaiters.includes(user.id) ? [...assignedWaiters, user.id] : [...assignedWaiters];
 const newKAdmins = (newStaffRoles.isKermesAdmin && isSuperAdmin && !kermesAdmins.includes(user.id)) ? [...kermesAdmins, user.id] : [...kermesAdmins];

 setAssignedStaff(newStaff);
 setAssignedDrivers(newDrivers);
 setAssignedWaiters(newWaiters);
 setKermesAdmins(newKAdmins);
 await saveTeamToDb(newStaff, newDrivers, newWaiters, newKAdmins);

 // Firestore'da kullaniciya kermes atamasi ekle
 const userRef = doc(db, 'users', user.id);
 const adminRef = doc(db, 'admins', user.id);
 const roles: string[] = [];
 if (newStaffRoles.isStaff) roles.push('personel');
 if (newStaffRoles.isDriver) roles.push('surucu');
 if (newStaffRoles.isWaiter) roles.push('garson');
 if (newStaffRoles.isKermesAdmin && isSuperAdmin) roles.push('kermes_admin');

 const assignmentData = {
 kermesAssignments: [{
 kermesId: kermes.id,
 kermesTitle: kermes.title,
 roles,
 assignedAt: new Date(),
 assignedBy: admin?.id || 'unknown',
 }]
 };
 // Users koleksiyonunda guncelle (varsa)
 const userSnap = await getDoc(userRef);
 if (userSnap.exists()) {
 const existing = userSnap.data().kermesAssignments || [];
 const filtered = existing.filter((a: any) => a.kermesId !== kermes.id);
 const updateData: any = { kermesAssignments: [...filtered, assignmentData.kermesAssignments[0]] };
 if (newStaffForm.gender && !userSnap.data().gender) updateData.gender = newStaffForm.gender;
 await updateDoc(userRef, updateData);
 }
 // Admins koleksiyonunda guncelle (varsa)
 const adminSnap = await getDoc(adminRef);
 if (adminSnap.exists()) {
 const existing = adminSnap.data().kermesAssignments || [];
 const filtered = existing.filter((a: any) => a.kermesId !== kermes.id);
 const updateData: any = { kermesAssignments: [...filtered, assignmentData.kermesAssignments[0]] };
 if (newStaffForm.gender && !adminSnap.data().gender) updateData.gender = newStaffForm.gender;
 await updateDoc(adminRef, updateData);
 }

 // Bildirim - atama emaili gonder
 try {
 await fetch('/api/kermes/notify-assignment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userId: user.id,
 userName: user.displayName || user.name || user.firstName || '',
 userEmail: user.email || '',
 userPhone: user.phone || user.phoneNumber || '',
 kermesId: kermes.id,
 kermesTitle: kermes.title,
 roles,
 isKermesAdmin: newStaffRoles.isKermesAdmin && isSuperAdmin,
 assignerName: admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() : 'Admin',
 locale: params.locale || 'de',
 }),
 });
 } catch (notifErr) {
 console.error('Notification error (non-blocking):', notifErr);
 }

 setIsAddingStaff(false);
 setNewStaffForm({ name: '', phone: '', email: '', countryCode: '+49', gender: '' });
 setMatchedUser(null);
 setNewStaffRoles({ isStaff: true, isDriver: false, isWaiter: false, isKermesAdmin: false });
 showToast(`${user.displayName || user.name || ''} kermes kadrosuna eklendi`, 'success');
 } catch (error: any) {
 console.error('Assign existing user error:', error);
 showToast(error.message || 'Atama hatası', 'error');
 } finally {
 setIsCreatingUser(false);
 }
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
 discountPrice: editProduct.discountPrice || null,
 category: editProduct.category,
 unit: editProduct.unit || t('adet'),
 secondaryName: editProduct.secondaryName || null,
 description: editProduct.description || null,
 detailedDescription: editProduct.detailedDescription || null,
 allergens: Array.isArray(editProduct.allergens) ? editProduct.allergens : [],
 ingredients: Array.isArray(editProduct.ingredients) ? editProduct.ingredients : [],
 imageUrls: editProduct.imageUrls || [],
 prepZone: editProduct.prepZone || [],
 serviceType: editProduct.serviceType || 'prepped',
 counterAvailability: editProduct.counterAvailability || 'all',
  optionGroups: editProduct.optionGroups || [],
 updatedAt: new Date(),
 };
 await updateDoc(productRef, updateData);
 // Local state güncelle
 setProducts(products.map(p =>
 p.id === editProduct.product.id
 ? { ...p, ...updateData }
 : p
 ));
 showToast(`✅ ${getLocalizedText(editProduct.product.name, locale)} güncellendi`);
 setEditProduct(null);
 } catch (error) {
 console.error('Error updating product:', error);
 showToast(t('guncelleme_hatasi'), 'error');
 } finally {
 setSaving(false);
 }
 };

 // ... we need to map the first section as well
 const handleCreateCustom = async () => {
 if (!customProduct.name.trim() || customProduct.price <= 0) {
 showToast(t('urun_adi_ve_fiyat_gerekli'), 'error');
 return;
 }
 setSaving(true);
 try {
 const sku = `CUSTOM-${kermesId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
 const productData = {
 masterSku: sku, name: customProduct.name.trim(), category: customProduct.category,
 price: customProduct.price, isAvailable: true, isCustom: true, sourceType: 'custom',
 prepZone: customProduct.prepZone || [],
 serviceType: customProduct.serviceType || 'prepped',
 counterAvailability: customProduct.counterAvailability || 'all',
 createdAt: new Date(), createdBy: admin?.id,
 };
 const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'products'), productData);
 setProducts([...products, { id: docRef.id, ...productData } as KermesProduct]);
 setCustomProduct({ name: '', category: 'Ana Yemek', price: 0, prepZone: [], serviceType: 'prepped', counterAvailability: 'all' });
 setShowAddModal(false);
 showToast(`✅ "${customProduct.name}" oluşturuldu`);
 } catch (error) {
 showToast(t('hata'), 'error');
 } finally {
 setSaving(false);
 }
 };

 const touchKermesTimestamp = async () => {
    try {
      const { serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'kermes_events', kermesId), { updatedAt: serverTimestamp() });
    } catch(e) { console.error(e); }
  };

  const handleToggleAvailability = async (product: KermesProduct) => {
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), { isAvailable: !product.isAvailable });
 setProducts(products.map(p => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p));
    await touchKermesTimestamp();
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Stok: Hizli artir/azalt
 const handleStockAdjust = async (product: KermesProduct, delta: number) => {
 const newStock = Math.max(0, (product.currentStock || 0) + delta);
 const updatePayload: Record<string, any> = {
 currentStock: newStock,
 lastStockUpdateAt: new Date(),
 lastStockUpdateBy: admin?.id || 'admin',
 };
 if (newStock <= 0) {
 updatePayload.isAvailable = false;
 } else if (!product.isAvailable && newStock > 0) {
 updatePayload.isAvailable = true;
 }
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), updatePayload);
 setProducts(products.map(p => p.id === product.id ? { ...p, currentStock: newStock, isAvailable: newStock > 0 ? (product.isAvailable || newStock > 0) : false, ...updatePayload } : p));
    await touchKermesTimestamp();
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Stok: Direkt sayi girisi
 const handleStockSet = async (product: KermesProduct, value: number) => {
 const newStock = Math.max(0, value);
 const updatePayload: Record<string, any> = {
 currentStock: newStock,
 lastStockUpdateAt: new Date(),
 lastStockUpdateBy: admin?.id || 'admin',
 };
 if (newStock <= 0) updatePayload.isAvailable = false;
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), updatePayload);
 setProducts(products.map(p => p.id === product.id ? { ...p, ...updatePayload } : p));
 setEditingStockId(null);
    await touchKermesTimestamp();
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Stok: Tukendi (sifirla)
 const handleMarkSoldOut = async (product: KermesProduct) => {
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), {
 currentStock: 0, isAvailable: false,
 lastStockUpdateAt: new Date(), lastStockUpdateBy: admin?.id || 'admin',
 });
 setProducts(products.map(p => p.id === product.id ? { ...p, currentStock: 0, isAvailable: false } : p));
 showToast(`${product.name}: Tukendi olarak isaretlendi`);
    await touchKermesTimestamp();
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Stok: Toggle stockEnabled
 const handleToggleStockEnabled = async (product: KermesProduct) => {
 const newEnabled = !product.stockEnabled;
 const updatePayload: Record<string, any> = { stockEnabled: newEnabled };
 if (newEnabled && !product.initialStock) {
 updatePayload.initialStock = 0;
 updatePayload.currentStock = 0;
 updatePayload.lowStockThreshold = 5;
 }
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), updatePayload);
 setProducts(products.map(p => p.id === product.id ? { ...p, ...updatePayload, stockEnabled: newEnabled } : p));
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Stok: Baslangic stok ayarla
 const handleSetInitialStock = async (product: KermesProduct, value: number) => {
 try {
 await updateDoc(doc(db, 'kermes_events', kermesId, 'products', product.id), {
 initialStock: value, currentStock: value, stockEnabled: true,
 lowStockThreshold: product.lowStockThreshold || 5,
 lastStockUpdateAt: new Date(), lastStockUpdateBy: admin?.id || 'admin',
 });
 setProducts(products.map(p => p.id === product.id ? { ...p, initialStock: value, currentStock: value, stockEnabled: true } : p));
 showToast(`${product.name}: Baslangic stok ${value} olarak ayarlandi`);
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Stok: Gun basla - tum urunleri initialStock'a resetle
 const handleDayStart = async () => {
 const stockProducts = products.filter(p => p.stockEnabled && p.initialStock && p.initialStock > 0);
 if (stockProducts.length === 0) {
 showToast('Stok takibi aktif urun yok');
 return;
 }
 try {
 const promises = stockProducts.map(p =>
 updateDoc(doc(db, 'kermes_events', kermesId, 'products', p.id), {
 currentStock: p.initialStock, isAvailable: true,
 lastStockUpdateAt: new Date(), lastStockUpdateBy: admin?.id || 'admin',
 })
 );
 await Promise.all(promises);
 setProducts(products.map(p => {
 if (p.stockEnabled && p.initialStock && p.initialStock > 0) {
 return { ...p, currentStock: p.initialStock, isAvailable: true };
 }
 return p;
 }));
 showToast(`${stockProducts.length} urunun stogu sifirlandi (Gun Basla)`);
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 // Satis gecmisi yukle
 const handleLoadSalesHistory = async (product: KermesProduct) => {
 setSalesHistoryProduct(product);
 setLoadingSalesHistory(true);
 setSalesHistoryData([]);
 try {
 // Root-level koleksiyondan tum kermesler boyunca bu urunun satislarini cek
 const salesQuery = await getDocs(
 query(
 collection(db, 'kermes_product_sales'),
 where('productName', '==', typeof product.name === 'object' ? (product.name as any).tr || Object.values(product.name)[0] : product.name),
 orderBy('soldAt', 'desc'),
 limit(500)
 )
 );
 const sales = salesQuery.docs.map(d => ({ id: d.id, ...d.data() }));
 setSalesHistoryData(sales);
 } catch (error) {
 console.error('Satis gecmisi yuklenemedi:', error);
 // Fallback: sadece bu kermes'in satislarini cek
 try {
 const fallbackQuery = await getDocs(
 query(
 collection(db, 'kermes_events', kermesId, 'product_sales'),
 where('productId', '==', product.id),
 orderBy('soldAt', 'desc'),
 limit(200)
 )
 );
 setSalesHistoryData(fallbackQuery.docs.map(d => ({ id: d.id, ...d.data() })));
 } catch (err2) {
 console.error('Fallback satis gecmisi de yuklenemedi:', err2);
 }
 } finally {
 setLoadingSalesHistory(false);
 }
 };

 // Silme butonuna basinca modal ac
 const handleSendFlashSale = async () => {
   setIsSendingFlashSale(true);
   try {
     const discountedItems = products.filter(p => p.discountPrice && p.discountPrice! > 0 && !p.isSoldOut && p.isAvailable);
     if (discountedItems.length === 0) {
       toast.error(t('hata_olustu') || 'İndirimde ürün bulunmuyor.');
       return;
     }
     
     const response = await fetch('/api/notifications/kermes-flash-sale', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         kermesId,
         kermesTitle: kermes.title,
         targetRadiusKm: flashSaleRadius,
         kermesLat: kermes.latitude || null,
         kermesLng: kermes.longitude || null,
         targetGroups: {
           favorites: flashTargetFavorites,
           staff: flashTargetStaff,
           nearby: flashTargetNearby,
         },
         discountedItems: discountedItems.map(p => ({
           id: p.id,
           name: getLocalizedText(p.name, locale),
           price: p.price,
           discountPrice: p.discountPrice,
           image: p.imageUrls?.[0] || p.imageUrl || null
         })),
       }),
     });
     
     const data = await response.json();
     if (data.success) {
       toast.success(`Bildirim başarıyla ${data.sentCount} kişiye gönderildi!`);
       setShowFlashSaleModal(false);
     } else {
       toast.error(data.error || t('hata_olustu'));
     }
   } catch (error) {
     toast.error(String(error));
   } finally {
     setIsSendingFlashSale(false);
   }
 };


  // ── Park Anons handler ──
  const handleSendParkingAnnouncement = async () => {
    if (!vehiclePlate.trim()) {
      toast.error('Plaka bilgisi zorunlu.');
      return;
    }
    setIsSendingParking(true);
    try {
      const plateUpper = vehiclePlate.trim().toUpperCase();
      // Dogru gramer: "Siyah Mercedes (HS QT 3410) plakali arac sahibi..."
      let vehicleInfo = '';
      if (vehicleColor.trim()) vehicleInfo += vehicleColor.trim() + ' ';
      if (vehicleBrand.trim()) vehicleInfo += vehicleBrand.trim() + ' ';
      vehicleInfo += `(${plateUpper})`;
      const message = `ACIL PARK ANONSU: ${vehicleInfo} plakalı araç sahibi, lütfen aracınızı acilen çekiniz!`;
      console.log('[PARKING-PUSH] Sending:', { kermesId, message, kermesLat: kermes.latitude, kermesLng: kermes.longitude });
      const response = await fetch('/api/notifications/kermes-parking-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kermesId,
          kermesTitle: kermes.title,
          message,
          vehiclePlate: plateUpper,
          vehicleColor: vehicleColor.trim(),
          vehicleBrand: vehicleBrand.trim(),
          vehicleImageUrl: vehicleImageUrl || null,
          targetRadiusKm: parkRadius,
          kermesLat: kermes.latitude || null,
          kermesLng: kermes.longitude || null,
          targetGroups: { favorites: true, staff: true, nearby: true }, // Park anonsu her zaman personellere ve favorilere gitmeli
        }),
      });
      console.log('[PARKING-PUSH] Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PARKING-PUSH] Error response:', errorText);
        toast.error(`API hatasi: ${response.status}`);
      } else {
        const data = await response.json();
        console.log('[PARKING-PUSH] Result:', data);
        if (data.success) {
          const cnt = data.sentCount || 0;
          toast.success(`Acil arac anonsu ${cnt} kisiye gonderildi!`);
        } else {
          toast.error(data.error || 'Gonderilemedi');
        }
      }
      // Her durumda modali kapat ve formu sifirla
      setShowParkingModal(false);
      setVehiclePlate(''); setVehicleColor(''); setVehicleBrand(''); setVehicleImageUrl('');
    } catch (error) {
      console.error('[PARKING-PUSH] Exception:', error);
      toast.error(String(error));
      setShowParkingModal(false);
    } finally {
      setIsSendingParking(false);
    }
  };

  // ── Manuel Bildirim handler ──
  const handleSendManualNotification = async () => {
    if (!manualTitle.trim() || !manualBody.trim()) {
      toast.error('Baslik ve icerik bos birakilamaz.');
      return;
    }
    setIsSendingManual(true);
    try {
      const response = await fetch('/api/notifications/kermes-manual-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kermesId,
          kermesTitle: kermes.title,
          title: manualTitle.trim(),
          body: manualBody.trim(),
          targetRadiusKm: manualRadius,
          kermesLat: kermes.latitude || null,
          kermesLng: kermes.longitude || null,
          targetGroups: { favorites: manualTargetFavorites, staff: manualTargetStaff, nearby: manualTargetNearby },
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Bildirim gonderildi! (${data.sentCount} kisi)`);
        setShowManualModal(false);
        setManualTitle('');
        setManualBody('');
      } else {
        toast.error(data.error || 'Gönderilemedi');
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsSendingManual(false);
    }
  };

  // ── Bildirim Gecmisi yukle ──
  const loadNotifHistory = async () => {
    try {
      const { getFirestore } = await import('firebase/firestore');
      const firestore = getFirestore();
      const histRef = collection(firestore, 'kermes_events', kermesId, 'notificationHistory');
      const q = query(histRef, orderBy('sentAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      setNotifHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.warn('notifHistory load error:', e);
    }
  };
 const handleDeleteProduct = (product: KermesProduct) => {
 setDeleteConfirm(product);
 };

 // Silme onaylandığında
 const handleConfirmDelete = async () => {
 if (!deleteConfirm) return;
 try {
 await deleteDoc(doc(db, 'kermes_events', kermesId, 'products', deleteConfirm.id));
 setProducts(products.filter(p => p.id !== deleteConfirm.id));
 showToast(t('kaldirildi'));
 setDeleteConfirm(null);
 } catch (error) {
 showToast(t('hata'), 'error');
 }
 };

 const filteredCatalog = Object.values(KERMES_MENU_CATALOG).filter(item => {
 const matchesCat = !selectedCategory || item.category === selectedCategory;
 const matchesSearch = !searchQuery || getLocalizedText(item.name, locale).toLowerCase().includes(searchQuery.toLowerCase());
 return matchesCat && matchesSearch;
 });

 const filteredMaster = masterProducts.filter(item => {
 const matchesSearch = !searchQuery || getLocalizedText(item.name, locale).toLowerCase().includes(searchQuery.toLowerCase()) ||
 (item.barcode && item.barcode.includes(searchQuery));
 return matchesSearch;
 });

 const productsByCategory = products.reduce((acc, p) => {
 const cat = (typeof p.category === 'object' ? getLocalizedText(p.category, locale) : p.category) || t('diger');
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
  if (!f) return featureId;
  try { return f.labelKey ? t(f.labelKey) : f.label; } catch { return f.label; }
 };
  const getFeatureIcon = (featureId: string) => {
  const f = eventFeatures.find(ef => ef.id === featureId);
  return f?.icon || '';
  };

 if (adminLoading || loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
 </div>
 );
 }

 if (!kermes) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <p className="text-foreground">{t('kermes_bulunamadi')}</p>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background p-6">
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
 <Link href="/admin/kermes" className="text-muted-foreground hover:text-white">← Geri</Link>
 <div>
 <h1 className="text-xl font-bold text-foreground flex items-center gap-2">🎪 {kermes.title}</h1>
 {kermes.organizationName && <p className="text-muted-foreground text-sm">🕌 {kermes.organizationName}</p>}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button 
 onClick={() => { setActiveTab('masalar'); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight/2, behavior: 'smooth' }), 100); }}
 className="px-4 py-2 mr-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg shadow-sm font-bold text-sm flex items-center gap-2 transform transition hover:scale-105"
 >
 🍳 Mutfak & Expo (KDS)
 </button>
 {kermes.sponsor === 'tuna' && <span className="px-2 py-1 bg-blue-600/30 text-blue-800 dark:text-blue-400 rounded text-xs">🐟 TUNA</span>}
 {kermes.sponsor === 'akdeniz_toros' && <span className="px-2 py-1 bg-amber-600/30 text-amber-800 dark:text-amber-400 rounded text-xs">🏔️ TOROS</span>}
 <button onClick={toggleActiveStatus}
 className={`px-3 py-1 rounded-lg text-sm font-medium ${kermes.isActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
 {kermes.isActive ? t('aktif') : t('kapali')}
 </button>
 {admin?.role === 'super_admin' && (
 <button onClick={handleDeleteKermes} disabled={saving} className="px-3 py-1 bg-red-800/80 hover:bg-red-700 text-white rounded-lg text-sm">
 🗑️ Sil
 </button>
 )}
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-2 mb-6 bg-card p-1 rounded-xl w-fit">
 <button onClick={() => setActiveTab('bilgi')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'bilgi' ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
 📋 Bilgiler
 </button>
 <button onClick={() => setActiveTab('menu')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'menu' ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
 {t('menu')}{products.length})
 </button>
 <button onClick={() => setActiveTab('personel')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'personel' ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
 👥 Personel {assignedStaffDetails.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-pink-500/30 text-pink-300 rounded-full text-xs">{assignedStaffDetails.length}</span>}
 </button>
 <button onClick={() => setActiveTab('vardiya')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'vardiya' ? 'bg-cyan-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
 📅 Vardiya Planı
 </button>
 <button onClick={() => setActiveTab('gorevler')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'gorevler' ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
 🛠️ Görevler
 </button>
 <button onClick={() => setActiveTab('mutfak')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'mutfak' ? 'bg-orange-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
 Mutfak {kermesSectionDefs.some(s => (s.prepZones || []).length > 0) && <span className="ml-1 px-1.5 py-0.5 bg-orange-500/30 text-orange-300 rounded-full text-xs">{kermesSectionDefs.reduce((acc, s) => acc + (s.prepZones || []).length, 0)}</span>}
 </button>
        <button onClick={() => setActiveTab('masalar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'masalar' ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
          Masalar ve Bölümler
        </button>
        <button onClick={() => setActiveTab('siparisler')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'siparisler' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
          Siparisler
        </button>
        {(isSuperAdmin || isKermesAdminOfThis) && (
          <button onClick={() => setActiveTab('tahsilat')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'tahsilat' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
            Tahsilat
          </button>
        )}
        {(isSuperAdmin || isKermesAdminOfThis) && (
          <>
            <button onClick={() => setActiveTab('tedarik')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'tedarik' ? 'bg-rose-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
              <span className="material-symbols-outlined text-base align-middle mr-1">conveyor_belt</span>Tedarik
            </button>
            <button onClick={() => setActiveTab('bildirimler')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'bildirimler' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-white'}`}>
              <span className="material-symbols-outlined text-base align-middle mr-1">notifications</span>Bildirimler
            </button>
          </>
        )}
      </div>

 {/* Tab Content - Bilgi */}
 {activeTab === 'bilgi' && (
 <div className="space-y-4">

  {/* Sub-Tab Navigation */}
  <div className="bg-card rounded-xl p-1.5 flex gap-1 overflow-x-auto">
   {([{k:'genel' as const,l:'Genel Ayarlar',c:'bg-pink-600'},{k:'marka' as const,l:'Marka & Sertifika',c:'bg-purple-600'},{k:'ozellikler' as const,l:'Ozellikler',c:'bg-amber-600'},{k:'teslimat' as const,l:'Siparis & Teslimat',c:'bg-blue-600'},{k:'fiyat' as const,l: t('fiyat_ayarlari') || 'Fiyat Ayarlari',c:'bg-emerald-600'},{k:'imkanlar' as const,l:'Park Ayarlari',c:'bg-teal-600'}]).map(t=>(
    <button key={t.k} onClick={()=>setBilgiSubTab(t.k)} className={`px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0 ${bilgiSubTab===t.k?t.c+' text-white shadow':'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>{t.l}</button>
   ))}
   <div className="ml-auto flex items-center gap-2 flex-shrink-0">
    {!isEditing ? (
    <button onClick={() => {
    const startD = kermes?.date?.toDate?.() || kermes?.startDate?.toDate?.() || (kermes?.date?.seconds ? new Date(kermes.date.seconds * 1000) : (kermes?.startDate?.seconds ? new Date(kermes.startDate.seconds * 1000) : null));
    const endD = kermes?.endDate?.toDate?.() || (kermes?.endDate?.seconds ? new Date(kermes.endDate.seconds * 1000) : null);
    setEditForm({
    title: kermes?.title || '', titleSecondary: kermes?.titleSecondary || '',
    description: kermes?.description || '', descriptionSecondary: kermes?.descriptionSecondary || '',
    secondaryLanguage: kermes?.secondaryLanguage || 'de',
    date: startD ? (startD as Date).toISOString().split('T')[0] : '',
    endDate: endD ? (endD as Date).toISOString().split('T')[0] : '',
    openingTime: normalizeTimeString(kermes?.openingTime || '') || '',
    closingTime: normalizeTimeString(kermes?.closingTime || '') || '',
    address: kermes?.address || '', secondStreetName: kermes?.secondStreetName || '',
    city: kermes?.city || '', postalCode: kermes?.postalCode || '',
    country: kermes?.country || '',
    contactName: kermes?.contactName || '', contactFirstName: kermes?.contactFirstName || '',
    contactLastName: kermes?.contactLastName || '', contactPhone: kermes?.contactPhone || '',
    phoneCountryCode: kermes?.phoneCountryCode || '+49',
    isMenuOnly: kermes?.isMenuOnly || false,
    hasTakeaway: kermes?.hasTakeaway !== false, hasDineIn: kermes?.hasDineIn ?? true,
    hasDelivery: kermes?.hasDelivery || false,
    deliveryFee: kermes?.deliveryFee || 0, minCartForFreeDelivery: kermes?.minCartForFreeDelivery || 0,
    minOrderAmount: kermes?.minOrderAmount || 0,
    parkingLocations: kermes?.parkingLocations || [], generalParkingNote: kermes?.generalParkingNote || '',
    hasPfandSystem: kermes?.hasPfandSystem || false, pfandAmount: kermes?.pfandAmount || 0.25,
    showKdv: kermes?.showKdv || false, kdvRate: kermes?.kdvRate || 7,
    currency: kermes?.currency || (kermes?.country === 'Turkiye' || kermes?.country === 'Turkey' ? 'TRY' : 'EUR'),
    pricingMode: (kermes as any)?.pricingMode || (kermes?.pricesIncludeKdv !== false ? 'brut' : 'net'),
    foodTaxRate: (kermes as any)?.foodTaxRate ?? 7,
    nonFoodTaxRate: (kermes as any)?.nonFoodTaxRate ?? 19,
    pricesIncludeKdv: kermes?.pricesIncludeKdv !== false,
    headerImage: kermes?.headerImage || '', headerImageId: kermes?.headerImageId || '',
    sponsor: kermes?.sponsor || 'none', activeBadgeIds: kermes?.activeBadgeIds || [],
    acceptsDonations: kermes?.acceptsDonations || false,
    selectedDonationFundId: kermes?.selectedDonationFundId || '',
    selectedDonationFundName: kermes?.selectedDonationFundName || '',
    latitude: kermes?.latitude || null, longitude: kermes?.longitude || null,
    customRoles: kermes?.customRoles || [],
    isSilaYolu: (kermes as any)?.isSilaYolu || false,
    });
    setEditFeatures(kermes?.features || []);
    setEditCustomFeatures(kermes?.customFeatures || []);
    setIsEditing(true);
    }} className="px-3 py-1.5 bg-gray-700 text-gray-100 rounded-lg text-xs hover:bg-gray-600 transition border border-gray-600">
    {t('duzenle') || 'Duzenle'}
    </button>
    ) : (
    <>
    <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 bg-gray-600 text-gray-300 rounded-lg text-xs hover:bg-gray-500 transition border border-gray-500">{t('cancel_btn')}</button>
    <button onClick={handleSaveEdits} disabled={saving} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-500 transition font-semibold disabled:opacity-50">{saving ? '...' : t('kaydet')}</button>
    </>
    )}
   </div>
  </div>

 {/* TAB: Genel Ayarlar */}
 {bilgiSubTab === 'genel' && (
 <>
 {/* Main Info Card */}
 <div className="bg-card rounded-xl p-6">
  <h3 className="text-foreground font-bold mb-4">Kermes Bilgileri</h3>

 {isEditing ? (
 <div className="space-y-4">
 {/* Temel Bilgiler */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('kermes_adi_turkce')}</label>
 <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('kermes_adi_i_kincil_dil')}</label>
 <input type="text" value={editForm.titleSecondary} onChange={(e) => setEditForm({ ...editForm, titleSecondary: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow"
 placeholder="z.B. Ramadan Kermes 2026" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('aciklama_turkce')}</label>
 <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" rows={2} />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('aciklama_i_kincil_dil')}</label>
 <textarea value={editForm.descriptionSecondary} onChange={(e) => setEditForm({ ...editForm, descriptionSecondary: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" rows={2} />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('baslangic_tarihi')}</label>
 <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('bitis_tarihi')}</label>
 <input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('acilis_saati')}</label>
 <input type="time" value={editForm.openingTime} onChange={(e) => setEditForm({ ...editForm, openingTime: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('kapanis_saati')}</label>
 <input type="time" value={editForm.closingTime} onChange={(e) => setEditForm({ ...editForm, closingTime: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 </div>

 {/* Konum Bilgileri */}
 <div className="pt-4 border-t border-border">
 <h4 className="text-foreground font-medium mb-3">📍 Konum Bilgileri</h4>
 
 {/* Dernek Sec Button */}
 <div className="mb-4">
 <button
 type="button"
 onClick={() => setShowOrgSearchModal(true)}
 className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 transition shadow-lg flex items-center gap-2"
 >
 <span>🕌</span>
 <span>Dernek Sec</span>
 </button>
 <p className="text-xs text-muted-foreground/80 mt-1">
 VIKZ derneklerinden birini secerek konum bilgilerini otomatik doldurabilirsiniz
 </p>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="md:col-span-2">
 <label className="text-muted-foreground text-xs block mb-1">Ana Adres <span className="text-blue-800 dark:text-blue-400">{t('google_ile_ara')}</span></label>
 <div className="flex gap-2">
 <div className="flex-1">
 <PlacesAutocomplete
 value={editForm.address || ''}
 onChange={(value) => setEditForm({ ...editForm, address: value })}
 onPlaceSelect={(place) => {
 // Ana adresi ve diğer bilgileri otomatik doldur
 setEditForm({
 ...editForm,
 address: place.street || place.formattedAddress || editForm.address,
 city: place.city || editForm.city,
 postalCode: place.postalCode || editForm.postalCode,
 country: place.country || editForm.country,
 latitude: place.lat || editForm.latitude,
 longitude: place.lng || editForm.longitude
 });
 }}
 placeholder={t('orn_hauptstra_e_10_koln')}
 className="text-sm"
 />
 </div>
 <button
 type="button"
 onClick={() => setMainMapOpen(true)}
 className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg border border-gray-600 transition flex items-center gap-2 flex-shrink-0"
 title="Haritada Koordinat İşaretle"
 >
 <span>📍</span>
 </button>
 </div>
 {(editForm.latitude && editForm.longitude) && (
 <p className="text-xs text-green-400 mt-1">Koordinatlar ayarlandı: {editForm.latitude.toFixed(4)}, {editForm.longitude.toFixed(4)}</p>
 )}
 </div>
 <div className="md:col-span-2">
 <label className="text-muted-foreground text-xs block mb-1">{t('2_sokak_adi_opsiyonel')}</label>
 <input type="text" value={editForm.secondStreetName} onChange={(e) => setEditForm({ ...editForm, secondStreetName: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow"
 placeholder="İkinci sokak adresi varsa girin..." />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('sehir')}</label>
 <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('postal_code')}</label>
 <input type="text" value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('ulke')}</label>
 <input type="text" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 </div>
 </div>
 {/* Kurumsal Ayarlar (Pfand & KDV) */}
 <div className="pt-4 border-t border-border">
 <h4 className="text-foreground font-medium mb-3">🏢 {t('kurumsal_ayarlar') || 'Kurumsal Ayarlar'}</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Pfand Sistemi */}
 <div className="bg-card shadow-sm p-4 rounded-xl border border-border">
 <div className="flex items-center justify-between mb-2">
 <span className="text-foreground font-medium">🍶 Pfand (Depozito) Sistemi</span>
 <label className="relative inline-flex items-center cursor-pointer">
 <input type="checkbox" checked={editForm.hasPfandSystem} onChange={(e) => setEditForm({ ...editForm, hasPfandSystem: e.target.checked })} className="sr-only peer" />
 <div className="w-11 h-6 bg-slate-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background dark:after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 transition-colors"></div>
 </label>
 </div>
 {editForm.hasPfandSystem && (
 <div className="mt-3">
 <label className="text-muted-foreground text-xs block mb-1.5">{t('pfand_ucreti')}</label>
 <input type="number" step="0.01" value={editForm.pfandAmount} onChange={(e) => setEditForm({ ...editForm, pfandAmount: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-shadow" />
 </div>
 )}
 </div>

 {/* KDV Sistemi */}
 <div className="bg-card shadow-sm p-4 rounded-xl border border-border">
 <div className="flex items-center justify-between mb-2">
 <span className="text-foreground font-medium">{t('kdv_gosterimi')}</span>
 <label className="relative inline-flex items-center cursor-pointer">
 <input type="checkbox" checked={editForm.showKdv} onChange={(e) => setEditForm({ ...editForm, showKdv: e.target.checked })} className="sr-only peer" />
 <div className="w-11 h-6 bg-slate-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background dark:after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 transition-colors"></div>
 </label>
 </div>
 {editForm.showKdv && (
 <div className="space-y-3 mt-3">
 <div>
 <label className="text-muted-foreground text-xs block mb-1.5">{t('kdv_orani')}</label>
 <input type="number" value={editForm.kdvRate} onChange={(e) => setEditForm({ ...editForm, kdvRate: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-shadow" />
 </div>
 <div className="flex items-center gap-2 pt-1">
 <input type="checkbox" checked={editForm.pricesIncludeKdv} onChange={(e) => setEditForm({ ...editForm, pricesIncludeKdv: e.target.checked })}
 className="w-4 h-4 rounded bg-background border-input cursor-pointer text-cyan-500 focus:ring-cyan-500" />
 <span className="text-foreground text-sm font-medium">{t('vat_included')}</span>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 </div>
 ) : (
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">{t('tarih')}</span>
 <span className="text-foreground">{formatDate(kermes.date || kermes.startDate)}</span>
 </div>
 {kermes.endDate && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">{t('bitis')}</span>
 <span className="text-foreground">{formatDate(kermes.endDate)}</span>
 </div>
 )}
 {kermes.openingTime && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">{t('saat')}</span>
 <span className="text-foreground">{kermes.openingTime} - {kermes.closingTime || '?'}</span>
 </div>
 )}
 <div className="flex justify-between text-sm md:col-span-2">
 <span className="text-muted-foreground/80">📍 Adres:</span>
 <div className="text-right">
 <div className="text-foreground">{kermes.address || '-'}</div>
 {(kermes.secondStreetName) && <div className="text-muted-foreground text-xs">{kermes.secondStreetName}</div>}
 <div className="text-foreground text-xs">{[kermes.postalCode, kermes.city, kermes.country].filter(Boolean).join(' ')}</div>
 </div>
 </div>

 {/* Bilingual Bilgiler */}
 {kermes.titleSecondary && (
 <div className="flex justify-between text-sm md:col-span-2 border-t border-border pt-2 mt-2">
 <span className="text-muted-foreground/80">🌍 {kermes.secondaryLanguage?.toUpperCase()} {t('baslik')}</span>
 <div className="text-right">
 <div className="text-foreground">{kermes.titleSecondary}</div>
 {kermes.descriptionSecondary && <div className="text-muted-foreground text-xs truncate max-w-[200px]">{kermes.descriptionSecondary}</div>}
 </div>
 </div>
 )}
 </div>

 {/* Kurumsal Bilgiler */}
 {(kermes.hasPfandSystem || kermes.showKdv) && (
 <div className="pt-4 border-t border-border">
 <h4 className="text-muted-foreground/80 text-sm font-medium mb-2">🏢 Kurumsal Bilgiler</h4>
 <div className="grid grid-cols-2 gap-4 text-sm">
 {kermes.hasPfandSystem && (
 <div className="bg-card p-2 rounded border border-gray-600">
 <span className="text-muted-foreground block text-xs">{t('deposit_system')}</span>
 <span className="text-green-800 dark:text-green-400 font-medium">{kermes.pfandAmount}€</span>
 </div>
 )}
 {kermes.showKdv && (
 <div className="bg-card p-2 rounded border border-gray-600">
 <span className="text-muted-foreground block text-xs">KDV ({kermes.kdvRate}%)</span>
 <span className="text-blue-800 dark:text-blue-400 font-medium">{kermes.pricesIncludeKdv ? 'Dahil' : t('haric')}</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Features Display */}
 {kermes.features && Array.isArray(kermes.features) && kermes.features.length > 0 && (
 <div className="pt-4 border-t border-border">
 <span className="text-muted-foreground/80 text-sm block mb-2">{t('ozellikler')}</span>
 <div className="flex flex-wrap gap-2">
 {kermes.features.map(fId => (
 <span key={fId} className="px-3 py-1 bg-pink-600/20 text-pink-800 dark:text-pink-400 rounded-full text-xs">
 {getFeatureLabel(fId)}
 </span>
 ))}
 {/* Özel özellikler */}
 {kermes.customFeatures && kermes.customFeatures.map((cf: string, idx: number) => (
 <span key={`custom-${idx}`} className="px-3 py-1 bg-blue-600/20 text-blue-800 dark:text-blue-400 rounded-full text-xs">
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
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">{t('yetkili_kisi')}</h3>
 {isEditing ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('yetkili_adi')}</label>
 <input type="text" value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" placeholder={t('kermesten_sorumlu_kisi')} />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('telefon_numarasi')}</label>
 <input type="tel" value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" placeholder="+49 123 456 789" />
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-center gap-3 text-sm">
 <span className="text-muted-foreground/80">👤 İsim:</span>
 <span className="text-foreground">{kermes.contactName || '-'}</span>
 </div>
 <div className="flex items-center gap-3 text-sm">
 <span className="text-muted-foreground/80">📞 Telefon:</span>
 <span className="text-foreground">{kermes.contactPhone || '-'}</span>
 </div>
 </div>
 )}
 </div>

 </>
 )}

 {/* TAB: Teslimat */}
 {bilgiSubTab === 'teslimat' && (
 <>
 {/* Sipariş ve Teslimat Seçenekleri */}
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">Sipariş ve Teslimat Seçenekleri</h3>
 {isEditing ? (
 <div className="space-y-4">
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={editForm.isMenuOnly}
 onChange={(e) => {
 const val = e.target.checked;
 setEditForm({ ...editForm, isMenuOnly: val, hasTakeaway: val ? false : editForm.hasTakeaway, hasDelivery: val ? false : editForm.hasDelivery, hasDineIn: val ? false : editForm.hasDineIn });
 }}
 className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500" />
 <span className="text-foreground">Sadece Menü Gösterimi <span className="text-muted-foreground text-xs">(Sipariş Kapalı)</span></span>
 </label>
 
 {!editForm.isMenuOnly && (
 <>
 <div className="pl-6 space-y-3 border-l-2 border-gray-700 ml-2 mt-4">
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={editForm.hasTakeaway !== false} // Varsayılan açık
 onChange={(e) => setEditForm({ ...editForm, hasTakeaway: e.target.checked })}
 className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500" />
 <span className="text-foreground">Gel-Al İmkanı (Takeaway)</span>
 </label>
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={editForm.hasDineIn}
 onChange={(e) => setEditForm({ ...editForm, hasDineIn: e.target.checked })}
 className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500" />
 <span className="text-foreground">Masa Servisi İmkanı (Dine-in)</span>
 </label>
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={editForm.hasDelivery}
 onChange={(e) => setEditForm({ ...editForm, hasDelivery: e.target.checked })}
 className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500" />
 <span className="text-foreground">{t('kurye_servisi_mevcut')}</span>
 </label>
 </div>

 {editForm.hasDelivery && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8 mt-4">
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('nakliyat_ucreti')}</label>
 <input type="number" step="0.50" min="0" value={editForm.deliveryFee || ''}
 onChange={(e) => setEditForm({ ...editForm, deliveryFee: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" placeholder="3.00" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('minimum_siparis_tutari')} <span className="text-yellow-800 dark:text-yellow-400">{t('bu_tutarin_altinda_kurye_kabul_edilmez')}</span></label>
 <input type="number" step="1" min="0" value={editForm.minOrderAmount || ''}
 onChange={(e) => setEditForm({ ...editForm, minOrderAmount: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" placeholder="15" />
 </div>
 </div>
 )}
 </>
 )}
 </div>
 ) : (
 <div className="space-y-4">
 {kermes.isMenuOnly ? (
 <div className="flex items-center gap-3 text-sm">
 <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-600/30 text-white">
 Sadece Menü Gösterimi (Sipariş Kapalı)
 </span>
 </div>
 ) : (
 <div className="flex flex-wrap gap-2 text-sm mt-2">
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${kermes.hasTakeaway !== false ? 'bg-green-600/30 text-green-800 dark:text-green-400' : 'bg-red-600/30 text-red-800 dark:text-red-400'}`}>
 {kermes.hasTakeaway !== false ? 'Gel-Al (Var)' : 'Gel-Al (Yok)'}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${kermes.hasDineIn ? 'bg-green-600/30 text-green-800 dark:text-green-400' : 'bg-red-600/30 text-red-800 dark:text-red-400'}`}>
 {kermes.hasDineIn ? 'Masa (Var)' : 'Masa (Yok)'}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${kermes.hasDelivery ? 'bg-green-600/30 text-green-800 dark:text-green-400' : 'bg-red-600/30 text-red-800 dark:text-red-400'}`}>
 {kermes.hasDelivery ? t('kurye_var') : t('kurye_yok')}
 </span>
 </div>
 )}
 {kermes.hasDelivery && !kermes.isMenuOnly && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
 <div className="flex items-center gap-2 text-sm">
 <span className="text-muted-foreground/80">{t('nakliyat_ucreti')}</span>
 <span className="text-foreground font-medium">{(kermes.deliveryFee || 0).toFixed(2)} €</span>
 </div>
 {(kermes.minOrderAmount || 0) > 0 && (
 <div className="flex items-center gap-2 text-sm">
 <span className="text-muted-foreground/80">{t('min_siparis')}</span>
 <span className="text-yellow-800 dark:text-yellow-400 font-medium">{(kermes.minOrderAmount || 0).toFixed(2)} {t('altinda_kurye_kabul_edilmez')}</span>
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>

 </>
 )}

 {/* TAB: Genel - Yuvarlama + Sila Yolu */}
 {bilgiSubTab === 'genel' && (
 <>
 {/* Yuvarlama ile Destek */}
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-1">Yuvarlama ile Destek</h3>
 <p className="text-muted-foreground text-xs mb-4">Aktifse, checkout'ta kullaniciya siparis tutamini yuvarlamasina ve farki bagis olarak gondermesine imkan tanirsaniz.</p>
 {isEditing ? (
 <div className="space-y-4">
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={editForm.acceptsDonations}
 onChange={(e) => setEditForm({ ...editForm, acceptsDonations: e.target.checked, selectedDonationFundId: e.target.checked ? editForm.selectedDonationFundId : '', selectedDonationFundName: e.target.checked ? editForm.selectedDonationFundName : '' })}
 className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500" />
 <span className="text-foreground">Yuvarlama ile Destek Aktif</span>
 </label>
 {editForm.acceptsDonations && (
 <div className="pl-6 border-l-2 border-gray-700 ml-2 space-y-3">
 <p className="text-muted-foreground text-xs">Kullanici her zaman <strong className="text-white">kendi kermes kurulasuna</strong> yuvarlayabilir. Asagidan bir 2. bagis fonu da sec:</p>
 {donationFunds.length > 0 ? (
 <select
 value={editForm.selectedDonationFundId}
 onChange={(e) => {
 const fund = donationFunds.find(f => f.id === e.target.value);
 setEditForm({ ...editForm, selectedDonationFundId: e.target.value, selectedDonationFundName: fund?.name || '' });
 }}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm"
 >
 <option value="">-- 2. Fon secme (sadece kendi kurulusu gosterilir) --</option>
 {donationFunds.map(f => (
 <option key={f.id} value={f.id}>{f.name}</option>
 ))}
 </select>
 ) : (
 <p className="text-yellow-400 text-xs">Henuz aktif bagis fonu tanimlanmamis. Super Admin &gt; Ayarlar &gt; Bagis Fonlari kisminda ekleyin.</p>
 )}
 </div>
 )}
 </div>
 ) : (
 <div className="flex flex-wrap gap-2">
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${
 (kermes as any).acceptsDonations ? 'bg-green-600/30 text-green-400' : 'bg-gray-600/30 text-gray-400'
 }`}>
 {(kermes as any).acceptsDonations ? 'Yuvarlama Aktif' : 'Yuvarlama Pasif'}
 </span>
 {(kermes as any).selectedDonationFundName && (
 <span className="px-3 py-1 rounded-full text-xs bg-blue-600/30 text-blue-400">
 2. Fon: {(kermes as any).selectedDonationFundName}
 </span>
 )}
 </div>
 )}
 </div>

 {/* Sila Yolu Kermesi */}
 <div className="bg-card rounded-xl p-6">
  <div className="flex items-center gap-3 mb-1">
   <span className="text-xl">🛣️</span>
   <h3 className="text-foreground font-bold">Sıla Yolu Kermesi</h3>
  </div>
  <p className="text-muted-foreground text-xs mb-4">
   Bu kermes <strong className="text-foreground">Sıla Yolu</strong> güzergahındaki bir etkinliktir. İşaretlenirse mobil uygulamada <em>Almanya → Sıla Yolu Kermesleri</em> listesinde görünür.
  </p>
  {isEditing ? (
   <label className="flex items-center gap-3 cursor-pointer">
    <input
     type="checkbox"
     checked={!!editForm.isSilaYolu}
     onChange={(e) => setEditForm({ ...editForm, isSilaYolu: e.target.checked })}
     className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-pink-600 focus:ring-pink-500"
    />
    <span className="text-foreground font-medium">Bu bir Sıla Yolu kermesidir</span>
   </label>
  ) : (
   <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
    (kermes as any).isSilaYolu ? 'bg-emerald-600/30 text-emerald-400' : 'bg-gray-600/30 text-gray-400'
   }`}>
    {(kermes as any).isSilaYolu ? '🛣️ Sıla Yolu Kermesi' : 'Normal Kermes'}
   </span>
  )}
 </div>

 </>
 )}

 {/* TAB: Marka & Sertifika */}
 {bilgiSubTab === 'marka' && (
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">Marka & Sertifika</h3>
 {isEditing ? (
 <div className="space-y-6">
 {/* Header Image */}
 <div>
 <label className="text-muted-foreground text-xs block mb-2">{t('baslik_gorseli')}</label>
 <div className="bg-muted/80 dark:bg-muted/20 border border-border rounded-lg p-4">
 {editForm.headerImage ? (
 <div className="relative">
 <img src={editForm.headerImage} alt={t('baslik_gorseli')} className="w-full h-32 object-cover rounded-lg" />
 <button type="button" onClick={() => setEditForm({ ...editForm, headerImage: '', headerImageId: '' })}
 className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white rounded text-xs">{t('kaldir')}</button>
 </div>
 ) : (
 <button type="button" onClick={() => setShowStockImageModal(true)}
 className="w-full h-32 border-2 border-dashed border-gray-500 rounded-lg hover:border-cyan-500 transition flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-cyan-800 dark:text-cyan-400">
 <span className="text-3xl">&#x1f5bc;&#xfe0f;</span>
 <span className="text-sm">{t('stok_gorsel_sec')}</span>
 </button>
 )}
 <p className="text-muted-foreground/80 text-xs mt-2 text-center">{t('onerilen_1200_675px_16_9')}</p>
 </div>
 </div>

 {/* Marka & Sertifika Rozetleri */}
 <div>
 <h4 className="text-foreground font-medium mb-3">Marka & Sertifika Rozetleri</h4>
 <div className="flex flex-wrap gap-3">
 {availableBadges.map((badge) => {
 const isSelected = editForm.activeBadgeIds?.includes(badge.id);
 return (
 <button key={badge.id} type="button" onClick={() => {
 const currentIds = editForm.activeBadgeIds || [];
 setEditForm({ ...editForm, activeBadgeIds: isSelected ? currentIds.filter(id => id !== badge.id) : [...currentIds, badge.id] });
 }}
 className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${isSelected ? 'bg-pink-600/20 border-pink-500 text-pink-500' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
 {badge.iconUrl && (<div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center p-0.5"><img src={badge.iconUrl} alt={badge.name} className="w-full h-full object-contain" /></div>)}
 <span className="text-sm font-medium">{badge.name}</span>
 </button>
 );
 })}
 {availableBadges.length === 0 && (<p className="text-sm text-muted-foreground w-full py-2">Henuz aktif rozet bulunmuyor.</p>)}
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 {kermes?.headerImage && (
 <div>
 <img src={kermes.headerImage} alt="Header" className="w-full h-32 object-cover rounded-lg" />
 </div>
 )}
 {kermes?.activeBadgeIds && kermes.activeBadgeIds.length > 0 && (
 <div>
 <span className="text-muted-foreground/80 text-sm block mb-2">Aktif Rozetler</span>
 <div className="flex flex-wrap gap-2">
 {kermes.activeBadgeIds.map((badgeId: string) => {
 const badge = availableBadges.find(b => b.id === badgeId);
 return badge ? (
 <span key={badgeId} className="px-3 py-1 bg-purple-600/20 text-purple-800 dark:text-purple-400 rounded-full text-xs flex items-center gap-1.5">
 {badge.iconUrl && <img src={badge.iconUrl} alt="" className="w-4 h-4 object-contain rounded-sm" />}
 {badge.name}
 </span>
 ) : null;
 })}
 </div>
 </div>
 )}
 {(!kermes?.headerImage && (!kermes?.activeBadgeIds || kermes.activeBadgeIds.length === 0)) && (
 <p className="text-muted-foreground text-sm">Henuz marka veya sertifika bilgisi eklenmedi.</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* TAB: Ozellikler */}
 {bilgiSubTab === 'ozellikler' && (
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">Ozellikler</h3>
 {isEditing ? (
 <div className="space-y-6">
 {/* Sabit Ozellikler */}
 <div>
 <label className="text-muted-foreground text-xs block mb-2">{t('etkinlik_ozellikleri_sabit')}</label>
 <div className="flex flex-wrap gap-2">
 {eventFeatures.map(f => (
 <span key={f.id} className="inline-flex items-center gap-0.5 group">
 <button type="button" onClick={() => toggleFeature(f.id)}
 className={`px-3 py-1 rounded-full text-xs font-semibold transition inline-flex items-center gap-1.5 ${editFeatures.includes(f.id) ? 'text-white' : 'bg-gray-700 text-muted-foreground'}`}
 style={editFeatures.includes(f.id) ? { backgroundColor: f.color } : {}}>
 {f.iconUrl ? <img src={f.iconUrl} alt={f.label} className="w-4 h-4 object-contain rounded-sm inline-block" /> : (f.icon && (f.icon.startsWith('http') ? <img src={f.icon} alt="" className="w-4 h-4 object-contain rounded-sm inline-block" /> : <span>{f.icon}</span>))}
 {getLocalizedFeatureLabel(f)}
 </button>
 </span>
 ))}
 </div>
 </div>

 {/* Ozel Ozellikler - Max 3 */}
 <div>
 <label className="text-muted-foreground text-xs block mb-2">{t('ozel_ozellikler_max_3')}</label>
 <div className="flex flex-wrap gap-2 mb-2">
 {editCustomFeatures.map((cf, idx) => (
 <span key={idx} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white flex items-center gap-1">
 {cf}
 <button type="button" onClick={() => setEditCustomFeatures(editCustomFeatures.filter((_, i) => i !== idx))}
 className="w-4 h-4 rounded-full bg-blue-800 hover:bg-blue-700 flex items-center justify-center text-xs">x</button>
 </span>
 ))}
 </div>
 {editCustomFeatures.length < 3 && (
 <div className="flex gap-2">
 <input type="text" placeholder={t('yeni_ozellik_adi')} id="custom-feature-input-tab"
 className="flex-1 px-3 py-1 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-xs"
 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const input = e.target as HTMLInputElement; if (input.value.trim() && editCustomFeatures.length < 3) { setEditCustomFeatures([...editCustomFeatures, input.value.trim()]); input.value = ''; } } }} />
 <button type="button" onClick={() => { const input = document.getElementById('custom-feature-input-tab') as HTMLInputElement; if (input?.value.trim() && editCustomFeatures.length < 3) { setEditCustomFeatures([...editCustomFeatures, input.value.trim()]); input.value = ''; } }}
 className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-500 transition font-medium">+ {t('ekle')}</button>
 </div>
 )}
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 {kermes.features && Array.isArray(kermes.features) && kermes.features.length > 0 && (
 <div>
 <span className="text-muted-foreground/80 text-sm block mb-2">{t('ozellikler')}</span>
 <div className="flex flex-wrap gap-2">
 {kermes.features.map((fId: string) => (
 <span key={fId} className="px-3 py-1 bg-pink-600/20 text-pink-800 dark:text-pink-400 rounded-full text-xs inline-flex items-center gap-1">
 {(() => { const ic = getFeatureIcon(fId); return ic ? (ic.startsWith('http') ? <img src={ic} alt="" className="w-3.5 h-3.5 object-contain rounded-sm" /> : <span>{ic}</span>) : null; })()}
 {getFeatureLabel(fId)}
 </span>
 ))}
 {kermes.customFeatures && kermes.customFeatures.map((cf: string, idx: number) => (
 <span key={`custom-${idx}`} className="px-3 py-1 bg-blue-600/20 text-blue-800 dark:text-blue-400 rounded-full text-xs">{cf}</span>
 ))}
 </div>
 </div>
 )}
 {(!kermes.features || kermes.features.length === 0) && (
 <p className="text-muted-foreground text-sm">Henuz ozellik eklenmedi.</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* TAB: Fiyat Ayarlari */}
 {bilgiSubTab === 'fiyat' && (
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">{t('fiyat_ayarlari') || 'Fiyat Ayarlari'}</h3>
 {isEditing ? (
 <div className="space-y-6">

 {/* Para Birimi */}
 <div className="bg-muted/20 border border-border rounded-xl p-4">
 <h4 className="text-foreground font-medium mb-3">{t('para_birimi') || 'Para Birimi'}</h4>
 <select value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
 className="w-full px-3 py-2.5 bg-background text-foreground rounded-lg border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-shadow text-sm">
 <option value="EUR">EUR - Euro</option>
 <option value="TRY">TRY - Turk Lirasi</option>
 <option value="USD">USD - ABD Dolari</option>
 <option value="GBP">GBP - Ingiliz Sterlini</option>
 <option value="CHF">CHF - Isvicre Frangi</option>
 <option value="NOK">NOK - Norvec Kronu</option>
 <option value="SEK">SEK - Isvec Kronu</option>
 <option value="DKK">DKK - Danimarka Kronu</option>
 </select>
 <p className="text-muted-foreground text-xs mt-2">Kermesteki fiyatlar bu para biriminde gosterilir. Ulke bilgisinden otomatik doldurulur.</p>
 </div>

 {/* Net / Brut Fiyat Modu */}
 <div className="bg-muted/20 border border-border rounded-xl p-4">
 <h4 className="text-foreground font-medium mb-3">{t('fiyat_gosterim_modu') || 'Fiyat Gösterim Modu'}</h4>
 <div className="flex gap-3">
 <button type="button" onClick={() => setEditForm({ ...editForm, pricingMode: 'brut' })}
 className={`flex-1 px-4 py-3 rounded-lg border-2 transition text-sm font-medium ${editForm.pricingMode === 'brut' ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-muted/30 border-border text-muted-foreground hover:border-gray-500'}`}>
 <div className="font-bold mb-1">Brut (KDV Dahil)</div>
 <div className="text-xs opacity-80">Fiyatlar vergi dahil gosterilir</div>
 </button>
 <button type="button" onClick={() => setEditForm({ ...editForm, pricingMode: 'net' })}
 className={`flex-1 px-4 py-3 rounded-lg border-2 transition text-sm font-medium ${editForm.pricingMode === 'net' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-muted/30 border-border text-muted-foreground hover:border-gray-500'}`}>
 <div className="font-bold mb-1">Net (KDV Haric)</div>
 <div className="text-xs opacity-80">Fiyatlar vergisiz gosterilir, vergi kasada eklenir</div>
 </button>
 </div>
 </div>

 {/* Vergi Oranlari (Brut secildiginde) */}
 {editForm.pricingMode === 'brut' && (
 <div className="bg-muted/20 border border-border rounded-xl p-4">
 <h4 className="text-foreground font-medium mb-3">Vergi Oranlari</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-card shadow-sm p-4 rounded-xl border border-border">
 <label className="text-muted-foreground text-xs block mb-1.5">Yiyecek & Icecek Vergi Orani (%)</label>
 <input type="number" step="0.1" min="0" max="100" value={editForm.foodTaxRate}
 onChange={(e) => setEditForm({ ...editForm, foodTaxRate: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-shadow" />
 <p className="text-muted-foreground text-xs mt-1.5">Almanya: 7%, Turkiye: 10%</p>
 </div>
 <div className="bg-card shadow-sm p-4 rounded-xl border border-border">
 <label className="text-muted-foreground text-xs block mb-1.5">Diger Urunler Vergi Orani (%)</label>
 <input type="number" step="0.1" min="0" max="100" value={editForm.nonFoodTaxRate}
 onChange={(e) => setEditForm({ ...editForm, nonFoodTaxRate: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-shadow" />
 <p className="text-muted-foreground text-xs mt-1.5">Almanya: 19%, Turkiye: 20%</p>
 </div>
 </div>
 <p className="text-muted-foreground text-xs mt-3">Bu oranlar menudeki urunlere otomatik uygulanir. Yiyecek kategorisindeki urunlere yiyecek orani, diger urunlere genel oran uygulanir.</p>
 </div>
 )}

 {/* Pfand (Depozito) Sistemi */}
 <div className="bg-muted/20 border border-border rounded-xl p-4">
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-foreground font-medium">Pfand (Depozito) Sistemi</h4>
 <label className="relative inline-flex items-center cursor-pointer">
 <input type="checkbox" checked={editForm.hasPfandSystem} onChange={(e) => setEditForm({ ...editForm, hasPfandSystem: e.target.checked })} className="sr-only peer" />
 <div className="w-11 h-6 bg-slate-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background dark:after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 transition-colors"></div>
 </label>
 </div>
 {editForm.hasPfandSystem && (
 <div className="mt-3">
 <label className="text-muted-foreground text-xs block mb-1.5">{t('pfand_ucreti')}</label>
 <div className="flex items-center gap-2">
 <input type="number" step="0.01" value={editForm.pfandAmount} onChange={(e) => setEditForm({ ...editForm, pfandAmount: parseFloat(e.target.value) || 0 })}
 className="w-32 px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-shadow" />
 <span className="text-muted-foreground text-sm">{editForm.currency}</span>
 </div>
 </div>
 )}
 </div>

 </div>
 ) : (
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">Para Birimi</span>
 <span className="text-foreground font-medium">{kermes?.currency || 'EUR'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">Fiyat Modu</span>
 <span className={`font-medium ${(kermes as any)?.pricingMode === 'net' ? 'text-blue-400' : 'text-green-400'}`}>
 {(kermes as any)?.pricingMode === 'net' ? 'Net (KDV Haric)' : 'Brut (KDV Dahil)'}
 </span>
 </div>
 </div>
 {(kermes as any)?.pricingMode !== 'net' && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">Yiyecek Vergi Orani</span>
 <span className="text-foreground">%{(kermes as any)?.foodTaxRate ?? 7}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground/80">Diger Vergi Orani</span>
 <span className="text-foreground">%{(kermes as any)?.nonFoodTaxRate ?? 19}</span>
 </div>
 </div>
 )}
 {kermes?.hasPfandSystem && (
 <div className="flex justify-between text-sm pt-2 border-t border-border">
 <span className="text-muted-foreground/80">Pfand (Depozito)</span>
 <span className="text-green-400 font-medium">{kermes.pfandAmount} {kermes?.currency || 'EUR'}</span>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* TAB: Imkanlar */}
 {bilgiSubTab === 'imkanlar' && (
 <>
 {/* Park Imkanlari Card */}
 <div className="bg-card rounded-xl p-6">
 <h3 className="text-foreground font-bold mb-4">{t('park_i_mkanlari')}</h3>
 {isEditing ? (
 <div className="space-y-4">
 {/* Park Locations List */}
 {editForm.parkingLocations.map((loc, idx) => (
 <div key={idx} className="bg-muted/80 dark:bg-muted/20 border border-border rounded-lg p-4 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{idx + 1}</span>
 <span className="text-foreground font-medium text-sm">{t('park_i_mkani')} {idx + 1}</span>
 {/* Status Toggle */}
 <div className="flex gap-1 ml-2">
 {[
   { key: null, label: 'Belirsiz', color: 'gray' },
   { key: 'available', label: 'Bo\u015f', color: 'green' },
   { key: 'full', label: 'Dolu', color: 'red' },
 ].map((opt) => (
   <button
     key={opt.label}
     onClick={() => {
       const updated = [...editForm.parkingLocations];
       if (opt.key === null) {
         delete updated[idx].status;
       } else {
         updated[idx] = { ...updated[idx], status: opt.key };
       }
       setEditForm({ ...editForm, parkingLocations: updated });
     }}
     className={`px-2 py-0.5 text-xs rounded-full border transition ${
       (loc.status || null) === opt.key
         ? opt.color === 'green' ? 'bg-green-600/20 border-green-500 text-green-400'
           : opt.color === 'red' ? 'bg-red-600/20 border-red-500 text-red-400'
           : 'bg-gray-600/20 border-gray-500 text-gray-400'
         : 'border-gray-700 text-gray-500 hover:border-gray-500'
     }`}
   >
     {opt.label}
   </button>
 ))}
 </div>
 </div>
 <button onClick={() => {
 const updated = [...editForm.parkingLocations];
 updated.splice(idx, 1);
 setEditForm({ ...editForm, parkingLocations: updated });
 }} className="text-red-800 dark:text-red-400 hover:text-red-300 text-xs">{t('sil')}</button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="md:col-span-2">
 <label className="text-muted-foreground text-xs block mb-1">📍 Sokak / Cadde Adresi <span className="text-blue-800 dark:text-blue-400">{t('google_ile_ara')}</span></label>
 <PlacesAutocomplete
 value={loc.street || ''}
 onChange={(value) => {
 const updated = [...editForm.parkingLocations];
 updated[idx] = { ...updated[idx], street: value };
 setEditForm({ ...editForm, parkingLocations: updated });
 }}
 onPlaceSelect={(place) => {
 // Tum adres bilesenleri + koordinatlari otomatik doldur
 const updated = [...editForm.parkingLocations];
 updated[idx] = {
 ...updated[idx],
 street: place.street,
 city: place.city,
 postalCode: place.postalCode,
 country: place.country,
 lat: place.lat,
 lng: place.lng
 };
 setEditForm({ ...editForm, parkingLocations: updated });
 }}
 placeholder={t('orn_hauptstra_e_10')}
 className="text-sm"
 />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('sehir')}</label>
 <input type="text" value={loc.city || ''} placeholder={t('orn_huckelhoven')}
 onChange={(e) => {
 const updated = [...editForm.parkingLocations];
 updated[idx] = { ...updated[idx], city: e.target.value };
 setEditForm({ ...editForm, parkingLocations: updated });
 }}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm" />
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('postal_code')}</label>
 <input type="text" value={loc.postalCode || ''} placeholder="41836"
 onChange={(e) => {
 const updated = [...editForm.parkingLocations];
 updated[idx] = { ...updated[idx], postalCode: e.target.value };
 setEditForm({ ...editForm, parkingLocations: updated });
 }}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('ulke')}</label>
 <input type="text" value={loc.country || ''} placeholder="Almanya"
 onChange={(e) => {
 const updated = [...editForm.parkingLocations];
 updated[idx] = { ...updated[idx], country: e.target.value };
 setEditForm({ ...editForm, parkingLocations: updated });
 }}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm" />
 </div>
 </div>
 <div className="md:col-span-2">
 <label className="text-muted-foreground text-xs block mb-1">{t('aciklama_not')}</label>
 <input type="text" value={loc.note || ''} placeholder={t('orn_caddenin_sag_ve_sol_tarafina_park_ed')}
 onChange={(e) => {
 const updated = [...editForm.parkingLocations];
 updated[idx] = { ...updated[idx], note: e.target.value };
 setEditForm({ ...editForm, parkingLocations: updated });
 }}
 className="w-full px-3 py-2 bg-gray-600 text-foreground rounded-lg border border-gray-500 text-sm" />
 </div>
 {/* Resim Yükleme Bölümü */}
 <div className="md:col-span-2">
 <label className="text-muted-foreground text-xs block mb-2">📷 Park Resimleri (Max 3)</label>
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
 <span className="text-muted-foreground text-2xl">+</span>
 <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
 const file = e.target.files?.[0];
 if (!file) return;

 // Loading göster
 const loadingToast = document.createElement('div');
 loadingToast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg z-50';
 loadingToast.textContent = t('resim_yukleniyor');
 document.body.appendChild(loadingToast);

 try {
 console.log(t('resim_yukleme_basliyor'), file.name);

 // Firebase Storage'a yükle
 const fileName = `parking_${idx}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
 const storageRef = ref(storage, `kermes/${kermesId}/parking/${fileName}`);

 console.log('📂 Storage path:', `kermes/${kermesId}/parking/${fileName}`);

 await uploadBytes(storageRef, file);
 console.log(t('upload_tamamlandi'));

 const downloadUrl = await getDownloadURL(storageRef);
 console.log('🔗 Download URL:', downloadUrl);

 const updated = [...editForm.parkingLocations];
 updated[idx] = { ...updated[idx], images: [...(loc.images || []), downloadUrl].slice(0, 3) };
 setEditForm({ ...editForm, parkingLocations: updated });

 loadingToast.textContent = t('resim_yuklendi');
 loadingToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg z-50';
 setTimeout(() => loadingToast.remove(), 2000);
 } catch (error: unknown) {
 console.error(t('resim_yukleme_hatasi'), error);
 loadingToast.textContent = `❌ Hata: ${error instanceof Error ? error.message : t('bilinmeyen_hata')}`;
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
 className="py-3 border-2 border-dashed border-gray-600 text-muted-foreground rounded-lg hover:border-blue-500 hover:text-blue-800 dark:text-blue-400 text-sm flex flex-col items-center gap-1">
 <span className="text-lg">✏️</span>
 <span>{t('manuel_ekle')}</span>
 </button>
 {/* GPS'den Ekle */}
 <button onClick={() => {
 setMapPickerIndex('new');
 setMapPickerOpen(true);
 }}
 className="py-3 border-2 border-dashed border-green-600/50 text-green-800 dark:text-green-400 rounded-lg hover:border-green-500 hover:bg-green-900/20 text-sm flex flex-col items-center gap-1">
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
 note: t('kermes_adresi_yakini'),
 images: []
 }]
 });
 }}
 className="py-3 border-2 border-dashed border-purple-600/50 text-purple-800 dark:text-purple-400 rounded-lg hover:border-purple-500 hover:bg-purple-900/20 text-sm flex flex-col items-center gap-1">
 <span className="text-lg">📍</span>
 <span>{t('kermes_location')}</span>
 </button>
 </div>

 {/* General Parking Note */}
 <div className="pt-4 border-t border-border">
 <label className="text-muted-foreground text-xs block mb-2">{t('parking_info')}</label>
 <textarea value={editForm.generalParkingNote} placeholder={t('ziyaretcilere_gosterilecek_genel_park_bi')}
 onChange={(e) => setEditForm({ ...editForm, generalParkingNote: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm h-20 resize-none" />
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 {kermes.parkingLocations && kermes.parkingLocations.length > 0 ? (
 <>
 {kermes.parkingLocations.map((loc: any, idx: number) => (
 <div key={idx} className="bg-muted/50 dark:bg-muted/10 border border-border rounded-lg p-3">
 <div className="flex items-start gap-3">
 <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{idx + 1}</span>
 <div className="flex-1">
 <p className="text-foreground text-sm font-medium">
 {loc.street || loc.address}{loc.city && `, ${loc.city}`}
 </p>
 {(loc.postalCode || loc.country) && (
 <p className="text-muted-foreground text-xs">{[loc.postalCode, loc.country].filter(Boolean).join(', ')}</p>
 )}
 {loc.note && <p className="text-muted-foreground text-xs mt-1 italic">{loc.note}</p>}
 </div>
 </div>
 </div>
 ))}
 </>
 ) : (
 <p className="text-muted-foreground/80 text-sm">{t('park_imkani_bilgisi_eklenmemis')}</p>
 )}
 {kermes.generalParkingNote && (
 <div className="pt-3 border-t border-border">
 <p className="text-muted-foreground text-xs">ℹ️ {kermes.generalParkingNote}</p>
 </div>
 )}
 </div>
 )}
 </div>
 </>
 )}
 </div>
 )}

 {/* Tab Content - Personel */}
 {activeTab === 'personel' && (
 <div className="space-y-6">
 {/* Kermes Personel */}
 <div className="bg-card rounded-xl p-6">
 <div className="flex justify-between items-center mb-4">
 <div>
 <h3 className="text-foreground font-bold flex items-center gap-2">
 <span className="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center text-sm">P</span>
 Kermes Personel
 </h3>
 <p className="text-xs text-muted-foreground mt-1">
 {t('kermes_personel_aciklama') || 'Kermeste gorev alacak personelleri secin. Araba ikonu ile surucu olarak da atayabilirsiniz.'}
 </p>
 </div>
 <button 
 type="button"
 onClick={() => setIsAddingStaff(!isAddingStaff)}
 className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition"
 >
 {isAddingStaff ? t('iptal_et') || 'Iptal Et' : `+ ${t('yeni_personel_ekle') || 'Yeni Personel Ekle'}`}
 </button>
 </div>

 {isAddingStaff && (
  <div className="mb-6 p-4 bg-cyan-950/20 rounded-xl border border-cyan-700/30 space-y-4">
  <h5 className="text-sm font-semibold text-foreground">
  {canManageStaff ? 'Yeni Personel Ekle veya Mevcut Kullaniciyi Bul' : 'Personel Bilgileri'}
  </h5>

  {/* Telefon + Email alanlari - her ikisi icin de arama tetikler */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <input
  type="text"
  placeholder={t('ad_soyad') || 'Ad Soyad'}
  aria-label="Ad Soyad"
  className="w-full px-3 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow outline-none"
  value={newStaffForm.name}
  onChange={e => setNewStaffForm({...newStaffForm, name: e.target.value})}
  />
  <div className="flex gap-2">
  <input
  type="text"
  placeholder="+49"
  aria-label="Ulke kodu"
  className="w-20 px-3 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow outline-none text-center"
  value={newStaffForm.countryCode}
  onChange={e => setNewStaffForm({...newStaffForm, countryCode: e.target.value})}
  />
  <input
  type="text"
  placeholder={t('telefon_numarasi') || 'Telefon Numarasi'}
  aria-label="Telefon numarasi"
  className="flex-1 px-3 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow outline-none"
  value={newStaffForm.phone}
  onChange={e => {
  const v = e.target.value;
  setNewStaffForm({...newStaffForm, phone: v});
  // Debounce ile ara
  if (v.length >= 6) lookupUserByPhoneOrEmail(v, newStaffForm.email);
  else setMatchedUser(null);
  }}
  />
  </div>
  <input
  type="email"
  placeholder={t('email_opsiyonel') || 'E-posta (Istege Bagli)'}
  aria-label="E-posta adresi"
  className="w-full px-3 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow outline-none"
  value={newStaffForm.email}
  onChange={e => {
  const v = e.target.value;
  setNewStaffForm({...newStaffForm, email: v});
  if (v.includes('@') && v.length >= 5) lookupUserByPhoneOrEmail(newStaffForm.phone, v);
  }}
  />
  <select
  aria-label="Cinsiyet secimi"
  className="w-full px-3 py-2 bg-background text-foreground rounded-lg text-sm border border-input focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow outline-none"
  value={newStaffForm.gender}
  onChange={e => setNewStaffForm({...newStaffForm, gender: e.target.value})}
  >
  <option value="" disabled>{t('cinsiyet_seciniz') || 'Cinsiyet Seciniz'}</option>
  <option value="male">{t('erkek') || 'Bay / Herr'}</option>
  <option value="female">{t('kadin') || 'Bayan / Frau'}</option>
  </select>
  </div>

  {/* Eslesen kullanici banneri */}
  {isMatchSearching && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <div className="w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
  Sistemde aranıyor...
  </div>
  )}
  {matchedUser && !isMatchSearching && (
  <div className="rounded-xl border-2 border-emerald-500/60 bg-emerald-950/20 p-4">
  <div className="flex items-start gap-3">
  <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
  {(matchedUser.displayName || matchedUser.name || matchedUser.firstName || 'U').substring(0, 2).toUpperCase()}
  </div>
  <div className="flex-1 min-w-0">
  <p className="text-sm font-semibold text-emerald-400">Sistemde kayitli kullanici bulundu!</p>
  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
  {matchedUser.displayName || (matchedUser.firstName ? `${matchedUser.firstName} ${matchedUser.lastName || ''}`.trim() : '') || matchedUser.name}
  </p>
  {matchedUser.email && <p className="text-xs text-muted-foreground">{matchedUser.email}</p>}
  {(matchedUser.phone || matchedUser.phoneNumber) && <p className="text-xs text-muted-foreground">{matchedUser.phone || matchedUser.phoneNumber}</p>}
  </div>
  </div>

  {/* Rol Checkboxlari */}
  <div className="mt-4 grid grid-cols-2 gap-2">
  {([
  { key: 'isStaff', label: 'Personel', color: 'cyan' },
  { key: 'isDriver', label: 'Surucu', color: 'amber' },
  { key: 'isWaiter', label: 'Garson', color: 'emerald' },
  ] as const).map(role => (
  <label key={role.key} className="flex items-center gap-2 cursor-pointer select-none">
  <input
  type="checkbox"
  aria-label={`${role.label} olarak ata`}
  checked={newStaffRoles[role.key]}
  onChange={e => setNewStaffRoles(r => ({...r, [role.key]: e.target.checked}))}
  className="w-4 h-4 accent-cyan-500 rounded"
  />
  <span className="text-xs text-foreground">{role.label}</span>
  </label>
  ))}
  {isSuperAdmin && (
  <label className="flex items-center gap-2 cursor-pointer select-none col-span-2 mt-1 p-2 rounded-lg bg-purple-900/20 border border-purple-700/30">
  <input
  type="checkbox"
  aria-label="Kermes Admin olarak ata"
  checked={newStaffRoles.isKermesAdmin}
  onChange={e => setNewStaffRoles(r => ({...r, isKermesAdmin: e.target.checked}))}
  className="w-4 h-4 accent-purple-500 rounded"
  />
  <span className="text-xs font-semibold text-purple-300">Kermes Admin olarak ata (Personel yonetim yetkisi verir)</span>
  </label>
  )}
  </div>

  <button
  type="button"
  onClick={() => handleAssignExistingUser(matchedUser)}
  disabled={isCreatingUser || (!newStaffRoles.isStaff && !newStaffRoles.isDriver && !newStaffRoles.isWaiter && !newStaffRoles.isKermesAdmin)}
  className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
  >
  {isCreatingUser ? 'Ataniyor...' : `${matchedUser.displayName || matchedUser.name || 'Kullanici'} kermes kadrosuna ekle`}
  </button>
  <p className="text-xs text-muted-foreground text-center mt-1.5">
  veya asagidan yeni kayit olustur
  </p>
  </div>
  )}
  {!matchedUser && !isMatchSearching && newStaffForm.phone.length >= 6 && (
  <p className="text-xs text-amber-400">Sistemde bu telefon/email ile eslesen kullanici bulunamadi. Asagidan yeni kayit olusturulacak.</p>
  )}

  {/* Rol Checkboxlari - yoksa da goster (yeni kayit icin) */}
  {!matchedUser && (
  <div className="grid grid-cols-2 gap-2">
  <label className="flex items-center gap-2 cursor-pointer select-none">
  <input type="checkbox" aria-label="Personel olarak ata" checked={newStaffRoles.isStaff} onChange={e => setNewStaffRoles(r => ({...r, isStaff: e.target.checked}))} className="w-4 h-4 accent-cyan-500 rounded" />
  <span className="text-xs text-foreground">Personel</span>
  </label>
  <label className="flex items-center gap-2 cursor-pointer select-none">
  <input type="checkbox" aria-label="Surucu olarak ata" checked={newStaffRoles.isDriver} onChange={e => setNewStaffRoles(r => ({...r, isDriver: e.target.checked}))} className="w-4 h-4 accent-amber-500 rounded" />
  <span className="text-xs text-foreground">Surucu</span>
  </label>
  <label className="flex items-center gap-2 cursor-pointer select-none">
  <input type="checkbox" aria-label="Garson olarak ata" checked={newStaffRoles.isWaiter} onChange={e => setNewStaffRoles(r => ({...r, isWaiter: e.target.checked}))} className="w-4 h-4 accent-emerald-500 rounded" />
  <span className="text-xs text-foreground">Garson</span>
  </label>
  {isSuperAdmin && (
  <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded-lg bg-purple-900/20 border border-purple-700/30">
  <input type="checkbox" aria-label="Kermes Admin olarak ata" checked={newStaffRoles.isKermesAdmin} onChange={e => setNewStaffRoles(r => ({...r, isKermesAdmin: e.target.checked}))} className="w-4 h-4 accent-purple-500 rounded" />
  <span className="text-xs font-semibold text-purple-300">Kermes Admin</span>
  </label>
  )}
  </div>
  )}

  {/* Yeni kayit olusturma butonu - eslesen yoksa */}
  {!matchedUser && (
  <>
  <button
  type="button"
  onClick={() => handleCreateUser('kermes_staff')}
  disabled={isCreatingUser || !newStaffForm.name || (!newStaffForm.phone && !newStaffForm.email) || !newStaffForm.gender}
  className={`w-full py-2.5 text-white text-sm font-semibold rounded-lg transition ${
  isCreatingUser || !newStaffForm.name || (!newStaffForm.phone && !newStaffForm.email) || !newStaffForm.gender
   ? 'bg-gray-600 cursor-not-allowed opacity-60'
   : 'bg-cyan-600 hover:bg-cyan-500'
  }`}
  >
  {isCreatingUser ? (t('olusturuluyor') || 'Olusturuluyor...') : (t('kaydet') || 'Yeni Kayit Olustur ve Ata')}
  </button>
  {!newStaffForm.gender && (
  <p className="text-xs text-amber-400 text-center mt-1">Bitte Geschlecht auswahlen / Cinsiyet seciniz</p>
  )}
  </>
  )}
  </div>
 )}

 {/* Personel Arama - SADECE Super Admin */}
  {canManageStaff && (
  <div className="relative mb-4">
  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mevcut kullanici listesinden ara (Ad, email veya telefon)</label>
  <input
  type="text"
  placeholder="Isim, e-posta veya telefon ile ara..."
  aria-label="Kullanici listesinde ara"
  value={staffSearchQuery}
  onChange={(e) => searchStaff(e.target.value)}
  className="w-full px-4 py-2.5 bg-background text-foreground rounded-lg border border-input shadow-sm text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow outline-none"
  />
  {searchingStaff && (
  <div className="absolute right-3 top-9 w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
  )}
  {staffResults.length > 0 && (
  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden py-1">
  {staffResults.map(user => {
  const alreadyAssigned = assignedStaff.includes(user.id);
  return (
  <div key={user.id} className="border-b border-border last:border-0">
  <div className="flex items-start gap-3 px-4 py-3">
  <div className="w-8 h-8 rounded-full bg-cyan-600/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
  {(user.displayName || user.name || user.firstName || 'U').substring(0, 2).toUpperCase()}
  </div>
  <div className="flex-1 min-w-0">
  <p className="text-sm font-medium text-foreground">{user.displayName || user.name || user.firstName} {user.lastName || ''}</p>
  {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
  {/* Rol secim checkboxlari - super admin arama sonucunda */}
  <div className="flex flex-wrap gap-3 mt-2">
  {(['Personel', 'Surucu', 'Garson'] as const).map((rol, idx) => {
  const keys = ['isStaff', 'isDriver', 'isWaiter'] as const;
  return (
  <label key={rol} className="flex items-center gap-1 cursor-pointer select-none">
  <input
  type="checkbox"
  aria-label={`${user.displayName || user.name} - ${rol} olarak ata`}
  defaultChecked={idx === 0}
  id={`search-role-${user.id}-${rol}`}
  className="w-3.5 h-3.5 accent-cyan-500 rounded"
  onChange={e => {
  setNewStaffRoles(r => ({...r, [keys[idx]]: e.target.checked}));
  }}
  />
  <span className="text-xs text-foreground">{rol}</span>
  </label>
  );
  })}
  <label className="flex items-center gap-1 cursor-pointer select-none">
  <input
  type="checkbox"
  aria-label={`${user.displayName || user.name} - Kermes Admin olarak ata`}
  id={`search-role-${user.id}-admin`}
  className="w-3.5 h-3.5 accent-purple-500 rounded"
  onChange={e => setNewStaffRoles(r => ({...r, isKermesAdmin: e.target.checked}))}
  />
  <span className="text-xs font-semibold text-purple-300">K.Admin</span>
  </label>
  </div>
  </div>
  <button
  type="button"
  disabled={alreadyAssigned}
  onClick={() => {
  if (alreadyAssigned) return;
  setMatchedUser(user);
  handleAssignExistingUser(user);
  setStaffSearchQuery('');
  setStaffResults([]);
  }}
  className={`flex-shrink-0 mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
  alreadyAssigned
  ? 'bg-gray-200 dark:bg-gray-700 text-muted-foreground cursor-not-allowed'
  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
  }`}
  >
  {alreadyAssigned ? 'Zaten Atandi' : 'Ata'}
  </button>
  </div>
  </div>
  );
  })}
  </div>
  )}
  </div>
  )}

 {/* Atanmis Personel Listesi */}
 <div className="space-y-2">
 {assignedStaffDetails.map(staff => (
 <div key={staff.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 rounded-lg border ${
 staff.gender === 'female'
 ? 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800'
 : 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800'
 }`}>
 <div className="flex items-center gap-3 flex-1 min-w-0">
 {staff.photoURL || staff.profileImageUrl ? (
 <img src={staff.photoURL || staff.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
 ) : (
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
 staff.gender === 'female'
 ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400'
 : 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400'
 }`}>
 {(staff.displayName || staff.firstName || staff.name || staff.email || 'P').substring(0, 2).toUpperCase()}
 </div>
 )}
 <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
 <span className="text-sm font-medium text-foreground w-full md:w-auto mr-1 truncate">{staff.displayName || (staff.firstName ? `${staff.firstName} ${staff.lastName || ''}`.trim() : '') || staff.name || staff.email}</span>
 {assignedStaff.includes(staff.id) && (
 <span className="ml-2 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 rounded">Personel</span>
 )}
 {kermesAdmins.includes(staff.id) && (
 <span className="ml-1 text-xs text-purple-400 bg-purple-900/30 border border-purple-700/30 px-2 py-0.5 rounded font-semibold">Kermes Admin</span>
 )}
 {assignedDrivers.includes(staff.id) && (
 <span className="ml-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">Surucu</span>
 )}
 {assignedWaiters.includes(staff.id) && (
 <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">Garson</span>
 )}
 {/* Custom & Extended System Roles Badges */}
 {[...EXTENDED_SYSTEM_ROLES, ...(editForm.customRoles || [])].filter(r => (customRoleAssignments[r.id] || []).includes(staff.id)).map(r => (
   <span key={r.id} className={`ml-1 flex-shrink-0 whitespace-nowrap text-xs px-2 py-0.5 rounded ${r.color || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
     {r.name}
   </span>
 ))}
 {/* Auth Provider */}
 {authProviderMap[staff.id] && (
 <div className="flex gap-1 mt-0.5">
 {authProviderMap[staff.id].includes('google.com') && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
  <svg width="10" height="10" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  Google
  </span>
 )}
 {authProviderMap[staff.id].includes('password') && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20">
  Email
  </span>
 )}
 {authProviderMap[staff.id].includes('phone') && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">
  SMS
  </span>
 )}
 </div>
 )}
 </div>
 </div>
 <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 md:w-auto flex-shrink-0">
 <button 
 type="button" 
 onClick={() => {
 if (assignedWaiters.includes(staff.id)) {
 const newWaiters = assignedWaiters.filter(id => id !== staff.id);
 setAssignedWaiters(newWaiters);
 saveTeamToDb(assignedStaff, assignedDrivers, newWaiters, kermesAdmins);
 } else {
 const newWaiters = [...assignedWaiters, staff.id];
 setAssignedWaiters(newWaiters);
 saveTeamToDb(assignedStaff, assignedDrivers, newWaiters, kermesAdmins);
 }
 }}
 className={`w-7 h-7 rounded-sm overflow-hidden flex items-center justify-center text-xs font-semibold transition-colors ${
 assignedWaiters.includes(staff.id)
 ? 'bg-emerald-500 text-white hover:bg-emerald-600'
 : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600'
 }`}
 title={assignedWaiters.includes(staff.id) ? 'Garsonluktan Cikar' : 'Garson Olarak Ata'}
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12"/>
 <line x1="4" y1="12" x2="20" y2="12"/>
 <line x1="6" y1="17" x2="18" y2="17"/>
 </svg>
 </button>
 <button 
 type="button" 
 onClick={() => {
 if (assignedDrivers.includes(staff.id)) {
 const newDrivers = assignedDrivers.filter(id => id !== staff.id);
 setAssignedDrivers(newDrivers);
 saveTeamToDb(assignedStaff, newDrivers, assignedWaiters, kermesAdmins);
 } else {
 const newDrivers = [...assignedDrivers, staff.id];
 setAssignedDrivers(newDrivers);
 saveTeamToDb(assignedStaff, newDrivers, assignedWaiters, kermesAdmins);
 }
 }}
 className={`w-7 h-7 rounded-sm flex items-center justify-center text-xs font-semibold transition-colors ${
 assignedDrivers.includes(staff.id)
 ? 'bg-amber-500 text-white hover:bg-amber-600'
 : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600'
 }`}
 title={assignedDrivers.includes(staff.id) ? 'Suruculukten Cikar' : 'Surucu Olarak Ata'}
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
 </button>
  {/* Custom Roles Assignment */}
  {[...EXTENDED_SYSTEM_ROLES, ...(editForm.customRoles || [])].map(r => {
    const isAssigned = customRoleAssignments[r.id]?.includes(staff.id) || false;
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => {
          const currentAssigns = customRoleAssignments[r.id] || [];
          const newAssigns = { ...customRoleAssignments };
          if (isAssigned) {
            newAssigns[r.id] = currentAssigns.filter(id => id !== staff.id);
          } else {
            newAssigns[r.id] = [...currentAssigns, staff.id];
          }
          setCustomRoleAssignments(newAssigns);
          saveTeamToDb(assignedStaff, assignedDrivers, assignedWaiters, kermesAdmins, newAssigns);
        }}
        className={`w-7 h-7 rounded-sm flex items-center justify-center text-sm transition-colors border ${
          isAssigned
            ? 'bg-purple-500 text-white border-purple-600 hover:bg-purple-600'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 border-transparent'
        }`}
        title={`${r.name} ${isAssigned ? 'Görevinden Çıkar' : 'Olarak Ata'}`}
      >
        <span>{r.icon.startsWith('http') ? <img src={r.icon} alt={r.name} className="w-4 h-4 object-cover rounded" /> : r.icon}</span>
      </button>
    );
  })}
  {/* Kermes Admin Toggle - sadece canManageStaff */}
  {canManageStaff && (
  <button
    type="button"
    onClick={() => {
      if (kermesAdmins.includes(staff.id)) {
        const newAdmins = kermesAdmins.filter(id => id !== staff.id);
        setKermesAdmins(newAdmins);
        saveTeamToDb(assignedStaff, assignedDrivers, assignedWaiters, newAdmins);
        showToast(`${staff.displayName || staff.name || 'Personel'} admin yetkisi kaldirildi`, 'success');
      } else {
        const newAdmins = [...kermesAdmins, staff.id];
        setKermesAdmins(newAdmins);
        saveTeamToDb(assignedStaff, assignedDrivers, assignedWaiters, newAdmins);
        showToast(`${staff.displayName || staff.name || 'Personel'} Kermes Admin yapildi`, 'success');
      }
    }}
    className={`w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold transition-colors border ${
      kermesAdmins.includes(staff.id)
        ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 border-transparent'
    }`}
    title={kermesAdmins.includes(staff.id) ? 'Kermes Admin yetkisini kaldir' : 'Kermes Admin yap (personel yonetim yetkisi verir)'}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill={kermesAdmins.includes(staff.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  </button>
  )}
 <button 
 type="button" 
 onClick={() => setEditPersonData({
 id: staff.id,
 name: staff.displayName || (staff.firstName ? `${staff.firstName} ${staff.lastName || ''}`.trim() : '') || staff.name,
 email: staff.email || '',
 phone: staff.phone || staff.phoneNumber || '',
 gender: staff.gender || '',
 })}
 className="w-7 h-7 rounded-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center justify-center text-xs font-semibold transition-colors"
 title="Düzenle"
 >
 ✎
 </button>
 {/* Removing inline delete. Users must use the Edit popup. */}
 </div>
 </div>
 ))}

 {/* Surucu bilgi notu */}
 {assignedDrivers.length > 0 && (
 <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
 <p className="text-xs text-amber-700 dark:text-amber-400">
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1 -mt-0.5"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
 {assignedDrivers.length} {t('surucu_atandi_bilgi') || 'kisi surucu olarak atandi. Siparis teslimatlari bu kisilere yonlendirilecektir.'}
 </p>
 </div>
 )}
  {assignedStaff.length === 0 && (
  <div className="text-center py-8 text-muted-foreground">
  <div className="text-3xl mb-2">P</div>
  <p className="text-sm">{t('henuz_personel_yok') || 'Henuz personel atanmamis.'}</p>
  </div>
  )}
  </div>
  </div>
  </div>
  )}

   {/* Tab Content - Gorevler (Roles) */}
   {activeTab === 'gorevler' && (
   <div className="space-y-6">
    <div className="bg-card rounded-xl p-6 border border-border">
     <div className="flex items-center gap-3 mb-4">
      <span className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-xl">
       🛠️
      </span>
      <div>
       <h3 className="text-foreground font-bold text-lg">Kermes Görevleri</h3>
       <p className="text-sm text-muted-foreground">Bu kermese özel dinamik görev unvanları tanımlayın ve yönetin.</p>
      </div>
     </div>

     <div className="space-y-4">
      <h4 className="font-semibold text-sm border-b border-border pb-2">Sabit Sistem Görevleri (Kilitli)</h4>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">👥</span>
        <div>
         <div className="font-medium text-sm">Genel Personel</div>
         <div className="text-xs text-muted-foreground">Temel giriş yetkisi ve kermes listesini görme</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">🚗</span>
        <div>
         <div className="font-medium text-sm">Sürücü / Kurye</div>
         <div className="text-xs text-muted-foreground">Siparişleri teslim etme yetkisi</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">🍽️</span>
        <div>
         <div className="font-medium text-sm">Garson</div>
         <div className="text-xs text-muted-foreground">Masalara servis yapma yetkisi</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">👑</span>
        <div>
         <div className="font-medium text-sm">Kermes Admin</div>
         <div className="text-xs text-muted-foreground">Kermesi yönetme tam yetkisi</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">🧹</span>
        <div>
         <div className="font-medium text-sm">Temizlik Görevlisi</div>
         <div className="text-xs text-muted-foreground">Etkinlik alanı temizliği ve düzeni</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">🅿️</span>
        <div>
         <div className="font-medium text-sm">Park Görevlisi</div>
         <div className="text-xs text-muted-foreground">Araç park yönlendirme ve düzeni</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">👶</span>
        <div>
         <div className="font-medium text-sm">Çocuk Görevlisi</div>
         <div className="text-xs text-muted-foreground">Çocuk oyun alanı gözetimi</div>
        </div>
       </div>
       <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
        <span className="text-xl">⭐</span>
        <div>
         <div className="font-medium text-sm">Özel Misafir (VIP)</div>
         <div className="text-xs text-muted-foreground">Protokol ve özel misafir ağırlama</div>
        </div>
       </div>
      </div>

      <div className="mt-8">
       <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
        <h4 className="font-semibold text-sm">Özel Görevler (Dinamik)</h4>
        {isSuperAdmin && (
          <button 
            onClick={() => {
              setEditingCustomRole({
                id: 'role_' + Math.random().toString(36).substr(2, 9),
                name: '',
                icon: '📋',
                color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              });
            }}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition"
          >
            + Yeni Özel Görev Ekle
          </button>
        )}
       </div>
       
       {(editForm.customRoles || []).length === 0 ? (
         <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
           Henüz özel bir görev oluşturulmadı.
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {(editForm.customRoles || []).filter(r => !['role_temizlik_system', 'role_park_system'].includes(r.id)).map(r => {
              const canEditRole = isSuperAdmin;
              const canDeleteRole = isSuperAdmin;
              return (
             <div key={r.id} className="p-3 bg-background border border-border rounded-lg flex items-center justify-between">
               <div className="flex items-center gap-3">
                 {r.icon?.startsWith('http') ? (
                    <img src={r.icon} alt={r.name} className="w-6 h-6 object-cover rounded" />
                 ) : (
                    <span className="text-xl">{r.icon}</span>
                 )}
                 <span className="font-medium text-sm">{r.name}</span>
               </div>
               <div className="flex items-center gap-1">
                 {canEditRole && (
                     <button 
                       onClick={() => setEditingCustomRole(r)}
                       className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1.5 rounded transition"
                       title="Görev Düzenle"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                     </button>
                 )}
                 {canDeleteRole && (
                     <button 
                       onClick={async () => {
                         if (confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                           const newRoles = editForm.customRoles.filter(cr => cr.id !== r.id);
                           setEditForm(prev => ({ ...prev, customRoles: newRoles }));
                           try {
                             await updateDoc(doc(db, 'kermes_events', kermesId as string), { customRoles: newRoles });
                             showToast('Görev silindi', 'success');
                           } catch (e) {
                             console.error(e);
                             showToast('Silinirken hata oluştu', 'error');
                           }
                         }
                       }}
                       className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition"
                       title="Görevi Sil"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                     </button>
                 )}
               </div>
             </div>
            ); })}
         </div>
       )}
      </div>
      
      {/* Kaydetme Hatırlatıcısı */}
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded-lg">
        🚨 Yaptığınız görev değişikliklerinin geçerli olması için yukarıdaki <strong>"Kaydet"</strong> butonuna basmayı unutmayın.
      </div>
     </div>
    </div>
   </div>
   )}

   {/* Tab Content - Mutfak (PrepZone Istasyon Yonetimi) */}
   {activeTab === 'mutfak' && (
   <div className="space-y-4">
   <div className="bg-card rounded-xl p-4 border border-orange-500/20">
   <div className="flex items-center gap-3 mb-1">
   <span className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center text-sm">
   <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/></svg>
   </span>
   <div>
   <h3 className="text-foreground font-bold">Mutfak Istasyonlari</h3>
   <p className="text-xs text-muted-foreground">Her hazirlik alanina (PrepZone) personel atayin. Siparis geldiginde atanan personellerin ekranina dusecektir.</p>
   </div>
   </div>
   </div>

    {!showNewKitchenPanel ? (
      <button onClick={() => setShowNewKitchenPanel(true)} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-orange-500/30 text-orange-500 rounded-xl hover:bg-orange-500/10 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        <span className="font-medium">Yeni Mutfak / Üretim Alanı Ekle</span>
      </button>
    ) : (
      <div className="bg-card rounded-xl p-4 border border-orange-500/40">
        <h4 className="font-semibold text-foreground mb-3">Yeni Mutfak Bölümü Oluştur</h4>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Mutfak Adı</label>
            <input type="text" value={newKitchenName} onChange={e => setNewKitchenName(e.target.value)} placeholder="Örn: Tatlı Sepeti, Izgara Çadırı.." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Bu Mutfak Kimler İçin Hizmet Verecek? (Zorunlu Porsiyon Takibi İçin)</label>
            <div className="flex gap-2">
              <button onClick={() => setNewKitchenGender('women_only')} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${newKitchenGender === 'women_only' ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-background border-border text-muted-foreground hover:border-pink-500/50'}`}>Hanımlar Bölümü</button>
              <button onClick={() => setNewKitchenGender('men_only')} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${newKitchenGender === 'men_only' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-background border-border text-muted-foreground hover:border-blue-500/50'}`}>Beyler Bölümü</button>
              <button onClick={() => setNewKitchenGender('mixed')} className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${newKitchenGender === 'mixed' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-background border-border text-muted-foreground hover:border-indigo-500/50'}`}>Ortak (Karışık)</button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40 mt-1">
            <button onClick={() => { setShowNewKitchenPanel(false); setNewKitchenName(''); setNewKitchenGender('women_only'); }} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">İptal</button>
            <button 
              disabled={!newKitchenName.trim()}
              onClick={() => {
                const trimmed = newKitchenName.trim();
                // Check against ALL existing sections to prevent ID collisions
                if (kermesSectionDefs.some(s => s.name === trimmed)) { alert("Bu isimde bir bölüm zaten var!"); return; }
                const newSection = { name: trimmed, genderRestriction: newKitchenGender, hasDineIn: false, prepZones: [] };
                setKermesSectionDefs([...kermesSectionDefs, newSection]);
                setShowNewKitchenPanel(false);
                setNewKitchenName('');
                setNewKitchenGender('women_only');
              }} 
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Mutfak Oluştur
            </button>
          </div>
        </div>
      </div>
    )}

    {kermesSectionDefs.filter(s => s.hasDineIn === false || (s.prepZones && s.prepZones.length > 0)).length === 0 ? (
    <div className="text-center py-12 text-muted-foreground">
    <div className="text-4xl mb-3">
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-40"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/></svg>
    </div>
    <p className="text-sm font-medium">Henuz Mutfak veya Üretim Alanı eklemediniz.</p>
    <p className="text-xs mt-1">Yukarıdaki butona tıklayarak mutfak bölümlerini oluşturabilir, ardından onlara PrepZone (Hazırlık İstasyonu) ekleyebilirsiniz.</p>
    </div>
   ) : (
   <div className="space-y-4">
   {kermesSectionDefs.filter(s => s.hasDineIn === false || (s.prepZones && s.prepZones.length > 0)).map((section) => {
   const prepZones = section.prepZones || [];
   const isCustomSection = section.genderRestriction === 'mixed' && section.name !== 'Karisik / Aile';
   const genderIcon = section.genderRestriction === 'women_only' ? 'K' : section.genderRestriction === 'men_only' ? 'E' : isCustomSection ? section.name.charAt(0).toUpperCase() : 'A';
   const genderColor = section.genderRestriction === 'women_only'
    ? 'border-pink-500/30 bg-pink-500/5'
    : section.genderRestriction === 'men_only'
    ? 'border-blue-500/30 bg-blue-500/5'
    : 'border-indigo-500/30 bg-indigo-500/5';
   const badgeColor = section.genderRestriction === 'women_only'
    ? 'bg-pink-500/20 text-pink-400'
    : section.genderRestriction === 'men_only'
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-indigo-500/20 text-indigo-400';

   return (
   <div key={section.name} className={`rounded-xl border ${genderColor} overflow-hidden`}>
    {/* Section Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 group">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${badgeColor}`}>{genderIcon}</span>
        <h4 className="text-foreground font-semibold">{section.name}</h4>
        <span className="text-xs text-muted-foreground ml-1">({prepZones.length} istasyon)</span>
      </div>
      {isSuperAdmin && (
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" title="Bölüm ismini düzenle (Rename)" onClick={() => {
          const newName = prompt('Yeni bölüm ismi:', section.name);
          if (!newName || newName.trim() === '' || newName.trim() === section.name) return;
          const trimmed = newName.trim();
          if (kermesSectionDefs.some(s => s.name === trimmed)) { showToast('Bu isimde başka bir bölüm zaten var!', 'error'); return; }
          const newDefs = kermesSectionDefs.map(d => d.name === section.name ? { ...d, name: trimmed } : d);
          setKermesSectionDefs(newDefs);
          updateDoc(doc(db, 'kermes_events', kermesId as string), { tableSectionsV2: newDefs })
            .then(() => showToast(`Bölüm adı güncellendi`, 'success'))
            .catch(() => showToast('Hata oluştu', 'error'));
        }} className="w-6 h-6 flex items-center justify-center rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button type="button" title="Bölümü Sil" onClick={() => {
          // Kadin Bolumu ve Erkek Bolumu cannot be deleted! (Only super admin sees this button, but still prevent deleting default main sections)
          if (['Kadin Bölümü', 'Erkek Bölümü'].includes(section.name)) {
            showToast('Ana sistem bölümleri ("Kadin Bölümü", "Erkek Bölümü") silinemez!', 'error');
            return;
          }
          if (prepZones.length > 0) {
            showToast('Önce bu bölüm içindeki istasyonları (PrepZone) silmelisiniz!', 'error');
            return;
          }
          if (!confirm(`"${section.name}" bölümünü silmek istediğinize emin misiniz?`)) return;
          const newDefs = kermesSectionDefs.filter(d => d.name !== section.name);
          setKermesSectionDefs(newDefs);
          updateDoc(doc(db, 'kermes_events', kermesId as string), { tableSectionsV2: newDefs })
            .then(() => showToast(`Bölüm silindi`, 'success'))
            .catch(() => showToast('Hata oluştu', 'error'));
        }} className="w-6 h-6 flex items-center justify-center rounded bg-red-500/10 text-red-500 hover:bg-red-500/20">
           <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
      )}
    </div>

    {prepZones.length === 0 ? (
    <div className="px-4 py-4 text-center text-muted-foreground">
    <p className="text-sm">Bu bolumde henuz hazirlik alani yok.</p>
    <p className="text-xs mt-1 mb-3">Asagidan yeni PrepZone ekleyebilirsiniz.</p>
    </div>
    ) : (
    <div className="p-4 space-y-3">
    {prepZones.map((zone) => {
     const assignedIds = prepZoneAssignments[zone] || [];
     const assignedDetails = assignedIds.map(id => assignedStaffDetails.find((s: any) => s.id === id)).filter(Boolean);
     // Cinsiyete uygun personelleri filtrele
     const eligibleStaff = assignedStaffDetails.filter((s: any) => {
      if (section.genderRestriction === 'women_only') return s.gender === 'female';
      if (section.genderRestriction === 'men_only') return s.gender === 'male';
      return true;
     });

     return (
     <div key={zone} className="bg-card rounded-lg border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
       <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-bold">{zone}</span>
       <span className="text-sm text-foreground font-medium">Istasyon</span>
       <button type="button" title="Istasyon ismini duzenle" onClick={() => {
        const newName = prompt('Yeni istasyon ismi:', zone);
        if (!newName || newName.trim() === '' || newName.trim() === zone) return;
        const trimmed = newName.trim();
        const allZones = kermesSectionDefs.flatMap((d: any) => d.prepZones || []);
        if (allZones.includes(trimmed)) { showToast('Bu isim baska bir bolumde zaten var. Lutfen "Grill E" veya "Grill K" gibi benzersiz bir isim girin.', 'error'); return; }
        const newDefs = kermesSectionDefs.map((d: any) => d.name === section.name ? { ...d, prepZones: (d.prepZones || []).map((z: string) => z === zone ? trimmed : z) } : d);
        setKermesSectionDefs(newDefs);
        const newAssigns = { ...prepZoneAssignments };
        if (newAssigns[zone]) { newAssigns[trimmed] = newAssigns[zone]; delete newAssigns[zone]; }
        setPrepZoneAssignments(newAssigns);
        updateDoc(doc(db, 'kermes_events', kermesId as string), { tableSectionsV2: newDefs, prepZoneAssignments: newAssigns })
         .then(() => showToast(`"${zone}" -> "${trimmed}"`, 'success'))
         .catch(() => showToast('Guncelleme hatasi', 'error'));
       }} className="w-5 h-5 flex items-center justify-center rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
       </button>
      </div>
      <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{assignedIds.length} personel atandi</span>
      <button onClick={async () => {
       if (!confirm(`"${zone}" istasyonunu silmek istediginizden emin misiniz?`)) return;
       const newDefs = kermesSectionDefs.map((d: any) => d.name === section.name ? { ...d, prepZones: (d.prepZones || []).filter((z: string) => z !== zone) } : d);
       setKermesSectionDefs(newDefs);
       const newAssigns = { ...prepZoneAssignments };
       delete newAssigns[zone];
       setPrepZoneAssignments(newAssigns);
       try {
        await updateDoc(doc(db, 'kermes_events', kermesId as string), { tableSectionsV2: newDefs, prepZoneAssignments: newAssigns });
        showToast(`${zone} silindi`, 'success');
       } catch (err) { console.error(err); showToast('Hata', 'error'); }
      }} className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold" title="PrepZone sil">x</button>
      </div>
      </div>

      {/* Atanan personeller */}
      {assignedDetails.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-2">
       {assignedDetails.map((staff: any) => (
       <span key={staff.id} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-md text-xs">
        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${staff.gender === 'female' ? 'bg-pink-500/30 text-pink-300' : 'bg-blue-500/30 text-blue-300'}`}>
        {staff.gender === 'female' ? 'K' : 'E'}
        </span>
        <span className="text-foreground">{staff.displayName || staff.email}</span>
        <button
        onClick={async () => {
         const newIds = assignedIds.filter((id: string) => id !== staff.id);
         const newAssignments = { ...prepZoneAssignments, [zone]: newIds };
         if (newIds.length === 0) delete newAssignments[zone];
         setPrepZoneAssignments(newAssignments);
         try {
         await updateDoc(doc(db, 'kermes_events', kermesId as string), { prepZoneAssignments: newAssignments });
         } catch (e) { console.error('PrepZone atama hatasi:', e); }
        }}
        className="ml-0.5 text-red-400 hover:text-red-300 font-bold"
        >x</button>
       </span>
       ))}
      </div>
      )}

      {/* Personel atama dropdown */}
      <select
       title={`${zone} istasyonuna personel ata`}
       value=""
       onChange={async (e) => {
       const staffId = e.target.value;
       if (!staffId) return;
       const newIds = [...assignedIds, staffId];
       const newAssignments = { ...prepZoneAssignments, [zone]: newIds };
       setPrepZoneAssignments(newAssignments);
       try {
        await updateDoc(doc(db, 'kermes_events', kermesId as string), { prepZoneAssignments: newAssignments });
        showToast('Personel istasyona atandi', 'success');
       } catch (e) {
        console.error('PrepZone atama hatasi:', e);
        showToast('Atama basarisiz', 'error');
       }
       }}
       className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-orange-500"
      >
       <option value="">+ Personel ata...</option>
       {eligibleStaff
       .filter((s: any) => !assignedIds.includes(s.id))
       .map((s: any) => (
        <option key={s.id} value={s.id}>{s.displayName || s.email} ({s.gender === 'female' ? 'Kadin' : 'Erkek'})</option>
       ))
       }
      </select>
     </div>
     );
    })}
    </div>
    )}

    {/* PrepZone Ekleme */}
    <div className="px-4 pb-3">
    <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
    <p className="text-xs font-semibold text-orange-400/80 mb-2">+ Yeni PrepZone Ekle</p>
    <div className="flex gap-1.5">
    <input type="text" placeholder={`Orn: P${kermesSectionDefs.flatMap(d => d.prepZones || []).length + 1}`}
    className="flex-1 bg-background text-foreground text-xs px-2 py-1.5 rounded-md border border-input focus:border-orange-500 focus:outline-none"
    id={`pz-mutfak-input-${section.name.replace(/\s/g, '_')}`}
    onKeyDown={async (e) => {
    if (e.key === 'Enter') {
     const val = (e.target as HTMLInputElement).value.trim();
     const allZones = kermesSectionDefs.flatMap(d => d.prepZones || []);
     const newName = val || `P${allZones.length + 1}`;
     if (allZones.includes(newName)) { showToast("Bu isim baska bir bolumde zaten var. Lutfen 'Grill E' gibi benzersiz bir isim secin.", "error"); return; }
     const newDefs = kermesSectionDefs.map(d => d.name === section.name ? { ...d, prepZones: [...(d.prepZones || []), newName] } : d);
     setKermesSectionDefs(newDefs);
     try {
      await updateDoc(doc(db, 'kermes_events', kermesId as string), { tableSectionsV2: newDefs });
      showToast(`${newName} eklendi`, 'success');
     } catch (err) { console.error('PrepZone ekleme hatasi:', err); showToast('Hata olustu', 'error'); }
     (e.target as HTMLInputElement).value = '';
    }
    }} />
    <button onClick={async () => {
    const input = document.getElementById(`pz-mutfak-input-${section.name.replace(/\s/g, '_')}`) as HTMLInputElement;
    const val = input?.value.trim();
    const allZones = kermesSectionDefs.flatMap(d => d.prepZones || []);
    const newName = val || `P${allZones.length + 1}`;
    if (allZones.includes(newName)) { showToast("Bu isim baska bir bolumde zaten var. Lutfen 'Grill E' gibi benzersiz bir isim secin.", "error"); return; }
    const newDefs = kermesSectionDefs.map(d => d.name === section.name ? { ...d, prepZones: [...(d.prepZones || []), newName] } : d);
    setKermesSectionDefs(newDefs);
    try {
     await updateDoc(doc(db, 'kermes_events', kermesId as string), { tableSectionsV2: newDefs });
     showToast(`${newName} eklendi`, 'success');
    } catch (err) { console.error('PrepZone ekleme hatasi:', err); showToast('Hata olustu', 'error'); }
    if (input) input.value = '';
    }} className="px-2.5 py-1.5 bg-orange-600/80 hover:bg-orange-500 text-white text-xs rounded-md transition font-medium" title="Bos birakinca otomatik numara atar">+</button>
    </div>
    <p className="text-[10px] text-muted-foreground/50 mt-1">Bos birakip + basinca otomatik P-numara atanir. Isim girip Enter'a basabilirsiniz.</p>
    </div>
    </div>
   </div>
   );
   })}

   {/* Ozet: Kac kisi hangi istasyona atanmis */}
   {Object.keys(prepZoneAssignments).length > 0 && (
   <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Atama Ozeti</p>
    <div className="flex flex-wrap gap-2">
    {Object.entries(prepZoneAssignments).map(([zone, ids]) => (
     <span key={zone} className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-foreground">
     <strong>{zone}</strong>: {ids.length} kisi
     </span>
    ))}
    </div>
   </div>
   )}
   </div>
   )}
   </div>
   )}

   {/* Tab Content - Masalar */}
   {activeTab === 'masalar' && (
   <div className="space-y-4">
  <div className="bg-card rounded-xl p-4 border border-amber-500/20">
  <div className="flex items-center gap-3 mb-1">
  <span className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center text-sm">🪑</span>
  <div>
  <h3 className="text-foreground font-bold">Masa Planı</h3>
  <p className="text-xs text-muted-foreground">Bu Kermes etkinliği için masa düzenini, bölümleri ve QR kodlarını yönetin.</p>
  </div>
  </div>
  </div>
  <TableManagementPanel
  businessId={kermesId}
  businessName={kermes?.title || ''}
  collectionPath="kermes_events"
  qrBaseUrl="https://lokma.web.app/kermes"
  isKermes={true}
  sponsorLogos={
  (kermes?.activeBadgeIds || [])
   .map((bid: string) => availableBadges.find((b: any) => b.id === bid))
   .filter((b: any) => b && b.iconUrl)
   .map((b: any) => ({ iconUrl: b.iconUrl, name: b.name || '', bgColor: b.bgColor }))
  }
  />
  </div>
  )}

{/* Tab Content - Siparisler */}
   {activeTab === 'siparisler' && (
     <KermesSiparislerTab kermesId={kermesId} />
   )}

  {/* Tab Content - Menu */}
 {activeTab === 'menu' && (
 <div className="bg-card rounded-xl p-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-foreground font-bold">{t('kermes_menusu')}</h3>
 <div className="flex gap-2">
 {products.some(p => p.stockEnabled) && (
 <button onClick={handleDayStart}
 className="px-3 py-2 bg-amber-600/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-600/40 flex items-center gap-1"
 title="Tum stok takipli urunlerin stogunu baslangic degerine sifirlar">
 <span className="material-symbols-outlined text-base">restart_alt</span> Gun Basla
 </button>
 )}
 <button onClick={() => setShowCategoryModal(true)}
 className="px-3 py-2 bg-purple-600/20 text-purple-800 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-600/40">
 {t('kategori_ekle')}
 </button>
 <button onClick={() => { setShowAddModal(true); setModalView('select'); }}
 className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm font-medium">
 {t('urun_ekle')}
 </button>
 </div>
 </div>

 {/* Kategori Tab'ları - TÜM Kategoriler */}
 <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-border">
 <button
 onClick={() => setSelectedCategory('')}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedCategory === ''
 ? 'bg-pink-600 text-white'
 : 'bg-muted/50 text-foreground/90 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
 }`}>
 {t('tumu')} ({products.length})
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
 ? 'bg-muted/50 text-foreground/90 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
 : 'bg-card text-muted-foreground/80 hover:bg-gray-700 border border-gray-600 border-dashed'
 }`}>
 {getCategoryEmoji(category)} {category} ({count})
 </button>
 );
 })}
 </div>

 {products.length === 0 ? (
 <div className="text-center py-8">
 <p className="text-4xl mb-3">🍽️</p>
 <p className="text-muted-foreground mb-4">{t('henuz_menude_urun_yok')}</p>
 <button onClick={() => { setShowAddModal(true); setModalView('select'); }}
 className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm">
 {t('i_lk_urunu_ekle')}
 </button>
 </div>
 ) : (
 <div className="space-y-4">
 {Object.entries(productsByCategory)
 .filter(([category]) => !selectedCategory || category === selectedCategory)
 .map(([category, items]) => (
 <div key={category}>
 <h4 className="text-pink-800 dark:text-pink-400 text-sm font-medium mb-2">{getCategoryEmoji(category)} {category}</h4>
 <div className="space-y-2">
 {items.map((product) => (
 <div key={product.id} className={`bg-gray-700 rounded-lg p-3 ${!product.isAvailable ? 'opacity-60' : ''}`}>
 <div className="flex items-center justify-between cursor-pointer hover:bg-gray-600/50 rounded -m-1 p-1 transition"
 onClick={() => setEditProduct({
 product,
 price: product.price,
 costPrice: product.costPrice || 0,
 discountPrice: product.discountPrice || 0,
 category: product.category,
 unit: product.unit || t('adet'),
 secondaryName: product.secondaryName || '',
 description: typeof product.description === 'object' ? getLocalizedText(product.description, locale) : (product.description || ''),
 detailedDescription: product.detailedDescription || '',
 allergens: Array.isArray(product.allergens) ? product.allergens : [],
 ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
 imageUrls: product.imageUrls || [],
 newAllergen: '',
 newIngredient: '',
 prepZone: product.prepZone || [],
 serviceType: product.serviceType || 'prepped',
 counterAvailability: product.counterAvailability || 'all',
  optionGroups: product.optionGroups || [],
 })}>
 <div className="flex items-center gap-3">
 {product.imageUrls && product.imageUrls.length > 0 ? (
 <img src={product.imageUrls[0]} alt={product.name} className="w-8 h-8 rounded-full object-cover border border-gray-600" />
 ) : (
 <div className="w-8 h-8 rounded-full bg-gray-600/50 border border-gray-500/50 flex items-center justify-center">
 <span className="text-[10px]">🍽️</span>
 </div>
 )}
 <span className="text-foreground font-medium">{getLocalizedText(product.name, locale)}</span>
 {product.isCustom && <span className="px-2 py-0.5 bg-purple-600/30 text-purple-800 dark:text-purple-400 rounded text-xs">{t('ozel')}</span>}
 {product.sourceType === 'master' && <span className="px-2 py-0.5 bg-blue-600/30 text-blue-800 dark:text-blue-400 rounded text-xs">{t('barcode')}</span>}
 <span className="text-green-800 dark:text-green-400 font-bold">{(Number(product.price) || 0).toFixed(2)} EUR</span>
 <span className="text-muted-foreground/80 text-xs">{t('duzenle')}</span>
 </div>
 <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
 <button onClick={() => handleToggleAvailability(product)}
 className={`px-2 py-1 rounded text-xs ${product.isAvailable ? 'bg-green-600/30 text-green-800 dark:text-green-400' : 'bg-red-600/30 text-red-800 dark:text-red-400'}`}>
 {product.isAvailable ? 'Mevcut' : t('tukendi')}
 </button>
 <button onClick={() => handleDeleteProduct(product)} className="px-2 py-1 bg-red-600/20 text-red-800 dark:text-red-400 hover:bg-red-600/40 rounded text-xs">
 <span className="material-symbols-outlined text-sm">delete</span>
 </button>
 </div>
 </div>
 {/* Stok Kontrolleri */}
 <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-600" onClick={(e) => e.stopPropagation()}>
 {/* Stok Takip Toggle */}
 <button
 onClick={() => handleToggleStockEnabled(product)}
 className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
 product.stockEnabled
 ? 'bg-cyan-600/30 text-cyan-300'
 : 'bg-gray-600 text-gray-400'
 }`}
 title="Stok takibini ac/kapat">
 <span className="material-symbols-outlined text-sm">inventory_2</span>
 {product.stockEnabled ? 'Stok Takip' : 'Stok Kapat'}
 </button>

 {product.stockEnabled && (
 <>
 {/* Artir/Azalt */}
 <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1">
 <button onClick={() => handleStockAdjust(product, -1)}
 className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-600/30 rounded font-bold text-lg">-</button>
 {editingStockId === product.id ? (
 <input
 type="number"
 value={editingStockValue}
 onChange={e => setEditingStockValue(e.target.value)}
 onBlur={() => { handleStockSet(product, parseInt(editingStockValue) || 0); }}
 onKeyDown={(e) => { if (e.key === 'Enter') handleStockSet(product, parseInt(editingStockValue) || 0); }}
 className="w-14 text-center bg-transparent text-white font-bold text-sm focus:outline-none"
 aria-label="Stok miktari"
 placeholder="0"
 autoFocus
 />
 ) : (
 <button
 onClick={() => { setEditingStockId(product.id); setEditingStockValue(String(product.currentStock || 0)); }}
 className="w-14 text-center text-white font-bold text-sm hover:bg-gray-700 rounded py-1"
 title="Tiklayarak stogu degistir">
 {product.currentStock ?? 0}
 </button>
 )}
 <button onClick={() => handleStockAdjust(product, 1)}
 className="w-7 h-7 flex items-center justify-center text-green-400 hover:bg-green-600/30 rounded font-bold text-lg">+</button>
 </div>

 {/* Baslangic Stok / Kalan gostergesi */}
 <span className={`text-xs px-2 py-1 rounded ${
 (product.currentStock || 0) <= (product.lowStockThreshold || 5) && (product.currentStock || 0) > 0
 ? 'bg-amber-600/30 text-amber-400'
 : (product.currentStock || 0) <= 0
 ? 'bg-red-600/30 text-red-400'
 : 'bg-gray-600 text-gray-300'
 }`}>
 {product.initialStock ? `${product.currentStock ?? 0} / ${product.initialStock}` : `${product.currentStock ?? 0} adet`}
 </span>

 {/* Tukendi Butonu */}
 {(product.currentStock || 0) > 0 && (
 <button onClick={() => handleMarkSoldOut(product)}
 className="px-2 py-1 bg-red-700/40 text-red-300 hover:bg-red-700/60 rounded text-xs flex items-center gap-1"
 title="Tukendi olarak isaretle">
 <span className="material-symbols-outlined text-sm">block</span> Tukendi
 </button>
 )}

 {/* Baslangic Stok Ayarla (eger 0 ise) */}
 {(!product.initialStock || product.initialStock === 0) && (
 <button onClick={() => {
 const val = prompt('Baslangic stok (adet):', '50');
 if (val) handleSetInitialStock(product, parseInt(val));
 }} className="px-2 py-1 bg-blue-600/30 text-blue-300 rounded text-xs flex items-center gap-1">
 <span className="material-symbols-outlined text-sm">edit</span> Bas.Stok
 </button>
 )}
 </>
 )}

 {/* Satis Gecmisi Butonu - her zaman gozukur */}
 <button onClick={() => handleLoadSalesHistory(product)}
 className="ml-auto px-2 py-1 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 rounded text-xs flex items-center gap-1"
 title="Satis gecmisi ve istatistikler">
 <span className="material-symbols-outlined text-sm">bar_chart</span> Gecmis
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
 )}
 </div>

  {/* Category Modal */}
  {showCategoryModal && (
    <CategoryManagementModal 
      onClose={() => setShowCategoryModal(false)}
      onCategoriesUpdated={loadCategories}
      locale={locale}
    />
  )}

 {/* Add Product Modal */}
 {showAddModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
 <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
 <div className="p-4 border-b border-border flex items-center justify-between">
 <div className="flex items-center gap-3">
 {modalView !== 'select' && <button onClick={() => setModalView('select')} className="text-muted-foreground hover:text-white">←</button>}
 <h2 className="text-lg font-bold text-foreground">
 {modalView === 'select' && t('urun_ekle')}
 {modalView === 'catalog' && t('kermes_katalogu')}
 {modalView === 'master' && '📦 Master Katalog (Barkodlu)'}
 {modalView === 'custom' && t('ozel_urun')}
 </h2>
 </div>
 <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-white text-xl">✕</button>
 </div>

 <div className="flex-1 overflow-y-auto p-4">
 {modalView === 'select' && (
 <div className="grid grid-cols-3 gap-4">
 <button onClick={() => setModalView('catalog')} className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 text-left">
 <div className="text-3xl mb-2">🎪</div>
 <h3 className="text-foreground font-bold">{t('kermes_katalogu')}</h3>
 <p className="text-muted-foreground text-sm">{t('hazir_yemek_listesi')}</p>
 </button>
 <button onClick={() => { setModalView('master'); loadMasterProducts(); }} className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 text-left">
 <div className="text-3xl mb-2">📦</div>
 <h3 className="text-foreground font-bold">{t('master_catalog')}</h3>
 <p className="text-muted-foreground text-sm">{t('barkodlu_urunler')}</p>
 </button>
 <button onClick={() => setModalView('custom')} className="bg-gray-700 hover:bg-gray-600 rounded-xl p-6 text-left">
 <div className="text-3xl mb-2">✨</div>
 <h3 className="text-foreground font-bold">{t('ozel_urun')}</h3>
 <p className="text-muted-foreground text-sm">{t('kendi_urununuzu_ekleyin')}</p>
 </button>
 </div>
 )}

 {modalView === 'catalog' && (
 <>
 <div className="flex gap-2 mb-4">
 <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ara..."
 className="flex-1 px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm" />
 <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
 className="px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm">
 <option value="">{t('tumu')}</option>
 {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
 </select>
 </div>
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {filteredCatalog.map((item) => {
 const isAdded = products.some(p => p.masterSku === item.sku);
 return (
 <div key={item.sku} className={`bg-gray-700 rounded-lg p-3 flex items-center justify-between ${isAdded ? 'opacity-50' : ''}`}>
 <div>
 <span className="text-foreground">{getLocalizedText(item.name, locale)}</span>
 <span className="text-muted-foreground/80 text-sm ml-2">{item.category}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-green-800 dark:text-green-400 font-bold">{item.defaultPrice.toFixed(2)} €</span>
 {isAdded ? <span className="text-muted-foreground text-xs">✓</span> : (
 <button onClick={() => handleSelectFromCatalog(item)} disabled={saving}
 className="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded text-sm disabled:opacity-50">{t('ekle')}</button>
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
 <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('urun_adi_veya_barkod_ile_ara')}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-sm" />
 </div>
 {loadingMaster ? (
 <div className="text-center py-8 text-muted-foreground">{t('yukleniyor')}</div>
 ) : filteredMaster.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 {masterProducts.length === 0 ? t('master_katalog_bos') : t('sonuc_bulunamadi')}
 </div>
 ) : (
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {filteredMaster.map((item) => {
 const isAdded = products.some(p => p.masterSku === item.id);
 return (
 <div key={item.id} className={`bg-gray-700 rounded-lg p-3 flex items-center justify-between ${isAdded ? 'opacity-50' : ''}`}>
 <div>
 <span className="text-foreground">{getLocalizedText(item.name, locale)}</span>
 {item.barcode && <span className="text-muted-foreground/80 text-xs ml-2">#{item.barcode}</span>}
 </div>
 <div className="flex items-center gap-3">
 {item.defaultPrice && <span className="text-green-800 dark:text-green-400 font-bold">{item.defaultPrice.toFixed(2)} €</span>}
 {isAdded ? <span className="text-muted-foreground text-xs">✓</span> : (
 <button onClick={() => handleSelectFromMaster(item)} disabled={saving}
 className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm disabled:opacity-50">{t('ekle')}</button>
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
 <label className="text-muted-foreground text-sm block mb-1">{t('urun_adi')}</label>
 <input type="text" value={customProduct.name} onChange={(e) => setCustomProduct({ ...customProduct, name: e.target.value })}
 placeholder={t('orn_ev_yapimi_baklava')} className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('kategori')}</label>
 <select value={customProduct.category} onChange={(e) => setCustomProduct({ ...customProduct, category: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow">
 {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
 </select>
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-1">{t('price_eur')}</label>
 <input type="number" step="0.50" min="0" value={customProduct.price || ''} onChange={(e) => setCustomProduct({ ...customProduct, price: parseFloat(e.target.value) || 0 })}
 placeholder="0.00" className="w-full px-3 py-2 bg-gray-700 text-white text-xl font-bold rounded-lg border border-gray-600" />
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-1">Hangi İstasyonlarda Hazırlanıyor? (Opsiyonel)</label>
 <PrepZoneSelector value={customProduct.prepZone || []} onChange={(val) => setCustomProduct({ ...customProduct, prepZone: val })} products={products} sectionDefs={kermesSectionDefs} />
 </div>
 <button onClick={handleCreateCustom} disabled={saving || !customProduct.name.trim() || customProduct.price <= 0}
 className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium disabled:opacity-50">
 {saving ? t('olusturuluyor') : t('olustur_ve_ekle')}
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
 <div className="bg-card rounded-2xl w-full max-w-md p-6">
 <h2 className="text-lg font-bold text-foreground mb-4">
 {t('urun_ekle')} {editBeforeAdd.type === 'catalog'
 ? (editBeforeAdd.item as KermesMenuItemData).name
 : (editBeforeAdd.item as MasterProduct).name}
 </h2>
 <div className="space-y-4">
 <div>
 <label className="text-muted-foreground text-sm block mb-2">{t('menu_kategorisi')}</label>
 <select value={editBeforeAdd.category} onChange={(e) => setEditBeforeAdd({ ...editBeforeAdd, category: e.target.value })}
 className="w-full px-4 py-3 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow">
 {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
 </select>
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-2">{t('kermes_fiyati')}</label>
 <input type="number" step="0.50" min="0" value={editBeforeAdd.price || ''}
 onChange={(e) => setEditBeforeAdd({ ...editBeforeAdd, price: parseFloat(e.target.value) || 0 })}
 className="w-full px-4 py-3 bg-gray-700 text-white text-xl font-bold rounded-lg border border-gray-600" placeholder="0.00" />
 <p className="text-muted-foreground/80 text-xs mt-1">
 {t('varsayilan')} {editBeforeAdd.type === 'catalog'
 ? (editBeforeAdd.item as KermesMenuItemData).defaultPrice.toFixed(2)
 : ((editBeforeAdd.item as MasterProduct).defaultPrice || 0).toFixed(2)} €
 </p>
 </div>
 <div>
 <label className="text-muted-foreground text-sm block mb-2">Hangi İstasyonlarda Hazırlanıyor? (Opsiyonel)</label>
 <PrepZoneSelector value={editBeforeAdd.prepZone || []} onChange={(val) => setEditBeforeAdd({ ...editBeforeAdd, prepZone: val })} products={products} sectionDefs={kermesSectionDefs} />
 </div>
 </div>
 <div className="flex gap-3 mt-6">
 <button onClick={() => setEditBeforeAdd(null)} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium">{t('cancel_btn')}</button>
 <button onClick={handleConfirmAdd} disabled={saving || editBeforeAdd.price <= 0}
 className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium disabled:opacity-50">
 {saving ? '⏳ Ekleniyor...' : t('menuye_ekle')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Mevcut Ürün Düzenleme Modalı - Geliştirilmiş */}
 {editProduct && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
 <div className="bg-card rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="sticky top-0 bg-card px-6 py-4 border-b border-border flex items-center justify-between">
 <h2 className="text-lg font-bold text-foreground">
 {t('duzenle')} {getLocalizedText(editProduct.product.name, locale)}
 </h2>
 <button onClick={() => setEditProduct(null)} className="text-muted-foreground hover:text-white text-xl">×</button>
 </div>

 <div className="p-6 space-y-5">
 {/* Ürün Görseli (Elit Modası Upload) */}
 <div className="bg-muted/80 dark:bg-muted/20 border border-border rounded-xl p-4">
 <h3 className="text-foreground text-sm font-medium mb-3 flex items-center justify-between">
 <span>📸 {t('urun_gorseli') || 'Ürün Görseli'}</span>
 </h3>
 <div className="flex items-center gap-4">
 <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-500 overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
 {editProduct.imageUrls && editProduct.imageUrls.length > 0 ? (
 <img src={editProduct.imageUrls[0]} alt="Product" className="w-full h-full object-cover" />
 ) : (
 <span className="text-3xl opacity-50">🍽️</span>
 )}
 {isUploadingProductImage && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
 <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
 </div>
 )}
 </div>
 <div className="flex-1">
 <p className="text-xs text-muted-foreground mb-2">
 Ürüne ait iştah açıcı ve elit bir görsel yükleyin. Bu görsel detay sayfasında büyük, listelerde zarif bir şekilde gösterilecektir. Minimum 800x800px önerilir.
 </p>
 <label className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg cursor-pointer transition shadow-lg text-sm font-medium">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
 {isUploadingProductImage ? 'Yükleniyor...' : 'Görsel Seç & Yükle'}
 <input 
 type="file" 
 className="hidden" 
 accept="image/*"
 disabled={isUploadingProductImage}
 onChange={async (e) => {
 if (!e.target.files || !e.target.files[0]) return;
 try {
 setIsUploadingProductImage(true);
 const file = e.target.files[0];
 
 // Resim boyutlandirma islemi
 const resizedBlob = await new Promise<Blob>((resolve, reject) => {
 const img = new Image();
 img.onload = () => {
 const canvas = document.createElement('canvas');
 const MAX_WIDTH = 800;
 const MAX_HEIGHT = 800;
 let width = img.width;
 let height = img.height;

 if (width > height) {
 if (width > MAX_WIDTH) {
 height = Math.round((height * MAX_WIDTH) / width);
 width = MAX_WIDTH;
 }
 } else {
 if (height > MAX_HEIGHT) {
 width = Math.round((width * MAX_HEIGHT) / height);
 height = MAX_HEIGHT;
 }
 }

 canvas.width = width;
 canvas.height = height;
 const ctx = canvas.getContext('2d');
 ctx?.drawImage(img, 0, 0, width, height);

 canvas.toBlob((blob) => {
 if (blob) resolve(blob);
 else reject(new Error('Canvas to Blob hatasi'));
 }, file.type, 0.85);
 };
 img.onerror = (err) => reject(err);
 img.src = URL.createObjectURL(file);
 });

 const fileExt = file.name.split('.').pop() || 'jpg';
 const fileName = `product_${Date.now()}.${fileExt}`;
 const storageRef = ref(storage, `kermes/${kermesId}/products/${fileName}`);
 await uploadBytes(storageRef, resizedBlob);
 const url = await getDownloadURL(storageRef);
 setEditProduct({ ...editProduct, imageUrls: [url] });
 showToast('Görsel başarıyla yüklendi', 'success');
 } catch (error) {
 console.error('Upload Error:', error);
 showToast('Görsel yüklenirken bir hata oluştu', 'error');
 } finally {
 setIsUploadingProductImage(false);
 }
 }}
 />
 </label>
 {editProduct.imageUrls && editProduct.imageUrls.length > 0 && (
 <button 
 type="button" 
 onClick={() => setEditProduct({ ...editProduct, imageUrls: [] })}
 className="ml-3 text-xs text-red-400 hover:text-red-300 transition underline"
 >
 Görseli Kaldır
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Fiyat Bilgileri */}
 <div className="bg-muted/80 dark:bg-muted/20 border border-border rounded-xl p-4">
 <h3 className="text-foreground text-sm font-medium mb-3">💰 Fiyat Bilgileri</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('satis_fiyati')}</label>
 <input type="number" step="0.50" min="0" value={editProduct.price || ''}
 onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-green-800 dark:text-green-400 text-xl font-bold rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-green-500/50" placeholder="0.00" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">
 {t('indirimli_fiyat') || '⚡ İndirimli Fiyat (€)'}
 </label>
 <input type="number" step="0.50" min="0" value={editProduct.discountPrice || ''}
 onChange={(e) => setEditProduct({ ...editProduct, discountPrice: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-pink-600 dark:text-pink-400 text-xl font-bold rounded-lg border border-pink-500/50 focus:outline-none focus:ring-2 focus:ring-pink-500/50" placeholder="0.00" />
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('maliyet_fiyati')}</label>
 <input type="number" step="0.10" min="0" value={editProduct.costPrice || ''}
 onChange={(e) => setEditProduct({ ...editProduct, costPrice: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 bg-background text-amber-800 dark:text-amber-400 text-lg font-medium rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-amber-500/50" placeholder="0.00" />
 {editProduct.costPrice > 0 && editProduct.price > 0 && (
 <p className="text-xs text-muted-foreground/80 mt-1">
 Kar: {(editProduct.price - editProduct.costPrice).toFixed(2)}€ ({((editProduct.price - editProduct.costPrice) / editProduct.costPrice * 100).toFixed(0)}%)
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Kategori ve Birim */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('kategori')}</label>
 <select title="Kategori sec" value={editProduct.category} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow">
 {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
 </select>
 </div>
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('unit_label')}</label>
 <select title="Birim sec" value={editProduct.unit} onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow">
 <option value={t('adet')}>{t('adet')}</option>
 <option value="porsiyon">Porsiyon</option>
 <option value="bardak">Bardak</option>
 <option value="kase">Kase</option>
 <option value="litre">Litre</option>
 <option value="kg">Kilogram (kg)</option>
 <option value="gr">Gram (gr)</option>
 </select>
 </div>
 </div>

 {/* Mutfak Operasyonu */}
                <div className="bg-orange-900/10 dark:bg-orange-950/20 border border-orange-500/20 rounded-xl p-4 space-y-4">
                  <h3 className="text-foreground text-sm font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/></svg>
                    Mutfak Operasyonu
                  </h3>

                  {/* Hazirlik Yeri - PrepZone secimi */}
                  <div>
                    <label className="text-muted-foreground text-xs block mb-2">Hangi İstasyonlarda Hazırlanıyor? (Opsiyonel)</label>
                    <PrepZoneSelector value={editProduct.prepZone || []} onChange={(val) => setEditProduct({ ...editProduct, prepZone: val })} products={products} sectionDefs={kermesSectionDefs} />
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Birden fazla bölüm seçebilirsiniz (örneğin hem Erkek hem Kadın bölümünde hazırlanan ürünler için)</p>
                  </div>
                </div>


                {/* Tab Navigation */}
                <div className="flex gap-1 bg-muted/30 rounded-lg p-1 mb-4">
                  <button type="button" onClick={() => setEditProductTab('genel')}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition ${editProductTab === 'genel' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                    Genel
                  </button>
                  <button type="button" onClick={() => setEditProductTab('detay')}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition ${editProductTab === 'detay' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                    Detay & Alerjenler
                  </button>
                  <button type="button" onClick={() => setEditProductTab('secenekler')}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition ${editProductTab === 'secenekler' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                    Secenekler {(editProduct.optionGroups || []).length > 0 ? `(${(editProduct.optionGroups || []).length})` : ''}
                  </button>
                </div>

                {/* GENEL TAB */}
                {editProductTab === 'genel' && (
                <div className="space-y-4">
                {/* 2. İsim */}
 <div>
 <label className="text-muted-foreground text-xs block mb-1">2. İsim (Opsiyonel)</label>
 <input type="text" value={editProduct.secondaryName || ''}
 onChange={(e) => setEditProduct({ ...editProduct, secondaryName: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow"
 placeholder={t('orn_turkce_veya_almanca_alternatif_isim')} />
 </div>

 {/* Açıklama */}
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('kisa_aciklama')}</label>
 <input type="text" value={editProduct.description || ''}
 onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow"
 placeholder={t('menude_gorunecek_kisa_aciklama')} />
 </div>

 {/* Detaylı Açıklama */}
 <div>
 <label className="text-muted-foreground text-xs block mb-1">{t('detayli_tarif_opsiyonel')}</label>
 <textarea value={editProduct.detailedDescription || ''}
 onChange={(e) => setEditProduct({ ...editProduct, detailedDescription: e.target.value })}
 className="w-full px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow min-h-[80px]"
 placeholder={t('detayli_bilgi_tarif_veya_urun_hakkinda_n')} />
 </div>

  </div>
                )}

                {/* DETAY & ALERJENLER TAB */}
                {editProductTab === 'detay' && (
                <div className="space-y-4">
 {/* Alerjenler */}
 <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-800/30">
 <label className="text-amber-800 dark:text-amber-400 text-sm font-medium block mb-2">⚠️ Alerjenler</label>
 <div className="flex flex-wrap gap-2 mb-2">
 {(Array.isArray(editProduct.allergens) ? editProduct.allergens : []).map((allergen, idx) => (
 <span key={idx} className="px-3 py-1 bg-amber-600/30 text-amber-300 rounded-full text-xs flex items-center gap-1">
 {allergen}
 <button onClick={() => setEditProduct({ ...editProduct, allergens: (Array.isArray(editProduct.allergens) ? editProduct.allergens : []).filter((_, i) => i !== idx) })}
 className="w-4 h-4 rounded-full bg-amber-700 hover:bg-amber-600 flex items-center justify-center">×</button>
 </span>
 ))}
 </div>
 <div className="flex gap-2">
 <select
 value={editProduct.newAllergen}
 onChange={(e) => {
 const val = e.target.value;
 if (val && !(Array.isArray(editProduct.allergens) ? editProduct.allergens : []).includes(val)) {
 setEditProduct({ ...editProduct, allergens: [...(Array.isArray(editProduct.allergens) ? editProduct.allergens : []), val], newAllergen: '' });
 }
 }}
 className="flex-1 px-2 py-1 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-xs">
 <option value="">{t('alerjen_sec')}</option>
 <option value="Gluten">Gluten</option>
 <option value={t('sut')}>{t('sut_urunleri')}</option>
 <option value="Yumurta">Yumurta</option>
 <option value={t('findik')}>{t('findik_kabuklu_yemis')}</option>
 <option value={t('yer_fistigi')}>{t('yer_fistigi')}</option>
 <option value="Soya">Soya</option>
 <option value={t('balik')}>{t('balik')}</option>
 <option value="Kabuklu Deniz">{t('kabuklu_deniz_urunleri')}</option>
 <option value="Kereviz">Kereviz</option>
 <option value="Hardal">Hardal</option>
 <option value="Susam">Susam</option>
 <option value={t('sulfur_dioksit')}>{t('sulfur_dioksit')}</option>
 </select>
 <input type="text" value={editProduct.newAllergen || ''}
 onChange={(e) => setEditProduct({ ...editProduct, newAllergen: e.target.value })}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && editProduct.newAllergen?.trim()) {
 e.preventDefault();
 if (!(Array.isArray(editProduct.allergens) ? editProduct.allergens : []).includes(editProduct.newAllergen.trim())) {
 setEditProduct({ ...editProduct, allergens: [...(Array.isArray(editProduct.allergens) ? editProduct.allergens : []), editProduct.newAllergen.trim()], newAllergen: '' });
 }
 }
 }}
 className="flex-1 px-2 py-1 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-xs"
 placeholder={t('veya_ozel_alerjen_yaz')} />
 </div>
 </div>

 {/* İçerikler */}
 <div className="bg-muted/50 dark:bg-muted/10 border border-border rounded-xl p-4">
 <label className="text-foreground text-sm font-medium block mb-2">{t('i_cerikler_zutaten')}</label>
 <div className="flex flex-wrap gap-2 mb-2">
 {(Array.isArray(editProduct.ingredients) ? editProduct.ingredients : []).map((ingredient, idx) => (
 <span key={idx} className="px-3 py-1 bg-gray-600 text-gray-200 rounded-full text-xs flex items-center gap-1">
 {ingredient}
 <button onClick={() => setEditProduct({ ...editProduct, ingredients: (Array.isArray(editProduct.ingredients) ? editProduct.ingredients : []).filter((_, i) => i !== idx) })}
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
 if (!(Array.isArray(editProduct.ingredients) ? editProduct.ingredients : []).includes(editProduct.newIngredient.trim())) {
 setEditProduct({ ...editProduct, ingredients: [...(Array.isArray(editProduct.ingredients) ? editProduct.ingredients : []), editProduct.newIngredient.trim()], newIngredient: '' });
 }
 }
 }}
 className="flex-1 px-2 py-1 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-shadow text-xs"
 placeholder={t('i_cerik_adi_yazip_enter_a_basin')} />
 <button
 type="button"
 onClick={() => {
 if (editProduct.newIngredient?.trim() && !(Array.isArray(editProduct.ingredients) ? editProduct.ingredients : []).includes(editProduct.newIngredient.trim())) {
 setEditProduct({ ...editProduct, ingredients: [...(Array.isArray(editProduct.ingredients) ? editProduct.ingredients : []), editProduct.newIngredient.trim()], newIngredient: '' });
 }
 }}
 className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-xs">{t('ekle')}</button>
 </div>
 </div>

 {/* TODO: Görseller - Gelecekte eklenecek */}
 {/* <div className="bg-muted/50 dark:bg-muted/10 border border-border rounded-xl p-4">
 <label className="text-foreground text-sm font-medium block mb-2">📷 Görseller (Max 3)</label>
 ... Image upload will be added here ...
 </div> */}
  </div>
                )}

                {/* SECENEKLER TAB */}
                {editProductTab === 'secenekler' && (
                <div className="space-y-4">
                <div className="bg-muted/50 dark:bg-muted/10 border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-amber-800 dark:text-amber-400 text-sm font-medium">Urun Secenekleri (Combo / Varyantlar)</label>
                    <button type="button"
                      onClick={() => {
                        const groups = editProduct.optionGroups || [];
                        const newGroup = { id: `grp_${Date.now()}`, name: '', type: 'radio', required: false, minSelect: 0, maxSelect: 1, options: [] };
                        setEditProduct({ ...editProduct, optionGroups: [...groups, newGroup] });
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors">
                      + Grup Ekle
                    </button>
                  </div>
                  {(editProduct.optionGroups || []).length === 0 ? (
                    <div className="bg-background/50 border border-dashed border-input rounded-xl p-5 text-center">
                      <p className="text-muted-foreground/80 text-sm">Henuz secenek grubu yok.</p>
                      <p className="text-muted-foreground text-xs mt-1">Boyut, sos, ekstra secimi icin Grup Ekle butonunu kullanin.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(editProduct.optionGroups || []).map((group: any, gIdx: number) => (
                        <div key={group.id} className="bg-background/60 border border-input rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-muted-foreground/80 font-mono text-xs">#{gIdx + 1}</span>
                            <input type="text" value={group.name}
                              onChange={e => { const g = [...(editProduct.optionGroups || [])]; g[gIdx] = { ...g[gIdx], name: e.target.value }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                              className="flex-1 bg-card border border-input rounded-lg px-3 py-1.5 text-sm font-semibold"
                              placeholder="Grup adi (orn: Boyut, Sos Secimi, Ekstra)" />
                            <select value={group.type}
                              onChange={e => { const g = [...(editProduct.optionGroups || [])]; g[gIdx] = { ...g[gIdx], type: e.target.value, maxSelect: e.target.value === 'radio' ? 1 : -1 }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                              className="bg-card border border-input rounded-lg px-2 py-1 text-xs">
                              <option value="radio">Tek Secim</option>
                              <option value="checkbox">Coklu Secim</option>
                            </select>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={group.required}
                                onChange={e => { const g = [...(editProduct.optionGroups || [])]; g[gIdx] = { ...g[gIdx], required: e.target.checked, minSelect: e.target.checked ? 1 : 0 }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                                className="w-3.5 h-3.5 rounded" />
                              <span className="text-xs text-muted-foreground">Zorunlu</span>
                            </label>
                            <button type="button" onClick={() => { const g = [...(editProduct.optionGroups || [])]; g.splice(gIdx, 1); setEditProduct({ ...editProduct, optionGroups: g }); }}
                              className="text-destructive hover:text-destructive/80 text-sm px-2">X</button>
                          </div>
                          <div className="space-y-2">
                            {(group.options || []).map((opt: any, oIdx: number) => (
                              <div key={opt.id} className="flex items-center gap-2 bg-card/50 rounded-lg px-3 py-2">
                                <span className="text-muted-foreground text-xs w-4">{oIdx + 1}.</span>
                                <input type="text" value={opt.name}
                                  onChange={e => { const g = [...(editProduct.optionGroups || [])]; const o = [...g[gIdx].options]; o[oIdx] = { ...o[oIdx], name: e.target.value }; g[gIdx] = { ...g[gIdx], options: o }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                                  className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm" placeholder="Secenek adi" />
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground/80">+EUR</span>
                                  <input type="number" step="0.10" min="0" value={opt.priceModifier || ''}
                                    onChange={e => { const g = [...(editProduct.optionGroups || [])]; const o = [...g[gIdx].options]; o[oIdx] = { ...o[oIdx], priceModifier: parseFloat(e.target.value) || 0 }; g[gIdx] = { ...g[gIdx], options: o }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                                    className="w-20 bg-background border border-input rounded px-2 py-1 text-sm text-right" placeholder="0.00" />
                                </div>
                                <button type="button" onClick={() => { const g = [...(editProduct.optionGroups || [])]; const o = [...g[gIdx].options]; o.splice(oIdx, 1); g[gIdx] = { ...g[gIdx], options: o }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                                  className="text-destructive text-xs px-1">X</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => { const g = [...(editProduct.optionGroups || [])]; const no = { id: `opt_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name: '', priceModifier: 0 }; g[gIdx] = { ...g[gIdx], options: [...(g[gIdx].options||[]), no] }; setEditProduct({ ...editProduct, optionGroups: g }); }}
                              className="w-full py-1.5 border border-dashed border-input hover:border-amber-500 rounded-lg text-xs text-muted-foreground/80 hover:text-amber-600 transition-colors">
                              + Secenek Ekle
                            </button>
                          </div>
                          {group.options && group.options.length > 0 && (
                            <div className="mt-2 text-[10px] text-muted-foreground/80">{group.options.length} secenek | {group.type === 'radio' ? 'Tek secim' : 'Coklu secim'}{group.required ? ' | Zorunlu' : ''}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
                )}

  </div>
 {/* Footer Buttons */}
 <div className="sticky bottom-0 bg-card px-6 py-4 border-t border-border flex gap-3">
 <button onClick={() => setEditProduct(null)} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium">İptal</button>
 <button onClick={handleSaveProduct} disabled={saving || editProduct.price <= 0}
 className="flex-1 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium disabled:opacity-50">
 {saving ? '⏳ Kaydediliyor...' : t('kaydet')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Silme Onay Modalı */}
 {deleteConfirm && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
 <div className="bg-card rounded-2xl w-full max-w-sm p-6 text-center">
 <div className="text-4xl mb-4">🗑️</div>
 <h2 className="text-lg font-bold text-foreground mb-2">{t('urun_kaldirilsin_mi')}</h2>
 <p className="text-muted-foreground mb-6">
 <span className="text-pink-800 dark:text-pink-400 font-medium">"{deleteConfirm.name}"</span> {t('menuden_kaldirilacak')}
 </p>
 <div className="flex gap-3">
 <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium">İptal</button>
 <button onClick={handleConfirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium">{t('kaldir')}</button>
 </div>
 </div>
 </div>
 )}

 {/* Satis Gecmisi Modali */}
 {salesHistoryProduct && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]" onClick={() => setSalesHistoryProduct(null)}>
 <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
 <div className="flex items-center justify-between p-4 border-b border-border">
 <div>
 <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
 <span className="material-symbols-outlined text-indigo-400">bar_chart</span>
 Satis Gecmisi: {typeof salesHistoryProduct.name === 'object' ? (salesHistoryProduct.name as any).tr || Object.values(salesHistoryProduct.name)[0] : salesHistoryProduct.name}
 </h2>
 <p className="text-muted-foreground text-sm mt-1">Tum kermesler boyunca satis verileri</p>
 </div>
 <button onClick={() => setSalesHistoryProduct(null)} className="text-muted-foreground hover:text-foreground text-2xl">x</button>
 </div>
 <div className="p-4 overflow-y-auto flex-1">
 {loadingSalesHistory ? (
 <div className="text-center py-8">
 <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-3"></div>
 <p className="text-muted-foreground">Satis verileri yukleniyor...</p>
 </div>
 ) : salesHistoryData.length === 0 ? (
 <div className="text-center py-8">
 <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">inbox</span>
 <p className="text-muted-foreground">Henuz satis verisi yok</p>
 </div>
 ) : (
 <div className="space-y-4">
 {/* Ozet */}
 <div className="grid grid-cols-3 gap-3">
 <div className="bg-green-900/30 rounded-xl p-3 text-center">
 <div className="text-2xl font-bold text-green-400">
 {salesHistoryData.reduce((sum: number, s: any) => sum + (s.quantity || 1), 0)}
 </div>
 <div className="text-xs text-green-300">Toplam Adet</div>
 </div>
 <div className="bg-blue-900/30 rounded-xl p-3 text-center">
 <div className="text-2xl font-bold text-blue-400">
 {salesHistoryData.reduce((sum: number, s: any) => sum + (s.totalPrice || 0), 0).toFixed(2)} EUR
 </div>
 <div className="text-xs text-blue-300">Toplam Gelir</div>
 </div>
 <div className="bg-purple-900/30 rounded-xl p-3 text-center">
 <div className="text-2xl font-bold text-purple-400">
 {new Set(salesHistoryData.map((s: any) => s.kermesDate)).size}
 </div>
 <div className="text-xs text-purple-300">Gun Sayisi</div>
 </div>
 </div>

 {/* Bolum bazli dagilim */}
 <div className="bg-gray-800 rounded-xl p-3">
 <h4 className="text-sm font-medium text-foreground mb-2">Bolum Bazli Dagilim</h4>
 <div className="space-y-1">
 {Object.entries(
 salesHistoryData.reduce((acc: Record<string, {qty: number, total: number}>, s: any) => {
 const section = s.sectionLabel || s.section || 'Bilinmiyor';
 if (!acc[section]) acc[section] = { qty: 0, total: 0 };
 acc[section].qty += s.quantity || 1;
 acc[section].total += s.totalPrice || 0;
 return acc;
 }, {})
 ).map(([section, data]) => (
 <div key={section} className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">{section}</span>
 <div className="flex items-center gap-3">
 <span className="text-foreground">{(data as any).qty} adet</span>
 <span className="text-green-400 font-medium">{(data as any).total.toFixed(2)} EUR</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Tarih bazli dagilim */}
 <div className="bg-gray-800 rounded-xl p-3">
 <h4 className="text-sm font-medium text-foreground mb-2">Tarih Bazli Satis</h4>
 <div className="space-y-1 max-h-60 overflow-y-auto">
 {Object.entries(
 salesHistoryData.reduce((acc: Record<string, {qty: number, total: number}>, s: any) => {
 const date = s.kermesDate || 'Bilinmiyor';
 if (!acc[date]) acc[date] = { qty: 0, total: 0 };
 acc[date].qty += s.quantity || 1;
 acc[date].total += s.totalPrice || 0;
 return acc;
 }, {})
 ).sort(([a], [b]) => b.localeCompare(a)).map(([date, data]) => (
 <div key={date} className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">{date}</span>
 <div className="flex items-center gap-3">
 <span className="text-foreground">{(data as any).qty} adet</span>
 <span className="text-green-400 font-medium">{(data as any).total.toFixed(2)} EUR</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Son satislar listesi */}
 <div className="bg-gray-800 rounded-xl p-3">
 <h4 className="text-sm font-medium text-foreground mb-2">Son Satislar (en son 20)</h4>
 <div className="space-y-1 max-h-48 overflow-y-auto">
 {salesHistoryData.slice(0, 20).map((sale: any, i: number) => (
 <div key={sale.id || i} className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-gray-700 last:border-0">
 <div className="flex items-center gap-2">
 <span>{sale.kermesDate}</span>
 <span className="text-gray-500">
 {sale.soldAt?.toDate ? sale.soldAt.toDate().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
 </span>
 <span className={`px-1.5 py-0.5 rounded text-xs ${
 sale.section?.includes('K') ? 'bg-pink-900/40 text-pink-300' :
 sale.section?.includes('E') ? 'bg-blue-900/40 text-blue-300' :
 'bg-green-900/40 text-green-300'
 }`}>{sale.sectionLabel || sale.section}</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-foreground">{sale.quantity}x</span>
 <span className="text-green-400">{sale.totalPrice?.toFixed(2)} EUR</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Map Location Picker Modal */}
 {/* Stok Görsel Seçme Modalı */}
 {showStockImageModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
 <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
 <div className="flex items-center justify-between p-4 border-b border-border">
 <h2 className="text-xl font-bold text-foreground">{t('stok_gorsel_sec')}</h2>
 <button
 onClick={() => setShowStockImageModal(false)}
 className="text-muted-foreground hover:text-foreground text-2xl"
 >
 ×
 </button>
 </div>
 <div className="p-4 overflow-y-auto">
 {stockImages.length === 0 ? (
 <div className="text-center py-12">
 <div className="text-6xl mb-4">🖼️</div>
 <h3 className="text-lg font-medium text-foreground mb-2">{t('henuz_stok_gorsel_yok')}</h3>
 <p className="text-muted-foreground mb-4">
 {t('super_admin_olarak_stok_gorseller_sayfas')}
 </p>
 <Link
 href="/admin/settings/kermes-stock-images"
 className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg"
 >
 {t('gorsel_yukle')}
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
 <div className="aspect-video bg-background relative">
 <img
 src={img.url}
 alt={img.title}
 className="w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
 <span className="text-foreground font-medium">{t('sec')}</span>
 </div>
 </div>
 <div className="p-2">
 <p className="text-foreground text-sm truncate">{img.title}</p>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 <div className="p-4 border-t border-border bg-background/50">
 <p className="text-muted-foreground/80 text-xs text-center">
 {t('onerilen_boyut_1200_675_piksel_16_9_oran')}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Ana Adres Harita Seçici Modalı */}
 <MapLocationPicker
 isOpen={mainMapOpen}
 onClose={() => setMainMapOpen(false)}
 initialLat={editForm.latitude || 51.0}
 initialLng={editForm.longitude || 9.0}
 onLocationSelect={(loc: SelectedLocation) => {
 setEditForm({
 ...editForm,
 address: loc.street || loc.address || editForm.address,
 city: loc.city || editForm.city,
 postalCode: loc.postalCode || editForm.postalCode,
 country: loc.country || editForm.country,
 latitude: loc.lat,
 longitude: loc.lng,
 });
 }}
 />

 {/* Park Alanı / Yeni Seçim */}
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
  initialLat={editForm.latitude || 51.0}
  initialLng={editForm.longitude || 9.0}
  kermesLat={editForm.latitude}
  kermesLng={editForm.longitude}
  kermesName={editForm.city || kermes?.title}
 />

 {/* Organization Search Modal */}
 <OrganizationSearchModal
 isOpen={showOrgSearchModal}
 onClose={() => setShowOrgSearchModal(false)}
 onSelect={(org) => {
 setEditForm({
 ...editForm,
 address: org.address || editForm.address,
 city: org.city || editForm.city,
 postalCode: org.postalCode || editForm.postalCode,
 country: org.country || editForm.country,
 });
 }}
 />

 {/* Edit Person Modal */}
 {editPersonData && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[99]">
 <div className="bg-card rounded-2xl w-full max-w-md p-6 border border-border">
 <div className="flex justify-between items-center mb-6">
 <h2 className="text-xl font-bold text-foreground">Personeli Düzenle</h2>
 <button onClick={() => setEditPersonData(null)} className="text-muted-foreground hover:text-white text-xl">✕</button>
 </div>
 
 <div className="space-y-4">
 <div>
 <label className="text-sm text-muted-foreground block mb-1">Ad Soyad</label>
 <input 
 type="text" 
 value={editPersonData.name} 
 onChange={(e) => setEditPersonData({...editPersonData, name: e.target.value})}
 className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-cyan-500 focus:outline-none"
 />
 </div>
 
 <div>
 <label className="text-sm text-muted-foreground block mb-1">E-Posta</label>
 <input 
 type="email" 
 value={editPersonData.email} 
 onChange={(e) => setEditPersonData({...editPersonData, email: e.target.value})}
 className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-cyan-500 focus:outline-none"
 />
 </div>

 <div>
 <label className="text-sm text-muted-foreground block mb-1">Telefon</label>
 <input 
 type="text" 
 value={editPersonData.phone} 
 onChange={(e) => setEditPersonData({...editPersonData, phone: e.target.value})}
 className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-cyan-500 focus:outline-none"
 />
 </div>

 <div>
 <label className="text-sm text-muted-foreground block mb-1">Cinsiyet <span className="text-red-500">*</span></label>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => setEditPersonData({...editPersonData, gender: 'male'})}
 className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${
 editPersonData.gender === 'male'
 ? 'bg-blue-600 text-white border-blue-600'
 : 'bg-background text-muted-foreground border-border hover:border-blue-400'
 }`}
 >
 Erkek
 </button>
 <button
 type="button"
 onClick={() => setEditPersonData({...editPersonData, gender: 'female'})}
 className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${
 editPersonData.gender === 'female'
 ? 'bg-pink-600 text-white border-pink-600'
 : 'bg-background text-muted-foreground border-border hover:border-pink-400'
 }`}
 >
 Kadin
 </button>
 </div>
 {!editPersonData.gender && (
 <p className="text-xs text-red-400 mt-1">Kermes personeli icin cinsiyet secimi zorunludur</p>
 )}
 </div>

  <div className="pt-4 border-t border-border mt-6">
  <label className="text-sm font-semibold text-foreground block mb-3">Hizli Islemler</label>
  
  {/* Surucu Toggle Switch */}
  <div className="flex items-center justify-between p-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
  <div className="flex items-center gap-2">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
  <span className="text-sm font-medium text-foreground">Surucu Olarak Ata</span>
  </div>
  <button
  type="button"
  title="Surucu olarak ata/cikar"
  onClick={() => {
  if (assignedDrivers.includes(editPersonData.id)) {
  const nd = assignedDrivers.filter((did: string) => did !== editPersonData.id);
  setAssignedDrivers(nd);
  saveTeamToDb(assignedStaff, nd);
  } else {
  const nd = [...assignedDrivers, editPersonData.id];
  setAssignedDrivers(nd);
  saveTeamToDb(assignedStaff, nd);
  }
  }}
  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${assignedDrivers.includes(editPersonData.id) ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
  >
  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${assignedDrivers.includes(editPersonData.id) ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
  </div>
  {assignedDrivers.includes(editPersonData.id) && (
  <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 -mt-1 ml-1">Bu personel ayni zamanda surucu olarak aktif.</p>
  )}

   {/* Garson Toggle Switch */}
   <div className="flex items-center justify-between p-3 mb-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
   <div className="flex items-center gap-2">
   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400"><path d="M3 11h18M5 11V6a7 7 0 0 1 14 0v5"/><ellipse cx="12" cy="11" rx="10" ry="2"/><path d="M12 13v2"/><circle cx="12" cy="17" r="2"/></svg>
   <span className="text-sm font-medium text-foreground">Garson Olarak Ata</span>
   </div>
   <button
   type="button"
   title="Garson olarak ata/cikar"
   onClick={() => {
   if (assignedWaiters.includes(editPersonData.id)) {
   const nw = assignedWaiters.filter((wid: string) => wid !== editPersonData.id);
   setAssignedWaiters(nw);
   saveTeamToDb(assignedStaff, assignedDrivers, nw);
   } else {
   const nw = [...assignedWaiters, editPersonData.id];
   setAssignedWaiters(nw);
   saveTeamToDb(assignedStaff, assignedDrivers, nw);
   }
   }}
   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${assignedWaiters.includes(editPersonData.id) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
   >
   <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${assignedWaiters.includes(editPersonData.id) ? 'translate-x-6' : 'translate-x-1'}`} />
   </button>
   </div>
   {assignedWaiters.includes(editPersonData.id) && (
   <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3 -mt-1 ml-1">Bu personel garson olarak atandi. Masa siparisleri bolumune gore yonlendirilecek.</p>
   )}

   {/* Kermes Admin Toggle - sadece canManageStaff */}
   {canManageStaff && (
   <>
   <div className="flex items-center justify-between p-3 mb-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
   <div className="flex items-center gap-2">
   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
   <span className="text-sm font-medium text-foreground">Kermes Admin Yap</span>
   </div>
   <button
   type="button"
   title="Kermes Admin olarak ata/cikar"
   onClick={() => {
   if (kermesAdmins.includes(editPersonData.id)) {
   const na = kermesAdmins.filter((aid: string) => aid !== editPersonData.id);
   setKermesAdmins(na);
   saveTeamToDb(assignedStaff, assignedDrivers, assignedWaiters, na);
   showToast('Admin yetkisi kaldirildi', 'success');
   } else {
   const na = [...kermesAdmins, editPersonData.id];
   setKermesAdmins(na);
   saveTeamToDb(assignedStaff, assignedDrivers, assignedWaiters, na);
   showToast('Kermes Admin yapildi', 'success');
   }
   }}
   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kermesAdmins.includes(editPersonData.id) ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
   >
   <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${kermesAdmins.includes(editPersonData.id) ? 'translate-x-6' : 'translate-x-1'}`} />
   </button>
   </div>
   {kermesAdmins.includes(editPersonData.id) && (
   <p className="text-xs text-purple-600 dark:text-purple-400 mb-3 -mt-1 ml-1">Bu personel Kermes Admin olarak atandi. Personel yonetim yetkisine sahip.</p>
   )}
   </>
   )}

   {/* Ozel Gorev Atamalari */}
   {(editForm.customRoles || []).length > 0 && (
   <>
   <h4 className="text-sm font-semibold text-foreground mt-4 mb-2">Ozel Gorevler</h4>
   {(editForm.customRoles || []).map((role: any) => {
     const isAssigned = customRoleAssignments[role.id]?.includes(editPersonData.id) || false;
     return (
       <div key={role.id} className={`flex items-center justify-between p-3 mb-2 rounded-lg border transition-colors ${
         isAssigned
           ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
           : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
       }`}>
       <div className="flex items-center gap-2">
         {role.icon?.startsWith('http') ? (
           <img src={role.icon} alt={role.name} className="w-5 h-5 object-cover rounded" />
         ) : (
           <span className="text-base">{role.icon}</span>
         )}
         <span className="text-sm font-medium text-foreground">{role.name}</span>
       </div>
       <button
         type="button"
         title={`${role.name} ${isAssigned ? 'gorevinden cikar' : 'olarak ata'}`}
         onClick={() => {
           const currentAssigns = customRoleAssignments[role.id] || [];
           const newAssigns = { ...customRoleAssignments };
           if (isAssigned) {
             newAssigns[role.id] = currentAssigns.filter((id: string) => id !== editPersonData.id);
           } else {
             newAssigns[role.id] = [...currentAssigns, editPersonData.id];
           }
           setCustomRoleAssignments(newAssigns);
           saveTeamToDb(assignedStaff, assignedDrivers, assignedWaiters, kermesAdmins, newAssigns);
         }}
         className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
           isAssigned ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
         }`}
       >
         <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
           isAssigned ? 'translate-x-6' : 'translate-x-1'
         }`} />
       </button>

       </div>
     );
   })}
   </>
   )}

  {/* \u00d6zel G\u00f6rev D\u00fczenleme Modal\u0131 */}
  {editingCustomRole && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h3 className="font-bold text-foreground">Özel Görevi Düzenle</h3>
          <button onClick={() => setEditingCustomRole(null)} className="text-muted-foreground hover:bg-muted p-1.5 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Görev Adı</label>
            <input 
              type="text" 
              value={editingCustomRole.name} 
              onChange={e => setEditingCustomRole(r => r ? {...r, name: e.target.value} : null)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Örn: Temizlik Görevlisi"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Görev İkonu</label>
            
            <div className="flex items-center gap-4 border border-border p-3 rounded-lg bg-muted/10">
              <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-background flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                {editingCustomRole.icon.startsWith('http') ? (
                  <img src={editingCustomRole.icon} alt="icon" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">{editingCustomRole.icon}</span>
                )}
              </div>
              
              <div className="flex-1">
                <input 
                  type="text" 
                  value={editingCustomRole.icon.startsWith('http') ? '' : editingCustomRole.icon}
                  onChange={e => setEditingCustomRole(r => r ? {...r, icon: e.target.value} : null)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                  placeholder="Emoji yazın (Örn: 🧹) VEYA resim yükleyin"
                  disabled={editingCustomRole.icon.startsWith('http')}
                />
                
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    id="role-icon-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      try {
                        setIsUploadingRoleIcon(true);
                        const fileExt = file.name.split('.').pop();
                        const fileName = `role_${Date.now()}.${fileExt}`;
                        const storageRef = ref(storage, `kermes_roles/${fileName}`);
                        await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(storageRef);
                        
                        setEditingCustomRole(r => r ? {...r, icon: url} : null);
                      } catch (error) {
                        console.error('Upload failed', error);
                        alert('Resim yüklenirken bir hata oluştu.');
                      } finally {
                        setIsUploadingRoleIcon(false);
                      }
                    }}
                  />
                  <label 
                    htmlFor="role-icon-upload"
                    className="flex w-full items-center justify-center gap-2 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 border border-blue-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-100 transition whitespace-nowrap"
                  >
                    {isUploadingRoleIcon ? (
                      <span className="animate-pulse">Yükleniyor...</span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        Yeni Resim Yükle
                      </>
                    )}
                  </label>
                </div>
                
                {editingCustomRole.icon.startsWith('http') && (
                  <button 
                    type="button"
                    onClick={() => setEditingCustomRole(r => r ? {...r, icon: '📋'} : null)}
                    className="w-full mt-2 text-xs text-red-500 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Resmi Kaldır (Emojiye Dön)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border flex gap-3 bg-muted/10">
          <button 
            type="button" 
            onClick={() => setEditingCustomRole(null)} 
            className="flex-1 py-2 bg-muted hover:bg-muted-foreground/10 text-foreground rounded-lg font-medium transition-colors text-sm"
          >
            İptal
          </button>
          <button 
            type="button" 
            onClick={async () => {
              if (editingCustomRole) {
                if (!editingCustomRole.name.trim()) return showToast("Görev adı zorunludur", "error");
                
                const exists = (editForm.customRoles || []).some(r => r.id === editingCustomRole.id);
                const newRoles = exists 
                  ? (editForm.customRoles || []).map(r => r.id === editingCustomRole.id ? editingCustomRole : r)
                  : [...(editForm.customRoles || []), editingCustomRole];
                
                setEditForm(prev => ({ ...prev, customRoles: newRoles }));
                
                try {
                  await updateDoc(doc(db, 'kermes_events', kermesId as string), { customRoles: newRoles });
                  showToast('Görev başarıyla kaydedildi.', 'success');
                  setEditingCustomRole(null);
                } catch (err) {
                  console.error(err);
                  showToast('Görev kaydedilirken hata oluştu.', 'error');
                }
              }
            }} 
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )}


   {/* Login Bilgilerini Tekrar Gonder veya Yeni Sifre Belirle */}
   {(editPersonData.email || editPersonData.phone || editPersonData.phoneNumber) && (
   <button
   type="button"
   onClick={async () => {
   try {
   const email = editPersonData.email;
   if (email) {
   // Kullanicinin sifresini sifirlayip yeni sifre ile email gonderme
   showToast("Yeni şifre oluşturuluyor...", "success");
   const resetRes = await fetch("/api/admin/reset-user-password", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({ uid: editPersonData.id })
   });
   
   if (!resetRes.ok) {
     showToast("Şifre sıfırlama başarısız oldu", "error");
     return;
   }
   
   const { tempPassword } = await resetRes.json();
   
   const res = await fetch("/api/email/send", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({
   to: email,
   subject: "LOKMA - Kermes Personel Login Bilgileri",
   html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb"><h2 style="color:#1e40af;margin-top:0">Merhaba ${editPersonData.displayName || editPersonData.firstName || editPersonData.name || "Personel"}</h2><p>Kermes personel panelinize giris yapmak icin lutfen asagidaki bilgileri kullanin:</p><p><strong>Benutzername (Login):</strong> ${email}</p><p><strong>Passwort (Şifre):</strong> <span style="background-color:#ffe4e6;color:#e11d48;padding:4px 8px;border-radius:4px;font-family:monospace;font-size:16px;">${tempPassword}</span></p><p><strong>Link:</strong> <a href="https://lokma.web.app/kermes-login">https://lokma.web.app/kermes-login</a></p><p>Eger sifrenizi degistirmek isterseniz, giris sayfasindan "Sifremi Unuttum" secenegini kullanabilirsiniz.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"><p style="color:#6b7280;font-size:12px">LOKMA Kermes Yonetim Sistemi</p></div>`
   })
   });
   if (res.ok) {
   showToast("Yeni şifreli login bilgileri email ile gonderildi", "success");
   } else {
   showToast("Email gonderilemedi", "error");
   }
   } else {
   showToast("Bu kisinin email adresi yok. Telefon ile Firebase Auth uzerinden giris yapabilir.", "success");
   }
   } catch (err) {
   console.error("Resend error:", err);
   showToast("Bilgi gonderilemedi", "error");
   }
   }}
   className="w-full py-2 mb-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 border border-blue-900/30 rounded-lg text-sm font-medium transition"
   >
   Login Bilgilerini Tekrar Gönder (Yeni Şifre)
   </button>
   )}

  <button
  onClick={() => handleRemovePersonFromKermes(editPersonData.id)}
  className="w-full py-2 mb-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition"
  >
  Bu Personeli Karmesten Çıkar
  </button>

  <button
  onClick={() => handleDeletePersonCompletely(editPersonData.id)}
  className="w-full py-2 bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-900/30 rounded-lg text-sm font-medium transition"
  >
  Sistemden Tamamen Sil
  </button>
  </div>
 </div>

 <div className="flex gap-3 mt-8">
 <button onClick={() => setEditPersonData(null)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">İptal</button>
 <button onClick={handleSaveEditPerson} disabled={isSavingPerson || !editPersonData.gender} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 transition">
 {isSavingPerson ? 'Kaydediliyor...' : 'Kaydet'}
 </button>
 </div>
 </div>
 </div>
 )}
 {/* ── Tab Content: Bildirimler ── */}
 {activeTab === 'bildirimler' && (
 <div className="max-w-5xl mx-auto space-y-6">
   <div className="flex items-center gap-3 mb-2">
     <span className="material-symbols-outlined text-2xl text-violet-500">notifications_active</span>
     <div>
       <h3 className="text-lg font-bold text-foreground">Push Bildirimler</h3>
       <p className="text-sm text-muted-foreground">Kermes ziyaretcilerine bildirim gonderin</p>
     </div>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     {/* Kart 1: Aksam Pazari */}
     <button onClick={() => setShowFlashSaleModal(true)}
       disabled={!products.some(p => p.discountPrice && p.discountPrice > 0 && !p.isSoldOut && p.isAvailable)}
       className="group p-5 rounded-xl border border-border bg-card hover:bg-pink-600/5 hover:border-pink-500/40 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed">
       <div className="flex items-center gap-3 mb-3">
         <div className="w-10 h-10 rounded-lg bg-pink-600/15 flex items-center justify-center">
           <span className="material-symbols-outlined text-xl text-pink-500">campaign</span>
         </div>
         <div>
           <h4 className="font-bold text-sm text-foreground">Aksam Pazari (Flash Sale)</h4>
           <p className="text-xs text-muted-foreground">Indirimli urunleri duyur</p>
         </div>
       </div>
       <p className="text-xs text-muted-foreground leading-relaxed">
         Indirimde olan urunleri secilen hedef kitleye push bildirim olarak gonderin.
       </p>
       {products.some(p => p.discountPrice && p.discountPrice > 0 && !p.isSoldOut && p.isAvailable) ? (
         <div className="mt-3 px-2 py-1 bg-pink-600/10 text-pink-500 rounded text-xs font-medium w-fit">
           {products.filter(p => p.discountPrice && p.discountPrice > 0 && !p.isSoldOut && p.isAvailable).length} indirimli urun mevcut
         </div>
       ) : (
         <div className="mt-3 px-2 py-1 bg-muted/50 text-muted-foreground rounded text-xs w-fit">
           Indirimli urun yok
         </div>
       )}
     </button>

     {/* Kart 2: Acil Arac Anonsu */}
     <button onClick={() => setShowParkingModal(true)}
       className="group p-5 rounded-xl border border-border bg-card hover:bg-red-600/5 hover:border-red-500/40 transition-all text-left">
       <div className="flex items-center gap-3 mb-3">
         <div className="w-10 h-10 rounded-lg bg-red-600/15 flex items-center justify-center">
           <span className="material-symbols-outlined text-xl text-red-500">car_crash</span>
         </div>
         <div>
           <h4 className="font-bold text-sm text-foreground">Acil Arac Anonsu</h4>
           <p className="text-xs text-muted-foreground">Araç çekilmeli bildirimi</p>
         </div>
       </div>
       <p className="text-xs text-muted-foreground leading-relaxed">
         Yanlış park eden araçların sahiplerini acil olarak bilgilendirin. Plaka, renk ve marka ile anons yapın.
       </p>
     </button>

     {/* Kart 3: Genel Duyuru / Manuel */}
     <button onClick={() => setShowManualModal(true)}
       className="group p-5 rounded-xl border border-border bg-card hover:bg-emerald-600/5 hover:border-emerald-500/40 transition-all text-left">
       <div className="flex items-center gap-3 mb-3">
         <div className="w-10 h-10 rounded-lg bg-emerald-600/15 flex items-center justify-center">
           <span className="material-symbols-outlined text-xl text-emerald-500">edit_notifications</span>
         </div>
         <div>
           <h4 className="font-bold text-sm text-foreground">Genel Duyuru</h4>
           <p className="text-xs text-muted-foreground">Serbest bildirim yaz</p>
         </div>
       </div>
       <p className="text-xs text-muted-foreground leading-relaxed">
         Kendi baslik ve iceriginizle ozel bir push bildirim gonderin.
       </p>
     </button>

     {/* Kart 4: Bildirim Gecmisi */}
     <button onClick={loadNotifHistory}
       className="group p-5 rounded-xl border border-border bg-card hover:bg-amber-600/5 hover:border-amber-500/40 transition-all text-left">
       <div className="flex items-center gap-3 mb-3">
         <div className="w-10 h-10 rounded-lg bg-amber-600/15 flex items-center justify-center">
           <span className="material-symbols-outlined text-xl text-amber-500">history</span>
         </div>
         <div>
           <h4 className="font-bold text-sm text-foreground">Bildirim Gecmisi</h4>
           <p className="text-xs text-muted-foreground">Gonderilen bildirimleri gor</p>
         </div>
       </div>
       <p className="text-xs text-muted-foreground leading-relaxed">
         Bu kermes icin daha once gonderilen tum bildirimlerin kaydini goruntuleyin.
       </p>
     </button>
   </div>

   {/* Bildirim Gecmisi Listesi */}
   {notifHistory.length > 0 && (
     <div className="mt-6">
       <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
         <span className="material-symbols-outlined text-base text-amber-500">history</span>
         Son Gonderilen Bildirimler
       </h4>
       <div className="space-y-2">
         {notifHistory.map((n: any) => (
           <div key={n.id} className="p-3 rounded-lg bg-card border border-border flex items-center gap-3">
             <span className="material-symbols-outlined text-base text-muted-foreground">
               {n.type === 'flash_sale' ? 'campaign' : n.type === 'parking' ? 'local_parking' : 'notifications'}
             </span>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
               <p className="text-xs text-muted-foreground truncate">{n.body}</p>
             </div>
             <div className="text-right shrink-0">
               <p className="text-xs text-muted-foreground">{n.sentCount || 0} kisi</p>
               <p className="text-xs text-muted-foreground">{n.sentAt?.toDate?.()?.toLocaleDateString('tr-TR') || ''}</p>
             </div>
           </div>
         ))}
       </div>
     </div>
   )}
 </div>
 )}

  {/* Flash Sale Push Notification Modal */}
 {showFlashSaleModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !isSendingFlashSale && setShowFlashSaleModal(false)}>
 <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
 
 {/* Header */}
 <div className="p-4 border-b border-border bg-gradient-to-r from-pink-600/10 to-rose-600/10 dark:from-pink-900/20 dark:to-rose-900/20 flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-pink-600 dark:text-pink-400">
 <span className="material-symbols-outlined">campaign</span>
 </div>
 <div>
 <h3 className="font-bold text-foreground">{t('flash_sale_title')}</h3>
 <p className="text-xs text-muted-foreground">{kermes.title} - {t('flash_sale_desc')}</p>
 </div>
 <button onClick={() => setShowFlashSaleModal(false)} disabled={isSendingFlashSale} className="ml-auto text-muted-foreground hover:text-foreground">
 <span className="material-symbols-outlined">close</span>
 </button>
 </div>
 
 {/* Content */}
 <div className="p-5 flex-1 overflow-y-auto">
 <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 p-3 rounded-lg text-xs leading-relaxed mb-4 border border-amber-200 dark:border-amber-900/30 flex gap-2">
 <span className="material-symbols-outlined text-base shrink-0">info</span>
 <div>
 {t('flash_sale_info')}
 </div>
 </div>

 <h4 className="font-medium text-sm text-foreground mb-2">{t('flash_sale_target_audience') || 'Hedef Kitle'}</h4>
 <div className="space-y-2 mb-4">
   {/* Checkbox 1: Favoriler */}
   <label className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:bg-muted/50 transition">
     <input type="checkbox" checked={flashTargetFavorites} onChange={(e) => setFlashTargetFavorites(e.target.checked)}
       className="w-4 h-4 rounded accent-pink-600" />
     <span className="material-symbols-outlined text-base text-pink-600">favorite</span>
     <div className="flex-1">
       <span className="text-sm font-medium">{t('flash_sale_group_favorites') || 'Kermes Favorileri'}</span>
       <p className="text-xs text-muted-foreground">{t('flash_sale_group_favorites_desc') || 'Bu kermesi favorilerine ekleyen kullanicilar'}</p>
     </div>
   </label>

   {/* Checkbox 2: Personel & Admin */}
   <label className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:bg-muted/50 transition">
     <input type="checkbox" checked={flashTargetStaff} onChange={(e) => setFlashTargetStaff(e.target.checked)}
       className="w-4 h-4 rounded accent-pink-600" />
     <span className="material-symbols-outlined text-base text-blue-500">badge</span>
     <div className="flex-1">
       <span className="text-sm font-medium">{t('flash_sale_group_staff') || 'Personel & Adminler'}</span>
       <p className="text-xs text-muted-foreground">{t('flash_sale_group_staff_desc') || 'Bu kermesin personeli ve adminleri'}</p>
     </div>
   </label>

   {/* Checkbox 3: Yakin Cevre */}
   <label className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:bg-muted/50 transition">
     <input type="checkbox" checked={flashTargetNearby} onChange={(e) => setFlashTargetNearby(e.target.checked)}
       className="w-4 h-4 rounded accent-pink-600" />
     <span className="material-symbols-outlined text-base text-green-500">near_me</span>
     <div className="flex-1">
       <span className="text-sm font-medium">{t('flash_sale_group_nearby') || 'Yakin Cevredekiler'}</span>
       <p className="text-xs text-muted-foreground">{t('flash_sale_group_nearby_desc') || 'Kermes alaninin belirli km yakinindaki kullanicilar'}</p>
     </div>
   </label>
 </div>

 {/* Radius secimi sadece "Yakin Cevre" aktifse goster */}
 {flashTargetNearby && (
 <div className="mb-5 bg-border/20 p-3 rounded-xl border border-border flex items-center justify-between">
   <div className="flex flex-col">
     <span className="text-sm font-bold flex items-center gap-1"><span className="material-symbols-outlined text-sm text-pink-600">my_location</span> {t('flash_sale_target_radius')}</span>
     <span className="text-xs text-muted-foreground">{t('flash_sale_target_desc')}</span>
   </div>
   <select 
     value={flashSaleRadius} 
     onChange={(e) => setFlashSaleRadius(Number(e.target.value))}
     className="px-4 py-2 bg-background border border-input rounded-lg text-sm font-bold shadow-sm focus:ring-2 focus:ring-pink-500/50"
   >
     <option value={1}>1 KM</option>
     <option value={2}>2 KM</option>
     <option value={5}>5 KM</option>
     <option value={10}>10 KM</option>
     <option value={50}>50 KM</option>
   </select>
 </div>
 )}

 {!flashTargetFavorites && !flashTargetStaff && !flashTargetNearby && (
   <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs border border-red-200 dark:border-red-900/30 mb-4">
     En az bir hedef grup secmelisiniz.
   </div>
 )}
 
 <h4 className="font-medium text-sm text-foreground mb-2">{t('flash_sale_products')}</h4>
 <div className="space-y-2 mb-4">
 {products.filter(p => p.discountPrice && p.discountPrice > 0 && !p.isSoldOut && p.isAvailable).map(product => (
 <div key={product.id} className="flex justify-between items-center p-2 rounded-lg bg-background border border-border">
 <span className="text-sm font-medium">{getLocalizedText(product.name, locale)}</span>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground line-through">{product.price.toFixed(2)}€</span>
 <span className="text-sm font-bold text-pink-600 dark:text-pink-400">{product.discountPrice?.toFixed(2)}€</span>
 </div>
 </div>
 ))}
 </div>
 
 <h4 className="font-medium text-sm text-foreground mb-2 mt-4">{t('flash_sale_preview')}</h4>
 <div className="bg-background rounded-2xl p-4 shadow-sm border border-border mt-2">
 <div className="flex gap-3">
 <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
 <span className="material-symbols-outlined text-white text-sm">local_mall</span>
 </div>
 <div>
 <h5 className="font-bold text-sm text-foreground mb-1">🌙 {kermes.title} - Akşam Pazarı Başladı!</h5>
 <p className="text-xs text-muted-foreground leading-relaxed">
 {(() => {
 const topDiscount = products.filter(p => p.discountPrice && p.discountPrice > 0 && !p.isSoldOut && p.isAvailable).sort((a,b) => ((b.price - b.discountPrice!)/b.price) - ((a.price - a.discountPrice!)/a.price))[0];
 return topDiscount ? `🔥 Son firsatlar! ${getLocalizedText(topDiscount.name, locale)} ${topDiscount.price.toFixed(2)}€ yerine sadece ${topDiscount.discountPrice?.toFixed(2)}€! ⏳ Tum indirimler stoklarla sinirlidir, tukenmeden yetisin! 🏃‍♂️` : 'Indirimli urunlerimiz basladi, stoklar bitmeden yetisin!';
 })()}
 </p>
 </div>
 </div>
 </div>
 </div>
 
 {/* Footer */}
 <div className="p-4 border-t border-border flex gap-3 bg-muted/30">
 <button onClick={() => setShowFlashSaleModal(false)} disabled={isSendingFlashSale} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-background border border-input hover:bg-muted text-foreground transition">
 {t('flash_sale_cancel')}
 </button>
 <button onClick={handleSendFlashSale} disabled={isSendingFlashSale || (!flashTargetFavorites && !flashTargetStaff && !flashTargetNearby)} className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-pink-600 hover:bg-pink-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
 {isSendingFlashSale ? (
 <>{t('flash_sale_sending')} <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span></>
 ) : t('flash_sale_send')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* -- Acil Arac Anonsu Modal -- */}
 {showParkingModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !isSendingParking && setShowParkingModal(false)}>
 <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
   {/* Header */}
   <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-red-600/10">
     <div className="p-2 rounded-lg bg-red-600/20"><span className="material-symbols-outlined text-red-500">car_crash</span></div>
     <div>
       <h3 className="font-bold text-foreground">Acil Arac Anonsu</h3>
       <p className="text-xs text-muted-foreground">{kermes.title} - Araç çekilmeli!</p>
     </div>
     <button onClick={() => setShowParkingModal(false)} disabled={isSendingParking} className="ml-auto text-muted-foreground hover:text-foreground">
       <span className="material-symbols-outlined">close</span>
     </button>
   </div>
   {/* Content */}
   <div className="p-5 flex-1 overflow-y-auto space-y-4">
     {/* Uyari */}
     <div className="flex items-start gap-2 p-3 rounded-lg bg-red-600/10 border border-red-500/20">
       <span className="material-symbols-outlined text-red-500 text-base mt-0.5">warning</span>
       <p className="text-xs text-red-400">Bu bildirim 1km yarıçaptaki tüm kermes bildirimlerini açmış kullanıcılara gönderilir.</p>
     </div>
     {/* Plaka */}
     <div>
       <label className="text-sm font-medium text-foreground">Plaka No <span className="text-red-500">*</span></label>
       <input type="text" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
         placeholder="34 ABC 123"
         className="mt-1 w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm font-bold tracking-wider uppercase focus:ring-2 focus:ring-red-500/50" />
     </div>
     {/* Renk */}
     <div>
       <label className="text-sm font-medium text-foreground">Araba Rengi</label>
       <div className="mt-1.5 flex flex-wrap gap-1.5">
         {['Siyah', 'Beyaz', 'Gri', 'Gümüş', 'Mavi'].map(c => (
           <button key={c} type="button" onClick={() => setVehicleColor(vehicleColor === c ? '' : c)}
             className={`px-3 py-1 rounded-full text-xs font-medium border transition ${vehicleColor === c ? 'bg-red-600 text-white border-red-600' : 'bg-background border-border text-muted-foreground hover:border-red-500/40'}`}>
             {c}
           </button>
         ))}
       </div>
       <input type="text" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)}
         placeholder="Ya da farklı renk yazın..."
         className="mt-1.5 w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-red-500/50" />
     </div>
     {/* Marka */}
     <div>
       <label className="text-sm font-medium text-foreground">Araba Markası</label>
       <div className="mt-1.5 flex flex-wrap gap-1.5">
         {['VW', 'BMW', 'Mercedes', 'Audi', 'Opel'].map(b => (
           <button key={b} type="button" onClick={() => setVehicleBrand(vehicleBrand === b ? '' : b)}
             className={`px-3 py-1 rounded-full text-xs font-medium border transition ${vehicleBrand === b ? 'bg-red-600 text-white border-red-600' : 'bg-background border-border text-muted-foreground hover:border-red-500/40'}`}>
             {b}
           </button>
         ))}
       </div>
       <input type="text" value={vehicleBrand} onChange={e => setVehicleBrand(e.target.value)}
         placeholder="Ya da farklı marka yazın..."
         className="mt-1.5 w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-red-500/50" />
     </div>
     {/* Resim Ekleme */}
     <div>
       <label className="text-sm font-medium text-foreground">Araç Fotoğrafı (Opsiyonel)</label>
       <div className="mt-1">
         {vehicleImageUrl ? (
           <div className="relative">
             <img src={vehicleImageUrl} alt="Arac" className="w-full h-40 object-cover rounded-lg border border-border" />
             <button onClick={() => setVehicleImageUrl('')} className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80">
               <span className="material-symbols-outlined text-sm">close</span>
             </button>
           </div>
         ) : (
           <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-red-500/40 hover:bg-red-600/5 transition">
             <span className="material-symbols-outlined text-2xl text-muted-foreground mb-1">add_a_photo</span>
             <span className="text-xs text-muted-foreground">Resim yükle</span>
             <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
               const file = e.target.files?.[0];
               if (!file) return;
               try {
                 const { getStorage } = await import('firebase/storage');
                 const storage = getStorage();
                 const storageRef = ref(storage, `kermes/${kermesId}/parking/${Date.now()}_${file.name}`);
                 await uploadBytes(storageRef, file);
                 const url = await getDownloadURL(storageRef);
                 setVehicleImageUrl(url);
               } catch (err) { console.error('Upload error:', err); }
             }} />
           </label>
         )}
       </div>
     </div>
     {/* Onizleme */}
     {vehiclePlate.trim() && (
       <div className="p-3 rounded-lg bg-red-600/10 border border-red-500/20">
         <p className="text-xs font-medium text-foreground mb-1">Push Önizleme:</p>
         <p className="text-xs text-muted-foreground">
           ACIL PARK ANONSU: {vehicleColor.trim() ? `${vehicleColor.trim()} ` : ''}{vehicleBrand.trim() ? `${vehicleBrand.trim()} ` : ''}({vehiclePlate.trim().toUpperCase()}) plakalı araç sahibi, lütfen aracınızı acilen çekiniz!
         </p>
       </div>
     )}
   </div>
   {/* Footer */}
   <div className="border-t border-border px-5 py-3 flex gap-3">
     <button onClick={() => setShowParkingModal(false)} disabled={isSendingParking} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-background border border-input hover:bg-muted text-foreground transition">Iptal</button>
     <button onClick={handleSendParkingAnnouncement} disabled={isSendingParking || !vehiclePlate.trim()}
       className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
       {isSendingParking ? (<>Gönderiliyor <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span></>) : 'Acil Anons Gönder'}
     </button>
   </div>
 </div>
 </div>
 )}

 {/* ── Manuel Bildirim Modal ── */}
 {showManualModal && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !isSendingManual && setShowManualModal(false)}>
 <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
   {/* Header */}
   <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
     <div className="p-2 rounded-lg bg-emerald-600/15"><span className="material-symbols-outlined text-emerald-500">edit_notifications</span></div>
     <div>
       <h3 className="font-bold text-foreground">Genel Duyuru</h3>
       <p className="text-xs text-muted-foreground">{kermes.title}</p>
     </div>
     <button onClick={() => setShowManualModal(false)} disabled={isSendingManual} className="ml-auto text-muted-foreground hover:text-foreground">
       <span className="material-symbols-outlined">close</span>
     </button>
   </div>
   {/* Content */}
   <div className="p-5 flex-1 overflow-y-auto space-y-4">
     <div>
       <label className="text-sm font-medium text-foreground">Baslik</label>
       <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)}
         placeholder="Bildirim basligi..."
         className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/50" />
     </div>
     <div>
       <label className="text-sm font-medium text-foreground">Icerik</label>
       <textarea value={manualBody} onChange={e => setManualBody(e.target.value)}
         placeholder="Bildirim icerigi..."
         className="mt-1 w-full px-3 py-2 bg-background border border-input rounded-lg text-sm resize-none h-24 focus:ring-2 focus:ring-emerald-500/50" />
     </div>
     {/* Hedef Kitle */}
     <div>
       <h4 className="font-medium text-sm text-foreground mb-2">Hedef Kitle</h4>
       <div className="space-y-2">
         <label className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:bg-muted/50 transition">
           <input type="checkbox" checked={manualTargetFavorites} onChange={e => setManualTargetFavorites(e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
           <span className="material-symbols-outlined text-base text-pink-600">favorite</span>
           <span className="text-sm font-medium">Favoriler</span>
         </label>
         <label className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:bg-muted/50 transition">
           <input type="checkbox" checked={manualTargetStaff} onChange={e => setManualTargetStaff(e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
           <span className="material-symbols-outlined text-base text-blue-500">badge</span>
           <span className="text-sm font-medium">Personel & Adminler</span>
         </label>
         <label className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:bg-muted/50 transition">
           <input type="checkbox" checked={manualTargetNearby} onChange={e => setManualTargetNearby(e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
           <span className="material-symbols-outlined text-base text-green-500">near_me</span>
           <span className="text-sm font-medium">Yakin Cevredekiler</span>
         </label>
       </div>
       {manualTargetNearby && (
         <div className="mt-2 flex items-center gap-2">
           <span className="text-sm text-muted-foreground">Yaricap:</span>
           <select value={manualRadius} onChange={e => setManualRadius(Number(e.target.value))}
             className="px-3 py-1.5 bg-background border border-input rounded-lg text-sm font-bold">
             <option value={1}>1 KM</option><option value={2}>2 KM</option><option value={5}>5 KM</option><option value={10}>10 KM</option><option value={50}>50 KM</option>
           </select>
         </div>
       )}
     </div>
   </div>
   {/* Footer */}
   <div className="border-t border-border px-5 py-3 flex gap-3">
     <button onClick={() => setShowManualModal(false)} disabled={isSendingManual} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-background border border-input hover:bg-muted text-foreground transition">Iptal</button>
     <button onClick={handleSendManualNotification} disabled={isSendingManual || (!manualTargetFavorites && !manualTargetStaff && !manualTargetNearby) || !manualTitle.trim() || !manualBody.trim()}
       className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
       {isSendingManual ? (<>Gönderiliyor <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span></>) : 'Gonder'}
     </button>
   </div>
 </div>
 </div>
 )}

 {activeTab === "tedarik" && (
  <KermesTedarikTab 
    kermesId={kermesId as string} 
    adminUid={adminUid} 
    kermesData={kermes} 
  />
 )}

 {activeTab === "vardiya" && (
  <KermesRosterTab
    kermesId={kermesId as string}
    assignedStaffIds={[...new Set([...assignedStaff, ...assignedDrivers, ...assignedWaiters])]}
    workspaceStaff={assignedStaffDetails}
    adminUid={adminUid}
    kermesStart={editForm.date}
    kermesEnd={editForm.endDate}
    isSuperAdmin={isSuperAdmin}
    adminGender={admin?.gender || admin?.profile?.gender || 'unknown'}
    kermesSections={editForm.tableSectionsV2 || []}
    customRoles={[...EXTENDED_SYSTEM_ROLES, ...(editForm.customRoles || [])]}
  />
 )}

 </div>
 );
}
