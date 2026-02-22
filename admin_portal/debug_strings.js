const fs = require('fs');

function findStrings(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const trRegex = /['"\`][^'"\`\n]*[çğıöşüÇĞİÖŞÜ][^'"\`\n]*['"\`]/g;
    const matches = code.match(trRegex) || [];

    // Filter out classnames that might have these chars by coincidence though rare
    const validMatches = matches.filter(m => !m.includes('bg-') && !m.includes('text-'));

    console.log(`${filePath}: ${validMatches.length} matches`);
    if (validMatches.length > 0) {
        console.log(' Samples:', validMatches.slice(0, 5));
    }
}

findStrings('src/app/[locale]/admin/dashboard/page.tsx');
findStrings('src/app/[locale]/admin/settings/page.tsx');
