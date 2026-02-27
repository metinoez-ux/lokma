import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_places_flutter/google_places_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';
import 'package:lokma_app/providers/user_location_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'dart:convert';

// Constants
const String googleApiKey = 'AIzaSyB8Pvs-P4580Wsk4mT46cvGT7TGlZiLkWo'; // Ensure this matches everywhere

class AddressSelectionSheet extends ConsumerStatefulWidget {
  const AddressSelectionSheet({super.key});

  @override
  ConsumerState<AddressSelectionSheet> createState() => _AddressSelectionSheetState();
}

class _AddressSelectionSheetState extends ConsumerState<AddressSelectionSheet> {
  final TextEditingController _searchController = TextEditingController();
  List<UserLocation> _recentSearches = [];
  bool _isLoading = false;
  bool _isEditing = false;
  UserLocation? _actualGpsLocation;

  @override
  void initState() {
    super.initState();
    _loadRecentSearches();
    _fetchTrueGpsLocation();
  }

  Future<void> _fetchTrueGpsLocation() async {
    try {
      // Create a temporary un-notified instance just to fetch the real GPS data
      // without updating the global state yet.
      // But instead of complex logic, we can just use the Geocoding api ourselves here
      // to keep the provider clean, or add a method to the provider.
      // Easiest is to just call the same logic UserLocationNotifier uses
      // but return it instead of setting state.
      
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );

      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      ).timeout(const Duration(seconds: 10));

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        final street = place.thoroughfare ?? '';
        final number = place.subThoroughfare ?? '';
        final city = place.locality ?? place.administrativeArea ?? '';

        final addressParts = <String>[];
        if (street.isNotEmpty) addressParts.add(street);
        if (number.isNotEmpty) addressParts.add(number);
        final streetPart = addressParts.join(' ');

        String address = '';
        if (streetPart.isNotEmpty && city.isNotEmpty) {
          address = '$streetPart, $city';
        } else if (city.isNotEmpty) {
          address = city;
        } else if (streetPart.isNotEmpty) {
          address = streetPart;
        }

        if (mounted) {
          setState(() {
            _actualGpsLocation = UserLocation(
              latitude: position.latitude,
              longitude: position.longitude,
              address: address,
              street: street,
              city: city,
              hasPermission: true,
            );
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching true GPS location for bottom sheet: $e');
    }
  }

  Future<void> _loadRecentSearches() async {
    final prefs = await SharedPreferences.getInstance();
    final List<String>? recentJson = prefs.getStringList('recent_addresses');
    if (recentJson != null) {
      setState(() {
        _recentSearches = recentJson.map((str) {
          final map = jsonDecode(str);
          return UserLocation(
            latitude: map['latitude'] as double,
            longitude: map['longitude'] as double,
            address: map['address'] as String,
            street: map['street'] as String,
            city: map['city'] as String,
            hasPermission: true,
          );
        }).toList();
      });
    }
  }

  Future<void> _saveRecentSearch(UserLocation location) async {
    final prefs = await SharedPreferences.getInstance();
    // Remove if already exists
    _recentSearches.removeWhere((l) => l.latitude == location.latitude && l.longitude == location.longitude);
    // Add to top
    _recentSearches.insert(0, location);
    // Keep only top 5
    if (_recentSearches.length > 5) {
      _recentSearches = _recentSearches.sublist(0, 5);
    }

    final List<String> recentJson = _recentSearches.map((l) {
      return jsonEncode({
        'latitude': l.latitude,
        'longitude': l.longitude,
        'address': l.address,
        'street': l.street,
        'city': l.city,
      });
    }).toList();

    await prefs.setStringList('recent_addresses', recentJson);
    setState(() {});
  }

  void _onAddressSelected(UserLocation location) {
    HapticFeedback.lightImpact();
    // Update the provider
    ref.read(userLocationProvider.notifier).setLocation(location);
    _saveRecentSearch(location);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      constraints: BoxConstraints(
        maxHeight: screenHeight * 0.90, // Limit to 90% of screen height
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea( 
        child: Column(
          mainAxisSize: MainAxisSize.min, // Avoid expanding more than needed
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Row (Matches "Standort eingeben | Abbrechen")
            Padding(
              padding: const EdgeInsets.only(top: 20, left: 20, right: 20, bottom: 20),
              child: Row(
                children: [
                  const SizedBox(width: 80), // Balance right button to keep title centered
                  Expanded(
                    child: Text(
                      'Adres girin',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 80,
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[800] : Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: Colors.grey[200]!),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            'İptal',
                            style: TextStyle(
                              color: isDark ? Colors.white : Colors.grey[700],
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: GooglePlaceAutoCompleteTextField(
                textEditingController: _searchController,
                googleAPIKey: googleApiKey,
                boxDecoration: const BoxDecoration(), // Eliminate random borders/shadows from package
                inputDecoration: InputDecoration(
                  hintText: 'Tam adres',
                  hintStyle: TextStyle(color: Colors.grey[500], fontSize: 16),
                  filled: true,
                  fillColor: bgColor,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[400]!, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF2C55A6), width: 1.5), // matching the blue border from screenshot
                  ),
                ),
                textStyle: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontSize: 16),
                debounceTime: 400,
                countries: const ['de'],
                isLatLngRequired: true,
                getPlaceDetailWithLatLng: (prediction) {
                  final lat = double.tryParse(prediction.lat ?? '');
                  final lng = double.tryParse(prediction.lng ?? '');
                  if (lat != null && lng != null) {
                    final desc = prediction.description ?? '';
                    final parts = desc.split(',');
                    String street = '';
                    String city = '';
                    if (parts.length >= 2) {
                       street = parts[0].trim();
                       city = parts[1].trim(); 
                    } else {
                       city = desc;
                    }
                    
                    final newLoc = UserLocation(
                      latitude: lat,
                      longitude: lng,
                      address: desc,
                      street: street,
                      city: city,
                      hasPermission: true,
                    );
                    _onAddressSelected(newLoc);
                  }
                },
                itemClick: (Prediction prediction) {
                  _searchController.text = prediction.description ?? '';
                  _searchController.selection = TextSelection.fromPosition(
                    TextPosition(offset: prediction.description?.length ?? 0),
                  );
                },
              ),
            ),

            const SizedBox(height: 24),

            // Current Location Indicator (Matches "Aktueller Standort")
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 20),
              leading: _isLoading 
                ? SizedBox(
                    width: 24, 
                    height: 24, 
                    child: CircularProgressIndicator(
                      color: Theme.of(context).colorScheme.onSurface, 
                      strokeWidth: 2
                    )
                  )
                : Icon(
                    Icons.near_me, 
                    color: Theme.of(context).colorScheme.onSurface, 
                    size: 26
                  ),
              title: Text(
                'Mevcut Konum',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 16,
                  fontWeight: FontWeight.w500, // Slightly less bold than street name
                ),
              ),
              subtitle: _actualGpsLocation != null 
                ? Padding(
                    padding: const EdgeInsets.only(top: 4.0),
                    child: Text(
                      _actualGpsLocation!.address,
                      style: TextStyle(
                        color: Colors.grey[600], 
                        fontSize: 14,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.only(top: 4.0),
                    child: Text(
                      'Konum bulunuyor...',
                      style: TextStyle(
                        color: Colors.grey[500], 
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
              onTap: () async {
                 if (_actualGpsLocation == null) return; // Still fetching
                 setState(() => _isLoading = true);
                 HapticFeedback.lightImpact();
                 // Immediately apply the exact GPS location to the global provider
                 ref.read(userLocationProvider.notifier).setLocation(_actualGpsLocation!);
                 if (context.mounted) Navigator.pop(context);
              },
            ),

            const SizedBox(height: 16),

            // Recent Searches Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Son Aramalar',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  if (_recentSearches.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _isEditing = !_isEditing);
                      },
                      child: Text(
                        _isEditing ? 'Bitti' : 'Düzenle',
                        style: TextStyle(
                          fontSize: 14,
                          color: const Color(0xFFFB335B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Recent Searches List
            if (_recentSearches.isNotEmpty)
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true, // Only take space as much as items need
                  padding: const EdgeInsets.symmetric(vertical: 0),
                  itemCount: _recentSearches.length,
                  itemBuilder: (context, index) {
                    final loc = _recentSearches[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      leading: Icon(
                        Icons.location_on, 
                        color: const Color(0xFFFB335B), // LOKMA brand color
                        size: 26
                      ),
                      title: Padding(
                        padding: const EdgeInsets.only(bottom: 2.0),
                        child: Text(
                          loc.street.isNotEmpty ? loc.street : loc.city,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 16,
                            fontWeight: FontWeight.bold, // Bold street name matching screenshot
                          ),
                        ),
                      ),
                      subtitle: Text(
                        loc.city,
                        style: TextStyle(color: Colors.grey[600], fontSize: 14),
                      ),
                      trailing: _isEditing
                        ? GestureDetector(
                            onTap: () async {
                              HapticFeedback.lightImpact();
                              setState(() {
                                _recentSearches.removeAt(index);
                              });
                              // Persist the change
                              final prefs = await SharedPreferences.getInstance();
                              final List<String> recentJson = _recentSearches.map((l) {
                                return jsonEncode({
                                  'latitude': l.latitude,
                                  'longitude': l.longitude,
                                  'address': l.address,
                                  'street': l.street,
                                  'city': l.city,
                                });
                              }).toList();
                              await prefs.setStringList('recent_addresses', recentJson);
                              if (_recentSearches.isEmpty) {
                                setState(() => _isEditing = false);
                              }
                            },
                            child: const Icon(
                              Icons.delete_outline,
                              color: Color(0xFFFB335B),
                              size: 22,
                            ),
                          )
                        : null,
                      onTap: _isEditing ? null : () => _onAddressSelected(loc),
                    );
                  },
                ),
              ),

            // Added padding at the bottom for safety
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
