import re

with open('admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'r') as f:
    text = f.read()
    lines = text.split('\n')

# Find imports
imports = []
for line in lines:
    if line.startswith('import '):
        imports.append(line)

# Output structure
out = []
out.append("import React, { useState, useEffect } from 'react';")
for i in imports:
    if "firebase" in i or "lucide" in i or "utils" in i or "components" in i:
        if "layout" not in i and "page" not in i:
            out.append(i)

out.append("""
export default function BusinessSettingsEditor({ businessId, business, adminType, showToast, t }) {
""")

print("Done")
