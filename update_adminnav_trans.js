const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'fr', 'it'];
const baseDir = path.join(__dirname, 'admin_portal/messages');

const translations = {
    tr: {
        accounting: "Muhasebe",
        usersAndStaff: "Kullanıcı & Personel"
    },
    en: {
        accounting: "Accounting",
        usersAndStaff: "User & Staff"
    },
    de: {
        accounting: "Buchhaltung",
        usersAndStaff: "Benutzer & Personal"
    },
    fr: {
        accounting: "Comptabilité",
        usersAndStaff: "Utilisateur & Personnel"
    },
    it: {
        accounting: "Contabilità",
        usersAndStaff: "Utenti & Personale"
    }
};

locales.forEach(locale => {
    const filePath = path.join(baseDir, `${locale}.json`);
    if (fs.existsSync(filePath)) {
        let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!data.AdminNav) {
            data.AdminNav = {};
        }

        Object.assign(data.AdminNav, translations[locale]);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`Updated ${locale}.json in AdminNav`);
    } else {
        console.warn(`File not found: ${filePath}`);
    }
});
