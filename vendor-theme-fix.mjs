import fs from 'fs';

let content = fs.readFileSync('admin_portal/src/app/[locale]/vendor/page.tsx', 'utf-8');

// Header & Footer
content = content.replace(/<PublicHeader themeAware=\{false\} \/>/g, '<PublicHeader themeAware={true} />');
content = content.replace(/<PublicFooter themeAware=\{false\} \/>/g, '<PublicFooter themeAware={true} />');

// Global Container
content = content.replace(/bg-white text-gray-900/g, 'bg-background text-foreground');

// Sections
content = content.replace(/bg-white/g, 'bg-background');
content = content.replace(/bg-gray-50/g, 'bg-muted/30');
content = content.replace(/border-gray-100/g, 'border-border/50');
content = content.replace(/border-gray-200/g, 'border-border');

// Text Colors
content = content.replace(/text-gray-900/g, 'text-foreground');
content = content.replace(/text-gray-600/g, 'text-muted-foreground');
content = content.replace(/text-gray-500/g, 'text-muted-foreground');

// Buttons / Cards
content = content.replace(/bg-gray-900/g, 'bg-foreground');
content = content.replace(/hover:bg-black/g, 'hover:bg-foreground/90');
content = content.replace(/text-white px-8/g, 'text-background px-8');
content = content.replace(/shadow-gray-900\/20/g, 'shadow-foreground/10');
content = content.replace(/bg-white text-gray-900/g, 'bg-background text-foreground');
content = content.replace(/hover:bg-gray-50/g, 'hover:bg-muted');

// White cards
content = content.replace(/bg-white p-4/g, 'bg-card p-4');
content = content.replace(/bg-white rounded-\[2rem\]/g, 'bg-card rounded-[2rem]');

// Specific fixes that might have been broken by global replace
content = content.replace(/bg-foreground text-background/g, 'bg-foreground text-background'); // Just to be sure

// Fix Smart Scale explicitly dark section
content = content.replace(/bg-foreground text-white relative/g, 'bg-gray-900 dark:bg-[#15223e] text-white relative');

fs.writeFileSync('admin_portal/src/app/[locale]/vendor/page.tsx', content, 'utf-8');
console.log("Vendor page theme refactoring complete.");
