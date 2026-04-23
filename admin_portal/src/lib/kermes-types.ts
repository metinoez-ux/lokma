// ============================================
// 🎪 KERMES TYPES & FEATURES
// ============================================

import { Timestamp } from 'firebase-admin/firestore';

// Kermes Özellikleri (Chip'ler)
export enum KermesFeature {
 TUNA = 'tuna', // Tuna logosu
 KIDS_FRIENDLY = 'kids', // Çocuk etkinliği
 CARD_PAYMENT = 'card_payment', // Kart ile ödeme
 PARKING = 'parking', // Park yeri mevcut
 FAMILY_TENTS = 'family_tents', // Aile çadırları
 INDOOR_AREA = 'indoor', // Kapalı alan
 ARGELATO_ICE_CREAM = 'argelato_ice_cream', // Argelato Dondurma
}

// Feature görsel config
export const FEATURE_CONFIG: Record<KermesFeature, {
 icon: string;
 label: string;
 labelTr: string;
 color: string;
}> = {
 [KermesFeature.TUNA]: {
 icon: '🎯',
 label: 'Tuna',
 labelTr: 'Tuna',
 color: 'bg-purple-500',
 },
 [KermesFeature.KIDS_FRIENDLY]: {
 icon: '👶',
 label: 'Kids Friendly',
 labelTr: 'Çocuk Etkinliği',
 color: 'bg-blue-500',
 },
 [KermesFeature.CARD_PAYMENT]: {
 icon: '💳',
 label: 'Card Payment',
 labelTr: 'Kart ile Ödeme',
 color: 'bg-green-500',
 },
 [KermesFeature.PARKING]: {
 icon: '🅿️',
 label: 'Parking',
 labelTr: 'Park Yeri',
 color: 'bg-yellow-500',
 },
 [KermesFeature.FAMILY_TENTS]: {
 icon: '👨‍👩‍👧',
 label: 'Family Tents',
 labelTr: 'Aile Çadırları',
 color: 'bg-pink-500',
 },
 [KermesFeature.INDOOR_AREA]: {
 icon: '🏠',
 label: 'Indoor Area',
 labelTr: 'Kapalı Alan',
 color: 'bg-indigo-500',
 },
 [KermesFeature.ARGELATO_ICE_CREAM]: {
 icon: '🍦',
 label: 'Argelato Ice Cream',
 labelTr: 'Argelato Dondurma',
 color: 'bg-amber-500',
 },
};

// Park bilgisi
export interface ParkingInfo {
 hasParking: boolean; // "Yeterince park yeri mevcut"
 hasNearbyParking: boolean; // "Yakınlarda park yeri mevcut"
 customNote?: string; // Özel not
}

// Adres bilgisi (Google Places)
export interface KermesAddress {
 fullAddress: string;
 street: string;
 city: string;
 postalCode: string;
 country: string;
 placeId?: string; // Google Places ID
 coordinates?: {
 lat: number;
 lng: number;
 };
}

// İletişim bilgisi
export interface KermesContact {
 name: string;
 phone: string;
 email?: string;
}

// Günlük çalışma saatleri
export interface DailyHours {
 open: string; // "09:00"
 close: string; // "18:00"
}

// Kermes durumu
export type KermesStatus = 'draft' | 'active' | 'ended' | 'cancelled';

// 🎪 Ana Kermes Interface
export interface Kermes {
 id: string;

 // Temel bilgiler
 name: string;
 description: string;
 organizationId: string;

 // Tarih & saat
 startDate: Timestamp | Date | string;
 endDate: Timestamp | Date | string;
 dailyHours: DailyHours;

 // İletişim
 contact: KermesContact;

 // Impressum / Rechtliche Angaben
 legalForm?: string;
 managingDirector?: string;
 authorizedRepresentative?: string;
 registerCourt?: string;
 registerNumber?: string;
 vatNumber?: string;
 customerId?: string;

 // Adres
 address: KermesAddress;

 // Park
 parking: ParkingInfo;

 // Özellikler
 features: KermesFeature[];

 // Menü (opsiyonel - ayrı collection'da da olabilir)
 hasMenu: boolean;
 menuId?: string;

 // Durum & meta
 status: KermesStatus;
 createdAt: Timestamp | Date;
 updatedAt: Timestamp | Date;
 createdBy: string;
}

// Kermes oluşturma formu için input type
export interface CreateKermesInput {
 name: string;
 description: string;
 organizationId: string;
 startDate: string; // ISO date string
 endDate: string;
 dailyHours: DailyHours;
 contact: KermesContact;
 // Impressum / Rechtliche Angaben
 legalForm?: string;
 managingDirector?: string;
 authorizedRepresentative?: string;
 registerCourt?: string;
 registerNumber?: string;
 vatNumber?: string;
 customerId?: string;
 address: KermesAddress;
 parking: ParkingInfo;
 features: KermesFeature[];
}

// Menü kategorisi
export interface MenuCategory {
 id: string;
 kermesId: string;
 name: string;
 icon?: string;
 order: number;
 createdAt: Timestamp | Date;
}

// Menü öğesi
export interface MenuItem {
 id: string;
 kermesId: string;
 categoryId: string;
 name: string;
 description?: string;
 price: number;
 image?: string;
 isAvailable: boolean;
 order: number;
 createdAt: Timestamp | Date;
 updatedAt: Timestamp | Date;
}
