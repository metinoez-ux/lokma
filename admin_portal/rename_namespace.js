const fs = require('fs');
const glob = require('glob');

const files = glob.sync('messages/*.json');

files.forEach(file => {
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(raw);
        if (data['AdminPortal.Orders']) {
            data['AdminOrders'] = data['AdminPortal.Orders'];
            delete data['AdminPortal.Orders'];
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
            console.log(`Updated ${file}`);
        }
    } catch (e) {
        console.error(`Error processing ${file}: ${e.message}`);
    }
});
