import 'package:flutter_riverpod/flutter_riverpod.dart';

class BottomNavVisibility extends Notifier<bool> {
  @override
  bool build() => true;

  void setVisible(bool isVisible) {
    state = isVisible;
  }
}

final bottomNavVisibilityProvider = NotifierProvider<BottomNavVisibility, bool>(BottomNavVisibility.new);
