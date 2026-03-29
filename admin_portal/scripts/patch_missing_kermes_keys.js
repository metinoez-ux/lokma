const fs = require('fs');
const path = require('path');

const locales = ['de', 'en', 'es', 'fr', 'it', 'nl', 'tr'];
const dir = path.join(__dirname, '../messages');

const translations = {
    tr: { email_opsiyonel: "E-posta (İsteğe Bağlı)" },
    de: { email_opsiyonel: "E-Mail (Optional)" },
    en: { email_opsiyonel: "Email (Optional)" },
    es: { email_opsiyonel: "Correo Electrónico (Opcional)" },
    fr: { email_opsiyonel: "E-mail (Facultatif)" },
    it: { email_opsiyonel: "Email (Opzionale)" },
    nl: { email_opsiyonel: "E-mail (Optioneel)" }
};

for (const loc of locales) {
    const file = path.join(dir, `${loc}.json`);
    if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(raw);
        if (json.AdminKermesDetail) {
            let patched = false;
            for (const [key, value] of Object.entries(translations[loc])) {
                if (!json.AdminKermesDetail[key]) {
                    json.AdminKermesDetail[key] = value;
                    patched = true;
                }
            }
            if (patched) {
                fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
                console.log(`✅ Patched ${loc}.json`);
            }
        }
    }
}
