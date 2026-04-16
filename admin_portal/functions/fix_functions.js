const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/kermesSupplyFunctions.ts');
let content = fs.readFileSync(file, 'utf8');

// Change personnel_notifications to notifications
content = content.replace(/collection\("personnel_notifications"\)/g, 'collection("notifications")');

// Use urgency for titles
content = content.replace(
  /const itemName = data\.itemName \|\| 'Malzeme';/g,
  "const itemName = data.itemName || 'Malzeme';\n    const urgency = data.urgency || 'normal';"
);

content = content.replace(
  /const title = `🚨 Acil Malzeme Lazım: \$\{itemName\}`;/g,
  "const isUrgent = urgency === 'super_urgent';\n      const title = isUrgent ? `🚨🔥 SÜPER ACİL: \${itemName}` : `🚨 İhtiyaç: \${itemName}`;"
);

content = content.replace(
  /const body = `\$\{requestedByName\} \(\$\{reqZone\}\) acil \$\{itemName\} bekliyor\.`;/g,
  "const body = isUrgent\n        ? `⚠️ DİKKAT! \${requestedByName} (\${reqZone}) işi gücü bırakıp HEMEN \${itemName} getirmenizi bekliyor!`\n        : `\${requestedByName} (\${reqZone}) şu an \${itemName} bekliyor.`;"
);

// We need to also keep kermes logic for status update.
fs.writeFileSync(file, content);
console.log('Fixed kermesSupplyFunctions.ts');
