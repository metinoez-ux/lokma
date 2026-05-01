import re

filepath = "src/app/[locale]/admin/orders/page.tsx"
with open(filepath, "r") as f:
    content = f.read()

old_logic = """      const isKermesAdmin = admin?.businessType === 'kermes' || !!admin?.kermesId || ['kermes', 'kermes_staff', 'mutfak', 'garson', 'teslimat', 'kds', 'kasa', 'vezne', 'volunteer'].includes(admin?.adminType || '');
      const orderRef = isKermesAdmin 
        ? doc(db, 'kermes_orders', orderId) 
        : doc(db, 'meat_orders', orderId);"""

new_logic = """      // Check if it's a Kermes order by looking at the order itself
      const orderToUpdate = orders.find(o => o.id === orderId);
      const isKermesOrder = !!(orderToUpdate?.kermesId || orderToUpdate?.isKermes);
      
      const orderRef = isKermesOrder 
        ? doc(db, 'kermes_orders', orderId) 
        : doc(db, 'meat_orders', orderId);"""

content = content.replace(old_logic, new_logic)

with open(filepath, "w") as f:
    f.write(content)
