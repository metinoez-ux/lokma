'use client';
import { useTranslations } from 'next-intl';
import AbonelikTabContent from '../admin/business/[id]/AbonelikTabContent';
import HardwareTabContent from '../admin/business/[id]/HardwareTabContent';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { limitService } from '@/services/limitService';
import { invoiceService } from '@/services/invoiceService';
import { subscriptionService } from '@/services/subscriptionService';
import { ButcherSubscriptionPlan } from '@/types';
import { formatCurrency } from '@/utils/currency';
import SubscriptionChangeModal from '@/components/admin/SubscriptionChangeModal';
import { BUSINESS_TYPES } from '@/lib/business-types';
import BusinessInvoiceSection from '@/components/invoices/BusinessInvoiceSection';

// Helper: Generate display features list from a Firestore plan
function getPlanFeatures(plan: ButcherSubscriptionPlan): string[] {
 const features: string[] = [];
 if (plan.orderLimit) features.push(`${plan.orderLimit} sipariş/ay`);
 else features.push('Sınırsız sipariş');
 if (plan.features?.delivery) features.push('Kurye hizmeti');
 if (plan.features?.onlinePayment) features.push('Online ödeme');
 if (plan.features?.campaigns) features.push('Kampanyalar');
 if (plan.features?.prioritySupport) features.push('Öncelikli destek');
 if (plan.features?.liveCourierTracking) features.push('Canlı kurye takibi');
 return features;
}

// Helper: Get plan icon from plan code/name
function getPlanIcon(plan: ButcherSubscriptionPlan): string {
 return '';
}

export default function AccountPage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [admin, setAdmin] = useState<any>(null);
 const [business, setBusiness] = useState<any>(null);
 const [livePlan, setLivePlan] = useState<ButcherSubscriptionPlan | null>(null); // Firestore'dan gelen aktif plan
 const [allPlans, setAllPlans] = useState<ButcherSubscriptionPlan[]>([]); // All active plans for modal
 const [usageStats, setUsageStats] = useState<any>(null); // limitService'den
 const [estimatedInvoice, setEstimatedInvoice] = useState<any>(null); // invoiceService'den
 const [stats, setStats] = useState({
 totalOrders: 0,
 monthlyOrders: 0,
 totalRevenue: 0,
 monthlyRevenue: 0,
 accruedCommission: 0, monthlyCardCommission: 0, monthlyCashCommission: 0,
 paidCommission: 0,
 pushUsed: 0, activeSponsoredProducts: 0, monthlySponsoredOrders: 0, monthlySponsoredFees: 0,
 monthlySponsoredRevenueGross: 0, monthlySponsoredRevenueNet: 0,
 monthlyTableReservations: 0, monthlyTableCovers: 0, monthlyReservationFees: 0,
 });
 const [invoices, setInvoices] = useState<any[]>([]);
 const [commissionRecords, setCommissionRecords] = useState<any[]>([]);
 const [commissionSummary, setCommissionSummary] = useState({
 totalCommission: 0,
 cardCommission: 0,
 cashCommission: 0,
 pendingAmount: 0,
 collectedAmount: 0,
 orderCount: 0,
 });
 const [showBankModal, setShowBankModal] = useState(false);

 const [bankForm, setBankForm] = useState({
 iban: '',
 bic: '',
 accountHolder: '',
 bankName: '',
 });
 const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'billing' | 'hardware'>('overview');
  const tSub = useTranslations('AdminBusinessDetail');
  const tAdmin = useTranslations('Admin');
  const tNav = useTranslations('AdminNav');
  const tAccount = useTranslations('AdminAccount');
  const tBiz = useTranslations('AdminBusiness');

  const cleanEmoji = (str: string) => {
    if (!str) return '';
    return str.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}💳💼📊📈💰🛒]/gu, '').trim();
  };

 // ═══════════════════════════════════════════════════════════════════
 // AUTH & DATA LOADING
 // ═══════════════════════════════════════════════════════════════════
 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (user) => {
 if (!user) {
 router.push('/login');
 return;
 }

 try {
 // Admin bilgisi
 const adminDoc = await getDoc(doc(db, 'admins', user.uid));
 if (!adminDoc.exists()) {
 router.push('/login');
 return;
 }
 const adminData = { id: adminDoc.id, ...adminDoc.data() };
 setAdmin(adminData);

 // İşletme bilgisi
 if ((adminData as any).butcherId) {
 const businessDoc = await getDoc(doc(db, 'businesses', (adminData as any).butcherId));
 if (businessDoc.exists()) {
 const businessData = { id: businessDoc.id, ...businessDoc.data() };
 setBusiness(businessData);

 // Banka formu doldur
 const bankInfo = (businessData as any).bankInfo || {};
 setBankForm({
 iban: bankInfo.iban || '',
 bic: bankInfo.bic || '',
 accountHolder: bankInfo.accountHolder || '',
 bankName: bankInfo.bankName || '',
 });

  // Kullanım istatistikleri (limitService)
  const usage = await limitService.getUsageStats(businessDoc.id);
  setUsageStats(usage);

  // Plan bilgilerini yükle ve eşleştir
  const rawType = (businessData as any).businessCategories?.[0] || (businessData as any).businessType || (businessData as any).type || '';
  const sectorCategory = rawType ? (BUSINESS_TYPES[rawType as keyof typeof BUSINESS_TYPES]?.category || rawType) : '';
  const plans = await subscriptionService.getAllPlans(sectorCategory || undefined);
  
  // Sadece aktif olanları listele (Abonelik tabındaki Modal vs için)
  setAllPlans(plans.filter(p => p.isActive));
  
  let planId = (businessData as any).subscriptionPlan || (businessData as any).plan;
  let activePlan = plans.find(p => p.id === planId || p.code === planId);
  
  // Eğer işletmenin atanan planı yoksa veya silinmişse, fallback olarak uygun "free" planı ata
  if (!activePlan) {
    activePlan = plans.find(p => p.monthlyFee === 0 || p.code?.toLowerCase().includes('free') || p.id.toLowerCase().includes('free'));
  }
  
  if (activePlan) {
    setLivePlan(activePlan);
  }

  // İstatistikleri yükle ve tahmini faturayı hesapla
  await loadStats(businessDoc.id, businessData, activePlan || null, usage);
  }
 }

 // Son faturalar + komisyon kayıtları
 if ((adminData as any).butcherId) {
 await loadInvoices((adminData as any).butcherId);
 await loadCommissionRecords((adminData as any).butcherId);
 }
 } catch (error) {
 console.error('Veri yükleme hatası:', error);
 }

 setLoading(false);
 });

 return () => unsubscribe();
 }, [router]);

  const loadStats = async (butcherId: string, businessData: any, currentPlan: any, fetchedUsage?: any) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const ordersRef = collection(db, 'meat_orders');
      const ordersQuery = query(ordersRef, where('butcherId', '==', butcherId));
      const ordersSnap = await getDocs(ordersQuery);

      let totalRevenue = 0; // Represents YEARLY
      let monthlyRevenue = 0;
      let totalOrders = 0; // Represents YEARLY
      let monthlyOrders = 0;

      let monthlyCommission = 0;
      let monthlyCardCommission = 0;
      let monthlyCashCommission = 0;
      let monthlyPerOrderFees = 0;
      let monthlySponsoredFees = 0;
      let monthlySponsoredOrders = 0;
      let monthlySponsoredRevenueGross = 0;
      let monthlySponsoredRevenueNet = 0;

      let monthlyTableReservations = 0;
      let monthlyTableCovers = 0;
      let monthlyReservationFees = 0;

      ordersSnap.forEach(doc => {
        const data = doc.data();
        const status = data.status || '';
        // Sadece basariyla tamamlanmis/teslim edilmis siparisler (delivered, picked_up, past, completed)
        const isCompleted = status === 'delivered' || status === 'picked_up' || status === 'completed' || status === 'past';
        if (!isCompleted) return;

        const orderDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
        const orderTotal = data.total || data.grandTotal || 0;

        // Yıllık istatistikler
        if (orderDate >= startOfYear) {
          totalOrders++;
          totalRevenue += orderTotal;
        }

        // Aylık istatistikler
        if (orderDate >= startOfMonth) {
          monthlyOrders++;
          monthlyRevenue += orderTotal;

          // Dinamik Komisyon Hesaplama
          const deliveryType = data.deliveryMethod || data.courierType || 'click_collect';
          let commRate = currentPlan?.commissionClickCollect || 0;
          if (deliveryType === 'own_courier') commRate = currentPlan?.commissionOwnCourier || 0;
          else if (deliveryType === 'lokma_courier') commRate = currentPlan?.commissionLokmaCourier || 0;
          
          const orderComm = orderTotal * (commRate / 100);
          monthlyCommission += orderComm;

          const isCard = data.paymentMethod === 'card' || data.paymentMethod === 'stripe' || data.paymentMethod === 'online';
          if (isCard) {
             monthlyCardCommission += orderComm;
          } else {
             monthlyCashCommission += orderComm;
          }

          let perOrderFee = 0;
          if (currentPlan?.perOrderFeeType === 'fixed') {
              perOrderFee = currentPlan.perOrderFeeAmount || 0;
          } else if (currentPlan?.perOrderFeeType === 'percentage') {
              perOrderFee = orderTotal * ((currentPlan.perOrderFeeAmount || 0) / 100);
          }
          if (perOrderFee > 0) monthlyPerOrderFees += perOrderFee;

          // Sponsored Product/Event Fee
          let sponsoredItemsCount = 0;
          let tempSponsoredGross = 0;
          let tempSponsoredNet = 0;
          
          if (Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                  let isItemSponsored = false;
                  
                  // 1. Historical check (most reliable): Did the mobile app tag this specific product as sponsored?
                  if (data.hasSponsoredItems && Array.isArray(data.sponsoredItemIds) && item.productId && data.sponsoredItemIds.includes(item.productId)) {
                      isItemSponsored = true;
                  } 
                  // 2. Fallback to current business list (if historical data is missing)
                  else if (item.productId && businessData?.sponsoredProducts && Array.isArray(businessData.sponsoredProducts) && businessData.sponsoredProducts.includes(item.productId)) {
                      isItemSponsored = true;
                  }
                  
                  if (isItemSponsored) {
                      const q = Number(item.quantity || 1);
                      sponsoredItemsCount += q;
                      const gross = (Number(item.price) || 0) * q;
                      tempSponsoredGross += gross;
                      const taxRate = Number(item.taxRate) || 7;
                      tempSponsoredNet += gross / (1 + (taxRate / 100));
                  }
              });
          }
          
          // 3. Fallback to explicit flags from mobile app if items parsing failed
          if (sponsoredItemsCount === 0) {
              if (data.hasSponsoredItems && Array.isArray(data.sponsoredItemIds)) {
                  sponsoredItemsCount = data.sponsoredItemIds.length;
              } else if (data.fromSponsored || data.isSponsored || data.hasSponsoredItems) {
                  sponsoredItemsCount = 1;
              }
              // If we reached here, we couldn't match items. Estimate revenue from order total.
              if (sponsoredItemsCount > 0) {
                  tempSponsoredGross = Number(data.grandTotal || data.total || data.subTotal || 0);
                  tempSponsoredNet = tempSponsoredGross / 1.07;
              }
          }

          if (sponsoredItemsCount > 0) {
              const sponsoredFee = currentPlan?.sponsoredFeePerConversion || 0;
              if (sponsoredFee > 0) {
                  monthlySponsoredFees += (sponsoredFee * sponsoredItemsCount);
              }
              monthlySponsoredOrders += sponsoredItemsCount;
              monthlySponsoredRevenueGross += tempSponsoredGross;
              monthlySponsoredRevenueNet += tempSponsoredNet;
          }
        }
      });

      // --- MASA REZERVASYONLARI HESAPLAMASI ---
      const reservationsRef = collection(db, 'reservations');
      const reservationsQuery = query(reservationsRef, where('businessId', '==', butcherId));
      const reservationsSnap = await getDocs(reservationsQuery);
      
      reservationsSnap.forEach(doc => {
          const data = doc.data();
          const resDate = data.reservedAt?.toDate ? data.reservedAt.toDate() : new Date(data.reservedAt || data.createdAt || 0);
          
          if (resDate >= startOfMonth && data.status !== 'cancelled' && data.status !== 'rejected') {
              monthlyTableReservations++;
              monthlyTableCovers += Number(data.guestCount || data.guests || data.coverCount || 1);
          }
      });
      
      // Calculate reservation fees based on currentPlan model
      let reservationBillableUnits = 0;
      const resModel = currentPlan?.tableReservationModel || 'free';
      const resQuota = currentPlan?.tableReservationFreeQuota || 0;
      const resFee = currentPlan?.tableReservationFee || 0;
      
      if (resModel === 'per_cover') {
          reservationBillableUnits = Math.max(0, monthlyTableCovers - resQuota);
          monthlyReservationFees = reservationBillableUnits * resFee;
      } else if (resModel === 'per_reservation') {
          reservationBillableUnits = Math.max(0, monthlyTableReservations - resQuota);
          monthlyReservationFees = reservationBillableUnits * resFee;
      } else if (currentPlan?.tableReservationLimit && currentPlan?.tableReservationOverageFee) {
          // Legacy support for older plans
          reservationBillableUnits = Math.max(0, monthlyTableReservations - currentPlan.tableReservationLimit);
          monthlyReservationFees = reservationBillableUnits * currentPlan.tableReservationOverageFee;
      }

      // --- TAHMİNİ FATURA OLUŞTURMA (LOCAL) ---
      const lineItems = [];
      
      // 1. Abonelik Ücreti
      if (currentPlan?.monthlyFee > 0) {
        lineItems.push({
          description: `${currentPlan.name} Plan - Aylık Abonelik`,
          total: currentPlan.monthlyFee,
          type: 'subscription'
        });
      }

      // Eklentiler (Add-ons)
      if (businessData?.etaAddon) {
        lineItems.push({
          description: `Eklenti: ETA Canlı Kurye Takibi`,
          total: 15,
          type: 'addon'
        });
      }
      if (businessData?.whatsappAddon) {
        lineItems.push({
          description: `Eklenti: WhatsApp Bildirim Paketi`,
          total: 29,
          type: 'addon'
        });
      }

      // 2. Sipariş Provizyonu (Sadece % Komisyon)
      if (monthlyCommission > 0) {
        lineItems.push({
          description: `Sipariş Provizyonu (${monthlyOrders} sipariş)`,
          total: monthlyCommission,
          quantity: monthlyOrders,
          type: 'commission'
        });
      }
      
      // 3. Sipariş Başı Ücret
      if (monthlyPerOrderFees > 0) {
        lineItems.push({
          description: `Sipariş Başı Ücret`,
          total: monthlyPerOrderFees,
          type: 'perOrder'
        });
      }

      // 4. Sponsored Product / Extra Ücretler
      if (monthlySponsoredFees > 0) {
        lineItems.push({
          description: `Sponsored Products Ücreti (${monthlySponsoredOrders} adet)`,
          total: monthlySponsoredFees,
          type: 'sponsored'
        });
      }

      // 5. Sipariş Aşım Ücreti
      if (currentPlan?.orderLimit !== null && currentPlan?.orderLimit !== undefined && monthlyOrders > currentPlan.orderLimit) {
        const overageOrders = monthlyOrders - currentPlan.orderLimit;
        const overageTotal = overageOrders * (currentPlan.orderOverageFee || 0);
        if (overageTotal > 0) {
          lineItems.push({
            description: `Sipariş Aşım Ücreti (${overageOrders} adet)`,
            total: overageTotal,
            type: 'overage'
          });
        }
      }

      // 6. Personel Aşım Ücreti
      if (fetchedUsage?.personnel?.used > fetchedUsage?.personnel?.limit && fetchedUsage?.personnel?.limit !== null) {
        const overageCount = fetchedUsage.personnel.used - fetchedUsage.personnel.limit;
        const overageTotal = overageCount * (currentPlan?.personnelOverageFee || 0);
        if (overageTotal > 0) {
          lineItems.push({
            description: `Personel Aşım Ücreti (${overageCount} kişi)`,
            total: overageTotal,
            type: 'overage'
          });
        }
      }

      // 7. Masa Rezervasyon Aşım Ücreti
      if (fetchedUsage?.tableReservations?.used > fetchedUsage?.tableReservations?.limit && fetchedUsage?.tableReservations?.limit !== null) {
        const overageCount = fetchedUsage.tableReservations.used - fetchedUsage.tableReservations.limit;
        const overageTotal = overageCount * (currentPlan?.tableReservationOverageFee || 0);
        if (overageTotal > 0) {
          lineItems.push({
            description: `Masa Rezervasyon Aşım Ücreti (${overageCount} adet)`,
            total: overageTotal,
            type: 'overage'
          });
        }
      }

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const taxRate = 19; // Almanya KDV
      const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      const dynamicInvoice = {
        lineItems,
        subtotal,
        tax,
        taxRate,
        total,
        currency: currentPlan?.currency || businessData?.currency || 'EUR'
      };
      setEstimatedInvoice(dynamicInvoice);
      // ------------------------------------------

      const commissionRate = currentPlan?.commissionClickCollect || 5.0;
      const accruedCommission = totalRevenue * (commissionRate / 100);

      setStats({
        totalOrders,
        monthlyOrders,
        totalRevenue,
        monthlyRevenue,
        accruedCommission,
        monthlyCardCommission,
        monthlyCashCommission,
        paidCommission: businessData?.paidCommission || 0,
        pushUsed: businessData?.pushUsed || 0,
        activeSponsoredProducts: businessData?.sponsoredProducts?.length || 0,
        monthlySponsoredOrders,
        monthlySponsoredFees,
        monthlySponsoredRevenueGross,
        monthlySponsoredRevenueNet,
        monthlyTableReservations,
        monthlyTableCovers,
        monthlyReservationFees,
      });
    } catch (error) {
      console.error('Stats yükleme hatası:', error);
    }
  };

 const loadInvoices = async (butcherId: string) => {
 try {
 const invoicesQuery = query(
 collection(db, 'invoices'),
 where('businessId', '==', butcherId),
 orderBy('createdAt', 'desc')
 );
 const invoicesSnap = await getDocs(invoicesQuery);
 setInvoices(invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
 } catch (e) {
 // Index yoksa sadece where ile cekip client'ta sirala
 try {
 const fallbackQuery = query(
 collection(db, 'invoices'),
 where('businessId', '==', butcherId)
 );
 const fallbackSnap = await getDocs(fallbackQuery);
 const rawInvoices = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 const sorted = rawInvoices.sort((a: any, b: any) => {
 const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
 const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
 return dateB - dateA;
 });
 setInvoices(sorted);
 } catch (err) {
 console.error('Fatura yükleme hatası:', err);
 setInvoices([]);
 }
 }
 };

 // ═══════════════════════════════════════════════════════════════════
 // KOMİSYON KAYITLARI
 // ═══════════════════════════════════════════════════════════════════
 const loadCommissionRecords = async (butcherId: string) => {
 try {
 const now = new Date();
 const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
 const commQuery = query(
 collection(db, 'commission_records'),
 where('businessId', '==', butcherId),
 where('period', '==', currentPeriod),
 orderBy('createdAt', 'desc')
 );
 const snap = await getDocs(commQuery);
 const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
 setCommissionRecords(records);

 // Summary
 let totalCommission = 0, cardCommission = 0, cashCommission = 0, pendingAmount = 0, collectedAmount = 0;
 records.forEach((r: any) => {
 totalCommission += r.totalCommission || 0;
 const isCard = r.paymentMethod === 'card' || r.paymentMethod === 'stripe';
 if (isCard) {
 cardCommission += r.totalCommission || 0;
 collectedAmount += r.totalCommission || 0;
 } else {
 cashCommission += r.totalCommission || 0;
 if (r.collectionStatus === 'pending') {
 pendingAmount += r.totalCommission || 0;
 } else {
 collectedAmount += r.totalCommission || 0;
 }
 }
 });
 setCommissionSummary({ totalCommission, cardCommission, cashCommission, pendingAmount, collectedAmount, orderCount: records.length });
 } catch (error) {
 console.error('Komisyon kayıtları yükleme hatası:', error);
 }
 };

 // ═══════════════════════════════════════════════════════════════════
 // BANKA BİLGİSİ KAYDET
 // ═══════════════════════════════════════════════════════════════════
 const handleSaveBank = async () => {
 if (!business?.id) return;
 setSaving(true);
 try {
 await updateDoc(doc(db, 'businesses', business.id), {
 bankInfo: bankForm,
 updatedAt: new Date(),
 });
 setBusiness({ ...business, bankInfo: bankForm });
 setShowBankModal(false);
 alert('Banka bilgileri kaydedildi!');
 } catch (error) {
 console.error('Banka kaydetme hatası:', error);
 alert('Kaydetme hatası!');
 }
 setSaving(false);
 };

 // ═══════════════════════════════════════════════════════════════════
 // PLAN DEĞİŞİMİ (GELECEK AYIN 1'İ)
 // ═══════════════════════════════════════════════════════════════════


 // ═══════════════════════════════════════════════════════════════════
 // RENDER
 // ═══════════════════════════════════════════════════════════════════
 if (loading) {
 return (
 <div className="min-h-screen bg-gray-900 flex items-center justify-center">
 <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
 </div>
 );
 }

 const currentPlan = business?.subscriptionPlan || business?.plan || 'free';
 // Derive display info from livePlan (Firestore) instead of hardcoded PLANS
 const planName = livePlan?.name || currentPlan;
 const planPrice = livePlan?.monthlyFee ?? 0;
  const planOrderLimit = livePlan?.orderLimit !== undefined ? livePlan.orderLimit : (usageStats?.orders?.limit !== undefined ? usageStats.orders.limit : null);
  const planColor = livePlan?.color?.replace('bg-', '').replace('-600', '') || 'gray';
  const planIcon = livePlan ? getPlanIcon(livePlan) : '';
  const planFeatures = livePlan?.features ? Object.keys(livePlan.features).filter(k => livePlan.features[k] === true) : [];
  const pushLimit = usageStats?.push?.limit !== undefined ? usageStats.push.limit : null;
  const pushRemaining = pushLimit === null ? '∞' : Math.max(0, pushLimit - stats.pushUsed);
  const orderProgress = planOrderLimit === null ? 0 : (stats.monthlyOrders / (planOrderLimit || 1)) * 100;
  
  const personnelLimit = usageStats?.personnel?.limit !== undefined ? usageStats.personnel.limit : null;
  const personnelUsed = usageStats?.personnel?.used || 0;
  const personnelProgress = personnelLimit === null ? 0 : (personnelUsed / (personnelLimit || 1)) * 100;
  
  const tableReservationLimit = usageStats?.tableReservations?.limit !== undefined ? usageStats.tableReservations.limit : null;
  const tableReservationUsed = usageStats?.tableReservations?.used || 0;
  const tableReservationProgress = tableReservationLimit === null ? 0 : (tableReservationUsed / (tableReservationLimit || 1)) * 100;

  const kTarget = admin?.kermesId || ((admin as any)?.kermesAssignments && (admin as any)?.kermesAssignments[0] && (admin as any)?.kermesAssignments[0].kermesId) || ((admin as any)?.assignments?.find((a: any) => a.entityType === 'kermes')?.entityId);
  const isKermesUser = business?.type === 'kermes' || business?.businessType === 'kermes' || !!kTarget || ['kermes', 'kermes_staff', 'kermes_admin', 'mutfak', 'garson', 'teslimat', 'kds', 'kasa', 'vezne', 'volunteer'].includes(admin?.adminType || '');

  if (isKermesUser) {
    const balance = admin?.collectedCash || admin?.walletBalance || admin?.balance || 0;
    const assignedShifts = admin?.assignedShifts || admin?.shifts || [];
    const workedHours = admin?.workedHours || admin?.totalHours || 0;

    return (
      <div className="min-h-screen bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                {tNav('myAccount') || 'Hesabım'}
              </h1>
              <p className="text-gray-400 mt-1">
                {admin?.name || admin?.firstName || admin?.adminName || 'Gönüllü Personel'} - {business?.companyName || business?.brand || 'Kermes'}
              </p>
            </div>
            <button onClick={() => router.back()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              {tSub('geri_buton') || '← Geri'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-r from-emerald-900/60 to-emerald-800/40 border border-emerald-500/40 rounded-2xl p-6">
              <p className="text-emerald-200 text-sm mb-2">Cüzdan / Kasa Durumu</p>
              <h2 className="text-4xl font-bold text-white">
                {formatCurrency(balance, business?.currency || 'EUR')}
              </h2>
              <p className="text-emerald-200/70 text-xs mt-2">Aktif olarak üzerinizde bulunan tahsilat tutarı</p>
            </div>

            <div className="bg-gradient-to-r from-blue-900/60 to-blue-800/40 border border-blue-500/40 rounded-2xl p-6">
              <p className="text-blue-200 text-sm mb-2">Çalışma İstatistiği</p>
              <h2 className="text-4xl font-bold text-white">
                {workedHours} Saat
              </h2>
              <p className="text-blue-200/70 text-xs mt-2">Bu kermes boyunca kaydedilen toplam görev süresi</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              Atanan Vardiyalar
            </h3>
            {assignedShifts && assignedShifts.length > 0 ? (
              <div className="space-y-3">
                {assignedShifts.map((shift: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <div>
                      <p className="text-white font-medium">{shift.name || shift.title || 'Vardiya'}</p>
                      <p className="text-gray-400 text-sm mt-0.5">{shift.date} • {shift.startTime} - {shift.endTime}</p>
                    </div>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                      {shift.role || 'Gönüllü'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4">Henüz atanmış bir vardiyanız bulunmuyor.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

 return (
 <div className="min-h-screen bg-gray-900">
 <div className="max-w-6xl mx-auto px-4 py-8">
 {/* ═══════════════════════════════════════════════════════════════════
 HEADER
 ═══════════════════════════════════════════════════════════════════ */}
  <div className="flex items-center justify-between mb-8">
  <div>
  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
  {cleanEmoji(tNav('myAccount') || 'Hesabım')}
  </h1>
  <p className="text-gray-400 mt-1">
  {business?.companyName || business?.brand || 'İşletme'} - {tSub('limitler_ve_ucretler') || 'Limitler ve Ücretler'}
  </p>
  </div>
  <button onClick={() => router.back()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
  {tSub('geri_buton') || '← Geri'}
  </button>
  </div>

  {/* ═══════════════════════════════════════════════════════════════════
  TABS NAVIGATION
  ═══════════════════════════════════════════════════════════════════ */}
  <div className="flex overflow-x-auto gap-2 mb-6 bg-card/50 p-1.5 rounded-xl border border-border w-fit">
    <button
      onClick={() => setActiveTab('overview')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'overview'
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
      }`}
    >
      {tSub('detay') || 'Özet'}
    </button>
    <button
      onClick={() => setActiveTab('subscription')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'subscription'
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
      }`}
    >
      {tSub('uyelikAbonelik') || 'Abonelik'}
    </button>
    <button
      onClick={() => setActiveTab('billing')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'billing'
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
      }`}
    >
      {cleanEmoji(tAccount('fatura_ve_odeme') || 'Fatura & Ödeme')}
    </button>
    <button
      onClick={() => setActiveTab('hardware')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        activeTab === 'hardware'
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
      }`}
    >
      Donanım Mağazası
    </button>
  </div>

  {activeTab === 'overview' && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

 {/* ═══════════════════════════════════════════════════════════════════
 AKTİF PLAN KARTI
 ═══════════════════════════════════════════════════════════════════ */}
 <div className={`bg-gradient-to-r from-${planColor}-900/60 to-${planColor}-800/40 border border-${planColor}-500/40 rounded-2xl p-6 mb-6`}>
 <div className="flex flex-wrap items-start justify-between gap-4">
 <div>
 <p className="text-gray-400 text-sm mb-1">{tAccount('mevcut_plan') || 'Aktif Planınız'}</p>
 <h2 className="text-4xl font-bold text-white flex items-center gap-3">
 {planName}
 </h2>
  <div className="flex flex-wrap gap-2 mt-4">
  {planFeatures.length > 0 ? planFeatures.map((f, i) => (
  <span key={i} className="px-3 py-1 bg-background/10 text-white/90 text-sm rounded-full">
  ✓ {tBiz(`feature_${f}`) || f}
  </span>
  )) : (
  <span className="px-3 py-1 bg-background/10 text-white/90 text-sm rounded-full">
  ✓ {tSub('limitler_ve_ucretler') || 'Temel özellikler'}
  </span>
  )}
  {business?.etaAddon && (
  <span className="px-3 py-1 bg-blue-500/20 text-blue-200 text-sm rounded-full border border-blue-500/30">
  + ETA Canlı Takip
  </span>
  )}
  {business?.whatsappAddon && (
  <span className="px-3 py-1 bg-green-500/20 text-green-200 text-sm rounded-full border border-green-500/30">
  + WhatsApp Bildirim
  </span>
  )}
  </div>
 </div>
 <div className="text-right">
 <p className="text-gray-400 text-sm">{tAccount('aylik_ucret')?.split(':')[0] || 'Aylık Ücret'}</p>
 <p className="text-4xl font-bold text-white">
 {formatCurrency(planPrice, livePlan?.currency || business?.currency)}
 </p>
 
 </div>
 </div>

 {business?.pendingPlanChange && (
 <div className="mt-4 px-4 py-3 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-3">
 <div>
 <p className="text-amber-200 font-semibold text-sm">{tSub('bekleyen_plan_degisikligi') || 'Bekleyen Plan Değişikliği'}</p>
 <p className="text-amber-200/80 text-xs mt-0.5">
  <strong className="text-amber-100">
  {allPlans.find(p => p.code === (typeof business.pendingPlanChange === 'string' ? business.pendingPlanChange : business.pendingPlanChange?.planCode))?.name || (typeof business.pendingPlanChange === 'string' ? business.pendingPlanChange : business.pendingPlanChange?.planCode)}
  </strong> {tSub('yeni_plan_gecis_tarihi') || 'planına geçişiniz'} <strong>
  {business.planTransitionDate?.toDate 
  ? business.planTransitionDate.toDate().toLocaleDateString('tr-TR')
  : (business.planTransitionDate ? new Date(business.planTransitionDate).toLocaleDateString('tr-TR') : 'Gelecek ay')}
  </strong> {tSub('tarihinde_aktif_olacak') || 'tarihinde aktif olacaktır.'}
 </p>
 </div>
 </div>
 )}

 {/* Kullanım Barları */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
 {/* Sipariş Kullanımı */}
 <div>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-gray-300">{tAccount('bu_ay') || 'Bu Ay'} {tAccount('siparisler') || 'Sipariş'}</span>
 <span className="text-white font-bold">
 {stats.monthlyOrders} / {planOrderLimit === null ? '∞' : planOrderLimit}
 </span>
 </div>
 <div className="w-full bg-gray-700 rounded-full h-3">
 <div
 className={`h-3 rounded-full transition-all ${orderProgress > 90 ? 'bg-red-500' : orderProgress > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
 style={{ width: `${Math.min(100, orderProgress)}%` }}
 />
 </div>
 </div>
 {/* Push Kullanımı */}
 <div>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-gray-300">Push Bildirim</span>
 <span className="text-white font-bold">
 {stats.pushUsed} / {pushLimit === null ? '∞' : pushLimit}
 </span>
 </div>
 <div className="w-full bg-gray-700 rounded-full h-3">
 <div
 className="h-3 rounded-full bg-blue-500 transition-all"
 style={{ width: pushLimit === null ? '5%' : `${Math.min(100, (stats.pushUsed / pushLimit) * 100)}%` }}
 />
 </div>
 </div>
 {/* Personel Kullanımı */}
 <div>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-gray-300">Personel Kullanımı</span>
 <span className="text-white font-bold">
 {personnelUsed} / {personnelLimit === null ? '∞' : personnelLimit}
 </span>
 </div>
 <div className="w-full bg-gray-700 rounded-full h-3">
 <div
 className={`h-3 rounded-full transition-all ${personnelProgress > 90 ? 'bg-red-500' : personnelProgress > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
 style={{ width: personnelLimit === null ? '5%' : `${Math.min(100, personnelProgress)}%` }}
 />
 </div>
 </div>
 {/* Masa Rezervasyon Kullanımı */}
 <div>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-gray-300">Masa Rezervasyonu</span>
 <span className="text-white font-bold">
 {tableReservationUsed} / {tableReservationLimit === null ? '∞' : tableReservationLimit}
 </span>
 </div>
 <div className="w-full bg-gray-700 rounded-full h-3">
 <div
 className={`h-3 rounded-full transition-all ${tableReservationProgress > 90 ? 'bg-red-500' : tableReservationProgress > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
 style={{ width: tableReservationLimit === null ? '5%' : `${Math.min(100, tableReservationProgress)}%` }}
 />
 </div>
 </div>
 </div>
 </div>

 {/* ═══════════════════════════════════════════════════════════════════
 İSTATİSTİK KARTLARI
 ═══════════════════════════════════════════════════════════════════ */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <div className="bg-gray-800 rounded-xl p-5">
 <p className="text-gray-400 text-sm">{tAccount('bu_ay') || 'Bu Ay'} {tAccount('siparisler') || 'Sipariş'}</p>
 <p className="text-3xl font-bold text-white">{stats.monthlyOrders}</p>
 </div>
 <div className="bg-gray-800 rounded-xl p-5">
 <p className="text-gray-400 text-sm">{tAccount('bu_yil') || 'Bu Yıl'} {tAccount('siparisler') || 'Sipariş'}</p>
 <p className="text-3xl font-bold text-white">{stats.totalOrders}</p>
 </div>
 <div className="bg-gray-800 rounded-xl p-5">
 <p className="text-gray-400 text-sm">{tAccount('bu_ay') || 'Bu Ay'} {tAccount('ciro') || 'Ciro'}</p>
 <p className="text-3xl font-bold text-green-400">{formatCurrency(stats.monthlyRevenue, business?.currency)}</p>
 </div>
 <div className="bg-gray-800 rounded-xl p-5">
 <p className="text-gray-400 text-sm">{tAccount('bu_yil_ciro') || 'Bu Yıl Ciro'}</p>
 <p className="text-3xl font-bold text-green-400">{formatCurrency(stats.totalRevenue, business?.currency)}</p>
 </div>
 </div>

  {/* ═══════════════════════════════════════════════════════════════════
  SPONSORED PRODUCTS İSTATİSTİKLERİ
  ═══════════════════════════════════════════════════════════════════ */}
  {(livePlan?.features as any)?.sponsoredProducts && (
  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-6 mb-6">
  <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2">
  Sponsored Products
  </h3>
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  <div className="bg-background/50 rounded-lg p-4 border border-yellow-600/20">
  <p className="text-gray-400 text-xs mb-1">Aktif Ürünler</p>
  <p className="text-2xl font-bold text-white">{stats.activeSponsoredProducts} <span className="text-sm font-normal text-gray-500">/ {(livePlan as any).sponsoredMaxProducts || 5}</span></p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-yellow-600/20">
  <p className="text-gray-400 text-xs mb-1">Satış Değeri (Net/Brüt)</p>
  <p className="text-2xl font-bold text-green-400">
    {formatCurrency(stats.monthlySponsoredRevenueNet, livePlan?.currency || business?.currency)}
    <span className="text-sm font-normal text-gray-500 ml-1">/ {formatCurrency(stats.monthlySponsoredRevenueGross, livePlan?.currency || business?.currency)}</span>
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-yellow-600/20">
  <p className="text-gray-400 text-xs mb-1">Sipariş Başı Ücret</p>
  <p className="text-2xl font-bold text-yellow-400">
  {((livePlan as any)?.sponsoredFeePerConversion || 0) > 0 ? formatCurrency((livePlan as any).sponsoredFeePerConversion, livePlan?.currency || business?.currency) : 'Ücretsiz'}
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-yellow-600/20">
  <p className="text-gray-400 text-xs mb-1">Bu Ay Siparişler</p>
  <p className="text-2xl font-bold text-white">{stats.monthlySponsoredOrders}</p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-yellow-600/20">
  <p className="text-gray-400 text-xs mb-1">Bu Ay Toplam Ücret</p>
  <p className="text-2xl font-bold text-red-400">{formatCurrency(stats.monthlySponsoredFees, livePlan?.currency || business?.currency)}</p>
  </div>
  </div>
  </div>
  )}

  {/* ═══════════════════════════════════════════════════════════════════
  MASA REZERVASYON İSTATİSTİKLERİ
  ═══════════════════════════════════════════════════════════════════ */}
  {(livePlan?.features as any)?.tableReservation && (
  <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-6 mb-6">
  <h3 className="text-lg font-bold text-blue-500 mb-4 flex items-center gap-2">
  🍽️ Masa Rezervasyonları
  </h3>
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  <div className="bg-background/50 rounded-lg p-4 border border-blue-600/20">
  <p className="text-gray-400 text-xs mb-1">Fiyatlandırma Modeli</p>
  <p className="text-lg font-bold text-white leading-tight">
  {(livePlan as any).tableReservationModel === 'per_cover' ? 'Kişi Başı Ücret' : ((livePlan as any).tableReservationModel === 'per_reservation' ? 'Masa Başı Ücret' : 'Ücretsiz (Sabit)')}
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-blue-600/20">
  <p className="text-gray-400 text-xs mb-1">Aylık Ücretsiz Kota</p>
  <p className="text-2xl font-bold text-white">
  {(livePlan as any).tableReservationFreeQuota != null ? (livePlan as any).tableReservationFreeQuota : 'Sınırsız'}
  <span className="text-sm font-normal text-gray-500 ml-1">
  {(livePlan as any).tableReservationModel === 'per_cover' ? 'Kişi' : 'Masa'}
  </span>
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-blue-600/20">
  <p className="text-gray-400 text-xs mb-1">Bu Ay Gerçekleşen</p>
  <p className="text-2xl font-bold text-blue-400">
  {stats.monthlyTableReservations} <span className="text-sm font-normal text-gray-500 ml-1">Masa</span>
  <br/>
  <span className="text-lg text-white">{stats.monthlyTableCovers}</span> <span className="text-xs text-gray-500">Kişi (Cover)</span>
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-blue-600/20">
  <p className="text-gray-400 text-xs mb-1">Birim Ücret</p>
  <p className="text-2xl font-bold text-white">
  {((livePlan as any)?.tableReservationFee || 0) > 0 ? formatCurrency((livePlan as any)?.tableReservationFee, livePlan?.currency || business?.currency) : '0,00'}
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-blue-600/20">
  <p className="text-gray-400 text-xs mb-1">Bu Ay Toplam Ücret</p>
  <p className="text-2xl font-bold text-red-400">{formatCurrency(stats.monthlyReservationFees, livePlan?.currency || business?.currency)}</p>
  </div>
  </div>
  </div>
  )}


  {/* ═══════════════════════════════════════════════════════════════════
  PERSONEL & VARDİYA İSTATİSTİKLERİ
  ═══════════════════════════════════════════════════════════════════ */}
  <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-xl p-6 mb-6">
  <h3 className="text-lg font-bold text-cyan-500 mb-4 flex items-center gap-2">
  👥 Personel & Vardiya Yönetimi
  </h3>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div className="bg-background/50 rounded-lg p-4 border border-cyan-600/20">
  <p className="text-gray-400 text-xs mb-1">Vardiya Takibi Modülü</p>
  <p className="text-lg font-bold text-white leading-tight">
  {(livePlan?.features as any)?.staffShiftTracking ? 'Aktif' : 'Kapalı'}
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-cyan-600/20">
  <p className="text-gray-400 text-xs mb-1">Kayıtlı Personel</p>
  <p className="text-2xl font-bold text-white">
  {personnelUsed} <span className="text-sm font-normal text-gray-500 ml-1">/ {livePlan?.personnelLimit != null ? livePlan.personnelLimit : 'Sınırsız'}</span>
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-cyan-600/20">
  <p className="text-gray-400 text-xs mb-1">Aşım Birim Ücreti</p>
  <p className="text-2xl font-bold text-white">
  {(livePlan?.personnelOverageFee || 0) > 0 ? formatCurrency(livePlan?.personnelOverageFee || 0, livePlan?.currency || business?.currency) : '0,00'}
  </p>
  </div>
  <div className="bg-background/50 rounded-lg p-4 border border-cyan-600/20">
  <p className="text-gray-400 text-xs mb-1">Bu Ay Aşım Ücreti</p>
  <p className="text-2xl font-bold text-red-400">
  {livePlan?.personnelLimit != null && personnelUsed > livePlan.personnelLimit ? formatCurrency((personnelUsed - livePlan.personnelLimit) * (livePlan.personnelOverageFee || 0), livePlan?.currency || business?.currency) : formatCurrency(0, livePlan?.currency || business?.currency)}
  </p>
  </div>
  </div>
  </div>


 {/* ═══════════════════════════════════════════════════════════════════
 PROVİZYON & TAHMİNİ FATURA
 ═══════════════════════════════════════════════════════════════════ */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
 {/* Provizyon - Dinamik Kurye Bazlı */}
 <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-6">
 <h3 className="text-lg font-bold text-amber-200 mb-4 flex items-center gap-2">
 {cleanEmoji(tAccount('provizyon_ozeti') || 'Provizyon Özeti')}
 </h3>
 <div className="space-y-3">
 {livePlan ? (
 <>
 <div className="grid grid-cols-3 gap-2">
 <div className="bg-green-900/40 rounded-lg p-3 text-center">
 <p className="text-xs text-gray-400">{cleanEmoji(tAccount('click_collect') || 'Gel-Al')}</p>
 <p className="text-xl font-bold text-green-400">%{livePlan.commissionClickCollect || 5}</p>
 </div>
 <div className="bg-blue-900/40 rounded-lg p-3 text-center">
 <p className="text-xs text-gray-400">{cleanEmoji(tAccount('kendi_kurye') || 'Kendi')}</p>
 <p className="text-xl font-bold text-blue-400">%{livePlan.commissionOwnCourier || 4}</p>
 </div>
 <div className="bg-purple-900/40 rounded-lg p-3 text-center">
 <p className="text-xs text-gray-400">{tAccount('lokma_kurye') || 'LOKMA'}</p>
 <p className="text-xl font-bold text-purple-400">%{livePlan.commissionLokmaCourier || 7}</p>
 </div>
 </div>
 {livePlan.freeOrderCount > 0 && (
 <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-900/30 rounded-lg px-3 py-2">
 <span className="font-medium">PDF</span>
 {tSub('ilk') || 'İlk'} {livePlan.freeOrderCount} {tAccount('siparis') || 'sipariş'} {tSub('ucretsiz') || 'ücretsiz!'}
 </div>
 )}
 {livePlan.perOrderFeeType && livePlan.perOrderFeeType !== 'none' && livePlan.perOrderFeeAmount > 0 && (
 <div className="flex items-center gap-2 text-sm text-amber-400">
 {tSub('siparis_basi') || 'Sipariş başı:'} {livePlan.perOrderFeeType === 'percentage' ? `%${livePlan.perOrderFeeAmount}` : formatCurrency(livePlan.perOrderFeeAmount, livePlan.currency || business?.currency)}
 </div>
 )}
 </>
 ) : (
 <div className="flex justify-between items-center">
 <span className="text-gray-300">Provizyon Oranı</span>
 <span className="text-xl font-bold text-white">%5</span>
 </div>
 )}
 <hr className="border-amber-700/50" />
 {(() => {
 // Derive commission data from estimatedInvoice for consistency
 const commLine = estimatedInvoice?.lineItems?.find((item: any) => item.type === 'commission');
 const commOrderCount = commLine?.quantity || commissionSummary.orderCount;
 const commTotal = commLine?.total || commissionSummary.totalCommission;
 return (
 <>
 <div className="flex justify-between items-center">
 <span className="text-gray-300">
 {tAccount('bu_ay') || 'Bu Ay'} {tAccount('komisyon') || 'Komisyon'} ({commOrderCount} {tAccount('siparis') || 'sipariş'})
 </span>
 <span className="text-xl font-bold text-amber-400">{formatCurrency(commTotal, business?.currency)}</span>
 </div>
 <div className="grid grid-cols-2 gap-2 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-400">{tAccount('kart') || 'Kart'}</span>
 <span className="text-blue-400">{formatCurrency(commissionSummary.cardCommission, business?.currency)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-400">{tAccount('nakit') || 'Nakit'}</span>
 <span className="text-purple-400">{formatCurrency(commissionSummary.cashCommission, business?.currency)}</span>
 </div>
 </div>
 </>
 );
 })()}
 {(business?.accountBalance || 0) > 0 && (
 <div className="bg-red-900/40 border border-red-600/40 rounded-lg p-3 flex justify-between items-center">
 <span className="text-red-300 text-sm">{tAccount('acik_bakiye') || 'Açık Bakiye'}</span>
 <span className="text-xl font-bold text-red-400">{formatCurrency((business?.accountBalance || 0), business?.currency)}</span>
 </div>
 )}
 </div>
 </div>

 {/* Tahmini Fatura Önizleme */}
 <div className="bg-indigo-900/30 border border-indigo-600/40 rounded-xl p-6">
 <h3 className="text-lg font-bold text-indigo-200 mb-4 flex items-center gap-2">
 {tAccount('tahmini_guncel_fatura') || 'Güncel Tahmini Fatura (Bu Ay)'}
 </h3>
 {estimatedInvoice ? (
 <div className="space-y-2">
 {estimatedInvoice.lineItems?.map((item: any, i: number) => (
 <div key={i} className="flex justify-between text-sm">
 <span className="text-gray-300">{item.description}</span>
 <span className="text-white font-medium">{formatCurrency(item.total, estimatedInvoice.currency || business?.currency)}</span>
 </div>
 ))}
 <hr className="border-indigo-700/50" />
 <div className="flex justify-between">
 <span className="text-gray-300">{tAccount('ara_toplam') || 'Ara Toplam'}</span>
 <span className="text-white font-bold">{formatCurrency(estimatedInvoice.subtotal, estimatedInvoice.currency || business?.currency)}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-gray-400">{tAccount('kdv') || 'KDV'} (%{estimatedInvoice.taxRate})</span>
 <span className="text-gray-300">{formatCurrency(estimatedInvoice.tax, estimatedInvoice.currency || business?.currency)}</span>
 </div>
 <div className="flex justify-between pt-2 border-t border-indigo-700/50">
 <span className="text-lg font-bold text-white">{tAccount('toplam') || 'TOPLAM'}</span>
 <span className="text-2xl font-bold text-indigo-400">{formatCurrency(estimatedInvoice.total, estimatedInvoice.currency || business?.currency)}</span>
 </div>
 </div>
 ) : (
 <div className="text-center py-4">
 <p className="text-gray-400">{tAccount('henuz_fatura_yok') || 'Bu ay henüz işlem yok'}</p>
 <p className="text-3xl font-bold text-indigo-400 mt-2">{formatCurrency(0, business?.currency)}</p>
 </div>
 )}
 </div>
 </div>

  </div>
  )}

  {activeTab === 'subscription' && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
    <AbonelikTabContent
      business={business}
      availablePlans={allPlans}
      admin={admin}
      t={tSub}
      showToast={(msg: string) => alert(msg)}
      setBusiness={setBusiness}
      onNavigateToHardware={() => setActiveTab('hardware')}
    />
  </div>
  )}

  {activeTab === 'hardware' && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 mt-6">
    <HardwareTabContent
      business={business}
      admin={admin}
      showToast={(msg: string, type: 'success' | 'error' | 'info') => {
        if (type === 'error') {
          console.error(msg);
          alert(msg);
        } else {
          alert(msg);
        }
      }}
    />
  </div>
  )}

  {activeTab === 'billing' && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">

 {/* ═══════════════════════════════════════════════════════════════════
 STRIPE CONNECT - BANKA HESABI
 ═══════════════════════════════════════════════════════════════════ */}
 <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/40 rounded-xl p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-white flex items-center gap-2">
 {tAccount('odeme_alma_stripe') || 'Ödeme Alma - Stripe Connect'}
 </h3>
 {business?.stripeAccountStatus === 'active' && (
 <span className="px-3 py-1 bg-green-500/30 text-green-300 text-sm rounded-full">
 ✓ {tSub('rc_aktif') || 'Aktif'}
 </span>
 )}
 </div>

 {business?.stripeAccountId && business?.stripeAccountStatus === 'active' ? (
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-background/5 rounded-lg p-4">
 <p className="text-gray-400 text-xs mb-1">{tAccount('hesap_id') || 'Hesap ID'}</p>
 <p className="text-white font-mono">{business.stripeAccountId}</p>
 </div>
 <div className="bg-background/5 rounded-lg p-4">
 <p className="text-gray-400 text-xs mb-1">{tAccount('durum') || 'Durum'}</p>
 <p className="text-green-400 font-semibold">{tAccount('stripe_bagli') || 'Ödemeler Aktif'}</p>
 </div>
 </div>
 <p className="text-gray-400 text-sm">
 {tAccount('stripe_aciklama') || 'Müşterilerden online ödeme alabilir, kazançlarınız otomatik olarak banka hesabınıza aktarılır.'}
 </p>
 </div>
 ) : business?.stripeAccountId && business?.stripeAccountStatus === 'pending' ? (
 <div className="text-center py-4">
 <p className="text-yellow-200 font-semibold">{tSub('bekleyen') || 'Doğrulama Bekliyor'}</p>
 <p className="text-gray-400 text-sm mt-2">
 {tAccount('stripe_aciklama') || 'Stripe hesabınız oluşturuldu. Banka bilgilerinizi tamamlayın.'}
 </p>
 <button
 onClick={async () => {
 try {
 const res = await fetch('/api/stripe-connect', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 businessId: business.id,
 email: admin?.email || business.email,
 businessName: business.companyName || business.brand || 'İşletme',
 })
 });
 const data = await res.json();
 if (data.onboardingUrl) {
 window.location.href = data.onboardingUrl;
 }
 } catch (err) {
 console.error('Stripe Connect error:', err);
 }
 }}
 className="mt-4 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium"
 >
 {tSub('kaydet') || 'Doğrulamayı Tamamla'}
 </button>
 </div>
 ) : (
 <div className="text-center py-6">
 <h4 className="text-xl font-bold text-white mb-2">{tAccount('odeme_alma_stripe') || 'Online Ödeme Almaya Başlayın'}</h4>
 <p className="text-gray-400 mb-6 max-w-md mx-auto">
 {tAccount('stripe_aciklama') || 'Stripe ile banka hesabınızı bağlayın. Müşterilerinizden güvenli online ödeme alın, kazançlarınız otomatik olarak hesabınıza aktarılsın.'}
 </p>
 <div className="flex flex-col sm:flex-row gap-3 justify-center">
 <button
 onClick={async () => {
 try {
 setSaving(true);
 const res = await fetch('/api/stripe-connect', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 businessId: business?.id,
 email: admin?.email || business?.email,
 businessName: business?.companyName || business?.brand || 'İşletme',
 })
 });
 const data = await res.json();
 if (data.onboardingUrl) {
 window.location.href = data.onboardingUrl;
 } else {
 alert(data.error || 'Bir hata oluştu');
 }
 } catch (err) {
 console.error('Stripe Connect error:', err);
 alert('Bağlantı hatası');
 } finally {
 setSaving(false);
 }
 }}
 disabled={saving}
 className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50"
 >
 {saving ? `${tSub('kaydediliyor') || 'Bağlanıyor'}...` : (tAccount('stripe_olustur_bagla') || 'Stripe ile Banka Bağla')}
 </button>
 </div>
 <p className="text-muted-foreground/80 text-xs mt-4">
 {tSub('guvenlik_notu') || '256-bit SSL şifrelemesi ile güvende. Stripe altyapısı.'}
 </p>
 </div>
 )}
 </div>

 {/* ═══════════════════════════════════════════════════════════════════
        FATURALAR
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-card/80 to-card border border-border/40 rounded-xl p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{tAccount('aylik_fatura_gecmisi') || 'Faturalar & Ödemeler'}</h3>
          </div>

          <BusinessInvoiceSection invoices={invoices} />
        </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
 BANKA BİLGİSİ MODAL
 ═══════════════════════════════════════════════════════════════════ */}
 {showBankModal && (
 <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
 <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
 <h2 className="text-xl font-bold text-white mb-4">{tAccount('banka_bilgileri') || 'Banka Bilgileri'}</h2>

 <div className="space-y-4">
 <div>
 <label className="block text-gray-400 text-sm mb-1">IBAN *</label>
 <input
 type="text"
 value={bankForm.iban}
 onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value.toUpperCase() })}
 className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
 placeholder="DE89 3704 0044 0532 0130 00"
 />
 </div>
 <div>
 <label className="block text-gray-400 text-sm mb-1">BIC / SWIFT</label>
 <input
 type="text"
 value={bankForm.bic}
 onChange={(e) => setBankForm({ ...bankForm, bic: e.target.value.toUpperCase() })}
 className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 font-mono"
 placeholder="COBADEFFXXX"
 />
 </div>
 <div>
 <label className="block text-gray-400 text-sm mb-1">Hesap Sahibi *</label>
 <input
 type="text"
 value={bankForm.accountHolder}
 onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
 placeholder="Firma GmbH"
 />
 </div>
 <div>
 <label className="block text-gray-400 text-sm mb-1">Banka Adı</label>
 <input
 type="text"
 value={bankForm.bankName}
 onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
 className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600"
 placeholder="Commerzbank"
 />
 </div>
 </div>

 <div className="flex gap-3 mt-6">
 <button
 onClick={() => setShowBankModal(false)}
 className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
 >
 İptal
 </button>
 <button
 onClick={handleSaveBank}
 disabled={saving || !bankForm.iban || !bankForm.accountHolder}
 className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
 >
 {saving ? `${tSub('kaydediliyor') || 'Kaydediliyor'}...` : (tSub('kaydet') || 'Kaydet')}
 </button>
 </div>
 </div>
 </div>
 )}

  </div>
  );
}