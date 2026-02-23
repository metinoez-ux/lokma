import 'dart:io';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:image_picker/image_picker.dart';
import '../../services/order_service.dart';
import '../../services/shift_service.dart';
import '../../services/location_tracking_service.dart';
import '../../utils/currency_utils.dart';

/// Staff Delivery Screen - Shows pending deliveries for staff to claim
class StaffDeliveryScreen extends StatefulWidget {
  final String businessId;
  
  const StaffDeliveryScreen({super.key, required this.businessId});

  @override
  State<StaffDeliveryScreen> createState() => _StaffDeliveryScreenState();
}

class _StaffDeliveryScreenState extends State<StaffDeliveryScreen> {
  final OrderService _orderService = OrderService();
  String? _staffName;
  String? _staffPhone;
  bool _isLoading = false;
  bool _checkedActiveDelivery = false;

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
    } else {
      if (mounted) {
        setState(() => _checkedActiveDelivery = true);
      }
    }
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
          _staffName = data['name'] ?? data['displayName'] ?? 'Personel';
          _staffPhone = data['phone'] ?? data['phoneNumber'] ?? '';
        });
      }
    }
  }

  Future<void> _claimDelivery(LokmaOrder order) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || _staffName == null) return;

    // Check if staff is on break — ask to end break first
    final shiftService = ShiftService();
    if (shiftService.shiftStatus == 'paused') {
      final endBreak = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(tr('staff.break_continues')),
          content: const Text(
            'Teslimat üstlenmek için molanız sonlandırılacak.\n\n'
            'Devam etmek istiyor musunuz?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(tr('common.cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFB335B)),
              child: const Text('Molayı Bitir ve Üstlen', style: TextStyle(color: Colors.white)),
            ),
          ],
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

    // Confirm dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('driver.take_delivery')),
        content: Text(
          'Bu siparişi üstlenmek istediğinize emin misiniz?\n\n'
          '📍 ${order.deliveryAddress ?? "Adres yok"}\n'
          '💰 ${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(tr('common.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFB335B)),
            child: const Text('Üstlen', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);

    final success = await _orderService.claimDelivery(
      orderId: order.id,
      courierId: user.uid,
      courierName: _staffName!,
      courierPhone: _staffPhone ?? '',
    );

    setState(() => _isLoading = false);

    if (success && mounted) {
      final breakEnded = shiftService.shiftStatus == 'active' && shiftService.isOnShift;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            breakEnded
                ? '☕ Molanız durduruldu. Teslimatınızı teslim edebilirsiniz!'
                : '✅ Teslimat üstlenildi! Konum takibi başladı.',
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
        backgroundColor: const Color(0xFFFB335B),
        foregroundColor: Colors.white,
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
                                'Bekleyen teslimat yok',
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
            leading: const Icon(Icons.history, color: Color(0xFFFB335B)),
            title: Row(
              children: [
                Text(
                  'Bugün: ${completedOrders.length}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
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
                        fontWeight: FontWeight.bold,
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
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            subtitle: cashTotal > 0 
              ? Text(
                  'Kasaya teslim edilecek nakit',
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
      final addressParts = order.deliveryAddress!.split(',');
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
          isCash ? Icons.payments : Icons.credit_card,
          color: isCash ? Colors.green : Colors.blue,
          size: 20,
        ),
        title: Row(
          children: [
            Text(
              orderNum,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
              style: TextStyle(
                color: isCash ? Colors.green[700] : Colors.grey[600],
                fontWeight: FontWeight.bold,
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
        ? '✅ HAZIR' 
        : isPreparing 
            ? '🍳 Hazırlanıyor' 
            : '⏳ Bekliyor';
    
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
                    color: const Color(0xFFFB335B).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '#${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFFB335B),
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
                      fontWeight: FontWeight.bold,
                      color: statusColor,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
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
                    order.deliveryAddress ?? 'Adres belirtilmemiş',
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
                      ? '🚗 BEN ÜSTLENDİM' 
                      : isPreparing 
                          ? '👨‍🍳 Hazırlanıyor - Bekleyin'
                          : '⏳ Sipariş bekleniyor',
                  style: TextStyle(
                    color: isReady ? Colors.white : Colors.grey[600],
                    fontWeight: FontWeight.bold,
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
class ActiveDeliveryScreen extends StatefulWidget {
  final String orderId;
  
  const ActiveDeliveryScreen({super.key, required this.orderId});

  @override
  State<ActiveDeliveryScreen> createState() => _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends State<ActiveDeliveryScreen> {
  final OrderService _orderService = OrderService();
  final LocationTrackingService _locationService = LocationTrackingService();

  @override
  void initState() {
    super.initState();
    // Auto-resume tracking if order is already onTheWay
    _resumeTrackingIfNeeded();
  }

  /// Resume tracking if the order is already onTheWay but tracking stopped
  /// (e.g., app was killed and reopened, or user navigated away and back)
  Future<void> _resumeTrackingIfNeeded() async {
    if (_locationService.isTracking && _locationService.activeOrderId == widget.orderId) {
      debugPrint('[ActiveDelivery] Already tracking order ${widget.orderId}');
      return;
    }
    
    // Check Firestore for current order status
    try {
      final order = await _orderService.getOrder(widget.orderId);
      if (order != null && order.status == OrderStatus.onTheWay) {
        debugPrint('[ActiveDelivery] Resuming tracking for onTheWay order ${widget.orderId}');
        await _locationService.startTracking(widget.orderId);
      }
    } catch (e) {
      debugPrint('[ActiveDelivery] Error resuming tracking: $e');
    }
  }

  @override
  void dispose() {
    // Do NOT stop tracking on dispose - the singleton keeps tracking
    // Tracking is stopped only when delivery is completed or cancelled
    super.dispose();
  }

  Future<void> _completeDelivery() async {
    // Get order to check payment method
    final orderSnapshot = await _orderService.getOrder(widget.orderId);
    if (orderSnapshot == null) return;
    
    final paymentMethod = orderSnapshot.paymentMethod ?? 'cash';
    final isCash = paymentMethod == 'cash' || paymentMethod == 'nakit';
    final amount = orderSnapshot.totalAmount.toStringAsFixed(2);
    
    // STEP 1: Cash collection confirmation (only if cash payment)
    if (isCash) {
      final cashConfirm = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: Text(tr('payments.step1_payment_collection')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFB335B).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFB335B), width: 2),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.payments, color: Color(0xFFFB335B), size: 32),
                    const SizedBox(width: 12),
                    Text(
                      '$amount${CurrencyUtils.getCurrencySymbol()}',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFFFB335B)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text('Parayı müşteriden tahsil ettiniz mi?', style: TextStyle(fontSize: 16)),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(tr('common.cancel'))),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFB335B)),
              child: const Text('✓ Evet, Tahsil Ettim', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      if (cashConfirm != true) return;
    }
    
    // STEP 2: Delivery type selection
    final deliveryType = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _DeliveryTypeSheet(isCash: isCash),
    );
    
    if (deliveryType == null) return;
    
    String? proofPhotoUrl;
    
    // If left at door, require photo
    if (deliveryType == 'left_at_door') {
      proofPhotoUrl = await _captureProofPhoto();
      if (proofPhotoUrl == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr('driver.photo_required')), backgroundColor: Colors.red),
          );
        }
        return;
      }
    }
    
    // Complete delivery with proof
    _locationService.stopTracking();
    await _orderService.completeDeliveryWithProof(
      widget.orderId,
      deliveryType: deliveryType,
      proofPhotoUrl: proofPhotoUrl,
    );
    
    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('driver.delivery_completed_success')), backgroundColor: Colors.green),
      );
    }
  }
  
  Future<String?> _captureProofPhoto() async {
    final ImagePicker picker = ImagePicker();
    
    try {
      final XFile? photo = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      
      if (photo == null) return null;
      
      // Show uploading indicator
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('driver.uploading_photo')), duration: Duration(seconds: 10)),
        );
      }
      
      // Upload to Firebase Storage
      final file = File(photo.path);
      final fileName = 'delivery_proof_${widget.orderId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final ref = FirebaseStorage.instance.ref().child('delivery_proofs').child(fileName);
      
      await ref.putFile(file);
      final downloadUrl = await ref.getDownloadURL();
      
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
      }
      
      return downloadUrl;
    } catch (e) {
      debugPrint('Photo capture error: $e');
      return null;
    }
  }


  Future<void> _startDelivery() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('driver.head_out')),
        content: Text(tr('driver.did_you_take_order_and_head_out')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(tr('common.no')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFB335B)),
            child: const Text('Evet, Yola Çıkıyorum', 
                              style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _locationService.startTracking(widget.orderId);
      await _orderService.startDelivery(widget.orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('driver.you_are_on_the_way')),
            backgroundColor: const Color(0xFFFB335B),
          ),
        );
      }
    }
  }

  Future<void> _cancelDelivery() async {
    String? selectedReason;
    String otherNotes = '';
    
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(tr('driver.cancel_delivery')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'İptal sebebini seçin:',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                const SizedBox(height: 12),
                
                // Option 1: Address/Customer issue
                RadioListTile<String>(
                  title: const Text('Adres doğru değil / Müşteriye ulaşılamadı', 
                    style: TextStyle(fontSize: 14)),
                  value: 'address_issue',
                  groupValue: selectedReason,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  onChanged: (val) => setDialogState(() => selectedReason = val),
                ),
                
                // Option 2: Other
                RadioListTile<String>(
                  title: const Text('Diğer', style: TextStyle(fontSize: 14)),
                  value: 'other',
                  groupValue: selectedReason,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  onChanged: (val) => setDialogState(() => selectedReason = val),
                ),
                
                // Notes field for "Other" option
                if (selectedReason == 'other') ...[
                  const SizedBox(height: 8),
                  TextField(
                    maxLines: 3,
                    maxLength: 200,
                    onChanged: (val) => otherNotes = val,
                    decoration: InputDecoration(
                      hintText: 'Sebep açıklaması yazın...',
                      hintStyle: TextStyle(color: Colors.grey[400]),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                ],
                
                const SizedBox(height: 8),
                Text(
                  'Sipariş tekrar havuza düşecek.',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(tr('common.no')),
            ),
            ElevatedButton(
              onPressed: selectedReason != null 
                ? () => Navigator.pop(ctx, true) 
                : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: selectedReason != null ? Colors.red : Colors.grey,
              ),
              child: const Text('Evet, İptal Et', 
                                style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );

    if (confirm == true && selectedReason != null) {
      _locationService.stopTracking();
      
      // Build cancellation reason
      final cancellationReason = selectedReason == 'other' && otherNotes.isNotEmpty
          ? otherNotes
          : selectedReason == 'address_issue'
              ? 'Adres doğru değil / Müşteriye ulaşılamadı'
              : 'Diğer';
      
      await _orderService.cancelClaim(widget.orderId, reason: cancellationReason);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('driver.delivery_cancelled')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _callCustomer(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.could_not_open_phone'))),
        );
      }
    }
  }

  Future<void> _openNavigation(String? address) async {
    if (address == null || address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('common.address_not_found'))),
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
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Harita Uygulaması Seçin',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              // Apple Maps
              ListTile(
                leading: const Icon(Icons.map, color: Colors.green, size: 28),
                title: Text(tr('common.apple_maps')),
                subtitle: Text(tr('common.default_ios_map')),
                onTap: () async {
                  Navigator.pop(ctx);
                  // Apple Maps URL scheme
                  final appleUri = Uri.parse('maps://?q=$encodedAddress');
                  if (await canLaunchUrl(appleUri)) {
                    await launchUrl(appleUri, mode: LaunchMode.externalApplication);
                  }
                },
              ),
              // Google Maps
              ListTile(
                leading: const Icon(Icons.location_on, color: Colors.red, size: 28),
                title: Text(tr('common.google_maps')),
                subtitle: Text(tr('common.google_map_app')),
                onTap: () async {
                  Navigator.pop(ctx);
                  // Try Google Maps app first, fallback to web
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('driver.active_delivery')),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.cancel_outlined),
            tooltip: 'Teslimatı İptal Et',
            onPressed: _cancelDelivery,
          ),
        ],
      ),
      body: StreamBuilder<LokmaOrder?>(
        stream: _orderService.getOrderStream(widget.orderId),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final order = snapshot.data!;
          // Use enum comparison, not string comparison (OrderStatus is an enum)
          final isReady = order.status == OrderStatus.ready;
          final isOnTheWay = order.status == OrderStatus.onTheWay;
          final isPreparing = order.status == OrderStatus.preparing;
          final isWaiting = !isReady && !isOnTheWay;
          
          // Payment info
          final paymentMethod = order.paymentMethod ?? 'cash';
          final isPaid = paymentMethod == 'card' || paymentMethod == 'online';
          
          // Use Column with Expanded ScrollView + fixed bottom button
          return Column(
            children: [
              // Scrollable content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Compact status banner for waiting orders
                      if (isWaiting)
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: isPreparing 
                              ? Colors.amber.withValues(alpha: isDark ? 0.3 : 0.1) 
                              : Colors.grey.withValues(alpha: isDark ? 0.3 : 0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isPreparing ? Colors.amber : Colors.grey,
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isPreparing ? Icons.restaurant : Icons.hourglass_empty,
                                color: isPreparing ? Colors.amber : Colors.grey,
                                size: 24,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  isPreparing ? '👨‍🍳 Hazırlanıyor - Bekle...' : '⏳ Sipariş Bekleniyor',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: theme.colorScheme.onSurface,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      
                      // Compact Order Info Row (ID + Business)
                      Card(
                        color: isDark ? theme.cardColor : null,
                        margin: EdgeInsets.zero,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              const Icon(Icons.receipt_long, color: Colors.amber, size: 24),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Sipariş #${order.orderNumber ?? order.id.substring(0, 6).toUpperCase()}',
                                      style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold,
                                        color: theme.colorScheme.onSurface,
                                      ),
                                    ),
                                    Text(
                                      order.butcherName,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 8),
                      
                      // Customer + Address Row (Compact 2-column)
                      Row(
                        children: [
                          // Customer Card
                          Expanded(
                            child: Card(
                              color: isDark ? theme.cardColor : null,
                              margin: EdgeInsets.zero,
                              child: InkWell(
                                onTap: () => _callCustomer(order.userPhone),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('👤 Müşteri', style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
                                      const SizedBox(height: 4),
                                      Text(order.userPhone, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: theme.colorScheme.onSurface)),
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(15)),
                                        child: const Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.phone, color: Colors.white, size: 14),
                                            SizedBox(width: 4),
                                            Text('ARA', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Address Card
                          Expanded(
                            child: Card(
                              color: isDark ? theme.cardColor : null,
                              margin: EdgeInsets.zero,
                              child: InkWell(
                                onTap: () => _openNavigation(order.deliveryAddress),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('📍 Adres', style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
                                      const SizedBox(height: 4),
                                      Text(
                                        order.deliveryAddress ?? 'Adres yok',
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: theme.colorScheme.onSurface),
                                      ),
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(color: Colors.blue, borderRadius: BorderRadius.circular(15)),
                                        child: const Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.navigation, color: Colors.white, size: 14),
                                            SizedBox(width: 4),
                                            Text('GİT', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 8),
                      
                      // Payment + Total Row (Compact)
                      Card(
                        color: isDark ? theme.cardColor : null,
                        margin: EdgeInsets.zero,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              Icon(isPaid ? Icons.credit_card : Icons.payments, color: isPaid ? Colors.green : Colors.amber, size: 24),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      isPaid ? '✅ ÖDENDİ' : '💵 KAPIDA ÖDEME',
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: isPaid ? Colors.green : Colors.amber),
                                    ),
                                    Text(
                                      isPaid ? 'Online ödeme yapıldı' : 'Müşteriden tahsil edilecek',
                                      style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isPaid ? Colors.green : Colors.amber),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      // Delivery Notes (if exists) - Compact
                      if (order.notes != null && order.notes!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Card(
                            color: Colors.amber.withValues(alpha: isDark ? 0.2 : 0.1),
                            margin: EdgeInsets.zero,
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.note_alt, color: Colors.amber, size: 20),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      order.notes!,
                                      style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface, fontStyle: FontStyle.italic),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      
                      // Order Items (Collapsed by default)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: ExpansionTile(
                          tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                          title: Text(
                            '🛒 Sipariş İçeriği (${order.items.length} ürün)',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface.withValues(alpha: 0.8)),
                          ),
                          children: order.items.map((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              children: [
                                Text('${item.quantity}x', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.amber)),
                                const SizedBox(width: 8),
                                Expanded(child: Text(item.name, style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface))),
                                Text('${(item.price * item.quantity).toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withValues(alpha: 0.7))),
                              ],
                            ),
                          )).toList(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              
              // Fixed Bottom Action Button
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: SizedBox(
                    height: 52,
                    width: double.infinity,
                    child: isOnTheWay 
                      ? ElevatedButton.icon(
                          onPressed: _completeDelivery,
                          icon: const Icon(Icons.check_circle, color: Colors.white, size: 24),
                          label: const Text(
                            '✅ TESLİMAT TAMAMLANDI',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                          ),
                        )
                      : isReady
                        ? ElevatedButton.icon(
                            onPressed: _startDelivery,
                            icon: const Icon(Icons.motorcycle, color: Colors.white, size: 24),
                            label: const Text(
                              '🚗 YOL AL',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFFB335B),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                            ),
                          )
                        : Container(
                            decoration: BoxDecoration(
                              color: isDark ? Colors.grey[800] : Colors.grey[300],
                              borderRadius: BorderRadius.circular(26),
                            ),
                            child: Center(
                              child: Text(
                                isPreparing ? '🍳 Hazırlanıyor...' : '⏳ Sipariş Bekleniyor...',
                                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                            ),
                          ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

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
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
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
            border: Border.all(color: color.withValues(alpha: 0.5), width: 2),
            borderRadius: BorderRadius.circular(12),
            color: color.withValues(alpha: 0.1),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.2),
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
                        fontWeight: FontWeight.bold,
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
