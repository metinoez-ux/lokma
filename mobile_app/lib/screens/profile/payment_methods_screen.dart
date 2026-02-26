import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class PaymentMethodsScreen extends ConsumerStatefulWidget {
  const PaymentMethodsScreen({super.key});

  @override
  ConsumerState<PaymentMethodsScreen> createState() => _PaymentMethodsScreenState();
}

class _PaymentMethodsScreenState extends ConsumerState<PaymentMethodsScreen> {
  static const Color lokmaRed = Color(0xFFFB335B);
  static const Color blackPure = Color(0xFF000000);
  static const Color surfaceCard = Color(0xFF181818);
  static const Color textSubtle = Color(0xFF888888);
  static const Color borderSubtle = Color(0xFF262626);

  bool _isLoading = true;
  bool _isSaving = false;

  bool _cashOnDelivery = true;
  bool _cardPayment = true;
  String _defaultMethod = 'cash'; // 'cash' or 'card'

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();

      if (doc.exists && doc.data()?['paymentPreferences'] != null) {
        final prefs = doc.data()!['paymentPreferences'] as Map<String, dynamic>;
        setState(() {
          _cashOnDelivery = prefs['cashOnDelivery'] ?? true;
          _cardPayment = prefs['cardPayment'] ?? true;
          _defaultMethod = prefs['defaultMethod'] ?? 'cash';
        });
      }
    } catch (e) {
      debugPrint('Error loading payment preferences: $e');
    }

    setState(() => _isLoading = false);
  }

  Future<void> _savePreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    setState(() => _isSaving = true);
    HapticFeedback.lightImpact();

    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .set({
            'paymentPreferences': {
              'cashOnDelivery': _cashOnDelivery,
              'cardPayment': _cardPayment,
              'defaultMethod': _defaultMethod,
            },
          }, SetOptions(merge: true));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('profile.payment_prefs_saved')),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
      }
    }

    setState(() => _isSaving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: blackPure,
      appBar: AppBar(
        backgroundColor: blackPure,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Ödeme Yöntemleri', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: lokmaRed))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Info Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: lokmaRed.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: lokmaRed.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: lokmaRed, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Sipariş verirken hangi ödeme yöntemlerini kullanmak istediğinizi seçin.',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Payment Methods
                _buildSectionHeader('Ödeme Yöntemleri', Icons.payment),
                const SizedBox(height: 12),

                _buildPaymentOption(
                  title: 'Kapıda Ödeme',
                  subtitle: 'Nakit veya kapıda kart ile ödeme',
                  icon: Icons.local_shipping,
                  isEnabled: _cashOnDelivery,
                  isDefault: _defaultMethod == 'cash',
                  onToggle: (v) => setState(() {
                    _cashOnDelivery = v;
                    if (!v && _defaultMethod == 'cash') {
                      _defaultMethod = 'card';
                    }
                  }),
                  onSetDefault: () => setState(() => _defaultMethod = 'cash'),
                ),

                _buildPaymentOption(
                  title: 'Kart ile Ödeme',
                  subtitle: 'Online kredi/banka kartı ödemesi',
                  icon: Icons.credit_card,
                  isEnabled: _cardPayment,
                  isDefault: _defaultMethod == 'card',
                  onToggle: (v) => setState(() {
                    _cardPayment = v;
                    if (!v && _defaultMethod == 'card') {
                      _defaultMethod = 'cash';
                    }
                  }),
                  onSetDefault: () => setState(() => _defaultMethod = 'card'),
                ),

                const SizedBox(height: 40),

                // Save Button
                GestureDetector(
                  onTap: _isSaving ? null : _savePreferences,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: _isSaving ? lokmaRed.withValues(alpha: 0.5) : lokmaRed,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text(
                              'Kaydet',
                              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                ),

                const SizedBox(height: 20),
              ],
            ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: lokmaRed, size: 20),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Widget _buildPaymentOption({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isEnabled,
    required bool isDefault,
    required ValueChanged<bool> onToggle,
    required VoidCallback onSetDefault,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDefault ? lokmaRed : borderSubtle,
          width: isDefault ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isEnabled ? lokmaRed.withValues(alpha: 0.2) : Colors.grey.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: isEnabled ? lokmaRed : Colors.grey, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: isEnabled ? Colors.white : Colors.grey,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(color: textSubtle, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Switch(
                value: isEnabled,
                onChanged: onToggle,
                activeThumbColor: lokmaRed,
                activeTrackColor: lokmaRed.withValues(alpha: 0.4),
              ),
            ],
          ),
          if (isEnabled) ...[
            const SizedBox(height: 12),
            GestureDetector(
              onTap: isDefault ? null : onSetDefault,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isDefault ? lokmaRed.withValues(alpha: 0.2) : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isDefault ? lokmaRed : borderSubtle,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isDefault ? Icons.check_circle : Icons.radio_button_unchecked,
                      color: isDefault ? lokmaRed : textSubtle,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isDefault ? 'Varsayılan' : 'Varsayılan yap',
                      style: TextStyle(
                        color: isDefault ? lokmaRed : textSubtle,
                        fontSize: 12,
                        fontWeight: isDefault ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
