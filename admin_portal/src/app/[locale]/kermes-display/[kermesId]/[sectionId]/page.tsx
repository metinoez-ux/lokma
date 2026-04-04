'use client';

import { useEffect, useState, useRef } from 'react';
import { getDb } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { use } from 'react';
import styles from './display.module.css';

// ============================================================
// Kermes Siparis Durumu Display Ekrani
// TV / Tablet icin tam ekran kiosk gorunumu
// Her bolum (erkekler/kadinlar/kahve) ayri URL ile calisir
// Auth gerektirmez - sadece okuma
// ============================================================

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  prepZone?: string;
  itemStatus?: string;
  claimedByStaffId?: string;
  claimedByStaffName?: string;
  claimedAt?: Date;
}

interface KermesDisplayOrder {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType: string;
  customerName: string;
  tableNumber?: string;
  tableSection?: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
  completedAt?: Date;
}

export default function KermesDisplayPage({
  params,
}: {
  params: Promise<{ kermesId: string; sectionId: string; locale: string }>;
}) {
  const { kermesId, sectionId } = use(params);
  const [orders, setOrders] = useState<KermesDisplayOrder[]>([]);
  const [kermesName, setKermesName] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [newlyReady, setNewlyReady] = useState<Set<string>>(new Set());
  const previousReadyRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Bolum mu, Istasyon mu?
  const isKnownSection = sectionId.includes('bolumu') || sectionId.includes('section') || sectionId.includes('bolum');
  const isStationDisplay = !isKnownSection;

  // Saat guncelleme
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Kermes ve bolum bilgisi
  useEffect(() => {
    async function fetchMeta() {
      try {
        const db = getDb();
        const kermesDoc = await getDoc(doc(db, 'kermes_events', kermesId));
        if (kermesDoc.exists()) {
          const data = kermesDoc.data();
          setKermesName(data.name || data.title || 'Kermes');

          const sectionsV2 = data.tableSectionsV2 as Record<string, { label?: string }> | undefined;
          if (sectionsV2 && sectionsV2[sectionId]) {
            setSectionLabel(sectionsV2[sectionId].label || sectionId);
          } else {
            const formatted = sectionId
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            setSectionLabel(formatted);
          }
        }
      } catch (e) {
        console.error('Kermes meta fetch error:', e);
      }
    }
    fetchMeta();
  }, [kermesId, sectionId]);

  // Sesli uyari
  useEffect(() => {
    audioRef.current = new Audio('/sounds/order-ready-chime.mp3');
    audioRef.current.volume = 0.6;
  }, []);

  // Firestore realtime listener
  useEffect(() => {
    const db = getDb();
    const ordersRef = collection(db, 'kermes_orders');

    const q = query(
      ordersRef,
      where('kermesId', '==', kermesId),
      where('status', 'in', ['pending', 'preparing', 'ready']),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders: KermesDisplayOrder[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const orderSection = data.tableSection as string | undefined;
        const sectionNormalized = sectionId.replace(/_/g, ' ').toLowerCase();

        // Bolum ekrani: tableSection eslesirse (Erkek/Kadin pickup ekrani)
        const matchesSection = orderSection === sectionId;

        // Istasyon ekrani: herhangi bir item'in prepZone'u eslesirse (Manti/Kumpir mutfak ekrani)
        const items = (data.items as { prepZone?: string; name?: string; quantity?: number; price?: number; itemStatus?: string }[]) || [];
        const matchesPrepZone = items.some(
          (item) =>
            item.prepZone &&
            item.prepZone.toLowerCase().includes(sectionNormalized)
        );

        if (!matchesSection && !matchesPrepZone) return;

        allOrders.push({
          id: docSnap.id,
          orderNumber: data.orderNumber || docSnap.id,
          status: data.status,
          deliveryType: data.deliveryType || 'gelAl',
          customerName: data.customerName || '',
          tableNumber: data.tableNumber,
          tableSection: data.tableSection,
          // Istasyon ekraninda sadece o istasyona ait itemleri goster
          items: (matchesPrepZone && !matchesSection
            ? items.filter(item => item.prepZone && item.prepZone.toLowerCase().includes(sectionNormalized))
            : items
          ).map((item) => ({
            name: item.name || '',
            quantity: item.quantity || 1,
            price: item.price || 0,
            prepZone: item.prepZone,
            itemStatus: item.itemStatus,
            claimedByStaffId: (item as any).claimedByStaffId,
            claimedByStaffName: (item as any).claimedByStaffName,
          })),
          totalAmount: data.totalAmount || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          completedAt: data.completedAt?.toDate?.(),
        });
      });

      // Yeni hazir olanlar (ses icin)
      const currentReadyIds = new Set(
        allOrders.filter((o) => o.status === 'ready').map((o) => o.id)
      );
      const prevReady = previousReadyRef.current;
      const brandNew = new Set<string>();
      currentReadyIds.forEach((id) => {
        if (!prevReady.has(id)) brandNew.add(id);
      });

      if (brandNew.size > 0) {
        setNewlyReady(brandNew);
        audioRef.current?.play().catch(() => {/* autoplay policy */});
        setTimeout(() => setNewlyReady(new Set()), 3000);
      }

      previousReadyRef.current = currentReadyIds;
      setOrders(allOrders);
    });

    return () => unsubscribe();
  }, [kermesId, sectionId]);

  // Hazir siparisler (sol taraf)
  const readyOrders = orders
    .filter((o) => o.status === 'ready')
    .sort((a, b) => (parseInt(a.orderNumber) || 0) - (parseInt(b.orderNumber) || 0));

  // Hazirlanan siparisler (sag taraf)
  const preparingOrders = orders
    .filter((o) => o.status === 'preparing' || o.status === 'pending')
    .sort((a, b) => (parseInt(a.orderNumber) || 0) - (parseInt(b.orderNumber) || 0));

  // No. formatla
  const formatOrderNo = (orderNumber: string) => {
    const num = parseInt(orderNumber);
    if (isNaN(num)) return orderNumber;
    if (num > 11000) return (num - 11000).toString();
    return num.toString();
  };

  // Teslimat turu iconu
  const getDeliveryIcon = (type: string) => {
    switch (type) {
      case 'masada': return 'table_restaurant';
      case 'kurye': return 'delivery_dining';
      default: return 'shopping_bag';
    }
  };

  const getDeliveryLabel = (order: KermesDisplayOrder) => {
    switch (order.deliveryType) {
      case 'masada': return `Masa ${order.tableNumber || ''}`;
      case 'kurye': return 'Kurye';
      default: return 'Gel Al';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.lokmaLogo}>LOKMA</span>
          <span className={styles.kermesName}>{kermesName}</span>
        </div>
        <div className={styles.headerCenter}>
          <span className={styles.sectionName}>{sectionLabel}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.clock}>
            {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* HAZIR - Sol Taraf */}
        <section className={styles.readySection}>
          <div className={styles.sectionHeader}>
            <span className={`material-symbols-outlined ${styles.sectionIconReady}`}>
              check_circle
            </span>
            <h2 className={styles.sectionTitleReady}>HAZIR</h2>
            <span className={styles.countBadgeReady}>{readyOrders.length}</span>
          </div>

          <div className={styles.readyGrid}>
            {readyOrders.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={`material-symbols-outlined ${styles.emptyIcon}`}>
                  hourglass_empty
                </span>
                <p className={styles.emptyText}>Hazir siparis yok</p>
              </div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className={newlyReady.has(order.id) ? styles.readyCardNew : styles.readyCard}
                >
                  <div className={styles.readyNumber}>
                    No.{formatOrderNo(order.orderNumber)}
                  </div>
                  <div className={styles.readyDelivery}>
                    <span className={`material-symbols-outlined ${styles.readyDeliveryIcon}`}>
                      {getDeliveryIcon(order.deliveryType)}
                    </span>
                    <span className={styles.readyDeliveryText}>
                      {getDeliveryLabel(order)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Ayirici */}
        <div className={styles.divider} />

        {/* HAZIRLANIYOR - Sag Taraf */}
        <section className={styles.preparingSection}>
          <div className={styles.sectionHeader}>
            <span className={`material-symbols-outlined ${styles.sectionIconPreparing}`}>
              skillet
            </span>
            <h2 className={styles.sectionTitlePreparing}>HAZIRLANIYOR</h2>
            <span className={styles.countBadgePreparing}>{preparingOrders.length}</span>
          </div>

          <div className={styles.preparingList}>
            {preparingOrders.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={`material-symbols-outlined ${styles.emptyIcon}`}>
                  restaurant
                </span>
                <p className={styles.emptyText}>Hazirlanan siparis yok</p>
              </div>
            ) : (
              preparingOrders.map((order) => (
                <div key={order.id} className={styles.preparingCard}>
                  <div className={styles.preparingHeader}>
                    <span className={styles.preparingNumber}>
                      No.{formatOrderNo(order.orderNumber)}
                    </span>
                    <span className={styles.preparingDelivery}>
                      <span className={`material-symbols-outlined ${styles.preparingDeliveryIcon}`}>
                        {getDeliveryIcon(order.deliveryType)}
                      </span>
                      {getDeliveryLabel(order)}
                    </span>
                  </div>
                  <div className={styles.preparingItems}>
                    {order.items.map((item, idx) => (
                      <span key={idx} className={styles.preparingItemWrap}>
                        {item.name} x{item.quantity}
                        {item.claimedByStaffName && (
                          <span className={styles.claimChip}>
                            {item.claimedByStaffName}
                          </span>
                        )}
                        {idx < order.items.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={`material-symbols-outlined ${styles.footerIcon}`}>{isStationDisplay ? 'skillet' : 'info'}</span>
        <span className={styles.footerText}>
          {isStationDisplay
            ? 'Gelen siparisleri hazirlayin - garson gelip alacak'
            : 'Numaraniz ekranda gorundugunde tezgahtan alabilirsiniz'
          }
        </span>
      </footer>
    </div>
  );
}
