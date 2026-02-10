import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Model for a table session
class TableSession {
  final String id;
  final String businessId;
  final int tableNumber;
  final String pin;
  final String status; // 'active' or 'closed'
  final String waiterId;
  final String waiterName;
  final String? linkedCustomerId;
  final DateTime createdAt;
  final DateTime? closedAt;

  TableSession({
    required this.id,
    required this.businessId,
    required this.tableNumber,
    required this.pin,
    required this.status,
    required this.waiterId,
    required this.waiterName,
    this.linkedCustomerId,
    required this.createdAt,
    this.closedAt,
  });

  bool get isActive => status == 'active';

  factory TableSession.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TableSession(
      id: doc.id,
      businessId: data['businessId'] ?? '',
      tableNumber: data['tableNumber'] ?? 0,
      pin: data['pin'] ?? '',
      status: data['status'] ?? 'active',
      waiterId: data['waiterId'] ?? '',
      waiterName: data['waiterName'] ?? '',
      linkedCustomerId: data['linkedCustomerId'],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      closedAt: (data['closedAt'] as Timestamp?)?.toDate(),
    );
  }
}

/// Service for managing table sessions (Masa Oturumları)
/// Each session creates a unique 4-digit PIN for customer access
class TableSessionService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Generate a random 4-digit PIN
  String _generatePin() {
    final random = Random();
    return (1000 + random.nextInt(9000)).toString(); // 1000-9999
  }

  /// Create a new table session for a waiter
  /// Returns the created session with its PIN
  Future<TableSession> createSession({
    required String businessId,
    required int tableNumber,
    required String waiterId,
    required String waiterName,
  }) async {
    // Close any existing active session for this table
    final existing = await getActiveSession(businessId, tableNumber);
    if (existing != null) {
      await closeSession(existing.id, businessId);
    }

    final pin = _generatePin();
    final docRef = _db
        .collection('businesses')
        .doc(businessId)
        .collection('table_sessions')
        .doc();

    await docRef.set({
      'businessId': businessId,
      'tableNumber': tableNumber,
      'pin': pin,
      'status': 'active',
      'waiterId': waiterId,
      'waiterName': waiterName,
      'linkedCustomerId': null,
      'createdAt': FieldValue.serverTimestamp(),
    });

    return TableSession(
      id: docRef.id,
      businessId: businessId,
      tableNumber: tableNumber,
      pin: pin,
      status: 'active',
      waiterId: waiterId,
      waiterName: waiterName,
      createdAt: DateTime.now(),
    );
  }

  /// Get active session for a specific table
  Future<TableSession?> getActiveSession(String businessId, int tableNumber) async {
    final query = await _db
        .collection('businesses')
        .doc(businessId)
        .collection('table_sessions')
        .where('tableNumber', isEqualTo: tableNumber)
        .where('status', isEqualTo: 'active')
        .limit(1)
        .get();

    if (query.docs.isEmpty) return null;
    return TableSession.fromFirestore(query.docs.first);
  }

  /// Close a table session
  Future<void> closeSession(String sessionId, String businessId) async {
    await _db
        .collection('businesses')
        .doc(businessId)
        .collection('table_sessions')
        .doc(sessionId)
        .update({
      'status': 'closed',
      'closedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Validate PIN for customer access
  /// Returns the session if PIN matches, null otherwise
  Future<TableSession?> validatePin({
    required String businessId,
    required int tableNumber,
    required String pin,
  }) async {
    final session = await getActiveSession(businessId, tableNumber);
    if (session == null) return null;
    if (session.pin != pin) return null;
    return session;
  }

  /// Link a customer to a session (after PIN validation)
  Future<void> linkCustomer({
    required String sessionId,
    required String businessId,
    required String customerId,
  }) async {
    await _db
        .collection('businesses')
        .doc(businessId)
        .collection('table_sessions')
        .doc(sessionId)
        .update({
      'linkedCustomerId': customerId,
    });
  }

  /// Get all orders for a table session (realtime stream)
  Stream<List<Map<String, dynamic>>> getSessionOrdersStream(String sessionId) {
    return _db
        .collection('meat_orders')
        .where('tableSessionId', isEqualTo: sessionId)
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) {
              final data = doc.data();
              data['id'] = doc.id;
              return data;
            }).toList());
  }

  /// Get session stream for realtime updates
  Stream<TableSession?> getSessionStream(String sessionId, String businessId) {
    return _db
        .collection('businesses')
        .doc(businessId)
        .collection('table_sessions')
        .doc(sessionId)
        .snapshots()
        .map((doc) => doc.exists ? TableSession.fromFirestore(doc) : null);
  }

  /// Get all active sessions for a business (waiter overview)
  Stream<List<TableSession>> getActiveSessionsStream(String businessId) {
    return _db
        .collection('businesses')
        .doc(businessId)
        .collection('table_sessions')
        .where('status', isEqualTo: 'active')
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map((doc) => TableSession.fromFirestore(doc)).toList());
  }
}
