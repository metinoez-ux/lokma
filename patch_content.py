import re

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'r') as f:
    content = f.read()

# Replace Gorevler tab block header to be merged inside mutfak
gorevler_content_regex = re.compile(r"\{\/\* Tab Content - Gorevler \(Roles\) \*\/\}\n\s*\{activeTab === 'gorevler' && \(\n\s*<div className=\"space-y-6\">")
mutfak_content_regex = re.compile(r"\{\/\* Tab Content - Mutfak \(PrepZone Istasyon Yonetimi\) \*\/\}\n\s*\{activeTab === 'mutfak' && \(\n\s*<div className=\"space-y-4\">")

content = gorevler_content_regex.sub(r"""{/* Tab Content - Gorevler (Roles) */}
  {(activeTab === 'mutfak' || activeTab === 'gorevler') && (hasPermission('manage_staff') || hasPermission('manage_custom_roles')) && (
  <div className="space-y-6 mt-8">
   <h2 className="text-xl font-bold text-foreground pb-2 border-b border-border/40 mb-4">Görevler ve Rol Yönetimi</h2>""", content)

content = mutfak_content_regex.sub(r"""{/* Tab Content - Mutfak (PrepZone Istasyon Yonetimi) */}
  {activeTab === 'mutfak' && hasPermission('manage_prepzones') && (
  <div className="space-y-4">
   <h2 className="text-xl font-bold text-foreground pb-2 border-b border-border/40 mb-4">Ocakbaşı İstasyonları</h2>""", content)

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Success")
