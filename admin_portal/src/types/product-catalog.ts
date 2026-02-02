// =============================================================================
// MIRA MASTER PRODUCT CATALOG - TypeScript Types
// Synchronized with Flutter: lib/data/product_catalog_types.dart
// =============================================================================

// Product Domain - Top level classification
export type ProductDomain =
    | 'kasap'      // Meat
    | 'manav'      // Produce  
    | 'market'     // Market
    | 'firin'      // Bakery
    | 'sut'        // Dairy
    | 'parfum'     // Perfume
    | 'giyim'      // Clothing
    | 'temizlik'   // Cleaning
    | 'elektronik' // Electronics
    | 'ev';        // Homeware

export const PRODUCT_DOMAINS: Record<ProductDomain, { displayName: string; description: string }> = {
    kasap: { displayName: 'Kasap', description: 'Et Ürünleri' },
    manav: { displayName: 'Manav', description: 'Sebze & Meyve' },
    market: { displayName: 'Market', description: 'Market Ürünleri' },
    firin: { displayName: 'Fırın', description: 'Ekmek & Pasta' },
    sut: { displayName: 'Süt Ürünleri', description: 'Süt & Peynir' },
    parfum: { displayName: 'Parfüm', description: 'Kozmetik & Parfüm' },
    giyim: { displayName: 'Giyim', description: 'Kıyafet & Aksesuar' },
    temizlik: { displayName: 'Temizlik', description: 'Temizlik Ürünleri' },
    elektronik: { displayName: 'Elektronik', description: 'Elektronik Ürünler' },
    ev: { displayName: 'Ev & Yaşam', description: 'Ev Eşyaları' },
};

// Unit Type
export type UnitType = 'kg' | 'g' | 'L' | 'ml' | 'adet' | 'paket' | 'kutu' | 'şişe' | 'm' | 'cm';

export const UNIT_TYPES: Record<UnitType, { displayName: string; baseUnits: number }> = {
    kg: { displayName: 'Kilogram', baseUnits: 1000 },
    g: { displayName: 'Gram', baseUnits: 1 },
    L: { displayName: 'Litre', baseUnits: 1000 },
    ml: { displayName: 'Mililitre', baseUnits: 1 },
    adet: { displayName: 'Adet', baseUnits: 1 },
    paket: { displayName: 'Paket', baseUnits: 1 },
    kutu: { displayName: 'Kutu', baseUnits: 1 },
    'şişe': { displayName: 'Şişe', baseUnits: 1 },
    m: { displayName: 'Metre', baseUnits: 100 },
    cm: { displayName: 'Santimetre', baseUnits: 1 },
};

// Product Category
export interface ProductCategory {
    code: string;
    name: string;
    icon: string;
    domain: ProductDomain;
}

// Image Metadata
export interface ImageMetadata {
    version: string;
    generatedDate: string;
    tags: string[];
    style: string;
    surface: string;
    isHygienic: boolean;
}

// Master Product - Platform controlled, vendors can NOT modify
export interface MasterProduct {
    sku: string;           // MIRA-MEAT-DANA-001
    name: string;
    description: string;
    domain: ProductDomain;
    category: ProductCategory;
    imagePath: string;
    imageMetadata: ImageMetadata;
    unitType: UnitType;
    defaultMinQuantity: number;
    defaultStepQuantity: number;
    tags: string[];
    isHalal: boolean;
    barcode?: string;      // EAN-13
    gtin?: string;         // Global Trade Item Number
    shelfLifeDays?: number;
}

// Vendor Product Listing - What vendors CAN customize
export interface VendorProductListing {
    vendorId: string;
    masterProductSku: string;
    price: number;
    minQuantity: number;
    stepQuantity: number;
    isAvailable: boolean;
    isDiscounted: boolean;
    discountedPrice?: number;
    stockQuantity: number;

    // Food safety (Gıda güvenliği)
    productionDate?: Date;    // Üretim tarihi
    expirationDate?: Date;    // SKT
    batchNumber?: string;     // Parti no
    lotNumber?: string;       // Lot no
}

// Vendor Permissions - Admin controls which domains vendor can access
export interface VendorPermissions {
    vendorId: string;
    allowedDomains: ProductDomain[];
    allowedCategoryCodes: string[];
    canCreateCustomProducts: boolean;
    isActive: boolean;
    updatedAt?: Date;
    updatedByAdminId?: string;
}

// =============================================================================
// GRUNDPREIS (EU/German PAngV Compliance)
// =============================================================================

export function formatDualPrice(pricePerKg: number, currency = '€'): string {
    const per100g = pricePerKg / 10;
    return `${currency}${pricePerKg.toFixed(2)}/kg (${currency}${per100g.toFixed(2)}/100g)`;
}

export function formatDualVolume(pricePerLiter: number, currency = '€'): string {
    const per100ml = pricePerLiter / 10;
    return `${currency}${pricePerLiter.toFixed(2)}/L (${currency}${per100ml.toFixed(2)}/100ml)`;
}

// =============================================================================
// MEAT CATEGORIES
// =============================================================================

export const MEAT_CATEGORIES: ProductCategory[] = [
    { code: 'dana', name: 'Dana Eti', icon: 'lunch_dining', domain: 'kasap' },
    { code: 'kuzu', name: 'Kuzu Eti', icon: 'kebab_dining', domain: 'kasap' },
    { code: 'tavuk', name: 'Tavuk', icon: 'egg_alt', domain: 'kasap' },
    { code: 'islenmiş', name: 'İşlenmiş Ürünler', icon: 'kitchen', domain: 'kasap' },
    { code: 'ozel', name: 'Özel Paketler', icon: 'star', domain: 'kasap' },
];
