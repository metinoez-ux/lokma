const fs = require('fs');

const strings = JSON.parse(fs.readFileSync('business_strings.json', 'utf8'));
const map = {};

const TR_MAP = {
    'ı': 'i', 'İ': 'i',
    'ğ': 'g', 'Ğ': 'g',
    'ü': 'u', 'Ü': 'u',
    'ş': 's', 'Ş': 's',
    'ö': 'o', 'Ö': 'o',
    'ç': 'c', 'Ç': 'c'
};

function toCamelCase(str) {
    // Basic cleanup
    let s = str.replace(/[\n\r]+/g, ' ').trim();
    
    // Replace TR chars
    s = s.replace(/[ıİğĞüÜşŞöÖçÇ]/g, match => TR_MAP[match]);
    
    // Remove non-alphanumeric except spaces
    s = s.replace(/[^a-zA-Z0-9 ]/g, '');
    
    // Convert to camelCase
    const words = s.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 'key' + Math.floor(Math.random() * 10000);
    
    let key = words[0].toLowerCase();
    for (let i = 1; i < Math.min(words.length, 6); i++) { // Max 6 words for key
        key += words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase();
    }
    return key;
}

const keySet = new Set();
const trJson = {};

for (const str of strings) {
    let baseKey = toCamelCase(str);
    let key = baseKey;
    let counter = 1;
    while (keySet.has(key)) {
        key = baseKey + counter;
        counter++;
    }
    keySet.add(key);
    map[str] = key;
    trJson[key] = str;
}

fs.writeFileSync('business_map.json', JSON.stringify(map, null, 2));
fs.writeFileSync('business_tr.json', JSON.stringify(trJson, null, 2));

console.log('Generated mapping for', Object.keys(map).length, 'strings.');
