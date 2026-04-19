import 'dart:io';
import 'dart:convert';

void main() {
  final dir = Directory('assets/translations');
  final files = dir.listSync().where((f) => f.path.endsWith('.json'));

  final translations = {
    'tr': {
      'kermes_search_hint': 'Kermes ara: şehir, eyalet, menü...',
      'lezzet_soleni': 'LEZZET ŞÖLENİ',
      'menu_and_order': 'Menü ve Sipariş',
      'kermes_flavor_desc': 'Kebaplar, tatlılar ve sokak lezzetlerini keşfet.',
      'populer': 'POPÜLER'
    },
    'de': {
      'kermes_search_hint': 'Kermes suchen: Stadt, Bundesland, Menü...',
      'lezzet_soleni': 'GESCHMACKS-FEST',
      'menu_and_order': 'Menü & Bestellung',
      'kermes_flavor_desc': 'Entdecke Kebaps, Desserts und Streetfood.',
      'populer': 'BELIEBT'
    },
    'en': {
      'kermes_search_hint': 'Search Kermes: city, state, menu...',
      'lezzet_soleni': 'FLAVOR FESTIVAL',
      'menu_and_order': 'Menu & Order',
      'kermes_flavor_desc': 'Discover kebabs, desserts and street food.',
      'populer': 'POPULAR'
    }
  };

  for (final file in files) {
    if (file is File) {
      final lang = file.uri.pathSegments.last.replaceAll('.json', '');
      final data = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      
      data['kermes'] ??= {};
      final targetTrans = translations[lang] ?? translations['en']!;
      
      targetTrans.forEach((key, value) {
        data['kermes'][key] = value;
      });

      file.writeAsStringSync(jsonEncode(data));
      print('Updated \${file.path}');
    }
  }
}
