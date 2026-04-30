import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx', 'r') as f:
    content = f.read()

kermes_dates_calc = """  const kermesDates = React.useMemo(() => {
    if (!kermesStart || !kermesEnd) return [];
    const dates = [];
    const sDate = new Date(kermesStart);
    sDate.setHours(12, 0, 0, 0);
    const eDate = new Date(kermesEnd);
    eDate.setHours(12, 0, 0, 0);
    
    if (sDate > eDate) return [kermesStart];
    
    const curr = new Date(sDate);
    while (curr <= eDate) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [kermesStart, kermesEnd]);\n\n"""

target_use_effect = """  useEffect(() => {
    const dates = Object.keys(groupedRosters).sort();"""

replacement_use_effect = kermes_dates_calc + """  useEffect(() => {
    const dates = kermesDates.length > 0 ? kermesDates : Object.keys(groupedRosters).sort();"""

if target_use_effect in content:
    content = content.replace(target_use_effect, replacement_use_effect)

target_map = """{Object.keys(groupedRosters).sort().map(dateStr => {"""
replacement_map = """{(kermesDates.length > 0 ? kermesDates : Object.keys(groupedRosters).sort()).map(dateStr => {"""
if target_map in content:
    content = content.replace(target_map, replacement_map)

target_empty = """        ) : Object.keys(groupedRosters).length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted-foreground">
            Buna kermese henüz vardiya eklenmedi.
          </div>
        ) : ("""
replacement_empty = """        ) : ("""
if target_empty in content:
    content = content.replace(target_empty, replacement_empty)

# Also fix the styling of KermesRosterTab to be completely inside a single bg-card wrapper to match tablet format
target_root = """  return (
    <div className="space-y-6 overflow-hidden">
      {/* Vardiya ve Mesai Planlama Paneli */}
      {isAdmin ? (
        <div className="bg-card rounded-xl p-6 shadow-sm border border-border overflow-hidden">"""

replacement_root = """  return (
    <div className="bg-card rounded-xl p-6 border border-border space-y-8 overflow-hidden w-full">
      {/* Vardiya ve Mesai Planlama Paneli */}
      {isAdmin ? (
        <div className="bg-slate-900/50 rounded-xl p-5 shadow-inner border border-border/50">"""

if target_root in content:
    content = content.replace(target_root, replacement_root)

# Find the second bg-card inside
target_boşluk = """      <div className="bg-card/50 rounded-xl p-4 border border-border">
        <button """
replacement_boşluk = """      <div className="bg-slate-900/30 rounded-xl p-4 border border-border/50">
        <button """

if target_boşluk in content:
    content = content.replace(target_boşluk, replacement_boşluk)

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx', 'w') as f:
    f.write(content)

print("Patch complete")
