const fs = require('fs');
const files = [
  'admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx',
  'admin_portal/src/app/api/notifications/kermes-manual-notification/route.ts',
  'admin_portal/src/app/api/notifications/kermes-flash-sale/route.ts',
  'admin_portal/src/app/api/notifications/kermes-parking-announcement/route.ts'
];
for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/'kermesEvents'/g, "'kermes_events'");
  fs.writeFileSync(file, content);
}
console.log('Fixed kermesEvents collection names!');
