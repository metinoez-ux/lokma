const fs = require('fs');
const path = require('path');

const transDir = path.join(__dirname, 'assets/translations');
const phase3Trans = JSON.parse(fs.readFileSync('phase3_translations_merged.json', 'utf8'));

const languages = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of languages) {
    const filePath = path.join(transDir, `${lang}.json`);
    if (fs.existsSync(filePath)) {
        let current = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const newTranslations = phase3Trans[lang];
        if (newTranslations) {
            for (const [domain, keysObj] of Object.entries(newTranslations)) {
                if (!current[domain]) {
                    current[domain] = {};
                }

                // Merge keys
                for (const [k, v] of Object.entries(keysObj)) {
                    current[domain][k] = v;
                }
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
        console.log(`Updated Phase 3 in ${lang}.json`);
    } else {
        console.warn(`${lang}.json not found!`);
    }
}
