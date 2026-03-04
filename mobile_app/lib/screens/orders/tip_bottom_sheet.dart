import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../utils/currency_utils.dart';

/// Bahşiş (Tip) Bottom Sheet — Shown after order delivery
/// Lets customers tip the courier with predefined amounts or custom entry.
class TipBottomSheet extends StatefulWidget {
  final String orderId;
  final String courierName;
  final double orderTotal;

  const TipBottomSheet({
    super.key,
    required this.orderId,
    required this.courierName,
    required this.orderTotal,
  });

  /// Shows the tipping sheet — call after delivery confirmation
  static Future<double?> show(BuildContext context, {
    required String orderId,
    required String courierName,
    required double orderTotal,
  }) {
    return showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TipBottomSheet(
        orderId: orderId,
        courierName: courierName,
        orderTotal: orderTotal,
      ),
    );
  }

  @override
  State<TipBottomSheet> createState() => _TipBottomSheetState();
}

class _TipBottomSheetState extends State<TipBottomSheet> {
  static const Color accent = Color(0xFFFB335B);

  double? _selectedTip;
  bool _isCustom = false;
  bool _isSending = false;
  final TextEditingController _customController = TextEditingController();

  // Predefined tip amounts
  List<double> get _tipOptions {
    final total = widget.orderTotal;
    return [
      double.parse((total * 0.10).toStringAsFixed(2)), // 10%
      double.parse((total * 0.15).toStringAsFixed(2)), // 15%
      double.parse((total * 0.20).toStringAsFixed(2)), // 20%
    ];
  }

  List<String> get _tipLabels => ['10%', '15%', '20%'];

  Future<void> _sendTip() async {
    double tipAmount;
    
    if (_isCustom) {
      final parsed = double.tryParse(_customController.text.replaceAll(',', '.'));
      if (parsed == null || parsed <= 0) return;
      tipAmount = parsed;
    } else if (_selectedTip != null) {
      tipAmount = _selectedTip!;
    } else {
      return;
    }

    setState(() => _isSending = true);

    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;
      
      // Save tip to order document
      await FirebaseFirestore.instance
          .collection('meat_orders')
          .doc(widget.orderId)
          .update({
            'tip': tipAmount,
            'tipGivenAt': FieldValue.serverTimestamp(),
            'tipGivenBy': userId,
          });

      if (mounted) {
        HapticFeedback.mediumImpact();
        Navigator.of(context).pop(tipAmount);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.courierName}\'a ${CurrencyUtils.getCurrencySymbol()}${tipAmount.toStringAsFixed(2)} bahşiş gönderildi! 🎉'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: accent,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Bahşiş gönderilemedi, lütfen tekrar deneyin'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red[400],
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : Colors.black87;
    final textSecondary = isDark ? Colors.grey[400] : Colors.grey[600];
    final cardBg = isDark ? const Color(0xFF2A2A2A) : Colors.white;
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(bottom: bottomPadding),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle bar
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[700] : Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              const SizedBox(height: 20),
              
              // Header emoji + title
              const Text('🎉', style: TextStyle(fontSize: 40)),
              const SizedBox(height: 12),
              
              Text(
                'Siparişin teslim edildi!',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: textPrimary,
                ),
              ),
              
              const SizedBox(height: 8),
              
              Text(
                '${widget.courierName} için bahşiş bırakmak ister misin?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: textSecondary,
                  height: 1.4,
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Tip options
              Row(
                children: List.generate(3, (index) {
                  final amount = _tipOptions[index];
                  final label = _tipLabels[index];
                  final isActive = !_isCustom && _selectedTip == amount;
                  
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        left: index == 0 ? 0 : 6,
                        right: index == 2 ? 0 : 6,
                      ),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          setState(() {
                            _selectedTip = amount;
                            _isCustom = false;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            color: isActive
                                ? accent.withValues(alpha: 0.1)
                                : (isDark ? Colors.grey[850] : Colors.grey[100]),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isActive ? accent : Colors.transparent,
                              width: 2,
                            ),
                          ),
                          child: Column(
                            children: [
                              Text(
                                label,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: isActive ? accent : textSecondary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${CurrencyUtils.getCurrencySymbol()}${amount.toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: isActive ? accent : textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
              
              const SizedBox(height: 12),
              
              // Custom amount option
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  setState(() {
                    _isCustom = true;
                    _selectedTip = null;
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                  decoration: BoxDecoration(
                    color: _isCustom
                        ? accent.withValues(alpha: 0.1)
                        : (isDark ? Colors.grey[850] : Colors.grey[100]),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _isCustom ? accent : Colors.transparent,
                      width: 2,
                    ),
                  ),
                  child: _isCustom
                      ? Row(
                          children: [
                            Text(
                              CurrencyUtils.getCurrencySymbol(),
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: accent,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: _customController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                autofocus: true,
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: textPrimary,
                                ),
                                decoration: InputDecoration(
                                  hintText: 'Tutar girin',
                                  hintStyle: TextStyle(color: Colors.grey[500]),
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                          ],
                        )
                      : Center(
                          child: Text(
                            'Özel Tutar',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: textSecondary,
                            ),
                          ),
                        ),
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Send Tip button
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: (_selectedTip != null || _isCustom) && !_isSending
                      ? _sendTip
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: isDark ? Colors.grey[800] : Colors.grey[300],
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: _isSending
                      ? const SizedBox(
                          width: 24, height: 24,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text(
                          'Bahşiş Gönder 💝',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                        ),
                ),
              ),
              
              const SizedBox(height: 10),
              
              // Skip
              TextButton(
                onPressed: () => Navigator.of(context).pop(null),
                child: Text(
                  'Şimdilik geç',
                  style: TextStyle(
                    color: textSecondary,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
