const fs = require('fs');
const path = require('path');
const dir = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/messages';

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.json')) {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    content = content.replace(/👨‍🍳 /g, '');
    content = content.replace(/🪑 /g, '');
    fs.writeFileSync(path.join(dir, file), content, 'utf8');
  }
});
console.log("Emojis removed from all languages.");
