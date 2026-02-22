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
    if (typeof str !== 'string') return false;
    const turkishChars = /[çğıöşüÇĞIÖŞÜ]/;
    if (turkishChars.test(str)) return true;
    
    // Common Turkish words
    const commonWords = /\b(ve|veya|ile|için|gibi|kadar|fakat|ama|ancak|lakin|çünkü|eğer|belki|sanki|güzel|iyi|kötü|büyük|küçük|yeni|eski|sıcak|soğuk|var|yok|evet|hayır|lütfen|teşekkür|merhaba|günaydın|sipariş|iptal|onayla|bekleyen|ödendi|kurye|müşteri|restoran|hesap|fatura|tarih|saat|toplam|tutar|adet|ürün|kategori|ekle|sil|düzenle|kaydet|kapat|aç|gönder|durum|aktif|pasif|başarılı|hata|uyarı|bilgi)\b/i;
    
    if (commonWords.test(str)) return true;

    return false;
}

function getNamespaceForFile(filePath) {
    const relativePath = filePath.replace(path.join(__dirname, '../src/'), '');
    
    // Convert 'components/ui/ConfirmModal.tsx' to 'AdminComponentConfirmModal'
    if (relativePath.startsWith('components/')) {
        let name = relativePath.replace('components/', '').replace('.tsx', '').replace('.ts', '').split('/').pop();
        return 'AdminComponent' + name.replace(/[^a-zA-Z0-9]/g, '');
    }

    // Convert 'lib/erp-utils.ts' to 'AdminLibErpUtils'
    if (relativePath.startsWith('lib/')) {
        let name = relativePath.replace('lib/', '').replace('.ts', '').split('/').pop();
        return 'AdminLib' + name.replace(/[^a-zA-Z0-9]/g, '');
    }

    // Convert 'app/[locale]/admin/activity-logs/page.tsx' to 'AdminActivityLogs'
    if (relativePath.startsWith('app/[locale]/admin/')) {
        let parts = relativePath.split('/');
        let subPath = parts.slice(3, -1).join('_');
        if (!subPath) subPath = 'dashboard';
        
        return 'Admin' + subPath.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/[^a-zA-Z0-9]/g, '')).join('');
    }

    return 'AdminGlobal';
}

function normalizeKey(str) {
    if (typeof str !== 'string') return 'error_key';
    let key = str.toLowerCase();
    key = key.replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
    key = key.replace(/[^a-z0-9]/g, '_');
    key = key.replace(/_+/g, '_').replace(/^_|_$/g, '');
    return key.substring(0, 40) || 'unknown';
}

const extractedData = {}; // { namespace: { key: originalString } }
const fileToNamespaceMap = {}; // { relativePath: namespace }

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
        return; // Ignore parsing errors
    }

    const ns = getNamespaceForFile(filePath);
    if (!extractedData[ns]) extractedData[ns] = {};

    let foundAny = false;

    traverse(ast, {
        StringLiteral(path) {
            // Exclude already translated
            if (path.parent.type === 'CallExpression' && path.parent.callee.name && path.parent.callee.name.startsWith('t')) return;
            // Exclude object keys naturally
            if (path.parent.type === 'ObjectProperty' && path.parent.key === path.node) return;
            if (path.parent.type === 'ImportDeclaration') return;
            
            const val = path.node.value;
            if (typeof val !== 'string') return;
            if (/^\p{Emoji}+$/u.test(val)) return;
            if (/^[\d\s\p{Punctuation}]+$/u.test(val)) return;
            
            if (hasTurkishContent(val)) {
                
                // Skip camelCase mapping keys
                if (/^[a-z]+[a-zA-Z0-9]*$/.test(val.trim()) && val.includes('Hata')) return;
                if (/^[a-z]+[A-Z][a-zA-Z0-9]*$/.test(val.trim())) return; // Pure camel case

                const key = normalizeKey(val);
                extractedData[ns][key] = val;
                foundAny = true;
            }
        },
        JSXText(path) {
            const val = path.node.value.trim();
            if (!val) return;
            
            if (hasTurkishContent(val)) {
                const key = normalizeKey(val);
                extractedData[ns][key] = val;
                foundAny = true;
            }
        }
    });

    if (foundAny) {
        fileToNamespaceMap[filePath] = ns; // Store absolute path
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

console.log("Starting Phase 3 Extraction...");
for (const dir of TARGET_DIRS) {
    if (fs.existsSync(dir)) {
        scanDirectory(dir);
    }
}

// Ensure the directory exists
fs.writeFileSync(path.join(__dirname, '../phase3_extract.json'), JSON.stringify(extractedData, null, 2));
fs.writeFileSync(path.join(__dirname, '../phase3_file_map.json'), JSON.stringify(fileToNamespaceMap, null, 2));

console.log(`Saved phase3_extract.json with ${Object.keys(extractedData).length} namespaces.`);
console.log(`Saved phase3_file_map.json with ${Object.keys(fileToNamespaceMap).length} matched files.`);
