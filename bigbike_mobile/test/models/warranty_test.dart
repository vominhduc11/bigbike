import 'package:flutter_test/flutter_test.dart';
import 'package:bigbike_mobile/core/models/warranty.dart';

void main() {
  group('WarrantyLookupResult.fromJson', () {
    test('parses a complete payload', () {
      final result = WarrantyLookupResult.fromJson({
        'serialNumber': 'SN-A1B2C3D4E5F6',
        'productName': 'Mũ bảo hiểm LS2 FF800',
        'startDate': '2025-01-10',
        'endDate': '2026-07-10',
        'status': 'ACTIVE',
        'daysLeft': 120,
      });

      expect(result.serialNumber, 'SN-A1B2C3D4E5F6');
      expect(result.productName, 'Mũ bảo hiểm LS2 FF800');
      expect(result.startDate, '2025-01-10');
      expect(result.endDate, '2026-07-10');
      expect(result.status, 'ACTIVE');
      expect(result.daysLeft, 120);
    });

    test('missing fields fall back to safe defaults', () {
      final result = WarrantyLookupResult.fromJson({});

      expect(result.serialNumber, '');
      expect(result.productName, '');
      expect(result.startDate, '');
      expect(result.endDate, '');
      expect(result.status, '');
      expect(result.daysLeft, 0);
    });

    test('daysLeft accepts a numeric (double) value', () {
      final result = WarrantyLookupResult.fromJson({'daysLeft': 30.0});
      expect(result.daysLeft, 30);
    });

    test('null fields do not throw and default safely', () {
      final result = WarrantyLookupResult.fromJson({
        'serialNumber': null,
        'productName': null,
        'status': null,
        'daysLeft': null,
      });

      expect(result.serialNumber, '');
      expect(result.productName, '');
      expect(result.status, '');
      expect(result.daysLeft, 0);
    });
  });
}
