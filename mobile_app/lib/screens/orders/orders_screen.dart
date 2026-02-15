import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../models/butcher_product.dart';
import '../../models/product_option.dart';
import '../../services/order_service.dart';
import 'rating_screen.dart';
import 'courier_tracking_screen.dart';


class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  static const Color lokmaOrange = Color(0xFFFF8000);

  bool _isActiveOrder(OrderStatus status) {
    return status == OrderStatus.pending ||
           status == OrderStatus.accepted ||
           status == OrderStatus.preparing ||
           status == OrderStatus.ready ||
           status == OrderStatus.served ||
           status == OrderStatus.onTheWay;
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final userId = authState.user?.uid;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    final bgColor = isDark ? Colors.black : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.grey[400] : Colors.grey[600];
    final cardColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'Siparişlerim',
          style: TextStyle(
            color: textColor,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios, color: textColor, size: 20),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/restoran');
            }
          },
        ),
      ),
      body: _buildOrdersList(userId, cardColor, textColor, subtitleColor, isDark),
    );
  }

  Widget _buildOrdersList(String? userId, Color cardColor, Color textColor, Color? subtitleColor, bool isDark) {
    if (userId == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.login, size: 64, color: subtitleColor),
            const SizedBox(height: 16),
            Text(
              'Siparişlerinizi görmek için giriş yapın',
              style: TextStyle(color: subtitleColor, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: lokmaOrange,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              ),
              onPressed: () => context.go('/profile'),
              child: const Text('Giriş Yap', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    final orderService = OrderService();

    return StreamBuilder<List<LokmaOrder>>(
      stream: orderService.getUserOrdersStream(userId),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Text(
              'Hata: ${snapshot.error}',
              style: const TextStyle(color: Colors.red),
            ),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: CircularProgressIndicator(color: lokmaOrange),
          );
        }

        final allOrders = snapshot.data ?? [];
        
        if (allOrders.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.receipt_long_outlined, size: 64, color: subtitleColor),
                const SizedBox(height: 16),
                Text(
                  'Henüz siparişiniz yok',
                  style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'Sipariş vermek için bir işletme seçin!',
                  style: TextStyle(color: subtitleColor, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        // Sort: active orders first (by createdAt desc), then completed (by createdAt desc)
        final activeOrders = allOrders.where((o) => _isActiveOrder(o.status)).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        final completedOrders = allOrders.where((o) => !_isActiveOrder(o.status)).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

        return ListView(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
          children: [
            // Active orders — shown normally
            if (activeOrders.isNotEmpty) ...[
              for (final order in activeOrders)
                _OrderCard(order: order, isDark: isDark),
            ] else ...[
              // No active orders message
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.check_circle_outline, size: 48, color: Colors.green[300]),
                      const SizedBox(height: 12),
                      Text(
                        'Aktif siparişiniz yok',
                        style: TextStyle(color: subtitleColor, fontSize: 15, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            // Past orders — collapsed section
            if (completedOrders.isNotEmpty) ...[
              const SizedBox(height: 8),
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  initiallyExpanded: false,
                  tilePadding: const EdgeInsets.symmetric(horizontal: 4),
                  title: Row(
                    children: [
                      Icon(Icons.history, size: 20, color: subtitleColor),
                      const SizedBox(width: 8),
                      Text(
                        'Geçmiş Siparişler (${completedOrders.length})',
                        style: TextStyle(
                          color: textColor,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  children: [
                    for (final order in completedOrders)
                      _OrderCard(order: order, isDark: isDark),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _OrderCard extends ConsumerStatefulWidget {
  final LokmaOrder order;
  final bool isDark;

  const _OrderCard({required this.order, required this.isDark});

  @override
  ConsumerState<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<_OrderCard> {
  static const Color lokmaOrange = Color(0xFFFF8000);
  String? _businessImageUrl;
  bool? _isTuna;

  @override
  void initState() {
    super.initState();
    _loadBusinessInfo();
  }

  Future<void> _loadBusinessInfo() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.order.butcherId)
          .get();
      if (doc.exists && mounted) {
        final data = doc.data();
        setState(() {
          _businessImageUrl = data?['imageUrl'] ?? data?['logoUrl'];
          // Check all possible TUNA indicators
          _isTuna = data?['isTuna'] == true || 
                    data?['isTunaPartner'] == true ||
                    data?['isTunaApproved'] == true ||
                    data?['brand']?.toString().toLowerCase() == 'tuna' ||
                    (data?['name']?.toString().toLowerCase().contains('tuna') ?? false) ||
                    (data?['companyName']?.toString().toLowerCase().contains('tuna') ?? false);
        });
      }
    } catch (e) {
      debugPrint('Error loading business info: $e');
    }
  }


  Color _getStatusColor(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return Colors.orange;
      case OrderStatus.accepted:
        return Colors.blue;
      case OrderStatus.preparing:
        return Colors.purple;
      case OrderStatus.ready:
        return Colors.green;
      case OrderStatus.served:
        return Colors.teal;
      case OrderStatus.onTheWay:
        return Colors.teal;
      case OrderStatus.delivered:
        return Colors.green;
      case OrderStatus.cancelled:
        return Colors.red;
    }
  }

  String _getStatusText(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return 'Beklemede';
      case OrderStatus.accepted:
        return 'Onaylandı';
      case OrderStatus.preparing:
        return 'Hazırlanıyor';
      case OrderStatus.ready:
        return 'Hazır';
      case OrderStatus.served:
        return 'Servis Edildi';
      case OrderStatus.onTheWay:
        return 'Yolda';
      case OrderStatus.delivered:
        return 'Teslim Edildi';
      case OrderStatus.cancelled:
        return 'İptal';
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    
    if (diff.inDays == 0) {
      return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year.toString().substring(2)} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (diff.inDays == 1) {
      return 'Dün';
    } else {
      return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year.toString().substring(2)}';
    }
  }

  IconData _getDeliveryTypeIcon(String? type) {
    switch (type) {
      case 'personal_handoff':
        return Icons.person;
      case 'handed_to_other':
        return Icons.people;
      case 'left_at_door':
        return Icons.door_front_door;
      default:
        return Icons.check_circle;
    }
  }

  String _getDeliveryTypeText(String? type) {
    switch (type) {
      case 'personal_handoff':
        return '✓ Bizzat teslim edildi';
      case 'handed_to_other':
        return '✓ Başka birine teslim edildi';
      case 'left_at_door':
        return '📸 Kapıya bırakıldı';
      default:
        return '✓ Teslim edildi';
    }
  }

  void _showProofPhoto(BuildContext context, String photoUrl) {
    showDialog(
      context: context,
      builder: (dialogContext) => Dialog(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppBar(
              title: const Text('Teslimat Fotoğrafı'),
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(dialogContext),
                ),
              ],
            ),
            Image.network(
              photoUrl,
              fit: BoxFit.contain,
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return const SizedBox(
                  height: 200,
                  child: Center(child: CircularProgressIndicator()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showOrderDetails() {
    final order = widget.order;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollCtrl) => Container(
          padding: const EdgeInsets.all(20),
          child: ListView(
            controller: scrollCtrl,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // Receipt header
              Center(
                child: Text(
                  'Sipariş Detayı',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  'Sipariş No: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  _formatDate(order.createdAt),
                  style: TextStyle(color: Colors.grey[500], fontSize: 12),
                ),
              ),
              const Divider(height: 24),
              // Business name
              Row(
                children: [
                  Icon(Icons.store, size: 18, color: Colors.orange[700]),
                  const SizedBox(width: 8),
                  Text(
                    order.butcherName,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Unavailable items warning banner
              if (order.unavailableItems.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red[200]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.red[700], size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${order.unavailableItems.length} ürün mevcut değil',
                          style: TextStyle(fontSize: 13, color: Colors.red[700], fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              // Items
              ...order.items.asMap().entries.map((entry) {
                final idx = entry.key;
                final item = entry.value;
                final posNum = item.positionNumber ?? (idx + 1);
                // Check if this item is in the unavailable list
                final isUnavailable = order.unavailableItems.any(
                  (u) => (u['positionNumber'] as int?) == posNum,
                );
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Position badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            margin: const EdgeInsets.only(right: 8, top: 1),
                            decoration: BoxDecoration(
                              color: isUnavailable ? Colors.red[400] : const Color(0xFFFF8000),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '#$posNum',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          // Quantity
                          SizedBox(
                            width: 26,
                            child: Text(
                              '${item.quantity.toStringAsFixed(item.quantity == item.quantity.roundToDouble() ? 0 : 1)}x',
                              style: TextStyle(
                                color: isUnavailable ? Colors.red[300] : Colors.grey[600],
                                fontSize: 13,
                                decoration: isUnavailable ? TextDecoration.lineThrough : null,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              item.name,
                              style: TextStyle(
                                fontSize: 14,
                                color: isUnavailable ? Colors.red[300] : null,
                                decoration: isUnavailable ? TextDecoration.lineThrough : null,
                              ),
                            ),
                          ),
                          if (isUnavailable)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              margin: const EdgeInsets.only(left: 4),
                              decoration: BoxDecoration(
                                color: Colors.red[50],
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.red[200]!),
                              ),
                              child: Text(
                                '❌ Mevcut Değil',
                                style: TextStyle(fontSize: 10, color: Colors.red[700], fontWeight: FontWeight.w600),
                              ),
                            )
                          else
                            Text(
                              '€${(item.price * item.quantity).toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                            ),
                        ],
                      ),
                      // Item note
                      if (item.itemNote != null && item.itemNote!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(left: 40, top: 2),
                          child: Text(
                            '📝 ${item.itemNote}',
                            style: TextStyle(fontSize: 12, color: Colors.orange[400]),
                          ),
                        ),
                    ],
                  ),
                );
              }),
              const Divider(height: 16),
              // Total
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Toplam', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(
                    '€${order.totalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Delivery address
              if (order.deliveryAddress != null && order.deliveryAddress!.isNotEmpty) ...[
                const Divider(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.location_on, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        order.deliveryAddress!,
                        style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                      ),
                    ),
                  ],
                ),
              ],
              // Notes
              if (order.notes != null && order.notes!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.note, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        order.notes!,
                        style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                      ),
                    ),
                  ],
                ),
              ],
              // Payment method
              if (order.paymentMethod != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.payment, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 6),
                    Text(
                      order.paymentMethod == 'cash' ? 'Nakit Ödeme' : order.paymentMethod == 'card' ? 'Kart ile Ödeme' : 'Online Ödeme',
                      style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ],
              // Status
              const SizedBox(height: 12),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: _getStatusColor(order.status).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _getStatusText(order.status),
                    style: TextStyle(
                      color: _getStatusColor(order.status),
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrderModeTag(OrderType type, bool isDark) {
    final IconData icon;
    final String label;
    final Color color;

    switch (type) {
      case OrderType.delivery:
        icon = Icons.delivery_dining;
        label = 'Kurye';
        color = const Color(0xFF2196F3); // Blue
      case OrderType.pickup:
        icon = Icons.storefront;
        label = 'Gel Al';
        color = const Color(0xFFFF9800); // Orange
      case OrderType.dineIn:
        icon = Icons.restaurant;
        label = 'Masa';
        color = const Color(0xFF9C27B0); // Purple
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.2 : 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.4), width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final isDark = widget.isDark;
    
    final cardColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.grey[400] : Colors.grey[600];
    final dividerColor = isDark ? Colors.grey.shade800 : Colors.grey.shade200;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: isDark ? null : Border.all(color: dividerColor),
        boxShadow: isDark ? null : [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with business info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Business image with TUNA badge
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: _businessImageUrl != null && _businessImageUrl!.isNotEmpty
                          ? Image.network(
                              _businessImageUrl!,
                              width: 90,
                              height: 64,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 90,
                                height: 64,
                                color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                                child: Icon(Icons.restaurant, color: subtitleColor, size: 28),
                              ),
                            )
                          : Container(
                              width: 90,
                              height: 64,
                              color: isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                              child: Icon(Icons.restaurant, color: subtitleColor, size: 28),
                            ),
                    ),
                    // TUNA badge
                    if (_isTuna == true)
                      Positioned(
                        bottom: 4,
                        left: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFB335B),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'TUNA',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                // Business info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Order number
                      Text(
                        'Sipariş No: ${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                        style: TextStyle(
                          color: subtitleColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      // Business name
                      Text(
                        order.butcherName,
                        style: TextStyle(
                          color: textColor,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      // Status and date
                      Text(
                        '${_getStatusText(order.status)} • ${_formatDate(order.createdAt)}',
                        style: TextStyle(color: subtitleColor, fontSize: 13),
                      ),
                      const SizedBox(height: 6),
                      // Order mode tag (Kurye / Gel Al / Masa)
                      _buildOrderModeTag(order.orderType, isDark),
                      const SizedBox(height: 6),
                      // "Siparişi Görüntüle" link
                      GestureDetector(
                        onTap: _showOrderDetails,
                        child: Text(
                          'Siparişi Görüntüle',
                          style: TextStyle(
                            color: textColor,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      // Items and price
                      Text(
                        '${order.items.length} ürün • €${order.totalAmount.toStringAsFixed(2)}',
                        style: TextStyle(color: subtitleColor, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusColor(order.status).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _getStatusText(order.status),
                    style: TextStyle(
                      color: _getStatusColor(order.status),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Delivery Proof Section - for delivered orders with proof
          if (order.status == OrderStatus.delivered && order.deliveryProof != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? Colors.green.shade900.withOpacity(0.3) : Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green.shade300, width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Delivery type header
                    Row(
                      children: [
                        Icon(
                          _getDeliveryTypeIcon(order.deliveryProof!['type'] as String?),
                          color: Colors.green,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _getDeliveryTypeText(order.deliveryProof!['type'] as String?),
                          style: TextStyle(
                            color: isDark ? Colors.green.shade300 : Colors.green.shade700,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                    // Proof photo if exists
                    if (order.deliveryProof!['photoUrl'] != null) ...[
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: InkWell(
                          onTap: () => _showProofPhoto(context, order.deliveryProof!['photoUrl'] as String),
                          child: Image.network(
                            order.deliveryProof!['photoUrl'] as String,
                            height: 120,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return Container(
                                height: 120,
                                color: Colors.grey.shade200,
                                child: const Center(child: CircularProgressIndicator()),
                              );
                            },
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                height: 60,
                                color: Colors.grey.shade200,
                                child: const Center(child: Icon(Icons.broken_image)),
                              );
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Fotoğrafı büyütmek için dokunun',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
          
          // Buttons row - Lieferando style thin pills
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                // Kuryeyi Takip Et button - only for onTheWay orders
                if (order.status == OrderStatus.onTheWay) ...[
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => CourierTrackingScreen(orderId: order.id),
                          ),
                        );
                      },
                      icon: const Icon(Icons.location_on, size: 20),
                      label: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Kuryeyi Takip Et'),
                          if (order.etaMinutes != null) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '~${order.etaMinutes} dk',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ],
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.teal,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(22),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                // Puan Ver button
                SizedBox(
                  width: double.infinity,
                  height: 40,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => RatingScreen(
                            orderId: order.id,
                            businessId: order.butcherId,
                            businessName: order.butcherName,
                            userId: order.userId,
                            orderStatus: order.status.name,
                          ),

                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade200,
                      foregroundColor: isDark ? Colors.white : Colors.black,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      padding: EdgeInsets.zero,
                    ),
                    child: Text(
                      'Puan Ver',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                // Tekrar Sipariş Ver button
                SizedBox(
                  width: double.infinity,
                  height: 40,
                  child: ElevatedButton(
                    onPressed: () {
                      // Reorder: reconstruct cart items from order data
                      final cartNotifier = ref.read(cartProvider.notifier);
                      cartNotifier.clearCart();

                      for (final item in order.items) {
                        // Reconstruct ButcherProduct from stored order item data
                        final product = ButcherProduct(
                          butcherId: order.butcherId,
                          id: item.sku,
                          sku: item.sku,
                          masterId: '',
                          name: item.name,
                          description: '',
                          category: '',
                          price: item.price,
                          unitType: item.unit,
                          imageUrl: item.imageUrl,
                          minQuantity: item.unit == 'kg' ? 0.5 : 1.0,
                          stepQuantity: item.unit == 'kg' ? 0.5 : 1.0,
                        );

                        // Reconstruct selected options (Dönertasche, küçük, ohne Zwiebel etc.)
                        final selectedOpts = item.selectedOptions
                            .map((o) => SelectedOption.fromMap(o))
                            .toList();

                        cartNotifier.addToCart(
                          product,
                          item.quantity,
                          order.butcherId,
                          order.butcherName,
                          selectedOptions: selectedOpts,
                          note: item.itemNote,
                        );
                      }

                      // Navigate directly to cart screen — ready for checkout
                      context.push('/cart');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? const Color(0xFF3A3A3C) : const Color(0xFF1A1A1A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      padding: EdgeInsets.zero,
                    ),
                    child: const Text(
                      'Tekrar Sipariş Ver',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
