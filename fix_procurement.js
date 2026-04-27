const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Insert the buttons for "Bestellungen" and "Lieferanten"
const buttonsAnchor = ` {menuInternalTab === "sponsored"
 ? "bg-amber-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 } \${!planFeatures.sponsoredProducts && admin?.adminType !== 'super' ? 'opacity-60' : ''}\`}
 >
 {!planFeatures.sponsoredProducts && admin?.adminType !== 'super' && '🔒 '}Sponsored Products ({sponsoredProducts.length})
 </button>`;

const buttonsReplacement = ` {menuInternalTab === "sponsored"
 ? "bg-amber-600 text-white"
 : "bg-muted/50 text-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/40 border border-border shadow-sm"
 } \${!planFeatures.sponsoredProducts && admin?.adminType !== 'super' ? 'opacity-60' : ''}\`}
 >
 {!planFeatures.sponsoredProducts && admin?.adminType !== 'super' && '🔒 '}Sponsored Products ({sponsoredProducts.length})
 </button>
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

if (content.includes(buttonsAnchor) && !content.includes('setMenuInternalTab("bestellungen")')) {
  content = content.replace(buttonsAnchor, buttonsReplacement);
}

// 2. Wrap the procurement logic in the new menuInternalTab logic
// The old block starts with settingsSubTab === "procurement" && (
const oldProcurementRegex = /settingsSubTab === "procurement" && \(\s*<LockedModuleOverlay featureKey="supplyChain">\s*<div className="space-y-4">\s*\{\/\* Sub-tabs \*\/\}\s*<div className="flex gap-2 mb-4">[\s\S]*?<\/div>\s*\{\/\* ═══ SUPPLIERS LIST ═══ \*\/\}\s*\{procurementSubTab === 'suppliers' && \(/m;

if (oldProcurementRegex.test(content)) {
    content = content.replace(oldProcurementRegex, 
    `(settingsSubTab === "menu" && (menuInternalTab === "bestellungen" || menuInternalTab === "lieferanten")) && (
 <LockedModuleOverlay featureKey="supplyChain">
 <div className="space-y-4">
 {/* ═══ SUPPLIERS LIST ═══ */}
 {menuInternalTab === 'lieferanten' && (`
    );
} else {
    console.log("Could not find the start of procurement UI using regex.");
}

// 3. We also need to change `{procurementSubTab === 'orders' && (` to `{menuInternalTab === 'bestellungen' && (`
const oldOrdersRegex = /\{procurementSubTab === 'orders' && \(/g;
content = content.replace(oldOrdersRegex, `{menuInternalTab === 'bestellungen' && (`);

// Also fix `t('kategoriler')` button that had an error from earlier: `{t('urunler')}{inlineProducts.length})` 
content = content.replace(/\{t\('urunler'\)\}\{inlineProducts\.length\}\)/g, "{t('urunler')} ({inlineProducts.length})");

fs.writeFileSync(file, content, 'utf8');
console.log("Updated UI for bestellungen and lieferanten tabs.");
