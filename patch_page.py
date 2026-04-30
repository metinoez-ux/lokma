import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'r') as f:
    content = f.read()

target = """ {hasPermission('manage_staff') && (
 <button onClick={() => setActiveTab('vardiya')}
 className={`h-10 px-4 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'vardiya' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
 Vardiya
 </button>
 )}
 </button>
 )}"""

replacement = """ {hasPermission('manage_staff') && (
 <button onClick={() => setActiveTab('vardiya')}
 className={`h-10 px-4 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'vardiya' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
 Vardiya
 </button>
 )}
 {(hasPermission('manage_prepzones') || hasPermission('manage_staff') || hasPermission('manage_custom_roles')) && (
 <button onClick={() => setActiveTab('mutfak')}
 className={`h-10 px-4 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === 'mutfak' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
 Ocakbaşı & Görevler
 </button>
 )}"""

if target in content:
    content = content.replace(target, replacement)
    with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Failed to find target")
