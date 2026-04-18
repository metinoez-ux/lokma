'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { collection, query, onSnapshot, updateDoc, doc, Timestamp, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface KermesTedarikTabProps {
  kermesId: string;
  adminUid: string;
  kermesData: any;
}

export default function KermesTedarikTab({ kermesId, adminUid, kermesData }: KermesTedarikTabProps) {
  const t = useTranslations('kermes');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes state for replies
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  // Categories config
  const [categories, setCategories] = useState<any[]>(kermesData?.supplyCategories || []);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  
  // Edit category
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatTitle, setEditingCatTitle] = useState('');

  const allZones = Array.from(new Set(
    kermesData?.tableSectionsV2?.flatMap((s: any) => s.prepZones || []) || []
  )).sort() as string[];

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

  const handleUpdateStatus = async (reqId: string, status: string, replyMessage?: string) => {
    try {
      const updateData: any = {
        status,
        assignedToUid: adminUid,
        updatedAt: Timestamp.now(),
        adminReply: replyMessage || null,
      };
      if (status === 'completed' || status === 'rejected') {
         updateData.completedAt = Timestamp.now();
      }
      await updateDoc(doc(db, 'kermes_events', kermesId, 'supply_requests', reqId), updateData);
      
      // Clear reply text if it exists
      if (replyTexts[reqId]) {
        setReplyTexts(prev => {
          const newTexts = { ...prev };
          delete newTexts[reqId];
          return newTexts;
        });
      }
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

  const handleEditCategorySave = async (catId: string) => {
    if (!editingCatTitle.trim()) return;
    const catIndex = categories.findIndex(c => c.id === catId);
    if(catIndex < 0) return;
    const updated = [...categories];
    updated[catIndex].title = editingCatTitle.trim();
    try {
      await updateDoc(doc(db, 'kermes_events', kermesId), {
         supplyCategories: updated
      });
      setCategories(updated);
      setEditingCatId(null);
    } catch(e) {}
  };

  const handleToggleZone = async (catId: string, zone: string) => {
     const catIndex = categories.findIndex(c => c.id === catId);
     if(catIndex < 0) return;
     const updated = [...categories];
     const cat = updated[catIndex];
     if (!cat.allowedZones) cat.allowedZones = [];
     
     if (cat.allowedZones.includes(zone)) {
        cat.allowedZones = cat.allowedZones.filter((z: string) => z !== zone);
     } else {
        cat.allowedZones.push(zone);
     }
     
     try {
       await updateDoc(doc(db, 'kermes_events', kermesId), { supplyCategories: updated });
       setCategories(updated);
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

  const liveReqs = requests.filter(r => r.status === 'pending' || r.status === 'on_the_way' || r.status === 'super_urgent');
  const pastReqs = requests.filter(r => r.status === 'completed' || r.status === 'rejected' || r.status === 'cancelled');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* AKTIF İHTİYAÇLAR ALANI */}
      <div className="bg-card rounded-xl p-6 border border-border">
         <h3 className="text-lg font-bold flex items-center mb-4">
            <span className="material-symbols-outlined text-red-500 mr-2">campaign</span>
            Canlı Tedarik Bekleyenler
         </h3>

         {loading ? (
             <p className="text-muted-foreground text-sm">Yükleniyor...</p>
         ) : liveReqs.length === 0 ? (
             <div className="text-center py-10 bg-muted/30 rounded-lg">
                <span className="material-symbols-outlined text-4xl text-muted-foreground/50 mb-2">check_circle</span>
                <p className="text-muted-foreground">Şu an hiçbir ihtiyaç anonsu yok.</p>
             </div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {liveReqs.map((r) => (
                  <div key={r.id} className={`p-4 xl:p-5 rounded-lg flex flex-col justify-between border ${r.status === 'completed' ? 'bg-muted/30 border-muted opacity-60' : r.status === 'on_the_way' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : r.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 opacity-80' : r.urgency === 'super_urgent' ? 'bg-red-100 dark:bg-red-900/40 border-red-500 animate-pulse-soft' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200'}`}>
                     <div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                           {r.urgency === 'super_urgent' && r.status === 'pending' && (
                             <span className="px-2 py-1 text-[11px] font-black rounded-md bg-red-600 text-white animate-bounce">
                               🔥 SÜPER ACİL
                             </span>
                           )}
                           <span className={`px-2 py-1 text-[11px] font-bold rounded-md ${r.status === 'completed' ? 'bg-gray-200 text-gray-700' : r.status === 'on_the_way' ? 'bg-amber-200 text-amber-800' : r.status === 'rejected' ? 'bg-red-200 text-red-800' : r.urgency === 'super_urgent' ? 'hidden' : 'bg-orange-500 text-white'}`}>
                              {r.status === 'completed' ? 'Tamamlandı' : r.status === 'on_the_way' ? 'Yola Çıktı' : r.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                           </span>
                           <span className="text-sm font-medium opacity-60">
                              {new Date(r.createdAt?.toMillis()).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                        <h4 className={`font-bold text-lg mt-2 ${r.urgency === 'super_urgent' && r.status === 'pending' ? 'text-red-700 dark:text-red-400' : ''}`}>{r.itemName}</h4>
                        <p className="text-sm text-muted-foreground mt-1 mb-2">
                           <span className="material-symbols-outlined text-xs align-middle mr-1">person</span>
                           {r.requestedByName} <span className="mx-1">•</span>
                           <span className="material-symbols-outlined text-xs align-middle mr-1">location_on</span>
                           {r.requestedZone}
                        </p>
                     </div>
                     <div className="flex flex-col mt-2">
                        {r.status === 'pending' && (
                           <>
                             <input 
                               type="text" 
                               placeholder="Cevap notu (isteğe bağlı)..."
                               className="bg-background border border-border rounded px-3 py-1.5 text-sm w-full mb-2"
                               value={replyTexts[r.id] || ''}
                               onChange={(e) => setReplyTexts(prev => ({...prev, [r.id]: e.target.value}))}
                             />
                             <div className="flex gap-2">
                               <button onClick={() => handleUpdateStatus(r.id, 'on_the_way', replyTexts[r.id])} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-2 py-2 rounded-lg text-sm font-bold flex items-center justify-center">
                                  <span className="material-symbols-outlined text-sm mr-1">local_shipping</span> Yola Çıkar
                               </button>
                               <button onClick={() => handleUpdateStatus(r.id, 'rejected', replyTexts[r.id])} className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60 px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition" title="Reddet">
                                  <span className="material-symbols-outlined text-sm">close</span>
                               </button>
                             </div>
                           </>
                        )}
                        {r.status === 'on_the_way' && (
                           <div className="flex flex-col">
                             {r.adminReply && <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30 px-2 py-1.5 rounded mb-2 italic">Notunuz: {r.adminReply}</p>}
                             <button onClick={() => handleUpdateStatus(r.id, 'completed')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center">
                                <span className="material-symbols-outlined text-sm mr-1">check</span> Teslim Edildi
                             </button>
                           </div>
                        )}
                     </div>
                  </div>
                ))}
             </div>
         )}

         {/* TAMAMLANANLAR ALANI */}
         {pastReqs.length > 0 && (
            <details className="mt-8 bg-card rounded-xl border border-border group overflow-hidden">
               <summary className="p-4 bg-muted/20 cursor-pointer font-bold flex items-center justify-between list-none">
                  <div className="flex items-center">
                     <span className="material-symbols-outlined text-muted-foreground mr-2">history</span>
                     Geçmiş Talepler ({pastReqs.length})
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground group-open:rotate-180 transition-transform">expand_more</span>
               </summary>
               <div className="p-6 pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 border-t border-border bg-card">
                  {pastReqs.map((r) => (
                    <div key={r.id} className="p-4 xl:p-5 rounded-lg flex flex-col justify-between border bg-muted/20 border-muted opacity-70">
                       <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                             <span className={`px-2 py-1 text-[11px] font-bold rounded-md ${r.status === 'completed' ? 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : r.status === 'cancelled' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {r.status === 'completed' ? 'Tamamlandı' : r.status === 'cancelled' ? 'İptal Edildi' : 'Reddedildi'}
                             </span>
                             <span className="text-sm font-medium opacity-60">
                                {new Date(r.createdAt?.toMillis()).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                             </span>
                          </div>
                          <h4 className={`font-bold text-lg mt-2 ${r.status === 'completed' ? 'line-through opacity-70' : ''}`}>{r.itemName}</h4>
                          <p className="text-sm text-muted-foreground mt-1 mb-2">
                             <span className="material-symbols-outlined text-xs align-middle mr-1">person</span>
                             {r.requestedByName} <span className="mx-1">•</span>
                             <span className="material-symbols-outlined text-xs align-middle mr-1">location_on</span>
                             {r.requestedZone}
                          </p>
                          {r.adminReply && <p className="text-xs text-muted-foreground bg-muted p-1.5 rounded italic">Cevabınız: {r.adminReply}</p>}
                       </div>
                    </div>
                  ))}
               </div>
            </details>
         )}

      </div>

      {/* KATEGORI VE MALZEME YONETIMI */}
      <div className="bg-card rounded-xl p-6 border border-border">
         <h3 className="text-lg font-bold mb-1">Mevcut Malzeme Stoğu (Butonlar)</h3>
         <p className="text-sm text-muted-foreground mb-6">Personelin mobil uygulamasında bir tıklamayla isteyebileceği hazır malzeme butonları.</p>

         <div className="flex flex-col sm:flex-row gap-4 mb-8 max-w-3xl">
            <input 
               type="text" 
               placeholder="Yeni Kategori Ekle (Örn: Lojistik, İçecek Standı, Temizlik...)" 
               className="w-full bg-background border border-border rounded-xl px-5 py-3 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
               value={newCatTitle}
               onChange={(e) => setNewCatTitle(e.target.value)}
               onKeyDown={(e) => { if(e.key === 'Enter') handleAddCategory(); }}
            />
            <button onClick={handleAddCategory} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm transition-all focus:ring-2 focus:ring-blue-500/50">
               Kategori Ekle
            </button>
         </div>

         {categories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
               {categories.map((cat) => (
                  <div key={cat.id} className="bg-background rounded-lg border border-border p-4 shadow-sm">
                     <div className="flex items-center justify-between mb-4 border-b pb-2">
                        {editingCatId === cat.id ? (
                           <div className="flex flex-col w-full mr-4">
                             <div className="flex items-center space-x-2 flex-1 mb-2">
                               <input 
                                 type="text" 
                                 value={editingCatTitle} 
                                 onChange={(e) => setEditingCatTitle(e.target.value)}
                                 className="flex-1 bg-muted border border-border rounded px-2 py-1 text-sm font-bold"
                                 autoFocus
                                 onKeyDown={(e) => { if(e.key === 'Enter') handleEditCategorySave(cat.id); }}
                               />
                               <button onClick={() => handleEditCategorySave(cat.id)} className="text-green-600 hover:bg-green-50 px-2 py-1 rounded">
                                 <span className="material-symbols-outlined text-sm">check</span>
                               </button>
                               <button onClick={() => setEditingCatId(null)} className="text-muted-foreground hover:bg-muted px-2 py-1 rounded">
                                 <span className="material-symbols-outlined text-sm">close</span>
                               </button>
                             </div>
                           </div>
                        ) : (
                           <div className="flex items-center group">
                             <h4 className="font-bold flex-1">{cat.title}</h4>
                             <button onClick={() => { setEditingCatId(cat.id); setEditingCatTitle(cat.title); }} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition px-2">
                               <span className="material-symbols-outlined text-[16px]">edit</span>
                             </button>
                           </div>
                        )}
                        <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded text-xs transition ml-auto" title="Kategoriyi Sil">
                           <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                     </div>

                     <div className="mb-4">
                        {editingCatId === cat.id && allZones.length > 0 && (
                          <div className="bg-muted/30 p-2 rounded-md border border-border/50 mb-3">
                             <p className="text-xs text-muted-foreground mb-2 font-medium">Bu kategoriyi hangi istasyonlar isteyebilir? (Boşsa herkes isteyebilir)</p>
                             <div className="flex flex-wrap gap-1.5">
                               {allZones.map(zone => {
                                  const isSelected = (cat.allowedZones || []).includes(zone);
                                  return (
                                     <button 
                                        key={zone}
                                        onClick={() => handleToggleZone(cat.id, zone)}
                                        className={`px-2 py-1 text-[11px] rounded-md transition ${isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-background border border-border text-foreground hover:bg-muted'}`}
                                     >
                                        {zone}
                                     </button>
                                  );
                               })}
                             </div>
                          </div>
                        )}
                        {(cat.allowedZones || []).length > 0 && editingCatId !== cat.id && (
                           <div className="flex flex-wrap gap-1 mb-2">
                             <span className="text-[10px] text-muted-foreground self-center mr-1">Sadece:</span>
                             {cat.allowedZones.map((z: string) => (
                               <span key={z} className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">{z}</span>
                             ))}
                           </div>
                        )}
                     </div>

                     <div className="flex flex-wrap gap-2 mb-4">
                        {cat.items?.map((item: string) => (
                           <div key={item} className="bg-muted px-3 py-1.5 rounded-full text-sm flex items-center shadow-sm">
                              {item}
                              <button onClick={() => handleRemoveItem(cat.id, item)} className="ml-2 text-muted-foreground hover:text-red-500">
                                 <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                           </div>
                        ))}
                     </div>

                     <div className="flex flex-wrap gap-2 mt-4 max-w-xl">
                        <input 
                           type="text" 
                           placeholder="Yeni Malzeme Ekle (Örn: Peçete, Bardak...)" 
                           className="flex-1 min-w-[200px] w-full bg-muted/30 border border-muted-foreground/20 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
                           value={selectedCatId === cat.id ? newItemName : ''}
                           onChange={(e) => { setSelectedCatId(cat.id); setNewItemName(e.target.value); }}
                           onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(cat.id); }}
                        />
                        <button onClick={() => handleAddItem(cat.id)} className="w-full xl:w-auto bg-secondary hover:bg-secondary/80 text-secondary-foreground px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm">
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

