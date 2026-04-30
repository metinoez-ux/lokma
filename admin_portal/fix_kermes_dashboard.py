import sys
import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesDashboardTab.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Stop dumping everything into 'GENEL OCAKBAŞI'. Instead, we should check if the item is explicitly an ocakbaşı item!
# Or we just let stantStats[formattedZone] handle it, and REMOVE the 'GENEL OCAKBAŞI' totalizer block!
pattern1 = re.compile(r'(\s*// Keep a total count for Genel Ocakbaşı\s*if \(!stantStats\[\'GENEL OCAKBAŞI\'\]\) stantStats\[\'GENEL OCAKBAŞI\'\] = \{ count: 0, revenue: 0 \};\s*stantStats\[\'GENEL OCAKBAŞI\'\]\.count \+= qty;\s*stantStats\[\'GENEL OCAKBAŞI\'\]\.revenue \+= totalVal;\s*)')

if pattern1.search(content):
    content = pattern1.sub("\n", content)
    print("Fix 1 (Genel Ocakbaşı aggregate) applied.")
else:
    print("Fix 1 not found.")

# Fix 2: Restore the Toplam Ocakbaşı chip!
# We will just add it back where we replaced it, or add it next to assignedStaffCount.
pattern2 = re.compile(r'(<div className="bg-card rounded-xl p-4 text-center">\s*<p className="text-3xl font-bold text-gray-800 dark:text-gray-400">\{assignedStaffCount\}</p>\s*<p className="text-xs text-muted-foreground mt-1">Kermes Personeli</p>\s*</div>)')

if pattern2.search(content):
    new_chips = """<div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-400">{assignedStaffCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Kermes Personeli</p>
          </div>
          <div className="bg-card rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-800 dark:text-orange-400">{ocakbasiCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Ocakbaşı Sipariş</p>
          </div>"""
    content = pattern2.sub(new_chips, content)
    print("Fix 2 (Ocakbaşı chip) applied.")
else:
    print("Fix 2 not found.")

# Fix 3: Change "Tezgah Performansları" to "Ocakbaşı Performansı" if user requested.
pattern3 = re.compile(r"\{t\('stant_performanslari'\) \|\| 'Tezgah Performansları'\}")
if pattern3.search(content):
    content = pattern3.sub("{t('ocakbasi_performansi') || 'Ocakbaşı Performansı'}", content)
    print("Fix 3 (Header title) applied.")

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

