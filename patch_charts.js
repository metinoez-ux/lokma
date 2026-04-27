const fs = require('fs');
const file = 'admin_portal/src/app/[locale]/admin/business/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace "siparisler" label in the sidebar with "KDS"
content = content.replace(
  /<span className="font-medium">\{t\('siparisler'\)\} \(\{orders\.length\}\)<\/span>/g,
  '<span className="font-medium">KDS ({orders.length})</span>'
);

// 2. Inject `periodTab` and `analytics` object
const analyticsCode = `
  const [periodTab, setPeriodTab] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  
  const analytics = useMemo(() => {
    const hourlyDistribution = Array(24).fill(0).map((_, hour) => ({
      hour,
      count: orders.filter((o: any) => o.createdAt?.toDate?.()?.getHours() === hour).length,
      revenue: orders.filter((o: any) => o.createdAt?.toDate?.()?.getHours() === hour)
        .reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    }));

    const dailyDistribution = ['Pazar', 'Pzt', 'Salı', 'Çar', 'Per', 'Cuma', 'Cmt'].map((day, idx) => ({
      day,
      count: orders.filter((o: any) => o.createdAt?.toDate?.()?.getDay() === idx).length,
      revenue: orders.filter((o: any) => o.createdAt?.toDate?.()?.getDay() === idx)
        .reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    }));

    const typeBreakdown = {
      pickup: orders.filter((o: any) => o.type === 'pickup' || o.type === 'gelAl').length,
      delivery: orders.filter((o: any) => o.type === 'delivery').length,
      dineIn: orders.filter((o: any) => o.type === 'dineIn' || o.type === 'dine_in' || o.type === 'masa').length,
    };

    const productCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    orders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        const itemName = item.productName || item.name || '';
        if (!itemName) return;
        const key = itemName;
        if (!productCounts[key]) {
          productCounts[key] = { name: itemName, quantity: 0, revenue: 0 };
        }
        productCounts[key].quantity += item.quantity || 1;
        productCounts[key].revenue += (item.totalPrice || item.price || 0) * (item.quantity || 1);
      });
    });
    const topProducts = Object.values(productCounts)
      .filter((p: any) => p.name)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 10);

    const maxHourly = Math.max(...hourlyDistribution.map(h => h.count), 1);
    const peakHour = hourlyDistribution.find(h => h.count === maxHourly)?.hour || 12;

    const sortedDays = [...dailyDistribution].sort((a, b) => b.count - a.count);
    const busiestDay = sortedDays[0]?.day || 'Cumartesi';
    const slowestDay = sortedDays[sortedDays.length - 1]?.day || 'Pazartesi';

    return { hourlyDistribution, dailyDistribution, typeBreakdown, topProducts, peakHour, busiestDay, slowestDay };
  }, [orders]);

  if (adminLoading || loading) {`;

content = content.replace(/if\s*\(\s*adminLoading\s*\|\|\s*loading\s*\)\s*\{/, analyticsCode);

// 3. Replace the dummy chart section with the real one
const oldChartCodeStart = `<div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">`;
const oldChartCodeEnd = `{/* Quick Stats Column */}`;

const startIdx = content.indexOf(oldChartCodeStart);
const endIdx = content.indexOf(oldChartCodeEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const newChartCode = `<div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                {tStats('i_sletme_performansi') || 'İşletme Performansı'}
              </h3>
              <p className="text-muted-foreground text-xs mt-1">{tStats('son_7_gun_trend_analizi') || 'Sipariş ve Ciro Analizi'}</p>
            </div>
            <div className="flex bg-gray-700 rounded-lg overflow-hidden">
              {(['weekly', 'monthly', 'yearly'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPeriodTab(tab)}
                  className={\`px-3 py-1 text-xs font-medium transition \${periodTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-muted-foreground hover:text-white'
                  }\`}
                >
                  {tab === 'weekly' ? (tStats('weekly') || 'Haftalık') : tab === 'monthly' ? (tStats('monthly') || 'Aylık') : 'Yıllık'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-6 flex-1 min-h-[300px] flex flex-col gap-8">
            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Hourly Distribution */}
              <div>
                <h3 className="text-foreground font-bold mb-4">{t('saatlik_siparis_dagilimi') || 'Saatlik Sipariş Yoğunluğu'}</h3>
                {(() => {
                  const hourData = analytics.hourlyDistribution.slice(8, 22);
                  const maxCount = Math.max(...hourData.map(h => h.count), 1);
                  const chartH = 120;
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: \`\${chartH + 24}px\`, paddingTop: '16px' }}>
                      {hourData.map((h) => {
                        const barH = h.count > 0 ? Math.max((h.count / maxCount) * chartH, 6) : 3;
                        return (
                          <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            {h.count > 0 && (
                              <span style={{ fontSize: '9px', color: '#93c5fd', fontWeight: 600, marginBottom: '2px' }}>{h.count}</span>
                            )}
                            <div
                              style={{
                                width: '100%',
                                height: \`\${barH}px\`,
                                borderRadius: '4px 4px 0 0',
                                background: h.count > 0 ? '#3b82f6' : '#374151',
                                transition: 'background 0.2s',
                              }}
                              title={\`\${h.hour}:00 - \${h.count} sipariş, \${h.revenue.toFixed(2)}€\`}
                            />
                            <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{h.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Period Chart (Weekly/Monthly/Yearly) */}
              <div>
                <h3 className="text-foreground font-bold mb-4">Sipariş & Ciro Trendi</h3>
                {(() => {
                  const now = new Date();
                  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                  let periodData: { label: string; count: number; revenue: number }[] = [];

                  if (periodTab === 'weekly') {
                    for (let i = 6; i >= 0; i--) {
                      const d = new Date(now);
                      d.setDate(d.getDate() - i);
                      const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
                      const dayOrders = orders.filter((o: any) => {
                        if (!o.createdAt) return false;
                        const od = o.createdAt.toDate?.() || new Date(o.createdAt);
                        return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
                      });
                      periodData.push({
                        label: dayStr,
                        count: dayOrders.length,
                        revenue: dayOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
                      });
                    }
                  } else if (periodTab === 'monthly') {
                    const daysInMonth = now.getDate();
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dayOrders = orders.filter((o: any) => {
                        if (!o.createdAt) return false;
                        const od = o.createdAt.toDate?.() || new Date(o.createdAt);
                        return od.getDate() === day && od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear();
                      });
                      periodData.push({
                        label: \`\${day}\`,
                        count: dayOrders.length,
                        revenue: dayOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
                      });
                    }
                  } else {
                    const currentMonth = now.getMonth();
                    for (let m = 0; m <= currentMonth; m++) {
                      const monthOrders = orders.filter((o: any) => {
                        if (!o.createdAt) return false;
                        const od = o.createdAt.toDate?.() || new Date(o.createdAt);
                        return od.getMonth() === m && od.getFullYear() === now.getFullYear();
                      });
                      periodData.push({
                        label: monthNames[m],
                        count: monthOrders.length,
                        revenue: monthOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
                      });
                    }
                  }

                  const maxCount = Math.max(...periodData.map(d => d.count), 1);
                  const maxRevenue = Math.max(...periodData.map(d => d.revenue), 1);

                  return (
                    <div className="flex flex-col gap-4">
                      {/* Order Count Bars */}
                      <div className="flex items-end gap-1" style={{ height: 60 }}>
                        {periodData.map((d, i) => {
                          const h = (d.count / maxCount) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                              {d.count > 0 && <span className="text-[9px] text-blue-300 mb-0.5">{d.count}</span>}
                              <div className="w-full bg-blue-500/80 rounded-t" style={{ height: \`\${Math.max(h, 2)}%\`, minHeight: d.count > 0 ? 4 : 2 }} />
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Revenue Bars */}
                      <div className="flex items-end gap-1" style={{ height: 60 }}>
                        {periodData.map((d, i) => {
                          const h = (d.revenue / maxRevenue) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                              {d.revenue > 0 && <span className="text-[9px] text-green-300 mb-0.5">€{d.revenue.toFixed(0)}</span>}
                              <div className="w-full bg-green-500/80 rounded-t" style={{ height: \`\${Math.max(h, 2)}%\`, minHeight: d.revenue > 0 ? 4 : 2 }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {periodData.map((d, i) => (
                          <div key={i} className="flex-1 text-center">
                            <span className="text-[8px] text-muted-foreground/80">{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Top Products */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-foreground font-bold mb-4">{t('en_cok_satan_urunler') || 'Meistverkaufte Produkte'}</h3>
              {analytics.topProducts.length === 0 ? (
                <p className="text-muted-foreground/80 text-center py-4">{t('urun_verisi_bulunamadi') || 'Ürün verisi bulunamadı'}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                  {analytics.topProducts.slice(0, 6).map((p: any, idx: number) => (
                    <div key={p.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={\`text-lg \${idx === 0 ? 'text-yellow-800 dark:text-yellow-400' : idx === 1 ? 'text-foreground' : idx === 2 ? 'text-amber-600' : 'text-muted-foreground/80'}\`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : \`#\${idx + 1}\`}
                        </span>
                        <span className="text-foreground text-sm font-medium">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-green-800 dark:text-green-400 font-bold text-sm">{(p.revenue).toFixed(2)} €</p>
                        <p className="text-[10px] text-muted-foreground/80">{p.quantity} {t('adet') || 'Menge'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        `;

  content = content.substring(0, startIdx) + newChartCode + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log("Patched successfully!");
} else {
  console.log("Could not find bounds to replace chart block.");
  console.log("startIdx:", startIdx);
  console.log("endIdx:", endIdx);
}
