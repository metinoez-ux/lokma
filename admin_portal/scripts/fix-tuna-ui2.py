import sys

target_file = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx"
with open(target_file, "r") as f:
    lines = f.readlines()

out_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if "ESKİ KOD MİMARİSİ" in line:
        # We found the start of the legacy block.
        # Let's insert our new UI right BEFORE the `<div className="bg-card/50... opacity-60">` which is 1 line above
        
        # Let's pop the last line from out_lines which holds the `<div className="bg-card/50 border border-border rounded-xl p-6 opacity-60">`
        # wait, let me just find exact line numbers.
        pass
    i += 1

