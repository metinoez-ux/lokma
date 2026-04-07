import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/models/guest_profile_model.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/providers/group_order_provider.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/services/guest_profile_service.dart';
import 'package:lokma_app/widgets/kermes/order_qr_dialog.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';
import 'package:lokma_app/widgets/kermes/group_order_share_sheet.dart';
import '../../utils/currency_utils.dart';
import '../../widgets/qr_scanner_screen.dart';
import '../../services/staff_role_service.dart';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl_phone_field/intl_phone_field.dart';

/// Unified Checkout Sheet - Tüm sipariş akışı tek bir tam ekran bottom sheet'te
class KermesCheckoutSheet extends ConsumerStatefulWidget {
  final KermesEvent event;
  final String? initialTableNumber;
  final int? initialDeliveryMode;
  
  const KermesCheckoutSheet({
    super.key, 
    required this.event,
    this.initialTableNumber,
    this.initialDeliveryMode,
  });
  
  @override
  ConsumerState<KermesCheckoutSheet> createState() => _KermesCheckoutSheetState();
}

class _KermesCheckoutSheetState extends ConsumerState<KermesCheckoutSheet> {
  // Checkout adimlari
  int _currentStep = 0;
  
  // Form degerleri
  bool _isGroupOrder = false; // Step 2: Bireysel/Ailecek
  DeliveryType? _deliveryType; // Step 3: Teslimat
  PaymentMethodType _paymentMethod = PaymentMethodType.cash; // Step 5: Odeme
  String? _selectedSectionId; // Step 1: Bolum Secimi (kadin_bolumu, erkek_bolumu, aile_bolumu)
  bool _showManualSectionSelection = false;
  
  // Kişisel bilgiler
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _tableController = TextEditingController();
  String _completePhoneNumber = '';

  @override
  void initState() {
    super.initState();
    if (widget.initialTableNumber != null) {
      _deliveryType = DeliveryType.masada;
    } else {
      _deliveryType = null;
    }
    
    if (widget.initialTableNumber != null) {
      _tableController.text = widget.initialTableNumber!;
      // QR masadan gelen siparis: masanin bolumunu otomatik ata
      final section = widget.event.findSectionForTable(widget.initialTableNumber!);
      if (section != null) {
        _selectedSectionId = section.id;
      }
    }
    // Tek bolum varsa otomatik sec
    if (_selectedSectionId == null && widget.event.sectionDefs.length == 1) {
      _selectedSectionId = widget.event.sectionDefs.first.id;
    }
    
    // Autofill user info if logged in or has guest profile
    _prefillUserInfo();
  }
  
  Future<void> _prefillUserInfo() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      if (user.displayName != null && user.displayName!.isNotEmpty) {
        _nameController.text = user.displayName!;
      }
      if (user.phoneNumber != null && user.phoneNumber!.isNotEmpty) {
        _phoneController.text = user.phoneNumber!;
        _completePhoneNumber = user.phoneNumber!;
      } else {
        // Fetch from firestore if phone not in auth object
        try {
          final db = FirebaseFirestore.instance;
          final doc = await db.collection('users').doc(user.uid).get();
          if (doc.exists) {
            final data = doc.data()!;
            if (_nameController.text.isEmpty && data['name'] != null) {
              _nameController.text = data['name'];
            }
            if (_phoneController.text.isEmpty && data['phone'] != null) {
              _phoneController.text = data['phone'];
              _completePhoneNumber = data['phone'];
            }
          }
        } catch (_) {}
      }
    }
  }
  
  // Loading state
  bool _isSubmitting = false;
  bool _isCreatingGroup = false;
  String? _activeGroupOrderId;
  
  // Bagis/yuvarlama
  double _donationAmount = 0.0;
  String _donationTarget = 'none'; // 'kermesOrg' | 'fund' | 'none'
  
  // Renkler
  static const Color lokmaPink = Color(0xFFEA184A);
  Color _darkBg(bool isDark) => isDark ? const Color(0xFF121212) : const Color(0xFFE8E8EC);
  Color _cardBg(bool isDark) => isDark ? const Color(0xFF1E1E1E) : Colors.white;
  
  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _tableController.dispose();
    super.dispose();
  }

  /// Grup siparisi olustur ve paylasim sheet'ini goster
  Future<void> _createAndShareGroupOrder() async {
    final hostName = _nameController.text.trim();
    if (hostName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr('Lutfen isminizi girin')),
          backgroundColor: Colors.amber,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      return;
    }

    setState(() => _isCreatingGroup = true);
    HapticFeedback.mediumImpact();

    try {
      final orderId = await ref.read(groupOrderProvider.notifier).createGroupOrder(
        kermesId: widget.event.id,
        kermesName: widget.event.title,
        hostName: hostName,
        expirationMinutes: 30,
      );

      if (orderId != null && mounted) {
        setState(() {
          _isCreatingGroup = false;
          _activeGroupOrderId = orderId;
        });

        // Show share sheet
        await showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (ctx) => GroupOrderShareSheet(
            orderId: orderId,
            kermesName: widget.event.title,
            hostName: hostName,
            expirationMinutes: 30,
            expiresAt: DateTime.now().add(const Duration(minutes: 30)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isCreatingGroup = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Grup siparisi olusturulamadi: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
  
  /// Kermes aktiflik durumu kontrolleri
  bool get _isKermesActive {
    final now = DateTime.now();
    return now.isAfter(widget.event.startDate.subtract(const Duration(hours: 1))) && 
           now.isBefore(widget.event.endDate.add(const Duration(hours: 2)));
  }
  
  bool get _isKermesFuture => DateTime.now().isBefore(widget.event.startDate);
  /// Toplam adim sayisi
  int get _totalSteps => 5;

  /// Adim baslik listesi
  List<String> get _stepTitles {
    return [
      'Sepetim',
      'Siparis Turu',
      'Teslimat',
      'Bilgileriniz',
      'Odeme',
    ];
  }
  
  /// Ileri butonu aktif mi?
  bool get _canProceed {
    final effectiveStep = _getEffectiveStep(_currentStep);
    switch (effectiveStep) {
      case 'cart':
        return ref.read(kermesCartProvider).isNotEmpty;
      case 'orderType':
        return true;
      case 'delivery':
        if (_deliveryType == null) return false;
        if (_deliveryType == DeliveryType.kurye) return true;
        if (widget.event.sectionDefs.length <= 1) return true;
        
        if (_deliveryType == DeliveryType.gelAl) {
          return _selectedSectionId != null;
        }
        
        if (_deliveryType == DeliveryType.masada) {
          return _selectedSectionId != null;
        }
        return true;
      case 'info':
        if (!_isKermesActive) return false;
        bool isInfoOk = _nameController.text.trim().isNotEmpty && 
               (_phoneController.text.trim().isNotEmpty || _completePhoneNumber.isNotEmpty);
        if (_deliveryType == DeliveryType.masada) {
          isInfoOk = isInfoOk && _tableController.text.trim().isNotEmpty;
        }
        return isInfoOk;
      case 'payment':
        return true;
      default:
        return true;
    }
  }

  /// Step index -> mantiksal adim adi
  String _getEffectiveStep(int step) {
    switch (step) {
      case 0: return 'cart';
      case 1: return 'orderType';
      case 2: return 'delivery';
      case 3: return 'info';
      case 4: return 'payment';
      default: return 'cart';
    }
  }
  
  void _nextStep() {
    // Tarih kontrolu: Sepetten sonra Kermes aktif mi kontrol et
    if (_currentStep == 0 && !_isKermesActive) {
      HapticFeedback.heavyImpact();
      _showKermesDateBlockDialog();
      return;
    }
    
    if (_currentStep < _totalSteps - 1) {
      HapticFeedback.selectionClick();
      setState(() => _currentStep++);
    } else {
      // Son adim - siparisi tamamla
      _submitOrder();
    }
  }
  
  void _showKermesDateBlockDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isFuture = _isKermesFuture;
    final event = widget.event;
    
    // Tarih formatlama
    final months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    String formatDate(DateTime d) => '${d.day} ${months[d.month - 1]} ${d.year}';
    
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: isFuture 
                      ? Colors.orange.withOpacity(0.15)
                      : Colors.red.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isFuture ? Icons.schedule_rounded : Icons.event_busy_rounded,
                  size: 32,
                  color: isFuture ? Colors.orange : Colors.red,
                ),
              ),
              const SizedBox(height: 16),
              
              // Baslik
              Text(
                isFuture 
                    ? 'Kermes Henuz Baslamadi'
                    : 'Kermes Sona Erdi',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              
              // Aciklama
              Text(
                isFuture 
                    ? 'Bu kermes ${formatDate(event.startDate)} tarihinde basliyor.\n\nKermes zamani geldiginde siparislerinizi bekliyoruz!'
                    : 'Bu kermes ${formatDate(event.endDate)} tarihinde sona erdi.\n\nBir dahaki sefere insallah gorusmek uzere!',
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              
              // Tamam butonu
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: lokmaPink,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Tamam',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  void _previousStep() {
    if (_currentStep > 0) {
      HapticFeedback.selectionClick();
      setState(() => _currentStep--);
    } else {
      Navigator.pop(context);
    }
  }
  
  Future<void> _submitOrder() async {
    setState(() => _isSubmitting = true);
    
    try {
      final cartState = ref.read(kermesCartProvider);
      
      // Pfand hesaplama
      final bool hasPfandSystem = widget.event.hasPfandSystem;
      final double pfandAmount = widget.event.pfandAmount;
      int pfandCount = 0;
      if (hasPfandSystem) {
        for (final item in cartState.items) {
          if (item.menuItem.hasPfand) {
            pfandCount += item.quantity;
          }
        }
      }
      final double pfandTotal = pfandCount * pfandAmount;
      final double totalAmount = cartState.totalAmount + pfandTotal + _donationAmount;
      
      // Sipariş öğelerini oluştur
      final orderItems = cartState.items.map((item) => KermesOrderItem(
        name: item.menuItem.name,
        quantity: item.quantity,
        price: item.menuItem.price,
        productId: item.menuItem.name,
        prepZones: item.menuItem.prepZones,
        category: item.menuItem.category,
        imageUrl: item.menuItem.imageUrl,
      )).toList();
      
      // Guest profil servisi
      final guestProfileService = ref.read(guestProfileServiceProvider);
      GuestProfile? guestProfile;
      
      try {
        guestProfile = await guestProfileService.findOrCreateProfile(
          name: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
        );
      } catch (e) {
        debugPrint('Guest profil oluşturulamadı: $e');
      }
      
      // Sipariş servisi
      final orderService = ref.read(kermesOrderServiceProvider);
      
      // Sıralı sipariş numarası oluştur (kermes bazlı)
      String orderNumber;
      try {
        orderNumber = await orderService.generateSequentialOrderId(widget.event.id, tableSection: _selectedSectionId);
      } catch (e) {
        debugPrint('Sıralı ID oluşturulamadı, fallback kullanılıyor: $e');
        orderNumber = orderService.generateFallbackOrderId();
      }
      
      // Benzersiz Firestore doc ID oluştur: kermesId_orderNumber
      final docId = '${widget.event.id}_$orderNumber';
      
      // Staff bilgisi (siparişi alan kişinin garson olup olmadığını anla)
      final roleService = StaffRoleService();
      final isStaff = roleService.isStaff;
      final staffId = isStaff ? FirebaseAuth.instance.currentUser?.uid : null;
      final staffName = isStaff ? roleService.staffName ?? guestProfile?.name : null;

      // Siparis olustur
      final order = KermesOrder(
        id: docId,
        orderNumber: orderNumber,
        kermesId: widget.event.id,
        kermesName: widget.event.city,
        userId: guestProfile?.id,
        customerName: _nameController.text.trim(),
        customerPhone: _completePhoneNumber.isNotEmpty ? _completePhoneNumber : _phoneController.text.trim(),
        deliveryType: _deliveryType ?? DeliveryType.gelAl,
        tableNumber: _tableController.text.isNotEmpty ? _tableController.text : null,
        address: null,
        items: orderItems,
        totalAmount: totalAmount,
        donationAmount: _donationAmount,
        paymentMethod: _paymentMethod,
        isPaid: _paymentMethod == PaymentMethodType.card,
        status: KermesOrderStatus.pending,
        createdAt: DateTime.now(),
        orderSource: isStaff ? 'pos_garson' : 'app',
        tableSection: _selectedSectionId,
        assignedWaiterId: staffId,
        assignedWaiterName: staffName,
        createdByStaffId: staffId,
        createdByStaffName: staffName,
      );
      
      // Siparişi kaydet
      await orderService.createOrder(order);
      
      // Sepeti temizle
      ref.read(kermesCartProvider.notifier).clearCart();
      
      // Başarı - QR göster (kullanıcıya orderNumber göster)
      if (mounted) {
        final rootNavContext = Navigator.of(context, rootNavigator: true).context;
        Navigator.pop(context); // Checkout sheet'i kapat
        
        showOrderQRDialog(
          rootNavContext,
          orderId: docId,
          orderNumber: orderNumber,
          kermesId: widget.event.id,
          kermesName: widget.event.city,
          totalAmount: totalAmount,
          isPaid: _paymentMethod == PaymentMethodType.card,
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr('orders.order_error_e')),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = _darkBg(isDark);
    
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Handle - daha aşağıda konumlandırılmış header için
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 20),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[600] : Colors.grey[400],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Header with step indicator
          _buildHeader(),
          
          // Progress indicator
          _buildProgressBar(),
          
          // Content
          Expanded(
            child: _buildStepContent(),
          ),
          
          // Footer with navigation buttons
          _buildFooter(),
        ],
      ),
    );
  }
  
  
  Widget _buildHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ana header row: Back + Title + Close
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Back button (always visible — step 0 closes sheet, others go back)
              GestureDetector(
                onTap: _previousStep,
                child: Container(
                  padding: EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _cardBg(isDark),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _currentStep > 0 ? Icons.arrow_back_ios_new : Icons.close,
                    color: textColor,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              
              // Title + Step indicator
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _stepTitles[_currentStep],
                      style: TextStyle(
                        color: textColor,
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      'Adim ${_currentStep + 1} / 5',
                      style: TextStyle(
                        color: isDark ? Colors.grey[400]! : Colors.grey[600]!,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Close button
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _cardBg(isDark),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.close,
                    color: textColor,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
          
          // Kermes adı - ayrı satırda
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _cardBg(isDark).withOpacity(0.5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.location_on, color: lokmaPink, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.event.city,
                    style: TextStyle(
                      color: isDark ? Colors.grey[300] : Colors.grey[700],
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildProgressBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(_totalSteps, (index) {
          final isCompleted = index < _currentStep;
          final isCurrent = index == _currentStep;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: index < _totalSteps - 1 ? 4 : 0),
              height: 4,
              decoration: BoxDecoration(
                color: isCompleted || isCurrent 
                    ? lokmaPink 
                    : isDark ? Colors.grey[800] : Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }
  
  Widget _buildStepContent() {
    final effectiveStep = _getEffectiveStep(_currentStep);
    switch (effectiveStep) {
      case 'cart':
        return _buildCartStep();
      case 'orderType':
        return _buildOrderTypeStep();
      case 'delivery':
        return _buildDeliveryStep();
      case 'info':
        return _buildInfoStep();
      case 'payment':
        return _buildPaymentStep();
      default:
        return const SizedBox.shrink();
    }
  }

  /// Step 0: Sepet ozeti
  Widget _buildCartStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    return Consumer(
      builder: (context, ref, child) {
        final cartState = ref.watch(kermesCartProvider);
        
        if (cartState.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shopping_bag_outlined, size: 64, color: isDark ? Colors.grey[700] : Colors.grey[400]),
                const SizedBox(height: 16),
                Text(
                  'Sepetiniz boş',
                  style: TextStyle(color: subtleTextColor, fontSize: 16),
                ),
              ],
            ),
          );
        }
        
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: cartState.items.length + 1, // +1 for total summary
          itemBuilder: (context, index) {
            if (index == cartState.items.length) {
              // Pfand hesaplama - kermes ayarlarına bak
              final bool hasPfandSystem = widget.event.hasPfandSystem;
              final double pfandAmount = widget.event.pfandAmount;
              
              // Pfandlı ürün sayısını hesapla
              int pfandCount = 0;
              if (hasPfandSystem) {
                for (final item in cartState.items) {
                  if (item.menuItem.hasPfand) {
                    pfandCount += item.quantity;
                  }
                }
              }
              final double pfandTotal = pfandCount * pfandAmount;
              final double grandTotal = cartState.totalAmount + pfandTotal;
              
              // Summary card with Pfand breakdown
              return Container(
                margin: const EdgeInsets.only(top: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Ara Toplam (Ürünler)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${cartState.totalItems} ürün',
                          style: TextStyle(color: subtleTextColor, fontSize: 14),
                        ),
                        Text(
                          '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            color: isDark ? Colors.white70 : Colors.black54,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    
                    // Pfand satırı (varsa)
                    if (pfandCount > 0) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.recycling, color: Colors.green, size: 16),
                              const SizedBox(width: 6),
                              Text(
                                'Depozito ($pfandCount adet)',
                                style: TextStyle(color: Colors.green[400], fontSize: 14),
                              ),
                            ],
                          ),
                          Text(
                            '+${pfandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                            style: TextStyle(
                              color: Colors.green[400],
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                    
                    // Ayırıcı çizgi
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Container(
                        height: 1,
                        color: isDark ? Colors.white.withOpacity(0.2) : Colors.black.withOpacity(0.1),
                      ),
                    ),
                    
                    // Toplam Tutar
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Toplam Tutar',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '${grandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }
            
            final cartItem = cartState.items[index];
            final item = cartItem.menuItem;
            final quantity = cartItem.quantity;
            final subtotal = item.price * quantity;
            
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _cardBg(isDark),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          style: TextStyle(
                            color: textColor,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        if (cartItem.selectedOptions.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            cartItem.selectedOptions.map((o) => o.optionName).join(', '),
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[500], fontSize: 13, fontWeight: FontWeight.w500),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 4),
                        Text(
                          '${item.price.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()} x $quantity = ${subtotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(color: subtleTextColor, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  // Controls
                  Container(
                    height: 36,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        GestureDetector(
                          onTap: () => ref.read(kermesCartProvider.notifier).removeFromCart(item.name),
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            child: Icon(Icons.remove, size: 18, color: isDark ? Colors.white70 : Colors.black87),
                          ),
                        ),
                        Container(
                          width: 30,
                          alignment: Alignment.center,
                          child: Text(
                            quantity.toString(),
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => ref.read(kermesCartProvider.notifier).addToCart(item, widget.event.id, widget.event.city),
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            child: Icon(Icons.add, size: 18, color: lokmaPink),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
  
  /// Step 1: Sipariş Türü
  Widget _buildOrderTypeStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Nasil siparis vermek istersiniz?',
            style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 24),
          
          // Bireysel
          _buildOptionCard(
            icon: Icons.person,
            iconColor: Colors.blue,
            title: 'Bireysel Sipariş',
            subtitle: 'Sadece kendiniz için sipariş verin',
            isSelected: !_isGroupOrder,
            onTap: () => setState(() => _isGroupOrder = false),
          ),
          const SizedBox(height: 12),
          
          // Ailecek
          _buildOptionCard(
            icon: Icons.group,
            iconColor: Colors.green,
            title: 'Ailecek Sipariş',
            subtitle: 'Link paylaşın, birlikte sipariş verin',
            badge: 'YENİ',
            isSelected: _isGroupOrder,
            onTap: () => setState(() => _isGroupOrder = true),
          ),
          
          if (_isGroupOrder) ...[
            const SizedBox(height: 24),
            // Name input for group host
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _cardBg(isDark),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Isminiz (Grup Yoneticisi)',
                    style: TextStyle(
                      color: isDark ? Colors.white70 : Colors.black54,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                    decoration: InputDecoration(
                      hintText: 'Orn: Metin',
                      hintStyle: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400]),
                      filled: true,
                      fillColor: isDark ? Colors.grey[900] : Colors.grey[100],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Create group order button
            if (_activeGroupOrderId == null)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isCreatingGroup ? null : _createAndShareGroupOrder,
                  icon: _isCreatingGroup
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                        )
                      : const Icon(Icons.link, size: 20),
                  label: Text(_isCreatingGroup ? 'Olusturuluyor...' : 'Link Olustur ve Paylas'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
              )
            else
              // Group order created - show active state
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.green.withOpacity(0.3)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Icon(Icons.check_circle, color: Colors.green[400], size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Grup siparisi olusturuldu!',
                            style: TextStyle(color: Colors.green[400], fontSize: 15, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: Colors.transparent,
                            builder: (ctx) => GroupOrderShareSheet(
                              orderId: _activeGroupOrderId!,
                              kermesName: widget.event.title,
                              hostName: _nameController.text.trim(),
                              expirationMinutes: 30,
                              expiresAt: DateTime.now().add(const Duration(minutes: 30)),
                            ),
                          );
                        },
                        icon: const Icon(Icons.share, size: 18),
                        label: const Text('Linki Tekrar Paylas'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.green[400],
                          side: BorderSide(color: Colors.green.withOpacity(0.4)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
  
  Widget _buildSectionSelector({required bool includeFamily}) {
    // QR masadan gelen siparis: otomatik atandiysa gosterme
    if (widget.initialTableNumber != null && _selectedSectionId != null) return const SizedBox.shrink();
    if (widget.event.sectionDefs.length <= 1) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;

    final sections = widget.event.sectionDefs.where(
      (s) {
        if (!includeFamily && s.gender == 'mixed') return false;
        if (_deliveryType == DeliveryType.masada && !s.hasDineIn) return false;
        return true;
      }
    ).toList();

    if (sections.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg(isDark),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: lokmaPink.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hangi bölümden almak istersiniz?',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
          const SizedBox(height: 12),
          ...sections.map((section) {
            final isSelected = _selectedSectionId == section.id;
            IconData sectionIcon;
            if (section.gender == 'female') {
              sectionIcon = Icons.woman;
            } else if (section.gender == 'male') {
              sectionIcon = Icons.man;
            } else {
              sectionIcon = Icons.family_restroom;
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() {
                    _selectedSectionId = section.id;
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isSelected ? lokmaPink.withOpacity(0.1) : (isDark ? Colors.grey[800] : Colors.grey[100]),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? lokmaPink : Colors.transparent,
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(sectionIcon, color: isSelected ? lokmaPink : subtleTextColor, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          section.name,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                            color: isSelected ? lokmaPink : textColor,
                          ),
                        ),
                      ),
                      if (isSelected)
                        Icon(Icons.check_circle, color: lokmaPink, size: 18),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  /// Step 2: Teslimat Türü
  Widget _buildDeliveryStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Siparissinizi nasil almak istersiniz?',
            style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 24),
          
          // Gel Al
          _buildOptionCard(
            icon: Icons.shopping_bag_outlined,
            iconColor: Colors.amber,
            title: 'Gel Al',
            subtitle: 'Tezgahtan kendiniz alın',
            badge: widget.event.hasTakeaway ? null : 'KAPALI',
            badgeColor: Colors.grey,
            isSelected: _deliveryType == DeliveryType.gelAl,
            isDisabled: !widget.event.hasTakeaway,
            onTap: widget.event.hasTakeaway
                ? () => setState(() => _deliveryType = DeliveryType.gelAl)
                : null,
          ),
          if (_deliveryType == DeliveryType.gelAl) _buildSectionSelector(includeFamily: false),
          const SizedBox(height: 12),
          
          // Masada
          _buildOptionCard(
            icon: Icons.table_restaurant,
            iconColor: Colors.purple,
            title: 'Masaya Servis',
            subtitle: 'Masanıza getirelim',
            badge: widget.event.hasDineIn ? null : 'KAPALI',
            badgeColor: Colors.grey,
            isSelected: _deliveryType == DeliveryType.masada,
            isDisabled: !widget.event.hasDineIn,
            onTap: widget.event.hasDineIn
                ? () => setState(() => _deliveryType = DeliveryType.masada)
                : null,
          ),
          if (_deliveryType == DeliveryType.masada) ...[
            if (_selectedSectionId != null && _tableController.text.isNotEmpty)
              Container(
                 margin: const EdgeInsets.symmetric(vertical: 8),
                 padding: const EdgeInsets.all(12),
                 decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.green.withOpacity(0.3))),
                 child: Row(children: [
                   const Icon(Icons.check_circle, color: Colors.green), const SizedBox(width: 8),
                   Expanded(child: Text("${widget.event.sectionDefs.firstWhere((s) => s.id == _selectedSectionId, orElse: () => widget.event.sectionDefs.first).name} - Masa ${_tableController.text}", style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold))),
                   TextButton(onPressed: () => setState(() { _tableController.clear(); _selectedSectionId = null; }), child: Text("Değiştir", style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Colors.white70 : Colors.black54)))
                 ])
              )
            else ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _scanTableQR,
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Masa QR Kodunu Okut'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              if (!_showManualSectionSelection)
                Center(
                  child: TextButton(
                    onPressed: () => setState(() => _showManualSectionSelection = true),
                    child: const Text('Masada QR kod yok mu? Bölüm seçerek devam et', style: TextStyle(color: Colors.grey)),
                  ),
                ),
              if (_showManualSectionSelection)
                _buildSectionSelector(includeFamily: true),
            ],
          ],
          const SizedBox(height: 12),
          
          // Kurye
          _buildOptionCard(
            icon: Icons.delivery_dining,
            iconColor: Colors.teal,
            title: 'Kurye ile Teslimat',
            subtitle: 'Adresinize getirelim',
            badge: widget.event.hasDelivery ? null : 'KAPALI',
            badgeColor: Colors.grey,
            isSelected: _deliveryType == DeliveryType.kurye,
            isDisabled: !widget.event.hasDelivery,
            onTap: widget.event.hasDelivery 
                ? () => setState(() => _deliveryType = DeliveryType.kurye)
                : null,
          ),
        ],
      ),
    );
  }
  
  /// QR Okutma
  Future<void> _scanTableQR() async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (context) => const QRScannerScreen(
          prompt: 'Masadaki QR Kodu Okutun',
        ),
      ),
    );
    
    if (result != null && result.isNotEmpty) {
      try {
        final uri = Uri.parse(result);
        if (uri.pathSegments.contains('table')) {
          final tableIndex = uri.pathSegments.indexOf('table');
          if (tableIndex + 1 < uri.pathSegments.length) {
            final tableLabel = uri.pathSegments[tableIndex + 1];
            final section = uri.queryParameters['section'];
            setState(() {
              _tableController.text = tableLabel;
              if (section != null && section.isNotEmpty) {
                 final matchingSection = widget.event.sectionDefs.where(
                    (s) => s.name == section || s.id == section
                 ).firstOrNull;
                 if (matchingSection != null) {
                   _selectedSectionId = matchingSection.id;
                 }
              }
            });
          }
        }
      } catch (e) {
        debugPrint('QR Parse error: $e');
      }
    }
  }

  /// Step 3: Kişisel Bilgiler
  Widget _buildInfoStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Kermes aktif değilse uyarı göster
    if (!_isKermesActive) {
      return _buildKermesNotActiveMessage();
    }
    
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Siparissiniz icin bilgilerinizi girin',
            style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 20),
          
          // Ad
          _buildTextField(
            controller: _nameController,
            label: 'Adınız',
            icon: Icons.person_outline,
            hint: 'Siparişte görünecek isim',
          ),
          const SizedBox(height: 14),
          
          // Telefon
          IntlPhoneField(
            controller: _phoneController,
            decoration: InputDecoration(
              labelText: 'Telefon',
              labelStyle: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 15, fontWeight: FontWeight.w600),
              filled: true,
              fillColor: _cardBg(isDark),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: lokmaPink, width: 2),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
            initialCountryCode: 'DE',
            style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 16),
            dropdownTextStyle: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 16),
            onChanged: (phone) {
              _completePhoneNumber = phone.completeNumber;
              setState(() {});
            },
            onCountryChanged: (country) {
              setState(() {});
            },
          ),
          
          // Masa numarası (masada için)
          if (_deliveryType == DeliveryType.masada) ...[
            const SizedBox(height: 14),
            _buildTextField(
              controller: _tableController,
              label: 'Bolum / Masa No',
              icon: Icons.table_restaurant_outlined,
              hint: 'Orn: M9',
              keyboardType: TextInputType.text,
            ),
          ],
          
          const SizedBox(height: 16),
        ],
      ),
    );
  }
  
  /// Kermes aktif değilse gösterilecek mesaj
  Widget _buildKermesNotActiveMessage() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final event = widget.event;
    final isFuture = _isKermesFuture;
    
    // Tarih formatlama
    String formatDate(DateTime date) {
      final months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return '${date.day} ${months[date.month - 1]} ${date.year}';
    }
    
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        children: [
          // Ana ikon
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isFuture 
                    ? [Colors.amber.withOpacity(0.2), Colors.amber.withOpacity(0.1)]
                    : [Colors.grey.withOpacity(0.2), Colors.grey.withOpacity(0.1)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isFuture ? Icons.schedule : Icons.event_busy,
              size: 48,
              color: isFuture ? Colors.amber : Colors.grey[500],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Başlık
          Text(
            isFuture 
                ? 'Kermes Henüz Başlamadı'
                : 'Kermes Sona Erdi',
            style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
              fontSize: 22,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
          
          const SizedBox(height: 16),
          
          // Kermes tarihleri kartı
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _cardBg(isDark),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isFuture ? Colors.amber.withOpacity(0.3) : Colors.grey.withOpacity(0.3),
              ),
            ),
            child: Column(
              children: [
                // Kermes adı
                Row(
                  children: [
                    Icon(Icons.location_city, color: Colors.grey[500], size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        event.city,
                        style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 12),
                const Divider(color: Colors.white12),
                const SizedBox(height: 12),
                
                // Tarih aralığı
                Row(
                  children: [
                    Icon(Icons.calendar_today, color: isFuture ? Colors.amber : Colors.grey[500], size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${formatDate(event.startDate)} - ${formatDate(event.endDate)}',
                        style: TextStyle(
                          color: isFuture ? Colors.amber[300] : Colors.grey[400],
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 8),
                
                // Saat aralığı
                Row(
                  children: [
                    Icon(Icons.access_time, color: Colors.grey[500], size: 18),
                    const SizedBox(width: 8),
                    Text(
                      '${event.openingTime} - ${event.closingTime}',
                      style: TextStyle(
                        color: Colors.grey[400],
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 20),
          
          // Açıklama mesajı
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isFuture 
                    ? [Colors.amber.withOpacity(0.1), Colors.transparent]
                    : [Colors.grey.withOpacity(0.1), Colors.transparent],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  isFuture 
                      ? '⏰ Sipariş verme tarihi henüz gelmedi.\nKermes günü tekrar deneyin!'
                      : '🏁 Bu kermes sona erdi.\nBir sonraki kermeste görüşmek üzere!',
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 15,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                
                // Geçmiş kermes için "Diğer Kermeslere Git" butonu
                if (!isFuture) ...[
                  const SizedBox(height: 20),
                  GestureDetector(
                    onTap: () {
                      Navigator.pop(context); // Checkout sheet'i kapat
                      Navigator.pop(context); // Kermes detay sayfasını kapat (listeye dön)
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                      decoration: BoxDecoration(
                        color: lokmaPink.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: lokmaPink.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.explore, color: lokmaPink, size: 20),
                          const SizedBox(width: 8),
                          const Text(
                            'Diğer Kermesleri Keşfet',
                            style: TextStyle(
                              color: lokmaPink,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// Step 4: Ödeme Yöntemi
  Widget _buildPaymentStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cartState = ref.watch(kermesCartProvider);
    
    // Pfand hesaplama
    final bool hasPfandSystem = widget.event.hasPfandSystem;
    final double pfandAmount = widget.event.pfandAmount;
    int pfandCount = 0;
    if (hasPfandSystem) {
      for (final item in cartState.items) {
        if (item.menuItem.hasPfand) {
          pfandCount += item.quantity;
        }
      }
    }
    final double pfandTotal = pfandCount * pfandAmount;
    final double grandTotal = cartState.totalAmount + pfandTotal;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Özet kartı
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Urunler detayli
                ...cartState.items.map((cartItem) {
                  final itemTotal = cartItem.menuItem.price * cartItem.quantity;
                  final optionText = cartItem.selectedOptions.isNotEmpty
                      ? ' (${cartItem.selectedOptions.map((o) => o.optionName).join(', ')})'
                      : '';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            '${cartItem.quantity}x ${cartItem.menuItem.name}$optionText',
                            style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[700], fontSize: 14, fontWeight: FontWeight.w500),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${itemTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  );
                }).toList(),
                
                // Pfand satırı
                if (pfandCount > 0) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.recycling, color: Colors.green, size: 14),
                          const SizedBox(width: 4),
                          Text('${tr('Depozito')} ($pfandCount)', style: TextStyle(color: Colors.green[400], fontSize: 13)),
                        ],
                      ),
                      Text(
                        '+${pfandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                        style: TextStyle(color: Colors.green[400], fontSize: 14),
                      ),
                    ],
                  ),
                ],
                
                const Divider(color: Colors.white24, height: 20),
                
                // Toplam
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(tr('Toplam'), style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.w600, fontSize: 16)),
                    Text(
                      '${grandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                
                const Divider(color: Colors.white24, height: 20),
                
                // Teslimat
                Row(
                  children: [
                    Icon(_getDeliveryIcon(), color: isDark ? Colors.white70 : Colors.grey[600], size: 18),
                    const SizedBox(width: 8),
                    Text(
                      _getDeliveryLabel(),
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Yuvarlama ile Destek - ayri kart
          if (widget.event.acceptsDonations) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.green.withOpacity(0.3), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: _buildRoundUpWidget(isDark, grandTotal),
            ),
          ],
          
          const SizedBox(height: 24),
          Text(
            'Ödeme Yöntemi',
            style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          
          // Nakit - her zaman gosterilir
          _buildOptionCard(
            icon: Icons.payments_outlined,
            iconColor: Colors.green,
            title: 'Nakit',
            subtitle: 'Teslimatta nakit odeme yapin',
            isSelected: _paymentMethod == PaymentMethodType.cash,
            onTap: () => setState(() => _paymentMethod = PaymentMethodType.cash),
          ),
          const SizedBox(height: 12),
          
          // Kapida Kart (Tap to Pay) - Sadece Kurye modunda gosterilir
          if (_deliveryType == DeliveryType.kurye) ...[
            _buildOptionCard(
              icon: Icons.contactless,
              iconColor: Colors.orange,
              title: 'Kapıda Kart',
              subtitle: 'Tap to Pay ile teslimatta ödeyin',
              isSelected: _paymentMethod == PaymentMethodType.tapToPay,
              onTap: () => setState(() => _paymentMethod = PaymentMethodType.tapToPay),
            ),
            const SizedBox(height: 12),
          ],
          
          // Kart (Online) - Her durumda gosterilir
          _buildOptionCard(
            icon: Icons.credit_card,
            iconColor: Colors.blue,
            title: 'Kart ile Ödeme',
            subtitle: 'Şimdi ödeyin',
            badge: 'YAKIN',
            badgeColor: Colors.amber,
            isSelected: _paymentMethod == PaymentMethodType.card,
            isDisabled: false, // Explicitly enabling it because user expects it available based on prompt.
            onTap: () => setState(() => _paymentMethod = PaymentMethodType.card),
          ),
        ],
      ),
    );
  }
  
  /// Hesabi yuvarlama helper
  double _roundUpTo(double value, double multiple) {
    return (value / multiple).ceil() * multiple;
  }
  
  /// Dr. Hep Sahin bagis/yuvarlama UI
  Widget _buildDonationSection(double baseTotal) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currency = CurrencyUtils.getCurrencySymbol();
    
    final roundHalf = _roundUpTo(baseTotal, 0.50);
    final round1 = _roundUpTo(baseTotal, 1.00);
    final round5 = _roundUpTo(baseTotal, 5.00);
    final round10 = _roundUpTo(baseTotal, 10.00);
    
    final rawOptions = <Map<String, dynamic>>[
      {'label': '+${(roundHalf - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((roundHalf - baseTotal).toStringAsFixed(2))},
      {'label': '+${(round1 - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((round1 - baseTotal).toStringAsFixed(2))},
      {'label': '+${(round5 - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((round5 - baseTotal).toStringAsFixed(2))},
      {'label': '+${(round10 - baseTotal).toStringAsFixed(2)} $currency', 'donation': double.parse((round10 - baseTotal).toStringAsFixed(2))},
    ];
    
    // Sifir ve tekrar eden degerleri kaldir
    final seen = <double>{};
    final options = <Map<String, dynamic>>[];
    for (final o in rawOptions) {
      final d = o['donation'] as double;
      if (d > 0 && seen.add(d)) options.add(o);
    }
    
    if (options.isEmpty) return const SizedBox.shrink();
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg(isDark),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.green.withOpacity(0.3) : Colors.green.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.volunteer_activism, color: Colors.green[600], size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hayir icin Yuvarlama',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    backgroundColor: Colors.transparent,
                    builder: (ctx) => Container(
                      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 36, height: 4, decoration: BoxDecoration(color: isDark ? Colors.white24 : Colors.black12, borderRadius: BorderRadius.circular(2))),
                          const SizedBox(height: 20),
                          Icon(Icons.volunteer_activism, size: 40, color: Colors.green[600]),
                          const SizedBox(height: 12),
                          Text(
                            'Dr. Hep Sahin Vakfi',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: isDark ? Colors.white : Colors.black87),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Hesabinizi yuvarlayarak Dr. Hep Sahin Vakfi\'na bagista bulunabilirsiniz. Tum bagislar ihtiyac sahiplerine ulastirilmaktadir.',
                            style: TextStyle(fontSize: 14, color: isDark ? Colors.grey[400] : Colors.grey[600], height: 1.5),
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () => Navigator.pop(ctx),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                              child: const Text('Anladim', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
                child: Icon(Icons.info_outline, size: 20, color: Colors.grey[400]),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Bagis yapmak isterseniz bir tutar secin',
            style: TextStyle(color: Colors.grey[500], fontSize: 13),
          ),
          const SizedBox(height: 14),
          // Bagis chipleri
          Row(
            children: [
              for (int i = 0; i < options.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        final newDonation = options[i]['donation'] as double;
                        _donationAmount = _donationAmount == newDonation ? 0.0 : newDonation;
                      });
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: _donationAmount == (options[i]['donation'] as double)
                            ? Colors.green
                            : (isDark ? Colors.grey[800] : Colors.grey[200]),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: _donationAmount == (options[i]['donation'] as double)
                              ? Colors.green
                              : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          options[i]['label'] as String,
                          style: TextStyle(
                            color: _donationAmount == (options[i]['donation'] as double) ? Colors.white : (isDark ? Colors.white70 : Colors.black54),
                            fontWeight: FontWeight.w500,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          // Bagis secildiginde onay mesaji
          if (_donationAmount > 0) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.7, end: 1.0),
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.elasticOut,
                  builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
                  child: const Icon(Icons.favorite, size: 16, color: Color(0xFFF41C54)),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${baseTotal.toStringAsFixed(2)} $currency -> ${(baseTotal + _donationAmount).toStringAsFixed(2)} $currency  (+${_donationAmount.toStringAsFixed(2)} $currency bagis)',
                    style: TextStyle(
                      color: isDark ? Colors.grey[300] : const Color(0xFF3E3E3E),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
  
  Widget _buildOptionCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    String? badge,
    Color? badgeColor,
    required bool isSelected,
    bool isDisabled = false,
    VoidCallback? onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: isDisabled ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? lokmaPink.withOpacity(0.05) : _cardBg(isDark),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? lokmaPink : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
            width: isSelected ? 2 : 1.5,
          ),
        ),
        child: Opacity(
          opacity: isDisabled ? 0.5 : 1.0,
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: TextStyle(
                              color: isSelected ? (isDark ? Colors.white : Colors.black87) : (isDark ? Colors.white : Colors.black87),
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: badgeColor ?? Colors.green,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge,
                              style: TextStyle(
                                color: isDark ? Colors.white : Colors.black87,
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: lokmaPink,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.check, color: Theme.of(context).colorScheme.surface, size: 16),
                )
              else
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[400]!, width: 2),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hint,
    TextInputType? keyboardType,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 16),
      onChanged: (_) => setState(() {}), // Rebuild for validation
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 15, fontWeight: FontWeight.w600),
        hintStyle: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400], fontSize: 15),
        prefixIcon: Icon(icon, color: isDark ? Colors.grey[500] : Colors.grey[600]),
        filled: true,
        fillColor: _cardBg(isDark),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: lokmaPink, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }
  
  Widget _buildFooter() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cartState = ref.watch(kermesCartProvider);
    final isLastStep = _currentStep == 4;
    
    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 10,
        bottom: MediaQuery.of(context).padding.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: _cardBg(isDark),
        border: Border(top: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[300]!)),
      ),
      child: Row(
        children: [
          // Total (only on non-cart steps)
          if (_currentStep > 0) ...[
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${cartState.totalItems} ürün',
                  style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[600], fontSize: 11),
                ),
                Text(
                  '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            Spacer(),
          ],
          
          // Next/Submit button
          Expanded(
            flex: _currentStep == 0 ? 1 : 0,
            child: SizedBox(
              width: _currentStep > 0 ? 160 : null,
              child: ElevatedButton(
                onPressed: _canProceed && !_isSubmitting ? _nextStep : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: lokmaPink,
                  disabledBackgroundColor: isDark ? Colors.grey[700] : Colors.grey[400],
                  padding: EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
                child: _isSubmitting
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Theme.of(context).colorScheme.surface,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            isLastStep ? 'Siparişi Onayla' : 'Devam Et',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.surface,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (!isLastStep) ...[
                            SizedBox(width: 6),
                            Icon(Icons.arrow_forward, color: Theme.of(context).colorScheme.surface, size: 18),
                          ],
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  IconData _getDeliveryIcon() {
    switch (_deliveryType) {
      case DeliveryType.gelAl:
        return Icons.shopping_bag_outlined;
      case DeliveryType.masada:
        return Icons.table_restaurant;
      case DeliveryType.kurye:
        return Icons.delivery_dining;
      default:
        return Icons.delivery_dining;
    }
  }
  
  String _getDeliveryLabel() {
    switch (_deliveryType) {
      case DeliveryType.gelAl:
        return 'Gel Al - Tezgahtan alacaksınız';
      case DeliveryType.masada:
        return 'Masaya Servis';
      case DeliveryType.kurye:
        return 'Kurye ile Teslimat';
      default:
        return '';
    }
  }

  /// Yuvarlama ile Destek widget'i
  Widget _buildRoundUpWidget(bool isDark, double subtotal) {
    final double roundedUp = subtotal == subtotal.ceilToDouble() ? subtotal + 1 : subtotal.ceilToDouble();
    final double roundUpAmount = double.parse((roundedUp - subtotal).toStringAsFixed(2));
    final String kermesOrgName = widget.event.title;
    final String? fundName = widget.event.selectedDonationFundName;
    final bool hasFund = fundName != null && fundName.isNotEmpty;

    void selectTarget(String target) {
      HapticFeedback.selectionClick();
      setState(() {
        if (_donationTarget == target) {
          _donationTarget = 'none';
          _donationAmount = 0;
        } else {
          _donationTarget = target;
          _donationAmount = roundUpAmount;
        }
      });
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E2A2E) : const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _donationTarget != 'none'
              ? Colors.green.withOpacity(0.5)
              : isDark ? Colors.white12 : Colors.grey.shade300,
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.volunteer_activism, color: Colors.green, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Yuvarlama ile Destek',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
              if (roundUpAmount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '+${roundUpAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                    style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${subtotal.toStringAsFixed(2)} € → ${roundedUp.toStringAsFixed(2)} €',
            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 11),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildDonationPill(
                isDark: isDark,
                label: kermesOrgName,
                isSelected: _donationTarget == 'kermesOrg',
                icon: Icons.mosque,
                onTap: () => selectTarget('kermesOrg'),
              ),
              if (hasFund)
                _buildDonationPill(
                  isDark: isDark,
                  label: fundName,
                  isSelected: _donationTarget == 'fund',
                  icon: Icons.favorite,
                  onTap: () => selectTarget('fund'),
                ),
              _buildDonationPill(
                isDark: isDark,
                label: 'Hayir, tesekkurler',
                isSelected: _donationTarget == 'none',
                icon: Icons.close,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() {
                    _donationTarget = 'none';
                    _donationAmount = 0;
                  });
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDonationPill({
    required bool isDark,
    required String label,
    required bool isSelected,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? Colors.green.withOpacity(0.2)
              : isDark ? const Color(0xFF2A2A2A) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? Colors.green : (isDark ? Colors.white24 : Colors.grey.shade300),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isSelected ? Colors.green : (isDark ? Colors.white54 : Colors.grey)),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected ? Colors.green : (isDark ? Colors.white70 : Colors.black54),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// Helper function to show the checkout sheet
void showKermesCheckoutSheet(
  BuildContext context, 
  KermesEvent event, {
  String? initialTableNumber,
  int? initialDeliveryMode,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (context) => KermesCheckoutSheet(
      event: event,
      initialTableNumber: initialTableNumber,
      initialDeliveryMode: initialDeliveryMode,
    ),
  );
}
