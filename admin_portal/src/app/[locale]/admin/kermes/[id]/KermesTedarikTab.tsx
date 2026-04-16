'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, Timestamp, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface KermesTedarikTabProps {
  kermesId: string;
  adminUid: string;
  kermesData: any;
}

export default function KermesTedarikTab({ kermesId, adminUid, kermesData }: KermesTedarikTabProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Categories config
  const [categories, setCategories] = useState<any[]>(kermesData?.supplyCategories || []);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'kermes_events', kermesId, 'supply_requests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [kermesId]);

  const handleUpdateStatus = async (reqId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'kermes_events', kermesId, 'supply_requests', reqId), {
        status,
        assignedToUid: adminUid,
        completedAt: status === 'completed' ? Timestamp.now() : null
      });
    } catch (error) {
      console.error("Error updating supply status", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatTitle.trim()) return;
    const catId = newCatTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCat = { id: catId, title: newCatTitle, items: [] };
    const updated = [...categories, newCat];
    try {
       await updateDoc(doc(db, 'kermes_events', kermesId), {
          supplyCategories: updated
       });
       setCategories(updated);
       setNewCatTitle('');
    } catch(e) {}
  };

  const handleAddItem = async (catId: string) => {
    if (!newItemName.trim() || !catId) return;
    const catIndex = categories.findIndex(c => c.id === catId);
    if(catIndex < 0) return;
    
    const updated = [...categories];
    updated[catIndex].items.push(newItemName.trim());
    
    try {
       await updateDoc(doc(db, 'kermes_events', kermesId), {
          supplyCategories: updated
       });
       setCategories(updated);
       setNewItemName('');
    } catch (e) {}
  };

  const handleRemoveItem = async (catId: string, item: string) => {
     const catIndex = categories.findIndex(c => c.id === catId);
     if(catIndex < 0) return;
     const updated = [...categories];
     updated[catIndex].items = updated[catIndex].items.filter((i: string) => i !== item);
     try {
       await updateDoc(doc(db, 'kermes_events', kermesId), {
          supplyCategories: updated
       });
       setCategories(updated);
     } catch (e) {}
  };

  const handleDeleteCategory = async (catId: string) => {
     const updated = categories.filter(c => c.id !== catId);
     try {
       await updateDoc(doc(db, 'kermes_events', kermesId), {
          supplyCategories: updated
       });
       setCategories(updated);
     } catch (e) {}
  };

  return (
    <div className="space-y-8">
      {/* AKTIF İHTİYAÇLAR ALANI */}
      <div className="bg-card rounded-xl p-6 border border-border">
         <h3 className="text-lg font-bold flex items-center mb-4">
            <span className="material-symbols-outlined text-red-500 mr-2">campaign</span>
            Canlı Tedarik Bekleyenler
         </h3>

         {loading ? (
             <p className="text-muted-foreground text-sm">Yükleniyor...</p>
         ) : requests.length === 0 ? (
             <div className="text-center py-10 bg-muted/30 rounded-lg">
                <span className="material-symbols-outlined text-4xl text-muted-foreground/50 mb-2">check_circle</span>
                <p className="text-muted-foreground">Şu an hiçbir ihtiyaç anonsu yok.</p>
             </div>
         ) : (
            <div className="space-y-3">
               {requests.map((r) => (
                  <div key={r.id} className={`p-4 rounded-lg flex items-center justify-between border ${r.status === 'completed' ? 'bg-muted/30 border-muted opacity-60' : r.status === 'on_the_way' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200'}`}>
                     <div>
                        <div className="flex items-center space-x-2">
                           <span className={`px-2 py-1 text-xs font-bold rounded-md ${r.status === 'completed' ? 'bg-gray-200 text-gray-700' : r.status === 'on_the_way' ? 'bg-amber-200 text-amber-800' : 'bg-red-500 text-white'}`}>
                              {r.status === 'completed' ? 'Tamamlandı' : r.status === 'on_the_way' ? 'Yola Çıktı' : 'Acil Bekliyor'}
                           </span>
                           <span className="text-sm font-medium opacity-60">
                              {new Date(r.createdAt?.toMillis()).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                        <h4 className="font-bold text-lg mt-1">{r.itemName}</h4>
                        <p className="text-sm text-muted-foreground">
                           <span className="material-symbols-outlined text-xs align-middle mr-1">person</span>
                           {r.requestedByName} <span className="mx-1">•</span>
                           <span className="material-symbols-outlined text-xs align-middle mr-1">location_on</span>
                           {r.requestedZone}
                        </p>
                     </div>
                     <div className="flex flex-col space-y-2">
                        {r.status === 'pending' && (
                           <button onClick={() => handleUpdateStatus(r.id, 'on_the_way')} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center">
                              <span className="material-symbols-outlined text-sm mr-1">local_shipping</span> Yola Çıkar
                           </button>
                        )}
                        {r.status === 'on_the_way' && (
                           <button onClick={() => handleUpdateStatus(r.id, 'completed')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center">
                              <span className="material-symbols-outlined text-sm mr-1">check</span> Teslim Edildi
                           </button>
                        )}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {/* KATEGORI VE MALZEME YONETIMI */}
      <div className="bg-card rounded-xl p-6 border border-border">
         <h3 className="text-lg font-bold mb-1">Mevcut Malzeme Stoğu (Butonlar)</h3>
         <p className="text-sm text-muted-foreground mb-6">Personelin mobil uygulamasında bir tıklamayla isteyebileceği hazır malzeme butonları.</p>

         <div className="flex gap-4 mb-6">
            <input 
               type="text" 
               placeholder="Yeni Kategori (Örn: Mutfak Eşyası)" 
               className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm"
               value={newCatTitle}
               onChange={(e) => setNewCatTitle(e.target.value)}
            />
            <button onClick={handleAddCategory} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
               Kategori Ekle
            </button>
         </div>

         {categories.length > 0 && (
            <div className="space-y-6">
               {categories.map((cat) => (
                  <div key={cat.id} className="bg-background rounded-lg border border-border p-4">
                     <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <h4 className="font-bold">{cat.title}</h4>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded text-xs transition">
                           Kategoriyi Sil
                        </button>
                     </div>

                     <div className="flex flex-wrap gap-2 mb-4">
                        {cat.items?.map((item: string) => (
                           <div key={item} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center">
                              {item}
                              <button onClick={() => handleRemoveItem(cat.id, item)} className="ml-2 text-muted-foreground hover:text-red-500">
                                 <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                           </div>
                        ))}
                     </div>

                     <div className="flex max-w-sm gap-2">
                        <input 
                           type="text" 
                           placeholder="Yeni Malzeme Ekle" 
                           className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm"
                           value={selectedCatId === cat.id ? newItemName : ''}
                           onChange={(e) => { setSelectedCatId(cat.id); setNewItemName(e.target.value); }}
                        />
                        <button onClick={() => handleAddItem(cat.id)} className="bg-muted hover:bg-muted-foreground/10 text-foreground px-3 py-1.5 rounded-lg text-sm font-medium">
                           Ekle
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>
    </div>
  );
}

