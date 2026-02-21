const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'lib/screens');

const excludeDirs = [
    'staff', 'driver', 'orders'
];

const textRegex = /Text\(\s*(['"])(.*?)\1/g;
let extracted = [];

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (excludeDirs.includes(file)) continue;

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
                        });
                    }
                }
            }
        }
    }
}

scanDirectory(screensDir);

// Deduplicate
const uniqueStrings = [...new Set(extracted.map(e => e.string))];
console.log(`Found ${uniqueStrings.length} unique strings in Phase 4.`);
fs.writeFileSync('phase4_strings.json', JSON.stringify(uniqueStrings, null, 2));
