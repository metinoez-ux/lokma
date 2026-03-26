const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const locales = ['tr', 'en', 'de', 'nl', 'fr', 'es', 'it'];
const missingReportPath = path.join(__dirname, 'missing_i18n_report.json');

if (!fs.existsSync(missingReportPath)) {
    console.error("Missing keys report not found. Run audit_i18n.js first.");
    process.exit(1);
}

const missingKeys = JSON.parse(fs.readFileSync(missingReportPath, 'utf8'));

// Helper to capitalize phrase
function formatRawKeyToTitle(str) {
    if (!str) return "Bilinmeyen";
    return str
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// 1. Extract ALL fallbacks from codebase to build a dictionary of Key -> Fallback
const fallbackDict = {};

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getFiles(fullPath, fileList);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const allFiles = getFiles(srcDir);
for (const file of allFiles) {
    const code = fs.readFileSync(file, 'utf8');
    
    // Attempt to match: t('some.key') || 'My String'  AND t(`some.key`) || 'My String'
    const fallbackRegex = /([a-zA-Z0-9_]+)\(\s*[`'"]([^`'"]+)[`'"]\s*\)\s*\|\|\s*['"]([^'"]+)['"]/g;
    let fbMatch;
    while ((fbMatch = fallbackRegex.exec(code)) !== null) {
        const key = fbMatch[2];
        const fallback = fbMatch[3];
        // We might not know the full namespace here, so we store by the literal key string
        // E.g. "cancelModal.reasons.outOfStock" -> "Tükendi"
        fallbackDict[key] = fallback;
    }
}

console.log(`Sourced ${Object.keys(fallbackDict).length} explicit fallback definitions from TSX code.`);

// 2. Prepare patches for the JSON files
const patches = [];

// Helper to determine the text to inject
missingKeys.forEach(item => {
    // 1. Try to find an explicit fallback mapped to this item's specific literal key
    let resolvedText = fallbackDict[item.key];

    // 2. Try the fullKey just in case
    if (!resolvedText && fallbackDict[item.fullKey]) {
        resolvedText = fallbackDict[item.fullKey];
    }
    
    // 3. Fallback to title-cased key fragment (e.g. hazirlanmayi_bekliyor -> Hazirlanmayi Bekliyor)
    if (!resolvedText) {
        const parts = item.key.split('.');
        resolvedText = formatRawKeyToTitle(parts[parts.length - 1]);
    }
    
    patches.push({
        fullKey: item.fullKey,
        text: resolvedText
    });
});

console.log(`Prepared ${patches.length} translation patches for injection.`);

// 3. Inject into all supported languages
locales.forEach(loc => {
    const jsonPath = path.join(__dirname, 'messages', `${loc}.json`);
    if (!fs.existsSync(jsonPath)) return;

    let data;
    try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        console.error(`Failed to parse ${loc}.json`);
        return;
    }

    let injectedCount = 0;

    for (const patch of patches) {
        const { fullKey, text } = patch;
        
        const keyParts = fullKey.split('.');
        const lastPart = keyParts.pop();
        
        let target = data;
        for (const part of keyParts) {
             target[part] = typeof target[part] === 'object' && target[part] !== null ? target[part] : {};
             target = target[part];
        }

        // Only inject if it doesn't already exist or it was stored as the raw key name
        if (!target[lastPart] || target[lastPart] === lastPart || target[lastPart] === fullKey) {
             target[lastPart] = text;
             injectedCount++;
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Injected ${injectedCount} missing items into ${loc}.json`);
});
