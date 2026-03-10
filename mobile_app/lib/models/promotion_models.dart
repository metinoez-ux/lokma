import 'package:cloud_firestore/cloud_firestore.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Promotion Types & Popup Formats
// ─────────────────────────────────────────────────────────────────────────────

enum PromotionType {
  // Klasik İndirim
  percentOff,
  fixedOff,
  freeDelivery,
  buyXGetY,
  minOrderDiscount,
  // Zamanlı & Etkinlik
  happyHour,
  flashSale,
  // Sadakat & Ödül
  loyaltyCard,
  cashback,
  spinWheel,
  // Ürün & Sepet Bazlı
  bundleDeal,
  productDiscount,
  cartBooster,
  // Hedefli & Otomatik
  segmentCampaign,
  firstOrderSurprise,
  pushPromo,
}

enum PopupFormat {
  bottomSheet,
  centerModal,
  topBanner,
  snackbar,
}

// ─────────────────────────────────────────────────────────────────────────────
// Promotion Template (Super Admin creates these)
// ─────────────────────────────────────────────────────────────────────────────

class PromotionTemplate {
  final String id;
  final String name;
  final Map<String, String> nameTranslations;
  final String description;
  final Map<String, String> descriptionTranslations;
  final PromotionType type;
  final String icon;
  final double defaultValue;
  final int defaultDurationDays;
  final String minPlanTier; // 'basic', 'standard', 'premium'
  final List<PopupFormat> allowedPopupFormats;
  final bool isActive;
  final int sortOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const PromotionTemplate({
    required this.id,
    required this.name,
    required this.type,
    this.nameTranslations = const {},
    this.description = '',
    this.descriptionTranslations = const {},
    this.icon = '🎉',
    this.defaultValue = 0,
    this.defaultDurationDays = 7,
    this.minPlanTier = 'basic',
    this.allowedPopupFormats = const [PopupFormat.bottomSheet],
    this.isActive = true,
    this.sortOrder = 0,
    this.createdAt,
    this.updatedAt,
  });

  factory PromotionTemplate.fromFirestore(String id, Map<String, dynamic> data) {
    return PromotionTemplate(
      id: id,
      name: data['name'] as String? ?? '',
      nameTranslations: _parseTranslations(data['nameTranslations']),
      description: data['description'] as String? ?? '',
      descriptionTranslations: _parseTranslations(data['descriptionTranslations']),
      type: _parseType(data['type'] as String?),
      icon: data['icon'] as String? ?? '🎉',
      defaultValue: (data['defaultValue'] as num?)?.toDouble() ?? 0,
      defaultDurationDays: data['defaultDurationDays'] as int? ?? 7,
      minPlanTier: data['minPlanTier'] as String? ?? 'basic',
      allowedPopupFormats: _parseFormats(data['allowedPopupFormats']),
      isActive: data['isActive'] as bool? ?? true,
      sortOrder: data['sortOrder'] as int? ?? 0,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'name': name,
    'nameTranslations': nameTranslations,
    'description': description,
    'descriptionTranslations': descriptionTranslations,
    'type': type.name,
    'icon': icon,
    'defaultValue': defaultValue,
    'defaultDurationDays': defaultDurationDays,
    'minPlanTier': minPlanTier,
    'allowedPopupFormats': allowedPopupFormats.map((f) => f.name).toList(),
    'isActive': isActive,
    'sortOrder': sortOrder,
    'updatedAt': FieldValue.serverTimestamp(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Promotion (Business Admin activates/creates these)
// ─────────────────────────────────────────────────────────────────────────────

class BusinessPromotion {
  final String id;
  final String businessId;
  final String? templateId;
  final PromotionType type;
  final String title;
  final Map<String, String> titleTranslations;
  final String description;
  final Map<String, String> descriptionTranslations;
  final double value;
  final String valueType; // 'fixed' or 'percent'

  // Conditions
  final double? minOrderAmount;
  final int? maxRedemptions;
  final int? perUserLimit;
  final bool newCustomersOnly;
  final List<String> validDeliveryMethods; // ['delivery', 'pickup']
  final List<String> validDays; // ['mon', 'tue', ...]
  final List<String> validCategories; // empty = all
  final List<String> validProducts; // empty = all
  final int? buyX;
  final int? getY;
  final String? targetProductId; // For productDiscount
  final double? cashbackPercent; // For cashback type
  final double? bundlePrice; // For bundleDeal type
  final List<String> bundleProductIds; // For bundleDeal type
  final double? boosterThreshold; // For cartBooster: spend X€
  final String? boosterReward; // For cartBooster: get Y free
  final String? targetSegment; // For segmentCampaign: 'vip', 'new', 'returning'

  // Usage Limits
  final int? dailyLimit; // Max redemptions per day (null = unlimited)
  final int? weeklyLimit; // Max redemptions per week (null = unlimited)
  final int? perUserDailyLimit; // Max per user per day (null = unlimited)
  // Tracking counters (reset by engine or Cloud Function)
  final int dailyRedemptions;
  final int weeklyRedemptions;
  final DateTime? lastDailyReset;
  final DateTime? lastWeeklyReset;

  // Schedule
  final DateTime? validFrom;
  final DateTime? validUntil;
  final String? happyHourStart; // '14:00'
  final String? happyHourEnd;   // '16:00'

  // Display
  final bool showInDiscovery;
  final bool showAsPopup;
  final bool showInStore;
  final String badgeText;
  final String badgeColor;
  final PopupFormat popupFormat;
  final String? popupImageUrl;

  // Stats
  final int impressions;
  final int clicks;
  final int redemptions;
  final double totalDiscountGiven;

  final bool isActive;
  final String? createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const BusinessPromotion({
    required this.id,
    required this.businessId,
    required this.type,
    required this.title,
    this.templateId,
    this.titleTranslations = const {},
    this.description = '',
    this.descriptionTranslations = const {},
    this.value = 0,
    this.valueType = 'fixed',
    this.minOrderAmount,
    this.maxRedemptions,
    this.perUserLimit,
    this.newCustomersOnly = false,
    this.validDeliveryMethods = const ['delivery', 'pickup'],
    this.validDays = const ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    this.validCategories = const [],
    this.validProducts = const [],
    this.buyX,
    this.getY,
    this.targetProductId,
    this.cashbackPercent,
    this.bundlePrice,
    this.bundleProductIds = const [],
    this.boosterThreshold,
    this.boosterReward,
    this.targetSegment,
    this.dailyLimit,
    this.weeklyLimit,
    this.perUserDailyLimit,
    this.dailyRedemptions = 0,
    this.weeklyRedemptions = 0,
    this.lastDailyReset,
    this.lastWeeklyReset,
    this.validFrom,
    this.validUntil,
    this.happyHourStart,
    this.happyHourEnd,
    this.showInDiscovery = true,
    this.showAsPopup = false,
    this.showInStore = true,
    this.badgeText = '',
    this.badgeColor = '#FF6B35',
    this.popupFormat = PopupFormat.bottomSheet,
    this.popupImageUrl,
    this.impressions = 0,
    this.clicks = 0,
    this.redemptions = 0,
    this.totalDiscountGiven = 0,
    this.isActive = true,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
  });

  factory BusinessPromotion.fromFirestore(String id, String businessId, Map<String, dynamic> data) {
    return BusinessPromotion(
      id: id,
      businessId: businessId,
      templateId: data['templateId'] as String?,
      type: _parseType(data['type'] as String?),
      title: data['title'] as String? ?? '',
      titleTranslations: _parseTranslations(data['titleTranslations']),
      description: data['description'] as String? ?? '',
      descriptionTranslations: _parseTranslations(data['descriptionTranslations']),
      value: (data['value'] as num?)?.toDouble() ?? 0,
      valueType: data['valueType'] as String? ?? 'fixed',
      // Conditions
      minOrderAmount: (data['minOrderAmount'] as num?)?.toDouble(),
      // maxRedemptions: explicit limit or plan-based safety fallback
      maxRedemptions: data['maxRedemptions'] as int? ?? data['_safetyMaxRedemptions'] as int?,
      perUserLimit: data['perUserLimit'] as int?,
      newCustomersOnly: data['newCustomersOnly'] as bool? ?? false,
      validDeliveryMethods: List<String>.from(data['validDeliveryMethods'] ?? ['delivery', 'pickup']),
      validDays: List<String>.from(data['validDays'] ?? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      validCategories: List<String>.from(data['validCategories'] ?? []),
      validProducts: List<String>.from(data['validProducts'] ?? []),
      buyX: data['buyX'] as int?,
      getY: data['getY'] as int?,
      targetProductId: data['targetProductId'] as String?,
      cashbackPercent: (data['cashbackPercent'] as num?)?.toDouble(),
      bundlePrice: (data['bundlePrice'] as num?)?.toDouble(),
      bundleProductIds: List<String>.from(data['bundleProductIds'] ?? []),
      boosterThreshold: (data['boosterThreshold'] as num?)?.toDouble(),
      boosterReward: data['boosterReward'] as String?,
      targetSegment: data['targetSegment'] as String?,
      // Usage limits
      // dailyLimit: explicit limit or plan-based safety fallback
      dailyLimit: data['dailyLimit'] as int? ?? data['_safetyDailyLimit'] as int?,
      weeklyLimit: data['weeklyLimit'] as int?,
      perUserDailyLimit: data['perUserDailyLimit'] as int?,
      dailyRedemptions: data['dailyRedemptions'] as int? ?? 0,
      weeklyRedemptions: data['weeklyRedemptions'] as int? ?? 0,
      lastDailyReset: (data['lastDailyReset'] as Timestamp?)?.toDate(),
      lastWeeklyReset: (data['lastWeeklyReset'] as Timestamp?)?.toDate(),
      // Schedule
      validFrom: (data['validFrom'] as Timestamp?)?.toDate(),
      validUntil: (data['validUntil'] as Timestamp?)?.toDate(),
      happyHourStart: data['happyHourStart'] as String?,
      happyHourEnd: data['happyHourEnd'] as String?,
      // Display
      showInDiscovery: data['showInDiscovery'] as bool? ?? true,
      showAsPopup: data['showAsPopup'] as bool? ?? false,
      showInStore: data['showInStore'] as bool? ?? true,
      badgeText: data['badgeText'] as String? ?? '',
      badgeColor: data['badgeColor'] as String? ?? '#FF6B35',
      popupFormat: _parsePopupFormat(data['popupFormat'] as String?),
      popupImageUrl: data['popupImageUrl'] as String?,
      // Stats
      impressions: data['impressions'] as int? ?? 0,
      clicks: data['clicks'] as int? ?? 0,
      redemptions: data['redemptions'] as int? ?? 0,
      totalDiscountGiven: (data['totalDiscountGiven'] as num?)?.toDouble() ?? 0,
      isActive: data['isActive'] as bool? ?? true,
      createdBy: data['createdBy'] as String?,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    if (templateId != null) 'templateId': templateId,
    'type': type.name,
    'title': title,
    'titleTranslations': titleTranslations,
    'description': description,
    'descriptionTranslations': descriptionTranslations,
    'value': value,
    'valueType': valueType,
    'minOrderAmount': minOrderAmount,
    'maxRedemptions': maxRedemptions,
    'perUserLimit': perUserLimit,
    'newCustomersOnly': newCustomersOnly,
    'validDeliveryMethods': validDeliveryMethods,
    'validDays': validDays,
    'validCategories': validCategories,
    'validProducts': validProducts,
    'buyX': buyX,
    'getY': getY,
    'targetProductId': targetProductId,
    'cashbackPercent': cashbackPercent,
    'bundlePrice': bundlePrice,
    'bundleProductIds': bundleProductIds,
    'boosterThreshold': boosterThreshold,
    'boosterReward': boosterReward,
    'targetSegment': targetSegment,
    'dailyLimit': dailyLimit,
    'weeklyLimit': weeklyLimit,
    'perUserDailyLimit': perUserDailyLimit,
    'dailyRedemptions': dailyRedemptions,
    'weeklyRedemptions': weeklyRedemptions,
    'lastDailyReset': lastDailyReset != null ? Timestamp.fromDate(lastDailyReset!) : null,
    'lastWeeklyReset': lastWeeklyReset != null ? Timestamp.fromDate(lastWeeklyReset!) : null,
    'validFrom': validFrom != null ? Timestamp.fromDate(validFrom!) : null,
    'validUntil': validUntil != null ? Timestamp.fromDate(validUntil!) : null,
    'happyHourStart': happyHourStart,
    'happyHourEnd': happyHourEnd,
    'showInDiscovery': showInDiscovery,
    'showAsPopup': showAsPopup,
    'showInStore': showInStore,
    'badgeText': badgeText,
    'badgeColor': badgeColor,
    'popupFormat': popupFormat.name,
    'popupImageUrl': popupImageUrl,
    'impressions': impressions,
    'clicks': clicks,
    'redemptions': redemptions,
    'totalDiscountGiven': totalDiscountGiven,
    'isActive': isActive,
    'createdBy': createdBy,
    'updatedAt': FieldValue.serverTimestamp(),
  };

  /// Whether this promotion is currently valid (date + day + time checks)
  bool get isCurrentlyValid {
    final now = DateTime.now();
    if (validFrom != null && now.isBefore(validFrom!)) return false;
    if (validUntil != null && now.isAfter(validUntil!)) return false;

    // Day of week check
    if (validDays.isNotEmpty) {
      const dayNames = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      final todayName = dayNames[now.weekday - 1];
      if (!validDays.contains(todayName)) return false;
    }

    // Happy hour check
    if (happyHourStart != null && happyHourEnd != null) {
      final parts1 = happyHourStart!.split(':');
      final parts2 = happyHourEnd!.split(':');
      if (parts1.length == 2 && parts2.length == 2) {
        final startMinutes = int.parse(parts1[0]) * 60 + int.parse(parts1[1]);
        final endMinutes = int.parse(parts2[0]) * 60 + int.parse(parts2[1]);
        final nowMinutes = now.hour * 60 + now.minute;
        if (nowMinutes < startMinutes || nowMinutes > endMinutes) return false;
      }
    }

    // Redemption limit check
    if (maxRedemptions != null && redemptions >= maxRedemptions!) return false;

    // Daily limit check (reset if lastDailyReset is not today)
    if (dailyLimit != null) {
      final today = DateTime(now.year, now.month, now.day);
      final isToday = lastDailyReset != null &&
          lastDailyReset!.year == now.year &&
          lastDailyReset!.month == now.month &&
          lastDailyReset!.day == now.day;
      final effectiveDailyCount = isToday ? dailyRedemptions : 0;
      if (effectiveDailyCount >= dailyLimit!) return false;
    }

    // Weekly limit check (reset if lastWeeklyReset is more than 7 days ago)
    if (weeklyLimit != null) {
      final isThisWeek = lastWeeklyReset != null &&
          now.difference(lastWeeklyReset!).inDays < 7;
      final effectiveWeeklyCount = isThisWeek ? weeklyRedemptions : 0;
      if (effectiveWeeklyCount >= weeklyLimit!) return false;
    }

    return isActive;
  }

  /// Human-readable badge text
  String get displayBadge {
    if (badgeText.isNotEmpty) return badgeText;
    switch (type) {
      case PromotionType.percentOff:
        return '%${value.toStringAsFixed(0)} İndirim';
      case PromotionType.fixedOff:
        return '${value.toStringAsFixed(0)}€ İndirim';
      case PromotionType.freeDelivery:
        return 'Ücretsiz Teslimat';
      case PromotionType.buyXGetY:
        return '${buyX ?? 2} Al ${getY ?? 1} Öde';
      case PromotionType.minOrderDiscount:
        return '${minOrderAmount?.toStringAsFixed(0) ?? ''}€+ → ${value.toStringAsFixed(0)}€';
      case PromotionType.happyHour:
        return '⏰ Happy Hour %${value.toStringAsFixed(0)}';
      case PromotionType.flashSale:
        return '⚡ Flash Sale %${value.toStringAsFixed(0)}';
      case PromotionType.loyaltyCard:
        return '🎖 Puan Kartı';
      case PromotionType.cashback:
        return '💸 %${(cashbackPercent ?? value).toStringAsFixed(0)} Cashback';
      case PromotionType.spinWheel:
        return '🎰 Çark Çevir';
      case PromotionType.bundleDeal:
        return '📦 Paket ${bundlePrice?.toStringAsFixed(2) ?? value.toStringAsFixed(2)}€';
      case PromotionType.productDiscount:
        return '🏷️ Ürün İndirimi %${value.toStringAsFixed(0)}';
      case PromotionType.cartBooster:
        return '🛒 ${boosterThreshold?.toStringAsFixed(0) ?? ''}€+ → Hediye';
      case PromotionType.segmentCampaign:
        return '🎯 Özel Kampanya';
      case PromotionType.firstOrderSurprise:
        return '💳 İlk Sipariş Sürprizi';
      case PromotionType.pushPromo:
        return '📲 Özel Fırsat';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

PromotionType _parseType(String? type) {
  switch (type) {
    case 'fixedOff': return PromotionType.fixedOff;
    case 'freeDelivery': return PromotionType.freeDelivery;
    case 'buyXGetY': return PromotionType.buyXGetY;
    case 'minOrderDiscount': return PromotionType.minOrderDiscount;
    case 'happyHour': return PromotionType.happyHour;
    case 'flashSale': return PromotionType.flashSale;
    case 'loyaltyCard': return PromotionType.loyaltyCard;
    case 'cashback': return PromotionType.cashback;
    case 'spinWheel': return PromotionType.spinWheel;
    case 'bundleDeal': return PromotionType.bundleDeal;
    case 'productDiscount': return PromotionType.productDiscount;
    case 'cartBooster': return PromotionType.cartBooster;
    case 'segmentCampaign': return PromotionType.segmentCampaign;
    case 'firstOrderSurprise': return PromotionType.firstOrderSurprise;
    case 'pushPromo': return PromotionType.pushPromo;
    default: return PromotionType.percentOff;
  }
}

PopupFormat _parsePopupFormat(String? fmt) {
  switch (fmt) {
    case 'centerModal': return PopupFormat.centerModal;
    case 'topBanner': return PopupFormat.topBanner;
    case 'snackbar': return PopupFormat.snackbar;
    default: return PopupFormat.bottomSheet;
  }
}

List<PopupFormat> _parseFormats(dynamic data) {
  if (data is List) {
    return data.map((e) => _parsePopupFormat(e as String?)).toList();
  }
  return [PopupFormat.bottomSheet];
}

Map<String, String> _parseTranslations(dynamic data) {
  if (data is Map) {
    return data.map((k, v) => MapEntry(k.toString(), v.toString()));
  }
  return {};
}
