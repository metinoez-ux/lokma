'use client';

import { useTranslations } from 'next-intl';

interface SubscriptionChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any; // the target plan
  currentPlanCode?: string;
  onConfirm: (planCode: string) => Promise<void>;
  saving: boolean;
}

export default function SubscriptionChangeModal({
  isOpen,
  onClose,
  plan,
  currentPlanCode,
  onConfirm,
  saving,
}: SubscriptionChangeModalProps) {
  const t = useTranslations('AdminBusiness');

  if (!isOpen || !plan) return null;

  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  const dateStr = date.toLocaleDateString('tr-TR');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-muted px-6 py-5 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            {t('abonelikPlani1')} - {t('degisiklik')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('planTransitionInfo')}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-background rounded-xl p-4 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('hedefPlan') || 'Hedef Plan'}: <span className="text-blue-500">{plan.name}</span>
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('aylikUcret')}:</span>
              <span className="font-bold text-foreground text-lg">
                {plan.monthlyFee === 0 ? t('free') : `€${plan.monthlyFee}`}
              </span>
            </div>
            {plan.orderLimit && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">{t('orderLimit')}:</span>
                <span className="font-medium text-foreground">{plan.orderLimit}</span>
              </div>
            )}
            {plan.personnelLimit && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">{t('personnelLimit')}:</span>
                <span className="font-medium text-foreground">{plan.personnelLimit}</span>
              </div>
            )}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-amber-500 font-semibold">{t('gecisTarihi') || 'Geçiş Tarihi'}</h4>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t('confirmPlanChange', { planName: plan.name })}
                <br />
                <span className="font-bold text-foreground inline-block mt-1">
                  ({dateStr} {t('dateWillBeActive') || 'tarihinden itibaren aktif olacak'})
                </span>
              </p>
            </div>
          </div>

          {/* B2B Terms agreement simulated */}
          <div className="text-xs text-muted-foreground leading-relaxed">
            * B2B koşulları gereği, abonelik plan değişiklikleri bir sonraki fatura döneminden (ayın 1'inden) itibaren geçerli olur. Onaylamanız halinde bu işlem geri alınamaz.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-background border border-transparent hover:border-border transition-colors disabled:opacity-50"
          >
            {t('iptal')}
          </button>
          <button
            onClick={() => onConfirm(plan.code)}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : null}
            {t('onayla')}
          </button>
        </div>
      </div>
    </div>
  );
}
