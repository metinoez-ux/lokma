import 'dart:io';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

const Color _parkRed = Color(0xFFFF3333);

class ParkingManagementTab extends StatefulWidget {
  final String kermesId;
  final String kermesName;

  const ParkingManagementTab({
    super.key,
    required this.kermesId,
    required this.kermesName,
  });

  @override
  State<ParkingManagementTab> createState() => _ParkingManagementTabState();
}

class _ParkingManagementTabState extends State<ParkingManagementTab> {
  List<Map<String, dynamic>> _parkingList = [];
  bool _isLoading = true;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = FirebaseFirestore.instance
        .collection('kermes_events')
        .doc(widget.kermesId)
        .snapshots()
        .listen((doc) {
      if (doc.exists && mounted) {
        final raw = doc.data()?['parkingLocations'] as List<dynamic>? ?? [];
        setState(() {
          _parkingList = raw
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  // Doluluk durumu rengi
  Color _statusColor(String? status) {
    if (status == 'available') return Colors.green;
    if (status == 'full') return Colors.red;
    return Colors.orange;
  }

  String _statusLabel(String? status) {
    if (status == 'available') return 'Bos';
    if (status == 'full') return 'Dolu';
    return 'Belirsiz';
  }

  IconData _statusIcon(String? status) {
    if (status == 'available') return Icons.check_circle;
    if (status == 'full') return Icons.block;
    return Icons.help_outline;
  }

  // Lokal state'i aninda guncelle, Firestore'a arka planda yaz (gecikme yok)
  Future<void> _setStatus(int index, String? newStatus) async {
    if (index >= _parkingList.length) return;
    HapticFeedback.mediumImpact();

    // Aninda lokal guncelleme - UI hemen yanit verir
    setState(() {
      if (newStatus != null) {
        _parkingList[index]['status'] = newStatus;
        _parkingList[index]['statusUpdatedAt'] = DateTime.now().toIso8601String();
        _parkingList[index]['statusUpdatedBy'] = FirebaseAuth.instance.currentUser?.uid;
      } else {
        _parkingList[index].remove('status');
        _parkingList[index].remove('statusUpdatedAt');
        _parkingList[index].remove('statusUpdatedBy');
      }
    });

    // Arka planda Firestore'a yaz (lokal snapshot'i kullan, get() yok)
    try {
      final updatedList = _parkingList.map((e) => Map<String, dynamic>.from(e)).toList();
      await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .update({'parkingLocations': updatedList});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Kayit hatasi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // Navigasyon
  Future<void> _navigate(Map<String, dynamic> p) async {
    final lat = (p['latitude'] as num?)?.toDouble();
    final lng = (p['longitude'] as num?)?.toDouble();
    final street = p['street'] as String? ?? '';
    final city = p['city'] as String? ?? '';
    final address = '$street, $city';

    if (lat != null && lng != null) {
      final uri = Uri.parse(
          'https://maps.apple.com/?daddr=$lat,$lng&dirflg=d');
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
    }
    final encodedAddr = Uri.encodeComponent(address);
    await launchUrl(
      Uri.parse('https://maps.apple.com/?q=$encodedAddr'),
      mode: LaunchMode.externalApplication,
    );
  }

  // Park alani sil
  Future<void> _deleteParkingLocation(int index) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Park Alanini Sil'),
        content: const Text('Bu park alanini silmek istediginizden emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Iptal')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sil', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _parkingList.removeAt(index));
    try {
      final updatedList = _parkingList.map((e) => Map<String, dynamic>.from(e)).toList();
      await FirebaseFirestore.instance
          .collection('kermes_events')
          .doc(widget.kermesId)
          .update({'parkingLocations': updatedList});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Park alani silindi'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Silme hatasi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  // Park alani duzenle sheet'i
  Future<void> _showEditSheet(int index) async {
    final p = _parkingList[index];
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final noteCtrl = TextEditingController(text: p['note'] as String? ?? '');
    List<String> existingImages = List<String>.from(
      (p['images'] as List<dynamic>? ?? []).map((e) => e.toString())
    );
    if (p['imageUrl'] != null && existingImages.isEmpty) {
      existingImages = [p['imageUrl'] as String];
    }
    List<File> newImages = [];
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useRootNavigator: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setSheet) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx2).viewInsets.bottom),
          child: Container(
            height: MediaQuery.of(ctx2).size.height * 0.82,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                // Handle
                Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.grey[600], borderRadius: BorderRadius.circular(2)),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
                  child: Row(
                    children: [
                      IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx2)),
                      Expanded(
                        child: Text(
                          p['street'] as String? ?? 'Park Alani ${index + 1}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      // Sil butonu
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.red),
                        tooltip: 'Park alanini sil',
                        onPressed: () async {
                          Navigator.pop(ctx2);
                          await _deleteParkingLocation(index);
                        },
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // --- Durum ---
                        const Text('Doluluk Durumu', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            _StatusChip(
                              label: 'Belirsiz',
                              icon: Icons.help_outline,
                              active: (_parkingList[index]['status'] as String?) == null ||
                                  (_parkingList[index]['status'] as String?) == 'unknown',
                              color: Colors.orange,
                              onTap: () {
                                _setStatus(index, null);
                                setSheet(() {});
                              },
                            ),
                            const SizedBox(width: 8),
                            _StatusChip(
                              label: 'Bos',
                              icon: Icons.check_circle,
                              active: (_parkingList[index]['status'] as String?) == 'available',
                              color: Colors.green,
                              onTap: () {
                                _setStatus(index, 'available');
                                setSheet(() {});
                              },
                            ),
                            const SizedBox(width: 8),
                            _StatusChip(
                              label: 'Dolu',
                              icon: Icons.block,
                              active: (_parkingList[index]['status'] as String?) == 'full',
                              color: Colors.red,
                              onTap: () {
                                _setStatus(index, 'full');
                                setSheet(() {});
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // --- Not ---
                        const Text('Park Notu', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        const SizedBox(height: 10),
                        TextField(
                          controller: noteCtrl,
                          maxLines: 3,
                          keyboardType: TextInputType.multiline,
                          decoration: InputDecoration(
                            hintText: 'Ornek: Bu alana park etmek yasaktir...',
                            filled: true,
                            fillColor: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF2F2F7),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),

                        // --- Fotograflar ---
                        const Text('Fotograflar', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        const SizedBox(height: 10),
                        // Mevcut fotograflar
                        if (existingImages.isNotEmpty)
                          SizedBox(
                            height: 90,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: existingImages.length,
                              separatorBuilder: (_, __) => const SizedBox(width: 8),
                              itemBuilder: (_, imgIdx) => Stack(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: Image.network(
                                      existingImages[imgIdx],
                                      width: 90, height: 90,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        width: 90, height: 90,
                                        color: Colors.grey[300],
                                        child: const Icon(Icons.broken_image),
                                      ),
                                    ),
                                  ),
                                  // Sil X butonu
                                  Positioned(
                                    top: 2, right: 2,
                                    child: GestureDetector(
                                      onTap: () => setSheet(() => existingImages.removeAt(imgIdx)),
                                      child: Container(
                                        width: 22, height: 22,
                                        decoration: const BoxDecoration(
                                          color: Colors.red,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        // Yeni secilen (upload edilmemis) fotograflar
                        if (newImages.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          SizedBox(
                            height: 90,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: newImages.length,
                              separatorBuilder: (_, __) => const SizedBox(width: 8),
                              itemBuilder: (_, imgIdx) => Stack(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: Image.file(
                                      newImages[imgIdx],
                                      width: 90, height: 90,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  Positioned(
                                    top: 2, right: 2,
                                    child: GestureDetector(
                                      onTap: () => setSheet(() => newImages.removeAt(imgIdx)),
                                      child: Container(
                                        width: 22, height: 22,
                                        decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        // Foto ekle butonu (max 3)
                        if (existingImages.length + newImages.length < 3)
                          GestureDetector(
                            onTap: () async {
                              final picker = ImagePicker();
                              final picked = await picker.pickImage(
                                source: ImageSource.gallery,
                                imageQuality: 75,
                              );
                              if (picked != null) {
                                setSheet(() => newImages.add(File(picked.path)));
                              }
                            },
                            child: Container(
                              height: 56,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: const Color(0xFF2563EB).withOpacity(0.08),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF2563EB).withOpacity(0.3), style: BorderStyle.solid),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.add_photo_alternate, color: Color(0xFF2563EB)),
                                  SizedBox(width: 8),
                                  Text('Fotograf Ekle', style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        const SizedBox(height: 80),
                      ],
                    ),
                  ),
                ),
                // Kaydet butonu
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: saving ? null : () async {
                        setSheet(() => saving = true);
                        try {
                          // Yeni fotograflari yukle
                          List<String> uploadedUrls = [];
                          for (final file in newImages) {
                            final ref = FirebaseStorage.instance
                                .ref('kermes/${widget.kermesId}/parking/$index/${DateTime.now().millisecondsSinceEpoch}.jpg');
                            await ref.putFile(file);
                            uploadedUrls.add(await ref.getDownloadURL());
                          }
                          final allImages = [...existingImages, ...uploadedUrls];
                          // Lokal guncelle
                          setState(() {
                            _parkingList[index]['note'] = noteCtrl.text.trim();
                            _parkingList[index]['images'] = allImages;
                            _parkingList[index].remove('imageUrl');
                          });
                          // Firestore'a yaz
                          final updatedList = _parkingList.map((e) => Map<String, dynamic>.from(e)).toList();
                          await FirebaseFirestore.instance
                              .collection('kermes_events')
                              .doc(widget.kermesId)
                              .update({'parkingLocations': updatedList});
                          if (mounted) Navigator.pop(ctx2);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Park alani guncellendi'), backgroundColor: Colors.green),
                            );
                          }
                        } catch (e) {
                          setSheet(() => saving = false);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Kaydet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Park alani ekle
  Future<void> _showAddSheet() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streetCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final postalCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    List<File> images = [];
    bool gettingGps = false;
    bool saving = false;
    double? pickedLat;
    double? pickedLng;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useRootNavigator: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setSheet) => Padding(
          // Klavye acikken sheet yukari kayar, kapanmaz
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx2).viewInsets.bottom),
          child: Container(
            height: MediaQuery.of(ctx2).size.height * 0.88,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                // Handle
                Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[600],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx2),
                      ),
                      const Expanded(
                        child: Text(
                          'Yeni Park Alani',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                ),
                const Divider(height: 1),
                // Form
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Hizli Ekle', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _QuickButton(
                                icon: gettingGps ? Icons.hourglass_empty : Icons.my_location,
                                label: gettingGps ? 'Aliniyor...' : 'GPS Konumum',
                                color: const Color(0xFF2563EB),
                                onTap: gettingGps ? null : () async {
                                  setSheet(() => gettingGps = true);
                                  try {
                                    LocationPermission perm = await Geolocator.checkPermission();
                                    if (perm == LocationPermission.denied) {
                                      perm = await Geolocator.requestPermission();
                                    }
                                    if (perm == LocationPermission.deniedForever || perm == LocationPermission.denied) {
                                      throw Exception('Konum izni verilmedi');
                                    }
                                    final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
                                    pickedLat = pos.latitude;
                                    pickedLng = pos.longitude;
                                    final marks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
                                    if (marks.isNotEmpty) {
                                      final m = marks.first;
                                      setSheet(() {
                                        streetCtrl.text = '${m.thoroughfare ?? m.street ?? ''} ${m.subThoroughfare ?? ''}'.trim();
                                        cityCtrl.text = m.locality ?? m.subAdministrativeArea ?? '';
                                        postalCtrl.text = m.postalCode ?? '';
                                      });
                                    }
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('GPS konumu alindi'), backgroundColor: Colors.green, duration: Duration(seconds: 2)),
                                    );
                                  } catch (e) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
                                    );
                                  } finally {
                                    setSheet(() => gettingGps = false);
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _QuickButton(
                                icon: Icons.add_a_photo,
                                label: 'Fotograf Ekle',
                                color: Colors.teal,
                                onTap: (pickedLat == null && streetCtrl.text.trim().isEmpty) || images.length >= 3
                                    ? null
                                    : () async {
                                        final picker = ImagePicker();
                                        final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
                                        if (file != null) setSheet(() => images.add(File(file.path)));
                                      },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        _SectionTitle(text: 'Adres'),
                        const SizedBox(height: 10),
                        _Field(controller: streetCtrl, label: 'Sokak / Cadde', hint: 'Hauptstrasse 15', icon: Icons.location_on, isDark: isDark),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(child: _Field(controller: postalCtrl, label: 'Posta Kodu', hint: '41836', keyboardType: TextInputType.number, isDark: isDark)),
                            const SizedBox(width: 10),
                            Expanded(flex: 2, child: _Field(controller: cityCtrl, label: 'Sehir', hint: 'Hückelhoven', isDark: isDark)),
                          ],
                        ),
                        const SizedBox(height: 20),
                        _SectionTitle(text: 'Aciklama (opsiyonel)'),
                        const SizedBox(height: 10),
                        _Field(controller: noteCtrl, label: 'Not', hint: 'Orn: Cadde boyu park edilebilir', maxLines: 3, isDark: isDark),
                        if (images.isNotEmpty) ...[
                          const SizedBox(height: 20),
                          _SectionTitle(text: 'Fotograflar'),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 10,
                            children: images.asMap().entries.map((e) => Stack(
                              children: [
                                Container(
                                  width: 80, height: 80,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(10),
                                    image: DecorationImage(image: FileImage(e.value), fit: BoxFit.cover),
                                  ),
                                ),
                                Positioned(
                                  top: 2, right: 2,
                                  child: GestureDetector(
                                    onTap: () => setSheet(() => images.removeAt(e.key)),
                                    child: Container(
                                      width: 22, height: 22,
                                      decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                                      child: const Icon(Icons.close, size: 14, color: Colors.white),
                                    ),
                                  ),
                                ),
                              ],
                            )).toList(),
                          ),
                        ],
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
                // Kaydet butonu
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                    border: Border(top: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: saving ? null : () async {
                          if (streetCtrl.text.isEmpty || cityCtrl.text.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Lutfen sokak ve sehir bilgisi girin'), backgroundColor: Colors.amber),
                            );
                            return;
                          }
                          setSheet(() => saving = true);
                          try {
                            final urls = <String>[];
                            for (int i = 0; i < images.length; i++) {
                              final ref = FirebaseStorage.instance.ref()
                                  .child('kermes/${widget.kermesId}/parking/${DateTime.now().millisecondsSinceEpoch}_$i.jpg');
                              await ref.putFile(images[i]);
                              urls.add(await ref.getDownloadURL());
                            }
                            final newEntry = <String, dynamic>{
                              'street': streetCtrl.text.trim(),
                              'city': cityCtrl.text.trim(),
                              'postalCode': postalCtrl.text.trim(),
                              'country': 'Deutschland',
                              'images': urls,
                              if (noteCtrl.text.trim().isNotEmpty) 'note': noteCtrl.text.trim(),
                              if (pickedLat != null) 'latitude': pickedLat,
                              if (pickedLng != null) 'longitude': pickedLng,
                            };
                            await FirebaseFirestore.instance
                                .collection('kermes_events')
                                .doc(widget.kermesId)
                                .update({'parkingLocations': FieldValue.arrayUnion([newEntry])});
                            if (ctx2.mounted) Navigator.pop(ctx2);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Park alani eklendi'), backgroundColor: Colors.green),
                              );
                            }
                          } catch (e) {
                            setSheet(() => saving = false);
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
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: saving
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Park Alani Kaydet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
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
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF121212) : const Color(0xFFF2F2F7);
    final cardBg = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      backgroundColor: bg,
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'acil_anons',
            onPressed: _showAnnouncementSheet,
            backgroundColor: Colors.red,
            icon: const Icon(Icons.campaign, color: Colors.white, size: 20),
            label: const Text('Acil Anons',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
          ),
          const SizedBox(height: 10),
          FloatingActionButton.extended(
            heroTag: 'park_ekle',
            onPressed: _showAddSheet,
            backgroundColor: const Color(0xFF2563EB),
            icon: const Icon(Icons.add_location_alt, color: Colors.white),
            label: const Text('Park Alani Ekle',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: _parkingList.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.local_parking,
                      size: 72,
                      color: isDark ? Colors.grey[700] : Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text(
                    'Henuz park alani eklenmemis',
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Asagidaki butona basarak ekleyebilirsiniz',
                    style: TextStyle(
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 80),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              itemCount: _parkingList.length,
              itemBuilder: (ctx, i) {
                final p = _parkingList[i];
                final status = p['status'] as String?;
                final street = p['street'] as String? ?? 'Park Alani ${i + 1}';
                final city = p['city'] as String? ?? '';
                final note = p['note'] as String? ?? '';
                final statusColor = _statusColor(status);

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFF2563EB).withOpacity(0.2),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            // Numara
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: const Color(0xFF2563EB).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  '${i + 1}',
                                  style: const TextStyle(
                                    color: Color(0xFF2563EB),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    street,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if (city.isNotEmpty)
                                    Text(
                                      city,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: isDark
                                            ? Colors.grey[400]
                                            : Colors.grey[600],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            // Navigasyon
                            IconButton(
                              icon: const Icon(Icons.navigation, color: Color(0xFF2563EB)),
                              onPressed: () => _navigate(p),
                              tooltip: 'Navigasyon',
                            ),
                            // Duzenle
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, color: Colors.grey),
                              onPressed: () => _showEditSheet(i),
                              tooltip: 'Duzenle / Not / Fotograf',
                            ),
                          ],
                        ),
                        if (note.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white.withOpacity(0.05)
                                  : Colors.grey[100],
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              note,
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark
                                    ? Colors.white70
                                    : Colors.black54,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        // Doluluk butonlari
                        Row(
                          children: [
                            const Text(
                              'Durum: ',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w500),
                            ),
                            const Spacer(),
                            // 3 durum butonu - anlik tepki
                            _StatusChip(
                              label: 'Belirsiz',
                              icon: Icons.help_outline,
                              active: status == null || status == 'unknown',
                              color: Colors.orange,
                              onTap: () => _setStatus(i, null),
                            ),
                            const SizedBox(width: 6),
                            _StatusChip(
                              label: 'Bos',
                              icon: Icons.check_circle,
                              active: status == 'available',
                              color: Colors.green,
                              onTap: () => _setStatus(i, 'available'),
                            ),
                            const SizedBox(width: 6),
                            _StatusChip(
                              label: 'Dolu',
                              icon: Icons.block,
                              active: status == 'full',
                              color: Colors.red,
                              onTap: () => _setStatus(i, 'full'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }

  /// Acil arac anonsu bottom sheet
  Future<void> _showAnnouncementSheet() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    String plate = '';
    String color = '';
    String brand = '';
    String? imageUrl;
    bool isSending = false;
    bool isUploading = false;

    final colorOptions = ['Siyah', 'Beyaz', 'Gri', 'Gumus', 'Mavi', 'Kirmizi', 'Yesil'];
    final brandOptions = ['VW', 'BMW', 'Mercedes', 'Audi', 'Opel', 'Ford', 'Toyota', 'Renault'];

    double kermesLat = 0;
    double kermesLng = 0;
    try {
      final doc = await FirebaseFirestore.instance.collection('kermes_events').doc(widget.kermesId).get();
      if (doc.exists) {
        kermesLat = (doc.data()?['latitude'] as num?)?.toDouble() ?? 0;
        kermesLng = (doc.data()?['longitude'] as num?)?.toDouble() ?? 0;
      }
    } catch (_) {}

    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useRootNavigator: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setSheet) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx2).viewInsets.bottom),
          child: Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx2).size.height * 0.85),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(margin: const EdgeInsets.only(top: 12, bottom: 8), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[500], borderRadius: BorderRadius.circular(2))),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: Colors.red.withOpacity(isDark ? 0.2 : 0.1), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.directions_car, color: Colors.red, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Acil Arac Anonsu', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Theme.of(ctx2).colorScheme.onSurface)),
                          Text(widget.kermesName, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                        ]),
                      ),
                      GestureDetector(onTap: () => Navigator.pop(ctx2), child: Icon(Icons.close, color: Colors.grey[500])),
                    ],
                  ),
                ),
                Divider(color: isDark ? Colors.grey[800] : Colors.grey[200]),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 12),
                        Text('Plaka No *', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Theme.of(ctx2).colorScheme.onSurface)),
                        const SizedBox(height: 8),
                        TextField(
                          textCapitalization: TextCapitalization.characters,
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Theme.of(ctx2).colorScheme.onSurface, letterSpacing: 2),
                          decoration: InputDecoration(
                            hintText: 'HS QT 1034', hintStyle: TextStyle(color: Colors.grey[600]),
                            filled: true, fillColor: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F7),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                          onChanged: (v) => plate = v,
                        ),
                        const SizedBox(height: 16),
                        Text('Araba Rengi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Theme.of(ctx2).colorScheme.onSurface)),
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, runSpacing: 8, children: colorOptions.map((c) => GestureDetector(
                          onTap: () { HapticFeedback.selectionClick(); setSheet(() => color = color == c ? '' : c); },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(color: color == c ? Colors.red : (isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF0F0F2)), borderRadius: BorderRadius.circular(20)),
                            child: Text(c, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color == c ? Colors.white : (isDark ? Colors.grey[300] : Colors.grey[700]))),
                          ),
                        )).toList()),
                        const SizedBox(height: 16),
                        Text('Araba Markasi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Theme.of(ctx2).colorScheme.onSurface)),
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, runSpacing: 8, children: brandOptions.map((b) => GestureDetector(
                          onTap: () { HapticFeedback.selectionClick(); setSheet(() => brand = brand == b ? '' : b); },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(color: brand == b ? Colors.red : (isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF0F0F2)), borderRadius: BorderRadius.circular(20)),
                            child: Text(b, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: brand == b ? Colors.white : (isDark ? Colors.grey[300] : Colors.grey[700]))),
                          ),
                        )).toList()),
                        const SizedBox(height: 16),
                        Text('Arac Fotografi (Opsiyonel)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Theme.of(ctx2).colorScheme.onSurface)),
                        const SizedBox(height: 8),
                        if (imageUrl != null && imageUrl!.isNotEmpty)
                          Stack(children: [
                            ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(imageUrl!, height: 150, width: double.infinity, fit: BoxFit.cover)),
                            Positioned(top: 8, right: 8, child: GestureDetector(
                              onTap: () => setSheet(() => imageUrl = null),
                              child: Container(padding: const EdgeInsets.all(4), decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle), child: const Icon(Icons.close, color: Colors.white, size: 18)),
                            )),
                          ])
                        else
                          GestureDetector(
                            onTap: isUploading ? null : () async {
                              final picker = ImagePicker();
                              final picked = await picker.pickImage(source: ImageSource.camera, maxWidth: 1200, imageQuality: 80);
                              if (picked == null) return;
                              setSheet(() => isUploading = true);
                              try {
                                final file = File(picked.path);
                                final ref = FirebaseStorage.instance.ref().child('kermes_parking/${widget.kermesId}/${DateTime.now().millisecondsSinceEpoch}.jpg');
                                await ref.putFile(file);
                                final url = await ref.getDownloadURL();
                                setSheet(() { imageUrl = url; isUploading = false; });
                              } catch (e) {
                                debugPrint('Foto yukleme hatasi: $e');
                                setSheet(() => isUploading = false);
                              }
                            },
                            child: Container(
                              height: 80,
                              decoration: BoxDecoration(color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F7), borderRadius: BorderRadius.circular(12), border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!)),
                              child: Center(child: isUploading
                                ? Column(mainAxisSize: MainAxisSize.min, children: [
                                    SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.red[400])),
                                    const SizedBox(height: 6),
                                    Text('Yukleniyor...', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                                  ])
                                : Column(mainAxisSize: MainAxisSize.min, children: [
                                    Icon(Icons.camera_alt_rounded, color: Colors.grey[500], size: 28),
                                    const SizedBox(height: 4),
                                    Text('Foto Cek', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                                  ])),
                            ),
                          ),
                        const SizedBox(height: 16),
                        if (plate.trim().isNotEmpty)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: isDark ? Colors.orange[900]!.withOpacity(0.15) : Colors.orange[50], borderRadius: BorderRadius.circular(12), border: Border.all(color: isDark ? Colors.orange[800]!.withOpacity(0.3) : Colors.orange[200]!)),
                            child: Row(children: [
                              Icon(Icons.preview, size: 16, color: Colors.orange[700]),
                              const SizedBox(width: 8),
                              Expanded(child: Text(
                                'ACIL PARK ANONSU: ${color.isNotEmpty ? "$color " : ""}${brand.isNotEmpty ? "$brand " : ""}(${plate.trim().toUpperCase()}) plakali arac sahibi, lutfen aracinizi acilen cekiniz!',
                                style: TextStyle(fontSize: 12, color: isDark ? Colors.orange[300] : Colors.orange[900]),
                              )),
                            ]),
                          ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: plate.trim().isEmpty || isSending || isUploading ? null : () async {
                              setSheet(() => isSending = true);
                              bool success = false;
                              try {
                                success = await _sendAnnouncementViaApi(plate: plate.trim().toUpperCase(), color: color, brand: brand, vehicleImageUrl: imageUrl, kermesLat: kermesLat, kermesLng: kermesLng);
                              } catch (e) {
                                debugPrint('[STAFF-PARKING] Exception: $e');
                              }
                              setSheet(() => isSending = false);
                              if (ctx2.mounted) Navigator.pop(ctx2);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                  content: Row(children: [
                                    Icon(success ? Icons.check_circle : Icons.warning_amber, color: Colors.white),
                                    const SizedBox(width: 12),
                                    Expanded(child: Text(success ? 'Acil arac anonsu gonderildi!' : 'Anons gonderilemedi, tekrar deneyin.')),
                                  ]),
                                  backgroundColor: success ? Colors.green : Colors.orange,
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ));
                              }
                            },
                            icon: isSending ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.campaign, size: 20),
                            label: Text(isSending ? 'Gonderiliyor...' : 'Acil Anons Gonder', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white, disabledBackgroundColor: Colors.red.withOpacity(0.4), padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<bool> _sendAnnouncementViaApi({required String plate, required String color, required String brand, String? vehicleImageUrl, required double kermesLat, required double kermesLng}) async {
    try {
      String vehicleInfo = '';
      if (color.isNotEmpty) vehicleInfo += '$color ';
      if (brand.isNotEmpty) vehicleInfo += '$brand ';
      vehicleInfo += '($plate)';
      final message = 'ACIL PARK ANONSU: $vehicleInfo plakali arac sahibi, lutfen aracinizi acilen cekiniz!';
      debugPrint('[STAFF-PARKING-PUSH] Sending: plate=$plate, color=$color, brand=$brand, imageUrl=${vehicleImageUrl != null ? "YES (${vehicleImageUrl.length} chars)" : "NULL"}');
      final uri = Uri.parse('https://lokma.shop/api/notifications/kermes-parking-announcement');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'kermesId': widget.kermesId, 'kermesTitle': widget.kermesName, 'message': message,
          'vehiclePlate': plate, 'vehicleColor': color, 'vehicleBrand': brand, 'vehicleImageUrl': vehicleImageUrl,
          'targetRadiusKm': 1, 'kermesLat': kermesLat, 'kermesLng': kermesLng,
          'targetGroups': {'favorites': true, 'staff': true, 'nearby': true},
        }),
      );
      debugPrint('[STAFF-PARKING-PUSH] Response: ${response.statusCode} - ${response.body}');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
      return false;
    } catch (e) {
      debugPrint('[STAFF-PARKING-PUSH] Error: $e');
      if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gonderilemedi: $e'), backgroundColor: Colors.red)); }
      return false;
    }
  }
}

// ─── Yardimci widgetlar ─────────────────────────────────────────────────────


class _StatusChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool active;
  final Color color;
  final VoidCallback onTap;

  const _StatusChip({
    required this.label,
    required this.icon,
    required this.active,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? color.withOpacity(0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? color : Colors.grey.withOpacity(0.3),
            width: active ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: active ? color : Colors.grey[600]),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                color: active ? color : Colors.grey[700],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _QuickButton({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Column(
          children: [
            Icon(icon, color: onTap == null ? Colors.grey : color, size: 26),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: onTap == null ? Colors.grey : color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle({required this.text});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData? icon;
  final TextInputType? keyboardType;
  final int maxLines;
  final bool isDark;

  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    this.icon,
    this.keyboardType,
    this.maxLines = 1,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: icon != null ? Icon(icon, size: 20) : null,
        filled: true,
        fillColor: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF2F2F7),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}
