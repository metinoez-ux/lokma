// Re-export synchronized types
export * from './product-catalog';
export * from './inventory';

// User profile with comprehensive fields
export interface UserProfile {
 // Basic Info
 firstName: string;
 lastName: string;
 email: string;
 phone?: string;
 dialCode?: string; // Country code (e.g., +49, +90)
 dateOfBirth?: string;

 // Address
 address: {
 street: string;
 houseNumber: string;
 apartmentNumber?: string;
 postalCode: string;
 city: string;
 state?: string; // Bundesland
 country: string;
 };

 // Preferences
 language: 'de' | 'tr' | 'en';
 timezone?: string;
 selectedCountry?: string; // e.g. 'DE', 'TR'

 // Metadata
 createdAt: Date;
 updatedAt: Date;
}

// Subscription types and pricing for MIRA modules
export interface SubscriptionPlan {
 id: string;
 name: string;
 moduleType: AdminType;
 price: {
 monthly: number;
 yearly: number;
 };
 features: string[];
 stripePriceId: {
 monthly: string;
 yearly: string;
 };
}

export interface Subscription {
 id: string;
 userId: string;
 planId: string;
 moduleType: AdminType;
 status: 'active' | 'cancelled' | 'past_due' | 'trialing';
 currentPeriodStart: Date;
 currentPeriodEnd: Date;
 stripeSubscriptionId: string;
 stripeCustomerId: string;
 createdAt: Date;
}

// Module pricing (EUR)
export const MODULE_PRICING: Record<string, { name: string; monthly: number; yearly: number; features: string[] }> = {
 kermes: {
 name: 'Kermes Modülü',
 monthly: 0,
 yearly: 0,
 features: ['Sınırsız etkinlik', 'Menü yönetimi', 'Sipariş takibi', 'Raporlama'],
 },
 restoran: {
 name: 'Restoran Modülü',
 monthly: 49.99,
 yearly: 479.99,
 features: ['Menü yönetimi', 'Sipariş sistemi', 'Rezervasyon', 'QR menü', 'Mutfak paneli', 'Garson uygulaması'],
 },
 kasap: {
 name: 'Kasap Modülü',
 monthly: 39.99,
 yearly: 399.99,
 features: ['Ürün kataloğu', 'Sipariş yönetimi', 'Teslimat takibi', 'Stok yönetimi'],
 },
 bakkal: {
 name: 'Market Modülü',
 monthly: 29.99,
 yearly: 299.99,
 features: ['Ürün kataloğu', 'Sipariş yönetimi', 'Teslimat takibi'],
 },
 hali_yikama: {
 name: 'Halı Yıkama Modülü',
 monthly: 34.99,
 yearly: 349.99,
 features: ['Sipariş yönetimi', 'Sürücü atama', 'Takip sistemi', 'Müşteri bildirimleri'],
 },
 transfer_surucu: {
 name: 'Transfer Modülü',
 monthly: 44.99,
 yearly: 449.99,
 features: ['Rezervasyon yönetimi', 'Sürücü atama', 'Rota optimizasyonu', 'Fiyatlandırma'],
 },
 cenaze_fonu: {
 name: 'Cenaze Fonu Modülü',
 monthly: 19.99,
 yearly: 199.99,
 features: ['Üye yönetimi', 'Ödeme takibi', 'Raporlama', 'Bildirimler'],
 },
 tur_rehberi: {
 name: 'Tur Rehberi Modülü',
 monthly: 39.99,
 yearly: 399.99,
 features: ['Tur yönetimi', 'Katılımcı listesi', 'Rota planlama', 'Bildirimler'],
 },
};

// =============================================================================
// MIRA B2B PRICING PLANS - ALMANYA / KASAPLAR (v1 – Integration Ready)
// =============================================================================
// ❌ Yüzdesel komisyon YOK
// ❌ Hard limit YOK (sipariş asla bloke edilmez)
// ✅ Soft limit + aşım ücreti
// ✅ Baştan net, sürprizsiz
// =============================================================================

export type LokmaPlanTier = 'free' | 'basic' | 'premium';

export interface LokmaPlanConfig {
 id: LokmaPlanTier;
 name: string;
 monthlyFee: number; // EUR

 // Sipariş Limitleri (Soft Limit - Asla Bloke Edilmez)
 orderLimit: number | null; // null = sınırsız
 orderOverageFee: number; // EUR per order over limit

 // Personel Limitleri
 personnelLimit: number | null; // null = sınırsız
 personnelOverageFee: number; // EUR per ekstra personel

 // Özellikler
 features: {
 profile: boolean;
 productListing: boolean;
 onlineOrders: boolean;
 whatsappNotifications: boolean;
 pushNotifications: boolean;
 courierIntegration: boolean;
 etaTracking: boolean;
 campaigns: number | 'unlimited'; // 0, 3, or unlimited
 reports: 'none' | 'basic' | 'advanced';
 onlinePayment: boolean; // Stripe Connect
 multiUser: boolean;
 prioritySupport: boolean;
 liveCourierTracking: boolean;
 eslIntegration?: boolean;

 // Future Integrations (Planned)
 posIntegration?: boolean; // POS System Integration
 scaleIntegration?: boolean; // Kantar/Smart Scale
 accountingIntegration?: boolean; // Datev/Lexoffice etc.

 // Supply Chain / B2B
 aiSupplierOrdering?: boolean; // Toptancı Siparişi (PDF/WP/AI)
 listingBoost?: boolean; // Featured Listing in User App
 };
 highlighted?: boolean;
 trialDays?: number; // 0 = no trial
}

export type SupplierCategory = 'meat' | 'vegetable' | 'packaging' | 'spices' | 'other';

export interface Supplier {
 id: string;
 butcherId: string; // The butcher who owns this contact
 name: string;
 companyName?: string;
 contactName?: string;
 phone: string; // WhatsApp capable
 email?: string;
 category: SupplierCategory;
 address?: string; // For shipping context
 notes?: string;
 createdAt: Date;
 updatedAt: Date;
}

export interface B2BOrderItem {
 name: string;
 quantity: number;
 unit: string; // kg, adet, koli, paket
 note?: string;
}

export interface B2BOrder {
 id: string;
 butcherId: string;
 supplierId: string;
 supplierName: string; // Snapshot
 items: B2BOrderItem[];
 status: 'draft' | 'sent' | 'completed' | 'cancelled';
 method: 'whatsapp' | 'email' | 'pdf' | 'manual';
 sentAt?: Date;
 createdAt: Date;
 note?: string;
 totalAmount?: number;
 currency?: string;
 deliveryDate?: Date;
}

// =============================================================================
// KURYE TİPİ & MÜŞTERİ SİPARİŞİ (Commission Tracking)
// =============================================================================

export type CourierType = 'click_collect' | 'own_courier' | 'lokma_courier';

export interface CustomerOrderItem {
 productId: string;
 name: string;
 quantity: number;
 unit: string;
 unitPrice: number;
 totalPrice: number;
}

export interface CustomerOrder {
 id: string;
 orderNumber: string;

 // İşletme & Müşteri
 businessId: string; // businesses/businesses ID
 businessName: string;
 customerId: string;
 customerName: string;
 customerPhone?: string;

 // Sipariş Detayları
 items: CustomerOrderItem[];
 subtotal: number;
 deliveryFee: number;
 discount: number;
 total: number;
 currency: string;

 // Teslimat
 courierType: CourierType;
 deliveryAddress?: string;
 deliveryNote?: string;
 scheduledDelivery?: Date;

 // Provizyon (Plan bazlı hesaplama)
 commissionRate: number; // Uygulanan oran (%)
 commissionAmount: number; // Hesaplanan tutar (€)
 perOrderFee: number; // Sipariş başı ücret (€)
 totalCommission: number; // commissionAmount + perOrderFee
 isFreeOrder: boolean; // Ücretsiz sipariş dahilinde mi?

 // Ödeme
 paymentMethod: 'cash' | 'card' | 'online';
 paymentStatus: 'pending' | 'paid' | 'refunded';

 // Durum
 status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'onTheWay' | 'delivered' | 'cancelled';

 // Zaman Damgaları
 createdAt: Date;
 updatedAt: Date;
 acceptedAt?: Date;
 deliveredAt?: Date;
}

// =============================================================================
// FATURA SİSTEMİ (Almanya Vergi Uyumlu)
// =============================================================================

export type InvoiceType = 'customer' | 'commission' | 'subscription';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
export type TaxRate = 0 | 7 | 19; // Almanya: 0%, 7% (yiyecek), 19% (hizmet)

export interface InvoiceParty {
 name: string;
 address: string;
 city: string;
 postalCode: string;
 country: string;
 taxId?: string; // Steuernummer
 vatId?: string; // USt-IdNr
 email?: string;
 phone?: string;
 iban?: string; // Bankverbindung
 bic?: string; // BIC/SWIFT
}

export interface InvoiceLineItem {
 description: string;
 quantity: number;
 unit: string; // Stück, kg, etc.
 unitPrice: number; // Net birim fiyat
 taxRate: TaxRate;
 netAmount: number; // quantity * unitPrice
 vatAmount: number; // netAmount * taxRate/100
 grossAmount: number; // netAmount + vatAmount
}

export interface MerchantInvoice {
 id: string;
 invoiceNumber: string; // RE-2026-00001 veya GS-2026-00001 (Gutschrift)
 type: InvoiceType;
 status: InvoiceStatus;

 // Taraflar
 seller: InvoiceParty; // Satıcı (işletme veya LOKMA)
 buyer: InvoiceParty; // Alıcı (müşteri veya işletme)

 // Kalemler
 lineItems: InvoiceLineItem[];

 // Toplamlar
 netTotal: number; // KDV hariç toplam
 vatBreakdown: { // KDV dağılımı
 rate: TaxRate;
 netAmount: number;
 vatAmount: number;
 }[];
 vatTotal: number; // Toplam KDV
 grossTotal: number; // KDV dahil toplam
 currency: string; // EUR

 // Ödeme
 paymentMethod?: 'stripe' | 'sepa' | 'bank_transfer' | 'cash';
 paymentStatus: 'pending' | 'paid' | 'partial' | 'refunded';
 paymentDueDate: Date;
 paidAt?: Date;
 paidAmount?: number;

 // İlişkiler
 orderId?: string; // Sipariş faturası için
 businessId: string; // İlgili işletme
 customerId?: string; // Müşteri faturası için

 // Dönem (komisyon/abonelik için)
 periodStart?: Date;
 periodEnd?: Date;

 // Dosya
 pdfUrl?: string;
 pdfGeneratedAt?: Date;

 // Meta
 notes?: string;
 internalNotes?: string;
 createdAt: Date;
 updatedAt: Date;
 issuedAt?: Date;
 cancelledAt?: Date;
 cancellationReason?: string;
}

// =============================================================================
// FIRMENEINSTELLUNGEN (Company Settings)
// =============================================================================

/** German legal forms (Rechtsformen) */
export type GermanLegalForm =
 | 'einzelunternehmen' // Einzelunternehmen (Sole Proprietorship)
 | 'freiberufler' // Freiberufler (Freelancer)
 | 'gbr' // GbR (Gesellschaft bürgerlichen Rechts)
 | 'ohg' // OHG (Offene Handelsgesellschaft)
 | 'kg' // KG (Kommanditgesellschaft)
 | 'gmbh' // GmbH (Gesellschaft mit beschränkter Haftung)
 | 'ug' // UG (haftungsbeschränkt) - Mini-GmbH
 | 'ag' // AG (Aktiengesellschaft)
 | 'kgaa' // KGaA (Kommanditgesellschaft auf Aktien)
 | 'eg' // eG (eingetragene Genossenschaft)
 | 'partg' // PartG (Partnerschaftsgesellschaft)
 | 'partg_mbb' // PartG mbB
 | 'ev' // e.V. (eingetragener Verein)
 | 'stiftung' // Stiftung (Foundation)
 | 'se' // SE (Societas Europaea)
 | 'gmbh_co_kg'; // GmbH & Co. KG

export const GERMAN_LEGAL_FORM_LABELS: Record<GermanLegalForm, string> = {
 einzelunternehmen: 'Einzelunternehmen',
 freiberufler: 'Freiberufler',
 gbr: 'GbR (Gesellschaft bürgerlichen Rechts)',
 ohg: 'OHG (Offene Handelsgesellschaft)',
 kg: 'KG (Kommanditgesellschaft)',
 gmbh: 'GmbH (Gesellschaft mit beschränkter Haftung)',
 ug: 'UG (haftungsbeschränkt)',
 ag: 'AG (Aktiengesellschaft)',
 kgaa: 'KGaA (Kommanditgesellschaft auf Aktien)',
 eg: 'eG (eingetragene Genossenschaft)',
 partg: 'PartG (Partnerschaftsgesellschaft)',
 partg_mbb: 'PartG mbB',
 ev: 'e.V. (eingetragener Verein)',
 stiftung: 'Stiftung',
 se: 'SE (Societas Europaea)',
 gmbh_co_kg: 'GmbH & Co. KG',
};

export interface CompanySettings {
 // Firma Bilgileri
 companyName: string;
 legalForm: GermanLegalForm;
 address: string;
 postalCode: string;
 city: string;
 country: string;

 // Kontakt
 phone: string; // Hauptnummer
 customerServicePhone?: string; // Kundenservice-Hotline
 businessInfoPhone?: string; // Info-Hotline für Geschäftskunden
 email: string;
 website?: string;

 // Steuerdaten
 taxId: string; // Steuernummer
 vatId: string; // USt-IdNr (DE...)

 // Bankverbindung
 iban: string;
 bic: string;
 bankName?: string;
 accountHolder?: string; // Kontoinhaber (falls abweichend)

 // Handelsregister
 registerCourt?: string; // Amtsgericht
 registerNumber?: string; // HRB / HRA Nummer

 // Geschäftsführung
 managingDirector?: string; // Geschäftsführer
 authorizedRepresentative?: string; // Vertretungsberechtigter

 // Meta
 updatedAt?: any;
 updatedBy?: string;
}

// LOKMA Platform bilgileri — FALLBACK defaults (Firestore'dan yüklenirken kullanılır)
export const LOKMA_COMPANY_INFO: InvoiceParty = {
 name: 'LOKMA GmbH',
 address: 'Schulte-Braucks-Str. 1',
 city: 'Hückelhoven',
 postalCode: '41836',
 country: 'Deutschland',
 taxId: 'DEMO-ST-123456', // Demo Steuernummer
 vatId: 'DEMO-UST-DE123456', // Demo USt-IdNr
 email: 'info@lokma.shop',
 phone: '+49 2433 123456',
 iban: 'DE89 3704 0044 0532 0130 00', // Demo IBAN
 bic: 'COBADEFFXXX', // Demo BIC
};

// =============================================================================
// KASAP PLANLARI (Almanya)
// =============================================================================

export const BUTCHER_PLANS_V2: Record<LokmaPlanTier, LokmaPlanConfig> = {
 // -------------------------------------------------------------------------
 // FREE - Deneme / Vitrin / Mikro İşletme
 // -------------------------------------------------------------------------
 free: {
 id: 'free',
 name: 'MIRA Free',
 monthlyFee: 0,
 orderLimit: 30, // Aylık 30 sipariş dahil
 orderOverageFee: 0.50, // Aşım: 0,50 € / sipariş
 personnelLimit: 1, // Sadece 1 kullanıcı
 personnelOverageFee: 5, // Aşım: 5 € / ekstra kullanıcı
 features: {
 profile: true,
 productListing: true,
 onlineOrders: true,
 whatsappNotifications: false,
 pushNotifications: false,
 courierIntegration: false,
 etaTracking: false,
 campaigns: 0,
 reports: 'none',
 onlinePayment: false,
 multiUser: false,
 prioritySupport: false,
 liveCourierTracking: false,
 listingBoost: false,
 },
 trialDays: 0,
 },

 // -------------------------------------------------------------------------
 // BASIC - Ana Paket (İlk 3 Ay Ücretsiz)
 // -------------------------------------------------------------------------
 basic: {
 id: 'basic',
 name: 'MIRA Basic',
 monthlyFee: 29,
 orderLimit: 100, // Aylık 100 sipariş dahil
 orderOverageFee: 0.50, // Aşım: 0,50 € / sipariş
 personnelLimit: 3, // 3 kullanıcı dahil
 personnelOverageFee: 5, // Aşım: 5 € / ekstra kullanıcı
 features: {
 profile: true,
 productListing: true,
 onlineOrders: true,
 whatsappNotifications: true,
 pushNotifications: true,
 courierIntegration: true,
 etaTracking: false, // +15€/ay ek modül
 campaigns: 3, // Ayda max 3
 reports: 'basic',
 onlinePayment: false, // Nakit / kapıda ödeme
 multiUser: false,
 prioritySupport: false,
 liveCourierTracking: false,
 listingBoost: false,
 },
 highlighted: true, // "EN POPÜLER"
 trialDays: 90, // İlk 3 ay ücretsiz
 },

 // -------------------------------------------------------------------------
 // PREMIUM - Super Digital
 // -------------------------------------------------------------------------
 premium: {
 id: 'premium',
 name: 'MIRA Premium',
 monthlyFee: 59,
 orderLimit: null, // Sınırsız
 orderOverageFee: 0, // Aşım ücreti yok
 personnelLimit: null, // Sınırsız personel
 personnelOverageFee: 0, // Aşım ücreti yok
 features: {
 profile: true,
 productListing: true,
 onlineOrders: true,
 whatsappNotifications: true,
 pushNotifications: true,
 courierIntegration: true,
 etaTracking: true, // Dahil
 campaigns: 'unlimited',
 reports: 'advanced',
 onlinePayment: true, // Stripe Connect
 multiUser: true,
 prioritySupport: true,
 liveCourierTracking: true,
 listingBoost: true,
 },
 trialDays: 90,
 },
};

// =============================================================================
// DYNAMIC SUBSCRIPTION PLANS (Allowing Super Admins to Create/Edit Plans)
// =============================================================================

export interface ButcherSubscriptionPlan {
 id: string; // Firestore Doc ID
 businessType: string; // Dynamic - synced with sectors collection categories
 code: string; // 'entry', 'pro', 'premium' etc.
 name: string; // Display Name (Başlangıç, Profesyonel)
 description?: string;
 monthlyFee: number;
 yearlyFee: number; // Yıllık ödeme tutarı (Örn: 10x aylık)
 currency: string;
 billingCycle: 'monthly' | 'yearly'; // Varsayılan döngü veya UI tercihi

 // Cost Recovery (ESL Hardware, Onboarding)
 setupFee: number; // One-time fee (e.g. for ESL installation or general setup)
 minContractMonths: number; // Minimum commitment

 // ESL Add-on
 eslEnabled?: boolean;
 eslTagCount?: number;
 eslStartDate?: Date; // To track ownership progress

 // Smart Notifications (IoT/Webhook)
 smartNotifications?: {
 enabled: boolean;
 gatewayUrl?: string; // IoT Gateway adresi
 gatewayApiKey?: string; // Gateway API key
 webhookUrl?: string; // Legacy: IFTTT, Home Assistant etc.
 alexaEnabled?: boolean; // Alexa ses bildirimi
 alexaLanguage?: 'tr' | 'de'; // Duyuru dili
 ledEnabled?: boolean; // WLED LED bildirim
 ledColor?: string; // Hex renk
 hueEnabled?: boolean; // Philips Hue
 soundEnabled: boolean; // Browser audio
 flashScreen?: boolean; // Visual alert
 };

 miraAppConnected?: boolean; // App Store app indirdi mi?: string;
 stripeProductId?: string;
 stripePriceId?: {
 monthly: string;
 yearly: string;
 };
 eslStripePriceId?: string; // Price ID for PER TAG rental (monthly)
 eslMonthlyPrice?: number; // UI Preview ONLY (e.g. 2.00 EUR/tag)
 eslOwnershipMonths?: number; // 0=Always Rent, 12, 24 etc.

 // Financials - Kurye Bazlı Provizyon (Yüzdesel)
 commissionClickCollect: number; // Gel-Al provizyonu (%)
 commissionOwnCourier: number; // Kendi kurye provizyonu (%)
 commissionLokmaCourier: number; // LOKMA kurye provizyonu (%)

 // Sipariş Başı Ücret
 perOrderFeeType: 'percentage' | 'fixed' | 'none'; // % veya € veya yok
 perOrderFeeAmount: number; // Tutar (oran veya sabit)

 // Limits & Rules
 orderLimit: number | null; // null for unlimited
 orderOverageAction: 'block' | 'overage_fee' | 'none'; // What to do when limit is reached
 orderOverageFee: number; // Fee per extra order if action is 'overage_fee'

 productLimit: number | null; // null for unlimited, e.g. 30
 campaignLimit: number | null; // null for unlimited, e.g. 0 or 3
 freeOrderCount: number; // İlk X sipariş ücretsiz

 personnelLimit?: number | null; // null for unlimited
 personnelOverageFee?: number; // Fee per extra personnel
 tableReservationLimit: number | null; // Dahil masa sayısı (null = sınırsız)
 tableReservationOverageFee: number; // Limit aşım ücreti (€/rezervasyon)

 // Sponsored Products (Öne Çıkan Ürünler)
 sponsoredFeePerConversion: number; // Plan bazlı sipariş başı ücret (€) — 0 = bedava
 sponsoredMaxProducts: number; // Bu plandaki max öne çıkan ürün sayısı

 trialDays: number;

 // Feature Toggles (Granular Control)
 features: {
 clickAndCollect: boolean; // Sipariş dükkandan teslim
 delivery: boolean; // Kurye teslimat desteği
 onlinePayment: boolean; // Kredi kartı / Apple Pay
 campaigns: boolean; // İndirim/Kampanya oluşturma
 basicStatsOnly: boolean; // True = Sadece görüntülenme, False = Detaylı raporlar
 marketing: boolean; // Bölgesel vitrin / Banner
 prioritySupport: boolean; // Öncelikli destek
 liveCourierTracking: boolean; // Canlı Kurye (ETA) Takibi
 aiBestPrice?: boolean; // AI Fiyat Önerisi (ortalama + satış günü bazlı)
 tableReservation?: boolean; // Masa Rezervasyonu
 staffShiftTracking?: boolean; // İşçi Çalışma Saatleri Takibi & Export
 // 🎯 Promosyon & Pazarlama Modülleri (Plan aktif eder → İşletme kontrol eder)
 couponSystem?: boolean; // 🎟️ Kupon/Promo Code sistemi
 referralSystem?: boolean; // 🤝 Referral (Davet Et Kazan)
 firstOrderDiscount?: boolean; // 🎁 İlk Sipariş İndirimi
 freeDrink?: boolean; // 🍺 Gratis İçecek Modülü
 donationRoundUp?: boolean; // 💚 Bağış Yuvarlama Modülü
 [key: string]: boolean | string | number | undefined;
 };

 // UI Presentation
 color: string;
 highlighted: boolean;
 order: number;

 // Metadata
 isActive: boolean;
 createdAt: Date;
 updatedAt: Date;
}

// =============================================================================
// EK MODÜLLER
// =============================================================================

export const ADDON_MODULES = {
 // ETA Uyumlu Canlı Kurye Takibi (Sadece Basic & Premium)
 eta_tracking: {
 name: 'ETA Canlı Kurye Takibi',
 monthlyFee: 15, // +15 €/ay
 trialDays: 90, // İlk 3 ay ücretsiz
 features: [
 'Canlı harita',
 'ETA hesaplama',
 'Trafiğe göre güncelleme',
 'Müşteriye "sipariş yolda" bildirimi',
 ],
 requiredPlan: ['basic', 'premium'] as LokmaPlanTier[],
 },

 // WhatsApp Paketi
 whatsapp_pack: {
 name: 'WhatsApp Bildirim Paketi',
 monthlyFee: 29,
 trialDays: 0,
 features: [
 '500 mesaj dahil',
 'Sipariş bildirimleri',
 'Kampanya mesajları',
 'Aşım: 0,10 €/mesaj',
 ],
 requiredPlan: ['basic', 'premium'] as LokmaPlanTier[],
 },
};

// =============================================================================
// DENEME SÜRESİ AYARLARI
// =============================================================================

export const TRIAL_CONFIG = {
 durationDays: 90, // 3 ay ücretsiz
 planDuringTrial: 'basic' as LokmaPlanTier,
 etaModuleFree: true, // ETA modülü de deneme süresinde ücretsiz
};

// =============================================================================
// STRIPE CONNECT AYARLARI (PREMIUM ONLY)
// =============================================================================

export const STRIPE_CONNECT_CONFIG = {
 // MIRA %0 ek komisyon alır
 miraCommissionRate: 0,

 // Stripe komisyonu aynen yansıtılır
 stripePassthrough: true,

 // Haftalık otomatik payout
 payoutSchedule: 'weekly' as const,
 payoutDay: 'monday' as const,
};

// =============================================================================
// İŞLETME STATE ŞEMASI (Uygulama İçi Kural Motoru)
// =============================================================================

export interface BusinessPlanState {
 plan: LokmaPlanTier;
 monthlyOrderLimit: number | null;
 orderPrice: number; // Aşım ücreti
 currentMonthOrders: number;

 // Personnel tracking
 maxPersonnel: number | null;
 personnelOverageFee: number;
 currentPersonnelCount?: number;
 campaignLimit: number | 'unlimited';
 courierEnabled: boolean;
 onlinePaymentEnabled: boolean;
 etaAddon: boolean;
 whatsappAddon: boolean;
 trialEndsAt: Date | null;
}


// Admin types for MIRA Portal
export type AdminRole = 'super_admin' | 'admin' | 'sub_admin' | 'hotline';

export type AdminType =
 | 'super'
 | 'admin'
 | 'staff';

export interface Admin {
 id: string;
 email: string;
 displayName: string;
 firstName?: string;
 lastName?: string;
 phone?: string;
 photoURL?: string; // Profile avatar URL
 role: AdminRole;
 adminType: AdminType;
 parentAdminId?: string; // For sub-admins
 currency?: string;

 // 🔑 UNIVERSAL BUSINESS ASSIGNMENT (Sector-agnostic)
 // This is the PRIMARY field for linking admin to their business
 // Works for ALL business types: kasap, market, restoran, cicekci, etc.
 businessId?: string; // Universal field - linked business ID
 businessName?: string; // Universal field - linked business name
 businessType?: string; // Universal field - business type (kasap, market, etc.)

 // M:N Role Assignments
 assignments?: AdminAssignment[];

 // Legacy fields (kept for backward compatibility)
 butcherId?: string; // @deprecated - use businessId instead
 butcherName?: string; // @deprecated - use businessName instead
 restaurantId?: string; // @deprecated - use businessId instead
 restaurantName?: string; // @deprecated - use businessName instead
 marketId?: string; // @deprecated - use businessId instead
 kermesId?: string; // @deprecated - use businessId instead

 location?: string;
 permissions: string[]; // Legacy — kept for backward compat
 createdAt: Date;
 createdBy: string;
 isActive: boolean;

// ═══ RBAC 2.0 — Module-Based Permission System ═══
 /** Reference to a permission group template (e.g. 'owner', 'manager', 'cashier') */
 permissionGroupId?: string;
 /** Effective permission map — resolved from group + overrides. { "orders.view": true, ... } */
 permissionMap?: Record<string, boolean>;
 /** Per-user overrides on top of group permissions. { "revenue.view": false } */
 permissionOverrides?: Record<string, boolean>;
 subscriptionId?: string;
 subscriptionStatus?: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'none';
 smartNotifications?: {
 enabled?: boolean;
 gatewayUrl?: string;
 gatewayApiKey?: string;
 webhookUrl?: string;
 alexaEnabled?: boolean;
 alexaLanguage?: 'tr' | 'de';
 ledEnabled?: boolean;
 ledColor?: string;
 hueEnabled?: boolean;
 soundEnabled?: boolean;
 flashScreen?: boolean;
 };
 printerSettings?: {
 enabled?: boolean;
 printerType?: string;
 printerIp?: string;
 printerPort?: number;
 paperWidth?: number;
 autoPrint?: boolean;
 printCopies?: number;
 };
}

export interface AdminAssignment {
 id: string; // Unique assignment ID (e.g. UUID)
 entityId: string; // businessId or kermesId
 entityType: 'business' | 'kermes';
 entityName: string; // For display purposes (e.g. 'A&P Pizzeria')
 role: AdminType; // e.g. 'isletme_staff', 'kermes_admin', 'teslimat'
 assignedAt?: string | Date;
}

// Kermes Types
export interface KermesEvent {
 id: string;
 title: string;
 description?: string;

 // Location
 city?: string;
 state?: string;
 country?: string;
 location?: string;
 address?: string;

 // Dates & Times
 date?: Date;
 startDate?: any;
 endDate?: any;
 openingTime?: string;
 closingTime?: string;

 // Contact & Organization
 organizerId: string;
 organizationId?: string; // Link to organizations collection
 phoneNumber?: string;

 // Sponsor
 sponsor?: 'tuna' | 'akdeniz_toros' | 'none';
 activeBadgeIds?: string[];

 // Items (legacy field for backward compatibility)
 items?: KermesItem[];

 // Status
 isActive: boolean;
 isArchived?: boolean;
 archivedAt?: any;
 createdAt?: any;
 updatedAt?: any;
}

export interface KermesItem {
 id: string;
 name: string;
 category: 'yemek' | 'tatli' | 'icecek' | 'diger';
 price: number;
 imageUrl?: string;
 isAvailable: boolean;
 stock?: number;
}

export interface KeremsDonation {
 id: string;
 kermesId: string;
 amount: number;
 donorName?: string;
 isAnonymous: boolean;
 message?: string;
 createdAt: Date;
}

// Butcher Partner Types (ERP Module)
export interface ButcherPartner {
 id: string;

 // Firma Bilgileri
 companyName: string;
 tradeName?: string; // Ticari unvan
 taxNumber?: string; // Vergi No
 customerId: string; // Müşteri No (MK-001)
 imageUrl?: string; // Kasap resmi (opsiyonel)


 // Marka
 brand: 'tuna' | 'akdeniz_toros' | 'independent';
 brandLabelActive: boolean; // TUNA/Toros badge gösterilsin mi?

 // İşletme/Dükkan Adresi
 address: {
 street: string;
 postalCode: string;
 city: string;
 country: string;
 };
 country?: string; // ISO 3166-1 alpha-2 (e.g. 'DE', 'TR')
 currency?: string; // ISO 4217 (e.g. 'EUR', 'TRY')

 // Dükkan İletişim
 shopPhone?: string;
 shopEmail?: string; // Dükkan genel e-posta

 // Çalışma Saatleri (Google Maps 'weekday_text' array: ["Monday: 09:00 - 18:00", ...])
 openingHours?: string[];
 pickupHours?: string[];
 deliveryHours?: string[];
 pickupStartTime?: string;
 pickupEndTime?: string;
 deliveryStartTime?: string;
 deliveryEndTime?: string;

 // Google Places Data
 googlePlaceId?: string;
 rating?: number;
 userRatingsTotal?: number;

 // Fatura Adresi (farklı ise)
 hasDifferentBillingAddress?: boolean;
 billingAddress?: {
 street: string;
 postalCode: string;
 city: string;
 country: string;
 };

 // Yetkili Kişi (MIRA İrtibatı / Birinci Admin)
 contactPerson: {
 name: string;
 surname: string;
 phone: string;
 email?: string;
 role?: string; // Sahip, Müdür vs.
 };

 // Abonelik & Plan
 subscriptionId?: string; // Stripe Subscription ID for automated billing
 subscriptionPlan: string; // Dynamic Plan ID ('free', 'basic', 'pro', 'ultra', etc.)
 subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'none';
 subscriptionStartDate?: Date;
 nextSubscriptionPlan?: string; // Gelecek ay başlayacak plan
 nextSubscriptionDate?: Date; // Plan değişikliğinin devreye gireceği tarih
 billingCycle: 'monthly' | 'yearly'; // Ödeme döngüsü
 renewalDate?: Date; // Bir sonraki ödeme tarihi
 monthlyFee: number; // Seçilen döngüye göre düşen aylık/yıllık tutar

 // Subscription History
 subscriptionHistory?: {
 plan: string;
 startDate: Date;
 endDate?: Date;
 reason?: string; // 'upgrade', 'downgrade', 'cancellation', 'initial'
 changedBy?: string;
 }[];

 // Live Usage Tracking (Current Billing Period)
 currentPeriodUsage?: {
 ordersCount: number;
 pushCount: number;
 calculatedOverageFee: number; // Snapshot of extra costs so far
 periodStart: Date;
 periodEnd: Date;
 };

 // ESL Hardware
 eslEnabled?: boolean;
 eslTagCount?: number; // Kiralanan etiket sayısı
 eslStartDate?: Date | null; // Kiralama başlangıç tarihi

 // Hesap Durumu
 accountBalance: number; // Açık hesap (+ alacak, - borç)
 lastPaymentAmount?: number;
 stripeCustomerId?: string; // Stripe Customer ID used for billing
 lastPaymentDate?: Date;

 // MIRA Bağlantısı
 linkedUserId?: string; // MIRA uygulamasındaki user ID
 miraAppConnected: boolean;

 // GPS & Harita
 lat?: number;
 lng?: number;


 reviewCount?: number;
 reviews?: any[]; // Allow storing reviews array (type 'any' for flexibility for now)

 // Teslimat Ayarları
 supportsDelivery?: boolean;
 deliveryPostalCode?: string; // Merkez PLZ (kasabın kendi PLZ'si)
 deliveryRadius?: number; // Teslimat yarıçapı (km)

 // Grup Siparişi Ayarları
 groupOrderLinkEnabled?: boolean;
 groupOrderTableEnabled?: boolean;

 // Smart Notifications & IOT
 smartNotifications?: {
 enabled?: boolean;
 gatewayUrl?: string;
 gatewayApiKey?: string;
 webhookUrl?: string;
 alexaEnabled?: boolean;
 alexaLanguage?: 'tr' | 'de';
 ledEnabled?: boolean;
 ledColor?: string;
 hueEnabled?: boolean;
 soundEnabled?: boolean;
 flashScreen?: boolean;
 };
 minDeliveryOrder?: number;
 deliveryFee?: number;

 // Ödeme Seçenekleri
 acceptsCardPayment?: boolean;
 acceptsCash?: boolean; // 🆕 Nakit ödeme kabul
 acceptsMealCards?: boolean; // 🆕 Yemek kartı kabul (Sodexo, Ticket, vb.)

 // 🆕 Hızlı Filtre Özellikleri
 offersVegetarian?: boolean; // Vejetaryen menü var mı
 isHalal?: boolean; // Helal sertifikalı mı
 hasActiveDiscounts?: boolean; // Aktif indirim/kampanya var mı

 // Stripe Connect (Marketplace)
 stripeConnectAccountId?: string; // Kasabın Stripe Connect hesabı
 stripeConnectStatus?: 'pending' | 'active' | 'restricted' | 'disabled';
 hasOwnPaymentSystem?: boolean; // Kendi kart POS'u var mı?
 commissionRate?: number; // Komisyon oranı (% olarak, örn: 5)
 payoutSchedule?: 'daily' | 'weekly' | 'monthly'; // Ödeme sıklığı

 // SEPA Banka Bilgileri (Maskeli - Gerçek IBAN sadece Stripe'da saklanır)
 bankAccount?: {
 last4: string; // Son 4 hane (örn: "1234")
 bankName: string; // Banka adı
 accountHolderName: string; // Hesap sahibi
 stripePaymentMethodId: string; // Stripe PM ID
 mandateId?: string; // Stripe SEPA Mandate ID
 mandateStatus?: 'pending' | 'active' | 'inactive';
 mandateDate?: Date;
 };

 // Manual Bank Details (For Invoice/Admin)
 bankDetails?: {
 iban: string;
 bic: string;
 bankName: string;
 accountHolder: string;
 };

 // Meta
 isActive: boolean;
 createdAt?: Date;
 updatedAt?: Date;
 notes?: string;
}

// =============================================================================
// FATURALAMA SİSTEMİ
// =============================================================================

// Fatura Kalemi
export interface InvoiceItem {
 description: string;
 quantity: number;
 unitPrice: number;
 total: number;
 type: 'subscription' | 'commission' | 'addon' | 'adjustment';
}

// Fatura
export interface Invoice {
 id: string;
 invoiceNumber: string; // INV-2024-001

 // Müşteri Bilgileri
 butcherId: string;
 butcherName: string;
 butcherAddress: string;
 butcherTaxId?: string;

 // Dönem
 period: string; // 2024-12
 periodStart: Date;
 periodEnd: Date;

 // Kalemler
 items: InvoiceItem[];
 subtotal: number;
 taxRate: number; // 19
 taxAmount: number;
 total: number;

 // Ek Ücret (Kart/PayPal ile ödemede)
 surchargeRate?: number; // 2.5
 surchargeAmount?: number;
 grandTotal: number;
 currency?: string;

 // Durum
 status: 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue' | 'storno';

 // GoBD Storno (İptal) - Almanya mali mevzuatı
 isStorno?: boolean; // Bu bir storno faturası mı?
 isCancelled?: boolean; // Bu fatura storno edildi mi?
 originalInvoiceId?: string; // Storno edilen orijinal fatura
 originalInvoiceNumber?: string; // Orijinal fatura numarası
 stornoInvoiceNumber?: string; // Bu faturayı storno eden fatura no
 stornoReason?: string; // Storno sebebi (zorunlu)
 cancelledAt?: Date;
 cancelledBy?: string;
 cancelReason?: string;

 // Ödeme Bilgileri
 paymentMethod?: 'sepa' | 'card' | 'paypal' | 'bank_transfer';
 stripeInvoiceId?: string;
 stripePaymentIntentId?: string;

 // Tarihler
 issueDate: Date;
 dueDate: Date;
 paidAt?: Date;

 // PDF
 pdfUrl?: string;
 pdfGeneratedAt?: Date;

 // Email
 emailSentAt?: Date;
 reminderSentAt?: Date;

 // Audit Trail
 createdBy?: string;
 description?: string;

 // Meta
 createdAt: Date;
 updatedAt: Date;
 notes?: string;
}

// Ödeme Yöntemi
export interface PaymentMethod {
 id: string;
 butcherId: string;

 type: 'sepa' | 'card';
 isDefault: boolean;

 // SEPA
 iban?: string;
 last4?: string; // Son 4 hane
 bankName?: string;
 accountHolderName?: string;
 mandateId?: string;
 mandateStatus?: 'pending' | 'active' | 'inactive';

 // Kart
 cardBrand?: string; // visa, mastercard
 cardLast4?: string;
 cardExpMonth?: number;
 cardExpYear?: number;

 // Stripe
 stripePaymentMethodId: string;

 // Meta
 createdAt: Date;
 updatedAt: Date;
}

// Payout (Stripe Connect - Kasaba Ödeme)
export interface Payout {
 id: string;
 butcherId: string;

 // Dönem
 periodStart: Date;
 periodEnd: Date;

 // Tutar
 grossAmount: number; // Brüt satış
 commissionAmount: number; // Komisyon
 netAmount: number; // Net ödeme

 // Durum
 status: 'pending' | 'processing' | 'paid' | 'failed';
 stripePayoutId?: string;

 // Ödeme Tarihi
 scheduledDate: Date;
 paidAt?: Date;

 // Sipariş Detayları
 orderCount: number;
 orderIds: string[];

 // Meta
 createdAt: Date;
 updatedAt: Date;
}

// =============================================================================
// CENAZE FONU & NAKİL (FUNERAL MODULE)
// =============================================================================

export interface FuneralMember {
 id: string; // Auto-ID
 memberNumber: string; // Unique Member No (e.g., "TR-12345")

 // Personal Info
 personalInfo: {
 firstName: string;
 lastName: string;
 tcNoOrPassport: string;
 dateOfBirth: Date;
 placeOfBirth: string;
 gender: 'male' | 'female';
 nationality: string;
 phone: string;
 email?: string;
 address: {
 street: string;
 postalCode: string;
 city: string;
 country: string;
 };
 };

 // Membership Status
 status: 'active' | 'pending' | 'passive' | 'debtor' | 'deceased';
 joinDate: Date;

 // Subscription Plan
 subscription: {
 plan: 'family' | 'single';
 fee: number; // Yearly fee
 currency: 'EUR';
 startDate: Date;
 renewalDate: Date;
 waitingPeriodEnds?: Date; // For new members
 };

 // Financial
 balance: number; // Positive = credit, Negative = debt
 lastPaymentDate?: Date;

 // Dependents (Family Plan)
 dependents: FuneralDependent[];

 // Metadata
 isActive: boolean;
 createdAt: Date;
 updatedAt: Date;
 notes?: string;
}

export interface FuneralDependent {
 id: string; // usually uuid
 firstName: string;
 lastName: string;
 relation: 'spouse' | 'child' | 'parent' | 'other';
 dateOfBirth: Date;
 gender: 'male' | 'female';
 status: 'active' | 'deceased';
}

export interface FuneralCase {
 id: string; // Auto-ID
 funeralId: string; // Human Readable ID (e.g., "FNR-2026-000234")
 memberId?: string; // Optional (if member)

 // Deceased Info
 deceased: {
 firstName: string;
 lastName: string;
 gender: 'male' | 'female';
 dateOfBirth: Date;
 dateOfDeath: Date;
 placeOfDeath: {
 city: string;
 country: string;
 hospital?: string;
 };
 };

 // Contact Person (Relative)
 contact: {
 name: string;
 phone: string;
 relation: string;
 email?: string;
 };

 // Service Details
 serviceType: 'transfer_tr' | 'transfer_eu' | 'burial_de';
 status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

 // Locations
 location: {
 pickupAddress: string;
 burialCity: string;
 burialCountry: string;
 burialCemetery?: string;
 };

 // Assignment
 assignment: {
 region?: string; // e.g., "NRW"
 mainAdminId?: string;
 subAdminId?: string;
 operationStaffId?: string;
 };

 // Timeline/Audit
 createdAt: Date;
 updatedAt: Date;
 createdBy: string;
}
