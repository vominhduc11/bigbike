import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../theme/app_colors.dart';

class MediaImage extends StatelessWidget {
  final String? src;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? placeholder;
  final Widget? errorWidget;

  const MediaImage({
    super.key,
    required this.src,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
    this.errorWidget,
  });

  String _resolve(String src) {
    if (src.startsWith('http')) return src;
    // Relative /media/… URLs are resolved against the web server which proxies to MinIO.
    return '${AppConfig.mediaBaseUrl}$src';
  }

  @override
  Widget build(BuildContext context) {
    final url = src != null && src!.isNotEmpty ? _resolve(src!) : null;

    final loadingWidget = placeholder ??
        Container(
          color: AppColors.bgSurfaceRaised,
          child: const Center(
            child: Icon(Icons.image_outlined,
                color: AppColors.textMuted, size: 32),
          ),
        );

    final errorView = errorWidget ??
        Container(
          color: AppColors.bgSurfaceRaised,
          child: const Center(
            child: Icon(Icons.broken_image_outlined,
                color: AppColors.textMuted, size: 32),
          ),
        );

    Widget img;
    if (url == null) {
      img = loadingWidget;
    } else {
      // memCacheWidth/Height cap the decoded bitmap size to the logical render size,
      // keeping memory proportional to display pixels rather than full image resolution.
      final pixelRatio = MediaQuery.maybeDevicePixelRatioOf(context) ?? 1.0;
      final memW = width != null ? (width! * pixelRatio).ceil() : null;
      final memH = height != null ? (height! * pixelRatio).ceil() : null;

      img = CachedNetworkImage(
        imageUrl: url,
        fit: fit,
        width: width,
        height: height,
        memCacheWidth: memW,
        memCacheHeight: memH,
        placeholder: (_, _) => loadingWidget,
        errorWidget: (_, _, _) => errorView,
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: img);
    }
    return img;
  }
}
