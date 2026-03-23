import 'dart:async';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/tap_to_pay_service.dart';
import '../../utils/currency_utils.dart';

/// NFC Temassız Ödeme Bottom Sheet
/// Kurye ve garson senaryoları için generic kullanılabilir.
///
/// Kullanım:
///   final result = await TapToPaySheet.show(
///     context: context, amount: 42.50,
///     businessId: 'biz123', orderId: 'ord456');
class TapToPaySheet extends StatefulWidget {
  final double amount;
  final String businessId;
  final String orderId;
  final String? courierId;
  final String? label; // "Kapıda Ödeme" veya "Masa Ödemesi"

  const TapToPaySheet({
    super.key,
    required this.amount,
    required this.businessId,
    required this.orderId,
    this.courierId,
    this.label,
  });

  /// Kolaylaştırıcı static show metodu
  static Future<TapToPayResult?> show({
    required BuildContext context,
    required double amount,
    required String businessId,
    required String orderId,
    String? courierId,
    String? label,
  }) {
    return showModalBottomSheet<TapToPayResult>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => TapToPaySheet(
        amount: amount,
        businessId: businessId,
        orderId: orderId,
        courierId: courierId,
        label: label,
      ),
    );
  }

  @override
  State<TapToPaySheet> createState() => _TapToPaySheetState();
}

class _TapToPaySheetState extends State<TapToPaySheet>
    with TickerProviderStateMixin {
  _PayState _state = _PayState.idle;
  String _statusText = '';
  String? _errorText;
  late AnimationController _ringController;
  late AnimationController _checkController;
  late Animation<double> _ringAnim;
  late Animation<double> _checkAnim;

  @override
  void initState() {
    super.initState();

    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    _ringAnim = CurvedAnimation(parent: _ringController, curve: Curves.easeOut);

    _checkController = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _checkAnim = CurvedAnimation(parent: _checkController, curve: Curves.easeOut);

    WidgetsBinding.instance.addPostFrameCallback((_) => _startPayment());
  }

  @override
  void dispose() {
    _ringController.dispose();
    _checkController.dispose();
    super.dispose();
  }

  Future<void> _startPayment() async {
    setState(() {
      _state = _PayState.processing;
      _statusText = tr('common.preparing');
    });

    final result = await TapToPayService.collectPayment(
      amount: widget.amount,
      businessId: widget.businessId,
      orderId: widget.orderId,
      courierId: widget.courierId,
      onStatusChange: (status) {
        if (mounted) setState(() => _statusText = status);
      },
    );

    if (!mounted) return;

    if (result.success) {
      HapticFeedback.heavyImpact();
      _ringController.stop();
      setState(() {
        _state = _PayState.success;
        _statusText = tr('payments.card_payment_received');
      });
      _checkController.forward();
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) Navigator.pop(context, result);
    } else if (result.wasCancelled) {
      if (mounted) Navigator.pop(context, result);
    } else {
      HapticFeedback.vibrate();
      setState(() {
        _state = _PayState.error;
        _errorText = result.error ?? tr('common.error_occurred');
        _statusText = tr('common.operation_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 24),

          // Label
          Text(
            widget.label ?? tr('payments.card'),
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 8),

          // Amount
          Text(
            '${widget.amount.toStringAsFixed(2)}${CurrencyUtils.getCurrencySymbol()}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 42,
              fontWeight: FontWeight.w600,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 36),

          // NFC Animation / Check / Error
          SizedBox(
            height: 140,
            child: _state == _PayState.success
                ? _buildSuccessWidget()
                : _state == _PayState.error
                    ? _buildErrorWidget()
                    : _buildNfcRingWidget(),
          ),

          const SizedBox(height: 24),

          // Status text
          Text(
            _statusText,
            style: TextStyle(
              color: _state == _PayState.error ? Colors.red[300] : Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),

          if (_errorText != null) ...[
            const SizedBox(height: 8),
            Text(
              _errorText!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ],

          const SizedBox(height: 28),

          // Buttons
          if (_state == _PayState.processing)
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white30),
                foregroundColor: Colors.white70,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                TapToPayService.disconnect();
                Navigator.pop(context, TapToPayResult(success: false, wasCancelled: true));
              },
              child: Text('common.cancel'.tr()),
            ),

          if (_state == _PayState.error)
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEA184A),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _startPayment,
              child: Text(tr('common.try_again'), style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }

  Widget _buildNfcRingWidget() {
    return AnimatedBuilder(
      animation: _ringAnim,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            // Dış ring — pulse
            Transform.scale(
              scale: 0.6 + (_ringAnim.value * 0.4),
              child: Opacity(
                opacity: 1 - _ringAnim.value,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFEA184A), width: 2),
                  ),
                ),
              ),
            ),
            // İç ring
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFEA184A).withValues(alpha: 0.15),
                border: Border.all(color: const Color(0xFFEA184A), width: 2),
              ),
              child: const Icon(Icons.contactless, color: Color(0xFFEA184A), size: 36),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSuccessWidget() {
    return ScaleTransition(
      scale: _checkAnim,
      child: Container(
        width: 100,
        height: 100,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: Color(0xFF00C853),
        ),
        child: const Icon(Icons.check_rounded, color: Colors.white, size: 56),
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.red.withValues(alpha: 0.15),
        border: Border.all(color: Colors.red, width: 2),
      ),
      child: const Icon(Icons.error_outline, color: Colors.red, size: 48),
    );
  }
}

enum _PayState { idle, processing, success, error }
