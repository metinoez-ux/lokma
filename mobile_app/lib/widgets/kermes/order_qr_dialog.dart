import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lokma_app/services/stripe_payment_service.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import '../../utils/currency_utils.dart';

/// Sipariş QR Kod Fullscreen Dialog
/// Tezgahta göstermek için parlak ekran ile QR kodu gösterir
class OrderQRDialog extends StatefulWidget {
  final String orderId;       // Firestore doc ID (kermesId_orderNumber)
  final String orderNumber;   // Kullanıcıya gösterilen (11001)
  final String kermesId;
  final String kermesName;
  final double totalAmount;
  final bool isPaid;

  const OrderQRDialog({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.kermesId,
    required this.kermesName,
    required this.totalAmount,
    required this.isPaid,
  });

  @override
  State<OrderQRDialog> createState() => _OrderQRDialogState();
}

class _OrderQRDialogState extends State<OrderQRDialog> {
  double? _previousBrightness;
  bool _isPaid = false;
  bool _isProcessingPayment = false;
  bool _isCancelled = false;
  bool _isCancelling = false;

  static const Color darkBg = Color(0xFF121212);
  static const Color cardBg = Color(0xFF1E1E1E);
  static const Color lokmaPink = Color(0xFFFB335B);

  @override
  void initState() {
    super.initState();
    _isPaid = widget.isPaid;
    _setMaxBrightness();
  }

  @override
  void dispose() {
    _restoreBrightness();
    super.dispose();
  }

  /// Ekran parlaklığını maksimuma çıkar
  Future<void> _setMaxBrightness() async {
    try {
      _previousBrightness = await ScreenBrightness().application;
      await ScreenBrightness().setApplicationScreenBrightness(1.0);
    } catch (e) {
      debugPrint('Parlaklık ayarlanamadı: $e');
    }
  }

  /// Önceki parlaklığa geri dön
  Future<void> _restoreBrightness() async {
    try {
      if (_previousBrightness != null) {
        await ScreenBrightness().setApplicationScreenBrightness(_previousBrightness!);
      } else {
        await ScreenBrightness().resetApplicationScreenBrightness();
      }
    } catch (e) {
      debugPrint('Parlaklık geri yüklenemedi: $e');
    }
  }

  void _copyOrderId() {
    Clipboard.setData(ClipboardData(text: widget.orderNumber));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(tr('orders.order_number_copied')),
        backgroundColor: cardBg,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 1),
      ),
    );
  }

  /// Kartla ödeme yap
  Future<void> _payWithCard() async {
    if (_isProcessingPayment) return;
    
    setState(() => _isProcessingPayment = true);
    
    try {
      // Stripe ile ödeme al
      final result = await StripePaymentService.processPayment(
        amount: widget.totalAmount,
        businessId: widget.kermesId, // Kermes ID'si
        orderId: widget.orderId,
      );
      
      if (result.success && mounted) {
        // Firestore'da ödeme durumunu güncelle
        await FirebaseFirestore.instance
            .collection('kermes_orders')
            .doc(widget.orderId)
            .update({
          'isPaid': true,
          'paymentMethod': 'card',
          'paidAt': FieldValue.serverTimestamp(),
          if (result.paymentIntentId != null) 
            'stripePaymentIntentId': result.paymentIntentId,
        });
        
        // UI'ı güncelle
        setState(() => _isPaid = true);
        
        // Başarı mesajı
        HapticFeedback.heavyImpact();
        if (mounted) {
          _showPaymentSuccessDialog();
        }
      } else if (result.error != null && !result.wasCancelled && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error!),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      debugPrint('Ödeme hatası: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ödeme yapılamadı: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessingPayment = false);
    }
  }
  
  /// Başarı dialog'u göster
  void _showPaymentSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, color: Colors.green, size: 60),
            ),
            const SizedBox(height: 24),
            const Text(
              'Ödeme Tamamlandı!',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${widget.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
              style: const TextStyle(
                color: Colors.greenAccent,
                fontSize: 28,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Tamam',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  /// Nakit ödeme bilgi dialog'u göster
  void _showCashPaymentInfo() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.greenAccent.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.payments_outlined, color: Colors.greenAccent, size: 50),
            ),
            const SizedBox(height: 20),
            const Text(
              'Nakit Ödeme',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Kermes alanındaki kasada bu QR kodu göstererek nakit ödeme yapabilirsiniz.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 15,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.greenAccent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.qr_code, color: Colors.greenAccent, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Sipariş: ${widget.orderNumber}',
                    style: const TextStyle(
                      color: Colors.greenAccent,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.greenAccent,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Anladım',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  /// Siparişi iptal et
  Future<void> _cancelOrder() async {
    // Önce onay al
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 28),
            SizedBox(width: 12),
            Text(
              'Sipariş İptali',
              style: TextStyle(color: Colors.white, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Siparişinizi iptal etmek istediğinize emin misiniz?',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            if (_isPaid) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Ödemeniz 2-3 iş günü içinde iade edilecektir.',
                        style: TextStyle(color: Colors.blue, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç', style: TextStyle(color: Colors.grey[500])),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: Text(tr('common.cancel_verb')),
          ),
        ],
      ),
    );
    
    if (confirmed != true) return;
    
    setState(() => _isCancelling = true);
    
    try {
      final orderService = KermesOrderService();
      final result = await orderService.cancelOrder(widget.orderId);
      
      if (result.success) {
        setState(() {
          _isCancelled = true;
          _isCancelling = false;
        });
        
        // Başarı mesajı göster
        if (mounted) {
          _showCancelSuccessDialog(result.refunded, result.message);
        }
      } else if (result.cannotCancel) {
        // Hazırlanıyor, iptal edilemez
        setState(() => _isCancelling = false);
        if (mounted) {
          _showCannotCancelDialog();
        }
      } else {
        // Diğer hatalar
        setState(() => _isCancelling = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result.error ?? 'İptal işlemi başarısız'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      setState(() => _isCancelling = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('common.operation_failed'.tr()),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
  
  /// İptal başarılı dialog
  void _showCancelSuccessDialog(bool refunded, String? message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, color: Colors.amber, size: 50),
            ),
            const SizedBox(height: 20),
            const Text(
              'Sipariş İptal Edildi',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            if (refunded) ...[
              Text(
                'Ödemeniz iade edildi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[400], fontSize: 14),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  '💡 İade tutarı 2-3 iş günü içinde hesabınıza yansıyacaktır. Bu teknik bir işlem süresidir.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.blue, fontSize: 12),
                ),
              ),
            ] else
              Text(
                message ?? 'Siparişiniz başarıyla iptal edildi.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[400], fontSize: 14),
              ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(dialogContext); // Dialog'u kapat
                  // Kermes menü ekranına geri dön (MainScaffold içinde)
                  Navigator.of(context).popUntil((route) => route.isFirst || route.settings.name == '/kermes');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
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
    );
  }
  
  /// Hazırlanıyor, iptal edilemez dialog
  void _showCannotCancelDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.restaurant, color: Colors.red, size: 50),
            ),
            const SizedBox(height: 20),
            const Text(
              'İptal Edilemiyor',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Siparişiniz hazırlanmaya başladığı için artık iptal edilemiyor. 🍳',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[400], fontSize: 14, height: 1.4),
            ),
            const SizedBox(height: 8),
            Text(
              'Lütfen tezgahta personel ile iletişime geçin.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[700],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Anladım',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: darkBg,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 28),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Spacer(),
                  Text(
                    widget.kermesName,
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            
            // Content - centered
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Üst bilgi - kompakt
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: lokmaPink.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'Bu QR kodu tezgah personeline gösterin',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      
                      const SizedBox(height: 16),
                      
                      // QR Kod - kompakt
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: QrImageView(
                          data: widget.orderId,
                          version: QrVersions.auto,
                          size: 160,
                          backgroundColor: Colors.white,
                          eyeStyle: const QrEyeStyle(
                            eyeShape: QrEyeShape.square,
                            color: Colors.black,
                          ),
                          dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: Colors.black,
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 12),
                      
                      // Sipariş Numarası başlık + numara
                      Text(
                        'Sipariş Numarası',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: _copyOrderId,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white24),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.orderNumber,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 3,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Icon(Icons.copy_rounded, color: Colors.grey[500], size: 20),
                            ],
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 10),
                      
                      // Ödeme Durumu - kompakt
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: _isPaid 
                              ? Colors.green.withValues(alpha: 0.15)
                              : Colors.amber.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _isPaid ? Colors.green : Colors.amber,
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _isPaid ? Icons.check_circle : Icons.schedule,
                              color: _isPaid ? Colors.green : Colors.amber,
                              size: 22,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              _isPaid ? 'ÖDEME YAPILDI' : 'ÖDEME BEKLENİYOR',
                              style: TextStyle(
                                color: _isPaid ? Colors.green : Colors.amber,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: 10),
                      
                      // Ödeme Bekleniyor açıklama metni
                      if (!_isPaid)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            'Siparişiniz ödeme yapıldıktan sonra\nhazırlanmaya başlanacaktır',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 12,
                              height: 1.3,
                            ),
                          ),
                        ),
                      
                      const SizedBox(height: 8),
                      
                      // Toplam Tutar - kompakt
                      Text(
                        'Toplam',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${widget.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                        style: const TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      
                      // Ödeme butonları - sadece ödeme bekleniyorsa
                      if (!_isPaid) ...[
                        const SizedBox(height: 10),
                        
                        // Online Öde butonu
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isProcessingPayment ? null : _payWithCard,
                            icon: _isProcessingPayment 
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.credit_card, size: 22),
                            label: Text(
                              _isProcessingPayment ? 'İşleniyor...' : 'Online Öde',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: lokmaPink,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 10),
                        
                        // Nakit Ödeme butonu
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _showCashPaymentInfo,
                            icon: const Icon(Icons.payments_outlined, size: 22),
                            label: const Text(
                              '💵 Nakit Ödeme',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.greenAccent,
                              side: const BorderSide(color: Colors.greenAccent, width: 1.5),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 20),
                        
                        // İptal Et butonu
                        SizedBox(
                          width: double.infinity,
                          child: TextButton.icon(
                            onPressed: _isCancelling ? null : _cancelOrder,
                            icon: _isCancelling 
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.red,
                                    ),
                                  )
                                : const Icon(Icons.cancel_outlined, size: 20, color: Colors.red),
                            label: Text(
                              _isCancelling ? 'İptal ediliyor...' : 'Siparişi İptal Et',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.red.shade400,
                              ),
                            ),
                          ),
                        ),
                      ],
                      
                      // İptal edilmiş görünümü
                      if (_isCancelled) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.cancel, color: Colors.red, size: 24),
                              const SizedBox(width: 8),
                              const Text(
                                'SİPARİŞ İPTAL EDİLDİ',
                                style: TextStyle(
                                  color: Colors.red,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      
                      const SizedBox(height: 16),
                    ],
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

/// QR kod göster helper fonksiyonu
void showOrderQRDialog(
  BuildContext context, {
  required String orderId,
  required String orderNumber,
  required String kermesId,
  required String kermesName,
  required double totalAmount,
  required bool isPaid,
}) {
  Navigator.of(context).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (context) => OrderQRDialog(
        orderId: orderId,
        orderNumber: orderNumber,
        kermesId: kermesId,
        kermesName: kermesName,
        totalAmount: totalAmount,
        isPaid: isPaid,
      ),
    ),
  );
}
