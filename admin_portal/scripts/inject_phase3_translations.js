const fs = require('fs');
const path = require('path');

const extractMapPath = path.join(__dirname, '../phase3_extract.json');
if (!fs.existsSync(extractMapPath)) {
    console.error("Missing extract map!");
    process.exit(1);
}

const extractedData = JSON.parse(fs.readFileSync(extractMapPath, 'utf8'));
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

console.log("Starting Phase 3 Translation Injection...");

for (const lang of LANGUAGES) {
    const langFilePath = path.join(__dirname, `../messages/${lang}.json`);
    let langData = {};
    if (fs.existsSync(langFilePath)) {
        langData = JSON.parse(fs.readFileSync(langFilePath, 'utf8'));
    }

    let injectedCount = 0;

    for (const ns in extractedData) {
        if (!langData[ns]) {
            langData[ns] = {};
        }

        const nsDict = extractedData[ns];
        for (const key in nsDict) {
            if (langData[ns][key] === undefined) {
                // If TR, inject the actual Turkish string.
                // Otherwise, wrap in a [LANG] marker so translators know.
                langData[ns][key] = lang === 'tr' ? nsDict[key] : `[${lang.toUpperCase()}] ${nsDict[key]}`;
                injectedCount++;
            }
        }
    }

    // Sort the namespaces and keys for cleanliness
    const sortedLangData = {};
    Object.keys(langData).sort().forEach(ns => {
        sortedLangData[ns] = {};
        Object.keys(langData[ns]).sort().forEach(key => {
            sortedLangData[ns][key] = langData[ns][key];
        });
    });

    fs.writeFileSync(langFilePath, JSON.stringify(sortedLangData, null, 2));
    console.log(`Injected ${injectedCount} missing translations into ${lang}.json`);
}

console.log("Phase 3 Injection Completed!");
