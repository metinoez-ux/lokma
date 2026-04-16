#!/bin/bash
sed -i '' -e '/  {tables.length === 0 && tableSections.length === 0 && (/i\
\
  {/* Delivery Zones (TV & Teslimat Ekranlari) - Sadece Kermes Icin */}\
  {isKermes && (\
   <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 mt-6">\
    <div className="flex items-center justify-between mb-4">\
     <div>\
      <h3 className="text-lg font-bold text-white flex items-center gap-2">📺 TV & Teslimat Noktaları</h3>\
      <p className="text-xs text-gray-400 mt-1">Hangi bölümlerin veya tezgahların hangi TV ekranında yayınlanacağını buradan tanımlayın.</p>\
     </div>\
     <button\
      onClick={() => {\
       const newZone: KermesDeliveryZone = { id: `dz_${Date.now()}`, name: `Teslimat Noktası ${deliveryZones.length + 1}` };\
       const updated = [...deliveryZones, newZone];\
       updateAndSave(undefined, undefined, undefined, undefined, undefined, updated);\
      }}\
      className="px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shadow-sm"\
     >\
      + TV Ekle\
     </button>\
    </div>\
\
    {deliveryZones.length === 0 ? (\
     <p className="text-sm text-gray-500 italic">Henüz özel bir teslimat noktası tanımlamadınız. Tanımlanmazsa eski usul her mutfağa TV üretilir.</p>\
    ) : (\
     <div className="space-y-3">\
      {deliveryZones.map((dz, idx) => (\
       <div key={dz.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">\
        <div className="flex gap-4 items-start sm:items-center flex-col sm:flex-row">\
         <div className="flex-1">\
          <label className="text-[10px] text-gray-500 block mb-1">Teslim Noktası / TV Adı</label>\
          <input\
           type="text"\
           value={dz.name}\
           onChange={(e) => {\
            const updated = [...deliveryZones];\
            updated[idx] = { ...updated[idx], name: e.target.value };\
            setDeliveryZones(updated);\
           }}\
           onBlur={() => updateAndSave(undefined, undefined, undefined, undefined, undefined, deliveryZones)}\
           className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none"\
          />\
         </div>\
         <div className="flex-1">\
          <label className="text-[10px] text-gray-500 block mb-1">Bağlı Bölüm (Opsiyonel)</label>\
          <select\
           value={dz.sectionFilter || ""}\
           onChange={(e) => {\
            const updated = [...deliveryZones];\
            updated[idx] = { ...updated[idx], sectionFilter: e.target.value || null };\
            updateAndSave(undefined, undefined, undefined, undefined, undefined, updated);\
           }}\
           className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none"\
          >\
           <option value="">Tümü (Genel)</option>\
           {tableSections.map((s) => <option key={s} value={s}>{s}</option>)}\
          </select>\
         </div>\
         <div className="flex-1">\
          <label className="text-[10px] text-gray-500 block mb-1">Mutfak/Tezgah Filtresi (Enter ile ekle)</label>\
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-1.5 flex flex-wrap gap-1">\
           {(dz.prepZoneFilters || []).map((pz) => (\
            <span key={pz} className="flex items-center gap-1 bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs">\
             {pz}\
             <button onClick={() => {\
              const updated = [...deliveryZones];\
              updated[idx].prepZoneFilters = dz.prepZoneFilters?.filter((p) => p !== pz);\
              updateAndSave(undefined, undefined, undefined, undefined, undefined, updated);\
             }} className="hover:text-amber-200">×</button>\
            </span>\
           ))}\
           <input\
            type="text"\
            className="bg-transparent text-white text-xs w-24 focus:outline-none px-1"\
            placeholder="Ekle..."\
            onKeyDown={(e) => {\
             if (e.key === "Enter" && (e.target as HTMLInputElement).value) {\
              const val = (e.target as HTMLInputElement).value.trim();\
              if (val) {\
               const updated = [...deliveryZones];\
               updated[idx].prepZoneFilters = [...(dz.prepZoneFilters || []), val];\
               updateAndSave(undefined, undefined, undefined, undefined, undefined, updated);\
               (e.target as HTMLInputElement).value = "";\
              }\
             }\
            }}\
           />\
          </div>\
         </div>\
         <button\
          onClick={() => {\
           if (confirm("Bu TV ekranını silmek istediğinize emin misiniz?")) {\
            const updated = deliveryZones.filter((_, i) => i !== idx);\
            updateAndSave(undefined, undefined, undefined, undefined, undefined, updated);\
           }\
          }}\
          className="text-red-400 hover:text-red-300 p-2"\
         >\
          Sil\
         </button>\
        </div>\
        \
        <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between">\
         <span className="text-xs text-gray-400">TV Ekranı Linki:</span>\
         <a href={`/kermes-tv/${businessId}?deliveryZone=${dz.id}`} target="_blank" className="text-xs text-blue-400 hover:underline flex items-center gap-1">\
          Oluşan URL`yi Gör ↗\
         </a>\
        </div>\
       </div>\
      ))}\
     </div>\
    )}\
   </div>\
  )}\
' /Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/TableManagementPanel.tsx
