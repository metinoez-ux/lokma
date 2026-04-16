const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/kermesSupplyFunctions.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const title = newStatus === 'on_the_way' \? `✅ Malzeme Yola Çıktı!` : `✅ Malzeme Tamamlandı`;/g,
  `const title = newStatus === 'on_the_way' ? \`✅ Malzeme Yola Çıktı!\` : newStatus === 'rejected' ? \`❌ Malzeme İsteği Reddedildi\` : \`✅ Malzeme Tamamlandı\`;`
);

content = content.replace(
  /const body = newStatus === 'on_the_way' \n             \? `Kermes Yetkilisi, "\$\{itemName\}" talebinizi onayladı ve yola çıkardı!` \n             : `"\$\{itemName\}" talebi tamam olarak işaretlendi\.`;/g,
  `const adminReply = newData.adminReply ? \`\\nCevap: "\${newData.adminReply}"\` : '';
      const body = newStatus === 'on_the_way' 
             ? \`Kermes Yetkilisi, "\${itemName}" talebinizi onayladı ve yola çıkardı!\${adminReply}\` 
             : newStatus === 'rejected' ? \`Yetkili, "\${itemName}" talebini şu an iptal etti.\${adminReply}\` : \`"\${itemName}" talebi tamam olarak işaretlendi.\`;`
);

// We need to also add "supply_alarm_status" as type!
content = content.replace(
  /type: "supply_alarm",\n          title,\n          body/g,
  `type: "supply_alarm_status",
          title,
          body`
);

fs.writeFileSync(file, content);
console.log('Fixed kermesSupplyFunctions.ts for admin replies');
