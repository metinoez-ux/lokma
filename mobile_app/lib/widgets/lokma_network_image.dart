import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:flutter_svg/flutter_svg.dart';

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

    Widget imageWidget;
    
    // Check if the image is an SVG
    final isSvg = imageUrl.toLowerCase().split('?').first.endsWith('.svg');
    
    if (isSvg) {
      imageWidget = SvgPicture.network(
        imageUrl,
        width: width,
        height: height,
        fit: fit,
        alignment: alignment,
        colorFilter: color != null 
            ? ColorFilter.mode(color!, colorBlendMode ?? BlendMode.srcIn)
            : null,
        placeholderBuilder: (context) => placeholder != null 
            ? placeholder(context, imageUrl) 
            : _buildShimmerPlaceholder(),
      );
      
      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: imageWidget,
      );
    } else {
      int? finalMemCacheWidth = memCacheWidth;
      int? finalMemCacheHeight = memCacheHeight;

      if (finalMemCacheWidth == null && finalMemCacheHeight == null) {
        // Safe multiplier to ensure crisp images while avoiding OOM
        // We use a fixed scale (like 2.0) if devicePixelRatio isn't easily accessible
        // without LayoutBuilder. Since we have context, we can use MediaQuery if available,
        // but to avoid depending on layout rebuilds or context availability issues,
        // a static multiplier of 2.0 works perfectly for most modern devices.
        const double dpr = 2.0;

        if (width != null && width! > 0 && width! < double.infinity) {
          finalMemCacheWidth = (width! * dpr).toInt();
        } else if (height != null && height! > 0 && height! < double.infinity) {
          finalMemCacheHeight = (height! * dpr).toInt();
        } else {
          // Fallback for list items without explicit size. 
          // 800 is a safe upper bound for most cards without explicit dimensions.
          finalMemCacheHeight = 800;
        }
      }

      imageWidget = CachedNetworkImage(
        imageUrl: imageUrl,
        width: width,
        height: height,
        fit: fit,
        color: color,
        colorBlendMode: colorBlendMode,
        alignment: alignment,
        filterQuality: filterQuality,
        memCacheHeight: finalMemCacheHeight,
        memCacheWidth: finalMemCacheWidth,
        fadeInDuration: fadeInDuration ?? const Duration(milliseconds: 200),
        fadeOutDuration: fadeOutDuration ?? const Duration(milliseconds: 200),
        useOldImageOnUrlChange: useOldImageOnUrlChange ?? true,
        placeholder: (context, url) => placeholder != null ? placeholder(context, url) : _buildShimmerPlaceholder(),
        errorWidget: (context, url, error) => errorWidget != null ? errorWidget(context, url, error) : _buildErrorPlaceholder(),
      );

      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: imageWidget,
      );
    }
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
