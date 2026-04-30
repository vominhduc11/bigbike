import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/slider.dart';
import '../../core/models/product.dart';
import '../../core/models/category.dart';
import '../../core/models/brand.dart';
import '../../core/models/article.dart';
import '../../core/models/common.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/theme/app_colors.dart';
import 'widgets/hero_slider.dart';
import 'widgets/product_horizontal_list.dart';
import 'widgets/category_grid.dart';
import 'widgets/brand_row.dart';
import 'widgets/article_row.dart';

final _homeDataProvider = FutureProvider.autoDispose<_HomeData>((ref) async {
  final client = ApiClient();
  final results = await Future.wait([
    client.get<Map<String, dynamic>>(ApiEndpoints.sliders,
        queryParams: {'location': 'home'}),
    client.get<Map<String, dynamic>>(ApiEndpoints.products,
        queryParams: {'featured': 'true', 'size': '8'}),
    client.get<Map<String, dynamic>>(ApiEndpoints.categories,
        queryParams: {
          'size': '8',
          'sort': 'sortOrder:asc',
          'showOnHomepage': 'true',
        }),
    client.get<Map<String, dynamic>>(ApiEndpoints.brands,
        queryParams: {'size': '12'}),
    client.get<Map<String, dynamic>>(ApiEndpoints.articles,
        queryParams: {'category': 'blog', 'size': '4', 'sort': 'publishedAt:desc'}),
  ]);

  final sliders = (results[0]['data'] as List? ?? results[0]['items'] as List? ?? [])
      .cast<Map<String, dynamic>>()
      .map(AppSlider.fromJson)
      .toList();
  final products = PaginatedResponse.fromJson(
      results[1], ProductSummary.fromJson);
  final categories = PaginatedResponse.fromJson(
      results[2], Category.fromJson);
  final brands = PaginatedResponse.fromJson(
      results[3], BrandSummary.fromJson);
  final articles = PaginatedResponse.fromJson(
      results[4], ArticleSummary.fromJson);

  return _HomeData(
    sliders: sliders,
    products: products.items,
    categories: categories.items,
    brands: brands.items,
    articles: articles.items,
  );
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataAsync = ref.watch(_homeDataProvider);
    final cartCount = ref.watch(cartCountProvider);
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_homeDataProvider.future),
        color: AppColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              floating: true,
              snap: true,
              pinned: false,
              backgroundColor: AppColors.bgSection,
              title: GestureDetector(
                onTap: () => context.push('/tim-kiem'),
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.bgSurfaceRaised,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: const Row(
                    children: [
                      SizedBox(width: 12),
                      Icon(Icons.search, color: AppColors.textMuted, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'Tìm kiếm sản phẩm...',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    IconButton(
                      onPressed: () => context.push('/gio-hang'),
                      icon: const Icon(Icons.shopping_cart_outlined),
                      color: AppColors.textSecondary,
                    ),
                    if (cartCount > 0)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            cartCount > 9 ? '9+' : '$cartCount',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 10,
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                IconButton(
                  onPressed: () => context.push('/lien-he'),
                  icon: const Icon(Icons.phone_outlined),
                  color: AppColors.textSecondary,
                ),
              ],
            ),
            dataAsync.when(
              loading: () => const SliverFillRemaining(
                child: Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primary)),
              ),
              error: (e, _) => SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          color: AppColors.primary, size: 40),
                      const SizedBox(height: 12),
                      Text(
                        'Không tải được dữ liệu',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: () => ref.refresh(_homeDataProvider),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Thử lại'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (data) => SliverList(
                delegate: SliverChildListDelegate([
                  if (data.sliders.isNotEmpty)
                    HeroSlider(sliders: data.sliders),
                  const SizedBox(height: 24),
                  if (data.products.isNotEmpty) ...[
                    _SectionHeader(
                      title: 'Sản phẩm nổi bật',
                      onViewAll: () => context.push('/san-pham'),
                    ),
                    ProductHorizontalList(products: data.products),
                    const SizedBox(height: 24),
                  ],
                  if (data.categories.isNotEmpty) ...[
                    _SectionHeader(
                      title: 'Danh mục',
                      onViewAll: () =>
                          context.push('/danh-muc-san-pham'),
                    ),
                    CategoryGrid(categories: data.categories),
                    const SizedBox(height: 24),
                  ],
                  if (data.brands.isNotEmpty) ...[
                    _SectionHeader(
                      title: 'Thương hiệu',
                      onViewAll: () => context.push('/brands'),
                    ),
                    BrandRow(brands: data.brands),
                    const SizedBox(height: 24),
                  ],
                  if (data.articles.isNotEmpty) ...[
                    _SectionHeader(
                      title: 'Tin tức',
                      onViewAll: () => context.push('/tin-tuc'),
                    ),
                    ArticleRow(articles: data.articles),
                    const SizedBox(height: 24),
                  ],
                  SizedBox(height: 16 + bottomPadding),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onViewAll;
  const _SectionHeader({required this.title, this.onViewAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w600)),
          if (onViewAll != null)
            TextButton(
              onPressed: onViewAll,
              child: const Text('Xem tất cả'),
            ),
        ],
      ),
    );
  }
}

class _HomeData {
  final List<AppSlider> sliders;
  final List<ProductSummary> products;
  final List<Category> categories;
  final List<BrandSummary> brands;
  final List<ArticleSummary> articles;

  const _HomeData({
    required this.sliders,
    required this.products,
    required this.categories,
    required this.brands,
    required this.articles,
  });
}
