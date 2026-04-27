const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

function extractBlock(startIndex) {
    let braceDepth = 0;
    let startFound = false;
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            startFound = true;
            braceDepth++;
        } else if (content[i] === '}') {
            braceDepth--;
            if (startFound && braceDepth === 0) {
                return {
                    start: startIndex,
                    end: i + 1,
                    text: content.substring(startIndex, i + 1)
                };
            }
        }
    }
    return null;
}

// 1. Extract blocks
const overviewMatch = content.match(/\{\s*activeTab === "overview" && \(/);
const overviewBlock = extractBlock(overviewMatch.index);

const ordersMatch = content.match(/\{\s*activeTab === "orders" && \(/);
const ordersBlock = extractBlock(ordersMatch.index);

// 2. Remove them from top level
content = content.substring(0, ordersBlock.start) + content.substring(ordersBlock.end);
content = content.substring(0, overviewBlock.start) + content.substring(overviewBlock.end);

// 3. Rename condition
let newOverview = overviewBlock.text.replace(/activeTab === "overview"/, 'settingsSubTab === "dashboard"');
let newOrders = ordersBlock.text.replace(/activeTab === "orders"/, 'settingsSubTab === "siparisler"');

// 4. Remove activeTab === "settings" wrapper
const settingsMatch = content.match(/\{\s*activeTab === "settings" && \(/);
const settingsBlock = extractBlock(settingsMatch.index);

// Remove the outer `{ activeTab === "settings" && (`
let settingsInner = settingsBlock.text.replace(/\{\s*activeTab === "settings" && \(/, '');
// Remove the matching `)}` at the end
settingsInner = settingsInner.replace(/\)\s*\}\s*$/, '');

// 5. Insert newOverview and newOrders inside RightContentPane
const insertTarget = '<div className="flex-1 w-full flex flex-col min-w-0">';
const insertPos = settingsInner.indexOf(insertTarget);
if (insertPos !== -1) {
    settingsInner = 
        settingsInner.substring(0, insertPos + insertTarget.length) + '\n\n' +
        newOverview + '\n\n' +
        newOrders + '\n\n' +
        settingsInner.substring(insertPos + insertTarget.length);
} else {
    console.error("Could not find insertTarget");
    process.exit(1);
}

content = content.substring(0, settingsBlock.start) + settingsInner + content.substring(settingsBlock.end);

// 6. Remove Tabs + Ayarlar Dropdown
const tabsHeaderStart = content.indexOf('{/* Tabs + Ayarlar Dropdown */}');
const tabsHeaderEndStr = `</header>\n        )}`;
const tabsHeaderEnd = content.indexOf(tabsHeaderEndStr, tabsHeaderStart);

if (tabsHeaderStart !== -1 && tabsHeaderEnd !== -1) {
    const toRemoveStart = content.lastIndexOf('<div className="flex flex-wrap items-center gap-1.5 mt-3">', tabsHeaderEnd);
    if (toRemoveStart !== -1) {
        let depth = 0;
        let foundEnd = -1;
        for (let i = toRemoveStart; i < content.length; i++) {
            if (content.substr(i, 4) === '<div') depth++;
            else if (content.substr(i, 5) === '</div') {
                depth--;
                if (depth === 0) {
                    foundEnd = i + 6;
                    break;
                }
            }
        }
        if (foundEnd !== -1) {
            content = content.substring(0, tabsHeaderStart) + content.substring(foundEnd);
        }
    }
}

// 7. Add Dashboard and Siparisler to sidebar list
if (!content.includes('LayoutDashboard')) {
    content = content.replace(/import \{([^}]+)\} from 'lucide-react';/, 'import { LayoutDashboard, ClipboardList, $1 } from \'lucide-react\';');
}

const navItemIsletme = '{ key: "isletme", label: t(\'isletme\'), icon: <Store className="w-5 h-5"/> },';
const newNavItems = `
                  { key: "dashboard", label: t('dashboard') || "Dashboard", icon: <LayoutDashboard className="w-5 h-5"/> },
                  { key: "siparisler", label: t('siparisler') || "Siparişler", icon: <ClipboardList className="w-5 h-5"/> },
                  ${navItemIsletme}`;

if (!content.includes('key: "dashboard"')) {
    content = content.replace(navItemIsletme, newNavItems);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Rewrite successful.");
