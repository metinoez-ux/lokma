import os

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/benutzerverwaltung/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Chunk 1: Interface
if "export interface KermesEvent {" in content:
    old_interface = """export interface KermesEvent {
    id: string;
    name: string;
    plz: string;
    city: string;
}"""
    new_interface = """export interface KermesEvent {
    id: string;
    name: string;
    plz: string;
    city: string;
    dernekIsmi?: string;
}"""
    content = content.replace(old_interface, new_interface, 1)

# Chunk 2: Load
if "allKermes.push({" in content:
    old_load = """                allKermes.push({
                    id: docSnap.id,
                    name: data.name || t('kermesLabel'),
                    plz: data.address?.plz || data.location?.zipCode || data.plz || '',
                    city: data.address?.city || data.location?.city || data.city || ''
                });"""
    new_load = """                allKermes.push({
                    id: docSnap.id,
                    name: data.name || t('kermesLabel'),
                    plz: data.address?.plz || data.location?.zipCode || data.plz || '',
                    city: data.address?.city || data.location?.city || data.city || '',
                    dernekIsmi: data.dernekIsmi || data.associationName || ''
                });"""
    content = content.replace(old_load, new_load, 1)

# Chunk 3: Business Placeholder
if "placeholder=\"İşletme ara (isim, plz, şehir)...\"" in content:
    content = content.replace(
        "placeholder=\"İşletme ara (isim, plz, şehir)...\"",
        "placeholder=\"İşletme ara (İsim, Şehir, Posta Kodu)...\""
    )

# Chunk 4: Kermes Placeholder
if "placeholder=\"Kermes ara (isim, plz, şehir)...\"" in content:
    content = content.replace(
        "placeholder=\"Kermes ara (isim, plz, şehir)...\"",
        "placeholder=\"Kermes ara (İsim, Dernek, Şehir, Posta Kodu)...\""
    )

# Chunk 5: Kermes Filter Logic
if "return k.name.toLowerCase().includes(search) || k.plz.includes(search) || k.city.toLowerCase().includes(search);" in content:
    new_kermes_filter = """                                                    const s = String(search).toLowerCase();
                                                    return String(k.name || '').toLowerCase().includes(s) || 
                                                           String(k.plz || '').includes(s) || 
                                                           String(k.city || '').toLowerCase().includes(s) ||
                                                           String(k.dernekIsmi || '').toLowerCase().includes(s);"""
    content = content.replace("return k.name.toLowerCase().includes(search) || k.plz.includes(search) || k.city.toLowerCase().includes(search);", new_kermes_filter)

# Chunk 6: Business Filter Logic
if "biz.name.toLowerCase().includes(search) || biz.plz.includes(search) || biz.city.toLowerCase().includes(search);" in content:
    new_biz_filter = """                                                    const s = String(search).toLowerCase();
                                                    return String(biz.name || '').toLowerCase().includes(s) || 
                                                           String(biz.plz || '').includes(s) || 
                                                           String(biz.city || '').toLowerCase().includes(s);"""
    content = content.replace("return biz.name.toLowerCase().includes(search) || biz.plz.includes(search) || biz.city.toLowerCase().includes(search);", new_biz_filter)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated successfully!")
