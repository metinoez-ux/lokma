"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, Info, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AbonelikTabContent({
  business,
  formData,
  setFormData,
  availablePlans,
  admin,
  t,
  showToast,
  setBusiness,
}: any) {
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{planName: string, date: Date} | null>(null);
  const [eslSelections, setEslSelections] = useState<Record<string, { quantity: number, mode: 'rent' | 'buy' }>>({});

  useEffect(() => {
    setEslSelections({});
  }, [selectedPlanCode]);

  const handleEslQuantityChange = (model: string, quantity: number, mode: 'rent' | 'buy') => {
    if (quantity <= 0) {
      const newSelections = { ...eslSelections };
      delete newSelections[model];
      setEslSelections(newSelections);
    } else {
      setEslSelections(prev => ({
        ...prev,
        [model]: { quantity, mode }
      }));
    }
  };

  const tBiz = useTranslations('AdminBusiness');

  const currentPlanCode = business?.subscriptionPlan || "free";
  const currentPlan = availablePlans.find((p: any) => p.code === currentPlanCode);

  const pendingPlanCode = business?.pendingPlanChange;
  const pendingPlan = availablePlans.find((p: any) => p.code === pendingPlanCode);
  const planTransitionDate = business?.planTransitionDate?.toDate 
    ? business.planTransitionDate.toDate() 
    : business?.planTransitionDate ? new Date(business.planTransitionDate) : null;

  const canChangePlan = admin?.adminType === 'admin' || admin?.adminType === 'super' || admin?.adminType === 'lokma_admin';

  // Formatting currency
  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  };

  const calculateTotalMonthlyFee = (plan: any) => {
    if (!plan) return 0;
    return plan.monthlyFee || 0;
  };

  // Group plans
  const freePlans = availablePlans.filter((p: any) => calculateTotalMonthlyFee(p) === 0 || p.code === 'free');
  const paidPlans = availablePlans.filter((p: any) => calculateTotalMonthlyFee(p) > 0 && p.code !== 'free');

  const getNextMonthFirstDay = () => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 1);
  };

  const handleConfirmChange = async () => {
    if (!selectedPlanCode || !agbAccepted || !business?.id) return;
    setSaving(true);
    try {
      const nextMonth = getNextMonthFirstDay();
      await updateDoc(doc(db, 'businesses', business.id), {
        pendingPlanChange: selectedPlanCode,
        planTransitionDate: Timestamp.fromDate(nextMonth),
      });
      
      const newPlan = availablePlans.find((p: any) => p.code === selectedPlanCode);
      setSuccessModalData({
        planName: newPlan?.name || selectedPlanCode,
        date: nextMonth
      });
      
      setBusiness((prev: any) => prev ? { 
        ...prev, 
        pendingPlanChange: selectedPlanCode,
        planTransitionDate: Timestamp.fromDate(nextMonth) 
      } : prev);
      
      setSelectedPlanCode(null);
      setAgbAccepted(false);
    } catch (err: any) {
      console.error('Plan update error:', err);
      showToast((t('hata_olustu') || 'Hata:') + ' ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPending = async () => {
    if (!business?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        pendingPlanChange: null,
        planTransitionDate: null,
      });
      showToast(t('plan_degisikligi_iptal_edildi') || 'Bekleyen plan değişikliği iptal edildi.', 'success');
      setBusiness((prev: any) => prev ? { 
        ...prev, 
        pendingPlanChange: null,
        planTransitionDate: null 
      } : prev);
    } catch (err: any) {
      console.error('Plan update error:', err);
      showToast((t('hata_olustu') || 'Hata:') + ' ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  
  const MASTER_FEATURE_ORDER = [
    'posSystem',
    'courierApp',
    'liveCourierTracking',
    'kitchenDisplaySystem',
    'qrOrdering',
    'clickAndCollect',
    'delivery',
    'onlinePayment',
    'staffShiftTracking',
    'smartScale',
    'scaleIntegration',
    'posIntegration',
    'accountingIntegration',
    'marketing',
    'marketingTools',
    'campaigns',
    'promotions',
    'couponSystem',
    'referralSystem',
    'firstOrderDiscount',
    'loyaltyProgram',
    'donationRoundUp',
    'sponsoredProducts',
    'advancedAnalytics',
    'customBranding',
    'apiAccess',
    'prioritySupport',
    'unlimitedProducts',
    'basicStatsOnly'
  ];

  const globalFeatureKeys = Array.from(
    new Set(
      availablePlans.flatMap((p: any) => 
        p.features ? Object.keys(p.features).filter(k => p.features[k] === true) : []
      )
    )
  ) as string[];

  globalFeatureKeys.sort((a, b) => {
    let indexA = MASTER_FEATURE_ORDER.indexOf(a);
    let indexB = MASTER_FEATURE_ORDER.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });
  
  const renderFeatures = (plan: any) => {
    return <PlanFeaturesList globalKeys={globalFeatureKeys} planFeatures={plan?.features || {}} t={tBiz} />;
  };

  const renderHardwarePricing = (plan: any) => {
    if (!plan.features?.eslIntegration || !plan.eslPackages || plan.eslPackages.length === 0) return null;
    
    return (
      <div className="mb-4 pb-3 border-b border-border/50">
        <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
          ESL Donanım Fiyatları (Netto)
        </h5>
        
        {plan.eslSystemMonthlyFee > 0 && (
          <div className="mb-2 text-[10px] text-indigo-200 bg-indigo-900/30 p-1.5 rounded border border-indigo-500/20 flex justify-between items-center">
            <span>Sistem & Ağ Geçidi (Gateway) Ücreti:</span>
            <strong className="text-white">€{plan.eslSystemMonthlyFee.toFixed(2)}/ay</strong>
          </div>
        )}

        <div className="space-y-1.5">
          {plan.eslPackages.map((pkg: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs bg-indigo-900/10 border border-indigo-500/20 px-2 py-1.5 rounded-md">
              <span className="text-indigo-100 font-medium">{pkg.model}</span>
              <div className="text-right">
                <span className="text-muted-foreground mr-2 text-[10px]">Alış: <strong className="text-foreground text-xs">€{pkg.purchasePrice?.toFixed(2)}</strong></span>
                <span className="text-muted-foreground text-[10px]">Kira: <strong className="text-foreground text-xs">€{pkg.rentalPrice?.toFixed(2)}</strong>/ay</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pt-4 border-t border-border mt-4">
      
      {/* Success Modal */}
      {successModalData && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-green-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-green-500/20 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-foreground text-center mb-3">
              {t('tebrikler') || 'Tebrikler!'}
            </h3>
            <p className="text-muted-foreground text-center mb-8 leading-relaxed text-sm">
              {t('abonelik_degisikligi_alindi') || 'Abonelik değişikliği talebiniz başarıyla alınmıştır.'} <br/><br/>
              Yeni <strong className="text-foreground text-base">{successModalData.planName}</strong> planınız <strong className="text-foreground text-base">{successModalData.date.toLocaleDateString('de-DE')}</strong> tarihinde aktif olacaktır. <br/><br/>
              Bizi tercih ettiğiniz için teşekkür eder, işletmenizde başarılar dileriz!
            </p>
            <button
              onClick={() => setSuccessModalData(null)}
              className="w-full py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-green-600/30"
            >
              {t('tamam') || 'Tamam'}
            </button>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex items-center justify-between">
        <h4 className="text-foreground font-bold text-2xl">{t('uyelikAbonelik') || 'Üyelik & Abonelik'}</h4>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{t('mevcut_plan') || 'Mevcut Plan:'}</span>
          <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-muted border border-border text-foreground">
            {currentPlan?.name || currentPlanCode.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Pending Change Banner */}
      {pendingPlanCode && pendingPlan && planTransitionDate && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-amber-500 font-bold">{t('bekleyen_plan_degisikligi') || 'Bekleyen Plan Değişikliği'}</h5>
              <p className="text-muted-foreground text-sm mt-1">
                {t('yeni_plan_gecis_tarihi') || 'Yeni planınız'} <strong className="text-foreground">{pendingPlan.name}</strong> 
                <span className="mx-2 text-muted-foreground">—</span>
                <strong className="text-foreground">{planTransitionDate.toLocaleDateString('de-DE')}</strong>
              </p>
            </div>
          </div>
          {canChangePlan && (
            <button 
              onClick={handleCancelPending}
              disabled={saving}
              className="shrink-0 px-4 py-2 bg-card border border-border hover:bg-red-500/10 hover:text-red-500 text-muted-foreground text-sm font-medium rounded-lg transition"
            >
              {t('degisikligi_iptal_et') || 'Değişikliği İptal Et'}
            </button>
          )}
        </div>
      )}

      {/* Selected Plan Action Card */}
      {selectedPlanCode && selectedPlanCode !== currentPlanCode && selectedPlanCode !== pendingPlanCode && canChangePlan && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 space-y-4 animate-in slide-in-from-bottom-4">
          <h5 className="text-blue-400 font-bold text-lg">{t('yeni_plan_onayi') || 'Yeni Plan Onayı'}</h5>
          
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-background/50 rounded-lg p-4 border border-border">
              <p className="text-muted-foreground text-xs uppercase font-semibold">{t('mevcut_plan') || 'Mevcut Plan'}</p>
              <p className="text-foreground font-bold text-xl mt-1">{currentPlan?.name || currentPlanCode}</p>
              <p className="text-muted-foreground text-sm">{currentPlan ? formatMoney(calculateTotalMonthlyFee(currentPlan), currentPlan.currency) : '€0,00'} /ay</p>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-2xl text-muted-foreground">→</span>
            </div>
            <div className="flex-1 bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
              <p className="text-blue-400/80 text-xs uppercase font-semibold">{t('yeni_plan') || 'Yeni Plan'}</p>
              <p className="text-blue-400 font-bold text-xl mt-1">
                {availablePlans.find((p:any) => p.code === selectedPlanCode)?.name}
              </p>
              <p className="text-blue-400/80 text-sm">
                {formatMoney(calculateTotalMonthlyFee(availablePlans.find((p:any) => p.code === selectedPlanCode)), 'EUR')} /ay
              </p>
            </div>
          </div>

          {availablePlans.find((p:any) => p.code === selectedPlanCode)?.features?.eslIntegration && availablePlans.find((p:any) => p.code === selectedPlanCode)?.eslPackages?.length > 0 && (
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4">
              <h6 className="text-indigo-400 font-bold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                ESL Donanım Hesaplayıcı (Opsiyonel)
              </h6>
              <p className="text-xs text-muted-foreground mb-4">
                Yeni planınız ESL Elektronik Fiyat Etiketi entegrasyonu sunmaktadır. İsteğe bağlı olarak donanım ihtiyacınızı hesaplayabilir ve siparişinizi Hardware Store üzerinden tamamlayabilirsiniz.
              </p>

              <div className="space-y-3">
                {availablePlans.find((p:any) => p.code === selectedPlanCode).eslPackages.map((pkg: any) => {
                  const sel = eslSelections[pkg.model] || { quantity: 0, mode: 'buy' };
                  return (
                    <div key={pkg.model} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-background/50 p-3 rounded-lg border border-border">
                      <div className="flex-1 min-w-[120px]">
                        <p className="font-semibold text-foreground text-sm">{pkg.model}</p>
                        <p className="text-[10px] text-muted-foreground">Alış: €{pkg.price}/adet | Kira: €{pkg.monthlyRent}/ay</p>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <select 
                          value={sel.mode}
                          onChange={(e) => handleEslQuantityChange(pkg.model, sel.quantity, e.target.value as 'rent' | 'buy')}
                          className="bg-card border border-border rounded text-xs px-2 py-1.5 focus:ring-1 focus:ring-blue-500 text-foreground"
                        >
                          <option value="buy">Satın Al</option>
                          <option value="rent">Kirala</option>
                        </select>
                        
                        <div className="flex items-center border border-border rounded bg-card">
                          <button 
                            type="button"
                            onClick={() => handleEslQuantityChange(pkg.model, Math.max(0, sel.quantity - 1), sel.mode)}
                            className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-white/5"
                          >-</button>
                          <input 
                            type="number"
                            min="0"
                            value={sel.quantity}
                            onChange={(e) => handleEslQuantityChange(pkg.model, parseInt(e.target.value) || 0, sel.mode)}
                            className="w-12 text-center bg-transparent text-sm border-x border-border focus:outline-none"
                          />
                          <button 
                            type="button"
                            onClick={() => handleEslQuantityChange(pkg.model, sel.quantity + 1, sel.mode)}
                            className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-white/5"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.keys(eslSelections).length > 0 && (() => {
                const newPlan = availablePlans.find((p:any) => p.code === selectedPlanCode);
                const totalBuy = Object.entries(eslSelections).reduce((sum, [model, sel]) => {
                  if (sel.mode !== 'buy') return sum;
                  const pkg = newPlan.eslPackages.find((p:any) => p.model === model);
                  return sum + (pkg ? pkg.price * sel.quantity : 0);
                }, 0);
                
                const totalRent = Object.entries(eslSelections).reduce((sum, [model, sel]) => {
                  if (sel.mode !== 'rent') return sum;
                  const pkg = newPlan.eslPackages.find((p:any) => p.model === model);
                  return sum + (pkg ? pkg.monthlyRent * sel.quantity : 0);
                }, 0);

                const hasEslItems = totalBuy > 0 || totalRent > 0;

                return (
                  <div className="mt-4 pt-4 border-t border-indigo-500/20">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-muted-foreground">Donanım Satın Alma Toplamı (Bir Seferlik):</span>
                      <span className="font-semibold text-foreground">€{totalBuy.toFixed(2)}</span>
                    </div>
                    {hasEslItems && newPlan.eslSystemMonthlyFee > 0 && (
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-muted-foreground">ESL Gateway & SaaS Ücreti:</span>
                        <span className="font-semibold text-indigo-300">€{newPlan.eslSystemMonthlyFee.toFixed(2)} /ay</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm mb-3">
                      <span className="text-muted-foreground">Donanım Kiralama Toplamı:</span>
                      <span className="font-semibold text-indigo-300">€{totalRent.toFixed(2)} /ay</span>
                    </div>
                    
                    <div className="bg-indigo-500/20 text-indigo-200 text-xs p-3 rounded flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        Bu bir hesaplama aracıdır. Donanım siparişinizi tamamlamak için plan onayından sonra <a href="#" onClick={(e) => { e.preventDefault(); showToast("Hardware Store modülü yakında eklenecektir.", "info"); }} className="underline font-bold hover:text-white transition-colors">Donanım Mağazasını (Hardware Store)</a> ziyaret ediniz.
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="pt-1">
                <input 
                  type="checkbox" 
                  checked={agbAccepted}
                  onChange={(e) => setAgbAccepted(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 bg-background accent-blue-500 focus:ring-blue-500"
                />
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                {t('plan_kabul_metni') || `Bu planı yeni aylık planım olarak seçiyorum. Plan değişikliğinin önümüzdeki ayın 1'inde (${getNextMonthFirstDay().toLocaleDateString('de-DE')}) yürürlüğe gireceğini anlıyor, AGB (Genel Hüküm ve Koşullar) ve cayma hakkı metinlerini okuyup kabul ediyorum.`}
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => { setSelectedPlanCode(null); setAgbAccepted(false); }}
              className="flex-1 py-3 bg-muted hover:bg-gray-700 text-foreground rounded-xl font-medium transition"
            >
              {t('iptal') || 'İptal'}
            </button>
            <button 
              onClick={handleConfirmChange}
              disabled={!agbAccepted || saving}
              className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl font-bold transition shadow-lg shadow-blue-500/20"
            >
              {saving ? (t('isleniyor') || 'İşleniyor...') : (t('satin_almayi_onayla') || 'Satın Almayı Onayla')}
            </button>
          </div>
        </div>
      )}

      {/* Free Plans (Promo Style) */}
      {freePlans.length > 0 && (
        <div className="space-y-4">
          {freePlans.map((plan: any) => (
            <div key={plan.id} className="relative bg-gradient-to-br from-gray-900 to-background border border-gray-700 rounded-2xl p-1 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600" />
              <div className="bg-card/90 backdrop-blur rounded-xl p-6">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-foreground mb-2">{plan.name}</h3>
                    <p className="text-3xl font-black text-foreground mb-4">
                      {formatMoney(calculateTotalMonthlyFee(plan), plan.currency)} <span className="text-lg text-muted-foreground font-medium">/ay</span>
                    </p>
                    <p className="text-muted-foreground text-sm mb-6 max-w-md">{plan.description}</p>
                    
                    {currentPlanCode === plan.code ? (
                      <div className="inline-block px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-bold border border-gray-700">
                        {t('mevcut_planiniz') || 'Mevcut Planınız'}
                      </div>
                    ) : pendingPlanCode === plan.code ? (
                      <div className="inline-block px-4 py-2 bg-amber-500/20 text-amber-500 rounded-lg text-sm font-bold border border-amber-500/30">
                        {t('bekleyen_gecis') || 'Bekleyen Geçiş'}
                      </div>
                    ) : canChangePlan ? (
                      <button 
                        onClick={() => setSelectedPlanCode(plan.code)}
                        className="px-8 py-3 bg-foreground hover:bg-gray-200 text-background rounded-xl font-bold transition"
                      >
                        {t('bu_plani_sec') || 'Bu Planı Seç'}
                      </button>
                    ) : null}
                  </div>

                  {/* Right: Features */}
                  <div className="flex-1 bg-background/50 rounded-xl p-5 border border-border">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
                      {t('limitler_ve_ucretler') || 'Limitler ve Ücretler'}
                    </h4>
                    {renderHardwarePricing(plan)}
                    {renderFeatures(plan)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paid Plans (Side by Side) */}
      {paidPlans.length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(paidPlans.length, 3)} gap-6`}>
          {paidPlans.map((plan: any) => {
            const isCurrent = currentPlanCode === plan.code;
            const isPending = pendingPlanCode === plan.code;
            const isSelected = selectedPlanCode === plan.code;

            return (
              <div 
                key={plan.id} 
                className={`relative flex flex-col bg-card border rounded-2xl overflow-hidden transition-all duration-300 ${
                  plan.highlighted ? 'border-blue-500 shadow-xl shadow-blue-500/10 transform md:-translate-y-2' : 
                  isSelected ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-border hover:border-gray-600'
                }`}
              >
                {plan.highlighted && (
                  <div className="bg-blue-600 text-white text-xs font-bold text-center py-1 uppercase tracking-wider">
                    {t('en_populer') || 'En Popüler'}
                  </div>
                )}
                
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-black text-foreground">
                      {formatMoney(calculateTotalMonthlyFee(plan), plan.currency)}
                    </span>
                    <span className="text-muted-foreground text-sm font-medium"> /ay</span>
                  </div>
                  
                  <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                    {plan.description}
                  </p>

                  <div className="flex-1 bg-background/50 rounded-xl p-4 border border-border/50 mb-6">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 border-b border-border/50 pb-2">
                      {t('limitler_ve_ucretler') || 'Limitler ve Ücretler'}
                    </h4>
                    
                    {/* Key Limits Highlight */}
                    {(plan.orderLimit || plan.tableReservationLimit) && (
                      <div className="mb-3 space-y-2 pb-3 border-b border-border/50">
                        {plan.orderLimit && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-foreground"><strong className="font-bold">{plan.orderLimit}</strong> {t('siparis_limiti') || 'Sipariş Limiti'}</span>
                          </div>
                        )}
                        {plan.tableReservationLimit && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-foreground"><strong className="font-bold">{plan.tableReservationLimit}</strong> {t('masa_limiti') || 'Masa Limiti'}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {renderHardwarePricing(plan)}
                    {renderFeatures(plan)}
                  </div>

                  <div className="mt-auto">
                    {isCurrent ? (
                      <div className="w-full py-3 bg-gray-800 text-gray-300 rounded-xl text-sm font-bold border border-gray-700 text-center">
                        {t('mevcut_planiniz') || 'Mevcut Planınız'}
                      </div>
                    ) : isPending ? (
                      <div className="w-full py-3 bg-amber-500/20 text-amber-500 rounded-xl text-sm font-bold border border-amber-500/30 text-center">
                        {t('bekleyen_gecis') || 'Bekleyen Geçiş'}
                      </div>
                    ) : canChangePlan ? (
                      <button 
                        onClick={() => setSelectedPlanCode(plan.code)}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${
                          plan.highlighted 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                            : 'bg-muted hover:bg-gray-700 text-foreground'
                        }`}
                      >
                        {t('bu_plani_sec') || 'Bu Planı Seç'}
                      </button>
                    ) : (
                      <div className="w-full py-3 bg-muted text-muted-foreground rounded-xl text-sm text-center">
                        {t('yetkiniz_yok') || 'Yetkiniz Yok'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy Fallback if availablePlans is empty */}
      {availablePlans.length === 0 && (
        <div className="bg-card/50 border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">{t('planlar_yukleniyor') || 'Planlar yükleniyor veya bu sektör için plan bulunamadı.'}</p>
        </div>
      )}

    </div>
  );
}

// Sub-component for features list
function PlanFeaturesList({ globalKeys, planFeatures, t }: { globalKeys: string[], planFeatures: any, t: any }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_LIMIT = 8;
  
  const displayKeys = expanded ? globalKeys : globalKeys.slice(0, INITIAL_LIMIT);
  const hasMore = globalKeys.length > INITIAL_LIMIT;

  return (
    <div className="space-y-3">
      {displayKeys.map(key => {
        const hasFeature = planFeatures && planFeatures[key] === true;
        return (
          <div key={key} className={`flex items-center gap-3 ${hasFeature ? '' : 'opacity-40'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${hasFeature ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
              {hasFeature ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <div className="w-2 h-[2px] bg-gray-500 rounded-full" />
              )}
            </div>
            <span className={`text-sm ${hasFeature ? 'text-foreground/90 font-medium' : 'text-muted-foreground line-through decoration-muted-foreground/30'}`}>
              {t(`feature_${key}`) || key}
            </span>
          </div>
        );
      })}
      
      {hasMore && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-blue-500 hover:text-blue-400 text-xs font-medium pt-2 w-full text-left flex items-center gap-1"
        >
          {expanded ? (t('daha_az_goster') || 'Daha Az Göster') : (t('tum_ozellikleri_goster', { count: globalKeys.length - INITIAL_LIMIT }) || `Tüm Özellikleri Göster (${globalKeys.length - INITIAL_LIMIT} daha)`)}
        </button>
      )}
    </div>
  );
}
