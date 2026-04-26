const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The block starts with "{/* 4. Masa & Rezervasyon Modülü */}"
// Let's count occurrences
const parts = content.split('{/* 4. Masa & Rezervasyon Modülü */}');
if (parts.length > 2) {
  // It appears more than once. We keep parts[0], parts[1], and the REST AFTER the duplicated block.
  // We need to carefully remove the second one.
  
  // Find the exact block to remove. We can just use string replacement on the first duplicate we find after the first one.
  // Actually, we can just split by "Masa & Rezervasyon Modülü", but wait, the content might be slightly different.
  
  // Let's just find the indices and remove the first occurrence.
  const idx1 = content.indexOf('{/* 4. Masa & Rezervasyon Modülü */}');
  const idx2 = content.indexOf('{/* 4. Masa & Rezervasyon Modülü */}', idx1 + 1);
  
  if (idx2 !== -1) {
    const endIdx2 = content.indexOf('{/* Plan Durumu - Basitleştirilmiş */}', idx2);
    if (endIdx2 !== -1) {
      const newContent = content.substring(0, idx2) + content.substring(endIdx2);
      fs.writeFileSync(file, newContent, 'utf8');
      console.log("Removed duplicated block successfully.");
    }
  }
}
