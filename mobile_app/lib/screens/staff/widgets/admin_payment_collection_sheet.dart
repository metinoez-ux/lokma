import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:lokma_app/models/kermes_order_model.dart';
import 'package:lokma_app/services/kermes_order_service.dart';
import 'package:lokma_app/utils/currency_utils.dart';

class AdminPaymentCollectionSheet extends StatefulWidget {
  final KermesOrder order;

  const AdminPaymentCollectionSheet({
    super.key,
    required this.order,
  });

  @override
  State<AdminPaymentCollectionSheet> createState() => _AdminPaymentCollectionSheetState();
}

class _AdminPaymentCollectionSheetState extends State<AdminPaymentCollectionSheet> {
  bool _isLoading = false;
  bool _isSuccess = false;

  Future<void> _handlePaymentConfirmation() async {
    final result = await _showCashReceivedDialog(widget.order.totalAmount);
    if (result == null) return; // Kullanici iptal etti

    setState(() => _isLoading = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      final changeGiven = (result - widget.order.totalAmount).clamp(0.0, double.infinity);
      
      await KermesOrderService().markAsPaid(
        widget.order.id, 
        collectorId: user?.uid,
        cashReceived: result,
        changeGiven: changeGiven,
      );
      
      if (mounted) {
        setState(() => _isSuccess = true);
        Future.delayed(const Duration(milliseconds: 1500), () {
          if (mounted) {
            Navigator.pop(context, true); // Return true indicating success
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 24),
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey[700] : Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              if (_isSuccess) ...[
                const SizedBox(height: 20),
                const Icon(Icons.check_circle, color: Colors.green, size: 80),
                const SizedBox(height: 16),
                const Text(
                  'Tahsilat Onaylandı!',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Sipariş başarıyla ödendi olarak işaretlendi.',
                  style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),
              ] else ...[
                // Order Info Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF41C54).withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.receipt_long_rounded,
                        color: Color(0xFFF41C54),
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Sipariş #${widget.order.orderNumber}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.order.customerName,
                            style: TextStyle(
                              fontSize: 14,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 24),
                
                // Details Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF2C2C2E) : Colors.grey[50],
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark ? Colors.white12 : Colors.grey[200]!,
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Ürün Adedi',
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                          ),
                          Text(
                            '${widget.order.items.length} adet',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Ödeme Durumu',
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: widget.order.isPaid 
                                  ? Colors.green.withOpacity(0.15) 
                                  : Colors.orange.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              widget.order.isPaid ? 'ÖDENDİ' : 'ÖDENMEDİ',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: widget.order.isPaid ? Colors.green : Colors.orange,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Divider(height: 1),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Tahsil Edilecek Tutar',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${widget.order.totalAmount.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFF41C54),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 32),

                // Action Buttons
                if (widget.order.isPaid)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Kapat',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handlePaymentConfirmation,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 4,
                        shadowColor: Colors.green.withOpacity(0.5),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              '💵 Nakit Tahsilatı Onayla',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                            ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<double?> _showCashReceivedDialog(double orderTotal) async {
    final controller = TextEditingController();
    double? selectedAmount;

    final quickAmounts = <double>[orderTotal];
    for (final note in [5.0, 10.0, 20.0, 50.0, 100.0]) {
      final rounded = (orderTotal / note).ceil() * note;
      if (rounded > orderTotal && !quickAmounts.contains(rounded.toDouble())) {
        quickAmounts.add(rounded.toDouble());
      }
    }
    quickAmounts.sort();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    const successGreen = Color(0xFF2E7D32);
    const lokmaPink = Color(0xFFF41C54);

    return showDialog<double>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            final change = selectedAmount != null
                ? (selectedAmount! - orderTotal).clamp(0.0, double.infinity)
                : 0.0;

            return AlertDialog(
              backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.money, color: Colors.green, size: 24),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Nakit Ödeme', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87))),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Siparis tutari
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: lokmaPink.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: lokmaPink.withOpacity(0.2)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Sipariş Tutarı:', style: TextStyle(fontSize: 14, color: isDark ? Colors.white70 : Colors.black87)),
                          Text(
                            '${orderTotal.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: lokmaPink),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    Text('Alınan Tutar:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: quickAmounts.map((amount) {
                        final isExact = amount == orderTotal;
                        final isSelected = selectedAmount == amount;
                        return GestureDetector(
                          onTap: () {
                            setDialogState(() {
                              selectedAmount = amount;
                              controller.text = amount.toStringAsFixed(2);
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? successGreen
                                  : isExact
                                      ? successGreen.withOpacity(0.1)
                                      : (isDark ? Colors.white10 : Colors.grey.shade100),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? successGreen : (isDark ? Colors.white24 : Colors.grey.shade300),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Text(
                              isExact ? 'Tam ${amount.toStringAsFixed(2)}' : '${amount.toStringAsFixed(2)}',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),

                    TextField(
                      controller: controller,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                      decoration: InputDecoration(
                        hintText: 'Özel tutar gir...',
                        hintStyle: TextStyle(fontSize: 14, color: isDark ? Colors.white38 : Colors.grey.shade400),
                        prefixIcon: Icon(Icons.euro, color: isDark ? Colors.green.shade300 : Colors.green),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                      onChanged: (val) {
                        final parsed = double.tryParse(val.replaceAll(',', '.'));
                        setDialogState(() => selectedAmount = parsed);
                      },
                    ),

                    if (selectedAmount != null && change > 0) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Para Üstü:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87)),
                            Text(
                              '${change.toStringAsFixed(2)} ${CurrencyUtils.getCurrencySymbol()}',
                              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.orange),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, null),
                  child: Text('İptal', style: TextStyle(color: isDark ? Colors.white54 : Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: selectedAmount != null && selectedAmount! >= orderTotal
                      ? () => Navigator.pop(ctx, selectedAmount)
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: successGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: const Text('Tahsil Et', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
