import 'package:flutter/material.dart';
import '../../services/rating_service.dart';

/// Rating screen for post-delivery feedback
class RatingScreen extends StatefulWidget {
  final String orderId;
  final String businessId;
  final String businessName;
  final String? courierId;
  final String? courierName;
  final String userId;

  const RatingScreen({
    super.key,
    required this.orderId,
    required this.businessId,
    required this.businessName,
    this.courierId,
    this.courierName,
    required this.userId,
  });

  @override
  State<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends State<RatingScreen> {
  final RatingService _ratingService = RatingService();
  final TextEditingController _businessCommentController = TextEditingController();
  final TextEditingController _courierCommentController = TextEditingController();

  int _businessRating = 0;
  int _courierRating = 0;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _businessCommentController.dispose();
    _courierCommentController.dispose();
    super.dispose();
  }

  Future<void> _submitRating() async {
    if (_businessRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen işletmeyi puanlayın')),
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
        businessComment: _businessCommentController.text.trim().isNotEmpty
            ? _businessCommentController.text.trim()
            : null,
        courierId: widget.courierId,
        courierRating: _courierRating > 0 ? _courierRating : null,
        courierComment: _courierCommentController.text.trim().isNotEmpty
            ? _courierCommentController.text.trim()
            : null,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Değerlendirmeniz kaydedildi. Teşekkürler! 🎉'),
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

  Widget _buildStarRating({
    required int rating,
    required ValueChanged<int> onRatingChanged,
    required String label,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(5, (index) {
            final starIndex = index + 1;
            return GestureDetector(
              onTap: () => onRatingChanged(starIndex),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Icon(
                  starIndex <= rating ? Icons.star : Icons.star_border,
                  size: 40,
                  color: starIndex <= rating ? Colors.amber : Colors.grey.shade400,
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 4),
        Center(
          child: Text(
            rating == 0
                ? 'Dokunarak puan verin'
                : _getRatingText(rating),
            style: TextStyle(
              fontSize: 14,
              color: rating == 0 ? Colors.grey : Colors.black87,
            ),
          ),
        ),
      ],
    );
  }

  String _getRatingText(int rating) {
    switch (rating) {
      case 1:
        return 'Çok Kötü 😞';
      case 2:
        return 'Kötü 😕';
      case 3:
        return 'Orta 😐';
      case 4:
        return 'İyi 😊';
      case 5:
        return 'Mükemmel 🤩';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Değerlendirme'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green, size: 48),
                  const SizedBox(height: 8),
                  const Text(
                    'Siparişiniz Teslim Edildi!',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Deneyiminizi bizimle paylaşır mısınız?',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Business Rating
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.store, color: Colors.deepOrange),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            widget.businessName,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildStarRating(
                      rating: _businessRating,
                      onRatingChanged: (r) => setState(() => _businessRating = r),
                      label: 'İşletmeyi Puanlayın *',
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _businessCommentController,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'Yorumunuz (opsiyonel)',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Courier Rating (if applicable)
            if (widget.courierId != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.delivery_dining, color: Colors.blue),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              widget.courierName ?? 'Kurye',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildStarRating(
                        rating: _courierRating,
                        onRatingChanged: (r) => setState(() => _courierRating = r),
                        label: 'Kuryeyi Puanlayın',
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _courierCommentController,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Yorumunuz (opsiyonel)',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Submit Button
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitRating,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepOrange,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
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
                  : const Text(
                      'Değerlendirmeyi Gönder',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
            ),
            const SizedBox(height: 16),

            // Skip Button
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'Şimdilik Geç',
                style: TextStyle(color: Colors.grey),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
