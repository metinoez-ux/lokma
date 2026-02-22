const fs = require('fs');

const LANGUAGES = ['en', 'de', 'fr', 'it', 'es'];
const sleep = ms => new Promise(res => setTimeout(res, ms));

async function fetchTranslation(text, targetLang) {
    if (!text || text.trim() === '') return text;
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data[0].map(item => item[0]).join('');
    } catch (e) {
        return null;
    }
}

async function runSingleTranslations() {
    const trData = JSON.parse(fs.readFileSync('messages/tr.json', 'utf8'));
    const allKeys = [];
    for (const ns in trData) {
        for (const key in trData[ns]) {
            allKeys.push({ ns, key, text: trData[ns][key] });
        }
    }

    for (const lang of LANGUAGES) {
        console.log(`\nStarting cleanup for ${lang.toUpperCase()} `);
        let langPath = `messages/${lang}.json`;
        let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));

        const keysToTranslate = allKeys.filter(item => {
            const currentVal = langData[item.ns] && langData[item.ns][item.key];
            return typeof currentVal === 'string' && currentVal.startsWith(`[${lang.toUpperCase()}] `);
        });

        console.log(`Found ${keysToTranslate.length} remaining prefixed keys for ${lang.toUpperCase()}`);

        let translatedCount = 0;

        for (let i = 0; i < keysToTranslate.length; i++) {
            const item = keysToTranslate[i];

            const result = await fetchTranslation(item.text, lang);
            if (result) {
                if (!langData[item.ns]) langData[item.ns] = {};
                langData[item.ns][item.key] = result.replace(/^\[[A-Z]+\]\s*/, '');
                translatedCount++;
            }
            if (i % 20 === 0) console.log(`  Progress: ${i + 1}/${keysToTranslate.length}`);

            await sleep(100);
        }

        const sortedLangData = {};
        Object.keys(langData).sort().forEach(ns => {
            sortedLangData[ns] = {};
            Object.keys(langData[ns]).sort().forEach(k => {
                sortedLangData[ns][k] = langData[ns][k];
            });
        });

        fs.writeFileSync(langPath, JSON.stringify(sortedLangData, null, 2));
        console.log(`Successfully cleaned up ${translatedCount} items for ${lang}.json`);
    }

    console.log("\nCleanup Complete!");
}

runSingleTranslations();
