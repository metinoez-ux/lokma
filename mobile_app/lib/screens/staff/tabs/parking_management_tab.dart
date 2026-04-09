import 'dart:io';
import 'dart:async';

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
                                        streetCtrl.text = '${m.street ?? ''} ${m.subThoroughfare ?? ''}'.trim();
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
                                onTap: images.length >= 3 ? null : () async {
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
                          backgroundColor: _parkRed,
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSheet,
        backgroundColor: _parkRed,
        icon: const Icon(Icons.add_location_alt, color: Colors.white),
        label: const Text('Park Alani Ekle',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
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
                      color: statusColor.withOpacity(0.3),
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
                              icon:
                                  const Icon(Icons.navigation, color: Color(0xFF2563EB)),
                              onPressed: () => _navigate(p),
                              tooltip: 'Navigasyon',
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
