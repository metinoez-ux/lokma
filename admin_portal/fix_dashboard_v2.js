const fs = require('fs');
const file = 'src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const analyticsStartStr = '// Advanced Analytics - All filtered by selected business';
const analyticsEndStr = "analytics.slowestDay = sortedDays[sortedDays.length - 1]?.day || 'Pazartesi';";

const optimizedAnalytics = `// Advanced Analytics - All filtered by selected business
  const analytics = useMemo(() => {
    const hourlyDistribution = Array(24).fill(0).map((_, hour) => ({ hour, count: 0, revenue: 0 }));
    const dailyDistribution = ['Pazar', 'Pazartesi', t('sali'), t('carsamba'), t('persembe'), 'Cuma', 'Cumartesi'].map(day => ({ day, count: 0, revenue: 0 }));
    const kermesDailyMap = {};
    const typeBreakdown = { pickup: 0, delivery: 0, dineIn: 0 };
    const productCounts = {};
    const businessStats = {};

    // Use kermes dates if available
    let activeDates = [];
    if (isKermesMode && kermesStartDate) {
      const endD = kermesEndDate ? new Date(kermesEndDate) : new Date(kermesStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      let curr = new Date(kermesStartDate);
      while (curr <= endD) {
        activeDates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredOrders.forEach(o => {
      const date = o.createdAt?.toDate();
      const total = o.total || 0;

      if (date) {
        // Hourly
        const hour = date.getHours();
        hourlyDistribution[hour].count++;
        hourlyDistribution[hour].revenue += total;

        // Daily
        const day = date.getDay();
        dailyDistribution[day].count++;
        dailyDistribution[day].revenue += total;

        // Kermes Daily
        const dateStr = date.toISOString().split('T')[0];
        if (!kermesDailyMap[dateStr]) {
          kermesDailyMap[dateStr] = { count: 0, revenue: 0 };
        }
        kermesDailyMap[dateStr].count++;
        kermesDailyMap[dateStr].revenue += total;
      }

      // Type Breakdown
      const type = o.type || (o as any).deliveryMethod;
      if (type === 'pickup' || type === 'gelAl') typeBreakdown.pickup++;
      else if (type === 'delivery') typeBreakdown.delivery++;
      else if (type === 'dineIn' || type === 'dine_in' || type === 'masa') typeBreakdown.dineIn++;

      // Top Products
      o.items?.forEach((item) => {
        const itemName = item.productName || item.name || '';
        if (!itemName) return;
        if (!productCounts[itemName]) {
          productCounts[itemName] = { name: itemName, quantity: 0, revenue: 0 };
        }
        productCounts[itemName].quantity += item.quantity || 1;
        productCounts[itemName].revenue += (item.totalPrice || item.price || 0) * (item.quantity || 1);
      });

      // Business Stats
      const id = o.businessId;
      if (id) {
        if (!businessStats[id]) {
          businessStats[id] = { id, name: businesses[id] || o.businessName || id, orders: 0, revenue: 0, avgOrder: 0 };
        }
        businessStats[id].orders++;
        businessStats[id].revenue += total;
      }
    });

    const mockWeathers = [
      { icon: '☀️', temp: '22°C', label: 'Açık', wind: '12km/s', rain: '0mm' },
      { icon: '⛅', temp: '19°C', label: 'Parçalı Bulutlu', wind: '18km/s', rain: '0mm' },
      { icon: '🌧️', temp: '16°C', label: 'Yağmurlu', wind: '25km/s', rain: '12mm' },
      { icon: '☁️', temp: '18°C', label: 'Çok Bulutlu', wind: '15km/s', rain: '2mm' }
    ];

    // Combine activeDates and orders' dates
    let allDates = Array.from(new Set([...activeDates, ...Object.keys(kermesDailyMap)])).sort();
    
    const kermesDailyDistribution = allDates.map((dateStr, idx) => {
      const dateObj = new Date(dateStr);
      const dateFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(dateObj);
      return {
        day: \`\${idx + 1}. Gün (\${dateFormatted})\`,
        weather: mockWeathers[idx % mockWeathers.length],
        count: kermesDailyMap[dateStr]?.count || 0,
        revenue: kermesDailyMap[dateStr]?.revenue || 0,
      };
    });

    const topProducts = Object.values(productCounts)
      .filter(p => p.name && p.name !== t('urun'))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    Object.values(businessStats).forEach(b => {
      b.avgOrder = b.orders > 0 ? b.revenue / b.orders : 0;
    });
    const businessPerformance = Object.values(businessStats).sort((a, b) => b.revenue - a.revenue);

    const maxHourly = Math.max(...hourlyDistribution.map(h => h.count), 1);
    const peakHour = hourlyDistribution.find(h => h.count === maxHourly)?.hour || 12;

    const sortedDays = [...dailyDistribution].sort((a, b) => b.count - a.count);
    const busiestDay = sortedDays[0]?.day || 'Cumartesi';
    const slowestDay = sortedDays[sortedDays.length - 1]?.day || 'Pazartesi';

    return {
      hourlyDistribution,
      dailyDistribution,
      kermesDailyDistribution,
      typeBreakdown,
      topProducts,
      businessPerformance,
      peakHour,
      busiestDay,
      slowestDay
    };
  }, [filteredOrders, businesses, t, isKermesMode, kermesStartDate, kermesEndDate]);`;

const startIdx = content.indexOf(analyticsStartStr);
const endIdx = content.indexOf(analyticsEndStr) + analyticsEndStr.length;
if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + optimizedAnalytics + content.substring(endIdx);
  
  // 2. Change width constraints from max-w-7xl and max-w-5xl to w-full
  content = content.replace(/className="max-w-7xl mx-auto/g, 'className="w-full');
  content = content.replace(/className="max-w-5xl mx-auto/g, 'className="w-full');

  // Also fix the conditional widths for embedded mode to just use w-full always
  content = content.replace(/className=\{embedded \? "w-full space-y-6" : "max-w-7xl mx-auto space-y-6"\}/g, 'className="w-full space-y-6"');
  content = content.replace(/className=\{embedded \? "w-full bg-card rounded-xl p-12 text-center" : "max-w-7xl mx-auto bg-card rounded-xl p-12 text-center"\}/g, 'className="w-full bg-card rounded-xl p-12 text-center"');

  fs.writeFileSync(file, content);
  console.log("Dashboard fixes applied.");
} else {
  console.log("Could not replace analytics block", startIdx, endIdx);
}
