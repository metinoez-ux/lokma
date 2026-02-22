const fs = require('fs');

const trJson = JSON.parse(fs.readFileSync('extras_tr.json', 'utf8'));
const languages = ['en', 'de', 'fr', 'it', 'es', 'tr'];

for (const lang of languages) {
    const filePath = `messages/${lang}.json`;
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(fileContent);

        if (!json.AdminExtras) {
            json.AdminExtras = {};
        }

        for (const [key, trString] of Object.entries(trJson)) {
            if (!json.AdminExtras[key]) {
                json.AdminExtras[key] = trString;
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Injected AdminExtras into ${lang}.json`);
    } else {
        console.log(`Warning: ${filePath} not found`);
    }
}
