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
  deliveryType?: string;
  tableNumber?: string | null;
  orderSource?: string;
}

function normalizeForSearch(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/_/g, ' ')
    .replace(/[\s-]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function formatGdprName(fullName: string): string {
  if (!fullName || fullName.trim().length === 0) return '';
  
  const val = fullName.trim();
  const lowerVal = val.toLowerCase();
  
  // Eger default isimler kullanilmassa hic isim gosterme ('P. S.' kargasasini onler)
  if (
    lowerVal === 'pos' || 
    lowerVal.includes('pos sat') || 
    lowerVal.includes('misafir') ||
    lowerVal.includes('p.s') ||
    lowerVal.includes('p. s') ||
    lowerVal === 'ps'
  ) {
    return '';
  }

  const parts = val.split(/\s+/);
  
  if (parts.length === 1) {
    const word = parts[0];
    if (word.length <= 3) {
      return word.toUpperCase() + '...';
    } else {
      return word.substring(0, 3).toUpperCase() + '...';
    }
  }
  
  // Birden fazla kelime varsa hepsi icin bas harf (Orn: Yonca Destebasi -> Y. D.)
  return parts
    .map((p) => p.charAt(0).toUpperCase() + '.')
    .join(' ');
}


interface WeatherData {
  temp: number;
  wind: number;
  prob: number;
  code: number;
}

function getWeatherIcon(code: number) {
  if (code === 0) return 'sunny';
  if ([1, 2, 3].includes(code)) return 'partly_cloudy_day';
  if ([45, 48].includes(code)) return 'foggy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowing';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'rainy';
}

const I18N_DICT: any = {
  de: {
    preparing: 'WIRD ZUBEREITET',
    ready: 'ABHOLBEREIT',
    emptyPreparing: 'Keine zubereitenden Bestellungen',
    emptyReady: 'Keine fertigen Bestellungen',
    activeOrder: 'Aktive Bestellung(en)',
    footerMessage: 'Wenn Ihre Nummer auf dem Bildschirm erscheint, können Sie diese an der Theke abholen',
    readyLabel: 'ABHOLBEREIT',
    dayStr: (day: number) => `Tag ${day}`,
    allSections: 'ALLE ABTEILUNGEN',
    startDisplay: 'BILDSCHIRM STARTEN',
    startHint: 'Bitte drücken Sie "OK" auf der Fernbedienung'
  },
  nl: {
    preparing: 'IN BEREIDING',
    ready: 'KLAAR',
    emptyPreparing: 'Geen bestellingen',
    emptyReady: 'Geen bestellingen klaar',
    activeOrder: 'actieve bestelling(en)',
    footerMessage: 'Wanneer uw nummer op het scherm verschijnt, kunt u het ophalen aan de balie',
    readyLabel: 'KLAAR',
    dayStr: (day: number) => `Dag ${day}`,
    allSections: 'ALLE AFDELINGEN',
    startDisplay: 'SCHERM STARTEN',
    startHint: 'Druk op "OK" op de afstandsbediening'
  },
  tr: {
    preparing: 'HAZIRLANIYOR',
    ready: 'HAZIR',
    emptyPreparing: 'Hazırlanan sipariş yok',
    emptyReady: 'Hazır sipariş yok',
    activeOrder: 'aktif sipariş',
    footerMessage: 'Numaranız ekranda göründüğünde tezgahtan alabilirsiniz',
    readyLabel: 'TESLİM ALINABİLİR',
    dayStr: (day: number) => `${day}. Gün`,
    allSections: 'TÜM BÖLÜMLER',
    startDisplay: 'EKRANI BAŞLAT',
    startHint: 'Lütfen kumandadan "OK" tuşuna basınız'
  }
};

function getDualLang(key: string, lang2: string | null, ...args: any[]) {
   const trStr = typeof I18N_DICT.tr[key] === 'function' ? I18N_DICT.tr[key](...args) : I18N_DICT.tr[key];
   if (!lang2 || !I18N_DICT[lang2]) return trStr;
   const secStr = typeof I18N_DICT[lang2][key] === 'function' ? I18N_DICT[lang2][key](...args) : I18N_DICT[lang2][key];
   return `${trStr} / ${secStr}`;
}

export default function KermesTvPage({
  params,
}: {
  params: Promise<{ kermesId: string; locale: string }>;
}) {
  const { kermesId } = use(params);
  const searchParams = useSearchParams();
  const deliveryZoneId = searchParams.get('deliveryZone') || null;
  const legacySection = searchParams.get('section') || null;

  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [kermesName, setKermesName] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [activeDeliveryZone, setActiveDeliveryZone] = useState<any>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lang2, setLang2] = useState<string | null>(null);
  const [dateRangeStr, setDateRangeStr] = useState<string>('');
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [newlyReady, setNewlyReady] = useState<Set<string>>(new Set());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAutoplayOverlay, setShowAutoplayOverlay] = useState(true);
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

          // Dil belirleme
          const countryStr = (data.country || '').toLowerCase();
          if (countryStr.includes('germany') || countryStr.includes('almanya') || countryStr.includes('deutschland') || countryStr.includes('austria') || countryStr.includes('avusturya') || countryStr.includes('österreich') || countryStr.includes('switzer') || countryStr.includes('isvicre') || countryStr.includes('schweiz')) {
            setLang2('de');
          } else if (countryStr.includes('nether') || countryStr.includes('hollanda') || countryStr.includes('niederlande')) {
            setLang2('nl');
          }

          // Tarih ve Gün hesaplama
          const sD = data.date?.toDate?.() || data.startDate?.toDate?.() || null;
          const eD = data.endDate?.toDate?.() || null;
          
          if (sD) {
             const startDate = new Date(sD);
             let dateStr = `${startDate.getDate().toString().padStart(2, '0')}`;
             
             if (eD) {
                const endDate = new Date(eD);
                if (startDate.getMonth() === endDate.getMonth()) {
                   dateStr += `-${endDate.getDate().toString().padStart(2, '0')}.${(startDate.getMonth() + 1).toString().padStart(2, '0')}.${startDate.getFullYear()}`;
                } else {
                   dateStr += `.${(startDate.getMonth() + 1).toString().padStart(2, '0')} - ${endDate.getDate().toString().padStart(2, '0')}.${(endDate.getMonth() + 1).toString().padStart(2, '0')}.${startDate.getFullYear()}`;
                }
             } else {
                dateStr += `.${(startDate.getMonth() + 1).toString().padStart(2, '0')}.${startDate.getFullYear()}`;
             }
             setDateRangeStr(dateStr);

             const now = new Date();
             now.setHours(0,0,0,0);
             const st = new Date(startDate);
             st.setHours(0,0,0,0);
             const diff = Math.floor((now.getTime() - st.getTime()) / (1000 * 60 * 60 * 24));
             
             if (eD) {
                const en = new Date(eD);
                en.setHours(0,0,0,0);
                if (now.getTime() > en.getTime()) {
                   setCurrentDay(-1); // Bitti
                } else {
                   setCurrentDay(diff >= 0 ? diff + 1 : 0);
                }
             } else {
                setCurrentDay(diff >= 0 ? diff + 1 : 0);
             }
          }
          // Weather fetch
          const fetchWeather = async (lat: number, lng: number) => {
            try {
              const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code&hourly=precipitation_probability`);
              const wData = await res.json();
              if (wData.current) {
                setWeather({
                  temp: Math.round(wData.current.temperature_2m),
                  wind: Math.round(wData.current.wind_speed_10m),
                  prob: wData.hourly?.precipitation_probability?.[new Date().getHours()] || 0,
                  code: wData.current.weather_code
                });
              }
            } catch (e) { console.error('Hava durumu cekilemedi', e); }
          };

          const loc = data.city || data.location;
          if (loc) {
             const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1`);
             const geoData = await geoRes.json();
             if (geoData.results?.length > 0) {
               fetchWeather(geoData.results[0].latitude, geoData.results[0].longitude);
             } else {
               fetchWeather(51.1657, 10.4515); // Germany
             }
          } else {
             fetchWeather(51.1657, 10.4515); // Germany Fallback
          }


          if (deliveryZoneId && data.deliveryZones) {
             let dz = data.deliveryZones.find((d: any) => d.id === deliveryZoneId);
             if (dz) {
               if (dz.sectionFilter && data.tableSectionsV2) {
                 const sfNorm = normalizeForSearch(dz.sectionFilter);
                 const sDef = data.tableSectionsV2.find((s: any) => normalizeForSearch(s.name) === sfNorm);
                 if (sDef && sDef.id) {
                   dz = { ...dz, mappedSectionId: sDef.id };
                 }
               }
               setActiveDeliveryZone(dz);
               setSectionLabel(dz.name);
             }
          } else if (legacySection) {
             let mappedSectionId = null;
             if (data.tableSectionsV2) {
                const sfNorm = normalizeForSearch(legacySection);
                const sDef = data.tableSectionsV2.find((s: any) => normalizeForSearch(s.name) === sfNorm);
                if (sDef && sDef.id) mappedSectionId = sDef.id;
             }
             setActiveDeliveryZone({
               id: 'legacy',
               name: legacySection,
               sectionFilter: legacySection,
               mappedSectionId: mappedSectionId,
               prepZoneFilters: []
             });
             setSectionLabel(legacySection);
          }
        }
      } catch (e) {
        console.error('Kermes meta fetch error:', e);
        setKermesName('Kermes');
      }
    }
    fetchKermesMeta();
  }, [kermesId, deliveryZoneId, legacySection]);

  // Ses hazirla
  useEffect(() => {
    audioRef.current = new Audio('/sounds/gong.wav');
    audioRef.current.volume = 0.7;
  }, []);

  const handleStartAudio = async () => {
    try {
      if (audioRef.current) {
         audioRef.current.play().then(() => {
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
            setAudioEnabled(true);
            setShowAutoplayOverlay(false);
         }).catch(err => {
            console.error('Audio play failed', err);
            setShowAutoplayOverlay(false);
         });
      } else {
        setShowAutoplayOverlay(false);
      }
    } catch (e) {
      setShowAutoplayOverlay(false);
    }
  };

  // Ses cal
  const playGong = useCallback(() => {
    if (!audioEnabled || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [audioEnabled]);

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

        if (activeDeliveryZone) {
          // Delivery Zone Filtrelemesi
          let matchesSection = true;
          if (activeDeliveryZone.sectionFilter) {
            const filterNorm = normalizeForSearch(activeDeliveryZone.sectionFilter);
            const orderSection = data.tableSection as string | undefined;
            const orderSectionNorm = normalizeForSearch(orderSection);
            
            const matchesId = activeDeliveryZone.mappedSectionId && orderSection === activeDeliveryZone.mappedSectionId;
            const matchesName = orderSectionNorm === filterNorm || (orderSectionNorm && filterNorm && (orderSectionNorm.includes(filterNorm) || filterNorm.includes(orderSectionNorm)));
            
            // "orderSection" yoksa bile siparis kaybolmasin diye ekranda gosterelim mi?
            // Eger bu Kumpir TV ise zaten matchesPrepZone onu sizer.
            // Eger bu master TV ise, orderSection bos olan gariban siparisi kimse gormezse sikinti.
            if (orderSection && !matchesId && !matchesName) {
               matchesSection = false;
            }
          }

          let matchesPrepZone = true;
          if (activeDeliveryZone.prepZoneFilters && activeDeliveryZone.prepZoneFilters.length > 0) {
            const items = (data.items as Array<any>) || [];
            matchesPrepZone = items.some((item) => {
              const pz = item.prepZones || item.prepZone;
              if (!pz) return false;
              const zones = Array.isArray(pz) ? pz : [pz];
              return zones.some((z: string) => 
                activeDeliveryZone.prepZoneFilters!.some((f: string) => normalizeForSearch(z).includes(normalizeForSearch(f)))
              );
            });
          }

          // Kural: Eger section ve prepZone ikisi de belirtilmisse, order her ikisini de (AND) veya birini karsilamali?
          // Ihtiyaca gore AND kullaniyoruz. 
          if (!matchesSection || !matchesPrepZone) {
            return;
          }
        }

        const orderUpdatedAt = data.updatedAt?.toDate?.() || data.readyAt?.toDate?.() || data.createdAt?.toDate?.() || new Date();
        const minutesSinceUpdate = (new Date().getTime() - orderUpdatedAt.getTime()) / 60000;

        // Auto-Hide Fallback (Kermes'te unutulup ekranda kalan hazir siparislerin tasmasini onler: 15 dakika siniri)
        if (data.status === 'ready' && minutesSinceUpdate > 15) {
          return; // Ekrana yansitma
        }

        allOrders.push({
          id: docSnap.id,
          orderNumber: data.orderNumber || docSnap.id,
          status: data.status,
          customerName: data.customerName || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          deliveryType: data.deliveryType,
          tableNumber: data.tableNumber,
          orderSource: data.orderSource || 'app',
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
  }, [kermesId, activeDeliveryZone, playGong]);

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
  const displayTitle = sectionLabel || getDualLang('allSections', lang2);

  // Siparis Kaynagi Ikonu
  const renderSourceIcon = (order: DisplayOrder, size: string = '24px') => {
    // Masa siparisi ise (rozet olsa bile cok dezent bir sekilde numaraya yapisik da dursun)
    if (order.deliveryType === 'masada') {
      return <span className="material-symbols-outlined" style={{ fontSize: size, color: '#64748b', opacity: 0.6, marginLeft: '8px' }}>restaurant</span>;
    }
    // POS (Kasa / Garson Tablet)
    if (order.orderSource?.startsWith('pos')) {
      return <span className="material-symbols-outlined" style={{ fontSize: size, color: '#64748b', opacity: 0.6, marginLeft: '8px' }}>point_of_sale</span>;
    }
    // Musteri App
    if (order.orderSource === 'app') {
      return <span className="material-symbols-outlined" style={{ fontSize: size, color: '#64748b', opacity: 0.6, marginLeft: '8px' }}>smartphone</span>;
    }
    return null;
  };

  return (
    <>
      {/* Google Material Symbols */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
      />

      <div className={styles.container}>
        {showAutoplayOverlay && (
          <div className={styles.autoplayOverlay}>
            <button 
              className={styles.autoplayButton} 
              onClick={handleStartAudio}
              autoFocus
            >
              ▶ {getDualLang('startDisplay', lang2)}
            </button>
            <span className={styles.autoplayHint}>
              {getDualLang('startHint', lang2)}
            </span>
          </div>
        )}

        {/* Header */}
        <header className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Logo Part */}
            <div style={{ marginRight: '20px' }}>
              <span className={styles.lokmaLogo}><strong style={{fontWeight: 900}}>LOKMA</strong> (ODS)</span>
            </div>
            
            {/* Title & Weather Part */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', paddingLeft: '16px', justifyContent: 'center' }}>
              {/* Line 1: Kermes Name */}
              <div style={{ fontSize: '18px', fontWeight: 500, color: '#e2e8f0', marginBottom: '6px' }}>
                {kermesName}
              </div>
              
              {/* Line 2: Date, Day, Weather Compact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {dateRangeStr && (
                  <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                    {dateRangeStr.replace('-', ' - ')}
                  </span>
                )}

                {currentDay !== null && currentDay > 0 && (
                  <>
                    <div style={{width: '4px', height: '4px', borderRadius: '50%', background: '#fbbf24'}}></div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#fbbf24' }}>
                      {getDualLang('dayStr', lang2, currentDay)}
                    </span>
                  </>
                )}

                {weather ? (
                  <>
                    <div style={{width: '2px', height: '14px', background: 'rgba(255,255,255,0.1)'}}></div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '13px'}}>
                       <span style={{display: 'flex', alignItems: 'center', gap: '2px', color: '#fff', fontWeight: 'bold'}}>
                         <span className="material-symbols-outlined" style={{color: '#fbbf24', fontSize: '14px'}}>{getWeatherIcon(weather.code)}</span>
                         {weather.temp}°C
                       </span>
                       <span style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
                         <span className="material-symbols-outlined" style={{fontSize: '14px'}}>air</span>
                         {weather.wind} km/h
                       </span>
                       <span style={{display: 'flex', alignItems: 'center', gap: '2px', color: '#93c5fd'}}>
                         <span className="material-symbols-outlined" style={{fontSize: '14px'}}>water_drop</span>
                         %{weather.prob}
                       </span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          
          <div className={styles.headerCenter} style={{flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            {displayTitle && (
              <span className={styles.sectionBadge}>
                {displayTitle.split(' / ').map((part, index, array) => (
                  <span key={index} style={{ display: 'block' }}>
                    {part.trim()}
                  </span>
                ))}
              </span>
            )}
          </div>

          <div className={styles.headerRight}>
            <span className={styles.orderCount}>
              {totalActive} {getDualLang('activeOrder', lang2)}
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
              <h2 className={styles.panelTitlePreparing}>{getDualLang('preparing', lang2)}</h2>
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
                  <p className={styles.emptyText}>{getDualLang('emptyPreparing', lang2)}</p>
                </div>
              ) : (
                preparingOrders.map((order) => (
                  <div key={order.id} className={styles.preparingCard} style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className={styles.preparingNumber}>
                        {formatOrderNo(order.orderNumber)}
                      </span>
                      {renderSourceIcon(order, '28px')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {order.deliveryType === 'masada' && (
                        <div className={styles.tableBadge}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>restaurant</span>
                          <span>M{order.tableNumber}</span>
                        </div>
                      )}
                      {order.customerName && formatGdprName(order.customerName) && (
                        <span className={styles.customerInitials}>
                          {formatGdprName(order.customerName)}
                        </span>
                      )}
                    </div>
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
              <h2 className={styles.panelTitleReady}>{getDualLang('ready', lang2)}</h2>
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
                  <p className={styles.emptyText}>{getDualLang('emptyReady', lang2)}</p>
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
                    style={{ position: 'relative' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className={styles.readyNumber}>
                        {formatOrderNo(order.orderNumber)}
                      </span>
                      {renderSourceIcon(order, '36px')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {order.deliveryType === 'masada' && (
                        <div className={styles.tableBadge}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>restaurant</span>
                          <span>M{order.tableNumber}</span>
                        </div>
                      )}
                      {order.customerName && formatGdprName(order.customerName) && (
                        <span className={styles.readyCustomerInitials}>
                          {formatGdprName(order.customerName)}
                        </span>
                      )}
                    </div>
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
            {getDualLang('footerMessage', lang2)}
          </span>
        </footer>
      </div>
    </>
  );
}
