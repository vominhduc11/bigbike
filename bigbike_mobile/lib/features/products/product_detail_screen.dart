import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/product.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/widgets/price_text.dart';
import '../../core/widgets/rating_stars.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/error_view.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import 'widgets/product_gallery.dart';

final _productDetailProvider =
    FutureProvider.family<Product, String>((ref, slug) async {
  final data = await ApiClient()
      .get<Map<String, dynamic>>(ApiEndpoints.product(slug));
  return Product.fromJson(data);
});

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String slug;
  const ProductDetailScreen({super.key, required this.slug});

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState
    extends ConsumerState<ProductDetailScreen> {
  int _qty = 1;
  ProductVariant? _selectedVariant;
  bool _addingToCart = false;
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final productAsync =
        ref.watch(_productDetailProvider(widget.slug));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết sản phẩm'),
        actions: [
          IconButton(
            onPressed: () => context.push('/tim-kiem'),
            icon: const Icon(Icons.search),
          ),
        ],
      ),
      body: productAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => ErrorView(
          message: 'Không tải được sản phẩm',
          onRetry: () =>
              ref.refresh(_productDetailProvider(widget.slug)),
        ),
        data: (product) => _buildContent(context, product),
      ),
    );
  }

  Widget _buildContent(BuildContext context, Product product) {
    // Gallery only depends on color — find the selected color value
    final selectedColor = _selectedVariant?.options
        .where((o) => o.name.toLowerCase().contains('màu'))
        .map((o) => o.value)
        .firstOrNull;

    // Image for the selected color = first variant of that color that has an image
    final colorImage = selectedColor != null
        ? product.variants
            .where((v) => v.options.any((o) =>
                o.name.toLowerCase().contains('màu') &&
                o.value == selectedColor))
            .map((v) => v.image)
            .whereType<String>()
            .firstOrNull
        : null;

    final String? leadImage = colorImage ?? product.image;
    final images = [
      if (leadImage != null) leadImage,
      ...product.gallery,
    ].toSet().toList();

    final displayVariant = _selectedVariant;
    // Price always comes from the parent product — picking a variant must not
    // change the displayed price. Variant-level price still exists in the
    // model for legacy reasons but is intentionally ignored here.
    final price = product.price;
    final stockState =
        displayVariant?.stockState ?? product.stockState;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProductGallery(
                  key: ValueKey(leadImage ?? ''),
                  images: images,
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (product.brand != null)
                        Text(
                          product.brand!.name,
                          style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        product.name,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          PriceText(price: price, fontSize: 22),
                          const Spacer(),
                          StatusBadge.fromStock(
                              stockState.name.toUpperCase()),
                        ],
                      ),
                      if (product.rating != null &&
                          product.rating! > 0) ...[
                        const SizedBox(height: 8),
                        RatingStars(
                          rating: product.rating!,
                          reviewCount: product.reviewCount,
                        ),
                      ],
                      if (product.variants.isNotEmpty) ...[
                        const Divider(
                            height: 24, color: AppColors.divider),
                        _buildVariantSelector(product),
                      ],
                      const Divider(
                          height: 24, color: AppColors.divider),
                      _buildQtyRow(),
                    ],
                  ),
                ),
                _buildTabs(product),
              ],
            ),
          ),
        ),
        _buildBottomBar(product, stockState),
      ],
    );
  }

  Widget _buildVariantSelector(Product product) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phiên bản',
            style: TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: product.variants.map((v) {
            final selected = _selectedVariant?.id == v.id;
            final oos = !v.stockState.canAddToCart;
            return GestureDetector(
              onTap: oos
                  ? null
                  : () => setState(() => _selectedVariant = v),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.primarySoft
                      : AppColors.bgSurfaceRaised,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: selected
                        ? AppColors.primary
                        : AppColors.borderSubtle,
                  ),
                ),
                child: Text(
                  v.name,
                  style: TextStyle(
                    color: oos
                        ? AppColors.textDisabled
                        : selected
                            ? AppColors.primary
                            : AppColors.textPrimary,
                    fontSize: 13,
                    decoration: oos
                        ? TextDecoration.lineThrough
                        : null,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildQtyRow() {
    return Row(
      children: [
        const Text('Số lượng:',
            style: TextStyle(color: AppColors.textSecondary)),
        const Spacer(),
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgSurfaceRaised,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: _qty > 1
                    ? () => setState(() => _qty--)
                    : null,
                icon: const Icon(Icons.remove, size: 18),
                color: AppColors.textPrimary,
              ),
              Text('$_qty',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600)),
              IconButton(
                onPressed: () => setState(() => _qty++),
                icon: const Icon(Icons.add, size: 18),
                color: AppColors.textPrimary,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTabs(Product product) {
    return Column(
      children: [
        Container(
          color: AppColors.bgSection,
          child: Row(
            children: [
              _TabBtn('Mô tả', 0),
              _TabBtn('Thông số', 1),
              _TabBtn('Đánh giá', 2),
            ].map((w) => Expanded(child: w)).toList(),
          ),
        ),
        _buildTabContent(product),
      ],
    );
  }

  Widget _TabBtn(String label, int idx) => GestureDetector(
        onTap: () => setState(() => _tabIndex = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: _tabIndex == idx
                    ? AppColors.primary
                    : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: _tabIndex == idx
                  ? AppColors.primary
                  : AppColors.textSecondary,
              fontWeight: _tabIndex == idx
                  ? FontWeight.w600
                  : FontWeight.normal,
              fontSize: 14,
            ),
          ),
        ),
      );

  Widget _buildTabContent(Product product) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: switch (_tabIndex) {
        1 => product.specifications.isEmpty
            ? const Text('Chưa có thông số',
                style:
                    TextStyle(color: AppColors.textMuted))
            : Table(
                border: TableBorder.all(
                    color: AppColors.borderSubtle),
                children: product.specifications
                    .map((s) => TableRow(children: [
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(s.name,
                                style: const TextStyle(
                                    color:
                                        AppColors.textSecondary,
                                    fontSize: 13)),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(s.value,
                                style: const TextStyle(
                                    color:
                                        AppColors.textPrimary,
                                    fontSize: 13)),
                          ),
                        ]))
                    .toList(),
              ),
        2 => _ReviewsSection(productId: product.id),
        _ => product.description?.isNotEmpty == true
            ? HtmlWidget(product.description!,
                textStyle: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.6))
            : Text(
                product.shortDescription ?? 'Chưa có mô tả',
                style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.6)),
      },
    );
  }

  Widget _buildBottomBar(
      Product product, StockState stockState) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: AppColors.bgSection,
        border:
            Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: stockState.canAddToCart
                  ? () => context.push('/gio-hang')
                  : null,
              child: const Text('Xem giỏ'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed:
                  stockState.canAddToCart && !_addingToCart
                      ? () => _addToCart(product)
                      : null,
              child: _addingToCart
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(
                      stockState == StockState.outOfStock
                          ? 'Hết hàng'
                          : stockState ==
                                  StockState.contactForStock
                              ? 'Liên hệ'
                              : 'Thêm vào giỏ'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addToCart(Product product) async {
    setState(() => _addingToCart = true);
    try {
      await ref.read(cartProvider.notifier).addItem(
            product.id,
            _qty,
            variantId: _selectedVariant?.id,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã thêm vào giỏ hàng'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text('Lỗi: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _addingToCart = false);
    }
  }
}

class _ReviewsSection extends StatefulWidget {
  final String productId;
  const _ReviewsSection({required this.productId});

  @override
  State<_ReviewsSection> createState() => _ReviewsSectionState();
}

class _ReviewsSectionState extends State<_ReviewsSection> {
  List<ProductReview>? _reviews;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.productReviews(widget.productId),
      );
      setState(() {
        _reviews = (data['reviews'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(ProductReview.fromJson)
            .toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(
              color: AppColors.primary));
    }
    if (_reviews == null || _reviews!.isEmpty) {
      return const Text('Chưa có đánh giá',
          style: TextStyle(color: AppColors.textMuted));
    }
    return Column(
      children: _reviews!.map((r) => _ReviewItem(review: r)).toList(),
    );
  }
}

class _ReviewItem extends StatelessWidget {
  final ProductReview review;
  const _ReviewItem({required this.review});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurfaceRaised,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                review.authorName ?? 'Ẩn danh',
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13),
              ),
              const Spacer(),
              RatingStars(rating: review.rating.toDouble(), size: 13),
            ],
          ),
          if (review.content?.isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Text(review.content!,
                style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13)),
          ],
          if (review.createdAt != null) ...[
            const SizedBox(height: 4),
            Text(formatDate(review.createdAt),
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}
