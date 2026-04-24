import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'r') as f:
    content = f.read()

target = """  <div className="flex-1 space-y-3 mb-6">
  )}
  {plan.productLimit && (
  <div className="flex items-start gap-2 text-sm">
  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
  <span className="text-foreground font-medium">{plan.productLimit}</span> <span className="text-muted-foreground">Ürün Ekleme</span>
  </div>
  )}
  
  {/* Dinamik Özellikler */}
  {plan.features && Object.entries(plan.features).map(([key, value]) => {
  // Sadece aktif (true) olan özellikleri gösterelim, SaaS tarzı temiz görünüm için
  if (value !== true && key !== 'maxStaff' && key !== 'hasApp') return null;
  
  return (
  <div key={key} className="flex items-start gap-2 text-sm">
  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
  <span className="text-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
  </div>
  );
  })}
  </div>"""

replacement = """  <div className="flex-1 space-y-3 mb-6">
  {/* Limit ve Ücretler */}
  <div className="bg-muted/30 p-4 rounded-xl space-y-3 mb-6 border border-border/50">
  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('limitsAndFees') || 'Limitler ve Ücretler'}</h5>
  
  <div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{t('orderLimit') || 'Sipariş Limiti'}:</span>
  <span className="font-semibold text-foreground">{plan.orderLimit === null ? 'Sınırsız' : plan.orderLimit}</span>
  </div>
  
  {(plan.orderOverageFee || 0) > 0 && (
  <div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{t('orderOverageFee') || 'Aşım Ücreti (Sipariş)'}:</span>
  <span className="font-semibold text-amber-500">€{plan.orderOverageFee!.toFixed(2)}</span>
  </div>
  )}

  <div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{t('productLimit') || 'Ürün Limiti'}:</span>
  <span className="font-semibold text-foreground">{plan.productLimit === null ? 'Sınırsız' : plan.productLimit}</span>
  </div>

  {(plan.personnelLimit !== undefined || plan.staffLimit !== undefined) && (
  <div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{t('personnelLimit') || 'Personel Limiti'}:</span>
  <span className="font-semibold text-foreground">{(plan.personnelLimit ?? plan.staffLimit) === null ? 'Sınırsız' : (plan.personnelLimit ?? plan.staffLimit)}</span>
  </div>
  )}
  
  {((plan.personnelOverageFee ?? plan.staffOverageFee ?? 0) > 0) && (
  <div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{t('personnelOverageFee') || 'Aşım Ücreti (Personel)'}:</span>
  <span className="font-semibold text-amber-500">€{(plan.personnelOverageFee ?? plan.staffOverageFee ?? 0).toFixed(2)}</span>
  </div>
  )}
  
  {((plan.perOrderFeeAmount ?? 0) > 0) && (
  <div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{t('perOrderFee') || 'Sipariş Başına Ücret'}:</span>
  <span className="font-semibold text-amber-500">€{plan.perOrderFeeAmount!.toFixed(2)}</span>
  </div>
  )}
  </div>

  {/* Dinamik Özellikler */}
  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 mt-4">{t('includedFeatures') || 'Dahil Olan Özellikler'}</h5>
  <div className="space-y-3">
  {plan.features && Object.entries(plan.features).map(([key, value]) => {
  // Sadece aktif (true) olan özellikleri gösterelim, SaaS tarzı temiz görünüm için
  if (value !== true && key !== 'maxStaff' && key !== 'hasApp') return null;
  
  // T() fonksiyonu ile dinamik dil desteği.
  const fallbackLabel = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  const label = t(`feature_${key}`) || fallbackLabel;

  return (
  <div key={key} className="flex items-start gap-2 text-sm">
  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
  <span className="text-foreground font-medium">{label}</span>
  </div>
  );
  })}
  </div>
  </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found. Let me print a small excerpt:")
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if "Dinamik Özellikler" in line:
            for j in range(i-10, i+15):
                print(f"{j+1}: {lines[j]}")
