with open("lib/services/chat_service.dart", "r") as f:
    content = f.read()

# Update sendMessage
content = content.replace("required String text,", "required String text,\n    bool isKermes = false,")
content = content.replace(".collection('meat_orders')", ".collection(isKermes ? 'kermes_orders' : 'meat_orders')")

# Update getMessagesStream
content = content.replace("Stream<List<ChatMessage>> getMessagesStream(String orderId) {", "Stream<List<ChatMessage>> getMessagesStream(String orderId, {bool isKermes = false}) {")

# Update markAllAsRead
content = content.replace("Future<void> markAllAsRead(String orderId, String userId) async {", "Future<void> markAllAsRead(String orderId, String userId, {bool isKermes = false}) async {")

# Update getUnreadCountStream
content = content.replace("Stream<int> getUnreadCountStream(String orderId, String userId) {", "Stream<int> getUnreadCountStream(String orderId, String userId, {bool isKermes = false}) {")

with open("lib/services/chat_service.dart", "w") as f:
    f.write(content)
