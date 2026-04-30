class OrderNote {
  final String id;
  final String content;
  final String? createdAt;

  const OrderNote({required this.id, required this.content, this.createdAt});

  factory OrderNote.fromJson(Map<String, dynamic> j) => OrderNote(
        id: j['id']?.toString() ?? '',
        content: j['content'] as String? ?? '',
        createdAt: j['createdAt'] as String?,
      );
}

class OrderAddress {
  final String type;
  final String fullName;
  final String? email;
  final String phone;
  final String? country;
  final String province;
  final String district;
  final String ward;
  final String addressLine1;
  final String? addressLine2;

  const OrderAddress({
    required this.type,
    required this.fullName,
    this.email,
    required this.phone,
    this.country,
    required this.province,
    required this.district,
    required this.ward,
    required this.addressLine1,
    this.addressLine2,
  });

  factory OrderAddress.fromJson(Map<String, dynamic> j) => OrderAddress(
        type: j['type'] as String? ?? 'shipping',
        fullName: j['fullName'] as String? ?? '',
        email: j['email'] as String?,
        phone: j['phone'] as String? ?? '',
        country: j['country'] as String?,
        province: j['province'] as String? ?? '',
        district: j['district'] as String? ?? '',
        ward: j['ward'] as String? ?? '',
        addressLine1: j['addressLine1'] as String? ?? '',
        addressLine2: j['addressLine2'] as String?,
      );

  String get fullAddress {
    final parts = [addressLine1, ward, district, province]
        .where((s) => s.isNotEmpty)
        .toList();
    return parts.join(', ');
  }
}

class OrderLineItem {
  final String id;
  final String? productId;
  final String? sku;
  final String productName;
  final String? variantName;
  final String? image;
  final int quantity;
  final double unitPrice;
  final double lineTotal;

  const OrderLineItem({
    required this.id,
    this.productId,
    this.sku,
    required this.productName,
    this.variantName,
    this.image,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  factory OrderLineItem.fromJson(Map<String, dynamic> j) => OrderLineItem(
        id: j['id'].toString(),
        productId: j['productId']?.toString(),
        sku: j['sku'] as String?,
        productName: j['productName'] as String? ?? '',
        variantName: j['variantName'] as String?,
        image: j['image'] as String?,
        quantity: j['quantity'] as int? ?? 1,
        unitPrice: (j['unitPrice'] as num?)?.toDouble() ?? 0,
        lineTotal: (j['lineTotal'] as num?)?.toDouble() ?? 0,
      );
}

class OrderPayment {
  final String id;
  final String status;
  final String method;
  final double amount;
  final String? transactionId;
  final String? paidAt;

  const OrderPayment({
    required this.id,
    required this.status,
    required this.method,
    required this.amount,
    this.transactionId,
    this.paidAt,
  });

  factory OrderPayment.fromJson(Map<String, dynamic> j) => OrderPayment(
        id: j['id'].toString(),
        status: j['status'] as String? ?? '',
        // Backend field name is paymentMethod, not method
        method: j['paymentMethod'] as String? ?? j['method'] as String? ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        transactionId: j['transactionId'] as String?,
        paidAt: j['paidAt'] as String?,
      );
}

class OrderSummary {
  final String id;
  final String orderNumber;
  final String? orderKey;
  final String status;
  final String paymentStatus;
  final String fulfillmentStatus;
  final double totalAmount;
  final String currency;
  final String? placedAt;

  const OrderSummary({
    required this.id,
    required this.orderNumber,
    this.orderKey,
    required this.status,
    required this.paymentStatus,
    required this.fulfillmentStatus,
    required this.totalAmount,
    required this.currency,
    this.placedAt,
  });

  factory OrderSummary.fromJson(Map<String, dynamic> j) => OrderSummary(
        id: j['id'].toString(),
        orderNumber: j['orderNumber'] as String? ?? '',
        orderKey: j['orderKey'] as String?,
        status: j['status'] as String? ?? '',
        paymentStatus: j['paymentStatus'] as String? ?? '',
        fulfillmentStatus: j['fulfillmentStatus'] as String? ?? '',
        totalAmount: (j['totalAmount'] as num?)?.toDouble() ?? 0,
        currency: j['currency'] as String? ?? 'VND',
        placedAt: j['placedAt'] as String?,
      );
}

class OrderDetail extends OrderSummary {
  final String? customerEmail;
  final String? customerPhone;
  final String? customerNote;
  final double subtotalAmount;
  final double discountAmount;
  final double shippingAmount;
  final List<OrderLineItem> lineItems;
  final List<OrderAddress> addresses;
  final List<OrderPayment> payments;
  final List<OrderNote> notes;

  const OrderDetail({
    required super.id,
    required super.orderNumber,
    super.orderKey,
    required super.status,
    required super.paymentStatus,
    required super.fulfillmentStatus,
    required super.totalAmount,
    required super.currency,
    super.placedAt,
    this.customerEmail,
    this.customerPhone,
    this.customerNote,
    required this.subtotalAmount,
    required this.discountAmount,
    required this.shippingAmount,
    required this.lineItems,
    required this.addresses,
    required this.payments,
    required this.notes,
  });

  // Backend sends type in UPPERCASE (SHIPPING / BILLING)
  OrderAddress? get shippingAddress =>
      addresses.where((a) => a.type.toUpperCase() == 'SHIPPING').firstOrNull;

  factory OrderDetail.fromJson(Map<String, dynamic> j) {
    final base = OrderSummary.fromJson(j);
    return OrderDetail(
      id: base.id,
      orderNumber: base.orderNumber,
      orderKey: base.orderKey,
      status: base.status,
      paymentStatus: base.paymentStatus,
      fulfillmentStatus: base.fulfillmentStatus,
      totalAmount: base.totalAmount,
      currency: base.currency,
      placedAt: base.placedAt,
      customerEmail: j['customerEmail'] as String?,
      customerPhone: j['customerPhone'] as String?,
      customerNote: j['customerNote'] as String?,
      subtotalAmount: (j['subtotalAmount'] as num?)?.toDouble() ?? 0,
      discountAmount: (j['discountAmount'] as num?)?.toDouble() ?? 0,
      shippingAmount: (j['shippingAmount'] as num?)?.toDouble() ?? 0,
      lineItems: (j['lineItems'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(OrderLineItem.fromJson)
          .toList(),
      addresses: (j['addresses'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(OrderAddress.fromJson)
          .toList(),
      payments: (j['payments'] as List? ?? [])
          .cast<Map<String, dynamic>>()
          .map(OrderPayment.fromJson)
          .toList(),
      notes: (j['notes'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(OrderNote.fromJson)
          .toList(),
    );
  }
}
