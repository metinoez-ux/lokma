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

const overviewMatch = content.match(/\{\s*activeTab === "overview" && \(/);
const overviewBlock = extractBlock(overviewMatch.index);

const ordersMatch = content.match(/\{\s*activeTab === "orders" && \(/);
const ordersBlock = extractBlock(ordersMatch.index);

const settingsMatch = content.match(/\{\s*activeTab === "settings" && \(/);
const settingsBlock = extractBlock(settingsMatch.index);

// 1. Remove overview and orders from content
// We need to replace them with empty string. Since we are replacing by index, we should do it from end to start to not mess up indices.
// orders is after overview, so:
content = content.substring(0, ordersBlock.start) + content.substring(ordersBlock.end);
content = content.substring(0, overviewBlock.start) + content.substring(overviewBlock.end);

// 2. Change their condition names
let newOverview = overviewBlock.text.replace(/activeTab === "overview"/, 'settingsSubTab === "dashboard"');
let newOrders = ordersBlock.text.replace(/activeTab === "orders"/, 'settingsSubTab === "siparisler"');

// 3. Find the right content pane start inside the NOW MODIFIED content
// Wait, we also need to remove `{ activeTab === "settings" && (` from the file.
// The settings block is now shifted!
const newSettingsMatch = content.match(/\{\s*activeTab === "settings" && \(/);
const newSettingsBlock = extractBlock(newSettingsMatch.index);

// Let's strip the outer `{ activeTab === "settings" && (` and `)}` from settings.
let settingsInner = newSettingsBlock.text.replace(/\{\s*activeTab === "settings" && \(/, '');
settingsInner = settingsInner.substring(0, settingsInner.lastIndexOf(')'));
settingsInner = settingsInner.substring(0, settingsInner.lastIndexOf('}'));

// Find where to insert overview and orders in settingsInner
// We want to insert them right after the header ends, or just before `{settingsSubTab === "isletme"`
const insertPos = settingsInner.indexOf('{settingsSubTab === "isletme"');
if (insertPos === -1) {
    console.error("Could not find insertion position.");
    process.exit(1);
}

let modifiedSettingsInner = 
    settingsInner.substring(0, insertPos) + 
    newOverview + '\n\n' + 
    newOrders + '\n\n' + 
    settingsInner.substring(insertPos);

// Replace the original settings block with the modified inner block
content = content.substring(0, newSettingsBlock.start) + modifiedSettingsInner + content.substring(newSettingsBlock.end);

fs.writeFileSync(file, content, 'utf8');
console.log('Chunks moved successfully!');
