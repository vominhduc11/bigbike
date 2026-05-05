import 'package:flutter_test/flutter_test.dart';
import 'package:bigbike_mobile/core/models/brand.dart';

void main() {
  group('BrandSummary.fromJson — logo parsing', () {
    test('null logo → logoUrl is null', () {
      final brand = BrandSummary.fromJson({
        'id': 'b1',
        'slug': 'ls2',
        'name': 'LS2',
        'logo': null,
      });
      expect(brand.logo, isNull);
    });

    test('logo as ImageAsset Map → extracts url field', () {
      final brand = BrandSummary.fromJson({
        'id': 'b1',
        'slug': 'ls2',
        'name': 'LS2',
        'logo': {
          'id': 'img_001',
          'url': 'http://localhost:9000/bigbike-media/logos/ls2.png',
          'alt': 'LS2 logo',
          'width': 200,
          'height': 80,
          'mimeType': 'image/png',
        },
      });
      expect(
        brand.logo,
        equals('http://localhost:9000/bigbike-media/logos/ls2.png'),
      );
    });

    test('logo as Map without url → logoUrl is null', () {
      final brand = BrandSummary.fromJson({
        'id': 'b1',
        'slug': 'ls2',
        'name': 'LS2',
        'logo': {'alt': 'no url here'},
      });
      expect(brand.logo, isNull);
    });

    test('logo as legacy String → used directly', () {
      final brand = BrandSummary.fromJson({
        'id': 'b1',
        'slug': 'ls2',
        'name': 'LS2',
        'logo': 'http://localhost:9000/bigbike-media/logos/ls2-legacy.png',
      });
      expect(
        brand.logo,
        equals('http://localhost:9000/bigbike-media/logos/ls2-legacy.png'),
      );
    });

    test('logo as empty String → logoUrl is null', () {
      final brand = BrandSummary.fromJson({
        'id': 'b1',
        'slug': 'ls2',
        'name': 'LS2',
        'logo': '',
      });
      expect(brand.logo, isNull);
    });

    test('logo as unexpected type (int) → logoUrl is null, no crash', () {
      final brand = BrandSummary.fromJson({
        'id': 'b1',
        'slug': 'ls2',
        'name': 'LS2',
        'logo': 42,
      });
      expect(brand.logo, isNull);
    });
  });

  group('Brand.fromJson', () {
    test('inherits logo parsing from BrandSummary', () {
      final brand = Brand.fromJson({
        'id': 'b2',
        'slug': 'shoei',
        'name': 'Shoei',
        'description': 'Premium Japanese helmets',
        'logo': {
          'id': 'img_002',
          'url': 'http://localhost:9000/bigbike-media/logos/shoei.png',
          'alt': 'Shoei logo',
        },
      });
      expect(brand.logo, equals('http://localhost:9000/bigbike-media/logos/shoei.png'));
      expect(brand.description, equals('Premium Japanese helmets'));
    });
  });
}
