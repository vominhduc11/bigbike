import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/product.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/widgets/price_text.dart';
import '../../core/widgets/rating_stars.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/error_view.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/validators.dart';
import 'widgets/product_gallery.dart';

final _productDetailProvider = FutureProvider.family<Product, String>((
  ref,
  slug,
) async {
  final data = await ApiClient().get<Map<String, dynamic>>(
    ApiEndpoints.product(slug),
  );
  return Product.fromJson(data);
});

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String slug;
  const ProductDetailScreen({super.key, required this.slug});

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int _qty = 1;
  ProductVariant? _selectedVariant;
  bool _addingToCart = false;
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(_productDetailProvider(widget.slug));

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
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (e, _) => ErrorView(
          message: 'Không tải được sản phẩm',
          onRetry: () => ref.refresh(_productDetailProvider(widget.slug)),
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
              .where(
                (v) => v.options.any(
                  (o) =>
                      o.name.toLowerCase().contains('màu') &&
                      o.value == selectedColor,
                ),
              )
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
    final stockState = displayVariant?.stockState ?? product.stockState;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProductGallery(key: ValueKey(leadImage ?? ''), images: images),
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
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        product.name,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          PriceText(price: price, fontSize: 22),
                          const Spacer(),
                          StatusBadge.fromStock(stockState.name.toUpperCase()),
                        ],
                      ),
                      if (product.rating != null && product.rating! > 0) ...[
                        const SizedBox(height: 8),
                        RatingStars(
                          rating: product.rating!,
                          reviewCount: product.reviewCount,
                        ),
                      ],
                      if (product.variants.isNotEmpty) ...[
                        const Divider(height: 24, color: AppColors.divider),
                        _buildVariantSelector(product),
                      ],
                      const Divider(height: 24, color: AppColors.divider),
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
        const Text(
          'Phiên bản',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: product.variants.map((v) {
            final selected = _selectedVariant?.id == v.id;
            final oos = !v.stockState.canAddToCart;
            return GestureDetector(
              onTap: oos ? null : () => setState(() => _selectedVariant = v),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
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
                    decoration: oos ? TextDecoration.lineThrough : null,
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
        const Text(
          'Số lượng:',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const Spacer(),
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgSurfaceRaised,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: _qty > 1 ? () => setState(() => _qty--) : null,
                icon: const Icon(Icons.remove, size: 18),
                color: AppColors.textPrimary,
              ),
              Text(
                '$_qty',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
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
            color: _tabIndex == idx ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
        ),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: _tabIndex == idx ? AppColors.primary : AppColors.textSecondary,
          fontWeight: _tabIndex == idx ? FontWeight.w600 : FontWeight.normal,
          fontSize: 14,
        ),
      ),
    ),
  );

  Widget _buildTabContent(Product product) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: switch (_tabIndex) {
        1 =>
          product.specifications.isEmpty
              ? const Text(
                  'Chưa có thông số',
                  style: TextStyle(color: AppColors.textMuted),
                )
              : Table(
                  border: TableBorder.all(color: AppColors.borderSubtle),
                  children: product.specifications
                      .map(
                        (s) => TableRow(
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(8),
                              child: Text(
                                s.name,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(8),
                              child: Text(
                                s.value,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )
                      .toList(),
                ),
        2 => _ReviewsSection(productId: product.id),
        _ =>
          product.description?.isNotEmpty == true
              ? HtmlWidget(
                  product.description!,
                  textStyle: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.6,
                  ),
                )
              : Text(
                  product.shortDescription ?? 'Chưa có mô tả',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.6,
                  ),
                ),
      },
    );
  }

  Widget _buildBottomBar(Product product, StockState stockState) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: AppColors.bgSection,
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
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
              onPressed: stockState.canAddToCart && !_addingToCart
                  ? () => _addToCart(product)
                  : null,
              child: _addingToCart
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      stockState == StockState.outOfStock
                          ? 'Hết hàng'
                          : stockState == StockState.contactForStock
                          ? 'Liên hệ'
                          : 'Thêm vào giỏ',
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addToCart(Product product) async {
    setState(() => _addingToCart = true);
    try {
      await ref
          .read(cartProvider.notifier)
          .addItem(product.id, _qty, variantId: _selectedVariant?.id);
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
            content: Text('Lỗi: ${e.toString()}'),
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
  final _formKey = GlobalKey<FormState>();
  final _authorCtrl = TextEditingController();
  final _commentCtrl = TextEditingController();
  List<ProductReview>? _reviews;
  bool _loading = true;
  bool _submitting = false;
  int _rating = 0;
  String? _loadError;
  String? _submitNotice;
  bool _submitSucceeded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _authorCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() => _loading = true);
    }
    try {
      final response = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.productReviews(widget.productId),
      );
      final payload = response['data'] is Map<String, dynamic>
          ? response['data'] as Map<String, dynamic>
          : response;
      final reviews = (payload['reviews'] as List? ?? [])
          .whereType<Map>()
          .map(
            (item) => ProductReview.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
      if (!mounted) return;
      setState(() {
        _reviews = reviews;
        _loading = false;
        _loadError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = 'Khong tai duoc danh gia. Vui long thu lai.';
      });
    }
  }

  Future<void> _submitReview() async {
    if (!_formKey.currentState!.validate()) return;
    if (_rating < 1 || _rating > 5) {
      setState(() {
        _submitSucceeded = false;
        _submitNotice = 'Vui long chon so sao tu 1 den 5.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _submitNotice = null;
    });

    try {
      final response = await ApiClient().post<Map<String, dynamic>>(
        ApiEndpoints.productReviews(widget.productId),
        data: {
          'authorName': _authorCtrl.text.trim(),
          'rating': _rating,
          'comment': _commentCtrl.text.trim(),
        },
      );
      final payload = response['data'] is Map<String, dynamic>
          ? response['data'] as Map<String, dynamic>
          : response;
      if (payload['success'] != true) {
        throw const ApiException(message: 'Khong the gui danh gia.');
      }
      if (!mounted) return;
      FocusScope.of(context).unfocus();
      _formKey.currentState!.reset();
      _authorCtrl.clear();
      _commentCtrl.clear();
      setState(() {
        _rating = 0;
        _submitting = false;
        _submitSucceeded = true;
        _submitNotice =
            'Da gui danh gia thanh cong. Noi dung se hien thi sau khi duoc duyet.';
      });
      await _load(silent: true);
    } catch (error) {
      final apiError = extractApiException(error);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitSucceeded = false;
        _submitNotice = apiError.displayMessage;
      });
    } finally {
      if (mounted && _submitting) {
        setState(() => _submitting = false);
      }
    }
  }

  String? _validateAuthorName(String? value) {
    final required = Validators.required(value, 'Ten');
    if (required != null) return required;
    if (value!.trim().length > 80) {
      return 'Ten khong duoc vuot qua 80 ky tu';
    }
    return null;
  }

  String? _validateComment(String? value) {
    if (value != null && value.length > 1000) {
      return 'Nhan xet khong duoc vuot qua 1000 ky tu';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ReviewComposer(
          formKey: _formKey,
          authorCtrl: _authorCtrl,
          commentCtrl: _commentCtrl,
          rating: _rating,
          submitting: _submitting,
          onRatingChanged: (value) => setState(() => _rating = value),
          onSubmit: _submitReview,
          validateAuthorName: _validateAuthorName,
          validateComment: _validateComment,
        ),
        if (_submitNotice != null) ...[
          const SizedBox(height: 12),
          _InlineNotice(message: _submitNotice!, success: _submitSucceeded),
        ],
        const SizedBox(height: 16),
        const Text(
          'Danh gia tu khach hang',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (_loadError != null)
          _ReviewsErrorState(onRetry: _load)
        else if (_reviews == null || _reviews!.isEmpty)
          const Text(
            'Chua co danh gia',
            style: TextStyle(color: AppColors.textMuted),
          )
        else
          Column(
            children: _reviews!.map((r) => _ReviewItem(review: r)).toList(),
          ),
      ],
    );
  }
}

class _ReviewComposer extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController authorCtrl;
  final TextEditingController commentCtrl;
  final int rating;
  final bool submitting;
  final ValueChanged<int> onRatingChanged;
  final Future<void> Function() onSubmit;
  final String? Function(String?) validateAuthorName;
  final String? Function(String?) validateComment;

  const _ReviewComposer({
    required this.formKey,
    required this.authorCtrl,
    required this.commentCtrl,
    required this.rating,
    required this.submitting,
    required this.onRatingChanged,
    required this.onSubmit,
    required this.validateAuthorName,
    required this.validateComment,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurfaceRaised,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Gui danh gia cua ban',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Danh gia moi se duoc kiem duyet truoc khi hien thi cong khai.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: authorCtrl,
              validator: validateAuthorName,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: _inputDecoration('Ten cua ban *'),
            ),
            const SizedBox(height: 12),
            _RatingInput(
              rating: rating,
              onChanged: submitting ? null : onRatingChanged,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: commentCtrl,
              validator: validateComment,
              maxLines: 4,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: _inputDecoration(
                'Nhan xet',
              ).copyWith(alignLabelWithHint: true),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: submitting ? null : onSubmit,
                child: submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Gui danh gia'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: AppColors.textMuted),
      filled: true,
      fillColor: AppColors.bgSurface,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.primary),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.error),
      ),
    );
  }
}

class _RatingInput extends StatelessWidget {
  final int rating;
  final ValueChanged<int>? onChanged;

  const _RatingInput({required this.rating, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'So sao *',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(5, (index) {
            final value = index + 1;
            return IconButton(
              onPressed: onChanged == null ? null : () => onChanged!(value),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints.tightFor(width: 36, height: 36),
              icon: Icon(
                rating >= value
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                color: AppColors.warning,
                size: 28,
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _InlineNotice extends StatelessWidget {
  final String message;
  final bool success;

  const _InlineNotice({required this.message, required this.success});

  @override
  Widget build(BuildContext context) {
    final color = success ? AppColors.success : AppColors.error;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ReviewsErrorState extends StatelessWidget {
  final Future<void> Function({bool silent}) onRetry;

  const _ReviewsErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurfaceRaised,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Khong tai duoc danh gia.',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          TextButton(onPressed: () => onRetry(), child: const Text('Thu lai')),
        ],
      ),
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
                  fontSize: 13,
                ),
              ),
              const Spacer(),
              RatingStars(rating: review.rating.toDouble(), size: 13),
            ],
          ),
          if (review.content?.isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Text(
              review.content!,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
          if (review.createdAt != null) ...[
            const SizedBox(height: 4),
            Text(
              formatDate(review.createdAt),
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}
