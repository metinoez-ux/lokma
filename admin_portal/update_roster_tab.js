const fs = require('fs');
const path = require('path');

const filePath = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add props
content = content.replace(
  'kermesEnd: string; // YYYY-MM-DD\n}',
  'kermesEnd: string; // YYYY-MM-DD\n  isSuperAdmin?: boolean;\n  adminGender?: string;\n}'
);
content = content.replace(
  'export default function KermesRosterTab({ kermesId, assignedStaffIds, workspaceStaff, adminUid, kermesStart, kermesEnd }: KermesRosterTabProps) {',
  'export default function KermesRosterTab({ kermesId, assignedStaffIds, workspaceStaff, adminUid, kermesStart, kermesEnd, isSuperAdmin, adminGender }: KermesRosterTabProps) {'
);

// 2. Fix getUserName 
const oldGetUserName = `  const getUserName = (userId: string) => {
    const s = workspaceStaff.find(w => w.id === userId || w.userId === userId);
    return s?.profile?.name || s?.name || 'Bilinmiyor / Seçimsiz';
  };`;
const newGetUserName = `  const getUserName = (userId: string) => {
    const s = workspaceStaff.find(w => w.id === userId || w.userId === userId);
    if (!s) return 'Bilinmiyor / Seçiniz';
    return s.profile?.name || s.name || (s.firstName ? \`\${s.firstName} \${s.lastName || ''}\`.trim() : '') || 'İsimsiz';
  };`;
content = content.replace(oldGetUserName, newGetUserName);

// 3. Filter staff by gender
const listVarsCode = `
  // Gender-based access control
  const isMaleAdmin = adminGender === 'male' || adminGender === 'erkek';
  const isFemaleAdmin = adminGender === 'female' || adminGender === 'kadin';

  const allowedStaffIds = assignedStaffIds.filter(uid => {
    if (isSuperAdmin) return true;
    const staff = workspaceStaff.find(w => w.id === uid || w.userId === uid);
    const staffGender = staff?.gender || staff?.profile?.gender || '';
    const isMaleStaff = staffGender === 'male' || staffGender === 'erkek';
    const isFemaleStaff = staffGender === 'female' || staffGender === 'kadin';
    
    if (isFemaleAdmin && isMaleStaff) return false;
    if (isMaleAdmin && isFemaleStaff) return false;
    return true;
  });

  const allowedRosters = rosters.filter(r => {
    if (isSuperAdmin) return true;
    const staff = workspaceStaff.find(w => w.id === r.userId || w.userId === r.userId);
    const staffGender = staff?.gender || staff?.profile?.gender || '';
    const isMaleStaff = staffGender === 'male' || staffGender === 'erkek';
    const isFemaleStaff = staffGender === 'female' || staffGender === 'kadin';
    
    if (isFemaleAdmin && isMaleStaff) return false;
    if (isMaleAdmin && isFemaleStaff) return false;
    return true;
  });

  // Group by date for display
  const groupedRosters = allowedRosters.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {} as Record<string, KermesRoster[]>);
`;

content = content.replace(
  `  // Group by date for display
  const groupedRosters = rosters.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {} as Record<string, KermesRoster[]>);`,
  listVarsCode
);

// 4. Update the Select Map loop
content = content.replace(
  `{assignedStaffIds.map(uid => (`,
  `{allowedStaffIds.map(uid => (`
);

// 5. Update Grid Layout
const oldGrid = `<form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="space-y-1 md:col-span-6 xl:col-span-3">
            <label className="text-xs text-muted-foreground">Personel Seç</label>`;

const newGrid = `<form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
                <label className="text-xs text-muted-foreground">Personel Seç</label>
                <a href="?tab=personel" className="text-[10px] text-blue-500 hover:underline">Yeni Ekle</a>
            </div>`;

content = content.replace(oldGrid, newGrid);

// Grid replacements for others
content = content.replace(
  `<div className="space-y-1 md:col-span-6 xl:col-span-3">
            <label className="text-xs text-muted-foreground">Görev / Rol</label>`,
  `<div className="space-y-1">
            <label className="text-xs text-muted-foreground">Görev / Rol</label>`
);

content = content.replace(
  `<div className="space-y-1 md:col-span-4 xl:col-span-2">
            <label className="text-xs text-muted-foreground">Tarih</label>`,
  `<div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tarih</label>`
);

content = content.replace(
  `<div className="space-y-1 md:col-span-5 xl:col-span-3">
            <label className="text-xs text-muted-foreground">Saat (Başlangıç - Bitiş)</label>`,
  `<div className="space-y-1">
            <label className="text-xs text-muted-foreground">Saat (Başlangıç - Bitiş)</label>`
);

content = content.replace(
  `<div className="md:col-span-3 xl:col-span-1">
            <button`,
  `<div>
            <button`
);

fs.writeFileSync(filePath, content);
console.log('KermesRosterTab.tsx updated');
