import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:video_player/video_player.dart';
import '../../../services/video_preload_service.dart';

class KermesVideoHeader extends StatefulWidget {
  final String videoUrl;
  final double height;
  final double width;
  final BoxFit fit;
  final ScrollController? scrollController;

  const KermesVideoHeader({
    Key? key,
    required this.videoUrl,
    this.height = double.infinity,
    this.width = double.infinity,
    this.fit = BoxFit.cover,
    this.scrollController,
  }) : super(key: key);

  @override
  State<KermesVideoHeader> createState() => _KermesVideoHeaderState();
}

class _KermesVideoHeaderState extends State<KermesVideoHeader> {
  late VideoPlayerController _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  bool _wasCollapsed = false;

  @override
  void initState() {
    super.initState();
    _initializeVideo();
    widget.scrollController?.addListener(_scrollListener);
  }

  void _scrollListener() {
    if (widget.scrollController != null && widget.scrollController!.hasClients) {
      final offset = widget.scrollController!.offset;
      // 400px civari kaydirinca video ekrandan cikar
      if (offset > 400 && !_wasCollapsed) {
        _wasCollapsed = true;
        if (_isInitialized) _controller.pause();
      } else if (offset <= 400 && _wasCollapsed) {
        _wasCollapsed = false;
        if (_isInitialized) _replayVideo();
      }
    }
  }

  void _videoListener() {
    if (_controller.value.hasError && mounted) {
      if (!_hasError) {
        setState(() {
          _hasError = true;
          _errorMessage = _controller.value.errorDescription ?? 'Bilinmeyen Hata';
        });
      }
    }
  }

  Future<void> _initializeVideo() async {
    try {
      _controller = VideoPreloadService.getController(widget.videoUrl);
      _controller.addListener(_videoListener);

      await VideoPreloadService.waitForInitialization(widget.videoUrl);

      // Eger yukleme sirasinda hata olduysa veya hala initialize olamadiysa devam etme!
      // Diger turlu setVolume veya play() metodlari platform kanalini cokertebilir (StateError firlatir).
      if (_controller.value.hasError) {
        throw Exception(_controller.value.errorDescription ?? 'Video yüklenemedi (Bağlantı hatası)');
      }
      if (!_controller.value.isInitialized) {
        throw Exception('Video başlatılamadı. Lütfen internet bağlantınızı kontrol edin.');
      }

      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        await _controller.setLooping(false);
        await _controller.setVolume(0);
        await _controller.seekTo(Duration.zero);
        await _controller.play(); // Ilk baslangicta oynat!
      }
    } catch (e) {
      // Hata firlatildiginda catch et!
      if (mounted) {
        setState(() {
          _hasError = true;
          if (e.toString().contains('StateError') || e.toString().contains('Future already completed')) {
            _errorMessage = 'Medya oynatıcı geçici bir hata verdi. Lütfen sayfayı yenileyin.';
          } else {
            _errorMessage = e.toString().replaceAll('Exception: ', '');
          }
        });
      }
    }
  }

  @override
  void dispose() {
    widget.scrollController?.removeListener(_scrollListener);
    _controller.removeListener(_videoListener);
    // NOT: _controller.dispose() ISLEMINI BURADA YAPMIYORUZ! 
    // VideoPreloadService on bellegi yonettigi icin, temizligi o yapacak.
    super.dispose();
  }

  void _replayVideo() {
    if (_isInitialized && !_hasError) {
      _controller.seekTo(Duration.zero);
      _controller.play();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      // Fallback if video fails to load
      return Container(
        width: widget.width,
        height: widget.height,
        color: Colors.red.shade900.withOpacity(0.8),
        padding: const EdgeInsets.all(16),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 40),
              const SizedBox(height: 8),
              const Text(
                'Video Açılamadı',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                _errorMessage ?? 'Desteklenmeyen AI formatı veya bağlantı koptu.',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    if (!_isInitialized) {
      return Container(
        width: widget.width,
        height: widget.height,
        color: const Color(0xFF1E1E1E), // Dark grey loading
        child: const Center(
          child: CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
        ),
      );
    }

    // Video is ready
    final vWidth = _controller.value.size.width;
    final vHeight = _controller.value.size.height;
    
    return GestureDetector(
      onTap: _replayVideo,
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: FittedBox(
          fit: widget.fit,
          child: SizedBox(
            width: vWidth > 0 ? vWidth : 1600,
            height: vHeight > 0 ? vHeight : 900,
            child: VideoPlayer(_controller),
          ),
        ),
      ),
    );
  }
}
