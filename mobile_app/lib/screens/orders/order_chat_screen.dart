import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../services/chat_service.dart';
import 'package:flutter/services.dart';

/// Order Chat Screen — WhatsApp-style bubble chat for order communication
class OrderChatScreen extends StatefulWidget {
  final String orderId;
  final String orderNumber;
  final String recipientName; // "Kurye: Mehmet" or "İşletme: LOKMA"
  final String recipientRole;
  final bool isKermes; // 'courier' or 'business'

  const OrderChatScreen({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.recipientName,
    this.recipientRole = 'courier',
    this.isKermes = false,
  });

  @override
  State<OrderChatScreen> createState() => _OrderChatScreenState();
}

class _OrderChatScreenState extends State<OrderChatScreen> {
  final ChatService _chatService = ChatService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  String? _currentUserId;
  String? _currentUserName;
  String _currentUserRole = 'customer';

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
  }

  Future<void> _loadCurrentUser() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _currentUserId = user.uid;

      // Check if user is the courier for this order
      final collection = widget.isKermes ? 'kermes_orders' : 'meat_orders';
      final orderDoc = await FirebaseFirestore.instance
          .collection(collection)
          .doc(widget.orderId)
          .get();

      if (orderDoc.exists) {
        final data = orderDoc.data()!;
        if (data['courierId'] == user.uid) {
          _currentUserRole = 'courier';
          _currentUserName = data['courierName'] ?? user.displayName ?? tr('common.courier');
        } else if (data['butcherId'] == user.uid) {
          _currentUserRole = 'business';
          _currentUserName = data['butcherName'] ?? tr('common.business');
        } else {
          _currentUserRole = 'customer';
          _currentUserName = data['userName'] ?? user.displayName ?? tr('common.customer');
        }
      }

      // Mark messages as read
      _chatService.markAllAsRead(widget.orderId, user.uid, isKermes: widget.isKermes);
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty || _currentUserId == null) return;

    _chatService.sendMessage(
      orderId: widget.orderId,
      senderId: _currentUserId!,
      senderName: _currentUserName ?? tr('common.user'),
      senderRole: _currentUserRole,
      text: text,
      isKermes: widget.isKermes,
    );

    _messageController.clear();
    _focusNode.requestFocus();
    HapticFeedback.lightImpact();

    // Scroll to bottom after a short delay
    Future.delayed(const Duration(milliseconds: 300), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A2E),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.recipientName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              'orders.order_number'.tr(args: [widget.orderNumber]),
              style: TextStyle(
                color: Colors.white.withOpacity(0.6),
                fontSize: 12,
              ),
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          // Messages list
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: _chatService.getMessagesStream(widget.orderId, isKermes: widget.isKermes),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  print('Chat stream error: ${snapshot.error}');
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, color: Colors.red, size: 48),
                        const SizedBox(height: 16),
                        Text('Mesajlar yüklenemedi: ${snapshot.error}', style: const TextStyle(color: Colors.red)),
                      ],
                    ),
                  );
                }
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(
                    child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
                  );
                }

                final messages = snapshot.data ?? [];

                if (messages.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.chat_bubble_outline,
                          size: 64,
                          color: Colors.white.withOpacity(0.2),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          tr('common.no_messages'),
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.5),
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          tr('common.send_first_message'),
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.3),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                // Auto-scroll when new messages arrive
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scrollController.hasClients) {
                    _scrollController.animateTo(
                      _scrollController.position.maxScrollExtent,
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOut,
                    );
                  }
                });

                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    return _buildMessageBubble(messages[index], index > 0 ? messages[index - 1] : null);
                  },
                );
              },
            ),
          ),

          // Input area
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage message, ChatMessage? previousMessage) {
    final isMe = message.senderId == _currentUserId;
    final showSenderName = !isMe &&
        (previousMessage == null || previousMessage.senderId != message.senderId);

    // Role-based colors
    Color bubbleColor;
    Color senderColor;
    switch (message.senderRole) {
      case 'courier':
        bubbleColor = isMe ? const Color(0xFF2D8B4E) : const Color(0xFF1A3D2A);
        senderColor = const Color(0xFF4CAF50);
        break;
      case 'business':
        bubbleColor = isMe ? const Color(0xFF8B2D2D) : const Color(0xFF3D1A1A);
        senderColor = Theme.of(context).colorScheme.primary;
        break;
      default: // customer
        bubbleColor = isMe ? const Color(0xFF2D4A8B) : const Color(0xFF1A2A3D);
        senderColor = const Color(0xFF42A5F5);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(
        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (showSenderName)
            Padding(
              padding: EdgeInsets.only(
                left: isMe ? 0 : 12,
                right: isMe ? 12 : 0,
                bottom: 4,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _getRoleIcon(message.senderRole),
                    size: 12,
                    color: senderColor,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    message.senderName,
                    style: TextStyle(
                      color: senderColor,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          Row(
            mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
            children: [
              Container(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.75,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: bubbleColor,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16),
                    topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(isMe ? 16 : 4),
                    bottomRight: Radius.circular(isMe ? 4 : 16),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      message.text,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${message.createdAt.hour.toString().padLeft(2, '0')}:${message.createdAt.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.5),
                            fontSize: 11,
                          ),
                        ),
                        if (isMe) ...[
                          const SizedBox(width: 4),
                          Icon(
                            message.read ? Icons.done_all : Icons.done,
                            size: 14,
                            color: message.read
                                ? const Color(0xFF42A5F5)
                                : Colors.white.withOpacity(0.5),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getRoleIcon(String role) {
    switch (role) {
      case 'courier':
        return Icons.delivery_dining;
      case 'business':
        return Icons.store;
      default:
        return Icons.person;
    }
  }

  Widget _buildInputArea() {
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        top: 10,
        bottom: MediaQuery.of(context).padding.bottom + 10,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        border: Border(
          top: BorderSide(color: Color(0xFF2A2A3E), width: 0.5),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0D0D1A),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: const Color(0xFF2A2A3E),
                  width: 0.5,
                ),
              ),
              child: TextField(
                controller: _messageController,
                focusNode: _focusNode,
                style: const TextStyle(color: Colors.white, fontSize: 15),
                maxLines: 4,
                minLines: 1,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _sendMessage(),
                decoration: InputDecoration(
                  hintText: tr('common.write_message'),
                  hintStyle: TextStyle(
                    color: Colors.white.withOpacity(0.3),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  border: InputBorder.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Theme.of(context).colorScheme.primary, const Color(0xFFFF4444)],
              ),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
              onPressed: _sendMessage,
            ),
          ),
        ],
      ),
    );
  }
}
