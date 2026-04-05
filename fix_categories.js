const fs = require('fs');
const path = require('path');

const filePath = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Focus on `loadCategories`
const newLoadCategories = `  // Global kategorileri Firebase'den yükle
  const loadCategories = useCallback(async () => {
    try {
      const q = query(collection(db, 'kermes_categories'), orderBy('order'));
      const snapshot = await getDocs(q);
      
      let finalCats = [];
      if (snapshot.empty) {
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
      setCategories(finalCats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [locale]);`;

// Regex replacement
content = content.replace(
  /\s*\/\/\s*Global kategorileri Firebase'den yükle[\s\S]*?\}, \[\]\);/m,
  "\n" + newLoadCategories
);

// We should also remove the old default categories push in loadKermes!
content = content.replace(
  /\s*\/\/\s*Dinamik kategorileri yükle[\s\S]*?\}\s*(\/)?/m,
  "\n        //"
);

fs.writeFileSync(filePath, content);
console.log("Fixed Categories in page.tsx!");
