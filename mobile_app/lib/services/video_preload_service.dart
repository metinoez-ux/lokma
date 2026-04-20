import 'package:video_player/video_player.dart';

class VideoPreloadService {
  static final Map<String, VideoPlayerController> _cache = {};
  static final List<String> _order = [];

  static VideoPlayerController getController(String url) {
    if (_cache.containsKey(url)) {
      return _cache[url]!;
    }

    // Yeni controller olustur
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _cache[url] = controller;
    _order.add(url);

    // Arka planda sessizce yuklemeye basla (UI kilitlenmez)
    controller.initialize().catchError((_) {});

    // Hafiza sismemesi icin en fazla 3 videoyu cache'te tutalim
    if (_order.length > 3) {
      final oldestUrl = _order.removeAt(0);
      final oldestController = _cache.remove(oldestUrl);
      oldestController?.dispose();
    }

    return controller;
  }

  /// Tüm cache'i temizle (örneğin bellek uyarısında çağrılabilir)
  static void clearCache() {
    for (final controller in _cache.values) {
      controller.dispose();
    }
    _cache.clear();
    _order.clear();
  }
}
