// Master Kermes Menu Catalog
// Tipik kermes ürünleri - Türk mutfağı standartları

export interface KermesMenuItemData {
    sku: string;
    // Bilingual fields (TR required, DE optional)
    name: string;           // Primary name (TR) - backward compatible
    name_de?: string;       // German name
    description?: string;   // Primary description (TR)
    description_de?: string; // German description
    allergens?: string;     // Allergens (TR)
    allergens_de?: string;  // German allergens
    ingredients?: string;   // Ingredients (TR)
    ingredients_de?: string; // German ingredients
    category: string;
    defaultPrice: number;
    unit: 'adet' | 'porsiyon' | 'bardak' | 'kase';
    imageAsset?: string;
    tags?: string[];
}

export const KERMES_MENU_CATALOG: Record<string, KermesMenuItemData> = {
    // ═══════════════════════════════════════════════════════════════
    // ANA YEMEKLER
    // ═══════════════════════════════════════════════════════════════
    'KERMES-YEMEK-001': {
        sku: 'KERMES-YEMEK-001',
        name: 'Lahmacun',
        description: 'İnce hamurlu, kıymalı lahmacun',
        category: 'Ana Yemek',
        defaultPrice: 5.00,
        unit: 'adet',
        tags: ['popüler'],
    },
    'KERMES-YEMEK-002': {
        sku: 'KERMES-YEMEK-002',
        name: 'Döner Dürüm',
        description: 'Lavaş ekmeğinde dana döner',
        category: 'Ana Yemek',
        defaultPrice: 8.00,
        unit: 'adet',
        tags: ['popüler'],
    },
    'KERMES-YEMEK-003': {
        sku: 'KERMES-YEMEK-003',
        name: 'Döner Porsiyon',
        description: 'Porsiyonluk döner, pilav ile',
        category: 'Ana Yemek',
        defaultPrice: 12.00,
        unit: 'porsiyon',
        tags: ['popüler'],
    },
    'KERMES-YEMEK-004': {
        sku: 'KERMES-YEMEK-004',
        name: 'Adana Kebap',
        description: 'Acılı kıyma kebabı',
        category: 'Ana Yemek',
        defaultPrice: 10.00,
        unit: 'porsiyon',
    },
    'KERMES-YEMEK-005': {
        sku: 'KERMES-YEMEK-005',
        name: 'Urfa Kebap',
        description: 'Acısız kıyma kebabı',
        category: 'Ana Yemek',
        defaultPrice: 10.00,
        unit: 'porsiyon',
    },
    'KERMES-YEMEK-006': {
        sku: 'KERMES-YEMEK-006',
        name: 'Pide (Kıymalı)',
        description: 'Kıymalı Türk pidesi',
        category: 'Ana Yemek',
        defaultPrice: 9.00,
        unit: 'adet',
    },
    'KERMES-YEMEK-007': {
        sku: 'KERMES-YEMEK-007',
        name: 'Pide (Kaşarlı)',
        description: 'Kaşarlı Türk pidesi',
        category: 'Ana Yemek',
        defaultPrice: 8.00,
        unit: 'adet',
    },
    'KERMES-YEMEK-008': {
        sku: 'KERMES-YEMEK-008',
        name: 'Çiğ Köfte Dürüm',
        description: 'Acılı çiğ köfte dürüm',
        category: 'Ana Yemek',
        defaultPrice: 6.00,
        unit: 'adet',
        tags: ['vejetaryen'],
    },
    'KERMES-YEMEK-009': {
        sku: 'KERMES-YEMEK-009',
        name: 'Kuru Fasulye',
        description: 'Pilav ile servis',
        category: 'Ana Yemek',
        defaultPrice: 7.00,
        unit: 'porsiyon',
    },
    'KERMES-YEMEK-010': {
        sku: 'KERMES-YEMEK-010',
        name: 'Karnıyarık',
        description: 'Kıymalı patlıcan',
        category: 'Ana Yemek',
        defaultPrice: 8.00,
        unit: 'porsiyon',
    },
    'KERMES-YEMEK-011': {
        sku: 'KERMES-YEMEK-011',
        name: 'İmam Bayıldı',
        description: 'Zeytinyağlı patlıcan',
        category: 'Ana Yemek',
        defaultPrice: 7.00,
        unit: 'porsiyon',
        tags: ['vejetaryen'],
    },
    'KERMES-YEMEK-012': {
        sku: 'KERMES-YEMEK-012',
        name: 'Mantı',
        description: 'El yapımı Türk mantısı, yoğurt ile',
        category: 'Ana Yemek',
        defaultPrice: 9.00,
        unit: 'porsiyon',
    },
    'KERMES-YEMEK-013': {
        sku: 'KERMES-YEMEK-013',
        name: 'Gözleme',
        description: 'Peynirli veya patatesli',
        category: 'Ana Yemek',
        defaultPrice: 5.00,
        unit: 'adet',
        tags: ['vejetaryen'],
    },

    // ═══════════════════════════════════════════════════════════════
    // ÇORBALAR
    // ═══════════════════════════════════════════════════════════════
    'KERMES-CORBA-001': {
        sku: 'KERMES-CORBA-001',
        name: 'Mercimek Çorbası',
        description: 'Kırmızı mercimek çorbası',
        category: 'Çorba',
        defaultPrice: 4.00,
        unit: 'kase',
        tags: ['vejetaryen', 'popüler'],
    },
    'KERMES-CORBA-002': {
        sku: 'KERMES-CORBA-002',
        name: 'Ezogelin Çorbası',
        description: 'Mercimekli bulgurlu çorba',
        category: 'Çorba',
        defaultPrice: 4.00,
        unit: 'kase',
        tags: ['vejetaryen'],
    },
    'KERMES-CORBA-003': {
        sku: 'KERMES-CORBA-003',
        name: 'İşkembe Çorbası',
        description: 'Geleneksel işkembe',
        category: 'Çorba',
        defaultPrice: 5.00,
        unit: 'kase',
    },

    // ═══════════════════════════════════════════════════════════════
    // TATLILAR
    // ═══════════════════════════════════════════════════════════════
    'KERMES-TATLI-001': {
        sku: 'KERMES-TATLI-001',
        name: 'Baklava',
        description: 'Fıstıklı baklava (2 dilim)',
        category: 'Tatlı',
        defaultPrice: 5.00,
        unit: 'porsiyon',
        tags: ['popüler'],
    },
    'KERMES-TATLI-002': {
        sku: 'KERMES-TATLI-002',
        name: 'Künefe',
        description: 'Sıcak peynirli kadayıf tatlısı',
        category: 'Tatlı',
        defaultPrice: 7.00,
        unit: 'porsiyon',
        tags: ['popüler'],
    },
    'KERMES-TATLI-003': {
        sku: 'KERMES-TATLI-003',
        name: 'Sütlaç',
        description: 'Fırın sütlacı',
        category: 'Tatlı',
        defaultPrice: 4.00,
        unit: 'porsiyon',
    },
    'KERMES-TATLI-004': {
        sku: 'KERMES-TATLI-004',
        name: 'Kazandibi',
        description: 'Geleneksel süt tatlısı',
        category: 'Tatlı',
        defaultPrice: 4.00,
        unit: 'porsiyon',
    },
    'KERMES-TATLI-005': {
        sku: 'KERMES-TATLI-005',
        name: 'Revani',
        description: 'Şerbetli irmik tatlısı',
        category: 'Tatlı',
        defaultPrice: 3.00,
        unit: 'adet',
    },
    'KERMES-TATLI-006': {
        sku: 'KERMES-TATLI-006',
        name: 'Lokma',
        description: 'Şerbetli mini hamur tatlısı',
        category: 'Tatlı',
        defaultPrice: 4.00,
        unit: 'porsiyon',
        tags: ['popüler'],
    },
    'KERMES-TATLI-007': {
        sku: 'KERMES-TATLI-007',
        name: 'Tulumba',
        description: 'Şerbetli tatlı',
        category: 'Tatlı',
        defaultPrice: 3.00,
        unit: 'porsiyon',
    },
    'KERMES-TATLI-008': {
        sku: 'KERMES-TATLI-008',
        name: 'Aşure',
        description: 'Geleneksel Türk tatlısı',
        category: 'Tatlı',
        defaultPrice: 3.00,
        unit: 'kase',
    },

    // ═══════════════════════════════════════════════════════════════
    // İÇECEKLER
    // ═══════════════════════════════════════════════════════════════
    'KERMES-ICECEK-001': {
        sku: 'KERMES-ICECEK-001',
        name: 'Çay',
        description: 'Türk çayı',
        category: 'İçecek',
        defaultPrice: 2.00,
        unit: 'bardak',
        tags: ['popüler'],
    },
    'KERMES-ICECEK-002': {
        sku: 'KERMES-ICECEK-002',
        name: 'Türk Kahvesi',
        description: 'Orta şekerli',
        category: 'İçecek',
        defaultPrice: 3.00,
        unit: 'bardak',
        tags: ['popüler'],
    },
    'KERMES-ICECEK-003': {
        sku: 'KERMES-ICECEK-003',
        name: 'Ayran',
        description: 'Taze ev yapımı ayran',
        category: 'İçecek',
        defaultPrice: 2.50,
        unit: 'bardak',
        tags: ['popüler'],
    },
    'KERMES-ICECEK-004': {
        sku: 'KERMES-ICECEK-004',
        name: 'Şalgam',
        description: 'Acılı şalgam suyu',
        category: 'İçecek',
        defaultPrice: 2.50,
        unit: 'bardak',
    },
    'KERMES-ICECEK-005': {
        sku: 'KERMES-ICECEK-005',
        name: 'Limonata',
        description: 'Taze sıkılmış limonata',
        category: 'İçecek',
        defaultPrice: 3.00,
        unit: 'bardak',
    },
    'KERMES-ICECEK-006': {
        sku: 'KERMES-ICECEK-006',
        name: 'Su',
        description: 'Pet şişe su (0.5L)',
        category: 'İçecek',
        defaultPrice: 1.00,
        unit: 'adet',
    },
    'KERMES-ICECEK-007': {
        sku: 'KERMES-ICECEK-007',
        name: 'Kola',
        description: 'Kutu içecek',
        category: 'İçecek',
        defaultPrice: 2.00,
        unit: 'adet',
    },
};

// Get all categories
export const KERMES_MENU_CATEGORIES = [...new Set(
    Object.values(KERMES_MENU_CATALOG).map(item => item.category)
)];

// Get items by category
export const getKermesMenuByCategory = (category: string): KermesMenuItemData[] => {
    return Object.values(KERMES_MENU_CATALOG).filter(item => item.category === category);
};
