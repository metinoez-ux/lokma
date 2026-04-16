#!/bin/bash
sed -i '' -e '/if (newSections !== undefined) setTableSections(s);/a\
  if (newDeliveryZones !== undefined) setDeliveryZones(newDeliveryZones);' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx
