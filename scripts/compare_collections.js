/**
 * Firebase Collection Comparison Script
 * 
 * Bu script Node.js ile çalıştırılmalı:
 * GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node compare_collections.js
 */

const admin = require('firebase-admin');

// Initialize with default credentials (requires GOOGLE_APPLICATION_CREDENTIALS env var)
admin.initializeApp({
    projectId: 'aylar-a45af'
});

const db = admin.firestore();

async function compareCollections() {
    console.log('Firebase koleksiyonları karşılaştırılıyor...\n');

    const businessesSnap = await db.collection('businesses').get();
    const butcherPartnersSnap = await db.collection('butcher_partners').get();

    const businessIds = new Map();
    businessesSnap.docs.forEach(d => {
        businessIds.set(d.id, d.data().companyName);
    });

    const partnerIds = new Map();
    butcherPartnersSnap.docs.forEach(d => {
        partnerIds.set(d.id, d.data().companyName);
    });

    console.log('=== KARŞILAŞTIRMA ===');
    console.log('businesses kayıt sayısı:', businessesSnap.size);
    console.log('butcher_partners kayıt sayısı:', butcherPartnersSnap.size);

    console.log('\n=== SADECE businesses\'da OLANLAR ===');
    let onlyBusinesses = 0;
    for (const [id, name] of businessIds) {
        if (!partnerIds.has(id)) {
            console.log(`  ${id} - ${name}`);
            onlyBusinesses++;
        }
    }
    console.log(`Toplam: ${onlyBusinesses}`);

    console.log('\n=== HER İKİSİNDE DE OLANLAR (DUPLICATE) ===');
    let duplicates = 0;
    for (const [id, name] of businessIds) {
        if (partnerIds.has(id)) {
            console.log(`  ${id} - ${name}`);
            duplicates++;
        }
    }
    console.log(`Toplam: ${duplicates}`);

    console.log('\n=== SADECE butcher_partners\'da OLANLAR ===');
    let onlyPartners = 0;
    for (const [id, name] of partnerIds) {
        if (!businessIds.has(id)) {
            console.log(`  ${id} - ${name}`);
            onlyPartners++;
        }
    }
    console.log(`Toplam: ${onlyPartners}`);

    console.log('\n=== SONUÇ ===');
    console.log(`businesses'dan butcher_partners'a taşınması gereken: ${onlyBusinesses}`);
    console.log(`Her iki koleksiyonda da olan (silinebilir): ${duplicates}`);

    process.exit(0);
}

compareCollections().catch(err => {
    console.error('Hata:', err);
    process.exit(1);
});
