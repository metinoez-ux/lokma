
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
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
import '../../providers/driver_provider.dart';
import '../../utils/currency_utils.dart';
import '../orders/order_chat_screen.dart';
import '../../services/chat_service.dart';
import 'proof_of_delivery_sheet.dart';
import '../shared/tap_to_pay_sheet.dart';
import 'package:lokma_app/widgets/lokma_network_image.dart';

class KermesActiveDeliveryScreen extends StatefulWidget {
  final String orderId;
  final KermesOrder? initialOrder;
  
  const KermesActiveDeliveryScreen({super.key, required this.orderId, this.initialOrder});

  @override
  State<KermesActiveDeliveryScreen> createState() => _KermesActiveDeliveryScreenState();
}

class _KermesActiveDeliveryScreenState extends State<KermesActiveDeliveryScreen> {
  final KermesOrderService _orderService = KermesOrderService();
  final LocationTrackingService _locationService = LocationTrackingService();

  // ── Compass state for precise pin navigation ──
  StreamSubscription<Position>? _positionSubscription;
  double? _driverLat;
  double? _driverLng;
  double? _distanceToPin; // meters
  double? _bearingToPin; // degrees
  bool _compassActive = false;
  bool _isCompleting = false; // Guard against double-tap
  bool _hasPopped = false; // Guard against double pop

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  Future<void> _initializeScreen() async {
    // Run initialization after first frame to prevent blocking UI build
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final order = await _orderService.getOrder(widget.orderId);
        if (order == null) return;

        // 1. Resume tracking if needed
        if (!_locationService.isTracking || _locationService.activeOrderId != widget.orderId) {
          if (order.status == KermesOrderStatus.onTheWay) {
            debugPrint('[ActiveDelivery] Resuming tracking for onTheWay order ${widget.orderId}');
            await _locationService.startTracking(widget.orderId, isKermes: true);
          }
        }

        // 2. Start compass if order has precise pin (Kermes currently does not have precise pin lat/lng)
        // returning early for now.
        return;
      } catch (e) {
        debugPrint('[ActiveDelivery] Init error: $e');
      }
    });
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    // Do NOT stop tracking on dispose - the singleton keeps tracking
    // Tracking is stopped only when delivery is completed or cancelled
    super.dispose();
  }

  Future<void> _completeDelivery(KermesOrder orderSnapshot) async {
    // Guard against multiple taps
    if (_isCompleting) return;
    setState(() => _isCompleting = true);
    
    try {
    
    final paymentMethod = orderSnapshot.paymentMethod ?? 'cash';
    final isCash = paymentMethod == 'cash' || paymentMethod == 'nakit';
    final isCardOnDelivery = paymentMethod == 'card_on_delivery' || paymentMethod == 'kapidakart';
    final amount = orderSnapshot.totalAmount.toStringAsFixed(2);
    
    // GUARD: Block completion if card_on_delivery payment not yet collected
    if (isCardOnDelivery) {
      final currentStatus = orderSnapshot.isPaid ? 'collected' : 'pending';
      if (currentStatus != 'collected') {
        if (mounted) {
          await showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: Text('staff.payment_not_collected'.tr()),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6A0DAD).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF6A0DAD), width: 2),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.contactless, color: Color(0xFF6A0DAD), size: 32),
                        const SizedBox(width: 12),
                        Text(
                          '$amount${CurrencyUtils.getCurrencySymbol()}',
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: Color(0xFF6A0DAD)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Önce kart ödemesini NFC ile tahsil etmeniz gerekiyor.',
                    style: TextStyle(fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
              actions: [
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6A0DAD)),
                  child: Text(tr('Tamam'), style: const TextStyle(color: Colors.white)),
                ),
              ],
            ),
          );
        }
        return;
      }
    }
    
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
                  color: const Color(0xFFEA184A).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFEA184A), width: 2),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.payments, color: Color(0xFFEA184A), size: 32),
                    const SizedBox(width: 12),
                    Text(
                      '$amount${CurrencyUtils.getCurrencySymbol()}',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: Color(0xFFEA184A)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(tr('Parayı müşteriden tahsil ettiniz mi?'), style: const TextStyle(fontSize: 16)),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(tr('common.cancel'))),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA184A)),
              child: const Text('✓ Evet, Tahsil Ettim', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      if (cashConfirm != true) return;
    }
    
    // Stop tracking immediately
    _locationService.stopTracking();
    
    // Complete delivery with PoD option via Bottom Sheet
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ProofOfDeliverySheet(orderId: widget.orderId),
    );

    if (result == null) return; // User cancelled

    final deliveryType = result['deliveryType'] as String;
    final photoPath = result['photoPath'] as String?;

    await _orderService.completeDeliveryWithProof(
      widget.orderId,
      deliveryType: deliveryType,
    );
    
    // Upload photo in background if provided
    if (photoPath != null) {
      FirebaseStorage.instance
          .ref()
          .child('delivery_proofs')
          .child('delivery_proof_${widget.orderId}_${DateTime.now().millisecondsSinceEpoch}.jpg')
          .putFile(File(photoPath))
          .then((task) async {
            final url = await task.ref.getDownloadURL();
            // Note: Kermes orders are stored in 'kermes_orders'
            await FirebaseFirestore.instance.collection('kermes_orders').doc(widget.orderId).update({
              'deliveryProof.photoUrl': url,
            });
          })
          .catchError((e) => debugPrint('Background photo upload failed: $e'));
    }
    if (mounted) {
      _hasPopped = true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('driver.delivery_completed_success')), backgroundColor: Colors.green),
      );
      Navigator.pop(context);
    }
    } catch (e) {
      debugPrint('[ActiveDelivery] _completeDelivery error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isCompleting = false);
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
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA184A)),
            child: Text('staff.yes_on_my_way'.tr(), 
                              style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _locationService.startTracking(widget.orderId, isKermes: true);
      await _orderService.startDelivery(widget.orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('driver.you_are_on_the_way')),
            backgroundColor: const Color(0xFFEA184A),
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
                  title: Text('staff.address_wrong_unreachable'.tr(), 
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
              child: Text('common.yes_cancel'.tr(), 
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

  Future<void> _openNavigation(String? address, {double? lat, double? lng}) async {
    // Prefer precise GPS coordinates if available
    final useCoordinates = lat != null && lng != null;
    
    if (!useCoordinates && (address == null || address.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('common.address_not_found'))),
      );
      return;
    }
    
    final encodedAddress = address != null ? Uri.encodeComponent(address) : '';
    
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
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  useCoordinates ? '📍 Hassas Konum Navigasyonu' : 'Harita Uygulaması Seçin',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
              // Apple Maps
              ListTile(
                leading: const Icon(Icons.map, color: Colors.green, size: 28),
                title: Text(tr('common.apple_maps')),
                subtitle: Text(useCoordinates ? 'GPS koordinatlarına git' : tr('common.default_ios_map')),
                onTap: () async {
                  Navigator.pop(ctx);
                  final appleUri = useCoordinates
                      ? Uri.parse('maps://?ll=$lat,$lng&q=Teslimat%20Noktası')
                      : Uri.parse('maps://?q=$encodedAddress');
                  if (await canLaunchUrl(appleUri)) {
                    await launchUrl(appleUri, mode: LaunchMode.externalApplication);
                  }
                },
              ),
              // Google Maps
              ListTile(
                leading: const Icon(Icons.location_on, color: Colors.red, size: 28),
                title: Text(tr('common.google_maps')),
                subtitle: Text(useCoordinates ? 'GPS koordinatlarına git' : tr('common.google_map_app')),
                onTap: () async {
                  Navigator.pop(ctx);
                  final googleAppUri = useCoordinates
                      ? Uri.parse('comgooglemaps://?daddr=$lat,$lng&directionsmode=walking')
                      : Uri.parse('comgooglemaps://?q=$encodedAddress');
                  final googleWebUri = useCoordinates
                      ? Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=walking')
                      : Uri.parse('https://www.google.com/maps/search/?api=1&query=$encodedAddress');
                  
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



  /// Build compass widget for last-mile precision navigation
  Widget _buildCompassWidget(KermesOrder order, bool isDark) {
    final distText = _distanceToPin != null
        ? (_distanceToPin! < 1000
            ? '${_distanceToPin!.round()}m'
            : '${(_distanceToPin! / 1000).toStringAsFixed(1)}km')
        : '...';
    
    final isClose = _compassActive; // < 200m
    final pinCode = '';
    
    return Card(
      color: isClose
          ? (isDark ? const Color(0xFF1B3A1B) : const Color(0xFFE8F5E9))
          : (isDark ? theme_cardColor(isDark) : null),
      margin: const EdgeInsets.only(top: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isClose ? const BorderSide(color: Colors.green, width: 2) : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Icon(
                  isClose ? Icons.near_me : Icons.gps_fixed,
                  color: isClose ? Colors.green : Colors.blue,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isClose ? '📍 Hassas Konuma Yaklaşıyorsunuz!' : '📍 Hassas Buluşma Noktası',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: isClose ? Colors.green : (isDark ? Colors.white : Colors.black87),
                    ),
                  ),
                ),
                // Distance badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isClose ? Colors.green : Colors.blue,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    distText,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
              ],
            ),
            
            // Compass arrow (only when close)
            if (isClose && _bearingToPin != null) ...[
              const SizedBox(height: 12),
              Center(
                child: Transform.rotate(
                  angle: _bearingToPin! * (pi / 180),
                  child: const Icon(Icons.navigation, color: Colors.green, size: 48),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  'Müşterinin konumuna doğru yürüyün',
                  style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                ),
              ),
            ],
            
            // PIN code display
            if (pinCode.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[800] : Colors.grey[100],
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.lock_outline, size: 18, color: Colors.amber),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Teslimat PIN: Müşteriden isteyin',
                        style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700]),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            
            // Navigate to precise pin button
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _openNavigation(
                  order.address,
                  lat: null,
                  lng: null,
                ),
                icon: const Icon(Icons.navigation, color: Colors.white, size: 18),
                label: Text(tr('Hassas Konuma Git'), style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color? theme_cardColor(bool isDark) => isDark ? const Color(0xFF2C2C2E) : null;

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
          // Chat with customer button
          StreamBuilder<KermesOrder?>(
            stream: _orderService.getOrderStream(widget.orderId),
            builder: (context, snap) {
              final order = snap.data;
              return IconButton(
                icon: StreamBuilder<int>(
                  stream: ChatService().getUnreadCountStream(widget.orderId, FirebaseAuth.instance.currentUser?.uid ?? '', isKermes: true),
                  builder: (context, badgeSnap) {
                    final unreadCount = badgeSnap.data ?? 0;
                    return Stack(
                      children: [
                        const Icon(Icons.chat_bubble_outline),
                        if (unreadCount > 0)
                          Positioned(
                            right: 0,
                            top: 0,
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: BoxDecoration(
                                color: Colors.red,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              constraints: const BoxConstraints(
                                minWidth: 12,
                                minHeight: 12,
                              ),
                              child: Text(
                                '$unreadCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.bold,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
                tooltip: 'Müşteriye Mesaj',
                onPressed: () {
                  if (order != null) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OrderChatScreen(
                          orderId: widget.orderId,
                          isKermes: true,
                          orderNumber: order.orderNumber ?? widget.orderId.substring(0, 6).toUpperCase(),
                          recipientName: 'Müşteri: ${order.customerName}',
                          recipientRole: 'customer',
                        ),
                      ),
                    );
                  }
                },
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.cancel_outlined),
            tooltip: 'Teslimatı İptal Et',
            onPressed: _cancelDelivery,
          ),
        ],
      ),
      body: StreamBuilder<KermesOrder?>(
        initialData: widget.initialOrder,
        stream: _orderService.getOrderStream(widget.orderId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snapshot.hasData || snapshot.data == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 64, color: Colors.amber),
                  const SizedBox(height: 16),
                  const Text('Sipariş bulunamadı veya silinmiş.', style: TextStyle(fontSize: 16)),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Geri Dön'),
                  ),
                ],
              ),
            );
          }

          final order = snapshot.data!;
          // Use enum comparison, not string comparison (KermesOrderStatus is an enum)
          final isReady = order.status == KermesOrderStatus.ready;
          final isOnTheWay = order.status == KermesOrderStatus.onTheWay;
          final isPreparing = order.status == KermesOrderStatus.preparing;
          final isWaiting = !isReady && !isOnTheWay;
          
          // Payment info
          final paymentMethod = order.paymentMethod ?? 'cash';
          final isPaid = paymentMethod == 'card' || paymentMethod == 'online';
          final isCardOnDelivery = paymentMethod == 'card_on_delivery' || paymentMethod == 'kapidakart';
          final isNfcCollected = paymentMethod == 'card_nfc';
          
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
                              ? Colors.amber.withOpacity(isDark ? 0.3 : 0.1) 
                              : Colors.grey.withOpacity(isDark ? 0.3 : 0.1),
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
                                    fontWeight: FontWeight.w600,
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
                                        fontWeight: FontWeight.w600,
                                        color: theme.colorScheme.onSurface,
                                      ),
                                    ),
                                    Text(
                                      order.kermesName,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: theme.colorScheme.onSurface.withOpacity(0.7),
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
                                onTap: () => _callCustomer(order.customerPhone),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(tr('👤 Müşteri'), style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withOpacity(0.6))),
                                      const SizedBox(height: 4),
                                      Text(order.customerPhone, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface)),
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(15)),
                                        child: const Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.phone, color: Colors.white, size: 14),
                                            SizedBox(width: 4),
                                            Text('ARA', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
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
                                onTap: () => _openNavigation(order.address),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('📍 Adres', style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withOpacity(0.6))),
                                      const SizedBox(height: 4),
                                      Text(
                                        order.address ?? 'Adres yok',
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
                                            Text('GİT', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
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

                      // 📍 Precise Pin Compass Widget (Phase 2)
                      _buildCompassWidget(order, isDark),
                      
                      const SizedBox(height: 8),
                      
                      // Payment + Total Row (Compact)
                      Card(
                        color: isDark ? theme.cardColor : null,
                        margin: EdgeInsets.zero,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              Icon(
                                isCardOnDelivery ? Icons.contactless 
                                    : isNfcCollected ? Icons.check_circle
                                    : isPaid ? Icons.credit_card 
                                    : Icons.payments, 
                                color: isCardOnDelivery ? const Color(0xFF6A0DAD)
                                    : isNfcCollected ? Colors.green
                                    : isPaid ? Colors.green 
                                    : Colors.amber, 
                                size: 24,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      isNfcCollected ? '✅ KART İLE ALINDI'
                                          : isCardOnDelivery ? '📱 KAPIDA KART'
                                          : isPaid ? '✅ ÖDENDİ' 
                                          : '💵 KAPIDA NAKİT',
                                      style: TextStyle(
                                        fontSize: 13, 
                                        fontWeight: FontWeight.w600, 
                                        color: isCardOnDelivery ? const Color(0xFF6A0DAD)
                                            : isNfcCollected ? Colors.green
                                            : isPaid ? Colors.green 
                                            : Colors.amber,
                                      ),
                                    ),
                                    Text(
                                      isNfcCollected ? 'NFC ile tahsil edildi'
                                          : isCardOnDelivery ? 'NFC ile tahsil edilecek'
                                          : isPaid ? 'Online ödeme yapıldı' 
                                          : 'Müşteriden nakit tahsil edilecek',
                                      style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withOpacity(0.6)),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '${order.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                                style: TextStyle(
                                  fontSize: 22, 
                                  fontWeight: FontWeight.w600, 
                                  color: isCardOnDelivery ? const Color(0xFF6A0DAD)
                                      : isNfcCollected ? Colors.green
                                      : isPaid ? Colors.green 
                                      : Colors.amber,
                                ),
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
                            color: Colors.amber.withOpacity(isDark ? 0.2 : 0.1),
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
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface.withOpacity(0.8)),
                          ),
                          children: order.items.map((item) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              children: [
                                Text('${item.quantity}x', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.amber)),
                                const SizedBox(width: 8),
                                Expanded(child: Text(item.name, style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface))),
                                Text('${(item.price * item.quantity).toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}', style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withOpacity(0.7))),
                              ],
                            ),
                          )).toList(),
                        ),
                      ),

                      // Delivery Proof Photo Preview
                      if (null?['photoUrl'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: InkWell(
                            onTap: () {
                              showDialog(
                                context: context,
                                builder: (_) => Dialog(
                                  backgroundColor: Colors.transparent,
                                  insetPadding: EdgeInsets.zero,
                                  child: Stack(
                                    fit: StackFit.loose,
                                    children: [
                                      InteractiveViewer(
                                        panEnabled: true,
                                        minScale: 0.5,
                                        maxScale: 4,
                                        child: LokmaNetworkImage(
                                          imageUrl: null!['photoUrl'],
                                          fit: BoxFit.contain,
                                          placeholder: (context, url) => const Center(child: CircularProgressIndicator(color: Colors.amber)),
                                          errorWidget: (context, url, error) => const Icon(Icons.error, color: Colors.white, size: 50),
                                        ),
                                      ),
                                      Positioned(
                                        top: 40,
                                        right: 20,
                                        child: IconButton(
                                          icon: const Icon(Icons.close, color: Colors.white, size: 30),
                                          onPressed: () => Navigator.pop(context),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                height: 180,
                                width: double.infinity,
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.amber.withOpacity(0.5), width: 2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    LokmaNetworkImage(
                                      imageUrl: null!['photoUrl'],
                                      fit: BoxFit.cover,
                                      placeholder: (context, url) => const Center(child: CircularProgressIndicator(color: Colors.amber)),
                                      errorWidget: (context, url, error) => const Icon(Icons.error, color: Colors.amber),
                                    ),
                                    Positioned(
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 8),
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.bottomCenter,
                                            end: Alignment.topCenter,
                                            colors: [Colors.black.withOpacity(0.8), Colors.transparent],
                                          ),
                                        ),
                                        child: const Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.zoom_in, color: Colors.white, size: 16),
                                            SizedBox(width: 4),
                                            Text(
                                              'Fotoğrafı Büyüt',
                                              style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                                            ),
                                          ],
                                        ),
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
                ),
              ),
              
              // Fixed Bottom Action Area
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // NFC Payment button for card_on_delivery (only when on-the-way)
                      if (isOnTheWay && isCardOnDelivery && !isNfcCollected) ...[
                        SizedBox(
                          height: 52,
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              final result = await TapToPaySheet.show(
                                context: context,
                                amount: order.totalAmount,
                                businessId: order.kermesId,
                                orderId: order.id,
                                courierId: FirebaseAuth.instance.currentUser?.uid,
                                label: 'Kapıda Kart Ödemesi',
                              );
                              if (result != null && result.success && mounted) {
                                await FirebaseFirestore.instance
                                    .collection('orders')
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
                            icon: const Icon(Icons.contactless, color: Colors.white, size: 24),
                            label: const Text(
                              '📱 Kart ile Tahsil Et',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF6A0DAD),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      // Main action button
                      SizedBox(
                        height: 52,
                        width: double.infinity,
                        child: isOnTheWay 
                          ? ElevatedButton.icon(
                              onPressed: () => _completeDelivery(order!),
                              icon: const Icon(Icons.check_circle, color: Colors.white, size: 24),
                              label: const Text(
                                'TESLİMAT TAMAMLANDI',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
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
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFEA184A),
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
                                    style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w600, fontSize: 15),
                                  ),
                                ),
                              ),
                      ),
                    ],
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
