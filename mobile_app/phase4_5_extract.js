const fs = require('fs');
const path = require('path');

const targetDirs = [
    path.join(__dirname, 'lib/screens/marketplace'),
    path.join(__dirname, 'lib/screens/home'),
    path.join(__dirname, 'lib/screens/customer')
];

const textRegex = /Text\(\s*(['"])(.*?)\1/g;
let extracted = [];

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
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
                        });
                    }
                }
            }
        }
    }
}

targetDirs.forEach(scanDirectory);

// Deduplicate
const uniqueStrings = [...new Set(extracted.map(e => e.string))];
console.log(`Found ${uniqueStrings.length} unique strings in Phase 4.5.`);
fs.writeFileSync('phase4_5_strings.json', JSON.stringify(uniqueStrings, null, 2));
