with open("lib/screens/orders/order_chat_screen.dart", "r") as f:
    content = f.read()

content = content.replace("_chatService.markAllAsRead(widget.orderId, user.uid);", "_chatService.markAllAsRead(widget.orderId, user.uid, isKermes: widget.isKermes);")
content = content.replace("_chatService.getMessagesStream(widget.orderId),", "_chatService.getMessagesStream(widget.orderId, isKermes: widget.isKermes),")
content = content.replace("text: text,", "text: text,\n      isKermes: widget.isKermes,")

with open("lib/screens/orders/order_chat_screen.dart", "w") as f:
    f.write(content)
