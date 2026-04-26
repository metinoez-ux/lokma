const fs = require('fs');
const path = 'src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const eslStart = '{(formData.features as any)?.eslIntegration && (';
const eslEndStr = 'Henüz paket eklenmedi';

// we need to find the specific block starting from eslStart
const eslIndex = content.indexOf(eslStart);
if (eslIndex === -1) {
  console.log("Not found");
  process.exit(1);
}

// Find the matching closing brace for the eslIntegration block
let braceCount = 0;
let endIndex = -1;
let inString = false;
let stringChar = null;

for (let i = eslIndex + eslStart.length; i < content.length; i++) {
  if (!inString) {
    if (content[i] === '{' || content[i] === '(') braceCount++;
    if (content[i] === '}' || content[i] === ')') braceCount--;
    
    if (content[i] === "'" || content[i] === '"' || content[i] === '`') {
      inString = true;
      stringChar = content[i];
    }
  } else {
    if (content[i] === stringChar && content[i-1] !== '\\') {
      inString = false;
      stringChar = null;
    }
  }

  if (braceCount === -1 && content[i] === ')' && content.substring(i, i+2) === ')}') {
    endIndex = i + 2;
    break;
  }
}

if (endIndex === -1) {
  console.log("Could not find end index");
  process.exit(1);
}

const replacement = `{(formData.features as any)?.eslIntegration && (
              <div className="pt-4 border-t border-border/50">
                <div className="mb-6">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Aylık Sistem Ücreti (€ Netto) <span className="text-red-500 ml-1">+ 19% MwSt.</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={(formData as any).eslSystemMonthlyFee ?? 29.90}
                    onChange={e => setFormData({ ...formData, eslSystemMonthlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                    className="w-full md:w-1/3 min-w-0 bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-foreground text-sm transition-colors"
                    placeholder="29.90"
                  />
                  <p className="text-[10px] text-muted-foreground/70 mt-1">SaaS & Base Station. Tüm fiyatlar Netto üzerinden hesaplanır.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-indigo-800 dark:text-indigo-400">ESL Etiket Paketleri (Minewtag Modelleri)</h5>
                    <button
                      type="button"
                      onClick={() => {
                        const currentPackages = (formData as any).eslPackages || [];
                        setFormData({
                          ...formData,
                          eslPackages: [...currentPackages, { model: 'DS021Q', quantity: 100, purchasePrice: 13.90, rentalPrice: 0.45 }]
                        } as any);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-md transition-colors flex items-center gap-1"
                    >
                      + Paket Ekle
                    </button>
                  </div>

                  {((formData as any).eslPackages || []).map((pkg: any, index: number) => {
                    const eslPrices: any = {
                      DS116: { purchase: 65.90, rental: 2.50 },
                      DS042Q: { purchase: 28.90, rental: 1.20 },
                      DS042F: { purchase: 26.90, rental: 1.10 },
                      DS043Q: { purchase: 29.90, rental: 1.30 },
                      DS035Q: { purchase: 23.90, rental: 0.90 },
                      DS035B: { purchase: 21.90, rental: 0.80 },
                      DS029Q: { purchase: 19.90, rental: 0.70 },
                      DS027Q: { purchase: 18.90, rental: 0.65 },
                      DS026F: { purchase: 16.90, rental: 0.55 },
                      DS021Q: { purchase: 13.90, rental: 0.45 },
                    };
                    
                    return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-indigo-900/10 border border-indigo-200 dark:border-indigo-700/30 rounded-lg relative">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Model & Ebat</label>
                        <select
                          value={pkg.model}
                          onChange={e => {
                            const newModel = e.target.value;
                            const newPackages = [...((formData as any).eslPackages || [])];
                            newPackages[index].model = newModel;
                            if (eslPrices[newModel]) {
                              newPackages[index].purchasePrice = eslPrices[newModel].purchase;
                              newPackages[index].rentalPrice = eslPrices[newModel].rental;
                            }
                            setFormData({ ...formData, eslPackages: newPackages } as any);
                          }}
                          className="w-full bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 rounded-md px-2 py-1.5 text-foreground text-xs"
                        >
                          <option value="DS116">DS116 (11.6") - 3 Renk</option>
                          <option value="DS042Q">DS042Q (4.2") - 4 Renk</option>
                          <option value="DS042F">DS042F (4.2") - Soğuk Hava (-25°C)</option>
                          <option value="DS043Q">DS043Q (4.3") - Bar Tipi 4 Renk</option>
                          <option value="DS035Q">DS035Q (3.5") - 4 Renk</option>
                          <option value="DS035B">DS035B (3.5") - Hızlı Yenileme</option>
                          <option value="DS029Q">DS029Q (2.9") - 4 Renk</option>
                          <option value="DS027Q">DS027Q (2.67") - İnce (7.8mm)</option>
                          <option value="DS026F">DS026F (2.66") - Soğuk Hava (-25°C)</option>
                          <option value="DS021Q">DS021Q (2.13") - 4 Renk</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Adet</label>
                        <input
                          type="number"
                          value={pkg.quantity ?? ''}
                          onChange={e => {
                            const newPackages = [...((formData as any).eslPackages || [])];
                            newPackages[index].quantity = e.target.value === '' ? '' : parseInt(e.target.value);
                            setFormData({ ...formData, eslPackages: newPackages } as any);
                          }}
                          className="w-full bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 rounded-md px-2 py-1.5 text-foreground text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                          Satın Alma <span className="text-[9px] text-red-500">(Netto)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={pkg.purchasePrice ?? ''}
                          onChange={e => {
                            const newPackages = [...((formData as any).eslPackages || [])];
                            newPackages[index].purchasePrice = e.target.value === '' ? '' : parseFloat(e.target.value);
                            setFormData({ ...formData, eslPackages: newPackages } as any);
                          }}
                          className="w-full bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 rounded-md px-2 py-1.5 text-foreground text-xs"
                        />
                      </div>
                      <div className="relative">
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                          Kira/Ay <span className="text-[9px] text-red-500">(Netto)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={pkg.rentalPrice ?? ''}
                            onChange={e => {
                              const newPackages = [...((formData as any).eslPackages || [])];
                              newPackages[index].rentalPrice = e.target.value === '' ? '' : parseFloat(e.target.value);
                              setFormData({ ...formData, eslPackages: newPackages } as any);
                            }}
                            className="w-full bg-background border border-indigo-900/40 focus:outline-none focus:border-indigo-500 rounded-md px-2 py-1.5 text-foreground text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newPackages = [...((formData as any).eslPackages || [])];
                              newPackages.splice(index, 1);
                              setFormData({ ...formData, eslPackages: newPackages } as any);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )})}
                  {((formData as any).eslPackages || []).length === 0 && (
                    <div className="text-center py-6 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <p className="text-xs text-muted-foreground">Henüz paket eklenmedi. &quot;Paket Ekle&quot; butonuna tıklayarak modele göre adet belirleyebilirsiniz.</p>
                    </div>
                  )}
                </div>
              </div>
            )}`;

content = content.substring(0, eslIndex) + replacement + content.substring(endIndex);

fs.writeFileSync(path, content, 'utf8');
console.log("Success");
