const fs = require('fs');
const path = require('path');

const locales = ['tr', 'en', 'de', 'fr', 'it', 'es', 'nl', 'tr_updated'];
const baseDir = path.join(__dirname, 'admin_portal/messages');

locales.forEach(locale => {
    const filePath = path.join(baseDir, `${locale}.json`);
    if (fs.existsSync(filePath)) {
        let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (data.AdminNav && data.AdminNav.activityLogs) {
            data.AdminNav.activityLogs = "Service";
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
            console.log(`Updated ${locale}.json AdminNav.activityLogs to 'Service'`);
        }
    } else {
        console.warn(`File not found: ${filePath}`);
    }
});
