/**
 * VIKZ Organizasyon Adres Scraper ve Firestore Import v2
 * 
 * HER şehirden TÜM organizasyonları ayrı ayrı çeker ve
 * Firestore'daki doğru doc ile isim benzerliğine göre eşleştirir.
 * 
 * Kullanım:
 * export FIREBASE_SERVICE_ACCOUNT_KEY="$(grep FIREBASE_SERVICE_ACCOUNT_KEY admin_portal/.env.local | cut -d= -f2-)"
 * node scripts/scrape-vikz-addresses-v2.js
 */

const admin = require('firebase-admin');

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

// Şehirler ve harfler
const CITIES = [
    { city: "Aachen", letter: "a" },
    { city: "Achim", letter: "a" },
    { city: "Ahaus", letter: "a" },
    { city: "Ahlen", letter: "a" },
    { city: "Alsdorf", letter: "a" },
    { city: "Altensteig", letter: "a" },
    { city: "Amberg", letter: "a" },
    { city: "Aschaffenburg", letter: "a" },
    { city: "Augsburg", letter: "a" },
    { city: "Bad Saulgau", letter: "b" },
    { city: "Bad Wurzach", letter: "b" },
    { city: "Baesweiler", letter: "b" },
    { city: "Bamberg", letter: "b" },
    { city: "Bayreuth", letter: "b" },
    { city: "Bendorf", letter: "b" },
    { city: "Bergheim", letter: "b" },
    { city: "Bergisch Gladbach", letter: "b" },
    { city: "Bergkamen", letter: "b" },
    { city: "Berlin", letter: "b" },
    { city: "Biberach an der Riß", letter: "b" },
    { city: "Bielefeld", letter: "b" },
    { city: "Bocholt", letter: "b" },
    { city: "Bochum", letter: "b" },
    { city: "Bonn", letter: "b" },
    { city: "Bottrop", letter: "b" },
    { city: "Braunschweig", letter: "b" },
    { city: "Bremen", letter: "b" },
    { city: "Bremerhaven", letter: "b" },
    { city: "Brühl", letter: "b" },
    { city: "Buchen", letter: "b" },
    { city: "Böhmenkirch", letter: "b" },
    { city: "Bönen", letter: "b" },
    { city: "Coburg", letter: "c" },
    { city: "Darmstadt", letter: "d" },
    { city: "Datteln", letter: "d" },
    { city: "Deggendorf", letter: "d" },
    { city: "Delmenhorst", letter: "d" },
    { city: "Dinslaken", letter: "d" },
    { city: "Donzdorf", letter: "d" },
    { city: "Dormagen", letter: "d" },
    { city: "Dorsten", letter: "d" },
    { city: "Dortmund", letter: "d" },
    { city: "Duisburg", letter: "d" },
    { city: "Düren", letter: "d" },
    { city: "Düsseldorf", letter: "d" },
    { city: "Ebersbach", letter: "e" },
    { city: "Ehingen", letter: "e" },
    { city: "Elmshorn", letter: "e" },
    { city: "Emsdetten", letter: "e" },
    { city: "Ennepetal", letter: "e" },
    { city: "Eppelheim", letter: "e" },
    { city: "Erding", letter: "e" },
    { city: "Eschweiler", letter: "e" },
    { city: "Essen", letter: "e" },
    { city: "Esslingen", letter: "e" },
    { city: "Euskirchen", letter: "e" },
    { city: "Flehingen", letter: "f" },
    { city: "Flensburg", letter: "f" },
    { city: "Frankenthal", letter: "f" },
    { city: "Frankfurt", letter: "f" },
    { city: "Freiburg", letter: "f" },
    { city: "Frickhofen", letter: "f" },
    { city: "Friedberg", letter: "f" },
    { city: "Friedrichshafen", letter: "f" },
    { city: "Fulda", letter: "f" },
    { city: "Furtwangen", letter: "f" },
    { city: "Fürth", letter: "f" },
    { city: "Garmisch-Partenkirchen", letter: "g" },
    { city: "Geislingen", letter: "g" },
    { city: "Gelsenkirchen", letter: "g" },
    { city: "Germersheim", letter: "g" },
    { city: "Giengen", letter: "g" },
    { city: "Giessen", letter: "g" },
    { city: "Gladbeck", letter: "g" },
    { city: "Glückstadt", letter: "g" },
    { city: "Gotha", letter: "g" },
    { city: "Grevenbroich", letter: "g" },
    { city: "Groß-Gerau", letter: "g" },
    { city: "Göppingen", letter: "g" },
    { city: "Günzburg", letter: "g" },
    { city: "Gütersloh", letter: "g" },
    { city: "Hagen", letter: "h" },
    { city: "Hallbergmoos", letter: "h" },
    { city: "Hamburg", letter: "h" },
    { city: "Hamm", letter: "h" },
    { city: "Hanau", letter: "h" },
    { city: "Hannover", letter: "h" },
    { city: "Harsewinkel", letter: "h" },
    { city: "Hattingen", letter: "h" },
    { city: "Heide", letter: "h" },
    { city: "Herford", letter: "h" },
    { city: "Herne", letter: "h" },
    { city: "Herrenberg", letter: "h" },
    { city: "Herten", letter: "h" },
    { city: "Hof", letter: "h" },
    { city: "Homburg", letter: "h" },
    { city: "Höchst ODW.", letter: "h" },
    { city: "Höhr-Grenzhausen", letter: "h" },
    { city: "Hövels", letter: "h" },
    { city: "Hückelhoven", letter: "h" },
    { city: "Ibbenbüren", letter: "i" },
    { city: "Ingolstadt", letter: "i" },
    { city: "Iserlohn", letter: "i" },
    { city: "Jettingen", letter: "j" },
    { city: "Kaiserslautern", letter: "k" },
    { city: "Kamen", letter: "k" },
    { city: "Kamp-Lintfort", letter: "k" },
    { city: "Karlsruhe", letter: "k" },
    { city: "Karlstadt", letter: "k" },
    { city: "Kassel", letter: "k" },
    { city: "Kaufbeuren", letter: "k" },
    { city: "Kempten", letter: "k" },
    { city: "Kiel", letter: "k" },
    { city: "Kirchheim-Teck", letter: "k" },
    { city: "Kirchheimbolanden", letter: "k" },
    { city: "Koblenz", letter: "k" },
    { city: "Krefeld", letter: "k" },
    { city: "Köln", letter: "k" },
    { city: "Kösching", letter: "k" },
    { city: "Landau a.d.Isar", letter: "l" },
    { city: "Laupheim", letter: "l" },
    { city: "Leinfelden - Echterdingen", letter: "l" },
    { city: "Leverkusen", letter: "l" },
    { city: "Limburg", letter: "l" },
    { city: "Ludwigshafen", letter: "l" },
    { city: "Löhne", letter: "l" },
    { city: "Lörrach", letter: "l" },
    { city: "Lübeck", letter: "l" },
    { city: "Lüdenscheid", letter: "l" },
    { city: "Lünen", letter: "l" },
    { city: "Maintal", letter: "m" },
    { city: "Mainz", letter: "m" },
    { city: "Mannheim", letter: "m" },
    { city: "Marienheide", letter: "m" },
    { city: "Marl", letter: "m" },
    { city: "Memmingen", letter: "m" },
    { city: "Meschede", letter: "m" },
    { city: "Michelstadt", letter: "m" },
    { city: "Moers", letter: "m" },
    { city: "Mosbach", letter: "m" },
    { city: "Munderkingen", letter: "m" },
    { city: "Mönchengladbach", letter: "m" },
    { city: "Mühlacker", letter: "m" },
    { city: "Mühlheim", letter: "m" },
    { city: "Mülheim an der Ruhr", letter: "m" },
    { city: "München", letter: "m" },
    { city: "Münster", letter: "m" },
    { city: "Neckarsulm", letter: "n" },
    { city: "Nettetal", letter: "n" },
    { city: "Neu-Ulm", letter: "n" },
    { city: "Neuburg a.d. Donau", letter: "n" },
    { city: "Neufahrn bei Freising", letter: "n" },
    { city: "Neumünster", letter: "n" },
    { city: "Neuss", letter: "n" },
    { city: "Neustadt", letter: "n" },
    { city: "Neuwied", letter: "n" },
    { city: "Nienburg", letter: "n" },
    { city: "Norderstedt", letter: "n" },
    { city: "Nürnberg", letter: "n" },
    { city: "Oberhausen", letter: "o" },
    { city: "Oberndorf", letter: "o" },
    { city: "Ochsenhausen", letter: "o" },
    { city: "Oelde", letter: "o" },
    { city: "Oer Erkenschwick", letter: "o" },
    { city: "Offenbach", letter: "o" },
    { city: "Osnabrück", letter: "o" },
    { city: "Pforzheim", letter: "p" },
    { city: "Pfullendorf", letter: "p" },
    { city: "Pirmasens", letter: "p" },
    { city: "Plettenberg", letter: "p" },
    { city: "Quierschied", letter: "q" },
    { city: "Radevormald", letter: "r" },
    { city: "Rastatt", letter: "r" },
    { city: "Recklinghausen", letter: "r" },
    { city: "Regensburg", letter: "r" },
    { city: "Reinheim", letter: "r" },
    { city: "Remscheid", letter: "r" },
    { city: "Rheine", letter: "r" },
    { city: "Rietberg", letter: "r" },
    { city: "Rosenheim", letter: "r" },
    { city: "Rudersberg", letter: "r" },
    { city: "Saarbrücken", letter: "s" },
    { city: "Salzgitter", letter: "s" },
    { city: "Schloss-Holte", letter: "s" },
    { city: "Schrobenhausen", letter: "s" },
    { city: "Schwalmstadt", letter: "s" },
    { city: "Schweinfurt", letter: "s" },
    { city: "Schwerte", letter: "s" },
    { city: "Schwäbisch Gmünd", letter: "s" },
    { city: "Senden", letter: "s" },
    { city: "Sindelfingen", letter: "s" },
    { city: "Sinn", letter: "s" },
    { city: "Solingen", letter: "s" },
    { city: "St.Ingbert", letter: "s" },
    { city: "Stadtallendorf", letter: "s" },
    { city: "Starnberg", letter: "s" },
    { city: "Stolberg", letter: "s" },
    { city: "Stuttgart", letter: "s" },
    { city: "Tuttlingen", letter: "t" },
    { city: "Ulm", letter: "u" },
    { city: "Unterheinriet", letter: "u" },
    { city: "Vechta", letter: "v" },
    { city: "Velbert", letter: "v" },
    { city: "Völklingen", letter: "v" },
    { city: "Wahlstedt", letter: "w" },
    { city: "Waldbröl", letter: "w" },
    { city: "Waltrop", letter: "w" },
    { city: "Wannweil", letter: "w" },
    { city: "Wedel", letter: "w" },
    { city: "Weiden", letter: "w" },
    { city: "Werdohl", letter: "w" },
    { city: "Werne", letter: "w" },
    { city: "Wesel", letter: "w" },
    { city: "Wetzlar", letter: "w" },
    { city: "Wiesbaden", letter: "w" },
    { city: "Wittlich", letter: "w" },
    { city: "Wuppertal", letter: "w" },
    { city: "Würzburg", letter: "w" },
];

function decodeHtmlEntities(text) {
    // Decode hex entities: &#x6D; -> m
    let decoded = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });
    // Decode decimal entities: &#109; -> m
    decoded = decoded.replace(/&#(\d+);/g, (_, dec) => {
        return String.fromCharCode(parseInt(dec, 10));
    });
    return decoded;
}

/**
 * Bir şehir sayfasından TÜM organizasyonları çıkarır
 * Her organizasyonun ayrı ayrı isim, adres, telefon, email bilgisini döner
 */
function extractAllOrganizations(html, cityName) {
    const orgs = [];

    // Her org vereinsname ile başlıyor, split by vereinsname
    const parts = html.split(/<p class="field vereinsname">/);

    for (let i = 1; i < parts.length; i++) {
        const block = parts[i];

        // Extract name (first text before </p>)
        const nameMatch = block.match(/^([^<]+)<\/p>/);
        const name = nameMatch ? nameMatch[1].trim() : '';

        // Extract street (first field without specific class after vereinsname)
        const streetMatch = block.match(/<p class="field">([^<]+)<\/p>/);
        const street = streetMatch ? streetMatch[1].trim() : '';

        // Extract PLZ
        const plzMatch = block.match(/<p class="field plz">(\d{5})<\/p>/);
        const postalCode = plzMatch ? plzMatch[1] : '';

        // Extract city
        const cityMatch = block.match(/<p class="field ort">([^<]+)<\/p>/);
        const city = cityMatch ? cityMatch[1].trim() : cityName;

        // Extract phone
        const phoneMatch = block.match(/<p class="field telefonnummer">([^<]+)<\/p>/);
        const phone = phoneMatch ? phoneMatch[1].trim() : '';

        // Extract email
        const emailMatch = block.match(/<p class="field email">.*?>([^<]+)<\/a>/);
        const email = emailMatch ? decodeHtmlEntities(emailMatch[1].trim()) : '';

        if (name && postalCode) {
            orgs.push({ name, street, postalCode, city, phone, email });
        }
    }

    return orgs;
}

/**
 * İsim benzerliği hesapla (basit)
 * İki string arasındaki ortak kelime sayısına bakar
 */
function nameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;

    const words1 = name1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = name2.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    let matches = 0;
    for (const w1 of words1) {
        for (const w2 of words2) {
            if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
                matches++;
                break;
            }
        }
    }

    return matches / Math.max(words1.length, words2.length, 1);
}

async function main() {
    console.log('🕌 VIKZ Adres Scraper v2 - Çoklu Organizasyon Desteği\n');

    const allOrgs = [];
    let citiesProcessed = 0;

    // Her şehir için TÜM organizasyonları çek
    for (const cityInfo of CITIES) {
        const encodedCity = encodeURIComponent(cityInfo.city);
        const url = `https://www.vikz.de/de/gemeinden/anfangsbuchstabe_ort/${cityInfo.letter}/ort/${encodedCity}.html`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            const html = await response.text();
            const orgs = extractAllOrganizations(html, cityInfo.city);

            if (orgs.length > 0) {
                allOrgs.push(...orgs);
                process.stdout.write(`\r✅ ${++citiesProcessed}/${CITIES.length} | ${cityInfo.city}: ${orgs.length} org`);
            } else {
                console.log(`\n⚠️  ${cityInfo.city}: Org bulunamadı`);
            }

            await new Promise(r => setTimeout(r, 100));
        } catch (error) {
            console.log(`\n❌ ${cityInfo.city}: ${error.message}`);
        }
    }

    console.log(`\n\n📊 Toplam ${allOrgs.length} organizasyon scrape edildi\n`);

    // Şimdi Firestore'daki her organizasyonu bul ve eşleştir
    console.log('💾 Firestore güncelleniyor (isim eşleştirmesi ile)...\n');

    const organizationsRef = db.collection('organizations');
    const allDocs = await organizationsRef.get();

    let updated = 0;
    let notFound = 0;

    for (const doc of allDocs.docs) {
        const firestoreData = doc.data();
        const firestoreName = firestoreData.name || '';
        const firestoreCity = firestoreData.city || '';

        // Aynı şehirdeki scrape edilmiş organizasyonları bul
        const cityOrgs = allOrgs.filter(o =>
            o.city.toLowerCase() === firestoreCity.toLowerCase()
        );

        if (cityOrgs.length === 0) {
            notFound++;
            continue;
        }

        // İsim benzerliğine göre en iyi eşleşmeyi bul
        let bestMatch = null;
        let bestScore = 0;

        for (const org of cityOrgs) {
            const score = nameSimilarity(org.name, firestoreName);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = org;
            }
        }

        // Eğer şehirde tek org varsa veya iyi bir eşleşme varsa güncelle
        if (cityOrgs.length === 1 || bestScore >= 0.3) {
            const orgToUse = cityOrgs.length === 1 ? cityOrgs[0] : bestMatch;

            if (orgToUse) {
                const updateData = {
                    postalCode: orgToUse.postalCode,
                    address: orgToUse.street,
                    phone: orgToUse.phone,
                    email: orgToUse.email,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                // İsmi de güncelle (eğer farklıysa)
                if (orgToUse.name && orgToUse.name !== firestoreName) {
                    updateData.name = orgToUse.name;
                }

                await doc.ref.update(updateData);
                console.log(`✅ ${doc.id}: ${orgToUse.name} | ${orgToUse.street}, ${orgToUse.postalCode}`);
                updated++;

                // Kullanılan org'u listeden çıkar (tekrar eşleşmesin)
                const idx = allOrgs.indexOf(orgToUse);
                if (idx > -1) allOrgs.splice(idx, 1);
            }
        } else {
            console.log(`⚠️  ${doc.id}: Eşleşme bulunamadı (${firestoreName})`);
            notFound++;
        }
    }

    console.log(`\n🎉 Tamamlandı!`);
    console.log(`✅ Güncellenen: ${updated}`);
    console.log(`⚠️  Eşleşmeyen: ${notFound}`);
}

main().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
