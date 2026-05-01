files_to_fix = [
    "lib/screens/kermes/kermes_courier_tracking_screen.dart",
    "lib/screens/driver/kermes_active_delivery_screen.dart",
]

for file in files_to_fix:
    with open(file, "r") as f:
        content = f.read()
    
    content = content.replace("ChatService().getUnreadCountStream(widget.orderId, FirebaseAuth.instance.currentUser?.uid ?? '')", "ChatService().getUnreadCountStream(widget.orderId, FirebaseAuth.instance.currentUser?.uid ?? '', isKermes: true)")
    content = content.replace("builder: (_) => OrderChatScreen(\n                          orderId: widget.orderId,", "builder: (_) => OrderChatScreen(\n                          orderId: widget.orderId,\n                          isKermes: true,")
    
    with open(file, "w") as f:
        f.write(content)

with open("lib/screens/orders/orders_screen.dart", "r") as f:
    content = f.read()

# in orders_screen, there's `order is KermesOrder` check before ChatService!
# If order is KermesOrder, pass isKermes: true
import re
content = re.sub(
    r"(stream: ChatService\(\)\.getUnreadCountStream\(order\.id, ref\.read\(authProvider\)\.user\?\.uid \?\? ''\),)",
    r"stream: ChatService().getUnreadCountStream(order.id, ref.read(authProvider).user?.uid ?? '', isKermes: order is KermesOrder),",
    content
)
content = re.sub(
    r"(builder: \(_\) => OrderChatScreen\(\s*orderId: order\.id,\s*orderNumber: order\.orderNumber \?\? '',\s*recipientName: (.*?),\s*recipientRole: (.*?),\s*\),)",
    r"builder: (_) => OrderChatScreen(\n                                orderId: order.id,\n                                orderNumber: order.orderNumber ?? '',\n                                recipientName: \2,\n                                recipientRole: \3,\n                                isKermes: order is KermesOrder,\n                              ),",
    content
)

with open("lib/screens/orders/orders_screen.dart", "w") as f:
    f.write(content)

