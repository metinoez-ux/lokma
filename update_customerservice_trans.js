const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'fr', 'it'];
const baseDir = path.join(__dirname, 'admin_portal/messages');

const translations = {
    tr: {
        last_orders: "Son Siparişler"
    },
    en: {
        last_orders: "Recent Orders"
    },
    de: {
        last_orders: "Letzte Bestellungen"
    },
    fr: {
        last_orders: "Dernières Commandes"
    },
    it: {
        last_orders: "Ordini Recenti"
    }
};

locales.forEach(locale => {
    const filePath = path.join(baseDir, `${locale}.json`);
    if (fs.existsSync(filePath)) {
        let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!data.AdminCustomerService) {
            data.AdminCustomerService = {};
        }

        Object.assign(data.AdminCustomerService, translations[locale]);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`Updated ${locale}.json`);
    } else {
        console.warn(`File not found: ${filePath}`);
    }
});
