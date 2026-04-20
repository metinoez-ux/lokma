import 'package:video_player/video_player.dart';

class VideoPreloadService {
  static final Map<String, VideoPlayerController> _cache = {};
  static final Map<String, Future<void>> _initFutures = {};
  static final List<String> _order = [];

  static VideoPlayerController getController(String url) {
    if (_cache.containsKey(url)) {
      return _cache[url]!;
    }

    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _cache[url] = controller;
    _order.add(url);

    // Başlatma işlemini asenkron olarak kaydet
    _initFutures[url] = controller.initialize().catchError((_) {});

    if (_order.length > 3) {
      final oldestUrl = _order.removeAt(0);
      final oldestController = _cache.remove(oldestUrl);
      _initFutures.remove(oldestUrl);
      oldestController?.dispose();
    }

    return controller;
  }

  static Future<void> waitForInitialization(String url) async {
    if (_initFutures.containsKey(url)) {
      await _initFutures[url];
    }
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
