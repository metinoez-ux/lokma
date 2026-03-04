// Seed script: Create default kasap menu template in Firestore
// Run: node scripts/seedDefaultMenuTemplates.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccount.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const KASAP_TEMPLATE = {
    type: 'kasap',
    name: 'Kasap Varsayılan Menü',
    description: 'Helal kasap işletmeleri için standart kategori şablonu',
    createdAt: new Date(),
    updatedAt: new Date(),
    categories: [
        { name: { tr: 'Dana Eti', de: 'Rindfleisch', en: 'Beef' }, icon: '🥩', order: 0 },
        { name: { tr: 'Kuzu / Koyun Eti', de: 'Lamm-/Schaffleisch', en: 'Lamb' }, icon: '🐑', order: 1 },
        { name: { tr: 'Kıyma', de: 'Hackfleisch', en: 'Ground Meat' }, icon: '🔴', order: 2 },
        { name: { tr: 'Tavuk', de: 'Hähnchen', en: 'Chicken' }, icon: '🍗', order: 3 },
        { name: { tr: 'Hindi', de: 'Truthahn', en: 'Turkey' }, icon: '🦃', order: 4 },
        { name: { tr: 'Sucuk & Pastırma', de: 'Sucuk & Pastırma', en: 'Sucuk & Pastırma' }, icon: '🌭', order: 5 },
        { name: { tr: 'Mangal & Izgara', de: 'Grill & BBQ', en: 'BBQ & Grill' }, icon: '🔥', order: 6 },
        { name: { tr: 'Sakatat', de: 'Innereien', en: 'Offal' }, icon: '🫀', order: 7 },
        { name: { tr: 'Hazır & Pişirilmiş', de: 'Fertiggerichte', en: 'Ready-to-Cook' }, icon: '🍖', order: 8 },
        { name: { tr: 'Şarküteri', de: 'Aufschnitt', en: 'Deli' }, icon: '🧆', order: 9 },
    ],
};

async function seed() {
    try {
        console.log('📋 Seeding defaultMenuTemplates/kasap...');
        await db.doc('defaultMenuTemplates/kasap').set(KASAP_TEMPLATE);
        console.log('✅ Kasap template seeded successfully with', KASAP_TEMPLATE.categories.length, 'categories');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding template:', error);
        process.exit(1);
    }
}

seed();
