const fs = require('fs');

const rawStrings = JSON.parse(fs.readFileSync('extras_strings.json', 'utf8'));

function generateKey(str) {
    let key = str.replace(/['"]/g, '')
        .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .map(word => {
            word = word.toLowerCase();
            const trMap = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
            return word.replace(/[çğıöşü]/g, m => trMap[m]);
        })
        .join(' ');

    return key.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

const map = {};
const trTranslations = {};
const existingKeys = new Set();

for (const originalString of Object.keys(rawStrings)) {
    let baseKey = generateKey(originalString);
    if (!baseKey) baseKey = 'text';

    let uniqueKey = baseKey;
    let counter = 1;
    while (existingKeys.has(uniqueKey)) {
        uniqueKey = `${baseKey}${counter}`;
        counter++;
    }

    existingKeys.add(uniqueKey);
    map[originalString] = uniqueKey;
    trTranslations[uniqueKey] = originalString;
}

fs.writeFileSync('extras_map.json', JSON.stringify(map, null, 2));
fs.writeFileSync('extras_tr.json', JSON.stringify(trTranslations, null, 2));

console.log(`Generated ${Object.keys(map).length} keys for AdminExtras namespace.`);
