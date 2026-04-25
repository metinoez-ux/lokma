"use client";

import { useState } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, Info, Clock } from "lucide-react";

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

  // Group plans
  const freePlans = availablePlans.filter((p: any) => p.monthlyFee === 0 || p.code === 'free');
  const paidPlans = availablePlans.filter((p: any) => p.monthlyFee > 0 && p.code !== 'free');

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
      
      showToast(t('plan_degisikligi_onaylandi') || 'Plan değişikliği başarıyla alındı.', 'success');
      
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

  const renderFeatures = (plan: any) => {
    if (!plan.features) return null;
    const featureKeys = Object.keys(plan.features).filter(k => plan.features[k] === true);
    
    return <PlanFeaturesList featureKeys={featureKeys} t={t} />;
  };

  return (
    <div className="space-y-8 pt-4 border-t border-border mt-4">
      
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
                {t('yeni_plan_gecis_tarihi') || 'Yeni planınız'} <strong className="text-foreground">{pendingPlan.name}</strong>, {planTransitionDate.toLocaleDateString('de-DE')} {t('tarihinde_aktif_olacak') || 'tarihinde aktif olacak.'}
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
              <p className="text-muted-foreground text-sm">{currentPlan ? formatMoney(currentPlan.monthlyFee, currentPlan.currency) : '€0,00'} /ay</p>
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
                {formatMoney(availablePlans.find((p:any) => p.code === selectedPlanCode)?.monthlyFee || 0, 'EUR')} /ay
              </p>
            </div>
          </div>

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
                      {formatMoney(plan.monthlyFee, plan.currency)} <span className="text-lg text-muted-foreground font-medium">/ay</span>
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
                      {formatMoney(plan.monthlyFee, plan.currency)}
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

// Sub-component for features list with "Show More" functionality
function PlanFeaturesList({ featureKeys, t }: { featureKeys: string[], t: any }) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_LIMIT = 8;
  
  const displayKeys = expanded ? featureKeys : featureKeys.slice(0, INITIAL_LIMIT);
  const hasMore = featureKeys.length > INITIAL_LIMIT;

  return (
    <div className="space-y-2.5">
      {displayKeys.map(key => (
        <div key={key} className="flex items-start gap-2">
          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          <span className="text-sm text-foreground/90">
            {t(`feature_${key}`) || key}
          </span>
        </div>
      ))}
      
      {hasMore && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-blue-500 hover:text-blue-400 text-xs font-medium pt-2 w-full text-left flex items-center gap-1"
        >
          {expanded ? (t('daha_az_goster') || 'Daha Az Göster') : (t('tum_ozellikleri_goster', { count: featureKeys.length - INITIAL_LIMIT }) || `Tüm Özellikleri Göster (${featureKeys.length - INITIAL_LIMIT} daha)`)}
        </button>
      )}
    </div>
  );
}
