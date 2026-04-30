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
const IMAGES_DIR = '/Users/metinoz/Desktop/foodpaket_data'; // The paths in JSON start with foodpaket_all_images/

async function clearOldData() {
    console.log('Clearing old Foodpaket data...');
    
    // 1. Clear Master Products
    const masterQuery = await db.collection('master_products').where('sourcePlatform', '==', 'foodpaket').get();
    let batch = db.batch();
    let count = 0;
    masterQuery.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        if (count % 400 === 0) {
            batch.commit();
            batch = db.batch();
        }
    });
    if (count % 400 !== 0) await batch.commit();
    console.log(`Deleted ${count} old master_products`);

    // 2. Clear Hilal Market Products
    const hilalQuery = await db.collection('businesses').doc(HILAL_MARKET_ID).collection('products').where('sourcePlatform', '==', 'foodpaket').get();
    batch = db.batch();
    count = 0;
    hilalQuery.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        if (count % 400 === 0) {
            batch.commit();
            batch = db.batch();
        }
    });
    if (count % 400 !== 0) await batch.commit();
    console.log(`Deleted ${count} old Hilal Market products`);
}

async function uploadImage(localPath) {
    if (!localPath) return null;
    const fullPath = path.join(IMAGES_DIR, localPath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`Image not found locally: ${fullPath}`);
        return null;
    }
    
    const fileName = path.basename(localPath);
    const destination = `foodpaket_images/${fileName}`;
    
    try {
        await bucket.upload(fullPath, {
            destination: destination,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            }
        });
        
        // Make it public or just construct the URL
        const file = bucket.file(destination);
        await file.makePublic();
        return `https://storage.googleapis.com/${bucket.name}/${destination}`;
    } catch (e) {
        console.error(`Failed to upload image ${fileName}:`, e);
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
        order: 999, // push to end
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return newCatRef.id;
}

function extractAllergens(text) {
    if (!text) return [];
    if (text.includes('Allergenhinweise:')) {
        let parts = text.split('Allergenhinweise:');
        let allergenText = parts[1].replace('Enthält:', '').trim();
        return allergenText.split(',').map(s => s.replace('.', '').trim()).filter(s => s);
    }
    return [];
}

async function run() {
    await clearOldData();
    
    const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf-8'));
    console.log(`Found ${data.length} products to import.`);
    
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        console.log(`[${i+1}/${data.length}] Importing: ${item.urun_adi}`);
        
        // 1. Upload Images
        const uploadedUrls = [];
        if (item.lokal_resim_yollari && item.lokal_resim_yollari.length > 0) {
            for (let localPath of item.lokal_resim_yollari) {
                const url = await uploadImage(localPath);
                if (url) uploadedUrls.push(url);
            }
        }
        
        // Fallback to original URL if local fails
        const images = uploadedUrls.length > 0 ? uploadedUrls : (item.resim_url_listesi || []);
        const primaryImage = images.length > 0 ? images[0] : null;
        
        // 2. Resolve Category
        let mainCategory = "Allgemein";
        if (item.kategoriler && item.kategoriler.length > 0) {
            // Check specific logic. A simple way: find the category that looks most specific, or just take the first meaningful one.
            const ignoreList = ['Bestseller', 'Lebensmittel', 'Rabattfähig', 'Alle Produkte', 'Startseite'];
            const validCats = item.kategoriler.filter(c => !ignoreList.includes(c) && !c.includes('Rezepte') && !c.includes('Rezept:'));
            mainCategory = validCats.length > 0 ? validCats[0] : item.kategoriler[item.kategoriler.length - 1];
        }
        const categoryId = await getOrCreateCategory(mainCategory);
        
        // 3. Parse Price
        let priceNum = 0;
        if (item.fiyat) {
            const cleanPrice = String(item.fiyat).replace('€', '').replace(',', '.').trim();
            priceNum = parseFloat(cleanPrice);
        }
        
        const details = item.detaylar || {};
        const allergens = extractAllergens(details.zutaten_und_allergene);
        
        // Product Details extraction
        let brand = '';
        if (details.produktdetails && details.produktdetails.includes('Marke:')) {
             const parts = details.produktdetails.split('\n');
             const brandIndex = parts.indexOf('Marke:');
             if (brandIndex !== -1 && parts.length > brandIndex + 1) {
                 brand = parts[brandIndex + 1];
             }
        }
        
        // 4. Construct Product Document
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
            allergens: allergens,
            nutritionalInfo: details.naehrwerte || '',
            notes: details.hinweise || '',
            sourcePlatform: 'foodpaket',
            sourceUrl: item.orijinal_link || '',
            categoryName: mainCategory,
            importedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Insert to Master Catalog
        const masterRef = db.collection('master_products').doc();
        await masterRef.set({
            ...productDoc,
            visibility: 'super_admin_only'
        });
        
        // Insert to Hilal Market
        const marketProductRef = db.collection('businesses').doc(HILAL_MARKET_ID).collection('products').doc();
        await marketProductRef.set({
            ...productDoc,
            masterProductId: masterRef.id,
            categoryId: categoryId,
            inStock: item.stok_durumu !== 'out of stock'
        });
    }
    
    console.log('Import completed successfully!');
}

run().catch(console.error).then(() => process.exit(0));
