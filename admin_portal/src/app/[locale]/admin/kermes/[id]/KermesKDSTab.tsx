"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle as FiCheckCircle, Clock as FiClock, AlertCircle as FiAlertCircle, Utensils as FiUtensils, Hourglass as FiHourglass, LayoutDashboard } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface KermesKDSProps {
  kermesId: string;
  locale?: string;
  allZones?: string[];
}

export default function KermesKDSTab({ kermesId, locale = 'tr', allZones = [] }: KermesKDSProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const uniqueZones = Array.from(new Set(allZones));
  const [activeZone, setActiveZone] = useState<string>('Tüm İstasyonlar');

  useEffect(() => {
    if (!kermesId) return;

    // Sadece beklemede ve hazırlanan siparişleri (pending, preparing) dinle
    const q = query(
      collection(db, 'kermes_orders'), 
      where('kermesId', '==', kermesId),
      where('status', 'in', ['pending', 'preparing'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const active: any[] = [];
      snap.docs.forEach(d => {
        active.push({ id: d.id, ...d.data() });
      });
      // En eski sipariş en başta olacak şekilde (FIFO) sırala
      setOrders(active.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)));
      setLoading(false);
    });

    return () => unsub();
  }, [kermesId]);

  const toggleItemStatus = async (orderId: string, itemIndex: number, currentStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newItems = [...order.items];
      let newStatus = 'preparing';
      
      if (!currentStatus || currentStatus === 'pending') newStatus = 'preparing';
      else if (currentStatus === 'preparing') newStatus = 'ready';
      else return; // already ready

      newItems[itemIndex] = { ...newItems[itemIndex], itemStatus: newStatus };

      const updatePayload: any = { items: newItems };
      
      // Auto-complete order if all items are ready
      const allReady = newItems.every((item: any) => item.itemStatus === 'ready');
      if (allReady && newStatus === 'ready') {
        updatePayload.status = 'ready';
        updatePayload.readyAt = new Date();
      }

      // If the order was pending, mark it as preparing since we started an item
      if (order.status === 'pending') {
        updatePayload.status = 'preparing';
      }

      await updateDoc(doc(db, 'kermes_orders', orderId), updatePayload);
      
      if (newStatus === 'ready') {
        toast.success('Ürün Hazır!');
      } else {
        toast.success('Hazırlanıyor olarak işaretlendi');
      }
    } catch (err) {
      console.error(err);
      toast.error('Bir hata oluştu!');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">KDS Yükleniyor...</div>;
  }

  // Hangi zone'da kaç sipariş (veya bekleyen/hazırlanan ürün) var hesapla
  const zoneCounts: Record<string, number> = {};
  uniqueZones.forEach(z => zoneCounts[z] = 0);
  let totalPendingOrders = 0;

  orders.forEach(order => {
    let orderCountedForTotal = false;
    const countedZones = new Set<string>();

    (order.items || []).forEach((item: any) => {
      const status = item.itemStatus || 'pending';
      if (status !== 'ready') {
        if (!orderCountedForTotal) {
          totalPendingOrders++;
          orderCountedForTotal = true;
        }
        
        const itemZones = item.prepZone || item.prepZones || [];
        itemZones.forEach((z: string) => {
          if (!countedZones.has(z)) {
            if (zoneCounts[z] !== undefined) zoneCounts[z]++;
            countedZones.add(z);
          }
        });
      }
    });
  });

  // Filter orders that actually contain items for the activeZone
  const zoneOrders = orders.filter(order => {
    if (activeZone === 'Tüm İstasyonlar') return true;
    return (order.items || []).some((item: any) => {
      const itemZones = item.prepZone || item.prepZones || [];
      return itemZones.includes(activeZone) && item.itemStatus !== 'ready';
    });
  });

  return (
    <div className="p-6 bg-[#0B0F19] min-h-screen rounded-xl text-white shadow-inner border border-slate-800/50">
      {/* KDS Header - Zone Switcher */}
      <div className="flex flex-col mb-8 gap-6 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
            <FiUtensils className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              KDS
              <span className="text-orange-500 text-2xl font-medium">- {activeZone}</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Canlı Mutfak Yönetim Paneli</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2.5 bg-[#131A2A] p-2 rounded-2xl border border-white/5 w-full">
          {/* Tüm İstasyonlar Tab */}
          <button
            onClick={() => setActiveZone('Tüm İstasyonlar')}
            className={`relative px-5 py-2.5 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 ${
              activeZone === 'Tüm İstasyonlar' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Tüm İstasyonlar
            {totalPendingOrders > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-400 text-[#0B0F19] text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                {totalPendingOrders}
              </span>
            )}
          </button>

          {uniqueZones.map(zone => {
            const count = zoneCounts[zone] || 0;
            return (
              <button
                key={zone}
                onClick={() => setActiveZone(zone)}
                className={`relative px-5 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                  activeZone === zone 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/25' 
                    : 'bg-[#1C2538] text-slate-300 hover:bg-[#253147] border border-white/5'
                }`}
              >
                {zone}
                {count > 0 && (
                  <span className={`absolute -top-2 -right-2 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${
                    activeZone === zone 
                      ? 'bg-white text-orange-600' 
                      : 'bg-orange-500 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {zoneOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground bg-[#131A2A] rounded-2xl border border-white/5 border-dashed">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
            <FiCheckCircle className="w-12 h-12 text-emerald-500/60" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Sipariş Yok</h2>
          <p className="text-lg text-slate-400 max-w-md text-center">{activeZone} istasyonunda şu an bekleyen veya hazırlanan bir sipariş bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {zoneOrders.map((order) => {
            const waitMinutes = order.createdAt?.toDate ? Math.floor((new Date().getTime() - order.createdAt.toDate().getTime()) / 60000) : 0;
            const isUrgent = waitMinutes >= 15;
            const isWarning = waitMinutes >= 8 && !isUrgent;

            // Split items into zone items and other items
            const zoneItems: { index: number, item: any }[] = [];
            const otherItems: any[] = [];

            (order.items || []).forEach((item: any, i: number) => {
              const itemZones = item.prepZone || item.prepZones || [];
              if (activeZone === 'Tüm İstasyonlar' || itemZones.includes(activeZone) || uniqueZones.length === 0) {
                zoneItems.push({ index: i, item });
              } else {
                otherItems.push(item);
              }
            });

            return (
              <div key={order.id} className={`flex flex-col bg-[#131A2A] rounded-2xl border-2 overflow-hidden shadow-xl transition-all duration-300 ${
                isUrgent ? 'border-red-500/80 shadow-red-500/10' : 
                isWarning ? 'border-orange-500/50 shadow-orange-500/5' : 
                'border-slate-800'
              }`}>
                
                {/* KDS Kart Başlığı */}
                <div className={`p-5 text-white flex justify-between items-center ${
                  isUrgent ? 'bg-gradient-to-r from-red-600 to-red-500' : 
                  isWarning ? 'bg-gradient-to-r from-orange-600 to-orange-500' : 
                  'bg-[#1C2538]'
                }`}>
                  <div className="flex flex-col">
                    <span className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">SİPARİŞ NO</span>
                    <div className="font-black text-3xl">
                      #{order.orderNumber || order.id.slice(-5).toUpperCase()}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl shadow-inner ${
                    isUrgent || isWarning ? 'bg-black/20 text-white' : 'bg-slate-900 text-slate-300'
                  }`}>
                    <FiClock className="w-4 h-4" />
                    {waitMinutes} dk
                  </div>
                </div>

                {/* Sipariş Tipi & Masa */}
                <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{order.deliveryType === 'dine_in' ? '🍽️' : '🛍️'}</span>
                    <span className="font-bold text-slate-200 text-lg">
                      {order.deliveryType === 'dine_in' ? `Masa ${order.tableNo}` : 'Stant'}
                    </span>
                  </div>
                  {order.customerName && (
                    <span className="text-slate-400 text-sm font-medium">{order.customerName}</span>
                  )}
                </div>

                {/* Zone'a Ait Ürünler */}
                <div className="p-4 flex-1 overflow-y-auto">
                  <div className="space-y-3">
                    {zoneItems.map(({ index, item }) => {
                      const status = item.itemStatus || 'pending';
                      const isReady = status === 'ready';
                      const isPreparing = status === 'preparing';

                      return (
                        <div key={index} className={`flex flex-col p-4 rounded-xl border-2 transition-all duration-300 ${
                          isReady ? 'bg-emerald-500/5 border-emerald-500/20' : 
                          isPreparing ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/10' : 
                          'bg-[#1C2538] border-white/5 hover:border-white/10'
                        }`}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-xl ${
                                isReady ? 'bg-emerald-500/20 text-emerald-400' : 
                                isPreparing ? 'bg-blue-500/20 text-blue-400' : 
                                'bg-slate-800 text-white'
                              }`}>
                                {item.quantity}
                              </div>
                              <div className="flex flex-col pt-1">
                                <span className={`font-bold text-xl leading-none ${isReady ? 'text-emerald-400/70 line-through' : 'text-white'}`}>
                                  {item.name || item.productName}
                                </span>
                                {(item.variantName || item.category) && (
                                  <span className="text-slate-400 text-sm mt-1.5 font-medium">{item.variantName || item.category}</span>
                                )}
                                {item.notes && (
                                  <span className="text-orange-300 text-sm italic font-medium mt-2 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
                                    "{item.notes}"
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Aksiyon Butonu */}
                          <div className="mt-4">
                            <button
                              onClick={() => toggleItemStatus(order.id, index, status)}
                              disabled={isReady}
                              className={`w-full font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md tracking-wide ${
                                isReady ? 'bg-emerald-500/10 text-emerald-500/50 cursor-not-allowed border border-emerald-500/20' : 
                                isPreparing ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/25 text-white shadow-lg' : 
                                'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25 text-white shadow-lg'
                              }`}
                            >
                              {isReady ? (
                                <><FiCheckCircle className="w-5 h-5" /> TAMAMLANDI</>
                              ) : isPreparing ? (
                                <><FiCheckCircle className="w-5 h-5" /> HAZIR OLARAK İŞARETLE</>
                              ) : (
                                <><FiHourglass className="w-5 h-5" /> HAZIRLAMAYA BAŞLA</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Diğer Zone Ürünleri (Sadece Bilgi) */}
                  {otherItems.length > 0 && activeZone !== 'Tüm İstasyonlar' && (
                    <div className="mt-6 pt-5 border-t border-white/5">
                      <p className="text-[10px] text-slate-500 font-black mb-3 uppercase tracking-widest flex items-center gap-2">
                        <span>Diğer İstasyonlar</span>
                        <span className="h-px flex-1 bg-white/5"></span>
                      </p>
                      <div className="space-y-2.5">
                        {otherItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-sm text-slate-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                            <FiCheckCircle className={`w-4 h-4 flex-shrink-0 ${item.itemStatus === 'ready' ? 'text-emerald-500' : 'text-slate-600'}`} />
                            <span className={`font-medium ${item.itemStatus === 'ready' ? 'line-through opacity-50' : ''}`}>
                              <span className="font-bold text-white/50 mr-1">{item.quantity}x</span> {item.name || item.productName}
                            </span>
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-black/30 px-2 py-1 rounded-md text-slate-500">
                              {(item.prepZone || item.prepZones || []).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
