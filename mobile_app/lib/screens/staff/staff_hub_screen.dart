import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/driver_provider.dart';

/// Unified Staff Hub — Personel Girişi
/// Shows available staff functions based on the user's role:
/// - Teslimatlar (Deliveries) — if user is driver
/// - Rezervasyonlar (Reservations) — if assigned business has reservations
/// - Future: Sipariş Al (Take Orders) — for waiters
class StaffHubScreen extends ConsumerStatefulWidget {
  const StaffHubScreen({super.key});

  @override
  ConsumerState<StaffHubScreen> createState() => _StaffHubScreenState();
}

class _StaffHubScreenState extends ConsumerState<StaffHubScreen> {
  bool _isLoading = true;
  bool _isDriver = false;
  bool _hasReservation = false;
  String _staffName = '';
  String _businessName = '';
  String? _businessId;
  int _assignedBusinessCount = 0;

  // Live counters
  int _pendingReservations = 0;
  int _activeTableSessions = 0;

  @override
  void initState() {
    super.initState();
    _loadCapabilities();
  }

  Future<void> _loadCapabilities() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final adminDoc = await FirebaseFirestore.instance
          .collection('admins')
          .doc(user.uid)
          .get();

      if (!adminDoc.exists) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final data = adminDoc.data()!;
      _staffName = data['staffName'] ?? data['name'] ?? user.displayName ?? '';
      _isDriver = data['isDriver'] == true;

      // Check assignedBusinesses array
      final assigned = data['assignedBusinesses'] as List<dynamic>?;
      if (assigned != null && assigned.isNotEmpty) {
        _isDriver = true;
        _assignedBusinessCount = assigned.length;

        // Check each assigned business for reservation support
        for (final id in assigned) {
          final bizDoc = await FirebaseFirestore.instance
              .collection('businesses')
              .doc(id.toString())
              .get();
          if (bizDoc.exists && bizDoc.data()?['hasReservation'] == true) {
            _hasReservation = true;
            _businessId ??= id.toString();
            if (_businessName.isEmpty) {
              _businessName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? '';
            }
          }
        }
      }

      // Check direct business for reservation support
      final bizId = data['businessId'] ?? data['butcherId'];
      if (bizId != null) {
        _businessId ??= bizId;
        final bizDoc = await FirebaseFirestore.instance
            .collection('businesses')
            .doc(bizId)
            .get();
        if (bizDoc.exists) {
          if (_businessName.isEmpty) {
            _businessName = bizDoc.data()?['companyName'] ?? bizDoc.data()?['name'] ?? '';
          }
          if (bizDoc.data()?['hasReservation'] == true) {
            _hasReservation = true;
            _businessId = bizId;
          }
        }
      }

      // Load pending reservation count
      if (_hasReservation && _businessId != null) {
        _loadPendingReservationCount();
      }

      // Load active table session count for waiter view
      if (_businessId != null) {
        _loadActiveTableSessionCount();
      }
    } catch (e) {
      debugPrint('[StaffHub] Error: $e');
    }

    if (mounted) setState(() => _isLoading = false);
  }

  void _loadPendingReservationCount() {
    FirebaseFirestore.instance
        .collection('businesses')
        .doc(_businessId)
        .collection('reservations')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .listen((snap) {
      if (mounted) {
        setState(() => _pendingReservations = snap.docs.length);
      }
    });
  }

  void _loadActiveTableSessionCount() {
    FirebaseFirestore.instance
        .collection('businesses')
        .doc(_businessId)
        .collection('table_sessions')
        .where('isActive', isEqualTo: true)
        .snapshots()
        .listen((snap) {
      if (mounted) {
        setState(() => _activeTableSessions = snap.docs.length);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final driverState = ref.watch(driverProvider);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Personel Girişi',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            if (_staffName.isNotEmpty)
              Text(
                _staffName,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
          ],
        ),
        centerTitle: false,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : (!_isDriver && !_hasReservation)
              ? _buildNoAccess()
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Business name header
                      if (_businessName.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFB335B).withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.store, color: Color(0xFFFB335B), size: 24),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _businessName,
                                      style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (_assignedBusinessCount > 1)
                                      Text(
                                        '$_assignedBusinessCount işletme atandı',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey[500],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Section title
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 12),
                        child: Text(
                          'Görevler',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[600],
                          ),
                        ),
                      ),

                      // ─── Deliveries Card ───
                      if (_isDriver)
                        _buildFeatureCard(
                          icon: Icons.local_shipping,
                          title: 'Teslimatlar',
                          subtitle: driverState.isDriver
                              ? '${driverState.driverInfo?.assignedBusinesses.length ?? 0} işletme'
                              : 'Teslimat yönetimi',
                          color: const Color(0xFFFE0032),
                          gradient: const [Color(0xFFFA4C71), Color(0xFFFE0032)],
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/driver-deliveries');
                          },
                        ),

                      if (_isDriver) const SizedBox(height: 16),

                      // ─── Reservations Card ───
                      if (_hasReservation)
                        _buildFeatureCard(
                          icon: Icons.restaurant,
                          title: 'Rezervasyonlar',
                          subtitle: _pendingReservations > 0
                              ? '$_pendingReservations bekleyen'
                              : 'Tüm rezervasyonlar',
                          color: Colors.green.shade700,
                          gradient: [Colors.green.shade400, Colors.green.shade700],
                          badgeCount: _pendingReservations,
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/staff-reservations');
                          },
                        ),

                      if (_hasReservation) const SizedBox(height: 16),

                      // ─── Take Orders (Garson Sipariş) ───
                      if (_businessId != null)
                        _buildFeatureCard(
                          icon: Icons.receipt_long,
                          title: 'Sipariş Al',
                          subtitle: _activeTableSessions > 0
                              ? '$_activeTableSessions aktif masa'
                              : 'Masa siparişi al',
                          color: Colors.orange.shade700,
                          gradient: [Colors.orange.shade400, Colors.orange.shade700],
                          badgeCount: _activeTableSessions,
                          onTap: () {
                            HapticFeedback.lightImpact();
                            context.push('/waiter-order');
                          },
                        ),

                      if (_businessId != null) const SizedBox(height: 16),

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
    );
  }

  Widget _buildNoAccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Personel yetkisi bulunamadı',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Bu sayfaya erişmek için işletme yöneticinize başvurun',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required List<Color> gradient,
    required VoidCallback onTap,
    int badgeCount = 0,
    bool disabled = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Opacity(
        opacity: disabled ? 0.45 : 1.0,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: disabled ? Colors.grey.withOpacity(0.2) : color.withOpacity(0.3),
              width: 1.5,
            ),
            boxShadow: [
              if (!disabled)
                BoxShadow(
                  color: color.withOpacity(0.1),
                  blurRadius: 15,
                  offset: const Offset(0, 4),
                ),
            ],
          ),
          child: Row(
            children: [
              // Icon circle with gradient
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: gradient,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[500],
                      ),
                    ),
                  ],
                ),
              ),
              // Badge or arrow
              if (badgeCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$badgeCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                )
              else if (!disabled)
                Icon(
                  Icons.arrow_forward_ios,
                  size: 18,
                  color: Colors.grey[400],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
