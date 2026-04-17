const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. DELETE LOGIC PATCH (Using prompt instead of confirm)
const deleteOld = ` const handleDeleteKermes = async () => {
 if (!kermes) return;
 if (!confirm('DİKKAT! Bu Kermes tamamen silinecek. İlgili tüm ürünleri ve verileri kaybolacaktır. Onaylıyor musunuz?')) return;
 setSaving(true);`;

const deleteNew = ` const handleDeleteKermes = async () => {
 if (!kermes) return;
 const confirmText = window.prompt("DİKKAT! Bu Kermes tamamen silinecektir. İlgili tüm ürünleri ve verileri kaybolacaktır.\\nLütfen işlemi onaylamak için kutucuğa 'Kermes Sil' veya 'sil' yazın:");
 if (!confirmText || (confirmText.trim().toLowerCase() !== 'kermes sil' && confirmText.trim().toLowerCase() !== 'sil')) {
    alert("Silme işlemi iptal edildi.");
    return;
 }
 setSaving(true);`;

txt = txt.replace(deleteOld, deleteNew);


// 2. TOP RIGHT BUTTONS PATCH
const buttonsOldRegex = /<div className="flex items-center gap-2">\s*<button[\s\S]*?onClick=\{\(\) => \{ setActiveTab\('masalar'\); [\s\S]*?>\s*🍳 Mutfak & Expo \(KDS\)\s*<\/button>\s*\{kermes\.sponsor === 'tuna' && <span className="px-2 py-1 bg-blue-600\/30 text-blue-800 dark:text-blue-400 rounded text-xs">🐟 TUNA<\/span>\}\s*\{kermes\.sponsor === 'akdeniz_toros' && <span className="px-2 py-1 bg-amber-600\/30 text-amber-800 dark:text-amber-400 rounded text-xs">🏔️ TOROS<\/span>\}\s*<button onClick=\{toggleActiveStatus\}[\s\S]*?<\/button>\s*<button onClick=\{handleDeleteKermes\}[\s\S]*?<\/button>\s*<\/div>/;

const buttonsNew = `<div className="flex items-center gap-2">
 <button 
 onClick={() => { setActiveTab('masalar'); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight/2, behavior: 'smooth' }), 100); }}
 className="h-10 px-4 mr-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg shadow-sm font-bold text-sm flex items-center justify-center transition hover:scale-105"
 >
 Mutfak & Expo (KDS)
 </button>
 {kermes.sponsor === 'tuna' && (
   <div className="h-10 px-4 bg-blue-600/20 text-blue-800 dark:text-blue-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-blue-600/30">
     <img src="/tuna_logo_pill.png" alt="TUNA" className="h-5 drop-shadow-sm" /> TUNA
   </div>
 )}
 {kermes.sponsor === 'akdeniz_toros' && (
   <div className="h-10 px-4 bg-amber-600/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-amber-600/30">
     <img src="/akdeniz_toros_logo_pill.png" alt="TOROS" className="h-5 drop-shadow-sm" /> TOROS
   </div>
 )}
 <button onClick={toggleActiveStatus}
 className={\`h-10 px-4 rounded-lg text-sm font-bold flex items-center justify-center transition-colors \${kermes.isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}\`}>
 {kermes.isActive ? '✓ Aktiv' : '✗ Deaktiv'}
 </button>
 <button onClick={handleDeleteKermes}
 className="h-10 px-4 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg text-sm font-bold flex items-center justify-center transition-colors">
 Sil
 </button>
 </div>`;

txt = txt.replace(buttonsOldRegex, buttonsNew);


// 3. TABS MENU PATCH
// Wait, replacing the entire Tabs wrapper is safer structure-wise.
const tabsRegex = /<div className="flex gap-2 mb-6 bg-card p-1 rounded-xl w-fit">[\s\S]*?<\/div>/;

const tabsNew = `<div className="flex flex-wrap gap-2 mb-6 bg-card p-1 rounded-xl w-full lg:w-fit">
 <button onClick={() => setActiveTab('bilgi')}
 className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'bilgi' ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
 Bilgiler
 </button>
 <button onClick={() => setActiveTab('menu')}
 className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'menu' ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
 {t('menu')} ({products.length})
 </button>
 <button onClick={() => setActiveTab('personel')}
 className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'personel' ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
 Personel {assignedStaffDetails.length > 0 && <span className="px-1.5 py-0.5 bg-pink-500/30 text-pink-300 rounded-full text-xs font-bold">{assignedStaffDetails.length}</span>}
 </button>
 <button onClick={() => setActiveTab('vardiya')}
 className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'vardiya' ? 'bg-cyan-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
 Vardiya Planı
 </button>
 <button onClick={() => setActiveTab('gorevler')}
 className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'gorevler' ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
 Görevler
 </button>
 <button onClick={() => setActiveTab('mutfak')}
 className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'mutfak' ? 'bg-orange-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
 Mutfak {kermesSectionDefs.some(s => (s.prepZones || []).length > 0) && <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-300 rounded-full text-xs font-bold">{kermesSectionDefs.reduce((acc, s) => acc + (s.prepZones || []).length, 0)}</span>}
 </button>
        <button onClick={() => setActiveTab('masalar')}
          className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'masalar' ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
          Masalar ve Bölümler
        </button>
        <button onClick={() => setActiveTab('siparisler')}
          className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'siparisler' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
          Siparişler
        </button>
        {(isSuperAdmin || isKermesAdminOfThis) && (
          <button onClick={() => setActiveTab('tahsilat')}
            className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'tahsilat' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
            Tahsilat
          </button>
        )}
        {(isSuperAdmin || isKermesAdminOfThis) && (
          <>
            <button onClick={() => setActiveTab('tedarik')}
              className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'tedarik' ? 'bg-rose-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
              Tedarik
            </button>
            <button onClick={() => setActiveTab('bildirimler')}
              className={\`h-10 px-4 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap \${activeTab === 'bildirimler' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-white'}\`}>
              Bildirimler
            </button>
          </>
        )}
 </div>`;

txt = txt.replace(tabsRegex, tabsNew);

fs.writeFileSync(file, txt);
