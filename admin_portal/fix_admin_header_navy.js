const fs = require('fs');

const headerPath = 'src/components/admin/AdminHeader.tsx';
let content = fs.readFileSync(headerPath, 'utf8');

// 1. Desktop Nav Bar Wrapper
content = content.replace(
    'bg-card border-b border-border shadow-sm',
    'bg-[#0c1527] border-b border-[#1f3053] shadow-md'
);

// 2. Desktop Nav Active Links (make them look like Ozsoft active links)
content = content.replace(
    /'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white'/g,
    "'bg-[#15223e] border border-[#1f3053] text-white shadow-inner'"
);

// 3. Desktop Nav Inactive Links (transparent light blue)
content = content.replace(
    /'text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800\/50'/g,
    "'text-slate-300 hover:text-white hover:bg-[#15223e]'"
);

// 4. Any top-right profile text that I forced to text-foreground, make it text-white
content = content.replace(
    /<span className="text-foreground text-xs font-medium/g,
    '<span className="text-white text-xs font-medium'
);

// 5. Mobile Nav Bar Wrapper (compact tablet bar)
content = content.replace(
    /min-\[1921px\]:hidden bg-background border-b border-border/g,
    'min-[1921px]:hidden bg-[#0c1527] border-b border-[#1f3053]'
);

// 6. Mobile text
content = content.replace(
    /<span className="text-foreground font-semibold/g,
    '<span className="text-white font-semibold'
);
content = content.replace(
    /text-muted-foreground text-\[10px\]/g,
    'text-slate-400 text-[10px]'
);

// Also fix the dropdowns themselves. Since they are attached to the header, they should probably be the dark theme too,
// or use standard bg-card. The dropdowns use `bg-card border-border`, which is fine (they will match the theme dark/light).
// However, the Top Navbar itself must be strictly dark navy!

fs.writeFileSync(headerPath, content);
console.log('AdminHeader converted to static Ozsoft Deep Navy');
