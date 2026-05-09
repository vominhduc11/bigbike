class ImageAsset {
  final String? url;
  final String? alt;
  final int? width;
  final int? height;
  final String? mimeType;

  const ImageAsset({this.url, this.alt, this.width, this.height, this.mimeType});

  factory ImageAsset.fromJson(Map<String, dynamic> j) => ImageAsset(
        url: j['url'] as String?,
        alt: j['alt'] as String?,
        width: j['width'] as int?,
        height: j['height'] as int?,
        mimeType: j['mimeType'] as String?,
      );
}

class CategorySummary {
  final String id;
  final String slug;
  final String name;
  final ImageAsset? image;
  final ImageAsset? icon;

  const CategorySummary({
    required this.id,
    required this.slug,
    required this.name,
    this.image,
    this.icon,
  });

  String? get imageUrl => image?.url?.isNotEmpty == true ? image!.url : null;

  factory CategorySummary.fromJson(Map<String, dynamic> j) => CategorySummary(
        id: j['id'].toString(),
        slug: j['slug'] as String? ?? '',
        name: j['name'] as String? ?? '',
        image: j['image'] is Map ? ImageAsset.fromJson(j['image'] as Map<String, dynamic>) : null,
        icon: j['icon'] is Map ? ImageAsset.fromJson(j['icon'] as Map<String, dynamic>) : null,
      );
}

class Category extends CategorySummary {
  final String? description;
  final String? parentId;
  final int? sortOrder;
  final bool isVisible;
  final bool showOnHomepage;
  final int? productCount;

  const Category({
    required super.id,
    required super.slug,
    required super.name,
    super.image,
    super.icon,
    this.description,
    this.parentId,
    this.sortOrder,
    this.isVisible = true,
    this.showOnHomepage = false,
    this.productCount,
  });

  factory Category.fromJson(Map<String, dynamic> j) {
    final base = CategorySummary.fromJson(j);
    return Category(
      id: base.id,
      slug: base.slug,
      name: base.name,
      image: base.image,
      icon: base.icon,
      description: j['description'] as String?,
      parentId: j['parentId']?.toString(),
      sortOrder: j['sortOrder'] as int?,
      isVisible: j['isVisible'] as bool? ?? true,
      showOnHomepage: j['showOnHomepage'] as bool? ?? false,
      productCount: j['productCount'] as int?,
    );
  }
}
