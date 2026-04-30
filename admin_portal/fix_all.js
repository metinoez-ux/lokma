const fs = require('fs');

// 1. Fix admin/dashboard/page.tsx
const dashFile = 'src/app/[locale]/admin/dashboard/page.tsx';
let dashContent = fs.readFileSync(dashFile, 'utf8');

dashContent = dashContent.replace(
  "export default function StatisticsPage({ embedded = false, isKermesMode = false }: { embedded?: boolean; isKermesMode?: boolean; kermesStartDate?: Date }) {",
  "export default function StatisticsPage({ embedded = false, isKermesMode = false, kermesId, kermesStartDate, kermesEndDate }: { embedded?: boolean; isKermesMode?: boolean; kermesStartDate?: Date; kermesEndDate?: Date; kermesId?: string }) {"
);

dashContent = dashContent.replace(
  "const adminBusinessId = useAdminBusinessId();",
  `const adminBusinessId = useAdminBusinessId();
 const effectiveBusinessId = isKermesMode && kermesId ? kermesId : adminBusinessId;`
);

dashContent = dashContent.replace(
  "const { orders, loading: ordersLoading } = useOrdersStandalone({ initialDateFilter: 'all' });",
  "const { orders, loading: ordersLoading } = useOrdersStandalone({ businessId: effectiveBusinessId, initialDateFilter: 'all' });"
);

fs.writeFileSync(dashFile, dashContent);

// 2. Fix admin/kermes/[id]/KermesDashboardTab.tsx
const kDashFile = 'src/app/[locale]/admin/kermes/[id]/KermesDashboardTab.tsx';
let kDashContent = fs.readFileSync(kDashFile, 'utf8');

kDashContent = kDashContent.replace(
  "<StatisticsPage \n          embedded={true} \n          isKermesMode={true} \n          kermesStartDate={kermesStart ? new Date(kermesStart) : new Date()} \n          kermesEndDate={kermesEnd ? new Date(kermesEnd) : undefined}\n        />",
  "<StatisticsPage \n          embedded={true} \n          isKermesMode={true} \n          kermesId={kermesId}\n          kermesStartDate={kermesStart ? new Date(kermesStart) : new Date()} \n          kermesEndDate={kermesEnd ? new Date(kermesEnd) : undefined}\n        />"
);
fs.writeFileSync(kDashFile, kDashContent);

// 3. Fix admin/kermes/[id]/page.tsx
const kPageFile = 'src/app/[locale]/admin/kermes/[id]/page.tsx';
let kPageContent = fs.readFileSync(kPageFile, 'utf8');

kPageContent = kPageContent.replace(
  `{activeTab === "vardiya" && (
  <div className="max-w-5xl mx-auto">
   <KermesRosterTab
     kermesId={kermesId as string}
     assignedStaffIds={[...new Set([...assignedStaff, ...assignedDrivers, ...assignedWaiters])]}
     workspaceStaff={assignedStaffDetails}
     adminUid={adminUid}
     kermesStart={editForm.date}
     kermesEnd={editForm.endDate}
     isSuperAdmin={isSuperAdmin}
     adminGender={(admin as any)?.gender || (admin as any)?.profile?.gender || 'unknown'}
     kermesSections={editForm.tableSectionsV2 || []}
     customRoles={(editForm.customRoles || [])}
     isAdmin={canManageStaff}
   />
  </div>
 )}`,
  `{activeTab === "vardiya" && (
  <div className="w-full">
   <KermesRosterTab
     kermesId={kermesId as string}
     assignedStaffIds={[...new Set([...assignedStaff, ...assignedDrivers, ...assignedWaiters])]}
     workspaceStaff={assignedStaffDetails}
     adminUid={adminUid}
     kermesStart={kermes?.startDate?.toDate?.()?.toISOString()?.split('T')[0] || kermes?.date?.toDate?.()?.toISOString()?.split('T')[0] || editForm.date}
     kermesEnd={kermes?.endDate?.toDate?.()?.toISOString()?.split('T')[0] || editForm.endDate}
     isSuperAdmin={isSuperAdmin}
     adminGender={(admin as any)?.gender || (admin as any)?.profile?.gender || 'unknown'}
     kermesSections={editForm.tableSectionsV2 || []}
     customRoles={(editForm.customRoles || [])}
     isAdmin={canManageStaff}
   />
  </div>
 )}`
);
fs.writeFileSync(kPageFile, kPageContent);

console.log("Fixed all 3 files.");
