/**
 * MERKEZI İŞLETME TÜRLERİ KAYIT SİSTEMİ
 * 
 * TEK KAYNAK (Single Source of Truth)
 * - Tüm işletme türleri buradan yönetilir
 * - Dashboard modülleri, işletme formu, mobil app hepsi buradan çeker
 * 
 * NOT: Fastfood, Restoran içine dahil edildi (masa/sandalye ile ayırt edilir)
 */

export interface BusinessTypeConfig {
    value: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    hasModule: boolean;
    moduleRoute: string;
    features: string[];
    category: 'yemek' | 'market' | 'kermes' | 'hizmet';  // Sektör kategorisi - mobil app filtreleme için
}

// ═══════════════════════════════════════════════════════════════════
// İŞLETME TÜRLERİ - Modül olarak görünecekler
// ═══════════════════════════════════════════════════════════════════

export const BUSINESS_TYPES: Record<string, BusinessTypeConfig> = {
    kasap: {
        value: 'kasap',
        label: 'Kasap',
        icon: '🥩',
        color: 'red',
        description: 'Et & Et Ürünleri',
        hasModule: true,
        moduleRoute: '/admin/business?type=kasap',
        features: ['products', 'orders', 'delivery', 'brand_label'],
        category: 'market',  // Marketler sekmesinde gösterilir
    },
    market: {
        value: 'market',
        label: 'Market',
        icon: '🛒',
        color: 'green',
        description: 'Helal Market',
        hasModule: true,
        moduleRoute: '/admin/business?type=market',
        features: ['products', 'orders', 'delivery'],
        category: 'market',  // Marketler sekmesinde gösterilir
    },
    restoran: {
        value: 'restoran',
        label: 'Restoran',
        icon: '🍽️',
        color: 'orange',
        description: 'Yemek & Rezervasyon',
        hasModule: true,
        moduleRoute: '/admin/business?type=restoran',
        features: ['menu', 'orders', 'delivery', 'reservation', 'table_capacity'],
        category: 'yemek',  // Yemek sekmesinde gösterilir
    },
    // NOT: Fastfood artık Restoran içinde (masa/sandalye 0 ise fastfood)
    pastane: {
        value: 'pastane',
        label: 'Pastane & Tatlıcı',
        icon: '🎂',
        color: 'pink',
        description: 'Pasta & Tatlı',
        hasModule: true,
        moduleRoute: '/admin/business?type=pastane',
        features: ['products', 'orders', 'custom_orders'],
        category: 'yemek',  // Yemek sekmesinde gösterilir
    },
    cicekci: {
        value: 'cicekci',
        label: 'Çiçekçi',
        icon: '🌸',
        color: 'purple',
        description: 'Çiçek Mağazası',
        hasModule: true,
        moduleRoute: '/admin/business?type=cicekci',
        features: ['products', 'orders', 'delivery'],
        category: 'market',  // Marketler sekmesinde gösterilir
    },
    cigkofte: {
        value: 'cigkofte',
        label: 'Çiğ Köfteci',
        icon: '🥙',
        color: 'emerald',
        description: 'Çiğ Köfte',
        hasModule: true,
        moduleRoute: '/admin/business?type=cigkofte',
        features: ['products', 'orders', 'delivery'],
        category: 'yemek',  // Yemek sekmesinde gösterilir
    },
    cafe: {
        value: 'cafe',
        label: 'Kafe',
        icon: '☕',
        color: 'amber',
        description: 'Kahve & İçecek',
        hasModule: true,
        moduleRoute: '/admin/business?type=cafe',
        features: ['menu', 'orders', 'table_capacity'],
        category: 'yemek',  // Yemek sekmesinde gösterilir
    },
    catering: {
        value: 'catering',
        label: 'Catering',
        icon: '🎉',
        color: 'indigo',
        description: 'Toplu Yemek',
        hasModule: true,
        moduleRoute: '/admin/business?type=catering',
        features: ['menu', 'custom_orders'],
        category: 'yemek',  // Yemek sekmesinde gösterilir
    },
    firin: {
        value: 'firin',
        label: 'Fırın',
        icon: '🥖',
        color: 'amber',
        description: 'Ekmek, Börek & Hamur İşleri',
        hasModule: true,
        moduleRoute: '/admin/business?type=firin',
        features: ['products', 'orders', 'delivery'],
        category: 'yemek',  // Yemek sekmesinde gösterilir
    },
    kermes: {
        value: 'kermes',
        label: 'Kermes',
        icon: '🎪',
        color: 'violet',
        description: 'Etkinlik & Festival',
        hasModule: true,
        moduleRoute: '/admin/kermes',
        features: ['events', 'tickets', 'sponsors'],
        category: 'kermes',  // 4. ana kategori - Kermes
    },
    eticaret: {
        value: 'eticaret',
        label: 'E-Ticaret',
        icon: '🛍️',
        color: 'cyan',
        description: 'Online Mağaza',
        hasModule: true,
        moduleRoute: '/admin/shop',
        features: ['products', 'orders', 'shipping'],
        category: 'hizmet',  // Özel modül - ayrı sayfa
    },
} as const;

// ═══════════════════════════════════════════════════════════════════
// ÖZEL MODÜLLER - İşletme türü değil, ayrı sistemler
// ═══════════════════════════════════════════════════════════════════

export const SPECIAL_MODULES = {
    kermes: {
        label: 'Kermes',
        icon: '🎪',
        description: 'Etkinlik Yönetimi',
        route: '/admin/kermes',
    },
    eticaret: {
        label: 'E-Ticaret',
        icon: '🛍️',
        description: 'Online Shop',
        route: '/admin/shop',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════

/** Tüm işletme türlerini array olarak döndür */
export const getBusinessTypesList = (): BusinessTypeConfig[] => Object.values(BUSINESS_TYPES);

/** Belirli bir türün config'ini getir */
export const getBusinessType = (value: string): BusinessTypeConfig | undefined =>
    BUSINESS_TYPES[value as keyof typeof BUSINESS_TYPES];

/** Modül olarak görünecek işletme türlerini getir */
export const getModuleBusinessTypes = (): BusinessTypeConfig[] =>
    Object.values(BUSINESS_TYPES).filter(t => t.hasModule);

/** Tür değerine göre ikon getir */
export const getBusinessTypeIcon = (value: string): string =>
    BUSINESS_TYPES[value as keyof typeof BUSINESS_TYPES]?.icon || '🏪';

/** Tür değerine göre label getir */
export const getBusinessTypeLabel = (value: string): string =>
    BUSINESS_TYPES[value as keyof typeof BUSINESS_TYPES]?.label || value;

/** Tür değerine göre renk getir */
export const getBusinessTypeColor = (value: string): string =>
    BUSINESS_TYPES[value as keyof typeof BUSINESS_TYPES]?.color || 'gray';

// ═══════════════════════════════════════════════════════════════════
// DİNAMİK ROL SİSTEMİ (RBAC)
// ═══════════════════════════════════════════════════════════════════

export interface RoleConfig {
    value: string;
    label: string;
    icon: string;
    isAdmin: boolean;
    businessType?: string;
}

/** Belirli bir işletme türü için roller oluştur (Admin + Personel) */
export const generateRolesForBusinessType = (businessType: string): RoleConfig[] => {
    const config = getBusinessType(businessType);
    if (!config) return [];

    return [
        {
            value: businessType,
            label: `${config.label} Admin`,
            icon: `👑`,
            isAdmin: true,
            businessType,
        },
        {
            value: `${businessType}_staff`,
            label: `${config.label} Personeli`,
            icon: `👤`,
            isAdmin: false,
            businessType,
        },
    ];
};

/** Tüm rolleri al (Super Admin dahil + Kullanıcı seçeneği) */
export const getAllRoles = (): RoleConfig[] => {
    const roles: RoleConfig[] = [
        // Normal kullanıcı - admin rolünü kaldırmak için
        { value: 'user', label: 'Kullanıcı (Admin Değil)', icon: '👤', isAdmin: false },
        { value: 'super', label: 'Super Admin', icon: '🌟', isAdmin: true },
    ];

    Object.keys(BUSINESS_TYPES).forEach(type => {
        roles.push(...generateRolesForBusinessType(type));
    });

    return roles;
};

/** Belirli işletme türleri için rolleri al (dropdown filtreleme için) */
export const getRolesForBusinessTypes = (businessTypes: string[]): RoleConfig[] => {
    const roles: RoleConfig[] = [];

    businessTypes.forEach(type => {
        roles.push(...generateRolesForBusinessType(type));
    });

    return roles;
};

/** Rol değerinden config getir */
export const getRoleConfig = (roleValue: string): RoleConfig | undefined => {
    return getAllRoles().find(r => r.value === roleValue);
};

/** Rol değerinden label getir */
export const getRoleLabel = (roleValue: string): string => {
    return getRoleConfig(roleValue)?.label || roleValue;
};

/** Rol değerinden ikon getir */
export const getRoleIcon = (roleValue: string): string => {
    return getRoleConfig(roleValue)?.icon || '👤';
};

/** Rol admin mi kontrol et */
export const isAdminRole = (roleValue: string): boolean => {
    // Super admin veya sektör admin'i
    if (roleValue === 'super') return true;
    if (roleValue.endsWith('_staff')) return false;
    // Sektör admin'i (kasap, market, restoran vb.)
    return Object.keys(BUSINESS_TYPES).includes(roleValue);
};
