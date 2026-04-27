const fs = require('fs');

const bus = fs.readFileSync('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'utf8');

const regex = /const analytics = useMemo\(\(\) => \{[\s\S]*?return \{[\s\S]*?hourlyDistribution,[\s\S]*?dailyDistribution,[\s\S]*?typeBreakdown,[\s\S]*?totalRevenue[\s\S]*?\};/m;

const match = bus.match(regex);
if (match) {
    console.log(match[0]);
} else {
    console.log("Not found");
}

