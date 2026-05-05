import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/models/product.dart';
import '../../core/models/common.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/shimmer_box.dart';
import '../../core/widgets/pagination_widget.dart';
import 'widgets/product_card.dart';
import 'widgets/product_filters.dart';

class ProductListParams {
  final int page;
  final String? categorySlug;
  final String? brandSlug;
  final String? keyword;
  final String? sort;
  final double? minPrice;
  final double? maxPrice;

  const ProductListParams({
    this.page = 1,
    this.categorySlug,
    this.brandSlug,
    this.keyword,
    this.sort,
    this.minPrice,
    this.maxPrice,
  });

  Map<String, dynamic> toQuery() => {
        'page': page,
        'size': 20,
        if (categorySlug != null) 'category': categorySlug,
        if (brandSlug != null) 'pwb-brand': brandSlug,
        if (keyword != null && keyword!.isNotEmpty) 'q': keyword,
        if (sort != null) 'sort': sort,
        if (minPrice != null) 'min_price': minPrice!.toInt(),
        if (maxPrice != null) 'max_price': maxPrice!.toInt(),
      };
}

class ProductListScreen extends ConsumerStatefulWidget {
  final String? categorySlug;
  final String? brandSlug;
  final String? keyword;
  final bool embedded;

  const ProductListScreen({
    super.key,
    this.categorySlug,
    this.brandSlug,
    this.keyword,
    this.embedded = false,
  });

  @override
  ConsumerState<ProductListScreen> createState() =>
      _ProductListScreenState();
}

class _ProductListScreenState
    extends ConsumerState<ProductListScreen> {
  late ProductListParams _params;
  PaginatedResponse<ProductSummary>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _params = ProductListParams(
      categorySlug: widget.categorySlug,
      brandSlug: widget.brandSlug,
      keyword: widget.keyword,
    );
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient().get<Map<String, dynamic>>(
        ApiEndpoints.products,
        queryParams: _params.toQuery(),
      );
      setState(() {
        _data = PaginatedResponse.fromJson(data, ProductSummary.fromJson);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _changePage(int p) {
    setState(() => _params = ProductListParams(
          page: p,
          categorySlug: _params.categorySlug,
          brandSlug: _params.brandSlug,
          keyword: _params.keyword,
          sort: _params.sort,
          minPrice: _params.minPrice,
          maxPrice: _params.maxPrice,
        ));
    _load();
  }

  void _applyFilters(ProductListParams filters) {
    setState(() => _params = filters);
    _load();
  }

  Widget get _body {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: ShimmerProductGrid(),
      );
    }
    if (_error != null) {
      return ErrorView(message: _error!, onRetry: _load);
    }
    if (_data == null || _data!.items.isEmpty) {
      return const Center(
        child: Text(
          'Không tìm thấy sản phẩm',
          style: TextStyle(color: AppColors.textMuted),
        ),
      );
    }
    return Column(
      children: [
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.58,
            ),
            itemCount: _data!.items.length,
            itemBuilder: (ctx, i) {
              final p = _data!.items[i];
              return ProductCard(
                product: p,
                onTap: () => context.push('/product/${p.slug}'),
              );
            },
          ),
        ),
        PaginationWidget(
          currentPage: _data!.page,
          totalPages: _data!.totalPages,
          onPageChanged: _changePage,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.embedded) {
      return Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Sản phẩm',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: AppColors.textPrimary)),
                TextButton.icon(
                  onPressed: () => _showFilters(context),
                  icon: const Icon(Icons.tune_outlined, size: 16),
                  label: const Text('Lọc'),
                  style:
                      TextButton.styleFrom(foregroundColor: AppColors.primary),
                ),
              ],
            ),
          ),
          Expanded(child: _body),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.categorySlug != null
            ? 'Sản phẩm'
            : widget.keyword != null
                ? 'Kết quả: "${widget.keyword}"'
                : 'Tất cả sản phẩm'),
        actions: [
          IconButton(
            onPressed: () => _showFilters(context),
            icon: const Icon(Icons.tune_outlined),
          ),
        ],
      ),
      body: _body,
    );
  }

  void _showFilters(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSection,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => ProductFiltersSheet(
        current: _params,
        onApply: (p) {
          Navigator.pop(context);
          _applyFilters(p);
        },
      ),
    );
  }
}
