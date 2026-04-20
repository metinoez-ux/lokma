import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

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

  Future<void> _initializeVideo() async {
    try {
      _controller = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl));
      
      _controller.addListener(() {
        if (_controller.value.hasError && mounted) {
          if (!_hasError) {
            setState(() {
              _hasError = true;
              _errorMessage = _controller.value.errorDescription ?? 'Bilinmeyen Hata';
            });
          }
        }
      });

      await _controller.initialize();
      await _controller.setVolume(0.0); // Mute for looping background
      await _controller.setLooping(false); // Sadece bir kere oynasin ve dursun
      
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
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
    _controller.dispose();
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
      // Fallback if video fails to load: Give it a red tint so the user knows it's a CODEC/Error issue, not just "black"
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
