const fs = require('fs');

const file = 'src/app/[locale]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import { useTranslations } from 'next-intl';
if (!content.includes("import { useTranslations }")) {
    content = content.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { useTranslations } from 'next-intl';");
}

// 2. Remove the heavy translations object
content = content.replace(/\/\/ Translations\nconst translations: Record<string, Record<string, string>> = \{[\s\S]*?\n\};\n\n/, '');

// 3. Replace the 'const t = translations...' assignment
const oldAssignment = "const t = translations[currentLang] || translations.tr;";
const newAssignment = "const t = useTranslations('Landing');";
content = content.replace(oldAssignment, newAssignment);

// 4. Replace t.property with t('property') globally
// Careful regex to only catch valid object properties (e.g. t.home -> t('home'))
content = content.replace(/\bt\.([a-zA-Z0-9_]+)\b/g, "t('$1')");

fs.writeFileSync(file, content, 'utf8');
console.log("Refactoring complete");
