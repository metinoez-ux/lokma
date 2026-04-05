import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useTranslations } from 'next-intl';

interface KermesScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  kermesId: string;
}

export default function KermesScannerModal({ isOpen, onClose, kermesId }: KermesScannerModalProps) {
  const t = useTranslations('admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setFoundOrder(null);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    setFoundOrder(null);
    
    try {
      const term = searchTerm.trim();
      let docData = null;
      let orderId = term;

      // 1. Try treating search term as Document ID (QR Code scan)
      const docRef = doc(db, 'kermes_orders', term);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().kermesId === kermesId) {
        docData = { id: docSnap.id, ...docSnap.data() };
      } 
      // 2. Try treating search term as Order Number (e.g. "11005")
      else {
        const q = query(
          collection(db, 'kermes_orders'),
          where('kermesId', '==', kermesId),
          where('orderNumber', '==', term)
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          docData = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
        }
      }

      if (docData) {
        setFoundOrder(docData);
      } else {
        setError('Sipariş bulunamadı. Lütfen kontrol edip tekrar deneyin.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Arama sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
      setSearchTerm('');
      // Keep focus to allow sequential rapid scans
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handlePay = async () => {
    if (!foundOrder) return;
    setLoading(true);
    try {
      // Update the order: mark as paid and optionally advance status to preparing
      // since it's already accepted if it's paid.
      await updateDoc(doc(db, 'kermes_orders', foundOrder.id), {
        isPaid: true,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        status: foundOrder.status === 'pending' ? 'preparing' : foundOrder.status,
        updatedAt: new Date()
      });
      
      setFoundOrder(null);
      setError('Ödeme başarıyla alındı! (Sipariş #' + foundOrder.orderNumber + ')');
    } catch (err: any) {
      console.error(err);
      setError('Ödeme alınırken hata oluştu.');
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (error?.includes('başarıyla')) setError(null);
        inputRef.current?.focus();
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="7" height="7" x="7" y="7" rx="1"/><rect width="2" height="2" x="14" y="14"/><rect width="2" height="2" x="14" y="10"/><rect width="2" height="2" x="10" y="14"/></svg>
            QR & Tahsilat
          </h2>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1"
            title="Kapat"
            aria-label="Kapat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSearch} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              QR Kod Okutun veya Sipariş No Girin
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Örn: 11005"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading || !searchTerm}
                className="bg-gray-800 dark:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Ara
              </button>
            </div>
          </form>

          {/* Messages */}
          {error && (
            <div className={`p-4 rounded-lg mb-6 ${error.includes('başarıyla') ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
              <p className="font-medium text-center">{error}</p>
            </div>
          )}

          {/* Found Order Card */}
          {foundOrder && (
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-inner">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-wider">
                    #{foundOrder.orderNumber}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {foundOrder.userName || foundOrder.customerName || 'Misafir'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Toplam</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    €{Number(foundOrder.totalAmount || foundOrder.totalPrice || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Status block */}
              <div className="mb-6">
                {(foundOrder.isPaid || foundOrder.paymentStatus === 'paid') ? (
                  <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 p-3 rounded-lg font-medium flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    Bu sipariş zaten ÖDENDİ
                  </div>
                ) : (
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg font-medium flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    Ödeme Bekliyor - Nakit Alınacak
                  </div>
                )}
              </div>

              <button
                onClick={handlePay}
                disabled={loading || foundOrder.isPaid || foundOrder.paymentStatus === 'paid'}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                {loading ? 'İşleniyor...' : (foundOrder.isPaid ? 'Zaten Ödendi' : 'Nakit Alındı - Onayla')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
