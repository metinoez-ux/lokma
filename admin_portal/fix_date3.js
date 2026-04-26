const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/invoices/BusinessInvoiceSection.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/invoice\.dueDate\?\.toDate \? invoice\.dueDate\.toDate\(\) : invoice\.dueDate/g, 
  "(invoice.dueDate as any)?.toDate ? (invoice.dueDate as any).toDate() : invoice.dueDate");

content = content.replace(/invoice\.dueDate\.toDate \? invoice\.dueDate\.toDate\(\) : invoice\.dueDate/g, 
  "(invoice.dueDate as any)?.toDate ? (invoice.dueDate as any).toDate() : invoice.dueDate");

fs.writeFileSync(file, content);
