class AppSlider {
  final String id;
  final String? title;
  final String? imageDesktop;
  final String? imageMobile;
  final String? linkUrl;
  final int sortOrder;

  const AppSlider({
    required this.id,
    this.title,
    this.imageDesktop,
    this.imageMobile,
    this.linkUrl,
    this.sortOrder = 0,
  });

  String? get image => imageMobile ?? imageDesktop;

  factory AppSlider.fromJson(Map<String, dynamic> j) {
    final desktop = j['desktopImage'];
    final mobile = j['mobileImage'];
    return AppSlider(
      id: j['id'].toString(),
      title: j['title'] as String?,
      imageDesktop: _imageUrl(desktop) ?? j['imageDesktop'] as String? ?? j['image'] as String?,
      imageMobile: _imageUrl(mobile) ?? j['imageMobile'] as String?,
      linkUrl: j['link'] as String?
          ?? j['productLink'] as String?
          ?? j['externalLink'] as String?
          ?? j['linkUrl'] as String?,
      sortOrder: j['sortOrder'] as int? ?? 0,
    );
  }

  static String? _imageUrl(dynamic image) {
    if (image is Map<String, dynamic>) {
      final url = image['url'];
      return url is String ? url : null;
    }
    return null;
  }
}
