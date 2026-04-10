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

  const KermesUnifiedKdsScreen({
    super.key,
    required this.kermesId,
    required this.kermesName,
    this.allowedSections = const [],
  });

  @override
  ConsumerState<KermesUnifiedKdsScreen> createState() => _KermesUnifiedKdsScreenState();
}

class _KermesUnifiedKdsScreenState extends ConsumerState<KermesUnifiedKdsScreen> {
  String _activeFilter = 'Tümü';
  Set<String> _previousOrderIds = {};

  static const Color lokmaPink = Color(0xFFEA184A);
  static const Color successGreen = Color(0xFF2E7D32);
  static const Color warningOrange = Color(0xFFE65100);
  static const Color preparingBlue = Color(0xFF1565C0);

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
        return; // Zaten hazır
      }

      await orderService.updateItemStatus(
        orderId: order.id,
        itemIndex: itemIndex,
        newStatus: newStatus,
        zone: _activeFilter == 'Tümü' ? null : _activeFilter,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final orderService = ref.read(kermesOrderServiceProvider);

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: isDark ? const Color(0xFF0A0A0A) : const Color(0xFFEAEAEA),
        appBar: AppBar(
          backgroundColor: lokmaPink,
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.local_fire_department_rounded, size: 22),
                  const SizedBox(width: 8),
                  const Text('Mutfak (Ocak Başı)', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                ],
              ),
              Text(widget.kermesName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400)),
            ],
          ),
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            labelPadding: EdgeInsets.symmetric(horizontal: 4),
            tabs: [
              Tab(text: 'GELENLER'),
              Tab(text: 'HAZIRLANIYOR'),
              Tab(text: 'TESLİME HAZIR'),
            ],
          ),
        ),
        body: StreamBuilder<List<KermesOrder>>(
          // Aktif tüm siparişleri getirir
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

            // Collect unique zones for the filter chip
            final Set<String> zones = {};
            for (var order in sectionFilteredOrders) {
              for (var item in order.items) {
                zones.addAll(item.prepZones.where((z) => z.isNotEmpty));
              }
            }
            final zoneList = zones.toList()..sort();
            zoneList.insert(0, 'Tümü');

            // Ensure active filter is still valid (fallback to Tümü)
            if (!zoneList.contains(_activeFilter)) {
              _activeFilter = 'Tümü';
            }

            // Filter out orders that don't match the zone filter AT ALL
            final displayOrders = _activeFilter == 'Tümü'
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
                _buildFilterBar(zoneList, isDark),
                Expanded(
                  child: TabBarView(
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
    );
  }

  Widget _buildFilterBar(List<String> zones, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: zones.map((zone) {
            final isActive = _activeFilter == zone;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterChip(
                label: Text(zone, style: TextStyle(
                  color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                  fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                )),
                selected: isActive,
                selectedColor: lokmaPink,
                backgroundColor: isDark ? const Color(0xFF333333) : const Color(0xFFF0F0F0),
                onSelected: (selected) {
                  if (selected) {
                    HapticFeedback.selectionClick();
                    setState(() => _activeFilter = zone);
                  }
                },
              ),
            );
          }).toList(),
        ),
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
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
              border: Border(bottom: BorderSide(color: accentColor, width: 3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(color: accentColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                  child: Text(
                    "${orders.length} Sipariş",
                    style: TextStyle(fontWeight: FontWeight.bold, color: accentColor, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
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
                    if (order.tableNumber != null && order.tableNumber!.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                        child: Text(order.tableNumber!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blue)),
                      )
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
