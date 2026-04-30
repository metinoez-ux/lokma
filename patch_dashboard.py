import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesDashboardTab.tsx', 'r') as f:
    content = f.read()

target_use_memo = """    const sections: Record<string, { count: number, revenue: number }> = {};
    const today = new Date();"""

replacement_use_memo = """    const sections: Record<string, { count: number, revenue: number }> = {};
    const stantStats: Record<string, { count: number, revenue: number }> = {};
    const today = new Date();"""

if target_use_memo in content:
    content = content.replace(target_use_memo, replacement_use_memo)

target_ocakbasi = """        // Ocakbaşı check (by category, prepZone or name)
        const hasOcakbasi = (data.items || []).some((item: any) => {"""

replacement_ocakbasi = """        // Stant (PrepZone / Delivery Point) calculation
        (data.items || []).forEach((item: any) => {
           const qty = parseInt(item.quantity || item.count || '1', 10) || 1;
           const price = parseFloat(item.price || item.totalPrice || item.unitPrice || '0') || 0;
           const totalVal = qty * price;
           
           let zones: string[] = [];
           if (Array.isArray(item.prepZone)) {
             zones = item.prepZone.filter(z => typeof z === 'string' && z.trim() !== '');
           } else if (typeof item.prepZone === 'string' && item.prepZone.trim() !== '') {
             zones = [item.prepZone.trim()];
           }
           
           if (zones.length === 0) {
             zones = ['Genel / Belirtilmemiş'];
           }
           
           zones.forEach(zone => {
              if (!stantStats[zone]) stantStats[zone] = { count: 0, revenue: 0 };
              stantStats[zone].count += qty;
              stantStats[zone].revenue += totalVal;
           });
        });

        // Ocakbaşı check (by category, prepZone or name)
        const hasOcakbasi = (data.items || []).some((item: any) => {"""

if target_ocakbasi in content:
    content = content.replace(target_ocakbasi, replacement_ocakbasi)

target_return_obj = """    return {
      activeOrders,"""

replacement_return_obj = """    return {
      activeOrders,
      stantStats,"""

if target_return_obj in content:
    content = content.replace(target_return_obj, replacement_return_obj)

target_destructure = """    peakHour,
    sectionStats
  } = React.useMemo(() => {"""

replacement_destructure = """    peakHour,
    sectionStats,
    stantStats
  } = React.useMemo(() => {"""

if target_destructure in content:
    content = content.replace(target_destructure, replacement_destructure)

target_render_sections = """      {/* Bölüm Bazlı İstatistikler */}
      {Object.keys(sectionStats).length > 0 && ("""

replacement_render_sections = """      {/* Stant (Teslimat Noktası) İstatistikleri */}
      {Object.keys(stantStats).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Stant / İstasyon Performansları (Ürün & Ciro)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stantStats).sort((a, b) => b[1].revenue - a[1].revenue).map(([zone, stats]) => (
              <div key={zone} className="bg-gradient-to-br from-amber-100 dark:from-amber-900/30 to-amber-50 dark:to-amber-800/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4 text-center">
                 <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 truncate" title={zone.toUpperCase()}>{zone.toUpperCase()}</p>
                 <div className="flex justify-between items-center text-amber-900 dark:text-amber-300">
                    <span className="text-lg font-bold">{stats.count} Ürün</span>
                    <span className="text-lg font-bold">€{stats.revenue.toFixed(2)}</span>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bölüm Bazlı İstatistikler */}
      {Object.keys(sectionStats).length > 0 && ("""

if target_render_sections in content:
    content = content.replace(target_render_sections, replacement_render_sections)

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesDashboardTab.tsx', 'w') as f:
    f.write(content)

print("Patch complete")
