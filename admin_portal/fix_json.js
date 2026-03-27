const fs = require('fs');
const path = require('path');

const dir = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/messages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const missingKeys = {
    tr: { tarih_saat: "Tarih ve Saat", saat: "Saat", iptal_et: "İptal Et" },
    de: { tarih_saat: "Datum und Uhrzeit", saat: "Uhrzeit", iptal_et: "Stornieren" },
    en: { tarih_saat: "Date and Time", saat: "Time", iptal_et: "Cancel" },
    nl: { tarih_saat: "Datum en Tijd", saat: "Tijd", iptal_et: "Annuleren" },
    es: { tarih_saat: "Fecha y Hora", saat: "Hora", iptal_et: "Cancelar" },
    fr: { tarih_saat: "Date et Heure", saat: "Heure", iptal_et: "Annuler" },
    it: { tarih_saat: "Data e Ora", saat: "Ora", iptal_et: "Annulla" }
};

for (const file of files) {
    const locale = file.replace('.json', '');
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    
    // Fix tr.json specific known bugs
    if (file === 'tr.json') {
        content = content.replace('"buIsletmeninGecmisiVarn": "Bu işletmenin geçmişi var:\\",\n', '"buIsletmeninGecmisiVarn": "Bu işletmenin geçmişi var:",\n');
        content = content.replace(/\\Gelecek/g, '\\\\Gelecek');
        content = content.replace(/\\n/g, '\\\\n'); // catch random \n 
    }
    
    // Fix EOF `}\n` literal
    content = content.trim();
    if (content.endsWith('}\\n')) {
        content = content.slice(0, -2);
    }

    try {
        const data = JSON.parse(content);
        if (!data.AdminPortal) data.AdminPortal = {};
        if (!data.AdminPortal.Reservations) data.AdminPortal.Reservations = {};
        
        const keys = missingKeys[locale] || missingKeys.en;
        for (const [k, v] of Object.entries(keys)) {
            if (!data.AdminPortal.Reservations[k]) {
                data.AdminPortal.Reservations[k] = v;
            }
        }
        
        fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + '\n');
        console.log(`[OK] Updated ${file}`);
    } catch (e) {
        console.error(`[ERROR] Parsing ${file}:`, e.message);
    }
}
