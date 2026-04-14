import sys

filepath = "src/app/[locale]/admin/business/[id]/page.tsx"
with open(filepath, "r") as f:
    data = f.read()

legacy_start = '<div className="bg-card/50 border border-border rounded-xl p-6 opacity-60">'
legacy_end = '</select>\n </div>\n <div>'
full_block_start = '<div>\n <label className="text-muted-foreground text-sm block mb-2">{t(\'satilanUrunMarkalari\')}</label>'
full_block_end = '<span className="text-sm">🟢 {t(\'akdenizTorosUrunleri\')}</span>\n </label>\n </div>\n </div>'

# We want to insert the new block BEFORE legacy_start
new_block = """
  {/* Hazır Ürün Filtreleri */}
  <div className="bg-card/50 border border-border rounded-xl p-6 mt-6">
  <h4 className="text-foreground font-medium mb-2">🛍️ Hazır Paket Ürün Satışı (Mobil Filtreleme)</h4>
  <p className="text-xs text-muted-foreground mb-4">
  Marketler veya bu ürünleri paketli satan işletmeler için işaretleyin. Bu sayede kasap/restoran (sertifikalı TUNA kullananlar) dışında da aramalarda çıkacaktır.
  </p>
  <div className="flex flex-wrap gap-4">
  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors border ${formData.sellsTunaProducts ? 'bg-red-600/10 border-red-600/50' : 'bg-background border-border hover:bg-muted'}`}>
  <input type="checkbox" checked={formData.sellsTunaProducts} onChange={(e) => setFormData({ ...formData, sellsTunaProducts: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-red-600" />
  <span className="font-medium text-foreground">🔴 TUNA Ürünleri Satıyor</span>
  </label>
  <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors border ${formData.sellsTorosProducts ? 'bg-green-600/10 border-green-600/50' : 'bg-background border-border hover:bg-muted'}`}>
  <input type="checkbox" checked={formData.sellsTorosProducts} onChange={(e) => setFormData({ ...formData, sellsTorosProducts: e.target.checked })} disabled={!isEditing} className="w-5 h-5 accent-green-600" />
  <span className="font-medium text-foreground">🟢 Akdeniz Toros Ürünleri Satıyor</span>
  </label>
  </div>
  </div>

  <div className="bg-card/50 border border-border rounded-xl p-6 opacity-60 mt-6">
"""
# Replace legacy_start with new_block
data = data.replace(legacy_start, new_block)

# Remove the old internal div for `satilanUrunMarkalari` exactly
start_idx = data.find(full_block_start)
end_idx = data.find(full_block_end) + len(full_block_end)
if start_idx != -1 and end_idx > start_idx:
    data = data[:start_idx] + data[end_idx:]
else:
    print("Could not find the old block to remove!")
    
with open(filepath, "w") as f:
    f.write(data)
    
print("Updated successfully")
