with open("lib/screens/driver/active_delivery_screen.dart", "r") as f:
    content = f.read()

content = content.replace("True ?", "true ?")
content = content.replace("orderSnapshot.deliveryMethod", "orderSnapshot.orderType.name")
content = content.replace("import 'package:lokma_app/models/order_model.dart';", "")

with open("lib/screens/driver/active_delivery_screen.dart", "w") as f:
    f.write(content)
