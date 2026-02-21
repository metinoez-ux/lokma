import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../services/rating_service.dart';

/// Lieferando-style rating screen for post-delivery feedback
/// Two sections:
/// 1. Business rating with 5 stars (always orange)
/// 2. Pickup/Delivery experience with 3 emoji faces
class RatingScreen extends StatefulWidget {
  final String orderId;
  final String businessId;
  final String businessName;
  final String? courierId;
  final String? courierName;
  final String userId;
  final bool isDelivery; // true = delivery (kurye), false = pickup (gel al)
  final String orderStatus; // order status to check if rating is allowed

  const RatingScreen({
    super.key,
    required this.orderId,
    required this.businessId,
    required this.businessName,
    this.courierId,
    this.courierName,
    required this.userId,
    this.isDelivery = true,
    this.orderStatus = 'pending',
  });

  @override
  State<RatingScreen> createState() => _RatingScreenState();
}


class _RatingScreenState extends State<RatingScreen> {
  final RatingService _ratingService = RatingService();
  final TextEditingController _commentController = TextEditingController();

  int _businessRating = 0; // 1-5 stars
  int _experienceRating = 0; // 1=Bad, 2=OK, 3=Great
  bool _isSubmitting = false;
  Color _brandColor = const Color(0xFFFB335B); // Default LOKMA red

  // Check if order is completed (delivered)
  bool get _isOrderCompleted => widget.orderStatus == 'delivered';

  void _showOrderNotCompletedWarning() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(tr('orders.cannot_rate_before_completion')),
        backgroundColor: Colors.amber,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _fetchBrandColor();
  }

  Future<void> _fetchBrandColor() async {
    if (widget.businessId.isEmpty) return;
    try {
      final doc = await FirebaseFirestore.instance
          .collection('businesses')
          .doc(widget.businessId)
          .get();
      if (doc.exists && mounted) {
        final data = doc.data();
        final brandColorHex = data?['brandColor'] as String?;
        if (brandColorHex != null && brandColorHex.isNotEmpty) {
          final hex = brandColorHex.replaceAll('#', '');
          setState(() {
            _brandColor = Color(int.parse('FF$hex', radix: 16));
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching brand color: $e');
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submitRating() async {
    if (_businessRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('orders.please_rate_business'))),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await _ratingService.submitRating(
        orderId: widget.orderId,
        businessId: widget.businessId,
        userId: widget.userId,
        businessRating: _businessRating,
        businessComment: _commentController.text.trim().isNotEmpty
            ? _commentController.text.trim()
            : null,
        courierId: widget.isDelivery ? widget.courierId : null,
        courierRating: _experienceRating > 0 ? _experienceRating : null,
        courierComment: null,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('orders.rating_saved_thanks')),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hata: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? colorScheme.surface : const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        elevation: 0,
        title: Text(
          'Değerlendirme Yap',
          style: TextStyle(
            color: colorScheme.onSurface,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        leading: const SizedBox(),
        actions: [
          IconButton(
            onPressed: () => Navigator.of(context).pop(false),
            icon: Icon(Icons.close, color: _brandColor),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  // Section 1: Business Rating
                  Container(
                    width: double.infinity,
                    color: colorScheme.surface,
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                    child: Column(
                      children: [
                        Text(
                          'İşletmeyi Puanla',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Yemek nasıldı? ${widget.businessName}',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey.shade600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        // 5 Star Rating - Always orange
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(5, (index) {
                            final starIndex = index + 1;
                            return GestureDetector(
                              onTap: () {
                                if (_isOrderCompleted) {
                                  setState(() => _businessRating = starIndex);
                                } else {
                                  _showOrderNotCompletedWarning();
                                }
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 6),
                                child: Icon(
                                  starIndex <= _businessRating ? Icons.star : Icons.star_border,
                                  size: 48,
                                  color: Colors.amber,
                                ),
                              ),
                            );
                          }),
                        ),

                      ],
                    ),
                  ),
                  
                  Divider(height: 1, color: isDark ? Colors.grey.shade700 : const Color(0xFFE0E0E0)),
                  
                  // Section 2: Pickup or Delivery Experience
                  Container(
                    width: double.infinity,
                    color: colorScheme.surface,
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                    child: Column(
                      children: [
                        Text(
                          widget.isDelivery ? 'Kurye Deneyimi' : 'Gel Al Deneyimi',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 20),
                        // 3 Emoji Faces - Sentiment colors
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Bad - Red
                            _buildEmojiButton(
                              emoji: '😞',
                              label: 'Kötü',
                              isSelected: _experienceRating == 1,
                              color: Colors.red,
                              onTap: () {
                                if (_isOrderCompleted) {
                                  setState(() => _experienceRating = 1);
                                } else {
                                  _showOrderNotCompletedWarning();
                                }
                              },
                            ),
                            const SizedBox(width: 16),
                            // OK - Orange
                            _buildEmojiButton(
                              emoji: '😐',
                              label: 'İdare Eder',
                              isSelected: _experienceRating == 2,
                              color: Colors.amber,
                              onTap: () {
                                if (_isOrderCompleted) {
                                  setState(() => _experienceRating = 2);
                                } else {
                                  _showOrderNotCompletedWarning();
                                }
                              },
                            ),
                            const SizedBox(width: 16),
                            // Great - Green
                            _buildEmojiButton(
                              emoji: '😊',
                              label: 'Harika',
                              isSelected: _experienceRating == 3,
                              color: Colors.green,
                              onTap: () {
                                if (_isOrderCompleted) {
                                  setState(() => _experienceRating = 3);
                                } else {
                                  _showOrderNotCompletedWarning();
                                }
                              },
                            ),
                          ],
                        ),

                      ],
                    ),
                  ),
                  
                  Divider(height: 1, color: isDark ? Colors.grey.shade700 : const Color(0xFFE0E0E0)),
                  
                  // Section 3: Comment
                  Container(
                    width: double.infinity,
                    color: colorScheme.surface,
                    padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Yorum Yazın',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: colorScheme.onSurface,
                              ),
                            ),
                            Text(
                              'İsteğe bağlı - ${_commentController.text.length}/255',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        GestureDetector(
                          onTap: _isOrderCompleted ? null : _showOrderNotCompletedWarning,
                          child: AbsorbPointer(
                            absorbing: !_isOrderCompleted,
                            child: TextField(
                              controller: _commentController,
                              maxLines: 3,
                              maxLength: 255,
                              onChanged: (_) => setState(() {}),
                              style: TextStyle(color: colorScheme.onSurface),
                              decoration: InputDecoration(
                                hintText: _isOrderCompleted 
                                    ? 'Yemek lezzetli miydi? İyi paketlendi mi? Bize bildirin...'
                                    : 'Sipariş tamamlandıktan sonra yorum yapabilirsiniz...',
                                hintStyle: TextStyle(color: colorScheme.onSurface.withOpacity(0.4), fontSize: 14),
                                counterText: '',
                                filled: true,
                                fillColor: isDark ? Colors.grey.shade800 : const Color(0xFFF5F5F5),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide.none,
                                ),
                                contentPadding: const EdgeInsets.all(16),
                              ),
                            ),
                          ),
                        ),

                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          // Submit Button - Uses brand color
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            color: colorScheme.surface,
            child: SafeArea(
              top: false,
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSubmitting 
                      ? null 
                      : (_isOrderCompleted && _businessRating > 0) 
                          ? _submitRating 
                          : _showOrderNotCompletedWarning,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _businessRating > 0 && _isOrderCompleted
                        ? _brandColor 
                        : const Color(0xFFE0E0E0),
                    foregroundColor: _businessRating > 0 && _isOrderCompleted
                        ? Colors.white 
                        : Colors.grey.shade400,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          _isOrderCompleted ? 'Gönder' : 'Sipariş Tamamlandıktan Sonra',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                ),

              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmojiButton({
    required String emoji,
    required String label,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: isSelected ? color.withOpacity(0.1) : Colors.transparent,
              border: Border.all(
                color: isSelected ? color : (isDark ? Colors.grey.shade600 : Colors.grey.shade300),
                width: isSelected ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                emoji,
                style: const TextStyle(fontSize: 32),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              color: isSelected ? color : (isDark ? Colors.grey.shade400 : Colors.grey.shade600),
            ),
          ),
        ],
      ),
    );
  }
}
