import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:intl/intl.dart';

class KermesUnifiedKdsScreen extends ConsumerStatefulWidget {
  final String kermesId;
  final String kermesName;
  final List<String> allowedSections;
  final List<String> staffPrepZones; // Personelin atanmis hazirlik alanlari

  const KermesUnifiedKdsScreen({
    super.key,
    required this.kermesId,
    required this.kermesName,
    this.allowedSections = const [],
    this.staffPrepZones = const [],
  });

  @override
  ConsumerState<KermesUnifiedKdsScreen> createState() => _KermesUnifiedKdsScreenState();
}

class _KermesUnifiedKdsScreenState extends ConsumerState<KermesUnifiedKdsScreen>
    with TickerProviderStateMixin {
  String _activeFilter = 'Tümü';
  Set<String> _previousOrderIds = {};
  late final TabController _tabController;

  static const Color lokmaPink = Color(0xFFEA184A);
  static const Color successGreen = Color(0xFF2E7D32);
  static const Color warningOrange = Color(0xFFE65100);
  static const Color preparingBlue = Color(0xFF1565C0);

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

  Future<void> _toggleItemStatus(
    KermesOrder order,
    int itemIndex,
    KermesOrderItem item,
  ) async {
    HapticFeedback.heavyImpact();
    try {
      final orderService = ref.read(kermesOrderServiceProvider);

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
        zone: _activeFilter == 'T\u00fcm\u00fc' ? null : _activeFilter,
      );

      // Otomatik tab gecisi: bu sipariste baska islenecek item kaldi mi?
      if (mounted) {
        // Mevcut sipariste ayni statuslu baska item var mi kontrol et
        final sameStatusItems = order.items.where((i) => i.itemStatus == item.itemStatus).toList();
        // Bu item dahil sadece 1 tane kaldiysa (yani az once son item'i toggle ettik)
        // ve siparisin tum itemlari artik bir sonraki status'a geciyorsa
        if (sameStatusItems.length <= 1) {
          _autoSwitchTabIfEmpty();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  /// Mevcut tab bosaldiysa sonraki tab'a otomatik gec
  void _autoSwitchTabIfEmpty() {
    Future.delayed(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      final currentIndex = _tabController.index;
      if (currentIndex < 2) {
        _tabController.animateTo(currentIndex + 1);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final orderService = ref.read(kermesOrderServiceProvider);

    return Scaffold(
        backgroundColor: isDark ? const Color(0xFF0A0A0A) : const Color(0xFFEAEAEA),
        body: Column(
          children: [
            // Tab bar - is akisi gosterimi
            Container(
              color: isDark ? const Color(0xFF252525) : const Color(0xFFE8E8E8),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  TabBar(
                    controller: _tabController,
                    labelColor: Colors.white,
                    unselectedLabelColor: isDark ? Colors.grey[400] : const Color(0xFF555555),
                    indicator: BoxDecoration(
                      color: lokmaPink,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    indicatorPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                    dividerColor: Colors.transparent,
                    labelPadding: const EdgeInsets.symmetric(horizontal: 0),
                    labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                    unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 0.5),
                    tabs: const [
                      Tab(text: 'YENI'),
                      Tab(text: 'HAZIRLANIYOR'),
                      Tab(text: 'TESLIME HAZIR'),
                    ],
                  ),
                  // Chevron oklari tab'larin arasinda (overlay)
                  Positioned(
                    left: MediaQuery.of(context).size.width / 3 - 10,
                    child: IgnorePointer(
                      child: Icon(Icons.chevron_right, size: 20, color: isDark ? Colors.grey[500] : Colors.grey[500]),
                    ),
                  ),
                  Positioned(
                    left: MediaQuery.of(context).size.width * 2 / 3 - 10,
                    child: IgnorePointer(
                      child: Icon(Icons.chevron_right, size: 20, color: isDark ? Colors.grey[500] : Colors.grey[500]),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: StreamBuilder<List<KermesOrder>>(
                // Aktif tum siparisleri getirir
                stream: orderService.getActiveOrders(widget.kermesId),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snapshot.hasError) {
                    return Center(child: Text('Hata: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
                  }

                  final allOrders = snapshot.data ?? [];

                  // Optional order visibility control by table section
                  final sectionFilteredOrders = widget.allowedSections.isEmpty
                      ? allOrders
                      : allOrders.where((o) =>
                          o.tableSection == null ||
                          o.tableSection!.isEmpty ||
                          widget.allowedSections.contains(o.tableSection)).toList();

                  // Zone chipleri: personelin atanmis prepZone'larindan olustur
                  final zoneList = <String>['T\u00fcm\u00fc'];
                  if (widget.staffPrepZones.isNotEmpty) {
                    zoneList.addAll(widget.staffPrepZones);
                  } else {
                    // Fallback: siparislerden topla
                    final Set<String> zones = {};
                    for (var order in sectionFilteredOrders) {
                      for (var item in order.items) {
                        zones.addAll(item.prepZones.where((z) => z.isNotEmpty));
                      }
                    }
                    zoneList.addAll(zones.toList()..sort());
                  }

                  // Ensure active filter is still valid (fallback to Tumu)
                  if (!zoneList.contains(_activeFilter)) {
                    _activeFilter = 'T\u00fcm\u00fc';
                  }

                  // Zone bazli aktif siparis sayilarini hesapla (pending + preparing)
                  final activeOrders = sectionFilteredOrders.where(
                    (o) => o.status == KermesOrderStatus.pending || o.status == KermesOrderStatus.preparing
                  ).toList();
                  final Map<String, int> zoneCounts = {};
                  for (final zone in zoneList) {
                    if (zone == 'T\u00fcm\u00fc') {
                      zoneCounts[zone] = activeOrders.length;
                    } else {
                      zoneCounts[zone] = activeOrders.where(
                        (o) => o.items.any((item) => item.prepZones.contains(zone))
                      ).length;
                    }
                  }

                  // Filter out orders that don't match the zone filter AT ALL
                  final displayOrders = _activeFilter == 'T\u00fcm\u00fc'
                      ? sectionFilteredOrders
                      : sectionFilteredOrders.where((order) {
                          return order.items.any((item) => item.prepZones.contains(_activeFilter));
                        }).toList();

                  // Haptic on slightly distinct new orders
                  final currentIds = displayOrders.map((o) => o.id).toSet();
                  if (_previousOrderIds.isNotEmpty && currentIds.difference(_previousOrderIds).isNotEmpty) {
                    HapticFeedback.heavyImpact();
                  }
                  _previousOrderIds = currentIds;

                  // Bucket orders
                  final pendingOrders = displayOrders.where((o) => o.status == KermesOrderStatus.pending).toList();
                  final preparingOrders = displayOrders.where((o) => o.status == KermesOrderStatus.preparing).toList();
                  final readyOrders = displayOrders.where((o) => o.status == KermesOrderStatus.ready).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Zone filter sadece birden fazla zone varsa goster
                      if (zoneList.length > 1) _buildFilterBar(zoneList, isDark, zoneCounts),
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _buildKanbanColumn(pendingOrders, isDark, warningOrange),
                            _buildKanbanColumn(preparingOrders, isDark, preparingBlue),
                            _buildKanbanColumn(readyOrders, isDark, successGreen),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
    );
  }

  Widget _buildFilterBar(List<String> zones, bool isDark, Map<String, int> zoneCounts) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Baslik + toplam siparis badge
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Bana Atanan \"Ocak Ba\u015f\u0131\" G\u00f6revlerim',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.grey[400] : const Color(0xFF555555),
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                if ((zoneCounts['T\u00fcm\u00fc'] ?? 0) > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: warningOrange,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${zoneCounts['T\u00fcm\u00fc']} Sipari\u015f',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: zones.map((zone) {
            final isActive = _activeFilter == zone;
            final count = zoneCounts[zone] ?? 0;
            return Padding(
              padding: const EdgeInsets.only(right: 12, top: 4),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  FilterChip(
                    label: Text(zone, style: TextStyle(
                      color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                      fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    )),
                    selected: isActive,
                    selectedColor: warningOrange,
                    backgroundColor: isDark ? const Color(0xFF333333) : const Color(0xFFF0F0F0),
                    onSelected: (selected) {
                      if (selected) {
                        HapticFeedback.selectionClick();
                        setState(() => _activeFilter = zone);
                      }
                    },
                  ),
                  if (count > 0)
                    Positioned(
                      top: -6,
                      right: -8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                        decoration: BoxDecoration(
                          color: warningOrange,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                            width: 2,
                          ),
                        ),
                        child: Text(
                          '$count',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
        ],
      ),
    );
  }

  Widget _buildDivider(bool isDark) {
    return Container(
      width: 1,
      color: isDark ? Colors.white24 : Colors.black12,
    );
  }

  Widget _buildKanbanColumn(List<KermesOrder> orders, bool isDark, Color accentColor) {
    return Container(
      color: isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F7),
      child: Column(
        children: [
          Expanded(
            child: orders.isEmpty
                ? Center(
                    child: Text('Bulunamadı', style: TextStyle(color: isDark ? Colors.white30 : Colors.black26)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: orders.length,
                    itemBuilder: (context, index) {
                      return _buildUnifiedOrderCard(orders[index], isDark, accentColor);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildUnifiedOrderCard(KermesOrder order, bool isDark, Color cardAccent) {
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Order Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF0F0F0),
              borderRadius: const BorderRadius.only(topLeft: Radius.circular(12), topRight: Radius.circular(12)),
              border: Border(bottom: BorderSide(color: isDark ? Colors.white12 : Colors.black12)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text("#${order.orderNumber}", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textColor)),
                    const SizedBox(width: 8),
                    if (order.tableNumber != null && order.tableNumber!.isNotEmpty) ...[
                      Builder(builder: (context) {
                        // Bolum rengini belirle
                        final section = order.tableSection ?? '';
                        final sectionLower = section.toLowerCase();
                        Color sectionColor;
                        String sectionLabel;
                        if (sectionLower.contains('kadin') || sectionLower.contains('kad\u0131n') || sectionLower.contains('han\u0131m') || sectionLower.contains('female')) {
                          sectionColor = const Color(0xFFD32F2F); // Kirmizi
                          sectionLabel = 'Han\u0131mlar';
                        } else if (sectionLower.contains('erkek') || sectionLower.contains('male')) {
                          sectionColor = const Color(0xFF1565C0); // Mavi
                          sectionLabel = 'Erkekler';
                        } else if (sectionLower.contains('aile') || sectionLower.contains('family') || sectionLower.contains('mixed')) {
                          sectionColor = const Color(0xFF2E7D32); // Yesil
                          sectionLabel = 'Aile';
                        } else {
                          sectionColor = Colors.purple;
                          sectionLabel = section.isNotEmpty ? section : 'Masa';
                        }
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: sectionColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: sectionColor.withOpacity(0.4)),
                          ),
                          child: Text(
                            '$sectionLabel - M${order.tableNumber}',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: sectionColor),
                          ),
                        );
                      }),
                    ]
                    else 
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: warningOrange.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                        child: const Text('Paket / GelAl', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: warningOrange)),
                      ),
                  ],
                ),
                Text(
                  DateFormat.Hm().format(order.createdAt),
                  style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black54),
                ),
              ],
            ),
          ),
          
          // Order Notes
          if (order.notes != null && order.notes!.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              color: Colors.amber.withOpacity(0.2),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 14, color: Colors.orange),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      order.notes!,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange),
                    ),
                  ),
                ],
              ),
            ),

          // Order Items
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              children: List.generate(order.items.length, (index) {
                final item = order.items[index];
                final isItemMatched = _activeFilter == 'Tümü' || item.prepZones.contains(_activeFilter);
                
                return _buildOrderItemLine(order, index, item, isItemMatched, isDark);
              }),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderItemLine(KermesOrder order, int idx, KermesOrderItem item, bool isActiveMatch, bool isDark) {
    final statusColor = _getItemStatusColor(item.itemStatus);
    final statusText = _getItemStatusText(item.itemStatus);
    
    final textColor = isActiveMatch 
        ? (isDark ? Colors.white : Colors.black87)
        : (isDark ? Colors.white30 : Colors.black38);

    return InkWell(
      onTap: isActiveMatch ? () => _toggleItemStatus(order, idx, item) : null,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: isActiveMatch ? statusColor.withOpacity(0.05) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isActiveMatch ? statusColor.withOpacity(0.2) : (isDark ? Colors.white10 : Colors.black12),
          ),
        ),
        child: Row(
          children: [
            // Quantity Box
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isActiveMatch ? statusColor.withOpacity(0.1) : (isDark ? Colors.white10 : Colors.black12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                "${item.quantity}x",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isActiveMatch ? statusColor : textColor),
              ),
            ),
            const SizedBox(width: 8),
            
            // Name
            Expanded(
              child: Text(
                item.name,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isActiveMatch ? FontWeight.w600 : FontWeight.w400,
                  color: textColor,
                  decoration: item.itemStatus == KermesItemStatus.ready ? TextDecoration.lineThrough : null,
                ),
              ),
            ),
            
            // Status Button/Label
            if (isActiveMatch)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  statusText,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              )
            else 
              Icon(Icons.visibility_off, size: 14, color: textColor),
          ],
        ),
      ),
    );
  }

  Color _getItemStatusColor(KermesItemStatus status) {
    switch (status) {
      case KermesItemStatus.pending:
        return lokmaPink;
      case KermesItemStatus.preparing:
        return preparingBlue;
      case KermesItemStatus.ready:
        return successGreen;
    }
  }

  String _getItemStatusText(KermesItemStatus status) {
    switch (status) {
      case KermesItemStatus.pending:
        return 'YAP';
      case KermesItemStatus.preparing:
        return 'HAZIRLANIYOR';
      case KermesItemStatus.ready:
        return 'HAZIR';
    }
  }
}
