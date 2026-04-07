'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface KermesSiparislerTabProps {
  kermesId: string;
}

interface OrderItem {
  productId?: string;
  name?: string;
  productName?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  selectedOptions?: Record<string, string>;
}

interface KermesOrder {
  id: string;
  orderNumber: string;
  kermesId: string;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  pfandTotal?: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  isPaid: boolean;
  paymentMethod?: string;
  deliveryType: 'gelAl' | 'masada' | 'kurye';
  tableNumber?: string;
  tableSection?: string;
  items: OrderItem[];
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  assignedCourierId?: string;
  assignedCourierName?: string;
  createdAt: any;
  updatedAt?: any;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Bekliyor', color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' },
  preparing: { label: 'Hazirlaniyor', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  ready: { label: 'Hazir', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
  delivered: { label: 'Teslim Edildi', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' },
  cancelled: { label: 'Iptal', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' },
};

const DELIVERY_LABELS: Record<string, string> = {
  gelAl: 'Gel Al',
  masada: 'Masada',
  kurye: 'Kurye',
};

export default function KermesSiparislerTab({ kermesId }: KermesSiparislerTabProps) {
  const [orders, setOrders] = useState<KermesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all' | 'cancelled'>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!kermesId) return;

    const q = query(
      collection(db, 'kermes_orders'),
      where('kermesId', '==', kermesId),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as KermesOrder));

      // Client-side sort (newest first)
      list.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime;
      });

      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.error('Siparis stream hatasi:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [kermesId]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'kermes_orders', orderId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Status guncelleme hatasi:', err);
      alert('Hata olustu');
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'delivered',
    };
    return flow[current] || null;
  };

  const getNextStatusLabel = (current: string): string | null => {
    const labels: Record<string, string> = {
      pending: 'Hazirlaniyor',
      preparing: 'Hazir',
      ready: 'Teslim Edildi',
    };
    return labels[current] || null;
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (filter === 'active') return !['delivered', 'cancelled'].includes(o.status);
    if (filter === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  // Stats
  const activeCount = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const paidCount = orders.filter(o => o.isPaid).length;

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate?.() || new Date(ts.seconds * 1000);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-card rounded-xl p-4 border border-blue-500/20">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
          </span>
          <div>
            <h3 className="text-foreground font-bold">Siparisler</h3>
            <p className="text-xs text-muted-foreground">Canli siparis takibi ve durum yonetimi</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-background/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Aktif</p>
            <p className="text-xl font-bold text-orange-400">{activeCount}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Teslim Edilen</p>
            <p className="text-xl font-bold text-emerald-400">{deliveredCount}</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Toplam Ciro</p>
            <p className="text-xl font-bold text-foreground">{totalRevenue.toFixed(2)} EUR</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Odenen</p>
            <p className="text-xl font-bold text-green-400">{paidCount}/{orders.length}</p>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${filter === 'active' ? 'bg-blue-600 text-white border-blue-600' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}
        >
          Aktif ({activeCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}
        >
          Tumu ({orders.length})
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${filter === 'cancelled' ? 'bg-red-600 text-white border-red-600' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}
        >
          Iptal ({orders.filter(o => o.status === 'cancelled').length})
        </button>
      </div>

      {/* ORDER LIST */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Yukleniyor...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          Siparis bulunamadi.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const nextStatus = getNextStatus(order.status);
            const nextLabel = getNextStatusLabel(order.status);
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className={`bg-card rounded-xl border ${statusCfg.bgColor} overflow-hidden transition-all`}
              >
                {/* Order Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Order Number */}
                      <div className="text-center">
                        <span className="text-lg font-bold text-foreground">#{order.orderNumber}</span>
                      </div>

                      <div className="h-8 w-px bg-border" />

                      {/* Status Badge */}
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusCfg.color} bg-background/50`}>
                        {statusCfg.label}
                      </span>

                      {/* Delivery Type */}
                      <span className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground bg-muted/50">
                        {DELIVERY_LABELS[order.deliveryType] || order.deliveryType}
                        {order.tableNumber && ` #${order.tableNumber}`}
                      </span>

                      {/* Payment */}
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${order.isPaid ? 'text-green-400 bg-green-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                        {order.isPaid ? 'Odendi' : 'Odenmedi'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Total */}
                      <span className="text-lg font-bold text-foreground">
                        {order.totalAmount?.toFixed(2)} EUR
                      </span>

                      {/* Time */}
                      <span className="text-xs text-muted-foreground">
                        {formatTime(order.createdAt)}
                      </span>

                      {/* Expand Arrow */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* Customer Info */}
                  {(order.customerName || order.assignedWaiterName) && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {order.customerName && (
                        <span>Musteri: <span className="text-foreground">{order.customerName}</span></span>
                      )}
                      {order.assignedWaiterName && (
                        <span>Garson: <span className="text-foreground">{order.assignedWaiterName}</span></span>
                      )}
                      {order.assignedCourierName && (
                        <span>Kurye: <span className="text-foreground">{order.assignedCourierName}</span></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    {/* Items */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Urunler</p>
                      <div className="space-y-1">
                        {(order.items || []).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{item.quantity}x</span>
                              <span className="text-foreground">{item.name || item.productName}</span>
                              {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                                <span className="text-xs text-muted-foreground italic">
                                  ({Object.values(item.selectedOptions).join(', ')})
                                </span>
                              )}
                            </div>
                            <span className="text-foreground font-medium">
                              {((item.price || item.unitPrice || 0) * item.quantity).toFixed(2)} EUR
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pfand */}
                    {order.pfandTotal && order.pfandTotal > 0 && (
                      <div className="flex justify-between text-sm pt-1 border-t border-border">
                        <span className="text-muted-foreground">Pfand (Depozito)</span>
                        <span className="text-foreground">{order.pfandTotal.toFixed(2)} EUR</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between text-sm pt-2 border-t border-border font-bold">
                      <span className="text-foreground">Toplam</span>
                      <span className="text-foreground">{order.totalAmount?.toFixed(2)} EUR</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      {nextStatus && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, nextStatus); }}
                          disabled={updatingId === order.id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                        >
                          {updatingId === order.id ? '...' : `${nextLabel}`}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Siparisi iptal etmek istediginize emin misiniz?')) updateOrderStatus(order.id, 'cancelled'); }}
                          disabled={updatingId === order.id}
                          className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg text-sm font-medium border border-red-800 transition disabled:opacity-50"
                        >
                          Iptal Et
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
