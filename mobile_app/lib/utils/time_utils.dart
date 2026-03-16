/// Paylasimli Saat Formati Utility'leri (Dart)
///
/// Admin portal `timeUtils.ts` ile uyumlu.
/// Standart: 24 saat formati, HH:MM (sifir padli)
///
/// Desteklenen girdiler:
/// - "11:30 AM" / "10:00PM" / "1:30 pm" (AM/PM)
/// - "22:00" / "9:30" / "09:30" (24h)
/// - "9.30" / "11.30AM" (nokta seperator)
/// - "9" / "22" (sadece saat, dakika yok)

/// Tek bir saat stringini 24h HH:MM formatina normalize eder.
String normalizeTimeString(String? input) {
  if (input == null || input.trim().isEmpty) return '';

  String s = input.trim().toUpperCase();

  // Noktayi iki noktaya cevir
  s = s.replaceAll('.', ':');

  final isPM = s.contains('PM');
  final isAM = s.contains('AM');

  // AM/PM temizle
  s = s.replaceAll(RegExp(r'\s*(AM|PM)\s*', caseSensitive: false), '').trim();

  // Saat:dakika parcala
  final match = RegExp(r'^(\d{1,2}):?(\d{2})?$').firstMatch(s);
  if (match == null) return input.trim(); // parse edilemezse orijinali dondur

  int hours = int.parse(match.group(1)!);
  final minutes = match.group(2) != null ? int.parse(match.group(2)!) : 0;

  // AM/PM donusumu
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours == 12) hours = 0;

  // Sifir padli format
  return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}';
}
