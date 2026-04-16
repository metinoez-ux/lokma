const fs = require('fs');
const p = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx';
let d = fs.readFileSync(p, 'utf8');

// 1. Hook
if (!d.includes('const [deliveryZones, setDeliveryZones]')) {
    d = d.replace(/const \[saving, setSaving\] = useState\(false\);/, 
    "const [saving, setSaving] = useState(false);\n  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);");
}

// 2. Fetch
if (!d.includes('setDeliveryZones(d.deliveryZones || [])')) {
    d = d.replace(/setTableCapacity\(d\.tableCapacity \|\| 0\);/,
    "setTableCapacity(d.tableCapacity || 0);\n      setDeliveryZones(d.deliveryZones || []);");
}

// 3. Save Payload
if (!d.includes('deliveryZones: newDeliveryZones')) {
    d = d.replace(/tableSectionsV2: defsToSave,/,
    "tableSectionsV2: defsToSave,\n      deliveryZones: newDeliveryZones ?? deliveryZones,");
    d = d.replace(/newDefs\?: SectionDef\[\]/, "newDefs?: SectionDef[], newDeliveryZones?: any[]");
}

// 4. UpdateAndSave params
if (!d.includes('saveData(t2, m, c, s, newDefs, newDeliveryZones)')) {
    d = d.replace(/saveData\(t2, m, c, s, newDefs\);/,
    "if (newDeliveryZones !== undefined) setDeliveryZones(newDeliveryZones);\n    saveData(t2, m, c, s, newDefs, newDeliveryZones);");
}

// 5. Links
d = d.replace(/href={`\/kermes-display/g, "href={`/${locale}/kermes-display");
d = d.replace(/href={`\/kermes-tv/g, "href={`/${locale}/kermes-tv");


// 6. UI Block
if (!d.includes('📺 Teslimat Noktaları')) {
    const ui = `
      {/* TESLIMAT NOKTALARI */}
      {isKermes && (
        <div className="mt-8 mb-6 p-6 pb-8 bg-purple-900/10 border border-purple-500/30 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">📺 Teslimat Noktaları (TV Ekranları)</h2>
            <button onClick={() => {
              const newDz = [...deliveryZones, { id: 'dz_' + Date.now(), name: 'Yeni Ekran', prepZoneFilters: [] }];
              updateAndSave(undefined, undefined, undefined, undefined, undefined, newDz);
            }} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition">+ TV Ekranı Ekle</button>
          </div>
          <p className="text-sm text-gray-400 mb-6">Buradan eklediğiniz Teslimat Noktaları...</p>
          <div className="flex flex-col gap-3">
            {deliveryZones.map((dz, idx) => (
              <div key={dz.id} className="bg-gray-800/80 p-4 rounded-xl border border-gray-700 flex flex-wrap lg:flex-nowrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Ekran Adı</label>
                  <input type="text" value={dz.name} onChange={(e) => {
                    const upd = [...deliveryZones]; upd[idx].name = e.target.value; setDeliveryZones(upd);
                  }} onBlur={() => updateAndSave(undefined, undefined, undefined, undefined, undefined, deliveryZones)} className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700" />
                </div>
                <div className="w-[180px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Bağlı Bölüm</label>
                  <select value={dz.sectionFilter || ""} onChange={(e) => {
                    const upd = [...deliveryZones]; upd[idx].sectionFilter = e.target.value || null; updateAndSave(undefined, undefined, undefined, undefined, undefined, upd);
                  }} className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700">
                    <option value="">Tümü</option>
                    {tableSections.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">İstasyonlar (Virgül)</label>
                  <input type="text" value={(dz.prepZoneFilters || []).join(", ")} onChange={(e) => {
                    const upd = [...deliveryZones]; upd[idx].prepZoneFilters = e.target.value.split(',').map(s=>s.trim()).filter(s=>s.length>0); setDeliveryZones(upd);
                  }} onBlur={() => updateAndSave(undefined, undefined, undefined, undefined, undefined, deliveryZones)} className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700" />
                </div>
                <div className="pb-1">
                  <button onClick={() => {
                    if (confirm('Silinecek?')) {
                      const upd = deliveryZones.filter((_, i) => i !== idx);
                      updateAndSave(undefined, undefined, undefined, undefined, undefined, upd);
                    }
                  }} className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg">Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    `;

    const targetIdx = d.lastIndexOf('</div>\n    </div>\n  );\n}');
    if (targetIdx > -1) {
        d = d.slice(0, targetIdx) + ui + '\n' + d.slice(targetIdx);
    }
}

fs.writeFileSync(p, d);
console.log("Patched correctly");
