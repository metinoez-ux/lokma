import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/table_group_session_model.dart';

/// Service for managing table group ordering sessions
class TableGroupService {
  static final TableGroupService instance = TableGroupService._();
  TableGroupService._();

  final FirebaseFirestore _db = FirebaseFirestore.instance;
  static const String _collection = 'table_group_sessions';

  /// Create a new group session for a table
  Future<TableGroupSession> createSession({
    required String businessId,
    required String businessName,
    required String tableNumber,
    required String hostUserId,
    required String hostName,
  }) async {
    final participantId = const Uuid().v4();
    
    final participant = TableGroupParticipant(
      participantId: participantId,
      userId: hostUserId,
      name: hostName,
      isHost: true,
    );

    final docRef = _db.collection(_collection).doc();
    final session = TableGroupSession(
      id: docRef.id,
      businessId: businessId,
      businessName: businessName,
      tableNumber: tableNumber,
      status: GroupSessionStatus.active,
      hostUserId: hostUserId,
      hostName: hostName,
      participants: [participant],
      createdAt: DateTime.now(),
    );

    await docRef.set(session.toMap());
    debugPrint('📋 Created group session ${docRef.id} for table $tableNumber at $businessName');
    
    return session.copyWith();
  }

  /// Find an active session for a specific table at a business
  Future<TableGroupSession?> findActiveSession(String businessId, String tableNumber) async {
    final query = await _db
        .collection(_collection)
        .where('businessId', isEqualTo: businessId)
        .where('tableNumber', isEqualTo: tableNumber)
        .where('status', whereIn: ['active', 'ordering'])
        .limit(1)
        .get();

    if (query.docs.isEmpty) return null;
    return TableGroupSession.fromFirestore(query.docs.first);
  }

  /// Join an existing group session
  Future<String> joinSession({
    required String sessionId,
    required String userId,
    required String userName,
  }) async {
    final participantId = const Uuid().v4();
    
    final participant = TableGroupParticipant(
      participantId: participantId,
      userId: userId,
      name: userName,
      isHost: false,
    );

    final docRef = _db.collection(_collection).doc(sessionId);
    
    // Use transaction to safely add participant
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');
      
      final session = TableGroupSession.fromFirestore(snapshot);
      
      // Check if user already joined
      final alreadyJoined = session.participants.any((p) => p.userId == userId);
      if (alreadyJoined) {
        debugPrint('⚠️ User $userId already in session $sessionId');
        return;
      }

      final updatedParticipants = [...session.participants, participant];
      tx.update(docRef, {
        'participants': updatedParticipants.map((p) => p.toMap()).toList(),
      });
    });

    debugPrint('👤 User $userName joined session $sessionId');
    return participantId;
  }

  /// Update a participant's items in the session (real-time sync)
  Future<void> updateParticipantItems({
    required String sessionId,
    required String participantId,
    required List<TableGroupItem> items,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');
      
      final session = TableGroupSession.fromFirestore(snapshot);
      final updatedParticipants = session.participants.map((p) {
        if (p.participantId == participantId) {
          final subtotal = items.fold(0.0, (sum, item) => sum + item.totalPrice);
          return p.copyWith(items: items, subtotal: subtotal);
        }
        return p;
      }).toList();

      // Recalculate grand total
      final grandTotal = updatedParticipants.fold(0.0, (sum, p) => sum + p.subtotal);

      tx.update(docRef, {
        'participants': updatedParticipants.map((p) => p.toMap()).toList(),
        'grandTotal': grandTotal,
      });
    });
  }

  /// Submit group order — creates individual meat_orders for each participant
  Future<List<String>> submitGroupOrder(String sessionId) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    final snapshot = await docRef.get();
    if (!snapshot.exists) throw Exception('Session not found');
    
    final session = TableGroupSession.fromFirestore(snapshot);
    final orderIds = <String>[];
    
    final batch = _db.batch();
    
    for (final participant in session.participants) {
      if (participant.items.isEmpty) continue;
      
      final orderRef = _db.collection('meat_orders').doc();
      final orderNumber = orderRef.id.substring(0, 6).toUpperCase();
      
      final orderData = {
        'userId': participant.userId,
        'userDisplayName': participant.name,
        'customerName': participant.name,
        'butcherId': session.businessId,
        'butcherName': session.businessName,
        'items': participant.items.asMap().entries.map((entry) {
          final item = entry.value;
          return {
            'productId': item.productId,
            'productName': item.productName,
            'quantity': item.quantity,
            'unitPrice': item.unitPrice,
            'totalPrice': item.totalPrice,
            'imageUrl': item.imageUrl,
            'positionNumber': entry.key + 1,
            if (item.itemNote != null) 'itemNote': item.itemNote,
            if (item.selectedOptions.isNotEmpty) 'selectedOptions': item.selectedOptions,
          };
        }).toList(),
        'totalAmount': participant.subtotal,
        'deliveryMethod': 'dineIn',
        'tableNumber': session.tableNumber,
        'paymentMethod': 'payLater',
        'paymentStatus': 'pending',
        'status': 'pending',
        'orderNumber': orderNumber,
        // Group linking
        'groupSessionId': session.id,
        'isGroupOrder': true,
        'participantName': participant.name,
        'participantId': participant.participantId,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };
      
      batch.set(orderRef, orderData);
      orderIds.add(orderRef.id);
    }
    
    // Update session status to ordering
    batch.update(docRef, {'status': 'ordering'});
    
    await batch.commit();
    debugPrint('🍽️ Submitted ${orderIds.length} group orders for session $sessionId');
    
    return orderIds;
  }

  /// Mark a participant as paid
  Future<void> markParticipantPaid({
    required String sessionId,
    required String participantId,
    required String paymentMethod,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) return;
      
      final session = TableGroupSession.fromFirestore(snapshot);
      final updatedParticipants = session.participants.map((p) {
        if (p.participantId == participantId) {
          return p.copyWith(
            paymentStatus: 'paid',
            paymentMethod: paymentMethod,
            paidAt: DateTime.now(),
          );
        }
        return p;
      }).toList();

      // Recalculate paid total
      final paidTotal = updatedParticipants
          .where((p) => p.isPaid)
          .fold(0.0, (sum, p) => sum + p.subtotal);

      final allPaid = updatedParticipants.every((p) => p.isPaid);

      tx.update(docRef, {
        'participants': updatedParticipants.map((p) => p.toMap()).toList(),
        'paidTotal': paidTotal,
        'paymentType': 'individual',
        if (allPaid) 'status': 'closed',
        if (allPaid) 'closedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  /// One person pays for all remaining unpaid participants
  Future<void> payForAll({
    required String sessionId,
    required String paidByUserId,
    required String paymentMethod,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) return;
      
      final session = TableGroupSession.fromFirestore(snapshot);
      final updatedParticipants = session.participants.map((p) {
        if (!p.isPaid) {
          return p.copyWith(
            paymentStatus: 'paid',
            paymentMethod: paymentMethod,
            paidAt: DateTime.now(),
          );
        }
        return p;
      }).toList();

      tx.update(docRef, {
        'participants': updatedParticipants.map((p) => p.toMap()).toList(),
        'paidTotal': session.grandTotal,
        'paymentType': 'single',
        'paidByUserId': paidByUserId,
        'status': 'closed',
        'closedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  /// Close a session manually
  Future<void> closeSession(String sessionId) async {
    await _db.collection(_collection).doc(sessionId).update({
      'status': 'closed',
      'closedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Get real-time session stream
  Stream<TableGroupSession?> getSessionStream(String sessionId) {
    return _db.collection(_collection).doc(sessionId).snapshots().map(
      (doc) => doc.exists ? TableGroupSession.fromFirestore(doc) : null,
    );
  }

  /// Get all active sessions for a business (admin/staff view)
  Stream<List<TableGroupSession>> getActiveSessionsStream(String businessId) {
    return _db
        .collection(_collection)
        .where('businessId', isEqualTo: businessId)
        .where('status', whereIn: ['active', 'ordering', 'paying'])
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => TableGroupSession.fromFirestore(doc))
            .toList());
  }
}
