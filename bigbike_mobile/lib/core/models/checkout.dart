class ShippingMethod {
  final String id;
  final String code;
  final String title;
  final double cost;

  const ShippingMethod({
    required this.id,
    required this.code,
    required this.title,
    required this.cost,
  });

  factory ShippingMethod.fromJson(Map<String, dynamic> j) => ShippingMethod(
        id: j['id'].toString(),
        code: j['code'] as String? ?? '',
        title: j['title'] as String? ?? '',
        cost: (j['cost'] as num?)?.toDouble() ?? 0,
      );
}

class PaymentMethod {
  final String id;
  final String code;
  final String title;
  final String? description;

  const PaymentMethod({
    required this.id,
    required this.code,
    required this.title,
    this.description,
  });

  factory PaymentMethod.fromJson(Map<String, dynamic> j) => PaymentMethod(
        id: j['id']?.toString() ?? (j['code'] as String? ?? ''),
        code: j['code'] as String? ?? '',
        title: j['title'] as String? ?? '',
        description: j['description'] as String?,
      );
}

class CheckoutOptions {
  final List<ShippingMethod> shippingMethods;
  final List<PaymentMethod> paymentMethods;

  const CheckoutOptions({
    required this.shippingMethods,
    required this.paymentMethods,
  });

  factory CheckoutOptions.fromJson(Map<String, dynamic> j) => CheckoutOptions(
        shippingMethods: (j['shippingMethods'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(ShippingMethod.fromJson)
            .toList(),
        paymentMethods: (j['paymentMethods'] as List? ?? [])
            .cast<Map<String, dynamic>>()
            .map(PaymentMethod.fromJson)
            .toList(),
      );
}

class CheckoutAddress {
  final String fullName;
  final String phone;
  final String email;
  final String province;
  final String district;
  final String ward;
  final String addressLine1;

  const CheckoutAddress({
    required this.fullName,
    required this.phone,
    required this.email,
    required this.province,
    required this.district,
    required this.ward,
    required this.addressLine1,
  });

  Map<String, dynamic> toJson() => {
        'fullName': fullName,
        'phone': phone,
        'email': email,
        'province': province,
        'district': district,
        'ward': ward,
        'addressLine1': addressLine1,
        'country': 'VN',
      };
}

class CheckoutPayload {
  final CheckoutAddress shippingAddress;
  final CheckoutAddress? billingAddress;
  final String shippingMethodId;
  final String paymentMethod;
  final String? customerNote;

  const CheckoutPayload({
    required this.shippingAddress,
    this.billingAddress,
    required this.shippingMethodId,
    required this.paymentMethod,
    this.customerNote,
  });

  Map<String, dynamic> toJson() => {
        'shippingAddress': shippingAddress.toJson(),
        'billingAddress': (billingAddress ?? shippingAddress).toJson(),
        'shippingMethodId': shippingMethodId,
        'paymentMethod': paymentMethod,
        if (customerNote != null && customerNote!.isNotEmpty)
          'customerNote': customerNote,
      };
}

class OrderConfirmation {
  final String orderId;
  final String orderNumber;
  final String orderKey;
  final double totalAmount;

  const OrderConfirmation({
    required this.orderId,
    required this.orderNumber,
    required this.orderKey,
    required this.totalAmount,
  });

  factory OrderConfirmation.fromJson(Map<String, dynamic> j) =>
      OrderConfirmation(
        orderId: j['id']?.toString() ?? j['orderId']?.toString() ?? '',
        orderNumber: j['orderNumber'] as String? ?? '',
        orderKey: j['orderKey'] as String? ?? '',
        totalAmount: (j['totalAmount'] as num?)?.toDouble() ?? 0,
      );
}
