import os

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/benutzerverwaltung/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Chunk 1: business filter mapping
old_business_filter = """                                            {businesses
                                                .filter(biz => {
                                                    const s = String(businessSearch).toLowerCase();
                                                    return String(biz.name || '').toLowerCase().includes(s) || 
                                                           String(biz.plz || '').includes(s) || 
                                                           String(biz.city || '').toLowerCase().includes(s);
                                                })"""

new_business_filter = """                                            {businesses
                                                .filter(biz => {
                                                    const terms = String(businessSearch).toLowerCase().split(' ').filter(v => v.trim() !== '');
                                                    if (terms.length === 0) return true;
                                                    const combined = `${biz.name || ''} ${biz.plz || ''} ${biz.city || ''}`.toLowerCase();
                                                    return terms.every(term => combined.includes(term));
                                                })"""

content = content.replace(old_business_filter, new_business_filter, 1)

# Chunk 2: business filter empty state
old_biz_empty = """                                            {businesses.length > 0 && businesses.filter(biz => {
                                                    const s = String(businessSearch).toLowerCase();
                                                    return String(biz.name || '').toLowerCase().includes(s) || 
                                                           String(biz.plz || '').includes(s) || 
                                                           String(biz.city || '').toLowerCase().includes(s);
                                            }).length === 0 && ("""

new_biz_empty = """                                            {businesses.length > 0 && businesses.filter(biz => {
                                                    const terms = String(businessSearch).toLowerCase().split(' ').filter(v => v.trim() !== '');
                                                    if (terms.length === 0) return true;
                                                    const combined = `${biz.name || ''} ${biz.plz || ''} ${biz.city || ''}`.toLowerCase();
                                                    return terms.every(term => combined.includes(term));
                                            }).length === 0 && ("""

content = content.replace(old_biz_empty, new_biz_empty, 1)


# Chunk 3: kermes filter mapping
old_kermes_filter = """                                            {kermesEvents
                                                .filter(k => {
                                                    const s = String(kermesSearch).toLowerCase();
                                                    return String(k.name || '').toLowerCase().includes(s) || 
                                                           String(k.plz || '').includes(s) || 
                                                           String(k.city || '').toLowerCase().includes(s) ||
                                                           String(k.dernekIsmi || '').toLowerCase().includes(s);
                                                })"""

new_kermes_filter = """                                            {kermesEvents
                                                .filter(k => {
                                                    const terms = String(kermesSearch).toLowerCase().split(' ').filter(v => v.trim() !== '');
                                                    if (terms.length === 0) return true;
                                                    const combined = `${k.name || ''} ${k.plz || ''} ${k.city || ''} ${k.dernekIsmi || ''}`.toLowerCase();
                                                    return terms.every(term => combined.includes(term));
                                                })"""

content = content.replace(old_kermes_filter, new_kermes_filter, 1)

# Chunk 4: kermes filter empty state
old_kermes_empty = """                                            {kermesEvents.length > 0 && kermesEvents.filter(k => {
                                                    const s = String(kermesSearch).toLowerCase();
                                                    return String(k.name || '').toLowerCase().includes(s) || 
                                                           String(k.plz || '').includes(s) || 
                                                           String(k.city || '').toLowerCase().includes(s) ||
                                                           String(k.dernekIsmi || '').toLowerCase().includes(s);
                                            }).length === 0 && ("""

new_kermes_empty = """                                            {kermesEvents.length > 0 && kermesEvents.filter(k => {
                                                    const terms = String(kermesSearch).toLowerCase().split(' ').filter(v => v.trim() !== '');
                                                    if (terms.length === 0) return true;
                                                    const combined = `${k.name || ''} ${k.plz || ''} ${k.city || ''} ${k.dernekIsmi || ''}`.toLowerCase();
                                                    return terms.every(term => combined.includes(term));
                                            }).length === 0 && ("""

content = content.replace(old_kermes_empty, new_kermes_empty, 1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated successfully!")
