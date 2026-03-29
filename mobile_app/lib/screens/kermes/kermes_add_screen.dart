import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lokma_app/widgets/gradient_app_bar.dart';
import 'package:lokma_app/widgets/organization_search_sheet.dart';
import '../../utils/currency_utils.dart';

class KermesAddScreen extends StatefulWidget {
  const KermesAddScreen({super.key});

  @override
  State<KermesAddScreen> createState() => _KermesAddScreenState();
}

class _KermesAddScreenState extends State<KermesAddScreen> {
  final _formKey = GlobalKey<FormState>();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  // Basic Info
  final _cityController = TextEditingController();
  final _titleController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _latitudeController = TextEditingController();
  final _longitudeController = TextEditingController();
  
  // Date & Time
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now().add(const Duration(days: 2));
  TimeOfDay _openingTime = const TimeOfDay(hour: 10, minute: 0);
  TimeOfDay _closingTime = const TimeOfDay(hour: 22, minute: 0);
  
  // Country
  String _selectedCountry = 'Almanya';
  final List<String> _countries = [
    'Almanya', 'Avusturya', 'Hollanda', 'Belçika', 'Fransa', 
    'İsviçre', 'Sırbistan', 'Macaristan', 'Bulgaristan', 'Türkiye'
  ];
  
  // Features
  bool _hasKidsActivities = false;
  bool _hasFamilyTents = false;
  bool _hasShoppingStands = false;
  bool _hasIndoorArea = false;
  bool _hasCreditCardPayment = false;
  bool _hasSleepingAccommodation = false;
  
  // Sponsor seçimi
  String _selectedSponsor = 'tuna'; // 'tuna', 'akdenizToros', 'none'
  
  // Menu Items
  final List<Map<String, dynamic>> _menuItems = [];
  
  // Parking
  final List<Map<String, dynamic>> _parkingItems = [];
  
  // Organization
  Map<String, dynamic>? _selectedOrganization;
  
  bool _isLoading = false;
  bool _isAdmin = false; // ignore: unused_field
  
  @override
  void initState() {
    super.initState();
    _checkAdminStatus();
  }
  
  Future<void> _checkAdminStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('userRole') ?? '';
    setState(() {
      _isAdmin = role == 'super_admin' || role == 'admin_kermes';
    });
  }
  
  @override
  void dispose() {
    _cityController.dispose();
    _titleController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : _endDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate.isBefore(_startDate)) {
            _endDate = _startDate.add(const Duration(days: 2));
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }
  
  Future<void> _selectTime(bool isOpening) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isOpening ? _openingTime : _closingTime,
    );
    if (picked != null) {
      setState(() {
        if (isOpening) {
          _openingTime = picked;
        } else {
          _closingTime = picked;
        }
      });
    }
  }
  
  void _addMenuItem() {
    showDialog(
      context: context,
      builder: (context) {
        final nameController = TextEditingController();
        final priceController = TextEditingController();
        final descController = TextEditingController();
        
        return AlertDialog(
          title: Text(tr('kermes.add_menu_item')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Yemek Adı*'),
                ),
                TextField(
                  controller: priceController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: 'Fiyat (${CurrencyUtils.getCurrencySymbol()})*'),
                ),
                TextField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Açıklama'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(tr('common.cancel')),
            ),
            ElevatedButton(
              onPressed: () {
                if (nameController.text.isNotEmpty && priceController.text.isNotEmpty) {
                  setState(() {
                    _menuItems.add({
                      'name': nameController.text,
                      'price': double.tryParse(priceController.text) ?? 0,
                      'description': descController.text,
                    });
                  });
                  Navigator.pop(context);
                }
              },
              child: Text(tr('common.add')),
            ),
          ],
        );
      },
    );
  }
  
  void _addParkingItem() {
    showDialog(
      context: context,
      builder: (context) {
        final addressController = TextEditingController();
        final descController = TextEditingController();
        
        return AlertDialog(
          title: Text(tr('kermes.add_parking_area')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Açıklama*'),
                ),
                TextField(
                  controller: addressController,
                  decoration: const InputDecoration(labelText: 'Adres*'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(tr('common.cancel')),
            ),
            ElevatedButton(
              onPressed: () {
                if (addressController.text.isNotEmpty && descController.text.isNotEmpty) {
                  setState(() {
                    _parkingItems.add({
                      'address': addressController.text,
                      'description': descController.text,
                    });
                  });
                  Navigator.pop(context);
                }
              },
              child: Text(tr('common.add')),
            ),
          ],
        );
      },
    );
  }
  
  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() => _isLoading = true);
    
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('Giriş yapmalısınız');
      
      final kermesData = {
        'city': _cityController.text,
        'country': _selectedCountry,
        'title': _titleController.text,
        'address': _addressController.text,
        'phoneNumber': _phoneController.text,
        'startDate': Timestamp.fromDate(_startDate),
        'endDate': Timestamp.fromDate(_endDate),
        'latitude': double.tryParse(_latitudeController.text) ?? 0,
        'longitude': double.tryParse(_longitudeController.text) ?? 0,
        'openingTime': '${_openingTime.hour.toString().padLeft(2, '0')}:${_openingTime.minute.toString().padLeft(2, '0')}',
        'closingTime': '${_closingTime.hour.toString().padLeft(2, '0')}:${_closingTime.minute.toString().padLeft(2, '0')}',
        'hasKidsActivities': _hasKidsActivities,
        'hasFamilyTents': _hasFamilyTents,
        'hasShoppingStands': _hasShoppingStands,
        'hasIndoorArea': _hasIndoorArea,
        'hasCreditCardPayment': _hasCreditCardPayment,
        'hasSleepingAccommodation': _hasSleepingAccommodation,
        'sponsor': _selectedSponsor,
        'menu': _menuItems,
        'parking': _parkingItems,
        'createdBy': user.uid,
        'createdAt': FieldValue.serverTimestamp(),
        'status': 'pending', // Admin onayı bekliyor
      };
      
      // Add organization reference if selected
      if (_selectedOrganization != null) {
        kermesData['organizationId'] = _selectedOrganization!['id'];
        kermesData['organizationName'] = _selectedOrganization!['name'];
      }
      
      await _firestore.collection('kermes').add(kermesData);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr('kermes.kermes_added_waiting_approval')),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tr('common.error_e')), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: GradientAppBar(
        title: const Column(
          children: [
            Text('HADEF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w300, letterSpacing: 2)),
            Text(tr('Yeni Kermes Ekle'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Bilgilendirme kartı
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.blue.shade50, Colors.blue.shade100],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: Color(0xFF1976D2)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Kermes bilgilerini eksiksiz doldurun. Eklenen kermes admin onayından sonra yayınlanacaktır.',
                      style: TextStyle(color: Color(0xFF1976D2), fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // BÖLÜM 1: Temel Bilgiler
            _buildSectionHeader('Temel Bilgiler', Icons.info),
            const SizedBox(height: 12),
            
            // Dernek Seç Button
            ElevatedButton.icon(
              onPressed: () async {
                await showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (context) => OrganizationSearchSheet(
                    onSelect: (org) {
                      setState(() {
                        _selectedOrganization = org;
                        // Pre-fill form fields
                        _cityController.text = org['city'] ?? '';
                        _addressController.text = org['address'] ?? '';
                        _titleController.text = '${org['city'] ?? ''} Kermesi';
                        if (org['phone'] != null) {
                          _phoneController.text = org['phone'];
                        }
                      });
                    },
                  ),
                );
              },
              icon: const Text('🕌', style: TextStyle(fontSize: 20)),
              label: Text(tr('kermes.select_association')),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                backgroundColor: Colors.blue[700],
                foregroundColor: Colors.white,
              ),
            ),
            if (_selectedOrganization != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  border: Border.all(color: Colors.blue[300]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Seçilen Dernek:',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _selectedOrganization!['name'] ?? '',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          if (_selectedOrganization!['postalCode'] != null ||
                              _selectedOrganization!['city'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                '📍 ${_selectedOrganization!['postalCode'] ?? ''} ${_selectedOrganization!['city'] ?? ''}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () {
                        setState(() {
                          _selectedOrganization = null;
                        });
                      },
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            
            TextFormField(
              controller: _cityController,
              decoration: const InputDecoration(
                labelText: 'Şehir*',
                hintText: 'örn: Köln, Berlin, Münih',
                prefixIcon: Icon(Icons.location_city),
                border: OutlineInputBorder(),
              ),
              validator: (v) => v?.isEmpty ?? true ? 'Şehir gerekli' : null,
            ),
            const SizedBox(height: 12),
            
            DropdownButtonFormField<String>(
              initialValue: _selectedCountry,
              decoration: const InputDecoration(
                labelText: 'Ülke*',
                prefixIcon: Icon(Icons.flag),
                border: OutlineInputBorder(),
              ),
              items: _countries.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setState(() => _selectedCountry = v!),
            ),
            const SizedBox(height: 12),
            
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Kermes Adı*',
                hintText: 'örn: Köln Büyük Kermesi',
                prefixIcon: Icon(Icons.event),
                border: OutlineInputBorder(),
              ),
              validator: (v) => v?.isEmpty ?? true ? 'Kermes adı gerekli' : null,
            ),
            const SizedBox(height: 12),
            
            TextFormField(
              controller: _addressController,
              decoration: const InputDecoration(
                labelText: 'Adres*',
                hintText: 'Tam adres',
                prefixIcon: Icon(Icons.location_on),
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
              validator: (v) => v?.isEmpty ?? true ? 'Adres gerekli' : null,
            ),
            const SizedBox(height: 12),
            
            TextFormField(
              controller: _phoneController,
              decoration: const InputDecoration(
                labelText: 'Telefon*',
                hintText: '+49 ...',
                prefixIcon: Icon(Icons.phone),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.phone,
              validator: (v) => v?.isEmpty ?? true ? 'Telefon gerekli' : null,
            ),
            
            const SizedBox(height: 24),
            
            // BÖLÜM 2: Konum
            _buildSectionHeader('Konum Koordinatları', Icons.map),
            const SizedBox(height: 12),
            
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _latitudeController,
                    decoration: const InputDecoration(
                      labelText: 'Enlem*',
                      hintText: '50.9375',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    validator: (v) => v?.isEmpty ?? true ? 'Gerekli' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _longitudeController,
                    decoration: const InputDecoration(
                      labelText: 'Boylam*',
                      hintText: '6.9603',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    validator: (v) => v?.isEmpty ?? true ? 'Gerekli' : null,
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 24),
            
            // BÖLÜM 3: Tarih & Saat
            _buildSectionHeader('Tarih & Saat', Icons.calendar_today),
            const SizedBox(height: 12),
            
            Row(
              children: [
                Expanded(
                  child: _buildDateSelector('Başlangıç', _startDate, () => _selectDate(true)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDateSelector('Bitiş', _endDate, () => _selectDate(false)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            Row(
              children: [
                Expanded(
                  child: _buildTimeSelector('Açılış', _openingTime, () => _selectTime(true)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimeSelector('Kapanış', _closingTime, () => _selectTime(false)),
                ),
              ],
            ),
            
            const SizedBox(height: 24),
            
            // BÖLÜM 4: Özellikler
            _buildSectionHeader('Özellikler', Icons.stars),
            const SizedBox(height: 12),
            
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildFeatureChip('Çocuk Aktivitesi', _hasKidsActivities, 
                    (v) => setState(() => _hasKidsActivities = v), Icons.child_care),
                _buildFeatureChip('Aile Çadırı', _hasFamilyTents, 
                    (v) => setState(() => _hasFamilyTents = v), Icons.family_restroom),
                _buildFeatureChip('Alışveriş Standı', _hasShoppingStands, 
                    (v) => setState(() => _hasShoppingStands = v), Icons.shopping_bag),
                _buildFeatureChip('Kapalı Alan', _hasIndoorArea, 
                    (v) => setState(() => _hasIndoorArea = v), Icons.roofing),
                _buildFeatureChip('Kart Geçerli', _hasCreditCardPayment, 
                    (v) => setState(() => _hasCreditCardPayment = v), Icons.credit_card),
                _buildFeatureChip('Dinlenme İmkanı', _hasSleepingAccommodation, 
                    (v) => setState(() => _hasSleepingAccommodation = v), Icons.bed),
              ],
            ),
            
            SizedBox(height: 16),
            
            // Sponsor Seçimi
            DropdownButtonFormField<String>(
              initialValue: _selectedSponsor,
              decoration: InputDecoration(
                labelText: 'Sponsor',
                prefixIcon: Icon(Icons.store),
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(value: 'tuna', child: Row(children: [
                  Text('🇪🇺 ', style: TextStyle(fontSize: 20)),
                  Text(tr('kermes.tuna_meat_europe')),
                ])),
                DropdownMenuItem(value: 'akdenizToros', child: Row(children: [
                  Text('🇹🇷 ', style: TextStyle(fontSize: 20)),
                  Text(tr('kermes.akdeniz_toros_turkey')),
                ])),
                DropdownMenuItem(value: 'none', child: Text(tr('kermes.no_sponsor'))),
              ],
              onChanged: (v) => setState(() => _selectedSponsor = v!),
            ),
            
            const SizedBox(height: 24),
            
            // BÖLÜM 5: Menü
            _buildSectionHeader('Menü', Icons.restaurant_menu),
            const SizedBox(height: 12),
            
            if (_menuItems.isNotEmpty)
              ...List.generate(_menuItems.length, (i) => Card(
                child: ListTile(
                  title: Text(_menuItems[i]['name']),
                  subtitle: Text('${_menuItems[i]['price']}${CurrencyUtils.getCurrencySymbol()}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => setState(() => _menuItems.removeAt(i)),
                  ),
                ),
              )),
            
            OutlinedButton.icon(
              onPressed: _addMenuItem,
              icon: const Icon(Icons.add),
              label: Text(tr('kermes.add_menu_item')),
            ),
            
            const SizedBox(height: 24),
            
            // BÖLÜM 6: Park Alanları
            _buildSectionHeader('Park Alanları', Icons.local_parking),
            const SizedBox(height: 12),
            
            if (_parkingItems.isNotEmpty)
              ...List.generate(_parkingItems.length, (i) => Card(
                child: ListTile(
                  title: Text(_parkingItems[i]['description']),
                  subtitle: Text(_parkingItems[i]['address']),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => setState(() => _parkingItems.removeAt(i)),
                  ),
                ),
              )),
            
            OutlinedButton.icon(
              onPressed: _addParkingItem,
              icon: const Icon(Icons.add),
              label: Text(tr('kermes.add_parking_area')),
            ),
            
            const SizedBox(height: 32),
            
            // Kaydet butonu
            SizedBox(
              height: 54,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _submitForm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1976D2),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.save),
                          SizedBox(width: 8),
                          Text(tr('KERMESİ KAYDET'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                        ],
                      ),
              ),
            ),
            
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
  
  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFF1976D2).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: const Color(0xFF1976D2), size: 20),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Color(0xFF1976D2)),
        ),
      ],
    );
  }
  
  Widget _buildDateSelector(String label, DateTime date, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            Text(
              DateFormat('dd.MM.yyyy').format(date),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildTimeSelector(String label, TimeOfDay time, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            Text(
              '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildFeatureChip(String label, bool value, ValueChanged<bool> onChanged, IconData icon) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: value ? Colors.white : Colors.grey),
          const SizedBox(width: 4),
          Text(label),
        ],
      ),
      selected: value,
      onSelected: onChanged,
      selectedColor: const Color(0xFF1976D2),
      checkmarkColor: Colors.white,
      labelStyle: TextStyle(color: value ? Colors.white : Colors.black87),
    );
  }
}
