import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/category.dart';
import '../../core/models/common.dart';
import '../../core/widgets/media_image.dart';
import '../../core/widgets/error_view.dart';
import '../../core/theme/app_colors.dart';
import '../products/product_list_screen.dart';

class CategoryDetailScreen extends StatefulWidget {
  final String slug;
  const CategoryDetailScreen({super.key, required this.slug});

  @override
  State<CategoryDetailScreen> createState() => _CategoryDetailScreenState();
}

class _CategoryDetailScreenState extends State<CategoryDetailScreen> {
  Category? _category;
  List<Category> _subCategories = [];
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
      final results = await Future.wait([
        ApiClient().get<Map<String, dynamic>>(ApiEndpoints.category(widget.slug)),
        ApiClient().get<Map<String, dynamic>>(ApiEndpoints.categories,
            queryParams: {'size': 100, 'sort': 'sortOrder:asc'}),
      ]);

      final catData = results[0]['data'];
      final category = catData is Map<String, dynamic> ? Category.fromJson(catData) : null;

      final allCats = PaginatedResponse.fromJson(results[1], Category.fromJson);
      final subCats = category == null
          ? <Category>[]
          : allCats.items.where((c) => c.parentId == category.id && c.isVisible).toList();

      setState(() {
        _category = category;
        _subCategories = subCats;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.bgPage,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.bgPage,
        body: ErrorView(message: _error!, onRetry: _load),
      );
    }

    final category = _category;
    if (category == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Danh mục')),
        body: const Center(child: Text('Không tìm thấy danh mục')),
      );
    }

    final heroUrl = category.imageUrl;
    final plainDesc = category.description
        ?.replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll(RegExp(r'\s{2,}'), ' ')
        .trim();

    return Scaffold(
      backgroundColor: AppColors.bgPage,
      body: NestedScrollView(
        headerSliverBuilder: (context, _) => [
          SliverAppBar(
            expandedHeight: heroUrl != null ? 220 : 80,
            pinned: true,
            backgroundColor: AppColors.bgSection,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                category.name,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              background: heroUrl != null
                  ? Stack(fit: StackFit.expand, children: [
                      MediaImage(src: heroUrl, fit: BoxFit.cover),
                      Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Colors.black54],
                          ),
                        ),
                      ),
                    ])
                  : Container(color: AppColors.bgSection),
            ),
          ),
        ],
        body: CustomScrollView(
          slivers: [
            if (plainDesc != null && plainDesc.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Text(
                    plainDesc,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ),
              ),
            if (_subCategories.isNotEmpty) ...[
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 20, 16, 8),
                  child: Text(
                    'Danh mục con',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 40,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _subCategories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (ctx, i) {
                      final sub = _subCategories[i];
                      return GestureDetector(
                        onTap: () => ctx.push('/danh-muc-san-pham/${sub.slug}'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.bgSurface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: Text(
                            sub.name,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
            SliverFillRemaining(
              child: ProductListScreen(
                categorySlug: widget.slug,
                key: ValueKey(widget.slug),
                embedded: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
