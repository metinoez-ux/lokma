import 'package:cloud_firestore/cloud_firestore.dart';

/// Rating model for business and courier ratings
class Rating {
  final String id;
  final String orderId;
  final String businessId;
  final String? courierId;
  final String userId;
  final int businessRating; // 1-5
  final String? businessComment;
  final int? courierRating; // 1-5
  final String? courierComment;
  final DateTime createdAt;

  Rating({
    required this.id,
    required this.orderId,
    required this.businessId,
    this.courierId,
    required this.userId,
    required this.businessRating,
    this.businessComment,
    this.courierRating,
    this.courierComment,
    required this.createdAt,
  });

  factory Rating.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Rating(
      id: doc.id,
      orderId: data['orderId'] ?? '',
      businessId: data['businessId'] ?? '',
      courierId: data['courierId'],
      userId: data['userId'] ?? '',
      businessRating: data['businessRating'] ?? 0,
      businessComment: data['businessComment'],
      courierRating: data['courierRating'],
      courierComment: data['courierComment'],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
    'orderId': orderId,
    'businessId': businessId,
    'courierId': courierId,
    'userId': userId,
    'businessRating': businessRating,
    'businessComment': businessComment,
    'courierRating': courierRating,
    'courierComment': courierComment,
    'createdAt': FieldValue.serverTimestamp(),
  };
}

/// Rating Service for submitting and retrieving ratings
class RatingService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  static const String _collection = 'ratings';

  /// Submit a new rating for an order
  Future<String> submitRating({
    required String orderId,
    required String businessId,
    required String userId,
    required int businessRating,
    String? businessComment,
    String? courierId,
    int? courierRating,
    String? courierComment,
  }) async {
    // Create rating document
    final docRef = await _db.collection(_collection).add({
      'orderId': orderId,
      'businessId': businessId,
      'userId': userId,
      'businessRating': businessRating,
      'businessComment': businessComment,
      'courierId': courierId,
      'courierRating': courierRating,
      'courierComment': courierComment,
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Update business average rating
    await _updateBusinessRating(businessId);

    // Mark order as rated
    await _db.collection('lokma_orders').doc(orderId).update({
      'hasRating': true,
      'ratingId': docRef.id,
    });

    return docRef.id;
  }

  /// Check if order has already been rated
  Future<bool> hasRating(String orderId) async {
    final query = await _db
        .collection(_collection)
        .where('orderId', isEqualTo: orderId)
        .limit(1)
        .get();
    return query.docs.isNotEmpty;
  }

  /// Get rating for an order
  Future<Rating?> getRatingForOrder(String orderId) async {
    final query = await _db
        .collection(_collection)
        .where('orderId', isEqualTo: orderId)
        .limit(1)
        .get();
    if (query.docs.isEmpty) return null;
    return Rating.fromFirestore(query.docs.first);
  }

  /// Get all ratings for a business
  Stream<List<Rating>> getBusinessRatings(String businessId) {
    return _db
        .collection(_collection)
        .where('businessId', isEqualTo: businessId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => Rating.fromFirestore(doc)).toList());
  }

  /// Update business average rating after new rating
  Future<void> _updateBusinessRating(String businessId) async {
    final ratings = await _db
        .collection(_collection)
        .where('businessId', isEqualTo: businessId)
        .get();

    if (ratings.docs.isEmpty) return;

    double total = 0;
    for (final doc in ratings.docs) {
      total += (doc.data()['businessRating'] ?? 0) as int;
    }

    final average = total / ratings.docs.length;

    // Update business document
    await _db.collection('businesses').doc(businessId).update({
      'averageRating': double.parse(average.toStringAsFixed(1)),
      'totalRatings': ratings.docs.length,
    });
  }
}
