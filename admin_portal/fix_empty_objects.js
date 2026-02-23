const fs = require('fs');

const LANGUAGES = ['de', 'en', 'fr', 'it', 'es'];

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    let changed = false;

    // We only added these keys at the root level in tr.json.
    // Let's check if any root level key is an empty object or starts with [LANG]
    for (const key in langData) {
        if (typeof langData[key] === 'object' && langData[key] !== null && Object.keys(langData[key]).length === 0) {
            delete langData[key];
            changed = true;
            console.log(`Deleted empty object "${key}" from ${lang}.json`);
        } else if (typeof langData[key] === 'string' && langData[key].startsWith(`[${lang.toUpperCase()}]`)) {
            delete langData[key];
            changed = true;
            console.log(`Deleted placeholder string "${key}" from ${lang}.json`);
        }
    }

    if (changed) {
        fs.writeFileSync(langPath, JSON.stringify(langData, null, 2));
    }
}
