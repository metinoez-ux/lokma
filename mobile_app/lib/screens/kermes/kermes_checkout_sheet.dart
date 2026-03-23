import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/models/guest_profile_model.dart';
import 'package:lokma_app/providers/kermes_cart_provider.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/services/guest_profile_service.dart';
import 'package:lokma_app/widgets/kermes/order_qr_dialog.dart';
import 'package:lokma_app/widgets/kermes/delivery_type_dialog.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';
import '../../utils/currency_utils.dart';

/// Unified Checkout Sheet - Tüm sipariş akışı tek bir tam ekran bottom sheet'te
class KermesCheckoutSheet extends ConsumerStatefulWidget {
  final KermesEvent event;
  
  const KermesCheckoutSheet({super.key, required this.event});
  
  @override
  ConsumerState<KermesCheckoutSheet> createState() => _KermesCheckoutSheetState();
}

class _KermesCheckoutSheetState extends ConsumerState<KermesCheckoutSheet> {
  // Checkout adımları
  int _currentStep = 0;
  
  // Form değerleri
  bool _isGroupOrder = false; // Step 1: Bireysel/Ailecek
  DeliveryType _deliveryType = DeliveryType.gelAl; // Step 2: Teslimat
  PaymentMethodType _paymentMethod = PaymentMethodType.cash; // Step 4: Ödeme
  
  // Kişisel bilgiler
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _tableController = TextEditingController();
  
  // Loading state
  bool _isSubmitting = false;
  
  // Bagis/yuvarlama
  double _donationAmount = 0.0;
  
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
  
  /// Kermes aktiflik durumu kontrolleri
  bool get _isKermesActive {
    final now = DateTime.now();
    return now.isAfter(widget.event.startDate.subtract(const Duration(hours: 1))) && 
           now.isBefore(widget.event.endDate.add(const Duration(hours: 2)));
  }
  
  bool get _isKermesFuture => DateTime.now().isBefore(widget.event.startDate);
  /// Adım başlıkları
  List<String> get _stepTitles => [
    'Sepetim',
    'Sipariş Türü',
    'Teslimat',
    'Bilgileriniz',
    'Ödeme',
  ];
  
  /// İleri butonu aktif mi?
  bool get _canProceed {
    switch (_currentStep) {
      case 0: // Sepet
        return ref.read(kermesCartProvider).isNotEmpty;
      case 1: // Sipariş Türü - her zaman seçili
        return true;
      case 2: // Teslimat
        return true;
      case 3: // Bilgiler - kermes aktif değilse engelle
        if (!_isKermesActive) return false;
        return _nameController.text.trim().isNotEmpty && 
               _phoneController.text.trim().isNotEmpty;
      case 4: // Ödeme - son adım
        return true;
      default:
        return true;
    }
  }
  
  void _nextStep() {
    if (_currentStep < 4) {
      HapticFeedback.selectionClick();
      setState(() => _currentStep++);
    } else {
      // Son adım - siparişi tamamla
      _submitOrder();
    }
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
        orderNumber = await orderService.generateSequentialOrderId(widget.event.id);
      } catch (e) {
        debugPrint('Sıralı ID oluşturulamadı, fallback kullanılıyor: $e');
        orderNumber = orderService.generateFallbackOrderId();
      }
      
      // Benzersiz Firestore doc ID oluştur: kermesId_orderNumber
      final docId = '${widget.event.id}_$orderNumber';
      
      // Sipariş oluştur
      final order = KermesOrder(
        id: docId,
        orderNumber: orderNumber,
        kermesId: widget.event.id,
        kermesName: widget.event.city,
        userId: guestProfile?.id,
        customerName: _nameController.text.trim(),
        customerPhone: _phoneController.text.trim(),
        deliveryType: _deliveryType,
        tableNumber: _tableController.text.isNotEmpty ? _tableController.text : null,
        address: null,
        items: orderItems,
        totalAmount: totalAmount,
        donationAmount: _donationAmount,
        paymentMethod: _paymentMethod,
        isPaid: _paymentMethod == PaymentMethodType.card,
        status: KermesOrderStatus.pending,
        createdAt: DateTime.now(),
      );
      
      // Siparişi kaydet
      await orderService.createOrder(order);
      
      // Sepeti temizle
      ref.read(kermesCartProvider.notifier).clearCart();
      
      // Başarı - QR göster (kullanıcıya orderNumber göster)
      if (mounted) {
        Navigator.pop(context); // Checkout sheet'i kapat
        
        showOrderQRDialog(
          context,
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
                    color: Theme.of(context).colorScheme.surface,
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
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'Adım ${_currentStep + 1} / 5',
                      style: TextStyle(
                        color: isDark ? Colors.grey[400]! : Colors.grey[600]!,
                        fontSize: 13,
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
              color: _cardBg(isDark).withValues(alpha: 0.5),
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
        children: List.generate(5, (index) {
          final isCompleted = index < _currentStep;
          final isCurrent = index == _currentStep;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: index < 4 ? 4 : 0),
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
    switch (_currentStep) {
      case 0:
        return _buildCartStep();
      case 1:
        return _buildOrderTypeStep();
      case 2:
        return _buildDeliveryStep();
      case 3:
        return _buildInfoStep();
      case 4:
        return _buildPaymentStep();
      default:
        return const SizedBox.shrink();
    }
  }
  
  /// Step 0: Sepet özeti
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
                  gradient: LinearGradient(
                    colors: [lokmaPink.withValues(alpha: 0.2), lokmaPink.withValues(alpha: 0.05)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: lokmaPink.withValues(alpha: 0.3)),
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
                        color: isDark ? Colors.white.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.1),
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
                          style: const TextStyle(
                            color: Colors.greenAccent,
                            fontSize: 28,
                            fontWeight: FontWeight.w600,
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
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item.price.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()} x $quantity = ${subtotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                          style: TextStyle(color: subtleTextColor, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  // Controls
                  Container(
                    decoration: BoxDecoration(
                      color: lokmaPink.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () {
                            ref.read(kermesCartProvider.notifier).removeFromCart(item.name);
                          },
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: lokmaPink,
                              borderRadius: BorderRadius.horizontal(left: Radius.circular(8)),
                            ),
                            child: Icon(Icons.remove, color: Theme.of(context).colorScheme.surface, size: 18),
                          ),
                        ),
                        Container(
                          width: 36,
                          alignment: Alignment.center,
                          child: Text(
                            quantity.toString(),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.surface,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            ref.read(kermesCartProvider.notifier).addToCart(
                              item,
                              widget.event.id,
                              widget.event.city,
                            );
                          },
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: lokmaPink,
                              borderRadius: BorderRadius.horizontal(right: Radius.circular(8)),
                            ),
                            child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface, size: 18),
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
          const Text(
            'Nasıl sipariş vermek istersiniz?',
            style: TextStyle(color: Colors.white70, fontSize: 15),
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
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.green[400], size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Ailecek sipariş özelliği yakında kullanıma sunulacak!',
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 13),
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
  
  /// Step 2: Teslimat Türü
  Widget _buildDeliveryStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Siparişinizi nasıl almak istersiniz?',
            style: TextStyle(color: Colors.white70, fontSize: 15),
          ),
          const SizedBox(height: 24),
          
          // Gel Al
          _buildOptionCard(
            icon: Icons.shopping_bag_outlined,
            iconColor: Colors.amber,
            title: 'Gel Al',
            subtitle: 'Tezgahtan kendiniz alın',
            isSelected: _deliveryType == DeliveryType.gelAl,
            onTap: () => setState(() => _deliveryType = DeliveryType.gelAl),
          ),
          const SizedBox(height: 12),
          
          // Masada
          _buildOptionCard(
            icon: Icons.table_restaurant,
            iconColor: Colors.purple,
            title: 'Masaya Servis',
            subtitle: 'Masanıza getirelim',
            isSelected: _deliveryType == DeliveryType.masada,
            onTap: () => setState(() => _deliveryType = DeliveryType.masada),
          ),
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
  
  /// Step 3: Kişisel Bilgiler
  Widget _buildInfoStep() {
    // Kermes aktif değilse uyarı göster
    if (!_isKermesActive) {
      return _buildKermesNotActiveMessage();
    }
    
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Siparişiniz için bilgilerinizi girin',
            style: TextStyle(color: Colors.white70, fontSize: 15),
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
          _buildTextField(
            controller: _phoneController,
            label: 'Telefon',
            icon: Icons.phone_outlined,
            hint: '+49 XXX XXXXXXX',
            keyboardType: TextInputType.phone,
          ),
          
          // Masa numarası (masada için)
          if (_deliveryType == DeliveryType.masada) ...[
            const SizedBox(height: 14),
            _buildTextField(
              controller: _tableController,
              label: 'Masa Numarası',
              icon: Icons.table_restaurant_outlined,
              hint: 'Örn: 5',
              keyboardType: TextInputType.number,
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
                    ? [Colors.amber.withValues(alpha: 0.2), Colors.amber.withValues(alpha: 0.1)]
                    : [Colors.grey.withValues(alpha: 0.2), Colors.grey.withValues(alpha: 0.1)],
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
                color: isFuture ? Colors.amber.withValues(alpha: 0.3) : Colors.grey.withValues(alpha: 0.3),
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
                    ? [Colors.amber.withValues(alpha: 0.1), Colors.transparent]
                    : [Colors.grey.withValues(alpha: 0.1), Colors.transparent],
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
                        color: lokmaPink.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: lokmaPink.withValues(alpha: 0.3)),
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
              gradient: LinearGradient(
                colors: [lokmaPink.withValues(alpha: 0.15), lokmaPink.withValues(alpha: 0.05)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                // Ürünler
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${cartState.totalItems} ürün', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
                    Text(
                      '${cartState.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 16),
                    ),
                  ],
                ),
                
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
                          Text('Depozito ($pfandCount)', style: TextStyle(color: Colors.green[400], fontSize: 13)),
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
                    Text('Toplam', style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.w600)),
                    Text(
                      '${grandTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                      style: const TextStyle(
                        color: Colors.greenAccent,
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                
                const Divider(color: Colors.white24, height: 20),
                
                // Teslimat
                Row(
                  children: [
                    Icon(_getDeliveryIcon(), color: Colors.white70, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      _getDeliveryLabel(),
                      style: TextStyle(color: isDark ? Colors.white70 : Colors.black54, fontSize: 14),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
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
          
          // Bagis / Yuvarlama section
          const SizedBox(height: 28),
          _buildDonationSection(grandTotal),
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
          color: isDark ? Colors.green.withValues(alpha: 0.3) : Colors.green.withValues(alpha: 0.2),
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
          color: isSelected ? lokmaPink.withValues(alpha: 0.15) : _cardBg(isDark),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? lokmaPink : Colors.transparent,
            width: 2,
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
                  color: iconColor.withValues(alpha: 0.15),
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
                              color: isSelected ? (isDark ? Colors.white : Colors.black87) : (isDark ? Colors.white70 : Colors.black54),
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
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
                      style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[600], fontSize: 13),
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
        labelStyle: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
        hintStyle: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400]),
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
    }
  }
}

/// Helper function to show the checkout sheet
void showKermesCheckoutSheet(BuildContext context, KermesEvent event) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => KermesCheckoutSheet(event: event),
  );
}
