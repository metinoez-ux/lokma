'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice } from '@/types';
import { useTranslations } from 'next-intl';

export default function InvoiceDetailView({ invoiceId, basePath }: { invoiceId: string, basePath: string }) {
  const t = useTranslations('AdminInvoices');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [commissionRecords, setCommissionRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Order Detail States
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const invDoc = await getDoc(doc(db, 'invoices', invoiceId));
        if (!invDoc.exists()) {
          setLoading(false);
          return;
        }
        
        const invData = invDoc.data() as any;
        const inv = {
          ...invData,
          id: invDoc.id,
          createdAt: invData.createdAt?.toDate ? invData.createdAt.toDate() : new Date(invData.createdAt),
          dueDate: invData.dueDate?.toDate ? invData.dueDate.toDate() : new Date(invData.dueDate),
          periodStart: invData.periodStart?.toDate ? invData.periodStart.toDate() : new Date(invData.periodStart),
          periodEnd: invData.periodEnd?.toDate ? invData.periodEnd.toDate() : new Date(invData.periodEnd),
        } as Invoice;
        
        setInvoice(inv);

        // Derive period string 'YYYY-MM' from periodStart
        const year = inv.periodStart.getFullYear();
        const month = String(inv.periodStart.getMonth() + 1).padStart(2, '0');
        const periodStr = `${year}-${month}`;

        // Fetch commission records for this business and period
        const q = query(
          collection(db, 'commission_records'),
          where('businessId', '==', inv.butcherId),
          where('period', '==', periodStr)
        );
        
        const commSnap = await getDocs(q);
        const records: any[] = [];
        commSnap.forEach(d => {
          const cData = d.data();
          records.push({
            id: d.id,
            ...cData,
            createdAt: cData.createdAt?.toDate ? cData.createdAt.toDate() : new Date(cData.createdAt),
          });
        });

        // Sort by createdAt desc
        records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setCommissionRecords(records);

      } catch (error) {
        console.error('Error loading invoice details:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [invoiceId]);

  // Load Order Details
  const loadOrderDetail = useCallback(async (orderId: string, commissionRecord: any) => {
    setOrderLoading(true);
    try {
      const orderDoc = await getDoc(doc(db, 'meat_orders', orderId));
      if (orderDoc.exists()) {
        const data = orderDoc.data();
        setSelectedOrder({
          ...data,
          id: orderDoc.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null,
          deliveredAt: data.deliveredAt?.toDate ? data.deliveredAt.toDate() : data.deliveredAt ? new Date(data.deliveredAt) : null,
          claimedAt: data.claimedAt?.toDate ? data.claimedAt.toDate() : data.claimedAt ? new Date(data.claimedAt) : null,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
          commission: commissionRecord,
        });
      } else {
        // Order not found, show commission data only
        setSelectedOrder({ id: orderId, notFound: true, commission: commissionRecord });
      }
    } catch (error) {
      console.error('Error loading order detail:', error);
      setSelectedOrder({ id: orderId, notFound: true, commission: commissionRecord });
    } finally {
      setOrderLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center text-red-500">Fatura bulunamadı.</div>;
  }

  const getCourierTypeLabel = (type: string) => {
    switch(type) {
      case 'click_collect': return '🛒 Gel-Al';
      case 'own_courier': return '🏪 Kendi Kurye';
      case 'lokma_courier': return '🚗 LOKMA Kurye';
      case 'dine_in': return '🍽️ Masada';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-6 rounded-xl border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fatura Detayı: {invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground">{invoice.butcherName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Tarih: {invoice.createdAt.toLocaleDateString('de-DE')}</p>
          <div className="mt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              invoice.status === 'paid' ? 'bg-green-600/30 text-green-300' :
              invoice.status === 'pending' ? 'bg-yellow-600/30 text-yellow-300' :
              'bg-gray-600/30 text-gray-300'
            }`}>
              {invoice.status}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase">Abonelik Detayı</h3>
          {(invoice.items || []).filter(li => li.type === 'subscription').map((li, i) => (
            <div key={i} className="flex justify-between items-center mb-2">
              <span className="text-foreground text-sm">{li.description}</span>
              <span className="text-white font-medium">€{li.total.toFixed(2)}</span>
            </div>
          ))}
          {(invoice.items || []).filter(li => li.type === 'subscription').length === 0 && (
            <p className="text-muted-foreground text-sm">Abonelik ücreti bulunmuyor.</p>
          )}
        </div>

        <div className="bg-card p-6 rounded-xl border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase">Komisyon Özeti</h3>
          {(invoice.items || []).filter(li => li.type === 'commission').map((li, i) => (
            <div key={i} className="flex justify-between items-center mb-2">
              <span className="text-foreground text-sm">{li.description}</span>
              <span className="text-amber-500 font-medium">€{li.total.toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Sipariş Sayısı</span>
            <span className="text-white font-bold">{commissionRecords.length}</span>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase">Genel Toplam</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Ara Toplam</span>
              <span>€{(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>KDV (%{invoice.taxRate})</span>
              <span>€{(invoice.taxAmount || (invoice as any).tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-border mt-2">
              <span>Toplam</span>
              <span className="text-indigo-400">€{invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">Sipariş Kayıtları ({commissionRecords.length})</h3>
          <p className="text-sm text-muted-foreground">Bu faturaya yansıyan tüm sipariş detayları (Detay için siparişe tıklayın)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Tarih</th>
                <th className="px-6 py-3 text-left font-medium">Sipariş</th>
                <th className="px-6 py-3 text-left font-medium">Teslimat Tipi</th>
                <th className="px-6 py-3 text-right font-medium">Sipariş Tutarı</th>
                <th className="px-6 py-3 text-right font-medium">Komisyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {commissionRecords.map((cr) => (
                <tr 
                  key={cr.id} 
                  className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => loadOrderDetail(cr.orderId, cr)}
                >
                  <td className="px-6 py-4 text-muted-foreground">
                    {cr.createdAt.toLocaleDateString('de-DE')} {cr.createdAt.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-white">
                    #{cr.orderNumber || cr.orderId.substring(0,6)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-800 px-2 py-1 rounded text-xs">{getCourierTypeLabel(cr.courierType)}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-white">
                    €{cr.orderTotal?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-amber-500 font-bold">€{cr.totalCommission?.toFixed(2) || '0.00'}</span>
                    <div className="text-[10px] text-muted-foreground">({cr.commissionRate}%)</div>
                  </td>
                </tr>
              ))}
              {commissionRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Bu döneme ait detaylı sipariş/komisyon kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {(selectedOrder || orderLoading) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
            {orderLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Sipariş detayları yükleniyor...</p>
              </div>
            ) : selectedOrder?.notFound ? (
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-foreground">Sipariş #{selectedOrder.commission?.orderNumber || selectedOrder.id?.slice(0, 6)}</h3>
                  <button onClick={() => setSelectedOrder(null)} className="text-muted-foreground hover:text-white text-xl">✕</button>
                </div>
                <p className="text-muted-foreground">Sipariş detayı bulunamadı (sadece provizyon kaydı var).</p>
                {selectedOrder.commission && (
                  <div className="mt-4 bg-background/50 rounded-lg p-4">
                    <p className="text-foreground text-sm">💰 Provizyon: <span className="text-amber-800 dark:text-amber-400 font-bold">€{selectedOrder.commission.totalCommission.toFixed(2)}</span></p>
                    <p className="text-foreground text-sm">Tutar: €{selectedOrder.commission.orderTotal.toFixed(2)}</p>
                  </div>
                )}
              </div>
            ) : selectedOrder && (
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Sipariş #{selectedOrder.orderNumber || selectedOrder.id?.slice(0, 6)}</h3>
                    <p className="text-muted-foreground text-sm mt-0.5">{selectedOrder.butcherName || selectedOrder.businessName || selectedOrder.commission?.businessName}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">✕</button>
                </div>

                {/* Status Badge */}
                <div className="mb-5">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedOrder.status === 'delivered' ? 'bg-green-600/30 text-green-300' :
                    selectedOrder.status === 'cancelled' ? 'bg-red-600/30 text-red-300' :
                    selectedOrder.status === 'ready' ? 'bg-blue-600/30 text-blue-300' :
                    selectedOrder.status === 'preparing' ? 'bg-yellow-600/30 text-yellow-300' :
                    'bg-gray-600/30 text-foreground'
                  }`}>
                    {selectedOrder.status === 'delivered' ? '✅ Teslim Edildi' :
                     selectedOrder.status === 'cancelled' ? '❌ İptal' :
                     selectedOrder.status === 'ready' ? 'Hazır' :
                     selectedOrder.status === 'preparing' ? 'Hazırlanıyor' :
                     selectedOrder.status === 'pending' ? '⏳ Bekliyor' :
                     selectedOrder.status}
                  </span>
                  <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                    selectedOrder.deliveryMethod === 'delivery' ? 'bg-purple-600/30 text-purple-300' : 'bg-cyan-600/30 text-cyan-300'
                  }`}>
                    {selectedOrder.deliveryMethod === 'delivery' ? 'Kurye ile Teslimat' : '🛒 Gel-Al / Masada'}
                  </span>
                </div>

                {/* Order Items */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="bg-background/50 rounded-xl p-4 mb-4">
                    <h4 className="text-muted-foreground text-xs font-medium mb-3 uppercase tracking-wider">Sipariş İçeriği</h4>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                          <div className="flex-1">
                            <p className="text-foreground text-sm font-medium">{item.productName || item.name}</p>
                            <p className="text-muted-foreground text-xs">{item.quantity}x · €{(item.unitPrice || item.price || 0).toFixed(2)}/{item.unit || 'adet'}</p>
                          </div>
                          <p className="text-amber-800 dark:text-amber-400 font-bold text-sm">€{(item.totalPrice || (item.quantity * (item.unitPrice || item.price || 0))).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex justify-between">
                      <span className="text-foreground font-bold">Toplam</span>
                      <span className="text-amber-800 dark:text-amber-400 font-bold text-lg">€{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Courier Info */}
                {(selectedOrder.courierName || selectedOrder.courierId) && (
                  <div className="bg-background/50 rounded-xl p-4 mb-4">
                    <h4 className="text-muted-foreground text-xs font-medium mb-3 uppercase tracking-wider">Kurye Bilgileri</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-muted-foreground/80 text-xs">Kurye Adı</p>
                        <p className="text-foreground text-sm font-medium">{selectedOrder.courierName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/80 text-xs">Kurye Tipi</p>
                        <p className="text-foreground text-sm">{getCourierTypeLabel(selectedOrder.commission?.courierType)}</p>
                      </div>
                      {selectedOrder.deliveryProof && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground/80 text-xs">Teslimat Kanıtı</p>
                          <p className="text-foreground text-sm">
                            {selectedOrder.deliveryProof.type === 'personal_handoff' ? '🤝 Elden Teslim' :
                             selectedOrder.deliveryProof.type === 'left_at_door' ? 'Kapıda Bırakıldı' :
                             selectedOrder.deliveryProof.type || '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Commission & Payment */}
                {selectedOrder.commission && (
                  <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4 mb-4">
                    <h4 className="text-amber-800 dark:text-amber-400 text-xs font-medium mb-3 uppercase tracking-wider">Provizyon Detayı</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-foreground text-sm">Sipariş Tutarı</span>
                        <span className="text-foreground text-sm">€{selectedOrder.commission.orderTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground text-sm">Komisyon Oranı</span>
                        <span className="text-foreground text-sm">%{selectedOrder.commission.commissionRate}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-amber-200 dark:border-amber-700/30">
                        <span className="text-foreground text-sm font-bold">Toplam Provizyon Kesintisi</span>
                        <span className="text-amber-800 dark:text-amber-400 font-bold">€{selectedOrder.commission.totalCommission.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors mt-4"
                >
                  Kapat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
