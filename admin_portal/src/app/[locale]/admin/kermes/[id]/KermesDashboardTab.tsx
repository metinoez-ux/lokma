"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLocalizedText } from '@/lib/utils';
import { TrendingUp as FiTrendingUp, ShoppingBag as FiShoppingBag, Users as FiUsers, Clock as FiClock, Activity as FiActivity } from 'lucide-react';

interface KermesDashboardProps {
  kermesId: string;
  assignedStaffCount: number;
  assignedWaitersCount: number;
  locale?: string;
}

export default function KermesDashboardTab({ kermesId, assignedStaffCount, assignedWaitersCount, locale = 'tr' }: KermesDashboardProps) {
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kermesId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Siparişleri dinle
    const q = query(collection(db, 'kermes_orders'), where('kermesId', '==', kermesId));
    const unsub = onSnapshot(q, (snap) => {
      let revenue = 0;
      const active: any[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const orderDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        
        if (orderDate >= today && data.status !== 'cancelled' && data.status !== 'rejected') {
          revenue += (data.totalAmount || 0);
        }

        if (['pending', 'accepted', 'preparing', 'ready'].includes(data.status)) {
          active.push({ id: d.id, ...data });
        }
      });
      setTodayRevenue(revenue);
      setActiveOrders(active.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    });

    return () => unsub();
  }, [kermesId]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Dashboard yükleniyor...</div>;
  }

  const statCards = [
    { label: "Bugünkü Ciro", value: `€${todayRevenue.toFixed(2)}`, icon: FiTrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Aktif Sipariş", value: activeOrders.length, icon: FiActivity, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Görevli Garson", value: assignedWaitersCount, icon: FiUsers, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Görevli Personel", value: assignedStaffCount, icon: FiShoppingBag, color: "text-purple-500", bg: "bg-purple-500/10" }
  ];

  return (
    <div className="space-y-6">
      {/* İstatistik Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Canlı Sipariş Akışı */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border/50 flex justify-between items-center bg-muted/20">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Canlı İşlem Akışı
          </h2>
        </div>
        <div className="p-0">
          {activeOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <FiClock className="w-8 h-8 mb-3 opacity-50" />
              Şu an bekleyen sipariş bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {activeOrders.slice(0, 10).map((order) => (
                <div key={order.id} className="p-4 hover:bg-muted/30 transition flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-semibold">{order.orderNumber || order.id.slice(-5).toUpperCase()} - {order.deliveryType === 'dine_in' ? `Masa ${order.tableNo}` : 'Gel-Al'}</span>
                    <span className="text-xs text-muted-foreground">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString() : ''} 
                    </span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="font-bold">€{order.totalAmount?.toFixed(2)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      order.status === 'pending' ? 'bg-orange-500/10 text-orange-600' :
                      order.status === 'preparing' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-emerald-500/10 text-emerald-600'
                    }`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
