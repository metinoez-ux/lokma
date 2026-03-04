const fs = require('fs');
const Papa = require('papaparse');

const csvPath = '/Users/metinoz/Downloads/lokma_translations.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');

const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

function unflattenObject(flatObj) {
    const result = {};
    for (const key in flatObj) {
        if (flatObj.hasOwnProperty(key)) {
            const parts = key.split('.');
            let current = result;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {};
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = flatObj[key];
        }
    }
    return result;
}

Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
        const parsedData = results.data;
        const flatDocumentsByLang = {};
        LANGUAGES.forEach(lang => { flatDocumentsByLang[lang] = {}; });

        parsedData.forEach(row => {
            const ns = row.Namespace || row.namespace;
            const k = row.Key || row.key;

            if (!ns || !k) return;

            const fullKey = ns === 'Global' ? k : `${ns}.${k}`;

            LANGUAGES.forEach(lang => {
                const val = row[lang.toUpperCase()] || row[lang];
                if (val !== undefined) {
                    flatDocumentsByLang[lang][fullKey] = val;
                }
            });
        });

        LANGUAGES.forEach(lang => {
            const unflattened = unflattenObject(flatDocumentsByLang[lang]);
            const targetPath = `./messages/${lang}.json`;
            fs.writeFileSync(targetPath, JSON.stringify(unflattened, null, 2));
            console.log(`Wrote unflattened JSON to ${targetPath}`);
        });
    }
});
