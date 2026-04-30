const fs = require('fs');
const file = 'src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  {/* Period Chart: Haftalık / Aylık / Yıllık */}
  {(() => {
  const now = new Date();
  const monthNames = ['Oca', t('sub'), 'Mar', 'Nis', 'May', 'Haz', 'Tem', t('agu'), 'Eyl', 'Eki', 'Kas', 'Ara'];

  let periodData: { label: string; count: number; revenue: number }[] = [];

  if (periodTab === 'weekly') {
  for (let i = 6; i >= 0; i--) {
  const d = new Date(now);
  d.setDate(d.getDate() - i);
  const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
  const dayOrders = orders.filter(o => {
  if (!o.createdAt) return false;
  const od = o.createdAt.toDate();
  return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
  });
  periodData.push({
  label: dayStr,
  count: dayOrders.length,
  revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
  });
  }
  } else if (periodTab === 'monthly') {
  const daysInMonth = now.getDate();
  for (let day = 1; day <= daysInMonth; day++) {
  const dayOrders = orders.filter(o => {
  if (!o.createdAt) return false;
  const od = o.createdAt.toDate();
  return od.getDate() === day && od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear();
  });
  periodData.push({
  label: \`\${day}\`,
  count: dayOrders.length,
  revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
  });
  }
  } else {
  const currentMonth = now.getMonth();
  for (let m = 0; m <= currentMonth; m++) {
  const monthOrders = orders.filter(o => {
  if (!o.createdAt) return false;
  const od = o.createdAt.toDate();
  return od.getMonth() === m && od.getFullYear() === now.getFullYear();
  });
  periodData.push({
  label: monthNames[m],
  count: monthOrders.length,
  revenue: monthOrders.reduce((s, o) => s + (o.total || 0), 0),
  });
  }
  }`;

const replacement = `  {/* Period Chart: Haftalık / Aylık / Yıllık */}
  {!isKermesMode && (() => {
  const now = new Date();
  const monthNames = ['Oca', t('sub'), 'Mar', 'Nis', 'May', 'Haz', 'Tem', t('agu'), 'Eyl', 'Eki', 'Kas', 'Ara'];

  const buckets: Record<string, { count: number, revenue: number }> = {};
  
  let minDate = new Date(0);
  if (periodTab === 'weekly') {
    minDate = new Date(now);
    minDate.setDate(minDate.getDate() - 6);
    minDate.setHours(0,0,0,0);
  } else if (periodTab === 'monthly') {
    minDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    minDate = new Date(now.getFullYear(), 0, 1);
  }

  orders.forEach(o => {
    if (!o.createdAt) return;
    const od = o.createdAt.toDate();
    if (od < minDate) return;
    
    let key = '';
    if (periodTab === 'weekly') {
      key = od.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
    } else if (periodTab === 'monthly') {
      key = \`\${od.getDate()}\`;
    } else {
      key = monthNames[od.getMonth()];
    }
    
    if (!buckets[key]) buckets[key] = { count: 0, revenue: 0 };
    buckets[key].count++;
    buckets[key].revenue += (o.total || 0);
  });

  let periodData: { label: string; count: number; revenue: number }[] = [];

  if (periodTab === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
      periodData.push({ label: dayStr, count: buckets[dayStr]?.count || 0, revenue: buckets[dayStr]?.revenue || 0 });
    }
  } else if (periodTab === 'monthly') {
    const daysInMonth = now.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const key = \`\${day}\`;
      periodData.push({ label: key, count: buckets[key]?.count || 0, revenue: buckets[key]?.revenue || 0 });
    }
  } else {
    const currentMonth = now.getMonth();
    for (let m = 0; m <= currentMonth; m++) {
      const key = monthNames[m];
      periodData.push({ label: key, count: buckets[key]?.count || 0, revenue: buckets[key]?.revenue || 0 });
    }
  }`;

if (content.includes("periodData.push({")) {
  content = content.replace(target, replacement);
  // and we need to replace the closing `})()` with `})()}` because we added `{!isKermesMode && `
  const closingTarget = `  </div>
  );
  })()}`;
  
  if (content.includes(closingTarget)) {
    content = content.replace(closingTarget, `  </div>
  );
  })()}`);
  }
}
fs.writeFileSync(file, content);
console.log("Period chart fixed.");
