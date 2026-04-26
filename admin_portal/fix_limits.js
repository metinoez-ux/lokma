const fs = require('fs');
const path = 'src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const fieldsToFix = ['productLimit', 'orderLimit', 'personnelLimit', 'campaignLimit', 'tableReservationFreeQuota'];

fieldsToFix.forEach(field => {
  const regex = new RegExp(`onChange=\\{e => setFormData\\(\\{ \\.\\.\\.formData, ${field}: e\\.target\\.value \\? parseInt\\(e\\.target\\.value\\) : null( \\} as any)?\\}\\)\\}`, 'g');
  const replacement = `onChange={e => setFormData({ ...formData, ${field}: e.target.value === '' ? '' : parseInt(e.target.value) } as any)}`;
  content = content.replace(regex, replacement);
});

fs.writeFileSync(path, content, 'utf8');
console.log('done limits');
