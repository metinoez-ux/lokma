const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'lib/widgets');
const textRegex = /Text\(\s*(['"])(.*?)\1/g;
let extracted = [];

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath);
        } else if (fullPath.endsWith('.dart')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let match;
            while ((match = textRegex.exec(content)) !== null) {
                const textStr = match[2];
                if (textStr.trim().length > 0 && !textStr.startsWith('$') && !textStr.includes('tr(')) {
                    if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(textStr) && !/^[a-z_]+$/.test(textStr)) {
                        extracted.push({
                            file: fullPath,
                            string: textStr,
                            fullMatch: match[0],
                            quote: match[1]
                        });
                    }
                }
            }
        }
    }
}

scanDirectory(targetDir);

// Deduplicate
const uniqueStrings = [...new Set(extracted.map(e => e.string))];
console.log(`Found ${uniqueStrings.length} unique strings in Phase 1 (widgets).`);
fs.writeFileSync('phase1_strings.json', JSON.stringify(uniqueStrings, null, 2));

const translationsMap = {};
uniqueStrings.forEach((str, i) => {
    // Generate a simple key
    let key = str.toLowerCase()
        .replace(/[^a-zğüşıöç0-9 ]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .join('_');
    if (!key) key = `widget_str_${i}`;
    translationsMap[str] = `widgets.${key}`;
});
fs.writeFileSync('phase1_map.json', JSON.stringify(translationsMap, null, 2));
