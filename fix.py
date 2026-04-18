with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'r') as f:
    text = f.read()

target = """  setFormData({ 
   ...formData, 
   activeBrandIds: newIds
  });

  if (businessId && businessId !== 'new') {
     try {
        await updateDoc(doc(db, "businesses", businessId), {
            activeBrandIds: newIds
        });
        showToast(e.target.checked ? "Rozet eklendi (Anlık Yansıtıldı)" : "Rozet kaldırıldı (Anlık Yansıtıldı)", "success");
     } catch (error) {}
  }"""

replacement = """  setFormData({ 
   ...formData, 
   activeBrandIds: newIds,
   brand: '',
   isTunaPartner: false,
   brandLabelActive: false,
   brandLabel: null
  });

  if (businessId && businessId !== 'new') {
     try {
        await updateDoc(doc(db, "businesses", businessId), {
            activeBrandIds: newIds,
            brand: null,
            isTunaPartner: false,
            brandLabelActive: false,
            brandLabel: null
        });
        showToast(e.target.checked ? "Rozet eklendi (Eski ayarlar sıfırlandı)" : "Rozet kaldırıldı (Eski ayarlar sıfırlandı)", "success");
     } catch (error) {}
  }"""

with open('/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'w') as f:
    f.write(text.replace(target, replacement))

print("Done")
