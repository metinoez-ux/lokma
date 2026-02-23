const fs = require('fs');

const tr = JSON.parse(fs.readFileSync('messages/tr.json', 'utf8'));
const LANGUAGES = ['de', 'en', 'fr', 'it', 'es'];

function fixNode(node, trNode, path) {
    let changed = false;
    for (const key in trNode) {
        if (typeof trNode[key] === 'string') {
            if (typeof node[key] === 'object') {
                delete node[key]; // Wrong type
                changed = true;
            } else if (typeof node[key] === 'string' && node[key].startsWith('[')) {
                delete node[key]; // Placeholder
                changed = true;
            }
        } else if (typeof trNode[key] === 'object' && trNode[key] !== null) {
            if (typeof node[key] !== 'object' || node[key] === null) {
                node[key] = {};
                changed = true;
            }
            if (fixNode(node[key], trNode[key], path + key + '.')) {
                changed = true;
            }
        }
    }
    return changed;
}

for (const lang of LANGUAGES) {
    let langPath = `messages/${lang}.json`;
    let langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    
    if (fixNode(langData, tr, '')) {
        fs.writeFileSync(langPath, JSON.stringify(langData, null, 2));
        console.log(`Fixed types/placeholders in ${lang}.json`);
    } else {
        console.log(`${lang}.json is OK`);
    }
}
