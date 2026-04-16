const fs = require('fs');
const p = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx';
let d = fs.readFileSync(p, 'utf8');

const regex = /<div className="flex-1 min-w-\[150px\]">[\s\S]*?<label className="block text-xs font-semibold text-gray-400 mb-1">İstasyonlar \(Virgül\)<\/label>[\s\S]*?<input type="text" value=\{\(dz\.prepZoneFilters \|\| \[\]\)\.join\([^<]*<\/div>/;

const replacement = `<div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">İstasyon Seçimi (TV'de Görünecekler)</label>
                  {(() => {
                     const sDef = dz.sectionFilter ? sectionDefs.find(d => d.name === dz.sectionFilter) : null;
                     const available = sDef ? (sDef.prepZones || []) : Array.from(new Set(sectionDefs.flatMap(d => d.prepZones || [])));
                     
                     if (available.length === 0) {
                        return <div className="text-xs text-gray-500 italic bg-gray-900 border border-gray-800 rounded px-3 py-1.5 inline-block">Bu bölüme kayıtlı istasyon bulunamadı.</div>;
                     }
                     
                     return (
                        <div className="flex flex-wrap gap-2">
                          {available.map(pz => {
                             const isSelected = (dz.prepZoneFilters || []).includes(pz);
                             return (
                               <label key={pz} className={\`cursor-pointer transition px-2.5 py-1 text-xs rounded-full flex items-center gap-1.5 border \${isSelected ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700'}\`}>
                                  <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                      const upd = [...deliveryZones];
                                      if (!upd[idx].prepZoneFilters) upd[idx].prepZoneFilters = [];
                                      if (e.target.checked) {
                                          if (!upd[idx].prepZoneFilters.includes(pz)) upd[idx].prepZoneFilters.push(pz);
                                      } else {
                                          upd[idx].prepZoneFilters = upd[idx].prepZoneFilters.filter(x => x !== pz);
                                      }
                                      setDeliveryZones(upd);
                                      updateAndSave(undefined, undefined, undefined, undefined, undefined, upd);
                                  }} />
                                  <div className={\`w-3 h-3 rounded-sm border flex items-center justify-center \${isSelected ? 'border-black bg-black text-amber-500' : 'border-gray-500'}\`}>
                                     {isSelected && <span className="material-symbols-outlined text-[10px] font-bold">check</span>}
                                  </div>
                                  {pz}
                               </label>
                             );
                          })}
                        </div>
                     )
                  })()}
                </div>`;

if (d.match(regex)) {
   d = d.replace(regex, replacement);
   fs.writeFileSync(p, d);
   console.log("Patched dynamic checkbox logic");
} else {
   console.log("Could not find block to replace.");
}
