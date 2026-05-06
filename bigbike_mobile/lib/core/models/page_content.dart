class PageContent {
  final String id;
  final String slug;
  final String title;
  final String? body;
  final String? type;
  final String? updatedAt;

  const PageContent({
    required this.id,
    required this.slug,
    required this.title,
    this.body,
    this.type,
    this.updatedAt,
  });

  factory PageContent.fromJson(Map<String, dynamic> j) => PageContent(
        id: j['id'].toString(),
        slug: j['slug'] as String? ?? '',
        title: j['title'] as String? ?? '',
        body: j['body'] as String?,
        type: j['type'] as String?,
        updatedAt: j['updatedAt'] as String?,
      );
}
