const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/invoices/BusinessInvoiceSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace new Date(...) logic for Firebase Timestamps
content = content.replace(/new Date\(invoice\.dueDate && typeof invoice\.dueDate\.toDate === 'function' \? invoice\.dueDate\.toDate\(\) : invoice\.dueDate \|\| Date\.now\(\)\)/g, 
  "new Date(invoice.dueDate && typeof (invoice.dueDate as any).toDate === 'function' ? (invoice.dueDate as any).toDate() : invoice.dueDate || Date.now())");

content = content.replace(/new Date\(invoice\.createdAt && typeof invoice\.createdAt\.toDate === 'function' \? invoice\.createdAt\.toDate\(\) : invoice\.createdAt \|\| Date\.now\(\)\)/g, 
  "new Date(invoice.createdAt && typeof (invoice.createdAt as any).toDate === 'function' ? (invoice.createdAt as any).toDate() : invoice.createdAt || Date.now())");

content = content.replace(/new Date\(invoice\.updatedAt && typeof invoice\.updatedAt\.toDate === 'function' \? invoice\.updatedAt\.toDate\(\) : invoice\.updatedAt \|\| Date\.now\(\)\)/g, 
  "new Date(invoice.updatedAt && typeof (invoice.updatedAt as any).toDate === 'function' ? (invoice.updatedAt as any).toDate() : invoice.updatedAt || Date.now())");

content = content.replace(/new Date\(invoice\.issueDate && typeof invoice\.issueDate\.toDate === 'function' \? invoice\.issueDate\.toDate\(\) : invoice\.issueDate \|\| Date\.now\(\)\)/g, 
  "new Date(invoice.issueDate && typeof (invoice.issueDate as any).toDate === 'function' ? (invoice.issueDate as any).toDate() : invoice.issueDate || Date.now())");

// Also there is one in the HTML
content = content.replace(/\(invoice\.dueDate && typeof invoice\.dueDate\.toDate === 'function' \? invoice\.dueDate\.toDate\(\) : invoice\.dueDate\)/g, 
  "(invoice.dueDate && typeof (invoice.dueDate as any).toDate === 'function' ? (invoice.dueDate as any).toDate() : invoice.dueDate)");

fs.writeFileSync(file, content);
