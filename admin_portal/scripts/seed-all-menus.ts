/**
 * LOKMA Bulk Menu & Product Seeding Script
 *
 * Tum Yemek ve Market isletmelerine toplu olarak menu kategorileri ve urunler ekler.
 * - Yemek (restoran, cafe, firin, pastane, cigkofte): MENU_TEMPLATES sablonlari
 * - Market: Turk marketi kategorileri + TUNA master katalog urunleri (resimli)
 *
 * ONEMLI: "Tuna Kebaphaus & Pizzeria" KESINLIKLE ATLANIR (sahibinin test isletmesi).
 *
 * Kullanim:
 *   npx tsx scripts/seed-all-menus.ts              # Gercek calistir
 *   npx tsx scripts/seed-all-menus.ts --dry-run     # Simule et (Firestore'a yazmaz)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin SDK init
const serviceAccount = require('../serviceAccount.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

// ================================================================
// DOKUNMA LISTESI -- Bu isletmelere KESINLIKLE ekleme yapilmaz
// ================================================================
const EXCLUDED_NAMES = [
    'tuna kebaphaus',
    'tuna kebaphaus & pizzeria',
    'tuna kebaphaus und pizzeria',
];

function isExcluded(name: string): boolean {
    const n = name.toLowerCase().trim();
    return EXCLUDED_NAMES.some(ex => n.includes(ex));
}

// ================================================================
// YEMEK ISLETMELERI ICIN MENU SABLONLARI
// ================================================================
const YEMEK_TYPES = ['restoran', 'cafe', 'firin', 'pastane', 'cigkofte'];

interface MenuProduct {
    name: string;
    price: number;
    description?: string;
    unit?: string;
    imageUrl?: string;
}

interface MenuCategory {
    name: string;
    icon: string;
    products: MenuProduct[];
}

// AI-destekli restoran alt tur algilama
function detectSubType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('baklava') || n.includes('kunefe') || n.includes('künefe') || n.includes('tatli') || n.includes('tatlı')) return 'baklava';
    if (n.includes('pizza') || n.includes('pizzeria') || n.includes('ristorante') || n.includes('trattoria')) return 'pizza';
    if (n.includes('döner') || n.includes('kebab') || n.includes('kebap') || n.includes('grill')) return 'doner';
    if (n.includes('asia') || n.includes('china') || n.includes('sushi') || n.includes('thai') || n.includes('vietnam') || n.includes('wok')) return 'asya';
    if (n.includes('burger') || n.includes('american') || n.includes('steakhaus')) return 'burger';
    if (n.includes('griech') || n.includes('gyros') || n.includes('taverna')) return 'griechisch';
    if (n.includes('imbiss') || n.includes('snack')) return 'imbiss';
    return 'general';
}

// Restoran tur bazli ek/ozel kategoriler
const RESTORAN_SUBTYPES: Record<string, MenuCategory[]> = {
    baklava: [
        {
            name: 'Baklava', icon: '🍯',
            products: [
                { name: 'Baklava mit Pistazien (500g)', price: 18.90, description: 'Knuspriges Blätterteig mit Pistazienfüllung und Zuckersirup' },
                { name: 'Baklava mit Walnuss (500g)', price: 16.90, description: 'Klassisch mit Walnuss und Sirup' },
                { name: 'Baklava Gemischt (1kg)', price: 32.00, description: 'Pistazie, Walnuss und Haselnuss gemischt' },
                { name: 'Sobiyet (500g)', price: 19.90, description: 'Sahne-Baklava mit Pistazien' },
                { name: 'Burma Kadayif (500g)', price: 17.90, description: 'Gerolltes Engelshaar-Gebäck mit Pistazien' },
                { name: 'Havuc Dilim (500g)', price: 16.90, description: 'Karottenförmige Baklava' },
            ]
        },
        {
            name: 'Warme Desserts', icon: '🔥',
            products: [
                { name: 'Künefe', price: 8.90, description: 'Warmes Fadennudelgebäck mit Käsefüllung, Sirup und Pistazien' },
                { name: 'Katmer', price: 7.90, description: 'Knuspriger Teig mit Pistazien und Kaymak' },
                { name: 'Sutlu Nuriye', price: 6.90, description: 'Milch-Baklava, leichter und cremig' },
            ]
        },
        {
            name: 'Kalte Desserts', icon: '🍮',
            products: [
                { name: 'Sütlaç', price: 4.90, description: 'Türkischer Milchreis, kalt serviert' },
                { name: 'Kazandibi', price: 5.50, description: 'Karamellisierter Milchpudding' },
                { name: 'Kemalpaşa', price: 5.90, description: 'Süße Teigbällchen in Sirup' },
                { name: 'Tavuk Göğsü', price: 5.50, description: 'Milchpudding (traditionelle Art)' },
                { name: 'Aşure', price: 4.50, description: 'Noahs Pudding mit Trockenfrüchten' },
            ]
        },
        {
            name: 'Getränke', icon: '🍵',
            products: [
                { name: 'Türkischer Tee', price: 2.00 },
                { name: 'Türkischer Mokka', price: 3.00 },
                { name: 'Sahlep', price: 3.50, description: 'Warmes Milchgetränk mit Zimt' },
                { name: 'Ayran', price: 2.50 },
            ]
        },
    ],
    pizza: [
        {
            name: 'Pizza Klassiker', icon: '🍕',
            products: [
                { name: 'Pizza Margherita', price: 8.50, description: 'Tomaten, Mozzarella, Basilikum' },
                { name: 'Pizza Salami', price: 9.90, description: 'Tomaten, Mozzarella, Rindersalami' },
                { name: 'Pizza Funghi', price: 9.50, description: 'Tomaten, Mozzarella, frische Champignons' },
                { name: 'Pizza Hawaii', price: 10.50, description: 'Tomaten, Mozzarella, Schinken, Ananas' },
                { name: 'Pizza Quattro Stagioni', price: 11.50, description: 'Vier Jahreszeiten mit verschiedenem Belag' },
                { name: 'Pizza Diavola', price: 10.90, description: 'Scharfe Salami, Peperoni, Mozzarella' },
            ]
        },
        {
            name: 'Pizza Spezial', icon: '⭐',
            products: [
                { name: 'Pizza Sucuk', price: 10.90, description: 'Türkische Knoblauchwurst, Paprika, Zwiebeln' },
                { name: 'Pizza Döner', price: 12.90, description: 'Dönerfleisch, Zwiebeln, Tomaten, Soße' },
                { name: 'Pizza BBQ Chicken', price: 11.90, description: 'Hähnchen, BBQ-Soße, Mais, Röstzwiebeln' },
                { name: 'Calzone', price: 11.50, description: 'Gefaltete Pizza mit Schinken und Käse' },
                { name: 'Pizza Tonno', price: 10.90, description: 'Thunfisch, Zwiebeln, Oliven' },
            ]
        },
        {
            name: 'Pasta', icon: '🍝',
            products: [
                { name: 'Spaghetti Bolognese', price: 10.90, description: 'Hausgemachte Fleischsoße' },
                { name: 'Penne Arrabiata', price: 9.90, description: 'Scharfe Tomatensoße' },
                { name: 'Lasagne', price: 11.90, description: 'Klassisch mit Fleisch und Béchamel' },
                { name: 'Tortellini alla Panna', price: 11.50, description: 'Gefüllte Nudeln in Sahnesoße' },
            ]
        },
        {
            name: 'Salate', icon: '🥗',
            products: [
                { name: 'Gemischter Salat', price: 6.90 },
                { name: 'Insalata Caprese', price: 8.50, description: 'Tomaten, Mozzarella, Basilikum' },
                { name: 'Caesar Salat', price: 9.90, description: 'Mit Hähnchen und Parmesan' },
            ]
        },
        {
            name: 'Getränke', icon: '🥤',
            products: [
                { name: 'Coca-Cola 0,33l', price: 2.50 },
                { name: 'Fanta 0,33l', price: 2.50 },
                { name: 'Wasser 0,5l', price: 2.00 },
                { name: 'Ayran', price: 2.50 },
            ]
        },
    ],
    doner: [
        {
            name: 'Döner & Kebab', icon: '🥙',
            products: [
                { name: 'Döner im Brot', price: 6.50, description: 'Dönerfleisch im Fladenbrot mit Salat und Soße' },
                { name: 'Döner Dürüm', price: 7.50, description: 'Döner im Yufka-Wrap' },
                { name: 'Döner Teller', price: 12.90, description: 'Mit Reis, Salat und Soße' },
                { name: 'Dönertasche', price: 6.90, description: 'Döner in der Tasche mit allen Zutaten' },
                { name: 'Iskender Kebab', price: 15.90, description: 'Döner auf Fladenbrot mit Tomatensoße und Joghurt' },
                { name: 'Adana Kebab', price: 14.50, description: 'Scharf gewürztes Hackfleisch vom Grill' },
            ]
        },
        {
            name: 'Türkische Spezialitäten', icon: '🍖',
            products: [
                { name: 'Lahmacun', price: 5.50, description: 'Türkische Pizza mit Hackfleisch' },
                { name: 'Pide mit Käse', price: 8.90, description: 'Türkisches Fladenbrot mit Käsefüllung' },
                { name: 'Pide mit Hackfleisch', price: 9.90, description: 'Pide mit gewürztem Hackfleisch' },
                { name: 'Köfte Teller', price: 12.90, description: 'Gegrillte Frikadellen mit Reis und Salat' },
                { name: 'Mixed Grill', price: 18.90, description: 'Verschiedene Grillspezialitäten' },
            ]
        },
        {
            name: 'Vorspeisen', icon: '🥗',
            products: [
                { name: 'Linsensuppe', price: 4.50 },
                { name: 'Sigara Börek', price: 5.90, description: '6 Stück mit Schafskäse' },
                { name: 'Hummus', price: 5.50 },
                { name: 'Cacik', price: 4.00, description: 'Joghurt mit Gurken und Knoblauch' },
            ]
        },
        {
            name: 'Getränke', icon: '🥤',
            products: [
                { name: 'Ayran', price: 2.50 },
                { name: 'Coca-Cola 0,33l', price: 2.50 },
                { name: 'Türkischer Tee', price: 2.00 },
                { name: 'Wasser 0,5l', price: 2.00 },
            ]
        },
    ],
    asya: [
        {
            name: 'Vorspeisen', icon: '🥟',
            products: [
                { name: 'Frühlingsrollen (4 Stk.)', price: 5.90, description: 'Knusprig frittiert mit Gemüsefüllung' },
                { name: 'Wan-Tan-Suppe', price: 5.50, description: 'Klare Brühe mit gefüllten Teigtaschen' },
                { name: 'Edamame', price: 4.50, description: 'Gesalzene Sojabohnen' },
                { name: 'Gyoza (6 Stk.)', price: 7.50, description: 'Japanische Teigtaschen, gedämpft oder gebraten' },
            ]
        },
        {
            name: 'Hauptgerichte', icon: '🍜',
            products: [
                { name: 'Gebratene Nudeln mit Hähnchen', price: 10.90, description: 'Wok-Nudeln mit Gemüse und Hähnchen' },
                { name: 'Gebratener Reis mit Garnelen', price: 12.90, description: 'Wok-Reis mit Garnelen und Gemüse' },
                { name: 'Kung Pao Chicken', price: 12.50, description: 'Hähnchen mit Erdnüssen in süß-scharfer Soße' },
                { name: 'Pad Thai', price: 11.90, description: 'Thailändische Reisnudeln mit Erdnüssen' },
                { name: 'Ente süß-sauer', price: 13.90, description: 'Knusprige Ente in süß-saurer Soße' },
                { name: 'Rotes Curry mit Hähnchen', price: 12.50, description: 'Thailändisches Curry mit Kokosmilch' },
            ]
        },
        {
            name: 'Sushi', icon: '🍣',
            products: [
                { name: 'Lachs Nigiri (2 Stk.)', price: 5.50 },
                { name: 'California Roll (8 Stk.)', price: 9.90, description: 'Surimi, Avocado, Gurke' },
                { name: 'Sushi Mix Box (16 Stk.)', price: 18.90, description: 'Gemischte Auswahl' },
                { name: 'Maki Box (12 Stk.)', price: 8.90, description: 'Lachs, Thunfisch, Avocado' },
            ]
        },
        {
            name: 'Getränke', icon: '🥤',
            products: [
                { name: 'Grüner Tee', price: 2.50 },
                { name: 'Thai Eistee', price: 3.50 },
                { name: 'Coca-Cola 0,33l', price: 2.50 },
                { name: 'Wasser 0,5l', price: 2.00 },
            ]
        },
    ],
    burger: [
        {
            name: 'Burger', icon: '🍔',
            products: [
                { name: 'Classic Burger', price: 8.90, description: 'Rindfleisch-Patty, Salat, Tomate, Zwiebel' },
                { name: 'Cheese Burger', price: 9.50, description: 'Mit Cheddar' },
                { name: 'BBQ Bacon Burger', price: 11.90, description: 'Bacon, Cheddar, BBQ-Soße, Röstzwiebeln' },
                { name: 'Chicken Burger', price: 9.90, description: 'Knuspriges Hähnchenfilet' },
                { name: 'Veggie Burger', price: 9.50, description: 'Pflanzlicher Patty mit Avocado' },
                { name: 'Double Smash Burger', price: 12.90, description: 'Zwei dünne Smash-Pattys mit Käse' },
            ]
        },
        {
            name: 'Beilagen', icon: '🍟',
            products: [
                { name: 'Pommes Frites', price: 3.90 },
                { name: 'Sweet Potato Fries', price: 4.90 },
                { name: 'Onion Rings', price: 4.50 },
                { name: 'Chicken Wings (6 Stk.)', price: 7.90 },
                { name: 'Chicken Nuggets (9 Stk.)', price: 6.90 },
            ]
        },
        {
            name: 'Getränke', icon: '🥤',
            products: [
                { name: 'Coca-Cola 0,33l', price: 2.50 },
                { name: 'Fanta 0,33l', price: 2.50 },
                { name: 'Milchshake Vanille', price: 4.50 },
                { name: 'Milchshake Schokolade', price: 4.50 },
            ]
        },
    ],
    griechisch: [
        {
            name: 'Vorspeisen', icon: '🫒',
            products: [
                { name: 'Tzatziki', price: 4.50, description: 'Joghurt mit Gurke, Knoblauch und Olivenöl' },
                { name: 'Griechischer Salat', price: 8.90, description: 'Mit Feta, Oliven und Peperoni' },
                { name: 'Feta überbacken', price: 6.90, description: 'Mit Tomaten und Paprika' },
                { name: 'Dolmadakia', price: 5.90, description: 'Gefüllte Weinblätter' },
            ]
        },
        {
            name: 'Vom Grill', icon: '🥩',
            products: [
                { name: 'Gyros Teller', price: 12.90, description: 'Mit Reis, Salat und Tzatziki' },
                { name: 'Gyros Pita', price: 7.50, description: 'Im Fladenbrot mit Salat und Soße' },
                { name: 'Souvlaki (3 Spieße)', price: 13.90, description: 'Schweinefiletspieße mit Beilagen' },
                { name: 'Bifteki', price: 14.50, description: 'Griechische Frikadelle mit Schafskäse gefüllt' },
                { name: 'Lammkoteletts', price: 17.90, description: 'Vom Grill mit Kräutern' },
            ]
        },
        {
            name: 'Getränke', icon: '🥤',
            products: [
                { name: 'Griechischer Wein (0,25l)', price: 5.50 },
                { name: 'Ouzo', price: 3.50 },
                { name: 'Coca-Cola 0,33l', price: 2.50 },
                { name: 'Wasser 0,5l', price: 2.00 },
            ]
        },
    ],
    imbiss: [
        {
            name: 'Snacks', icon: '🌯',
            products: [
                { name: 'Döner im Brot', price: 6.00 },
                { name: 'Döner Dürüm', price: 7.00 },
                { name: 'Lahmacun', price: 5.00 },
                { name: 'Pommes', price: 3.00 },
                { name: 'Currywurst mit Pommes', price: 6.50 },
                { name: 'Frikadelle im Brötchen', price: 4.50 },
            ]
        },
        {
            name: 'Getränke', icon: '🥤',
            products: [
                { name: 'Ayran', price: 2.00 },
                { name: 'Coca-Cola 0,33l', price: 2.00 },
                { name: 'Wasser 0,5l', price: 1.50 },
            ]
        },
    ],
};

// Standart restoran menusu (general & fallback)
const GENERAL_RESTORAN: MenuCategory[] = [
    {
        name: 'Vorspeisen', icon: '🥗',
        products: [
            { name: 'Gemischter Salat', price: 5.90, description: 'Frischer Blattsalat mit Tomaten, Gurken' },
            { name: 'Linsensuppe', price: 4.50, description: 'Traditionelle rote Linsensuppe' },
            { name: 'Hummus', price: 5.50, description: 'Kichererbsenpüree mit Olivenöl' },
            { name: 'Sigara Börek (4 Stk.)', price: 6.50, description: 'Knusprige Teigröllchen mit Schafskäse' },
        ]
    },
    {
        name: 'Hauptgerichte', icon: '🍖',
        products: [
            { name: 'Döner Teller', price: 12.90, description: 'Mit Reis, Salat und Soße' },
            { name: 'Adana Kebab', price: 14.50, description: 'Scharf gewürztes Hackfleisch vom Grill' },
            { name: 'Hähnchen Schnitzel', price: 11.90, description: 'Mit Pommes und Salat' },
            { name: 'Falafel Teller', price: 10.90, description: 'Mit Hummus und Fladenbrot' },
            { name: 'Iskender Kebab', price: 15.90, description: 'Döner auf Fladenbrot mit Tomatensoße' },
        ]
    },
    {
        name: 'Desserts', icon: '🍮',
        products: [
            { name: 'Baklava (4 Stk.)', price: 5.50 },
            { name: 'Sütlaç', price: 4.50, description: 'Türkischer Milchreis' },
            { name: 'Tiramisu', price: 5.90 },
        ]
    },
    {
        name: 'Getränke', icon: '🥤',
        products: [
            { name: 'Ayran', price: 2.50 },
            { name: 'Coca-Cola 0,33l', price: 2.50 },
            { name: 'Türkischer Tee', price: 2.00 },
            { name: 'Wasser 0,5l', price: 2.00 },
        ]
    },
];

// Cafe, Firin, Pastane, Cigkofte sablonlari (demoBusinessData.ts'den)
const CAFE_MENU: MenuCategory[] = [
    {
        name: 'Kaffee', icon: '☕',
        products: [
            { name: 'Espresso', price: 2.50 },
            { name: 'Cappuccino', price: 3.50 },
            { name: 'Latte Macchiato', price: 3.90 },
            { name: 'Türkischer Mokka', price: 3.00 },
            { name: 'Eiskaffee', price: 4.50 },
        ]
    },
    {
        name: 'Tee & Andere', icon: '🍵',
        products: [
            { name: 'Türkischer Tee', price: 2.00, description: 'Traditionell im Glas' },
            { name: 'Pfefferminztee', price: 2.50 },
            { name: 'Heiße Schokolade', price: 3.50 },
            { name: 'Frisch gepresster O-Saft', price: 4.50 },
        ]
    },
    {
        name: 'Kuchen & Gebäck', icon: '🍰',
        products: [
            { name: 'Käsekuchen', price: 4.50 },
            { name: 'Schokoladentorte', price: 4.90 },
            { name: 'Croissant', price: 2.50 },
            { name: 'Baklava (2 Stk.)', price: 3.50 },
        ]
    },
    {
        name: 'Frühstück', icon: '🥪',
        products: [
            { name: 'Avocado Toast', price: 6.90, description: 'Mit Ei und Chiliflocken' },
            { name: 'Türkisches Frühstück', price: 12.90, description: 'Oliven, Käse, Tomate, Gurke, Eier, Honig' },
            { name: 'Toast mit Käse', price: 4.50 },
            { name: 'Açaí Bowl', price: 8.90, description: 'Mit Früchten und Granola' },
        ]
    },
];

const FIRIN_MENU: MenuCategory[] = [
    {
        name: 'Brot', icon: '🍞',
        products: [
            { name: 'Weizenbrot', price: 2.50 },
            { name: 'Vollkornbrot', price: 3.20 },
            { name: 'Fladenbrot', price: 1.80 },
            { name: 'Ciabatta', price: 2.90 },
        ]
    },
    {
        name: 'Börek & Herzhaftes', icon: '🥟',
        products: [
            { name: 'Börek mit Schafskäse', price: 3.50 },
            { name: 'Börek mit Hackfleisch', price: 4.00 },
            { name: 'Simit', price: 1.50, description: 'Türkischer Sesamkringel' },
            { name: 'Pogaca', price: 2.00, description: 'Weiches Gebäck mit Käse' },
            { name: 'Pide mit Sucuk', price: 4.50 },
        ]
    },
    {
        name: 'Süßes Gebäck', icon: '🥐',
        products: [
            { name: 'Croissant', price: 1.80 },
            { name: 'Schoko-Croissant', price: 2.20 },
            { name: 'Nussschnecke', price: 2.50 },
            { name: 'Baklava (3 Stk.)', price: 4.50 },
        ]
    },
];

const PASTANE_MENU: MenuCategory[] = [
    {
        name: 'Torten', icon: '🎂',
        products: [
            { name: 'Schokoladentorte', price: 32.00, description: '26cm, 12 Stücke' },
            { name: 'Erdbeertorte', price: 28.00, description: '26cm, frische Erdbeeren' },
            { name: 'Cheesecake New York', price: 30.00 },
        ]
    },
    {
        name: 'Türkische Süßigkeiten', icon: '🍬',
        products: [
            { name: 'Baklava Pistazie (500g)', price: 18.90 },
            { name: 'Baklava Walnuss (500g)', price: 16.90 },
            { name: 'Künefe', price: 7.90, description: 'Warm mit Pistazien' },
            { name: 'Tulumba (10 Stk.)', price: 8.50 },
            { name: 'Lokum (250g)', price: 6.90, description: 'Turkish Delight' },
        ]
    },
    {
        name: 'Getränke', icon: '🥤',
        products: [
            { name: 'Türkischer Tee', price: 2.00 },
            { name: 'Cappuccino', price: 3.50 },
            { name: 'Ayran', price: 2.50 },
        ]
    },
];

const CIGKOFTE_MENU: MenuCategory[] = [
    {
        name: 'Dürüm', icon: '🌯',
        products: [
            { name: 'Cig Köfte Dürüm', price: 5.90, description: 'Mit Salat, Granatapfelsirup und Zitrone' },
            { name: 'Cig Köfte Dürüm XL', price: 7.90 },
            { name: 'Falafel Dürüm', price: 5.50 },
        ]
    },
    {
        name: 'Portionen', icon: '🥙',
        products: [
            { name: 'Cig Köfte 200g', price: 6.50 },
            { name: 'Cig Köfte 350g', price: 9.50 },
            { name: 'Cig Köfte 1kg zum Mitnehmen', price: 19.90 },
        ]
    },
    {
        name: 'Getränke', icon: '🥤',
        products: [
            { name: 'Ayran', price: 2.50 },
            { name: 'Salgam', price: 3.00, description: 'Fermentierter Rübensaft' },
            { name: 'Coca-Cola 0,33l', price: 2.50 },
        ]
    },
];

function getMenuForType(type: string, name: string): MenuCategory[] {
    switch (type) {
        case 'cafe': return CAFE_MENU;
        case 'firin': return FIRIN_MENU;
        case 'pastane': return PASTANE_MENU;
        case 'cigkofte': return CIGKOFTE_MENU;
        case 'restoran': {
            const sub = detectSubType(name);
            return RESTORAN_SUBTYPES[sub] || GENERAL_RESTORAN;
        }
        default: return GENERAL_RESTORAN;
    }
}

// ================================================================
// MARKET URUNLERI -- TUNA Master Katalog + Turk Marketi Essentials
// ================================================================

const MARKET_CATEGORIES: MenuCategory[] = [
    {
        name: 'Et & Tavuk', icon: '🥩',
        products: [
            { name: 'Hähnchen Ganz', price: 6.49, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/452_tum_tavuk-1.jpg' },
            { name: 'Hähnchenschenkel', price: 6.99, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/459_tavuk_incik-1.jpg' },
            { name: 'Hähnchenfilet 600g', price: 7.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/456_tavuk_gogus-1.jpg' },
            { name: 'Hähnchenflügel', price: 7.99, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/458_tavuk_kanat-1.jpg' },
            { name: 'Rinderhackfleisch Normal', price: 13.99, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/204_azyagli_kiyma-1.jpg' },
            { name: 'Hackfleisch Mager 2kg', price: 29.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/210_yagsiz_kiyma-1.jpg' },
            { name: 'Gulaschfleisch', price: 17.99, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/192_tosun_kusbasi-1.jpg' },
            { name: 'Roastbeef', price: 22.99, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/195_roastbeef-1.jpg' },
        ]
    },
    {
        name: 'Sucuk & Pastirma', icon: '🌶️',
        products: [
            { name: 'Sucuk Mittelscharf 1kg', price: 15.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/501_parmak_sucuk_1kg_2-1.png' },
            { name: 'Kangal Sucuk 1kg', price: 15.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/502_kangal_sucuk_1kg_2-1.png' },
            { name: 'Sucuk Extra Scharf 1kg', price: 15.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/503_sadrazam_sucuk_1kg-1.png' },
            { name: 'Sucuk in Scheiben 250g', price: 4.49, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/101_dilim_sucuk_2-1.png' },
            { name: 'Sucuk Mittelscharf 400g', price: 6.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/504_parmak_sucuk_400g_2-1.png' },
            { name: 'Mini Sucuk 30g', price: 1.25, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/507_mini_sucuk-1.png' },
            { name: 'Pastirma 100g', price: 3.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/12/Pastirma_1x.png' },
        ]
    },
    {
        name: 'Wurst & Aufschnitt', icon: '🥓',
        products: [
            { name: 'Rindswürstchen 400g', price: 6.25, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/12/sigir_sosis_konserve-1.png' },
            { name: 'Hähnchenwürstchen 400g', price: 5.49, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/12/656_tavuk_sosis_400g-1.png' },
            { name: 'Rindswurst Scheiben 150g', price: 2.69, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/596_dilim_sigir_salam_200g-1.png' },
            { name: 'Hähnchenwurst Scheiben 150g', price: 2.69, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/598_dilim_tavuk_salam_200g-1.png' },
            { name: 'Salami ungarisch 400g', price: 6.49, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/599_macar_salam_2-1.png' },
            { name: 'Rindswurst 400g', price: 5.79, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/561_sade_salam_baton_400g-1.png' },
        ]
    },
    {
        name: 'Tiefkühl', icon: '🧊',
        products: [
            { name: 'Döner für zu Hause 500g', price: 9.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/673_ev_tipi_doner-1.jpg' },
            { name: 'Hähnchen Nuggets 500g', price: 6.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/684_tavuk_nugget_500g-1.png' },
            { name: 'TUNA Buletten 600g', price: 9.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/659_tuna_kofte_600g-1.png' },
            { name: 'Inegöl Buletten 600g', price: 9.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/658_inegol_kofte_600g-1.png' },
            { name: 'Adana Kebap 560g', price: 9.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/657_adana_kebap_560g-1.png' },
            { name: 'Hähnchen Burger 540g', price: 7.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/685_tavuk_burger_540g-1.png' },
            { name: 'Rinds-Burger 600g', price: 9.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/656_dana_burger_600g-1.png' },
            { name: 'Manti 750g', price: 7.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2020/11/688_tuna_manti_750g-1.png' },
            { name: 'Lahmacun', price: 6.49, imageUrl: 'https://tunafood.com/wp-content/uploads/2024/03/lahmacun.jpg' },
            { name: 'Pizza Sucuk', price: 7.49, imageUrl: 'https://tunafood.com/wp-content/uploads/2024/03/pizza-sucuk.jpg' },
        ]
    },
    {
        name: 'Kavurma', icon: '🍖',
        products: [
            { name: 'Kavurma 3kg', price: 74.99, imageUrl: 'https://tunafood.com/wp-content/uploads/2024/03/tunafood-baton-kavurma-582.png' },
            { name: 'Kavurma Geschnitten', price: 24.99, unit: 'kg', imageUrl: 'https://tunafood.com/wp-content/uploads/2024/03/tunafood-dilim-kavurma-589.png' },
        ]
    },
    {
        name: 'Milchprodukte', icon: '🧀',
        products: [
            { name: 'Ayran 1L', price: 2.49 },
            { name: 'Beyaz Peynir (Schafskäse) 400g', price: 4.99 },
            { name: 'Kaymak 200g', price: 3.49 },
            { name: 'Joghurt 1kg', price: 3.99 },
            { name: 'Halloumi 200g', price: 3.99 },
        ]
    },
    {
        name: 'Konserven & Hülsenfrüchte', icon: '🥫',
        products: [
            { name: 'Kichererbsen 400g', price: 1.29 },
            { name: 'Tomatenmark 800g', price: 2.99 },
            { name: 'Oliven schwarz 700g', price: 4.49 },
            { name: 'Rote Linsen 1kg', price: 2.99 },
            { name: 'Weiße Bohnen 400g', price: 1.49 },
            { name: 'Weinblätter 400g', price: 3.49 },
        ]
    },
    {
        name: 'Gewürze & Saucen', icon: '🌿',
        products: [
            { name: 'Sumak 200g', price: 2.99 },
            { name: 'Pul Biber (Chiliflocken) 200g', price: 2.99 },
            { name: 'Kreuzkümmel (Cumin) 100g', price: 2.49 },
            { name: 'Granatapfelsirup 500ml', price: 4.99 },
            { name: 'Tahin (Sesammus) 300g', price: 3.99 },
        ]
    },
    {
        name: 'Getränke', icon: '🥤',
        products: [
            { name: 'Ayran 250ml', price: 0.99 },
            { name: 'Salgam 1L', price: 2.99, description: 'Rübensaft' },
            { name: 'Uludag Gazoz 250ml', price: 1.29 },
            { name: 'Türkischer Tee (Caykur) 500g', price: 6.99 },
            { name: 'Türkischer Kaffee 250g', price: 5.99 },
        ]
    },
    {
        name: 'Brot & Backwaren', icon: '🍞',
        products: [
            { name: 'Fladenbrot', price: 1.80 },
            { name: 'Yufka (Teigblätter) 500g', price: 2.99 },
            { name: 'Simit (3er Pack)', price: 2.99 },
            { name: 'Pogaca (5er Pack)', price: 3.99 },
        ]
    },
];

// ================================================================
// MAIN SEEDING FUNCTION
// ================================================================

async function seedAllMenus() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  LOKMA Bulk Menu & Product Seeding`);
    console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log(`${'='.repeat(60)}\n`);

    // Tum business'lari cek
    const snapshot = await db.collection('businesses').get();
    console.log(`Total businesses in Firestore: ${snapshot.size}\n`);

    let yemekSeeded = 0;
    let marketSeeded = 0;
    let skippedExcluded = 0;
    let skippedHasMenu = 0;
    let skippedUnknownType = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.companyName || data.businessName || 'Unknown';
        const type = (data.businessType || '').toLowerCase();
        const types: string[] = Array.isArray(data.types) ? data.types : [type];

        // DOKUNMA KONTROLU
        if (isExcluded(name)) {
            console.log(`  ATLA (korunuyor): ${name}`);
            skippedExcluded++;
            continue;
        }

        // Mevcut menu varsa atla
        const existingCats = await db.collection('businesses').doc(doc.id).collection('categories').limit(1).get();
        if (!existingCats.empty) {
            console.log(`  ATLA (menu var): ${name}`);
            skippedHasMenu++;
            continue;
        }

        // Is tipi kontrol
        const isYemek = YEMEK_TYPES.includes(type) || types.some(t => YEMEK_TYPES.includes(t));
        const isMarket = type === 'market' || types.includes('market');

        let menu: MenuCategory[] = [];

        if (isYemek) {
            menu = getMenuForType(type, name);
            yemekSeeded++;
        } else if (isMarket) {
            menu = MARKET_CATEGORIES;
            marketSeeded++;
        } else {
            console.log(`  ATLA (tur: ${type}): ${name}`);
            skippedUnknownType++;
            continue;
        }

        console.log(`  SEED [${type}]: ${name} (${doc.id}) -> ${menu.length} kategori`);

        if (!DRY_RUN) {
            const businessRef = db.collection('businesses').doc(doc.id);
            const batch = db.batch();

            for (let i = 0; i < menu.length; i++) {
                const cat = menu[i];
                const catRef = businessRef.collection('categories').doc();
                batch.set(catRef, {
                    name: { de: cat.name, tr: cat.name },
                    icon: cat.icon,
                    isActive: true,
                    order: i,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                for (const prod of cat.products) {
                    const prodRef = businessRef.collection('products').doc();
                    const prodData: any = {
                        name: { de: prod.name, tr: prod.name },
                        price: prod.price,
                        sellingPrice: prod.price,
                        description: prod.description ? { de: prod.description, tr: prod.description } : { de: '', tr: '' },
                        category: cat.name,
                        categories: [cat.name],
                        unit: prod.unit || 'stueck',
                        defaultUnit: prod.unit || 'stueck',
                        isActive: true,
                        isAvailable: true,
                        isCustom: true,
                        outOfStock: false,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };
                    if (prod.imageUrl) {
                        prodData.imageUrl = prod.imageUrl;
                    }
                    batch.set(prodRef, prodData);
                }
            }

            await batch.commit();
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  SONUC:`);
    console.log(`    Yemek isletmeleri seeded: ${yemekSeeded}`);
    console.log(`    Market isletmeleri seeded: ${marketSeeded}`);
    console.log(`    Atlanan (korunan): ${skippedExcluded}`);
    console.log(`    Atlanan (menu var): ${skippedHasMenu}`);
    console.log(`    Atlanan (bilinmeyen tur): ${skippedUnknownType}`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);
}

seedAllMenus().catch((err) => {
    console.error('HATA:', err);
    process.exit(1);
});
