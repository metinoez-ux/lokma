import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';


/// Kermes KDS (Kitchen Display System) Ekrani
/// Zone-bazli mutfak gorunumu: Her hazirlik alani (prepZone) kendi siparislerini gorur
/// Tablet-optimized, buyuk butonlar, sesli uyari destegi
class KermesKDSScreen extends ConsumerStatefulWidget {
  final String kermesId;
  final String kermesName;
  final String zone; // Bu KDS ekraninin zone'u (ornegin "Kadin Mutfagi")
  final List<String> allZones; // Tum zone listesi (tab degistirmek icin)

  const KermesKDSScreen({
    super.key,
    required this.kermesId,
    required this.kermesName,
    required this.zone,
    this.allZones = const [],
  });

  @override
  ConsumerState<KermesKDSScreen> createState() => _KermesKDSScreenState();
}

class _KermesKDSScreenState extends ConsumerState<KermesKDSScreen> {
  late String _activeZone;
  Set<String> _previousOrderIds = {};

  // Renkler
  static const Color lokmaPink = Color(0xFFEA184A);
  static const Color successGreen = Color(0xFF2E7D32);
  static const Color warningOrange = Color(0xFFE65100);
  static const Color preparingBlue = Color(0xFF1565C0);

  @override
  void initState() {
    super.initState();
    _activeZone = widget.zone;
  }

  /// Zone degistir
  void _switchZone(String zone) {
    HapticFeedback.selectionClick();
    setState(() => _activeZone = zone);
  }

  /// Item statusunu guncelle
  Future<void> _toggleItemStatus(
    KermesOrder order,
    int itemIndex,
    KermesOrderItem item,
  ) async {
    HapticFeedback.heavyImpact();

    try {
      final orderService = ref.read(kermesOrderServiceProvider);

      // Pending -> Preparing -> Ready
      KermesItemStatus newStatus;
      if (item.itemStatus == KermesItemStatus.pending) {
        newStatus = KermesItemStatus.preparing;
      } else if (item.itemStatus == KermesItemStatus.preparing) {
        newStatus = KermesItemStatus.ready;
      } else {
        return; // Zaten hazir
      }

      await orderService.updateItemStatus(
        orderId: order.id,
        itemIndex: itemIndex,
        newStatus: newStatus,
        zone: _activeZone,
      );
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final orderService = ref.read(kermesOrderServiceProvider);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0A0A) : const Color(0xFFF0F0F0),
      appBar: AppBar(
        backgroundColor: _getZoneColor(_activeZone),
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.restaurant, size: 20),
                const SizedBox(width: 8),
                Text(
                  'KDS - $_activeZone',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            Text(
              widget.kermesName,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          // Tum zone'lar butonu
          if (widget.allZones.length > 1)
            PopupMenuButton<String>(
              icon: const Icon(Icons.swap_horiz, color: Colors.white),
              tooltip: 'Zone Degistir',
              onSelected: _switchZone,
              itemBuilder: (context) => widget.allZones
                  .map((z) => PopupMenuItem(
                        value: z,
                        child: Row(
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: _getZoneColor(z),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(z,
                                style: TextStyle(
                                  fontWeight: z == _activeZone
                                      ? FontWeight.w700
                                      : FontWeight.w400,
                                )),
                          ],
                        ),
                      ))
                  .toList(),
            ),
        ],
      ),
      body: StreamBuilder<List<KermesOrder>>(
        stream: orderService.getOrdersByZone(widget.kermesId, _activeZone),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline,
                      size: 48, color: Colors.red),
                  const SizedBox(height: 12),
                  Text('Hata: ${snapshot.error}',
                      style: const TextStyle(color: Colors.red)),
                ],
              ),
            );
          }

          final orders = snapshot.data ?? [];

          // Yeni siparis geldiyse haptic + ses (ID-bazli karsilastirma)
          final currentIds = orders.map((o) => o.id).toSet();
          if (_previousOrderIds.isNotEmpty && currentIds.difference(_previousOrderIds).isNotEmpty) {
            HapticFeedback.heavyImpact();
          }
          _previousOrderIds = currentIds;

          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle,
                      size: 80,
                      color: successGreen.withOpacity(0.3)),
                  const SizedBox(height: 20),
                  Text(
                    'Tum siparisler hazir',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.grey.shade600,
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$_activeZone hazirlik alaninda bekleyen siparis yok',
                    style: TextStyle(
                      color: isDark ? Colors.white38 : Colors.grey.shade400,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            );
          }

          // Tablet icin grid, telefon icin list
          final isTablet = MediaQuery.of(context).size.width > 768;

          if (isTablet) {
            return _buildKDSGrid(orders, isDark);
          }
          return _buildKDSList(orders, isDark);
        },
      ),
    );
  }

  /// KDS Grid (Tablet Layout) - Siparisler kart halinde grid'de
  Widget _buildKDSGrid(List<KermesOrder> orders, bool isDark) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: MediaQuery.of(context).size.width > 1200 ? 4 : 3,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.75,
      ),
      itemCount: orders.length,
      itemBuilder: (context, index) =>
          _buildOrderCard(orders[index], isDark),
    );
  }

  /// KDS List (Telefon Layout)
  Widget _buildKDSList(List<KermesOrder> orders, bool isDark) {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _buildOrderCard(orders[index], isDark),
        );
      },
    );
  }

  /// Tek siparis karti (KDS gorunumu - buyuk, okunabilir)
  Widget _buildOrderCard(KermesOrder order, bool isDark) {
    // Bu zone'a ait itemleri filtrele
    final zoneItems = <MapEntry<int, KermesOrderItem>>[];
    final otherZoneItems = <KermesOrderItem>[];

    for (int i = 0; i < order.items.length; i++) {
      final item = order.items[i];
      if (item.prepZone == _activeZone) {
        zoneItems.add(MapEntry(i, item));
      } else {
        otherZoneItems.add(item);
      }
    }

    // Bekleme suresi (dakika)
    final waitMinutes =
        DateTime.now().difference(order.createdAt).inMinutes;

    // Aciliyet rengi
    Color urgencyColor;
    if (waitMinutes >= 15) {
      urgencyColor = Colors.red;
    } else if (waitMinutes >= 8) {
      urgencyColor = warningOrange;
    } else {
      urgencyColor = isDark ? Colors.white : Colors.black87;
    }

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: waitMinutes >= 15
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
          // Header (siparis no, bekleme suresi, teslimat bilgisi)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: _getZoneColor(_activeZone).withOpacity(isDark ? 0.2 : 0.08),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
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
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white10 : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    order.deliveryTypeLabel,
                    style: TextStyle(
                      color: isDark ? Colors.white70 : Colors.black54,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                // Masa numarasi
                if (order.tableNumber != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
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
                const Spacer(),
                // Bekleme suresi
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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

          // Bu zone'un itemlari (HAZIR butonlu)
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              children: zoneItems.map((entry) {
                final itemIndex = entry.key;
                final item = entry.value;
                return _buildKDSItem(order, itemIndex, item, isDark);
              }).toList(),
            ),
          ),

          // Diger zone'lardan itemlar (sadece bilgi amacli)
          if (otherZoneItems.isNotEmpty)
            Container(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Divider(
                      color: isDark ? Colors.white12 : Colors.grey.shade200),
                  Text(
                    'Diger alanlardan:',
                    style: TextStyle(
                      color: isDark ? Colors.white38 : Colors.grey.shade400,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ...otherZoneItems.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Row(
                          children: [
                            Icon(
                              item.isReady
                                  ? Icons.check_circle
                                  : Icons.radio_button_unchecked,
                              size: 14,
                              color: item.isReady
                                  ? successGreen
                                  : Colors.grey,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${item.quantity}x ${item.name}',
                              style: TextStyle(
                                color: isDark
                                    ? Colors.white38
                                    : Colors.grey.shade500,
                                fontSize: 12,
                                decoration: item.isReady
                                    ? TextDecoration.lineThrough
                                    : null,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              item.prepZone ?? '?',
                              style: TextStyle(
                                color: isDark
                                    ? Colors.white24
                                    : Colors.grey.shade400,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      )),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// KDS item satiri (buyuk, dokunabilir HAZIR butonu)
  Widget _buildKDSItem(
    KermesOrder order,
    int itemIndex,
    KermesOrderItem item,
    bool isDark,
  ) {
    final isPreparing = item.itemStatus == KermesItemStatus.preparing;
    final isReady = item.itemStatus == KermesItemStatus.ready;

    Color itemColor;
    IconData itemIcon;
    String buttonText;

    if (isReady) {
      itemColor = successGreen;
      itemIcon = Icons.check_circle;
      buttonText = 'HAZIR';
    } else if (isPreparing) {
      itemColor = preparingBlue;
      itemIcon = Icons.restaurant;
      buttonText = 'HAZIR';
    } else {
      itemColor = warningOrange;
      itemIcon = Icons.hourglass_empty;
      buttonText = 'BASLA';
    }

    return GestureDetector(
      onTap: isReady ? null : () => _toggleItemStatus(order, itemIndex, item),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isReady
              ? successGreen.withOpacity(isDark ? 0.15 : 0.08)
              : isPreparing
                  ? preparingBlue.withOpacity(isDark ? 0.15 : 0.08)
                  : isDark
                      ? Colors.white.withOpacity(0.05)
                      : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: itemColor.withOpacity(0.3),
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            // Statu ikonu
            Icon(itemIcon, color: itemColor, size: 24),
            const SizedBox(width: 10),
            // Miktar ve isim
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${item.quantity}x ${item.name}',
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      decoration:
                          isReady ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  if (item.category != null)
                    Text(
                      item.category!,
                      style: TextStyle(
                        color: isDark ? Colors.white38 : Colors.grey,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
            // HAZIR / BASLA butonu
            if (!isReady)
              Material(
                color: itemColor,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  onTap: () =>
                      _toggleItemStatus(order, itemIndex, item),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    child: Text(
                      buttonText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Zone bazli renk
  Color _getZoneColor(String zone) {
    final lower = zone.toLowerCase();
    if (lower.contains('kadin') || lower.contains('frauen')) {
      return const Color(0xFFE91E63);
    } else if (lower.contains('erkek') ||
        lower.contains('mann') ||
        lower.contains('manner')) {
      return const Color(0xFF1565C0);
    } else if (lower.contains('grill') || lower.contains('barbekü')) {
      return const Color(0xFFE65100);
    } else if (lower.contains('icecek') || lower.contains('getrank')) {
      return const Color(0xFF00838F);
    } else if (lower.contains('tatli') || lower.contains('dessert')) {
      return const Color(0xFF8E24AA);
    }
    return lokmaPink;
  }
}
