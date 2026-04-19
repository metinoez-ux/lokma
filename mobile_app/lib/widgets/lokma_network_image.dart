import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

// Export the provider so components using it as an ImageProvider don't break
export 'package:cached_network_image/cached_network_image.dart' show CachedNetworkImageProvider;

class LokmaNetworkImage extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double borderRadius;
  final dynamic errorWidget;
  // Drop-in replacement parameters
  final dynamic placeholder;
  final int? memCacheHeight;
  final int? memCacheWidth;
  final int? maxWidthDiskCache;
  final int? maxHeightDiskCache;
  final Duration? fadeInDuration;
  final Duration? fadeOutDuration;
  final bool? useOldImageOnUrlChange;
  final Color? color;
  final BlendMode? colorBlendMode;
  final Alignment alignment;
  final FilterQuality filterQuality;

  const LokmaNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius = 0.0,
    this.errorWidget,
    this.placeholder,
    this.memCacheHeight,
    this.memCacheWidth,
    this.maxWidthDiskCache,
    this.maxHeightDiskCache,
    this.fadeInDuration,
    this.fadeOutDuration,
    this.useOldImageOnUrlChange,
    this.color,
    this.colorBlendMode,
    this.alignment = Alignment.center,
    this.filterQuality = FilterQuality.low,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return _buildErrorPlaceholder();
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: CachedNetworkImage(
        imageUrl: imageUrl,
        width: width,
        height: height,
        fit: fit,
        color: color,
        colorBlendMode: colorBlendMode,
        alignment: alignment,
        filterQuality: filterQuality,
        // Removed dynamic memory scaling defaults which force heavy software resizing on old Android CPUs (causing 30s lags)
        memCacheHeight: memCacheHeight,
        memCacheWidth: memCacheWidth,
        fadeInDuration: fadeInDuration ?? const Duration(milliseconds: 200),
        fadeOutDuration: fadeOutDuration ?? const Duration(milliseconds: 200),
        useOldImageOnUrlChange: useOldImageOnUrlChange ?? true,
        placeholder: (context, url) => placeholder != null ? placeholder(context, url) : _buildShimmerPlaceholder(),
        errorWidget: (context, url, error) => errorWidget != null ? errorWidget(context, url, error) : _buildErrorPlaceholder(),
      ),
    );
  }

  Widget _buildShimmerPlaceholder() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Container(
        width: width ?? double.infinity,
        height: height ?? double.infinity,
        color: Colors.white,
      ),
    );
  }

  Widget _buildErrorPlaceholder() {
    return Container(
      width: width ?? double.infinity,
      height: height ?? double.infinity,
      color: Colors.grey[200],
      child: const Center(
        child: Icon(Icons.image_not_supported, color: Colors.grey, size: 24),
      ),
    );
  }
}
