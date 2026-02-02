// VIKZ Dernek Scraper - Gerçek isimler ve detaylarla
// node scripts/scrape-vikz.js

const https = require('https');
const http = require('http');
const { URL } = require('url');

const ALPHABET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w'];

async function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'de,en;q=0.9'
            }
        };

        client.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Şehir listesini çıkar
function extractCities(html) {
    // Pattern: /de/gemeinden/ort/SEHIR_ADI/anfangsbuchstabe_ort/X.html
    const cities = [];
    const pattern = /\/de\/gemeinden\/ort\/([^\/]+)\/anfangsbuchstabe_ort\/[a-z]\.html/g;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const city = decodeURIComponent(match[1]);
        if (!cities.includes(city)) {
            cities.push(city);
        }
    }
    return cities;
}

// Dernek detaylarını çıkar
function extractOrganizations(html, city) {
    const orgs = [];

    // HTML'den dernek bilgilerini parse et
    // Pattern: dernek adı, adres, posta kodu, şehir, telefon, email

    // Dernek adları genellikle "...e.V." veya "...Verein..." içerir
    const blocks = html.split(/(?=(?:Integrations|Islamische|Kultur|Bildungs|Verein))/i);

    for (const block of blocks) {
        // Dernek ismi ara
        const nameMatch = block.match(/^([^<\n]+(?:e\.V\.|Verein|Kulturzentrum|Gemeinde)[^<\n]*)/i);
        if (!nameMatch) continue;

        const name = nameMatch[1].trim();
        if (name.length < 10) continue;

        // Adres bilgileri
        const streetMatch = block.match(/(?:str\.|straße|weg|platz|allee)\s*\.?\s*\d+[a-z]?/i) ||
            block.match(/([A-Za-zäöüÄÖÜß\-]+(?:str\.|straße|weg))\s*\.?\s*\d+/i);

        const postalMatch = block.match(/\b(\d{5})\b/);
        const phoneMatch = block.match(/(\d{4,5}\s*\d{5,7})/);
        const emailMatch = block.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

        const org = {
            name: name,
            city: city,
            postalCode: postalMatch ? postalMatch[1] : '',
            street: streetMatch ? streetMatch[0] : '',
            phone: phoneMatch ? phoneMatch[1] : '',
            email: emailMatch ? emailMatch[1] : '',
        };

        // Tekrar kontrolü
        if (!orgs.some(o => o.name === org.name)) {
            orgs.push(org);
        }
    }

    return orgs;
}

async function main() {
    console.log('🕌 VIKZ Dernek Scraper başlatılıyor...\n');

    const allOrgs = [];
    const allCities = [];

    // Her harf için şehirleri al
    for (const letter of ALPHABET) {
        const url = `https://www.vikz.de/de/gemeinden/anfangsbuchstabe_ort/${letter}.html`;
        console.log(`📚 ${letter.toUpperCase()} harfi taranıyor...`);

        try {
            const html = await fetchPage(url);
            const cities = extractCities(html);
            console.log(`   ✓ ${cities.length} şehir bulundu: ${cities.slice(0, 5).join(', ')}${cities.length > 5 ? '...' : ''}`);

            for (const city of cities) {
                if (!allCities.includes(city)) {
                    allCities.push(city);
                }
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 200));
        } catch (err) {
            console.error(`   ❌ Hata: ${err.message}`);
        }
    }

    console.log(`\n📍 Toplam ${allCities.length} şehir bulundu\n`);

    // Her şehir için detayları al
    let processed = 0;
    for (const city of allCities) {
        const encodedCity = encodeURIComponent(city);
        const firstLetter = city.charAt(0).toLowerCase().replace(/[äáà]/g, 'a').replace(/[öóò]/g, 'o').replace(/[üúù]/g, 'u');
        const url = `https://www.vikz.de/de/gemeinden/ort/${encodedCity}/anfangsbuchstabe_ort/${firstLetter}.html`;

        try {
            const html = await fetchPage(url);
            const orgs = extractOrganizations(html, city);

            if (orgs.length > 0) {
                allOrgs.push(...orgs);
                process.stdout.write(`\r🏛️ ${++processed}/${allCities.length} | ${allOrgs.length} dernek bulundu`);
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 150));
        } catch (err) {
            // Skip errors
        }
    }

    console.log(`\n\n✅ Toplam ${allOrgs.length} dernek bulundu!\n`);

    // JSON çıktısı
    const output = {
        scraped_at: new Date().toISOString(),
        total_cities: allCities.length,
        total_organizations: allOrgs.length,
        cities: allCities,
        organizations: allOrgs
    };

    // Dosyaya yaz
    const fs = require('fs');
    fs.writeFileSync('vikz-organizations.json', JSON.stringify(output, null, 2));
    console.log('💾 Sonuçlar vikz-organizations.json dosyasına kaydedildi');

    // İlk 10 örnek göster
    console.log('\n📋 Örnek dernekler:');
    allOrgs.slice(0, 10).forEach((org, i) => {
        console.log(`${i + 1}. ${org.name} (${org.city}, ${org.postalCode})`);
    });
}

main().catch(console.error);
