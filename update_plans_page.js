const fs = require('fs');
const file = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split('\n');

// 1. Remove Masa Rezervasyonu from Limitler & Hizmet Şartları
// Lines 669 to 748 are indices 668 to 747.
const masaRezervasyonuStart = lines.findIndex(l => l.includes('{/* Masa Rezervasyonu */}'));
if (masaRezervasyonuStart !== -1) {
  // Let's find the end. It's an 80-line block.
  // We can just find the closing </div> of <div className="col-span-2">
  let openDivs = 0;
  let endIdx = -1;
  for (let i = masaRezervasyonuStart + 1; i < lines.length; i++) {
    if (lines[i].includes('<div')) openDivs += (lines[i].match(/<div/g) || []).length;
    if (lines[i].includes('</div')) openDivs -= (lines[i].match(/<\/div/g) || []).length;
    if (openDivs === 0 && lines[i].includes('</div>')) {
      endIdx = i;
      break;
    }
  }
  
  if (endIdx !== -1) {
    console.log(`Found Masa Rezervasyonu from ${masaRezervasyonuStart} to ${endIdx}`);
    lines.splice(masaRezervasyonuStart, endIdx - masaRezervasyonuStart + 1);
  }
}

// 2. Remove table features from Plan Özellikleri
const dineInIdx = lines.findIndex(l => l.includes("key: 'dineInQR'"));
if (dineInIdx !== -1) lines.splice(dineInIdx, 1);
const waiterIdx = lines.findIndex(l => l.includes("key: 'waiterOrder'"));
if (waiterIdx !== -1) lines.splice(waiterIdx, 1);
const groupTableIdx = lines.findIndex(l => l.includes("key: 'groupOrderTable'"));
if (groupTableIdx !== -1) lines.splice(groupTableIdx, 1);

// 3. Insert new Masa & Rezervasyon Modülü before Plan Durumu - Basitleştirilmiş
const planDurumuIdx = lines.findIndex(l => l.includes('{/* Plan Durumu - Basitleştirilmiş */}'));
if (planDurumuIdx !== -1) {
  const newCard = `
  {/* 4. Masa & Rezervasyon Modülü */}
  <div className="bg-card/50 p-5 rounded-xl border border-border/50">
    <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-pink-500 rounded-full"></span>
      🍽️ Masa & Rezervasyon
    </h3>
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">
        {/* Masada Sipariş (QR Kod) */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={(formData.features as any)?.dineInQR || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, dineInQR: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-amber-800 dark:text-amber-400 group-hover:text-white transition-colors">{t('masada_siparis_qr_kod')}</span>
        </label>

        {/* Garson Siparişi */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={(formData.features as any)?.waiterOrder || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, waiterOrder: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-teal-400 group-hover:text-white transition-colors">{t('garson_siparis')}</span>
        </label>

        {/* Masada Grup Siparişi */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={(formData.features as any)?.groupOrderTable || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, groupOrderTable: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-orange-800 dark:text-orange-400 group-hover:text-white transition-colors">🪑 Masada Grup Siparişi</span>
        </label>

        {/* Masa Rezervasyonu Sistemi */}
        <label className="flex items-center p-3 rounded-lg bg-background border border-border hover:border-gray-600 transition-all cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={formData.features?.tableReservation || false}
              onChange={e => setFormData({ ...formData, features: { ...formData.features!, tableReservation: e.target.checked } })}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
          </div>
          <span className="ml-3 text-sm font-medium text-pink-800 dark:text-pink-400 group-hover:text-white transition-colors">Masa Rezervasyonu Sistemi</span>
        </label>
      </div>

      {formData.features?.tableReservation && (
        <div className="bg-background/50 p-4 rounded-xl border border-pink-900/30">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fiyatlandırma Modeli (Sektör Standardı)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['free', 'per_cover', 'per_reservation'] as const).map(model => (
                <button
                  key={model}
                  type="button"
                  onClick={() => setFormData({ ...formData, tableReservationModel: model } as any)}
                  className={\`px-3 py-2 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 \${(formData as any).tableReservationModel === model || (model === 'free' && !(formData as any).tableReservationModel) ? 'bg-pink-600 text-white shadow-md' : 'bg-card text-muted-foreground border border-border hover:bg-pink-900/20'}\`}
                >
                  {model === 'free' ? 'Ücretsiz (Sabit)' : model === 'per_cover' ? 'Kişi Başı Ücret' : 'Masa Başı Ücret'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {\`\${((formData as any).tableReservationModel || 'free') === 'free' ? 'Rezervasyonlar işletme planına dahildir, ekstra komisyon alınmaz.' : ((formData as any).tableReservationModel === 'per_cover' ? 'OpenTable ve TheFork standardı; rezerve edilen her misafir (cover) başına ücret alınır.' : 'Misafir sayısından bağımsız, oluşturulan her masa rezervasyonu için sabit ücret alınır.')}\`}
            </p>
          </div>

          {((formData as any).tableReservationModel === 'per_cover' || (formData as any).tableReservationModel === 'per_reservation') && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 mt-4">
              <div>
                <label className="block text-xs text-muted-foreground/80 mb-1.5">Ücret Tutarı ({globalFormatCurrency(0, formData.currency || 'EUR').replace(/[\\d.,]/g, '')})</label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData as any).tableReservationFee ?? 0.50}
                  onChange={e => setFormData({ ...formData, tableReservationFee: parseFloat(e.target.value) || 0 } as any)}
                  className="w-full bg-card border border-pink-900/40 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
                  placeholder="0.50"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground/80 mb-1.5">Aylık Ücretsiz Kota</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={(formData as any).tableReservationFreeQuota === null ? '' : ((formData as any).tableReservationFreeQuota ?? 0)}
                    onChange={e => setFormData({ ...formData, tableReservationFreeQuota: e.target.value ? parseInt(e.target.value) : null } as any)}
                    disabled={(formData as any).tableReservationFreeQuota === null}
                    className="flex-1 bg-card border border-pink-900/40 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-lg px-3 py-2 text-foreground text-sm disabled:opacity-50 transition-colors"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, tableReservationFreeQuota: (p as any).tableReservationFreeQuota === null ? 0 : null } as any))}
                    className={\`px-4 py-2 rounded-lg border text-xs font-bold transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 \${(formData as any).tableReservationFreeQuota === null ? 'bg-pink-600 border-pink-500 text-white' : 'bg-card border-gray-600 text-muted-foreground'}\`}
                  >
                    ∞
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">İlk X {(formData as any).tableReservationModel === 'per_cover' ? 'kişi' : 'rezervasyon'} ücretsiz.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>\n`;

  lines.splice(planDurumuIdx, 0, newCard);
  console.log("Inserted new Masa & Rezervasyon card");
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log("File updated successfully.");
