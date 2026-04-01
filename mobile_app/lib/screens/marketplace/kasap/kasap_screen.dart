import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:lokma_app/utils/opening_hours_helper.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lokma_app/providers/cart_provider.dart';

// Business sector definitions - mirrors admin_portal business-types.ts
const Map<String, Map<String, dynamic>> BUSINESS_SECTORS = {
  'kasap': {'label': 'Kasap', 'icon': '🥩', 'color': 0xFFEA184A},
  'market': {'label': 'Market', 'icon': '🛒', 'color': 0xFF4CAF50},
  'restoran': {'label': 'Restoran ve Fastfood', 'icon': '🍽️', 'color': 0xFFFFC107},
  'pastane': {'label': 'Pastane & Tatlıcı', 'icon': '🎂', 'color': 0xFFEA184A},
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
  'kuruyemis': {'label': 'Kuru Yemiş', 'icon': '🥜', 'color': 0xFFFFC107},
  'ciftci': {'label': 'Çiftçi', 'icon': '🌾', 'color': 0xFF8BC34A},
  'eticaret': {'label': 'Online Shop', 'icon': '🛍️', 'color': 0xFF00BCD4},
};

class KasapScreen extends StatefulWidget {
  const KasapScreen({super.key});

  @override
  State<KasapScreen> createState() => _KasapScreenState();
}

class _KasapScreenState extends State<KasapScreen> {
  // Colors now come from Theme.of(context) — see build()
  
  // Selected sector filters - empty means all
  final Set<String> _selectedSectors = {};

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = Theme.of(context).scaffoldBackgroundColor;
    final cardBgColor = isDark ? const Color(0xFF2A2A28) : Colors.white;
    final textPrimary = Theme.of(context).colorScheme.onSurface;
    
    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: cardBgColor,
        title: Row(
          children: [
            const Text('🛒 ', style: TextStyle(fontSize: 24)),
            Text('marketplace.markets'.tr(), style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600)),
          ],
        ),
        actions: [
          IconButton(
            icon: Stack(
              children: [
                const Icon(Icons.filter_list, color: Colors.grey),
                if (_selectedSectors.isNotEmpty)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${_selectedSectors.length}',
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
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
      backgroundColor: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF2A2A28) : Colors.white,
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
                                fontSize: 20,
                                fontWeight: FontWeight.w600,
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
                            child: Text(
                              'Temizle',
                              style: TextStyle(color: Theme.of(context).colorScheme.primary),
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
                                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
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
                          backgroundColor: Theme.of(context).colorScheme.primary,
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
                            fontWeight: FontWeight.w600,
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
              'marketplace.error_occurred'.tr(),
              style: const TextStyle(color: Colors.red),
            ),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(
            child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
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
                      ? 'marketplace.no_stores_yet'.tr()
                      : 'marketplace.no_stores_in_category'.tr(),
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
                    icon: Icon(Icons.filter_list_off, color: Theme.of(context).colorScheme.primary),
                    label: Text('marketplace.clear_filters'.tr(), style: TextStyle(color: Theme.of(context).colorScheme.primary)),
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
            
              // Check open: openingHours first, then deliveryHours/pickupHours fallback
              bool isOpenNow = false;
              if (data['openingHours'] != null) {
                isOpenNow = OpeningHoursHelper(data['openingHours']).isOpenAt(DateTime.now());
              }
              if (!isOpenNow && data['deliveryHours'] != null) {
                isOpenNow = OpeningHoursHelper(data['deliveryHours']).isOpenAt(DateTime.now());
              }
              if (!isOpenNow && data['pickupHours'] != null) {
                isOpenNow = OpeningHoursHelper(data['pickupHours']).isOpenAt(DateTime.now());
              }
              if (data['openingHours'] == null && data['deliveryHours'] == null && data['pickupHours'] == null) {
                isOpenNow = true;
              }

              // Pause detection
              final bool deliveryPaused = data['temporaryDeliveryPaused'] as bool? ?? false;
              final bool pickupPaused = data['temporaryPickupPaused'] as bool? ?? false;
              String? pauseText;
              if (deliveryPaused) {
                final dpUntil = data['deliveryPauseUntil'];
                if (dpUntil != null) {
                  final DateTime dt = dpUntil is Timestamp ? dpUntil.toDate() : (dpUntil is DateTime ? dpUntil : DateTime.now());
                  final mins = dt.difference(DateTime.now()).inMinutes;
                  if (mins > 0) pauseText = tr('marketplace.delivery_resumes_in', namedArgs: {'minutes': '$mins'});
                }
                pauseText ??= tr('marketplace.courier_not_available');
              } else if (pickupPaused) {
                final ppUntil = data['pickupPauseUntil'];
                if (ppUntil != null) {
                  final DateTime dt = ppUntil is Timestamp ? ppUntil.toDate() : (ppUntil is DateTime ? ppUntil : DateTime.now());
                  final mins = dt.difference(DateTime.now()).inMinutes;
                  if (mins > 0) pauseText = tr('marketplace.pickup_resumes_in', namedArgs: {'minutes': '$mins'});
                }
                pauseText ??= tr('marketplace.pickup_paused');
              }
              
              return _BusinessCard(
                id: doc.id,
                name: data['companyName'] ?? data['businessName'] ?? data['name'] ?? 'marketplace.unnamed_store'.tr(),
                address: addressStr,
                rating: (data['rating'] ?? 0).toDouble(),
                imageUrl: data['imageUrl'],
                logoUrl: data['logoUrl'] as String?,
                cuisineType: data['cuisineType'] as String?,
                isOpen: (data['isActive'] ?? true) && isOpenNow,
                pauseText: pauseText,
              businessType: businessType,
              sectorIcon: sectorInfo['icon'] as String,
              sectorLabel: sectorInfo['label'] as String,
              sectorColor: Color(sectorInfo['color'] as int),
              businessId: doc.id,
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
  final String? logoUrl;  // 🆕 Lieferando-style logo (square)
  final String? cuisineType;  // 🆕 Lieferando-style cuisine type
  final bool isOpen;
  final String? pauseText;
  final String businessType;
  final String sectorIcon;
  final String sectorLabel;
  final Color sectorColor;
  final String businessId;
  final VoidCallback onTap;

  const _BusinessCard({
    required this.id,
    required this.name,
    required this.address,
    required this.rating,
    this.imageUrl,
    this.logoUrl,
    this.cuisineType,
    required this.isOpen,
    this.pauseText,
    required this.businessType,
    required this.sectorIcon,
    required this.sectorLabel,
    required this.sectorColor,
    required this.businessId,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? const Color(0xFF2A2A28)
              : Colors.white,
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
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF2A2A28)
                        : Colors.grey.shade100,
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
                  // Sector Badge (TOP RIGHT - to not overlap with logo)
                  Positioned(
                    top: 12,
                    right: 12,
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
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // 🎯 Promo Badge (TOP LEFT) - Discovery kampanya gösterimi
                  FutureBuilder<QuerySnapshot>(
                    future: FirebaseFirestore.instance
                        .collection('businesses')
                        .doc(businessId)
                        .collection('promotions')
                        .where('isActive', isEqualTo: true)
                        .where('showInDiscovery', isEqualTo: true)
                        .limit(1)
                        .get(),
                    builder: (context, promoSnap) {
                      if (promoSnap.hasData && promoSnap.data!.docs.isNotEmpty) {
                        return Positioned(
                          top: 12,
                          left: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF00C853), Color(0xFF00E676)],
                              ),
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF00C853).withOpacity(0.4),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text('🎯', style: TextStyle(fontSize: 12)),
                                SizedBox(width: 4),
                                Text(
                                  'Kampanya',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                  // 🆕 Business Logo (BOTTOM LEFT - Lieferando style)
                  if (logoUrl != null && logoUrl!.isNotEmpty)
                    Positioned(
                      left: 12,
                      bottom: 12,
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.2),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            logoUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(sectorIcon, style: const TextStyle(fontSize: 24)),
                            ),
                          ),
                        ),
                      ),
                    ),
                  // 🆕 Cart badge (BOTTOM RIGHT) - Lieferando-style
                  Consumer(
                    builder: (context, ref, _) {
                      final cartState = ref.watch(cartProvider);
                      if (cartState.butcherId == id && cartState.items.isNotEmpty) {
                        return Positioned(
                          right: 12,
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Icon(
                                  Icons.shopping_cart_outlined,
                                  color: Colors.amber.shade700,
                                  size: 24,
                                ),
                                Positioned(
                                  right: -8,
                                  top: -8,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: Colors.amber.shade700,
                                      shape: BoxShape.circle,
                                    ),
                                    constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                                    child: Center(
                                      child: Text(
                                        '${cartState.items.length}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ],
              ),
            ),
            // Info section (below image)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Builder(
                builder: (context) {
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  final textColor = isDark ? Colors.white.withOpacity(0.9) : Colors.black87;
                  final starColor = isDark ? Color(0xFFFF9529) : Color(0xFFFF9529);
                  
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: pauseText != null
                                  ? Colors.orange.withOpacity(0.1)
                                  : (isOpen ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1)),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              pauseText ?? (isOpen ? 'marketplace.open'.tr() : 'marketplace.closed'.tr()),
                              style: TextStyle(
                                color: pauseText != null ? Colors.orange : (isOpen ? Colors.green : Colors.red),
                                fontSize: pauseText != null ? 10 : 12,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      
                      // Rating + Type (Lieferando style)
                      Row(
                        children: [
                          Icon(Icons.star, color: starColor, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            rating.toStringAsFixed(1).replaceAll('.', ','),
                            style: TextStyle(
                              color: textColor,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            ' · ',
                            style: TextStyle(color: textColor, fontSize: 15),
                          ),
                          Expanded(
                            child: Text(
                              cuisineType != null && cuisineType!.isNotEmpty ? cuisineType! : sectorLabel,
                              style: TextStyle(
                                color: textColor,
                                fontSize: 15,
                                fontWeight: FontWeight.w400,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 6),
                      
                      // Location
                      Row(
                        children: [
                          Icon(Icons.location_on_outlined, size: 16, color: textColor),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              address,
                              style: TextStyle(
                                color: textColor,
                                fontSize: 15,
                                fontWeight: FontWeight.w400,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                }
              ),
            ),
          ],
        ),
      ),
    );
  }
}
