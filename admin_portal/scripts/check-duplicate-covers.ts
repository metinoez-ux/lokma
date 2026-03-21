/**
 * Duplicate Cover Image Checker
 * Firestore'daki isletmelerin coverImageUrl degerlerini kontrol eder
 * ve ayni gorseli kullanan isletmeleri listeler.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = require('../serviceAccount.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkDuplicateCovers() {
    const snapshot = await db.collection('businesses').get();
    const urlMap: Record<string, { name: string; id: string; type: string }[]> = {};

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const url = data.coverImageUrl || '';
        const name = data.companyName || data.businessName || 'Unknown';
        const type = data.businessType || '';

        if (url) {
            if (!urlMap[url]) urlMap[url] = [];
            urlMap[url].push({ name, id: doc.id, type });
        }
    }

    console.log('\n=== Ayni Cover Image Kullanan Isletmeler ===\n');
    let dupeCount = 0;
    for (const [url, businesses] of Object.entries(urlMap)) {
        if (businesses.length > 1) {
            dupeCount++;
            console.log(`URL: ${url.substring(0, 80)}...`);
            for (const b of businesses) {
                console.log(`  - ${b.name} (${b.id}) [${b.type}]`);
            }
            console.log('');
        }
    }

    if (dupeCount === 0) {
        console.log('Duplicate yok!');
    }

    console.log(`\n=== Cover Resmi OLMAYAN Isletmeler ===\n`);
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const url = data.coverImageUrl || '';
        if (!url) {
            console.log(`  - ${data.companyName || 'Unknown'} (${doc.id}) [${data.businessType || ''}]`);
        }
    }

    process.exit(0);
}

checkDuplicateCovers().catch(err => { console.error(err); process.exit(1); });
