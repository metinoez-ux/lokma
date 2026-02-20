const fs = require('fs');

const pageContent = fs.readFileSync('src/app/[locale]/page.tsx', 'utf8');
const translationsMatch = pageContent.match(/const translations: Record<string, Record<string, string>> = (\{[\s\S]*?\n\});\n/);

if (translationsMatch) {
    let translationsStr = translationsMatch[1];
    // To evaluate this object string, we can temporarily assign it to module.exports
    // But since it's just a JS object literal, we can wrap it in parenthesis and eval
    const translations = eval('(' + translationsStr + ')');

    for (const [lang, msgs] of Object.entries(translations)) {
        const filename = `messages/${lang}.json`;
        let existing = {};
        if (fs.existsSync(filename)) {
            existing = JSON.parse(fs.readFileSync(filename, 'utf8'));
        }
        existing.Landing = msgs;
        fs.writeFileSync(filename, JSON.stringify(existing, null, 2));
        console.log(`Updated ${filename}`);
    }
} else {
    console.error("Could not find translations block");
}
