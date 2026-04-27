const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('LayoutDashboard')) {
    content = content.replace(/import \{([^}]+)\} from 'lucide-react';/, 'import { LayoutDashboard, ClipboardList, $1 } from \'lucide-react\';');
}

const navItemIsletme = '{ key: "isletme", label: t(\'isletme\'), icon: <Store className="w-5 h-5"/> },';
const newNavItems = `
                  { key: "dashboard", label: t('dashboard') || "Dashboard", icon: <LayoutDashboard className="w-5 h-5"/> },
                  { key: "siparisler", label: t('siparisler') || "Siparişler", icon: <ClipboardList className="w-5 h-5"/> },
                  ${navItemIsletme}`;

if (!content.includes('key: "dashboard"')) {
    content = content.replace(navItemIsletme, newNavItems);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Sidebar updated');
