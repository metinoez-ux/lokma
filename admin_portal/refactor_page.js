const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove activeTab state
content = content.replace(/const \[activeTab, setActiveTab\] = useState<\n[^\>]+>\(initialTab\);/g, '');
// Replace initialSubTab default
content = content.replace(/\| 'saatler' \|\| 'isletme'/g, "| 'saatler' || 'dashboard'");
content = content.replace(/useState<\n\s*"isletme"/g, 'useState<\n    "dashboard" | "siparisler" | "isletme"');

// 2. Remove the top Navigation Tabs from Header
const headerTabsRegex = /\{\/\* Tabs \+ Ayarlar Dropdown \*\/\}[\s\S]*?<\/header>/;
content = content.replace(headerTabsRegex, '</header>');

// 3. Move the Overview and Orders to be inside the Right Content Pane
// Let's find the start of overview:
//   {/* Overview Tab */}
//   {activeTab === "overview" && (
const overviewStart = content.indexOf('{/* Overview Tab */}');
const ordersStart = content.indexOf('{/* Orders Tab */}');
const settingsStart = content.indexOf('{/* Settings Tab (Unified Layout) */}');

const overviewContent = content.substring(overviewStart, ordersStart);
const ordersContent = content.substring(ordersStart, settingsStart);

// Remove activeTab === "overview" && (  wrapper
let newOverview = overviewContent.replace(/\{activeTab === "overview" && \(/, '{settingsSubTab === "dashboard" && (');
// Remove activeTab === "orders" && ( wrapper
let newOrders = ordersContent.replace(/\{activeTab === "orders" && \(/, '{settingsSubTab === "siparisler" && (');

// Remove these sections from their original place
content = content.substring(0, overviewStart) + content.substring(settingsStart);

// Now we need to insert newOverview and newOrders into the Right Content Pane.
// We'll insert it right after the Settings Sub-Tab Header closing div.
// Find:
//   {settingsSubTab === "isletme" && t('isletmeAyarlari')}
//   ...
//   </h3>
//   </div>
const rightContentHeaderEndRegex = /<\/h3>\s*<\/div>/;
const match = content.match(rightContentHeaderEndRegex);

if (match) {
    const insertPos = match.index + match[0].length;
    content = content.substring(0, insertPos) + '\n\n' + newOverview + '\n\n' + newOrders + '\n\n' + content.substring(insertPos);
}

// 4. Update the Left Sidebar Menu items
const navItemIsletme = '{ key: "isletme", label: t(\'isletme\'), icon: <Store className="w-5 h-5"/> },';
const newNavItems = `
                  { key: "dashboard", label: t('dashboard') || "Dashboard", icon: <LayoutDashboard className="w-5 h-5"/> },
                  { key: "siparisler", label: t('siparisler') || "Siparişler", icon: <ClipboardList className="w-5 h-5"/> },
                  ${navItemIsletme}`;
content = content.replace(navItemIsletme, newNavItems);

// 5. Remove `activeTab === "settings" && (` wrapper
content = content.replace(/activeTab === "settings" && \(/, '(');

// Add LayoutDashboard and ClipboardList to imports from lucide-react
if (!content.includes('LayoutDashboard')) {
    content = content.replace(/import \{([^}]+)\} from 'lucide-react';/, 'import { LayoutDashboard, ClipboardList, $1 } from \'lucide-react\';');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Refactor script applied.');
