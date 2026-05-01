with open("lib/screens/orders/order_chat_screen.dart", "r") as f:
    content = f.read()

# Add isKermes property
content = content.replace("final String recipientRole;", "final String recipientRole;\n  final bool isKermes;")
content = content.replace("this.recipientRole = 'courier',", "this.recipientRole = 'courier',\n    this.isKermes = false,")

# Update _loadCurrentUser
old_query = """      final orderDoc = await FirebaseFirestore.instance
          .collection('meat_orders')
          .doc(widget.orderId)
          .get();"""

new_query = """      final collection = widget.isKermes ? 'kermes_orders' : 'meat_orders';
      final orderDoc = await FirebaseFirestore.instance
          .collection(collection)
          .doc(widget.orderId)
          .get();"""
content = content.replace(old_query, new_query)

with open("lib/screens/orders/order_chat_screen.dart", "w") as f:
    f.write(content)
