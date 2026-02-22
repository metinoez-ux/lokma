const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const targetFiles = [
    'src/app/[locale]/admin/page.tsx',
    'src/app/[locale]/admin/kermes/page.tsx',
    'src/app/[locale]/admin/account/page.tsx',
    'src/app/[locale]/login/page.tsx'
];

const OUTPUT_FILE = 'phase2_extract.json';

const TR_CHARS = /[ıİğĞüÜşŞöÖçÇ]/;
const TR_WORDS = ["İşletme", "Ekle", "Sil", "Düzenle", "İptal", "Kaydet", "Masa", "Sipariş", "Kurye", "Müşteri", "Başarılı", "Hata", "Lütfen", "Giriş", "Hesap", "Yeni", "Tümü", "Durum", "Ara", "Kapat", "Güncelle", "Kategori"];

const extractMap = {};

function hasTurkishContent(str) {
    if (!str || typeof str !== 'string' || str.trim().length === 0) return false;
    const trimmed = str.trim();
    if (trimmed.length < 2) return false;
    // Common non-translatable class names or codes
    if (trimmed.includes('flex') || trimmed.includes('text-') || trimmed.includes('bg-') || /^#[0-9A-Fa-f]{3,6}$/.test(trimmed)) return false;

    return TR_CHARS.test(trimmed) || TR_WORDS.some(w => trimmed.includes(w));
}

function generateKey(str) {
    let key = str.trim()
        .replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 40)
        .toLowerCase();

    // Convert TR chars for key
    const trMap = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'i̇': 'i' };
    key = key.replace(/[ığüşöçi̇]/g, m => trMap[m] || m);

    if (key.length === 0) return 'text_' + Math.floor(Math.random() * 10000);
    return key;
}

targetFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    const code = fs.readFileSync(filePath, 'utf8');
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
        });

        const fileStrings = new Set();

        traverse(ast, {
            StringLiteral(path) {
                // Skip if argument to t()
                if (path.parent.type === 'CallExpression' && path.parent.callee.name === 't') return;
                // Skip if property key
                if (path.parent.type === 'ObjectProperty' && path.parent.key === path.node) return;

                const val = path.node.value;
                if (!hasTurkishContent(val)) return;

                // Skip camelCase mapping keys like urunEklenirkenHataOlustu
                if (/^[a-z]+[a-zA-Z0-9]*$/.test(val.trim()) && val.includes('Hata')) return;
                if (/^[a-z]+[A-Z][a-zA-Z0-9]*$/.test(val.trim())) return; // Pure camel case

                fileStrings.add(val.trim());
            },
            JSXText(path) {
                if (hasTurkishContent(path.node.value)) {
                    fileStrings.add(path.node.value.trim());
                }
            },
            TemplateElement(path) {
                if (hasTurkishContent(path.node.value.raw)) {
                    fileStrings.add(path.node.value.raw.trim());
                }
            }
        });

        if (fileStrings.size > 0) {
            let namespace = '';
            // Define specific namespaces based on paths
            if (filePath.includes('admin/page')) namespace = 'AdminDashboard';
            else if (filePath.includes('kermes/page')) namespace = 'AdminKermes';
            else if (filePath.includes('account/page')) namespace = 'AdminProfile';
            else if (filePath.includes('login/page')) namespace = 'AdminLogin';
            else namespace = 'AdminGeneric';

            if (!extractMap[namespace]) extractMap[namespace] = {};

            fileStrings.forEach(str => {
                let key = generateKey(str);
                // Handle duplicate keys
                let counter = 1;
                while (Object.values(extractMap[namespace]).includes(key) && Object.keys(extractMap[namespace]).find(k => extractMap[namespace][k] === key) !== str) {
                    key = `${generateKey(str)}_${counter}`;
                    counter++;
                }

                // Reverse mapping: Original String -> Key  (easier for replacement script)
                extractMap[namespace][str] = key;
            });
        }
    } catch (e) {
        console.error('Error parsing', filePath, e.message);
    }
});

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(extractMap, null, 2));
console.log(`Extraction complete. Saved to ${OUTPUT_FILE}`);
