import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';

class ProofOfDeliverySheet extends StatefulWidget {
  final String orderId;
  const ProofOfDeliverySheet({super.key, required this.orderId});

  @override
  State<ProofOfDeliverySheet> createState() => _ProofOfDeliverySheetState();
}

class _ProofOfDeliverySheetState extends State<ProofOfDeliverySheet> {
  String? _selectedType;
  String? _photoUrl;
  bool _isUploading = false;
  File? _localPhoto;

  Future<void> _capturePhoto() async {
    final picker = ImagePicker();
    try {
      final photo = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      
      if (photo == null) return;
      
      if (mounted) {
        setState(() {
          _localPhoto = File(photo.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fotoğraf seçilemedi veya çekilemedi.')),
        );
      }
    }
  }

  void _complete() {
    if (_selectedType == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen teslimat şeklini seçin.')),
      );
      return;
    }
    
    if ((_selectedType == 'left_at_door' || _selectedType == 'handed_to_other') && _localPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bu teslimat tipi için kanıt fotoğrafı zorunludur!'), backgroundColor: Colors.red),
      );
      return;
    }
    
    Navigator.pop(context, {
      'deliveryType': _selectedType,
      'photoPath': _localPhoto?.path,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).padding.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Teslimatı Tamamla (PoD)',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          const Text('Siparişi nereye teslim ettiniz?', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          
          _buildOption('personal_handoff', 'Müşteriye Bizzat', Icons.person),
          _buildOption('left_at_door', 'Kapıya Bıraktım', Icons.door_front_door),
          _buildOption('handed_to_other', 'Komşuya Bıraktım', Icons.people),
          
          const SizedBox(height: 16),
          
          if (_selectedType != null) ...[
            if (_localPhoto != null)
              Stack(
                alignment: Alignment.center,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.file(_localPhoto!, height: 120, width: double.infinity, fit: BoxFit.cover),
                  ),
                  Positioned(
                    right: 8, top: 8,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      style: IconButton.styleFrom(backgroundColor: Colors.black54),
                      onPressed: () => setState(() {
                        _localPhoto = null;
                      }),
                    ),
                  ),
                ],
              )
            else
              OutlinedButton.icon(
                onPressed: _capturePhoto,
                icon: const Icon(Icons.camera_alt),
                label: Text((_selectedType == 'left_at_door' || _selectedType == 'handed_to_other') 
                    ? 'Fotoğraf Çek (Zorunlu)' 
                    : 'Fotoğraf Çek (İsteğe Bağlı)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: BorderSide(
                    color: (_selectedType == 'left_at_door' || _selectedType == 'handed_to_other') ? Colors.red : Colors.grey,
                  ),
                ),
              ),
            
            const SizedBox(height: 16),
            
              ElevatedButton(
                onPressed: _complete,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Teslimatı Onayla', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildOption(String type, String title, IconData icon) {
    final isSelected = _selectedType == type;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: isSelected ? Colors.green : Colors.transparent, width: 2),
      ),
      color: isSelected ? Colors.green.withOpacity(0.1) : null,
      child: ListTile(
        leading: Icon(icon, color: isSelected ? Colors.green : null),
        title: Text(title, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
        trailing: isSelected ? const Icon(Icons.check_circle, color: Colors.green) : null,
        onTap: () => setState(() => _selectedType = type),
      ),
    );
  }
}
