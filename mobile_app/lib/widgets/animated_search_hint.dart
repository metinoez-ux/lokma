import 'dart:async';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

class AnimatedSearchHint extends StatefulWidget {
  final String? segment; // Optional segment to customize terms if needed

  const AnimatedSearchHint({Key? key, this.segment}) : super(key: key);

  @override
  State<AnimatedSearchHint> createState() => _AnimatedSearchHintState();
}

class _AnimatedSearchHintState extends State<AnimatedSearchHint> {
  int _currentIndex = 0;
  Timer? _timer;

  Map<String, String> get _prefixes => {
    'de': 'Du suchst ',
    'tr': 'Aradığın ',
    'en': 'You search for ',
    'nl': 'Je zoekt ',
    'fr': 'Vous cherchez ',
    'it': 'Cerchi ',
    'es': 'Buscas ',
  };

  List<String> _getTerms(String? segment, String lang) {
    if (segment == 'market') {
      final map = {
        'de': ['Artikel?', 'Lebensmittel?', 'Bäckereien?', 'Floristen?', 'World Foods?'],
        'tr': ['Ürünler?', 'Gıda?', 'Fırınlar?', 'Çiçekçiler?', 'Dünya Lezzetleri?'],
        'en': ['Items?', 'Groceries?', 'Bakeries?', 'Florists?', 'World Foods?'],
        'nl': ['Artikelen?', 'Levensmiddelen?', 'Bakkerijen?', 'Bloemisten?', 'Wereldse smaken?'],
        'fr': ['Articles?', 'Épicerie?', 'Boulangeries?', 'Fleuristes?', 'Saveurs du monde?'],
        'it': ['Articoli?', 'Generi alimentari?', 'Panetterie?', 'Fioristi?', 'Sapori dal mondo?'],
        'es': ['¿Artículos?', '¿Comestibles?', '¿Panaderías?', '¿Floristerías?', '¿Sabores del mundo?'],
      };
      return map[lang] ?? map['de']!;
    } else if (segment == 'kermes') {
      final map = {
        'de': ['Wohltätigkeitsbasar?', 'Stadt?', 'Spezialitäten?', 'Lebensmittel?'],
        'tr': ['Kermes?', 'Şehir?', 'Özel Lezzetler?', 'Gıda?'],
        'en': ['Charity Bazaar?', 'City?', 'Special Tastes?', 'Groceries?'],
        'nl': ['Liefdadigheidsbazaar?', 'Stad?', 'Specialiteiten?', 'Levensmiddelen?'],
        'fr': ['Bazar de charité?', 'Ville?', 'Spécialités?', 'Épicerie?'],
        'it': ['Mercatino di beneficenza?', 'Città?', 'Specialità?', 'Generi alimentari?'],
        'es': ['¿Bazar benéfico?', '¿Ciudad?', '¿Especialidades?', '¿Comestibles?'],
      };
      return map[lang] ?? map['de']!;
    } else {
      // Default to 'yemek' or generic
      final map = {
        'de': ['Kategorien?', 'Artikel?', 'Restaurants?', 'Lebensmittel?'],
        'tr': ['Kategoriler?', 'Ürünler?', 'Restoranlar?', 'Gıda?'],
        'en': ['Categories?', 'Items?', 'Restaurants?', 'Groceries?'],
        'nl': ['Categorieën?', 'Artikelen?', 'Restaurants?', 'Boodschappen?'],
        'fr': ['Catégories?', 'Articles?', 'Restaurants?', 'Épicerie?'],
        'it': ['Categorie?', 'Articoli?', 'Ristoranti?', 'Generi alimentari?'],
        'es': ['¿Categorías?', '¿Artículos?', '¿Restaurantes?', '¿Comestibles?'],
      };
      return map[lang] ?? map['de']!;
    }
  }

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (mounted) {
        setState(() {
          _currentIndex++;
        });
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.locale.languageCode;
    final prefix = _prefixes[lang] ?? _prefixes['de']!;
    final terms = _getTerms(widget.segment, lang);
    final currentTerm = terms[_currentIndex % terms.length];

    final textStyle = TextStyle(
      color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[700],
      fontSize: 15,
      fontWeight: FontWeight.w500,
    );

    return Row(
      children: [
        Text(
          prefix,
          style: textStyle,
        ),
        Expanded(
          child: ClipRect(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 500),
              transitionBuilder: (Widget child, Animation<double> animation) {
                final isIncoming = child.key == ValueKey<String>(currentTerm);
                final offsetAnimation = Tween<Offset>(
                  begin: isIncoming ? const Offset(0.0, 1.0) : const Offset(0.0, -1.0),
                  end: Offset.zero,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeInOut,
                ));
                
                return SlideTransition(
                  position: offsetAnimation,
                  child: child,
                );
              },
              layoutBuilder: (Widget? currentChild, List<Widget> previousChildren) {
                return Stack(
                  alignment: Alignment.centerLeft,
                  children: <Widget>[
                    ...previousChildren,
                    if (currentChild != null) currentChild,
                  ],
                );
              },
              child: Align(
                key: ValueKey<String>(currentTerm),
                alignment: Alignment.centerLeft,
                child: Text(
                  currentTerm,
                  style: textStyle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
