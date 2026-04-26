const fs = require('fs');
const path = 'src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const promoStartMarker = '          {/* PROMOSYON & PAZARLAMA — Collapsible Section */}';
const limitsStartMarker = '          {/* Limits & Rules moved here */}';

const promoStartIndex = content.indexOf(promoStartMarker);
const limitsStartIndex = content.indexOf(limitsStartMarker);

if (promoStartIndex === -1 || limitsStartIndex === -1) {
  console.log('Markers not found');
  process.exit(1);
}

// Extract Promo block
let promoBlock = content.substring(promoStartIndex, limitsStartIndex);
content = content.substring(0, promoStartIndex) + content.substring(limitsStartIndex);

// Remove the accordion button wrapper
// We will replace the accordion button with the standard card header.
// Also remove the `{(formData as any)._promoExpanded !== false && (` wrapper.

const buttonRegex = /<button[\s\S]*?<\/button>/;
promoBlock = promoBlock.replace(buttonRegex, `
          <h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 border-b border-border pb-4">
            <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
            Promosyon & Pazarlama
          </h3>
`);

// The outer div should be standard card
promoBlock = promoBlock.replace(
  '<div className="mt-6 border border-orange-200 dark:border-orange-700/30 rounded-xl overflow-hidden">',
  '<div className="mt-6 bg-card/50 p-6 rounded-xl border border-border/50">'
);

// Remove `{(formData as any)._promoExpanded !== false && (`
promoBlock = promoBlock.replace(/\{\(formData as any\)\._promoExpanded !== false && \(/g, '');

// Remove the `)}` that was closing it.
// We just remove the last `)}` in the block before the outer `</div>`
const lastClosingBrace = promoBlock.lastIndexOf(')}');
if (lastClosingBrace !== -1) {
    promoBlock = promoBlock.substring(0, lastClosingBrace) + promoBlock.substring(lastClosingBrace + 2);
}

// Now insert promoBlock AFTER the MAIN FEATURES CARD
const kurierMarker = '          {/* KURIERLIEFERUNGEN (Kurye Siparişleri) */}';
const kurierIndex = content.indexOf(kurierMarker);

if (kurierIndex === -1) {
  console.log('Kurier marker not found');
  process.exit(1);
}

content = content.substring(0, kurierIndex) + promoBlock + '\n' + content.substring(kurierIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Moved Promosyon successfully');
