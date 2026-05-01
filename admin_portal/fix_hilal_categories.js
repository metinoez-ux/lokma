const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/service-account.json'))
    });
}
const db = admin.firestore();

async function run() {
    const businessId = 'aOTmMmSArHjBbym459j5'; // Hilal Market
    const catsRef = db.collection('businesses').doc(businessId).collection('categories');
    const prodsRef = db.collection('businesses').doc(businessId).collection('products');
    
    // 1. Delete existing categories
    const existingCats = await catsRef.get();
    const batchDelete = db.batch();
    existingCats.forEach(d => batchDelete.delete(d.ref));
    await batchDelete.commit();
    console.log(`Deleted ${existingCats.size} existing categories.`);
    
    // 2. Create 2 Main Categories
    const cat1Ref = catsRef.doc();
    const cat1Name = { tr: "Gıda Ürünleri", de: "Lebensmittel", en: "Food Products", nl: "Levensmiddelen" };
    await cat1Ref.set({
        name: cat1Name,
        icon: "🛒",
        isActive: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    
    const cat2Ref = catsRef.doc();
    const cat2Name = { tr: "Temizlik & Kozmetik", de: "Haushalt & Kosmetik", en: "Household & Cosmetics", nl: "Huishouden & Cosmetica" };
    await cat2Ref.set({
        name: cat2Name,
        icon: "🧼",
        isActive: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    console.log("Created 2 main categories: Lebensmittel, Haushalt & Kosmetik");

    // 3. Update all products to belong to these 2 categories
    const products = await prodsRef.get();
    let batch = db.batch();
    let count = 0;
    
    products.forEach(doc => {
        const data = doc.data();
        let catStr = (data.category || "") + " " + (data.categories ? data.categories.join(" ") : "");
        catStr = catStr.toLowerCase();
        
        // Match household & cosmetics
        let newCategory = "Lebensmittel"; // Default
        if (catStr.includes("haushalt") || catStr.includes("kosmetik") || catStr.includes("pflege") || catStr.includes("reinigung") || catStr.includes("temizlik")) {
            newCategory = "Haushalt & Kosmetik";
        }
        
        batch.update(doc.ref, {
            category: newCategory,
            categories: [newCategory],
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
    console.log(`Updated ${count} products.`);
}
run().then(() => {
    console.log("Done.");
    process.exit();
}).catch(console.error);
