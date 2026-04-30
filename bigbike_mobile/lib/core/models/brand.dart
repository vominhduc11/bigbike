class BrandSummary {
  final String id;
  final String slug;
  final String name;
  final String? logo;

  const BrandSummary({
    required this.id,
    required this.slug,
    required this.name,
    this.logo,
  });

  factory BrandSummary.fromJson(Map<String, dynamic> j) => BrandSummary(
        id: j['id'].toString(),
        slug: j['slug'] as String? ?? '',
        name: j['name'] as String? ?? '',
        logo: j['logo'] as String?,
      );
}

class Brand extends BrandSummary {
  final String? description;
  final String? website;

  const Brand({
    required super.id,
    required super.slug,
    required super.name,
    super.logo,
    this.description,
    this.website,
  });

  factory Brand.fromJson(Map<String, dynamic> j) {
    final base = BrandSummary.fromJson(j);
    return Brand(
      id: base.id,
      slug: base.slug,
      name: base.name,
      logo: base.logo,
      description: j['description'] as String?,
      website: j['website'] as String?,
    );
  }
}
