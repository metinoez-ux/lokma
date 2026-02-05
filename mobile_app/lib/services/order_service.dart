import 'package:cloud_firestore/cloud_firestore.dart';
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
  final String? paymentMethod; // 'cash', 'card', 'online'
  final DateTime createdAt;
  final DateTime updatedAt;

  LokmaOrder({
    required this.id,
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
    this.paymentMethod,
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
        (e) => e.name == data['orderType'],
        orElse: () => OrderType.pickup,
      ),
      status: _parseOrderStatus(data['status']),
      deliveryAddress: data['deliveryAddress'],
      scheduledTime: (data['scheduledTime'] as Timestamp?)?.toDate(),
      notes: data['notes'],
      courierId: data['courierId'],
      courierName: data['courierName'],
      courierPhone: data['courierPhone'],
      courierLocation: courierLoc,
      claimedAt: (data['claimedAt'] as Timestamp?)?.toDate(),
      etaMinutes: data['etaMinutes'],
      lastLocationUpdate: (data['lastLocationUpdate'] as Timestamp?)?.toDate(),
      paymentMethod: data['paymentMethod'],
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

  OrderItem({
    required this.sku,
    required this.name,
    required this.price,
    required this.quantity,
    required this.unit,
  });

  Map<String, dynamic> toMap() => {
    'sku': sku,
    'name': name,
    'price': price,
    'quantity': quantity,
    'unit': unit,
  };

  factory OrderItem.fromMap(Map<String, dynamic> map) => OrderItem(
    sku: map['sku'] ?? '',
    name: map['name'] ?? '',
    price: (map['price'] ?? 0).toDouble(),
    quantity: (map['quantity'] ?? 0).toDouble(),
    unit: map['unit'] ?? 'kg',
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

    final docRef = await _db.collection(_collection).add({
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
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    return docRef.id;
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
    
    // Build update data - always assign courier
    final updateData = <String, dynamic>{
      'courierId': courierId,
      'courierName': courierName,
      'courierPhone': courierPhone,
      'claimedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
    
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

  /// Cancel delivery claim - releases order back to pool
  /// Called when driver cancels and hands the order back
  Future<bool> cancelClaim(String orderId) async {
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

  /// Get ready deliveries for a DRIVER assigned to multiple businesses
  /// Shows ready, preparing, and pending delivery orders - ready first
  /// NOTE: Uses client-side filtering because Firestore doesn't support multiple whereIn
  Stream<List<LokmaOrder>> getDriverDeliveriesStream(List<String> businessIds) {
    if (businessIds.isEmpty) {
      return Stream.value([]);
    }

    // Query all delivery orders, filter client-side for business + status
    return _db
        .collection(_collection)
        .snapshots()
        .map((snapshot) {
          final validStatuses = ['ready', 'preparing', 'pending'];
          
          final orders = snapshot.docs
              .where((doc) {
                final data = doc.data();
                final butcherId = data['butcherId']?.toString() ?? '';
                final status = data['status']?.toString() ?? '';
                final deliveryMethod = data['deliveryMethod']?.toString() ?? data['orderType']?.toString() ?? '';
                final courierId = data['courierId'];
                
                // Filter: assigned business + valid status + delivery + unclaimed
                final isAssignedBusiness = businessIds.contains(butcherId);
                final isValidStatus = validStatuses.contains(status);
                final isDelivery = deliveryMethod == 'delivery';
                final isUnclaimed = courierId == null || courierId.toString().isEmpty;
                
                return isAssignedBusiness && isValidStatus && isDelivery && isUnclaimed;
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
}

