/**
 * VIKZ Organizasyon Adres Güncelleme Script'i
 * 
 * Firestore'daki 285 VIKZ organizasyonu için Google Places API ile
 * adres, telefon ve koordinat bilgilerini çeker ve günceller.
 * 
 * Kullanım:
 * 1. .env.local'de GOOGLE_PLACES_API_KEY ayarlayın
 * 2. npx ts-node scripts/update-org-addresses.ts
 */

import * as admin from 'firebase-admin';

// Firebase Admin SDK
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY bulunamadı!');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
});

const db = admin.firestore();

// Google Places API key
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY bulunamadı!');
    console.error('Lütfen .env.local dosyasına ekleyin: GOOGLE_PLACES_API_KEY=your_key_here');
    process.exit(1);
}

interface PlaceResult {
    postalCode: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
}

async function fetchPlaceDetails(orgName: string, city: string): Promise<PlaceResult> {
    try {
        // 1. Text Search ile place_id bul
        const searchQuery = `${orgName} ${city} Germany`;
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`;

        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.status !== 'OK' || !searchData.results?.[0]) {
            console.log(`   ⚠️  Place bulunamadı: ${orgName}`);
            return { postalCode: '', address: '', phone: '', lat: 0, lng: 0 };
        }

        const place = searchData.results[0];
        const placeId = place.place_id;

        // 2. Place Details ile detaylı bilgi al
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,formatted_phone_number,address_components,geometry&key=${GOOGLE_API_KEY}`;

        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        if (detailsData.status !== 'OK') {
            console.log(`   ⚠️  Detay alınamadı: ${orgName}`);
            return { postalCode: '', address: '', phone: '', lat: 0, lng: 0 };
        }

        const details = detailsData.result;

        // Posta kodu çıkar
        let postalCode = '';
        if (details.address_components) {
            for (const component of details.address_components) {
                if (component.types.includes('postal_code')) {
                    postalCode = component.long_name;
                    break;
                }
            }
        }

        return {
            postalCode: postalCode || '',
            address: details.formatted_address || '',
            phone: details.formatted_phone_number || '',
            lat: details.geometry?.location?.lat || 0,
            lng: details.geometry?.location?.lng || 0,
        };

    } catch (error) {
        console.error(`   ❌ Hata (${orgName}):`, error);
        return { postalCode: '', address: '', phone: '', lat: 0, lng: 0 };
    }
}

async function updateOrganizations() {
    console.log('🕌 VIKZ Organizasyon Adreslerini Güncelleme Başlıyor...\n');

    // Tüm organizasyonları çek
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`✅ ${orgsSnapshot.size} organizasyon bulundu\n`);

    let updated = 0;
    let failed = 0;

    for (const doc of orgsSnapshot.docs) {
        const org = doc.data();
        const orgName = org.name || org.shortName;
        const city = org.city;

        console.log(`📍 ${orgName} (${city})`);

        // Eğer zaten adres varsa skip et
        if (org.postalCode && org.address && org.phone) {
            console.log('   ✓ Adres mevcut, atlanıyor\n');
            continue;
        }

        // Google Places'den bilgi çek
        const placeInfo = await fetchPlaceDetails(orgName, city);

        if (!placeInfo.postalCode && !placeInfo.address && !placeInfo.phone) {
            console.log('   ❌ Bilgi bulunamadı\n');
            failed++;
            continue;
        }

        // Firestore'u güncelle
        await doc.ref.update({
            postalCode: placeInfo.postalCode || org.postalCode || '',
            address: placeInfo.address || org.address || '',
            phone: placeInfo.phone || org.phone || '',
            lat: placeInfo.lat || org.lat || null,
            lng: placeInfo.lng || org.lng || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`   ✅ Güncellendi:`);
        console.log(`      PLZ: ${placeInfo.postalCode}`);
        console.log(`      Adres: ${placeInfo.address}`);
        console.log(`      Tel: ${placeInfo.phone}\n`);

        updated++;

        // Rate limiting - Google API quota için
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms bekle
    }

    console.log('\n🎉 Tamamlandı!');
    console.log(`✅ Güncellenen: ${updated}`);
    console.log(`❌ Başarısız: ${failed}`);
    console.log(`📊 Toplam: ${orgsSnapshot.size}`);
}

// Script'i çalıştır
updateOrganizations()
    .then(() => {
        console.log('\n✨ Script başarıyla tamamlandı!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script hatası:', error);
        process.exit(1);
    });
