import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../utils/currency_utils.dart';

/// Driver Earnings Screen — Datenschutz-konform Kazanç Dashboard
/// Shows tip history with privacy-safe data only:
/// ✅ Date+Time, City, Order Amount, Tip Amount
/// ❌ Customer name, address, phone — NEVER shown
class DriverEarningsScreen extends StatefulWidget {
  const DriverEarningsScreen({super.key});

  @override
  State<DriverEarningsScreen> createState() => _DriverEarningsScreenState();
}

class _DriverEarningsScreenState extends State<DriverEarningsScreen> {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  String _selectedPeriod = 'week'; // 'week', 'month', 'all'
  Map<String, dynamic>? _bankAccount;
  Map<String, dynamic>? _payoutPrefs;
  bool _isLoadingProfile = true;

  @override
  void initState() {
    super.initState();
    _loadDriverProfile();
  }

  Future<void> _loadDriverProfile() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    final doc = await _db.collection('admins').doc(uid).get();
    if (doc.exists && mounted) {
      final data = doc.data()!;
      setState(() {
        _bankAccount = data['bankAccount'] as Map<String, dynamic>?;
        _payoutPrefs = data['payoutPreferences'] as Map<String, dynamic>?;
        _isLoadingProfile = false;
      });
    } else {
      setState(() => _isLoadingProfile = false);
    }
  }

  DateTime _getStartDate() {
    final now = DateTime.now();
    switch (_selectedPeriod) {
      case 'week':
        return now.subtract(Duration(days: now.weekday - 1)); // Monday
      case 'month':
        return DateTime(now.year, now.month, 1);
      case 'all':
        return DateTime(2024, 1, 1); // All time
      default:
        return now.subtract(const Duration(days: 7));
    }
  }

  @override
  Widget build(BuildContext context) {
    const brandBottom = Color(0xFFFE0032);
    const brandTop = Color(0xFFFA4C71);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final uid = FirebaseAuth.instance.currentUser?.uid;

    if (uid == null) {
      return Scaffold(body: Center(child: Text('driver.earnings_not_logged_in'.tr())));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('driver.earnings_my_earnings'.tr(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [brandTop, brandBottom],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 22),
            tooltip: 'driver.earnings_payout_settings'.tr(),
            onPressed: () => _openPayoutSettings(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Period selector
          _buildPeriodSelector(isDark),
          // Content
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: _db
                  .collection('meat_orders')
                  .where('courierId', isEqualTo: uid)
                  .where('status', isEqualTo: 'delivered')
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final allDocs = snapshot.data?.docs ?? [];
                final startDate = _getStartDate();

                // Filter by period + only deliveries with valid deliveredAt
                final orders = allDocs.where((doc) {
                  final data = doc.data() as Map<String, dynamic>;
                  final deliveredAt = (data['deliveredAt'] as Timestamp?)?.toDate();
                  if (deliveredAt == null) return false;
                  return deliveredAt.isAfter(startDate);
                }).map((doc) {
                  final data = doc.data() as Map<String, dynamic>;
                  return _EarningsEntry(
                    orderId: doc.id,
                    orderNumber: data['orderNumber']?.toString() ?? doc.id.substring(0, 6).toUpperCase(),
                    deliveredAt: (data['deliveredAt'] as Timestamp).toDate(),
                    totalAmount: (data['totalAmount'] ?? 0).toDouble(),
                    tipAmount: (data['tipAmount'] ?? data['tip'] ?? 0).toDouble(),
                    city: _extractCity(data['deliveryAddress'] as String?),
                    paymentMethod: data['paymentMethod'] as String? ?? 'unknown',
                  );
                }).toList()
                  ..sort((a, b) => b.deliveredAt.compareTo(a.deliveredAt));

                final totalTips = orders.fold<double>(0, (acc, e) => acc + e.tipAmount);
                final tippedCount = orders.where((e) => e.tipAmount > 0).length;
                final totalDeliveries = orders.length;

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Summary cards
                    _buildSummaryCards(totalTips, tippedCount, totalDeliveries, isDark),
                    const SizedBox(height: 16),
                    // Bank account status
                    _buildBankAccountStatus(isDark),
                    const SizedBox(height: 16),
                    // Delivery & Tip History header
                    Row(
                      children: [
                        Icon(Icons.receipt_long, size: 18, color: isDark ? Colors.amber : Colors.amber.shade700),
                        const SizedBox(width: 8),
                        Text(
                          'driver.earnings_delivery_tip_history'.tr(),
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: isDark ? Colors.white : Colors.grey.shade800,
                          ),
                        ),
                        const Spacer(),
                        Text(
                           'driver.earnings_deliveries_count'.tr(args: [totalDeliveries.toString()]),
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Privacy notice
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.blue.withOpacity(0.15)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.shield_outlined, size: 14, color: Colors.blue.shade400),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                               'driver.earnings_privacy_notice'.tr(),
                              style: TextStyle(fontSize: 11, color: Colors.blue.shade400),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    // Tip history list
                    if (orders.isEmpty)
                      _buildEmptyState(isDark)
                    else
                      ...orders.map((entry) => _buildEarningsRow(entry, isDark)),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodSelector(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: isDark ? Colors.grey.shade900 : Colors.grey.shade50,
      child: Row(
        children: [
          _periodChip('driver.earnings_this_week'.tr(), 'week', isDark),
          const SizedBox(width: 8),
          _periodChip('driver.earnings_this_month'.tr(), 'month', isDark),
          const SizedBox(width: 8),
          _periodChip('driver.earnings_all_time'.tr(), 'all', isDark),
        ],
      ),
    );
  }

  Widget _periodChip(String label, String value, bool isDark) {
    final isSelected = _selectedPeriod == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _selectedPeriod = value);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFFE0032)
              : isDark ? Colors.grey.shade800 : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFFFE0032)
                : isDark ? Colors.grey.shade700 : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : (isDark ? Colors.grey.shade300 : Colors.grey.shade600),
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCards(double totalTips, int tippedCount, int totalDeliveries, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _summaryCard(
            icon: Icons.monetization_on,
            iconColor: Colors.amber.shade700,
            label: 'driver.earnings_total_tips'.tr(),
            value: '${totalTips.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _summaryCard(
            icon: Icons.thumb_up_alt,
            iconColor: Colors.green.shade600,
            label: 'driver.earnings_tipped'.tr(),
            value: '$tippedCount / $totalDeliveries',
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _summaryCard(
            icon: Icons.trending_up,
            iconColor: Colors.blue.shade600,
            label: 'driver.earnings_average'.tr(),
            value: tippedCount > 0
                ? '${(totalTips / tippedCount).toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}'
                : '—',
            isDark: isDark,
          ),
        ),
      ],
    );
  }

  Widget _summaryCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF303030) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, size: 22, color: iconColor),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.grey.shade800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }

  Widget _buildBankAccountStatus(bool isDark) {
    if (_isLoadingProfile) {
      return const SizedBox.shrink();
    }

    final hasBankAccount = _bankAccount != null && _bankAccount!['iban'] != null;
    final frequency = _payoutPrefs?['frequency'] ?? 'not_set';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: hasBankAccount
            ? Colors.green.withOpacity(0.06)
            : Colors.orange.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hasBankAccount
              ? Colors.green.withOpacity(0.2)
              : Colors.orange.withOpacity(0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            hasBankAccount ? Icons.account_balance : Icons.warning_amber_rounded,
            size: 24,
            color: hasBankAccount ? Colors.green.shade600 : Colors.orange.shade600,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasBankAccount
                      ? 'driver.earnings_bank_registered'.tr(args: [_maskIban(_bankAccount!['iban'] as String? ?? '')])
                      : 'driver.earnings_bank_not_registered'.tr(),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: hasBankAccount ? Colors.green.shade700 : Colors.orange.shade700,
                  ),
                ),
                if (hasBankAccount) ...[
                  const SizedBox(height: 2),
                  Text(
                    'driver.earnings_payout_label'.tr(args: [_getFrequencyLabel(frequency)]),
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                  ),
                ],
              ],
            ),
          ),
          TextButton(
            onPressed: () => _openBankSetup(),
            child: Text(
               hasBankAccount ? 'driver.earnings_edit'.tr() : 'driver.earnings_save'.tr(),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFFFE0032),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEarningsRow(_EarningsEntry entry, bool isDark) {
    final hasTip = entry.tipAmount > 0;
    final timeStr = '${entry.deliveredAt.day.toString().padLeft(2, '0')}.${entry.deliveredAt.month.toString().padLeft(2, '0')} '
        '${entry.deliveredAt.hour.toString().padLeft(2, '0')}:${entry.deliveredAt.minute.toString().padLeft(2, '0')}';
    final isCash = entry.paymentMethod == 'cash' || entry.paymentMethod == 'nakit';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey.shade900 : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasTip
              ? Colors.amber.withOpacity(0.3)
              : (isDark ? Colors.grey.shade700 : Colors.grey.shade200),
        ),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
        ],
      ),
      child: Row(
        children: [
          // Payment icon
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: isCash ? Colors.green.withOpacity(0.1) : Colors.purple.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isCash ? Icons.payments_outlined : Icons.credit_card,
              size: 18,
              color: isCash ? Colors.green.shade600 : Colors.purple.shade600,
            ),
          ),
          const SizedBox(width: 10),
          // Date + City
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  timeStr,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.grey.shade800,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 12, color: Colors.grey.shade400),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(
                        entry.city.isNotEmpty ? entry.city : '—',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Order total
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${entry.totalAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.grey.shade300 : Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 3),
              if (hasTip)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '💰 +${entry.tipAmount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.amber.shade700,
                    ),
                  ),
                )
              else
                Text(
                  '—',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            Icon(Icons.local_shipping_outlined, size: 60, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            Text(
               'driver.earnings_no_deliveries'.tr(),
              style: TextStyle(fontSize: 15, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  /// Extract city from delivery address (privacy: only city, no street/number)
  /// Input: "Musterstraße 12, 44135 Dortmund" → Output: "Dortmund"
  String _extractCity(String? address) {
    if (address == null || address.isEmpty) return '';
    final parts = address.split(',');
    if (parts.length >= 2) {
      final lastPart = parts.last.trim();
      // Try to extract just city name (after PLZ)
      final plzCityParts = lastPart.split(' ');
      if (plzCityParts.length >= 2) {
        // Return only city name, not PLZ (extra privacy)
        return plzCityParts.sublist(1).join(' ');
      }
      return lastPart;
    }
    return '';
  }

  String _maskIban(String iban) {
    if (iban.length < 8) return '••••';
    return '${iban.substring(0, 4)} •••• ${iban.substring(iban.length - 4)}';
  }

  String _getFrequencyLabel(String frequency) {
    switch (frequency) {
       case 'weekly':
        return 'driver.earnings_frequency_weekly'.tr();
      case 'monthly':
        return 'driver.earnings_frequency_monthly'.tr();
      case 'manual':
        return 'driver.earnings_frequency_manual'.tr();
      default:
        return 'driver.earnings_frequency_not_set'.tr();
    }
  }

  void _openBankSetup() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const _BankAccountSetupPage()),
    ).then((_) => _loadDriverProfile());
  }

  void _openPayoutSettings() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const _PayoutSettingsPage()),
    ).then((_) => _loadDriverProfile());
  }
}

/// Simple earnings entry (privacy-safe: no customer data)
class _EarningsEntry {
  final String orderId;
  final String orderNumber;
  final DateTime deliveredAt;
  final double totalAmount;
  final double tipAmount;
  final String city;
  final String paymentMethod;

  _EarningsEntry({
    required this.orderId,
    required this.orderNumber,
    required this.deliveredAt,
    required this.totalAmount,
    required this.tipAmount,
    required this.city,
    required this.paymentMethod,
  });
}

// ─────────────────────────────────────────────
// Bank Account Setup Page (inline)
// ─────────────────────────────────────────────
class _BankAccountSetupPage extends StatefulWidget {
  const _BankAccountSetupPage();

  @override
  State<_BankAccountSetupPage> createState() => _BankAccountSetupPageState();
}

class _BankAccountSetupPageState extends State<_BankAccountSetupPage> {
  final _formKey = GlobalKey<FormState>();
  final _ibanController = TextEditingController();
  final _holderController = TextEditingController();
  final _bicController = TextEditingController();
  
  // Legal declaration
  String _employmentType = 'lokma'; // 'lokma' or 'external'
  String? _externalEmployer;
  String _externalType = 'minijob'; // 'minijob', 'teilzeit', 'vollzeit'
  bool _legalAccepted = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final doc = await FirebaseFirestore.instance.collection('admins').doc(uid).get();
    if (doc.exists && mounted) {
      final data = doc.data()!;
      final bank = data['bankAccount'] as Map<String, dynamic>?;
      final legal = data['legalDeclaration'] as Map<String, dynamic>?;
      if (bank != null) {
        _ibanController.text = bank['iban'] ?? '';
        _holderController.text = bank['accountHolder'] ?? '';
        _bicController.text = bank['bic'] ?? '';
      }
      if (legal != null) {
        setState(() {
          _employmentType = legal['type'] ?? 'lokma';
          _externalEmployer = legal['employerName'];
          _externalType = legal['employmentType'] ?? 'minijob';
          _legalAccepted = true;
        });
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_legalAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('driver.earnings_please_accept_legal'.tr()), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isSaving = true);
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    await FirebaseFirestore.instance.collection('admins').doc(uid).update({
      'bankAccount': {
        'iban': _ibanController.text.trim().replaceAll(' ', ''),
        'accountHolder': _holderController.text.trim(),
        'bic': _bicController.text.trim(),
        'verified': false,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      'legalDeclaration': {
        'type': _employmentType,
        if (_employmentType == 'external') 'employerName': _externalEmployer,
        if (_employmentType == 'external') 'employmentType': _externalType,
        'acceptedAt': FieldValue.serverTimestamp(),
      },
      'tipPayoutEnabled': true,
    });

    if (mounted) {
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('driver.earnings_bank_saved'.tr()), backgroundColor: Colors.green),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text('driver.earnings_bank_title'.tr()),
        backgroundColor: isDark ? Colors.grey.shade900 : Colors.white,
        foregroundColor: isDark ? Colors.white : Colors.black87,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Bank Account Section
            _sectionHeader('driver.earnings_bank_info'.tr(), Icons.account_balance),
            const SizedBox(height: 12),
            TextFormField(
              controller: _ibanController,
              decoration: _inputDecoration('IBAN', 'DE89 3704 0044 0532 0130 00', isDark),
              validator: (v) => (v == null || v.replaceAll(' ', '').length < 15) ? 'driver.earnings_valid_iban_required'.tr() : null,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9 ]'))],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _holderController,
              decoration: _inputDecoration('driver.earnings_account_holder'.tr(), 'Max Mustermann', isDark),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'driver.earnings_account_holder_required'.tr() : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _bicController,
              decoration: _inputDecoration('driver.earnings_bic_optional'.tr(), 'COBADEFFXXX', isDark),
              textCapitalization: TextCapitalization.characters,
            ),
            const SizedBox(height: 6),
            Text(
              'driver.earnings_iban_must_be_yours'.tr(),
              style: TextStyle(fontSize: 11, color: Colors.orange.shade600),
            ),

            const SizedBox(height: 28),

            // Legal Declaration Section
            _sectionHeader('driver.earnings_legal_declaration'.tr(), Icons.gavel),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.withValues(alpha: 0.15)),
              ),
              child: Text(
                'driver.earnings_legal_info'.tr(),
                style: TextStyle(fontSize: 12, color: Colors.blue.shade600),
              ),
            ),
            const SizedBox(height: 14),

            // Employment type selection
            _radioTile(
              'driver.earnings_employed_at_lokma'.tr(),
              'driver.earnings_employed_at_lokma_sub'.tr(),
              'lokma',
              isDark,
            ),
            const SizedBox(height: 8),
            _radioTile(
              'driver.earnings_employed_external'.tr(),
              'driver.earnings_employed_external_sub'.tr(),
              'external',
              isDark,
            ),

            if (_employmentType == 'external') ...[
              const SizedBox(height: 12),
              TextFormField(
                decoration: _inputDecoration('driver.earnings_employer_name'.tr(), 'Firma GmbH', isDark),
                initialValue: _externalEmployer,
                onChanged: (v) => _externalEmployer = v,
                validator: (v) => (_employmentType == 'external' && (v == null || v.trim().isEmpty))
                    ? 'driver.earnings_employer_required'.tr()
                    : null,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _employmentChip('Minijob', 'minijob', isDark),
                  const SizedBox(width: 8),
                  _employmentChip('Teilzeit', 'teilzeit', isDark),
                  const SizedBox(width: 8),
                  _employmentChip('Vollzeit', 'vollzeit', isDark),
                ],
              ),
            ],

            const SizedBox(height: 20),

            // Legal acceptance checkbox
            CheckboxListTile(
              value: _legalAccepted,
              onChanged: (v) => setState(() => _legalAccepted = v ?? false),
              title: Text(
                'driver.earnings_legal_accept'.tr(),
                style: TextStyle(fontSize: 12),
              ),
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: const Color(0xFFFE0032),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 24),

            // Save button
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFE0032),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: _isSaving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('driver.earnings_confirm_and_enable'.tr(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFFFE0032)),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ],
    );
  }

  InputDecoration _inputDecoration(String label, String hint, bool isDark) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: isDark ? Colors.grey.shade900 : Colors.grey.shade50,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: isDark ? Colors.grey.shade700 : Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFFE0032), width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    );
  }

  Widget _radioTile(String title, String subtitle, String value, bool isDark) {
    final isSelected = _employmentType == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _employmentType = value);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFFE0032).withValues(alpha: 0.06)
              : isDark ? Colors.grey.shade900 : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFFFE0032) : (isDark ? Colors.grey.shade700 : Colors.grey.shade300),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected ? const Color(0xFFFE0032) : Colors.grey,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _employmentChip(String label, String value, bool isDark) {
    final isSelected = _externalType == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _externalType = value);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFE0032) : (isDark ? Colors.grey.shade800 : Colors.grey.shade100),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFFFE0032) : Colors.grey.shade400),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : (isDark ? Colors.grey.shade300 : Colors.grey.shade700),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _ibanController.dispose();
    _holderController.dispose();
    _bicController.dispose();
    super.dispose();
  }
}

// ─────────────────────────────────────────────
// Payout Settings Page (inline)
// ─────────────────────────────────────────────
class _PayoutSettingsPage extends StatefulWidget {
  const _PayoutSettingsPage();

  @override
  State<_PayoutSettingsPage> createState() => _PayoutSettingsPageState();
}

class _PayoutSettingsPageState extends State<_PayoutSettingsPage> {
  String _frequency = 'weekly';
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final doc = await FirebaseFirestore.instance.collection('admins').doc(uid).get();
    if (doc.exists && mounted) {
      final prefs = (doc.data()!['payoutPreferences'] as Map<String, dynamic>?);
      if (prefs != null) {
        setState(() => _frequency = prefs['frequency'] ?? 'weekly');
      }
    }
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    await FirebaseFirestore.instance.collection('admins').doc(uid).update({
      'payoutPreferences': {
        'frequency': _frequency,
        'updatedAt': FieldValue.serverTimestamp(),
      },
    });

    if (mounted) {
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('driver.earnings_payout_saved'.tr()), backgroundColor: Colors.green),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text('driver.earnings_payout_title'.tr()),
        backgroundColor: isDark ? Colors.grey.shade900 : Colors.white,
        foregroundColor: isDark ? Colors.white : Colors.black87,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'driver.earnings_payout_description'.tr(),
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 6),
          Text(
            'driver.earnings_min_payout'.tr(args: [CurrencyUtils.getCurrencySymbol()]),
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.blue.shade600),
          ),
          const SizedBox(height: 20),

          _payoutOption(
            icon: Icons.calendar_view_week,
            title: 'driver.earnings_weekly'.tr(),
            subtitle: 'driver.earnings_weekly_sub'.tr(),
            value: 'weekly',
            isDark: isDark,
          ),
          const SizedBox(height: 10),
          _payoutOption(
            icon: Icons.calendar_month,
            title: 'driver.earnings_monthly'.tr(),
            subtitle: 'driver.earnings_monthly_sub'.tr(),
            value: 'monthly',
            isDark: isDark,
          ),
          const SizedBox(height: 10),
          _payoutOption(
            icon: Icons.touch_app,
            title: 'driver.earnings_manual'.tr(),
            subtitle: 'driver.earnings_manual_sub'.tr(),
            value: 'manual',
            isDark: isDark,
          ),

          const SizedBox(height: 30),

          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFE0032),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _isSaving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('driver.earnings_save'.tr(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _payoutOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required String value,
    required bool isDark,
  }) {
    final isSelected = _frequency == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _frequency = value);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFFE0032).withValues(alpha: 0.06)
              : isDark ? Colors.grey.shade900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? const Color(0xFFFE0032) : (isDark ? Colors.grey.shade700 : Colors.grey.shade300),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 28, color: isSelected ? const Color(0xFFFE0032) : Colors.grey),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isSelected ? const Color(0xFFFE0032) : (isDark ? Colors.white : Colors.grey.shade800),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),
            if (isSelected) const Icon(Icons.check_circle, color: Color(0xFFFE0032), size: 24),
          ],
        ),
      ),
    );
  }
}
