import '../../services/shift_service.dart';
import '../../services/order_service.dart';
import 'package:flutter/material.dart';
import 'kermes_active_delivery_screen.dart';
import 'active_delivery_screen.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/driver_provider.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import '../../services/kermes_order_service.dart';
import 'package:rxdart/rxdart.dart';
import '../staff/staff_delivery_screen.dart';
import '../../utils/currency_utils.dart';
import '../shared/tap_to_pay_sheet.dart';
import 'driver_earnings_screen.dart';
import 'package:cloud_firestore/cloud_firestore.dart' show FirebaseFirestore, FieldValue;

/// Driver Delivery Screen - Shows pending deliveries from ALL assigned businesses
/// This screen is for couriers (drivers) who are assigned to multiple businesses
class DriverDeliveryScreen extends ConsumerStatefulWidget {
  final bool embedded;
  const DriverDeliveryScreen({super.key, this.embedded = false});

  @override
  ConsumerState<DriverDeliveryScreen> createState() => _DriverDeliveryScreenState();
}

class _DriverDeliveryScreenState extends ConsumerState<DriverDeliveryScreen> {
  final OrderService _orderService = OrderService();
  final KermesOrderService _kermesOrderService = KermesOrderService();
  String? _driverName;
  String? _driverPhone;
  bool _isLoading = false;
  bool _showAllOrders = false;

  /// Helper to combine meat and kermes orders
  Stream<List<dynamic>> _getCombinedDeliveriesStream(List<String> businessIds, List<String> kermesIds, String? courierId) {
    if (businessIds.isEmpty && kermesIds.isEmpty) return Stream.value([]);
    
    final allKermesIds = [...kermesIds, ...businessIds].toSet().toList();

    final meatStream = businessIds.isEmpty 
        ? Stream.value(<LokmaOrder>[]) 
        : _orderService.getDriverDeliveriesStream(businessIds, courierId: courierId)
            .onErrorReturnWith((e, _) {
              debugPrint('DEBUG STREAM: meatStream error: $e');
              return <LokmaOrder>[];
            })
            .startWith(<LokmaOrder>[]);
    final kermesStream = allKermesIds.isEmpty 
        ? Stream.value(<KermesOrder>[]) 
        : _kermesOrderService.getDriverDeliveriesStream(allKermesIds, courierId: courierId)
            .onErrorReturnWith((e, _) {
              debugPrint('DEBUG STREAM: kermesStream error: $e');
              return <KermesOrder>[];
            })
            .startWith(<KermesOrder>[]);
    
    return Rx.combineLatest2(
      meatStream,
      kermesStream,
      (List<LokmaOrder> meat, List<KermesOrder> kermes) {
        print('DEBUG STREAM: meat=${meat.length}, kermes=${kermes.length}');
        final combined = [...meat, ...kermes];
        combined.sort((x, y) {
          final dynamic dx = x;
          final dynamic dy = y;
          
          final xStatus = (x.runtimeType.toString() == 'LokmaOrder') ? (x as dynamic).status.name : (x as dynamic).status.name;
          final yStatus = (y.runtimeType.toString() == 'LokmaOrder') ? (y as dynamic).status.name : (y as dynamic).status.name;
          
          final xCourierId = dx.courierId;
          final yCourierId = dy.courierId;
          
          final xIsMyOrder = courierId != null && xCourierId == courierId;
          final yIsMyOrder = courierId != null && yCourierId == courierId;
          
          if (xIsMyOrder && !yIsMyOrder) return -1;
          if (!xIsMyOrder && yIsMyOrder) return 1;
          
          const priority = {'onTheWay': 0, 'accepted': 0, 'ready': 1, 'preparing': 2, 'pending': 3};
          final xPriority = priority[xStatus] ?? 4;
          final yPriority = priority[yStatus] ?? 4;
          return xPriority.compareTo(yPriority);
        });
        return combined;
      }
    );
  }

  /// Helper to combine all orders
  Stream<List<dynamic>> _getAllCombinedOrdersStream(List<String> businessIds, List<String> kermesIds) {
    if (businessIds.isEmpty && kermesIds.isEmpty) return Stream.value([]);
    
    // Combine businessIds and kermesIds for querying kermes_orders (since unified businesses store orders there)
    final allKermesIds = [...kermesIds, ...businessIds].toSet().toList();

    final meatStream = businessIds.isEmpty 
        ? Stream.value(<LokmaOrder>[]) 
        : _orderService.getAllBusinessOrdersStream(businessIds)
            .onErrorReturnWith((e, _) {
              debugPrint('DEBUG STREAM: meatStream all error: $e');
              return <LokmaOrder>[];
            })
            .startWith(<LokmaOrder>[]);
    final kermesStream = allKermesIds.isEmpty 
        ? Stream.value(<KermesOrder>[]) 
        : _kermesOrderService.getAllKermesOrdersStream(allKermesIds)
            .onErrorReturnWith((e, _) {
              debugPrint('DEBUG STREAM: kermesStream all error: $e');
              return <KermesOrder>[];
            })
            .startWith(<KermesOrder>[]);
    
    return Rx.combineLatest2(
      meatStream,
      kermesStream,
      (List<LokmaOrder> meat, List<KermesOrder> kermes) {
        final combined = [...meat, ...kermes];
        combined.sort((x, y) {
          final xStatus = (x.runtimeType.toString() == 'LokmaOrder') ? (x as dynamic).status.name : (x as dynamic).status.name;
          final yStatus = (y.runtimeType.toString() == 'LokmaOrder') ? (y as dynamic).status.name : (y as dynamic).status.name;
          const priority = {'pending': 0, 'preparing': 1, 'ready': 2, 'accepted': 3, 'onTheWay': 4};
          final xPriority = priority[xStatus] ?? 5;
          final yPriority = priority[yStatus] ?? 5;
          return xPriority.compareTo(yPriority);
        });
        return combined;
      }
    );
  }

  /// Helper to combine completed deliveries for today
  Stream<List<dynamic>> _getCombinedCompletedDeliveriesTodayStream(String courierId) {
    if (courierId.isEmpty) return Stream.value([]);
    
    // Always query both for completed deliveries for a specific driver
    final meatStream = _orderService.getMyCompletedDeliveriesToday(courierId)
        .startWith(<LokmaOrder>[]);
    final kermesStream = _kermesOrderService.getMyCompletedDeliveriesToday(courierId)
        .startWith(<KermesOrder>[]);
    
    return Rx.combineLatest2(
      meatStream,
      kermesStream,
      (List<LokmaOrder> meat, List<KermesOrder> kermes) {
        final combined = [...meat, ...kermes];
        combined.sort((a, b) {
          final dynamic da = a;
          final dynamic db = b;
          final aDate = (a.runtimeType.toString() == 'LokmaOrder') ? (da.deliveredAt ?? DateTime.now()) : (da.completedAt ?? DateTime.now());
          final bDate = (b.runtimeType.toString() == 'LokmaOrder') ? (db.deliveredAt ?? DateTime.now()) : (db.completedAt ?? DateTime.now());
          return bDate.compareTo(aDate); // descending
        });
        return combined;
      }
    );
  }

  @override
  void initState() {
    super.initState();
    _loadDriverInfo();
    _checkForActiveDelivery();
  }

  /// Check if user has an active delivery - no longer redirects
  /// Active deliveries are now shown inline in the main list
  Future<void> _checkForActiveDelivery() async {
    // Active deliveries are shown inline now - no action needed
  }

  Future<void> _loadDriverInfo() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final doc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      if (doc.exists) {
        final data = doc.data()!;
        setState(() {
          _driverName = data['name'] ?? data['displayName'] ?? tr('driver.surucu');
          _driverPhone = data['phone'] ?? data['phoneNumber'] ?? '';
        });
      }
    }
  }

  Future<void> _claimDelivery(dynamic order) async {
    final user = FirebaseAuth.instance.currentUser;
    final driverState = ref.read(driverProvider);
    final driverName = _driverName ?? driverState.driverInfo?.name ?? 'Kurye';
    final driverPhone = _driverPhone ?? driverState.driverInfo?.phone ?? '';
    
    if (user == null) return;

    // Check if driver is on break — ask to end break first
    final shiftService = ShiftService();
    if (shiftService.shiftStatus == 'paused') {
      final endBreak = await showModalBottomSheet<bool>(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (ctx) => Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 24),
                    decoration: BoxDecoration(
                      color: Colors.grey.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.coffee, size: 40, color: Colors.amber),
                ),
                const SizedBox(height: 20),
                Text(
                  tr('staff.break_continues'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Text(
                  '${tr('driver.teslimat_ustlenmek_icin_molani').replaceAll(r'\\n', '').replaceAll(r'\n', '')}\nDevam etmek istiyor musunuz?',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, color: Colors.grey.shade600, height: 1.4),
                ),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          side: BorderSide(color: Colors.grey.shade300),
                        ),
                        child: Text(tr('common.cancel'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.amber,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text(tr('driver.molayi_bitir_ve_ustlen'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );

      if (endBreak != true) return;

      // Resume shift (end break)
      final resumed = await shiftService.resumeShift();
      if (!resumed && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('staff.break_end_failed')),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

    if (!mounted) return;

    // Confirm dialog via Bottom Sheet
    final confirm = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 20,
              spreadRadius: 5,
            ),
          ],
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.delivery_dining, size: 48, color: Colors.amber),
              ),
              const SizedBox(height: 20),
              Text(
                tr('driver.take_delivery'),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                tr('driver.bu_siparisi_ustlenmek_istedigi').replaceAll(r'\\n', '').replaceAll(r'\n', ''),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: Colors.grey.shade600, height: 1.4),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.withValues(alpha: 0.1)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                          child: const Icon(Icons.store, color: Colors.blue, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('İşletme', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                              Text(
                                (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).butcherName : 'Kermes',
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1)),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                          child: const Icon(Icons.location_on, color: Colors.red, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Teslimat Adresi', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                              Text(
                                (order.runtimeType.toString() == 'LokmaOrder') ? ((order as dynamic).deliveryAddress ?? "Adres yok") : "Kermes Alanı",
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1)),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                          child: const Icon(Icons.payments, color: Colors.green, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Toplam Tutar', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                              Text(
                                '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        side: BorderSide(color: Colors.grey.shade300),
                      ),
                      child: Text(tr('common.cancel'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Text(tr('driver.ustlen'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);

    bool success = false;
    if (order.runtimeType.toString() == 'LokmaOrder') {
      success = await _orderService.claimDelivery(
        orderId: order.id,
        courierId: user.uid,
        courierName: driverName,
        courierPhone: driverPhone,
      );
    } else if (order.runtimeType.toString() == 'KermesOrder') {
      success = await _kermesOrderService.claimDelivery(
        orderId: order.id,
        courierId: user.uid,
        courierName: driverName,
        courierPhone: driverPhone,
      );
    }

    setState(() => _isLoading = false);

    if (success && mounted) {
      // Show appropriate message based on whether break was ended
      final breakEnded = shiftService.shiftStatus == 'active' && shiftService.isOnShift;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            breakEnded
                ? '☕ Molanız durduruldu. Teslimatınızı teslim edebilirsiniz!'
                : tr('driver.teslimat_ustlenildi_konum_taki'),
          ),
          backgroundColor: Colors.green,
        ),
      );
      // Navigate to active delivery screen
      if (order.runtimeType.toString() == 'KermesOrder') {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => KermesActiveDeliveryScreen(orderId: order.id),
          ),
        );
      } else {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => ActiveDeliveryScreen(orderId: order.id),
          ),
        );
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr('driver.delivery_already_taken')),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  /// Show bottom sheet with list of assigned businesses and their order counts
  void _showBusinessListSheet(List<String> businessIds) {

    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _BusinessListSheet(
        businessIds: businessIds,
        orderService: _orderService,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final driverState = ref.watch(driverProvider);
    final businessIds = driverState.driverInfo?.assignedBusinesses ?? [];
    final kermesIds = driverState.driverInfo?.assignedKermesIds ?? [];
    final assignedCount = businessIds.length + kermesIds.length;

    const brandBottom = Color(0xFFFE0032);
    const brandTop = Color(0xFFFA4C71);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Container(
          margin: const EdgeInsets.only(left: 4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () => setState(() => _showAllOrders = false),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: !_showAllOrders ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Teslimatlarım',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: !_showAllOrders ? brandBottom : Colors.white,
                    ),
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _showAllOrders = true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _showAllOrders ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    tr('driver.tum_siparisler'),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _showAllOrders ? brandBottom : Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [brandTop, brandBottom],
            ),
          ),
        ),
        actions: [
          // Kazançlarım (Earnings) button
          IconButton(
            icon: const Icon(Icons.monetization_on_outlined, size: 22),
            tooltip: tr('driver.kazanclarim'),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const DriverEarningsScreen()),
            ),
          ),
          // Show assigned business count - tappable
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: () => _showBusinessListSheet(businessIds),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$assignedCount',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 2),
                    const Icon(Icons.store, size: 16),
                  ],
                ),
              ),
            ),
          ),
          // Active Delivery Resume Button
          StreamBuilder<List<dynamic>>(
            stream: _getCombinedDeliveriesStream(businessIds, kermesIds, FirebaseAuth.instance.currentUser?.uid),
            builder: (context, snapshot) {
              if (snapshot.hasData && snapshot.data!.isNotEmpty) {
                final activeOrders = snapshot.data!.where((o) {
                  final status = (o.runtimeType.toString() == 'LokmaOrder') ? (o as dynamic).status.name : (o as dynamic).status.name;
                  final courierId = (o as dynamic).courierId;
                  final isMyOrder = courierId == FirebaseAuth.instance.currentUser?.uid;
                  return isMyOrder && (status == 'accepted' || status == 'onTheWay');
                }).toList();

                if (activeOrders.isNotEmpty) {
                  final activeOrder = activeOrders.first;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: IconButton(
                      icon: Stack(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.motorcycle, size: 20, color: Colors.white),
                          ),
                          Positioned(
                            right: 0,
                            top: 0,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: Colors.red,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                            ),
                          ),
                        ],
                      ),
                      tooltip: 'Aktif Teslimata Devam Et',
                      onPressed: () {
                        if (activeOrder.runtimeType.toString() == 'LokmaOrder') {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => ActiveDeliveryScreen(orderId: activeOrder.id)));
                        } else {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => KermesActiveDeliveryScreen(orderId: activeOrder.id)));
                        }
                      },
                    ),
                  );
                }
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: driverState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : !driverState.isDriver
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.warning_amber_rounded, size: 80, color: Colors.amber),
                      SizedBox(height: 16),
                      Text(
                        tr('driver.surucu_yetkisi_bulunamadi'),
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                      SizedBox(height: 8),
                      Text(
                        tr('driver.lutfen_yoneticinize_basvurun'),
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                )
              : (businessIds.isEmpty && kermesIds.isEmpty)
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.store_mall_directory_outlined, size: 80, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            tr('driver.henuz_isletme_atanmamis'),
                            style: TextStyle(fontSize: 18, color: Colors.grey),
                          ),
                          SizedBox(height: 8),
                          Text(
                            tr('driver.admin_panelinden_isletme_atama'),
                            style: TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : _isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : _showAllOrders
                          ? _buildAllOrdersView(businessIds, kermesIds)
                          : _buildMyDeliveriesView(businessIds, kermesIds),
    );
  }

  /// Build the "Teslimatlarım" view — only claimable (ready) + claimed-by-me orders
  Widget _buildMyDeliveriesView(List<String> businessIds, List<String> kermesIds) {
    return StreamBuilder<List<dynamic>>(
      stream: _getCombinedDeliveriesStream(businessIds, kermesIds, FirebaseAuth.instance.currentUser?.uid),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          debugPrint('DEBUG STREAM: _buildMyDeliveriesView error: ${snapshot.error}');
          return Center(child: Text('Hata: ${snapshot.error}'));
        }
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allOrders = snapshot.data ?? [];

        // Show ALL delivery orders — claim button is gated to ready-only
        final claimableOrders = allOrders;

        if (claimableOrders.isEmpty) {
          return Column(
            children: [
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline, size: 80, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        tr('driver.ustlenebilecek_teslimat_yok'),
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${businessIds.length + kermesIds.length} merkez izleniyor',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    ],
                  ),
                ),
              ),
              _buildCompletedDeliveriesSection(),
            ],
          );
        }

        return Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: claimableOrders.length,
                itemBuilder: (context, index) {
                  return _buildDeliveryCard(claimableOrders[index]);
                },
              ),
            ),
            _buildCompletedDeliveriesSection(),
          ],
        );
      },
    );
  }

  /// Build the tr('driver.tum_siparisler') view — all orders from assigned businesses
  Widget _buildAllOrdersView(List<String> businessIds, List<String> kermesIds) {
    return StreamBuilder<List<dynamic>>(
      stream: _getAllCombinedOrdersStream(businessIds, kermesIds),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          debugPrint('DEBUG STREAM: _buildAllOrdersView error: ${snapshot.error}');
          return Center(child: Text('Hata: ${snapshot.error}'));
        }
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.inbox_outlined, size: 80, color: Colors.grey[400]),
                const SizedBox(height: 16),
                Text(
                  tr('driver.aktif_siparis_yok'),
                  style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                ),
                const SizedBox(height: 8),
                Text(
                  '${businessIds.length + kermesIds.length} merkez izleniyor',
                  style: TextStyle(color: Colors.grey[500]),
                ),
              ],
            ),
          );
        }

        final orders = snapshot.data!;
        // Group by status
        final statusGroups = <String, List<dynamic>>{};
        for (final order in orders) {
          final key = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).status.name : (order as dynamic).status.name;
          statusGroups.putIfAbsent(key, () => []).add(order);
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Summary bar
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.list_alt, color: Colors.amber, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    '${orders.length} aktif sipariş',
                    style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.amber),
                  ),
                  const Spacer(),
                  ..._buildStatusSummaryChips(statusGroups),
                ],
              ),
            ),
            // Order cards
            ...orders.map((order) => _buildAllOrderCard(order)),
          ],
        );
      },
    );
  }

  List<Widget> _buildStatusSummaryChips(Map<String, List<dynamic>> groups) {
    final chips = <Widget>[];
    final statusConfig = {
      'pending': ('⏳', Colors.grey),
      'preparing': ('🔥', Colors.amber),
      'ready': ('✅', Colors.green),
      'accepted': ('🚗', Colors.blue),
      'onTheWay': ('🚗', Colors.blue),
    };

    for (final entry in statusConfig.entries) {
      final count = groups[entry.key]?.length ?? 0;
      if (count > 0) {
        chips.add(Container(
          margin: const EdgeInsets.only(left: 6),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: entry.value.$2.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '${entry.value.$1} $count',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: entry.value.$2),
          ),
        ));
      }
    }
    return chips;
  }

  Widget _buildAllOrderCard(dynamic order) {
    final statusName = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).status.name : (order as dynamic).status.name;
    final statusConfig = _getStatusConfig(statusName);
    final businessName = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).butcherName : '🏢 ${(order as dynamic).kermesId.split('_').first.toUpperCase()} Kermesi';
    final courierId = (order as dynamic).courierId ?? '';
    final isClaimed = courierId.isNotEmpty;
    final isMyOrder = courierId == FirebaseAuth.instance.currentUser?.uid;
    final orderIdTrimmed = ((order as dynamic).orderNumber != null) ? (order as dynamic).orderNumber.toString() : (order as dynamic).id.substring(0, 6).toUpperCase();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isMyOrder 
              ? Colors.blue.withValues(alpha: 0.4)
              : Colors.grey.withValues(alpha: 0.15),
          width: isMyOrder ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: status + order ID
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusConfig.$2.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${statusConfig.$1} ${statusConfig.$3}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: statusConfig.$2,
                  ),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '#$orderIdTrimmed',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.amber,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Business name
          Row(
            children: [
              const Icon(Icons.store, size: 16, color: Colors.grey),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  businessName,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Items + total
          Row(
            children: [
              Icon(Icons.shopping_bag_outlined, size: 15, color: Colors.grey[500]),
              const SizedBox(width: 4),
              Text(
                '${(order.items as List).length} ürün',
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
              const SizedBox(width: 16),
              Text(
                '${(order.totalAmount as double).toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: Colors.green),
              ),
              const Spacer(),
              // Claimed indicator
              if (isClaimed)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isMyOrder ? Colors.blue.withValues(alpha: 0.1) : Colors.purple.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isMyOrder ? '👤 Benim' : '👤 Alındı',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isMyOrder ? Colors.blue : Colors.purple,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  (String, Color, String) _getStatusConfig(String status) {
    switch (status) {
      case 'pending':
        return ('⏳', Colors.amber, 'Bekliyor');
      case 'preparing':
        return ('🔥', Colors.amber, 'Hazırlanıyor');
      case 'ready':
        return ('✅', Colors.purple, 'Hazır');
      case 'accepted':
        return ('🚗', Colors.blue, 'Kabul Edildi');
      case 'onTheWay':
        return ('🚗', Colors.blue, 'Teslimatta');
      default:
        return ('❓', Colors.grey, status);
    }
  }

  /// Build the completed deliveries section with cash summary
  Widget _buildCompletedDeliveriesSection() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const SizedBox.shrink();

    return StreamBuilder<List<dynamic>>(
      stream: _getCombinedCompletedDeliveriesTodayStream(user.uid),
      builder: (context, snapshot) {
        // Always show the section, even if empty for today
        final completedOrders = snapshot.data ?? [];
        
        // Calculate cash total
        final cashOrders = completedOrders.where((o) => 
          o.paymentMethod == 'cash' || o.paymentMethod == 'nakit'
        ).toList();
        final cashTotal = cashOrders.fold<double>(
          0, (acc, o) => acc + o.totalAmount
        );

        // Calculate NFC card total
        // ignore: unused_local_variable
        final nfcOrders = completedOrders.where((o) => 
          o.paymentMethod == 'card_on_delivery' || o.paymentMethod == 'kapidakart' || o.paymentMethod == 'card_nfc'
        ).toList();

        // Calculate online card total
        final cardOrders = completedOrders.where((o) => 
          o.paymentMethod == 'card' || o.paymentMethod == 'kart' || o.paymentMethod == 'online'
        ).toList();
        final cardTotal = cardOrders.fold<double>(
          0, (acc, o) => acc + o.totalAmount
        );

        // Calculate total km from deliveryProof
        final totalKm = completedOrders.fold<double>(
          0, (acc, o) {
            final proof = o.deliveryProof;
            if (proof != null && proof['distanceKm'] != null) {
              return acc + (proof['distanceKm'] as num).toDouble();
            }
            return acc;
          }
        );

        // Calculate total tips earned today
        final totalTips = completedOrders.fold<double>(
          0, (acc, o) => acc + o.tipAmount,
        );
        final tippedCount = completedOrders.where((o) => o.tipAmount > 0).length;

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final bgColor = isDark ? Colors.grey[900] : Colors.grey[100];
        final borderColor = isDark ? Colors.grey[700] : Colors.grey[300];
        
        return Container(
          constraints: const BoxConstraints(minHeight: 60),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border(top: BorderSide(color: borderColor!)),
          ),
          child: snapshot.connectionState == ConnectionState.waiting
            ? ListTile(
                leading: Icon(Icons.history, color: Colors.amber),
                title: Text(tr('common.loading')),
              )
            : ExpansionTile(
            backgroundColor: bgColor,
            collapsedBackgroundColor: bgColor,
            initiallyExpanded: true,
            leading: const Icon(Icons.history, color: Colors.amber),
            title: Text(
              'Bugün: ${completedOrders.length} teslimat',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
            subtitle: Row(
              children: [
                // KM Badge
                if (totalKm > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(right: 6, top: 4),
                    decoration: BoxDecoration(
                      color: Colors.blue[600],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '🛣️ ${totalKm.toStringAsFixed(1)} km',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
                // Cash Badge
                if (cashTotal > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(right: 6, top: 4),
                    decoration: BoxDecoration(
                      color: Colors.green[700],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '💵 ${cashTotal.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
                // Card Badge
                if (cardTotal > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: Colors.purple[600],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '💳 ${cardTotal.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
                // Tip Badge
                if (totalTips > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(left: 6, top: 4),
                    decoration: BoxDecoration(
                      color: Colors.amber[700],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '💰 ${totalTips.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()} ($tippedCount)',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            children: completedOrders.isEmpty
                ? [
                    Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        tr('driver.bugun_henuz_teslimat_yok'),
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  ]
                : completedOrders.map((order) => _buildCompletedDeliveryItem(order)).toList(),
          ),
        );
      },
    );
  }

  /// Build a single completed delivery item
  Widget _buildCompletedDeliveryItem(dynamic order) {
    final proof = order.deliveryProof;
    final distanceKm = proof?['distanceKm'] as num?;
    final isCash = order.paymentMethod == 'cash' || order.paymentMethod == 'nakit';
    
    // Extract PLZ and city from delivery address
    String locationInfo = '';
    final String? deliveryAddr = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).deliveryAddress : null;
    if (deliveryAddr != null && deliveryAddr.isNotEmpty) {
      // Try to extract PLZ and city from address string (e.g., "Straße 123, 44135 Dortmund")
      final addressParts = deliveryAddr.split(',');
      if (addressParts.length >= 2) {
        // Take the last part which usually contains PLZ + City
        locationInfo = addressParts.last.trim();
      } else {
        // Just use the full address
        locationInfo = deliveryAddr;
      }
    } else if (order.runtimeType.toString() != 'LokmaOrder') {
      locationInfo = 'Kermes Alanı';
    }
    
    // Order number (first 6 chars)
    final orderNumber = (order as dynamic).orderNumber ?? (order as dynamic).id.substring(0, 6).toUpperCase();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final businessName = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).butcherName : '🏢 ${(order as dynamic).kermesId.split('_').first.toUpperCase()} Kermesi';
    final deliveredAt = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).deliveredAt : (order as dynamic).completedAt;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
      ),
      child: Row(
        children: [
          // Payment method icon
          Icon(
            isCash ? Icons.payments : Icons.credit_card,
            color: isCash ? Colors.green : Colors.purple,
            size: 22,
          ),
          const SizedBox(width: 10),
          // Order info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Order number + business name
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '#$orderNumber',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.amber.shade800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        businessName,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // Location + time + km
                Row(
                  children: [
                    Icon(Icons.location_on, size: 12, color: Colors.grey[500]),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        locationInfo.isNotEmpty ? locationInfo : 'Adres yok',
                        style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                // Time + km
                Text(
                  '${deliveredAt?.hour.toString().padLeft(2, '0')}:${deliveredAt?.minute.toString().padLeft(2, '0')}${distanceKm != null ? ' • ${distanceKm.toStringAsFixed(1)} km' : ''}',
                  style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
          // Price + Tip
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: isCash ? Colors.green[700] : Colors.purple[700],
                ),
              ),
              if (order.tipAmount > 0) ...[
                const SizedBox(height: 2),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '💰 +${order.tipAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber.shade800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryCard(dynamic order) {
    final currentUserId = FirebaseAuth.instance.currentUser?.uid;
    final isClaimedByMe = (order as dynamic).courierId != null && 
                          (order as dynamic).courierId == currentUserId;
    
    // Status determination
    final orderStatus = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).status.name : (order as dynamic).status.name;
    final isOnTheWay = orderStatus == 'onTheWay' || orderStatus == 'accepted';
    final isReady = orderStatus == 'ready';
    final isPreparing = orderStatus == 'preparing';
    
    // Colors and text based on claim status
    // Colors match admin panel: pending=amber, preparing=orange, ready=purple
    Color statusColor;
    String statusText;
    IconData statusIcon;
    
    if (isClaimedByMe) {
      statusColor = Colors.blue;
      statusText = isOnTheWay ? '🚗 Yolda' : tr('driver.ustlenildi');
      statusIcon = Icons.local_shipping;
    } else if (isReady) {
      statusColor = Colors.purple;
      statusText = 'Hazır';
      statusIcon = Icons.check_circle;
    } else if (isPreparing) {
      statusColor = Colors.amber;
      statusText = 'Hazırlanıyor';
      statusIcon = Icons.restaurant;
    } else {
      statusColor = Colors.amber;
      statusText = 'Bekliyor';
      statusIcon = Icons.hourglass_top;
    }
    
    // Extract PLZ + City for cleaner display
    final String? deliveryAddr = (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).deliveryAddress : null;
    String shortAddress = deliveryAddr ?? ((order.runtimeType.toString() == 'LokmaOrder') ? 'Adres yok' : 'Kermes Alanı');
    if (deliveryAddr != null && deliveryAddr.contains(',')) {
      final parts = deliveryAddr.split(',');
      if (parts.length >= 2) {
        shortAddress = parts.sublist(1).join(',').trim();
      }
    }

    return GestureDetector(
      onTap: isClaimedByMe ? () {
        // Navigate to active delivery screen for claimed orders
        if (order.runtimeType.toString() == 'KermesOrder') {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => KermesActiveDeliveryScreen(orderId: order.id),
            ),
          );
        } else {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ActiveDeliveryScreen(orderId: order.id),
            ),
          );
        }
      } : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
          border: isClaimedByMe 
              ? Border.all(color: Colors.blue, width: 2) 
              : isReady 
                  ? Border.all(color: Colors.purple, width: 2) 
                  : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            // Top header row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Icon(statusIcon, size: 18, color: statusColor),
                  const SizedBox(width: 6),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  // Order number
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isClaimedByMe ? Colors.blue : Colors.amber,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Business name
                  Text(
                    (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).butcherName : '🏢 ${(order as dynamic).kermesId.split('_').first.toUpperCase()} Kermesi',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  // Address row
                  Row(
                    children: [
                      const Icon(Icons.location_on, size: 16, color: Colors.red),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          shortAddress,
                          style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  // Price row
                  Row(
                    children: [
                      Text(
                        '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 18,
                          color: Colors.green,
                        ),
                      ),
                      const Spacer(),
                      // Payment method
                      Icon(
                        order.paymentMethod == 'card_on_delivery' || order.paymentMethod == 'kapidakart' || order.paymentMethod == 'card_nfc'
                            ? Icons.contactless
                            : order.paymentMethod == 'cash' || order.paymentMethod == 'nakit'
                                ? Icons.payments
                                : Icons.credit_card,
                        size: 18,
                        color: order.paymentMethod == 'card_on_delivery' || order.paymentMethod == 'kapidakart' || order.paymentMethod == 'card_nfc'
                            ? const Color(0xFF6A0DAD)
                            : order.paymentMethod == 'cash' || order.paymentMethod == 'nakit'
                                ? Colors.green
                                : Colors.purple,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Order notes
                  if (order.notes != null && order.notes!.isNotEmpty) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.1),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('📝', style: TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              order.notes!,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.amber[800],
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  // Action button row
                  Row(
                    children: [
                      // NFC Ödeme butonu — kapıda kart ödemesi gereken siparişlerde
                      if (isClaimedByMe &&
                          isOnTheWay &&
                          (order.paymentMethod == 'cash_on_delivery' ||
                           order.paymentMethod == 'card_on_delivery' ||
                           order.paymentMethod == 'kapidakart')) ...[
                        Expanded(
                          child: ElevatedButton.icon(
                            icon: const Icon(Icons.contactless, size: 18),
                            label: Text(tr('driver.nfc_odeme'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF6A0DAD),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: () async {
                                final result = await TapToPaySheet.show(
                                  context: context,
                                  amount: (order.totalAmount as num).toDouble(),
                                  businessId: (order.runtimeType.toString() == 'LokmaOrder') ? (order as dynamic).butcherId : (order as dynamic).kermesId,
                                  orderId: order.id,
                                  courierId: FirebaseAuth.instance.currentUser?.uid,
                                  label: tr('driver.kapida_kart_odemesi'),
                                );
                              if (result != null && result.success && mounted) {
                                  // Firestore'da ödeme durumunu güncelle
                                  final collectionPath = (order.runtimeType.toString() == 'LokmaOrder') ? 'orders' : 'kermes_orders';
                                  await FirebaseFirestore.instance
                                      .collection(collectionPath)
                                      .doc(order.id)
                                      .update({
                                    'paymentStatus': 'collected',
                                    'paymentMethod': 'card_nfc',
                                    'terminalPaymentIntentId': result.paymentIntentId,
                                    'tapToPayAt': FieldValue.serverTimestamp(),
                                  });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('staff.card_payment_received'.tr()),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                }
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      // Ana aksiyon butonu
                      Expanded(
                        child: ElevatedButton(
                          onPressed: isClaimedByMe 
                              ? () {
                                  if (order.runtimeType.toString() == 'KermesOrder') {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => KermesActiveDeliveryScreen(orderId: order.id),
                                      ),
                                    );
                                  } else {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => ActiveDeliveryScreen(orderId: order.id),
                                      ),
                                    );
                                  }
                                }
                              : isReady 
                                  ? () => _claimDelivery(order) 
                                  : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isClaimedByMe 
                                ? Colors.blue 
                                : isReady 
                                    ? Colors.purple 
                                    : Colors.grey[200],
                            foregroundColor: isClaimedByMe || isReady 
                                ? Colors.white 
                                : Colors.grey[500],
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: isClaimedByMe || isReady ? 2 : 0,
                          ),
                          child: Text(
                            isClaimedByMe 
                                ? '🚗 Devam Et' 
                                : isReady 
                                    ? tr('driver.ustlen') 
                                    : isPreparing 
                                        ? '👨\u200d🍳 Hazırlanıyor' 
                                        : '⏳ Bekliyor',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet widget showing assigned businesses with order counts
class _BusinessListSheet extends StatefulWidget {
  final List<String> businessIds;
  final OrderService orderService;

  const _BusinessListSheet({
    required this.businessIds,
    required this.orderService,
  });

  @override
  State<_BusinessListSheet> createState() => _BusinessListSheetState();
}

class _BusinessListSheetState extends State<_BusinessListSheet> {
  /// Open map app picker for a business address
  Future<void> _openBusinessNavigation(String? address) async {
    if (address == null || address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('driver.business_address_not_found'))),
      );
      return;
    }
    final encodedAddress = Uri.encodeComponent(address);
    // Show bottom sheet to let user pick maps app
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  tr('driver.harita_uygulamasi_secin'),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.map, color: Colors.green, size: 28),
                title: Text(tr('common.apple_maps')),
                onTap: () async {
                  Navigator.pop(ctx);
                  final appleUri = Uri.parse('maps://?q=$encodedAddress');
                  if (await canLaunchUrl(appleUri)) {
                    await launchUrl(appleUri, mode: LaunchMode.externalApplication);
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.location_on, color: Colors.red, size: 28),
                title: Text(tr('common.google_maps')),
                onTap: () async {
                  Navigator.pop(ctx);
                  final googleAppUri = Uri.parse('comgooglemaps://?q=$encodedAddress');
                  final googleWebUri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encodedAddress');
                  if (await canLaunchUrl(googleAppUri)) {
                    await launchUrl(googleAppUri, mode: LaunchMode.externalApplication);
                  } else if (await canLaunchUrl(googleWebUri)) {
                    await launchUrl(googleWebUri, mode: LaunchMode.externalApplication);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Text(
            tr('driver.atanmis_i_sletmeler'),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          // Business list with order counts
          Flexible(
            child: StreamBuilder<List<LokmaOrder>>(
              stream: widget.orderService.getDriverDeliveriesStream(widget.businessIds),
              builder: (context, ordersSnapshot) {
                final allOrders = ordersSnapshot.data ?? [];
                
                return FutureBuilder<List<Map<String, dynamic>>>(
                  future: _fetchBusinessDetails(widget.businessIds, allOrders),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }
                    
                    final businesses = snapshot.data!;
                    
                    return ListView.builder(
                      shrinkWrap: true,
                      itemCount: businesses.length,
                      itemBuilder: (context, index) {
                        final biz = businesses[index];
                        return _buildBusinessRow(context, biz);
                      },
                    );
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Future<List<Map<String, dynamic>>> _fetchBusinessDetails(
    List<String> ids,
    List<LokmaOrder> allOrders,
  ) async {
    final List<Map<String, dynamic>> result = [];
    
    for (final id in ids) {
      // Fetch business name and address
      String name = id;
      String? address;
      try {
        final doc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(id)
            .get();
        if (doc.exists) {
          final data = doc.data();
          name = data?['companyName'] ?? data?['businessName'] ?? data?['name'] ?? id;
          // Build address from fields
          final street = data?['street'] ?? data?['address'] ?? '';
          final plz = data?['postalCode'] ?? data?['plz'] ?? '';
          final city = data?['city'] ?? '';
          if (street.toString().isNotEmpty) {
            address = '$street, $plz $city'.trim();
          }
        }
      } catch (_) {}
      
      // Count orders for this business
      final businessOrders = allOrders.where((o) => o.butcherId == id).toList();
      final pending = businessOrders.where((o) => o.status == OrderStatus.pending).length;
      final preparing = businessOrders.where((o) => o.status == OrderStatus.preparing).length;
      final ready = businessOrders.where((o) => o.status == OrderStatus.ready).length;
      
      result.add({
        'id': id,
        'name': name,
        'address': address,
        'pending': pending,
        'preparing': preparing,
        'ready': ready,
        'total': pending + preparing + ready,
      });
    }
    
    return result;
  }

  Widget _buildBusinessRow(BuildContext context, Map<String, dynamic> biz) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final address = biz['address'] as String?;
    return GestureDetector(
      onTap: () => _openBusinessNavigation(address),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
        ),
        child: Row(
          children: [
            // Business icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.amber.shade100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.store,
                color: Colors.amber.shade700,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            // Business name + address
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    biz['name'] as String,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (address != null && address.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      address,
                      style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 4),
                  // Order count badges
                  Row(
                    children: [
                      if ((biz['pending'] as int) > 0)
                        _buildCountBadge(biz['pending'] as int, Colors.amber, '⏳'),
                      if ((biz['preparing'] as int) > 0)
                        _buildCountBadge(biz['preparing'] as int, Colors.amber, '🍳'),
                      if ((biz['ready'] as int) > 0)
                        _buildCountBadge(biz['ready'] as int, Colors.green, '✅'),
                      if ((biz['total'] as int) == 0)
                        Text(
                          tr('driver.siparis_yok'),
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[500],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            // Navigate button
            if (address != null && address.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.navigation, color: Colors.white, size: 14),
                    SizedBox(width: 4),
                    Text(tr('driver.gi_t'), style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                  ],
                ),
              )
            else if ((biz['total'] as int) > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.amber,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${biz['total']}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCountBadge(int count, Color color, String emoji) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 10)),
          const SizedBox(width: 2),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: HSLColor.fromColor(color).withLightness(0.3).toColor(),
            ),
          ),
        ],
      ),
    );
  }
}
