import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../utils/currency_utils.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // Design tokens
  static const Color darkBg = Color(0xFF0D0D0D);
  static const Color cardBg = Color(0xFF1A1A1A);
  static const Color accent = Color(0xFFFF6B35);
  
  int _selectedFulfillmentType = 0; // 0=Teslimat, 1=Gel Al, 2=Masa

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? darkBg : Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // ===== HEADER (Compact) =====
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Logo
                  Text(
                    'LOKMA',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: accent,
                      letterSpacing: 1,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go('/profile'),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isDark ? cardBg : Colors.grey[100],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.person_rounded, color: isDark ? Colors.white.withOpacity(0.7) : Colors.black87, size: 22),
                    ),
                  ),
                ],
              ),
            ),

            // ===== FULFILLMENT SELECTOR (Lieferando Style - Compact Pills) =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  _buildFulfillmentPill(0, '🚴 Teslimat'),
                  const SizedBox(width: 8),
                  _buildFulfillmentPill(1, '🏃 Gel Al'),
                  const SizedBox(width: 8),
                  _buildFulfillmentPill(2, '🍽️ Masa'),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ===== HERO SEARCH BAR (Prominent - Lieferando Style) =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  context.push('/search');
                },
                child: Container(
                  height: 60,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white : Colors.grey[100],
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: isDark ? [
                      BoxShadow(
                        color: accent.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ] : null,
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 16),
                      Icon(Icons.search_rounded, color: Colors.grey[600], size: 26),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Yemek veya restoran ara...',
                          style: TextStyle(color: Colors.grey[400], fontSize: 17),
                        ),
                      ),
                      Container(
                        margin: const EdgeInsets.all(8),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: accent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 22),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),

            // ===== RECENT ORDERS - QUICK REORDER =====
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Quick Reorder Section
                    _buildReorderSection(),
                    const SizedBox(height: 24),
                    
                    // Categories Header
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        'Kategoriler',
                        style: TextStyle(
                          color: isDark ? Colors.white.withOpacity(0.9) : Colors.black87,
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 3,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.95,
                      children: [
                        _buildCategoryTile('🥩', 'Kasap', '/kasap'),
                        _buildCategoryTile('🍖', 'Imbiss', '/market'),
                        _buildCategoryTile('🍽️', 'Restoran', '/restoran'),
                        _buildCategoryTile('🎪', 'Kermes', '/kermes'),
                        _buildCategoryTile('☕', 'Shop', '/kahve'),
                        _buildCategoryTile('🛒', 'Market', '/market'),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Orders shortcut
                    GestureDetector(
                      onTap: () => context.go('/orders'),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isDark ? cardBg : Colors.grey[100],
                          borderRadius: BorderRadius.circular(14),
                          border: isDark ? Border.all(color: Colors.white.withOpacity(0.05)) : null,
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: accent.withOpacity(isDark ? 0.15 : 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.receipt_long_rounded, color: accent, size: 22),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                'Siparişlerim',
                                style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Icon(Icons.arrow_forward_ios_rounded, color: isDark ? Colors.white.withOpacity(0.3) : Colors.grey[400], size: 16),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFulfillmentPill(int index, String label) {
    final isSelected = _selectedFulfillmentType == index;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          setState(() => _selectedFulfillmentType = index);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? accent : (isDark ? cardBg : Colors.grey[100]),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? accent : (isDark ? Colors.white.withOpacity(0.08) : Colors.transparent),
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : (isDark ? Colors.white.withOpacity(0.6) : Colors.black87),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryTile(String emoji, String title, String route) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.go(route);
      },
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? cardBg : Colors.grey[100],
          borderRadius: BorderRadius.circular(16),
          border: isDark ? Border.all(color: Colors.white.withOpacity(0.05)) : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 36)),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===== QUICK REORDER SECTION =====
  Widget _buildReorderSection() {
    // TODO: Replace with actual Firebase data from butcher_orders
    final recentOrders = [
      {'vendor': 'Tuna Kasap', 'items': '2x Kuşbaşı, 1x Kıyma', 'total': '${CurrencyUtils.getCurrencySymbol()}45.90', 'date': 'Bugün'},
      {'vendor': 'Akdeniz Imbiss', 'items': 'Döner Teller, Ayran', 'total': '${CurrencyUtils.getCurrencySymbol()}12.50', 'date': 'Dün'},
    ];

    if (recentOrders.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.replay_rounded, color: accent, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Tekrar Sipariş Ver',
                    style: TextStyle(
                      color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black87,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => context.go('/orders'),
                child: Text(
                  'Tümü',
                  style: TextStyle(
                    color: accent,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 140,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: recentOrders.length,
            itemBuilder: (context, index) {
              final order = recentOrders[index];
              return _buildReorderCard(
                order['vendor']!,
                order['items']!,
                order['total']!,
                order['date']!,
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildReorderCard(String vendor, String items, String total, String date) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        // TODO: Add to cart with edit capability
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$vendor siparişi sepete eklendi'),
            backgroundColor: accent,
            action: SnackBarAction(
              label: 'Düzenle',
              textColor: Colors.white,
              onPressed: () {},
            ),
          ),
        );
      },
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? cardBg : Colors.grey[100],
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: accent.withOpacity(0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        vendor,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      date,
                      style: TextStyle(
                        color: isDark ? Colors.white.withOpacity(0.4) : Colors.grey[600],
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  items,
                  style: TextStyle(
                    color: isDark ? Colors.white.withOpacity(0.6) : Colors.grey[700],
                    fontSize: 12,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  total,
                  style: TextStyle(
                    color: accent,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add_shopping_cart_rounded, color: Colors.white, size: 14),
                      SizedBox(width: 4),
                      Text(
                        'Tekrarla',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
