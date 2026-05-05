import 'package:bigbike_mobile/core/models/checkout.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CheckoutOptions.fromJson', () {
    test('preserves shipping UUID and payment code from backend options', () {
      final options = CheckoutOptions.fromJson({
        'shippingMethods': [
          {
            'id': '7f7e1b3e-4d6b-4f88-b409-6ed1b3f28a51',
            'code': 'STANDARD',
            'title': 'Giao hàng tiêu chuẩn',
            'cost': 30000,
          },
        ],
        'paymentMethods': [
          {'code': 'COD', 'title': 'Thanh toán khi nhận hàng'},
        ],
      });

      expect(options.shippingMethods, hasLength(1));
      expect(
        options.shippingMethods.first.id,
        '7f7e1b3e-4d6b-4f88-b409-6ed1b3f28a51',
      );
      expect(options.shippingMethods.first.code, 'STANDARD');

      expect(options.paymentMethods, hasLength(1));
      expect(options.paymentMethods.first.code, 'COD');
      expect(
        options.paymentMethods.first.id,
        'COD',
        reason: 'Backend checkout options do not return a payment method id.',
      );
    });
  });

  group('CheckoutPayload.toJson', () {
    test('serializes backend field names for checkout request', () {
      const payload = CheckoutPayload(
        shippingAddress: CheckoutAddress(
          fullName: 'Nguyen Van A',
          phone: '0909123456',
          email: 'a@example.com',
          province: 'Ho Chi Minh',
          district: 'Quan 1',
          ward: 'Ben Nghe',
          addressLine1: '123 Le Loi',
        ),
        shippingMethodId: '7f7e1b3e-4d6b-4f88-b409-6ed1b3f28a51',
        paymentMethod: 'COD',
        customerNote: 'Giao giờ hành chính',
      );

      expect(payload.toJson(), {
        'shippingAddress': {
          'fullName': 'Nguyen Van A',
          'phone': '0909123456',
          'email': 'a@example.com',
          'province': 'Ho Chi Minh',
          'district': 'Quan 1',
          'ward': 'Ben Nghe',
          'addressLine1': '123 Le Loi',
          'country': 'VN',
        },
        'billingAddress': {
          'fullName': 'Nguyen Van A',
          'phone': '0909123456',
          'email': 'a@example.com',
          'province': 'Ho Chi Minh',
          'district': 'Quan 1',
          'ward': 'Ben Nghe',
          'addressLine1': '123 Le Loi',
          'country': 'VN',
        },
        'shippingMethodId': '7f7e1b3e-4d6b-4f88-b409-6ed1b3f28a51',
        'paymentMethod': 'COD',
        'customerNote': 'Giao giờ hành chính',
      });
    });

    test('omits empty customerNote', () {
      const payload = CheckoutPayload(
        shippingAddress: CheckoutAddress(
          fullName: 'Nguyen Van B',
          phone: '0909123457',
          email: 'b@example.com',
          province: 'Ho Chi Minh',
          district: 'Quan 3',
          ward: 'Vo Thi Sau',
          addressLine1: '456 Nguyen Dinh Chieu',
        ),
        shippingMethodId: 'method-uuid',
        paymentMethod: 'BACS',
        customerNote: '',
      );

      expect(payload.toJson().containsKey('customerNote'), isFalse);
    });
  });
}
