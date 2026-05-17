import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/article.dart';
import '../../core/models/common.dart';
import '../../core/widgets/media_image.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/pagination_widget.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';

class ArticleListScreen extends StatefulWidget {
  const ArticleListScreen({super.key});

  @override
  State<ArticleListScreen> createState() => _ArticleListScreenState();
}

class _ArticleListScreenState extends State<ArticleListScreen> {
  PaginatedResponse<ArticleSummary>? _data;
  bool _loading = true;
  String? _error;
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.articles,
        queryParams: {'page': _page, 'size': 12, 'sort': 'publishedAt:desc'},
      );
      setState(() {
        _data = PaginatedResponse.fromJson(data, ArticleSummary.fromJson);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tin tức')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    Expanded(
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _data?.items.length ?? 0,
                        separatorBuilder: (_, _) => const SizedBox(height: 16),
                        itemBuilder: (ctx, i) => _ArticleCard(article: _data!.items[i]),
                      ),
                    ),
                    if (_data != null)
                      PaginationWidget(
                        currentPage: _data!.page,
                        totalPages: _data!.totalPages,
                        onPageChanged: (p) { setState(() => _page = p); _load(); },
                      ),
                  ],
                ),
    );
  }
}

class _ArticleCard extends StatelessWidget {
  final ArticleSummary article;
  const _ArticleCard({required this.article});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/tin-tuc/${article.slug}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MediaImage(src: article.coverImage, height: 180, width: double.infinity, fit: BoxFit.cover),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (article.categoryName != null)
                    Text(article.categoryName!,
                        style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(article.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w600, height: 1.3)),
                  if (article.excerpt != null) ...[
                    const SizedBox(height: 4),
                    Text(article.excerpt!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                  ],
                  const SizedBox(height: 6),
                  Text(formatDate(article.publishedAt),
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
