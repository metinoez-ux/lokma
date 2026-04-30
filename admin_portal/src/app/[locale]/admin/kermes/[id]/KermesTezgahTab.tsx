"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ShoppingBag, 
  UtensilsCrossed, 
  Bike,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Timer,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface KermesTezgahProps {
  kermesId: string;
  locale?: string;
}

export default function KermesTezgahTab({ kermesId, locale = 'tr' }: KermesTezgahProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gelAl' | 'masada' | 'kurye'>('gelAl');

  useEffect(() => {
    if (!kermesId) return;

    // Sadece hazırlanıyor ve hazır siparişleri getir
    const q = query(
      collection(db, 'kermes_orders'), 
      where('kermesId', '==', kermesId),
      where('status', 'in', ['preparing', 'ready'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const active: any[] = [];
      snap.docs.forEach(d => {
        active.push({ id: d.id, ...d.data() });
      });
      // FIFO: en eski en üstte
      setOrders(active.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)));
      setLoading(false);
    });

    return () => unsub();
  }, [kermesId]);

  // Siparişi Teslim Et (Gel Al & Masa)
  const markAsDelivered = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'kermes_orders', orderId), {
        status: 'delivered',
        updatedAt: Timestamp.now(),
        deliveredAt: Timestamp.now()
      });
      toast.success('Sipariş teslim edildi!');
    } catch (e) {
      console.error(e);
      toast.error('Teslim edilirken hata oluştu');
    }
  };

  // Siparişi Kuryeye Teslim Et
  const markReadyForCourier = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'kermes_orders', orderId), {
        status: 'delivered', 
        updatedAt: Timestamp.now(),
        deliveredAt: Timestamp.now()
      });
      toast.success('Kuryeye teslim edildi!');
    } catch (e) {
      console.error(e);
      toast.error('İşlem başarısız');
    }
  };

  const getUrgencyColor = (createdAt: any) => {
    if (!createdAt) return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    const mins = Math.floor((Date.now() - (createdAt.toMillis?.() || 0)) / 60000);
    if (mins >= 15) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (mins >= 8) return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  const getWaitMinutes = (createdAt: any) => {
    if (!createdAt) return 0;
    return Math.floor((Date.now() - (createdAt.toMillis?.() || 0)) / 60000);
  };

  // Filter orders by active tab
  const tabOrders = orders.filter(o => o.deliveryType === activeTab);
  
  // Split into Ready and Preparing
  const readyOrders = tabOrders.filter(o => o.status === 'ready');
  const preparingOrders = tabOrders.filter(o => o.status === 'preparing');

  return (
    <div className="bg-[#0B0F19] min-h-[600px] rounded-xl text-white shadow-inner border border-slate-800/50 flex flex-col h-full">
      
      {/* HEADER / TAB NAV */}
      <div className="flex border-b border-white/5 bg-[#131A2A] rounded-t-xl sticky top-0 z-10">
        <button 
          onClick={() => setActiveTab('gelAl')}
          className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 relative transition-colors ${activeTab === 'gelAl' ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ShoppingBag className="w-6 h-6" />
          <span className="font-bold text-sm">Gel Al</span>
          {activeTab === 'gelAl' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500 rounded-t-md" />}
        </button>
        <button 
          onClick={() => setActiveTab('masada')}
          className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 relative transition-colors ${activeTab === 'masada' ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <UtensilsCrossed className="w-6 h-6" />
          <span className="font-bold text-sm">Masa</span>
          {activeTab === 'masada' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500 rounded-t-md" />}
        </button>
        <button 
          onClick={() => setActiveTab('kurye')}
          className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 relative transition-colors ${activeTab === 'kurye' ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Bike className="w-6 h-6" />
          <span className="font-bold text-sm">Kurye</span>
          {activeTab === 'kurye' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500 rounded-t-md" />}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      ) : tabOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 min-h-[400px]">
          {activeTab === 'gelAl' && <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />}
          {activeTab === 'masada' && <UtensilsCrossed className="w-16 h-16 mb-4 opacity-20" />}
          {activeTab === 'kurye' && <Bike className="w-16 h-16 mb-4 opacity-20" />}
          <h3 className="text-xl font-bold text-slate-400">
            {activeTab === 'gelAl' ? 'Gel Al' : activeTab === 'masada' ? 'Masa' : 'Kurye'} siparişi yok
          </h3>
          <p className="text-slate-600 mt-2">Şu an beklemede olan bir sipariş bulunmuyor.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* TESLİME HAZIR SECTION */}
          {readyOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-2 rounded-lg w-max">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold tracking-wide">TESLİME HAZIR ({readyOrders.length})</span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {readyOrders.map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    isReady={true} 
                    urgencyClass={getUrgencyColor(order.createdAt)} 
                    waitMins={getWaitMinutes(order.createdAt)} 
                    onAction={() => activeTab === 'kurye' ? markReadyForCourier(order.id) : markAsDelivered(order.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* HAZIRLANIYOR SECTION */}
          {preparingOrders.length > 0 && (
            <div className="space-y-4 mt-8">
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-500 px-4 py-2 rounded-lg w-max">
                <Timer className="w-5 h-5" />
                <span className="font-bold tracking-wide">HAZIRLANIYOR ({preparingOrders.length})</span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {preparingOrders.map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    isReady={false} 
                    urgencyClass={getUrgencyColor(order.createdAt)} 
                    waitMins={getWaitMinutes(order.createdAt)}
                    onAction={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function OrderCard({ order, isReady, urgencyClass, waitMins, onAction }: { order: any, isReady: boolean, urgencyClass: string, waitMins: number, onAction: () => void }) {
  
  const readyItems = (order.items || []).filter((i:any) => i.itemStatus === 'ready').length;
  const totalItems = (order.items || []).length;
  const progress = totalItems > 0 ? (readyItems / totalItems) * 100 : 0;

  return (
    <div className={`bg-[#1A1D24] rounded-2xl overflow-hidden flex flex-col border-2 ${isReady ? 'border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : waitMins >= 15 ? 'border-red-500/50' : 'border-transparent'}`}>
      
      {/* Card Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isReady ? 'bg-green-500/10' : 'bg-pink-500/10'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-white">#{order.orderNumber}</span>
          <div className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${
            order.deliveryType === 'gelAl' ? 'bg-green-500/20 text-green-400' : 
            order.deliveryType === 'masada' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
          }`}>
            {order.deliveryType === 'gelAl' && <ShoppingBag className="w-3 h-3" />}
            {order.deliveryType === 'masada' && <UtensilsCrossed className="w-3 h-3" />}
            {order.deliveryType === 'kurye' && <Bike className="w-3 h-3" />}
            {order.deliveryType === 'gelAl' ? 'Gel Al' : order.deliveryType === 'masada' ? 'Masa' : 'Kurye'}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isReady && (
            <span className="text-blue-400 font-bold text-sm">
              {readyItems}/{totalItems}
            </span>
          )}
          <div className={`px-2 py-1 rounded-md text-xs font-bold border flex items-center gap-1 ${urgencyClass}`}>
            <Clock className="w-3 h-3" />
            {waitMins}dk
          </div>
        </div>
      </div>

      {/* Customer / Context Info */}
      {(order.customerName || order.tableNumber || order.tableSection) && (
        <div className="px-4 pt-3 flex flex-wrap items-center gap-3">
          {order.customerName && order.customerName !== 'POS Siparis' && (
            <div className="flex items-center gap-1.5 text-slate-300 text-sm">
              <User className="w-4 h-4 text-slate-500" />
              <span className="font-medium">{order.customerName}</span>
            </div>
          )}
          {order.tableNumber && (
            <div className="bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded text-sm font-bold">
              M{order.tableNumber}
            </div>
          )}
          {order.tableSection && (
            <div className="text-slate-500 text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {order.tableSection}
            </div>
          )}
        </div>
      )}

      {/* Items List */}
      <div className="px-4 py-4 space-y-3 flex-1">
        {(order.items || []).map((item: any, idx: number) => {
          const itemReady = item.itemStatus === 'ready';
          return (
            <div key={idx} className="flex items-start gap-2">
              <div className="mt-0.5">
                {itemReady ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                )}
              </div>
              <div className="flex-1">
                <div className={`text-base font-bold ${itemReady ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {item.quantity}x {item.productName || item.name}
                </div>
                {item.prepZones && item.prepZones.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.prepZones.map((z: string) => (
                      <span key={z} className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                        {z}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Area */}
      <div className="px-4 pb-4 mt-auto">
        <div className="flex items-center justify-between mb-4 text-sm font-bold">
          <span className="text-slate-500">Toplam</span>
          <span className="text-white text-lg">€{(order.totalAmount || 0).toFixed(2)}</span>
        </div>

        {isReady ? (
          <button 
            onClick={onAction}
            className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/20"
          >
            <CheckCircle className="w-5 h-5" />
            {order.deliveryType === 'masada' ? 'TESLİM EDİLDİ' : order.deliveryType === 'kurye' ? 'KURYE HAZIR' : 'TESLİM ET'}
          </button>
        ) : (
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
