import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/kermes_model.dart';

/// Kermes favorilerini yöneten servis
/// Favori kermesleri SharedPreferences'ta saklar ve takvime entegre eder
class KermesFavoriteService {
  static const String _favoritesKey = 'kermes_favorites';
  static const String _favoriteDetailsKey = 'kermes_favorite_details';

  static KermesFavoriteService? _instance;
  static KermesFavoriteService get instance {
    _instance ??= KermesFavoriteService._();
    return _instance!;
  }

  KermesFavoriteService._();

  SharedPreferences? _prefs;

  Future<void> _ensureInitialized() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  /// Favori ID'lerini getir
  Future<List<String>> getFavoriteIds() async {
    await _ensureInitialized();
    return _prefs!.getStringList(_favoritesKey) ?? [];
  }

  /// Kermes favori mi?
  Future<bool> isFavorite(String kermesId) async {
    final favorites = await getFavoriteIds();
    return favorites.contains(kermesId);
  }

  /// Senkron kontrol (widget'lar için)
  bool isFavoriteSync(String kermesId) {
    if (_prefs == null) return false;
    final favorites = _prefs!.getStringList(_favoritesKey) ?? [];
    return favorites.contains(kermesId);
  }

  /// Favorilere ekle
  Future<void> addFavorite(KermesEvent kermes) async {
    await _ensureInitialized();
    
    // ID'yi listeye ekle
    final favorites = await getFavoriteIds();
    if (!favorites.contains(kermes.id)) {
      favorites.add(kermes.id);
      await _prefs!.setStringList(_favoritesKey, favorites);
    }

    // Detayları kaydet (takvim için)
    await _saveFavoriteDetails(kermes);
  }

  /// Favorilerden çıkar
  Future<void> removeFavorite(String kermesId) async {
    await _ensureInitialized();
    
    // ID'yi listeden çıkar
    final favorites = await getFavoriteIds();
    favorites.remove(kermesId);
    await _prefs!.setStringList(_favoritesKey, favorites);

    // Detayları sil
    await _removeFavoriteDetails(kermesId);
  }

  /// Toggle favorite
  Future<bool> toggleFavorite(KermesEvent kermes) async {
    final isFav = await isFavorite(kermes.id);
    if (isFav) {
      await removeFavorite(kermes.id);
      return false;
    } else {
      await addFavorite(kermes);
      return true;
    }
  }

  /// Favori detaylarını kaydet
  Future<void> _saveFavoriteDetails(KermesEvent kermes) async {
    final detailsMap = _prefs!.getString(_favoriteDetailsKey);
    final Map<String, dynamic> details = detailsMap != null ? json.decode(detailsMap) : {};
    
    details[kermes.id] = {
      'id': kermes.id,
      'city': kermes.city,
      'title': kermes.title,
      'address': kermes.address,
      'startDate': kermes.startDate.toIso8601String(),
      'endDate': kermes.endDate.toIso8601String(),
      'openingTime': kermes.openingTime,
      'closingTime': kermes.closingTime,
    };
    
    await _prefs!.setString(_favoriteDetailsKey, json.encode(details));
  }

  /// Favori detaylarını sil
  Future<void> _removeFavoriteDetails(String kermesId) async {
    final detailsMap = _prefs!.getString(_favoriteDetailsKey);
    if (detailsMap == null) return;
    
    final Map<String, dynamic> details = json.decode(detailsMap);
    details.remove(kermesId);
    await _prefs!.setString(_favoriteDetailsKey, json.encode(details));
  }

  /// Takvim için favori kermes etkinliklerini getir
  Future<List<KermesCalendarEvent>> getKermesEventsForDay(DateTime date) async {
    await _ensureInitialized();
    
    // Önce favori ID'lerini al
    final favoriteIds = await getFavoriteIds();
    if (favoriteIds.isEmpty) return [];
    
    final detailsMap = _prefs!.getString(_favoriteDetailsKey);
    if (detailsMap == null) return [];
    
    final Map<String, dynamic> details = json.decode(detailsMap);
    final List<KermesCalendarEvent> events = [];
    final checkDate = DateTime(date.year, date.month, date.day);
    
    for (var entry in details.entries) {
      // Sadece favori listesinde olan kermes'leri göster
      if (!favoriteIds.contains(entry.key)) continue;
      
      final data = entry.value as Map<String, dynamic>;
      final startDate = DateTime.parse(data['startDate']);
      final endDate = DateTime.parse(data['endDate']);
      
      final start = DateTime(startDate.year, startDate.month, startDate.day);
      final end = DateTime(endDate.year, endDate.month, endDate.day);
      
      // Tarih kermes aralığında mı?
      if ((checkDate.isAtSameMomentAs(start) || checkDate.isAfter(start)) &&
          (checkDate.isAtSameMomentAs(end) || checkDate.isBefore(end))) {
        events.add(KermesCalendarEvent(
          id: data['id'],
          city: data['city'],
          title: data['title'],
          address: data['address'],
          time: '${data['openingTime']} - ${data['closingTime']}',
          startDate: startDate,
          endDate: endDate,
        ));
      }
    }
    
    return events;
  }

  /// Servisi yeniden yükle (state değişikliklerinde)
  Future<void> reload() async {
    _prefs = await SharedPreferences.getInstance();
  }
}

/// Takvimde gösterilecek kermes etkinliği
class KermesCalendarEvent {
  final String id;
  final String city;
  final String title;
  final String address;
  final String time;
  final DateTime startDate;
  final DateTime endDate;

  KermesCalendarEvent({
    required this.id,
    required this.city,
    required this.title,
    required this.address,
    required this.time,
    required this.startDate,
    required this.endDate,
  });
}
