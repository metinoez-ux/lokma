const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const targetDir = 'src/app/[locale]/admin';
if (!fs.existsSync(targetDir)) {
    console.error('Directory not found');
    process.exit(1);
}

const files = walkDir(targetDir);

files.forEach(file => {
    let original = fs.readFileSync(file, 'utf8');
    let content = original;

    // 1. Fix the main wrapper bug where the whole page inherited white text!
    content = content.replace(/bg-background text-white/g, 'bg-background text-foreground');
    content = content.replace(/text-white bg-background/g, 'text-foreground bg-background');

    // 2. Fix the chips bug matching exactly what is in Benutzerverwaltung:
    // "bg-gray-700 text-foreground"
    content = content.replace(
        /className="(.*?)bg-gray-700 text-foreground(.*)"/g,
        'className="$1bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100$2"'
    );

    // 3. Just in case it's specifically bg-gray-700 without text-foreground but expects white
    content = content.replace(
        /className="bg-gray-700 text-xs/g,
        'className="bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 text-xs'
    );

    if (content !== original) {
        fs.writeFileSync(file, content);
    }
});

console.log('Fixed contrast bugs across all modular admin pages!');
