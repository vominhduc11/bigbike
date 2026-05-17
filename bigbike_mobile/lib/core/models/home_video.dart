class HomeVideo {
  final String id;
  final String? title;
  final String? videoUrl;
  final String? youtubeId;
  final String? embedUrl;
  final String? autoThumbnailUrl;
  final String? thumbnailUrl;

  const HomeVideo({
    required this.id,
    this.title,
    this.videoUrl,
    this.youtubeId,
    this.embedUrl,
    this.autoThumbnailUrl,
    this.thumbnailUrl,
  });

  String? get playableUrl => embedUrl ?? videoUrl;

  String? get thumbnailSrc {
    if (thumbnailUrl != null && thumbnailUrl!.isNotEmpty) return thumbnailUrl;
    if (youtubeId != null) return 'https://img.youtube.com/vi/$youtubeId/hqdefault.jpg';
    return autoThumbnailUrl;
  }

  factory HomeVideo.fromJson(Map<String, dynamic> j) {
    final thumb = j['thumbnail'];
    final thumbUrl = thumb is Map<String, dynamic> ? thumb['url'] as String? : null;
    return HomeVideo(
      id: j['id']?.toString() ?? '',
      title: j['title'] as String?,
      videoUrl: j['videoUrl'] as String?,
      youtubeId: j['youtubeId'] as String?,
      embedUrl: j['embedUrl'] as String?,
      autoThumbnailUrl: j['autoThumbnailUrl'] as String?,
      thumbnailUrl: thumbUrl,
    );
  }
}
