void main() {
  var d = {
    'type': 'market',
    'types': ['market'],
    'businessType': null,
    'cuisineType': '',
    'category': null,
    'tags': null,
  };
  
  try {
    final str = [
      d['type'],
      d['types'],
      d['businessType'],
      d['cuisineType'],
      d['category'],
      d['tags'],
    ].join(' ').toLowerCase();
    
    print('str is: $str');
    bool isMarket = str.contains('market');
    print('isMarket: $isMarket');
  } catch (e) {
    print('CRASH: $e');
  }
}
