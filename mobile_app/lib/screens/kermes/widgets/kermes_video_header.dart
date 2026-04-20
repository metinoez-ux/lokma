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

  @override
  void initState() {
    super.initState();
    _initializeVideo();
  }

  Future<void> _initializeVideo() async {
    try {
      _controller = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl));
      await _controller.initialize();
      await _controller.setVolume(0.0); // Mute for looping background
      await _controller.setLooping(true); // Loop forever
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        await _controller.play();
      }
    } catch (e) {
      debugPrint('Error initializing video header: $e');
      if (mounted) {
        setState(() => _hasError = true);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      // Fallback if video fails to load
      return Container(
        width: widget.width,
        height: widget.height,
        color: Colors.grey.shade900,
        child: const Center(
          child: Icon(Icons.error_outline, color: Colors.white54, size: 40),
        ),
      );
    }

    if (!_isInitialized) {
      return Container(
        width: widget.width,
        height: widget.height,
        color: Colors.grey.shade900,
        child: const Center(
          child: CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
        ),
      );
    }

    // Video is ready
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: FittedBox(
        fit: widget.fit,
        child: SizedBox(
          width: _controller.value.size.width,
          height: _controller.value.size.height,
          child: VideoPlayer(_controller),
        ),
      ),
    );
  }
}
