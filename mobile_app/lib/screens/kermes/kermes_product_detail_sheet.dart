import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lokma_app/models/kermes_model.dart';

const Color lokmaPink = Color(0xFFFB335B);
Color _darkBg(bool isDark) => isDark ? const Color(0xFF121212) : const Color(0xFFE8E8EC);
Color _cardBg(bool isDark) => isDark ? const Color(0xFF1E1E1E) : Colors.white;

/// Kermes ürün detay bottom sheet'ini göster
void showKermesProductDetailSheet(
  BuildContext context, {
  required KermesMenuItem item,
  required int cartQuantity,
  required VoidCallback onAdd,
  required VoidCallback onRemove,
}) {
  HapticFeedback.lightImpact();
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => KermesProductDetailSheet(
      item: item,
      cartQuantity: cartQuantity,
      onAdd: onAdd,
      onRemove: onRemove,
    ),
  );
}

class KermesProductDetailSheet extends StatefulWidget {
  final KermesMenuItem item;
  final int cartQuantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  const KermesProductDetailSheet({
    super.key,
    required this.item,
    required this.cartQuantity,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  State<KermesProductDetailSheet> createState() => _KermesProductDetailSheetState();
}

class _KermesProductDetailSheetState extends State<KermesProductDetailSheet> {
  int _currentImageIndex = 0;
  
  KermesMenuItem get item => widget.item;
  int get cartQuantity => widget.cartQuantity;
  VoidCallback get onAdd => widget.onAdd;
  VoidCallback get onRemove => widget.onRemove;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) => Container(
        decoration: BoxDecoration(
          color: _cardBg(isDark),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Drag handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[600] : Colors.grey[400],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
                  // Content
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(20),
                children: [
                  // Ürün Resimleri (Carousel)
                  _buildImageCarousel(context),
                  
                  const SizedBox(height: 20),
                  
                  // Ürün Adı + 2. İsim
                  Text(
                    item.name,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (item.secondaryName != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      item.secondaryName!,
                      style: TextStyle(
                        color: subtleTextColor,
                        fontSize: 16,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                  
                  const SizedBox(height: 12),
                  
                  // Fiyat
                  Text(
                    '${item.price.toStringAsFixed(2)} €',
                    style: const TextStyle(
                      color: Colors.greenAccent,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  
                  // Açıklama
                  if (item.description != null || item.detailedDescription != null) ...[
                    const SizedBox(height: 16),
                    Divider(color: isDark ? Colors.grey : Colors.grey[300]),
                    const SizedBox(height: 12),
                    Text(
                      item.detailedDescription ?? item.description!,
                      style: TextStyle(
                        color: isDark ? Colors.grey[300] : Colors.grey[700],
                        fontSize: 15,
                        height: 1.5,
                      ),
                    ),
                  ],
                  
                  // Alerjenler
                  if (item.allergens.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildSectionTitle('⚠️ Alerjenler'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: item.allergens.map((allergen) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.amber.withOpacity(0.5)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(_getAllergenIcon(allergen), size: 16, color: Colors.amber),
                            const SizedBox(width: 6),
                            Text(
                              allergen,
                              style: const TextStyle(color: Colors.amber, fontSize: 13),
                            ),
                          ],
                        ),
                      )).toList(),
                    ),
                  ],
                  
                  // İçerikler / Zutaten
                  if (item.ingredients.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _buildSectionTitle('🥘 İçerikler / Zutaten'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: item.ingredients.map((ingredient) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isDark ? Colors.grey[800] : Colors.grey[200],
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          ingredient,
                          style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[700], fontSize: 13),
                        ),
                      )).toList(),
                    ),
                  ],
                  
                  // Bottom spacing for cart buttons
                  const SizedBox(height: 100),
                ],
              ),
            ),
            
            // Sepet Kontrolleri (Sticky Footer)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _darkBg(isDark),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 12,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    if (cartQuantity > 0) ...[
                      // Quantity controls
                      Container(
                        decoration: BoxDecoration(
                          color: lokmaPink.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: lokmaPink.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: () {
                                HapticFeedback.selectionClick();
                                onRemove();
                              },
                              icon: const Icon(Icons.remove, color: lokmaPink),
                            ),
                            Text(
                              cartQuantity.toString(),
                              style: TextStyle(
                                color: textColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                            IconButton(
                              onPressed: () {
                                HapticFeedback.selectionClick();
                                onAdd();
                              },
                              icon: const Icon(Icons.add, color: lokmaPink),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    
                    // Add to cart button
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          HapticFeedback.mediumImpact();
                          onAdd();
                          if (cartQuantity == 0) {
                            Navigator.pop(context);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: lokmaPink,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.add_shopping_cart),
                            const SizedBox(width: 8),
                            Text(
                              cartQuantity > 0 
                                ? 'Bir Tane Daha Ekle' 
                                : 'Sepete Ekle • ${item.price.toStringAsFixed(2)} €',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Resim carousel veya placeholder
  Widget _buildImageCarousel(BuildContext context) {
    final images = item.allImages;
    
    if (images.isEmpty) {
      // Placeholder if no image
      return Container(
        height: 120,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [lokmaPink.withOpacity(0.3), lokmaPink.withOpacity(0.1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
          child: Icon(Icons.restaurant, size: 56, color: lokmaPink),
        ),
      );
    }
    
    if (images.length == 1) {
      // Single image  
      return GestureDetector(
        onTap: () => _showFullScreenImage(context, images[0]),
        child: Hero(
          tag: 'product_image_${item.name}',
          child: Container(
            height: 200,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                images[0],
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: lokmaPink.withOpacity(0.2),
                  child: const Icon(Icons.restaurant, size: 64, color: lokmaPink),
                ),
              ),
            ),
          ),
        ),
      );
    }
    
    // Multiple images - carousel
    return Column(
      children: [
        Container(
          height: 200,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: PageView.builder(
              itemCount: images.length,
              onPageChanged: (index) {
                setState(() => _currentImageIndex = index);
              },
              itemBuilder: (context, index) {
                return GestureDetector(
                  onTap: () => _showFullScreenImage(context, images[index]),
                  child: Image.network(
                    images[index],
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: lokmaPink.withOpacity(0.2),
                      child: const Icon(Icons.restaurant, size: 64, color: lokmaPink),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        // Dot indicators
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(images.length, (index) {
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: _currentImageIndex == index ? 24 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: _currentImageIndex == index 
                    ? lokmaPink 
                    : Colors.grey[600],
                borderRadius: BorderRadius.circular(4),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black87,
        fontSize: 16,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  IconData _getAllergenIcon(String allergen) {
    final lower = allergen.toLowerCase();
    if (lower.contains('gluten') || lower.contains('buğday')) return Icons.grain;
    if (lower.contains('süt') || lower.contains('milk')) return Icons.water_drop;
    if (lower.contains('yumurta') || lower.contains('egg')) return Icons.egg;
    if (lower.contains('fındık') || lower.contains('nut') || lower.contains('badem')) return Icons.forest;
    if (lower.contains('soya')) return Icons.grass;
    if (lower.contains('balık') || lower.contains('fish')) return Icons.set_meal;
    return Icons.warning_amber;
  }

  void _showFullScreenImage(BuildContext context, String imageUrl) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (context, animation, secondaryAnimation) {
          return _FullScreenImageViewer(
            imageUrl: imageUrl,
            heroTag: 'product_image_${item.name}',
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }
}

/// Tam ekran resim görüntüleyici (Pinch to zoom)
class _FullScreenImageViewer extends StatelessWidget {
  final String imageUrl;
  final String heroTag;

  const _FullScreenImageViewer({
    required this.imageUrl,
    required this.heroTag,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Stack(
          children: [
            // Background
            Container(color: Colors.black87),
            
            // Image with zoom
            Center(
              child: Hero(
                tag: heroTag,
                child: InteractiveViewer(
                  minScale: 0.5,
                  maxScale: 4.0,
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.broken_image,
                      size: 64,
                      color: Colors.grey,
                    ),
                  ),
                ),
              ),
            ),
            
            // Close button
            Positioned(
              top: 50,
              right: 20,
              child: GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: const Icon(Icons.close, color: Colors.white),
                ),
              ),
            ),
            
            // Hint text
            Positioned(
              bottom: 40,
              left: 0,
              right: 0,
              child: Center(
                child: Text(
                  'Yakınlaştırmak için sıkıştırın',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.6),
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
