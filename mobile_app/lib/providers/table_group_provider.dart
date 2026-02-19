import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/table_group_session_model.dart';
import '../services/table_group_service.dart';

/// State for table group session
class TableGroupState {
  final TableGroupSession? session;
  final String? myParticipantId;
  final bool isLoading;
  final String? error;

  const TableGroupState({
    this.session,
    this.myParticipantId,
    this.isLoading = false,
    this.error,
  });

  /// My participant data
  TableGroupParticipant? get myParticipant {
    if (session == null || myParticipantId == null) return null;
    return session!.participants.cast<TableGroupParticipant?>().firstWhere(
      (p) => p?.participantId == myParticipantId,
      orElse: () => null,
    );
  }

  /// Am I the host?
  bool get isHost => myParticipant?.isHost ?? false;

  TableGroupState copyWith({
    TableGroupSession? session,
    String? myParticipantId,
    bool? isLoading,
    String? error,
  }) {
    return TableGroupState(
      session: session ?? this.session,
      myParticipantId: myParticipantId ?? this.myParticipantId,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Table group notifier (Riverpod 3.x Notifier pattern)
class TableGroupNotifier extends Notifier<TableGroupState> {
  final TableGroupService _service = TableGroupService.instance;
  StreamSubscription? _sessionSub;

  @override
  TableGroupState build() {
    ref.onDispose(() {
      _sessionSub?.cancel();
    });
    return const TableGroupState();
  }

  /// Create a new group session (auto-resolves current user)
  Future<TableGroupSession?> createSession({
    required String businessId,
    required String businessName,
    required String tableNumber,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Giriş yapmanız gerekli');
    
    final hostUserId = user.uid;
    final hostName = user.displayName ?? user.email?.split('@').first ?? 'Misafir';
    
    state = state.copyWith(isLoading: true, error: null);

    try {
      final session = await _service.createSession(
        businessId: businessId,
        businessName: businessName,
        tableNumber: tableNumber,
        hostUserId: hostUserId,
        hostName: hostName,
      );

      final participantId = session.participants.first.participantId;
      state = state.copyWith(
        session: session,
        myParticipantId: participantId,
        isLoading: false,
      );

      // Start listening for real-time updates
      _startListening(session.id);
      return session;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  /// Find active session for a table
  Future<TableGroupSession?> findActiveSession(String businessId, String tableNumber) async {
    return _service.findActiveSession(businessId, tableNumber);
  }

  /// Resume an existing session — restores myParticipantId from Firebase Auth
  /// This is critical when the app is reopened and provider state is fresh.
  Future<bool> resumeSession(String sessionId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;

    try {
      final doc = await FirebaseFirestore.instance
          .collection('table_group_sessions')
          .doc(sessionId)
          .get();

      if (!doc.exists) return false;
      final session = TableGroupSession.fromFirestore(doc);

      // Find participant matching current user
      final myParticipant = session.participants.cast<TableGroupParticipant?>().firstWhere(
        (p) => p?.userId == user.uid,
        orElse: () => null,
      );

      if (myParticipant == null) {
        debugPrint('⚠️ Current user ${user.uid} not found in session $sessionId');
        return false;
      }

      state = state.copyWith(
        session: session,
        myParticipantId: myParticipant.participantId,
        isLoading: false,
      );

      _startListening(sessionId);
      debugPrint('✅ Resumed session $sessionId as ${myParticipant.name} (${myParticipant.participantId})');
      return true;
    } catch (e) {
      debugPrint('❌ Failed to resume session: $e');
      return false;
    }
  }

  /// Join an existing session (auto-resolves current user)
  Future<bool> joinSession(String sessionId, {required String pin, String? displayName}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('Giriş yapmanız gerekli');
    
    final userId = user.uid;
    final userName = displayName?.isNotEmpty == true ? displayName! : (user.displayName ?? user.email?.split('@').first ?? 'Misafir');
    
    state = state.copyWith(isLoading: true, error: null);

    try {
      final participantId = await _service.joinSession(
        sessionId: sessionId,
        userId: userId,
        userName: userName,
        pin: pin,
      );

      // Fetch current session data
      final doc = await FirebaseFirestore.instance
          .collection('table_group_sessions')
          .doc(sessionId)
          .get();
      
      if (!doc.exists) throw Exception('Session not found after join');
      final session = TableGroupSession.fromFirestore(doc);

      state = state.copyWith(
        session: session,
        myParticipantId: participantId,
        isLoading: false,
      );

      _startListening(sessionId);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Add an item to my cart in the session
  Future<void> addItem(TableGroupItem item) async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) {
      debugPrint('❌ addItem failed: session=${currentSession != null}, participantId=$participantId');
      return;
    }

    // Find my current items
    final myParticipant = state.myParticipant;
    if (myParticipant == null) {
      debugPrint('❌ addItem failed: myParticipant null (participantId=$participantId, '
          'participants=${currentSession.participants.map((p) => p.participantId).toList()})');
      return;
    }

    // Check if item already in cart → increase quantity
    final existingIndex = myParticipant.items.indexWhere(
      (i) => i.productId == item.productId,
    );

    List<TableGroupItem> updatedItems;
    if (existingIndex >= 0) {
      updatedItems = [...myParticipant.items];
      final existing = updatedItems[existingIndex];
      final newQty = existing.quantity + item.quantity;
      updatedItems[existingIndex] = existing.copyWith(
        quantity: newQty,
        totalPrice: newQty * existing.unitPrice,
      );
    } else {
      updatedItems = [...myParticipant.items, item];
    }

    await _service.updateParticipantItems(
      sessionId: currentSession.id,
      participantId: participantId,
      items: updatedItems,
    );
  }

  /// Remove an item from my cart
  Future<void> removeItem(String productId) async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) return;

    final myParticipant = state.myParticipant;
    if (myParticipant == null) return;

    final updatedItems = myParticipant.items
        .where((i) => i.productId != productId)
        .toList();

    await _service.updateParticipantItems(
      sessionId: currentSession.id,
      participantId: participantId,
      items: updatedItems,
    );
  }

  /// Update item quantity
  Future<void> updateItemQuantity(String productId, int newQuantity) async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) return;

    final myParticipant = state.myParticipant;
    if (myParticipant == null) return;

    if (newQuantity <= 0) {
      return removeItem(productId);
    }

    final updatedItems = myParticipant.items.map((item) {
      if (item.productId == productId) {
        return item.copyWith(
          quantity: newQuantity,
          totalPrice: newQuantity * item.unitPrice,
        );
      }
      return item;
    }).toList();

    await _service.updateParticipantItems(
      sessionId: currentSession.id,
      participantId: participantId,
      items: updatedItems,
    );
  }

  /// Toggle my readiness state
  Future<void> toggleReady() async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) return;

    final myParticipant = state.myParticipant;
    if (myParticipant == null) return;

    await _service.markReady(
      sessionId: currentSession.id,
      participantId: participantId,
      ready: !myParticipant.isReady,
    );
  }

  /// Host submits group order to kitchen
  Future<bool> submitToKitchen() async {
    final currentSession = state.session;
    if (currentSession == null) return false;

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return false;

    try {
      await _service.submitToKitchen(sessionId: currentSession.id, userId: uid);
      return true;
    } catch (e) {
      debugPrint('❌ submitToKitchen failed: $e');
      return false;
    }
  }

  /// Submit all orders to kitchen
  Future<List<String>> submitOrder() async {
    if (state.session == null) return [];
    return _service.submitGroupOrder(state.session!.id);
  }

  /// Mark my payment as done
  Future<void> markMyPayment(String paymentMethod) async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) return;

    await _service.markParticipantPaid(
      sessionId: currentSession.id,
      participantId: participantId,
      paymentMethod: paymentMethod,
    );
  }

  /// Pay for all remaining unpaid
  Future<void> payForAll(String paymentMethod) async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) return;

    final myParticipant = state.myParticipant;
    if (myParticipant == null) return;

    await _service.payForAll(
      sessionId: currentSession.id,
      paidByUserId: myParticipant.userId,
      paymentMethod: paymentMethod,
    );
  }

  /// Start real-time Firestore listener
  void _startListening(String sessionId) {
    _sessionSub?.cancel();
    _sessionSub = _service.getSessionStream(sessionId).listen(
      (session) {
        if (session != null) {
          state = state.copyWith(session: session);
        }
      },
      onError: (e) {
        debugPrint('❌ Session stream error: $e');
      },
    );
  }

  /// Cancel session (host only)
  Future<void> cancelSession() async {
    final currentSession = state.session;
    if (currentSession == null) return;
    await _service.cancelSession(currentSession.id);
    clearSession();
  }

  /// Leave session (participant)
  Future<void> leaveSession() async {
    final currentSession = state.session;
    final participantId = state.myParticipantId;
    if (currentSession == null || participantId == null) return;
    await _service.leaveSession(
      sessionId: currentSession.id,
      participantId: participantId,
    );
    clearSession();
  }

  /// Kick a participant (host only) — removes them from the session
  Future<void> kickParticipant(String participantId) async {
    final currentSession = state.session;
    if (currentSession == null) return;
    if (!state.isHost) {
      debugPrint('❌ Only host can kick participants');
      return;
    }
    await _service.leaveSession(
      sessionId: currentSession.id,
      participantId: participantId,
    );
    debugPrint('👢 Host kicked participant $participantId');
  }

  /// Clear session and stop listening
  void clearSession() {
    _sessionSub?.cancel();
    _sessionSub = null;
    state = const TableGroupState();
  }
}

/// Global provider
final tableGroupProvider = NotifierProvider<TableGroupNotifier, TableGroupState>(() {
  return TableGroupNotifier();
});
