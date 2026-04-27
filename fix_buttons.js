const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = `{!planFeatures.sponsoredProducts && admin?.adminType !== 'super' && '🔒 '}Sponsored Products ({sponsoredProducts.length})\n </button>`;

const addition = `
 <button
 onClick={() => setMenuInternalTab("bestellungen")}
 className={\`px-4 py-2 rounded-t-lg text-sm font-medium transition \${menuInternalTab === "bestellungen"
 ? "bg-red-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 }\`}
 >
 {!planFeatures.supplyChain && admin?.adminType !== 'super' && '🔒 '}{t('procurement_orders') || 'Bestellungen'}
 </button>
 <button
 onClick={() => setMenuInternalTab("lieferanten")}
 className={\`px-4 py-2 rounded-t-lg text-sm font-medium transition \${menuInternalTab === "lieferanten"
 ? "bg-red-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 }\`}
 >
 {!planFeatures.supplyChain && admin?.adminType !== 'super' && '🔒 '}{t('procurement_suppliers') || 'Lieferanten'}
 </button>`;

if (content.includes(anchor) && !content.includes('setMenuInternalTab("bestellungen")')) {
  content = content.replace(anchor, anchor + addition);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Success: Inserted tabs.");
} else {
  console.log("Failed: Anchor not found or already inserted.");
}
