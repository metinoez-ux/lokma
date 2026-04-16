#!/bin/bash
sed -i '' -e 's/saveData(t2, m, c, s, newDefs);/saveData(t2, m, c, s, newDefs, newDeliveryZones);/' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx
