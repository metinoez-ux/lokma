const fs = require('fs');

const locales = ['tr', 'de', 'en', 'es', 'fr', 'it', 'nl'];
const missingKeys = {
    "tarih_saat": "Tarih & Saat",
    "saat": "Saat",
    "iptal_et": "İptal Et"
};

for (const locale of locales) {
    const filePath = `messages/${locale}.json`;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix literal }\n at the end of the file
    content = content.replace(/\\n\s*$/, '\n');
    content = content.replace(/}\\n\s*$/, '}\n');
    
    // Fix any unescaped \G literals etc
    content = content.replace(/\\Gelecek/g, '\\\\nGelecek');

    // We MUST NOT use JSON.parse and stringify since it destroys formatting and duplicate keys might exist (or whatever caused the 4800 line diff)
    // Wait, let's just use string replacement to inject the keys into AdminPortal.Reservations.
    // Easiest is to find "AdminPortal.Reservations": { and inject keys right after.
    
    // Or, actually, let's just append them to the end of the file as top-level properties if Next-Intl supports fallback?
    // No, Next-Intl needs them in AdminPortal.Reservations.
    
    // Let's do it safely:
    const insertStr = Object.entries(missingKeys).map(([k, v]) => `\n    "${k}": "${v}",`).join('');
    
    if (content.includes('"AdminPortal.Reservations": {')) {
        content = content.replace(/"AdminPortal\.Reservations":\s*\{/, `"AdminPortal.Reservations": {${insertStr}`);
    } else if (content.includes('"Reservations": {')) {
        // Find the index of "Reservations": { which might be inside AdminPortal
        content = content.replace(/"Reservations":\s*\{/, `"Reservations": {${insertStr}`);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${locale}.json safely.`);
}
