// Product option models for Lieferando-style customization.
//
// Data structure in Firestore:
//   products/{id}/optionGroups: [
//     { id, name, required, type, minSelect, maxSelect, options: [...] }
//   ]

class ProductOption {
  final String id;
  final String name;
  final double priceModifier;
  final bool defaultSelected;

  const ProductOption({
    required this.id,
    required this.name,
    this.priceModifier = 0.0,
    this.defaultSelected = false,
  });

  factory ProductOption.fromMap(Map<String, dynamic> map) {
    return ProductOption(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      priceModifier: (map['priceModifier'] ?? 0).toDouble(),
      defaultSelected: map['defaultSelected'] ?? false,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'priceModifier': priceModifier,
    'defaultSelected': defaultSelected,
  };
}

class OptionGroup {
  final String id;
  final String name;
  final bool required;
  final String type; // 'radio' or 'checkbox'
  final int minSelect;
  final int maxSelect; // -1 = unlimited
  final List<ProductOption> options;

  const OptionGroup({
    required this.id,
    required this.name,
    this.required = false,
    this.type = 'checkbox',
    this.minSelect = 0,
    this.maxSelect = -1,
    this.options = const [],
  });

  bool get isRadio => type == 'radio';
  bool get isCheckbox => type == 'checkbox';

  factory OptionGroup.fromMap(Map<String, dynamic> map) {
    return OptionGroup(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      required: map['required'] ?? false,
      type: map['type'] ?? 'checkbox',
      minSelect: map['minSelect'] ?? 0,
      maxSelect: map['maxSelect'] ?? -1,
      options: (map['options'] as List<dynamic>?)
          ?.map((o) => ProductOption.fromMap(o as Map<String, dynamic>))
          .toList() ?? [],
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'required': required,
    'type': type,
    'minSelect': minSelect,
    'maxSelect': maxSelect,
    'options': options.map((o) => o.toMap()).toList(),
  };
}

/// Represents a user's selection for one option within a group.
class SelectedOption {
  final String groupId;
  final String groupName;
  final String optionId;
  final String optionName;
  final double priceModifier;

  const SelectedOption({
    required this.groupId,
    required this.groupName,
    required this.optionId,
    required this.optionName,
    this.priceModifier = 0.0,
  });

  Map<String, dynamic> toMap() => {
    'groupId': groupId,
    'groupName': groupName,
    'optionId': optionId,
    'optionName': optionName,
    'priceModifier': priceModifier,
  };

  factory SelectedOption.fromMap(Map<String, dynamic> map) {
    return SelectedOption(
      groupId: map['groupId'] ?? '',
      groupName: map['groupName'] ?? '',
      optionId: map['optionId'] ?? '',
      optionName: map['optionName'] ?? '',
      priceModifier: (map['priceModifier'] ?? 0).toDouble(),
    );
  }
}
