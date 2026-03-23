const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walkDir('src/app/[locale]/admin');
let themeViolations = [];
let i18nViolations = [];

files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    
    // Check for hardcoded bg-white without dark: matcher
    let bgWhiteMatch = code.match(/className="[^"]*bg-white(?![^"]*dark:)[^"]*"/g);
    if (bgWhiteMatch) {
       themeViolations.push({ file, issue: 'bg-white without dark variant', hits: bgWhiteMatch.length });
    }

    let textBlackMatch = code.match(/className="[^"]*text-black(?![^"]*dark:)[^"]*"/g);
    if (textBlackMatch) {
       themeViolations.push({ file, issue: 'text-black without dark variant', hits: textBlackMatch.length });
    }

    // Check for raw German/Turkish text inside JSX tags.
    // E.g. >Speichern< or >Aktion<
    let rawText = code.match(/>\s*([A-ZÄÖÜ][a-öA-Ö0-9\s,&:-]{3,})\s*</g);
    if (rawText) {
        let filtered = rawText.map(t => t.replace(/[><]/g, '').trim()).filter(t => !t.includes('{') && !t.includes('}'));
        if (filtered.length > 5) {
            i18nViolations.push({ file, hits: filtered.length, examples: filtered.slice(0, 3).join(' | ') });
        }
    }
});

console.log("\n=== THEME VIOLATIONS (Top 10) ===");
console.table(themeViolations.slice(0, 10));
console.log(`Total Files with Theme Issues: ${themeViolations.length}`);

console.log("\n=== I18N VIOLATIONS (Potential Raw Text - Top 10) ===");
console.table(i18nViolations.slice(0, 10));
console.log(`Total Files with Potential i18n Issues: ${i18nViolations.length}`);
