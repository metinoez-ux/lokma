const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const globalModal = `
  {/* Global System Role Editor Modal */}
  {editingGlobalRole && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h3 className="font-bold text-foreground">Sistem Görevini Düzenle</h3>
          <button onClick={() => setEditingGlobalRole(null)} className="text-muted-foreground hover:bg-muted p-1.5 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-xs leading-relaxed border border-amber-200 dark:border-amber-800/50">
            <strong>Dikkat:</strong> Bu değişiklik <strong>tüm sistemdeki</strong> bütün kermesleri etkileyecektir. Sistem görevleri silinemez, sadece adları ve görünümleri değiştirilebilir.
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Görev Adı</label>
            <input 
              type="text" 
              value={editingGlobalRole.name} 
              onChange={e => setEditingGlobalRole(r => r ? {...r, name: e.target.value} : null)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">İkon Listesi (Emoji)</label>
              <div className="flex gap-2">
                 {['👥', '🚗', '🍽️', '👑', '🧹', '🅿️', '👶', '⭐', '📦', '🛡️', '👨‍🍳'].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditingGlobalRole(r => r ? {...r, icon: i} : null)}
                    className={\`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all \${editingGlobalRole.icon === i ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500' : 'bg-muted hover:bg-muted/80'}\`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
        
        <div className="p-4 border-t border-border flex gap-3 bg-muted/10">
          <button 
            type="button" 
            onClick={() => setEditingGlobalRole(null)} 
            className="flex-1 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors text-sm"
          >
            İptal
          </button>
          <button 
            type="button" 
            onClick={async () => {
              if (editingGlobalRole) {
                if (!editingGlobalRole.name.trim()) return showToast("Görev adı zorunludur", "error");
                
                const newRoles = (globalSystemRoles.length > 0 ? globalSystemRoles : DEFAULT_GLOBAL_SYSTEM_ROLES).map(r => r.id === editingGlobalRole.id ? editingGlobalRole : r);
                
                setGlobalSystemRoles(newRoles);
                
                try {
                  await setDoc(doc(db, 'settings', 'kermes_roles'), { systemRoles: newRoles }, { merge: true });
                  showToast('Sistem görevi başarıyla küresel olarak güncellendi.', 'success');
                  setEditingGlobalRole(null);
                } catch (err) {
                  console.error(err);
                  showToast('Görev güncellenirken hata oluştu.', 'error');
                }
              }
            }} 
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Küresel Kaydet
          </button>
        </div>
      </div>
    </div>
  )}
`;

txt = txt.replace('{/* Özel Görev Düzenleme Modalı */}', globalModal + '\n\n  {/* Özel Görev Düzenleme Modalı */}');

fs.writeFileSync(file, txt);
console.log('Modal Patched!');
