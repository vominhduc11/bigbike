import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/product.dart';
import '../../core/models/common.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/media_image.dart';
import '../../core/widgets/price_text.dart';
import '../../core/widgets/pagination_widget.dart';
import '../../core/theme/app_colors.dart';

class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  PaginatedResponse<ProductSummary>? _data;
  bool _loading = true;
  String? _error;
  int _page = 1;
  static const int _pageSize = 12;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.wishlistProducts,
        queryParams: {'page': _page, 'size': _pageSize},
      );
      setState(() {
        _data = PaginatedResponse.fromJson(data, ProductSummary.fromJson);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _removeFromWishlist(String productId) async {
    try {
      await ApiClient().delete(ApiEndpoints.wishlistItem(productId));
      _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể xoá khỏi yêu thích. Vui lòng thử lại.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sản phẩm yêu thích')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : _data == null || _data!.items.isEmpty
                  ? const _EmptyWishlist()
                  : Column(
                      children: [
                        Expanded(
                          child: GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 0.62,
                            ),
                            itemCount: _data!.items.length,
                            itemBuilder: (ctx, i) => _WishlistCard(
                              product: _data!.items[i],
                              onTap: () =>
                                  ctx.push('/product/${_data!.items[i].slug}'),
                              onRemove: () =>
                                  _removeFromWishlist(_data!.items[i].id),
                            ),
                          ),
                        ),
                        PaginationWidget(
                          currentPage: _data!.page,
                          totalPages: _data!.totalPages,
                          onPageChanged: (p) {
                            setState(() => _page = p);
                            _load();
                          },
                        ),
                      ],
                    ),
    );
  }
}

class _WishlistCard extends StatelessWidget {
  final ProductSummary product;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  const _WishlistCard({
    required this.product,
    required this.onTap,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(10)),
              child: Stack(
                children: [
                  MediaImage(
                    src: product.image,
                    width: double.infinity,
                    height: 150,
                    fit: BoxFit.cover,
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: GestureDetector(
                      onTap: onRemove,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.bgSection.withValues(alpha: 0.88),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.favorite,
                          color: AppColors.primary,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  PriceText(price: product.price, fontSize: 14),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyWishlist extends StatelessWidget {
  const _EmptyWishlist();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.favorite_border,
                color: AppColors.textMuted, size: 72),
            const SizedBox(height: 16),
            const Text(
              'Chưa có sản phẩm yêu thích',
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 16,
                  fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Bấm vào tim trên trang sản phẩm để lưu vào đây.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 14),
            ),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () => context.push('/san-pham'),
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50)),
              child: const Text('Khám phá sản phẩm'),
            ),
          ],
        ),
      ),
    );
  }
}
