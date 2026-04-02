/**
 * Organization Types - Kermes Organizasyon Yapısı
 * 
 * Her kermes bir organizasyona bağlıdır.
 * Organizasyonlar: VIKZ camileri, DITIB, IGMG, Bağımsız dernekler vb.
 */

// Organizasyon türleri
export type OrganizationType = 'vikz' | 'ditib' | 'diyanet' | 'igmg' | 'bagimsiz' | 'other';

// Organizasyon interface'i
export interface Organization {
 id: string;
 name: string; // Dernek adı (örn: "Islamisches Kulturzentrum Hückelhoven")
 shortName?: string; // Kısa ad (örn: "IKZ Hückelhoven")
 type: OrganizationType; // Organizasyon türü
 city: string; // Şehir
 state?: string; // Eyalet (Landesverband)
 postalCode?: string; // Posta kodu
 address?: string; // Tam adres
 country: string; // Ülke (DE, TR)
 phone?: string;
 email?: string;
 website?: string;
 sourceUrl?: string; // Kaynak URL (VIKZ.de vb.)

 // Admin bilgileri
 adminIds?: string[]; // Firebase User IDs of admins
 primaryAdminId?: string; // İşletme sahibi (ana admin)

 // Kermes bilgileri
 activeKermesIds?: string[]; // Aktif kermes IDs
 totalKermesCount?: number; // Toplam yapılan kermes sayısı

 // Meta
 isActive: boolean;
 createdAt: Date | any; // Firestore Timestamp
 updatedAt: Date | any;
 importedFrom?: 'vikz.de' | 'ditib.de' | 'manual' | string;
}

// Organizasyon türleri ve etiketleri
export const ORGANIZATION_TYPES: { value: OrganizationType; label: string; icon: string; color: string }[] = [
 { value: 'vikz', label: 'VIKZ', icon: '🕌', color: 'green' },
 { value: 'ditib', label: 'DİTİB', icon: '🏛️', color: 'blue' },
 { value: 'diyanet', label: 'Diyanet', icon: '☪️', color: 'teal' },
 { value: 'igmg', label: 'IGMG', icon: '🕋', color: 'purple' },
 { value: 'bagimsiz', label: 'Bağımsız Dernek', icon: '🏠', color: 'amber' },
 { value: 'other', label: 'Diğer', icon: '📍', color: 'gray' },
];

// Yardımcı fonksiyonlar
export function getOrganizationTypeLabel(type: OrganizationType): string {
 return ORGANIZATION_TYPES.find(t => t.value === type)?.label || type;
}

export function getOrganizationTypeIcon(type: OrganizationType): string {
 return ORGANIZATION_TYPES.find(t => t.value === type)?.icon || '📍';
}

export function getOrganizationTypeColor(type: OrganizationType): string {
 return ORGANIZATION_TYPES.find(t => t.value === type)?.color || 'gray';
}

// Varsayılan boş organizasyon
export const DEFAULT_ORGANIZATION: Partial<Organization> = {
 name: '',
 type: 'bagimsiz',
 city: '',
 country: 'DE',
 isActive: true,
 adminIds: [],
 activeKermesIds: [],
 totalKermesCount: 0,
};
