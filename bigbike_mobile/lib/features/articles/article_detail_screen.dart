import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/article.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/media_image.dart';
import '../../core/widgets/error_view.dart';
import '../../core/utils/formatters.dart';

class ArticleDetailScreen extends StatefulWidget {
  final String slug;
  const ArticleDetailScreen({super.key, required this.slug});

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  Article? _article;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await ApiClient()
          .get<Map<String, dynamic>>(ApiEndpoints.article(widget.slug));
      final data = raw['data'] as Map<String, dynamic>? ?? raw;
      setState(() {
        _article = Article.fromJson(data);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_article?.title ?? 'Tin tức', overflow: TextOverflow.ellipsis),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _article == null
                  ? const EmptyState(message: 'Không tìm thấy bài viết')
                  : _ArticleContent(article: _article!),
    );
  }
}

class _ArticleContent extends StatelessWidget {
  final Article article;
  const _ArticleContent({required this.article});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (article.coverImage != null)
            MediaImage(
                src: article.coverImage,
                height: 220,
                width: double.infinity,
                fit: BoxFit.cover),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (article.categoryName != null)
                  Text(article.categoryName!,
                      style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(article.title,
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (article.authorName != null)
                      Text(article.authorName!,
                          style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13)),
                    if (article.authorName != null &&
                        article.publishedAt != null)
                      const Text(' · ',
                          style: TextStyle(color: AppColors.textMuted)),
                    if (article.publishedAt != null)
                      Text(formatDate(article.publishedAt),
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(color: AppColors.divider),
                const SizedBox(height: 16),
                if (article.content?.isNotEmpty == true)
                  HtmlWidget(
                    article.content!,
                    textStyle: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 15,
                        height: 1.7),
                  )
                else if (article.excerpt != null)
                  Text(article.excerpt!,
                      style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.7)),
                const SizedBox(height: 32),
                if (article.tags.isNotEmpty) ...[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: article.tags
                        .map((t) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.bgSurfaceRaised,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: AppColors.borderSubtle),
                              ),
                              child: Text('#$t',
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12)),
                            ))
                        .toList(),
                  ),
                  const SizedBox(height: 24),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
