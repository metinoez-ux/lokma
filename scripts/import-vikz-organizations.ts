/**
 * VIKZ Organizasyon Import Script
 * 
 * Bu script VIKZ.de'den tüm cami derneklerini (Verein) çekip
 * Firestore'a "organizations" collection olarak kaydeder.
 * 
 * Kullanım: npx ts-node scripts/import-vikz-organizations.ts
 */

import * as admin from 'firebase-admin';

// Firebase Admin SDK initialization from environment variable
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found!');
    console.log('Please run: export FIREBASE_SERVICE_ACCOUNT_KEY=$(cat admin_portal/.env.local | grep FIREBASE_SERVICE_ACCOUNT_KEY | cut -d= -f2-)');
    process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Organization interface
interface Organization {
    id?: string;
    name: string;                    // Dernek adı (örn: "Islamisches Kulturzentrum Hückelhoven")
    shortName?: string;              // Kısa ad (örn: "IKZ Hückelhoven")
    type: 'vikz' | 'ditib' | 'diyanet' | 'igmg' | 'bagimsiz' | 'other';
    city: string;                    // Şehir
    state?: string;                  // Eyalet (Landesverband)
    postalCode?: string;             // Posta kodu
    address?: string;                // Tam adres
    country: string;                 // Ülke (DE)
    phone?: string;
    email?: string;
    website?: string;
    sourceUrl?: string;              // Kaynak URL (VIKZ.de vb.)

    // Admin bilgileri
    adminIds?: string[];             // Firebase User IDs of admins
    primaryAdminId?: string;         // İşletme sahibi

    // Kermes bilgileri
    activeKermesIds?: string[];      // Aktif kermes IDs
    totalKermesCount?: number;       // Toplam yapılan kermes sayısı

    // Meta
    isActive: boolean;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
    importedFrom?: string;           // 'vikz.de', 'ditib.de', 'manual'
}

// A'dan Z'ye tüm harfler için VIKZ şehirlerini al
const ALPHABET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w'];

// Manuel VIKZ Cami listesi (web sitesinden alınan)
// Her dernek için şehir bazlı organizasyon oluşturulacak
const VIKZ_CITIES = [
    // A
    'Aachen', 'Achim', 'Ahaus', 'Ahlen', 'Alsdorf', 'Altensteig', 'Amberg', 'Aschaffenburg', 'Augsburg',
    // B  
    'Bad Hersfeld', 'Bad Salzuflen', 'Bamberg', 'Bayreuth', 'Beckum', 'Bergisch Gladbach', 'Bergkamen',
    'Berlin', 'Bielefeld', 'Bocholt', 'Bochum', 'Bonn', 'Borken', 'Bottrop', 'Braunschweig', 'Bremen', 'Bremerhaven', 'Brilon', 'Brühl',
    // C
    'Castrop-Rauxel', 'Celle', 'Cloppenburg', 'Coburg', 'Coesfeld',
    // D
    'Darmstadt', 'Delmenhorst', 'Detmold', 'Diepholz', 'Dinslaken', 'Dorsten', 'Dortmund', 'Duisburg', 'Düren', 'Düsseldorf',
    // E
    'Emden', 'Erftstadt', 'Erkelenz', 'Erlangen', 'Eschweiler', 'Essen', 'Esslingen',
    // F
    'Flensburg', 'Frankfurt am Main', 'Freiburg', 'Freising', 'Friedberg', 'Fürth', 'Fulda',
    // G
    'Gelsenkirchen', 'Gießen', 'Gladbeck', 'Göppingen', 'Göttingen', 'Gütersloh',
    // H
    'Hagen', 'Hamburg', 'Hamm', 'Hanau', 'Hannover', 'Heidelberg', 'Heilbronn', 'Helmstedt', 'Herne', 'Herten', 'Hilden', 'Hildesheim', 'Hückelhoven',
    // I
    'Ibbenbüren', 'Ingolstadt', 'Iserlohn',
    // J
    'Jena',
    // K
    'Kaiserslautern', 'Karlsruhe', 'Kassel', 'Kaufbeuren', 'Kempten', 'Kiel', 'Kleve', 'Koblenz', 'Köln', 'Krefeld',
    // L
    'Landau', 'Landshut', 'Langenfeld', 'Leverkusen', 'Limburg', 'Lingen', 'Lippstadt', 'Lübeck', 'Lüdenscheid', 'Ludwigshafen', 'Lünen',
    // M
    'Mainz', 'Mannheim', 'Marburg', 'Marl', 'Memmingen', 'Menden', 'Minden', 'Mönchengladbach', 'Moers', 'Mülheim an der Ruhr', 'München', 'Münster',
    // N
    'Neuss', 'Neustadt', 'Nürnberg',
    // O
    'Oberhausen', 'Offenbach', 'Offenburg', 'Oldenburg', 'Osnabrück',
    // P
    'Paderborn', 'Passau', 'Pforzheim', 'Pirmasens',
    // R
    'Rastatt', 'Ratingen', 'Ravensburg', 'Recklinghausen', 'Regensburg', 'Remscheid', 'Reutlingen', 'Rheda-Wiedenbrück', 'Rheine', 'Rosenheim', 'Rüsselsheim',
    // S
    'Saarbrücken', 'Salzgitter', 'Schwäbisch Gmünd', 'Schweinfurt', 'Schwerte', 'Siegen', 'Sindelfingen', 'Solingen', 'Speyer', 'Stuttgart',
    // T
    'Troisdorf', 'Tübingen', 'Tuttlingen',
    // U
    'Ulm', 'Unna',
    // V
    'Velbert', 'Viersen',
    // W
    'Waiblingen', 'Wanne-Eickel', 'Wattenscheid', 'Wesel', 'Wetzlar', 'Wiesbaden', 'Wilhelmshaven', 'Witten', 'Wolfsburg', 'Worms', 'Wuppertal', 'Würzburg',
];

async function getPostalCodeForCity(city: string): Promise<string> {
    try {
        // Use Google Places API to get postal code
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            console.warn('⚠️  No GOOGLE_PLACES_API_KEY found, skipping postal code for', city);
            return '';
        }

        const query = `${city}, Germany`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results?.[0]?.address_components) {
            for (const component of data.results[0].address_components) {
                if (component.types.includes('postal_code')) {
                    return component.long_name;
                }
            }
        }
        return '';
    } catch (error) {
        console.warn(`⚠️  Could not fetch postal code for ${city}:`, error);
        return '';
    }
}

async function importOrganizations() {
    console.log('🕌 VIKZ Organizasyonları Firestore\'a aktarılıyor...\n');

    const batch = db.batch();
    const organizationsRef = db.collection('organizations');
    let count = 0;

    for (const city of VIKZ_CITIES) {
        // Normalize city name for ID
        const cityId = city.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss');

        const docId = `vikz-${cityId}`;
        const docRef = organizationsRef.doc(docId);

        // Fetch postal code from Google Places API
        console.log(`📍 Fetching postal code for ${city}...`);
        const postalCode = await getPostalCodeForCity(city);

        if (postalCode) {
            console.log(`   ✅ ${city} → ${postalCode}`);
        } else {
            console.log(`   ⚠️  ${city} → No postal code found`);
        }

        const organization: Organization = {
            name: `Islamisches Kulturzentrum ${city}`,
            shortName: `IKZ ${city}`,
            type: 'vikz',
            city: city,
            postalCode: postalCode || undefined,
            country: 'DE',
            sourceUrl: `https://www.vikz.de/de/gemeinden/ort/${encodeURIComponent(city)}.html`,
            isActive: true,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            importedFrom: 'vikz.de',
            adminIds: [],
            activeKermesIds: [],
            totalKermesCount: 0,
        };

        batch.set(docRef, organization, { merge: true });
        count++;

        // Firestore batch limit is 500
        if (count % 400 === 0) {
            await batch.commit();
            console.log(`✅ ${count} organizasyon kaydedildi...`);
        }

        // Rate limit: Google Places API'yi çok hızlı çağırmamak için
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Commit remaining
    await batch.commit();
    console.log(`\n🎉 Toplam ${count} VIKZ organizasyonu başarıyla aktarıldı!`);

    // Also create some sample non-VIKZ organizations
    console.log('\n📍 Örnek bağımsız organizasyonlar ekleniyor...');

    const sampleOrgs = [
        {
            id: 'ditib-koeln',
            name: 'DITIB Türkisch Islamische Union Köln',
            shortName: 'DITIB Köln',
            type: 'ditib' as const,
            city: 'Köln',
            country: 'DE',
        },
        {
            id: 'igmg-duesseldorf',
            name: 'IGMG Düsseldorf',
            shortName: 'IGMG Düsseldorf',
            type: 'igmg' as const,
            city: 'Düsseldorf',
            country: 'DE',
        },
        {
            id: 'merkez-cami-hueckelhoven',
            name: 'Merkez Camii Derneği Hückelhoven',
            shortName: 'Merkez Cami Hückelhoven',
            type: 'bagimsiz' as const,
            city: 'Hückelhoven',
            country: 'DE',
        },
    ];

    for (const org of sampleOrgs) {
        const docRef = organizationsRef.doc(org.id);
        await docRef.set({
            ...org,
            isActive: true,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            importedFrom: 'manual',
            adminIds: [],
            activeKermesIds: [],
            totalKermesCount: 0,
        }, { merge: true });
    }

    console.log('✅ Örnek organizasyonlar eklendi.');
    console.log('\n🏁 İmport tamamlandı!');
    process.exit(0);
}

// Run
importOrganizations().catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
});
