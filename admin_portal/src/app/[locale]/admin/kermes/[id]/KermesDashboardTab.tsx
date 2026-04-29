"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Clock as FiClock } from 'lucide-react';
import StatisticsPage from '../../dashboard/page';

interface KermesDashboardProps {
  kermesId: string;
  assignedStaffCount: number;
  assignedWaitersCount: number;
  locale?: string;
}

export default function KermesDashboardTab({ kermesId, assignedStaffCount, assignedWaitersCount, locale = 'tr' }: KermesDashboardProps) {
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [ocakbasiCount, setOcakbasiCount] = useState(0);
  const [peakHour, setPeakHour] = useState(12);
  const [sectionStats, setSectionStats] = useState<Record<string, { count: number, revenue: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kermesId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(collection(db, 'kermes_orders'), where('kermesId', '==', kermesId));
    const unsub = onSnapshot(q, (snap) => {
      let revenue = 0;
      let totalRev = 0;
      let completed = 0;
      let cancelled = 0;
      let ocakbasi = 0;
      const hourCounts: Record<number, number> = {};
      const active: any[] = [];
      const sections: Record<string, { count: number, revenue: number }> = {};

      snap.docs.forEach(d => {
        const data = d.data();
        const orderDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        
        if (data.status === 'cancelled' || data.status === 'rejected') {
          cancelled++;
        } else {
          totalRev += (data.totalAmount || 0);
          if (orderDate >= today) {
            revenue += (data.totalAmount || 0);
          }
          if (['delivered', 'served', 'completed'].includes(data.status)) {
            completed++;
          }

          // Section mapping (Dine-in only)
          if (data.deliveryType === 'dine_in') {
            const sectionName = data.tableSection || 'Diğer / Atanmamış';
            if (!sections[sectionName]) sections[sectionName] = { count: 0, revenue: 0 };
            sections[sectionName].count++;
            sections[sectionName].revenue += (data.totalAmount || 0);
          } else {
            const sectionName = 'Gel-Al / Paket';
            if (!sections[sectionName]) sections[sectionName] = { count: 0, revenue: 0 };
            sections[sectionName].count++;
            sections[sectionName].revenue += (data.totalAmount || 0);
          }

          // Ocakbaşı check (by category, prepZone or name)
          const hasOcakbasi = (data.items || []).some((item: any) => 
            item.prepZone?.toLowerCase() === 'ocakbasi' ||
            item.category?.toLowerCase().includes('ocak') ||
            item.name?.toLowerCase().includes('ocak') ||
            item.productName?.toLowerCase().includes('ocak')
          );
          if (hasOcakbasi) ocakbasi++;

          // Peak hour calculation
          const h = orderDate.getHours();
          hourCounts[h] = (hourCounts[h] || 0) + 1;
        }

        if (['pending', 'accepted', 'preparing', 'ready'].includes(data.status)) {
          active.push({ id: d.id, ...data });
        }
      });

      // Find peak hour
      let maxH = 0;
      let pHour = 12;
      Object.entries(hourCounts).forEach(([h, count]) => {
         if (count > maxH) { maxH = count; pHour = parseInt(h); }
      });

      setTotalOrders(snap.docs.length);
      setTodayRevenue(revenue);
      setTotalRevenue(totalRev);
      setCompletedCount(completed);
      setCancelledCount(cancelled);
      setOcakbasiCount(ocakbasi);
      setPeakHour(pHour);
      setSectionStats(sections);
      setActiveOrders(active.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    });

    return () => unsub();
  }, [kermesId]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Dashboard yükleniyor...</div>;
  }

  const validOrdersCount = totalOrders - cancelledCount;
  const avgOrderValue = validOrdersCount > 0 ? (totalRevenue / validOrdersCount) : 0;

  return (
    <div className="space-y-6">
      {/* Genel İstatistik Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4">Genel İstatistikler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-800 dark:text-green-400">€{todayRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Bugünkü Ciro</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">€{totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Toplam Ciro</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-800 dark:text-blue-400">{totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">Toplam Sipariş</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-800 dark:text-purple-400">€{avgOrderValue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Ort. Sipariş</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-teal-800 dark:text-teal-400">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Tamamlanan</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-800 dark:text-red-400">{cancelledCount}</p>
            <p className="text-xs text-muted-foreground mt-1">İptal</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-800 dark:text-amber-400">{peakHour}:00</p>
            <p className="text-xs text-muted-foreground mt-1">En Yoğun Saat</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-800 dark:text-orange-400">{ocakbasiCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Ocakbaşı Siparişi</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-400">{activeOrders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Aktif Bekleyen</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-400">{assignedWaitersCount + assignedStaffCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Görevli Personel ({assignedWaitersCount} Garson)</p>
          </div>
        </div>
      </div>

      {/* Bölüm Bazlı İstatistikler */}
      {Object.keys(sectionStats).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Bölüm Performansları (Aile, Hanımlar vs.)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(sectionStats).sort((a, b) => b[1].revenue - a[1].revenue).map(([sec, stats]) => (
              <div key={sec} className="bg-gradient-to-br from-indigo-100 dark:from-indigo-900/30 to-indigo-50 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-700/30 rounded-xl p-4 text-center">
                 <p className="text-sm font-bold text-indigo-800 dark:text-indigo-400 mb-2">{sec.toUpperCase().replace('_', ' ')}</p>
                 <div className="flex justify-between items-center text-indigo-900 dark:text-indigo-300">
                    <span className="text-lg font-bold">{stats.count} Sip.</span>
                    <span className="text-lg font-bold">€{stats.revenue.toFixed(2)}</span>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canlı Sipariş Akışı */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm mt-8">
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

      {/* Konsolide Edilmiş Grafikler (Global Dashboard'dan Sadece Grafikleri Alır) */}
      <div className="mt-8 border-t border-border/50 pt-8">
        <StatisticsPage embedded={true} isKermesMode={true} kermesStartDate={new Date()} />
      </div>
    </div>
  );
}
