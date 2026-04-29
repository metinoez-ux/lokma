'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

interface KermesTahsilatTabProps {
  kermesId: string;
  kermesAdmins: any[];
  workspaceStaff: any[];
  isAdmin: boolean;
}

interface Handover {
  id: string;
  staffId: string;
  adminId: string | null;
  amount: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: any;
  resolvedAt?: any;
}

export default function KermesTahsilatTab({ kermesId, kermesAdmins, workspaceStaff, isAdmin }: KermesTahsilatTabProps) {
  const t = useTranslations('Kermes');
  const [activeSubTab, setActiveSubTab] = useState<'personel' | 'onaylar' | 'loglar'>('personel');
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [kermesId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Handovers
      const hoSnapshot = await getDocs(
        query(collection(db, 'kermes_cash_handovers'), where('kermesId', '==', kermesId), orderBy('createdAt', 'desc'))
      );
      const hoList = hoSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Handover));
      setHandovers(hoList);

      // Fetch Sales (just cash for now)
      // This presumes kermes_events/{id}/product_sales or orders. Using kermes_product_sales for root level.
      const salesSnapshot = await getDocs(
        query(collection(db, 'kermes_events', kermesId, 'product_sales'), where('paymentMethod', '==', 'CASH'), orderBy('soldAt', 'desc'))
      );
      setSales(salesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHandover = async (id: string, newStatus: 'ACCEPTED' | 'REJECTED') => {
    try {
      await updateDoc(doc(db, 'kermes_cash_handovers', id), {
        status: newStatus,
        resolvedAt: Timestamp.now()
      });
      setHandovers(prev => prev.map(ho => ho.id === id ? { ...ho, status: newStatus, resolvedAt: Timestamp.now() } : ho));
    } catch (error) {
      console.error("Error updating handover", error);
      alert("Hata oluştu, tekrar deneyin.");
    }
  };

  const getStaffName = (staffId: string) => {
    const staff = workspaceStaff.find(s => s.userId === staffId || s.id === staffId);
    return staff?.profile?.name || staff?.name || 'Bilinmiyor';
  };

  const pendingHandovers = handovers.filter(h => h.status === 'PENDING');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-3xl">
          🔒
        </div>
        <h2 className="text-xl font-bold text-foreground">Yetkisiz Erişim</h2>
        <p className="text-muted-foreground max-w-md">
          Sizin yeterli Admin haklarınız bulunmuyor. Tahsilat bölümüne sadece Kermes Yöneticileri erişebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="bg-card rounded-xl p-4 border border-emerald-500/20">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center text-sm">💶</span>
          <div>
            <h3 className="text-foreground font-bold">Tahsilat / Kasa Yönetimi</h3>
            <p className="text-xs text-muted-foreground">Görevlerden toplanan nakit paraları ve iptal olan işlemleri yönetin.</p>
          </div>
        </div>
      </div>

      {/* SUB TABS */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button 
          onClick={() => setActiveSubTab('personel')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${activeSubTab === 'personel' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Personel Kasaları
        </button>
        <button 
          onClick={() => setActiveSubTab('onaylar')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${activeSubTab === 'onaylar' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Bekleyen Onaylar {pendingHandovers.length > 0 && <span className="ml-1 px-2 py-0.5 bg-red-600 text-white rounded-full text-xs">{pendingHandovers.length}</span>}
        </button>
        <button 
          onClick={() => setActiveSubTab('loglar')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${activeSubTab === 'loglar' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Nakit Satış Logları
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
      ) : (
        <div className="pt-2">
          
          {/* PERSONEL KASALARI */}
          {activeSubTab === 'personel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaceStaff.filter(s => s.role === 'STAFF' || s.role === 'WAITER').length === 0 ? (
                <div className="col-span-full py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                  Henüz kasa işlemi yapacak personel atanmamış.
                </div>
              ) : (
                workspaceStaff.filter(s => s.role === 'STAFF' || s.role === 'WAITER').map((staff) => {
                  const staffId = staff.userId || staff.id;
                  
                  // Calculate raw cash sales
                  const staffSales = sales.filter(s => s.staffId === staffId || s.createdBy === staffId);
                  const totalSalesValue = staffSales.reduce((acc, curr) => acc + (curr.totalPrice || curr.price || 0), 0);
                  
                  // Calculate handed over (Accepted + Pending)
                  const staffHandovers = handovers.filter(h => h.staffId === staffId && h.status !== 'REJECTED');
                  const totalHandedOver = staffHandovers.reduce((acc, curr) => acc + curr.amount, 0);

                  const pendingObj = handovers.find(h => h.staffId === staffId && h.status === 'PENDING');
                  const currentlyPendingAmount = pendingObj ? pendingObj.amount : 0;
                  
                  const activeDrawer = totalSalesValue - totalHandedOver;

                  return (
                    <div key={staffId} className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <img 
                            src={staff.profile?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} 
                            alt="Avatar" 
                            className="w-10 h-10 rounded-full object-cover" 
                          />
                          <div>
                            <p className="font-medium text-foreground text-sm">{staff.profile?.name || staff.name || 'Bilinmiyor'}</p>
                            <p className="text-xs text-muted-foreground">Görevli</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Şu Anki Kasa (Teslim Edilmeyen):</span>
                          <span className="font-bold text-white text-lg">€{activeDrawer.toFixed(2)}</span>
                        </div>
                        {currentlyPendingAmount > 0 && (
                          <div className="flex justify-between items-center text-sm text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                            <span>Admin Onayı Bekliyor:</span>
                            <span className="font-bold">€{currentlyPendingAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-border mt-2">
                          <span className="text-muted-foreground">Toplam Onaylanan Teslimat:</span>
                          <span className="text-emerald-400">€{(totalHandedOver - currentlyPendingAmount).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ONAYLAR */}
          {activeSubTab === 'onaylar' && (
            <div className="space-y-3">
              {pendingHandovers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                  Bekleyen teslimat onayı bulunmuyor.
                </div>
              ) : (
                pendingHandovers.map(ho => (
                  <div key={ho.id} className="bg-background border border-yellow-500/30 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 lg:gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center text-xl">💵</div>
                      <div>
                        <p className="font-bold text-foreground">{getStaffName(ho.staffId)}</p>
                        <p className="text-sm text-muted-foreground">{ho.createdAt?.toDate().toLocaleString('tr-TR')}</p>
                      </div>
                    </div>
                    
                    <div className="text-2xl font-bold text-emerald-400">
                      €{ho.amount.toFixed(2)}
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleUpdateHandover(ho.id, 'ACCEPTED')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition"
                      >
                        Teslim Aldım
                      </button>
                      <button 
                        onClick={() => handleUpdateHandover(ho.id, 'REJECTED')}
                        className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg font-medium border border-red-800 transition"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* LOGLAR */}
          {activeSubTab === 'loglar' && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Tarih</th>
                      <th className="px-4 py-3 font-medium">Personel</th>
                      <th className="px-4 py-3 font-medium">Ürün x Adet</th>
                      <th className="px-4 py-3 font-medium">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sales.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Hiç nakit satış logu bulunamadı.</td>
                      </tr>
                    ) : (
                      sales.map(s => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">{s.soldAt?.toDate ? s.soldAt.toDate().toLocaleString('tr-TR') : ''}</td>
                          <td className="px-4 py-3 font-medium">{getStaffName(s.staffId || s.createdBy)}</td>
                          <td className="px-4 py-3">{s.productName || 'Sipariş'} <span className="text-muted-foreground">x{s.quantity || 1}</span></td>
                          <td className="px-4 py-3 text-emerald-400 font-medium">€{(s.totalPrice || s.price || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
