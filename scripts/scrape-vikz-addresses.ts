/**
 * VIKZ Organizasyon Adres Scraper ve Firestore Import
 * 
 * 285 doğrulanmış VIKZ organizasyonu için adres bilgilerini çekip
 * Firestore'a kaydeder.
 * 
 * Kullanım:
 * export FIREBASE_SERVICE_ACCOUNT_KEY=$(cat admin_portal/.env.local | grep FIREBASE_SERVICE_ACCOUNT_KEY | cut -d= -f2-)
 * npx ts-node scripts/scrape-vikz-addresses.ts
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

// 285 Doğrulanmış VIKZ Organizasyonu (şehir + first letter için URL yapısı)
const ORGANIZATIONS = [
    // A
    { city: "Aachen", letter: "a" },
    { city: "Achim", letter: "a" },
    { city: "Ahaus", letter: "a" },
    { city: "Ahlen", letter: "a" },
    { city: "Alsdorf", letter: "a" },
    { city: "Altensteig", letter: "a" },
    { city: "Amberg", letter: "a" },
    { city: "Aschaffenburg", letter: "a" },
    { city: "Augsburg", letter: "a" },
    // B
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
    // C
    { city: "Coburg", letter: "c" },
    // D
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
    // E
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
    // F
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
    // G
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
    // H
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
    // I
    { city: "Ibbenbüren", letter: "i" },
    { city: "Ingolstadt", letter: "i" },
    { city: "Iserlohn", letter: "i" },
    // J
    { city: "Jettingen", letter: "j" },
    // K
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
    // L
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
    // M
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
    // N
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
    // O
    { city: "Oberhausen", letter: "o" },
    { city: "Oberndorf", letter: "o" },
    { city: "Ochsenhausen", letter: "o" },
    { city: "Oelde", letter: "o" },
    { city: "Oer Erkenschwick", letter: "o" },
    { city: "Offenbach", letter: "o" },
    { city: "Osnabrück", letter: "o" },
    // P
    { city: "Pforzheim", letter: "p" },
    { city: "Pfullendorf", letter: "p" },
    { city: "Pirmasens", letter: "p" },
    { city: "Plettenberg", letter: "p" },
    // Q
    { city: "Quierschied", letter: "q" },
    // R
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
    // S
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
    // T
    { city: "Tuttlingen", letter: "t" },
    // U
    { city: "Ulm", letter: "u" },
    { city: "Unterheinriet", letter: "u" },
    // V
    { city: "Vechta", letter: "v" },
    { city: "Velbert", letter: "v" },
    { city: "Völklingen", letter: "v" },
    // W
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

interface ScrapedOrg {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    phone: string;
    email: string;
}

async function fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'de,en;q=0.9'
        }
    });
    return response.text();
}

function decodeHtmlEntities(text: string): string {
    // Decode HTML entities like &#109;&#97;... to proper text
    return text.replace(/&#x?([0-9a-fA-F]+);/g, (_, code) => {
        const num = code.startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
        return String.fromCharCode(num);
    });
}

function extractOrganizations(html: string): ScrapedOrg[] {
    const orgs: ScrapedOrg[] = [];

    // Extract vereinsname (org name)
    const nameMatch = html.match(/<p class="field vereinsname">([^<]+)<\/p>/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // Extract street (class="field" without specific class)
    const streetMatch = html.match(/<p class="field">([^<]+(?:str|Str|weg|Weg|platz|Platz|allee|Allee)[^<]*\d+[^<]*)<\/p>/i) ||
        html.match(/<p class="field">([^<]*\d+[^<]*)<\/p>/);
    const street = streetMatch ? streetMatch[1].trim() : '';

    // Extract PLZ
    const plzMatch = html.match(/<p class="field plz">(\d{5})<\/p>/);
    const postalCode = plzMatch ? plzMatch[1] : '';

    // Extract city
    const cityMatch = html.match(/<p class="field ort">([^<]+)<\/p>/);
    const city = cityMatch ? cityMatch[1].trim() : '';

    // Extract phone
    const phoneMatch = html.match(/<p class="field telefonnummer">([^<]+)<\/p>/);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';

    // Extract email
    const emailMatch = html.match(/<p class="field email">.*?>([^<]+)<\/a>/);
    const email = emailMatch ? decodeHtmlEntities(emailMatch[1].trim()) : '';

    if (name || postalCode) {
        orgs.push({ name, street, postalCode, city, phone, email });
    }

    return orgs;
}

async function main() {
    console.log('🕌 VIKZ Adres Scraper & Firestore İmport Başlıyor...\n');

    const allOrgs: ScrapedOrg[] = [];
    let success = 0;
    let failed = 0;

    for (const org of ORGANIZATIONS) {
        const encodedCity = encodeURIComponent(org.city);
        const url = `https://www.vikz.de/de/gemeinden/anfangsbuchstabe_ort/${org.letter}/ort/${encodedCity}.html`;

        try {
            const html = await fetchPage(url);
            const scraped = extractOrganizations(html);

            if (scraped.length > 0 && scraped[0].postalCode) {
                allOrgs.push(...scraped);
                process.stdout.write(`\r✅ ${++success}/${ORGANIZATIONS.length} | ${org.city}: ${scraped[0].postalCode}`);
            } else {
                console.log(`\n⚠️  ${org.city}: Bilgi bulunamadı`);
                failed++;
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 150));
        } catch (error) {
            console.log(`\n❌ ${org.city}: ${error}`);
            failed++;
        }
    }

    console.log(`\n\n📊 Sonuç: ${allOrgs.length} organizasyon scrape edildi\n`);

    // Firestore'a kaydet
    console.log('💾 Firestore güncelleniyor...\n');

    const organizationsRef = db.collection('organizations');
    let updated = 0;

    for (const scrapedOrg of allOrgs) {
        // Firestore'da eşleşen organizasyonu bul (şehir + isim benzerliği)
        const snapshot = await organizationsRef
            .where('city', '==', scrapedOrg.city)
            .get();

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // İsim benzerliğini kontrol et veya aynı şehirdeki tek organizasyon
            if (snapshot.size === 1 ||
                data.name?.includes(scrapedOrg.name.split(' ')[0]) ||
                scrapedOrg.name.includes(data.name?.split(' ')[0] || '')) {

                await doc.ref.update({
                    postalCode: scrapedOrg.postalCode || data.postalCode || '',
                    address: scrapedOrg.street || data.address || '',
                    phone: scrapedOrg.phone || data.phone || '',
                    email: scrapedOrg.email || data.email || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`✅ ${doc.id}: PLZ=${scrapedOrg.postalCode}, Tel=${scrapedOrg.phone}`);
                updated++;
                break;
            }
        }
    }

    console.log(`\n🎉 Tamamlandı!`);
    console.log(`✅ Güncellenen: ${updated}`);
    console.log(`❌ Başarısız: ${failed}`);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Hata:', err);
        process.exit(1);
    });
