const fs = require('fs');

const file = 'admin_portal/src/app/[locale]/admin/kermes/[id]/KermesTedarikTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Differentiate pending and completed requests at the top of the render block.
// Find the start of return (
content = content.replace('return (', `  const pendingReqs = requests.filter(r => r.status !== 'completed');\n  const completedReqs = requests.filter(r => r.status === 'completed');\n\n  return (`);

// 2. Wrap the mapping logic
// Replace `requests.map((r) =>` with `pendingReqs.map((r) =>`
// AND if pendingReqs.length === 0, show the empty state.
content = content.replace('requests.length === 0 ? (', 'pendingReqs.length === 0 ? (');
content = content.replace('requests.map((r) =>', 'pendingReqs.map((r) =>');

// 3. Add the completed panel after the pending grid:
const completedPanel = `
         {/* TAMAMLANANLAR ALANI */}
         {completedReqs.length > 0 && (
            <details className="mt-8 bg-card rounded-xl border border-border group overflow-hidden">
               <summary className="p-4 bg-muted/20 cursor-pointer font-bold flex items-center justify-between list-none">
                  <div className="flex items-center">
                     <span className="material-symbols-outlined text-emerald-500 mr-2">check_circle</span>
                     Tamamlanan Teslimatlar ({completedReqs.length})
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground group-open:rotate-180 transition-transform">expand_more</span>
               </summary>
               <div className="p-6 pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 border-t border-border bg-card">
                  {completedReqs.map((r) => (
                    <div key={r.id} className="p-4 xl:p-5 rounded-lg flex flex-col justify-between border bg-muted/20 border-muted opacity-70">
                       <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                             <span className="px-2 py-1 text-[11px] font-bold rounded-md bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                Tamamlandı
                             </span>
                             <span className="text-sm font-medium opacity-60">
                                {new Date(r.createdAt?.toMillis()).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                             </span>
                          </div>
                          <h4 className="font-bold text-lg mt-2 line-through opacity-70">{r.itemName}</h4>
                          <p className="text-sm text-muted-foreground mt-1 mb-2">
                             <span className="material-symbols-outlined text-xs align-middle mr-1">person</span>
                             {r.requestedByName} <span className="mx-1">•</span>
                             <span className="material-symbols-outlined text-xs align-middle mr-1">location_on</span>
                             {r.requestedZone}
                          </p>
                       </div>
                    </div>
                  ))}
               </div>
            </details>
         )}
`;

content = content.replace('             </div>\n         )}', '             </div>\n         )}\n' + completedPanel);

fs.writeFileSync(file, content);
console.log('Fixed KermesTedarikTab.tsx');
