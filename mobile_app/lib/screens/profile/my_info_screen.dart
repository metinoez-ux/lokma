import 'dart:convert';
import 'package:lokma_app/config/app_secrets.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:google_places_flutter/google_places_flutter.dart';
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
  // Telefon alani -- kendi custom implementasyonumuz (packet stripping yok)
  String _selectedDialCode = '+49';
  String _selectedCountryFlag = '🇩🇪'; // DE bayragi
  String _phoneCompleteNumber = ''; // Kaydedilecek tam numara (+4915112345678)
  
  // Autocomplete State
  late final FocusNode _addressFocusNode;
  late final FocusNode _cityFocusNode;
  List<Map<String, dynamic>> _currentPredictions = [];
  List<Map<String, dynamic>> _cityPredictions = [];
  // Secim yapildiktan sonra dropdown'in tekrar acilmasini engeller
  bool _suppressAddressSearch = false;
  
  // API Key from Environment/Config (Hardcoded for immediate fix as per User Request)
  final String _googleMapsApiKey = AppSecrets.googlePlacesApiKey;

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
  void deactivate() {
    // Sayfa tree'den çıkınca (navigation, pop, hot restart) klavyeyi kapat
    FocusManager.instance.primaryFocus?.unfocus();
    super.deactivate();
  }

  // Dial code'a gore bayrak emoji dondur
  String _flagForDialCode(String dialCode) {
    const map = {
      '+49': '\ud83c\udde9\ud83c\uddea', // DE
      '+90': '\ud83c\uddf9\ud83c\uddf7', // TR
      '+43': '\ud83c\udde6\ud83c\uddf9', // AT
      '+41': '\ud83c\udde8\ud83c\udded', // CH
      '+31': '\ud83c\uddf3\ud83c\uddf1', // NL
      '+33': '\ud83c\uddeb\ud83c\uddf7', // FR
      '+44': '\ud83c\uddec\ud83c\udde7', // GB
      '+1':  '\ud83c\uddfa\ud83c\uddf8', // US
      '+32': '\ud83c\udde7\ud83c\uddea', // BE
      '+39': '\ud83c\uddee\ud83c\uddf9', // IT
    };
    return map[dialCode] ?? '\ud83c\uddf8\ud83c\uddee'; // fallback SI bayragi
  }

  // Ulke kodu secici bottom sheet
  void _showDialCodePicker(
    BuildContext ctx,
    Color textColor, Color cardBg, Color hintColor, Color borderColor, bool isDark,
  ) {
    const countries = [
      {'\ud83c\udde9\ud83c\uddea': '+49', 'name': 'Almanya'},
      {'\ud83c\uddf9\ud83c\uddf7': '+90', 'name': 'T\u00fcrkiye'},
      {'\ud83c\udde6\ud83c\uddf9': '+43', 'name': 'Avusturya'},
      {'\ud83c\udde8\ud83c\udded': '+41', 'name': 'İsvi\u00e7re'},
      {'\ud83c\uddf3\ud83c\uddf1': '+31', 'name': 'Hollanda'},
      {'\ud83c\uddeb\ud83c\uddf7': '+33', 'name': 'Fransa'},
      {'\ud83c\uddec\ud83c\udde7': '+44', 'name': 'Birle\u015fik Krall\u0131k'},
      {'\ud83c\uddfa\ud83c\uddf8': '+1',  'name': 'ABD'},
      {'\ud83c\udde7\ud83c\uddea': '+32', 'name': 'Bel\u00e7ika'},
      {'\ud83c\uddee\ud83c\uddf9': '+39', 'name': '\u0130talya'},
    ];
    showModalBottomSheet(
      context: ctx,
      backgroundColor: cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('\u00dcLKE KODU SE\u00c7', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 14)),
          ),
          ...countries.map((c) {
            final flag = c.keys.first;
            final dial = c[flag]!;
            final name = c['name']!;
            return ListTile(
              leading: Text(flag, style: const TextStyle(fontSize: 24)),
              title: Text('$name  $dial', style: TextStyle(color: textColor)),
              onTap: () {
                setState(() {
                  _selectedCountryFlag = flag;
                  _selectedDialCode = dial;
                  _phoneCompleteNumber = _phoneController.text.isEmpty
                      ? '' : '$dial${_phoneController.text}';
                });
                Navigator.pop(_);
              },
            );
          }),
          const SizedBox(height: 16),
        ],
      ),
    );
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
          final rawPhone = (data['phoneNumber'] ?? user.phoneNumber)?.toString() ?? '';
          _phoneCompleteNumber = rawPhone;
          if (rawPhone.startsWith('+')) {
            // +4915112345 gibi -- dial code ogren, gerisi numaraya gider
            final matchDial = RegExp(r'^\+(\d{1,3})(.*)').firstMatch(rawPhone);
            if (matchDial != null) {
              _selectedDialCode = '+${matchDial.group(1)}';
              _phoneController.text = matchDial.group(2)?.trim() ?? '';
              // Ülke bayragini da guncelle
              _selectedCountryFlag = _flagForDialCode(_selectedDialCode);
            } else {
              _phoneController.text = rawPhone;
            }
          } else {
            _phoneController.text = rawPhone;
          }
          
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
          _selectedDialCode = data['dialCode']?.toString() ?? '+49';
          _selectedCountryFlag = _flagForDialCode(_selectedDialCode);

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
    // Secim yapildiktan sonra yeniden arama tetikleme
    if (_suppressAddressSearch) {
      _suppressAddressSearch = false;
      return [];
    }
    if (query.length < 3) return [];
    
    final url = Uri.parse(
       "https://maps.googleapis.com/maps/api/place/autocomplete/json"
       "?input=${Uri.encodeComponent(query)}"
       "&key=$_googleMapsApiKey"
       "&language=tr"
       "&types=address"
       "&components=country:de|country:tr|country:at|country:ch"
    );

    try {
      final response = await http.get(url);
      final data = json.decode(response.body);

      if (data['status'] == 'OK') {
         final predictions = data['predictions'] as List;
         _currentPredictions = predictions.map<Map<String, dynamic>>((p) => <String, dynamic>{
           'description': p['description'] as String,
           'place_id': p['place_id'] as String,
         }).toList();
         return _currentPredictions.map<String>((p) => p['description'] as String);
      }
    } catch (e) {
      debugPrint("Suggestions Fetch Error: $e");
    }
    return [];
  }

  void _onSuggestionSelected(String description) {
    // Dropdown'un tekrar acilmasini engelle
    _suppressAddressSearch = true;
    _addressFocusNode.unfocus();
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
         _cityPredictions = predictions.map<Map<String, dynamic>>((p) => <String, dynamic>{
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

  Future<void> _fetchPlaceDetails(String placeId, String description) async {
    setState(() => _isLoading = true);
    try {
      // address_components ile dogru field mapping -- TR ve DE icin
      final url = Uri.parse(
        'https://maps.googleapis.com/maps/api/place/details/json'
        '?place_id=$placeId'
        '&fields=address_components'
        '&key=$_googleMapsApiKey',
      );
      final response = await http.get(url).timeout(const Duration(seconds: 8));
      final data = json.decode(response.body);

      if (data['status'] == 'OK') {
        final components = data['result']?['address_components'] as List<dynamic>? ?? [];

        String streetNumber = '';
        String route = '';
        String neighborhood = '';
        String postalCode = '';
        String locality = '';
        String adminArea1 = '';
        String adminArea2 = '';
        String country = '';

        for (final comp in components) {
          final types = List<String>.from(comp['types'] ?? []);
          final longName = comp['long_name']?.toString() ?? '';
          if (types.contains('street_number'))                    streetNumber = longName;
          else if (types.contains('route'))                       route = longName;
          else if (types.contains('neighborhood') ||
                   types.contains('sublocality_level_1') ||
                   types.contains('sublocality'))                 neighborhood = longName;
          else if (types.contains('postal_code'))                 postalCode = longName;
          else if (types.contains('locality'))                    locality = longName;
          else if (types.contains('administrative_area_level_1')) adminArea1 = longName;
          else if (types.contains('administrative_area_level_2')) adminArea2 = longName;
          else if (types.contains('country'))                     country = longName;
        }

        // TR: il (adminArea1) sehir olarak kullan; DE/AT/CH: locality
        String city;
        if (country == 'Türkiye' || country == 'Turkey') {
          city = adminArea1.isNotEmpty ? adminArea1
               : adminArea2.isNotEmpty ? adminArea2
               : locality;
          if (neighborhood.isNotEmpty && route.isNotEmpty) {
            route = '$neighborhood, $route';
          } else if (neighborhood.isNotEmpty) {
            route = neighborhood;
          }
        } else {
          city = locality.isNotEmpty ? locality
               : adminArea2.isNotEmpty ? adminArea2
               : adminArea1;
        }

        setState(() {
          _addressController.text = route.isNotEmpty ? route : description;
          _houseNumberController.text = streetNumber;
          _postalCodeController.text = postalCode;
          _cityController.text = city;
          _countryController.text = country;
        });
        // Cursor'u sona taşı -- backspace/silme calissin
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _addressController.selection = TextSelection.fromPosition(
            TextPosition(offset: _addressController.text.length),
          );
        });
      } else {
        // API basarisiz -- description'i sokak olarak koy
        setState(() => _addressController.text = description);
      }
    } catch (e) {
      debugPrint('Place details error: $e');
      setState(() => _addressController.text = description);
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
          'phoneNumber': _phoneCompleteNumber.isNotEmpty ? _phoneCompleteNumber : _phoneController.text,
          'email': _emailController.text,
          
          // Address Fields
          'address': _addressController.text, // Street
          'houseNumber': _houseNumberController.text,
          'addressLine2': _addressLine2Controller.text,
          'city': _cityController.text,
          'postalCode': _postalCodeController.text,
          'country': _countryController.text,
          'dialCode': _selectedDialCode,
          
          'updatedAt': FieldValue.serverTimestamp(),
        };

        await FirebaseFirestore.instance.collection('users').doc(user.uid).update(userData);
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(tr('profile.info_updated_successfully')),
              backgroundColor: Color(0xFFE30A17),
            ),
          );
          context.pop();
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tr('common.error_saving_e'))),
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
        body: const Center(child: CircularProgressIndicator(color: Colors.grey)),
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
              // Telefon -- custom: bayragi + dial code chip + plain TextField
              // IntlPhoneField bazi rakamlari (mesela '1') kesiyor, bu nedenle kendi implementasyonumuz
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Ulke kodu chip
                  GestureDetector(
                    onTap: () => _showDialCodePicker(context, textColor, cardBg, hintColor, borderColor, isDark),
                    child: Container(
                      height: 56,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: cardBg,
                        border: Border.all(color: borderColor),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_selectedCountryFlag, style: const TextStyle(fontSize: 20)),
                          const SizedBox(width: 4),
                          Text(_selectedDialCode, style: TextStyle(color: textColor, fontSize: 14, fontWeight: FontWeight.w500)),
                          Icon(Icons.arrow_drop_down, size: 18, color: hintColor),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Numara alani -- HICBIR kesme yok, sadece bas 0 cikar
                  Expanded(
                    child: TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      style: TextStyle(color: textColor, fontSize: 15),
                      decoration: InputDecoration(
                        labelText: 'Telefon (isteğe bağlı)',
                        labelStyle: TextStyle(color: hintColor),
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
                        fillColor: cardBg,
                      ),
                      onChanged: (val) {
                        String cleaned = val;
                        // Sadece basdaki 0'i sil (trunk prefix) -- baska hicbir seye dokunma
                        if (cleaned.startsWith('0') && cleaned.length > 1) {
                          cleaned = cleaned.substring(1);
                          _phoneController.value = TextEditingValue(
                            text: cleaned,
                            selection: TextSelection.collapsed(offset: cleaned.length),
                          );
                        }
                        setState(() {
                          _phoneCompleteNumber = cleaned.isEmpty ? '' : '$_selectedDialCode$cleaned';
                        });
                      },
                    ),
                  ),
                ],
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
                    : const Text('Bilgileri Güncelle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
                ),
              ),
              
              const SizedBox(height: 36),
              
              // ═══════════════════════════════════════════
              // KAYITLI ADRESLERİM (Saved Addresses)
              // ═══════════════════════════════════════════
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSectionTitle('Kayıtlı Adreslerim', textColor),
                  TextButton.icon(
                    onPressed: () => _showAddAddressDialog(isDark, cardBg, textColor, hintColor, borderColor),
                    icon: const Icon(Icons.add_circle_outline, color: Color(0xFFEA184A), size: 18),
                    label: const Text('Yeni Ekle', style: TextStyle(color: Color(0xFFEA184A), fontWeight: FontWeight.w600, fontSize: 13)),
                    style: TextButton.styleFrom(
                      backgroundColor: const Color(0xFFEA184A).withOpacity(0.08),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              
              // Saved addresses list from Firestore
              _buildSavedAddressesList(isDark, cardBg, textColor, hintColor, borderColor),
              
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
  
  // ═══════════════════ SAVED ADDRESSES SECTION ═══════════════════
  
  IconData _getLabelIcon(String? label) {
    if (label == null || label.isEmpty) return Icons.location_on;
    final lower = label.toLowerCase();
    if (lower.contains('ev') || lower.contains('home')) return Icons.home_outlined;
    if (lower.contains('iş') || lower.contains('is') || lower.contains('work') || lower.contains('office') || lower.contains('büro')) return Icons.work_outline;
    return Icons.location_on_outlined;
  }
  
  Color _getLabelColor(String? label) {
    if (label == null || label.isEmpty) return const Color(0xFFEA184A);
    final lower = label.toLowerCase();
    if (lower.contains('ev') || lower.contains('home')) return const Color(0xFF4CAF50);
    if (lower.contains('iş') || lower.contains('is') || lower.contains('work') || lower.contains('office')) return const Color(0xFF2196F3);
    return const Color(0xFFEA184A);
  }
  
  Widget _buildSavedAddressesList(bool isDark, Color cardBg, Color textColor, Color hintColor, Color borderColor) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const SizedBox.shrink();
    
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .collection('savedAddresses')
          .orderBy('createdAt', descending: false)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: Padding(
            padding: EdgeInsets.all(24),
            child: CircularProgressIndicator(color: Colors.grey, strokeWidth: 2),
          ));
        }
        
        final docs = snapshot.data?.docs ?? [];
        
        if (docs.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1F2937) : Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? Colors.grey.shade800 : Colors.grey.shade200),
            ),
            child: Column(
              children: [
                Icon(Icons.location_off_outlined, size: 40, color: Colors.grey[400]),
                const SizedBox(height: 12),
                Text(
                  'Henüz kayıtlı adresiniz yok',
                  style: TextStyle(color: Colors.grey[500], fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(
                  'Sık kullandığınız adresleri kaydedin,\nsipariş verirken hızlıca seçin',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey[400], fontSize: 12),
                ),
              ],
            ),
          );
        }
        
        return Column(
          children: docs.map((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final label = data['label']?.toString() ?? '';
            final street = data['street']?.toString() ?? '';
            final houseNumber = data['houseNumber']?.toString() ?? '';
            final postalCode = data['postalCode']?.toString() ?? '';
            final city = data['city']?.toString() ?? '';
            
            final streetFull = houseNumber.isNotEmpty ? '$street $houseNumber' : street;
            final fullAddress = [streetFull, '$postalCode $city'].where((s) => s.trim().isNotEmpty).join(', ');
            
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? Colors.grey.shade700 : Colors.grey.shade200),
                boxShadow: [
                  if (!isDark) BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  // Label icon
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      color: _getLabelColor(label).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(_getLabelIcon(label), color: _getLabelColor(label), size: 20),
                  ),
                  const SizedBox(width: 12),
                  // Address details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (label.isNotEmpty)
                          Text(
                            label,
                            style: TextStyle(
                              color: _getLabelColor(label),
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                        Text(
                          fullAddress,
                          style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // Edit button
                  IconButton(
                    icon: Icon(Icons.edit_outlined, color: Colors.grey[500], size: 18),
                    onPressed: () => _showEditAddressDialog(doc.id, data, isDark, cardBg, textColor, hintColor, borderColor),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                  // Delete button
                  IconButton(
                    icon: Icon(Icons.delete_outline, color: Colors.red[400], size: 18),
                    onPressed: () => _confirmDeleteAddress(doc.id, label.isNotEmpty ? label : fullAddress),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                ],
              ),
            );
          }).toList(),
        );
      },
    );
  }
  
  void _confirmDeleteAddress(String docId, String label) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('profile.delete_address'.tr()),
        content: Text('"$label" adresini silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('İptal', style: TextStyle(color: Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () async {
              final user = FirebaseAuth.instance.currentUser;
              if (user != null) {
                await FirebaseFirestore.instance
                    .collection('users')
                    .doc(user.uid)
                    .collection('savedAddresses')
                    .doc(docId)
                    .delete();
              }
              if (ctx.mounted) Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Sil', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
  
  void _showAddAddressDialog(bool isDark, Color cardBg, Color textColor, Color hintColor, Color borderColor) {
    _showAddressFormDialog(
      isDark: isDark,
      cardBg: cardBg,
      textColor: textColor,
      hintColor: hintColor,
      borderColor: borderColor,
      title: 'Yeni Adres Ekle',
      onSave: (addressData) async {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .collection('savedAddresses')
              .add({
            ...addressData,
            'createdAt': FieldValue.serverTimestamp(),
          });
        }
      },
    );
  }
  
  void _showEditAddressDialog(String docId, Map<String, dynamic> existing, bool isDark, Color cardBg, Color textColor, Color hintColor, Color borderColor) {
    _showAddressFormDialog(
      isDark: isDark,
      cardBg: cardBg,
      textColor: textColor,
      hintColor: hintColor,
      borderColor: borderColor,
      title: 'Adresi Düzenle',
      initialData: existing,
      onSave: (addressData) async {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .collection('savedAddresses')
              .doc(docId)
              .update(addressData);
        }
      },
    );
  }
  
  void _showAddressFormDialog({
    required bool isDark,
    required Color cardBg,
    required Color textColor,
    required Color hintColor,
    required Color borderColor,
    required String title,
    Map<String, dynamic>? initialData,
    required Future<void> Function(Map<String, dynamic>) onSave,
  }) {
    final labelCtrl = TextEditingController(text: initialData?['label']?.toString() ?? '');
    final searchCtrl = TextEditingController();
    final streetCtrl = TextEditingController(text: initialData?['street']?.toString() ?? '');
    final houseNumCtrl = TextEditingController(text: initialData?['houseNumber']?.toString() ?? '');
    final addressLine2Ctrl = TextEditingController(text: initialData?['addressLine2']?.toString() ?? '');
    final postalCtrl = TextEditingController(text: initialData?['postalCode']?.toString() ?? '');
    final cityCtrl = TextEditingController(text: initialData?['city']?.toString() ?? '');
    String selectedLabel = initialData?['label']?.toString() ?? '';
    // Determine if "Diger" is selected (not Ev or Is)
    bool isDigerSelected = selectedLabel.isNotEmpty && selectedLabel != 'Ev' && selectedLabel != 'İş';
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setFormState) {
            final bottomInset = MediaQuery.of(context).viewInsets.bottom;
            return Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
              padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle bar
                    Center(
                      child: Container(
                        width: 40, height: 4,
                        decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: textColor)),
                    const SizedBox(height: 20),
                    
                    // Quick label chips
                    Text('Adres Etiketi', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: hintColor)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _buildLabelChip('Ev', Icons.home_outlined, const Color(0xFF4CAF50), selectedLabel, (val) {
                          setFormState(() { selectedLabel = val; isDigerSelected = false; });
                          labelCtrl.text = val;
                        }),
                        const SizedBox(width: 8),
                        _buildLabelChip('İş', Icons.work_outline, const Color(0xFF2196F3), selectedLabel, (val) {
                          setFormState(() { selectedLabel = val; isDigerSelected = false; });
                          labelCtrl.text = val;
                        }),
                        const SizedBox(width: 8),
                        _buildLabelChip('Diğer', Icons.location_on_outlined, const Color(0xFFEA184A), selectedLabel, (val) {
                          setFormState(() { selectedLabel = val; isDigerSelected = true; });
                          labelCtrl.text = '';
                        }),
                      ],
                    ),
                    // "Diger" secilince ozel isim alani -- tam genislikte, rahat kullanim
                    if (isDigerSelected) ...[
                      const SizedBox(height: 10),
                      TextField(
                        controller: labelCtrl,
                        style: TextStyle(color: textColor, fontSize: 14),
                        decoration: InputDecoration(
                          labelText: 'Adres etiketi (ör. Sporthalle)',
                          labelStyle: TextStyle(color: hintColor, fontSize: 13),
                          prefixIcon: Icon(Icons.edit_outlined, color: hintColor, size: 20),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor)),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor)),
                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEA184A), width: 1.5)),
                          filled: true,
                          fillColor: cardBg,
                        ),
                        onChanged: (val) => setFormState(() => selectedLabel = val),
                      ),
                    ],
                    const SizedBox(height: 16),

                    // Google Places Autocomplete arama alani
                    Text('Adres Ara', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: hintColor)),
                    const SizedBox(height: 8),
                    GooglePlaceAutoCompleteTextField(
                      textEditingController: searchCtrl,
                      googleAPIKey: AppSecrets.googlePlacesApiKey,
                      boxDecoration: const BoxDecoration(),
                      inputDecoration: InputDecoration(
                        hintText: 'Sokak, sehir ara...',
                        hintStyle: TextStyle(color: Colors.grey[500], fontSize: 14),
                        prefixIcon: Icon(Icons.search_rounded, color: hintColor, size: 20),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEA184A), width: 1.5)),
                        filled: true,
                        fillColor: cardBg,
                      ),
                      textStyle: TextStyle(color: textColor, fontSize: 14),
                      debounceTime: 400,
                      countries: const ['de', 'tr', 'at', 'ch'],
                      isLatLngRequired: false,
                      getPlaceDetailWithLatLng: (_) {},
                      itemClick: (prediction) async {
                        // 1. Dropdown'u kapat -- focus'u al
                        FocusScope.of(context).unfocus();
                        // 2. Secilen adresi search alanina yaz
                        searchCtrl.text = prediction.description ?? '';
                        
                        final placeId = prediction.placeId ?? '';
                        if (placeId.isEmpty) return;
                        
                        try {
                          final url = Uri.parse(
                            'https://maps.googleapis.com/maps/api/place/details/json'
                            '?place_id=$placeId'
                            '&fields=address_components'
                            '&key=${AppSecrets.googlePlacesApiKey}',
                          );
                          final response = await http.get(url).timeout(const Duration(seconds: 8));
                          if (response.statusCode != 200) return;
                          
                          final data = json.decode(response.body);
                          final components = data['result']?['address_components'] as List<dynamic>? ?? [];
                          
                          String streetNumber = '';
                          String route = '';
                          String neighborhood = '';
                          String postalCode = '';
                          String locality = '';
                          String adminArea1 = '';
                          String adminArea2 = '';
                          String country = '';
                          
                          for (final comp in components) {
                            final types = List<String>.from(comp['types'] ?? []);
                            final longName = comp['long_name']?.toString() ?? '';
                            if (types.contains('street_number'))                        streetNumber = longName;
                            else if (types.contains('route'))                           route = longName;
                            else if (types.contains('neighborhood') ||
                                     types.contains('sublocality_level_1') ||
                                     types.contains('sublocality'))                     neighborhood = longName;
                            else if (types.contains('postal_code'))                     postalCode = longName;
                            else if (types.contains('locality'))                        locality = longName;
                            else if (types.contains('administrative_area_level_1'))     adminArea1 = longName;
                            else if (types.contains('administrative_area_level_2'))     adminArea2 = longName;
                            else if (types.contains('country'))                         country = longName;
                          }
                          
                          String city;
                          if (country == 'Türkiye' || country == 'Turkey') {
                            city = adminArea1.isNotEmpty ? adminArea1
                                 : adminArea2.isNotEmpty ? adminArea2
                                 : locality;
                            if (neighborhood.isNotEmpty && route.isNotEmpty) {
                              route = '$neighborhood, $route';
                            } else if (neighborhood.isNotEmpty) {
                              route = neighborhood;
                            }
                          } else {
                            city = locality.isNotEmpty ? locality
                                 : adminArea2.isNotEmpty ? adminArea2
                                 : adminArea1;
                          }
                          
                          setFormState(() {
                            streetCtrl.text = route;
                            houseNumCtrl.text = streetNumber;
                            postalCtrl.text = postalCode;
                            cityCtrl.text = city;
                          });
                        } catch (_) {
                          // Fallback: description'dan parse
                          final desc = prediction.description ?? '';
                          final parts = desc.split(',');
                          if (parts.isNotEmpty) {
                            setFormState(() {
                              streetCtrl.text = parts[0].trim();
                              if (parts.length >= 2) {
                                final plzCity = parts[1].trim();
                                final match = RegExp(r'(\d{4,7})\s*(.*)').firstMatch(plzCity);
                                if (match != null) {
                                  postalCtrl.text = match.group(1) ?? '';
                                  cityCtrl.text = match.group(2)?.trim() ?? '';
                                } else {
                                  cityCtrl.text = plzCity;
                                }
                              }
                              if (cityCtrl.text.isEmpty && parts.length >= 3) {
                                cityCtrl.text = parts[parts.length - 2].trim();
                              }
                            });
                          }
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    
                    // Manuel alanlar (autocomplete ile dolan veya manuel girilebilir)
                    Text('veya manuel girin', style: TextStyle(fontSize: 11, color: hintColor)),
                    const SizedBox(height: 8),

                    // Street + House Number
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: _buildFormField(streetCtrl, 'Sokak / Cadde *', Icons.location_on_outlined, isDark, cardBg, textColor, hintColor, borderColor),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 1,
                          child: _buildFormField(houseNumCtrl, 'Nr.', null, isDark, cardBg, textColor, hintColor, borderColor),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Daire / Kat / Kapi No (opsiyonel)
                    _buildFormField(addressLine2Ctrl, 'Daire, Kat, Kapı No (Opsiyonel)', Icons.apartment_outlined, isDark, cardBg, textColor, hintColor, borderColor),
                    const SizedBox(height: 12),

                    // PLZ + City
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildFormField(postalCtrl, 'PLZ *', Icons.local_post_office_outlined, isDark, cardBg, textColor, hintColor, borderColor, keyboardType: TextInputType.number),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 3,
                          child: _buildFormField(cityCtrl, 'Şehir *', Icons.location_city_outlined, isDark, cardBg, textColor, hintColor, borderColor),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    
                    // Save button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: () async {
                          if (streetCtrl.text.trim().isEmpty || cityCtrl.text.trim().isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('profile.street_city_required'.tr()), backgroundColor: Colors.red),
                            );
                            return;
                          }
                          await onSave({
                            'label': labelCtrl.text.trim(),
                            'street': streetCtrl.text.trim(),
                            'houseNumber': houseNumCtrl.text.trim(),
                            'addressLine2': addressLine2Ctrl.text.trim(),
                            'postalCode': postalCtrl.text.trim(),
                            'city': cityCtrl.text.trim(),
                          });
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA184A),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          initialData != null ? 'Güncelle' : 'Kaydet',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
  
  Widget _buildLabelChip(String label, IconData icon, Color color, String selected, Function(String) onTap) {
    final isSelected = selected.toLowerCase() == label.toLowerCase();
    return GestureDetector(
      onTap: () => onTap(label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade400,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isSelected ? color : Colors.grey[500]),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 11, color: isSelected ? color : Colors.grey[600], fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500)),
          ],
        ),
      ),
    );
  }
  
  Widget _buildFormField(TextEditingController controller, String label, IconData? icon, bool isDark, Color cardBg, Color textColor, Color hintColor, Color borderColor, {TextInputType keyboardType = TextInputType.text}) {
    return TextField(
      controller: controller,
      style: TextStyle(color: textColor, fontSize: 14),
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: icon != null ? Icon(icon, color: hintColor, size: 18) : null,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: borderColor)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: borderColor)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFEA184A))),
        filled: true,
        fillColor: cardBg,
        labelStyle: TextStyle(color: hintColor, fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        isDense: true,
      ),
    );
  }

  Widget _buildSectionTitle(String title, Color textColor) {
    return Text(
      title,
      style: TextStyle(
        color: textColor,
        fontSize: 18,
        fontWeight: FontWeight.w600,
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
