'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
import { useSearchParams } from 'next/navigation';
import styles from './tv-display.module.css';

// ============================================================
// Kermes TV Display - McDonald's Style Order Status Board
// Hisense TV (VIVA OS) browser icin optimize edilmis
// Auth gerektirmez - sadece Firestore okuma
//
// URL Yapisi:
//   /tr/kermes-tv/{kermesId}                    -> Tum siparisler
//   /tr/kermes-tv/{kermesId}?section=kadin_bolumu -> Belirli bolum
//
// Production: https://lokma.shop/tr/kermes-tv/{kermesId}?section=...
// ============================================================

interface DisplayOrder {
  id: string;
  orderNumber: string;
  status: string; // pending | preparing | ready
  customerName: string;
  createdAt: Date;
}

// GDPR uyumlu isim: "Metin Oz" -> "M. O."
function formatGdprName(fullName: string): string {
  if (!fullName || fullName.trim().length === 0) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + '.';
  }
  // Ad ve soyad basharfleri
  return parts
    .map((p) => p.charAt(0).toUpperCase() + '.')
    .join(' ');
}

export default function KermesTvPage({
  params,
}: {
  params: Promise<{ kermesId: string; locale: string }>;
}) {
  const { kermesId } = use(params);
  const searchParams = useSearchParams();
  const sectionFilter = searchParams.get('section') || null;

  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [kermesName, setKermesName] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [newlyReady, setNewlyReady] = useState<Set<string>>(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const previousReadyRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Saat guncelleme (her saniye)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Kermes ve bolum bilgisi cek
  useEffect(() => {
    async function fetchKermesMeta() {
      try {
        const db = getDb();
        const kermesDoc = await getDoc(doc(db, 'kermes_events', kermesId));
        if (kermesDoc.exists()) {
          const data = kermesDoc.data();
          setKermesName(data.name || data.title || 'Kermes');

          // Bolum label'ini tableSectionsV2'den cek
          if (sectionFilter) {
            const sectionsV2 = data.tableSectionsV2 as Record<string, { label?: string }> | undefined;
            if (sectionsV2 && sectionsV2[sectionFilter]) {
              setSectionLabel(sectionsV2[sectionFilter].label || sectionFilter);
            } else {
              const formatted = sectionFilter
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());
              setSectionLabel(formatted);
            }
          }
        }
      } catch (e) {
        console.error('Kermes meta fetch error:', e);
        setKermesName('Kermes');
      }
    }
    fetchKermesMeta();
  }, [kermesId, sectionFilter]);

  // Ses hazirla
  useEffect(() => {
    audioRef.current = new Audio('/sounds/gong.wav');
    audioRef.current.volume = 0.7;
  }, []);

  // Ses cal
  const playGong = useCallback(() => {
    if (!audioEnabled || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [audioEnabled]);

  // Autoplay'i etkinlestir (TV'de ilk dokunusta)
  const enableAudio = useCallback(() => {
    setAudioEnabled(true);
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
    }
  }, []);

  // Firestore real-time listener
  useEffect(() => {
    const db = getDb();
    const ordersRef = collection(db, 'kermes_orders');

    const q = query(
      ordersRef,
      where('kermesId', '==', kermesId),
      where('status', 'in', ['pending', 'preparing', 'ready']),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders: DisplayOrder[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();

        if (sectionFilter) {
          const sectionNormalized = sectionFilter.replace(/_/g, ' ').toLocaleLowerCase('tr-TR');
          const orderSection = (data.tableSection as string | undefined)?.toLocaleLowerCase('tr-TR');
          const matchesSection = orderSection === sectionNormalized || orderSection === sectionFilter.toLocaleLowerCase('tr-TR');
          
          const items = (data.items as Array<any>) || [];
          const matchesPrepZone = items.some(
            (item) => {
              if (!item.prepZone) return false;
              if (Array.isArray(item.prepZone)) {
                return item.prepZone.some((pz: string) => pz.toLocaleLowerCase('tr-TR').includes(sectionNormalized));
              } else if (typeof item.prepZone === 'string') {
                return item.prepZone.toLocaleLowerCase('tr-TR').includes(sectionNormalized);
              }
              return false;
            }
          );

          if (!matchesSection && !matchesPrepZone) {
            return;
          }
        }

        allOrders.push({
          id: docSnap.id,
          orderNumber: data.orderNumber || docSnap.id,
          status: data.status,
          customerName: data.customerName || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });

      // Yeni hazir olan siparisler (ses + animasyon icin)
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
        playGong();
        setTimeout(() => setNewlyReady(new Set()), 4000);
      }

      previousReadyRef.current = currentReadyIds;
      setOrders(allOrders);
    });

    return () => unsubscribe();
  }, [kermesId, sectionFilter, playGong]);

  // Numara formatlama: 11005 -> 5, 11042 -> 42
  const formatOrderNo = (orderNumber: string) => {
    const num = parseInt(orderNumber);
    if (isNaN(num)) return orderNumber;
    if (num > 11000) return (num - 11000).toString();
    return num.toString();
  };

  // Siparisleri ayir ve sirala
  const preparingOrders = orders
    .filter((o) => o.status === 'preparing' || o.status === 'pending')
    .sort((a, b) => (parseInt(a.orderNumber) || 0) - (parseInt(b.orderNumber) || 0));

  const readyOrders = orders
    .filter((o) => o.status === 'ready')
    .sort((a, b) => (parseInt(a.orderNumber) || 0) - (parseInt(b.orderNumber) || 0));

  const totalActive = preparingOrders.length + readyOrders.length;

  // Header'da gosterilecek bolum bilgisi
  const displayTitle = sectionLabel || 'Tum Bolumler';

  return (
    <>
      {/* Google Material Symbols */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
      />

      <div className={styles.container}>
        {/* Autoplay overlay - TV'de ilk acildiginda ses icin */}
        {!audioEnabled && (
          <div className={styles.autoplayOverlay} onClick={enableAudio}>
            <button className={styles.autoplayButton} onClick={enableAudio}>
              Siparis Ekranini Baslat
            </button>
            <span className={styles.autoplayHint}>
              Sesli uyari icin tiklayiniz
            </span>
          </div>
        )}

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.lokmaLogo}>LOKMA</span>
            <span className={styles.kermesName}>{kermesName}</span>
          </div>
          <div className={styles.headerCenter}>
            {sectionFilter && (
              <span className={styles.sectionBadge}>{displayTitle}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            <span className={styles.orderCount}>
              {totalActive} aktif siparis
            </span>
            <span className={styles.clock}>
              {currentTime.toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </header>

        {/* Ana icerik: 2 panel */}
        <main className={styles.main}>
          {/* SOL: HAZIRLANIYOR */}
          <section className={styles.preparingPanel}>
            <div className={styles.panelHeaderPreparing}>
              <span className={`material-symbols-outlined ${styles.panelIconPreparing}`}>
                skillet
              </span>
              <h2 className={styles.panelTitlePreparing}>Hazirlaniyor</h2>
              <span className={styles.panelCountPreparing}>
                {preparingOrders.length}
              </span>
            </div>

            <div className={styles.numberGrid}>
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
                    <span className={styles.preparingNumber}>
                      {formatOrderNo(order.orderNumber)}
                    </span>
                    {order.customerName && (
                      <span className={styles.customerInitials}>
                        {formatGdprName(order.customerName)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SAG: HAZIR */}
          <section className={styles.readyPanel}>
            <div className={styles.panelHeaderReady}>
              <span className={`material-symbols-outlined ${styles.panelIconReady}`}>
                check_circle
              </span>
              <h2 className={styles.panelTitleReady}>Hazir</h2>
              <span className={styles.panelCountReady}>
                {readyOrders.length}
              </span>
            </div>

            <div className={styles.numberGrid}>
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
                    className={
                      newlyReady.has(order.id)
                        ? styles.readyCardNew
                        : styles.readyCard
                    }
                  >
                    <span className={styles.readyNumber}>
                      {formatOrderNo(order.orderNumber)}
                    </span>
                    {order.customerName && (
                      <span className={styles.readyCustomerInitials}>
                        {formatGdprName(order.customerName)}
                      </span>
                    )}
                    <span className={styles.readyLabel}>Teslim Alinabilir</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <span className={`material-symbols-outlined ${styles.footerIcon}`}>
            info
          </span>
          <span className={styles.footerText}>
            Numaraniz ekranda gorundugunde tezgahtan alabilirsiniz
          </span>
        </footer>
      </div>
    </>
  );
}
