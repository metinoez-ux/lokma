const fs = require('fs');

// 1. Fix AdminHeader.tsx
const headerPath = 'src/components/admin/AdminHeader.tsx';
let headerContent = fs.readFileSync(headerPath, 'utf8');

// The massive red container
headerContent = headerContent.replace(
    'bg-gradient-to-r from-red-800 via-rose-700 to-red-800 border-b border-red-900',
    'bg-card border-b border-border'
);

// The active nav links
headerContent = headerContent.replace(
    /'bg-white\/15 text-white'/g,
    "'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white'"
);

// The inactive nav links
headerContent = headerContent.replace(
    /'text-blue-100 hover:text-white hover:bg-white\/10'/g,
    "'text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800/50'"
);

// Top right profile text
headerContent = headerContent.replace(
    /<span className="text-white text-xs font-medium/g,
    '<span className="text-foreground text-xs font-medium'
);
headerContent = headerContent.replace(
    /<span className="text-blue-200/g,
    '<span className="text-muted-foreground'
);

fs.writeFileSync(headerPath, headerContent);


// 2. Fix Analytics buttons
const analyticsPath = 'src/app/[locale]/admin/analytics/page.tsx';
if (fs.existsSync(analyticsPath)) {
    let analyticsContent = fs.readFileSync(analyticsPath, 'utf8');

    // Currently: 'bg-gray-700 text-foreground hover:bg-gray-600'
    analyticsContent = analyticsContent.replace(
        /'bg-gray-700 text-foreground hover:bg-gray-600'/g,
        "'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
    );

    // Active button: 'bg-amber-600 text-white' (Wait, grep said bg-amber-600 text-white but my regex maybe didn't hit it or they had a previous issue)
    // Looking at grep: it was bg-amber-600 text-white. We can keep it that way, but let's make it more robust.
    analyticsContent = analyticsContent.replace(
        /'bg-amber-600 text-foreground'/g, // just in case
        "'bg-amber-600 text-white shadow-sm'"
    );

    fs.writeFileSync(analyticsPath, analyticsContent);
}

console.log('Fixed Header and Analytics Buttons!');
