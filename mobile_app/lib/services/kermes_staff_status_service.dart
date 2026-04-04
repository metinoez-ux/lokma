import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Garson durum modeli
class KermesStaffStatus {
  final String id;           // kermesId__staffUid
  final String kermesId;
  final String staffId;
  final String staffName;
  final String role;         // 'waiter' | 'courier' | 'counter'
  final String status;       // 'active' | 'paused' | 'offline'
  final String assignedSection; // "kadin_bolumu", "erkek_bolumu", "aile_bolumu"
  final int currentOrderCount;
  final DateTime? lastAssignedAt;
  final DateTime? lastDeliveredAt;
  final DateTime? pausedAt;
  final DateTime updatedAt;

  KermesStaffStatus({
    required this.id,
    required this.kermesId,
    required this.staffId,
    required this.staffName,
    this.role = 'waiter',
    required this.status,
    this.assignedSection = '',
    this.currentOrderCount = 0,
    this.lastAssignedAt,
    this.lastDeliveredAt,
    this.pausedAt,
    DateTime? updatedAt,
  }) : updatedAt = updatedAt ?? DateTime.now();

  bool get isActive => status == 'active';
  bool get isPaused => status == 'paused';
  bool get isOffline => status == 'offline';

  factory KermesStaffStatus.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return KermesStaffStatus(
      id: doc.id,
      kermesId: data['kermesId']?.toString() ?? '',
      staffId: data['staffId']?.toString() ?? '',
      staffName: data['staffName']?.toString() ?? '',
      role: data['role']?.toString() ?? 'waiter',
      status: data['status']?.toString() ?? 'offline',
      assignedSection: data['assignedSection']?.toString() ?? '',
      currentOrderCount: (data['currentOrderCount'] as num?)?.toInt() ?? 0,
      lastAssignedAt: data['lastAssignedAt'] != null
          ? (data['lastAssignedAt'] as Timestamp).toDate()
          : null,
      lastDeliveredAt: data['lastDeliveredAt'] != null
          ? (data['lastDeliveredAt'] as Timestamp).toDate()
          : null,
      pausedAt: data['pausedAt'] != null
          ? (data['pausedAt'] as Timestamp).toDate()
          : null,
      updatedAt: data['updatedAt'] != null
          ? (data['updatedAt'] as Timestamp).toDate()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'kermesId': kermesId,
    'staffId': staffId,
    'staffName': staffName,
    'role': role,
    'status': status,
    'assignedSection': assignedSection,
    'currentOrderCount': currentOrderCount,
    'lastAssignedAt': lastAssignedAt != null ? Timestamp.fromDate(lastAssignedAt!) : null,
    'lastDeliveredAt': lastDeliveredAt != null ? Timestamp.fromDate(lastDeliveredAt!) : null,
    'pausedAt': pausedAt != null ? Timestamp.fromDate(pausedAt!) : null,
    'updatedAt': FieldValue.serverTimestamp(),
  };
}

/// Garson durum yonetim servisi
class KermesStaffStatusService {
  final FirebaseFirestore _db;
  
  KermesStaffStatusService({FirebaseFirestore? db})
      : _db = db ?? FirebaseFirestore.instance;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _db.collection('kermes_staff_status');

  /// Composite doc ID: kermesId__staffUid
  String _docId(String kermesId, String staffId) => '${kermesId}__$staffId';

  // ============================================================
  // Garson Durumu Okuma
  // ============================================================

  /// Belirli bir kermes'in tum aktif garsonlarini dinle
  Stream<List<KermesStaffStatus>> getActiveStaffStream(String kermesId) {
    return _collection
        .where('kermesId', isEqualTo: kermesId)
        .where('status', isEqualTo: 'active')
        .snapshots()
        .map((snap) => snap.docs.map(KermesStaffStatus.fromFirestore).toList());
  }

  /// Belirli bir bolumun aktif garsonlarini dinle
  Stream<List<KermesStaffStatus>> getSectionStaffStream(
    String kermesId,
    String sectionId,
  ) {
    return _collection
        .where('kermesId', isEqualTo: kermesId)
        .where('assignedSection', isEqualTo: sectionId)
        .where('status', isEqualTo: 'active')
        .snapshots()
        .map((snap) => snap.docs.map(KermesStaffStatus.fromFirestore).toList());
  }

  /// Tek personelin kendi durumunu realtime dinle
  Stream<KermesStaffStatus?> getMyStatusStream(String kermesId, String staffId) {
    final docId = _docId(kermesId, staffId);
    return _collection.doc(docId).snapshots().map((snap) {
      if (!snap.exists) return null;
      return KermesStaffStatus.fromFirestore(snap);
    });
  }

  /// Tek personelin durumunu oku (one-time)
  Future<KermesStaffStatus?> getMyStatus(String kermesId, String staffId) async {
    final docId = _docId(kermesId, staffId);
    final doc = await _collection.doc(docId).get();
    if (!doc.exists) return null;
    return KermesStaffStatus.fromFirestore(doc);
  }

  /// Tum garsonlari dinle (pause dahil)
  Stream<List<KermesStaffStatus>> getAllStaffStream(String kermesId) {
    return _collection
        .where('kermesId', isEqualTo: kermesId)
        .snapshots()
        .map((snap) => snap.docs.map(KermesStaffStatus.fromFirestore).toList());
  }

  // ============================================================
  // En Az Mesgul Garson Bulma
  // ============================================================

  /// Belirli bir bolumdeki en az mesgul aktif garsonu bul
  /// Aile Bolumu dahil tum bolumlerde erkek garson servis yapar
  Future<KermesStaffStatus?> findLeastBusyWaiter(
    String kermesId,
    String sectionId,
  ) async {
    try {
      final snap = await _collection
          .where('kermesId', isEqualTo: kermesId)
          .where('assignedSection', isEqualTo: sectionId)
          .where('status', isEqualTo: 'active')
          .orderBy('currentOrderCount')
          .limit(1)
          .get();

      if (snap.docs.isEmpty) {
        debugPrint('[StaffStatus] Bolum $sectionId icin aktif garson yok');
        return null;
      }

      return KermesStaffStatus.fromFirestore(snap.docs.first);
    } catch (e) {
      debugPrint('[StaffStatus] findLeastBusyWaiter error: $e');
      return null;
    }
  }

  // ============================================================
  // Garson Durumu Guncelleme
  // ============================================================

  /// Garson durumunu ayarla (active/paused/offline)
  Future<void> setStaffStatus(
    String kermesId,
    String staffId,
    String staffName,
    String status, {
    String? sectionId,
    String role = 'waiter',
  }) async {
    final docId = _docId(kermesId, staffId);
    final Map<String, dynamic> updateData = {
      'kermesId': kermesId,
      'staffId': staffId,
      'staffName': staffName,
      'role': role,
      'status': status,
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (sectionId != null) {
      updateData['assignedSection'] = sectionId;
    }

    if (status == 'paused') {
      updateData['pausedAt'] = FieldValue.serverTimestamp();
    } else if (status == 'active') {
      updateData['pausedAt'] = null;
    }

    await _collection.doc(docId).set(updateData, SetOptions(merge: true));
    debugPrint('[StaffStatus] $staffName -> $status (kermes: $kermesId)');
  }

  /// Garson pause toggle
  Future<void> togglePause(
    String kermesId,
    String staffId,
    String staffName,
  ) async {
    final docId = _docId(kermesId, staffId);
    final doc = await _collection.doc(docId).get();

    if (!doc.exists) {
      // Ilk kez giris - aktif olarak kaydet
      await setStaffStatus(kermesId, staffId, staffName, 'active');
      return;
    }

    final current = doc.data()?['status']?.toString() ?? 'offline';
    final newStatus = current == 'active' ? 'paused' : 'active';
    await setStaffStatus(kermesId, staffId, staffName, newStatus);
  }

  // ============================================================
  // Siparis Sayaci
  // ============================================================

  /// Garsona siparis atandiginda sayaci artir
  Future<void> incrementOrderCount(String kermesId, String staffId) async {
    final docId = _docId(kermesId, staffId);
    await _collection.doc(docId).update({
      'currentOrderCount': FieldValue.increment(1),
      'lastAssignedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Garson siparisi teslim ettiginde sayaci azalt
  Future<void> decrementOrderCount(String kermesId, String staffId) async {
    final docId = _docId(kermesId, staffId);
    await _collection.doc(docId).update({
      'currentOrderCount': FieldValue.increment(-1),
      'lastDeliveredAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Garson cevrimdisi olurken sayaci sifirla
  Future<void> goOffline(String kermesId, String staffId, String staffName) async {
    await setStaffStatus(kermesId, staffId, staffName, 'offline');
    final docId = _docId(kermesId, staffId);
    await _collection.doc(docId).update({
      'currentOrderCount': 0,
    });
  }
}

/// Riverpod provider
final kermesStaffStatusServiceProvider = Provider<KermesStaffStatusService>((ref) {
  return KermesStaffStatusService();
});
