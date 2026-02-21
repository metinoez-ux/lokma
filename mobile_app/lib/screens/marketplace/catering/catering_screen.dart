import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';


class CateringScreen extends ConsumerStatefulWidget {
  const CateringScreen({super.key});

  @override
  ConsumerState<CateringScreen> createState() => _CateringScreenState();
}

class _CateringScreenState extends ConsumerState<CateringScreen> {
  // Theme colors
  static const accent = Color(0xFFFB335B); // Pink/celebration accent

  List<DocumentSnapshot> _businesses = [];
  bool _isLoading = true;
  User? _currentUser;

  @override
  void initState() {
    super.initState();
    _loadData();
    _currentUser = FirebaseAuth.instance.currentUser;
    
    // Listen to auth changes
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (mounted) {
        setState(() => _currentUser = user);
      }
    });
  }

  Future<void> _loadData() async {
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('businesses')
          .where('businessCategories', arrayContains: 'catering')
          .where('isActive', isEqualTo: true)
          .get();

      if (mounted) {
        setState(() {
          _businesses = snapshot.docs;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading catering businesses: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  bool get _isLoggedIn => _currentUser != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0A0E14) : Colors.grey[50]!;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtextColor = isDark ? Colors.white.withOpacity(0.7) : Colors.black54;
    final surfaceColor = isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.05);
    final borderColor = isDark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.1);

    return Scaffold(
      backgroundColor: bgColor,
      body: CustomScrollView(
        slivers: [
          // Header
          SliverAppBar(
            backgroundColor: bgColor,
            expandedHeight: 200,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      accent.withOpacity(0.3),
                      bgColor,
                    ],
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 60),
                    const Text('🎉', style: TextStyle(fontSize: 56)),
                    const SizedBox(height: 12),
                    Text(
                      'Catering Hizmetleri',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Düğün • Nişan • Sünnet • Toplantı',
                      style: TextStyle(
                        color: subtextColor,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            leading: IconButton(
              icon: Icon(Icons.arrow_back, color: textColor),
              onPressed: () => context.pop(),
            ),
          ),

          // Login notice for pricing
          if (!_isLoggedIn)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.amber.withOpacity(0.2),
                      Colors.amber.withOpacity(0.2),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Text('🔒', style: TextStyle(fontSize: 28)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Fiyatları Görmek İçin Giriş Yapın',
                            style: TextStyle(
                              color: textColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'Catering fiyatları üyelere özeldir',
                            style: TextStyle(
                              color: subtextColor,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => context.push('/login'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(tr('auth.login')),
                    ),
                  ],
                ),
              ),
            ),

          // Info cards
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _buildInfoChip('📞', 'Telefonla Sipariş', surfaceColor, borderColor, subtextColor),
                  const SizedBox(width: 8),
                  _buildInfoChip('📋', 'Menü Planlama', surfaceColor, borderColor, subtextColor),
                  const SizedBox(width: 8),
                  _buildInfoChip('🚚', 'Etkinlik Teslimatı', surfaceColor, borderColor, subtextColor),
                ],
              ),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 16)),

          // Businesses
          _isLoading
              ? const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(color: accent),
                  ),
                )
              : _businesses.isEmpty
                  ? SliverFillRemaining(
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('🍽️', style: TextStyle(fontSize: 56)),
                            const SizedBox(height: 16),
                            Text(
                              'Yakında Catering İşletmeleri',
                              style: TextStyle(
                                color: textColor,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Catering hizmeti veren işletmeler henüz eklenmedi',
                              style: TextStyle(color: isDark ? Colors.white.withOpacity(0.5) : Colors.black45),
                            ),
                          ],
                        ),
                      ),
                    )
                  : SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final doc = _businesses[index];
                            final data = doc.data() as Map<String, dynamic>;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _buildCateringCard(doc.id, data, textColor, subtextColor),
                            );
                          },
                          childCount: _businesses.length,
                        ),
                      ),
                    ),
        ],
      ),
    );
  }

  Widget _buildInfoChip(String emoji, String label, Color surface, Color border, Color subtext) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: border),
        ),
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: subtext,
                fontSize: 10,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCateringCard(String id, Map<String, dynamic> data, Color textColor, Color subtextColor) {
    final companyName = data['companyName'] ?? 'İşletme';
    final city = data['address']?['city'] ?? '';
    final phone = data['contact']?['phone'] ?? '';
    final logoUrl = data['logoUrl'];

    return GestureDetector(
      onTap: () {
        // For catering, show contact info instead of navigating
        showModalBottomSheet(
          context: context,
          backgroundColor: Colors.transparent,
          builder: (ctx) => _buildContactSheet(companyName, phone, data),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              accent.withOpacity(0.15),
              Colors.transparent,
            ],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: accent.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            // Logo
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: accent.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: logoUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(logoUrl, fit: BoxFit.cover),
                    )
                  : const Center(
                      child: Text('🎉', style: TextStyle(fontSize: 28)),
                    ),
            ),
            const SizedBox(width: 16),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    companyName,
                    style: TextStyle(
                      color: textColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  if (city.isNotEmpty)
                    Text(
                      '📍 $city',
                      style: TextStyle(
                        color: subtextColor,
                        fontSize: 12,
                      ),
                    ),
                  const SizedBox(height: 4),
                  // Show price hint only if logged in
                  if (_isLoggedIn)
                    Text(
                      '💰 Fiyat teklifi için iletişime geçin',
                      style: TextStyle(
                        color: accent.withOpacity(0.8),
                        fontSize: 11,
                      ),
                    )
                  else
                    Text(
                      '🔒 Giriş yapın ve fiyatları görün',
                      style: TextStyle(
                        color: Colors.amber.withOpacity(0.8),
                        fontSize: 11,
                      ),
                    ),
                ],
              ),
            ),
            // Call button
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.phone, color: Colors.green, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactSheet(String name, String phone, Map<String, dynamic> data) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final email = data['contact']?['email'] ?? '';
    final website = data['contact']?['website'] ?? '';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1F26) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withOpacity(0.3) : Colors.black.withOpacity(0.2),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            name,
            style: TextStyle(
              color: textColor,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '🎉 Catering Hizmeti',
            style: TextStyle(color: isDark ? Colors.white.withOpacity(0.6) : Colors.black54),
          ),
          const SizedBox(height: 24),
          if (phone.isNotEmpty)
            _buildContactButton(Icons.phone, 'Ara', phone, Colors.green, () {
              // Could launch phone call
            }),
          if (email.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildContactButton(Icons.email, 'E-posta Gönder', email, Colors.blue, () {
              // Could launch email
            }),
          ],
          if (website.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildContactButton(Icons.language, 'Web Sitesi', website, Colors.purple, () {
              // Could launch browser
            }),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildContactButton(IconData icon, String label, String value, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                  Text(value, style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Colors.white.withOpacity(0.7) : Colors.black54, fontSize: 12)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: color),
          ],
        ),
      ),
    );
  }
}
