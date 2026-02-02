import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:lokma_app/config/app_secrets.dart';

class GooglePlacesService {
  static const String _baseUrl = 'https://maps.googleapis.com/maps/api/place';
  
  /// Search for a place by name and location
  /// Returns placeId which can be used to get details
  static Future<String?> findPlaceId(String businessName, String city, {String? fullAddress}) async {
    try {
      // Prioritize searching with the full address if available for better accuracy
      final String searchQuery;
      if (fullAddress != null && fullAddress.isNotEmpty) {
        searchQuery = '$businessName, $fullAddress';
      } else {
        searchQuery = '$businessName $city';
      }

      final query = Uri.encodeComponent(searchQuery);
      final url = '$_baseUrl/findplacefromtext/json?input=$query&inputtype=textquery&fields=place_id&key=${AppSecrets.googlePlacesApiKey}';
      
      final response = await http.get(Uri.parse(url));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['candidates'] != null && data['candidates'].isNotEmpty) {
          return data['candidates'][0]['place_id'] as String?;
        }
      }
      return null;
    } catch (e) {
      print('Error finding place ID: $e');
      return null;
    }
  }
  
  /// Get place details including reviews
  static Future<Map<String, dynamic>?> getPlaceDetails(String placeId) async {
    try {
      final url = '$_baseUrl/details/json?place_id=$placeId&fields=name,rating,user_ratings_total,reviews,formatted_address,formatted_phone_number,opening_hours,website,geometry,photos&reviews_no_translations=true&key=${AppSecrets.googlePlacesApiKey}';
      
      final response = await http.get(Uri.parse(url));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['status'] == 'OK' && data['result'] != null) {
          return data['result'] as Map<String, dynamic>;
        }
      }
      return null;
    } catch (e) {
      print('Error getting place details: $e');
      return null;
    }
  }
  
  /// Convenience method: Search and get details in one call
  static Future<Map<String, dynamic>?> getBusinessDetails(String businessName, String city, {String? fullAddress}) async {
    final placeId = await findPlaceId(businessName, city, fullAddress: fullAddress);
    if (placeId == null) return null;
    
    return await getPlaceDetails(placeId);
  }
}
