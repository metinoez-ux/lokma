import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/butcher_product.dart';

/// Firestore service for LOKMA app
/// Handles all Firestore CRUD operations for butchers, products, and orders
class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // ============ BUTCHERS ============

  /// Get all butchers stream (uses businesses with kasap category)
  Stream<QuerySnapshot> getButchersStream() {
    return _db
        .collection('businesses')
        .where('isActive', isEqualTo: true)
        .where('businessCategories', arrayContains: 'kasap')
        .snapshots();
  }

  /// Get businesses by sector category (yemek or market)
  /// Uses 'sectors' collection to determine which types belong to which sector
  /// Then queries businesses by their 'type' field
  Stream<QuerySnapshot> getBusinessesByCategory(String category) {
    // IMPORTANT: 'category' here is the sector name like 'market', 'kasap', 'restoran'
    // But it might also be the sector category like 'yemek' or 'market'
    // For backwards compatibility, we need to handle both cases
    
    // If category is a sector category (yemek/market), we need to expand it
    // But Firestore doesn't support this directly, so client-side filtering is needed
    // For now, return all active businesses and let the screen filter
    return _db
        .collection('businesses')
        .where('isActive', isEqualTo: true)
        .snapshots();
  }
  
  /// Get businesses by their type (restoran, kasap, market, etc.)
  Stream<QuerySnapshot> getBusinessesByType(String type) {
    return _db
        .collection('businesses')
        .where('isActive', isEqualTo: true)
        .where('type', isEqualTo: type)
        .snapshots();
  }
  
  /// Get businesses by types array (when business has multiple types)
  Stream<QuerySnapshot> getBusinessesByTypes(List<String> types) {
    return _db
        .collection('businesses')
        .where('isActive', isEqualTo: true)
        .where('type', whereIn: types)
        .snapshots();
  }

  /// Get all active businesses from businesses
  Stream<QuerySnapshot> getAllBusinessesStream() {
    return _db
        .collection('businesses')
        .where('isActive', isEqualTo: true)
        .snapshots();
  }

  /// Get single butcher by ID
  Future<DocumentSnapshot> getButcher(String butcherId) {
    return _db.collection('businesses').doc(butcherId).get();
  }

  /// Get butchers near location
  Stream<QuerySnapshot> getButchersNearLocation({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
  }) {
    // Note: For proper geo queries, use geoflutterfire2 package
    // For now, return all active butchers
    return getButchersStream();
  }

  // ============ PRODUCTS ============

  /// Get products for a butcher
  Stream<QuerySnapshot> getButcherProducts(String butcherId) {
    return _db
        .collection('businesses')
        .doc(butcherId)
        .collection('products')
        .where('isActive', isEqualTo: true)
        .orderBy('name')
        .snapshots();
  }

  /// Get single product
  Future<DocumentSnapshot> getProduct(String butcherId, String productId) {
    return _db
        .collection('businesses')
        .doc(butcherId)
        .collection('products')
        .doc(productId)
        .get();
  }

  // ============ ORDERS ============

  /// Create a new order (uses meat_orders - canonical collection)
  Future<DocumentReference> createOrder({
    required String butcherId,
    required String butcherName,
    required String userId,
    required String userName,
    required String userPhone,
    required List<Map<String, dynamic>> items,
    required double totalAmount,
    required String orderType, // 'delivery', 'pickup', 'dine_in'
    String? deliveryAddress,
    DateTime? scheduledTime,
    String? notes,
  }) async {
    return _db.collection('meat_orders').add({
      'butcherId': butcherId,
      'butcherName': butcherName,
      'userId': userId,
      'userName': userName,
      'userPhone': userPhone,
      'items': items,
      'totalAmount': totalAmount,
      'orderType': orderType,
      'deliveryAddress': deliveryAddress,
      'scheduledTime': scheduledTime,
      'notes': notes,
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Get user's order history
  Stream<QuerySnapshot> getUserOrders(String userId) {
    return _db
        .collection('meat_orders')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots();
  }

  /// Get single order
  Future<DocumentSnapshot> getOrder(String orderId) {
    return _db.collection('meat_orders').doc(orderId).get();
  }

  /// Update order status
  Future<void> updateOrderStatus(String orderId, String status) {
    return _db.collection('meat_orders').doc(orderId).update({
      'status': status,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  // ============ USER PROFILE ============

  /// Create or update user profile
  Future<void> saveUserProfile({
    required String uid,
    required String? email,
    required String? displayName,
    String? phoneNumber,
    String? photoUrl,
  }) async {
    await _db.collection('users').doc(uid).set({
      'email': email,
      'displayName': displayName,
      'phoneNumber': phoneNumber,
      'photoUrl': photoUrl,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Get user profile
  Future<DocumentSnapshot> getUserProfile(String uid) {
    return _db.collection('users').doc(uid).get();
  }

  /// Update user address
  Future<void> updateUserAddress(String uid, Map<String, dynamic> address) {
    return _db.collection('users').doc(uid).update({
      'defaultAddress': address,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }
}
