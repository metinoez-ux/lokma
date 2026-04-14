import 'package:flutter_test/flutter_test.dart';

void main() {
  test('checkIsMarket test', () {
    var d = {
      'type': 'market',
      'types': ['market'],
      'businessType': null,
      'cuisineType': '',
      'category': null,
      'tags': null,
    };
    
    final str = [
      d['type'],
      d['types'],
      d['businessType'],
      d['cuisineType'],
      d['category'],
      d['tags'],
    ].join(' ').toLowerCase();
    
    print('str is: \$str');
    bool isMarket = str.contains('market') || str.contains('markt') || str.contains('bakkal') || str.contains('grocery');
    print('isMarket is: \$isMarket');
    expect(isMarket, true);
  });
}
