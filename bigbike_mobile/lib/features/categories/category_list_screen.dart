import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/category.dart';
import '../../core/models/common.dart';
import '../../core/widgets/media_image.dart';
import '../../core/widgets/error_view.dart';
import '../../core/theme/app_colors.dart';

class CategoryListScreen extends StatefulWidget {
  const CategoryListScreen({super.key});

  @override
  State<CategoryListScreen> createState() =>
      _CategoryListScreenState();
}

class _CategoryListScreenState
    extends State<CategoryListScreen> {
  PaginatedResponse<Category>? _data;
  bool _loading = true;
  String? _error;
  final int _page = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.categories,
        queryParams: {'page': _page, 'size': 20},
      );
      setState(() {
        _data = PaginatedResponse.fromJson(data, Category.fromJson);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Danh mục')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.2,
                  ),
                  itemCount: _data?.items.length ?? 0,
                  itemBuilder: (ctx, i) {
                    final cat = _data!.items[i];
                    return GestureDetector(
                      onTap: () => ctx.push('/danh-muc-san-pham/${cat.slug}'),
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: Column(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
                                child: MediaImage(src: cat.imageUrl, width: double.infinity, fit: BoxFit.cover),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(8),
                              child: Text(cat.name,
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
