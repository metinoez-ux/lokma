const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const trJsonPath = path.join(__dirname, 'messages', 'tr.json');

// Flatten JSON to dot-notation
function flattenObject(ob) {
    var toReturn = {};
    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) continue;
        if ((typeof ob[i]) == 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
            var flatObject = flattenObject(ob[i]);
            for (var x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                toReturn[i + '.' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}

const trData = JSON.parse(fs.readFileSync(trJsonPath, 'utf8'));
const flatTr = flattenObject(trData);

function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findFiles(fullPath, fileList);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const allFiles = findFiles(srcDir);
const missingKeys = [];

for (const file of allFiles) {
    const code = fs.readFileSync(file, 'utf8');
    
    // Find namespaces used in useTranslations
    // Example: const t = useTranslations('AdminPortal.Orders')
    // We try to capture all t, tRes, tArr assignments
    const namespaceRegex = /(?:const|let|var)\s+({[^}]+}|[a-zA-Z0-9_]+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    const namespaces = [];
    while ((match = namespaceRegex.exec(code)) !== null) {
        const varName = match[1]; // could be 't', 'tRes', or '{ t }'
        const ns = match[2];
        namespaces.push({ varName, ns });
    }
    
    // Default to 'Global' or root if we can't parse or if it's just t('X')
    // Actually, next-intl useTranslations without arg defaults to root.

    // Regex to find t('some.key') or tRes('some.key')
    // Extracts the function name and the string literal
    const tCallRegex = /([a-zA-Z0-9_]+)\(\s*['"]([^'"]+)['"]/g;
    
    let tMatch;
    while ((tMatch = tCallRegex.exec(code)) !== null) {
        const funcName = tMatch[1];
        const key = tMatch[2];
        
        // Skip common false positives like console.log('...'), useState('...'), etc.
        if (!funcName.startsWith('t')) continue;
        
        // Find matching namespace
        let ns = '';
        for (const n of namespaces) {
             if (n.varName === funcName || n.varName.includes(funcName)) {
                 ns = n.ns;
                 break;
             }
        }
        
        const fullKey = ns ? `${ns}.${key}` : key;
        
        // If it looks like a translation string (not just generic variable)
        // Let's check if it exists in flatTr
        if (!flatTr.hasOwnProperty(fullKey) && !flatTr.hasOwnProperty(key)) {
            // Also it might be a dynamic key ending partially, we skip those if they end with . like 'reasons.'
            if (key.endsWith('.')) continue;
            
            missingKeys.push({
                file: file.replace(__dirname, ''),
                func: funcName,
                key: key,
                fullKey: fullKey
            });
        }
    }
}

// Remove duplicates based on fullKey
const uniqueMissing = [];
const seen = new Set();
for (const item of missingKeys) {
    if (!seen.has(item.fullKey)) {
        seen.add(item.fullKey);
        uniqueMissing.push(item);
    }
}

console.log(`Found ${uniqueMissing.length} potentially missing keys in Admin Portal Codebase:`);
uniqueMissing.forEach(item => {
    console.log(`- ${item.fullKey} (used in ${item.file})`);
});

fs.writeFileSync('missing_i18n_report.json', JSON.stringify(uniqueMissing, null, 2));
