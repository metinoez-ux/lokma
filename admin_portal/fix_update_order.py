import re

filepath = "src/app/[locale]/admin/business/[id]/page.tsx"
with open(filepath, "r") as f:
    content = f.read()

old_logic = """      const isKermesAdmin = admin?.businessType === 'kermes' || !!admin?.kermesId || ['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat', 'kds', 'kasa', 'vezne', 'volunteer'].includes(admin?.adminType || '');
      const orderRef = isKermesAdmin 
        ? doc(db, 'kermes_orders', orderId) 
        : doc(db, 'meat_orders', orderId);"""

new_logic = """      // Since this is the regular business dashboard and we fetch from meat_orders,
      // we must ALWAYS update meat_orders, regardless of the admin's type.
      const orderRef = doc(db, 'meat_orders', orderId);"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)
