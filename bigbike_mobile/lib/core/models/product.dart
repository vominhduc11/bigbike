import 'common.dart';
import 'category.dart';
import 'brand.dart';

enum StockState {
  inStock,
  lowStock,
  outOfStock,
  preorder,
  contactForStock;

  static StockState fromString(String? s) => switch (s) {
        'IN_STOCK' => inStock,
        'LOW_STOCK' => lowStock,
        'OUT_OF_STOCK' => outOfStock,
        'PREORDER' => preorder,
        'CONTACT_FOR_STOCK' => contactForStock,
        _ => inStock,
      };

  String get label => switch (this) {
        inStock => 'Còn hàng',
        lowStock => 'Sắp hết',
        outOfStock => 'Hết hàng',
        preorder => 'Đặt trước',
        contactForStock => 'Liên hệ',
      };

  bool get canAddToCart =>
      this == inStock || this == lowStock || this == preorder;
}

class ProductVariantOption {
  final String name;
  final String value;
  const ProductVariantOption({required this.name, required this.value});

  factory ProductVariantOption.fromJson(Map<String, dynamic> j) =>
      ProductVariantOption(
        name: j['name'] as String? ?? '',
        value: j['value'] as String? ?? '',
      );
}

class ProductVariant {
  final String id;
  final String sku;
  final String name;
  final List<ProductVariantOption> options;
  final ProductPrice price;
  final StockState stockState;
  final String? image;

  const ProductVariant({
    required this.id,
    required this.sku,
    required this.name,
    required this.options,
    required this.price,
    required this.stockState,
    this.image,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> j) => ProductVariant(
        id: j['id'].toString(),
        sku: j['sku'] as String? ?? '',
        name: j['name'] as String? ?? '',
        options: (j['options'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(ProductVariantOption.fromJson)
            .toList(),
        price: ProductPrice.fromJson(
            j['price'] as Map<String, dynamic>? ?? {}),
        stockState:
            StockState.fromString(j['stockState'] as String?),
        image: j['image'] as String?,
      );
}

class ProductSpecification {
  final String name;
  final String value;
  final String? group;
  const ProductSpecification(
      {required this.name, required this.value, this.group});

  factory ProductSpecification.fromJson(Map<String, dynamic> j) =>
      ProductSpecification(
        name: j['name'] as String? ?? '',
        value: j['value'] as String? ?? '',
        group: j['group'] as String?,
      );
}

class ProductSummary {
  final String id;
  final String slug;
  final String name;
  final String? image;
  final ProductPrice price;
  final StockState stockState;
  final double? rating;
  final int? reviewCount;
  final BrandSummary? brand;
  final CategorySummary? category;
  final bool isFeatured;

  const ProductSummary({
    required this.id,
    required this.slug,
    required this.name,
    this.image,
    required this.price,
    required this.stockState,
    this.rating,
    this.reviewCount,
    this.brand,
    this.category,
    this.isFeatured = false,
  });

  factory ProductSummary.fromJson(Map<String, dynamic> j) => ProductSummary(
        id: j['id'].toString(),
        slug: j['slug'] as String? ?? '',
        name: j['name'] as String? ?? '',
        image: j['image'] as String?,
        price: ProductPrice.fromJson(
            j['price'] as Map<String, dynamic>? ?? {}),
        stockState:
            StockState.fromString(j['stockState'] as String?),
        rating: (j['rating'] as num?)?.toDouble(),
        reviewCount: (j['ratingCount'] as num?)?.toInt() ??
            (j['reviewCount'] as num?)?.toInt(),
        brand: j['brand'] != null
            ? BrandSummary.fromJson(
                j['brand'] as Map<String, dynamic>)
            : null,
        category: j['category'] != null
            ? CategorySummary.fromJson(
                j['category'] as Map<String, dynamic>)
            : null,
        isFeatured: j['isFeatured'] as bool? ?? false,
      );
}

class Product extends ProductSummary {
  final String? shortDescription;
  final String? description;
  final List<String> gallery;
  final List<ProductVariant> variants;
  final List<ProductSpecification> specifications;
  final List<CategorySummary> categories;

  const Product({
    required super.id,
    required super.slug,
    required super.name,
    super.image,
    required super.price,
    required super.stockState,
    super.rating,
    super.reviewCount,
    super.brand,
    super.category,
    super.isFeatured,
    this.shortDescription,
    this.description,
    required this.gallery,
    required this.variants,
    required this.specifications,
    required this.categories,
  });

  factory Product.fromJson(Map<String, dynamic> j) {
    final base = ProductSummary.fromJson(j);
    return Product(
      id: base.id,
      slug: base.slug,
      name: base.name,
      image: base.image,
      price: base.price,
      stockState: base.stockState,
      rating: base.rating,
      reviewCount: base.reviewCount,
      brand: base.brand,
      category: base.category,
      isFeatured: base.isFeatured,
      shortDescription: j['shortDescription'] as String?,
      description: j['description'] as String?,
      gallery:
          (j['gallery'] as List? ?? []).cast<String>(),
      variants: (j['variants'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(ProductVariant.fromJson)
          .toList(),
      specifications: (j['specifications'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(ProductSpecification.fromJson)
          .toList(),
      categories: (j['categories'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(CategorySummary.fromJson)
          .toList(),
    );
  }
}

class ProductReview {
  final String id;
  final String? authorName;
  final int rating;
  final String? content;
  final String? createdAt;

  const ProductReview({
    required this.id,
    this.authorName,
    required this.rating,
    this.content,
    this.createdAt,
  });

  factory ProductReview.fromJson(Map<String, dynamic> j) => ProductReview(
        id: j['id'].toString(),
        authorName: j['authorName'] as String?,
        rating: j['rating'] as int? ?? 5,
        content: j['comment'] as String?,
        createdAt: j['createdAt'] as String?,
      );
}
