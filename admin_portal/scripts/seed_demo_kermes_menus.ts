import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { KERMES_MENU_CATALOG, KermesMenuItemData } from '../src/lib/kermes_menu_catalog';

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '../service-account.json');
let db: any;
try {
  if (fs.existsSync(serviceAccountPath)) {
    initializeApp({
      credential: cert(serviceAccountPath)
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId: 'aylar-a45af'
    });
  }
  db = getFirestore();
} catch (e) {
  console.log("Already initialized");
  db = getFirestore();
}

async function seedKermesMenus() {
  console.log("Fetching all demo Kermes events...");
  const snapshot = await db.collection('kermes_events').get();
  const kermeses = snapshot.docs;

  console.log(`Found ${kermeses.length} Kermes events. Starting menu injection...`);
  let totalImported = 0;

  for (const kermesDoc of kermeses) {
    const kermesId = kermesDoc.id;
    const kermesName = kermesDoc.data().title || kermesId;
    console.log(`Processing menus for: ${kermesName}`);

    const batch = db.batch();
    const productsRef = db.collection('kermes_events').doc(kermesId).collection('products');
    
    // Wipe existing products to prevent duplicates
    const existingProducts = await productsRef.get();
    for (const doc of existingProducts.docs) {
       batch.delete(doc.ref);
    }

    // Prepare Categories list just in case it's needed (unique categories)
    const uniqueCategories = Array.from(new Set(Object.values(KERMES_MENU_CATALOG).map(item => item.category)));
    const categoriesRef = db.collection('kermes_events').doc(kermesId).collection('categories');
    
    const existingCats = await categoriesRef.get();
    for (const doc of existingCats.docs) {
       batch.delete(doc.ref);
    }
    
    for (let i = 0; i < uniqueCategories.length; i++) {
        const catName = uniqueCategories[i];
        const catDoc = categoriesRef.doc();
        batch.set(catDoc, {
            name: { tr: catName, de: catName },
            isActive: true,
            order: i,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    // Insert menu catalog
    const menuItems = Object.values(KERMES_MENU_CATALOG);
    for (const item of menuItems) {
      const docRef = productsRef.doc(item.sku);
      
      const productData = {
        name: { 
            tr: item.name, 
            de: item.name_de || item.name 
        },
        description: { 
            tr: item.description || '', 
            de: item.description_de || '' 
        },
        ingredients: { 
            tr: item.ingredients || '', 
            de: item.ingredients_de || '' 
        },
        allergens: { 
            tr: item.allergens || '', 
            de: item.allergens_de || '' 
        },
        category: item.category,
        categories: [item.category],
        price: item.defaultPrice,
        sellingPrice: item.defaultPrice,
        unit: item.unit || 'adet',
        defaultUnit: item.unit || 'adet',
        isActive: true,
        isAvailable: true,
        outOfStock: false,
        tags: item.tags || [],
        imageUrl: item.imageAsset || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      batch.set(docRef, productData);
      totalImported++;
    }
    
    await batch.commit();
  }

  console.log(`\nSuccessfully injected ${Object.keys(KERMES_MENU_CATALOG).length} catalog products to ${kermeses.length} Kermeses.`);
  console.log(`Total DB writes: ${totalImported}`);
}

seedKermesMenus().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
