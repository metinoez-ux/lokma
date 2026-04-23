import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface Assignment {
 id: string; // The ID of the business/kermes
 entityName: string; // The display name
 role: string; // The role like 'lokma_admin', 'kermes_admin', 'staff', 'driver'
 entityType: 'business' | 'kermes'; // Helps differentiate
 assignedAt?: string;
}

interface WorkspaceAssignmentsListProps {
 assignments: Assignment[];
 onChange: (newAssignments: Assignment[]) => void;
 businesses: any[];
 kermesEvents: any[];
 isSuperAdmin: boolean;
 globalRole?: string;
}

const KERMES_ROLES = [
 { value: 'staff', label: 'Kermes Personeli', icon: '👥', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
 { value: 'driver', label: 'Kermes Sürücü', icon: '🚗', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
 { value: 'waiter', label: 'Kermes Garson', icon: '🍽️', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
 { value: 'kermes_admin', label: 'Kermes Admin', icon: '👑', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
];

const BUSINESS_ROLES = [
 { value: 'admin', label: 'Yönetici (Admin)', icon: '👑', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
 { value: 'staff', label: 'Personel (Standart)', icon: '👥', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
];

export function WorkspaceAssignmentsList({ assignments, onChange, businesses, kermesEvents, isSuperAdmin, globalRole }: WorkspaceAssignmentsListProps) {
 const t = useTranslations('AdminNav');
 const [showAdd, setShowAdd] = useState(false);
 const [selectedEntityId, setSelectedEntityId] = useState('');
 const [selectedRoles, setSelectedRoles] = useState<string[]>(['staff']);
 const [searchQuery, setSearchQuery] = useState('');
 const [isDropdownOpen, setIsDropdownOpen] = useState(false);

 // Determine if selected entity is a kermes
 const isSelectedKermes = kermesEvents.some(k => k.id === selectedEntityId);
 const roleOptions = isSelectedKermes ? KERMES_ROLES : BUSINESS_ROLES;

 const toggleRole = (role: string) => {
  setSelectedRoles(prev => 
   prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
  );
 };

 const handleAdd = () => {
  if (!selectedEntityId) return;
  
  // Determine entity type and name
   let entityName = '';
   let entityType: 'business' | 'kermes' = 'business';
   
   const b = businesses.find(x => x.id === selectedEntityId);
   if (b) {
    entityName = b.name;
    entityType = 'business';
   } else {
    const k = kermesEvents.find(x => x.id === selectedEntityId);
    if (k) {
     entityName = k.name;
     entityType = 'kermes';
    }
   }

   if (!entityName) return;

   let rolesToAdd = selectedRoles;
   
   // If it's a business, auto-determine the role based on globalRole to avoid redundancy
   if (entityType === 'business') {
     const isBusinessAdmin = ['business_admin', 'lokma_admin', 'super'].includes(globalRole || '');
     rolesToAdd = [isBusinessAdmin ? 'admin' : 'staff'];
   }

   // Add one assignment per selected role
   const newAssignments = [...assignments];
   for (const role of rolesToAdd) {
    if (newAssignments.find(a => a.id === selectedEntityId && a.role === role)) {
     continue; // Skip duplicates
    }
    newAssignments.push({
     id: selectedEntityId,
     entityName,
     role,
     entityType,
     assignedAt: new Date().toISOString()
    });
   }

   onChange(newAssignments);
   setSelectedEntityId('');
   setSelectedRoles(['staff']);
   setShowAdd(false);
  };

 const handleRemove = (index: number) => {
  const arr = [...assignments];
  arr.splice(index, 1);
  onChange(arr);
 };

 const getRoleBadgeStyle = (role: string, entityType: string) => {
  if (entityType === 'kermes') {
   const found = KERMES_ROLES.find(r => r.value === role);
   if (found) return found.color;
  } else {
   const found = BUSINESS_ROLES.find(r => r.value === role);
   if (found) return found.color;
  }
  return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
 };

 const allEntities = [...businesses.map(b => ({...b, _type: 'business'})), ...kermesEvents.map(k => ({...k, _type: 'kermes'}))];

 return (
  <div className="space-y-3">
   <div className="flex justify-between items-center">
    <label className="block text-sm font-medium text-foreground">
     {t('isletme_atamalari') || 'Betriebs- / Kermes-Zuweisungen'} ({assignments.length})
    </label>
    {isSuperAdmin && (
     <button 
      type="button" 
      onClick={() => setShowAdd(true)}
      className="text-xs bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/40 dark:text-pink-300 px-3 py-1.5 rounded-lg transition"
     >
      {t('rolEkle', { defaultValue: '+ Rolle hinzufügen' })}
     </button>
    )}
   </div>

   {assignments.length === 0 ? (
    <div className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-lg text-center bg-muted/20">
     {t('henuzAtamaYok', { defaultValue: 'Henüz atama yapılmamış. Kullanıcı global yetkilere sahip olabilir.' })}
    </div>
   ) : (
    <div className="space-y-2">
     {assignments.map((a, idx) => (
      <div key={`${a.id}-${a.role}-${idx}`} className="flex justify-between items-center bg-card border border-border p-3 rounded-lg">
       <div>
        <div className="font-medium text-sm text-foreground flex items-center gap-2 flex-wrap">
         <span className="font-bold">{a.entityName}</span>
         <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide ${a.entityType === 'kermes' ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800' : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'}`}>
          {a.entityType === 'kermes' ? 'Kermes' : t('isletme', { defaultValue: 'Isletme' })}
         </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
         <span className={`text-[11px] font-semibold px-2 py-0.5 rounded shadow-sm ${getRoleBadgeStyle(a.role, a.entityType)}`}>
          {a.entityType === 'kermes' ? (KERMES_ROLES.find(r => r.value === a.role)?.label || a.role.toUpperCase()) : (BUSINESS_ROLES.find(r => r.value === a.role)?.label || a.role.toUpperCase())}
         </span>
        </div>
       </div>
       {isSuperAdmin && (
        <button 
         type="button" 
         onClick={() => handleRemove(idx)}
         className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition"
         title="Sil"
        >
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
         </svg>
        </button>
       )}
      </div>
     ))}
    </div>
   )}

   {showAdd && isSuperAdmin && (
    <div className="mt-3 bg-muted/40 border border-border p-4 rounded-xl space-y-4 shadow-inner">
     <div className="flex justify-between items-center border-b border-border pb-2">
      <h4 className="font-semibold text-sm">{t('yeniRolAtamasi', { defaultValue: 'Yeni Rol Atamasi' })}</h4>
      <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
     </div>
     
     <div className="space-y-3">
      <div>
       <label className="block text-xs font-medium text-muted-foreground mb-1">{t('isletme_kermes', { defaultValue: 'Isletme veya Kermes' })}</label>
       
       <div className="relative">
        {!isDropdownOpen ? (
         <button 
          type="button" 
          onClick={() => setIsDropdownOpen(true)}
          className="w-full px-3 py-2 bg-background border border-input rounded-lg text-left flex justify-between items-center focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
         >
          <span className={selectedEntityId ? "text-foreground" : "text-muted-foreground truncate"}>
           {selectedEntityId 
            ? allEntities.find(b => b.id === selectedEntityId)?.name || 'Isletme / Kermes Secin...'
            : 'Isletme / Kermes Secin...'
           }
          </span>
          <span className="text-xs">&#9660;</span>
         </button>
        ) : (
         <div className="absolute top-full left-0 mt-1 w-full bg-background border border-border rounded-lg shadow-xl z-50">
          <div className="p-2 border-b border-border flex items-center gap-2">
           <span className="text-muted-foreground ml-1">&#128269;</span>
           <input 
            type="text" 
            autoFocus
            placeholder="kermes/isletme ara..." 
            className="w-full bg-transparent border-none focus:outline-none text-sm text-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
           />
           <button type="button" onClick={() => setIsDropdownOpen(false)} className="text-muted-foreground hover:text-foreground mr-1 text-lg leading-none">&times;</button>
          </div>
          <div className="max-h-60 overflow-y-auto">
           {allEntities
            .filter(b => {
             const searchTerms = String(searchQuery).toLowerCase().split(' ').filter(Boolean);
             if (searchTerms.length === 0) return true;
             const fullText = `${b.name || ''} ${(b as any).dernekIsmi || ''} ${b.plz || ''} ${b.city || ''}`.toLowerCase();
             return searchTerms.every(term => fullText.includes(term));
            })
            .map(b => (
             <div 
              key={b.id} 
              onClick={() => { setSelectedEntityId(b.id); setIsDropdownOpen(false); setSearchQuery(''); setSelectedRoles(['staff']); }}
              className={`p-3 text-sm cursor-pointer hover:bg-muted/50 border-b border-border last:border-0 ${selectedEntityId === b.id ? 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300' : ''}`}
             >
              <div className="font-medium text-foreground flex items-center gap-2">
               {b.name}
               <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${(b as any)._type === 'kermes' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                {(b as any)._type === 'kermes' ? 'Kermes' : 'Isletme'}
               </span>
              </div>
              {(b.plz || b.city || (b as any).dernekIsmi) && (
               <div className="text-[11px] text-muted-foreground mt-0.5">
                {[b.name !== (b as any).dernekIsmi ? (b as any).dernekIsmi : null, b.plz, b.city].filter(Boolean).join(' - ')}
               </div>
              )}
             </div>
            ))
           }
           {allEntities.filter(b => {
            const searchTerms = String(searchQuery).toLowerCase().split(' ').filter(Boolean);
            if (searchTerms.length === 0) return true;
            const fullText = `${b.name || ''} ${(b as any).dernekIsmi || ''} ${b.plz || ''} ${b.city || ''}`.toLowerCase();
            return searchTerms.every(term => fullText.includes(term));
           }).length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">Sonuc bulunamadi.</div>
           )}
          </div>
         </div>
        )}
       </div>
      </div>

      {/* Role selection - multi-select for kermes, auto-determined for business */}
      {selectedEntityId && isSelectedKermes && (
       <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">
         Kermes Rolleri (birden fazla secilebilir)
        </label>
        <div className="grid grid-cols-2 gap-2">
         {roleOptions.map(ro => {
          const isActive = selectedRoles.includes(ro.value);
          return (
           <button
            key={ro.value}
            type="button"
            onClick={() => toggleRole(ro.value)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
             isActive
              ? 'border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-500 shadow-sm'
              : 'border-border bg-background text-muted-foreground hover:border-pink-300 hover:bg-pink-50/50 dark:hover:bg-pink-900/10'
            }`}
           >
            <span className="text-lg">{ro.icon}</span>
            <span>{ro.label}</span>
            {isActive && <span className="ml-auto text-pink-500 font-bold">&#10003;</span>}
           </button>
          );
         })}
        </div>
       </div>
      )}

      <button 
       type="button" 
       onClick={handleAdd}
       disabled={!selectedEntityId || (isSelectedKermes && selectedRoles.length === 0)}
       className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
        selectedEntityId && (!isSelectedKermes || selectedRoles.length > 0)
         ? 'bg-pink-600 text-white shadow-md hover:bg-pink-700' 
         : 'bg-muted text-muted-foreground cursor-not-allowed'
       }`}
      >
       {selectedRoles.length > 1 && isSelectedKermes
        ? `${selectedRoles.length} Rol ile Ata`
        : 'Listeye Ekle'
       }
      </button>
     </div>
    </div>
   )}
  </div>
 );
}
