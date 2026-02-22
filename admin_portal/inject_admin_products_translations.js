const fs = require('fs');

const trJson = JSON.parse(fs.readFileSync('products_tr.json', 'utf8'));
const languages = ['en', 'de', 'fr', 'it', 'es', 'tr'];

for (const lang of languages) {
    const filePath = `messages/${lang}.json`;
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(fileContent);

        if (!json.AdminProducts) {
            json.AdminProducts = {};
        }

        // Just copy the Turkish strings as placeholders for EN/DE/FR/IT/ES
        // The LOKMA team translates missing strings via Firestore Admin in production
        for (const [key, trString] of Object.entries(trJson)) {
            // Keep existing translation if it exists, otherwise use TR String payload
            if (!json.AdminProducts[key]) {
                json.AdminProducts[key] = trString;
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Injected AdminProducts into ${lang}.json`);
    } else {
        console.log(`Warning: ${filePath} not found`);
    }
}
