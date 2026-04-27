const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// We need to extract the "overview" block and "orders" block.
// Let's find their start indices.
const overviewStartMatch = content.match(/\{\s*activeTab === "overview" && \(/);
const ordersStartMatch = content.match(/\{\s*activeTab === "orders" && \(/);
const settingsStartMatch = content.match(/\{\s*activeTab === "settings" && \(/);

if (!overviewStartMatch || !ordersStartMatch || !settingsStartMatch) {
    console.error("Could not find start patterns.");
    process.exit(1);
}

function extractBlock(startIndex) {
    let braceDepth = 0;
    let inString = false;
    let escape = false;
    let startFound = false;
    for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (char === '\\') {
            escape = true;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            // simplistic string ignoring, might not handle nested templates perfectly but good enough for JSX
            // actually better to just ignore string logic for simple brace matching if we assume valid JSX.
        }
        if (char === '{') {
            startFound = true;
            braceDepth++;
        } else if (char === '}') {
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

const overviewBlock = extractBlock(overviewStartMatch.index);
const ordersBlock = extractBlock(ordersStartMatch.index);
const settingsBlock = extractBlock(settingsStartMatch.index);

if (!overviewBlock || !ordersBlock || !settingsBlock) {
    console.error("Could not extract blocks.");
    process.exit(1);
}

// 1. In settings block, we want to REMOVE the surrounding `{ activeTab === "settings" && (` and `)}`
// We know settingsBlock.text starts with `{ activeTab === "settings" && (` and ends with `)}`
let settingsInner = settingsBlock.text.replace(/\{\s*activeTab === "settings" && \(/, '');
settingsInner = settingsInner.substring(0, settingsInner.lastIndexOf(')'));
settingsInner = settingsInner.substring(0, settingsInner.lastIndexOf('}'));

// 2. We change the condition for overview and orders.
let newOverview = overviewBlock.text.replace(/activeTab === "overview"/, 'settingsSubTab === "dashboard"');
let newOrders = ordersBlock.text.replace(/activeTab === "orders"/, 'settingsSubTab === "siparisler"');

// 3. We find where the "Right Content Pane" is inside settingsInner, and insert newOverview and newOrders right after the header ends.
const rightContentPaneMatch = settingsInner.match(/\{\/\* Right Content Pane \*\/\}/);
if (!rightContentPaneMatch) {
    console.error("Could not find Right Content Pane.");
    process.exit(1);
}

const headerEndMatch = settingsInner.match(/<\/h3>[\s\S]*?<\/div>[\s\S]*?<\/div>\s*<\/div>/);
// The settings sub-tab header is complicated. It's better to just find `<div className="flex-1 w-full flex flex-col min-w-0">` 
// and insert it AFTER the `<div className="mb-6"> ... </div>` which is the header.
// Actually, let's insert them right after `</h3>` and the toggle buttons. 
// Or better yet, just at the beginning of the content area for sub-tabs!
// The content area starts where `{settingsSubTab === "isletme" && (` starts.
const contentAreaStartMatch = settingsInner.indexOf('{settingsSubTab === "isletme" && (');
if (contentAreaStartMatch === -1) {
    console.error("Could not find content area start.");
    process.exit(1);
}

let modifiedSettingsInner = 
    settingsInner.substring(0, contentAreaStartMatch) + 
    newOverview + '\n' + 
    newOrders + '\n' + 
    settingsInner.substring(contentAreaStartMatch);


// 4. Put it all back together.
// The document is basically:
// [Everything before overviewBlock]
// [settingsInner modified]
// [Everything after settingsBlock]
// Note: overviewBlock, ordersBlock, settingsBlock are sequential.
// Let's replace them in the full string.
let newContent = content.substring(0, overviewBlock.start) + modifiedSettingsInner + content.substring(settingsBlock.end);

fs.writeFileSync(file, newContent, 'utf8');
console.log('Layout successfully refactored using AST-like parsing.');
