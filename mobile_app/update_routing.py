with open("lib/screens/driver/driver_delivery_screen.dart", "r") as f:
    content = f.read()

# Add import
import_stmt = "import 'kermes_active_delivery_screen.dart';"
new_import = "import 'kermes_active_delivery_screen.dart';\nimport 'active_delivery_screen.dart';"
content = content.replace(import_stmt, new_import)

# Replace KermesActiveDeliveryScreen for LokmaOrders
# There are 3 places: Navigator.push(context, MaterialPageRoute(builder: (_) => KermesActiveDeliveryScreen(orderId: order.id)))
# But we need to distinguish based on "if (order is KermesOrder)"

# We can just run a python replace because I saw the code earlier.
import re

content = re.sub(
r"""(if\s*\(order\s*is\s*KermesOrder\)\s*\{\s*Navigator\.pushReplacement\(\s*context,\s*MaterialPageRoute\(\s*builder:\s*\(_\)\s*=>\s*KermesActiveDeliveryScreen\(orderId:\s*order\.id\),\s*\),\s*\);\s*\}\s*else\s*\{\s*Navigator\.pushReplacement\(\s*context,\s*MaterialPageRoute\(\s*builder:\s*\(_\)\s*=>\s*)KermesActiveDeliveryScreen(\(orderId:\s*order\.id\),\s*\),\s*\);\s*\})""",
r"\1ActiveDeliveryScreen\2", content)

content = re.sub(
r"""(if\s*\(order\s*is\s*KermesOrder\)\s*\{\s*Navigator\.push\(\s*context,\s*MaterialPageRoute\(\s*builder:\s*\(_\)\s*=>\s*KermesActiveDeliveryScreen\(orderId:\s*order\.id\),\s*\),\s*\);\s*\}\s*else\s*\{\s*Navigator\.push\(\s*context,\s*MaterialPageRoute\(\s*builder:\s*\(_\)\s*=>\s*)KermesActiveDeliveryScreen(\(orderId:\s*order\.id\),\s*\),\s*\);\s*\})""",
r"\1ActiveDeliveryScreen\2", content)

with open("lib/screens/driver/driver_delivery_screen.dart", "w") as f:
    f.write(content)
