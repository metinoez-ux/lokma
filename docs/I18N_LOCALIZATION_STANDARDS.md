# MIRA & LOKMA Internationalization (i18n) Standards

## Core Principles

In order to support a global user base, LOKMA & MIRA architectures must handle both **Static UI translation** and **Dynamic Database translation**.

### 1. The "Zero Hardcode" Rule (Static UI)

Never hardcode a user-facing string in the UI components. Every text element MUST use translation keys from the locale JSONs.

- **Flutter**: Use `easy_localization` and `tr()` extension (e.g., `Text('cart.checkout'.tr())`).
- **Next.js (Admin Portal)**: Use `next-intl` (e.g., `t('checkout')`).

### 2. The "Dynamic Data Map" Rule (Firestore)

Any new Firestore field that contains human-readable text created by users/merchants (e.g., product names, descriptions, announcements, categories, etc.) MUST be structured as a localized Map instead of a primitive string.

- **Correct**: `"name": { "tr": "Elma", "en": "Apple", "de": "Apfel" }`
- **Incorrect**: `"name": "Elma"`

### 3. The "Graceful Fallback" Rule

Every dynamic UI element and static translation must have a fallback safety net. If a requested language key is missing from the database or translation file, it MUST seamlessly fall back to Turkish (`tr`) rather than showing a blank space or an error.

---

## Technical Implementations

### Dynamic Content Parsing (Flutter)

When reading dynamic Maps from Firestore in Flutter, use a global helper function like `getLocalizedText`.

```dart
String getLocalizedText(Map<String, dynamic>? textMap, String currentLocale) {
  if (textMap == null || textMap.isEmpty) return '';
  
  // Try to find the exact locale
  if (textMap.containsKey(currentLocale) && textMap[currentLocale].toString().isNotEmpty) {
    return textMap[currentLocale].toString();
  }
  
  // Fallback to Turkish
  if (textMap.containsKey('tr') && textMap['tr'].toString().isNotEmpty) {
    return textMap['tr'].toString();
  }
  
  // Ultimate fallback to first available key
  return textMap.values.first.toString();
}
```

### Next.js Admin Forms

For creating/editing entities, the Admin Panel must present tabbed inputs (Turkish | English | German) corresponding to the underlying Map structure, ensuring backend consistency without complicating the UI for standard tasks.

## Supported Locales Strategy

1. **Primary**: `tr` (Turkish) - Always the core fallback language.
2. **Expansion Track 1**: `en` (English), `de` (German).
3. **Future Expansions**: `fr` (French), `es` (Spanish) can be added simply by inserting new keys with zero database schema migrations required.
