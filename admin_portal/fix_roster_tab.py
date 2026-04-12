import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update form state
state_search = r"""  const \[isCreating, setIsCreating\] = useState\(false\);\n  const \[form, setForm\] = useState\(\{\n    userId: '',\n    role: '',\n    date: kermesStart \|\| '',\n    startTime: '08:00',\n    endTime: '16:00',\n  \}\);"""
state_replace = """  const [isCreating, setIsCreating] = useState(false);
  const [isFullKermes, setIsFullKermes] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    role: '',
    startDate: kermesStart || '',
    endDate: kermesStart || '',
    startTime: '08:00',
    endTime: '16:00',
  });"""
content = re.sub(state_search, state_replace, content)

# 2. Update handleCreate
handle_search = r"""  const handleCreate = async \(e: React.FormEvent\) => \{.*?(?=  const handleDelete =)"""
handle_replace = """  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId || !form.role || !form.startDate || !form.endDate || !form.startTime || !form.endTime) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }
    
    const sDate = new Date(form.startDate);
    const eDate = new Date(form.endDate);
    if (sDate > eDate) {
      alert('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }

    setIsCreating(true);
    try {
      const datesToAssign: string[] = [];
      const current = new Date(sDate);
      while (current <= eDate) {
        datesToAssign.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      for (const d of datesToAssign) {
        const payload = {
          kermesId,
          userId: form.userId,
          role: form.role,
          date: d,
          startTime: form.startTime,
          endTime: form.endTime,
          createdAt: Timestamp.now(),
          createdBy: adminUid
        };
        await addDoc(collection(db, 'kermes_events', kermesId, 'rosters'), payload);
      }
      
      await fetchRosters(); // Re-fetch to sort properly
      setForm(prev => ({ ...prev, userId: '', role: '' })); // Keep dates
      setIsFullKermes(false);
    } catch (err) {
      console.error(err);
      alert('Kaydedilirken hata oluştu.');
    } finally {
      setIsCreating(false);
    }
  };

"""
content = re.sub(handle_search, handle_replace, content, flags=re.DOTALL)

# 3. Fix Layout & Add UI parts
layout_search = r"""<div className="space-y-6 max-w-7xl">"""
layout_replace = """<div className="space-y-6 max-w-7xl mx-auto">"""
content = content.replace(layout_search, layout_replace)

form_cls_search = r"""<form onSubmit=\{handleCreate\} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">"""
form_cls_replace = """<form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">"""
content = content.replace(form_cls_search, form_cls_replace)

# 4. Replace the old Date Input section with the new Date Range + Checkbox section
date_input_search = r"""          <div className="space-y-1">\n            <label className="text-xs text-muted-foreground">Tarih</label>\n            <input \n              type="date" \n              value=\{form.date\}\n              min=\{kermesStart \|\| ''\}\n              max=\{kermesEnd \|\| ''\}\n              onChange=\{e => setForm\(\{\.\.\.form, date: e\.target\.value\}\)\}\n              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500"\n            />\n          </div>"""

date_input_replace = """          <div className="col-span-1 sm:col-span-2 lg:col-span-2 space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-muted-foreground">Tarih Aralığı (Başlangıç - Bitiş)</label>
              <label className="text-[10px] flex items-center gap-1 cursor-pointer text-blue-500 hover:text-blue-600 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded">
                <input 
                  type="checkbox" 
                  checked={isFullKermes} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsFullKermes(checked);
                    if (checked) {
                      setForm(prev => ({...prev, startDate: kermesStart || '', endDate: kermesEnd || ''}));
                    }
                  }} 
                  className="rounded border-blue-300 w-3 h-3 text-blue-600 focus:ring-blue-500" 
                />
                Tüm Kermes Boyunca
              </label>
            </div>
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                value={form.startDate}
                min={kermesStart || ''}
                max={kermesEnd || ''}
                disabled={isFullKermes}
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({...prev, startDate: val, endDate: prev.endDate < val ? val : prev.endDate}));
                }}
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-muted-foreground">-</span>
              <input 
                type="date" 
                value={form.endDate}
                min={form.startDate || kermesStart || ''}
                max={kermesEnd || ''}
                disabled={isFullKermes}
                onChange={e => setForm({...form, endDate: e.target.value})}
                className="w-full bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>"""

content = re.sub(date_input_search, date_input_replace, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Roster modifications applied.')
