import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/table_group_session_model.dart';
import 'fcm_service.dart';

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
    
    // Generate 4-digit PIN (1000-9999)
    final pin = (1000 + Random.secure().nextInt(9000)).toString();
    
    // Fetch FCM Token for the host
    String? fcmToken;
    try {
      fcmToken = await FCMService().refreshToken();
    } catch (e) {
      debugPrint('Error getting FCM token for session host: $e');
    }
    
    final participant = TableGroupParticipant(
      participantId: participantId,
      userId: hostUserId,
      name: hostName,
      isHost: true,
      fcmToken: fcmToken,
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
      groupPin: pin,
      participants: [participant],
      createdAt: DateTime.now(),
    );

    await docRef.set(session.toMap());
    debugPrint('📋 Created group session ${docRef.id} for table $tableNumber at $businessName (PIN: $pin)');
    
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
    
    final session = TableGroupSession.fromFirestore(query.docs.first);

    // FIX 14: Clear stale sessions when scanned by a new potential customer
    bool hasSubmittedItems = false;
    bool allSubmittedFinished = true;
    
    for (var p in session.participants) {
      for (var item in p.items) {
        if (item.isSubmitted) {
          hasSubmittedItems = true;
          if (item.orderStatus != 'completed' && item.orderStatus != 'cancelled' && item.orderStatus != 'delivered') {
            allSubmittedFinished = false; // still active items
          }
        }
      }
    }

    // 1. If it has submitted items and ALL are finished, the previous group finished their meal
    // but the session was never closed correctly (e.g., they paid cash). Close it & return null.
    if (hasSubmittedItems && allSubmittedFinished) {
      await _db.collection(_collection).doc(session.id).update({
        'status': 'closed', 
        'closedAt': FieldValue.serverTimestamp(),
        'cancelReason': 'Stale Complete (Masa QR Tarama)',
      });
      return null;
    }

    // 2. If NO items submitted AND session is over 15 minutes old, it's abandoned.
    final now = DateTime.now();
    final difference = now.difference(session.createdAt);
    if (!hasSubmittedItems && difference.inMinutes >= 15) {
      await _db.collection(_collection).doc(session.id).update({
        'status': 'cancelled', 
        'closedAt': FieldValue.serverTimestamp(),
        'cancelReason': '15 Dakika Zaman Aşımı (Masa QR Tarama)'
      });
      return null;
    }

    return session;
  }

  /// Join an existing group session (requires PIN)
  Future<String> joinSession({
    required String sessionId,
    required String userId,
    required String userName,
    required String pin,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    
    // First check if user already exists in session
    final currentDoc = await docRef.get();
    if (!currentDoc.exists) throw Exception('Session not found');
    final currentSession = TableGroupSession.fromFirestore(currentDoc);
    
    // Validate PIN (bypass if user is the original host)
    if (currentSession.hostUserId != userId) {
      if (currentSession.groupPin != null && currentSession.groupPin != pin) {
        throw Exception('WRONG_PIN');
      }
    }
    
    // If already joined, return existing participantId
    final existingParticipant = currentSession.participants.cast<TableGroupParticipant?>().firstWhere(
      (p) => p?.userId == userId,
      orElse: () => null,
    );
    if (existingParticipant != null) {
      debugPrint('⚠️ User $userId already in session $sessionId, returning existing participantId');
      return existingParticipant.participantId;
    }
    
    // Create new participant
    final participantId = const Uuid().v4();
    
    // Fetch FCM Token for the joining participant
    String? fcmToken;
    try {
      fcmToken = await FCMService().refreshToken();
    } catch (e) {
      debugPrint('Error getting FCM token for session join: $e');
    }

    final participant = TableGroupParticipant(
      participantId: participantId,
      userId: userId,
      name: userName,
      isHost: false,
      fcmToken: fcmToken,
    );

    // Track the actual participantId (may differ if already joined in race window)
    String actualParticipantId = participantId;

    // Use transaction to safely add participant
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');
      
      final session = TableGroupSession.fromFirestore(snapshot);
      
      // Double-check in transaction — if already joined, use existing ID
      final existingInTx = session.participants.cast<TableGroupParticipant?>().firstWhere(
        (p) => p?.userId == userId,
        orElse: () => null,
      );
      if (existingInTx != null) {
        actualParticipantId = existingInTx.participantId;
        debugPrint('⚠️ User $userId already in session (race), using existing ID: $actualParticipantId');
        return;
      }

      final updatedParticipants = [...session.participants, participant];
      tx.update(docRef, {
        'participants': updatedParticipants.map((p) => p.toMap()).toList(),
      });
    });

    debugPrint('👤 User $userName joined session $sessionId (participantId: $actualParticipantId)');
    return actualParticipantId;
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
          // Reset readiness when cart changes — prevents stale ready state
          return p.copyWith(items: items, subtotal: subtotal, isReady: false);
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

  /// Mark a participant as ready/not ready
  Future<void> markReady({
    required String sessionId,
    required String participantId,
    required bool ready,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');
      
      final session = TableGroupSession.fromFirestore(snapshot);
      final updatedParticipants = session.participants.map((p) {
        if (p.participantId == participantId) {
          return p.copyWith(isReady: ready);
        }
        return p;
      }).toList();

      tx.update(docRef, {
        'participants': updatedParticipants.map((p) => p.toMap()).toList(),
      });
    });
    debugPrint('${ready ? "✅" : "⏳"} Participant $participantId marked ${ready ? "ready" : "not ready"}');
  }

  /// Host submits group order to kitchen — validates host + allReady, then
  /// atomically creates the meat_orders document AND updates the session.
  /// This replaces the old dual-call (submitToKitchen + submitGroupOrder).
  Future<void> submitToKitchen({
    required String sessionId,
    required String userId,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);

    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');

      final session = TableGroupSession.fromFirestore(snapshot);

      // Verify caller is the host
      if (session.hostUserId != userId) {
        throw Exception('ONLY_HOST_CAN_SUBMIT');
      }

      // Verify all participants are ready
      if (!session.allReady) {
        throw Exception('NOT_ALL_READY');
      }

      tx.update(docRef, {
        'status': 'ordering',
        'orderedAt': FieldValue.serverTimestamp(),
      });
    });
    debugPrint('🍳 Session $sessionId submitted to kitchen');
  }

  /// Submit group order — creates a SINGLE meat_orders document aggregating
  /// all new items. Uses a **transaction** for atomicity (prevents data loss
  /// from concurrent participant edits).
  Future<List<String>> submitGroupOrder(String sessionId) async {
    final docRef = _db.collection(_collection).doc(sessionId);
    final orderRef = _db.collection('meat_orders').doc();
    final orderNumber = orderRef.id.substring(0, 6).toUpperCase();

    // Get fresh FCM token for the order
    String? fcmToken;
    try {
      fcmToken = await FCMService().refreshToken();
    } catch (e) {
      debugPrint('Error getting FCM token for group order: $e');
    }

    final List<String> createdOrderIds = [];

    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');

      final session = TableGroupSession.fromFirestore(snapshot);
      final updatedParticipants = <TableGroupParticipant>[];

      // 1. Gather all unsubmitted items across all participants
      final allUnsubmittedItems = <Map<String, dynamic>>[];
      double totalCombinedAmount = 0.0;

      // Collect FCM tokens for all participants in the session
      final Set<String> participantFcmTokens = {};
      if (fcmToken != null) participantFcmTokens.add(fcmToken!); // Ensure caller's token is included
      for (final p in session.participants) {
        if (p.fcmToken != null && p.fcmToken!.isNotEmpty) {
          participantFcmTokens.add(p.fcmToken!);
        }
      }
      final List<String> fcmTokensList = participantFcmTokens.toList();

      for (final p in session.participants) {
        final unsubmitted = p.items.where((i) => !i.isSubmitted).toList();
        if (unsubmitted.isNotEmpty) {
          for (final item in unsubmitted) {
            totalCombinedAmount += item.totalPrice;
            allUnsubmittedItems.add({
              'productId': item.productId,
              'productName': item.productName,
              'quantity': item.quantity,
              'unitPrice': item.unitPrice,
              'totalPrice': item.totalPrice,
              'imageUrl': item.imageUrl,
              if (item.itemNote != null) 'itemNote': item.itemNote,
              if (item.selectedOptions.isNotEmpty)
                'selectedOptions': item.selectedOptions,
              // Track who ordered this item
              'participantName': p.name,
              'participantId': p.participantId,
            });
          }
        }

        // Update local states for the session document
        final newItems =
            p.items.map((i) => i.copyWith(isSubmitted: true)).toList();
        updatedParticipants.add(p.copyWith(items: newItems));
      }

      // If no new items to submit, just return early
      if (allUnsubmittedItems.isEmpty) {
        return;
      }

      // Check if we can consolidate into the existing activePendingOrderId
      String? pendingOrderId = session.activePendingOrderId;
      bool appendToExisting = false;
      DocumentSnapshot? existingOrderSnapshot;

      if (pendingOrderId != null) {
        existingOrderSnapshot = await tx.get(_db.collection('meat_orders').doc(pendingOrderId));
        if (existingOrderSnapshot.exists) {
          final orderData = existingOrderSnapshot.data() as Map<String, dynamic>;
          if (orderData['status'] == 'pending') {
            appendToExisting = true;
          }
        }
      }

      if (appendToExisting && pendingOrderId != null && existingOrderSnapshot != null) {
        final existingOrderRef = _db.collection('meat_orders').doc(pendingOrderId);
        final orderData = existingOrderSnapshot.data() as Map<String, dynamic>;
        
        List<dynamic> existingItems = List.from(orderData['items'] ?? []);
        
        // Give positions continuing from the last item
        int startPosition = existingItems.length + 1;
        for (int i = 0; i < allUnsubmittedItems.length; i++) {
          allUnsubmittedItems[i]['positionNumber'] = startPosition + i;
        }

        existingItems.addAll(allUnsubmittedItems);
        
        double existingTotal = (orderData['totalAmount'] ?? 0.0).toDouble();
        double newTotal = existingTotal + totalCombinedAmount;

        tx.update(existingOrderRef, {
          'items': existingItems,
          'totalAmount': newTotal,
          if (fcmToken != null) 'fcmToken': fcmToken,
          if (fcmTokensList.isNotEmpty) 'fcmTokens': fcmTokensList,
          'updatedAt': FieldValue.serverTimestamp(),
        });

        // Stamp orderId and status back to items
        for (int pIdx = 0; pIdx < updatedParticipants.length; pIdx++) {
          var p = updatedParticipants[pIdx];
          var newItems = p.items.map((i) {
            if (i.isSubmitted && i.orderId == null) {
               return i.copyWith(orderId: pendingOrderId, orderStatus: 'pending');
            }
            return i;
          }).toList();
          updatedParticipants[pIdx] = p.copyWith(items: newItems);
        }

        tx.update(docRef, {
          'status': 'active',
          'participants': updatedParticipants.map((p) => p.toMap()).toList(),
        });

        createdOrderIds.add(pendingOrderId);
      } else {
        // Create new order as before
        final orderRef = _db.collection('meat_orders').doc();

        // Give positions 1..N to items
        for (int i = 0; i < allUnsubmittedItems.length; i++) {
          allUnsubmittedItems[i]['positionNumber'] = i + 1;
        }

        final orderData = {
          'userId': session.hostUserId, // Store under host
          'userDisplayName': session.hostName,
          'customerName': session.hostName, // Chef sees the table host
          'butcherId': session.businessId,
          'butcherName': session.businessName,
          'items': allUnsubmittedItems,
          'totalAmount': totalCombinedAmount,
          'deliveryMethod': 'dineIn',
          'tableNumber': session.tableNumber,
          'paymentMethod': 'payLater',
          'paymentStatus': 'pending',
          'status': 'pending',
          'orderNumber': orderNumber,
          // Group linking
          'tableSessionId': session.id,
          'groupSessionId': session.id,
          'isGroupOrder': true,
          'groupParticipantCount': session.participants.length,
          if (fcmToken != null) 'fcmToken': fcmToken,
          if (fcmTokensList.isNotEmpty) 'fcmTokens': fcmTokensList,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        };

        // 2. Create the order document inside the transaction
        tx.set(orderRef, orderData);

        // 3. Stamp orderId and status back to items
        for (int pIdx = 0; pIdx < updatedParticipants.length; pIdx++) {
          var p = updatedParticipants[pIdx];
          var newItems = p.items.map((i) {
            if (i.isSubmitted && i.orderId == null) {
               return i.copyWith(orderId: orderRef.id, orderStatus: 'pending');
            }
            return i;
          }).toList();
          updatedParticipants[pIdx] = p.copyWith(items: newItems);
        }

        // 4. Update session: mark items submitted, reset readiness, back to active, set activePendingOrderId
        tx.update(docRef, {
          'status': 'active',
          'participants': updatedParticipants.map((p) => p.toMap()).toList(),
          'activePendingOrderId': orderRef.id,
        });

        createdOrderIds.add(orderRef.id);
      }
    });

    if (createdOrderIds.isNotEmpty) {
      debugPrint(
          '🍽️ Submitted 1 combined group order (${orderRef.id}) for session $sessionId');
    }

    return createdOrderIds;
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

  /// Cancel a session (host only) — validates host then marks as cancelled
  Future<void> cancelSession(String sessionId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('NOT_AUTHENTICATED');

    final cancellerName =
        user.displayName ?? user.email?.split('@').first ?? 'Host';

    // Validate caller is the host (prevents unauthorized cancellation)
    final docRef = _db.collection(_collection).doc(sessionId);
    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) throw Exception('Session not found');

      final session = TableGroupSession.fromFirestore(snapshot);
      if (session.hostUserId != user.uid) {
        throw Exception('ONLY_HOST_CAN_CANCEL');
      }

      tx.update(docRef, {
        'status': 'cancelled',
        'cancelledAt': FieldValue.serverTimestamp(),
        'cancelledBy': cancellerName,
        'cancelReason': 'Host tarafından iptal edildi',
        'closedAt': FieldValue.serverTimestamp(),
      });
    });
    debugPrint('❌ Session $sessionId cancelled by $cancellerName');
  }

  /// Leave a session — removes participant from the array
  Future<void> leaveSession({
    required String sessionId,
    required String participantId,
  }) async {
    final docRef = _db.collection(_collection).doc(sessionId);

    await _db.runTransaction((tx) async {
      final snapshot = await tx.get(docRef);
      if (!snapshot.exists) return;

      final session = TableGroupSession.fromFirestore(snapshot);
      final updatedParticipants = session.participants
          .where((p) => p.participantId != participantId)
          .toList();

      if (updatedParticipants.isEmpty) {
        // Last person left → close session
        tx.update(docRef, {
          'participants': [],
          'grandTotal': 0,
          'status': 'closed',
          'closedAt': FieldValue.serverTimestamp(),
        });
      } else {
        // Recalculate grand total
        final grandTotal = updatedParticipants.fold(0.0, (sum, p) => sum + p.subtotal);
        tx.update(docRef, {
          'participants': updatedParticipants.map((p) => p.toMap()).toList(),
          'grandTotal': grandTotal,
        });
      }
    });

    debugPrint('👋 Participant $participantId left session $sessionId');
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

  /// Get closed group sessions where user was a participant (order history)
  Stream<List<TableGroupSession>> getUserGroupHistory(String userId) {
    // Firestore can't query inside arrays of maps directly,
    // so we fetch all closed sessions and filter client-side.
    // For scale, we'd add a 'participantUserIds' array field.
    return _db
        .collection(_collection)
        .where('status', isEqualTo: 'closed')
        .orderBy('closedAt', descending: true)
        .limit(50)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => TableGroupSession.fromFirestore(doc))
            .where((session) => session.participants.any((p) => p.userId == userId))
            .toList());
  }
}
