export interface MasterProduct {
    id: string; // SKU Matching Mobile App
    name: string;
    category: 'dana' | 'kuzu' | 'tavuk' | 'hazir' | 'diger' | string;
    defaultUnit: 'kg' | 'ad' | string;
    description: string;
    allowedBusinessTypes?: string[];  // 🆕 Hangi işletme türleri satabilir
}

export const MASTER_PRODUCTS: MasterProduct[] = [
    // Dana Eti
    {
        id: 'MIRA-MEAT-DANA-001',
        name: 'Dana Antrikot',
        category: 'dana',
        defaultUnit: 'kg',
        description: 'Özel besi dana etinin en lezzetli kısmı.'
    },
    {
        id: 'MIRA-MEAT-DANA-002',
        name: 'Dana Bonfile',
        category: 'dana',
        defaultUnit: 'kg',
        description: 'En yumuşak et, özel günler için.'
    },
    {
        id: 'MIRA-MEAT-DANA-003',
        name: 'Dana Kıyma',
        category: 'dana',
        defaultUnit: 'kg',
        description: 'Az yağlı, günlük taze çekim.'
    },
    {
        id: 'MIRA-MEAT-DANA-004',
        name: 'Dana Kuşbaşı',
        category: 'dana',
        defaultUnit: 'kg',
        description: 'Sinirsiz dana but, güveç için.'
    },
    {
        id: 'MIRA-MEAT-DANA-005',
        name: 'Dana Kaburga',
        category: 'dana',
        defaultUnit: 'kg',
        description: 'Fırın ve haşlama için ideal.'
    },

    // Kuzu Eti
    {
        id: 'MIRA-MEAT-KUZU-001',
        name: 'Kuzu Pirzola',
        category: 'kuzu',
        defaultUnit: 'kg',
        description: 'Premium kuzu pirzola, ızgara için.'
    },
    {
        id: 'MIRA-MEAT-KUZU-002',
        name: 'Kuzu But',
        category: 'kuzu',
        defaultUnit: 'kg',
        description: 'Bütün kuzu but, fırın için.'
    },
    {
        id: 'MIRA-MEAT-KUZU-003',
        name: 'Kuzu Kıyma',
        category: 'kuzu',
        defaultUnit: 'kg',
        description: 'Taze çekilmiş kuzu kıyma.'
    },

    // Tavuk
    {
        id: 'MIRA-MEAT-TAVUK-001',
        name: 'Tavuk Göğsü',
        category: 'tavuk',
        defaultUnit: 'kg',
        description: 'Derisiz tavuk göğsü fileto.'
    },
    {
        id: 'MIRA-MEAT-TAVUK-002',
        name: 'Bütün Tavuk',
        category: 'tavuk',
        defaultUnit: 'ad',
        description: 'Temizlenmiş bütün tavuk.'
    },

    // İşlenmiş (Hazır)
    {
        id: 'MIRA-MEAT-ISLEM-001',
        name: 'Evlik Sucuk',
        category: 'hazir',
        defaultUnit: 'kg',
        description: 'Geleneksel fermente dana sucuk.'
    },
    {
        id: 'MIRA-MEAT-ISLEM-002',
        name: 'Pastırma',
        category: 'hazir',
        defaultUnit: 'kg',
        description: 'El yapımı Kayseri pastırması.'
    },
    {
        id: 'MIRA-MEAT-ISLEM-003',
        name: 'Kasap Köfte',
        category: 'hazir',
        defaultUnit: 'kg',
        description: 'Özel baharat karışımlı.'
    },

    // Özel / Diğer
    {
        id: 'MIRA-MEAT-OZEL-001',
        name: 'Kurban Paketi',
        category: 'diger',
        defaultUnit: 'ad',
        description: 'Özel kurban kesim paketi.'
    },
    {
        id: 'MIRA-MEAT-OZEL-002',
        name: 'Mangal Paketi',
        category: 'diger',
        defaultUnit: 'ad',
        description: 'Pirzola, köfte içeren mangal seti.'
    },
];
