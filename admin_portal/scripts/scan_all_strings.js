const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const TARGET_DIRS = [
    path.join(__dirname, '../src/app/[locale]/admin'),
    path.join(__dirname, '../src/components'),
    path.join(__dirname, '../src/lib')
];

function hasTurkishContent(str) {
    const turkishChars = /[çğıöşüÇĞIÖŞÜ]/;
    if (turkishChars.test(str)) return true;
    
    // Common Turkish words without special chars
    const commonWords = /\b(ve|veya|ile|için|gibi|kadar|fakat|ama|ancak|lakin|çünkü|eğer|belki|sanki|güzel|iyi|kötü|büyük|küçük|yeni|eski|sıcak|soğuk|var|yok|evet|hayır|lütfen|teşekkür|merhaba|günaydın|sipariş|iptal|onayla|bekleyen|ödendi|kurye|müşteri|restoran|hesap|fatura|tarih|saat|toplam|tutar|adet|ürün|kategori|ekle|sil|düzenle|kaydet|kapat|aç|gönder|durum|aktif|pasif|başarılı|hata|uyarı|bilgi)\b/i;
    
    if (commonWords.test(str)) return true;

    return false;
}

function scanFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

    const code = fs.readFileSync(filePath, 'utf8');
    let ast;
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
    } catch (e) {
        console.error(`Error parsing ${filePath}:`, e.message);
        return;
    }

    const foundStrings = [];

    traverse(ast, {
        StringLiteral(path) {
            if (path.parent.type === 'CallExpression' && path.parent.callee.name === 't') return;
            if (path.parent.type === 'CallExpression' && path.parent.callee.name && path.parent.callee.name.startsWith('tAdmin')) return;
            if (path.parent.type === 'ObjectProperty' && path.parent.key === path.node) return;
            if (path.parent.type === 'ImportDeclaration') return;
            
            // Exclude icons/emojis only strings
            if (/^\p{Emoji}+$/u.test(path.node.value)) return;
            // Exclude pure numbers/symbols
            if (/^[\d\s\p{Punctuation}]+$/u.test(path.node.value)) return;
            
            if (hasTurkishContent(path.node.value)) {
                 foundStrings.push({ value: path.node.value, line: path.node.loc?.start.line });
            }
        },
        JSXText(path) {
            const val = path.node.value.trim();
            if (!val) return;
            // Skip if it feels like a placeholder or raw text without context
            if (hasTurkishContent(val)) {
                foundStrings.push({ value: val, line: path.node.loc?.start.line });
            }
        }
    });

    if (foundStrings.length > 0) {
        console.log(`\n--- ${filePath.replace(__dirname + '/../', '')} ---`);
        foundStrings.forEach(s => {
            console.log(`Line ${s.line}: "${s.value}"`);
        });
    }
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath);
        } else {
            scanFile(fullPath);
        }
    }
}

console.log("Scanning for hardcoded Turkish strings...");
for (const dir of TARGET_DIRS) {
    if (fs.existsSync(dir)) {
        scanDirectory(dir);
    }
}
