const fs = require('fs');

const missingTR = JSON.parse(fs.readFileSync('messages/tr_updated.json', 'utf8'));
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    let updatedCount = 0;

    for (const ns in missingTR) {
        if (!langData[ns]) langData[ns] = {};
        for (const key in missingTR[ns]) {
            if (langData[ns][key] === undefined) {
                if (lang === 'tr') {
                    langData[ns][key] = missingTR[ns][key];
                } else {
                    langData[ns][key] = `[${lang.toUpperCase()}] ${missingTR[ns][key]}`;
                }
                updatedCount++;
            }
        }
    }

    // Create sorted version
    const sortedLangData = {};
    Object.keys(langData).sort().forEach(ns => {
        sortedLangData[ns] = {};
        Object.keys(langData[ns]).sort().forEach(k => {
            sortedLangData[ns][k] = langData[ns][k];
        });
    });

    fs.writeFileSync(langPath, JSON.stringify(sortedLangData, null, 2));
    console.log(`Updated ${langPath} with ${updatedCount} entries.`);
}
