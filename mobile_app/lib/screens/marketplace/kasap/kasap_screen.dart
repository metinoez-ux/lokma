import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';

// Business sector definitions - mirrors admin_portal business-types.ts
const Map<String, Map<String, dynamic>> BUSINESS_SECTORS = {
  'kasap': {'label': 'Kasap', 'icon': '🥩', 'color': 0xFFE53935},
  'market': {'label': 'Market', 'icon': '🛒', 'color': 0xFF4CAF50},
  'restoran': {'label': 'Restoran ve Fastfood', 'icon': '🍽️', 'color': 0xFFFF9800},
  'pastane': {'label': 'Pastane & Tatlıcı', 'icon': '🎂', 'color': 0xFFE91E63},
  'cicekci': {'label': 'Çiçekçi', 'icon': '🌸', 'color': 0xFF9C27B0},
  'cigkofte': {'label': 'Çiğ Köfteci', 'icon': '🥙', 'color': 0xFF00BCD4},
  'cafe': {'label': 'Kafe', 'icon': '☕', 'color': 0xFF795548},
  'catering': {'label': 'Catering', 'icon': '🎉', 'color': 0xFF3F51B5},
  'firin': {'label': 'Fırın', 'icon': '🥖', 'color': 0xFFFF5722},
  'kermes': {'label': 'Kermes', 'icon': '🎪', 'color': 0xFF673AB7},
  'aktar': {'label': 'Aktar & Organik', 'icon': '🌿', 'color': 0xFF8BC34A},
  'icecek': {'label': 'Su & İçecekler', 'icon': '🥤', 'color': 0xFF03A9F4},
  'kozmetik': {'label': 'Kozmetik & Bakım', 'icon': '💄', 'color': 0xFFF06292},
  'sarkuteri': {'label': 'Şarküteri', 'icon': '🧀', 'color': 0xFFFFEB3B},
  'petshop': {'label': 'Pet Shop', 'icon': '🐾', 'color': 0xFF009688},
  'tursu': {'label': 'Turşu & Yufka', 'icon': '🥒', 'color': 0xFF4CAF50},
  'balik': {'label': 'Balık', 'icon': '🐟', 'color': 0xFF2196F3},
  'kuruyemis': {'label': 'Kuru Yemiş', 'icon': '🥜', 'color': 0xFFFF9800},
  'ciftci': {'label': 'Çiftçi', 'icon': '🌾', 'color': 0xFF8BC34A},
};

class KasapScreen extends StatefulWidget {
  const KasapScreen({super.key});

  @override
  State<KasapScreen> createState() => _KasapScreenState();
}

class _KasapScreenState extends State<KasapScreen> {
  static const Color darkBg = Color(0xFF0D0D0D);
  static const Color cardBg = Color(0xFF1E1E1E);
  static const Color accent = Color(0xFFFF6B35);
  
  // Selected sector filters - empty means all
  Set<String> _selectedSectors = {};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: darkBg,
      appBar: AppBar(
        backgroundColor: cardBg,
        title: const Row(
          children: [
            Text('🛒 ', style: TextStyle(fontSize: 24)),
            Text('Marketler', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          IconButton(
            icon: Stack(
              children: [
                const Icon(Icons.filter_list, color: Colors.white),
                if (_selectedSectors.isNotEmpty)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: accent,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${_selectedSectors.length}',
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: _showFilterModal,
          ),
        ],
      ),
      body: _buildBusinessList(),
    );
  }

  void _showFilterModal() {
    HapticFeedback.lightImpact();
    
    showModalBottomSheet(
      context: context,
      backgroundColor: cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return DraggableScrollableSheet(
            initialChildSize: 0.7,
            minChildSize: 0.5,
            maxChildSize: 0.9,
            expand: false,
            builder: (context, scrollController) {
              return Column(
                children: [
                  // Handle
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[600],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  
                  // Header
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Mağaza Türleri',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Görmek istediğin sektörleri seç',
                              style: TextStyle(color: Colors.grey, fontSize: 12),
                            ),
                          ],
                        ),
                        if (_selectedSectors.isNotEmpty)
                          TextButton(
                            onPressed: () {
                              setModalState(() {
                                _selectedSectors.clear();
                              });
                              setState(() {});
                            },
                            child: const Text(
                              'Temizle',
                              style: TextStyle(color: accent),
                            ),
                          ),
                      ],
                    ),
                  ),
                  
                  const Divider(color: Colors.white12),
                  
                  // Sector List
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: BUSINESS_SECTORS.length,
                      itemBuilder: (context, index) {
                        final sectorKey = BUSINESS_SECTORS.keys.elementAt(index);
                        final sector = BUSINESS_SECTORS[sectorKey]!;
                        final isSelected = _selectedSectors.contains(sectorKey);
                        
                        return InkWell(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setModalState(() {
                              if (isSelected) {
                                _selectedSectors.remove(sectorKey);
                              } else {
                                _selectedSectors.add(sectorKey);
                              }
                            });
                            setState(() {});
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: isSelected 
                                  ? Color(sector['color'] as int).withOpacity(0.2)
                                  : Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(12),
                              border: isSelected 
                                  ? Border.all(color: Color(sector['color'] as int), width: 2)
                                  : null,
                            ),
                            child: Row(
                              children: [
                                Text(
                                  sector['icon'] as String,
                                  style: const TextStyle(fontSize: 24),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Text(
                                    sector['label'] as String,
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : Colors.grey[300],
                                      fontSize: 16,
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                    ),
                                  ),
                                ),
                                if (isSelected)
                                  Icon(
                                    Icons.check_circle,
                                    color: Color(sector['color'] as int),
                                    size: 24,
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  
                  // Apply Button
                  Container(
                    padding: const EdgeInsets.all(16),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accent,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          _selectedSectors.isEmpty 
                              ? 'Tüm Mağazaları Göster' 
                              : '${_selectedSectors.length} Sektör Seçildi',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildBusinessList() {
    // Use businesses collection (standardized with Admin Portal)
    // NOTE: Don't filter isActive server-side - it excludes docs without the field
    Query<Map<String, dynamic>> query = FirebaseFirestore.instance
        .collection('businesses');
    
    // Filter by selected sectors if any (server-side for efficiency)
    if (_selectedSectors.isNotEmpty) {
      query = query.where('businessType', whereIn: _selectedSectors.toList());
    }
    
    return StreamBuilder<QuerySnapshot>(
      stream: query.limit(100).snapshots(),  // Increased limit from 50 to 100
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Text(
              'Hata: ${snapshot.error}',
              style: const TextStyle(color: Colors.red),
            ),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: CircularProgressIndicator(color: accent),
          );
        }

        // Client-side filter: exclude restaurant-related types from Marketler
        // Restaurant types: restoran, cafe, pastane, cigkofte, firin, catering
        const restaurantTypes = ['restoran', 'cafe', 'pastane', 'cigkofte', 'firin', 'catering', 'kermes'];
        
        var filteredBusinesses = (snapshot.data?.docs ?? []).where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final businessType = data['businessType'] as String? ?? '';
          final isActive = data['isActive'] as bool? ?? true; // Default to true if field missing
          
          // Skip inactive businesses
          if (!isActive) return false;
          
          // If user has selected specific sectors, show those
          if (_selectedSectors.isNotEmpty) {
            return _selectedSectors.contains(businessType);
          }
          
          // Otherwise, exclude restaurant types (show only market-type businesses)
          return !restaurantTypes.contains(businessType);
        }).toList();

        if (filteredBusinesses.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.store_outlined, size: 64, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  _selectedSectors.isEmpty 
                      ? 'Henüz mağaza bulunamadı'
                      : 'Bu kategorilerde mağaza bulunamadı',
                  style: const TextStyle(color: Colors.grey, fontSize: 16),
                ),
                if (_selectedSectors.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _selectedSectors.clear();
                      });
                    },
                    icon: const Icon(Icons.filter_list_off, color: accent),
                    label: const Text('Filtreleri Temizle', style: TextStyle(color: accent)),
                  ),
                ],
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: filteredBusinesses.length,
          itemBuilder: (context, index) {
            final doc = filteredBusinesses[index];
            final data = doc.data() as Map<String, dynamic>;
            
            // Parse address
            final address = data['address'] as Map<String, dynamic>?;
            final addressStr = address != null 
                ? '${address['street'] ?? ''}, ${address['city'] ?? ''}'
                : '';
            
            // Get business type
            final businessType = data['businessType'] as String? ?? 'market';
            final sectorInfo = BUSINESS_SECTORS[businessType] ?? 
                {'label': 'Mağaza', 'icon': '🏪', 'color': 0xFF9E9E9E};
            
            return _BusinessCard(
              id: doc.id,
              name: data['companyName'] ?? data['businessName'] ?? data['name'] ?? 'İsimsiz Mağaza',
              address: addressStr,
              rating: (data['rating'] ?? 0).toDouble(),
              imageUrl: data['imageUrl'],
              cuisineType: data['cuisineType'] as String?,  // 🆕 Lieferando-style
              isOpen: data['isActive'] ?? true,
              businessType: businessType,
              sectorIcon: sectorInfo['icon'] as String,
              sectorLabel: sectorInfo['label'] as String,
              sectorColor: Color(sectorInfo['color'] as int),
              onTap: () {
                // Navigate based on business type
                if (businessType == 'kasap') {
                  context.push('/kasap/${doc.id}');
                } else {
                  context.push('/business/${doc.id}');
                }
              },
            );
          },
        );
      },
    );
  }
}

class _BusinessCard extends StatelessWidget {
  final String id;
  final String name;
  final String address;
  final double rating;
  final String? imageUrl;
  final String? cuisineType;  // 🆕 Lieferando-style cuisine type
  final bool isOpen;
  final String businessType;
  final String sectorIcon;
  final String sectorLabel;
  final Color sectorColor;
  final VoidCallback onTap;

  const _BusinessCard({
    required this.id,
    required this.name,
    required this.address,
    required this.rating,
    this.imageUrl,
    this.cuisineType,  // 🆕 Optional
    required this.isOpen,
    required this.businessType,
    required this.sectorIcon,
    required this.sectorLabel,
    required this.sectorColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: Stack(
                children: [
                  Container(
                    height: 230,
                    width: double.infinity,
                    color: const Color(0xFF2A2A2A),
                    child: imageUrl != null && imageUrl!.isNotEmpty
                        ? Image.network(
                            imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(sectorIcon, style: const TextStyle(fontSize: 48)),
                            ),
                          )
                        : Center(
                            child: Text(sectorIcon, style: const TextStyle(fontSize: 48)),
                          ),
                  ),
                  // Sector Badge
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: sectorColor.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(sectorIcon, style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Text(
                            sectorLabel,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Info
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isOpen ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          isOpen ? 'Açık' : 'Kapalı',
                          style: TextStyle(
                            color: isOpen ? Colors.green : Colors.red,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 14, color: Colors.grey),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          address,
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 14,
                            fontWeight: FontWeight.normal,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.star, size: 14, color: Color(0xFFFF6B35)),
                      const SizedBox(width: 4),
                      Text(
                        rating.toStringAsFixed(1),
                        style: const TextStyle(
                          color: Color(0xFFFF6B35),
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      // 🆕 Cuisine type or sector label (Lieferando-style)
                      Text(
                        ' · ${cuisineType != null && cuisineType!.isNotEmpty ? cuisineType : sectorLabel}',
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
