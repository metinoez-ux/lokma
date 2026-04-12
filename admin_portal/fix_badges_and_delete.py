import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update confirm to prompt EVET
target_delete = r"if \(\!confirm\('Bu personeli sistemden tamamen silmek istediğinize emin misiniz\?'\)\) return;"
replace_delete = """const answer = prompt('Bu personeli sistemden TAMAMEN silmek istediğinize emin misiniz?\\nİşlemi onaylamak için büyük harflerle EVET yazın:');
  if (answer !== 'EVET') { showToast('Silme işlemi iptal edildi', 'info'); return; }"""

content = re.sub(target_delete, replace_delete, content, count=1)

# 2. Fix the flex wrap for badges
target_badge = r"""  <div>
  <span className="text-sm font-medium text-foreground">\{staff.displayName \|\| \(staff.firstName \? `\$\{staff.firstName\} \$\{staff.lastName \|\| ''\}`.trim\(\) : ''\) \|\| staff.name \|\| staff.email\}</span>
  \{assignedStaff.includes\(staff.id\) && \("""
replace_badge = """  <div className="flex-1 min-w-0">
  <span className="block text-sm font-medium text-foreground truncate">{staff.displayName || (staff.firstName ? `${staff.firstName} ${staff.lastName || ''}`.trim() : '') || staff.name || staff.email}</span>
  <div className="flex flex-wrap items-center gap-1.5 mt-1">
  {assignedStaff.includes(staff.id) && ("""

content = re.sub(target_badge, replace_badge, content, count=1)

# Fix the end of the badge section
target_auth_wrap = r"""  \}
  </div>
  \)\}
  </div>
  </div>
  <div className="flex items-center gap-2">"""
replace_auth_wrap = """  }
  </div>
  )}
  </div>
  </div>
  <div className="flex flex-wrap shrink-0 items-center justify-end gap-2 md:pl-2">"""

content = re.sub(target_auth_wrap, replace_auth_wrap, content, count=1)

# 3. Remove the Red Delete Button (the one with Title="Personeli Karmesten Çıkar")
# Look for title="Düzenle" block end, then look for Personeli Karmesten Çıkar block.
# Actually, I can just use a regex to match the button
target_red_btn = r"""  <button \n  type="button" \n  onClick=\{async \(\) => \{\n  const newStaff = assignedStaff\.filter\(id => id !== staff\.id\);\n.*?title="Personeli Karmesten Çıkar"\n  >\n  ×\n  </button>"""
content = re.sub(target_red_btn, "", content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modifications applied.")
