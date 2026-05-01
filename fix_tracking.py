import re

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "r") as f:
    content = f.read()

# 1. Remove phone icon from AppBar
content = re.sub(
    r"          if \(_order\?\.courierPhone != null\)\n            IconButton\(\n              icon: const Icon\(Icons\.phone\),\n              onPressed: \(\) => _callCourier\(_order!\.courierPhone!\),\n            \),\n",
    "",
    content
)

# 2. Remove refresh icon from AppBar
content = re.sub(
    r"          IconButton\(\n            icon: const Icon\(Icons\.refresh\),\n            tooltip: tr\('orders\.refresh'\),\n            onPressed: \(\) {\n              setState\(\(\) {\n                _refreshKey\+\+;\n              }\);\n            },\n          \),\n",
    "",
    content
)

with open("mobile_app/lib/screens/orders/courier_tracking_screen.dart", "w") as f:
    f.write(content)

