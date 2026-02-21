const fs = require('fs');
const path = require('path');

const transDir = path.join(__dirname, 'assets/translations');
const phase1Trans = JSON.parse(fs.readFileSync('phase1_translations_all.json', 'utf8'));

const languages = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of languages) {
    const filePath = path.join(transDir, `${lang}.json`);
    if (fs.existsSync(filePath)) {
        let current = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Merge the new 'widgets' section
        if (!current.widgets) {
            current.widgets = {};
        }

        const newTranslations = phase1Trans[lang];
        for (const [key, value] of Object.entries(newTranslations)) {
            current.widgets[key] = value;
        }

        fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
        console.log(`Updated ${lang}.json`);
    } else {
        console.warn(`${lang}.json not found!`);
    }
}
