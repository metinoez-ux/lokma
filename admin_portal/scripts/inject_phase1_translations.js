const fs = require('fs');
const path = require('path');

const extractMapFile = path.join(__dirname, '..', 'phase1_extract.json');
const messagesDir = path.join(__dirname, '..', 'messages');
const locales = ['tr', 'en', 'de', 'nl', 'fr', 'es', 'it'];

if (!fs.existsSync(extractMapFile)) {
    console.error(`Not found: ${extractMapFile}`);
    process.exit(1);
}

const extractMap = JSON.parse(fs.readFileSync(extractMapFile, 'utf8'));

locales.forEach(locale => {
    const localeFile = path.join(messagesDir, `${locale}.json`);
    let localeData = {};

    if (fs.existsSync(localeFile)) {
        localeData = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
    }

    for (const [ns, kv] of Object.entries(extractMap)) {
        if (!localeData[ns]) {
            localeData[ns] = {};
        }

        for (const [originalText, key] of Object.entries(kv)) {
            // If the key doesn't exist yet
            if (!localeData[ns][key]) {
                // By default put the Turkish text in. The translators will fix it later.
                localeData[ns][key] = originalText;
            }
        }
    }

    fs.writeFileSync(localeFile, JSON.stringify(localeData, null, 2));
    console.log(`Injected translations to ${localeFile}`);
});

console.log('Done injecting Phase 1 translations.');
