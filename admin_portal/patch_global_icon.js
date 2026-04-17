const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const targetStr = `          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">İkon Listesi</label>
              <div className="flex flex-wrap gap-2">
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
          </div>`;

const newStr = `          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Görev İkonu</label>
            <div className="flex items-center gap-4 border border-border p-3 rounded-lg bg-muted/10">
              <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-background flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                {editingGlobalRole.icon.startsWith('http') ? (
                  <img src={editingGlobalRole.icon} alt="icon" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">{editingGlobalRole.icon}</span>
                )}
              </div>
              <div className="flex-1">
                <input 
                  type="text" 
                  value={editingGlobalRole.icon.startsWith('http') ? '' : editingGlobalRole.icon}
                  onChange={e => setEditingGlobalRole(r => r ? {...r, icon: e.target.value} : null)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                  placeholder="Emoji yazın (Örn: 🧹) VEYA resim yükleyin"
                  disabled={editingGlobalRole.icon.startsWith('http')}
                />
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    id="global-role-icon-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setIsUploadingRoleIcon(true);
                        const fileExt = file.name.split('.').pop();
                        const fileName = \`role_\${Date.now()}.\${fileExt}\`;
                        const storageRef = ref(storage, \`kermes_roles/\${fileName}\`);
                        await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(storageRef);
                        setEditingGlobalRole(r => r ? {...r, icon: url} : null);
                      } catch (error) {
                        console.error('Upload failed', error);
                        alert('Resim yüklenirken bir hata oluştu.');
                      } finally {
                        setIsUploadingRoleIcon(false);
                      }
                    }}
                  />
                  <label 
                    htmlFor="global-role-icon-upload"
                    className="flex w-full items-center justify-center gap-2 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 border border-blue-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-100 transition whitespace-nowrap"
                  >
                    {isUploadingRoleIcon ? (
                      <span className="animate-pulse">Yükleniyor...</span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        Yeni Resim Yükle
                      </>
                    )}
                  </label>
                </div>
                {editingGlobalRole.icon.startsWith('http') && (
                  <button 
                    type="button"
                    onClick={() => setEditingGlobalRole(r => r ? {...r, icon: '📋'} : null)}
                    className="w-full mt-2 text-xs text-red-500 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    Resmi Kaldır (Emojiye Dön)
                  </button>
                )}
              </div>
            </div>
            
            <div className="mt-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Popüler İkonlar</label>
              <div className="flex flex-wrap gap-2">
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
          </div>`;

txt = txt.replace(targetStr, newStr);
fs.writeFileSync(file, txt);
