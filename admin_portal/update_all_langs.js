const fs = require('fs');

const missingTR = JSON.parse(fs.readFileSync('messages/tr_updated.json', 'utf8'));

const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    
    // For each namespace in missingTR
    for (const ns in missingTR) {
        if (!langData[ns]) langData[ns] = {};
        
        for (const key in missingTR[ns]) {
            if (langData[ns][key] === undefined) {
                if (lang === 'tr') {
                    // Try to make the TR value look better
                    let val = key.replace(/_/g, ' ');
                    val = val.charAt(0).toUpperCase() + val.slice(1);
                    langData[ns][key] = val;
                } else {
                    let val = key.replace(/_/g, ' ');
                    val = val.charAt(0).toUpperCase() + val.slice(1);
                    langData[ns][key] = `[${lang.toUpperCase()}] ${val}`;
                }
            }
        }
    }
    
    // Sort keys
    const sortedLangData = {};
    Object.keys(langData).sort().forEach(ns => {
        sortedLangData[ns] = {};
        Object.keys(langData[ns]).sort().forEach(k => {
            sortedLangData[ns][k] = langData[ns][k];
        });
    });
    
    fs.writeFileSync(langPath, JSON.stringify(sortedLangData, null, 2));
    console.log(`Updated ${lang}.json`);
}

