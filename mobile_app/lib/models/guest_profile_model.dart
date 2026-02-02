import 'package:cloud_firestore/cloud_firestore.dart';

/// Guest (Misafir) Profil Modeli
/// Kermes vb. sipariş akışlarında telefon numarasıyla oluşturulan minimal profil
class GuestProfile {
  final String id; // Telefon numarasının hash'i veya normalize edilmiş hali
  final String name;
  final String phone;
  final bool isGuest; // Tam kayıt yapmamış kullanıcı
  final DateTime createdAt;
  final DateTime? lastOrderAt;
  final int orderCount;
  final String? email; // Opsiyonel - sonra eklenebilir
  final String? firebaseUserId; // Eğer daha sonra tam hesap oluşturulursa

  GuestProfile({
    required this.id,
    required this.name,
    required this.phone,
    this.isGuest = true,
    required this.createdAt,
    this.lastOrderAt,
    this.orderCount = 0,
    this.email,
    this.firebaseUserId,
  });

  /// Firestore'a kaydetmek için Map'e dönüştür
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'isGuest': isGuest,
      'createdAt': Timestamp.fromDate(createdAt),
      'lastOrderAt': lastOrderAt != null ? Timestamp.fromDate(lastOrderAt!) : null,
      'orderCount': orderCount,
      'email': email,
      'firebaseUserId': firebaseUserId,
    };
  }

  /// Firestore Document'tan oluştur
  factory GuestProfile.fromDocument(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return GuestProfile(
      id: doc.id,
      name: data['name'] ?? '',
      phone: data['phone'] ?? '',
      isGuest: data['isGuest'] ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      lastOrderAt: (data['lastOrderAt'] as Timestamp?)?.toDate(),
      orderCount: data['orderCount'] ?? 0,
      email: data['email'],
      firebaseUserId: data['firebaseUserId'],
    );
  }

  /// Firestore Map'ten oluştur
  factory GuestProfile.fromMap(Map<String, dynamic> data, String id) {
    return GuestProfile(
      id: id,
      name: data['name'] ?? '',
      phone: data['phone'] ?? '',
      isGuest: data['isGuest'] ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      lastOrderAt: (data['lastOrderAt'] as Timestamp?)?.toDate(),
      orderCount: data['orderCount'] ?? 0,
      email: data['email'],
      firebaseUserId: data['firebaseUserId'],
    );
  }

  /// Bir sonraki sipariş için güncellenmiş profil
  GuestProfile withNewOrder() {
    return GuestProfile(
      id: id,
      name: name,
      phone: phone,
      isGuest: isGuest,
      createdAt: createdAt,
      lastOrderAt: DateTime.now(),
      orderCount: orderCount + 1,
      email: email,
      firebaseUserId: firebaseUserId,
    );
  }

  /// Telefon numarasından unique ID oluştur
  /// Format: Sadece rakamlar, ülke kodu dahil
  static String generateIdFromPhone(String phone) {
    // Telefon numarasını normalize et (sadece rakamlar)
    final normalized = phone.replaceAll(RegExp(r'[^0-9]'), '');
    // Son 10 hane yeterli (ülke kodu hariç yerel numara)
    if (normalized.length > 10) {
      return 'guest_${normalized.substring(normalized.length - 10)}';
    }
    return 'guest_$normalized';
  }
}
