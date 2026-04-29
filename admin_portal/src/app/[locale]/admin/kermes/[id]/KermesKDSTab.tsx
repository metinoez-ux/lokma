"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle as FiCheckCircle, Clock as FiClock, AlertCircle as FiAlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface KermesKDSProps {
  kermesId: string;
  locale?: string;
}

export default function KermesKDSTab({ kermesId, locale = 'tr' }: KermesKDSProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kermesId) return;

    // Sadece hazırlanan siparişleri (preparing) dinle
    const q = query(
      collection(db, 'kermes_orders'), 
      where('kermesId', '==', kermesId),
      where('status', '==', 'preparing')
    );

    const unsub = onSnapshot(q, (snap) => {
      const active: any[] = [];
      snap.docs.forEach(d => {
        active.push({ id: d.id, ...d.data() });
      });
      // En eski sipariş en başta olacak şekilde (FIFO) sırala
      setOrders(active.sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis()));
      setLoading(false);
    });

    return () => unsub();
  }, [kermesId]);

  const markAsReady = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'kermes_orders', orderId), {
        status: 'ready',
        readyAt: new Date()
      });
      toast.success('Sipariş Hazır olarak işaretlendi!');
    } catch (err) {
      console.error(err);
      toast.error('Bir hata oluştu!');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">KDS Yükleniyor...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <FiCheckCircle className="w-16 h-16 mb-4 text-emerald-500/50" />
        <h2 className="text-2xl font-bold text-foreground">Bekleyen Sipariş Yok</h2>
        <p>Tüm siparişler hazırlandı veya henüz yeni sipariş gelmedi.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/20 min-h-screen rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FiAlertCircle className="text-orange-500" /> 
          Ocakbaşı Aktif Siparişler
        </h2>
        <div className="bg-orange-500 text-white px-4 py-2 rounded-full font-bold shadow-md">
          Bekleyen: {orders.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => {
          const waitTime = order.createdAt?.toDate ? Math.floor((new Date().getTime() - order.createdAt.toDate().getTime()) / 60000) : 0;
          const isUrgent = waitTime >= 15;

          return (
            <div key={order.id} className={`flex flex-col bg-card rounded-xl border-2 overflow-hidden shadow-sm transition ${isUrgent ? 'border-red-500/50 shadow-red-500/20' : 'border-border/50'}`}>
              
              {/* KDS Kart Başlığı */}
              <div className={`p-3 text-white flex justify-between items-center ${isUrgent ? 'bg-red-500' : 'bg-slate-800'}`}>
                <div className="font-bold text-lg">
                  {order.orderNumber || order.id.slice(-5).toUpperCase()}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FiClock className="w-4 h-4" />
                  {waitTime} dk
                </div>
              </div>

              {/* Sipariş Tipi & Masa */}
              <div className="px-4 py-2 bg-muted/50 border-b border-border/50 flex justify-between items-center">
                <span className="font-semibold text-foreground">
                  {order.deliveryType === 'dine_in' ? '🍽️ Masa ' + order.tableNo : '🛍️ Gel-Al'}
                </span>
              </div>

              {/* İçerik / Ürünler */}
              <div className="p-4 flex-1 overflow-y-auto min-h-[150px] max-h-[300px]">
                <ul className="space-y-3">
                  {order.items?.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-start text-sm border-b border-border/30 pb-2 last:border-0">
                      <div className="flex gap-2">
                        <span className="font-bold text-lg min-w-[24px]">{item.quantity}x</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">{item.productName}</span>
                          {item.variantName && (
                            <span className="text-muted-foreground text-xs">+ {item.variantName}</span>
                          )}
                          {item.notes && (
                            <span className="text-orange-500 text-xs italic">"{item.notes}"</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Aksiyon */}
              <div className="p-3 bg-muted/20 border-t border-border/50">
                <button
                  onClick={() => markAsReady(order.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition active:scale-95 shadow-md"
                >
                  <FiCheckCircle className="w-5 h-5" />
                  SİPARİŞ HAZIR
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
