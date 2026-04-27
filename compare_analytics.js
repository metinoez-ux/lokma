const fs = require('fs');

const dash = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/dashboard/page.tsx', 'utf8');
const bus = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'utf8');

const getRevenueLogic = (content, name) => {
    const lines = content.split('\n');
    const revenueLine = lines.find(l => l.includes('revenue:') || l.includes('totalRevenue'));
    console.log(`${name} Revenue Logic: ${revenueLine ? revenueLine.trim() : 'Not Found'}`);
};

getRevenueLogic(dash, 'Dashboard');
getRevenueLogic(bus, 'Business');
