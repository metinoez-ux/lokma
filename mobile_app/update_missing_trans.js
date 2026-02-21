const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, 'assets/translations');
const LANGUAGES = ['tr', 'en', 'de', 'fr', 'it', 'es'];

// A map of files to their namespace
const fileNamespaceMap = {
    'lib/screens/auth/login_screen.dart': 'auth',
    'lib/screens/customer/group_table_order_screen.dart': 'customer',
    'lib/screens/customer/table_order_view_screen.dart': 'customer',
    'lib/screens/driver/driver_delivery_screen.dart': 'driver',
    'lib/screens/favorites/favorites_screen.dart': 'common', // maybe favorites
    'lib/screens/settings/settings_screen.dart': 'settings',
    'lib/screens/wallet/wallet_screen.dart': 'wallet',
    'lib/screens/search/smart_search_screen.dart': 'search',
};

// Generate a safe key from Turkish text
function generateSafeKey(text) {
    let safe = text.toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    if (safe.length > 30) safe = safe.substring(0, 30).replace(/_$/, '');
    if (!safe) safe = 'missing_key_' + Math.floor(Math.random() * 1000);
    return safe;
}

// Simple translation dict for common terms in missing list
const dictEN = {
    'Giriş Yap': 'Login', 'Şifre': 'Password', 'Ülke Seçin': 'Select Country',
    'Sepet': 'Cart', 'Profil': 'Profile', 'Kaydet': 'Save', 'Tümü': 'All',
    'İptal': 'Cancel', 'Tamam': 'OK', 'Evet': 'Yes', 'Hayır': 'No',
    'Menüyü Aç': 'Open Menu', 'Sipariş Ver': 'Order', 'Menü': 'Menu', 'Diğer': 'Other'
};
const dictDE = {
    'Giriş Yap': 'Anmelden', 'Şifre': 'Passwort', 'Ülke Seçin': 'Land auswählen',
    'Sepet': 'Warenkorb', 'Profil': 'Profil', 'Kaydet': 'Speichern', 'Tümü': 'Alle',
    'İptal': 'Abbrechen', 'Tamam': 'OK', 'Evet': 'Ja', 'Hayır': 'Nein',
    'Menüyü Aç': 'Menü öffnen', 'Sipariş Ver': 'Bestellen', 'Menü': 'Menü', 'Diğer': 'Andere'
};

async function processMissingStrings() {
    let translationsCache = {};
    for (const lang of LANGUAGES) {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        if (fs.existsSync(filePath)) {
            translationsCache[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
            translationsCache[lang] = {};
        }
    }

    // Just doing a fast pass on the massive files output by our previous script
    const missingLog = fs.readFileSync('extract_missing_strings.js', 'utf8'); // We didn't save the log to a file, so let's re-extract programmatically for exactly the files we care about that missed out

    for (const [filePath, namespace] of Object.entries(fileNamespaceMap)) {
        const fullPath = path.join(__dirname, filePath);
        if (!fs.existsSync(fullPath)) continue;

        let content = fs.readFileSync(fullPath, 'utf8');
        let lines = content.split('\n');

        // Find text triggers
        const turkishTriggers = /[ğüşöçİĞÜŞÖÇ]|Tamam|İptal|Evet|Hayır|Lütfen|Sipariş|Kurye|Kasap|Restoran|Sepet|Profil|Kaydet|Ekle|Onayla|Kapat/i;

        let modifications = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.includes('print(') || line.includes('tr(')) continue;

            const strMatches = line.match(/(['"])(.*?)\1/g);
            if (strMatches) {
                let newLine = line;
                for (const match of strMatches) {
                    const inner = match.substring(1, match.length - 1);
                    if (inner.length > 2 && turkishTriggers.test(inner) && !inner.includes('$')) { // ignore variables for now to avoid breaking syntax
                        const rawKey = generateSafeKey(inner);

                        // Seed translation dictionaries
                        if (!translationsCache['tr'][namespace]) translationsCache['tr'][namespace] = {};
                        translationsCache['tr'][namespace][rawKey] = inner;

                        LANGUAGES.forEach(lang => {
                            if (lang !== 'tr') {
                                if (!translationsCache[lang][namespace]) translationsCache[lang][namespace] = {};
                                if (!translationsCache[lang][namespace][rawKey]) {
                                    if (lang === 'en' && dictEN[inner]) translationsCache['en'][namespace][rawKey] = dictEN[inner];
                                    else if (lang === 'de' && dictDE[inner]) translationsCache['de'][namespace][rawKey] = dictDE[inner];
                                    else translationsCache[lang][namespace][rawKey] = inner; // Fallback to TR if unknown to the automated script (needs human review later)
                                }
                            }
                        });

                        // Replace in dart code
                        // Check if it was a Text widget text or a normal string
                        // For simplicity, just replace the exact match
                        newLine = newLine.replace(match, `tr('${namespace}.${rawKey}')`);
                        modifications++;
                    }
                }
                lines[i] = newLine;
            }
        }

        if (modifications > 0) {
            fs.writeFileSync(fullPath, lines.join('\n'));
            console.log(`Replaced ${modifications} strings in ${filePath}`);

            // Need to add import if missing
            let contentCheck = fs.readFileSync(fullPath, 'utf8');
            if (!contentCheck.includes("package:easy_localization/easy_localization.dart")) {
                contentCheck = contentCheck.replace(
                    /import 'package:flutter\/material\.dart';/,
                    `import 'package:flutter/material.dart';\nimport 'package:easy_localization/easy_localization.dart';`
                );
                fs.writeFileSync(fullPath, contentCheck);
            }
        }
    }

    // Save updated JSONs
    for (const lang of LANGUAGES) {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        // sort keys
        const sorted = {};
        Object.keys(translationsCache[lang]).sort().forEach(k => sorted[k] = translationsCache[lang][k]);
        fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2));
        console.log(`Updated assets/translations/${lang}.json`);
    }
}

processMissingStrings();
