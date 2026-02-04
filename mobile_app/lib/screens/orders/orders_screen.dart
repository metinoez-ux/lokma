import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../providers/auth_provider.dart';
import '../../services/order_service.dart';
import 'rating_screen.dart';


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
        
        final sortedOrders = [...activeOrders, ...completedOrders];

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: sortedOrders.length,
          itemBuilder: (context, index) {
            final order = sortedOrders[index];
            return _OrderCard(order: order, isDark: isDark);
          },
        );
      },
    );
  }
}

class _OrderCard extends StatefulWidget {
  final LokmaOrder order;
  final bool isDark;

  const _OrderCard({required this.order, required this.isDark});

  @override
  State<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<_OrderCard> {
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
                            color: const Color(0xFFE53935),
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
                        'Sipariş No: ${order.id.substring(0, 6).toUpperCase()}',
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
                      const SizedBox(height: 4),
                      // "Siparişi Görüntüle" link
                      Text(
                        'Siparişi Görüntüle',
                        style: TextStyle(
                          color: textColor,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
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
          
          // Buttons row - Lieferando style thin pills
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
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
                      context.push('/kasap/${order.butcherId}');
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
