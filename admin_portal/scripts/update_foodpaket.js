const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../service-account.json');

admin.initializeApp({ 
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const HILAL_MARKET_ID = 'aOTmMmSArHjBbym459j5';
const DATA_JSON_PATH = '/Users/metinoz/Desktop/foodpaket_data/foodpaket_all_products.json';

// Mapping from German strings to LOKMA keys
const ALLERGEN_MAP = {
    'gluten': 'gluten',
    'weizen': 'gluten',
    'krebstiere': 'crustaceans',
    'eier': 'eggs',
    'ei': 'eggs',
    'fisch': 'fish',
    'erdnuss': 'peanuts',
    'erdnüsse': 'peanuts',
    'soja': 'soy',
    'milch': 'milk',
    'laktose': 'milk',
    'schalenfrüchte': 'treeNuts',
    'nüsse': 'treeNuts',
    'sellerie': 'celery',
    'senf': 'mustard',
    'sesam': 'sesame',
    'sulfite': 'sulfites',
    'schwefeldioxid': 'sulfites',
    'lupine': 'lupin',
    'weichtiere': 'molluscs'
};

function extractAllergensRecord(text) {
    const record = {};
    if (!text) return record;
    
    const lowerText = text.toLowerCase();
    for (const [deName, key] of Object.entries(ALLERGEN_MAP)) {
        if (lowerText.includes(deName)) {
            record[key] = true;
        }
    }
    return record;
}

function parseNutrition(text) {
    const result = {};
    if (!text) return result;
    
    // Example: "Energie/Brennwert:\n1376 kJ\n/\n332\nkcal\nFett:\n28 g\ndavon gesättigte Fettsäuren:\n15  g\nKohlenhydrate:\n2 g\ndavon Zucker:\n1 g\nEiweiß:\n18 g\nSalz:\n3,3 g"
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const textJoined = lines.join(' ');
    
    const extractNum = (regex) => {
        const match = textJoined.match(regex);
        if (match && match[1]) {
            return parseFloat(match[1].replace(',', '.'));
        }
        return null;
    };

    result.energie_kj = extractNum(/(\d+(?:,\d+)?)\s*kJ/i) || extractNum(/Brennwert[^0-9]*(\d+(?:,\d+)?)/i);
    result.energie_kcal = extractNum(/(\d+(?:,\d+)?)\s*kcal/i);
    result.fett = extractNum(/Fett[^0-9]*(\d+(?:,\d+)?)\s*g/i);
    result.gesaettigte_fettsaeuren = extractNum(/gesättigte Fettsäuren[^0-9]*(\d+(?:,\d+)?)\s*g/i) || extractNum(/gesättigte[^0-9]*(\d+(?:,\d+)?)\s*g/i);
    result.kohlenhydrate = extractNum(/Kohlenhydrate[^0-9]*(\d+(?:,\d+)?)\s*g/i);
    result.zucker = extractNum(/Zucker[^0-9]*(\d+(?:,\d+)?)\s*g/i);
    result.protein = extractNum(/Eiweiß[^0-9]*(\d+(?:,\d+)?)\s*g/i) || extractNum(/Protein[^0-9]*(\d+(?:,\d+)?)\s*g/i);
    result.salz = extractNum(/Salz[^0-9]*(\d+(?:,\d+)?)\s*g/i);
    
    // Clean up nulls
    Object.keys(result).forEach(k => result[k] == null && delete result[k]);
    return result;
}

function extractWeight(text) {
    if (!text) return '';
    const match = text.match(/Nettofüllmenge:\s*([0-9.,]+\s*[a-zA-Z]+)/i);
    if (match && match[1]) {
        return match[1].replace(/\s+/g, '').toLowerCase(); // e.g. "250g"
    }
    // Try to find any "250g", "1kg", "500ml" in the title as fallback
    return '';
}

function extractWeightFromTitle(title) {
    if (!title) return '';
    const match = title.match(/-\s*([0-9.,]+\s*(?:g|kg|ml|l))/i);
    if (match && match[1]) {
        return match[1].replace(/\s+/g, '').toLowerCase();
    }
    return '';
}

async function updateProducts() {
    const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf-8'));
    console.log(`Found ${data.length} products in JSON.`);
    
    // Map JSON by sourceUrl
    const jsonMap = new Map();
    data.forEach(item => {
        if (item.orijinal_link) {
            jsonMap.set(item.orijinal_link, item);
        }
    });

    // 1. Update Master Products
    console.log('Fetching Master Products...');
    const masterQuery = await db.collection('master_products').where('sourcePlatform', '==', 'foodpaket').get();
    let batch = db.batch();
    let count = 0;
    
    masterQuery.docs.forEach(doc => {
        const sourceUrl = doc.data().sourceUrl;
        const item = jsonMap.get(sourceUrl);
        if (item) {
            const details = item.detaylar || {};
            const weight = extractWeight(details.produktdetails) || extractWeightFromTitle(item.urun_adi);
            const allergensRecord = extractAllergensRecord(details.zutaten_und_allergene);
            const nutrition = parseNutrition(details.naehrwerte);
            
            const updatePayload = {
                ingredients: details.zutaten_und_allergene || '',
                allergens: allergensRecord,
                weight: weight,
                ...nutrition
            };
            
            batch.update(doc.ref, updatePayload);
            count++;
            
            if (count % 400 === 0) {
                batch.commit();
                batch = db.batch();
            }
        }
    });
    if (count % 400 !== 0) await batch.commit();
    console.log(`Updated ${count} Master Products with rich data.`);

    // 2. Update Hilal Market Products
    console.log('Fetching Hilal Market Products...');
    const hilalQuery = await db.collection('businesses').doc(HILAL_MARKET_ID).collection('products').where('sourcePlatform', '==', 'foodpaket').get();
    batch = db.batch();
    count = 0;
    
    hilalQuery.docs.forEach(doc => {
        const sourceUrl = doc.data().sourceUrl;
        const item = jsonMap.get(sourceUrl);
        if (item) {
            const details = item.detaylar || {};
            const weight = extractWeight(details.produktdetails) || extractWeightFromTitle(item.urun_adi);
            const allergensRecord = extractAllergensRecord(details.zutaten_und_allergene);
            const nutrition = parseNutrition(details.naehrwerte);
            
            const updatePayload = {
                ingredients: details.zutaten_und_allergene || '',
                allergens: allergensRecord,
                weight: weight,
                ...nutrition
            };
            
            batch.update(doc.ref, updatePayload);
            count++;
            
            if (count % 400 === 0) {
                batch.commit();
                batch = db.batch();
            }
        }
    });
    if (count % 400 !== 0) await batch.commit();
    console.log(`Updated ${count} Hilal Market Products with rich data.`);
}

updateProducts().catch(console.error).then(() => process.exit(0));
