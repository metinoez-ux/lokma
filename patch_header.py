import re

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/components/admin/AdminHeader.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add KDS and Stant to the Normal Admin Desktop Header
# We'll replace the `{isKermesUser && targetKermesId ? null : (` with the links
target1 = "{isKermesUser && targetKermesId ? null : ("
replacement1 = """{isKermesUser && targetKermesId ? (
    <>
      <Link href={`/admin/kermes/${targetKermesId}?tab=kds`} className="flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium transition bg-red-600/20 border border-red-500/50 text-red-500 hover:bg-red-600/30 whitespace-nowrap">
        KDS Ekranı
      </Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=tezgah`} className="flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium transition bg-pink-600/20 border border-pink-500/50 text-pink-500 hover:bg-pink-600/30 whitespace-nowrap">
        Stant (Tezgah)
      </Link>
    </>
  ) : ("""
if target1 in content:
    content = content.replace(target1, replacement1)
else:
    print("WARNING: target1 not found")

# 2. Add Tahsilat and Bildirimler to the Normal Admin Profile Menu
# Just before {/* Language Selection */} in the normal admin dropdown (around line 1356)
target2 = "{/* Language Selection */}"
replacement2 = """{/* Kermes Special Menus */}
  {isKermesUser && targetKermesId && (
    <div className="py-2 border-b border-border bg-emerald-900/10">
      <p className="px-4 py-1 text-[10px] uppercase font-bold text-emerald-500/80 tracking-wider">Kermes Yönetimi</p>
      <Link href={`/admin/kermes/${targetKermesId}?tab=tahsilat`} className="block px-4 py-2 text-xs font-bold text-emerald-500 hover:bg-muted transition">Tahsilat (Kasa)</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=bildirimler`} className="block px-4 py-2 text-xs font-bold text-violet-500 hover:bg-muted transition">Bildirimler</Link>
    </div>
  )}
  {/* Language Selection */}"""
if target2 in content:
    # replace first occurence (actually there might be multiple language selections, one for super admin, one for normal)
    # We should replace all occurrences to be safe, so both menus get it.
    content = content.replace(target2, replacement2)
else:
    print("WARNING: target2 not found")

# 3. Update the Mobile Slide-in Panel for Kermes (around line 1404)
# Remove Tahsilat from main list, add KDS and Stant
target3 = """      <Link href={`/admin/kermes/${targetKermesId}?tab=dashboard`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('dashboard')}</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=siparisler`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">KDS</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=products`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">Ürünler</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=roster`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">Personel</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=tahsilat`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">Kasa</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=settings`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('settings')}</Link>"""

replacement3 = """      <Link href={`/admin/kermes/${targetKermesId}?tab=dashboard`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('dashboard')}</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=kds`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-red-500 font-medium hover:bg-muted">KDS Ekranı</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=tezgah`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-pink-500 font-medium hover:bg-muted">Stant (Tezgah)</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=products`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">Ürünler</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=roster`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">Personel</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=tahsilat`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-emerald-500 font-medium hover:bg-muted">Tahsilat (Kasa)</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=bildirimler`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-violet-500 font-medium hover:bg-muted">Bildirimler</Link>
      <Link href={`/admin/kermes/${targetKermesId}?tab=settings`} onClick={closeMobileMenu} className="block px-4 py-3 text-sm text-foreground hover:bg-muted">{t('settings')}</Link>"""
if target3 in content:
    content = content.replace(target3, replacement3)
else:
    print("WARNING: target3 not found")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch header applied.")
