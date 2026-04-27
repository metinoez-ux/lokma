const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace completed check in calculateStats
content = content.replace(
  /const completed = orderList\.filter\(o => \['delivered', 'picked_up'\]\.includes\(o\.status\)\);/,
  `const completed = orderList.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));`
);

// Replace completedOrders check later in the file
content = content.replace(
  /const completedOrders = filteredOrders\.filter\(o => \['delivered', 'picked_up'\]\.includes\(o\.status\)\);/,
  `const completedOrders = filteredOrders.filter(o => ['delivered', 'picked_up', 'completed'].includes(o.status));`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated dashboard stats calculation");
