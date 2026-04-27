const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Change analytics to depend on filteredOrders
content = content.replace(
  /const analytics = useMemo\(\(\) => \{([\s\S]*?)\} \), \[orders\]\);/m,
  (match, inner) => {
    // inside inner, replace orders.filter with filteredOrders.filter, and orders.forEach with filteredOrders.forEach
    let newInner = inner.replace(/orders\.filter/g, 'filteredOrders.filter');
    newInner = newInner.replace(/orders\.forEach/g, 'filteredOrders.forEach');
    return `const analytics = useMemo(() => {${newInner}} , [filteredOrders]);`;
  }
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated analytics to use filteredOrders");
