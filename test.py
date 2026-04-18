with open("/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const isKasapType =" in line:
        for j in range(i, i+10):
            print(lines[j].strip())
