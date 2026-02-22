const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const presetTypescript = require('@babel/preset-typescript');
const presetReact = require('@babel/preset-react');

// The file to process
const targetFile = path.join(__dirname, '../src/app/[locale]/admin/business/page.tsx');

// Hardcoded turkish phrases to look out for
const keywords = [
    'Yeni Kermes Ekle', 'Yeni İşletme Ekle', 'İşletme Yönetimi', 'Kermes Yönetimi',
    'İşletme', 'Kermes', 'aktif kermesleri yönetin', 'tüm kayıtlı işletmeleri yönetin',
    'sektör modülleri', 'Kermesler yükleniyor', 'Aktif', 'Pasif', 'Arşiv', 'İşletme Adı, Şehir veya Posta Kodu',
    'İşletme Ekle', 'Hata', 'Değişiklikleri Kaydet', 'Hesap Sahibi', 'Toplam Masa', 'Masa Rezervasyonu Aktif'
];

let counter = 1;
const extractedStrings = {};

const plugin = function ({ types: t }) {
    return {
        visitor: {
            JSXText(pathNode) {
                const text = pathNode.node.value.trim();
                if (text && text.length > 2 && /[A-Za-zÇŞĞÜÖİçşğüöı]/.test(text) && !text.includes('{') && !text.includes('}')) {
                    const key = (
                        text.replace(/[^a-zA-ZÇŞĞÜÖİçşğüöı0-9]/g, '_')
                            .replace(/_+/g, '_')
                            .toLowerCase()
                            .substring(0, 40)
                            .replace(/_$/, '')
                    ) || `string_${counter++}`;

                    if (!extractedStrings[key]) {
                        extractedStrings[key] = text;
                    }
                }
            },
            StringLiteral(pathNode) {
                const text = pathNode.node.value.trim();

                // Skip obvious non-human strings
                if (!text || text.length < 2 || text.startsWith('/') || text.includes('text-') || text.includes('bg-') || text.includes('flex')) {
                    return;
                }

                // Check if it's anywhere near a UI element or part of our keyword list
                const isTurkish = /[ÇŞĞÜÖİçşğüöı]/.test(text) || keywords.some(k => text.toLowerCase().includes(k.toLowerCase()));

                if (isTurkish && !text.includes('font-') && !text.includes('px-')) {
                    const key = (
                        text.replace(/[^a-zA-ZÇŞĞÜÖİçşğüöı0-9]/g, '_')
                            .replace(/_+/g, '_')
                            .toLowerCase()
                            .substring(0, 40)
                            .replace(/_$/, '')
                    ) || `string_${counter++}`;

                    if (!extractedStrings[key]) {
                        extractedStrings[key] = text;
                    }
                }
            }
        },
    };
};

function extract() {
    console.log('Extracting strings from businesses/page.tsx...');

    if (!fs.existsSync(targetFile)) {
        console.error(`File not found: ${targetFile}`);
        return;
    }

    const code = fs.readFileSync(targetFile, 'utf8');

    babel.transformSync(code, {
        filename: targetFile,
        presets: [presetTypescript, presetReact],
        plugins: [plugin],
    });

    console.log(`Extracted ${Object.keys(extractedStrings).length} strings.`);
    fs.writeFileSync(path.join(__dirname, '../business_extracted.json'), JSON.stringify(extractedStrings, null, 2));
}

extract();
