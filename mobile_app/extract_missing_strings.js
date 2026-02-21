const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else if (filePath.endsWith('.dart')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const targetDirs = [
    path.join(__dirname, 'lib/screens'),
    path.join(__dirname, 'lib/widgets')
];

let dartFiles = [];
targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        dartFiles = dartFiles.concat(walk(dir));
    }
});

let missingCount = 0;
const misses = {};

// Very simple heuristic for un-translated strings that usually contain Turkish characters or common words
const turkishTriggers = /[ğüşöçİĞÜŞÖÇ]|Tamam|İptal|Evet|Hayır|Lütfen|Sipariş|Kurye|Kasap|Restoran|Sepet|Profil|Kaydet|Ekle|Onayla|Kapat|Saat|Dakika|Gün|₺|TL/i;

dartFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        // Skip logs, print, and already translated ones
        if (line.includes('print(') || line.includes('log(') || line.includes('tr(')) return;

        // Find basic strings
        const strMatches = line.match(/(['"])(.*?)\1/g);
        if (strMatches) {
            strMatches.forEach(match => {
                const inner = match.substring(1, match.length - 1);
                // If it looks like user-facing text and contains Turkish or common words
                if (inner.length > 2 && turkishTriggers.test(inner)) {
                    if (!misses[file]) misses[file] = [];
                    misses[file].push({ line: index + 1, text: inner });
                    missingCount++;
                }
            });
        }
    });
});

console.log(`Found ${missingCount} potentially untranslated strings leaning towards Turkish:\n`);
let showed = 0;
for (const [file, items] of Object.entries(misses)) {
    console.log(`\n--- ${file.replace(__dirname + '/', '')} ---`);
    items.forEach(item => {
        console.log(`Line ${item.line}: "${item.text}"`);
        showed++;
    });
    if (showed > 150) {
        console.log(`\n... and ${missingCount - showed} more. (Truncated output)`);
        break;
    }
}
