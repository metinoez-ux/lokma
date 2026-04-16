const fs = require('fs');
const p = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/kermes-tv/[kermesId]/page.tsx';
let d = fs.readFileSync(p, 'utf8');

d = d.replace(/const deliveryZoneId = searchParams\.get\('deliveryZone'\) \|\| null;/,
"const deliveryZoneId = searchParams.get('deliveryZone') || null;\n  const legacySection = searchParams.get('section') || null;");

d = d.replace(/if \(deliveryZoneId && data\.deliveryZones\) \{[\s\S]*?setActiveDeliveryZone\(dz\);\s*setSectionLabel\(dz\.name\);\s*return;\s*\}\s*\}/,
`if (deliveryZoneId && data.deliveryZones) {
             const dz = data.deliveryZones.find((d: any) => d.id === deliveryZoneId);
             if (dz) {
               setActiveDeliveryZone(dz);
               setSectionLabel(dz.name);
             }
          } else if (legacySection) {
             setActiveDeliveryZone({
               id: 'legacy',
               name: legacySection,
               sectionFilter: legacySection,
               prepZoneFilters: []
             });
             setSectionLabel(legacySection);
          }`);

fs.writeFileSync(p, d);
console.log("Patched section filtering");
