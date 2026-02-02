/**
 * VIKZ Organizasyon Adres Scraper ve Firestore Import (CommonJS)
 * 
 * Kullanım:
 * source admin_portal/.env.local && node scripts/scrape-vikz-addresses.js
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
const ORGANIZATIONS = [
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

function extractOrganizations(html) {
    const orgs = [];

    const nameMatch = html.match(/<p class="field vereinsname">([^<]+)<\/p>/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    const streetMatch = html.match(/<p class="field">([^<]+)<\/p>/);
    const street = streetMatch ? streetMatch[1].trim() : '';

    const plzMatch = html.match(/<p class="field plz">(\d{5})<\/p>/);
    const postalCode = plzMatch ? plzMatch[1] : '';

    const cityMatch = html.match(/<p class="field ort">([^<]+)<\/p>/);
    const city = cityMatch ? cityMatch[1].trim() : '';

    const phoneMatch = html.match(/<p class="field telefonnummer">([^<]+)<\/p>/);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';

    const emailMatch = html.match(/<p class="field email">.*?>([^<]+)<\/a>/);
    const email = emailMatch ? decodeHtmlEntities(emailMatch[1].trim()) : '';

    if (name || postalCode) {
        orgs.push({ name, street, postalCode, city, phone, email });
    }

    return orgs;
}

async function main() {
    console.log('🕌 VIKZ Adres Scraper & Firestore İmport Başlıyor...\n');

    const allOrgs = [];
    let success = 0;
    let failed = 0;

    for (const org of ORGANIZATIONS) {
        const encodedCity = encodeURIComponent(org.city);
        const url = `https://www.vikz.de/de/gemeinden/anfangsbuchstabe_ort/${org.letter}/ort/${encodedCity}.html`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            const html = await response.text();
            const scraped = extractOrganizations(html);

            if (scraped.length > 0 && scraped[0].postalCode) {
                allOrgs.push(scraped[0]);
                process.stdout.write(`\r✅ ${++success}/204 | ${org.city}: ${scraped[0].postalCode}`);
            } else {
                console.log(`\n⚠️  ${org.city}: Bilgi bulunamadı`);
                failed++;
            }

            await new Promise(r => setTimeout(r, 100));
        } catch (error) {
            console.log(`\n❌ ${org.city}: ${error.message}`);
            failed++;
        }
    }

    console.log(`\n\n📊 Sonuç: ${allOrgs.length} organizasyon scrape edildi\n`);

    // Firestore güncelle
    console.log('💾 Firestore güncelleniyor...\n');

    const organizationsRef = db.collection('organizations');
    let updated = 0;

    for (const scrapedOrg of allOrgs) {
        const snapshot = await organizationsRef.where('city', '==', scrapedOrg.city).get();

        for (const doc of snapshot.docs) {
            const updateData = {
                postalCode: scrapedOrg.postalCode,
                address: scrapedOrg.street,
                phone: scrapedOrg.phone,
                email: scrapedOrg.email,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Sadece gerçek isim varsa güncelle (VIKZ ile başlamayanlar)
            if (scrapedOrg.name && !scrapedOrg.name.startsWith('VIKZ')) {
                updateData.name = scrapedOrg.name;
            }

            await doc.ref.update(updateData);

            console.log(`✅ ${doc.id}: ${scrapedOrg.name || 'İsim yok'} | PLZ=${scrapedOrg.postalCode}`);
            updated++;
        }
    }

    console.log(`\n🎉 Tamamlandı! ${updated} organizasyon güncellendi`);
}

main().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
});
