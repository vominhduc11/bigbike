class ArticleSummary {
  final String id;
  final String slug;
  final String title;
  final String? coverImage;
  final String? excerpt;
  final String? publishedAt;
  final String? categoryName;
  final String? authorName;

  const ArticleSummary({
    required this.id,
    required this.slug,
    required this.title,
    this.coverImage,
    this.excerpt,
    this.publishedAt,
    this.categoryName,
    this.authorName,
  });

  factory ArticleSummary.fromJson(Map<String, dynamic> j) => ArticleSummary(
        id: j['id'].toString(),
        slug: j['slug'] as String? ?? '',
        title: j['title'] as String? ?? '',
        coverImage: (j['coverImage'] as Map<String, dynamic>?)?['url'] as String?,
        excerpt: j['excerpt'] as String?,
        publishedAt: j['publishedAt'] as String?,
        categoryName: (j['category'] as Map<String, dynamic>?)?['name']
            as String?,
        authorName: (j['author'] as Map<String, dynamic>?)?['name'] as String?,
      );
}

class Article extends ArticleSummary {
  final String? content;
  final List<String> tags;

  const Article({
    required super.id,
    required super.slug,
    required super.title,
    super.coverImage,
    super.excerpt,
    super.publishedAt,
    super.categoryName,
    super.authorName,
    this.content,
    required this.tags,
  });

  factory Article.fromJson(Map<String, dynamic> j) {
    final base = ArticleSummary.fromJson(j);
    return Article(
      id: base.id,
      slug: base.slug,
      title: base.title,
      coverImage: base.coverImage,
      excerpt: base.excerpt,
      publishedAt: base.publishedAt,
      categoryName: base.categoryName,
      authorName: base.authorName,
      content: j['body'] as String?,
      tags: (j['tags'] as List? ?? []).cast<String>(),
    );
  }
}
