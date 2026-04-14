import sys

target_file = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx"
with open(target_file, "r") as f:
    content = f.read()

new_ui = """  <p className="text-xs text-green-800 dark:text-green-400 mt-4 border-t border-border pt-4">
  Seçilen markalar, mobil uygulamada işletme detaylarında ve kartında gösterilecektir.
  </p>
  </div>
  
  {/* Hazır Ürün Filtreleri (Yeni İstek) */}
  <div className="bg-card/50 border border-border rounded-xl p-6 mt-6">
  <h4 className="text-foreground font-medium mb-2">🛍️ Hazır Ürün Satışı (Mobil Filtreler)</h4>
  <p className="text-xs text-muted-foreground mb-4">
  Marketler veya hazır paketli ürün satan işletmeler için işaretleyin. İşletme sertifika rozeti almasa bile mobil uygulamadaki arama/filtreleme sonuçlarında "Tuna/Toros Ürünleri Satanlar" listesinde görünecektir.
  </p>
  <div className="flex flex-wrap gap-4">
  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors border ${formData.sellsTunaProducts ? 'bg-red-600/10 border-red-600/30' : 'bg-background border-border hover:bg-muted'}`}>
  <input type="checkbox" checked={formData.sellsTunaProducts} onChange={(e) => setFormData({ ...formData, sellsTunaProducts: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-red-600" />
  <span className="font-medium text-foreground">🔴 TUNA Ürünleri Satıyor</span>
  </label>
  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors border ${formData.sellsTorosProducts ? 'bg-green-600/10 border-green-600/30' : 'bg-background border-border hover:bg-muted'}`}>
  <input type="checkbox" checked={formData.sellsTorosProducts} onChange={(e) => setFormData({ ...formData, sellsTorosProducts: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-green-600" />
  <span className="font-medium text-foreground">🟢 Akdeniz Toros Ürünleri Satıyor</span>
  </label>
  </div>
  </div>
  
  <div className="bg-card/50 border border-border rounded-xl p-6 opacity-60 mt-6">
  <h4 className="text-foreground font-medium mb-2 line-through">ESKİ KOD MİMARİSİ (SABİT LOGOLAR)</h4>
  <p className="text-xs text-muted-foreground mb-4">Geçiş süresince geriye uyumluluk (backward compatibility) için saklanmaktadır.</p>
  <div className="flex flex-col gap-4">
  <div>
  <label className="text-muted-foreground text-sm"> Eski LOKMA Label</label>
  <select value={formData.brand || ''} onChange={(e) => { const val = e.target.value as "tuna" | "akdeniz_toros" | ""; setFormData({ ...formData, brand: val as any, brandLabelActive: val !== "" }); }} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg outline-none mt-1 disabled:opacity-50">
  <option value="">{t('secilmedi')}</option>
  <option value="tuna">🔴 TUNA</option>
  <option value="akdeniz_toros">⚫ Akdeniz Toros</option>
  </select>
  </div>
  </div>
  </div>
  </>"""


old_ui = """  <p className="text-xs text-green-800 dark:text-green-400 mt-4 border-t border-border pt-4">
  Seçilen markalar, mobil uygulamada işletme detaylarında ve kartında gösterilecektir.
  </p>
  </div>
  
  <div className="bg-card/50 border border-border rounded-xl p-6 opacity-60">
  <h4 className="text-foreground font-medium mb-2 line-through">ESKİ KOD MİMARİSİ (SABİT LOGOLAR)</h4>
  <p className="text-xs text-muted-foreground mb-4">Geçiş süresince geriye uyumluluk (backward compatibility) için saklanmaktadır.</p>
  <div className="flex flex-col gap-4">
  <div>
  <label className="text-muted-foreground text-sm"> Eski LOKMA Label</label>
  <select value={formData.brand || ''} onChange={(e) => { const val = e.target.value as "tuna" | "akdeniz_toros" | ""; setFormData({ ...formData, brand: val as any, brandLabelActive: val !== "" }); }} disabled={!isEditing} className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg outline-none mt-1 disabled:opacity-50">
  <option value="">{t('secilmedi')}</option>
  <option value="tuna">🔴 TUNA</option>
  <option value="akdeniz_toros">⚫ Akdeniz Toros</option>
  </select>
  </div>
  <div>
  <label className="text-muted-foreground text-sm block mb-2">{t('satilanUrunMarkalari')}</label>
  <div className="flex flex-wrap gap-3">
  <label className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer ${formData.sellsTunaProducts ? 'bg-red-600/30' : 'bg-muted'}`}>
  <input type="checkbox" checked={formData.sellsTunaProducts} onChange={(e) => setFormData({ ...formData, sellsTunaProducts: e.target.checked })} disabled={!isEditing} className="w-4 h-4" />
  <span className="text-sm">🔴 {t('tunaUrunleri')}</span>
  </label>
  <label className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer ${formData.sellsTorosProducts ? 'bg-green-600/30' : 'bg-muted'}`}>
  <input type="checkbox" checked={formData.sellsTorosProducts} onChange={(e) => setFormData({ ...formData, sellsTorosProducts: e.target.checked })} disabled={!isEditing} className="w-4 h-4" />
  <span className="text-sm">🟢 {t('akdenizTorosUrunleri')}</span>
  </label>
  </div>
  </div>
  </div>
  </div>
  </>"""

if old_ui in content:
    content = content.replace(old_ui, new_ui)
    with open(target_file, "w") as f:
        f.write(content)
    print("SUCCESS: UI replaced")
else:
    print("FAILED: old_ui not found in file")
