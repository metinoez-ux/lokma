#!/bin/bash
sed -i '' -e 's/newDefs?: SectionDef\[\]/newDefs?: SectionDef[], newDeliveryZones?: KermesDeliveryZone[]/' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx
