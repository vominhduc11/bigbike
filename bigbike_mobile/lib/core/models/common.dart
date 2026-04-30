class PaginatedResponse<T> {
  final List<T> items;
  final int total;
  final int page;
  final int size;
  final int totalPages;

  const PaginatedResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.totalPages,
  });

  bool get hasNextPage => page < totalPages;
  bool get hasPrevPage => page > 1;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    final rawItems = (json['data'] as List?) ?? [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? {};
    return PaginatedResponse(
      items: rawItems
          .cast<Map<String, dynamic>>()
          .map(fromItem)
          .toList(),
      total: pagination['totalItems'] as int? ?? 0,
      page: pagination['page'] as int? ?? 1,
      size: pagination['pageSize'] as int? ?? 20,
      totalPages: pagination['totalPages'] as int? ?? 1,
    );
  }
}

class ProductPrice {
  final double retailPrice;
  final double? compareAtPrice;
  final double? salePrice;
  final String currency;

  const ProductPrice({
    required this.retailPrice,
    this.compareAtPrice,
    this.salePrice,
    this.currency = 'VND',
  });

  double get displayPrice => salePrice ?? retailPrice;
  bool get hasDiscount => salePrice != null && salePrice! < retailPrice;

  factory ProductPrice.fromJson(Map<String, dynamic> json) => ProductPrice(
        retailPrice: (json['retailPrice'] as num?)?.toDouble() ?? 0,
        compareAtPrice: (json['compareAtPrice'] as num?)?.toDouble(),
        salePrice: (json['salePrice'] as num?)?.toDouble(),
        currency: json['currency'] as String? ?? 'VND',
      );
}
