import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/google_places_service.dart';
import 'package:lokma_app/config/app_secrets.dart';

class ButcherDataSeeder {
  static final List<Map<String, String>> _targetButchers = [
    {'name': 'TUNA Metzgerei', 'city': 'Hückelhoven'},
    {'name': 'TUNA Metzgerei', 'city': 'Duisburg Hochfeld'},
    {'name': 'TUNA Metzgerei', 'city': 'Duisburg Bruckhausen'},
    {'name': 'TUNA Metzgerei', 'city': 'München'},
    {'name': 'TUNA Metzgerei', 'city': 'Herne'},
    {'name': 'TUNA Metzgerei', 'city': 'Dortmund'},
    {'name': 'TUNA Metzgerei', 'city': 'Hamm'},
    {'name': 'Tuna Metzgerei', 'city': 'Neu-Ulm'},
    {'name': 'Tuna Hamburg', 'city': 'Hamburg'},
  ];

  static Future<void> seedButchers(BuildContext context) async {
    int successCount = 0;
    int failCount = 0;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Starting Data Migration... Please wait.')),
    );

    for (final target in _targetButchers) {
      final name = target['name']!;
      final city = target['city']!;
      
      try {
        // 1. Fetch details from Google Places
        final details = await GooglePlacesService.getBusinessDetails(name, city);
        
        if (details != null) {
          final lat = details['geometry']?['location']?['lat'];
          final lng = details['geometry']?['location']?['lng'];
          
          if (lat != null && lng != null) {
            // Photo Logic
            String? imageUrl;
            if (details['photos'] != null && (details['photos'] as List).isNotEmpty) {
               final photoRef = details['photos'][0]['photo_reference'];
               if (photoRef != null) {
                 imageUrl = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=$photoRef&key=${AppSecrets.googlePlacesApiKey}';
               }
            }

            // 2. Prepare Data (Admin Panel Compatible)
            // Admin Panel requires 'customerId' for sorting.
            // uniqueId generation: MK-G-{cityHash}
            final uniqueCityCode = city.hashCode.abs().toString().substring(0, 4);
            
            final data = {
              'name': name, 
              'companyName': details['name'] ?? '$name $city',
              'customerId': 'MK-G-$uniqueCityCode', // Google Auto-Imports
              'businessCategories': ['kasap'],
              'salesType': 'retail',
              'brand': 'tuna', // Lowercase matches admin panel 'tuna' key
              'brandLabelActive': true,
              'location': city,
              
              // Contact Person Object (Admin Panel expectation)
              'contactPerson': {
                'name': 'Google Data',
                'surname': '',
                'phone': details['formatted_phone_number'] ?? '',
                'email': '',
                'role': 'Otomatik',
              },
              
              'phone': details['formatted_phone_number'] ?? '', // Keep root for App
              
              // Financials
              'subscriptionPlan': 'basic',
              'subscriptionStatus': 'active',
              'monthlyFee': 0.0,
              'accountBalance': 0.0,
              'miraAppConnected': true,
              
              'rating': (details['rating'] as num?)?.toDouble() ?? 0.0,
              'reviewCount': (details['user_ratings_total'] as num?)?.toInt() ?? 0,
              if (imageUrl != null) 'imageUrl': imageUrl, 
              'isActive': true,
              'isApproved': true,
              'isOpen': details['opening_hours']?['open_now'] ?? true,
              'coordinates': {
                'latitude': lat,
                'longitude': lng,
              },
              'address': {
                'city': city,
                'full': details['formatted_address'],
                // Admin Panel expects flat address fields too? 
                // Admin: { street: '...', postalCode: '...', city: '...', country: '...' }
                // We'll try to map best effort or leave flat 'address' map for mobile
                'street': details['formatted_address']?.split(',')[0] ?? '',
                'postalCode': '', // Hard to parse reliably without components
                'country': 'DE',
              },
              'hours': _parseHours(details['opening_hours']),
              'googlePlaceId': details['place_id'] ?? '',
              'updatedAt': FieldValue.serverTimestamp(),
              'createdAt': FieldValue.serverTimestamp(), // Ensure exists
            };

            // 3. Upsert to Firestore (Match by City/Location to avoid duplicates)
            // Strategy: Create a unique ID based on City roughly, or query by city first.
            // Better: Query by unique name + city combination
            
            final query = await FirebaseFirestore.instance
                .collection('businesses')
                .where('location', isEqualTo: city)
                .where('brand', isEqualTo: 'TUNA Metzgerei')
                .get();

            if (query.docs.isNotEmpty) {
              await query.docs.first.reference.update(data);
              debugPrint('Updated: $city');
            } else {
              await FirebaseFirestore.instance.collection('businesses').add(data);
              debugPrint('Created: $city');
            }
            successCount++;
          } else {
             debugPrint('Skipped $city: No coordinates found');
             failCount++;
          }
        } else {
          debugPrint('Skipped $city: Google Place not found');
          failCount++;
        }
      } catch (e) {
        debugPrint('Error processing $city: $e');
        failCount++;
      }
      
      // Rate limit slightly
      await Future.delayed(const Duration(milliseconds: 500));
    }

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Migration Complete: $successCount Updated, $failCount Failed'),
          backgroundColor: successCount > 0 ? Colors.green : Colors.red,
        ),
      );
    }
  }

  static Map<String, String> _parseHours(Map<String, dynamic>? openingHours) {
    if (openingHours == null || openingHours['weekday_text'] == null) {
      return {};
    }
    
    final List<dynamic> texts = openingHours['weekday_text'];
    final Map<String, String> result = {};
    
    // Google returns "Monday: 9:00 AM – 6:00 PM"
    // We map to our keys: monday, tuesday... matches _getTodayHours logic
    for (final text in texts) {
      final str = text.toString();
      final parts = str.split(': ');
      if (parts.length >= 2) {
        final day = parts[0].toLowerCase();
        final hours = parts.sublist(1).join(': ');
        result[day] = hours;
      }
    }
    return result;
  }
}
