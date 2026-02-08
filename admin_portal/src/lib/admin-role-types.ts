/**
 * Admin Role Types - Çoklu Rol Yapısı
 * 
 * Bir kullanıcı birden fazla role sahip olabilir:
 * - Bir döner dükkanı personeli + aynı yerin kermes admini
 * - İki farklı işletmenin admini
 * - Kasap personeli + market personeli
 * 
 * Bu dosya çoklu rol yapısını tanımlar.
 */

// Rol türleri
// 🆕 Konsolide roller: isletme_admin / isletme_staff tüm işletme türlerini kapsar
// Eski roller (kasap, restoran, market vb.) geriye uyumluluk için korunur
export type AdminRoleType =
    | 'super'           // Süper Admin - Tüm sistem
    | 'isletme_admin'   // 🆕 İşletme Admin (Genel - tüm iş türleri)
    | 'isletme_staff'   // 🆕 İşletme Personel (Genel - tüm iş türleri)
    | 'kermes'          // Kermes Admin - Organizasyon bazlı
    | 'kermes_staff'    // Kermes Personeli
    // --- Eski roller (geriye uyumluluk) ---
    | 'kasap'           // → isletme_admin
    | 'kasap_staff'     // → isletme_staff
    | 'restoran'        // → isletme_admin
    | 'restoran_staff'  // → isletme_staff
    | 'market'          // → isletme_admin
    | 'market_staff'    // → isletme_staff
    | 'cenaze'          // Cenaze Fonu Admin
    | 'cenaze_staff';   // Cenaze Fonu Personeli

// Tek bir rol tanımı
export interface AdminRole {
    type: AdminRoleType;           // Rol türü

    // İşletme bazlı roller için (kasap, restoran, market)
    businessId?: string;           // businesses/{id}
    businessName?: string;         // İşletme adı

    // Organizasyon bazlı roller için (kermes, cenaze)
    organizationId?: string;       // organizations/{id}
    organizationName?: string;     // Organizasyon adı

    // Rol meta bilgileri
    isPrimary: boolean;            // Ana rol mü?
    isActive: boolean;             // Aktif mi?
    assignedAt: Date | any;        // Atama tarihi
    assignedBy: string;            // Atayan admin ID/email

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

    // 🆕 ÇOKLU ROL DİZİSİ
    roles: AdminRole[];

    // Geriye uyumluluk için mevcut alanlar (migration sonrası kaldırılabilir)
    adminType?: AdminRoleType;     // Ana rol
    butcherId?: string;            // Eski işletme ID
    butcherName?: string;          // Eski işletme adı
    organizationId?: string;       // Eski organizasyon ID
    organizationName?: string;     // Eski organizasyon adı

    // Meta bilgiler
    isActive: boolean;
    isPrimaryAdmin?: boolean;      // İşletme sahibi
    createdAt: Date | any;
    updatedAt: Date | any;
    createdBy?: string;
    updatedBy?: string;
}

// Yardımcı: Rol için işletme/organizasyon gerekiyor mu?
export function roleRequiresBusiness(type: AdminRoleType): boolean {
    return ['isletme_admin', 'isletme_staff', 'kasap', 'kasap_staff', 'restoran', 'restoran_staff', 'market', 'market_staff'].includes(type);
}

export function roleRequiresOrganization(type: AdminRoleType): boolean {
    return ['kermes', 'kermes_staff', 'cenaze', 'cenaze_staff'].includes(type);
}

// Yardımcı: Rol etiketi al
export function getAdminRoleLabel(type: AdminRoleType): string {
    const labels: Record<AdminRoleType, string> = {
        'super': '👑 Süper Admin',
        'isletme_admin': '🏪 İşletme Admin',
        'isletme_staff': '🏪 İşletme Personel',
        'kermes': '🎪 Kermes Admin',
        'kermes_staff': '🎪 Kermes Personel',
        // Eski roller → genel etikete map'lenir
        'kasap': '🏪 İşletme Admin',
        'kasap_staff': '🏪 İşletme Personel',
        'restoran': '🏪 İşletme Admin',
        'restoran_staff': '🏪 İşletme Personel',
        'market': '🏪 İşletme Admin',
        'market_staff': '🏪 İşletme Personel',
        'cenaze': '🕯️ Cenaze Fonu Admin',
        'cenaze_staff': '🕯️ Cenaze Fonu Personeli',
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

    const role: AdminRole = {
        type: admin.adminType,
        isPrimary: true,
        isActive: true,
        assignedAt: admin.createdAt || new Date(),
        assignedBy: admin.createdBy || 'migration',
    };

    // İşletme bazlı rol
    if (roleRequiresBusiness(admin.adminType) && admin.butcherId) {
        role.businessId = admin.butcherId;
        role.businessName = admin.butcherName;
    }

    // Organizasyon bazlı rol
    if (roleRequiresOrganization(admin.adminType) && admin.organizationId) {
        role.organizationId = admin.organizationId;
        role.organizationName = admin.organizationName;
    }

    return [role];
}

// Varsayılan boş rol
export const DEFAULT_ADMIN_ROLE: Partial<AdminRole> = {
    type: 'isletme_staff',
    isPrimary: false,
    isActive: true,
};
