import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('probe', Path(__file__).parents[1] / 'check-google-merchant.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
NOW = dt.datetime(2026, 10, 30, tzinfo=dt.timezone.utc)
ITEM = '<item><g:id>SKU</g:id><g:title>T</g:title><g:description>D</g:description><g:link>https://example.com/p</g:link><g:image_link>https://example.com/i</g:image_link><g:price>100 VND</g:price><g:availability>out_of_stock</g:availability></item>'


def xml(items):
    return '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>' + items + '</channel></rss>'


def headers(**overrides):
    return {'content-type': 'application/xml', 'x-merchant-item-count': '1',
            'x-merchant-product-count': '1', 'x-merchant-generated-at': NOW.isoformat(), **overrides}


class ProbeTests(unittest.TestCase):
    def test_success_and_recovery_after_failure(self):
        self.assertIn('XML_INVALID', probe.validate('<html>', {}, NOW, 60)['errors'])
        self.assertEqual(probe.validate(xml(ITEM), headers(), NOW, 60)['errors'], [])

    def test_stale_missing_and_future_are_not_healthy(self):
        for stamp in ['', '2026-10-29T00:00:00Z', '2026-10-31T00:00:00Z', '2026-10-30T00:00:00']:
            self.assertTrue(probe.validate(xml(ITEM), headers(**{'x-merchant-generated-at': stamp}), NOW, 60)['errors'])

    def test_duplicate_and_counts(self):
        errors = probe.validate(xml(ITEM + ITEM.replace('SKU', 'sku')), headers(), NOW, 60)['errors']
        self.assertIn('SKU_INVALID_OR_DUPLICATE', errors)
        self.assertIn('ITEM_COUNT_MISMATCH', errors)
        self.assertIn('CATALOG_COUNT_MISMATCH', probe.validate(xml(ITEM), headers(), NOW, 60, 2)['errors'])

    def test_group_counts_and_empty_verification(self):
        items = (ITEM.replace('</item>', '<g:item_group_id>P</g:item_group_id></item>') +
                 ITEM.replace('SKU', 'SECOND').replace('</item>', '<g:item_group_id>P</g:item_group_id></item>'))
        self.assertEqual(probe.validate(xml(items), headers(**{'x-merchant-item-count': '2'}), NOW, 60)['errors'], [])
        empty = headers(**{'x-merchant-item-count': '0', 'x-merchant-product-count': '0'})
        self.assertIn('EMPTY_UNVERIFIED', probe.validate(xml(''), empty, NOW, 60)['errors'])
        self.assertEqual(probe.validate(xml(''), empty, NOW, 60, 0)['errors'], [])


if __name__ == '__main__':
    unittest.main()
