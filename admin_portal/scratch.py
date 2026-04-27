import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx"

with open(file_path, "r") as f:
    content = f.read()

# Replace layout issue
# Original: <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
layout_target = '<div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">'
layout_replacement = '<div className="max-w-7xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)] w-full px-4 gap-6">'
content = content.replace(layout_target, layout_replacement)

# Original: <aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-card border-r border-border h-fit sticky top-20 shadow-sm overflow-y-auto p-3 m-4 rounded-xl">
aside_target = '<aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-card border-r border-border h-fit sticky top-20 shadow-sm overflow-y-auto p-3 m-4 rounded-xl">'
aside_replacement = '<aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-card border border-border h-fit sticky top-20 shadow-sm overflow-y-auto p-3 py-4 rounded-xl mt-6">'
content = content.replace(aside_target, aside_replacement)

# Original: <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
main_target = '<main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">'
main_replacement = '<main className="flex-1 w-full py-6">'
content = content.replace(main_target, main_replacement)


# Replace t('AdminStatistics.something') with tStats('something')
content = re.sub(r"t\('AdminStatistics\.([^']+)'\)", r"tStats('\1')", content)

# Replace t('AdminStaffdashboard.something') with tStaff('something')
content = re.sub(r"t\('AdminStaffdashboard\.([^']+)'\)", r"tStaff('\1')", content)

with open(file_path, "w") as f:
    f.write(content)

print("Replacement complete.")
