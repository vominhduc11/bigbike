import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/article.dart';
import '../../../core/widgets/media_image.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/theme/app_colors.dart';

class ArticleRow extends StatelessWidget {
  final List<ArticleSummary> articles;
  const ArticleRow({super.key, required this.articles});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: articles.length,
      separatorBuilder: (_, __) =>
          const Divider(height: 1, color: AppColors.divider),
      itemBuilder: (context, i) => _ArticleItem(article: articles[i]),
    );
  }
}

class _ArticleItem extends StatelessWidget {
  final ArticleSummary article;
  const _ArticleItem({required this.article});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/tin-tuc/${article.slug}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: MediaImage(
                src: article.coverImage,
                width: 80,
                height: 60,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatDate(article.publishedAt),
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
