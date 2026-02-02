/**
 * Add Postal Codes to Organizations
 * Quick fix: Add postal codes for major German cities
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Firebase Admin SDK initialization
const serviceAccountPath = './admin_portal/service-account.json';
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ service-account.json bulunamadı!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Major German cities with postal codes (first postal code of each city)
const CITY_POSTAL_CODES: Record<string, string> = {
    'Aachen': '52062',
    'Achim': '28832',
    'Ahlen': '59227',
    'Berlin': '10115',
    'Bielefeld': '33602',
    'Bocholt': '46395',
    'Bochum': '44787',
    'Bonn': '53111',
    'Bottrop': '46236',
    'Bremen': '28195',
    'Cologne': '50667',
    'Köln': '50667',
    'Dortmund': '44135',
    'Duisburg': '47051',
    'Düren': '52349',
    'Düsseldorf': '40210',
    'Essen': '45127',
    'Frankfurt am Main': '60311',
    'Frankfurt': '60311',
    'Gelsenkirchen': '45879',
    'Hagen': '58095',
    'Hamburg': '20095',
    'Hamm': '59063',
    'Hannover': '30159',
    'Herne': '44623',
    'Hückelhoven': '41836',
    'Iserlohn': '58636',
    'Kleve': '47533',
    'Krefeld': '47798',
    'Leverkusen': '51373',
    'Lünen': '44532',
    'Marl': '45768',
    'Mönchengladbach': '41061',
    'Moers': '47441',
    'Mülheim an der Ruhr': '45468',
    'München': '80331',
    'Münster': '48143',
    'Neuss': '41460',
    'Oberhausen': '46045',
    'Recklinghausen': '45657',
    'Remscheid': '42853',
    'Siegen': '57072',
    'Solingen': '42651',
    'Stuttgart': '70173',
    'Wanne-Eickel': '44649',
    'Wattenscheid': '44866',
    'Wuppertal': '42103',
};

async function addPostalCodes() {
    console.log('📮 Adding postal codes to organizations...\n');

    try {
        const organizationsRef = db.collection('organizations');
        const snapshot = await organizationsRef.get();

        let updateCount = 0;
        const batch = db.batch();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const city = data.city;

            if (city && CITY_POSTAL_CODES[city]) {
                const postalCode = CITY_POSTAL_CODES[city];
                batch.update(doc.ref, { postalCode });
                console.log(`✅ ${city} → ${postalCode}`);
                updateCount++;
            } else {
                console.log(`⚠️  ${city} → No postal code found`);
            }
        }

        if (updateCount > 0) {
            await batch.commit();
            console.log(`\n🎉 Updated ${updateCount} organizations with postal codes!`);
        } else {
            console.log('\n⚠️  No organizations to update.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addPostalCodes();
