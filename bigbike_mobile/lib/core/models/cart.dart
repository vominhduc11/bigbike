class CartItem {
  final String id;
  final String productId;
  final String? variantId;
  final String? sku;
  final String productName;
  final String? variantName;
  final String? image;
  final int quantity;
  final double unitPrice;
  final double lineSubtotal;
  final double lineDiscount;
  final double lineTotal;

  const CartItem({
    required this.id,
    required this.productId,
    this.variantId,
    this.sku,
    required this.productName,
    this.variantName,
    this.image,
    required this.quantity,
    required this.unitPrice,
    required this.lineSubtotal,
    required this.lineDiscount,
    required this.lineTotal,
  });

  factory CartItem.fromJson(Map<String, dynamic> j) => CartItem(
        id: j['id'].toString(),
        productId: j['productId'].toString(),
        variantId: j['variantId']?.toString(),
        sku: j['sku'] as String?,
        productName: j['productName'] as String? ?? '',
        variantName: j['variantName'] as String?,
        image: j['image'] as String?,
        quantity: j['quantity'] as int? ?? 1,
        unitPrice: (j['unitPrice'] as num?)?.toDouble() ?? 0,
        lineSubtotal: (j['lineSubtotal'] as num?)?.toDouble() ?? 0,
        lineDiscount: (j['lineDiscount'] as num?)?.toDouble() ?? 0,
        lineTotal: (j['lineTotal'] as num?)?.toDouble() ?? 0,
      );
}

class CartTotals {
  final double subtotalAmount;
  final double discountAmount;
  final double shippingAmount;
  final double feeAmount;
  final double totalAmount;

  const CartTotals({
    required this.subtotalAmount,
    required this.discountAmount,
    required this.shippingAmount,
    required this.feeAmount,
    required this.totalAmount,
  });

  factory CartTotals.fromJson(Map<String, dynamic> j) => CartTotals(
        subtotalAmount: (j['subtotalAmount'] as num?)?.toDouble() ?? 0,
        discountAmount: (j['discountAmount'] as num?)?.toDouble() ?? 0,
        shippingAmount: (j['shippingAmount'] as num?)?.toDouble() ?? 0,
        feeAmount: (j['feeAmount'] as num?)?.toDouble() ?? 0,
        totalAmount: (j['totalAmount'] as num?)?.toDouble() ?? 0,
      );

  static CartTotals empty() => const CartTotals(
        subtotalAmount: 0,
        discountAmount: 0,
        shippingAmount: 0,
        feeAmount: 0,
        totalAmount: 0,
      );
}

class Cart {
  final String id;
  final List<CartItem> items;
  final CartTotals totals;
  final List<String> couponCodes;

  const Cart({
    required this.id,
    required this.items,
    required this.totals,
    required this.couponCodes,
  });

  int get itemCount => items.fold(0, (sum, i) => sum + i.quantity);
  bool get isEmpty => items.isEmpty;

  factory Cart.fromJson(Map<String, dynamic> j) => Cart(
        id: j['id']?.toString() ?? '',
        items: (j['items'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(CartItem.fromJson)
            .toList(),
        totals: j['totals'] != null
            ? CartTotals.fromJson(j['totals'] as Map<String, dynamic>)
            : CartTotals.empty(),
        couponCodes:
            (j['couponCodes'] as List? ?? []).cast<String>(),
      );

  static Cart empty() => const Cart(
        id: '',
        items: [],
        totals: CartTotals(
          subtotalAmount: 0,
          discountAmount: 0,
          shippingAmount: 0,
          feeAmount: 0,
          totalAmount: 0,
        ),
        couponCodes: [],
      );
}
