const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
        } else { 
            /* Is a file */
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');
let totalMatches = 0;
const trRegex = /[ğüşöçİĞÜŞÖÇ]/; // Simple check for TR chars
const turkishWords = ["İşletme", "Ekle", "Sil", "Düzenle", "İptal", "Kaydet", "Masa", "Sipariş", "Kurye", "Müşteri", "Başarılı", "Hata", "Lütfen", "Giriş", "Hesap"];

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let fileMatches = 0;
    
    lines.forEach((line, idx) => {
        // Exclude imports and comments
        if (line.trim().startsWith('import ') || line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
        
        let hasTrWord = turkishWords.some(w => line.includes(w));
        let hasTrChar = trRegex.test(line);
        // Exclude console.log
        if (line.includes('console.log') || line.includes('console.error')) return;
        
        // Count basic matches to gauge the size of the problem
        if (hasTrWord || hasTrChar) {
            fileMatches++;
            totalMatches++;
        }
    });
    if (fileMatches > 0) {
        console.log(`${file}: ${fileMatches} matches`);
    }
});
console.log(`Total approximate hardcoded lines found: ${totalMatches}`);
