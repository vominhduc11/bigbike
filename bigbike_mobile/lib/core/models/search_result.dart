import 'product.dart';
import 'article.dart';

class SearchResults {
  final String query;
  final List<ProductSummary> products;
  final List<ArticleSummary> articles;

  const SearchResults({
    required this.query,
    required this.products,
    required this.articles,
  });

  bool get isEmpty => products.isEmpty && articles.isEmpty;

  factory SearchResults.fromJson(Map<String, dynamic> j) => SearchResults(
        query: j['query'] as String? ?? '',
        products: (j['products'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(ProductSummary.fromJson)
            .toList(),
        articles: (j['articles'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(ArticleSummary.fromJson)
            .toList(),
      );
}
