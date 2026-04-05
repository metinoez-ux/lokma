import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, setDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

interface Category {
  id: string;
  name: string;
  order: number;
}

interface CategoryManagementModalProps {
  onClose: () => void;
  onCategoriesUpdated: () => void;
  locale?: string;
  kermesId?: string;
}

export default function CategoryManagementModal({ onClose, onCategoriesUpdated, locale, kermesId }: CategoryManagementModalProps) {
  const t = useTranslations('Admin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'kermes_categories'), orderBy('order'));
      const snapshot = await getDocs(q);
      const cats: Category[] = snapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name as string || '',
        order: d.data().order || 0
      }));
      setCategories(cats);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSaving(true);
    try {
      const categoryId = newCatName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_ğüşöçı]/g, '');
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) : -1;
      
      const newCat = {
        id: categoryId,
        name: newCatName.trim(),
        order: maxOrder + 1,
        createdAt: new Date(),
      };
      
      await setDoc(doc(db, 'kermes_categories', categoryId), newCat);
      setNewCatName('');
      await loadCategories();
      onCategoriesUpdated();
    } catch (err) {
      console.error(err);
      alert('Kategori eklenirken hata: ' + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`'${name}' kategorisini silmek istediğinize emin misiniz? (İçinde ürün varsa "Diğer" kategorisine taşınacaktır)`)) return;
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Kategori koleksiyondan siliniyor
      batch.delete(doc(db, 'kermes_categories', id));
      
      // Bu kategoriye ait ürünler "Diğer" kategorisine atılıyor (eğer kermesId varsa)
      if (kermesId) {
        const qProducts = query(collection(db, `events/${kermesId}/products`));
        const pSnapshot = await getDocs(qProducts);
        pSnapshot.docs.forEach(d => {
          const prodCat = d.data().category;
          const catStr = typeof prodCat === 'object' ? prodCat.tr || prodCat.de || prodCat.nl : prodCat;
          if (catStr === name) {
            batch.update(doc(db, `events/${kermesId}/products`, d.id), { category: "Diğer" });
          }
        });
      }

      await batch.commit();

      await loadCategories();
      onCategoriesUpdated();
    } catch (err) {
      console.error(err);
      alert('Silme sırasında hata');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (cat: Category) => {
    if (!editingId || !editName.trim()) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Update global category
      batch.update(doc(db, 'kermes_categories', editingId), { name: editName.trim() });
      
      // Update all products in THIS kermes that had the old category
      if (kermesId) {
        const qProducts = query(collection(db, `events/${kermesId}/products`));
        const pSnapshot = await getDocs(qProducts);
        pSnapshot.docs.forEach(d => {
          const prodCat = d.data().category;
          const catStr = typeof prodCat === 'object' ? prodCat.tr || prodCat.de || prodCat.nl : prodCat;
          if (catStr === cat.name) {
            batch.update(doc(db, `events/${kermesId}/products`, d.id), { category: editName.trim() });
          }
        });
      }

      await batch.commit();

      setEditingId(null);
      await loadCategories();
      onCategoriesUpdated();
    } catch (err) {
      console.error(err);
      alert('Güncelleme sırasında hata');
    } finally {
      setIsSaving(false);
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newCats = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newCats[index];
    newCats[index] = newCats[targetIndex];
    newCats[targetIndex] = temp;

    // Update order values
    newCats.forEach((c, i) => { c.order = i; });
    setCategories(newCats);

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      newCats.forEach(c => {
        batch.update(doc(db, 'kermes_categories', c.id), { order: c.order });
      });
      await batch.commit();
      onCategoriesUpdated();
    } catch (err) {
      console.error(err);
      alert('Sıralama güncellenemedi');
      await loadCategories(); // rollback UI
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-foreground">Kategori Yönetimi</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white pb-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
        </div>

        <div className="p-4 flex gap-2 border-b border-border flex-shrink-0">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Yeni Kategori Adı"
              className="flex-1 px-3 py-2 bg-background text-foreground rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button 
              onClick={handleAddCategory} 
              disabled={isSaving || !newCatName.trim()} 
              className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
            >
              Ekle
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Yükleniyor...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">Hiç kategori yok</div>
          ) : (
            categories.map((cat, i) => (
              <div key={cat.id} className="flex items-center justify-between bg-muted/40 p-3 rounded-lg group">
                {editingId === cat.id ? (
                  <div className="flex-1 flex gap-2 mr-2">
                    <input 
                      type="text" 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      title="Kategori yeni adı"
                      aria-label="Kategori yeni adı"
                      className="flex-1 px-2 py-1 bg-background text-foreground rounded border border-input text-sm"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(cat)}
                    />
                    <button onClick={() => handleSaveEdit(cat)} disabled={isSaving} className="text-green-500 px-2">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 px-2">✕</button>
                  </div>
                ) : (
                  <span className="text-foreground font-medium flex-1">{cat.name}</span>
                )}

                {editingId !== cat.id && (
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                    <div className="flex flex-col mr-2">
                      <button 
                        onClick={() => moveCategory(i, 'up')} 
                        disabled={i === 0 || isSaving}
                        title="Yukarı taşı"
                        aria-label="Yukarı taşı"
                        className="text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                      </button>
                      <button 
                        onClick={() => moveCategory(i, 'down')} 
                        disabled={i === categories.length - 1 || isSaving}
                        title="Aşağı taşı"
                        aria-label="Aşağı taşı"
                        className="text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                    </div>

                    <button 
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                      title="Düzenle"
                      className="p-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/40"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id, cat.name)}
                      title="Sil"
                      className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40 ml-1"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
