const fs = require('fs');

const extractMapPath = './messages/tr.json';
const LANGUAGES = ['en', 'de', 'fr', 'it', 'es'];

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function fetchBulkTranslation(texts, targetLang) {
    if (!texts || texts.length === 0) return [];
    try {
        // join with \n 
        const combined = texts.join('\n');
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t&q=${encodeURIComponent(combined)}`;
        const response = await fetch(url);
        if (!response.ok) return texts.map(() => null);

        const data = await response.json();
        const translatedLines = [];
        if (data && data[0]) {
            let currentStr = "";
            for (let i = 0; i < data[0].length; i++) {
                // data[0][i][0] contains a logical segment. 
                // Sometimes google groups them. But it preserves \n if it was in the original.
                let segment = data[0][i][0];
                currentStr += segment;
            }
            let lines = currentStr.split('\n').map(s => s.trim());
            if (lines.length === texts.length) {
                return lines;
            } else {
                console.log("    [Warning] Batch length mismatch. Expected " + texts.length + " but got " + lines.length);
                // Fallback: translate one by one
                return texts.map(() => null);
            }
        }
        return texts.map(() => null);
    } catch (e) {
        return texts.map(() => null);
    }
}

async function runTranslations() {
    // Read TR file which serves as source of truth
    const trData = JSON.parse(fs.readFileSync('messages/tr.json', 'utf8'));
    const allKeys = [];
    for (const ns in trData) {
        for (const key in trData[ns]) {
            allKeys.push({ ns, key, text: trData[ns][key] });
        }
    }

    for (const lang of LANGUAGES) {
        console.log(`\n============================`);
        console.log(` Translating to ${lang.toUpperCase()} `);
        console.log(`============================`);

        let langPath = `messages/${lang}.json`;
        let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));

        const keysToTranslate = allKeys.filter(item => {
            const currentVal = langData[item.ns] && langData[item.ns][item.key];
            // If current val is missing OR starts with the placeholder prefix, we translate it.
            return !currentVal || (typeof currentVal === 'string' && currentVal.startsWith(`[${lang.toUpperCase()}] `));
        });

        console.log(`Need to translate ${keysToTranslate.length} keys for ${lang.toUpperCase()}`);

        const BATCH_SIZE = 40;
        let translatedCount = 0;

        for (let i = 0; i < keysToTranslate.length; i += BATCH_SIZE) {
            const chunk = keysToTranslate.slice(i, i + BATCH_SIZE);
            const texts = chunk.map(k => k.text);

            console.log(`  Processing batch ${i / BATCH_SIZE + 1} / ${Math.ceil(keysToTranslate.length / BATCH_SIZE)}...`);

            const results = await fetchBulkTranslation(texts, lang);

            for (let j = 0; j < chunk.length; j++) {
                const item = chunk[j];
                if (!langData[item.ns]) langData[item.ns] = {};

                // If the translation failed or array lengths mismatched, fallback
                if (results[j]) {
                    langData[item.ns][item.key] = results[j].replace(/^\[[A-Z]+\]\s*/, ''); // Ensure no prefix inside
                    translatedCount++;
                }
            }

            // Wait to avoid rate limit
            await sleep(300);
        }

        // Save
        const sortedLangData = {};
        Object.keys(langData).sort().forEach(ns => {
            sortedLangData[ns] = {};
            Object.keys(langData[ns]).sort().forEach(k => {
                sortedLangData[ns][k] = langData[ns][k];
            });
        });

        fs.writeFileSync(langPath, JSON.stringify(sortedLangData, null, 2));
        console.log(`Successfully translated ${translatedCount} items for ${lang}.json`);
    }

    console.log("\nDone translating all files!");
}

runTranslations();
