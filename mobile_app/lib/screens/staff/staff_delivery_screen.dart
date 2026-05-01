import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:image_picker/image_picker.dart';
import '../../services/order_service.dart';
import '../../services/shift_service.dart';
import '../../services/location_tracking_service.dart';
import '../driver/active_delivery_screen.dart';
import '../driver/kermes_active_delivery_screen.dart';
import '../../providers/driver_provider.dart';
import '../../utils/currency_utils.dart';
import '../orders/order_chat_screen.dart';
import '../../services/chat_service.dart';
import '../shared/tap_to_pay_sheet.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Staff Delivery Screen - Shows pending deliveries for staff to claim
class StaffDeliveryScreen extends ConsumerStatefulWidget {
  final String businessId;
  
  const StaffDeliveryScreen({super.key, required this.businessId});

  @override
  ConsumerState<StaffDeliveryScreen> createState() => _StaffDeliveryScreenState();
}

class _StaffDeliveryScreenState extends ConsumerState<StaffDeliveryScreen> {
  final OrderService _orderService = OrderService();
  String? _staffName;
  String? _staffPhone;
  bool _isLoading = false;
  bool _checkedActiveDelivery = false; // ignore: unused_field

  @override
  void initState() {
    super.initState();
    _loadStaffInfo();
    _checkForActiveDelivery();
  }

  /// Check if user has an active delivery and redirect if so
  Future<void> _checkForActiveDelivery() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    // Listen once for active delivery
    final activeDelivery = await _orderService
        .getMyActiveDeliveryStream(user.uid)
        .first;
    
    if (activeDelivery != null && mounted) {
      // User has an active delivery - redirect to it
      _checkedActiveDelivery = true;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ActiveDeliveryScreen(orderId: activeDelivery.id),
        ),
      );
      return;
    }

    setState(() => _isLoading = false);
  }

  Future<void> _loadStaffInfo() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final doc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();
      if (doc.exists) {
        final data = doc.data()!;
        setState(() {
          _staffName = data['name'] ?? data['displayName'] ?? tr('driver.surucu');
          _staffPhone = data['phone'] ?? data['phoneNumber'] ?? '';
        });
      }
    }
  }

  Future<void> _claimDelivery(LokmaOrder order) async {
    final user = FirebaseAuth.instance.currentUser;
    final driverState = ref.read(driverProvider);
    final driverName = _staffName ?? driverState.driverInfo?.name ?? 'Personel';
    final driverPhone = _staffPhone ?? driverState.driverInfo?.phone ?? '';
    
    if (user == null) return;

    // Check if staff is on break — ask to end break first
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
                      color: Colors.grey.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.15),
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
              color: Colors.black.withOpacity(0.1),
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
                    color: Colors.grey.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.withOpacity(0.15),
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
                  border: Border.all(color: Colors.grey.withOpacity(0.1)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
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
                          decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                          child: const Icon(Icons.location_on, color: Colors.red, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Teslimat Adresi', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                              Text(
                                order.deliveryAddress ?? "Adres yok",
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
                          decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
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

    final success = await _orderService.claimDelivery(
      orderId: order.id,
      courierId: user.uid,
      courierName: driverName,
      courierPhone: driverPhone,
    );

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
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ActiveDeliveryScreen(orderId: order.id),
        ),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr('driver.delivery_already_taken')),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('driver.pending_deliveries')),
        backgroundColor: const Color(0xFFEA184A),
        foregroundColor: Colors.white,
        actions: [
          StreamBuilder<dynamic>(
            stream: FirebaseAuth.instance.currentUser != null 
              ? _orderService.getMyActiveDeliveryStream(FirebaseAuth.instance.currentUser!.uid)
              : Stream.value([]),
            builder: (context, snapshot) {
              if (snapshot.hasData && snapshot.data != null && (snapshot.data as List).isNotEmpty) {
                final dynamic activeOrder = (snapshot.data as List).first;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final String typeName = activeOrder.runtimeType.toString();
                      if (typeName.contains('Kermes')) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => KermesActiveDeliveryScreen(orderId: activeOrder.id),
                          ),
                        );
                      } else {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ActiveDeliveryScreen(orderId: activeOrder.id),
                          ),
                        );
                      }
                    },
                    icon: const Icon(Icons.motorcycle, size: 18),
                    label: const Text('Devam', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Available deliveries (main section)
                Expanded(
                  child: StreamBuilder<List<LokmaOrder>>(
                    stream: _orderService.getReadyDeliveriesStream(widget.businessId),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_outline, 
                                   size: 80, color: Colors.grey[400]),
                              const SizedBox(height: 16),
                              Text(
                                tr('driver.no_pending_deliveries'),
                                style: TextStyle(
                                  fontSize: 18,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        );
                      }

                      final orders = snapshot.data!;
                      return ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: orders.length,
                        itemBuilder: (context, index) {
                          final order = orders[index];
                          return _buildDeliveryCard(order);
                        },
                      );
                    },
                  ),
                ),
                // Today's completed deliveries (collapsible)
                _buildCompletedDeliveriesSection(),
              ],
            ),
    );
  }

  /// Build the completed deliveries section with cash summary
  Widget _buildCompletedDeliveriesSection() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const SizedBox.shrink();

    return StreamBuilder<List<LokmaOrder>>(
      stream: _orderService.getMyCompletedDeliveriesToday(user.uid),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return const SizedBox.shrink();
        }

        final completedOrders = snapshot.data!;
        
        // Calculate cash total
        final cashOrders = completedOrders.where((o) => 
          o.paymentMethod == 'cash' || o.paymentMethod == 'nakit'
        ).toList();
        final cashTotal = cashOrders.fold<double>(
          0, (sum, o) => sum + o.totalAmount
        );

        // Calculate total km from deliveryProof
        final totalKm = completedOrders.fold<double>(
          0, (sum, o) {
            final proof = o.deliveryProof;
            if (proof != null && proof['distanceKm'] != null) {
              return sum + (proof['distanceKm'] as num).toDouble();
            }
            return sum;
          }
        );

        return Container(
          decoration: BoxDecoration(
            color: Colors.grey[100],
            border: Border(top: BorderSide(color: Colors.grey[300]!)),
          ),
          child: ExpansionTile(
            backgroundColor: Colors.grey[100],
            collapsedBackgroundColor: Colors.grey[100],
            leading: const Icon(Icons.history, color: Color(0xFFEA184A)),
            title: Row(
              children: [
                Text(
                  'Bugün: ${completedOrders.length}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const Spacer(),
                // KM Badge
                if (totalKm > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    margin: const EdgeInsets.only(right: 6),
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
                    decoration: BoxDecoration(
                      color: Colors.green[700],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '💰 ${cashTotal.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
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
            subtitle: cashTotal > 0 
              ? Text(
                  tr('staff.cash_to_register'),
                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                )
              : null,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 200),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: completedOrders.length,
                  itemBuilder: (context, index) {
                    return _buildCompletedOrderTile(completedOrders[index]);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Build privacy-compliant completed order tile
  /// Shows: Order number, PLZ/city only, collapsible items
  Widget _buildCompletedOrderTile(LokmaOrder order) {
    // Extract PLZ and city from address (privacy: no full address)
    String locationHint = '';
    if (order.deliveryAddress != null) {
      // Try to find PLZ (5 digits)
      final plzMatch = RegExp(r'\b\d{5}\b').firstMatch(order.deliveryAddress!);
      if (plzMatch != null) {
        locationHint = plzMatch.group(0)!;
        // Try to find city after PLZ
        final afterPlz = order.deliveryAddress!.substring(plzMatch.end).trim();
        final cityMatch = RegExp(r'^[,\s]*([A-Za-zäöüÄÖÜß]+)').firstMatch(afterPlz);
        if (cityMatch != null) {
          locationHint += ' ${cityMatch.group(1)}';
        }
      }
    }

    final isCash = order.paymentMethod == 'cash' || order.paymentMethod == 'nakit';
    final isCardOnDelivery = order.paymentMethod == 'card_on_delivery' || order.paymentMethod == 'kapidakart' || order.paymentMethod == 'card_nfc';
    final orderNum = order.orderNumber ?? '#${order.id.substring(0, 6).toUpperCase()}';
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: ExpansionTile(
        dense: true,
        tilePadding: const EdgeInsets.symmetric(horizontal: 12),
        leading: Icon(
          isCardOnDelivery ? Icons.contactless : isCash ? Icons.payments : Icons.credit_card,
          color: isCardOnDelivery ? const Color(0xFF6A0DAD) : isCash ? Colors.green : Colors.blue,
          size: 20,
        ),
        title: Row(
          children: [
            Text(
              orderNum,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
              style: TextStyle(
                color: isCash ? Colors.green[700] : Colors.grey[600],
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            // Show km if available
            if (order.deliveryProof?['distanceKm'] != null) ...[
              const SizedBox(width: 6),
              Text(
                '${(order.deliveryProof!['distanceKm'] as num).toStringAsFixed(1)}km',
                style: TextStyle(
                  color: Colors.blue[600],
                  fontSize: 11,
                ),
              ),
            ],
          ],
        ),
        subtitle: locationHint.isNotEmpty 
            ? Text(locationHint, style: const TextStyle(fontSize: 11))
            : null,
        trailing: Text(
          _formatTime(order.deliveredAt),
          style: TextStyle(fontSize: 11, color: Colors.grey[500]),
        ),
        children: [
          // Collapsible order items for memory
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: order.items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  '• ${item.quantity.toStringAsFixed(item.quantity == item.quantity.roundToDouble() ? 0 : 1)} ${item.unit} ${item.name}',
                  style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                ),
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime? dt) {
    if (dt == null) return '';
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildDeliveryCard(LokmaOrder order) {
    // Status-based colors - use enum comparison
    final isReady = order.status == OrderStatus.ready;
    final isPreparing = order.status == OrderStatus.preparing;
    final statusColor = isReady 
        ? Colors.green 
        : isPreparing 
            ? Colors.amber 
            : Colors.grey;
    final statusText = isReady 
        ? tr('orders.status_ready') 
        : isPreparing 
            ? tr('orders.status_preparing') 
            : tr('orders.status_pending');
    
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: isReady ? 8 : 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: isReady ? BorderSide(color: Colors.green, width: 2) : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with status badge
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEA184A).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFEA184A),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Colors.green,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            
            // Customer info
            Row(
              children: [
                const Icon(Icons.person, color: Colors.grey, size: 20),
                const SizedBox(width: 8),
                Text(
                  order.userName,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
              ],
            ),
            const SizedBox(height: 8),
            
            // Address
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on, color: Colors.red, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    order.deliveryAddress ?? tr('common.no_address'),
                    style: TextStyle(color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Items summary
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${order.items.length} ürün',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    order.items.map((i) => i.name).take(3).join(', ') +
                        (order.items.length > 3 ? '...' : ''),
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Claim button - ONLY active when order is READY
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                // Only allow claiming when order is ready
                onPressed: isReady ? () => _claimDelivery(order) : null,
                icon: Icon(
                  isReady ? Icons.motorcycle : isPreparing ? Icons.restaurant : Icons.hourglass_empty,
                  color: isReady ? Colors.white : Colors.grey,
                ),
                label: Text(
                  isReady 
                      ? tr('driver.i_claimed') 
                      : isPreparing 
                          ? tr('driver.preparing_wait')
                          : tr('driver.order_pending'),
                  style: TextStyle(
                    color: isReady ? Colors.white : Colors.grey[600],
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isReady ? Colors.green : Colors.grey[200],
                  disabledBackgroundColor: Colors.grey[200],
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Active Delivery Screen - For courier who claimed the order


/// Bottom sheet for selecting delivery confirmation type
class _DeliveryTypeSheet extends StatelessWidget {
  final bool isCash;
  
  const _DeliveryTypeSheet({required this.isCash});
  
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[400],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            isCash ? '📦 Adım 2: Teslimat Türü' : '📦 Teslimat Türü',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'Siparişi nasıl teslim ettiniz?',
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
          const SizedBox(height: 24),
          
          // Option 1: Personal handoff
          _buildOption(
            context,
            icon: Icons.person,
            color: Colors.green,
            title: 'Bizzat Teslim Ettim',
            subtitle: 'Müşterinin kendisine teslim edildi',
            value: 'personal_handoff',
          ),
          const SizedBox(height: 12),
          
          // Option 2: Handed to someone else
          _buildOption(
            context,
            icon: Icons.people,
            color: Colors.blue,
            title: 'Başka Birine Teslim Ettim',
            subtitle: 'Aile üyesi, komşu veya başka biri',
            value: 'handed_to_other',
          ),
          const SizedBox(height: 12),
          
          // Option 3: Left at door (requires photo)
          _buildOption(
            context,
            icon: Icons.door_front_door,
            color: Colors.amber,
            title: 'Kapıya Bıraktım',
            subtitle: '⚠️ Fotoğraf çekmeniz gerekecek',
            value: 'left_at_door',
            requiresPhoto: true,
          ),
          
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(tr('common.cancel')),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
        ],
      ),
    );
  }
  
  Widget _buildOption(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required String value,
    bool requiresPhoto = false,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => Navigator.pop(context, value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: color.withOpacity(0.5), width: 2),
            borderRadius: BorderRadius.circular(12),
            color: color.withOpacity(0.1),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: requiresPhoto ? Colors.amber : Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: color),
            ],
          ),
        ),
      ),
    );
  }
}
