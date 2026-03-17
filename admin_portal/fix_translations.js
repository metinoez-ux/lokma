const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, 'messages');
const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json') && !f.includes('updated'));

const translations = {
    'de.json': 'Weitere Status',
    'en.json': 'Other Statuses',
    'es.json': 'Otros Estados',
    'fr.json': 'Autres Statuts',
    'it.json': 'Altri Stati',
    'nl.json': 'Andere Statussen',
    'tr.json': 'Diğer Durumlar'
};

files.forEach(file => {
    const filePath = path.join(messagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Parse JSON
    try {
        const data = JSON.parse(content);
        if (data.AdminPortal && data.AdminPortal.Orders && data.AdminPortal.Orders.modal) {
            data.AdminPortal.Orders.modal.otherStatuses = translations[file] || 'Other Statuses';
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n', 'utf8');
            console.log(`Updated ${file}`);
        } else {
            console.log(`Skipped ${file} - Path not found`);
        }
    } catch (e) {
        console.error(`Error parsing ${file}:`, e);
    }
});
