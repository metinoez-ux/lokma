const fs = require('fs');
const file = 'src/app/[locale]/admin/kermes/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for categoryDocs and modal visibility
if (!content.includes('const [categoryDocs, setCategoryDocs]')) {
  content = content.replace(
    'const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);',
    `const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryDocs, setCategoryDocs] = useState<any[]>([]);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);`
  );
}

// 2. Modify loadCategories to populate categoryDocs and filter active categories
const loadCatTarget = `      if (snapshot.empty) {
        // Eğer Firebase'de Firebase'de kategori yoksa, default'ları kaydet ve göster
        finalCats = [...DEFAULT_CATEGORIES];
        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
          const catName = DEFAULT_CATEGORIES[i];
          const categoryId = catName.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_ğüşöçı]/g, '');
          await setDoc(doc(db, 'kermes_categories', categoryId), {
            name: catName, id: categoryId, order: i, createdAt: new Date(),
          });
        }
      } else {
        // Firebase'den gelen kategorileri çevirileriyle beraber al
        finalCats = snapshot.docs.map(d => {
          const name = d.data().name;
          return typeof name === "object" ? getLocalizedText(name, locale) : String(name || "");
        });
      }
      setCategories(finalCats);`;

const loadCatTargetAlt = `      if (snapshot.empty) {
        // Eğer Firebase'de kategori yoksa, default'ları kaydet ve göster
        finalCats = [...DEFAULT_CATEGORIES];
        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
          const catName = DEFAULT_CATEGORIES[i];
          const categoryId = catName.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_ğüşöçı]/g, '');
          await setDoc(doc(db, 'kermes_categories', categoryId), {
            name: catName, id: categoryId, order: i, createdAt: new Date(),
          });
        }
      } else {
        // Firebase'den gelen kategorileri çevirileriyle beraber al
        finalCats = snapshot.docs.map(d => {
          const name = d.data().name;
          return typeof name === "object" ? getLocalizedText(name, locale) : String(name || "");
        });
      }
      setCategories(finalCats);`;

const loadCatReplacement = `      let rawDocs = [];
      if (snapshot.empty) {
        finalCats = [...DEFAULT_CATEGORIES];
        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
          const catName = DEFAULT_CATEGORIES[i];
          const categoryId = catName.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_ğüşöçı]/g, '');
          const newDoc = { name: catName, id: categoryId, order: i, createdAt: new Date(), isActive: true };
          await setDoc(doc(db, 'kermes_categories', categoryId), newDoc);
          rawDocs.push({ ...newDoc, id: categoryId });
        }
      } else {
        snapshot.docs.forEach(d => {
          const data = d.data();
          rawDocs.push({ id: d.id, ...data });
          if (data.isActive !== false) {
            const name = data.name;
            finalCats.push(typeof name === "object" ? getLocalizedText(name, locale) : String(name || ""));
          }
        });
      }
      setCategoryDocs(rawDocs);
      setCategories(finalCats);`;

content = content.replace(loadCatTarget, loadCatReplacement);
content = content.replace(loadCatTargetAlt, loadCatReplacement);

// 3. Add the "Kategorileri Yönet" button
const btnTarget = `<button onClick={() => setShowCategoryModal(true)}
                        className="px-3 py-2 bg-purple-600/20 text-purple-800 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-600/40">
                        {t('kategori_ekle')}
                      </button>`;
const btnReplacement = `{(isSuperAdmin || isKermesAdminOfThis) && (
                        <button onClick={() => setShowManageCategoriesModal(true)}
                          className="px-3 py-2 bg-blue-600/20 text-blue-800 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-600/40 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">edit</span> {t('kategorileri_yonet') || 'Kategorileri Yönet'}
                        </button>
                      )}
                      <button onClick={() => setShowCategoryModal(true)}
                        className="px-3 py-2 bg-purple-600/20 text-purple-800 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-600/40">
                        {t('kategori_ekle')}
                      </button>`;
content = content.replace(btnTarget, btnReplacement);

// 4. Append the new Modal before the closing tags
const modalCode = `
      {/* MANAGE CATEGORIES MODAL */}
      {showManageCategoriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">category</span>
                {t('kategorileri_yonet') || 'Kategorileri Yönet'}
              </h2>
              <button onClick={() => setShowManageCategoriesModal(false)} className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-3">
              {categoryDocs.sort((a, b) => (a.order || 0) - (b.order || 0)).map((cat, index) => {
                const nameStr = typeof cat.name === 'object' ? getLocalizedText(cat.name, locale) : String(cat.name || '');
                return (
                  <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-background p-4 rounded-xl border border-border">
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-foreground min-w-[24px] text-muted-foreground">#{index + 1}</span>
                         <input
                           type="text"
                           defaultValue={nameStr}
                           onBlur={async (e) => {
                             if(e.target.value !== nameStr && e.target.value.trim() !== '') {
                               try {
                                 await updateDoc(doc(db, 'kermes_categories', cat.id), { name: e.target.value.trim() });
                                 loadCategories();
                               } catch(err) { console.error(err); }
                             }
                           }}
                           className="flex-1 bg-gray-700/50 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-blue-500 outline-none"
                         />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={async () => {
                           if(index > 0) {
                             const prev = categoryDocs[index - 1];
                             await updateDoc(doc(db, 'kermes_categories', cat.id), { order: prev.order });
                             await updateDoc(doc(db, 'kermes_categories', prev.id), { order: cat.order });
                             loadCategories();
                           }
                        }}
                        disabled={index === 0}
                        className="p-2 rounded bg-gray-700/50 hover:bg-gray-600 disabled:opacity-50 text-white"
                        title="Yukarı Taşı">
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                      </button>
                      <button 
                        onClick={async () => {
                           if(index < categoryDocs.length - 1) {
                             const next = categoryDocs[index + 1];
                             await updateDoc(doc(db, 'kermes_categories', cat.id), { order: next.order });
                             await updateDoc(doc(db, 'kermes_categories', next.id), { order: cat.order });
                             loadCategories();
                           }
                        }}
                        disabled={index === categoryDocs.length - 1}
                        className="p-2 rounded bg-gray-700/50 hover:bg-gray-600 disabled:opacity-50 text-white"
                        title="Aşağı Taşı">
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                      </button>
                      <button
                        onClick={async () => {
                           const newStatus = cat.isActive === false ? true : false;
                           await updateDoc(doc(db, 'kermes_categories', cat.id), { isActive: newStatus });
                           loadCategories();
                        }}
                        className={\`px-3 py-1.5 rounded text-sm font-medium \${cat.isActive !== false ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'}\`}
                      >
                        {cat.isActive !== false ? 'Aktif' : 'Pasif'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
`;

const closingTarget = `    </div>
  );
}
`;

if (!content.includes('MANAGE CATEGORIES MODAL')) {
  content = content.replace(closingTarget, modalCode + closingTarget);
}

fs.writeFileSync(file, content);
console.log("Categories script executed.");
