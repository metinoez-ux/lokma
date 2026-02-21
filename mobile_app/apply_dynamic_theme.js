const fs = require('fs');

// These files are the highest offenders for hardcoded Colors
const targets = [
    'lib/screens/marketplace/kasap/business_detail_screen.dart',
    'lib/screens/marketplace/restoran/restoran_screen.dart',
    'lib/screens/marketplace/kasap/cart_screen.dart',
    'lib/screens/kermes/kermes_parking_screen.dart',
    'lib/screens/kermes/kermes_detail_sheet.dart',
    'lib/screens/auth/login_screen.dart',
    'lib/screens/kermes/kermes_checkout_sheet.dart',
    'lib/screens/kermes/kermes_menu_screen.dart',
    'lib/screens/staff/staff_hub_screen.dart'
];

function replaceColors(filePath) {
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // A common dark mode anti-pattern:
    // color: Colors.black -> replace with dynamic text color or icon color
    // Usually, text/icons that are black in light mode should be white in dark mode:
    // This is typically Theme.of(context).colorScheme.onSurface or onBackground
    // We can use a simpler approach for direct colors: 
    // Theme.of(context).textTheme.bodyMedium?.color
    // Or Theme.of(context).colorScheme.onSurface

    // Backgrounds that are white in light mode should be surface color in dark mode
    // Colors.white -> Theme.of(context).colorScheme.surface
    // BUT sometimes white is meant to stay white (e.g. over an image).
    // The most robust search and replace for general structural blocks:

    // Replace text/icon colors
    content = content.replace(/color:\s*Colors\.black87/g, 'color: Theme.of(context).colorScheme.onSurface.withOpacity(0.87)');
    content = content.replace(/color:\s*Colors\.black54/g, 'color: Theme.of(context).colorScheme.onSurface.withOpacity(0.54)');
    content = content.replace(/color:\s*Colors\.black38/g, 'color: Theme.of(context).colorScheme.onSurface.withOpacity(0.38)');
    content = content.replace(/color:\s*Colors\.black12/g, 'color: Theme.of(context).colorScheme.onSurface.withOpacity(0.12)');
    content = content.replace(/color:\s*Colors\.black26/g, 'color: Theme.of(context).colorScheme.onSurface.withOpacity(0.26)');

    // Pure black/white
    content = content.replace(/color:\s*Colors\.black(?![\w])/g, 'color: Theme.of(context).colorScheme.onSurface');
    // Often Containers/Cards are white.
    // Replace `color: Colors.white` with `color: Theme.of(context).colorScheme.surface`
    content = content.replace(/color:\s*Colors\.white(?![\w])/g, 'color: Theme.of(context).colorScheme.surface');

    // TextStyles
    // If it's pure white text inside a container, it usually means it's over a primary color, 
    // where it should stay white even in dark mode (onPrimary is white in both themes).
    // Therefore, naive Colors.white replacement is risky for text over primary buttons.
    // However, if it's the main surface background, it should be dynamic.

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Refactored dynamic colors in: ${filePath}`);
    } else {
        console.log(`No verifiable color changes safe to auto-replace in: ${filePath}`);
    }
}

targets.forEach(replaceColors);
