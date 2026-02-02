import 'package:cloud_firestore/cloud_firestore.dart';

class AppUser {
  final String uid;
  final String customId;
  final String email;
  final String? displayName;
  final DateTime createdAt;
  final DateTime? birthDate;
  final String? country;
  final String? state;
  final String? city;
  final String? zipCode;
  final String? address;
  final String? hometown; // Türkiye'deki memleket ili
  final double? homeLatitude;  // Ev adresi koordinatları (seferi hesaplama için)
  final double? homeLongitude;
  final String? phoneNumber; // Telefon numarası
  final bool phoneVerified; // Telefon doğrulandı mı?
  
  // Notification Preferences
  final bool notifyOrderEmail; // Sipariş bildirimleri email
  final bool notifyOrderPush;  // Sipariş bildirimleri push
  final String? fcmToken;      // Firebase Cloud Messaging token

  AppUser({
    required this.uid,
    required this.customId,
    required this.email,
    this.displayName,
    required this.createdAt,
    this.birthDate,
    this.country,
    this.state,
    this.city,
    this.zipCode,
    this.address,
    this.hometown,
    this.homeLatitude,
    this.homeLongitude,
    this.phoneNumber,
    this.phoneVerified = false,
    this.notifyOrderEmail = true, // Default: açık
    this.notifyOrderPush = true,  // Default: açık
    this.fcmToken,
  });

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'customId': customId,
      'email': email,
      'displayName': displayName,
      'createdAt': Timestamp.fromDate(createdAt),
      'birthDate': birthDate != null ? Timestamp.fromDate(birthDate!) : null,
      'country': country,
      'state': state,
      'city': city,
      'zipCode': zipCode,
      'address': address,
      'hometown': hometown,
      'homeLatitude': homeLatitude,
      'homeLongitude': homeLongitude,
      'phoneNumber': phoneNumber,
      'phoneVerified': phoneVerified,
      'notifyOrderEmail': notifyOrderEmail,
      'notifyOrderPush': notifyOrderPush,
      'fcmToken': fcmToken,
    };
  }

  factory AppUser.fromMap(Map<String, dynamic> map) {
    return AppUser(
      uid: map['uid'] ?? '',
      customId: map['customId'] ?? '',
      email: map['email'] ?? '',
      displayName: map['displayName'],
      createdAt: map['createdAt'] != null 
          ? (map['createdAt'] as Timestamp).toDate() 
          : DateTime.now(),
      birthDate: map['birthDate'] != null 
          ? (map['birthDate'] as Timestamp).toDate() 
          : null,
      country: map['country'],
      state: map['state'],
      city: map['city'],
      zipCode: map['zipCode'],
      address: map['address'],
      hometown: map['hometown'],
      homeLatitude: (map['homeLatitude'] as num?)?.toDouble(),
      homeLongitude: (map['homeLongitude'] as num?)?.toDouble(),
      phoneNumber: map['phoneNumber'],
      phoneVerified: map['phoneVerified'] ?? false,
      notifyOrderEmail: map['notifyOrderEmail'] ?? true,
      notifyOrderPush: map['notifyOrderPush'] ?? true,
      fcmToken: map['fcmToken'],
    );
  }
  
  /// Create a copy with updated fields
  AppUser copyWith({
    String? hometown,
    bool? notifyOrderEmail,
    bool? notifyOrderPush,
    String? fcmToken,
  }) {
    return AppUser(
      uid: uid,
      customId: customId,
      email: email,
      displayName: displayName,
      createdAt: createdAt,
      birthDate: birthDate,
      country: country,
      state: state,
      city: city,
      zipCode: zipCode,
      address: address,
      hometown: hometown ?? this.hometown,
      homeLatitude: homeLatitude,
      homeLongitude: homeLongitude,
      phoneNumber: phoneNumber,
      phoneVerified: phoneVerified,
      notifyOrderEmail: notifyOrderEmail ?? this.notifyOrderEmail,
      notifyOrderPush: notifyOrderPush ?? this.notifyOrderPush,
      fcmToken: fcmToken ?? this.fcmToken,
    );
  }
  
  /// Deprecated: Use copyWith instead
  AppUser copyWithHometown(String? newHometown) {
    return copyWith(hometown: newHometown);
  }
}
