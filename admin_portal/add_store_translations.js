const fs = require('fs');

const trPath = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages/tr.json';
const dePath = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages/de.json';
const enPath = '/Users/metinoz/.gemini/antigravity/scratch/LOKMA_2026/admin_portal/messages/en.json';

function addKeys(filePath, newKeys) {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Add to 'Landing' namespace
    if (data.Landing) {
        data.Landing = { ...data.Landing, ...newKeys };
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

addKeys(trPath, {
  "appStoreButton": "App Store'dan İndir",
  "playStoreButton": "Google Play'den İndir"
});

addKeys(dePath, {
  "appStoreButton": "Im App Store herunterladen",
  "playStoreButton": "Bei Google Play herunterladen"
});

addKeys(enPath, {
  "appStoreButton": "Download on the App Store",
  "playStoreButton": "Get it on Google Play"
});

console.log('Keys added');
