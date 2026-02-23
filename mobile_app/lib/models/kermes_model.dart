import 'package:flutter/material.dart';
import '../utils/currency_utils.dart';

// Sponsor enum for kermes events
enum KermesSponsor {
  tuna,        // Tuna Et Mamülleri (Avrupa)
  akdenizToros, // Akdeniz Toros (Türkiye)
  none,        // Sponsor yok
}

class KermesEvent {
  final String id;
  final String city;
  final String country; // Ülke (Almanya, Avusturya, Sırbistan, vb.)
  final String? state; // Eyalet (Nordrhein-Westfalen, Bayern, vb.)
  final String title;
  final String address;
  final String phoneNumber;
  final DateTime startDate;
  final DateTime endDate;
  final double latitude;
  final double longitude;
  final List<KermesMenuItem> menu;
  final List<KermesParkingInfo> parking;
  final List<KermesWeather> weatherForecast;
  final bool hasKidsActivities;    // kids_area
  final bool hasFamilyArea;         // family_area (Aile Bölümü)
  final bool hasOutdoor;            // outdoor (Açık Alan)
  final bool hasIndoorArea;         // indoor (Kapalı Alan)
  final bool hasCreditCardPayment;  // card_payment
  final bool hasVegetarian;         // vegetarian
  final bool hasAccessible;         // accessible (Engelli Erişimi)
  final bool hasHalal;              // halal
  final bool hasWifi;               // wifi
  final bool hasLiveMusic;          // live_music
  final bool hasPrayerRoom;         // prayer_room
  final bool hasFreeEntry;          // free_entry
  final bool hasParking;            // parking
  final bool hasSleepingAccommodation; // Dinlenme/Yatak imkanı
  final bool hasArgelatoIceCream; // Argelato Dondurma
  final String openingTime;
  final String closingTime;
  final KermesSponsor sponsor; // Sponsor
  
  // Pfand/Depozito Sistemi
  final bool hasPfandSystem;  // Kermes geneli toggle
  final double pfandAmount;   // Varsayılan 0.25${CurrencyUtils.getCurrencySymbol()}
  
  // KDV/VAT Sistemi
  final bool showKdv;           // KDV göster toggle
  final double kdvRate;         // Varsayılan %7 (gıda)
  final bool pricesIncludeKdv;  // Brutto mu Netto mu?
  
  // Raw features list from Firebase
  final List<String> features;
  
  // Custom features (max 3)
  final List<String> customFeatures;
  
  // Kurye/Nakliyat Servisi
  final bool hasDelivery;
  final double deliveryFee;
  final double minCartForFreeDelivery;
  final double minOrderAmount; // Minimum sipariş tutarı (kurye için)
  
  // Yetkili Kişi
  final String? contactName; // Admin Portal'dan gelen yetkili adı
  final String? headerImage; // Admin Portal'dan seçilen başlık görseli
  
  // Legacy - keep for backwards compatibility
  @Deprecated('Use hasOutdoor instead')
  bool get hasShoppingStands => hasOutdoor;
  @Deprecated('Use hasFamilyArea instead')
  bool get hasFamilyTents => hasFamilyArea;
  
  // Genel park notu
  final String? generalParkingNote;

  KermesEvent({
    required this.id,
    required this.city,
    this.country = 'Almanya', // Varsayılan: Almanya
    this.state, // Eyalet opsiyonel
    required this.title,
    required this.address,
    required this.phoneNumber,
    required this.startDate,
    required this.endDate,
    required this.latitude,
    required this.longitude,
    required this.menu,
    required this.parking,
    required this.weatherForecast,
    this.hasKidsActivities = false,
    this.hasFamilyArea = false,
    this.hasOutdoor = false,
    this.hasIndoorArea = false,
    this.hasCreditCardPayment = false,
    this.hasVegetarian = false,
    this.hasAccessible = false,
    this.hasHalal = false,
    this.hasWifi = false,
    this.hasLiveMusic = false,
    this.hasPrayerRoom = false,
    this.hasFreeEntry = false,
    this.hasParking = false,
    this.hasSleepingAccommodation = false,
    this.hasArgelatoIceCream = false,
    required this.openingTime,
    required this.closingTime,
    this.sponsor = KermesSponsor.tuna, // Varsayılan: Tuna (Avrupa)
    this.flyers = const [], // Kermes ilanları/afişleri
    this.features = const [],
    this.customFeatures = const [],
    // Kurye servisi
    this.hasDelivery = false,
    this.deliveryFee = 0,
    this.minCartForFreeDelivery = 0,
    this.minOrderAmount = 0,
    this.contactName,
    this.headerImage,
    this.generalParkingNote,
    // Pfand sistemi
    this.hasPfandSystem = false,
    this.pfandAmount = 0.25,
    // KDV sistemi
    this.showKdv = false,
    this.kdvRate = 7.0,
    this.pricesIncludeKdv = true,
  });
  
  // Kermes ilanları/afişleri (asset yolları)
  final List<String> flyers;
}

class KermesMenuItem {
  final String name; // Fallback or TR value
  final dynamic nameData; // Raw localization map
  final String? secondaryName;  // 2. isim (örn: Almanca/Türkçe alternatif)
  final double price;
  final String? description; // Fallback or TR value
  final dynamic descriptionData; // Raw localization map
  final String? detailedDescription;  // Detaylı tarif
  final dynamic detailedDescriptionData; // Raw localization map
  final String? imageUrl;  // Legacy single image (backward compatibility)
  final List<String> imageUrls;  // Multiple images (up to 3)
  final String? category;  // Kategori: 'Yemekler', 'İçecekler', vb.
  final List<String> allergens;  // Alerjenler: ["Gluten", "Süt", "Fındık"]
  final List<String> ingredients;  // İçerikler/Zutaten: ["Un", "Su", "Tuz"]
  final bool hasPfand;  // Pfand/Depozito gerektiriyor mu? (içecekler için)
  final bool isAvailable;  // Stok durumu: true=mevcut, false=tükendi

  KermesMenuItem({
    required this.name,
    this.nameData,
    this.secondaryName,
    required this.price,
    this.description,
    this.descriptionData,
    this.detailedDescription,
    this.detailedDescriptionData,
    this.imageUrl,
    this.imageUrls = const [],
    this.category,
    this.allergens = const [],
    this.ingredients = const [],
    this.hasPfand = false,
    this.isAvailable = true,  // Varsayılan: mevcut
  });
  
  /// Tüm resimleri getir (imageUrls varsa onu, yoksa imageUrl'i)
  List<String> get allImages {
    if (imageUrls.isNotEmpty) return imageUrls;
    if (imageUrl != null && imageUrl!.isNotEmpty) return [imageUrl!];
    return [];
  }
  
  /// Detay gösterilmeli mi? (2. isim, detaylı açıklama, alerjen, içerik veya birden fazla resim varsa)
  bool get hasDetailInfo => 
    secondaryName != null || 
    detailedDescription != null || 
    allergens.isNotEmpty || 
    ingredients.isNotEmpty ||
    imageUrls.length > 1;

  // Helper factory if you ever create these from JSON
  factory KermesMenuItem.fromJson(Map<String, dynamic> json) {
    return KermesMenuItem(
      name: _extractString(json['name']) ?? '',
      nameData: json['name'],
      secondaryName: json['secondaryName'] as String?,
      price: (json['price'] ?? 0.0).toDouble(),
      description: _extractString(json['description'], isNullable: true),
      descriptionData: json['description'],
      detailedDescription: _extractString(json['detailedDescription'], isNullable: true),
      detailedDescriptionData: json['detailedDescription'],
      imageUrl: json['imageUrl'] as String?,
      imageUrls: (json['imageUrls'] as List<dynamic>?)?.cast<String>() ?? [],
      category: json['category'] as String?,
      allergens: (json['allergens'] as List<dynamic>?)?.cast<String>() ?? [],
      ingredients: (json['ingredients'] as List<dynamic>?)?.cast<String>() ?? [],
      hasPfand: json['hasPfand'] ?? false,
      isAvailable: json['isAvailable'] ?? true,
    );
  }

  static String? _extractString(dynamic data, {bool isNullable = false}) {
    if (data == null) return isNullable ? null : '';
    if (data is String) return data;
    if (data is Map) {
      if (data.containsKey('tr') && data['tr'] != null) return data['tr'].toString();
      if (data.values.isNotEmpty) return data.values.first.toString();
    }
    return isNullable ? null : '';
  }
}

class KermesParkingInfo {
  final String? address; // Eski format (backwards compatibility)
  final String street;
  final String city;
  final String postalCode;
  final String country;
  final String description;
  final String? imageUrl; // Eski tek resim (backwards compatibility)
  final List<String> images; // Yeni: 3 resim desteği
  final double? latitude;
  final double? longitude;
  final String? note; // Önemli not

  KermesParkingInfo({
    this.address,
    this.street = '',
    this.city = '',
    this.postalCode = '',
    this.country = 'Deutschland',
    this.description = '',
    this.imageUrl,
    this.images = const [],
    this.latitude,
    this.longitude,
    this.note,
  });
  
  // lat ve lng getter'ları (latitude/longitude için kısa isimler)
  double? get lat => latitude;
  double? get lng => longitude;
  
  // Tüm resimleri getir (eski + yeni format)
  List<String> get allImages {
    final result = <String>[];
    if (imageUrl != null) result.add(imageUrl!);
    result.addAll(images);
    return result.take(3).toList(); // Max 3 resim
  }
  
  // Tam adres string'i oluştur
  String get fullAddress {
    if (street.isNotEmpty || city.isNotEmpty) {
      final parts = <String>[];
      if (street.isNotEmpty) parts.add(street);
      if (city.isNotEmpty) parts.add(city);
      if (postalCode.isNotEmpty || country.isNotEmpty) {
        parts.add([postalCode, country].where((e) => e.isNotEmpty).join(', '));
      }
      return parts.join(', ');
    }
    return address ?? '';
  }
  
  // Factory constructor from JSON
  factory KermesParkingInfo.fromJson(Map<String, dynamic> json) {
    return KermesParkingInfo(
      address: json['address'] as String?,
      street: json['street'] as String? ?? '',
      city: json['city'] as String? ?? '',
      postalCode: json['postalCode'] as String? ?? '',
      country: json['country'] as String? ?? 'Deutschland',
      description: json['description'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      images: (json['images'] as List<dynamic>?)?.cast<String>() ?? [],
      latitude: (json['lat'] ?? json['latitude'])?.toDouble(),
      longitude: (json['lng'] ?? json['longitude'])?.toDouble(),
      note: json['note'] as String?,
    );
  }
  
  // Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      if (address != null) 'address': address,
      'street': street,
      'city': city,
      'postalCode': postalCode,
      'country': country,
      if (description.isNotEmpty) 'description': description,
      if (imageUrl != null) 'imageUrl': imageUrl,
      'images': images,
      if (latitude != null) 'lat': latitude,
      if (longitude != null) 'lng': longitude,
      if (note != null && note!.isNotEmpty) 'note': note,
    };
  }
}

class KermesWeather {
  final DateTime date;
  final IconData icon;
  final String description;
  final double temp;
  final int windSpeed; // km/h
  final int rainProbability; // %

  KermesWeather({
    required this.date,
    required this.icon,
    required this.description,
    required this.temp,
    required this.windSpeed,
    required this.rainProbability,
  });
}

// Saatlik hava durumu
class KermesHourlyWeather {
  final int hour; // 0-23
  final IconData icon;
  final double temp;
  final int rainProbability; // %

  KermesHourlyWeather({
    required this.hour,
    required this.icon,
    required this.temp,
    required this.rainProbability,
  });
}

// Bugünün saatlik hava durumu üretici fonksiyonu (mock veri)
List<KermesHourlyWeather> generateTodayHourlyWeather() {
  final now = DateTime.now();
  final currentHour = now.hour;
  final List<KermesHourlyWeather> hourlyData = [];
  
  // Mevcut saatten sonraki 12 saat
  for (int i = 0; i < 12; i++) {
    final hour = (currentHour + i) % 24;
    final isNight = hour >= 20 || hour < 6;
    
    // Mock hava durumu - saate göre değişen
    IconData icon;
    double temp;
    int rain;
    
    if (isNight) {
      icon = Icons.nightlight_round;
      temp = 5.0 + (i % 3);
      rain = 10 + (i * 2);
    } else if (hour >= 6 && hour < 10) {
      icon = Icons.wb_sunny;
      temp = 6.0 + i;
      rain = 5;
    } else if (hour >= 10 && hour < 14) {
      icon = Icons.wb_sunny;
      temp = 10.0 + (i % 4);
      rain = 0;
    } else if (hour >= 14 && hour < 17) {
      icon = Icons.wb_cloudy;
      temp = 9.0 + (i % 3);
      rain = 15;
    } else {
      icon = Icons.cloud;
      temp = 7.0 + (i % 2);
      rain = 25 + (i * 3);
    }
    
    hourlyData.add(KermesHourlyWeather(
      hour: hour,
      icon: icon,
      temp: temp,
      rainProbability: rain > 100 ? 100 : rain,
    ));
  }
  
  return hourlyData;
}

// --- MOCK DATA ---

final List<KermesEvent> mockKermesEvents = [
  KermesEvent(
    id: '1',
    city: 'Hückelhoven',
    state: 'Nordrhein-Westfalen',
    title: 'Hückelhoven Büyük Kermesi',
    address: 'Rheinstraße 15, 41836 Hückelhoven',
    phoneNumber: '+49 157 12345678',
    startDate: DateTime.now().add(const Duration(days: 2)),
    endDate: DateTime.now().add(const Duration(days: 4)),
    latitude: 51.0536,
    longitude: 6.2208,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    openingTime: '10:00',
    closingTime: '20:00',
    menu: [
      KermesMenuItem(name: 'Adana Kebap', price: 12.0),
      KermesMenuItem(name: 'Lahmacun', price: 5.0),
      KermesMenuItem(name: 'Ayran', price: 2.0),
      KermesMenuItem(name: 'Baklava (Porsiyon)', price: 6.0),
      KermesMenuItem(name: 'Çay', price: 1.5),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Marktplatz, 41836 Hückelhoven',
        description: 'Büyük pazar yeri otoparkı (Ücretsiz)',
        note: 'Cumartesi günleri pazar kurulu! Alternatif park yeri kullanın.',
      ),
      KermesParkingInfo(
        address: 'Parkhofstraße, 41836 Hückelhoven',
        description: 'Arka sokak park yerleri',
        note: 'Akşam 20:00\'den sonra park yasağı var!',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 2)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 22, windSpeed: 12, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 3)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 20, windSpeed: 15, rainProbability: 10),
      KermesWeather(date: DateTime.now().add(const Duration(days: 4)), icon: Icons.cloud, description: 'Bulutlu', temp: 19, windSpeed: 18, rainProbability: 20),
    ],
    flyers: [
      'assets/kermes_flyers/huckelhoven_tuna.jpg',
      'assets/kermes_flyers/koln_mintika.jpg',
    ],
  ),
  KermesEvent(
    id: '2',
    city: 'Mönchengladbach',
    state: 'Nordrhein-Westfalen',
    title: 'Mönchengladbach Bahar Şenliği',
    address: 'Konrad-Adenauer-Ring 10, 41061 Mönchengladbach',
    phoneNumber: '+49 176 98765432',
    startDate: DateTime.now().add(const Duration(days: 10)),
    endDate: DateTime.now().add(const Duration(days: 12)),
    latitude: 51.1985,
    longitude: 6.4382,
    hasKidsActivities: true,
    hasFamilyArea: false,
    hasOutdoor: true,
    hasIndoorArea: false,
    hasCreditCardPayment: true,
    openingTime: '11:00',
    closingTime: '22:00',
    menu: [
      KermesMenuItem(name: 'Döner Kebap', price: 8.0),
      KermesMenuItem(name: 'İskender', price: 15.0),
      KermesMenuItem(name: 'Künefe', price: 7.0),
      KermesMenuItem(name: 'Türk Kahvesi', price: 3.0),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Parkhaus Minto, 41061 MG',
        description: 'AVM Otoparkı (Ücretli)',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 10)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 24, windSpeed: 10, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 11)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 25, windSpeed: 8, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 12)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 26, windSpeed: 12, rainProbability: 5),
    ],
  ),
  KermesEvent(
    id: '3',
    city: 'Stolberg',
    state: 'Nordrhein-Westfalen',
    title: 'Stolberg Hayır Çarşısı',
    address: 'Eisenbahnstraße 5, 52222 Stolberg',
    phoneNumber: '+49 163 5554433',
    startDate: DateTime.now().add(const Duration(days: 20)),
    endDate: DateTime.now().add(const Duration(days: 22)),
    latitude: 50.7667,
    longitude: 6.2333,
    hasKidsActivities: false,
    hasFamilyArea: true,
    hasOutdoor: false,
    hasIndoorArea: true,
    hasCreditCardPayment: false,
    openingTime: '09:00',
    closingTime: '18:00',
    menu: [
      KermesMenuItem(name: 'Gözleme', price: 4.0),
      KermesMenuItem(name: 'Mantı', price: 10.0),
      KermesMenuItem(name: 'Sarma', price: 5.0),
      KermesMenuItem(name: 'Limonata', price: 2.5),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Bahnhofstraße, 52222 Stolberg',
        description: 'İstasyon yanı park alanı',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 20)), icon: Icons.cloud, description: 'Bulutlu', temp: 18, windSpeed: 20, rainProbability: 30),
      KermesWeather(date: DateTime.now().add(const Duration(days: 21)), icon: Icons.grain, description: 'Yağmurlu', temp: 16, windSpeed: 25, rainProbability: 60),
      KermesWeather(date: DateTime.now().add(const Duration(days: 22)), icon: Icons.grain, description: 'Yağmurlu', temp: 15, windSpeed: 22, rainProbability: 45),
    ],
  ),
  // Sıla Yolu Kermesleri - Avusturya
  KermesEvent(
    id: '4',
    city: 'Viyana',
    country: 'Avusturya',
    title: 'Viyana Türk Kermesi',
    address: 'Laxenburger Str. 2, 1100 Wien',
    phoneNumber: '+43 660 1234567',
    startDate: DateTime.now().add(const Duration(days: 5)),
    endDate: DateTime.now().add(const Duration(days: 7)),
    latitude: 48.1814,
    longitude: 16.3339,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: true,
    openingTime: '08:00',
    closingTime: '23:00',
    menu: [
      KermesMenuItem(name: 'Lahmacun', price: 4.0),
      KermesMenuItem(name: 'Döner', price: 7.0),
      KermesMenuItem(name: 'Çorba', price: 3.0),
      KermesMenuItem(name: 'Çay', price: 1.0),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Cami önü park alanı',
        description: 'Geniş ücretsiz otopark',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 5)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 25, windSpeed: 10, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 6)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 26, windSpeed: 8, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 7)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 24, windSpeed: 12, rainProbability: 10),
    ],
  ),
  // Sıla Yolu Kermesleri - Sırbistan
  KermesEvent(
    id: '5',
    city: 'Belgrad',
    country: 'Sırbistan',
    title: 'Belgrad Sıla Molası',
    address: 'Autoput za Niš, Beograd',
    phoneNumber: '+381 60 1234567',
    startDate: DateTime.now().add(const Duration(days: 8)),
    endDate: DateTime.now().add(const Duration(days: 10)),
    latitude: 44.7866,
    longitude: 20.4489,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: false,
    hasIndoorArea: true,
    hasCreditCardPayment: false,
    hasSleepingAccommodation: true,
    openingTime: '06:00',
    closingTime: '24:00',
    menu: [
      KermesMenuItem(name: 'Köfte', price: 5.0),
      KermesMenuItem(name: 'Pide', price: 6.0),
      KermesMenuItem(name: 'Mercimek Çorbası', price: 2.5),
      KermesMenuItem(name: 'Ayran', price: 1.5),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Otoyol kenarı dinlenme alanı',
        description: 'TIR ve otomobil park alanı (24 saat)',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 8)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 28, windSpeed: 8, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 9)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 30, windSpeed: 6, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 10)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 29, windSpeed: 10, rainProbability: 5),
    ],
  ),
  // Macaristan Sıla Molası
  KermesEvent(
    id: '6',
    city: 'Budapeşte',
    country: 'Macaristan',
    title: 'Budapeşte Türk Molası',
    address: 'M1 Autópálya, Budapest',
    phoneNumber: '+36 30 1234567',
    startDate: DateTime.now().add(const Duration(days: 6)),
    endDate: DateTime.now().add(const Duration(days: 8)),
    latitude: 47.4979,
    longitude: 19.0402,
    hasKidsActivities: false,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: true,
    openingTime: '07:00',
    closingTime: '22:00',
    menu: [
      KermesMenuItem(name: 'İskender', price: 12.0),
      KermesMenuItem(name: 'Adana', price: 10.0),
      KermesMenuItem(name: 'Türk Kahvesi', price: 2.0),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Otoyol dinlenme tesisi',
        description: 'Güvenlikli park alanı',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 6)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 27, windSpeed: 12, rainProbability: 5),
      KermesWeather(date: DateTime.now().add(const Duration(days: 7)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 25, windSpeed: 15, rainProbability: 20),
      KermesWeather(date: DateTime.now().add(const Duration(days: 8)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 26, windSpeed: 10, rainProbability: 0),
    ],
  ),
  
  // TÜRKİYE KERMESLERİ
  
  // İstanbul - 1
  KermesEvent(
    id: '7',
    city: 'İstanbul',
    country: 'Türkiye',
    title: 'Sultanahmet Hayır Kermesi',
    address: 'Sultanahmet Meydanı, Fatih, İstanbul',
    phoneNumber: '+90 212 518 1234',
    startDate: DateTime.now().add(const Duration(days: 3)),
    endDate: DateTime.now().add(const Duration(days: 5)),
    latitude: 41.0054,
    longitude: 28.9768,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: false,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: false,
    openingTime: '10:00',
    closingTime: '22:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Lahmacun', price: 30.0),
      KermesMenuItem(name: 'Döner', price: 80.0),
      KermesMenuItem(name: 'Ayran', price: 15.0),
      KermesMenuItem(name: 'Baklava', price: 50.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Sultanahmet Park Alanı', description: 'Ücretli otopark', note: 'Cumartesi çok kalabalık olabilir'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 3)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 28, windSpeed: 8, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 4)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 29, windSpeed: 10, rainProbability: 5),
      KermesWeather(date: DateTime.now().add(const Duration(days: 5)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 27, windSpeed: 12, rainProbability: 15),
    ],
  ),
  
  // İstanbul - 2
  KermesEvent(
    id: '8',
    city: 'İstanbul',
    country: 'Türkiye',
    title: 'Kadıköy Cami Kermesi',
    address: 'Moda Caddesi, Kadıköy, İstanbul',
    phoneNumber: '+90 216 345 6789',
    startDate: DateTime.now().add(const Duration(days: 10)),
    endDate: DateTime.now().add(const Duration(days: 12)),
    latitude: 40.9915,
    longitude: 29.0321,
    hasKidsActivities: true,
    hasFamilyArea: false,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: false,
    openingTime: '09:00',
    closingTime: '21:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Pide', price: 60.0),
      KermesMenuItem(name: 'Kebap', price: 120.0),
      KermesMenuItem(name: 'Çay', price: 10.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Moda Sahili Otopark', description: 'Açık otopark'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 10)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 26, windSpeed: 15, rainProbability: 0),
    ],
  ),
  
  // İstanbul - 3
  KermesEvent(
    id: '9',
    city: 'İstanbul',
    country: 'Türkiye',
    title: 'Üsküdar Çarşamba Kermesi',
    address: 'Üsküdar Meydanı, Üsküdar, İstanbul',
    phoneNumber: '+90 216 555 1234',
    startDate: DateTime.now().add(const Duration(days: 15)),
    endDate: DateTime.now().add(const Duration(days: 17)),
    latitude: 41.0264,
    longitude: 29.0155,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: false,
    hasCreditCardPayment: false,
    hasSleepingAccommodation: false,
    openingTime: '08:00',
    closingTime: '20:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Mantı', price: 55.0),
      KermesMenuItem(name: 'Gözleme', price: 35.0),
      KermesMenuItem(name: 'Limonata', price: 20.0),
    ],
    parking: [
      KermesParkingInfo(address: 'İskele Otopark', description: 'Vapur iskelesi yanında'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 15)), icon: Icons.cloud, description: 'Bulutlu', temp: 24, windSpeed: 10, rainProbability: 20),
    ],
  ),
  
  // Balıkesir - 1
  KermesEvent(
    id: '10',
    city: 'Balıkesir',
    country: 'Türkiye',
    title: 'Balıkesir Merkez Yaz Kermesi',
    address: 'Atatürk Parkı, Merkez, Balıkesir',
    phoneNumber: '+90 266 241 1234',
    startDate: DateTime.now().add(const Duration(days: 7)),
    endDate: DateTime.now().add(const Duration(days: 9)),
    latitude: 39.6484,
    longitude: 27.8826,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: false,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: false,
    openingTime: '09:00',
    closingTime: '22:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Höşmerim', price: 40.0),
      KermesMenuItem(name: 'Kuzu Tandır', price: 150.0),
      KermesMenuItem(name: 'Şıra', price: 15.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Park yanı otopark', description: 'Ücretsiz park alanı'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 7)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 30, windSpeed: 8, rainProbability: 0),
    ],
  ),
  
  // Balıkesir - 2
  KermesEvent(
    id: '11',
    city: 'Ayvalık',
    country: 'Türkiye',
    title: 'Ayvalık Sahil Kermesi',
    address: 'Sahil Yolu, Ayvalık, Balıkesir',
    phoneNumber: '+90 266 312 5678',
    startDate: DateTime.now().add(const Duration(days: 12)),
    endDate: DateTime.now().add(const Duration(days: 14)),
    latitude: 39.3186,
    longitude: 26.6934,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: false,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: false,
    openingTime: '10:00',
    closingTime: '23:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Zeytinyağlı Sarma', price: 45.0),
      KermesMenuItem(name: 'Balık Ekmek', price: 80.0),
      KermesMenuItem(name: 'Ayran', price: 12.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Sahil Otopark', description: 'Deniz manzaralı park'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 12)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 32, windSpeed: 5, rainProbability: 0),
    ],
  ),
  
  // Balıkesir - 3
  KermesEvent(
    id: '12',
    city: 'Edremit',
    country: 'Türkiye',
    title: 'Edremit Zeytinlik Kermesi',
    address: 'Belediye Meydanı, Edremit, Balıkesir',
    phoneNumber: '+90 266 373 9999',
    startDate: DateTime.now().add(const Duration(days: 20)),
    endDate: DateTime.now().add(const Duration(days: 22)),
    latitude: 39.5945,
    longitude: 27.0243,
    hasKidsActivities: false,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: false,
    hasSleepingAccommodation: false,
    openingTime: '09:00',
    closingTime: '21:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Zeytinyağlı Yaprak Sarma', price: 50.0),
      KermesMenuItem(name: 'Patlıcan Kebabı', price: 100.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Belediye Otopark', description: 'Ücretsiz otopark'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 20)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 31, windSpeed: 7, rainProbability: 0),
    ],
  ),
  
  // Afyonkarahisar - 1
  KermesEvent(
    id: '13',
    city: 'Afyonkarahisar',
    country: 'Türkiye',
    title: 'Afyon Kaymak Kermesi',
    address: 'Zafer Meydanı, Merkez, Afyonkarahisar',
    phoneNumber: '+90 272 213 4567',
    startDate: DateTime.now().add(const Duration(days: 5)),
    endDate: DateTime.now().add(const Duration(days: 7)),
    latitude: 38.7507,
    longitude: 30.5567,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: false,
    openingTime: '08:00',
    closingTime: '22:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Kaymaklı Ekmek Kadayıfı', price: 60.0),
      KermesMenuItem(name: 'Sucuk Tava', price: 70.0),
      KermesMenuItem(name: 'Afyon Lokumu', price: 40.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Meydan Altı Otopark', description: 'Kapalı otopark', note: 'İlk 2 saat ücretsiz'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 5)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 25, windSpeed: 10, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 6)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 26, windSpeed: 8, rainProbability: 5),
      KermesWeather(date: DateTime.now().add(const Duration(days: 7)), icon: Icons.cloud, description: 'Bulutlu', temp: 23, windSpeed: 12, rainProbability: 25),
    ],
  ),
  
  // Afyonkarahisar - 2
  KermesEvent(
    id: '14',
    city: 'Sandıklı',
    country: 'Türkiye',
    title: 'Sandıklı Termal Kermesi',
    address: 'Termal Bölgesi, Sandıklı, Afyonkarahisar',
    phoneNumber: '+90 272 512 8888',
    startDate: DateTime.now().add(const Duration(days: 18)),
    endDate: DateTime.now().add(const Duration(days: 20)),
    latitude: 38.4612,
    longitude: 30.2565,
    hasKidsActivities: false,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: true,
    openingTime: '09:00',
    closingTime: '21:00',
    sponsor: KermesSponsor.akdenizToros,
    menu: [
      KermesMenuItem(name: 'Köfte', price: 75.0),
      KermesMenuItem(name: 'Pide', price: 55.0),
      KermesMenuItem(name: 'Salep', price: 25.0),
    ],
    parking: [
      KermesParkingInfo(address: 'Termal Otopark', description: 'Geniş otopark alanı', note: 'Termal misafirlerine ücretsiz'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 18)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 22, windSpeed: 15, rainProbability: 10),
    ],
  ),
  
  // München - 8 Günlük Test Kermesi
  KermesEvent(
    id: '15',
    city: 'München',
    state: 'Bayern',
    country: 'Almanya',
    title: 'München Büyük Türk Festivali',
    address: 'Marienplatz 1, 80331 München',
    phoneNumber: '+49 89 12345678',
    startDate: DateTime.now().add(const Duration(days: 1)),
    endDate: DateTime.now().add(const Duration(days: 8)),
    latitude: 48.1371,
    longitude: 11.5754,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasSleepingAccommodation: false,
    openingTime: '10:00',
    closingTime: '22:00',
    sponsor: KermesSponsor.tuna,
    menu: [
      KermesMenuItem(name: 'Döner Kebap', price: 8.0),
      KermesMenuItem(name: 'İskender', price: 14.0),
      KermesMenuItem(name: 'Beyti Sarma', price: 16.0),
      KermesMenuItem(name: 'Künefe', price: 8.0),
      KermesMenuItem(name: 'Türk Kahvesi', price: 3.0),
    ],
    parking: [
      KermesParkingInfo(address: 'P1 Parkhaus', description: 'Marienplatz altı otoparkı'),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime.now().add(const Duration(days: 1)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 18, windSpeed: 8, rainProbability: 5),
      KermesWeather(date: DateTime.now().add(const Duration(days: 2)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 20, windSpeed: 10, rainProbability: 0),
      KermesWeather(date: DateTime.now().add(const Duration(days: 3)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 19, windSpeed: 12, rainProbability: 15),
      KermesWeather(date: DateTime.now().add(const Duration(days: 4)), icon: Icons.cloud, description: 'Bulutlu', temp: 17, windSpeed: 15, rainProbability: 30),
      KermesWeather(date: DateTime.now().add(const Duration(days: 5)), icon: Icons.grain, description: 'Yağmurlu', temp: 15, windSpeed: 20, rainProbability: 70),
      KermesWeather(date: DateTime.now().add(const Duration(days: 6)), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 16, windSpeed: 14, rainProbability: 25),
      KermesWeather(date: DateTime.now().add(const Duration(days: 7)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 19, windSpeed: 10, rainProbability: 5),
      KermesWeather(date: DateTime.now().add(const Duration(days: 8)), icon: Icons.wb_sunny, description: 'Güneşli', temp: 21, windSpeed: 8, rainProbability: 0),
    ],
  ),
  
  // Hückelhoven Fourdays - Bugünden 09.12.2025'e kadar
  KermesEvent(
    id: '16',
    city: 'Hückelhoven',
    state: 'Nordrhein-Westfalen',
    country: 'Almanya',
    title: 'Fourdays',
    address: 'Ludovicistr. 3, 41836 Hückelhoven',
    phoneNumber: '+49 177 8850670',
    startDate: DateTime(2025, 12, 6),
    endDate: DateTime(2025, 12, 9),
    latitude: 51.0536,
    longitude: 6.2208,
    hasKidsActivities: true,
    hasFamilyArea: true,
    hasOutdoor: true,
    hasIndoorArea: true,
    hasCreditCardPayment: true,
    hasArgelatoIceCream: true,
    openingTime: '12:00',
    closingTime: '21:00',
    sponsor: KermesSponsor.tuna,
    flyers: [
      'assets/kermes_flyers/huckelhoven_tuna.jpg',
    ],
    menu: [
      KermesMenuItem(name: 'Adana Kebap', price: 12.0),
      KermesMenuItem(name: 'Lahmacun', price: 5.0),
      KermesMenuItem(name: 'Döner Dürüm', price: 8.0),
      KermesMenuItem(name: 'Ayran', price: 2.0),
      KermesMenuItem(name: 'Baklava', price: 6.0),
      KermesMenuItem(name: 'Çay', price: 1.5),
    ],
    parking: [
      KermesParkingInfo(
        address: 'Rathaus Hückelhoven',
        description: 'Belediye binası önü otopark (Ücretsiz)',
        latitude: 51.0541,
        longitude: 6.2195,
      ),
      KermesParkingInfo(
        address: 'Netto Markt Parkplatz',
        description: 'Market otoparkı',
        latitude: 51.0528,
        longitude: 6.2220,
        note: 'Akşam 20:00\'den sonra kapalı!',
      ),
    ],
    weatherForecast: [
      KermesWeather(date: DateTime(2025, 12, 6), icon: Icons.wb_sunny, description: 'Güneşli', temp: 8, windSpeed: 12, rainProbability: 0),
      KermesWeather(date: DateTime(2025, 12, 7), icon: Icons.wb_cloudy, description: 'Parçalı Bulutlu', temp: 7, windSpeed: 15, rainProbability: 20),
      KermesWeather(date: DateTime(2025, 12, 8), icon: Icons.cloud, description: 'Bulutlu', temp: 6, windSpeed: 10, rainProbability: 30),
      KermesWeather(date: DateTime(2025, 12, 9), icon: Icons.wb_sunny, description: 'Güneşli', temp: 9, windSpeed: 8, rainProbability: 5),
    ],
  ),
];
