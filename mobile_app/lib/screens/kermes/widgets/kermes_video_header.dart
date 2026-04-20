import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../services/video_preload_service.dart';

class KermesVideoHeader extends StatefulWidget {
  final String videoUrl;
  final double height;
  final double width;
  final BoxFit fit;

  const KermesVideoHeader({
    Key? key,
    required this.videoUrl,
    this.height = double.infinity,
    this.width = double.infinity,
    this.fit = BoxFit.cover,
  }) : super(key: key);

  @override
  State<KermesVideoHeader> createState() => _KermesVideoHeaderState();
}

class _KermesVideoHeaderState extends State<KermesVideoHeader> {
  late VideoPlayerController _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initializeVideo();
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
      // Servis üzerinden controller al. Önceden başlatılmış olabilir!
      _controller = VideoPreloadService.getController(widget.videoUrl);
      
      _controller.addListener(_videoListener);

      // Çifte initialize çağırmamak için servisteki başlatma işlemini beklet
      await VideoPreloadService.waitForInitialization(widget.videoUrl);
      
      await _controller.setVolume(0.0); // Mute for looping background
      await _controller.setLooping(false); // Sadece bir kere oynasin ve dursun
      
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        
        // Video'nun basina sar ve oynat. (Ekrandan cikip girince veya ilk acilista)
        await _controller.seekTo(Duration.zero);
        await _controller.play();
      }
    } catch (e) {
      debugPrint('Error initializing video header: $e');
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = e.toString();
        });
      }
    }
  }

  @override
  void dispose() {
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

  bool _wasCollapsed = false;

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
    
    return LayoutBuilder(
      builder: (context, constraints) {
        // Eğer maxHeight 100'ün altındaysa (SliverAppBar kapandıysa) durumu kaydet.
        // Tekrar 100'ün üzerine çıkarsa (açılırsa), videoyu baştan oynat.
        if (constraints.maxHeight <= 100) {
          _wasCollapsed = true;
        } else if (_wasCollapsed && constraints.maxHeight > 100) {
          _wasCollapsed = false;
          // Asenkron triggerla
          Future.microtask(() => _replayVideo());
        }

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
    );
  }
}
