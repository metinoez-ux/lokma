const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

// Define categories with translations and keywords to match from foodpaket tags
const CATEGORY_MAP = [
    {
        name: { tr: "Et & Tavuk", de: "Fleisch & Geflügel", en: "Meat & Poultry", nl: "Vlees & Gevogelte" },
        icon: "🥩",
        keywords: ["fleisch", "grillfleisch", "geflügel", "hähnchen", "lamm", "rind"]
    },
    {
        name: { tr: "Şarküteri & Sosis", de: "Wurst & Feinkost", en: "Deli & Sausages", nl: "Vleeswaren & Delicatessen" },
        icon: "🥓",
        keywords: ["wurst", "feinkost", "milay", "sucuk", "pastirma", "salami", "aufschnitt"]
    },
    {
        name: { tr: "Süt Ürünleri & Peynir", de: "Milchprodukte & Käse", en: "Dairy & Cheese", nl: "Zuivel & Kaas" },
        icon: "🧀",
        keywords: ["milch", "käse", "joghurt", "butter"]
    },
    {
        name: { tr: "Kahvaltılık", de: "Frühstück", en: "Breakfast", nl: "Ontbijt" },
        icon: "🍯",
        keywords: ["frühstück", "brotaufstrich", "marmelade", "honig", "oliven", "olive"]
    },
    {
        name: { tr: "Atıştırmalık & Tatlı", de: "Snacks & Süßwaren", en: "Snacks & Sweets", nl: "Snacks & Snoep" },
        icon: "🍫",
        keywords: ["snack", "süß", "keks", "chips", "schokolade", "dessert", "lokum", "baklava", "cerez", "nüsse"]
    },
    {
        name: { tr: "İçecekler", de: "Getränke", en: "Beverages", nl: "Dranken" },
        icon: "🥤",
        keywords: ["getränke", "softdrink", "dosengetränke", "tee", "kaffee", "ayran", "säfte", "wasser", "limo"]
    },
    {
        name: { tr: "Meyve & Sebze", de: "Obst & Gemüse", en: "Fruits & Vegetables", nl: "Groenten & Fruit" },
        icon: "🍎",
        keywords: ["obst", "gemüse", "frisch"]
    },
    {
        name: { tr: "Dondurulmuş", de: "Tiefkühl", en: "Frozen", nl: "Diepvries" },
        icon: "❄️",
        keywords: ["tiefkühl", "tk", "eis", "pizza"]
    },
    {
        name: { tr: "Temel Gıda & Pişirme", de: "Kochen & Backen", en: "Cooking & Baking", nl: "Koken & Bakken" },
        icon: "🍝",
        keywords: ["kochen", "backen", "öl", "reis", "nudel", "gewürz", "hülsenfrucht", "mehl", "zucker", "konserv", "lebensmittel"]
    },
    {
        name: { tr: "Temizlik & Kozmetik", de: "Haushalt & Kosmetik", en: "Household & Cosmetics", nl: "Huishouden & Cosmetica" },
        icon: "🧼",
        keywords: ["haushalt", "kosmetik", "pflege", "reinigung", "wasch", "hygiene"]
    },
    {
        name: { tr: "Diğer", de: "Sonstiges", en: "Other", nl: "Overige" },
        icon: "🛒",
        keywords: [] // Fallback
    }
];

async function run() {
    const businessId = 'aOTmMmSArHjBbym459j5'; // Hilal Market
    const catsRef = db.collection('businesses').doc(businessId).collection('categories');
    const prodsRef = db.collection('businesses').doc(businessId).collection('products');
    
    // Load JSON to map product name -> original categories
    const productsData = JSON.parse(fs.readFileSync('/Users/metinoz/Desktop/foodpaket_data/foodpaket_all_products.json', 'utf8'));
    const nameToOriginalCats = {};
    for (const p of productsData) {
        if (p.urun_adi && p.kategoriler) {
            nameToOriginalCats[p.urun_adi.trim()] = p.kategoriler;
        }
    }
    
    // 1. Delete existing categories
    const existingCats = await catsRef.get();
    let batch = db.batch();
    existingCats.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${existingCats.size} existing categories.`);
    
    // 2. Create New Categories
    const categoryNameToId = {};
    batch = db.batch();
    for (let i = 0; i < CATEGORY_MAP.length; i++) {
        const catObj = CATEGORY_MAP[i];
        const newRef = catsRef.doc();
        batch.set(newRef, {
            name: catObj.name,
            icon: catObj.icon,
            isActive: true,
            order: i,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        categoryNameToId[catObj.name.de] = catObj;
    }
    await batch.commit();
    console.log(`Created ${CATEGORY_MAP.length} new subcategories.`);
    
    // 3. Update all products
    const products = await prodsRef.get();
    batch = db.batch();
    let count = 0;
    
    products.forEach(doc => {
        const data = doc.data();
        const pName = (data.name && typeof data.name === 'string') ? data.name.trim() : (data.name ? data.name.toString().trim() : "");
        
        let originalCats = pName ? (nameToOriginalCats[pName] || []) : [];
        let pDesc = (data.description && typeof data.description === 'string') ? data.description : (data.description ? data.description.toString() : "");
        let allTerms = originalCats.join(" ").toLowerCase() + " " + pDesc.toLowerCase();
        
        let selectedCategory = CATEGORY_MAP[CATEGORY_MAP.length - 1]; // Fallback to Sonstiges
        let bestMatchScore = -1;
        
        // Find best category match based on keywords
        for (let i = 0; i < CATEGORY_MAP.length - 1; i++) {
            let score = 0;
            const cat = CATEGORY_MAP[i];
            for (const kw of cat.keywords) {
                if (allTerms.includes(kw.toLowerCase())) {
                    score++;
                }
            }
            // Increase score heavily if original categories have exact match
            for (const oc of originalCats) {
                if (cat.keywords.some(kw => oc.toLowerCase().includes(kw))) {
                    score += 5;
                }
            }
            
            if (score > bestMatchScore && score > 0) {
                bestMatchScore = score;
                selectedCategory = cat;
            }
        }
        
        const newCatStr = selectedCategory.name.de; // Using German as the base string for `category` field since DB mostly relies on it for querying if it's a string. Or use the object?
        // Wait, in Firebase Lokma products `category` is a string (usually German or Turkish) and `categories` is an array.
        
        batch.update(doc.ref, {
            category: newCatStr,
            categories: [newCatStr],
            updatedAt: new Date()
        });
        
        count++;
        if (count % 400 === 0) {
            batch.commit();
            batch = db.batch();
        }
    });
    
    if (count % 400 !== 0) {
        await batch.commit();
    }
    console.log(`Updated ${count} products with new granular categories.`);
}

run().then(() => {
    console.log("Done.");
    process.exit();
}).catch(console.error);
