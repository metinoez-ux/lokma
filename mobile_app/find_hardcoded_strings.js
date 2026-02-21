const fs = require('fs');
const path = require('path');

const DIRECTORIES = [
    path.join(__dirname, 'lib/screens'),
    path.join(__dirname, 'lib/widgets')
];

let foundStrings = new Set();
// Regex to catch Text('...') or Text("...") or Text( '...' )
const textRegex = /Text\(\s*(['"])(.*?)\1/g;

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
                // Ignore empty, purely numeric, or variables that start with $
                if (textStr.trim().length > 0 && !textStr.startsWith('$') && !textStr.includes('tr(')) {
                    // Check if it's purely symbolic or English-like keys (e.g. some_key)
                    if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(textStr) && !/^[a-z_]+$/.test(textStr)) {
                        foundStrings.add(textStr);
                    }
                }
            }
        }
    }
}

DIRECTORIES.forEach(scanDirectory);

const sorted = Array.from(foundStrings).sort();
fs.writeFileSync('hardcoded_strings_report.txt', sorted.join('\n'));
console.log(`Found ${sorted.length} unique hardcoded strings in Text() widgets.`);
