import sys

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/dashboard/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "{staffBusinessId && ("
end_marker = "  {/* Sipariş Geçmişi Tablosu */}"

# We will just locate the whole staffBusinessId block towards the end of the file
# and replace the content.
import re
pattern = re.compile(r'\{staffBusinessId && \(\n\s+<>\n\s+<h4.*?</>\n\s+\)\}\n\s+</div>', re.DOTALL)

new_block = """{staffBusinessId && (
 <>
 <h4 className="text-foreground font-bold text-sm mb-4 border-b border-border pb-2 uppercase tracking-wide">
 {t('operasyon_detaylari') || 'Operasyon Detayları'}
 </h4>
 {/* Performance Stats Grid */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <div className="bg-background rounded-lg p-4">
 <div className="text-3xl font-bold text-foreground">{perfStats.totalOrders}</div>
 <div className="text-sm text-muted-foreground">{t('toplam_siparis') || 'Toplam Sipariş'}</div>
 </div>
 <div className="bg-green-600/20 rounded-lg p-4 border-l-4 border-green-500">
 <div className="text-3xl font-bold text-green-800 dark:text-green-400">{perfStats.completedOrders}</div>
 <div className="text-sm text-green-300">{t('tamamlanan_siparis') || 'Tamamlanan Sipariş'}</div>
 </div>
 <div className="bg-purple-600/20 rounded-lg p-4 border-l-4 border-purple-500">
 <div className="text-3xl font-bold text-purple-800 dark:text-purple-400">{perfStats.avgDeliveryTime}<span className="text-lg">{t('minutes_short') || 'Dk.'}</span></div>
 <div className="text-sm text-purple-300">{t('ortalama_teslimat') || 'Ort. Teslimat'}</div>
 </div>
 <div className="bg-amber-600/20 rounded-lg p-4 border-l-4 border-amber-500">
 <div className="text-3xl font-bold text-amber-800 dark:text-amber-400">{(perfStats.totalDistance || 0).toFixed(1)} <span className="text-lg">km</span></div>
 <div className="text-sm text-amber-300">{t('toplam_mesafe') || 'Toplam Mesafe'}</div>
 </div>
 </div>

 {/* Pause Statistics Row & Log Table - HIDE FOR KERMES MODE */}
 {!isKermesMode && (
 <>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <div className="bg-background rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2"><span className="text-xl">⏸️</span><span className="text-muted-foreground">{t('durdurma_sayisi')}</span></div>
 <div className="text-2xl font-bold text-amber-800 dark:text-amber-400">{pauseStats.pauseCount}</div>
 </div>
 <div className="bg-background rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2"><span className="text-muted-foreground">{t('retention_label')}</span></div>
 <div className="text-2xl font-bold text-green-800 dark:text-green-400">{pauseStats.resumeCount}</div>
 </div>
 <div className="bg-background rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2"><span className="text-xl">⏱️</span><span className="text-muted-foreground">{t('toplam_durdurma_suresi')}</span></div>
 <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-400">{pauseStats.totalPausedHours} <span className="text-lg">{t('saat')}</span></div>
 </div>
 </div>

 <div className="bg-background rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-border">
 <h4 className="text-foreground font-bold flex items-center gap-2">{t('kurye_acma_kapama_gecmisi')}</h4>
 </div>
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-border">
 <thead className="bg-card">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('tarih')}</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('i_slem')}</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admin</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {pauseLogs.length === 0 ? (
 <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t('henuz_kurye_acma_kapama_kaydi_yok')}</td></tr>
 ) : (
 <>
 {pauseLogs.slice(0, isPauseLogsExpanded ? pauseLogs.length : 3).map(log => (
 <tr key={log.id} className={log.action === 'paused' ? 'bg-amber-900/20' : 'bg-green-900/20'}>
 <td className="px-4 py-3 text-sm text-foreground">{formatPerfDate(log.timestamp)}</td>
 <td className="px-4 py-3">
 {log.action === 'paused'
 ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-600 text-white text-[10px] font-medium leading-none">⏸️ Durduruldu</span>
 : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-600 text-white text-[10px] font-medium leading-none">▶️ Devam Etti</span>}
 </td>
 <td className="px-4 py-3 text-xs text-foreground truncate max-w-[100px]">{log.adminName || log.adminEmail}</td>
 </tr>
 ))}
 {pauseLogs.length > 3 && (
 <tr>
 <td colSpan={3} className="px-2 py-2 text-center bg-card">
 <button onClick={() => setIsPauseLogsExpanded(!isPauseLogsExpanded)} className="text-xs font-semibold text-blue-500 hover:text-blue-400 py-1 transition-colors">
 {isPauseLogsExpanded ? 'Daralt' : `+ Tümünü Göster (${pauseLogs.length})`}
 </button>
 </td>
 </tr>
 )}
 </>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </>
 )}

 {/* Sipariş Geçmişi Tablosu */}
 <div className="bg-background rounded-lg overflow-hidden mt-6">
   <div className="px-4 py-3 border-b border-border flex justify-between items-center">
     <h4 className="text-foreground font-bold flex items-center gap-2">{t('tum_siparisler') || 'Tüm Siparişler'}</h4>
   </div>
   <div className="overflow-x-auto">
     <table className="min-w-full divide-y divide-border">
       <thead className="bg-card">
         <tr>
           <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('tarih') || 'Tarih'}</th>
           <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('saat') || 'Saat'}</th>
           <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('kurye') || 'Kurye'}</th>
           <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('adres') || 'Adres'}</th>
         </tr>
       </thead>
       <tbody className="divide-y divide-border">
         {staffOrders.length === 0 ? (
           <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t('henuz_siparis_kaydi_yok') || 'Henüz sipariş kaydı yok'}</td></tr>
         ) : (
           <>
             {staffOrders.slice(0, isStaffOrdersExpanded ? staffOrders.length : 5).map(o => {
               const oDate = o.createdAt;
               return (
                 <tr key={o.id} className="hover:bg-muted/10">
                   <td className="px-4 py-3 text-sm text-foreground">{oDate ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(oDate) : '-'}</td>
                   <td className="px-4 py-3 text-sm text-foreground">{oDate ? new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(oDate) : '-'}</td>
                   <td className="px-4 py-3 text-sm text-foreground">{o.courierName || o.assignedCourierName || o.deliveryPerson?.name || '-'}</td>
                   <td className="px-4 py-3 text-sm text-foreground truncate max-w-[200px]" title={o.customerAddress?.street || o.customerInfo?.address || '-'}>
                     {o.customerAddress?.street || o.customerInfo?.address || '-'}
                   </td>
                 </tr>
               );
             })}
             {staffOrders.length > 5 && (
               <tr>
                 <td colSpan={4} className="px-2 py-2 text-center bg-card">
                   <button onClick={() => setIsStaffOrdersExpanded(!isStaffOrdersExpanded)} className="text-xs font-semibold text-blue-500 hover:text-blue-400 py-1 transition-colors">
                     {isStaffOrdersExpanded ? (t('daralt') || 'Daralt') : `+ ${t('tumunu_goster') || 'Tümünü Göster'} (${staffOrders.length})`}
                   </button>
                 </td>
               </tr>
             )}
           </>
         )}
       </tbody>
     </table>
   </div>
 </div>
 </>
 )}
 </div>"""

if pattern.search(content):
    content = pattern.sub(new_block, content, count=1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("FAILED TO MATCH")
