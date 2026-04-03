/**
 * Demo Business Data Helper
 * PLZ 41836 Hückelhoven etrafindaki gercek isletmeler icin
 * Google Places arama sorgulari ve her tur icin menu sablonlari
 */

// ================================================================
// GOOGLE PLACES ARAMA SORGULARI (PLZ 41836 yakininda)
// ================================================================

// Hückelhoven merkez koordinatlari
export const DEMO_CENTER = { lat: 51.0547, lng: 6.2273 };
export const DEMO_RADIUS = 5000; // 5km

// Arama turleri -- Google Places 'type' parametresi
export const DEMO_SEARCH_QUERIES = [
 { query: 'Restaurant Hückelhoven', type: 'restoran', googleType: 'restaurant' },
 { query: 'Imbiss Hückelhoven', type: 'restoran', googleType: 'restaurant' },
 { query: 'Pizzeria Hückelhoven', type: 'restoran', googleType: 'restaurant' },
 { query: 'Döner Kebab Hückelhoven', type: 'restoran', googleType: 'restaurant' },
 { query: 'Bäckerei Hückelhoven', type: 'firin', googleType: 'bakery' },
 { query: 'Cafe Hückelhoven', type: 'cafe', googleType: 'cafe' },
 { query: 'Metzgerei Hückelhoven', type: 'kasap', googleType: 'store' },
 { query: 'Konditorei Hückelhoven', type: 'pastane', googleType: 'bakery' },
 { query: 'Asiatisches Restaurant Hückelhoven', type: 'restoran', googleType: 'restaurant' },
 { query: 'Griechisches Restaurant Hückelhoven', type: 'restoran', googleType: 'restaurant' },
];

// ================================================================
// ISLETME TURU -> LOKMA BUSINESS TYPE ESLESTIRME
// Google Places 'types' --> LOKMA businessType
// ================================================================

export function detectBusinessType(name: string, googleTypes: string[]): string {
 const n = name.toLowerCase();
 if (n.includes('metzger') || n.includes('fleisch')) return 'kasap';
 if (n.includes('bäcker') || n.includes('backhaus') || n.includes('backstube')) return 'firin';
 if (n.includes('konditor') || n.includes('patisser') || n.includes('torte')) return 'pastane';
 if (n.includes('cafe') || n.includes('café') || n.includes('kaffee') || n.includes('coffee')) return 'cafe';
 if (n.includes('çiğ köfte') || n.includes('cigkofte') || n.includes('cig kofte')) return 'cigkofte';
 // Default: restoran (includes imbiss, pizzeria, döner, etc.)
 return 'restoran';
}

// ================================================================
// MUTFAK TURLERI ESLESTIRME
// ================================================================

export function detectCuisineTypes(name: string): string[] {
 const n = name.toLowerCase();
 const cuisines: string[] = [];

 if (n.includes('türk') || n.includes('kebab') || n.includes('döner') || n.includes('lahmacun') || n.includes('pide')) cuisines.push('turkisch');
 if (n.includes('pizza') || n.includes('italia') || n.includes('ristorante') || n.includes('trattoria')) cuisines.push('italienisch');
 if (n.includes('china') || n.includes('chines') || n.includes('asia') || n.includes('sushi') || n.includes('thai') || n.includes('vietnam')) cuisines.push('asiatisch');
 if (n.includes('griech') || n.includes('greek') || n.includes('gyros') || n.includes('taverna')) cuisines.push('griechisch');
 if (n.includes('indian') || n.includes('curry') || n.includes('tandoori')) cuisines.push('indisch');
 if (n.includes('burger') || n.includes('american') || n.includes('steak')) cuisines.push('amerikanisch');
 if (n.includes('mexikan') || n.includes('taco') || n.includes('burrito')) cuisines.push('mexikanisch');
 if (n.includes('bäcker') || n.includes('deutsch') || n.includes('gasthaus') || n.includes('gasthof') || n.includes('wirtshaus')) cuisines.push('deutsch');

 if (cuisines.length === 0) cuisines.push('international');
 return cuisines;
}

// ================================================================
// MENU SABLONLARI -- Her isletme turu icin gercekci menuler
// ================================================================

export interface DemoMenuCategory {
 name: string;
 icon: string;
 products: DemoMenuProduct[];
}

export interface DemoMenuProduct {
 name: string;
 price: number;
 description?: string;
 unit?: string;
}

export const MENU_TEMPLATES: Record<string, DemoMenuCategory[]> = {
 // ─── RESTORAN ────────────────────────────────────────
 restoran: [
 {
 name: 'Vorspeisen', icon: '🥗',
 products: [
 { name: 'Gemischter Salat', price: 5.90, description: 'Frischer Blattsalat mit Tomaten, Gurken und Essig-Öl-Dressing' },
 { name: 'Linsensuppe', price: 4.50, description: 'Traditionelle rote Linsensuppe' },
 { name: 'Hummus', price: 5.50, description: 'Kichererbsenpüree mit Olivenöl und Fladenbrot' },
 { name: 'Cacik', price: 4.00, description: 'Joghurt mit Gurken, Knoblauch und Minze' },
 { name: 'Sigara Börek', price: 6.50, description: '4 Stück knusprige Teigröllchen mit Schafskäse' },
 ]
 },
 {
 name: 'Hauptgerichte', icon: '🍖',
 products: [
 { name: 'Döner Teller', price: 12.90, description: 'Mit Reis, Salat und Soße' },
 { name: 'Adana Kebab', price: 14.50, description: 'Scharf gewürztes Hackfleisch vom Grill mit Reis und Salat' },
 { name: 'Iskender Kebab', price: 15.90, description: 'Döner auf Fladenbrot mit Tomatensoße und Joghurt' },
 { name: 'Lahmacun', price: 7.50, description: 'Türkische Pizza mit Hackfleisch, dünn und knusprig' },
 { name: 'Pide mit Käse', price: 9.90, description: 'Türkisches Fladenbrot mit Käsefüllung' },
 { name: 'Hähnchen Schnitzel', price: 11.90, description: 'Paniertes Hähnchenschnitzel mit Pommes und Salat' },
 { name: 'Mixed Grill Teller', price: 18.90, description: 'Adana, Hähnchen, Lammkoteletts mit Beilagen' },
 { name: 'Falafel Teller', price: 10.90, description: 'Kichererbsenbällchen mit Hummus, Salat und Fladenbrot' },
 ]
 },
 {
 name: 'Pizza & Pasta', icon: '🍕',
 products: [
 { name: 'Pizza Margherita', price: 8.50, description: 'Tomaten, Mozzarella, Basilikum' },
 { name: 'Pizza Sucuk', price: 10.90, description: 'Tomaten, Mozzarella, Sucuk, Paprika' },
 { name: 'Pizza Lahmacun-Style', price: 11.50, description: 'Hackfleisch, Zwiebeln, Paprika, scharf' },
 { name: 'Spaghetti Bolognese', price: 10.90, description: 'Mit hausgemachter Fleischsoße' },
 ]
 },
 {
 name: 'Desserts', icon: '🍮',
 products: [
 { name: 'Baklava', price: 5.50, description: '4 Stück Blätterteiggebäck mit Pistazien und Sirup' },
 { name: 'Künefe', price: 7.90, description: 'Warmes Fadennudelgebäck mit Käsefüllung und Sirup' },
 { name: 'Sütlaç', price: 4.50, description: 'Türkischer Milchreis, kalt serviert' },
 { name: 'Tiramisu', price: 5.90, description: 'Italienisches Dessert mit Mascarpone und Espresso' },
 ]
 },
 {
 name: 'Getränke', icon: '🥤',
 products: [
 { name: 'Ayran', price: 2.50, description: 'Erfrischendes Joghurtgetränk' },
 { name: 'Coca-Cola 0,33l', price: 2.50 },
 { name: 'Fanta 0,33l', price: 2.50 },
 { name: 'Türkischer Tee', price: 2.00 },
 { name: 'Wasser 0,5l', price: 2.00 },
 { name: 'Frisch gepresster Orangensaft', price: 4.50 },
 ]
 },
 ],

 // ─── KASAP (METZGEREI) ───────────────────────────────
 kasap: [
 {
 name: 'Rindfleisch', icon: '🥩',
 products: [
 { name: 'Rinderhackfleisch', price: 12.90, unit: 'kg', description: 'Frisch durch den Wolf gedreht' },
 { name: 'Rindergulasch', price: 14.90, unit: 'kg', description: 'Zartes Rindfleisch, gewürfelt' },
 { name: 'Rindersteak', price: 28.90, unit: 'kg', description: 'Saftige Steaks vom Jungbullen' },
 { name: 'Rinderrouladen', price: 18.90, unit: 'kg', description: 'Dünn geschnittene Oberschale' },
 { name: 'Knochenmark', price: 8.90, unit: 'kg', description: 'Markknochen vom Rind' },
 ]
 },
 {
 name: 'Lammfleisch', icon: '🐑',
 products: [
 { name: 'Lammkeule', price: 19.90, unit: 'kg', description: 'Ganze Keule, ideal zum Schmoren' },
 { name: 'Lammkoteletts', price: 24.90, unit: 'kg', description: 'Zarte Koteletts vom Lamm' },
 { name: 'Lammhackfleisch', price: 16.90, unit: 'kg', description: 'Frisch gehackt' },
 { name: 'Lammschulter', price: 17.90, unit: 'kg', description: 'Ideal für Eintöpfe' },
 ]
 },
 {
 name: 'Hähnchen', icon: '🍗',
 products: [
 { name: 'Ganzes Hähnchen', price: 7.90, unit: 'kg', description: 'Frisches Hähnchen, bratfertig' },
 { name: 'Hähnchenbrust', price: 11.90, unit: 'kg', description: 'Mager und vielseitig' },
 { name: 'Hähnchenschenkel', price: 6.90, unit: 'kg', description: 'Saftig und aromatisch' },
 { name: 'Hähnchenflügel', price: 5.90, unit: 'kg', description: 'Ideal zum Grillen' },
 ]
 },
 {
 name: 'Wurstwaren', icon: '🌭',
 products: [
 { name: 'Sucuk (Knoblauchwurst)', price: 14.90, unit: 'kg', description: 'Würzige türkische Knoblauchwurst' },
 { name: 'Pastirma', price: 34.90, unit: 'kg', description: 'Luftgetrocknetes Rindfleisch mit Gewürzpaste' },
 { name: 'Rindersalami', price: 16.90, unit: 'kg', description: 'Mild gewürzte Rindersalami' },
 { name: 'Soudjouk', price: 15.90, unit: 'kg', description: 'Getrocknete Rinderwurst' },
 ]
 },
 ],

 // ─── CAFE ────────────────────────────────────────────
 cafe: [
 {
 name: 'Kaffee', icon: '☕',
 products: [
 { name: 'Espresso', price: 2.50 },
 { name: 'Cappuccino', price: 3.50 },
 { name: 'Latte Macchiato', price: 3.90 },
 { name: 'Filterkaffee', price: 2.80 },
 { name: 'Türkischer Mokka', price: 3.00 },
 { name: 'Eiskaffee', price: 4.50 },
 ]
 },
 {
 name: 'Tee & Andere', icon: '🍵',
 products: [
 { name: 'Türkischer Tee', price: 2.00, description: 'Traditionell serviert im Glas' },
 { name: 'Pfefferminztee', price: 2.50 },
 { name: 'Heiße Schokolade', price: 3.50 },
 { name: 'Frisch gepresster O-Saft', price: 4.50 },
 { name: 'Limonade hausgemacht', price: 3.90 },
 ]
 },
 {
 name: 'Kuchen & Gebäck', icon: '🍰',
 products: [
 { name: 'Käsekuchen', price: 4.50, description: 'Cremiger New-York-Style Cheesecake' },
 { name: 'Schokoladentorte', price: 4.90, description: 'Reichhaltig und schokoladig' },
 { name: 'Apfelstrudel', price: 4.50, description: 'Mit Vanillesoße' },
 { name: 'Croissant', price: 2.50, description: 'Frisch gebacken, buttrig' },
 { name: 'Baklava', price: 3.50, description: '2 Stück mit Pistazien' },
 ]
 },
 {
 name: 'Snacks', icon: '🥪',
 products: [
 { name: 'Toast mit Käse', price: 4.50 },
 { name: 'Avocado Toast', price: 6.90, description: 'Mit pochierten Ei und Chiliflocken' },
 { name: 'Bagel mit Lachs', price: 7.50 },
 { name: 'Açaí Bowl', price: 8.90, description: 'Mit frischen Früchten und Granola' },
 ]
 },
 ],

 // ─── FIRIN (BÄCKEREI) ────────────────────────────────
 firin: [
 {
 name: 'Brot', icon: '🍞',
 products: [
 { name: 'Weizenbrot', price: 2.50, description: 'Täglich frisch gebacken' },
 { name: 'Vollkornbrot', price: 3.20, description: 'Mit Körnern und Saaten' },
 { name: 'Fladenbrot', price: 1.80, description: 'Türkisches Fladenbrot, weich' },
 { name: 'Ciabatta', price: 2.90, description: 'Italienisches Weißbrot' },
 ]
 },
 {
 name: 'Brötchen', icon: '🥖',
 products: [
 { name: 'Weizenbrötchen', price: 0.50 },
 { name: 'Mehrkornbrötchen', price: 0.70 },
 { name: 'Laugenbrötchen', price: 0.80 },
 { name: 'Sesambrötchen', price: 0.60 },
 ]
 },
 {
 name: 'Börek & Herzhaftes', icon: '🥟',
 products: [
 { name: 'Börek mit Schafskäse', price: 3.50, description: 'Blätterteig mit Käsefüllung' },
 { name: 'Börek mit Hackfleisch', price: 4.00, description: 'Blätterteig mit Fleischfüllung' },
 { name: 'Simit', price: 1.50, description: 'Türkischer Sesamkringel' },
 { name: 'Poğaça', price: 2.00, description: 'Weiches Gebäck mit Käse oder Kartoffel' },
 { name: 'Pide mit Sucuk', price: 4.50, description: 'Türkische Pizza mit Knoblauchwurst' },
 ]
 },
 {
 name: 'Süßes Gebäck', icon: '🥐',
 products: [
 { name: 'Croissant', price: 1.80 },
 { name: 'Schoko-Croissant', price: 2.20 },
 { name: 'Nussschnecke', price: 2.50 },
 { name: 'Berliner', price: 1.50 },
 { name: 'Baklava (3 Stk.)', price: 4.50 },
 ]
 },
 ],

 // ─── PASTANE (KONDITOREI) ────────────────────────────
 pastane: [
 {
 name: 'Torten', icon: '🎂',
 products: [
 { name: 'Hochzeitstorte (pro Person)', price: 8.90, description: 'Nach Wunsch dekoriert, mind. 20 Personen' },
 { name: 'Schokoladentorte', price: 32.00, description: '26cm, 12 Stücke' },
 { name: 'Erdbeertorte', price: 28.00, description: '26cm, frische Erdbeeren' },
 { name: 'Cheesecake New York', price: 30.00, description: '26cm, cremig' },
 ]
 },
 {
 name: 'Kuchen am Stück', icon: '🍰',
 products: [
 { name: 'Käsekuchen', price: 4.50 },
 { name: 'Apfelkuchen', price: 3.90 },
 { name: 'Karottenkuchen', price: 4.50 },
 { name: 'Zitronenkuchen', price: 3.50 },
 ]
 },
 {
 name: 'Türkische Süßigkeiten', icon: '🍬',
 products: [
 { name: 'Baklava Pistazie (500g)', price: 18.90 },
 { name: 'Baklava Walnuss (500g)', price: 16.90 },
 { name: 'Künefe', price: 7.90, description: 'Warm serviert mit Pistazien' },
 { name: 'Tulumba Tatlisi (10 Stk.)', price: 8.50, description: 'Frittiertes Gebäck in Sirup' },
 { name: 'Lokum (250g)', price: 6.90, description: 'Turkish Delight, verschiedene Sorten' },
 { name: 'Sütlaç', price: 4.50, description: 'Türkischer Milchreis' },
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
 ],

 // ─── CIGKOFTE ────────────────────────────────────────
 cigkofte: [
 {
 name: 'Dürüm', icon: '🌯',
 products: [
 { name: 'Çiğ Köfte Dürüm', price: 5.90, description: 'Mit Salat, Granatapfelsirup und Zitrone' },
 { name: 'Çiğ Köfte Dürüm XL', price: 7.90, description: 'Extra groß mit doppelter Füllung' },
 { name: 'Falafel Dürüm', price: 5.50, description: 'Mit Hummus und Salat' },
 ]
 },
 {
 name: 'Portionen', icon: '🥙',
 products: [
 { name: 'Çiğ Köfte Portion 200g', price: 6.50, description: 'Mit Salat und Soße' },
 { name: 'Çiğ Köfte Portion 350g', price: 9.50, description: 'Familienpackung' },
 { name: 'Çiğ Köfte 1kg zum Mitnehmen', price: 19.90 },
 ]
 },
 {
 name: 'Beilagen', icon: '🥬',
 products: [
 { name: 'Pommes', price: 3.50 },
 { name: 'Hummus', price: 4.50 },
 { name: 'Salat', price: 3.90 },
 ]
 },
 {
 name: 'Getränke', icon: '🥤',
 products: [
 { name: 'Ayran', price: 2.50 },
 { name: 'Şalgam', price: 3.00, description: 'Fermentierter Rübensaft' },
 { name: 'Limonade', price: 2.90 },
 { name: 'Coca-Cola 0,33l', price: 2.50 },
 ]
 },
 ],

 // ─── MARKET ──────────────────────────────────────────
 market: [
 {
 name: 'Obst & Gemüse', icon: '🥬',
 products: [
 { name: 'Tomaten', price: 2.99, unit: 'kg' },
 { name: 'Gurken', price: 1.49, unit: 'stueck' },
 { name: 'Paprika Mix', price: 3.99, unit: 'kg' },
 { name: 'Bananen', price: 1.99, unit: 'kg' },
 { name: 'Äpfel', price: 2.49, unit: 'kg' },
 ]
 },
 {
 name: 'Molkereiprodukte', icon: '🧀',
 products: [
 { name: 'Ayran 1L', price: 2.49 },
 { name: 'Beyaz Peynir (Schafskäse) 400g', price: 4.99 },
 { name: 'Kaymak 200g', price: 3.49 },
 { name: 'Joghurt 1kg', price: 3.99 },
 ]
 },
 {
 name: 'Konserven & Hülsenfrüchte', icon: '🥫',
 products: [
 { name: 'Kichererbsen 400g', price: 1.29 },
 { name: 'Tomatenmark 800g', price: 2.99 },
 { name: 'Oliven schwarz 700g', price: 4.49 },
 { name: 'Rote Linsen 1kg', price: 2.99 },
 ]
 },
 ],
};

// ================================================================
// DEFAULT BUSINESS SETTINGS
// ================================================================

export function getDefaultBusinessSettings(type: string) {
 const base = {
 status: 'active',
 deliveryEnabled: true,
 pickupEnabled: true,
 dineInEnabled: false,
 minimumOrder: 15,
 deliveryFee: 2.90,
 deliveryRadius: 5,
 averagePreparationTime: 30,
 currency: 'EUR',
 taxRate: 19,
 isDemo: true,
 };

 switch (type) {
 case 'kasap':
 return { ...base, minimumOrder: 20, averagePreparationTime: 15, dineInEnabled: false };
 case 'cafe':
 return { ...base, minimumOrder: 8, averagePreparationTime: 10, dineInEnabled: true };
 case 'firin':
 return { ...base, minimumOrder: 5, deliveryFee: 1.90, averagePreparationTime: 10 };
 case 'pastane':
 return { ...base, minimumOrder: 10, averagePreparationTime: 15 };
 case 'cigkofte':
 return { ...base, minimumOrder: 8, averagePreparationTime: 10 };
 case 'market':
 return { ...base, minimumOrder: 25, averagePreparationTime: 20, deliveryFee: 3.90 };
 default: // restoran
 return { ...base, dineInEnabled: true };
 }
}
