const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = './src';
const MESSAGES_FILE = './messages/tr.json';

const trData = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
const missingTranslations = [];

const files = glob.sync(`${SRC_DIR}/**/*.{tsx,ts}`);

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    let currentNamespaces = {}; // variableName -> namespace
    const useTransRegex = /(?:const|let|var)\s*(?:\{\s*([a-zA-Z0-9_]+)\s*\}|([a-zA-Z0-9_]+))\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    while ((match = useTransRegex.exec(content)) !== null) {
        const varName = match[1] || match[2];
        const namespace = match[3];
        currentNamespaces[varName || 't'] = namespace;
    }
    
    const tRegex = /\b([a-zA-Z0-9_]+)(?:\.rich)?\(\s*['"]([^'"]+)['"]/g;
    
    while ((match = tRegex.exec(content)) !== null) {
        const callerName = match[1];
        const key = match[2];
        
        if (currentNamespaces[callerName]) {
            const namespace = currentNamespaces[callerName];
            
            if (!trData[namespace] || trData[namespace][key] === undefined) {
                missingTranslations.push({
                    file: file,
                    namespace: namespace,
                    key: key
                });
            }
        }
    }
});

const missingMap = {};
missingTranslations.forEach(item => {
    if (!missingMap[item.namespace]) missingMap[item.namespace] = new Set();
    missingMap[item.namespace].add(item.key);
});

let missingCount = 0;
for (const ns in missingMap) {
    console.log(`\nNamespace: ${ns}`);
    Array.from(missingMap[ns]).forEach(k => {
        missingCount++;
        console.log(`  - ${k}`);
    });
}

console.log(`\nFound ${missingCount} missing translations.`);

const outputJson = { ...trData };
for (const ns in missingMap) {
    if (!outputJson[ns]) outputJson[ns] = {};
    Array.from(missingMap[ns]).forEach(k => {
        if (outputJson[ns][k] === undefined) {
            let readable = k.replace(/_/g, ' ');
            readable = readable.charAt(0).toUpperCase() + readable.slice(1);
            outputJson[ns][k] = readable;
        }
    });
}

fs.writeFileSync('messages/tr_updated.json', JSON.stringify(outputJson, null, 2));
console.log('Saved preliminary matches to messages/tr_updated.json');
