#!/bin/bash
sed -i '' -e '/const \[sectionDefs, setSectionDefs\] = useState<SectionDef\[\]>(\[\]);/a\
 const [deliveryZones, setDeliveryZones] = useState<KermesDeliveryZone[]>([]);' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx

sed -i '' -e '/setTableCapacity(d.tableCapacity || 0);/a\
  setDeliveryZones(d.deliveryZones || []);' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx

sed -i '' -e '/tableSectionsV2: defsToSave,/a\
  deliveryZones: newDeliveryZones ?? deliveryZones,' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx

