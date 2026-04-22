import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:video_player/video_player.dart';
import '../../../services/video_preload_service.dart';
import '../../../widgets/lokma_network_image.dart'; // Make sure to import this if it's not already

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
    // Senkron olarak _controller'i atiyoruz, boylece build icinde erisilebilir
    _controller = VideoPreloadService.getController(widget.videoUrl);
    _initializeVideo();
    widget.scrollController?.addListener(_scrollListener);
  }

  String get _thumbnailUrl {
    if (widget.videoUrl.contains('?')) {
      final parts = widget.videoUrl.split('?');
      return '${parts[0]}_thumb.jpg?${parts[1]}';
    }
    return '${widget.videoUrl}_thumb.jpg';
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
      _controller.addListener(_videoListener);

      await VideoPreloadService.waitForInitialization(widget.videoUrl);

      // Eger yukleme sirasinda hata olduysa veya hala initialize olamadiysa devam etme!
      if (_controller.value.hasError) {
        throw Exception(_controller.value.errorDescription ?? 'Video yüklenemedi (Bağlantı hatası)');
      }
      if (!_controller.value.isInitialized) {
        throw Exception('Video başlatılamadı. Lütfen internet bağlantınızı kontrol edin.');
      }

      await _controller.setLooping(false);
      await _controller.setVolume(0);
      
      // Videonun her zaman baştan başlamasını garanti et
      if (_controller.value.position != Duration.zero) {
        await _controller.seekTo(Duration.zero);
      }

      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        
        // Frame'in ekrana yansıması için ufak bir gecikme veriyoruz ki "eski kare" zıplaması olmasın
        Future.delayed(const Duration(milliseconds: 50), () {
          if (mounted && _isInitialized && !_wasCollapsed) {
            _controller.play();
          }
        });
      }
    } catch (e) {
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
    // Ancak arka planda calismaya devam etmemesi icin videoyu durdurup basa sariyoruz.
    _controller.pause();
    _controller.seekTo(Duration.zero);
    
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

    // Video is ready or initializing. Show thumbnail behind the video player.
    return GestureDetector(
      onTap: _replayVideo,
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Static Image (Always behind, prevents flicker during transition)
            LokmaNetworkImage(
              imageUrl: _thumbnailUrl,
              fit: widget.fit,
              width: widget.width,
              height: widget.height,
              fadeInDuration: Duration.zero,
              fadeOutDuration: Duration.zero,
              useOldImageOnUrlChange: true,
              placeholder: (_, __) => Container(color: const Color(0xFF1E1E1E)), // Koyu arkaplan, beyaz flash'ı engeller
              errorWidget: (_, __, ___) => Container(color: const Color(0xFF1E1E1E)),
            ),
            
            // 2. Video Player (renders on top once initialized with a smooth fade)
            AnimatedOpacity(
              opacity: _isInitialized ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 300),
              child: _controller.value.isInitialized
                  ? FittedBox(
                      fit: widget.fit,
                      child: SizedBox(
                        width: _controller.value.size.width > 0 ? _controller.value.size.width : 1600,
                        height: _controller.value.size.height > 0 ? _controller.value.size.height : 900,
                        child: VideoPlayer(_controller),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}
