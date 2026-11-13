import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('image_audit', Path(__file__).parents[1] / 'audits/audit-gmc-images.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ImageAuditTests(unittest.TestCase):
    def test_shop_threshold_includes_non_thumbnail_between_500_and_799(self):
        products = [{'sku': 'WIDE', 'image': {'url': '/media/wide.jpg', 'width': 1500, 'height': 631}},
                    {'sku': 'OK', 'image': {'url': '/media/enough.jpg', 'width': 800, 'height': 800}}]
        rows = list(audit.review(products, []))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], 'WIDE')
        self.assertEqual(rows[0][5], 'under_800')

    def test_candidates_are_existing_objects_and_never_an_invented_url(self):
        product = {'sku': 'SKU', 'image': {'url': '/media/blue-400x400-1.jpg', 'width': 400, 'height': 400}}
        self.assertEqual(list(audit.review([product], []))[0][6], '')
        media = [{'public_url': '/media/blue-1.jpg', 'width': 1200, 'height': 1200}]
        result = list(audit.review([product], media))[0]
        self.assertEqual(result[6], '/media/blue-1.jpg')
        self.assertTrue(result[-1].startswith('UNVERIFIED'))

    def test_scans_html_and_variant_scope_without_borrowing_other_names(self):
        product = {'sku': 'PARENT', 'description': '<img src="/media/large.jpg" width="100" height="100">',
                   'variants': [{'sku': 'BLUE', 'gallery': [{'image': {'url': '/media/blue.jpg', 'width': 50, 'height': 50}}]}]}
        media = [{'public_url': '/media/red.jpg', 'width': 1200, 'height': 1200}]
        rows = list(audit.review([product], media))
        self.assertEqual({row[0] for row in rows}, {'PARENT', 'BLUE'})
        self.assertTrue(all(not row[6] for row in rows))


if __name__ == '__main__':
    unittest.main()
