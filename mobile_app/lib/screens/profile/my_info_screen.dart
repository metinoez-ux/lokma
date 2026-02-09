import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

class MyInfoScreen extends ConsumerStatefulWidget {
  const MyInfoScreen({super.key});

  @override
  ConsumerState<MyInfoScreen> createState() => _MyInfoScreenState();
}

class _MyInfoScreenState extends ConsumerState<MyInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Controllers
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  
  // Address Controllers - Root Level Schema (Admin Portal Compatible)
  late TextEditingController _addressController; // Street
  late TextEditingController _houseNumberController;
  late TextEditingController _addressLine2Controller; // Apt, Floor etc.
  late TextEditingController _cityController;
  late TextEditingController _postalCodeController;
  late TextEditingController _countryController;
  
  bool _isLoading = false;
  bool _isSaving = false;
  String? _dialCode = '+49'; // Default
  
  // Autocomplete State
  late final FocusNode _addressFocusNode;
  late final FocusNode _cityFocusNode;
  List<Map<String, dynamic>> _currentPredictions = [];
  List<Map<String, dynamic>> _cityPredictions = [];
  
  // API Key from Environment/Config (Hardcoded for immediate fix as per User Request)
  final String _googleMapsApiKey = "AIzaSyCPQZxB0Tt5c4dhh_q2IejHGTd-layUFQE";

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _emailController = TextEditingController();
    _phoneController = TextEditingController();
    
    _addressController = TextEditingController();
    _houseNumberController = TextEditingController();
    _addressLine2Controller = TextEditingController();
    _cityController = TextEditingController();
    _postalCodeController = TextEditingController();
    _countryController = TextEditingController(text: 'Germany'); // Default
    _addressFocusNode = FocusNode();
    _cityFocusNode = FocusNode();

    _loadUserData();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _houseNumberController.dispose();
    _addressLine2Controller.dispose();
    _cityController.dispose();
    _postalCodeController.dispose();
    _countryController.dispose();
    _addressFocusNode.dispose();
    _cityFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadUserData() async {
    setState(() => _isLoading = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
        if (doc.exists) {
          final data = doc.data() as Map<String, dynamic>;
          
          // Name: prefer firstName/lastName (canonical), fallback to fullName/displayName
          final firstName = data['firstName']?.toString() ?? '';
          final lastName = data['lastName']?.toString() ?? '';
          if (firstName.isNotEmpty || lastName.isNotEmpty) {
            _nameController.text = '$firstName $lastName'.trim();
          } else {
            _nameController.text = (data['fullName'] ?? data['displayName'])?.toString() ?? '';
          }
          _emailController.text = (data['email'] ?? user.email)?.toString() ?? '';
          _phoneController.text = (data['phoneNumber'] ?? user.phoneNumber)?.toString() ?? '';
          
          // Address handling
          var rawAddress = data['address'];
          if (rawAddress is String) {
            _addressController.text = rawAddress;
          } else if (rawAddress is Map) {
             // Handle legacy map if present in 'address' field
             _addressController.text = rawAddress['street']?.toString() ?? rawAddress['address']?.toString() ?? '';
          } else {
            _addressController.text = '';
          }

          _houseNumberController.text = data['houseNumber']?.toString() ?? '';
          _addressLine2Controller.text = data['addressLine2']?.toString() ?? '';
          _cityController.text = data['city']?.toString() ?? '';
          _postalCodeController.text = data['postalCode']?.toString() ?? '';
          _countryController.text = data['country']?.toString() ?? 'Germany';
          _dialCode = data['dialCode']?.toString() ?? '+49';

          // Fallback for legacy 'deliveryAddress' map if root fields are empty
          if (_addressController.text.isEmpty && data['deliveryAddress'] != null) {
             final delivery = data['deliveryAddress'] as Map<String, dynamic>;
             _addressController.text = delivery['street'] ?? '';
             _cityController.text = delivery['city'] ?? '';
             _postalCodeController.text = delivery['postalCode'] ?? '';
             _houseNumberController.text = delivery['houseNumber'] ?? '';
          }
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Kullanıcı bilgileri yüklenemedi: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isLoading = true);
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
           throw 'Konum izni reddedildi';
        }
      }
      
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high
      );
      
      await _fillAddressFromCoordinates(position.latitude, position.longitude);

    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Konum alınamadı: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fillAddressFromCoordinates(double lat, double lng) async {
    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(lat, lng);
      if (placemarks.isNotEmpty) {
        Placemark place = placemarks.first;
        setState(() {
          _addressController.text = place.thoroughfare ?? ''; // Street
          _houseNumberController.text = place.subThoroughfare ?? '';
          _cityController.text = place.locality ?? place.subAdministrativeArea ?? '';
          _postalCodeController.text = place.postalCode ?? '';
          _countryController.text = place.country ?? 'Germany';
          
          // Optional: You can fill state/province if needed
          // _stateController.text = place.administrativeArea ?? '';
        });
        
        // Ensure cursor is at the end
        if (_addressController.text.isNotEmpty) {
           _addressController.selection = TextSelection.fromPosition(TextPosition(offset: _addressController.text.length));
        }
      }
    } catch (e) {
      debugPrint("Address decode error: $e");
    }
  }

  // Real-time Autocomplete Suggestions Fetcher
  Future<Iterable<String>> _fetchSuggestionsFromGoogle(String query) async {
    if (query.length < 3) return [];
    
    final url = Uri.parse(
       "https://maps.googleapis.com/maps/api/place/autocomplete/json"
       "?input=${Uri.encodeComponent(query)}"
       "&key=$_googleMapsApiKey"
       "&language=tr"
       "&types=address" // Only show street addresses, not businesses
    );

    try {
      final response = await http.get(url);
      final data = json.decode(response.body);

      if (data['status'] == 'OK') {
         final predictions = data['predictions'] as List;
         _currentPredictions = predictions.map((p) => {
           'description': p['description'] as String,
           'place_id': p['place_id'] as String,
         }).toList();
         return _currentPredictions.map<String>((p) => p['description']!);
      }
    } catch (e) {
      debugPrint("Suggestions Fetch Error: $e");
    }
    return [];
  }

  void _onSuggestionSelected(String description) {
    final prediction = _currentPredictions.firstWhere(
      (p) => p['description'] == description, 
      orElse: () => <String, dynamic>{},
    );
    if (prediction.isNotEmpty && prediction['place_id'] != null) {
      _fetchPlaceDetails(prediction['place_id']!, description);
    }
  }

  // City Autocomplete - Only cities
  Future<Iterable<String>> _fetchCitySuggestions(String query) async {
    if (query.length < 2) return [];
    
    final url = Uri.parse(
       "https://maps.googleapis.com/maps/api/place/autocomplete/json"
       "?input=${Uri.encodeComponent(query)}"
       "&key=$_googleMapsApiKey"
       "&language=tr"
       "&types=(cities)" // Only show cities
    );

    try {
      final response = await http.get(url);
      final data = json.decode(response.body);

      if (data['status'] == 'OK') {
         final predictions = data['predictions'] as List;
         _cityPredictions = predictions.map((p) => {
           'description': p['description'] as String,
           'place_id': p['place_id'] as String,
         }).toList();
         // Extract just city name (first part before comma)
         return _cityPredictions.map<String>((p) {
           final desc = p['description'] as String;
           return desc.split(',').first.trim();
         });
      }
    } catch (e) {
      debugPrint("City Suggestions Error: $e");
    }
    return [];
  }

  void _onCitySelected(String cityName) {
    _cityController.text = cityName;
  }

  // Direct Google Places API Integration (No 3rd Party Library)
  Future<void> _searchGoogleAddressDirect() async {
     if (_addressController.text.length < 3) {
       ScaffoldMessenger.of(context).showSnackBar(
           const SnackBar(content: Text('Lütfen en az 3 karakter girin.'))
       );
       return;
     }
     
     setState(() => _isLoading = true);
     FocusManager.instance.primaryFocus?.unfocus();

     // 1. API Request
     final url = Uri.parse(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        "?input=${Uri.encodeComponent(_addressController.text)}"
        "&key=$_googleMapsApiKey"
        "&language=tr"
     );

     try {
       final response = await http.get(url);
       final data = json.decode(response.body);

       if (data['status'] == 'OK') {
          final predictions = data['predictions'] as List;
          _showPredictionsSheet(predictions);
       } else {
          // Show the RAW error from Google to the user/developer
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Google API Hatası: ${data['status']}\n${data['error_message'] ?? ""}'),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 5),
            )
          );
       }
     } catch (e) {
       ScaffoldMessenger.of(context).showSnackBar(
         SnackBar(content: Text('Bağlantı Hatası: $e')),
       );
     } finally {
       setState(() => _isLoading = false);
     }
  }

  void _showPredictionsSheet(List predictions) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sheetBg = isDark ? const Color(0xFF1F2937) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final dividerColor = isDark ? Colors.white10 : Colors.grey[300]!;

    showModalBottomSheet(
      context: context,
      backgroundColor: sheetBg,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: predictions.length,
          separatorBuilder: (_, __) => Divider(color: dividerColor),
          itemBuilder: (ctx, i) {
            final p = predictions[i];
            return ListTile(
              title: Text(p['description'], style: TextStyle(color: textColor)),
              leading: const Icon(Icons.place, color: Color(0xFFE30A17)),
              onTap: () {
                Navigator.pop(ctx);
                _fetchPlaceDetails(p['place_id'], p['description']);
              },
            );
          },
        );
      }
    );
  }

  Future<void> _fetchPlaceDetails(String placeId, String description) async {
      setState(() => _isLoading = true);
      _addressController.text = description; 
      
      final url = Uri.parse(
        "https://maps.googleapis.com/maps/api/place/details/json"
        "?place_id=$placeId"
        "&fields=geometry"
        "&key=$_googleMapsApiKey"
      );
      
      try {
        final response = await http.get(url);
        final data = json.decode(response.body);
        
        if (data['status'] == 'OK') {
           final location = data['result']['geometry']['location'];
           // Call the existing fill logic with Google coordinates
           await _fillAddressFromCoordinates(location['lat'], location['lng']);
        }
      } catch (e) {
        print("Details Error: $e");
      } finally {
        setState(() => _isLoading = false);
      }
  }

  Future<void> _saveUserData() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        // Parse firstName/lastName from full name
        final nameParts = _nameController.text.trim().split(' ');
        final firstName = nameParts.isNotEmpty ? nameParts.first : '';
        final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';
        
        // Universal Address Schema - Root Level Storage
        final userData = {
          'firstName': firstName,
          'lastName': lastName,
          'fullName': _nameController.text,
          'displayName': _nameController.text, // Sync displayName
          'phoneNumber': _phoneController.text,
          'email': _emailController.text,
          
          // Address Fields
          'address': _addressController.text, // Street
          'houseNumber': _houseNumberController.text,
          'addressLine2': _addressLine2Controller.text,
          'city': _cityController.text,
          'postalCode': _postalCodeController.text,
          'country': _countryController.text,
          'dialCode': _dialCode,
          
          'updatedAt': FieldValue.serverTimestamp(),
        };

        await FirebaseFirestore.instance.collection('users').doc(user.uid).update(userData);
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Bilgileriniz başarıyla güncellendi'),
              backgroundColor: Color(0xFFE30A17),
            ),
          );
          context.pop();
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Kaydedilirken hata oluştu: $e')),
      );
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF121212) : Colors.grey[50]!;
    final cardBg = isDark ? const Color(0xFF1F2937) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark ? Colors.white70 : Colors.black54;
    final borderColor = isDark ? Colors.white24 : Colors.grey[350]!;
    final dividerColor = isDark ? Colors.white10 : Colors.grey[300]!;

    if (_isLoading && _nameController.text.isEmpty) {
      return Scaffold(
        backgroundColor: scaffoldBg,
        body: const Center(child: CircularProgressIndicator(color: Color(0xFFE30A17))),
      );
    }

    InputDecoration buildInputDecoration({
      required String label,
      IconData? icon,
      bool isOptional = false,
    }) {
      return InputDecoration(
        labelText: label,
        prefixIcon: icon != null ? Icon(icon, color: hintColor, size: 20) : null,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: borderColor)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: borderColor)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE30A17))),
        filled: true,
        fillColor: cardBg,
        labelStyle: TextStyle(color: isOptional ? hintColor.withOpacity(0.5) : hintColor, fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        isDense: true,
      );
    }

    Widget buildAutocompleteSuggestions(Iterable<String> options, void Function(String) onSelected, {double maxWidth = 0.7}) {
      return Align(
        alignment: Alignment.topLeft,
        child: Material(
          color: cardBg,
          elevation: 8,
          borderRadius: BorderRadius.circular(8),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: 180, maxWidth: MediaQuery.of(context).size.width * maxWidth),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 4),
              shrinkWrap: true,
              itemCount: options.length,
              separatorBuilder: (_, __) => Divider(color: dividerColor, height: 1),
              itemBuilder: (context, index) {
                final option = options.elementAt(index);
                return ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  title: Text(option, style: TextStyle(color: textColor, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  leading: const Icon(Icons.place, color: Color(0xFFE30A17), size: 18),
                  onTap: () => onSelected(option),
                );
              },
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: scaffoldBg,
        surfaceTintColor: Colors.transparent,
        title: Text('Bilgilerim & Adres', style: TextStyle(color: textColor)),
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: textColor),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle('Kişisel Bilgiler', textColor),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _nameController,
                label: 'Ad Soyad',
                icon: Icons.person_outline,
                textColor: textColor,
                hintColor: hintColor,
                borderColor: borderColor,
                fillColor: cardBg,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _emailController,
                label: 'E-posta',
                icon: Icons.email_outlined,
                readOnly: true,
                textColor: textColor,
                hintColor: hintColor,
                borderColor: borderColor,
                fillColor: cardBg,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _phoneController,
                label: 'Telefon',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                textColor: textColor,
                hintColor: hintColor,
                borderColor: borderColor,
                fillColor: cardBg,
              ),
              
              const SizedBox(height: 32),
              
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSectionTitle('Teslimat Adresi', textColor),
                  TextButton.icon(
                    onPressed: _getCurrentLocation,
                    icon: const Icon(Icons.my_location, color: Color(0xFFE30A17)),
                    label: const Text('Konum Bul', style: TextStyle(color: Color(0xFFE30A17))),
                    style: TextButton.styleFrom(
                      backgroundColor: const Color(0xFFE30A17).withOpacity(0.1),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              
              // Row 1: Sokak + Ev Numarası
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: RawAutocomplete<String>(
                      textEditingController: _addressController,
                      focusNode: _addressFocusNode,
                      optionsBuilder: (TextEditingValue textEditingValue) {
                        return _fetchSuggestionsFromGoogle(textEditingValue.text);
                      },
                      displayStringForOption: (option) => option,
                      onSelected: _onSuggestionSelected,
                      fieldViewBuilder: (context, textEditingController, focusNode, onFieldSubmitted) {
                        return TextField(
                          controller: textEditingController,
                          focusNode: focusNode,
                          style: TextStyle(color: textColor, fontSize: 15),
                          decoration: buildInputDecoration(label: 'Sokak / Cadde', icon: Icons.location_on_outlined),
                          onSubmitted: (value) => onFieldSubmitted(),
                        );
                      },
                      optionsViewBuilder: (context, onSelected, options) {
                        return buildAutocompleteSuggestions(options, onSelected);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 1,
                    child: TextField(
                      controller: _houseNumberController,
                      style: TextStyle(color: textColor, fontSize: 15),
                      keyboardType: TextInputType.text,
                      textAlign: TextAlign.center,
                      decoration: buildInputDecoration(label: 'No'),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 10),
              
              // Row 2: Adres Satırı 2
              TextField(
                controller: _addressLine2Controller,
                style: TextStyle(color: textColor, fontSize: 15),
                decoration: buildInputDecoration(label: 'Daire, Kat, Kapı No (Opsiyonel)', icon: Icons.apartment_outlined, isOptional: true),
              ),
              
              const SizedBox(height: 10),
              
              // Row 3: Posta Kodu + Şehir
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: _postalCodeController,
                      style: TextStyle(color: textColor, fontSize: 15),
                      keyboardType: TextInputType.number,
                      decoration: buildInputDecoration(label: 'Posta Kodu', icon: Icons.local_post_office_outlined),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 3,
                    child: RawAutocomplete<String>(
                      textEditingController: _cityController,
                      focusNode: _cityFocusNode,
                      optionsBuilder: (TextEditingValue textEditingValue) {
                        return _fetchCitySuggestions(textEditingValue.text);
                      },
                      displayStringForOption: (option) => option,
                      onSelected: _onCitySelected,
                      fieldViewBuilder: (context, textEditingController, focusNode, onFieldSubmitted) {
                        return TextField(
                          controller: textEditingController,
                          focusNode: focusNode,
                          style: TextStyle(color: textColor, fontSize: 15),
                          decoration: buildInputDecoration(label: 'Şehir', icon: Icons.location_city_outlined),
                          onSubmitted: (value) => onFieldSubmitted(),
                        );
                      },
                      optionsViewBuilder: (context, onSelected, options) {
                        return buildAutocompleteSuggestions(options, onSelected, maxWidth: 0.5);
                      },
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _saveUserData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE30A17),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSaving 
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Bilgileri Güncelle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, Color textColor) {
    return Text(
      title,
      style: TextStyle(
        color: textColor,
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required Color textColor,
    required Color hintColor,
    required Color borderColor,
    required Color fillColor,
    bool readOnly = false,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      readOnly: readOnly,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: TextStyle(color: textColor),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: hintColor),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE30A17)),
        ),
        filled: true,
        fillColor: fillColor,
        labelStyle: TextStyle(color: hintColor),
      ),
      validator: (value) {
        if (!readOnly && (value == null || value.isEmpty)) {
          if (label.contains('İsteğe bağlı')) return null;
          return 'Zorunlu alan';
        }
        return null;
      },
    );
  }
}
