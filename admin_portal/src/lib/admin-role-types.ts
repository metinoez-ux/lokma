/**
 * Admin Role Types - Çoklu Rol Yapısı
 * 
 * Bir kullanıcı birden fazla role sahip olabilir.
 * Bu dosya çoklu rol yapısını tanımlar.
 */

// Rol türleri
// 🆕 Konsolide roller: admin / staff
export type AdminRoleType =
 | 'super' // Süper Admin - Tüm sistem
 | 'admin' // İşletme / Kermes Admin
 | 'staff'; // İşletme / Kermes Personel

// Tek bir rol tanımı
export interface AdminRole {
 type: AdminRoleType; // Rol türü

 // İşletme bazlı roller için
 businessId?: string; // businesses/{id}
 businessName?: string; // İşletme adı

 // Organizasyon bazlı roller için (kermes)
 organizationId?: string; // organizations/{id}
 organizationName?: string; // Organizasyon adı

 // Rol meta bilgileri
 isPrimary: boolean; // Ana rol mü?
 isActive: boolean; // Aktif mi?
 assignedAt: Date | any; // Atama tarihi
 assignedBy: string; // Atayan admin ID/email

 // Opsiyonel notlar
 notes?: string;
}

// Admin dokümanı - Çoklu rol destekli
export interface AdminDocument {
 // Temel bilgiler
 firebaseUid: string;
 email: string;
 displayName: string;
 firstName?: string;
 lastName?: string;
 phoneNumber?: string;
 photoURL?: string;

 roles: AdminRole[];

 // Geriye uyumluluk için mevcut alanlar
 adminType?: AdminRoleType; // Ana rol
 butcherId?: string; 
 butcherName?: string; 
 organizationId?: string; 
 organizationName?: string; 

 // Meta bilgiler
 isActive: boolean;
 isPrimaryAdmin?: boolean; // İşletme sahibi
 createdAt: Date | any;
 updatedAt: Date | any;
 createdBy?: string;
 updatedBy?: string;
}

// Platformda genel adminlik var mı?
export function roleRequiresBusiness(type: AdminRoleType): boolean {
 // Both 'admin' and 'staff' typically require a business assignment 
 // to know WHERE they operate, unless they are super.
 return ['admin', 'staff'].includes(type);
}

export function roleRequiresOrganization(type: AdminRoleType): boolean {
 return ['admin', 'staff'].includes(type);
}

// Yardımcı: Rol etiketi al
export function getAdminRoleLabel(type: AdminRoleType): string {
 const labels: Record<AdminRoleType, string> = {
 'super': '👑 Süper Admin',
 'admin': '🏪/🎪 Yönetici (Admin)',
 'staff': '🏪/🎪 Personel',
 };
 return labels[type] || type;
}

// Yardımcı: Ana rolü bul
export function getPrimaryRole(roles: AdminRole[]): AdminRole | undefined {
 return roles.find(r => r.isPrimary && r.isActive) || roles.find(r => r.isActive);
}

// Yardımcı: Belirli türdeki rolleri bul
export function getRolesByType(roles: AdminRole[], type: AdminRoleType): AdminRole[] {
 return roles.filter(r => r.type === type && r.isActive);
}

// Yardımcı: Belirli işletme için rolü bul
export function getRoleForBusiness(roles: AdminRole[], businessId: string): AdminRole | undefined {
 return roles.find(r => r.businessId === businessId && r.isActive);
}

// Yardımcı: Belirli organizasyon için rolü bul
export function getRoleForOrganization(roles: AdminRole[], organizationId: string): AdminRole | undefined {
 return roles.find(r => r.organizationId === organizationId && r.isActive);
}

// Mevcut tek-rol verilerini çoklu-rol formatına dönüştür
export function migrateToMultiRole(admin: Partial<AdminDocument>): AdminRole[] {
 if (admin.roles && admin.roles.length > 0) {
 return admin.roles; // Zaten migre edilmiş
 }

 // Eski formatı yeni formata dönüştür
 if (!admin.adminType) return [];

 let mappedType: AdminRoleType = 'staff';
 if (['super'].includes(admin.adminType as any)) mappedType = 'super';
 else if (['isletme_admin', 'kasap', 'restoran', 'market', 'kermes', 'lokma_admin', 'kermes_admin', 'admin'].includes(admin.adminType as any)) mappedType = 'admin';

 const role: AdminRole = {
 type: mappedType,
 isPrimary: true,
 isActive: true,
 assignedAt: admin.createdAt || new Date(),
 assignedBy: admin.createdBy || 'migration',
 };

 if (admin.butcherId) {
 role.businessId = admin.butcherId;
 role.businessName = admin.butcherName;
 }
 if (admin.organizationId) {
 role.organizationId = admin.organizationId;
 role.organizationName = admin.organizationName;
 }

 return [role];
}

export const DEFAULT_ADMIN_ROLE: Partial<AdminRole> = {
 type: 'staff',
 isPrimary: false,
 isActive: true,
};
