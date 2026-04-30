"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Clock as FiClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StatisticsPage from '../../dashboard/page';

interface KermesDashboardProps {
  kermesId: string;
  assignedStaffCount: number;
  assignedWaitersCount: number;
  locale?: string;
  kermesStart?: string;
  kermesEnd?: string;
}

import { useOrdersStandalone } from '@/hooks/useOrders';

export default function KermesDashboardTab({ kermesId, assignedStaffCount, assignedWaitersCount, locale = 'tr', kermesStart, kermesEnd }: KermesDashboardProps) {
  const { orders, loading } = useOrdersStandalone({ businessId: kermesId, isKermesMode: true });
  const [showStantStats, setShowStantStats] = useState(false);
  const [showSectionStats, setShowSectionStats] = useState(false);
  const t = useTranslations('AdminStatistics');
  const tDetail = useTranslations('AdminKermesDetail');

  const {
    activeOrders,
    todayRevenue,
    totalRevenue,
    totalOrders,
    completedCount,
    cancelledCount,
    ocakbasiCount,
    peakHour,
    sectionStats,
    stantStats
  } = React.useMemo(() => {
    let revenue = 0;
    let totalRev = 0;
    let completed = 0;
    let cancelled = 0;
    let ocakbasi = 0;
    let filteredTotal = 0;
    const hourCounts: Record<number, number> = {};
    const active: any[] = [];
    const sections: Record<string, { count: number, revenue: number }> = {
      'Aile Bölümü': { count: 0, revenue: 0 },
      'Hanımlar Bölümü': { count: 0, revenue: 0 },
      'Erkekler Bölümü': { count: 0, revenue: 0 },
      'Kurye': { count: 0, revenue: 0 }
    };
    const stantStats: Record<string, { count: number, revenue: number }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let kStart: Date = new Date();
    kStart.setHours(0, 0, 0, 0);
    let kEnd: Date = new Date();
    kEnd.setHours(23, 59, 59, 999);
    
    if (kermesStart) {
      kStart = new Date(kermesStart);
      kStart.setHours(0, 0, 0, 0);
    }
    if (kermesEnd) {
      kEnd = new Date(kermesEnd);
      kEnd.setHours(23, 59, 59, 999);
    } else if (kermesStart) {
      kEnd = new Date(kStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      kEnd.setHours(23, 59, 59, 999);
    }

    orders.forEach(order => {
      const data = order._raw;
      const orderDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt);
      
      if (orderDate < kStart) return;
      if (orderDate > kEnd) return;
      filteredTotal++;

      if (data.status === 'cancelled' || data.status === 'rejected') {
        cancelled++;
      } else {
        totalRev += (data.totalAmount || data.totalPrice || data.total || 0);
        if (orderDate >= today) {
          revenue += (data.totalAmount || data.totalPrice || data.total || 0);
        }
        if (['delivered', 'served', 'completed'].includes(data.status)) {
          completed++;
        }

        // Section mapping (All Orders)
        const dType = data.deliveryType || data.type || data.orderType;
        const isDineIn = ['dine_in', 'dineIn', 'masa'].includes(dType);
        
        // Either use the explicit tableSection, or fallback
        let sectionName = data.tableSection || '';
        
        const sLower = sectionName.toLowerCase();
        
        // Normalize section names to prevent duplication
        if (dType === 'delivery' || dType === 'kurye') {
          sectionName = 'Kurye';
        } else if (sLower.includes('kadin') || sLower.includes('kadın') || sLower.includes('hanim') || sLower.includes('hanım')) {
          sectionName = 'Hanımlar Bölümü';
        } else if (sLower.includes('erkek')) {
          sectionName = 'Erkekler Bölümü';
        } else {
          sectionName = 'Aile Bölümü';
        }
        
        if (!sections[sectionName]) sections[sectionName] = { count: 0, revenue: 0 };
        sections[sectionName].count++;
        sections[sectionName].revenue += (data.totalAmount || data.totalPrice || data.total || 0);

        // Stant (PrepZone / Delivery Point) calculation
        (data.items || []).forEach((item: any) => {
           const qty = parseInt(item.quantity || item.count || '1', 10) || 1;
           let totalVal = 0;
           if (item.totalPrice !== undefined && item.totalPrice !== null) {
             totalVal = parseFloat(item.totalPrice) || 0;
           } else if (item.price !== undefined && item.price !== null) {
             totalVal = parseFloat(item.price) || 0;
           } else if (item.unitPrice !== undefined && item.unitPrice !== null) {
             totalVal = qty * (parseFloat(item.unitPrice) || 0);
           }
           
           let zones: string[] = [];
           if (Array.isArray(item.prepZone)) {
             zones = item.prepZone.filter((z: any) => typeof z === 'string' && z.trim() !== '');
           } else if (typeof item.prepZone === 'string' && item.prepZone.trim() !== '') {
             zones = [item.prepZone.trim()];
           }
           
           if (zones.length === 0) {
             zones = ['Genel / Belirtilmemiş'];
           }
           
           let primaryZone = zones[0];
           const zLower = primaryZone ? primaryZone.toLowerCase() : '';
           
           if (!primaryZone || 
               zLower === 'genel / belirtilmemiş' || 
               zLower.includes('erkek') || 
               zLower.includes('kadin') || 
               zLower.includes('kadın') || 
               zLower.includes('hanim') || 
               zLower.includes('hanım') || 
               zLower.includes('aile') ||
               zLower.includes('masa') ||
               zLower.includes('stant') ||
               zLower.includes('stand')) {
             return; // Skip items that don't have a valid Tezgah/Ocakbaşı assigned
           }

           // Format nicely (e.g., "Grill K", "Kumpir")
           const formattedZone = primaryZone.toUpperCase();

           if (!stantStats[formattedZone]) stantStats[formattedZone] = { count: 0, revenue: 0 };
           stantStats[formattedZone].count += qty;
           stantStats[formattedZone].revenue += totalVal;
});

        // Ocakbasi check: any item with a real stant/prepZone (not generic section)
        const hasOcakbasi = (data.items || []).some((item: any) => {
          let zones: string[] = [];
          if (Array.isArray(item.prepZone)) {
            zones = item.prepZone.filter((z: any) => typeof z === 'string' && z.trim() !== '');
          } else if (typeof item.prepZone === 'string' && item.prepZone.trim() !== '') {
            zones = [item.prepZone.trim()];
          }
          return zones.some(z => {
            const zl = z.toLowerCase();
            return zl !== '' &&
              zl !== 'genel / belirtilmemiş' &&
              !zl.includes('erkek') &&
              !zl.includes('kadin') && !zl.includes('kadın') &&
              !zl.includes('hanim') && !zl.includes('hanım') &&
              !zl.includes('aile') &&
              !zl.includes('masa') &&
              !zl.includes('stant') && !zl.includes('stand');
          });
        });
        if (hasOcakbasi) ocakbasi++;

        // Peak hour calculation
        const h = orderDate.getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }

      if (['pending', 'accepted', 'preparing', 'ready'].includes(data.status)) {
        active.push({ id: order.id, ...data });
      }
    });

    let maxH = 0;
    let pHour = 12;
    Object.entries(hourCounts).forEach(([h, count]) => {
        if (count > maxH) { maxH = count; pHour = parseInt(h); }
    });

    return {
      activeOrders: active,
      todayRevenue: revenue,
      totalRevenue: totalRev,
      totalOrders: filteredTotal,
      completedCount: completed,
      cancelledCount: cancelled,
      ocakbasiCount: ocakbasi,
      peakHour: pHour,
      sectionStats: sections,
      stantStats: stantStats
    };
  }, [orders, kermesStart, kermesEnd]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Dashboard yükleniyor...</div>;
  }

  const validOrdersCount = totalOrders - cancelledCount;
  const avgOrderValue = validOrdersCount > 0 ? (totalRevenue / validOrdersCount) : 0;

  return (
    <div className="space-y-6">
      {/* Genel İstatistik Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4">İşletme Performansı (Kermes)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
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
          <div className="bg-card rounded-xl p-4 text-center flex flex-col justify-center">
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="text-3xl font-bold text-teal-800 dark:text-teal-400">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Tamamlanan</p>
              </div>
              <div className="w-px h-8 bg-border/50"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-800 dark:text-red-400">{cancelledCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">İptal Edilen</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-400">{activeOrders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Aktif Siparişler</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-400">{assignedStaffCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Kermes Personeli</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center flex flex-col justify-center">
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-800 dark:text-orange-400">{ocakbasiCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Siparis</p>
              </div>
              <div className="w-px h-8 bg-border/50"></div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-800 dark:text-amber-400">&euro;{Object.values(stantStats).reduce((sum: number, s: any) => sum + s.revenue, 0).toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Ciro</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Ocakbasi</p>
          </div>
        </div>
      </div>

      {/* Ocakbaşı (Hazırlık Noktası) İstatistikleri */}
      {Object.keys(stantStats).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4 cursor-pointer flex items-center justify-between hover:opacity-80" onClick={() => setShowStantStats(!showStantStats)}>
            <span>Ocakbaşı Performansı</span>
            <span className="text-sm bg-muted/50 px-3 py-1 rounded-full">{showStantStats ? 'Gizle' : 'Göster'}</span>
          </h2>
          {showStantStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stantStats).sort((a: any, b: any) => b[1].revenue - a[1].revenue).map(([zone, stats]: [string, any]) => (
              <div key={zone} className="bg-gradient-to-br from-amber-100 dark:from-amber-900/30 to-amber-50 dark:to-amber-800/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4 text-center">
                 <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 truncate" title={zone.toUpperCase()}>{zone.toUpperCase()}</p>
                 <div className="flex justify-between items-center text-amber-900 dark:text-amber-300">
                    <span className="text-lg font-bold">{stats.count} Ürün</span>
                    <span className="text-lg font-bold">€{stats.revenue.toFixed(2)}</span>
                 </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Bölüm Bazlı İstatistikler */}
      {Object.keys(sectionStats).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4 cursor-pointer flex items-center justify-between hover:opacity-80" onClick={() => setShowSectionStats(!showSectionStats)}>
            <span>Bölüm Performansları (Aile, Hanımlar vs.)</span>
            <span className="text-sm bg-muted/50 px-3 py-1 rounded-full">{showSectionStats ? 'Gizle' : 'Göster'}</span>
          </h2>
          {showSectionStats && (
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
          )}
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
                    <span className="font-semibold">{order.orderNumber || order.id.slice(-5).toUpperCase()} - {order.deliveryType === 'dine_in' ? `Masa ${order.tableNo}` : 'Stant'}</span>
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
                      {order.status === 'pending' ? 'BEKLİYOR' : order.status === 'accepted' ? 'ONAYLANDI' : order.status === 'preparing' ? 'HAZIRLANIYOR' : order.status === 'ready' ? 'HAZIR' : order.status.toUpperCase()}
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
        <StatisticsPage 
          embedded={true} 
          isKermesMode={true} 
          kermesId={kermesId}
          kermesStartDate={kermesStart ? new Date(kermesStart) : undefined} 
          kermesEndDate={kermesEnd ? new Date(kermesEnd) : undefined}
        />
      </div>
    </div>
  );
}
