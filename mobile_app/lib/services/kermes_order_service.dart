import 'dart:convert';
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
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
  Future<void> markAsPaid(String orderId, {String? collectorId, double? cashReceived, double? changeGiven}) async {
    try {
      final updates = <String, dynamic>{'isPaid': true};
      if (collectorId != null) {
        updates['collectedByStaffId'] = collectorId;
        updates['settledToRegister'] = false; // Add this to make sure it's explicitly tracked
      }
      if (cashReceived != null) {
        updates['cashReceived'] = cashReceived;
      }
      if (changeGiven != null) {
        updates['changeGiven'] = changeGiven;
      }
      await _ordersCollection.doc(orderId).update(updates);
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

  /// Siparis ID'si olustur - Bolum-farkindali siralama
  /// Erkekler bolumu: tek nolar (1, 3, 5, 7...)
  /// Kadinlar bolumu: cift nolar (2, 4, 6, 8...)
  /// Diger bolumler: 101'den baslayan ayri seri
  /// Atomic transaction ile race condition onlenir
  Future<String> generateSequentialOrderId(String kermesId, {String? tableSection}) async {
    final kermesRef = _firestore.collection('kermes_events').doc(kermesId);
    
    // Bolum tipine gore counter field ve numara mantigi belirle
    final sectionType = _getSectionType(tableSection);
    
    // Transaction ile atomic olarak counter'i artir
    final orderId = await _firestore.runTransaction<String>((transaction) async {
      final kermesDoc = await transaction.get(kermesRef);
      
      if (!kermesDoc.exists) {
        throw Exception('Kermes bulunamadi: $kermesId');
      }
      
      final data = kermesDoc.data() ?? {};
      
      switch (sectionType) {
        case _SectionType.erkekler:
          // Tek nolar: 1, 3, 5, 7...
          // Counter: kac tane erkek siparisi verildi (0, 1, 2...)
          final erkekCount = data['orderCounterErkek'] ?? 0;
          final newCount = erkekCount + 1;
          final orderNum = (newCount * 2) - 1; // 1, 3, 5, 7...
          transaction.update(kermesRef, {'orderCounterErkek': newCount});
          return orderNum.toString();
          
        case _SectionType.kadinlar:
          // Cift nolar: 2, 4, 6, 8...
          final kadinCount = data['orderCounterKadin'] ?? 0;
          final newCount = kadinCount + 1;
          final orderNum = newCount * 2; // 2, 4, 6, 8...
          transaction.update(kermesRef, {'orderCounterKadin': newCount});
          return orderNum.toString();
          
        case _SectionType.diger:
          // Diger bolumler: 101, 102, 103...
          final digerCount = data['orderCounterDiger'] ?? 100;
          final newCount = digerCount + 1;
          transaction.update(kermesRef, {'orderCounterDiger': newCount});
          return newCount.toString();
      }
    });
    
    return orderId;
  }
  
  /// Bolum tipini belirle
  _SectionType _getSectionType(String? tableSection) {
    if (tableSection == null) return _SectionType.diger;
    final lower = tableSection.toLowerCase();
    if (lower.contains('erkek') || lower.contains('men') || lower.contains('herren')) {
      return _SectionType.erkekler;
    }
    if (lower.contains('kadin') || lower.contains('kadın') || lower.contains('women') || lower.contains('damen') || lower.contains('frauen')) {
      return _SectionType.kadinlar;
    }
    return _SectionType.diger;
  }
  
  /// Fallback: Random sipariş ID'si oluştur (transaction başarısız olursa)
  String generateFallbackOrderId() {
    final now = DateTime.now();
    // 5 basamaklı random sayı (90000-99999 arası - sıralı ile karışmaması için)
    final number = 90000 + (now.microsecondsSinceEpoch % 10000);
    return number.toString();
  }

  // ==========================================================
  // KDS (Kitchen Display System) & POS METHODS
  // Zone-bazli mutfak yonlendirme ve item-bazli statu yonetimi
  // ==========================================================

  /// Zone-bazli siparis stream (KDS ekraninda kullanilir)
  /// Sadece belirli prepZone'a ait itemi olan aktif siparisleri dondurur
  Stream<List<KermesOrder>> getOrdersByZone(String kermesId, String zone) {
    return _ordersCollection
        .where('kermesId', isEqualTo: kermesId)
        .where('status', whereIn: [
          KermesOrderStatus.pending.name,
          KermesOrderStatus.preparing.name,
        ])
        .orderBy('createdAt', descending: false) // FIFO - ilk gelen ilk cikar
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => KermesOrder.fromDocument(doc))
              .where((order) {
                // Bu sipariste bu zone'a ait en az bir item var mi?
                return order.items.any((item) => 
                  item.prepZones.contains(zone) && item.itemStatus != KermesItemStatus.ready
                );
              })
              .toList();
        });
  }

  /// Tek bir item'in statusunu guncelle
  /// KDS ekraninda "HAZIR" butonu basildiginda cagrilir
  Future<void> updateItemStatus({
    required String orderId,
    required int itemIndex,
    required KermesItemStatus newStatus,
    String? zone,
  }) async {
    try {
      final docRef = _ordersCollection.doc(orderId);
      
      await _firestore.runTransaction((transaction) async {
        final doc = await transaction.get(docRef);
        if (!doc.exists) throw Exception('Siparis bulunamadi');
        
        final data = doc.data() as Map<String, dynamic>;
        final items = List<Map<String, dynamic>>.from(
          (data['items'] as List<dynamic>).map((e) => Map<String, dynamic>.from(e as Map))
        );
        
        if (itemIndex >= items.length) throw Exception('Gecersiz item index');
        
        // Zone dogrulama: bu item gercekten bu zone'a mi ait?
        if (zone != null && items[itemIndex]['prepZone'] != null) {
          final pZone = items[itemIndex]['prepZone'];
          bool matches = false;
          if (pZone is List) {
            matches = pZone.contains(zone);
          } else {
            matches = pZone == zone;
          }
          if (!matches) {
            throw Exception('Bu item bu zone\'a ait degil');
          }
        }
        
        // Item statusunu guncelle
        items[itemIndex]['itemStatus'] = newStatus.name;
        if (newStatus == KermesItemStatus.ready) {
          items[itemIndex]['readyAt'] = Timestamp.fromDate(DateTime.now());
          if (zone != null) items[itemIndex]['readyByZone'] = zone;
        }
        
        // Tum itemlar hazir mi kontrol et
        final allReady = items.every((item) => item['itemStatus'] == KermesItemStatus.ready.name);
        
        final updateData = <String, dynamic>{
          'items': items,
          'updatedAt': FieldValue.serverTimestamp(),
        };
        
        // Tum itemlar hazir ise siparis statusunu otomatik "ready" yap
        if (allReady) {
          updateData['status'] = KermesOrderStatus.ready.name;
        } else if (data['status'] == KermesOrderStatus.pending.name) {
          // En az bir item isleme alindiysa "preparing" yap
          updateData['status'] = KermesOrderStatus.preparing.name;
        }
        
        transaction.update(docRef, updateData);
      });
    } catch (e) {
      debugPrint('Item statu guncelleme hatasi: $e');
      throw Exception('Item statusu guncellenemedi: $e');
    }
  }

  /// Tum zone'lardaki KDS siparislerini getir (tum mutfaklar)
  Stream<List<KermesOrder>> getKDSOrdersStream(String kermesId) {
    return _ordersCollection
        .where('kermesId', isEqualTo: kermesId)
        .where('status', whereIn: [
          KermesOrderStatus.pending.name,
          KermesOrderStatus.preparing.name,
        ])
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => KermesOrder.fromDocument(doc))
            .toList());
  }

  /// POS ekrani icin aktif siparisler (garson gorunumu)
  /// pending, preparing, ready statusundeki tum siparisler
  Stream<List<KermesOrder>> getPOSActiveOrdersStream(String kermesId) {
    return _ordersCollection
        .where('kermesId', isEqualTo: kermesId)
        .where('status', whereIn: [
          KermesOrderStatus.pending.name,
          KermesOrderStatus.preparing.name,
          KermesOrderStatus.ready.name,
        ])
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
          final orders = snapshot.docs
              .map((doc) => KermesOrder.fromDocument(doc))
              .toList();
          
          // Hazir olanlar en uste
          orders.sort((a, b) {
            if (a.isFullyReady && !b.isFullyReady) return -1;
            if (!a.isFullyReady && b.isFullyReady) return 1;
            return b.createdAt.compareTo(a.createdAt);
          });
          
          return orders;
        });
  }

  // ==========================================================
  // TEZGAH (SIPARIS BIRLESTIRME NOKTASI) METHODS
  // Tezgah, tum zone'lardan gelen hazir itemlari birlestirir
  // ==========================================================

  /// Tezgah ekrani icin siparis stream'i
  /// Hazirlanan ve hazir siparisler gosterilir, tamamen teslim edilenler cikarilir
  /// Bolum filtresi uygulanabilir (ornegin sadece Kadin Bolumu tezgahi)
  Stream<List<KermesOrder>> getTezgahOrdersStream(String kermesId, {List<String>? sectionFilter}) {
    return _ordersCollection
        .where('kermesId', isEqualTo: kermesId)
        .where('status', whereIn: [
          KermesOrderStatus.pending.name,
          KermesOrderStatus.preparing.name,
          KermesOrderStatus.ready.name,
        ])
        .orderBy('createdAt', descending: false) // FIFO - ilk gelen ilk cikar
        .snapshots()
        .map((snapshot) {
          var orders = snapshot.docs
              .map((doc) => KermesOrder.fromDocument(doc))
              .toList();

          if (sectionFilter != null && sectionFilter.isNotEmpty) {
            orders = orders.where((order) {
              // Masa siparisi ise tableSection'a bak
              if (order.tableSection != null) {
                return sectionFilter.contains(order.tableSection);
              }
              // Hic prepZone'u olmayan urunler (zone atanmamis) herkese aittir
              final hasAnyZonedItem = order.items.any((item) => item.prepZones.isNotEmpty);
              if (!hasAnyZonedItem) return true; // zone atanmamis -> tum tezgahlarda gorun
              
              // Zone'lu urunler icin filtre uygula
              return order.items.any((item) =>
                item.prepZones.isEmpty || // zone'suz item -> gecir
                sectionFilter.any((s) =>
                  item.prepZones.any((zone) => zone.toLowerCase().startsWith(s.substring(0, 1).toLowerCase()))
                )
              );
            }).toList();
          }

          // Siralama: Tam hazir olanlar en uste
          orders.sort((a, b) {
            if (a.isFullyReady && !b.isFullyReady) return -1;
            if (!a.isFullyReady && b.isFullyReady) return 1;
            return a.createdAt.compareTo(b.createdAt); // FIFO
          });
          
          return orders;
        });
  }

  /// Tezgahtan teslim et (GelAl siparisleri)
  Future<void> markAsDeliveredFromTezgah(String orderId) async {
    try {
      await _ordersCollection.doc(orderId).update({
        'status': KermesOrderStatus.delivered.name,
        'completedAt': Timestamp.fromDate(DateTime.now()),
        'deliveredFromTezgah': true,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw Exception('Teslim islemi basarisiz: $e');
    }
  }

  /// Garson ata (masa siparisleri icin)
  Future<void> assignWaiter({
    required String orderId,
    required String waiterId,
    required String waiterName,
  }) async {
    try {
      await _ordersCollection.doc(orderId).update({
        'assignedWaiterId': waiterId,
        'assignedWaiterName': waiterName,
        'assignedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw Exception('Garson atamasi basarisiz: $e');
    }
  }

  /// Kurye hazir (kurye dispatch ekranina yonlendir)
  Future<void> markReadyForCourier(String orderId) async {
    try {
      await _ordersCollection.doc(orderId).update({
        'readyForCourier': true,
        'readyForCourierAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw Exception('Kurye hazirligi basarisiz: $e');
    }
  }

  /// Siparisi "teslim edildi" olarak isaretle (garson masaya goturdugunde)
  Future<void> markAsDelivered(String orderId) async {
    try {
      await _ordersCollection.doc(orderId).update({
        'status': KermesOrderStatus.delivered.name,
        'completedAt': Timestamp.fromDate(DateTime.now()),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw Exception('Teslim islemi basarisiz: $e');
    }
  }

  // ==========================================================
  // COURIER / DELIVERY WORKFLOW
  // Extends identical functionality from OrderService
  // ==========================================================

  /// Get ready deliveries for a kermes event (staff view)
  /// Shows ready, preparing, and pending delivery orders - ready first
  Stream<List<KermesOrder>> getReadyDeliveriesStream(String kermesId) {
    return _ordersCollection
        .where('kermesId', isEqualTo: kermesId)
        .snapshots()
        .map((snapshot) {
          final validStatuses = ['ready', 'preparing', 'pending'];
          
          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? '';
                final courierId = data['courierId'];
                
                final isValidStatus = validStatuses.contains(status);
                final isDelivery = deliveryMethod == 'delivery';
                final isUnclaimed = courierId == null || courierId.toString().isEmpty;
                
                return isValidStatus && isDelivery && isUnclaimed;
              })
              .map((doc) => KermesOrder.fromDocument(doc))
              .toList();
          
          orders.sort((a, b) {
            const priority = {'ready': 0, 'preparing': 1, 'pending': 2};
            final aPriority = priority[a.status.name] ?? 3;
            final bPriority = priority[b.status.name] ?? 3;
            return aPriority.compareTo(bPriority);
          });
          
          return orders;
        });
  }

  /// Get ready deliveries for a DRIVER assigned to multiple Kermes events
  Stream<List<KermesOrder>> getDriverDeliveriesStream(List<String> kermesIds, {String? courierId}) {
    if (kermesIds.isEmpty) {
      return Stream.value([]);
    }

    return _ordersCollection
        .snapshots()
        .map((snapshot) {
          final validStatuses = ['ready', 'preparing', 'pending', 'onTheWay', 'accepted'];
          
          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final eventId = data['kermesId']?.toString() ?? '';
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? '';
                final orderCourierId = data['courierId']?.toString() ?? '';
                
                final isAssignedEvent = kermesIds.contains(eventId);
                final isValidStatus = validStatuses.contains(status);
                final isDelivery = deliveryMethod == 'delivery';
                final isUnclaimed = orderCourierId.isEmpty;
                final isClaimedByMe = courierId != null && orderCourierId == courierId;
                
                return isValidStatus && isDelivery && (
                  (isAssignedEvent && isUnclaimed) || isClaimedByMe
                );
              })
              .map((doc) => KermesOrder.fromDocument(doc))
              .toList();
          
          orders.sort((a, b) {
            final aIsMyOrder = courierId != null && a.courierId == courierId;
            final bIsMyOrder = courierId != null && b.courierId == courierId;
            if (aIsMyOrder && !bIsMyOrder) return -1;
            if (!aIsMyOrder && bIsMyOrder) return 1;
            
            const priority = {'onTheWay': 0, 'accepted': 0, 'ready': 1, 'preparing': 2, 'pending': 3};
            final aPriority = priority[a.status.name] ?? 4;
            final bPriority = priority[b.status.name] ?? 4;
            return aPriority.compareTo(bPriority);
          });
          
          return orders;
        });
  }

  /// Get ALL orders from assigned Kermes events for driver planning view
  Stream<List<KermesOrder>> getAllKermesOrdersStream(List<String> kermesIds) {
    if (kermesIds.isEmpty) {
      return Stream.value([]);
    }

    return _ordersCollection
        .snapshots()
        .map((snapshot) {
          final validStatuses = ['pending', 'preparing', 'ready', 'accepted', 'onTheWay'];

          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final eventId = data['kermesId']?.toString() ?? '';
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? '';

                return kermesIds.contains(eventId) &&
                       validStatuses.contains(status) &&
                       deliveryMethod == 'delivery';
              })
              .map((doc) => KermesOrder.fromDocument(doc))
              .toList();

          orders.sort((a, b) {
            const priority = {'pending': 0, 'preparing': 1, 'ready': 2, 'accepted': 3, 'onTheWay': 4};
            final aPriority = priority[a.status.name] ?? 5;
            final bPriority = priority[b.status.name] ?? 5;
            return aPriority.compareTo(bPriority);
          });

          return orders;
        });
  }

  /// Claim a delivery (staff/driver takes responsibility)
  Future<bool> claimDelivery({
    required String orderId,
    required String courierId,
    required String courierName,
    required String courierPhone,
  }) async {
    final doc = await _ordersCollection.doc(orderId).get();
    if (!doc.exists) return false;
    
    final data = doc.data() as Map<String, dynamic>;
    final currentStatus = data['status'] as String?;
    
    if (data['courierId'] != null) {
      return false;
    }

    // Capture GPS
    Map<String, dynamic>? claimLocation;
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      claimLocation = {'lat': position.latitude, 'lng': position.longitude, 'timestamp': DateTime.now().toIso8601String()};
    } catch (e) {
      try {
        final lastPos = await Geolocator.getLastKnownPosition();
        if (lastPos != null) {
          claimLocation = {'lat': lastPos.latitude, 'lng': lastPos.longitude, 'isApproximate': true, 'timestamp': DateTime.now().toIso8601String()};
        }
      } catch (_) {}
    }
    
    final updateData = <String, dynamic>{
      'courierId': courierId,
      'courierName': courierName,
      'courierPhone': courierPhone,
      'claimedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (claimLocation != null) updateData['claimLocation'] = claimLocation;
    if (currentStatus == KermesOrderStatus.ready.name) updateData['status'] = KermesOrderStatus.onTheWay.name;

    await _ordersCollection.doc(orderId).update(updateData);
    return true;
  }

  /// Cancel delivery claim
  Future<bool> cancelClaim(String orderId, {String? reason}) async {
    await _ordersCollection.doc(orderId).update({
      'courierId': FieldValue.delete(),
      'courierName': FieldValue.delete(),
      'courierPhone': FieldValue.delete(),
      'courierLocation': FieldValue.delete(),
      'claimedAt': FieldValue.delete(),
      'startedAt': FieldValue.delete(),
      'etaMinutes': FieldValue.delete(),
      'status': KermesOrderStatus.ready.name,
      'updatedAt': FieldValue.serverTimestamp(),
      if (reason != null) 'lastCancellationReason': reason,
      if (reason != null) 'lastCancellationAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Start delivery
  Future<bool> startDelivery(String orderId) async {
    await _ordersCollection.doc(orderId).update({
      'status': KermesOrderStatus.onTheWay.name,
      'startedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Complete delivery
  Future<bool> completeDelivery(String orderId) async {
    await _ordersCollection.doc(orderId).update({
      'status': KermesOrderStatus.delivered.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Complete delivery with proof
  Future<bool> completeDeliveryWithProof(
    String orderId, {
    required String deliveryType,
    String? proofPhotoUrl,
  }) async {
    final orderDoc = await _ordersCollection.doc(orderId).get();
    final orderData = orderDoc.data() as Map<String, dynamic>?;
    final claimLocation = orderData?['claimLocation'] as Map<String, dynamic>?;

    Map<String, dynamic>? gpsData;
    double? deliveryLat;
    double? deliveryLng;
    
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      deliveryLat = position.latitude;
      deliveryLng = position.longitude;
      gpsData = {
        'latitude': position.latitude, 'longitude': position.longitude,
        'accuracy': position.accuracy, 'isLive': true, 'timestamp': position.timestamp.toIso8601String(),
      };
    } catch (e) {
      try {
        final lastPosition = await Geolocator.getLastKnownPosition();
        if (lastPosition != null) {
          deliveryLat = lastPosition.latitude; deliveryLng = lastPosition.longitude;
          gpsData = {
            'latitude': lastPosition.latitude, 'longitude': lastPosition.longitude,
            'accuracy': lastPosition.accuracy, 'isLive': false, 'isApproximate': true,
            'timestamp': lastPosition.timestamp.toIso8601String(), 'note': 'Son bilinen konum',
          };
        }
      } catch (_) {}
    }

    double? distanceKm;
    if (claimLocation != null && deliveryLat != null && deliveryLng != null) {
      final claimLat = (claimLocation['lat'] as num?)?.toDouble();
      final claimLng = (claimLocation['lng'] as num?)?.toDouble();
      if (claimLat != null && claimLng != null) {
        distanceKm = _calculateHaversineDistance(claimLat, claimLng, deliveryLat, deliveryLng);
      }
    }
    
    final deliveryProof = <String, dynamic>{
      'type': deliveryType,
      'completedAt': FieldValue.serverTimestamp(),
      'localTimestamp': DateTime.now().toIso8601String(),
    };
    
    if (gpsData != null) deliveryProof['gps'] = gpsData;
    if (distanceKm != null) deliveryProof['distanceKm'] = double.parse(distanceKm.toStringAsFixed(2));
    if (proofPhotoUrl != null) deliveryProof['photoUrl'] = proofPhotoUrl;
    
    await _ordersCollection.doc(orderId).update({
      'status': KermesOrderStatus.delivered.name,
      'deliveryProof': deliveryProof,
      'deliveredAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    return true;
  }

  /// Update courier location
  Future<void> updateCourierLocation({
    required String orderId,
    required double lat,
    required double lng,
    int? etaMinutes,
  }) async {
    await _ordersCollection.doc(orderId).update({
      'courierLocation': {'lat': lat, 'lng': lng},
      'lastLocationUpdate': FieldValue.serverTimestamp(),
      if (etaMinutes != null) 'etaMinutes': etaMinutes,
    });
  }

  /// Courier tracking & active logic
  Stream<KermesOrder?> getOrderStream(String orderId) {
    return _ordersCollection.doc(orderId).snapshots().map(
      (doc) => doc.exists ? (KermesOrder.fromDocument(doc)) : null,
    );
  }

  Stream<KermesOrder?> getMyActiveDeliveryStream(String courierId) {
    final activeStatuses = ['ready', 'preparing', 'pending', 'onTheWay', 'accepted'];
    return _ordersCollection.where('courierId', isEqualTo: courierId).snapshots().map((snapshot) {
      final activeDocs = snapshot.docs.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final status = data['status']?.toString() ?? '';
        final deliveryMethod = data['deliveryMethod']?.toString() ?? '';
        return activeStatuses.contains(status) && deliveryMethod == 'delivery';
      }).toList();
      
      if (activeDocs.isEmpty) return null;
      activeDocs.sort((a, b) {
        final aTime = (a.data() as Map<String, dynamic>)['claimedAt'] as Timestamp?;
        final bTime = (b.data() as Map<String, dynamic>)['claimedAt'] as Timestamp?;
        if (aTime == null) return 1; if (bTime == null) return -1;
        return bTime.compareTo(aTime);
      });
      return KermesOrder.fromDocument(activeDocs.first);
    });
  }

  Stream<List<KermesOrder>> getMyActiveDeliveriesStream(String courierId) {
    final activeStatuses = ['ready', 'preparing', 'pending', 'onTheWay', 'accepted'];
    return _ordersCollection.where('courierId', isEqualTo: courierId).snapshots().map((snapshot) {
      final activeDocs = snapshot.docs.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final status = data['status']?.toString() ?? '';
        final deliveryMethod = data['deliveryMethod']?.toString() ?? '';
        return activeStatuses.contains(status) && deliveryMethod == 'delivery';
      }).toList();
      
      activeDocs.sort((a, b) {
        final aTime = (a.data() as Map<String, dynamic>)['claimedAt'] as Timestamp?;
        final bTime = (b.data() as Map<String, dynamic>)['claimedAt'] as Timestamp?;
        if (aTime == null) return 1; if (bTime == null) return -1;
        return bTime.compareTo(aTime);
      });
      return activeDocs.map((doc) => KermesOrder.fromDocument(doc)).toList();
    });
  }

  Stream<List<KermesOrder>> getMyCompletedDeliveriesToday(String courierId) {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final visibilityStart = now.subtract(const Duration(hours: 3));
    final cutoffTime = todayStart.isBefore(visibilityStart) ? visibilityStart : todayStart;
    
    return _ordersCollection.where('courierId', isEqualTo: courierId).snapshots().map((snapshot) {
      return snapshot.docs
          .map((doc) => KermesOrder.fromDocument(doc))
          .where((order) {
            final statusStr = order.status.toString().split('.').last;
            if (statusStr != 'delivered') return false;
            // Uses createdAt as fallback if deliveredAt missing
            return order.createdAt.isAfter(cutoffTime);
          })
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    });
  }

  double _calculateHaversineDistance(double lat1, double lng1, double lat2, double lng2) {
    const R = 6371.0;
    final dLat = _toRadians(lat2 - lat1);
    final dLng = _toRadians(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) + cos(_toRadians(lat1)) * cos(_toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  double _toRadians(double degrees) => degrees * pi / 180;
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

/// Bolum tipi - numara atama icin
enum _SectionType { erkekler, kadinlar, diger }
