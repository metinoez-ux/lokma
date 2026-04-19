import re
file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update md:grid-cols-6 to md:grid-cols-7
new_text = re.sub(r'grid-cols-1 md:grid-cols-6', 'grid-cols-1 md:grid-cols-7', text)

# 2. Inject the getter function inside the map loop, around line 528 (next to getStatusConfig)
getter_func = """
  const getTimeStatusDisplay = (event: any) => {
    const e = event;
    const parseLocal = (d: any) => {
      if (!d) return null;
      if (d.toDate) return d.toDate();
      if (d.seconds) return new Date(d.seconds * 1000);
      if (typeof d === 'string') return new Date(d);
      if (d instanceof Date) return d;
      return null;
    };
    const startDate = parseLocal(e.startDate) || parseLocal(e.date);
    const endDate = parseLocal(e.endDate) || startDate;
    if (!startDate) return { text: '-', color: 'text-muted-foreground' };
    
    const now = new Date();
    const start = new Date(startDate);
    start.setHours(0,0,0,0);
    const end = endDate ? new Date(endDate) : new Date(start);
    end.setHours(23,59,59,999);
    
    const nowDay = new Date();
    nowDay.setHours(0,0,0,0);

    if (nowDay < start) {
      const diffDays = Math.round((start.getTime() - nowDay.getTime()) / (1000 * 3600 * 24));
      if (diffDays > 30) return { text: `~${Math.floor(diffDays/30)} ay sonra`, color: 'text-cyan-600 dark:text-cyan-400' };
      if (diffDays === 1) return { text: `Yarın`, color: 'text-amber-500 dark:text-amber-400 font-bold' };
      return { text: `${diffDays} gün kaldı`, color: 'text-cyan-600 dark:text-cyan-400' };
    } else if (now > end) {
      const diffDays = Math.round((nowDay.getTime() - new Date(end.setHours(0,0,0,0)).getTime()) / (1000 * 3600 * 24));
      if (diffDays > 30) return { text: `~${Math.floor(diffDays/30)} ay geçti`, color: 'text-slate-400' };
      if (diffDays === 1) return { text: `Dün bitti`, color: 'text-slate-400' };
      return { text: `${diffDays} gün geçti`, color: 'text-slate-400' };
    } else {
      const diffDays = Math.round((nowDay.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
      return { text: `${diffDays}. Günü`, color: 'text-green-600 dark:text-green-400 font-bold' };
    }
  };
  const timeDisplay = getTimeStatusDisplay(event);
"""

new_text = re.sub(
    r'(const statusConfig = getStatusConfig\(timeStatus\);\s*const e = event as any;)', 
    r'\1\n' + getter_func, 
    new_text
)

# 3. Inject the new Column HTML after the "Menü" column
menu_col_pattern = re.compile(r'(<div className="hidden md:block">\s*<span className="text-muted-foreground/80 text-xs">\{t\(\'menu\'\)\}<\/span>\s*<p className="text-cyan-800 dark:text-cyan-400 text-sm">\{event\.productCount \|\| 0\} \{t\(\'urun\'\)\}<\/p>\s*<\/div>)')

time_col_html = """
  <div className="hidden md:block">
  <span className="text-muted-foreground/80 text-xs">Durum</span>
  <p className={`text-sm ${timeDisplay.color}`}>{timeDisplay.text}</p>
  </div>
"""

new_text = menu_col_pattern.sub(r'\1\n' + time_col_html, new_text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("regex SUCCESS")
