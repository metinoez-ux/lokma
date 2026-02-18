import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:google_places_flutter/google_places_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:lokma_app/models/kermes_model.dart';
import 'package:url_launcher/url_launcher.dart';

// LOKMA Kermes tema renkleri
const Color primaryRed = Color(0xFFFF3333);
const Color accentRed = Color(0xFFE00000);
Color _darkBg(bool isDark) => isDark ? const Color(0xFF000000) : const Color(0xFFF5F5F5);
Color _surfaceDark(bool isDark) => isDark ? const Color(0xFF121212) : const Color(0xFFE8E8EC);
Color _cardBg(bool isDark) => isDark ? const Color(0xFF1E1E1E) : Colors.white;

/// Modern koyu tema park bilgileri ekranı
/// Collapsible kartlar, admin yönetimi ve push notification
class KermesParkingScreen extends StatefulWidget {
  final KermesEvent event;

  const KermesParkingScreen({super.key, required this.event});

  @override
  State<KermesParkingScreen> createState() => _KermesParkingScreenState();
}

class _KermesParkingScreenState extends State<KermesParkingScreen> with SingleTickerProviderStateMixin {
  late AnimationController _flashController;
  late Animation<double> _flashAnimation;
  
  // Collapsible state - hangi kartlar açık
  Set<int> _expandedCards = {};
  
  // Admin/Personel kontrolü
  bool _isAdmin = false;
  String? _userRole;
  
  // Realtime parking data
  List<KermesParkingInfo> _parkingList = [];
  StreamSubscription? _parkingSubscription;
  
  // Genel park bilgisi notu
  String _generalParkingNote = '';

  @override
  void initState() {
    super.initState();
    _parkingList = List.from(widget.event.parking);
    
    // Yanıp sönen animasyon
    _flashController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    
    _flashAnimation = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(parent: _flashController, curve: Curves.easeInOut),
    );
    
    _checkUserRole();
    _listenToParkingUpdates();
  }
  
  /// Kullanıcı rolünü kontrol et
  Future<void> _checkUserRole() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    try {
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      
      if (userDoc.exists) {
        final data = userDoc.data();
        final role = data?['role'] as String?;
        final adminType = data?['adminType'] as String?;
        final isAdminField = data?['isAdmin'] as bool? ?? false;
        final kermesRoles = data?['kermesRoles'] as Map<String, dynamic>?;
        
        debugPrint('🔐 Park Admin Check - User Role: $role, AdminType: $adminType, isAdmin: $isAdminField');
        debugPrint('🔐 Park Admin Check - Kermes Roles: $kermesRoles');
        debugPrint('🔐 Park Admin Check - Event ID: ${widget.event.id}');
        
        // Admin kontrolü: superadmin VEYA kermes_admin/personel (sadece bu kermes için)
        final isAdminRole = role == 'superadmin' || 
                     role == 'admin' ||
                     (isAdminField && adminType == 'super') ||
                     (isAdminField && adminType == 'admin') ||
                     kermesRoles?[widget.event.id] == 'kermes_admin' ||
                     kermesRoles?[widget.event.id] == 'personel';
        
        debugPrint('🔐 Park Admin Check - Is Admin Result: $isAdminRole');
        
        setState(() {
          _userRole = role ?? (isAdminField ? 'admin' : null);
          _isAdmin = isAdminRole;
        });
      }
    } catch (e) {
      debugPrint('Rol kontrolü hatası: $e');
    }
  }
  
  /// Realtime park güncellemelerini dinle
  void _listenToParkingUpdates() {
    _parkingSubscription = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(widget.event.id)
        .snapshots()
        .listen((snapshot) {
      if (snapshot.exists && mounted) {
        final data = snapshot.data();
        final parkingData = data?['parkingLocations'] as List<dynamic>? ?? [];
        final parkingNote = data?['parkingNote'] as String? ?? '';
        
        setState(() {
          _parkingList = parkingData.map((p) => KermesParkingInfo.fromJson(p as Map<String, dynamic>)).toList();
          _generalParkingNote = parkingNote;
        });
      }
    });
  }

  @override
  void dispose() {
    _flashController.dispose();
    _parkingSubscription?.cancel();
    super.dispose();
  }
  
  /// Acil park anonsu gönder
  Future<void> _sendEmergencyAnnouncement() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final controller = TextEditingController();
    
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _surfaceDark(isDark),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.campaign, color: Colors.red, size: 24),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Acil Park Anonsu',
                style: TextStyle(color: Colors.white, fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Bu mesaj kermesteki tüm kullanıcılara push bildirim olarak gönderilecek.',
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              maxLines: 3,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Örn: AB-123 plakalı araç acil çekilmeli!',
                hintStyle: TextStyle(color: Colors.grey[600]),
                filled: true,
                fillColor: _cardBg(isDark),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('İptal', style: TextStyle(color: Colors.grey[400])),
          ),
          ElevatedButton.icon(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                Navigator.pop(context, controller.text.trim());
              }
            },
            icon: const Icon(Icons.send, size: 18),
            label: const Text('Gönder'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
    
    if (result != null && result.isNotEmpty) {
      await _sendPushNotification(result);
    }
  }
  
  /// Push notification gönder (Firestore'a kaydet - Cloud Function tetikleyecek)
  Future<void> _sendPushNotification(String message) async {
    try {
      await FirebaseFirestore.instance.collection('kermes_announcements').add({
        'kermesId': widget.event.id,
        'kermesTitle': widget.event.title,
        'message': message,
        'type': 'parking_emergency',
        'createdAt': FieldValue.serverTimestamp(),
        'createdBy': FirebaseAuth.instance.currentUser?.uid,
        'status': 'pending',
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                const Text('Acil anons gönderildi!'),
              ],
            ),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // Harita seçim dialogu
  void _showMapSelectionDialog(BuildContext context, String address, double? lat, double? lng) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: _surfaceDark(isDark),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Haritayı Seç',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 20),
              
              // Apple Maps
              _buildMapOption(
                icon: Icons.map,
                iconColor: Colors.blue,
                title: 'Apple Haritalar',
                subtitle: 'iOS varsayılan',
                isDefault: Platform.isIOS,
                onTap: () {
                  Navigator.pop(context);
                  _launchAppleMaps(address, lat, lng);
                },
              ),
              
              const SizedBox(height: 12),
              
              // Google Maps
              _buildMapOption(
                icon: Icons.location_on,
                iconColor: primaryRed,
                title: 'Google Maps',
                subtitle: 'Detaylı navigasyon',
                isDefault: Platform.isAndroid,
                onTap: () {
                  Navigator.pop(context);
                  _launchGoogleMaps(address, lat, lng);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMapOption({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    bool isDefault = false,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _cardBg(isDark),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
                  Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                ],
              ),
            ),
            if (isDefault)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('Varsayılan', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.w600)),
              ),
            const SizedBox(width: 8),
            Icon(Icons.arrow_forward_ios, color: Colors.grey[600], size: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _launchAppleMaps(String address, double? lat, double? lng) async {
    Uri url;
    if (lat != null && lng != null) {
      url = Uri.parse('https://maps.apple.com/?ll=$lat,$lng&q=${Uri.encodeComponent(address)}');
    } else {
      url = Uri.parse('https://maps.apple.com/?q=${Uri.encodeComponent(address)}');
    }
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  Future<void> _launchGoogleMaps(String address, double? lat, double? lng) async {
    Uri url;
    if (lat != null && lng != null) {
      url = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    } else {
      url = Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
    }
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtleTextColor = isDark ? Colors.grey[400]! : Colors.grey[600]!;
    return Scaffold(
      backgroundColor: _darkBg(isDark),
      body: CustomScrollView(
        slivers: [
          // Modern App Bar
          SliverAppBar(
            expandedHeight: 180,
            pinned: true,
            backgroundColor: _darkBg(isDark),
            surfaceTintColor: Colors.transparent,
            leading: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
              ),
            ),
            actions: [
              // Admin için acil anons butonu
              if (_isAdmin)
                GestureDetector(
                  onTap: _sendEmergencyAnnouncement,
                  child: Container(
                    margin: const EdgeInsets.all(8),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.campaign, color: Colors.red, size: 18),
                        const SizedBox(width: 6),
                        const Text('Acil Anons', style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      const Color(0xFF2563EB).withOpacity(0.3),
                      _darkBg(isDark),
                    ],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Sol: P ikonu + Başlık
                        Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFF2563EB),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF2563EB).withOpacity(0.4),
                                    blurRadius: 8,
                                    spreadRadius: 1,
                                  ),
                                ],
                              ),
                              child: const Center(
                                child: Text(
                                  'P',
                                  style: TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'Park İmkanları',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                Text(
                                  '${_parkingList.length} park alanı',
                                  style: TextStyle(fontSize: 12, color: subtleTextColor),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const Spacer(),
                        // Sağ: Kermes/Şehir adı
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withOpacity(0.2)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.location_on, color: Colors.grey[300], size: 16),
                              const SizedBox(width: 6),
                              Text(
                                widget.event.city,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          
          // Genel Park Bilgisi Notu (sadece doluysa göster)
          if (_generalParkingNote.isNotEmpty)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.amber.withOpacity(0.15), Colors.orange.withOpacity(0.08)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, color: Colors.amber, size: 22),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _generalParkingNote,
                        style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          
          // Collapsible park kartları
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final info = _parkingList[index];
                  final isExpanded = _expandedCards.contains(index);
                  return _buildCollapsibleParkCard(info, index, isExpanded);
                },
                childCount: _parkingList.length,
              ),
            ),
          ),
          
          // Boş mesaj
          if (_parkingList.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.local_parking_outlined, size: 64, color: Colors.grey[600]),
                    const SizedBox(height: 16),
                    Text(
                      'Park bilgisi bulunamadı',
                      style: TextStyle(color: Colors.grey[500], fontSize: 16),
                    ),
                    if (_isAdmin) ...[
                      const SizedBox(height: 20),
                      ElevatedButton.icon(
                        onPressed: _showAddParkingDialog,
                        icon: const Icon(Icons.add),
                        label: const Text('İlk Park Alanını Ekle'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          
          const SliverToBoxAdapter(child: SizedBox(height: 100)), // FAB için boşluk
        ],
      ),
      // Admin için Floating Action Button
      floatingActionButton: _isAdmin ? Container(
        margin: const EdgeInsets.only(bottom: 16),
        child: FloatingActionButton.extended(
          onPressed: _showAddParkingDialogFull,
          backgroundColor: const Color(0xFF2563EB),
          icon: const Icon(Icons.add_location_alt, color: Colors.white),
          label: const Text('Park Ekle', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
      ) : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
  
  /// Collapsible park kartı
  Widget _buildCollapsibleParkCard(KermesParkingInfo info, int index, bool isExpanded) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final address = '${info.street}, ${info.postalCode} ${info.city}';
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _surfaceDark(isDark),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isExpanded ? const Color(0xFF2563EB).withOpacity(0.5) : Colors.white.withOpacity(0.05)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Header - tıklanabilir
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedCards.remove(index);
                } else {
                  _expandedCards.add(index);
                }
              });
              HapticFeedback.lightImpact();
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: isExpanded ? LinearGradient(
                  colors: [const Color(0xFF2563EB).withOpacity(0.2), const Color(0xFF1E40AF).withOpacity(0.1)],
                ) : null,
              ),
              child: Row(
                children: [
                  // Park numarası
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF2563EB), Color(0xFF1E40AF)]),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        'P${index + 1}',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Adres özeti
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          info.street.isNotEmpty ? info.street : 'Park Alanı ${index + 1}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${info.postalCode} ${info.city}',
                          style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                        ),
                      ],
                    ),
                  ),
                  // Genişlet/Daralt ikonu
                  AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.keyboard_arrow_down,
                      color: isExpanded ? const Color(0xFF2563EB) : Colors.grey[600],
                      size: 28,
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          // Genişletilmiş içerik
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: _buildExpandedContent(info, index, address),
            crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    );
  }
  
  /// Genişletilmiş kart içeriği
  Widget _buildExpandedContent(KermesParkingInfo info, int index, String address) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(color: Colors.white10),
          const SizedBox(height: 8),
          
          // Not varsa göster
          if (info.note != null && info.note!.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: Colors.amber, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      info.note!,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          
          // Resimler (blob URL'leri filtrele)
          Builder(builder: (context) {
            final validImages = info.images.where((url) => 
              url.startsWith('http://') || url.startsWith('https://')
            ).where((url) => !url.contains('blob:')).toList();
            
            if (validImages.isEmpty) return const SizedBox.shrink();
            
            return Column(
              children: [
                SizedBox(
                  height: 100,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: validImages.length,
                    itemBuilder: (context, imgIndex) {
                      return GestureDetector(
                        onTap: () => _showFullScreenImage(context, validImages[imgIndex]),
                        child: Container(
                          width: 100,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            color: _cardBg(isDark),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Image.network(
                            validImages[imgIndex],
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => 
                              const Center(child: Icon(Icons.broken_image, color: Colors.grey)),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
              ],
            );
          }),
          
          // Aksiyon butonları
          Row(
            children: [
              // Navigasyon
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showMapSelectionDialog(context, address, info.lat, info.lng),
                  icon: const Icon(Icons.directions, size: 18),
                  label: const Text('Yol Tarifi'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Adresi kopyala
              IconButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: address));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text('Adres kopyalandı'),
                      backgroundColor: Colors.green,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  );
                },
                icon: const Icon(Icons.copy, color: Colors.grey),
              ),
              // Admin için düzenle/sil
              if (_isAdmin) ...[
                IconButton(
                  onPressed: () => _showEditParkingDialog(index),
                  icon: const Icon(Icons.edit, color: Colors.blue),
                ),
                IconButton(
                  onPressed: () => _deleteParkingLocation(index),
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
  
  /// Park alanı ekle dialog
  Future<void> _showAddParkingDialog() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streetController = TextEditingController();
    final cityController = TextEditingController();
    final postalCodeController = TextEditingController();
    final noteController = TextEditingController();
    
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _surfaceDark(isDark),
        title: const Text('Yeni Park Alanı', style: TextStyle(color: Colors.white)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: streetController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Sokak/Cadde',
                  labelStyle: TextStyle(color: Colors.grey[400]),
                  filled: true,
                  fillColor: _cardBg(isDark),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: postalCodeController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Posta Kodu',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        filled: true,
                        fillColor: _cardBg(isDark),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: cityController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Şehir',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        filled: true,
                        fillColor: _cardBg(isDark),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                style: const TextStyle(color: Colors.white),
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'Not (opsiyonel)',
                  labelStyle: TextStyle(color: Colors.grey[400]),
                  filled: true,
                  fillColor: _cardBg(isDark),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('İptal', style: TextStyle(color: Colors.grey[400])),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            child: const Text('Ekle'),
          ),
        ],
      ),
    );
    
    if (result == true) {
      try {
        final newParking = {
          'street': streetController.text,
          'city': cityController.text,
          'postalCode': postalCodeController.text,
          'country': 'Deutschland',
          'note': noteController.text.isNotEmpty ? noteController.text : null,
          'images': <String>[],
        };
        
        await FirebaseFirestore.instance.collection('kermes_events').doc(widget.event.id).update({
          'parkingLocations': FieldValue.arrayUnion([newParking]),
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Park alanı eklendi'),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
  
  /// Gelişmiş park ekleme dialog'u - GPS, Google Places ve resim ekleme özelliği ile
  Future<void> _showAddParkingDialogFull() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streetController = TextEditingController();
    final cityController = TextEditingController();
    final postalCodeController = TextEditingController();
    final noteController = TextEditingController();
    final addressSearchController = TextEditingController();
    List<File> selectedImages = [];
    bool isUploading = false;
    bool isGettingLocation = false;
    String? selectedPlaceId;
    
    // Google Places API Key
    const googleApiKey = 'AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo';
    
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      enableDrag: true,
      isDismissible: true,
      backgroundColor: Colors.transparent,
      builder: (context) => GestureDetector(
        onHorizontalDragEnd: (details) {
          // Sağa swipe ile kapat
          if (details.primaryVelocity != null && details.primaryVelocity! > 300) {
            Navigator.pop(context, false);
          }
        },
        child: StatefulBuilder(
        builder: (context, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.9,
          decoration: BoxDecoration(
            color: _surfaceDark(isDark),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Handle bar (swipe down için)
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Header with back button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                child: Row(
                  children: [
                    // Geri butonu
                    IconButton(
                      onPressed: () => Navigator.pop(context, false),
                      icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 22),
                    ),
                    const Expanded(
                      child: Text(
                        'Yeni Park Alanı',
                        style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    // Sağ tarafta boşluk için
                    const SizedBox(width: 48),
                  ],
                ),
              ),
              // Form
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // === HIZLI EKLEME BUTONLARI ===
                      const Text('🚀 Hızlı Ekle', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          // GPS ile Ekle
                          Expanded(
                            child: GestureDetector(
                              onTap: isGettingLocation ? null : () async {
                                setModalState(() => isGettingLocation = true);
                                try {
                                  // Konum izni kontrolü
                                  LocationPermission permission = await Geolocator.checkPermission();
                                  if (permission == LocationPermission.denied) {
                                    permission = await Geolocator.requestPermission();
                                  }
                                  if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
                                    throw Exception('Konum izni verilmedi');
                                  }
                                  
                                  // Mevcut konumu al
                                  final position = await Geolocator.getCurrentPosition(
                                    desiredAccuracy: LocationAccuracy.high,
                                  );
                                  
                                  // Koordinatları adrese çevir
                                  final placemarks = await placemarkFromCoordinates(
                                    position.latitude, 
                                    position.longitude,
                                  );
                                  
                                  if (placemarks.isNotEmpty) {
                                    final place = placemarks.first;
                                    setModalState(() {
                                      streetController.text = '${place.street ?? ''} ${place.subThoroughfare ?? ''}'.trim();
                                      cityController.text = place.locality ?? place.subAdministrativeArea ?? '';
                                      postalCodeController.text = place.postalCode ?? '';
                                    });
                                    
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('📍 Konum alındı!'),
                                        backgroundColor: Colors.green,
                                        duration: Duration(seconds: 2),
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Konum hatası: $e'), backgroundColor: Colors.red),
                                  );
                                } finally {
                                  setModalState(() => isGettingLocation = false);
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E3A5F),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF2563EB).withOpacity(0.5)),
                                ),
                                child: Column(
                                  children: [
                                    isGettingLocation
                                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                        : const Icon(Icons.my_location, color: Colors.white, size: 24),
                                    const SizedBox(height: 8),
                                    Text(
                                      isGettingLocation ? 'Alınıyor...' : 'GPS ile Ekle',
                                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Kermes Adresi ile Ekle
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                // Kermes adresini parse et ve forma doldur
                                // Adres formatı: "Straße 123, 12345 Stadt" veya benzer
                                final fullAddress = widget.event.address;
                                final parts = fullAddress.split(',');
                                
                                String street = '';
                                String postalCode = '';
                                String city = widget.event.city;
                                
                                if (parts.isNotEmpty) {
                                  street = parts[0].trim();
                                }
                                
                                if (parts.length > 1) {
                                  // "12345 Stadt" formatını parse et
                                  final cityPart = parts[1].trim();
                                  final postalMatch = RegExp(r'(\d{5})\s*(.*)').firstMatch(cityPart);
                                  if (postalMatch != null) {
                                    postalCode = postalMatch.group(1) ?? '';
                                    if (postalMatch.group(2)?.isNotEmpty == true) {
                                      city = postalMatch.group(2)!.trim();
                                    }
                                  }
                                }
                                
                                setModalState(() {
                                  streetController.text = street;
                                  cityController.text = city;
                                  postalCodeController.text = postalCode;
                                });
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('📍 Kermes adresi eklendi!'),
                                    backgroundColor: Colors.green,
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E3A5F),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF2563EB).withOpacity(0.5)),
                                ),
                                child: const Column(
                                  children: [
                                    Icon(Icons.business, color: Colors.white, size: 24),
                                    SizedBox(height: 8),
                                    Text(
                                      'Kermes Adresi',
                                      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // === GOOGLE PLACES ARAMA ===
                      const Text('🔍 Adres Ara (Google)', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      GooglePlaceAutoCompleteTextField(
                        textEditingController: addressSearchController,
                        googleAPIKey: googleApiKey,
                        inputDecoration: InputDecoration(
                          hintText: 'Adres aramak için yazın...',
                          hintStyle: TextStyle(color: Colors.grey[500]),
                          filled: true,
                          fillColor: _cardBg(isDark),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          prefixIcon: const Icon(Icons.search, color: Colors.grey),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        ),
                        textStyle: const TextStyle(color: Colors.white),
                        debounceTime: 400,
                        countries: const ['de'],
                        isLatLngRequired: false,
                        getPlaceDetailWithLatLng: (prediction) {
                          // Place seçildiğinde
                          selectedPlaceId = prediction.placeId;
                          debugPrint('Selected place: ${prediction.description}');
                        },
                        itemClick: (Prediction prediction) {
                          addressSearchController.text = prediction.description ?? '';
                          addressSearchController.selection = TextSelection.fromPosition(
                            TextPosition(offset: prediction.description?.length ?? 0),
                          );
                          
                          // Adresin parçalarını parse et
                          final parts = prediction.description?.split(',') ?? [];
                          if (parts.isNotEmpty) {
                            setModalState(() {
                              streetController.text = parts[0].trim();
                              if (parts.length > 1) {
                                // Posta kodu ve şehir genellikle "12345 CityName" formatında
                                final cityPart = parts[1].trim();
                                final postalMatch = RegExp(r'(\d{5})\s*(.*)').firstMatch(cityPart);
                                if (postalMatch != null) {
                                  postalCodeController.text = postalMatch.group(1) ?? '';
                                  cityController.text = postalMatch.group(2)?.trim() ?? '';
                                } else {
                                  cityController.text = cityPart;
                                }
                              }
                            });
                          }
                        },
                        itemBuilder: (context, index, prediction) {
                          return Container(
                            padding: const EdgeInsets.all(12),
                            color: _cardBg(isDark),
                            child: Row(
                              children: [
                                const Icon(Icons.location_on, color: Colors.grey, size: 20),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    prediction.description ?? '',
                                    style: const TextStyle(color: Colors.white, fontSize: 14),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                        seperatedBuilder: const Divider(height: 1, color: Colors.grey),
                        isCrossBtnShown: true,
                        containerHorizontalPadding: 0,
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // === ADRES BİLGİLERİ ===
                      const Text('📍 Adres Bilgileri', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: streetController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: 'Sokak / Cadde',
                          hintText: 'Örn: Hauptstraße 15',
                          labelStyle: TextStyle(color: Colors.grey[400]),
                          hintStyle: TextStyle(color: Colors.grey[600]),
                          filled: true,
                          fillColor: _cardBg(isDark),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          prefixIcon: const Icon(Icons.location_on, color: Colors.grey),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: postalCodeController,
                              style: const TextStyle(color: Colors.white),
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Posta Kodu',
                                hintText: '41836',
                                labelStyle: TextStyle(color: Colors.grey[400]),
                                hintStyle: TextStyle(color: Colors.grey[600]),
                                filled: true,
                                fillColor: _cardBg(isDark),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 2,
                            child: TextField(
                              controller: cityController,
                              style: const TextStyle(color: Colors.white),
                              decoration: InputDecoration(
                                labelText: 'Şehir',
                                hintText: 'Hückelhoven',
                                labelStyle: TextStyle(color: Colors.grey[400]),
                                hintStyle: TextStyle(color: Colors.grey[600]),
                                filled: true,
                                fillColor: _cardBg(isDark),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                              ),
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // === NOT ===
                      const Text('📝 Açıklama', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: noteController,
                        style: const TextStyle(color: Colors.white),
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Park hakkında bilgi ekleyin...\nÖrn: Cadde boyu sağlı sollu park edilebilir.',
                          hintStyle: TextStyle(color: Colors.grey[600]),
                          filled: true,
                          fillColor: _cardBg(isDark),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // === RESİMLER ===
                      const Text('📷 Resimler (Max 3)', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          // Mevcut seçili resimler
                          ...selectedImages.asMap().entries.map((entry) => Stack(
                            children: [
                              Container(
                                width: 80,
                                height: 80,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  image: DecorationImage(
                                    image: FileImage(entry.value),
                                    fit: BoxFit.cover,
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: GestureDetector(
                                  onTap: () {
                                    setModalState(() => selectedImages.removeAt(entry.key));
                                  },
                                  child: Container(
                                    width: 24,
                                    height: 24,
                                    decoration: const BoxDecoration(
                                      color: Colors.red,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.close, color: Colors.white, size: 16),
                                  ),
                                ),
                              ),
                            ],
                          )),
                          // Resim ekleme butonu
                          if (selectedImages.length < 3)
                            GestureDetector(
                              onTap: () async {
                                final picker = ImagePicker();
                                final pickedFile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                                if (pickedFile != null) {
                                  setModalState(() => selectedImages.add(File(pickedFile.path)));
                                }
                              },
                              child: Container(
                                width: 80,
                                height: 80,
                                decoration: BoxDecoration(
                                  color: _cardBg(isDark),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.grey[600]!, style: BorderStyle.solid, width: 2),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.add_photo_alternate, color: Colors.grey[400], size: 28),
                                    const SizedBox(height: 4),
                                    Text('Ekle', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                      
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
              // Kaydet butonu
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: _surfaceDark(isDark),
                  border: Border(top: BorderSide(color: Colors.grey[800]!)),
                ),
                child: SafeArea(
                  top: false,
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: isUploading ? null : () async {
                        if (streetController.text.isEmpty || cityController.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Adres bilgilerini doldurun'), backgroundColor: Colors.orange),
                          );
                          return;
                        }
                        
                        setModalState(() => isUploading = true);
                        
                        try {
                          // Resimleri Firebase Storage'a yükle
                          List<String> imageUrls = [];
                          for (int i = 0; i < selectedImages.length; i++) {
                            final file = selectedImages[i];
                            final fileName = 'parking_${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
                            final storageRef = FirebaseStorage.instance.ref().child('kermes/${widget.event.id}/parking/$fileName');
                            await storageRef.putFile(file);
                            final url = await storageRef.getDownloadURL();
                            imageUrls.add(url);
                          }
                          
                          // Firestore'a kaydet
                          final newParking = {
                            'street': streetController.text,
                            'city': cityController.text,
                            'postalCode': postalCodeController.text,
                            'country': 'Deutschland',
                            'note': noteController.text.isNotEmpty ? noteController.text : null,
                            'images': imageUrls,
                            if (selectedPlaceId != null) 'placeId': selectedPlaceId,
                          };
                          
                          await FirebaseFirestore.instance.collection('kermes_events').doc(widget.event.id).update({
                            'parkingLocations': FieldValue.arrayUnion([newParking]),
                          });
                          
                          if (mounted) Navigator.pop(context, true);
                        } catch (e) {
                          setModalState(() => isUploading = false);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: isUploading
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                                SizedBox(width: 12),
                                Text('Yükleniyor...', style: TextStyle(color: Colors.white, fontSize: 16)),
                              ],
                            )
                          : const Text('Park Alanı Ekle', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
    
    if (result == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('✅ Park alanı eklendi!'),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }
  
  /// Park alanı düzenle dialog - resim ekleme/silme özelliği ile
  Future<void> _showEditParkingDialog(int index) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final info = _parkingList[index];
    final streetController = TextEditingController(text: info.street);
    final cityController = TextEditingController(text: info.city);
    final postalCodeController = TextEditingController(text: info.postalCode);
    final noteController = TextEditingController(text: info.note ?? '');
    List<String> existingImages = List<String>.from(info.images);
    List<File> newImages = [];
    bool isUploading = false;
    
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      enableDrag: true,
      isDismissible: true,
      backgroundColor: Colors.transparent,
      builder: (context) => GestureDetector(
        onHorizontalDragEnd: (details) {
          if (details.primaryVelocity != null && details.primaryVelocity! > 300) {
            Navigator.pop(context, false);
          }
        },
        child: StatefulBuilder(
          builder: (context, setModalState) => Container(
            height: MediaQuery.of(context).size.height * 0.85,
            decoration: BoxDecoration(
              color: _surfaceDark(isDark),
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                // Handle bar
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
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context, false),
                        icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 22),
                      ),
                      Expanded(
                        child: Text(
                          'Park Alanı ${index + 1} Düzenle',
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                ),
                // Form
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Adres Bilgileri
                        const Text('📍 Adres Bilgileri', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        TextField(
                          controller: streetController,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            labelText: 'Sokak / Cadde',
                            labelStyle: TextStyle(color: Colors.grey[400]),
                            filled: true,
                            fillColor: _cardBg(isDark),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                            prefixIcon: const Icon(Icons.location_on, color: Colors.grey),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: postalCodeController,
                                style: const TextStyle(color: Colors.white),
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(
                                  labelText: 'Posta Kodu',
                                  labelStyle: TextStyle(color: Colors.grey[400]),
                                  filled: true,
                                  fillColor: _cardBg(isDark),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 2,
                              child: TextField(
                                controller: cityController,
                                style: const TextStyle(color: Colors.white),
                                decoration: InputDecoration(
                                  labelText: 'Şehir',
                                  labelStyle: TextStyle(color: Colors.grey[400]),
                                  filled: true,
                                  fillColor: _cardBg(isDark),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                ),
                              ),
                            ),
                          ],
                        ),
                        
                        const SizedBox(height: 24),
                        
                        // Not
                        const Text('📝 Açıklama', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        TextField(
                          controller: noteController,
                          style: const TextStyle(color: Colors.white),
                          maxLines: 3,
                          decoration: InputDecoration(
                            hintText: 'Park hakkında bilgi...',
                            hintStyle: TextStyle(color: Colors.grey[600]),
                            filled: true,
                            fillColor: _cardBg(isDark),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          ),
                        ),
                        
                        const SizedBox(height: 24),
                        
                        // Resimler
                        const Text('📷 Resimler', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            // Mevcut resimler (URL)
                            ...existingImages.asMap().entries.map((entry) => Stack(
                              children: [
                                Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    image: DecorationImage(
                                      image: NetworkImage(entry.value),
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: GestureDetector(
                                    onTap: () {
                                      setModalState(() => existingImages.removeAt(entry.key));
                                    },
                                    child: Container(
                                      width: 24,
                                      height: 24,
                                      decoration: const BoxDecoration(
                                        color: Colors.red,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.close, color: Colors.white, size: 16),
                                    ),
                                  ),
                                ),
                              ],
                            )),
                            // Yeni eklenen resimler (File)
                            ...newImages.asMap().entries.map((entry) => Stack(
                              children: [
                                Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    image: DecorationImage(
                                      image: FileImage(entry.value),
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: GestureDetector(
                                    onTap: () {
                                      setModalState(() => newImages.removeAt(entry.key));
                                    },
                                    child: Container(
                                      width: 24,
                                      height: 24,
                                      decoration: const BoxDecoration(
                                        color: Colors.red,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.close, color: Colors.white, size: 16),
                                    ),
                                  ),
                                ),
                              ],
                            )),
                            // Resim ekleme butonu
                            if (existingImages.length + newImages.length < 5)
                              GestureDetector(
                                onTap: () async {
                                  final picker = ImagePicker();
                                  final pickedFile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                                  if (pickedFile != null) {
                                    setModalState(() => newImages.add(File(pickedFile.path)));
                                  }
                                },
                                child: Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    color: _cardBg(isDark),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.grey[600]!, style: BorderStyle.solid, width: 2),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.add_photo_alternate, color: Colors.grey[400], size: 28),
                                      const SizedBox(height: 4),
                                      Text('Ekle', style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                        
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
                // Kaydet butonu
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: _surfaceDark(isDark),
                    border: Border(top: BorderSide(color: Colors.grey[800]!)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isUploading ? null : () async {
                          if (streetController.text.isEmpty || cityController.text.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Adres bilgilerini doldurun'), backgroundColor: Colors.orange),
                            );
                            return;
                          }
                          
                          setModalState(() => isUploading = true);
                          
                          try {
                            // Yeni resimleri yükle
                            List<String> allImageUrls = List<String>.from(existingImages);
                            for (int i = 0; i < newImages.length; i++) {
                              final file = newImages[i];
                              final fileName = 'parking_${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
                              final storageRef = FirebaseStorage.instance.ref().child('kermes/${widget.event.id}/parking/$fileName');
                              await storageRef.putFile(file);
                              final url = await storageRef.getDownloadURL();
                              allImageUrls.add(url);
                            }
                            
                            // Mevcut listeyi al, güncelle, kaydet
                            final updatedList = _parkingList.map((p) => p.toJson()).toList();
                            updatedList[index] = {
                              'street': streetController.text,
                              'city': cityController.text,
                              'postalCode': postalCodeController.text,
                              'country': info.country,
                              'note': noteController.text.isNotEmpty ? noteController.text : null,
                              'images': allImageUrls,
                              'lat': info.lat,
                              'lng': info.lng,
                            };
                            
                            await FirebaseFirestore.instance.collection('kermes_events').doc(widget.event.id).update({
                              'parkingLocations': updatedList,
                            });
                            
                            if (mounted) Navigator.pop(context, true);
                          } catch (e) {
                            setModalState(() => isUploading = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                              );
                            }
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: isUploading
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                                  SizedBox(width: 12),
                                  Text('Kaydediliyor...', style: TextStyle(color: Colors.white, fontSize: 16)),
                                ],
                              )
                            : const Text('Değişiklikleri Kaydet', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    
    if (result == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('✅ Park alanı güncellendi!'),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }
  
  /// Park alanı sil
  Future<void> _deleteParkingLocation(int index) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _surfaceDark(isDark),
        title: const Text('Park Alanını Sil', style: TextStyle(color: Colors.white)),
        content: const Text('Bu park alanını silmek istediğinize emin misiniz?', style: TextStyle(color: Colors.grey)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('İptal', style: TextStyle(color: Colors.grey[400])),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    
    if (confirm == true) {
      try {
        final updatedList = _parkingList.map((p) => p.toJson()).toList();
        updatedList.removeAt(index);
        
        await FirebaseFirestore.instance.collection('kermes_events').doc(widget.event.id).update({
          'parkingLocations': updatedList,
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Park alanı silindi'),
              backgroundColor: Colors.orange,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
  
  /// Tam ekran resim görüntüleyici
  void _showFullScreenImage(BuildContext context, String imageUrl) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Center(
            child: InteractiveViewer(
              child: Image.network(imageUrl, fit: BoxFit.contain),
            ),
          ),
        ),
      ),
    );
  }
}
