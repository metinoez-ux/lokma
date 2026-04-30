const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../service-account.json');

admin.initializeApp({ 
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'aylar-a45af.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket('aylar-a45af.firebasestorage.app'); 

const HILAL_MARKET_ID = 'aOTmMmSArHjBbym459j5';
const DATA_JSON_PATH = '/Users/metinoz/Desktop/foodpaket_data/foodpaket_all_products.json';
const IMAGES_DIR = '/Users/metinoz/Desktop/foodpaket_data';

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
    
    Object.keys(result).forEach(k => result[k] == null && delete result[k]);
    return result;
}

function extractWeight(text) {
    if (!text) return '';
    const match = text.match(/Nettofüllmenge:\s*([0-9.,]+\s*[a-zA-Z]+)/i);
    if (match && match[1]) {
        return match[1].replace(/\s+/g, '').toLowerCase(); 
    }
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

async function uploadImage(localPath) {
    if (!localPath) return null;
    const fullPath = path.join(IMAGES_DIR, localPath);
    if (!fs.existsSync(fullPath)) {
        return null;
    }
    const fileName = path.basename(localPath);
    const destination = `foodpaket_images/${fileName}`;
    try {
        await bucket.upload(fullPath, {
            destination: destination,
            metadata: { cacheControl: 'public, max-age=31536000' }
        });
        const file = bucket.file(destination);
        await file.makePublic();
        return `https://storage.googleapis.com/${bucket.name}/${destination}`;
    } catch (e) {
        return null;
    }
}

async function getOrCreateCategory(catName) {
    if (!catName) return null;
    const catsRef = db.collection('businesses').doc(HILAL_MARKET_ID).collection('categories');
    const existing = await catsRef.where('name', '==', catName).get();
    if (!existing.empty) {
        return existing.docs[0].id;
    }
    const newCatRef = catsRef.doc();
    await newCatRef.set({
        name: catName,
        isActive: true,
        order: 999,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return newCatRef.id;
}

async function run() {
    const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf-8'));
    console.log(`Found ${data.length} products to import.`);
    
    console.log('Fetching already imported products...');
    const existingUrls = new Set();
    const existingQuery = await db.collection('master_products').where('sourcePlatform', '==', 'foodpaket').get();
    existingQuery.docs.forEach(doc => {
        if (doc.data().sourceUrl) existingUrls.add(doc.data().sourceUrl);
    });
    console.log(`${existingUrls.size} products already imported.`);
    
    let importedCount = 0;
    
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (existingUrls.has(item.orijinal_link)) {
            // Skip already imported products
            continue;
        }
        
        console.log(`[${i+1}/${data.length}] Importing: ${item.urun_adi}`);
        
        const uploadedUrls = [];
        if (item.lokal_resim_yollari && item.lokal_resim_yollari.length > 0) {
            for (let localPath of item.lokal_resim_yollari) {
                const url = await uploadImage(localPath);
                if (url) uploadedUrls.push(url);
            }
        }
        const images = uploadedUrls.length > 0 ? uploadedUrls : (item.resim_url_listesi || []);
        const primaryImage = images.length > 0 ? images[0] : null;
        
        let mainCategory = "Allgemein";
        if (item.kategoriler && item.kategoriler.length > 0) {
            const ignoreList = ['Bestseller', 'Lebensmittel', 'Rabattfähig', 'Alle Produkte', 'Startseite'];
            const validCats = item.kategoriler.filter(c => !ignoreList.includes(c) && !c.includes('Rezepte') && !c.includes('Rezept:'));
            mainCategory = validCats.length > 0 ? validCats[0] : item.kategoriler[item.kategoriler.length - 1];
        }
        const categoryId = await getOrCreateCategory(mainCategory);
        
        let priceNum = 0;
        if (item.fiyat) {
            const cleanPrice = String(item.fiyat).replace('€', '').replace(',', '.').trim();
            priceNum = parseFloat(cleanPrice);
        }
        
        const details = item.detaylar || {};
        let brand = '';
        if (details.produktdetails && details.produktdetails.includes('Marke:')) {
             const parts = details.produktdetails.split('\n');
             const brandIndex = parts.indexOf('Marke:');
             if (brandIndex !== -1 && parts.length > brandIndex + 1) {
                 brand = parts[brandIndex + 1];
             }
        }
        
        const weight = extractWeight(details.produktdetails) || extractWeightFromTitle(item.urun_adi);
        const allergensRecord = extractAllergensRecord(details.zutaten_und_allergene);
        const nutrition = parseNutrition(details.naehrwerte);
        
        const productDoc = {
            name: item.urun_adi || '',
            description: details.beschreibung || '',
            brand: brand,
            price: priceNum,
            originalPrice: priceNum,
            isActive: true,
            images: images,
            imageUrl: primaryImage,
            ingredients: details.zutaten_und_allergene || '',
            allergens: allergensRecord,
            weight: weight,
            ...nutrition,
            notes: details.hinweise || '',
            sourcePlatform: 'foodpaket',
            sourceUrl: item.orijinal_link || '',
            categoryName: mainCategory,
            importedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const masterRef = db.collection('master_products').doc();
        await masterRef.set({
            ...productDoc,
            visibility: 'super_admin_only'
        });
        
        const marketProductRef = db.collection('businesses').doc(HILAL_MARKET_ID).collection('products').doc();
        await marketProductRef.set({
            ...productDoc,
            masterProductId: masterRef.id,
            categoryId: categoryId,
            inStock: item.stok_durumu !== 'out of stock'
        });
        
        importedCount++;
    }
    
    console.log(`Import completed successfully! Imported ${importedCount} new products.`);
}

run().catch(console.error).then(() => process.exit(0));
