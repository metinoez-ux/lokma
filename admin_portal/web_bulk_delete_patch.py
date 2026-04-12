import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables
state_search = r"  const \[form, setForm\] = useState\(\{[\s\S]*?\}\);"
state_replace = """  const [form, setForm] = useState({
    userId: '',
    role: '',
    startDate: kermesStart || '',
    endDate: kermesStart || '',
    startTime: '08:00',
    endTime: '16:00',
  });

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetRoster, setTargetRoster] = useState<KermesRoster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);"""
content = re.sub(state_search, state_replace, content)

# 2. Add writeBatch import 
import_search = "import { collection, query, where, getDocs, addDoc, deleteDoc, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';"
import_replace = "import { collection, query, where, getDocs, addDoc, deleteDoc, orderBy, Timestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';"
content = content.replace(import_search, import_replace)


# 3. Replace handleDelete and add confirmSingleDelete / confirmBulkDelete
delete_func_search = r"  const handleDelete = async \(id: string\) => \{[\s\S]*?alert\('Silinemedi'\);\n    \}\n  \};"

delete_func_replace = """  const handleDeleteClick = (roster: KermesRoster) => {
    setTargetRoster(roster);
    setDeleteModalOpen(true);
  };

  const confirmSingleDelete = async () => {
    if (!targetRoster) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'kermes_events', kermesId, 'rosters', targetRoster.id));
      setRosters(prev => prev.filter(r => r.id !== targetRoster.id));
      setDeleteModalOpen(false);
      setTargetRoster(null);
    } catch (e) {
      console.error(e);
      alert('Silinemedi');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!targetRoster) return;
    setIsDeleting(true);
    try {
      // Find all rosters for this user in frontend
      const userRosters = rosters.filter(r => r.userId === targetRoster.userId);
      const batch = writeBatch(db);
      
      userRosters.forEach(r => {
         const ref = doc(db, 'kermes_events', kermesId, 'rosters', r.id);
         batch.delete(ref);
      });
      
      await batch.commit();
      
      // Update UI
      setRosters(prev => prev.filter(r => r.userId !== targetRoster.userId));
      setDeleteModalOpen(false);
      setTargetRoster(null);
    } catch (e) {
      console.error(e);
      alert('Toplu silme başarısız!');
    } finally {
      setIsDeleting(false);
    }
  };"""
content = re.sub(delete_func_search, delete_func_replace, content)

# 4. Modify JSX. Replace onClick={() => handleDelete(r.id)} with handleDeleteClick(r)
jsx_btn_search = r"onClick=\{\(\) => handleDelete\(r\.id\)\}"
jsx_btn_replace = "onClick={() => handleDeleteClick(r)}"
content = content.replace(jsx_btn_search, jsx_btn_replace)

# 5. Add Delete Modal at the bottom of the return statement
modal_jsx = """      {/* Delete Modal */}
      {deleteModalOpen && targetRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Vardiya İptal Seçenekleri</h3>
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                <strong>{getUserName(targetRoster.userId)}</strong> adlı personelin vardiyasını siliyorsunuz. Bu kişinin kermes boyunca toplam <strong>{rosters.filter(r => r.userId === targetRoster.userId).length}</strong> adet aktif görev ataması bulunuyor.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={confirmSingleDelete}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">Sadece Bu Vardiyayı Sil</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{targetRoster.date} tarihindeki görevi siler.</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>

                <button
                  onClick={confirmBulkDelete}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 group"
                >
                  <div className="text-left">
                    <div className="font-semibold text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300">Tüm Atamalarını Tek Seferde Temizle</div>
                    <div className="text-xs text-red-500/70 dark:text-red-400/70 mt-1">Bu kermesteki aktif tüm görevlerini iptal eder.</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                </button>
              </div>
              
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="w-full mt-4 py-3 font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}"""

content = content.replace("    </div>\n  );\n}", modal_jsx)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Web Portal updated successfully")
