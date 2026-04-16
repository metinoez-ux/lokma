const fs = require('fs');
const file = 'admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// replace toast.error(X) with showToast(X, 'error')
content = content.replace(/toast\.error\((.*?)\);/g, "showToast($1, 'error');");

// replace toast.success(X) with showToast(X, 'success')
content = content.replace(/toast\.success\((.*?)\);/g, "showToast($1, 'success');");

fs.writeFileSync(file, content);
console.log('Fixed toast usage!');
