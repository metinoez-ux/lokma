import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lokma_app/models/guest_profile_model.dart';

/// Guest Profil Servisi
/// Telefon numarasıyla tanımlanan kullanıcı profilleri için CRUD işlemleri
class GuestProfileService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  /// Guest profilleri sakladığımız collection
  CollectionReference get _profilesCollection => _firestore.collection('guest_profiles');

  /// Telefon numarasıyla profil bul veya oluştur
  /// Bu metot sipariş tamamlarken çağrılacak
  Future<GuestProfile> findOrCreateProfile({
    required String name,
    required String phone,
  }) async {
    try {
      // Telefon numarasından ID oluştur
      final profileId = GuestProfile.generateIdFromPhone(phone);
      
      // Mevcut profili kontrol et
      final doc = await _profilesCollection.doc(profileId).get();
      
      if (doc.exists) {
        // Profil var, güncelle ve döndür
        final existingProfile = GuestProfile.fromDocument(doc);
        
        // İsim güncellenmişse güncelle
        if (existingProfile.name != name) {
          await _profilesCollection.doc(profileId).update({
            'name': name,
            'lastOrderAt': Timestamp.fromDate(DateTime.now()),
          });
        }
        
        return existingProfile;
      } else {
        // Yeni profil oluştur
        final newProfile = GuestProfile(
          id: profileId,
          name: name,
          phone: phone,
          isGuest: true,
          createdAt: DateTime.now(),
          orderCount: 0,
        );
        
        await _profilesCollection.doc(profileId).set(newProfile.toMap());
        return newProfile;
      }
    } catch (e) {
      throw Exception('Profil oluşturulamadı: $e');
    }
  }

  /// Profili ID ile getir
  Future<GuestProfile?> getProfile(String profileId) async {
    try {
      final doc = await _profilesCollection.doc(profileId).get();
      if (doc.exists) {
        return GuestProfile.fromDocument(doc);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Telefon numarasıyla profil getir
  Future<GuestProfile?> getProfileByPhone(String phone) async {
    final profileId = GuestProfile.generateIdFromPhone(phone);
    return getProfile(profileId);
  }

  /// Sipariş sayısını artır
  Future<void> incrementOrderCount(String profileId) async {
    try {
      await _profilesCollection.doc(profileId).update({
        'orderCount': FieldValue.increment(1),
        'lastOrderAt': Timestamp.fromDate(DateTime.now()),
      });
    } catch (e) {
      // Hata durumunda sessizce devam et
    }
  }

  /// Profili güncelle
  Future<void> updateProfile(GuestProfile profile) async {
    try {
      await _profilesCollection.doc(profile.id).update(profile.toMap());
    } catch (e) {
      throw Exception('Profil güncellenemedi: $e');
    }
  }

  /// Guest profili tam hesaba dönüştür (firebaseUserId ekle)
  Future<void> linkToFirebaseUser(String profileId, String firebaseUserId) async {
    try {
      await _profilesCollection.doc(profileId).update({
        'firebaseUserId': firebaseUserId,
        'isGuest': false,
      });
    } catch (e) {
      throw Exception('Profil bağlanamadı: $e');
    }
  }
}

/// Guest profil servisi provider'ı
final guestProfileServiceProvider = Provider<GuestProfileService>((ref) {
  return GuestProfileService();
});

/// Mevcut guest profil state'i
/// Kullanıcı sipariş verdiğinde bu set edilir
class GuestProfileNotifier extends Notifier<GuestProfile?> {
  @override
  GuestProfile? build() {
    return null;
  }

  void setProfile(GuestProfile profile) {
    state = profile;
  }

  void clearProfile() {
    state = null;
  }
}

final currentGuestProfileProvider = NotifierProvider<GuestProfileNotifier, GuestProfile?>(() {
  return GuestProfileNotifier();
});
