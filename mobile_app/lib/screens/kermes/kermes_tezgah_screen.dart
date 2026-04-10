import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import '../../utils/currency_utils.dart';

/// Kermes Tezgah Ekrani - Siparis Birlestirme Noktasi
/// Tum zone'lardan gelen hazir itemlari birlestirip teslimata yonlendirir:
/// - GelAl: Musteri cagrilir, tezgahtan teslim edilir
/// - Masa: Garson atanir, masaya goturulur
/// - Kurye: Kurye dispatch ekranina yonlendirilir
class KermesTezgahScreen extends ConsumerStatefulWidget {
  final String kermesId;
  final String kermesName;
  final String tezgahName; // "KT1", "ET1" vb.
  final List<String> allowedSections; // Bu tezgahin bagli oldugu bolumler

  const KermesTezgahScreen({
    super.key,
    required this.kermesId,
    required this.kermesName,
    required this.tezgahName,
    this.allowedSections = const [],
  });

  @override
  ConsumerState<KermesTezgahScreen> createState() => _KermesTezgahScreenState();
}

class _KermesTezgahScreenState extends ConsumerState<KermesTezgahScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Renkler
  static const Color lokmaPink = Color(0xFFEA184A);
  static const Color successGreen = Color(0xFF2E7D32);
  static const Color warningOrange = Color(0xFFE65100);
  static const Color preparingBlue = Color(0xFF1565C0);
  static const Color kuryePurple = Color(0xFF7B1FA2);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final orderService = ref.read(kermesOrderServiceProvider);



    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0A0A) : const Color(0xFFF0F0F0),
      body: Column(
        children: [
          // Tab bar - header disinda, beyaz/koyu arka planla
          Container(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            child: TabBar(
              controller: _tabController,
              indicatorColor: lokmaPink,
              labelColor: lokmaPink,
              unselectedLabelColor: Colors.grey,
              tabs: const [
                Tab(icon: Icon(Icons.shopping_bag_outlined, size: 18), text: 'Gel Al'),
                Tab(icon: Icon(Icons.table_restaurant_outlined, size: 18), text: 'Masa'),
                Tab(icon: Icon(Icons.delivery_dining_outlined, size: 18), text: 'Kurye'),
              ],
            ),
          ),
          Expanded(
            child: StreamBuilder<List<KermesOrder>>(
              stream: orderService.getTezgahOrdersStream(
                widget.kermesId,
                sectionFilter: widget.allowedSections.isNotEmpty ? widget.allowedSections : null,
              ),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: lokmaPink));
                }

                final allOrders = snapshot.data ?? [];

                // Teslimat tipine gore ayir
                final gelAlOrders = allOrders
                    .where((o) => o.deliveryType == DeliveryType.gelAl)
                    .toList();
                final masaOrders = allOrders
                    .where((o) => o.deliveryType == DeliveryType.masada)
                    .toList();
                final kuryeOrders = allOrders
                    .where((o) => o.deliveryType == DeliveryType.kurye)
                    .toList();

                return TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOrderList(gelAlOrders, 'Gel Al', Icons.shopping_bag_outlined, isDark),
                    _buildOrderList(masaOrders, 'Masa', Icons.table_restaurant_outlined, isDark),
                    _buildOrderList(kuryeOrders, 'Kurye', Icons.delivery_dining_outlined, isDark),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderList(
    List<KermesOrder> orders,
    String type,
    IconData icon,
    bool isDark,
  ) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: isDark ? Colors.white24 : Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              '$type siparisi yok',
              style: TextStyle(
                color: isDark ? Colors.white38 : Colors.grey.shade500,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    // Tamamen hazir olanlari ve hazirlananlar olarak ayir
    final readyOrders = orders.where((o) => o.isFullyReady).toList();
    final preparingOrders = orders.where((o) => !o.isFullyReady).toList();

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // TAM HAZIR
        if (readyOrders.isNotEmpty) ...[
          _buildSectionHeader(
            'TESLIME HAZIR (${readyOrders.length})',
            successGreen,
            Icons.check_circle,
            isDark,
          ),
          const SizedBox(height: 8),
          ...readyOrders.map((order) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildTezgahOrderCard(order, isDark, isReady: true),
              )),
        ],
        // HAZIRLANIYOR
        if (preparingOrders.isNotEmpty) ...[
          const SizedBox(height: 8),
          _buildSectionHeader(
            'HAZIRLANIYOR (${preparingOrders.length})',
            warningOrange,
            Icons.restaurant,
            isDark,
          ),
          const SizedBox(height: 8),
          ...preparingOrders.map((order) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildTezgahOrderCard(order, isDark, isReady: false),
              )),
        ],
      ],
    );
  }

  Widget _buildSectionHeader(String title, Color color, IconData icon, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  /// Tezgah siparis karti
  Widget _buildTezgahOrderCard(KermesOrder order, bool isDark, {required bool isReady}) {
    final waitMinutes = DateTime.now().difference(order.createdAt).inMinutes;

    // Aciliyet rengi
    Color urgencyColor;
    if (waitMinutes >= 15) {
      urgencyColor = Colors.red;
    } else if (waitMinutes >= 8) {
      urgencyColor = warningOrange;
    } else {
      urgencyColor = isDark ? Colors.white70 : Colors.black54;
    }

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isReady
            ? Border.all(color: successGreen.withOpacity(0.5), width: 2)
            : waitMinutes >= 15
                ? Border.all(color: Colors.red, width: 2)
                : null,
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: (isReady ? successGreen : lokmaPink).withOpacity(isDark ? 0.15 : 0.06),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                // Siparis numarasi
                Text(
                  '#${order.orderNumber}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 10),
                // Teslimat badge
                _buildDeliveryBadge(order, isDark),
                const Spacer(),
                // Ilerleme gostergesi
                if (!isReady) ...[
                  Text(
                    '${order.readyItemCount}/${order.totalItemCount}',
                    style: TextStyle(
                      color: preparingBlue,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                // Bekleme suresi
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: urgencyColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.timer, size: 14, color: urgencyColor),
                      const SizedBox(width: 4),
                      Text(
                        '${waitMinutes}dk',
                        style: TextStyle(
                          color: urgencyColor,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Musteri bilgisi
          if (order.customerName.isNotEmpty || order.tableNumber != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
              child: Row(
                children: [
                  if (order.customerName.isNotEmpty) ...[
                    Icon(Icons.person_outline, size: 14,
                        color: isDark ? Colors.white54 : Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      order.customerName,
                      style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black54,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                  if (order.tableNumber != null) ...[
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: lokmaPink.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'M${order.tableNumber}',
                        style: const TextStyle(
                          color: lokmaPink,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                  if (order.tableSection != null) ...[
                    const SizedBox(width: 6),
                    Text(
                      order.tableSection!,
                      style: TextStyle(
                        color: isDark ? Colors.white38 : Colors.grey,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),

          // Item listesi
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              children: order.items.asMap().entries.map((entry) {
                final item = entry.value;
                return _buildTezgahItem(item, isDark);
              }).toList(),
            ),
          ),

          // Toplam tutar
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 6),
            child: Row(
              children: [
                Text(
                  'Toplam',
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.grey,
                    fontSize: 12,
                  ),
                ),
                const Spacer(),
                Text(
                  '${order.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

          // Aksiyon butonu (sadece tam hazir siparisler icin)
          if (isReady)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
              child: _buildActionButton(order, isDark),
            ),

          // Hazirlanan siparisler icin ilerleme cubugu
          if (!isReady)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: order.readyProgress,
                  backgroundColor: isDark ? Colors.white12 : Colors.grey.shade200,
                  valueColor: const AlwaysStoppedAnimation<Color>(preparingBlue),
                  minHeight: 6,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDeliveryBadge(KermesOrder order, bool isDark) {
    IconData icon;
    Color color;
    String label;

    switch (order.deliveryType) {
      case DeliveryType.gelAl:
        icon = Icons.shopping_bag_outlined;
        color = successGreen;
        label = 'Gel Al';
      case DeliveryType.masada:
        icon = Icons.table_restaurant_outlined;
        color = preparingBlue;
        label = 'Masa';
      case DeliveryType.kurye:
        icon = Icons.delivery_dining_outlined;
        color = kuryePurple;
        label = 'Kurye';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.2 : 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTezgahItem(KermesOrderItem item, bool isDark) {
    final isItemReady = item.isReady;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          // Statu ikonu
          Icon(
            isItemReady ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 18,
            color: isItemReady ? successGreen : warningOrange,
          ),
          const SizedBox(width: 8),
          // Miktar ve isim
          Expanded(
            child: Text(
              '${item.quantity}x ${item.name}',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 14,
                fontWeight: FontWeight.w600,
                decoration: isItemReady ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          // PrepZone badge
          if (item.prepZones.isNotEmpty)
            Wrap(
              spacing: 4,
              children: item.prepZones.map((zone) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: _getZoneColor(zone).withOpacity(isDark ? 0.2 : 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  zone,
                  style: TextStyle(
                    color: _getZoneColor(zone),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )).toList(),
            ),
        ],
      ),
    );
  }

  /// Teslimat tipine gore aksiyon butonu
  Widget _buildActionButton(KermesOrder order, bool isDark) {
    switch (order.deliveryType) {
      case DeliveryType.gelAl:
        return _buildFullWidthButton(
          label: 'TESLIM ET',
          icon: Icons.check_circle_outline,
          color: successGreen,
          onTap: () => _deliverOrder(order),
        );
      case DeliveryType.masada:
        if (order.assignedWaiterName != null) {
          return Column(
            children: [
              Row(
                children: [
                  Icon(Icons.person, size: 14, color: preparingBlue),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Garson: ${order.assignedWaiterName}',
                      style: TextStyle(
                        color: preparingBlue,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              _buildFullWidthButton(
                label: 'TESLIM EDILDI',
                icon: Icons.check_circle_outline,
                color: successGreen,
                onTap: () => _deliverOrder(order),
              ),
            ],
          );
        }
        return _buildFullWidthButton(
          label: 'GARSONA VER',
          icon: Icons.person_add_outlined,
          color: preparingBlue,
          onTap: () => _showWaiterSelector(order),
        );
      case DeliveryType.kurye:
        return _buildFullWidthButton(
          label: 'KURYE HAZIR',
          icon: Icons.delivery_dining_outlined,
          color: kuryePurple,
          onTap: () => _markReadyForCourier(order),
        );
    }
  }

  Widget _buildFullWidthButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ==========================================================
  // AKSIYONLAR
  // ==========================================================

  /// GelAl / Masa teslimi
  Future<void> _deliverOrder(KermesOrder order) async {
    HapticFeedback.heavyImpact();
    try {
      final orderService = ref.read(kermesOrderServiceProvider);
      await orderService.markAsDeliveredFromTezgah(order.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('#${order.orderNumber} teslim edildi'),
            backgroundColor: successGreen,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Garson secim dialog'u
  Future<void> _showWaiterSelector(KermesOrder order) async {
    HapticFeedback.mediumImpact();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Basitlesterilmis: garson adi girilir
    final waiterNameController = TextEditingController();

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Garson Sec',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '#${order.orderNumber} - Masa M${order.tableNumber ?? "?"}',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.grey,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: waiterNameController,
              autofocus: true,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
              decoration: InputDecoration(
                hintText: 'Garson adi',
                hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.grey),
                prefixIcon: const Icon(Icons.person_outline, color: lokmaPink),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: lokmaPink),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Iptal',
              style: TextStyle(color: isDark ? Colors.white54 : Colors.grey),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              final name = waiterNameController.text.trim();
              if (name.isNotEmpty) Navigator.pop(ctx, name);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: preparingBlue,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Ata', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      try {
        final orderService = ref.read(kermesOrderServiceProvider);
        await orderService.assignWaiter(
          orderId: order.id,
          waiterId: 'manual_${DateTime.now().millisecondsSinceEpoch}',
          waiterName: result,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('#${order.orderNumber} -> Garson: $result'),
              backgroundColor: preparingBlue,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  /// Kurye hazir isaretle
  Future<void> _markReadyForCourier(KermesOrder order) async {
    HapticFeedback.heavyImpact();
    try {
      final orderService = ref.read(kermesOrderServiceProvider);
      await orderService.markReadyForCourier(order.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('#${order.orderNumber} kurye icin hazir'),
            backgroundColor: kuryePurple,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  /// Zone rengi
  Color _getZoneColor(String zone) {
    final lower = zone.toLowerCase();
    if (lower.contains('kadin') || lower.contains('frauen') || lower.startsWith('k')) {
      return const Color(0xFFE91E63);
    } else if (lower.contains('erkek') || lower.contains('mann') || lower.startsWith('e')) {
      return const Color(0xFF1565C0);
    } else if (lower.contains('grill') || lower.contains('barbeku')) {
      return const Color(0xFFE65100);
    } else if (lower.contains('icecek') || lower.contains('getrank')) {
      return const Color(0xFF00838F);
    } else if (lower.contains('tatli') || lower.contains('dessert')) {
      return const Color(0xFF8E24AA);
    }
    return lokmaPink;
  }
}
