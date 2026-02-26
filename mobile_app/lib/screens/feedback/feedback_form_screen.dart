import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class FeedbackFormScreen extends StatefulWidget {
  const FeedbackFormScreen({super.key});

  @override
  State<FeedbackFormScreen> createState() => _FeedbackFormScreenState();
}

class _FeedbackFormScreenState extends State<FeedbackFormScreen> {
  static const Color lokmaRed = Color(0xFFFB335B);
  static const Color blackPure = Color(0xFF000000);
  static const Color surfaceCard = Color(0xFF181818);
  static const Color borderSubtle = Color(0xFF262626);

  // Ratings (1-5, 0 = not rated)
  int _productPortfolioRating = 0;
  int _appUsabilityRating = 0;
  int _deliverySpeedRating = 0;
  int _overallExperienceRating = 0;
  
  // Courier-specific ratings
  int _foodFreshnessRating = 0;
  int _courierProfessionalismRating = 0;
  final bool _wasDeliveryOrder = true; // Assume delivery by default

  final TextEditingController _noteController = TextEditingController();
  bool _isSubmitting = false;
  bool _hasSubmittedThisMonth = false;
  String? _lastOrderBusinessId;
  String? _lastOrderBusinessName;

  @override
  void initState() {
    super.initState();
    _checkMonthlySubmission();
    _getLastOrderBusiness();
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _checkMonthlySubmission() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);

    try {
      final query = await FirebaseFirestore.instance
          .collection('feedback')
          .where('userId', isEqualTo: user.uid)
          .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(monthStart))
          .limit(1)
          .get();

      if (query.docs.isNotEmpty) {
        setState(() => _hasSubmittedThisMonth = true);
      }
    } catch (e) {
      debugPrint('Error checking monthly submission: $e');
    }
  }

  Future<void> _getLastOrderBusiness() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final query = await FirebaseFirestore.instance
          .collection('meat_orders')
          .where('customerId', isEqualTo: user.uid)
          .orderBy('createdAt', descending: true)
          .limit(1)
          .get();

      if (query.docs.isNotEmpty) {
        final order = query.docs.first.data();
        setState(() {
          _lastOrderBusinessId = order['businessId'] as String?;
          _lastOrderBusinessName = order['businessName'] as String? ?? 'İşletme';
        });
      }
    } catch (e) {
      debugPrint('Error getting last order: $e');
    }
  }

  Future<void> _submitFeedback() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('auth.login_required_for_feedback')), backgroundColor: Colors.amber),
      );
      return;
    }

    // Validate at least one rating
    if (_productPortfolioRating == 0 && 
        _appUsabilityRating == 0 && _deliverySpeedRating == 0 && _overallExperienceRating == 0 &&
        _foodFreshnessRating == 0 && _courierProfessionalismRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('common.rate_at_least_one_category')), backgroundColor: Colors.amber),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    HapticFeedback.mediumImpact();

    try {
      // Create anonymous feedback document
      final feedbackData = {
        'userId': user.uid, // For checking monthly limit, not shared with business
        'businessId': _lastOrderBusinessId, // Linked to business for performance
        'ratings': {
          'productPortfolio': _productPortfolioRating,
          'appUsability': _appUsabilityRating,
          'deliverySpeed': _deliverySpeedRating,
          'overallExperience': _overallExperienceRating,
          'foodFreshness': _foodFreshnessRating,
          'courierProfessionalism': _courierProfessionalismRating,
        },
        'averageRating': _calculateAverageRating(),
        'note': _noteController.text.trim().isNotEmpty ? _noteController.text.trim() : null,
        'createdAt': FieldValue.serverTimestamp(),
        'month': '${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}',
        'isAnonymous': true, // Always anonymous
        'wasDeliveryOrder': _wasDeliveryOrder,
      };

      await FirebaseFirestore.instance.collection('feedback').add(feedbackData);

      // Update business performance metrics (aggregate only, no customer info)
      if (_lastOrderBusinessId != null) {
        await _updateBusinessPerformance();
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.thank_you_for_feedback_pray')), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('Error submitting feedback: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  double _calculateAverageRating() {
    int count = 0;
    int total = 0;
    
    if (_productPortfolioRating > 0) { total += _productPortfolioRating; count++; }
    if (_appUsabilityRating > 0) { total += _appUsabilityRating; count++; }
    if (_deliverySpeedRating > 0) { total += _deliverySpeedRating; count++; }
    if (_overallExperienceRating > 0) { total += _overallExperienceRating; count++; }
    if (_foodFreshnessRating > 0) { total += _foodFreshnessRating; count++; }
    if (_courierProfessionalismRating > 0) { total += _courierProfessionalismRating; count++; }
    
    return count > 0 ? total / count : 0;
  }

  Future<void> _updateBusinessPerformance() async {
    if (_lastOrderBusinessId == null) return;

    try {
      final businessRef = FirebaseFirestore.instance
          .collection('businesses')
          .doc(_lastOrderBusinessId);

      // Run transaction to update aggregate metrics
      await FirebaseFirestore.instance.runTransaction((transaction) async {
        final snapshot = await transaction.get(businessRef);
        
        if (!snapshot.exists) return;
        
        final data = snapshot.data() ?? {};
        final performance = data['performanceMetrics'] as Map<String, dynamic>? ?? {};
        
        final currentCount = (performance['feedbackCount'] as int?) ?? 0;
        final currentAvg = (performance['averageRating'] as num?)?.toDouble() ?? 0.0;
        
        final newCount = currentCount + 1;
        final newAvg = ((currentAvg * currentCount) + _calculateAverageRating()) / newCount;
        
        // Update delivery speed metric if rated
        double newDeliveryAvg = (performance['avgDeliveryRating'] as num?)?.toDouble() ?? 0.0;
        int deliveryCount = (performance['deliveryRatingCount'] as int?) ?? 0;
        if (_deliverySpeedRating > 0) {
          deliveryCount++;
          newDeliveryAvg = ((newDeliveryAvg * (deliveryCount - 1)) + _deliverySpeedRating) / deliveryCount;
        }
        
        transaction.update(businessRef, {
          'performanceMetrics': {
            ...performance,
            'feedbackCount': newCount,
            'averageRating': newAvg,
            'avgDeliveryRating': newDeliveryAvg,
            'deliveryRatingCount': deliveryCount,
            'lastFeedbackAt': FieldValue.serverTimestamp(),
          },
        });
      });
    } catch (e) {
      debugPrint('Error updating business performance: $e');
    }
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
        title: const Text('Geri Bildirim', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: _hasSubmittedThisMonth
          ? _buildAlreadySubmitted()
          : _buildFeedbackForm(),
    );
  }

  Widget _buildAlreadySubmitted() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle, color: Colors.green[400], size: 80),
            const SizedBox(height: 24),
            const Text(
              'Bu Ay Zaten Değerlendirdiniz',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Her ay bir kez geri bildirim verebilirsiniz.\nGelecek ay tekrar değerlendirebilirsiniz!',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeedbackForm() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Intro text
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: surfaceCard,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '📝 Görüşleriniz Bizim İçin Değerli',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _lastOrderBusinessName != null
                    ? 'Son siparişiniz: $_lastOrderBusinessName'
                    : 'Hizmetlerimizi değerlendirin',
                style: TextStyle(color: Colors.grey[400], fontSize: 13),
              ),
              const SizedBox(height: 4),
              Text(
                'Geri bildiriminiz anonim olarak işlenir.',
                style: TextStyle(color: Colors.grey[600], fontSize: 12, fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Rating categories
        _buildRatingCategory(
          '🛒 Ürün Çeşitliliği',
          'Ürün portföyü ve seçenekler',
          _productPortfolioRating,
          (rating) => setState(() => _productPortfolioRating = rating),
        ),

        _buildRatingCategory(
          '📱 Uygulama Kullanımı',
          'App\'in kullanım kolaylığı',
          _appUsabilityRating,
          (rating) => setState(() => _appUsabilityRating = rating),
        ),

        _buildRatingCategory(
          '🚚 Teslimat Hızı',
          'Siparişin size ulaşma süresi',
          _deliverySpeedRating,
          (rating) => setState(() => _deliverySpeedRating = rating),
        ),

        _buildRatingCategory(
          '⭐ Genel Deneyim',
          'Toplam memnuniyet',
          _overallExperienceRating,
          (rating) => setState(() => _overallExperienceRating = rating),
        ),

        const SizedBox(height: 24),

        // === COURIER RATINGS SECTION ===
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.delivery_dining, color: Colors.amber, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Kurye Değerlendirmesi',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),

        _buildRatingCategory(
          '🍲 Ürün Kalitesi',
          'Siparişiniz sıcak/taze geldi mi?',
          _foodFreshnessRating,
          (rating) => setState(() => _foodFreshnessRating = rating),
        ),

        _buildRatingCategory(
          '😊 Kurye Hizmeti',
          'Kurye güler yüzlü ve profesyoneldi',
          _courierProfessionalismRating,
          (rating) => setState(() => _courierProfessionalismRating = rating),
        ),

        const SizedBox(height: 24),

        // Note field
        const Text(
          'Eklemek İstediğiniz Not',
          style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _noteController,
          maxLines: 4,
          maxLength: 500,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Görüşlerinizi buraya yazabilirsiniz... (Opsiyonel)',
            hintStyle: TextStyle(color: Colors.grey[600]),
            filled: true,
            fillColor: surfaceCard,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: borderSubtle),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: lokmaRed),
            ),
            counterStyle: TextStyle(color: Colors.grey[600]),
          ),
        ),

        const SizedBox(height: 32),

        // Submit button
        GestureDetector(
          onTap: _isSubmitting ? null : _submitFeedback,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: _isSubmitting ? Colors.grey : lokmaRed,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text(
                      'Gönder',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ),

        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildRatingCategory(String title, String subtitle, int currentRating, Function(int) onRatingChanged) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(5, (index) {
              final rating = index + 1;
              final isSelected = currentRating >= rating;
              return GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onRatingChanged(rating);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.all(8),
                  child: Icon(
                    isSelected ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: isSelected ? Colors.amber : Colors.grey[600],
                    size: 36,
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
