const fs = require('fs');
const file = 'admin_portal/src/app/[locale]/admin/kermes/[id]/KermesTedarikTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add allZones
const allZonesStr = `  const [editingCatTitle, setEditingCatTitle] = useState('');

  const allZones = Array.from(new Set(
    kermesData?.tableSectionsV2?.flatMap((s: any) => s.prepZones || []) || []
  )).sort() as string[];`;
content = content.replace("  const [editingCatTitle, setEditingCatTitle] = useState('');", allZonesStr);

// 2. Add handleToggleZone function
const handleToggleZoneStr = `  const handleToggleZone = async (catId: string, zone: string) => {
     const catIndex = categories.findIndex(c => c.id === catId);
     if(catIndex < 0) return;
     const updated = [...categories];
     const cat = updated[catIndex];
     if (!cat.allowedZones) cat.allowedZones = [];
     
     if (cat.allowedZones.includes(zone)) {
        cat.allowedZones = cat.allowedZones.filter((z: string) => z !== zone);
     } else {
        cat.allowedZones.push(zone);
     }
     
     try {
       await updateDoc(doc(db, 'kermes_events', kermesId), { supplyCategories: updated });
       setCategories(updated);
     } catch(e) {}
  };`;
content = content.replace("  const handleAddItem = async", handleToggleZoneStr + "\n\n  const handleAddItem = async");

// 3. Edit mode UI
const editModeStr = `                        {editingCatId === cat.id ? (
                           <div className="flex flex-col w-full mr-4">
                             <div className="flex items-center space-x-2 flex-1 mb-2">
                               <input 
                                 type="text" 
                                 value={editingCatTitle} 
                                 onChange={(e) => setEditingCatTitle(e.target.value)}
                                 className="flex-1 bg-muted border border-border rounded px-2 py-1 text-sm font-bold"
                                 autoFocus
                                 onKeyDown={(e) => { if(e.key === 'Enter') handleEditCategorySave(cat.id); }}
                               />
                               <button onClick={() => handleEditCategorySave(cat.id)} className="text-green-600 hover:bg-green-50 px-2 py-1 rounded">
                                 <span className="material-symbols-outlined text-sm">check</span>
                               </button>
                               <button onClick={() => setEditingCatId(null)} className="text-muted-foreground hover:bg-muted px-2 py-1 rounded">
                                 <span className="material-symbols-outlined text-sm">close</span>
                               </button>
                             </div>
                           </div>
                        ) : (`;
content = content.replace(/                        \{editingCatId === cat\.id \? \([\s\S]*?\) : \(/, editModeStr);

// 4. Allowed Zones badge list
const badgeStr = `                     <div className="mb-4">
                        {editingCatId === cat.id && allZones.length > 0 && (
                          <div className="bg-muted/30 p-2 rounded-md border border-border/50 mb-3">
                             <p className="text-xs text-muted-foreground mb-2 font-medium">Bu kategoriyi hangi istasyonlar isteyebilir? (Boşsa herkes isteyebilir)</p>
                             <div className="flex flex-wrap gap-1.5">
                               {allZones.map(zone => {
                                  const isSelected = (cat.allowedZones || []).includes(zone);
                                  return (
                                     <button 
                                        key={zone}
                                        onClick={() => handleToggleZone(cat.id, zone)}
                                        className={\`px-2 py-1 text-[11px] rounded-md transition \${isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-background border border-border text-foreground hover:bg-muted'}\`}
                                     >
                                        {zone}
                                     </button>
                                  );
                               })}
                             </div>
                          </div>
                        )}
                        {(cat.allowedZones || []).length > 0 && editingCatId !== cat.id && (
                           <div className="flex flex-wrap gap-1 mb-2">
                             <span className="text-[10px] text-muted-foreground self-center mr-1">Sadece:</span>
                             {cat.allowedZones.map((z: string) => (
                               <span key={z} className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">{z}</span>
                             ))}
                           </div>
                        )}
                     </div>

                     <div className="flex flex-wrap gap-2 mb-4">`;
content = content.replace("                     <div className=\"flex flex-wrap gap-2 mb-4\">", badgeStr);

fs.writeFileSync(file, content);
console.log('Done!');
