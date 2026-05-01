import 'package:cloud_firestore/cloud_firestore.dart';

/// Chat message model for order-based messaging
class ChatMessage {
  final String id;
  final String senderId;
  final String senderName;
  final String senderRole; // 'customer', 'courier', 'business'
  final String text;
  final DateTime createdAt;
  final bool read;

  ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.text,
    required this.createdAt,
    this.read = false,
  });

  factory ChatMessage.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ChatMessage(
      id: doc.id,
      senderId: data['senderId'] ?? '',
      senderName: data['senderName'] ?? '',
      senderRole: data['senderRole'] ?? 'customer',
      text: data['text'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      read: data['read'] ?? false,
    );
  }
}

/// Chat Service — handles order-based messaging via Firestore sub-collection
class ChatService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Send a message in an order's chat
  Future<void> sendMessage({
    required String orderId,
    required String senderId,
    required String senderName,
    required String senderRole,
    required String text,
    bool isKermes = false,
  }) async {
    await _db
        .collection(isKermes ? 'kermes_orders' : 'meat_orders')
        .doc(orderId)
        .collection('messages')
        .add({
      'senderId': senderId,
      'senderName': senderName,
      'senderRole': senderRole,
      'text': text,
      'createdAt': FieldValue.serverTimestamp(),
      'read': false,
    });

    // Update order document with last message info for quick preview
    await _db.collection(isKermes ? 'kermes_orders' : 'meat_orders').doc(orderId).update({
      'lastMessage': text,
      'lastMessageAt': FieldValue.serverTimestamp(),
      'lastMessageBy': senderRole,
    });
  }

  /// Get real-time message stream for an order
  Stream<List<ChatMessage>> getMessagesStream(String orderId, {bool isKermes = false}) {
    return _db
        .collection(isKermes ? 'kermes_orders' : 'meat_orders')
        .doc(orderId)
        .collection('messages')
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => ChatMessage.fromFirestore(doc))
            .toList());
  }

  /// Mark all messages as read for a specific user
  Future<void> markAllAsRead(String orderId, String userId, {bool isKermes = false}) async {
    final unread = await _db
        .collection(isKermes ? 'kermes_orders' : 'meat_orders')
        .doc(orderId)
        .collection('messages')
        .where('read', isEqualTo: false)
        .where('senderId', isNotEqualTo: userId)
        .get();

    final batch = _db.batch();
    for (final doc in unread.docs) {
      batch.update(doc.reference, {'read': true});
    }
    await batch.commit();
  }

  /// Get unread message count for an order (for badge display)
  Stream<int> getUnreadCountStream(String orderId, String userId, {bool isKermes = false}) {
    return _db
        .collection(isKermes ? 'kermes_orders' : 'meat_orders')
        .doc(orderId)
        .collection('messages')
        .where('read', isEqualTo: false)
        .where('senderId', isNotEqualTo: userId)
        .snapshots()
        .map((snapshot) => snapshot.docs.length);
  }
}
