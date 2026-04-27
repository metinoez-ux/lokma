import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
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
import 'kermes_customization_sheet.dart';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl_phone_field/intl_phone_field.dart';

/// Unified Checkout Sheet - Tüm sipariş akışı tek bir tam ekran bottom sheet'te
class KermesCheckoutSheet extends ConsumerStatefulWidget {
  final KermesEvent event;
  final String? initialTableNumber;
  final String? initialSectionId;
  final int? initialDeliveryMode;
  final bool isPosMode;
  
  const KermesCheckoutSheet({
    super.key, 
    required this.event,
    this.initialTableNumber,
    this.initialSectionId,
    this.initialDeliveryMode,
    this.isPosMode = false,
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
      if (widget.initialSectionId != null) {
        _selectedSectionId = widget.initialSectionId;
      } else {
        // QR masadan gelen siparis: masanin bolumunu otomatik ata
        final section = widget.event.findSectionForTable(widget.initialTableNumber!);
        if (section != null) {
          _selectedSectionId = section.id;
        }
      }
    }
    
    // Eger section secilmediyse ve kermes'in bolumleri varsa, ilk bolumu varsayilan yap
    if (_selectedSectionId == null && widget.event.sectionDefs.isNotEmpty) {
      _selectedSectionId = widget.event.sectionDefs.first.id;
    }

    // Siparis baglami popup'tan gelen degerleri oku
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final cartState = ref.read(kermesCartProvider);
      
      bool needsUpdate = false;
      
      if (cartState.deliveryType != null && _deliveryType == null) {
        switch (cartState.deliveryType) {
          case 'gelAl':
            _deliveryType = DeliveryType.gelAl;
            break;
          case 'masada':
            _deliveryType = DeliveryType.masada;
            break;
          case 'kurye':
            _deliveryType = DeliveryType.kurye;
            break;
        }
        _isGroupOrder = cartState.isGroupOrder;
        needsUpdate = true;
      }
      
      // Masa bilgisi eger daha once secildiyse ve controller bossa doldur
      if (cartState.tableNo != null && _tableController.text.isEmpty) {
        _tableController.text = cartState.tableNo!;
        
        if (cartState.sectionId != null) {
          _selectedSectionId = cartState.sectionId;
        } else {
          final section = widget.event.findSectionForTable(cartState.tableNo!);
          if (section != null) {
            _selectedSectionId = section.id;
          }
        }
        needsUpdate = true;
      }
      
      if (needsUpdate) setState(() {});
    });

    // Eger hic secilmediyse Ilk bolumu otomatik sec ki TV ekranlarina mutlaka dussun
    // Cunku tableSection null olursa Mutfak TV ekranlarinda siparis gorunmez!
    if (_selectedSectionId == null && widget.event.sectionDefs.isNotEmpty) {
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
  
  // Auth state tracking - login sonrasi prefill icin
  String? _lastAuthUid;
  
  // Bagis/yuvarlama
  double _donationAmount = 0.0;
  String _donationTarget = 'none'; // 'kermesOrg' | 'fund' | 'none'

  // POS modu - opsiyonel musteri ismi (Datenschutz: sadece kisaltma gosterilir)
  final _posNameController = TextEditingController();
  
  // Renkler
  static const Color lokmaPink = Color(0xFFEA184A);
  Color _darkBg(bool isDark) => isDark ? const Color(0xFF121212) : const Color(0xFFE8E8EC);
  Color _cardBg(bool isDark) => isDark ? const Color(0xFF1E1E1E) : Colors.white;
  
  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _tableController.dispose();
    _posNameController.dispose();
    super.dispose();
  }

  /// GDPR uyumlu isim kisaltmasi: "Metin Oz" -> "M. O."
  /// Eger tek kelime verildiyse aynen gosterilir: "Metin" -> "Metin"
  String _abbreviateName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return fullName;
    if (parts.length == 1) return parts.first; // Tek isim: olduğu gibi göster
    return parts.map((p) => p.isNotEmpty ? '${p[0].toUpperCase()}.' : '').join(' ');
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
    // Bitiş tarihi aslında seçilen son günün gece yarısıdır. 
    // Yani 15 Nisan seçildiyse 15 Nisan 23:59:59'dur.
    // Gece geç saate sarkan siparişler için +4 saat esneme payı veriyoruz (Ertesi gün 04:00'e kadar).
    final endOfEventDay = DateTime(
      widget.event.endDate.year,
      widget.event.endDate.month,
      widget.event.endDate.day,
      23, 59, 59,
    ).add(const Duration(hours: 4));
    
    return now.isAfter(widget.event.startDate.subtract(const Duration(hours: 1))) && 
           now.isBefore(endOfEventDay);
  }
  
  bool get _isKermesFuture => DateTime.now().isBefore(widget.event.startDate);
  /// Toplam adim sayisi
  int get _totalSteps => widget.isPosMode ? 3 : 4;

  /// Adim baslik listesi
  List<String> get _stepTitles {
    if (widget.isPosMode) {
      return ['Sepetim', 'Teslimat', 'Odeme'];
    }
    return [
      'Sepetim',
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
        final user = FirebaseAuth.instance.currentUser;
        final isGuest = user == null || user.isAnonymous;
        
        if (isGuest && _deliveryType == DeliveryType.kurye) {
          return false;
        }
        
        if (isGuest && (_deliveryType == DeliveryType.gelAl || _deliveryType == DeliveryType.masada)) {
          bool isInfoOk = _nameController.text.trim().isNotEmpty;
          if (_deliveryType == DeliveryType.masada) {
            isInfoOk = isInfoOk && _tableController.text.trim().isNotEmpty;
          }
          return isInfoOk;
        }
        
        bool isInfoOk = _nameController.text.trim().isNotEmpty;
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
    if (widget.isPosMode) {
      switch (step) {
        case 0: return 'cart';
        case 1: return 'delivery';
        case 2: return 'payment';
        default: return 'cart';
      }
    }
    switch (step) {
      case 0: return 'cart';
      case 1: return 'delivery';
      case 2: return 'info';
      case 3: return 'payment';
      default: return 'cart';
    }
  }
  
  void _nextStep() {
    if (_currentStep < _totalSteps - 1) {
      HapticFeedback.selectionClick();
      setState(() => _currentStep++);
    } else {
      // Son adim - siparisi tamamla (tarih kontrolu burada yapilir)
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
    // Tarih kontrolu: siparis verilmeden once kermes aktif mi?
    if (!_isKermesActive) {
      HapticFeedback.heavyImpact();
      _showKermesDateBlockDialog();
      return;
    }

    // Nakit odeme: alinan tutari sor (sadece POS modunda)
    double? cashReceived;
    double? changeGiven;
    if (_paymentMethod == PaymentMethodType.cash && widget.isPosMode) {
      final cartState = ref.read(kermesCartProvider);
      // Pfand dahil toplam hesapla
      final bool hasPfandSystem = widget.event.hasPfandSystem;
      final double pfandAmount = widget.event.pfandAmount;
      int pfandCount = 0;
      if (hasPfandSystem) {
        for (final item in cartState.items) {
          if (item.menuItem.hasPfand) pfandCount += item.quantity;
        }
      }
      final double preTotal = cartState.totalAmount + (pfandCount * pfandAmount) + _donationAmount;
      final result = await _showCashReceivedDialog(preTotal);
      if (result == null) return; // iptal edildi
      cashReceived = result;
      changeGiven = (cashReceived - preTotal).clamp(0.0, double.infinity);
    }

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
      final orderItems = cartState.items.map((item) {
        String itemName = item.menuItem.name;
        if (item.selectedOptions.isNotEmpty) {
          final optionsStr = item.selectedOptions.map((o) => o.optionName).join(', ');
          itemName = '$itemName ($optionsStr)';
        }
        return KermesOrderItem(
          name: itemName,
          quantity: item.quantity,
          price: item.totalPrice, // Use totalPrice inside order to preserve addon prices
          productId: item.menuItem.name,
          prepZones: item.menuItem.prepZones,
          category: item.menuItem.category,
          imageUrl: item.menuItem.imageUrl,
        );
      }).toList();
      
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
        userId: (!isStaff && FirebaseAuth.instance.currentUser != null) 
            ? FirebaseAuth.instance.currentUser!.uid 
            : guestProfile?.id,
        customerName: widget.isPosMode
            ? (_posNameController.text.trim().isNotEmpty
                ? _posNameController.text.trim()
                : 'POS Siparis')
            : _nameController.text.trim(),
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
        cashReceived: cashReceived,
        changeGiven: changeGiven,
      );
      
      // Siparişi kaydet
      await orderService.createOrder(order);
      
      // Sepeti temizle
      ref.read(kermesCartProvider.notifier).clearCart();
      
      // Başarı - QR göster (kullanıcıya orderNumber göster)
      if (mounted) {
        final rootNavContext = Navigator.of(context, rootNavigator: true).context;
        Navigator.pop(context);

        if (widget.isPosMode) {
          // POS modu: her zaman POS dialog goster (tezgah veya masa)
          final posName = _posNameController.text.trim();
          String? subtitle;
          if (_deliveryType == DeliveryType.masada && _tableController.text.isNotEmpty) {
            // Masa bilgisi
            String sectionName = '';
            if (_selectedSectionId != null) {
              final sec = widget.event.sectionDefs.where((s) => s.id == _selectedSectionId).firstOrNull;
              if (sec != null) sectionName = '${sec.name} - ';
            }
            subtitle = '${sectionName}Masa ${_tableController.text}';
          }
          _showPOSOrderNumberDialog(rootNavContext, orderNumber,
              abbreviatedName: posName.isNotEmpty ? _abbreviateName(posName) : null,
              tableInfo: subtitle);
        } else {
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

  /// POS tezgahtan teslim: McDonald's siparis numarasi dialog
  void _showPOSOrderNumberDialog(BuildContext ctx, String orderNumber, {String? abbreviatedName, String? tableInfo}) {
    final isDark = Theme.of(ctx).brightness == Brightness.dark;
    showDialog(
      context: ctx,
      barrierDismissible: false,
      builder: (dctx) => Dialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  color: const Color(0xFF2E7D32).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 44),
              ),
              const SizedBox(height: 20),
              Text('Siparis Alindi!',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87)),
              const SizedBox(height: 8),
              // Masa bilgisi varsa goster
              if (tableInfo != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.purple.withOpacity(0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.table_restaurant, size: 16, color: Colors.purple[300]),
                      const SizedBox(width: 6),
                      Text(tableInfo, style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600,
                        color: Colors.purple[300],
                      )),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
              Text(tableInfo != null ? 'Garson masaya goturecek:' : 'Musteriye verilecek numara:',
                style: TextStyle(fontSize: 14, color: isDark ? Colors.grey[400] : Colors.grey[600])),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  color: lokmaPink.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: lokmaPink.withOpacity(0.3), width: 1.5),
                ),
                child: Column(
                  children: [
                    Text('#', style: TextStyle(fontSize: 24, color: lokmaPink.withOpacity(0.7))),
                    Text(orderNumber, style: const TextStyle(
                      fontSize: 64, fontWeight: FontWeight.w900, color: lokmaPink, letterSpacing: -2)),
                    // Isim varsa kısaltılmış göster (GDPR uyumlu)
                    if (abbreviatedName != null && abbreviatedName.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        decoration: BoxDecoration(
                          color: lokmaPink.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          abbreviatedName,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white70 : Colors.black54,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ] else ...[
                      Text(tableInfo != null ? 'Masaya Servis' : 'Tezgahtan Teslim',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500,
                          color: isDark ? Colors.grey[400] : Colors.grey[600])),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(dctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: lokmaPink, foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: const Text('Yeni Siparis Al',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = _darkBg(isDark);
    
    // Auth state degisikligi algila (login sonrasi prefill icin)
    final currentUser = FirebaseAuth.instance.currentUser;
    final currentUid = currentUser?.uid;
    if (currentUid != _lastAuthUid) {
      _lastAuthUid = currentUid;
      if (currentUser != null && !currentUser.isAnonymous) {
        // Kayitli kullanici olarak dondu - bilgileri doldur
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _prefillUserInfo().then((_) {
            if (mounted) setState(() {});
          });
        });
      }
    }
    
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      margin: EdgeInsets.only(bottom: bottomInset),
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
              // Back button (only on step > 0)
              if (_currentStep > 0)
                GestureDetector(
                  onTap: _previousStep,
                  child: Container(
                    padding: EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _cardBg(isDark),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.arrow_back_ios_new,
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
                      'Adim ${_currentStep + 1} / $_totalSteps',
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
          
          // Kermes bilgileri (isim, adres, tarih)
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: _cardBg(isDark).withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Kermes Adi
                Row(
                  children: [
                    Icon(Icons.storefront, color: lokmaPink, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        widget.event.title,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                
                // Adres
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.location_on, color: isDark ? Colors.grey[500] : Colors.grey[600], size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        widget.event.address,
                        style: TextStyle(
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                
                // Tarih / Gun Bilgisi
                Builder(
                  builder: (context) {
                    final now = DateTime.now();
                    final start = widget.event.startDate;
                    final end = widget.event.endDate;
                    
                    // Sadece tarih kısımlarını karşılaştır
                    final today = DateTime(now.year, now.month, now.day);
                    final startDate = DateTime(start.year, start.month, start.day);
                    final endDate = DateTime(end.year, end.month, end.day);
                    
                    final totalDays = endDate.difference(startDate).inDays + 1;
                    final currentDay = today.difference(startDate).inDays + 1;
                    
                    final locale = Localizations.localeOf(context).languageCode;
                    String dayText = '';
                    if (currentDay < 1) {
                      dayText = locale == 'de' ? 'Noch nicht begonnen' : 'Baslamadi';
                    } else if (currentDay > totalDays) {
                      dayText = locale == 'de' ? 'Beendet' : 'Sona Erdi';
                    } else {
                      dayText = locale == 'de' ? 'Tag $currentDay / $totalDays' : '$currentDay. Gun / $totalDays';
                    }
                    
                    final dateStr = '${start.day.toString().padLeft(2, '0')}.${start.month.toString().padLeft(2, '0')} - ${end.day.toString().padLeft(2, '0')}.${end.month.toString().padLeft(2, '0')}.${end.year}';
                    
                    return Row(
                      children: [
                        Icon(Icons.calendar_today, color: isDark ? Colors.grey[500] : Colors.grey[600], size: 16),
                        const SizedBox(width: 8),
                        Text(
                          '$dateStr  •  $dayText',
                          style: TextStyle(
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    );
                  }
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
                  'Sepetiniz bos',
                  style: TextStyle(color: subtleTextColor, fontSize: 16),
                ),
              ],
            ),
          );
        }
        
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
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cart items
              ...cartState.items.map((cartItem) {
                final item = cartItem.menuItem;
                final quantity = cartItem.quantity;
                final subtotal = item.price * quantity;
                
                final fullMenuItem = widget.event.menu.where((m) => m.name == item.name).firstOrNull;
                final isMultiStep = fullMenuItem != null && fullMenuItem.isComboMenu;
                return GestureDetector(
                  onTap: isMultiStep ? () {
                    _openCustomizationForCartEdit(fullMenuItem, cartItem);
                  } : null,
                  child: Container(
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
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.name,
                                      style: TextStyle(
                                        color: textColor,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ),
                                  if (isMultiStep)
                                    Icon(Icons.edit_outlined, size: 18, color: isDark ? Colors.grey[400] : Colors.grey[600]), // Increased size
                                ],
                              ),
                              if (cartItem.selectedOptions.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Padding(
                                  padding: const EdgeInsets.only(left: 4), // Reduced left padding
                                  child: Text(
                                    cartItem.selectedOptions.map((o) => o.optionName).join(', '),
                                    style: TextStyle(
                                      color: isDark ? Colors.grey[300] : Colors.grey[700], // Darker/more visible
                                      fontSize: 14.5, // Increased size
                                      fontWeight: FontWeight.w600, // Increased weight
                                      fontStyle: FontStyle.italic,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
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
                                onTap: () {
                                  if (isMultiStep) {
                                    _openCustomizationForCartAdd(fullMenuItem);
                                  } else {
                                    ref.read(kermesCartProvider.notifier).addToCart(item, widget.event.id, widget.event.city);
                                  }
                                },
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
                  ),
                );
              }),
              
              // Summary card
              Container(
                margin: const EdgeInsets.only(top: 4),
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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${cartState.totalItems} urun',
                          style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[800], fontSize: 15.5, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
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
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Container(
                        height: 1,
                        color: isDark ? Colors.white.withOpacity(0.2) : Colors.black.withOpacity(0.1),
                      ),
                    ),
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
              ),

              
              const SizedBox(height: 80), // bottom padding for checkout button
            ],
          ),
        );
      },
    );
  }
  
  /// Step 1: Siparis Turu
  void _openCustomizationForCartAdd(KermesMenuItem fullItem) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (ctx) => KermesCustomizationSheet(
        item: fullItem,
        eventId: widget.event.id,
        eventName: widget.event.city,
      ),
    );
  }

  /// Sepetteki multi-step urunu duzenle
  void _openCustomizationForCartEdit(KermesMenuItem fullItem, KermesCartItem cartItem) {
    final oldKey = cartItem.uniqueKey;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (ctx) => KermesCustomizationSheet(
        item: fullItem,
        eventId: widget.event.id,
        eventName: widget.event.city,
        editMode: true,
        initialSelections: cartItem.selectedOptions,
        initialQuantity: cartItem.quantity,
        onEdit: (newOptions) {
          ref.read(kermesCartProvider.notifier).replaceCartItem(oldKey, fullItem, newOptions);
          setState(() {});
        },
      ),
    );
  }

  /// Step 1: Siparis Turu
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
            // Explanatory info box for group orders
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.withOpacity(0.2)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 20, color: Colors.blue.shade700),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Masadaki arkadaşlarınıza QR kodu okutarak hızlıca gruba katılmalarını sağlayın. Uzaktakilere ise link göndererek aynı siparişe dahil edebilirsiniz.',
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.blue.shade200 : Colors.blue.shade900,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
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
                  label: Text(_isCreatingGroup ? 'Olusturuluyor...' : 'Grup Oluştur (QR & Link)'),
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

  /// Step 2: Teslimat Turu (normal + POS modu)
  Widget _buildDeliveryStep() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Secilen teslimat turunu ozet olarak goster
          if (_deliveryType != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? lokmaPink.withOpacity(0.12) : lokmaPink.withOpacity(0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: lokmaPink.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Icon(_getDeliveryIcon(), color: lokmaPink, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _deliveryType == DeliveryType.gelAl ? 'Gel Al'
                              : _deliveryType == DeliveryType.masada ? 'Masaya Servis'
                              : 'Kurye ile Teslimat',
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.black87,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_isGroupOrder)
                          Text(
                            'Grup / Aile Siparisi',
                            style: TextStyle(
                              color: lokmaPink,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      // Context'i sifirla ve popup'i tekrar goster
                      ref.read(kermesCartProvider.notifier).clearOrderContext();
                      setState(() {
                        _deliveryType = null;
                        _isGroupOrder = false;
                      });
                    },
                    child: Text('Degistir', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600], fontSize: 13)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          // Teslimat secimi popup'ta yapilamadiysa veya sifirlandiysa kartlari goster (Fallback)
          if (_deliveryType == null) ...[
            // Tezgahtan Teslim (Gel Al)
            _buildOptionCard(
              icon: Icons.storefront_outlined,
              iconColor: Colors.amber,
              title: 'Tezgahtan Teslim',
              subtitle: 'Siparisi stanttan alin',
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
            
            // Masaya Servis
            _buildOptionCard(
              icon: Icons.table_restaurant,
              iconColor: Colors.purple,
              title: 'Masaya Servis',
              subtitle: 'Masaniza getirelim',
              badge: widget.event.hasDineIn ? null : 'KAPALI',
              badgeColor: Colors.grey,
              isSelected: _deliveryType == DeliveryType.masada,
              isDisabled: !widget.event.hasDineIn,
              onTap: widget.event.hasDineIn
                  ? () => setState(() => _deliveryType = DeliveryType.masada)
                  : null,
            ),
            const SizedBox(height: 12),
            
            // Kurye ile Teslimat (Eger aktifse)
            if (widget.event.hasDelivery)
              _buildOptionCard(
                icon: Icons.moped_outlined,
                iconColor: Colors.orange,
                title: 'Kurye ile Teslimat',
                subtitle: 'Adresinize getirelim',
                isSelected: _deliveryType == DeliveryType.kurye,
                onTap: () => setState(() => _deliveryType = DeliveryType.kurye),
              ),
          ], // Delivery cards sonu

          // Masaya Servis secildiginde: bolum/masa secimi (hem POS hem normal mod)
          if (_deliveryType == DeliveryType.masada) ...[
            // Recovery: Eger _tableController bos ama cart provider'da veya widget'ta masa bilgisi varsa doldur
            Builder(builder: (_) {
              if (_tableController.text.isEmpty) {
                // 1. widget.initialTableNumber'dan doldur
                if (widget.initialTableNumber != null) {
                  _tableController.text = widget.initialTableNumber!;
                  if (widget.initialSectionId != null) {
                    _selectedSectionId = widget.initialSectionId;
                  } else {
                    final section = widget.event.findSectionForTable(widget.initialTableNumber!);
                    if (section != null) _selectedSectionId = section.id;
                  }
                } else {
                  // 2. Cart provider'dan doldur
                  final cartState = ref.read(kermesCartProvider);
                  if (cartState.tableNo != null && cartState.tableNo!.isNotEmpty) {
                    _tableController.text = cartState.tableNo!;
                    if (cartState.sectionId != null) {
                      _selectedSectionId = cartState.sectionId;
                    } else {
                      final section = widget.event.findSectionForTable(cartState.tableNo!);
                      if (section != null) _selectedSectionId = section.id;
                    }
                  }
                }
                if (_selectedSectionId == null && widget.event.sectionDefs.isNotEmpty) {
                  _selectedSectionId = widget.event.sectionDefs.first.id;
                }
              }
              return const SizedBox.shrink();
            }),
            if (_tableController.text.isNotEmpty && (_selectedSectionId != null || widget.event.sectionDefs.isEmpty)) ...[
              // Masa bilgisi zaten var - goster
              Container(
                 margin: const EdgeInsets.symmetric(vertical: 8),
                 padding: const EdgeInsets.all(12),
                 decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.green.withOpacity(0.3))),
                 child: Row(children: [
                   const Icon(Icons.check_circle, color: Colors.green), const SizedBox(width: 8),
                   Expanded(child: Text("${_getSectionDisplayName(_selectedSectionId)}${_getSectionDisplayName(_selectedSectionId).isNotEmpty ? ' - ' : ''}Masa ${_tableController.text}", style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold))),
                   TextButton(onPressed: () => setState(() { _tableController.clear(); _selectedSectionId = null; }), child: Text("Degistir", style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Colors.white70 : Colors.black54)))
                 ])
              ),
              // Baska masa QR kodu okut secenegi
              const SizedBox(height: 8),
              Center(
                child: TextButton.icon(
                  onPressed: _scanTableQR,
                  icon: Icon(Icons.qr_code_scanner, size: 16, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  label: Text('Baska bir masa QR kodu okut', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13)),
                ),
              ),
            ] else ...[
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
              if (widget.isPosMode) ...[ 
                _buildSectionSelector(includeFamily: true),
              ] else ...[
                if (!_showManualSectionSelection)
                  Center(
                    child: TextButton(
                      onPressed: () => setState(() => _showManualSectionSelection = true),
                      child: const Text('Masada QR kod yok mu? Bolum secerek devam et', style: TextStyle(color: Colors.grey)),
                    ),
                  ),
                if (_showManualSectionSelection)
                  _buildSectionSelector(includeFamily: true),
              ],
              if (widget.isPosMode) ...[
                const SizedBox(height: 8),
                Builder(builder: (context) {
                  String sectionLabel = '';
                  if (_selectedSectionId != null) {
                    final sec = widget.event.sectionDefs.where((s) => s.id == _selectedSectionId).firstOrNull;
                    if (sec != null) sectionLabel = '${sec.name} - ';
                  }
                  return TextField(
                    controller: _tableController,
                    keyboardType: TextInputType.number,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: '${sectionLabel}Masa No girin',
                      prefixIcon: const Icon(Icons.tag, size: 18, color: lokmaPink),
                      filled: true,
                      fillColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: lokmaPink, width: 1.5)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      prefixText: sectionLabel.isNotEmpty ? sectionLabel : null,
                      prefixStyle: const TextStyle(color: lokmaPink, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                  );
                }),
              ],
            ],
          ],

          // Gel Al secildiginde normal modda bolum secimi
          if (!widget.isPosMode && _deliveryType == DeliveryType.gelAl && widget.event.sectionDefs.length > 1) ...[
            const SizedBox(height: 12),
            _buildSectionSelector(includeFamily: false),
          ],

          // Grup siparisi araclari
          if (_isGroupOrder && _deliveryType != null) ...[
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.withOpacity(0.2)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 20, color: isDark ? Colors.blue.shade300 : Colors.blue.shade700),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _deliveryType == DeliveryType.masada
                          ? 'Masadaki arkadaslariniza QR kodu okutarak hizlica gruba katilmalarini saglayin. Uzaktakilere ise link gondererek ayni siparise dahil edebilirsiniz.'
                          : 'Link paylasarak yakinlarinizi ayni siparise davet edin. Herkes kendi urununu eklesin, tek seferde siparis verin!',
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.blue.shade200 : Colors.blue.shade900,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
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
            const SizedBox(height: 12),
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
                      : const Icon(Icons.qr_code_2, size: 20),
                  label: Text(_isCreatingGroup ? 'Olusturuluyor...' : 'Grup Olustur (QR & Link)'),
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
                        label: const Text('QR / Linki Tekrar Paylas'),
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
  
  /// Bolum ismini kisaltmali goster (kulturel hassasiyet)
  /// Hanimlar -> Bolum H / Bereich H, Erkek -> Bolum E / Bereich E, Aile -> Bolum A / Bereich A
  String _getSectionDisplayName(String? sectionId) {
    if (sectionId == null || widget.event.sectionDefs.isEmpty) return '';
    final section = widget.event.sectionDefs.where((s) => s.id == sectionId).firstOrNull;
    if (section == null) return '';
    final name = section.name;
    
    // Ilk harfi belirle
    String letter;
    if (name.toLowerCase().contains('aile') || name.toLowerCase().contains('famil')) {
      letter = 'A';
    } else if (name.toLowerCase().contains('han') || name.toLowerCase().contains('kad') || name.toLowerCase().contains('damen') || name.toLowerCase().contains('frauen')) {
      letter = 'H';
    } else if (name.toLowerCase().contains('erkek') || name.toLowerCase().contains('herren') || name.toLowerCase().contains('manner')) {
      letter = 'E';
    } else {
      letter = name.isNotEmpty ? name[0].toUpperCase() : '?';
    }
    
    // Locale'e gore Bolum/Bereich
    final locale = Localizations.localeOf(context).languageCode;
    final prefix = (locale == 'de') ? 'Bereich' : 'Bolum';
    return '$prefix $letter';
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
        String? tableLabel;
        String? sectionParam;

        final uri = Uri.tryParse(result);
        
        if (uri != null && uri.pathSegments.contains('table')) {
          final tableIndex = uri.pathSegments.indexOf('table');
          if (tableIndex + 1 < uri.pathSegments.length) {
            tableLabel = uri.pathSegments[tableIndex + 1];
            sectionParam = uri.queryParameters['section'];
          }
        } else if (uri != null && uri.queryParameters.containsKey('table')) {
          // Format: /kermesler/ID?table=M7&section=erkekler_bolumu
          tableLabel = uri.queryParameters['table']!;
          sectionParam = uri.queryParameters['section'];
        } else if (uri != null && uri.pathSegments.contains('kermes-dinein')) {
          // Format: /kermes-dinein/{kermesId}/table/{tableNo}
          final kermesDineinIndex = uri.pathSegments.indexOf('kermes-dinein');
          final tableIndex = uri.pathSegments.indexOf('table');
          if (tableIndex >= 0 && tableIndex + 1 < uri.pathSegments.length) {
            tableLabel = uri.pathSegments[tableIndex + 1];
            sectionParam = uri.queryParameters['section'];
          }
        }
        
        // Fallback: Eger hicbir format eslesmediyse, QR icerigini direkt table no olarak dene
        if (tableLabel == null) {
          // Basit sayi veya kisa string (orn: "7", "M7", "12") -> direkt masa numarasi olarak kabul et
          final cleaned = result.trim();
          if (cleaned.length <= 10 && !cleaned.contains('http') && !cleaned.contains('/')) {
            tableLabel = cleaned;
          }
        }

        if (tableLabel != null && tableLabel.isNotEmpty) {
          setState(() {
            _tableController.text = tableLabel!;
            if (sectionParam != null && sectionParam!.isNotEmpty) {
               final matchingSection = widget.event.sectionDefs.where(
                  (s) => s.name == sectionParam || s.id == sectionParam
               ).firstOrNull;
               if (matchingSection != null) {
                 _selectedSectionId = matchingSection.id;
               } else {
                 _selectedSectionId = sectionParam; // Fallback if admin misconfigured
               }
            } else {
              // Masanin bolumunu otomatik bul
              final section = widget.event.findSectionForTable(tableLabel!);
              if (section != null) {
                _selectedSectionId = section.id;
              } else if (widget.event.sectionDefs.isNotEmpty) {
                _selectedSectionId = widget.event.sectionDefs.first.id;
              }
            }
          });
          
          // Cart provider'a da kaydet
          ref.read(kermesCartProvider.notifier).setOrderContext(
            deliveryType: 'masada',
            isGroupOrder: _isGroupOrder,
            tableNo: tableLabel,
            sectionId: _selectedSectionId,
          );
        } else {
          // Hicbir format eşleşmedi - kullaniciya hata goster
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('QR kodu taninmadi. QR icerigi: "${result.length > 50 ? '${result.substring(0, 50)}...' : result}"'),
                backgroundColor: Colors.orange,
                duration: const Duration(seconds: 5),
              ),
            );
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
    
    // Kermes aktif degilse uyari goster
    if (!_isKermesActive) {
      return _buildKermesNotActiveMessage();
    }
    
    final user = FirebaseAuth.instance.currentUser;
    final isGuest = user == null || user.isAnonymous;
    
    // Misafir + Kurye: kayit zorunlu
    if (isGuest && _deliveryType == DeliveryType.kurye) {
      return _buildGuestKuryeRegistrationRequired(isDark);
    }
    
    // Misafir + Gel-Al/Masa: basit isim formu + LOKMA avantajlari
    if (isGuest) {
      return _buildGuestSimpleInfoStep(isDark);
    }
    
    // Kayitli kullanici: mevcut tam form
    return _buildRegisteredUserInfoStep(isDark);
  }
  
  /// Kayitli kullanici icin mevcut form
  Widget _buildRegisteredUserInfoStep(bool isDark) {
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
          
          _buildTextField(
            controller: _nameController,
            label: 'Adiniz',
            icon: Icons.person_outline,
            hint: 'Sipariste gorunecek isim',
          ),
          const SizedBox(height: 14),
          
          IntlPhoneField(
            controller: _phoneController,
            decoration: InputDecoration(
              labelText: 'Telefon (Tavsiye edilir)',
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
          
           if (_deliveryType == DeliveryType.masada) ...[
            const SizedBox(height: 14),
            _buildTextField(
              controller: _tableController,
              label: '${_getSectionDisplayName(_selectedSectionId)}${_getSectionDisplayName(_selectedSectionId).isNotEmpty ? ' / ' : ''}Masa No',
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
  
  /// Misafir + Gel-Al/Masa: basit isim formu + LOKMA avantajlari
  Widget _buildGuestSimpleInfoStep(bool isDark) {
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Isim alani (zorunlu)
          Text(
            'Siparissiniz icin adinizi girin',
            style: TextStyle(color: subtleColor, fontSize: 15, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 14),
          
          _buildTextField(
            controller: _nameController,
            label: 'Ad Soyad',
            icon: Icons.person_outline,
            hint: 'Sipariste gorunecek isim',
          ),
          
          // Masa numarasi (masada icin)
          if (_deliveryType == DeliveryType.masada) ...[
            const SizedBox(height: 14),
            _buildTextField(
              controller: _tableController,
              label: '${_getSectionDisplayName(_selectedSectionId)}${_getSectionDisplayName(_selectedSectionId).isNotEmpty ? ' / ' : ''}Masa No',
              icon: Icons.table_restaurant_outlined,
              hint: 'Orn: M9',
              keyboardType: TextInputType.text,
            ),
          ],
          
          const SizedBox(height: 24),
          
          // LOKMA Avantajlari + Kayit Ol
          _buildLokmaAdvantagesBanner(isDark, textColor, subtleColor),
        ],
      ),
    );
  }
  
  /// Misafir + Kurye: kayit zorunlu ekrani
  Widget _buildGuestKuryeRegistrationRequired(bool isDark) {
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        children: [
          // Uyari ikonu
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: lokmaPink.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.delivery_dining, size: 36, color: lokmaPink),
          ),
          const SizedBox(height: 16),
          
          Text(
            'Kurye Siparisi icin\nLOKMA Hesabi Gerekli',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: textColor,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Adresinize teslimat yapabilmemiz icin hesap olusturmaniz gerekmektedir.',
            textAlign: TextAlign.center,
            style: TextStyle(color: subtleColor, fontSize: 14, height: 1.4),
          ),
          
          const SizedBox(height: 24),
          
          // LOKMA Avantajlari
          _buildLokmaAdvantagesBanner(isDark, textColor, subtleColor),
          
          const SizedBox(height: 20),
          
          // Giris Yap / Kayit Ol pill toggle
          Container(
            height: 52,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(26),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      context.push('/login');
                    },
                    child: Container(
                      height: double.infinity,
                      decoration: BoxDecoration(
                        color: lokmaPink,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: [
                          BoxShadow(
                            color: lokmaPink.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'Giris Yap',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      context.push('/login?register=true');
                    },
                    child: Container(
                      height: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Center(
                        child: Text(
                          'Kayit Ol',
                          style: TextStyle(
                            color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 10),
          Text(
            'Sepetiniz korunur',
            textAlign: TextAlign.center,
            style: TextStyle(color: subtleColor, fontSize: 12),
          ),
        ],
      ),
    );
  }
  
  /// LOKMA avantajlari banner'i + opsiyonel kayit butonu
  Widget _buildLokmaAdvantagesBanner(bool isDark, Color textColor, Color subtleColor) {
    final advantages = [
      {'icon': Icons.receipt_long_outlined, 'text': 'Siparislerini her zaman takip et'},
      {'icon': Icons.verified_user_outlined, 'text': 'Guvenle siparis ver'},
      {'icon': Icons.store_outlined, 'text': 'TUNA isletmelerini kolayca bul'},
      {'icon': Icons.table_restaurant_outlined, 'text': 'Masa Rezervasyonu yap'},
      {'icon': Icons.delivery_dining_outlined, 'text': 'Kurye siparisi ver'},
    ];
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _cardBg(isDark),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: lokmaPink.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Image.asset(
                isDark
                    ? 'assets/images/lokma_logo_white.png'
                    : 'assets/images/logo_lokma_red.png',
                height: 22,
                errorBuilder: (_, __, ___) => Text(
                  'LOKMA',
                  style: TextStyle(color: lokmaPink, fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Hesap Avantajlari',
                style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          ...advantages.map((a) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Icon(a['icon'] as IconData, size: 18, color: lokmaPink),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    a['text'] as String,
                    style: TextStyle(color: subtleColor, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          )),
          
          const SizedBox(height: 12),
          
          // Giris Yap / Kayit Ol pill buttons
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    context.push('/login');
                  },
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: lokmaPink,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: lokmaPink.withOpacity(0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.login, size: 18, color: Colors.white),
                        SizedBox(width: 6),
                        Text(
                          'Giris Yap',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    context.push('/login?register=true');
                  },
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: lokmaPink,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: lokmaPink.withOpacity(0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_add, size: 18, color: Colors.white),
                        SizedBox(width: 6),
                        Text(
                          'Kayit Ol',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 6),
          Center(
            child: Text(
              'Sepetiniz korunur',
              style: TextStyle(color: subtleColor.withOpacity(0.7), fontSize: 11),
            ),
          ),
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
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
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
                
                // Bagis satiri (anlik yansima)
                if (_donationAmount > 0) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Icon(Icons.volunteer_activism, color: Colors.green[400], size: 14),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                _donationTarget == 'fund' && widget.event.selectedDonationFundName != null
                                    ? widget.event.selectedDonationFundName!
                                    : widget.event.title,
                                style: TextStyle(color: Colors.green[400], fontSize: 13, fontStyle: FontStyle.italic),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '+${_donationAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                        style: TextStyle(color: Colors.green[400], fontSize: 14, fontWeight: FontWeight.w600),
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
                      '${(grandTotal + _donationAmount).toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
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
          
          // Yuvarlama ile Destek
          if (widget.event.acceptsDonations) ...[
            const SizedBox(height: 16),
            _buildRoundUpWidget(isDark, grandTotal),
          ],
          
          const SizedBox(height: 24),
          Text(
            'Ödeme Yöntemi',
            style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          
          // POS modu - opsiyonel musteri ismi (Starbucks stili)
          if (widget.isPosMode && _deliveryType == DeliveryType.gelAl) ...[
            Container(
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? Colors.grey[700]! : Colors.grey[200]!,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.person_outline, size: 18,
                          color: isDark ? Colors.grey[400] : Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text(
                        'Müşteri Adı (opsiyonel)',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white70 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _posNameController,
                    textCapitalization: TextCapitalization.words,
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontSize: 15,
                    ),
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Orn: Metin Oz',
                      hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400]),
                      filled: true,
                      fillColor: isDark ? const Color(0xFF1E1E1E) : Colors.grey.shade100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: lokmaPink, width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      suffixIcon: _posNameController.text.isNotEmpty
                          // Kisaltma on-izlemesi
                          ? Padding(
                              padding: const EdgeInsets.only(right: 12),
                              child: Chip(
                                label: Text(
                                  _abbreviateName(_posNameController.text.trim()),
                                  style: const TextStyle(
                                      fontSize: 12, fontWeight: FontWeight.w700),
                                ),
                                backgroundColor: lokmaPink.withOpacity(0.1),
                                side: BorderSide(color: lokmaPink.withOpacity(0.3)),
                                padding: EdgeInsets.zero,
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                              ),
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Numara board\'unda: ${_posNameController.text.trim().isNotEmpty ? _abbreviateName(_posNameController.text.trim()) : "numara ile cagrilir"}',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.grey[600] : Colors.grey[500],
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ),
          ],
          
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
    final isLastStep = _currentStep == _totalSteps - 1;
    
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Grup/Aile toggle kaldirildi - artik Delivery (Teslimat) adiminda!
          Row(
            children: [
              // Total (only on non-cart steps)
              if (_currentStep > 0) ...[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${cartState.totalItems} urun',
                      style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[700], fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
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
      ),  // Row
        ],
      ),  // Column
    );  // Container
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
        return 'Gel Al - Tezgahtan alacaksiniz';
      case DeliveryType.masada:
        return 'Masaya Servis';
      case DeliveryType.kurye:
        return 'Kurye ile Teslimat';
      default:
        return '';
    }
  }

  /// Yuvarlama ile Destek widget'i - minimal, zarif tasarim
  Widget _buildRoundUpWidget(bool isDark, double baseTotal) {
    final currency = CurrencyUtils.getCurrencySymbol();
    final String kermesOrgName = widget.event.title;
    final String? fundName = widget.event.selectedDonationFundName;
    final String? fundUrl = null; // TODO: widget.event.donationFundUrl
    final bool hasFund = fundName != null && fundName.isNotEmpty;
    
    // Yuvarlama hesaplamalari - bir sonraki euro, 5, ve bir sonraki 5
    final round1 = _roundUpTo(baseTotal, 1.00);
    final round5 = _roundUpTo(baseTotal, 5.00);
    final round5next = round5 + 5.0;
    
    final rawDonations = <double>[
      double.parse((round1 - baseTotal).toStringAsFixed(2)),
      double.parse((round5 - baseTotal).toStringAsFixed(2)),
      double.parse((round5next - baseTotal).toStringAsFixed(2)),
    ];
    // Deduplicate & sifir olanlari filtrele
    final seen = <double>{};
    final options = <double>[];
    for (final d in rawDonations) {
      if (d > 0 && seen.add(d)) options.add(d);
    }
    
    final selectedDonation = _donationAmount;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF8F8F8),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Baslik satiri
          Row(
            children: [
              Icon(Icons.volunteer_activism, color: Colors.green[400], size: 18),
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
              if (selectedDonation > 0)
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _donationAmount = 0;
                      _donationTarget = 'none';
                    });
                  },
                  child: Text(
                    'Iptal',
                    style: TextStyle(
                      color: isDark ? Colors.grey[500] : Colors.grey[400],
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          
          // Yuvarlama secenekleri - sadece bagis miktari goster
          Row(
            children: [
              for (int i = 0; i < options.length; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _donationAmount = _donationAmount == options[i] ? 0.0 : options[i];
                      if (_donationAmount > 0 && _donationTarget == 'none') {
                        _donationTarget = 'kermesOrg';
                      }
                      if (_donationAmount == 0) _donationTarget = 'none';
                    });
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 20),
                    decoration: BoxDecoration(
                      color: selectedDonation == options[i]
                          ? Colors.green
                          : isDark ? const Color(0xFF2A2A2A) : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: selectedDonation == options[i]
                            ? Colors.green
                            : isDark ? Colors.grey[700]! : Colors.grey.shade300,
                        width: 1,
                      ),
                    ),
                    child: Text(
                      '+${options[i].toStringAsFixed(2)} $currency',
                      style: TextStyle(
                        color: selectedDonation == options[i]
                            ? Colors.white
                            : isDark ? Colors.white70 : Colors.black87,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          
          // Kurulus secimi (bagis secildiginde goster)
          if (selectedDonation > 0) ...[
            const SizedBox(height: 14),
            // Kermes organizasyonu
            _buildCharityOption(
              isDark: isDark,
              label: kermesOrgName,
              icon: Icons.mosque,
              isSelected: _donationTarget == 'kermesOrg',
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _donationTarget = 'kermesOrg');
              },
            ),
            // Ek hayir kurumu (varsa)
            if (hasFund) ...[
              const SizedBox(height: 8),
              _buildCharityOption(
                isDark: isDark,
                label: fundName,
                icon: Icons.favorite,
                isSelected: _donationTarget == 'fund',
                url: fundUrl,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _donationTarget = 'fund');
                },
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildCharityOption({
    required bool isDark,
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
    String? url,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? Colors.green.withOpacity(0.12)
              : isDark ? const Color(0xFF2A2A2A) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? Colors.green : (isDark ? Colors.white12 : Colors.grey.shade300),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.check_circle : Icons.radio_button_unchecked,
              size: 20,
              color: isSelected ? Colors.green : (isDark ? Colors.white38 : Colors.grey),
            ),
            const SizedBox(width: 10),
            Icon(icon, size: 16, color: isSelected ? Colors.green : (isDark ? Colors.white54 : Colors.grey)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? (isDark ? Colors.white : Colors.black87) : (isDark ? Colors.white70 : Colors.black54),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (url != null && url.isNotEmpty)
              GestureDetector(
                onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(width: 4),
                    Icon(Icons.open_in_new, size: 14, color: Colors.green[400]),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Nakit alinan tutar dialog - hizli butonlar + ozel giris
  Future<double?> _showCashReceivedDialog(double orderTotal) async {
    final controller = TextEditingController();
    double? selectedAmount;

    final quickAmounts = <double>[orderTotal];
    for (final note in [5.0, 10.0, 20.0, 50.0, 100.0]) {
      final rounded = (orderTotal / note).ceil() * note;
      if (rounded > orderTotal && !quickAmounts.contains(rounded.toDouble())) {
        quickAmounts.add(rounded.toDouble());
      }
    }
    quickAmounts.sort();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    const successGreen = Color(0xFF2E7D32);

    return showDialog<double>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            final change = selectedAmount != null
                ? (selectedAmount! - orderTotal).clamp(0.0, double.infinity)
                : 0.0;

            return AlertDialog(
              backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.money, color: Colors.green, size: 24),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Nakit Odeme', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Siparis tutari
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: lokmaPink.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: lokmaPink.withOpacity(0.2)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Siparis Tutari:', style: TextStyle(fontSize: 14, color: isDark ? Colors.white70 : Colors.black87)),
                          Text(
                            '${orderTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: lokmaPink),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    Text('Alinan Tutar:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: quickAmounts.map((amount) {
                        final isExact = amount == orderTotal;
                        final isSelected = selectedAmount == amount;
                        return GestureDetector(
                          onTap: () {
                            setDialogState(() {
                              selectedAmount = amount;
                              controller.text = amount.toStringAsFixed(2);
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? successGreen
                                  : isExact
                                      ? successGreen.withOpacity(0.1)
                                      : (isDark ? Colors.white10 : Colors.grey.shade100),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? successGreen : (isDark ? Colors.white24 : Colors.grey.shade300),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Text(
                              isExact ? 'Tam ${amount.toStringAsFixed(2)}' : '${amount.toStringAsFixed(2)}',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),

                    TextField(
                      controller: controller,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                      decoration: InputDecoration(
                        hintText: 'Ozel tutar gir...',
                        hintStyle: TextStyle(fontSize: 14, color: isDark ? Colors.white38 : Colors.grey.shade400),
                        prefixIcon: Icon(Icons.euro, color: isDark ? Colors.green.shade300 : Colors.green),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                      onChanged: (val) {
                        final parsed = double.tryParse(val.replaceAll(',', '.'));
                        setDialogState(() => selectedAmount = parsed);
                      },
                    ),

                    if (selectedAmount != null && change > 0) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Para Ustu:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87)),
                            Text(
                              '${change.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.orange),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, null),
                  child: Text('Iptal', style: TextStyle(color: isDark ? Colors.white54 : Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: selectedAmount != null && selectedAmount! >= orderTotal
                      ? () => Navigator.pop(ctx, selectedAmount)
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: successGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: const Text('Onayla', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

/// Helper function to show the checkout sheet
void showKermesCheckoutSheet(
  BuildContext context, 
  KermesEvent event, {
  String? initialTableNumber,
  String? initialSectionId,
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
      initialSectionId: initialSectionId,
      initialDeliveryMode: initialDeliveryMode,
    ),
  );
}
