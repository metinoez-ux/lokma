import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/widgets/kermes/payment_method_dialog.dart';

/// Kermes sipariş servisi
class KermesOrderService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  static const String _apiBaseUrl = 'https://lokma.shop/api';
  
  /// Siparişleri kaydettiğimiz collection
  /// NOT: İleride tüm iş türleri için ortak 'orders' collection kullanılabilir
  CollectionReference get _ordersCollection => _firestore.collection('kermes_orders');

  /// Yeni sipariş oluştur
  Future<String> createOrder(KermesOrder order) async {
    try {
      await _ordersCollection.doc(order.id).set(order.toMap());
      return order.id;
    } catch (e) {
      throw Exception('Sipariş oluşturulamadı: $e');
    }
  }

  /// Kullanıcının siparişlerini getir (userId ile)
  Stream<List<KermesOrder>> getUserOrders(String userId) {
    return _ordersCollection
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => KermesOrder.fromDocument(doc))
            .toList());
  }

  /// Tüm aktif siparişleri getir (admin için)
  Stream<List<KermesOrder>> getActiveOrders(String kermesId) {
    return _ordersCollection
        .where('kermesId', isEqualTo: kermesId)
        .where('status', whereIn: [
          KermesOrderStatus.pending.name,
          KermesOrderStatus.preparing.name,
          KermesOrderStatus.ready.name,
        ])
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => KermesOrder.fromDocument(doc))
            .toList());
  }

  /// Sipariş durumunu güncelle
  Future<void> updateOrderStatus(String orderId, KermesOrderStatus status) async {
    try {
      await _ordersCollection.doc(orderId).update({
        'status': status.name,
        if (status == KermesOrderStatus.delivered) 
          'completedAt': Timestamp.fromDate(DateTime.now()),
      });
    } catch (e) {
      throw Exception('Sipariş durumu güncellenemedi: $e');
    }
  }

  /// Ödeme durumunu güncelle
  Future<void> markAsPaid(String orderId) async {
    try {
      await _ordersCollection.doc(orderId).update({'isPaid': true});
    } catch (e) {
      throw Exception('Ödeme durumu güncellenemedi: $e');
    }
  }

  /// Tek bir siparişi getir
  Future<KermesOrder?> getOrder(String orderId) async {
    try {
      final doc = await _ordersCollection.doc(orderId).get();
      if (doc.exists) {
        return KermesOrder.fromDocument(doc);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /// Siparişi iptal et
  /// Ödeme yapılmışsa Stripe refund işlemi başlatılır
  Future<CancelOrderResult> cancelOrder(String orderId, {String? reason}) async {
    try {
      // Önce siparişi kontrol et
      final order = await getOrder(orderId);
      if (order == null) {
        return CancelOrderResult(
          success: false,
          error: 'Sipariş bulunamadı',
        );
      }
      
      // Durum kontrolü - sadece pending siparişler iptal edilebilir
      if (order.status != KermesOrderStatus.pending) {
        return CancelOrderResult(
          success: false,
          error: 'Siparişiniz hazırlanmaya başladığı için iptal edilemiyor.',
          cannotCancel: true,
        );
      }
      
      // Eğer ödeme yapılmışsa API'den refund iste
      if (order.isPaid && order.paymentMethod == PaymentMethodType.card) {
        debugPrint('💳 Requesting refund for order: $orderId');
        
        final response = await http.post(
          Uri.parse('$_apiBaseUrl/refund-payment'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'orderId': orderId,
            'reason': reason ?? 'customer_request',
          }),
        );
        
        final data = jsonDecode(response.body);
        
        if (response.statusCode != 200) {
          debugPrint('❌ Refund failed: ${response.body}');
          return CancelOrderResult(
            success: false,
            error: data['message'] ?? data['error'] ?? 'İade işlemi başarısız',
            cannotCancel: data['status'] != null && data['status'] != 'pending',
          );
        }
        
        debugPrint('✅ Refund successful: ${data['refundId']}');
        return CancelOrderResult(
          success: true,
          refunded: true,
          message: data['message'] ?? 'Sipariş iptal edildi ve ödemeniz iade edildi.',
          refundId: data['refundId'],
        );
      }
      
      // Ödeme yapılmamış - sadece iptal et
      await _ordersCollection.doc(orderId).update({
        'status': KermesOrderStatus.cancelled.name,
        'cancelledAt': Timestamp.fromDate(DateTime.now()),
        'cancellationReason': reason ?? 'customer_request',
      });
      
      return CancelOrderResult(
        success: true,
        refunded: false,
        message: 'Sipariş başarıyla iptal edildi.',
      );
      
    } catch (e) {
      debugPrint('❌ Cancel order error: $e');
      return CancelOrderResult(
        success: false,
        error: 'Sipariş iptal edilemedi: $e',
      );
    }
  }

  /// Sipariş ID'si oluştur - Kermes bazlı sıralı numara
  /// Format: 5 haneli sayı (11001, 11002, 11003...)
  /// Her kermes başlangıcında 11001 ile başlar
  /// Atomic transaction ile race condition önlenir
  Future<String> generateSequentialOrderId(String kermesId) async {
    final kermesRef = _firestore.collection('kermes_events').doc(kermesId);
    
    // Transaction ile atomic olarak counter'ı artır
    final orderId = await _firestore.runTransaction<String>((transaction) async {
      final kermesDoc = await transaction.get(kermesRef);
      
      if (!kermesDoc.exists) {
        throw Exception('Kermes bulunamadı: $kermesId');
      }
      
      // Mevcut counter'ı al, yoksa 11000 ile başla (ilk sipariş 11001 olacak)
      final currentCounter = kermesDoc.data()?['orderCounter'] ?? 11000;
      final newCounter = currentCounter + 1;
      
      // Counter'ı güncelle
      transaction.update(kermesRef, {'orderCounter': newCounter});
      
      // 5 haneli string olarak döndür
      return newCounter.toString();
    });
    
    return orderId;
  }
  
  /// Fallback: Random sipariş ID'si oluştur (transaction başarısız olursa)
  String generateFallbackOrderId() {
    final now = DateTime.now();
    // 5 basamaklı random sayı (90000-99999 arası - sıralı ile karışmaması için)
    final number = 90000 + (now.microsecondsSinceEpoch % 10000);
    return number.toString();
  }
}

/// Sipariş iptal sonucu
class CancelOrderResult {
  final bool success;
  final bool refunded;
  final String? message;
  final String? error;
  final String? refundId;
  final bool cannotCancel;

  CancelOrderResult({
    required this.success,
    this.refunded = false,
    this.message,
    this.error,
    this.refundId,
    this.cannotCancel = false,
  });
}

/// Kermes sipariş servisi provider'ı
final kermesOrderServiceProvider = Provider<KermesOrderService>((ref) {
  return KermesOrderService();
});
