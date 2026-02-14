import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../providers/cart_provider.dart';

/// Order status enum
enum OrderStatus {
  pending,    // Beklemede
  accepted,   // Onaylandı
  preparing,  // Hazırlanıyor
  ready,      // Hazır
  onTheWay,   // Yolda (for delivery)
  delivered,  // Teslim edildi
  cancelled,  // İptal
}

/// Parse order status from Firestore (handles legacy values)
OrderStatus _parseOrderStatus(dynamic status) {
  final statusStr = status?.toString() ?? 'pending';
  
  // Map legacy/alternative status values
  switch (statusStr) {
    case 'completed':
    case 'picked_up':
      return OrderStatus.delivered;
    case 'out_for_delivery':
      return OrderStatus.onTheWay;
    case 'confirmed':
      return OrderStatus.accepted;
    case 'ready_for_pickup':
    case 'ready_for_delivery':
      return OrderStatus.ready;
    case 'pending_payment':
      return OrderStatus.pending;
    case 'refunded':
      return OrderStatus.cancelled;
    default:
      return OrderStatus.values.firstWhere(
        (e) => e.name == statusStr,
        orElse: () => OrderStatus.pending,
      );
  }
}

/// Order type enum
enum OrderType {
  delivery,   // Teslimat
  pickup,     // Gel Al
  dineIn,     // Masa (Yerinde)
}

/// Order model for LOKMA
class LokmaOrder {
  final String id;
  final String? orderNumber; // User-facing number (6-char, e.g., 8SV396)
  final String butcherId;
  final String butcherName;
  final String userId;
  final String userName;
  final String userPhone;
  final List<OrderItem> items;
  final double totalAmount;
  final OrderType orderType;
  final OrderStatus status;
  final String? deliveryAddress;
  final DateTime? scheduledTime;
  final String? notes;
  final String? courierId;
  final String? courierName;
  final String? courierPhone;
  final Map<String, double>? courierLocation; // {lat, lng}
  final DateTime? claimedAt;
  final int? etaMinutes;
  final DateTime? lastLocationUpdate;
  final Map<String, double>? claimLocation; // Business pickup location {lat, lng}
  final String? paymentMethod; // 'cash', 'card', 'online'
  final String paymentStatus; // 'unpaid', 'paid'
  final DateTime? deliveredAt;
  final Map<String, dynamic>? deliveryProof; // {type, gps, photoUrl, completedAt}
  final List<Map<String, dynamic>> unavailableItems; // [{positionNumber, productName, quantity}]
  final DateTime createdAt;
  final DateTime updatedAt;

  LokmaOrder({
    required this.id,
    this.orderNumber,
    required this.butcherId,
    required this.butcherName,
    required this.userId,
    required this.userName,
    required this.userPhone,
    required this.items,
    required this.totalAmount,
    required this.orderType,
    required this.status,
    this.deliveryAddress,
    this.scheduledTime,
    this.notes,
    this.courierId,
    this.courierName,
    this.courierPhone,
    this.courierLocation,
    this.claimedAt,
    this.etaMinutes,
    this.lastLocationUpdate,
    this.claimLocation,
    this.paymentMethod,
    this.paymentStatus = 'unpaid',
    this.deliveredAt,
    this.deliveryProof,
    this.unavailableItems = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory LokmaOrder.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    
    // Parse courier location
    Map<String, double>? courierLoc;
    if (data['courierLocation'] != null) {
      final loc = data['courierLocation'] as Map<String, dynamic>;
      courierLoc = {
        'lat': (loc['lat'] ?? 0).toDouble(),
        'lng': (loc['lng'] ?? 0).toDouble(),
      };
    }
    
    return LokmaOrder(
      id: doc.id,
      orderNumber: data['orderNumber']?.toString(),
      butcherId: data['butcherId'] ?? '',
      butcherName: data['butcherName'] ?? '',
      userId: data['userId'] ?? '',
      userName: data['userName'] ?? '',
      userPhone: data['userPhone'] ?? '',
      items: (data['items'] as List<dynamic>?)
          ?.map((i) => OrderItem.fromMap(i))
          .toList() ?? [],
      totalAmount: (data['totalAmount'] ?? 0).toDouble(),
      orderType: OrderType.values.firstWhere(
        (e) => e.name == (data['orderType'] ?? data['deliveryMethod']),
        orElse: () => OrderType.pickup,
      ),
      status: _parseOrderStatus(data['status']),
      deliveryAddress: data['deliveryAddress'],
      scheduledTime: (data['scheduledTime'] as Timestamp?)?.toDate(),
      notes: data['notes'] ?? data['orderNote'],
      courierId: data['courierId'],
      courierName: data['courierName'],
      courierPhone: data['courierPhone'],
      courierLocation: courierLoc,
      claimedAt: (data['claimedAt'] as Timestamp?)?.toDate(),
      etaMinutes: data['etaMinutes'],
      lastLocationUpdate: (data['lastLocationUpdate'] as Timestamp?)?.toDate(),
      claimLocation: data['claimLocation'] != null
          ? {
              'lat': (data['claimLocation']['lat'] ?? 0).toDouble(),
              'lng': (data['claimLocation']['lng'] ?? 0).toDouble(),
            }
          : null,
      paymentMethod: data['paymentMethod'],
      paymentStatus: data['paymentStatus'] ?? 'unpaid',
      deliveredAt: (data['deliveredAt'] as Timestamp?)?.toDate(),
      deliveryProof: data['deliveryProof'] as Map<String, dynamic>?,
      unavailableItems: (data['unavailableItems'] as List<dynamic>?)
          ?.map((e) => Map<String, dynamic>.from(e as Map))
          .toList() ?? [],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}

class OrderItem {
  final String sku;
  final String name;
  final double price;
  final double quantity;
  final String unit;
  final int? positionNumber;
  final String? itemNote;
  final String? imageUrl;
  final List<Map<String, dynamic>> selectedOptions;

  OrderItem({
    required this.sku,
    required this.name,
    required this.price,
    required this.quantity,
    required this.unit,
    this.positionNumber,
    this.itemNote,
    this.imageUrl,
    this.selectedOptions = const [],
  });

  Map<String, dynamic> toMap() => {
    'sku': sku,
    'name': name,
    'price': price,
    'quantity': quantity,
    'unit': unit,
    if (positionNumber != null) 'positionNumber': positionNumber,
    if (itemNote != null) 'itemNote': itemNote,
  };

  factory OrderItem.fromMap(Map<String, dynamic> map) => OrderItem(
    sku: map['sku'] ?? map['productId'] ?? '',
    name: map['name'] ?? map['productName'] ?? '',
    price: (map['price'] ?? map['unitPrice'] ?? 0).toDouble(),
    quantity: (map['quantity'] ?? 0).toDouble(),
    unit: map['unit'] ?? 'kg',
    positionNumber: map['positionNumber'] as int?,
    itemNote: map['itemNote'] as String?,
    imageUrl: map['imageUrl'] as String?,
    selectedOptions: (map['selectedOptions'] as List<dynamic>?)
        ?.map((e) => Map<String, dynamic>.from(e as Map))
        .toList() ?? [],
  );

  factory OrderItem.fromCartItem(CartItem cartItem) => OrderItem(
    sku: cartItem.product.sku,
    name: cartItem.product.name,
    price: cartItem.product.price,
    quantity: cartItem.quantity,
    unit: cartItem.product.unitType,
  );
}

/// Order Service for LOKMA
class OrderService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  // Use meat_orders as the canonical collection (matches Admin Panel)
  static const String _collection = 'meat_orders';

  /// Create a new order from cart
  Future<String> createOrder({
    required String butcherId,
    required String butcherName,
    required String userId,
    required String userName,
    required String userPhone,
    required List<CartItem> cartItems,
    required double totalAmount,
    required OrderType orderType,
    String? deliveryAddress,
    DateTime? scheduledTime,
    String? notes,
  }) async {
    final orderItems = cartItems.map((item) => OrderItem.fromCartItem(item).toMap()).toList();

    // UOIP: Pre-generate doc ID so orderNumber is included in initial write
    // This eliminates the race condition where Cloud Functions fire before orderNumber is set
    final docRef = _db.collection(_collection).doc();
    final orderNumber = docRef.id.substring(0, 6).toUpperCase();

    await docRef.set({
      'butcherId': butcherId,
      'butcherName': butcherName,
      'userId': userId,
      'userName': userName,
      'userPhone': userPhone,
      'items': orderItems,
      'totalAmount': totalAmount,
      'orderType': orderType.name,
      'status': OrderStatus.pending.name,
      'deliveryAddress': deliveryAddress,
      'scheduledTime': scheduledTime != null ? Timestamp.fromDate(scheduledTime) : null,
      'notes': notes,
      'orderNumber': orderNumber,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    return docRef.id;
  }

  /// Create a dine-in order from waiter
  /// Tags order with table number, session, and waiter info
  Future<String> createDineInOrder({
    required String butcherId,
    required String butcherName,
    required String waiterId,
    required String waiterName,
    required int tableNumber,
    required String tableSessionId,
    required List<OrderItem> items,
    required double totalAmount,
    String? notes,
  }) async {
    final docRef = _db.collection(_collection).doc();
    final orderNumber = docRef.id.substring(0, 6).toUpperCase();

    await docRef.set({
      'butcherId': butcherId,
      'butcherName': butcherName,
      'userId': waiterId, // Waiter places the order
      'userName': waiterName,
      'userPhone': '',
      'items': items.map((item) => item.toMap()).toList(),
      'totalAmount': totalAmount,
      'orderType': OrderType.dineIn.name,
      'status': OrderStatus.pending.name,
      'tableNumber': tableNumber,
      'tableSessionId': tableSessionId,
      'waiterId': waiterId,
      'waiterName': waiterName,
      'paymentStatus': 'unpaid',
      'paymentMethod': null,
      'notes': notes,
      'orderNumber': orderNumber,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    return docRef.id;
  }

  /// Get all orders for a table session (realtime)
  Stream<List<LokmaOrder>> getTableSessionOrdersStream(String sessionId) {
    return _db
        .collection(_collection)
        .where('tableSessionId', isEqualTo: sessionId)
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => LokmaOrder.fromFirestore(doc))
            .toList())
        .handleError((e) {
          print('Error fetching table session orders: $e');
          return <LokmaOrder>[];
        });
  }

  /// Update payment status for dine-in order
  Future<void> updatePaymentStatus({
    required String orderId,
    required String paymentStatus,
    String? paymentMethod,
  }) async {
    await _db.collection(_collection).doc(orderId).update({
      'paymentStatus': paymentStatus,
      if (paymentMethod != null) 'paymentMethod': paymentMethod,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Get user's orders stream (from meat_orders - canonical collection)
  Stream<List<LokmaOrder>> getUserOrdersStream(String userId) {
    return _db
        .collection(_collection)
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => LokmaOrder.fromFirestore(doc))
            .toList())
        .handleError((e) {
          print('Error fetching orders: $e');
          return <LokmaOrder>[];
        });
  }

  /// Get single order
  Future<LokmaOrder?> getOrder(String orderId) async {
    final doc = await _db.collection(_collection).doc(orderId).get();
    if (!doc.exists) return null;
    return LokmaOrder.fromFirestore(doc);
  }

  /// Cancel order (user can only cancel pending orders)
  Future<bool> cancelOrder(String orderId) async {
    final doc = await _db.collection(_collection).doc(orderId).get();
    if (!doc.exists) return false;
    
    final data = doc.data() as Map<String, dynamic>;
    if (data['status'] != OrderStatus.pending.name) {
      return false; // Can only cancel pending orders
    }

    await _db.collection(_collection).doc(orderId).update({
      'status': OrderStatus.cancelled.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Get ready deliveries for a business (staff view)
  /// Shows ready, preparing, and pending delivery orders - ready first
  /// NOTE: Uses client-side filtering because Firestore doesn't support whereIn + where combo
  Stream<List<LokmaOrder>> getReadyDeliveriesStream(String businessId) {
    return _db
        .collection(_collection)
        .where('butcherId', isEqualTo: businessId)
        .snapshots()
        .map((snapshot) {
          // Show all delivery orders: pending, preparing, ready
          final validStatuses = ['ready', 'preparing', 'pending'];
          
          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data();
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';
                final courierId = data['courierId'];
                
                // Filter: valid status + delivery method + unclaimed
                final isValidStatus = validStatuses.contains(status);
                final isDelivery = deliveryMethod == 'delivery';
                final isUnclaimed = courierId == null || courierId.toString().isEmpty;
                
                return isValidStatus && isDelivery && isUnclaimed;
              })
              .map((doc) => LokmaOrder.fromFirestore(doc))
              .toList();
          
          // Sort: ready first, then preparing, then pending
          orders.sort((a, b) {
            const priority = {'ready': 0, 'preparing': 1, 'pending': 2};
            final aPriority = priority[a.status.name] ?? 3;
            final bPriority = priority[b.status.name] ?? 3;
            return aPriority.compareTo(bPriority);
          });
          
          return orders;
        });
  }

  /// Claim a delivery (staff takes responsibility)
  /// Industry standard: Allows claiming pending/preparing orders early
  /// Status only changes to 'onTheWay' when order is ready
  Future<bool> claimDelivery({
    required String orderId,
    required String courierId,
    required String courierName,
    required String courierPhone,
  }) async {
    final doc = await _db.collection(_collection).doc(orderId).get();
    if (!doc.exists) return false;
    
    final data = doc.data() as Map<String, dynamic>;
    final currentStatus = data['status'] as String?;
    
    // Can only claim if not already claimed by someone else
    if (data['courierId'] != null) {
      return false;
    }

    // Capture GPS at claim time for km tracking
    Map<String, dynamic>? claimLocation;
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      claimLocation = {
        'lat': position.latitude,
        'lng': position.longitude,
        'timestamp': DateTime.now().toIso8601String(),
      };
    } catch (e) {
      // Fallback to last known
      try {
        final lastPos = await Geolocator.getLastKnownPosition();
        if (lastPos != null) {
          claimLocation = {
            'lat': lastPos.latitude,
            'lng': lastPos.longitude,
            'isApproximate': true,
            'timestamp': DateTime.now().toIso8601String(),
          };
        }
      } catch (_) {}
    }
    
    // Build update data - always assign courier
    final updateData = <String, dynamic>{
      'courierId': courierId,
      'courierName': courierName,
      'courierPhone': courierPhone,
      'claimedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (claimLocation != null) {
      updateData['claimLocation'] = claimLocation;
    }
    
    // Only change status to onTheWay if order is already ready
    if (currentStatus == OrderStatus.ready.name) {
      updateData['status'] = OrderStatus.onTheWay.name;
    }

    await _db.collection(_collection).doc(orderId).update(updateData);
    return true;
  }

  /// Update courier location (called every 3 minutes during delivery)
  Future<void> updateCourierLocation({
    required String orderId,
    required double lat,
    required double lng,
    int? etaMinutes,
  }) async {
    await _db.collection(_collection).doc(orderId).update({
      'courierLocation': {'lat': lat, 'lng': lng},
      'lastLocationUpdate': FieldValue.serverTimestamp(),
      if (etaMinutes != null) 'etaMinutes': etaMinutes,
    });
  }

  /// Start delivery - changes status from 'ready' to 'onTheWay'
  /// Called when driver picks up the order and heads to customer
  Future<bool> startDelivery(String orderId) async {
    await _db.collection(_collection).doc(orderId).update({
      'status': OrderStatus.onTheWay.name,
      'startedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Complete delivery
  Future<bool> completeDelivery(String orderId) async {
    await _db.collection(_collection).doc(orderId).update({
      'status': OrderStatus.delivered.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Complete delivery with proof of delivery (POD)
  /// Logs: delivery type, timestamp, GPS coordinates, distance km, and optional photo
  Future<bool> completeDeliveryWithProof(
    String orderId, {
    required String deliveryType,
    String? proofPhotoUrl,
  }) async {
    // Fetch order to get claimLocation for km calculation
    final orderDoc = await _db.collection(_collection).doc(orderId).get();
    final orderData = orderDoc.data() as Map<String, dynamic>?;
    final claimLocation = orderData?['claimLocation'] as Map<String, dynamic>?;

    // Get current GPS location with fallback to last known position
    Map<String, dynamic>? gpsData;
    double? deliveryLat;
    double? deliveryLng;
    
    try {
      // Try to get current live position first
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      deliveryLat = position.latitude;
      deliveryLng = position.longitude;
      gpsData = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'isLive': true,
        'timestamp': position.timestamp.toIso8601String(),
      };
    } catch (e) {
      debugPrint('Live GPS failed, trying last known position: $e');
      
      // Fallback: Get last known position (cached)
      try {
        final lastPosition = await Geolocator.getLastKnownPosition();
        if (lastPosition != null) {
          deliveryLat = lastPosition.latitude;
          deliveryLng = lastPosition.longitude;
          gpsData = {
            'latitude': lastPosition.latitude,
            'longitude': lastPosition.longitude,
            'accuracy': lastPosition.accuracy,
            'isLive': false,
            'isApproximate': true,
            'timestamp': lastPosition.timestamp.toIso8601String(),
            'note': 'Son bilinen konum (tahmini)',
          };
        }
      } catch (fallbackError) {
        debugPrint('Last known position also failed: $fallbackError');
      }
    }

    // Calculate distance from claim location to delivery location
    double? distanceKm;
    if (claimLocation != null && deliveryLat != null && deliveryLng != null) {
      final claimLat = (claimLocation['lat'] as num?)?.toDouble();
      final claimLng = (claimLocation['lng'] as num?)?.toDouble();
      if (claimLat != null && claimLng != null) {
        distanceKm = _calculateHaversineDistance(
          claimLat, claimLng, 
          deliveryLat, deliveryLng
        );
      }
    }
    
    final deliveryProof = <String, dynamic>{
      'type': deliveryType, // personal_handoff, handed_to_other, left_at_door
      'completedAt': FieldValue.serverTimestamp(),
      'localTimestamp': DateTime.now().toIso8601String(),
    };
    
    if (gpsData != null) {
      deliveryProof['gps'] = gpsData;
    }
    
    if (distanceKm != null) {
      deliveryProof['distanceKm'] = double.parse(distanceKm.toStringAsFixed(2));
    }
    
    if (proofPhotoUrl != null) {
      deliveryProof['photoUrl'] = proofPhotoUrl;
    }
    
    await _db.collection(_collection).doc(orderId).update({
      'status': OrderStatus.delivered.name,
      'deliveryProof': deliveryProof,
      'deliveredAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    
    return true;
  }

  /// Calculate distance between two GPS points using Haversine formula
  double _calculateHaversineDistance(
    double lat1, double lng1, 
    double lat2, double lng2
  ) {
    const R = 6371.0; // Earth's radius in km
    final dLat = _toRadians(lat2 - lat1);
    final dLng = _toRadians(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) *
        sin(dLng / 2) * sin(dLng / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  double _toRadians(double degrees) => degrees * pi / 180;

  /// Cancel delivery claim - releases order back to pool
  /// Called when driver cancels and hands the order back
  Future<bool> cancelClaim(String orderId, {String? reason}) async {
    await _db.collection(_collection).doc(orderId).update({
      'courierId': FieldValue.delete(),
      'courierName': FieldValue.delete(),
      'courierPhone': FieldValue.delete(),
      'courierLocation': FieldValue.delete(),
      'claimedAt': FieldValue.delete(),
      'startedAt': FieldValue.delete(),
      'etaMinutes': FieldValue.delete(),
      'status': OrderStatus.ready.name, // Go back to ready pool
      'updatedAt': FieldValue.serverTimestamp(),
      if (reason != null) 'lastCancellationReason': reason,
      if (reason != null) 'lastCancellationAt': FieldValue.serverTimestamp(),
    });
    return true;
  }

  /// Get order stream for live tracking
  Stream<LokmaOrder?> getOrderStream(String orderId) {
    return _db
        .collection(_collection)
        .doc(orderId)
        .snapshots()
        .map((doc) => doc.exists ? LokmaOrder.fromFirestore(doc) : null);
  }

  /// Get courier's active (claimed but not delivered) delivery
  /// Returns the order if courier has an active delivery, null otherwise
  Stream<LokmaOrder?> getMyActiveDeliveryStream(String courierId) {
    // Active statuses: order is claimed and being delivered
    final activeStatuses = ['ready', 'preparing', 'pending', 'onTheWay', 'accepted'];
    
    return _db
        .collection(_collection)
        .where('courierId', isEqualTo: courierId)
        .snapshots()
        .map((snapshot) {
          final activeDocs = snapshot.docs.where((doc) {
            final data = doc.data();
            final status = data['status']?.toString() ?? '';
            final deliveryMethod = data['deliveryMethod']?.toString() ?? 
                                   data['orderType']?.toString() ?? '';
            
            // Must be a delivery order with active status
            return activeStatuses.contains(status) && deliveryMethod == 'delivery';
          }).toList();
          
          if (activeDocs.isEmpty) return null;
          
          // Return most recently claimed order
          activeDocs.sort((a, b) {
            final aTime = a.data()['claimedAt'] as Timestamp?;
            final bTime = b.data()['claimedAt'] as Timestamp?;
            if (aTime == null) return 1;
            if (bTime == null) return -1;
            return bTime.compareTo(aTime);
          });
          
          return LokmaOrder.fromFirestore(activeDocs.first);
        });
  }

  /// Get ALL of courier's active (claimed but not delivered) deliveries
  /// Returns list of orders for multi-order handling
  Stream<List<LokmaOrder>> getMyActiveDeliveriesStream(String courierId) {
    final activeStatuses = ['ready', 'preparing', 'pending', 'onTheWay', 'accepted'];
    
    return _db
        .collection(_collection)
        .where('courierId', isEqualTo: courierId)
        .snapshots()
        .map((snapshot) {
          final activeDocs = snapshot.docs.where((doc) {
            final data = doc.data();
            final status = data['status']?.toString() ?? '';
            final deliveryMethod = data['deliveryMethod']?.toString() ?? 
                                   data['orderType']?.toString() ?? '';
            
            return activeStatuses.contains(status) && deliveryMethod == 'delivery';
          }).toList();
          
          // Sort by claimedAt, most recent first
          activeDocs.sort((a, b) {
            final aTime = a.data()['claimedAt'] as Timestamp?;
            final bTime = b.data()['claimedAt'] as Timestamp?;
            if (aTime == null) return 1;
            if (bTime == null) return -1;
            return bTime.compareTo(aTime);
          });
          
          return activeDocs.map((doc) => LokmaOrder.fromFirestore(doc)).toList();
        });
  }
  /// Get ready deliveries for a DRIVER assigned to multiple businesses
  /// Shows ready, preparing, and pending delivery orders - ready first
  /// INCLUDES driver's own claimed orders at the top
  /// NOTE: Uses client-side filtering because Firestore doesn't support multiple whereIn
  Stream<List<LokmaOrder>> getDriverDeliveriesStream(List<String> businessIds, {String? courierId}) {
    if (businessIds.isEmpty) {
      return Stream.value([]);
    }

    // Query all delivery orders, filter client-side for business + status
    return _db
        .collection(_collection)
        .snapshots()
        .map((snapshot) {
          final validStatuses = ['ready', 'preparing', 'pending', 'onTheWay', 'accepted'];
          
          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data();
                final butcherId = data['butcherId']?.toString() ?? '';
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';
                final orderCourierId = data['courierId']?.toString() ?? '';
                
                final isAssignedBusiness = businessIds.contains(butcherId);
                final isValidStatus = validStatuses.contains(status);
                final isDelivery = deliveryMethod == 'delivery';
                final isUnclaimed = orderCourierId.isEmpty;
                final isClaimedByMe = courierId != null && orderCourierId == courierId;
                
                // Include: unclaimed orders from assigned businesses OR orders claimed by this driver
                return isValidStatus && isDelivery && (
                  (isAssignedBusiness && isUnclaimed) || isClaimedByMe
                );
              })
              .map((doc) => LokmaOrder.fromFirestore(doc))
              .toList();
          
          // Sort: claimed by me first, then ready, preparing, pending
          orders.sort((a, b) {
            // My claimed orders first
            final aIsMyOrder = courierId != null && a.courierId == courierId;
            final bIsMyOrder = courierId != null && b.courierId == courierId;
            if (aIsMyOrder && !bIsMyOrder) return -1;
            if (!aIsMyOrder && bIsMyOrder) return 1;
            
            // Then by status priority
            const priority = {'onTheWay': 0, 'accepted': 0, 'ready': 1, 'preparing': 2, 'pending': 3};
            final aPriority = priority[a.status.name] ?? 4;
            final bPriority = priority[b.status.name] ?? 4;
            return aPriority.compareTo(bPriority);
          });
          
          return orders;
        });
  }


  /// Get ALL orders from assigned businesses for driver planning view
  /// Shows every order regardless of claim status (pending, preparing, ready, onTheWay)
  /// Used for "Tüm Siparişler" secondary view so drivers can plan ahead
  Stream<List<LokmaOrder>> getAllBusinessOrdersStream(List<String> businessIds) {
    if (businessIds.isEmpty) {
      return Stream.value([]);
    }

    return _db
        .collection(_collection)
        .snapshots()
        .map((snapshot) {
          final validStatuses = ['pending', 'preparing', 'ready', 'accepted', 'onTheWay'];

          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data();
                final butcherId = data['butcherId']?.toString() ?? '';
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';

                return businessIds.contains(butcherId) &&
                       validStatuses.contains(status) &&
                       deliveryMethod == 'delivery';
              })
              .map((doc) => LokmaOrder.fromFirestore(doc))
              .toList();

          // Sort by status priority: pending → preparing → ready → onTheWay
          orders.sort((a, b) {
            const priority = {'pending': 0, 'preparing': 1, 'ready': 2, 'accepted': 3, 'onTheWay': 4};
            final aPriority = priority[a.status.name] ?? 5;
            final bPriority = priority[b.status.name] ?? 5;
            return aPriority.compareTo(bPriority);
          });

          return orders;
        });
  }

  /// Get courier's completed deliveries for today (or within last 3 hours after midnight)
  /// Used for end-of-day cash reconciliation and delivery tracking
  /// Returns orders with privacy-compliant data only
  Stream<List<LokmaOrder>> getMyCompletedDeliveriesToday(String courierId) {
    // Calculate visibility window: today's orders + orders completed within last 3 hours
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final visibilityStart = now.subtract(const Duration(hours: 3));
    
    // Use the earlier of today's start or 3 hours ago
    final cutoffTime = todayStart.isBefore(visibilityStart) ? visibilityStart : todayStart;
    
    // Simple query - just by courierId, filter locally for status and date
    // This avoids needing a composite index
    return _db
        .collection(_collection)
        .where('courierId', isEqualTo: courierId)
        .snapshots()
        .map((snapshot) {
          print('DEBUG: Got ${snapshot.docs.length} orders for courier $courierId');
          return snapshot.docs
              .map((doc) => LokmaOrder.fromFirestore(doc))
              .where((order) {
                // Filter for delivered status (check both enum value and string)
                final statusStr = order.status.toString().split('.').last;
                if (statusStr != 'delivered') return false;
                
                // Filter by visibility window
                if (order.deliveredAt == null) return false;
                return order.deliveredAt!.isAfter(cutoffTime);
              })
              .toList()
            ..sort((a, b) => (b.deliveredAt ?? DateTime.now()).compareTo(a.deliveredAt ?? DateTime.now()));
        });
  }
}

