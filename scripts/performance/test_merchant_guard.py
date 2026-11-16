"""Offline boundary/parser tests; these do not count as real Merchant acceptance."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from merchant_checks import (_feed, _guard, _identity, _local_inventory, _owned_product,
                             _selected_offers, _store_code, _write_private)
from stack_checks import Api


HEADERS = {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store',
           'X-Robots-Tag': 'noindex', 'X-Merchant-Item-Count': '2', 'X-Merchant-Product-Count': '1',
           'X-Merchant-Generated-At': '2026-11-16T00:00:00.000Z'}
PRODUCT = {'id': 'prod-owned', 'sku': 'E2E-MER-1-1', 'slug': 'e2e-product-merchant-1-1',
           'image': {'url': '/media/uploads/owned/photo.jpg'},
           'variants': [{'id': 'var-in', 'sku': 'E2E-MER-1-1-IN', 'isAvailable': True,
                         'price': {'retailPrice': 200000, 'salePrice': 180000},
                         'options': [{'name': 'E2E_ATTRIBUTE_MERCHANT_1-1', 'value': 'E2E_ATTRIBUTE_VALUE_A'}]},
                        {'id': 'var-out', 'sku': 'E2E-MER-1-1-OUT', 'isAvailable': False,
                         'price': {'retailPrice': 250000, 'salePrice': 210000},
                         'options': [{'name': 'E2E_ATTRIBUTE_MERCHANT_1-1', 'value': 'E2E_ATTRIBUTE_VALUE_B'}]}]}


def xml():
    items = []
    for row in PRODUCT['variants']:
        fields = {'id': row['sku'], 'link': 'http://localhost:13000/product/' + PRODUCT['slug'] + '/?variant=' + row['id'],
                  'price': str(row['price']['retailPrice']) + ' VND',
                  'sale_price': str(row['price']['salePrice']) + ' VND',
                  'image_link': 'http://localhost:13000/media/uploads/owned/photo.jpg',
                  'availability': 'in_stock' if row['isAvailable'] else 'out_of_stock', 'item_group_id': PRODUCT['id']}
        fields = ''.join('<g:' + key + '>' + value + '</g:' + key + '>' for key, value in fields.items())
        option = row['options'][0]
        items.append('<item>' + fields + '<g:variant_option><g:name>' + option['name'] + '</g:name><g:value>'
                     + option['value'] + '</g:value></g:variant_option></item>')
    return ('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>'
            + ''.join(items) + '</channel></rss>').encode()


class MerchantGuardTest(unittest.TestCase):
    def test_guard_refuses_local_or_shared_targets_before_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            env = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted', 'RUNNER_TEMP': temp}
            root, private = Path(temp) / 'source', Path(temp) / 'private'
            with patch.dict(os.environ, env, clear=True):
                self.assertEqual(_guard(root, Api('http://localhost:18080'), private, env, True), (root, private))
                for origin, done in (('http://localhost:8080', True), ('http://localhost:18080', False),
                                     ('http://localhost:14000', True)):
                    with self.assertRaises(ValueError):
                        _guard(root, Api(origin), private, env, done)
                with self.assertRaises(ValueError):
                    _guard(Path(temp), Api('http://localhost:18080'), private, env, True)
            with self.assertRaises(ValueError):
                _guard(root, Api('http://localhost:18080'), private, {}, True)

    def test_identity_is_exact_owned_and_bounded(self):
        identity = _identity({'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '2'})
        self.assertTrue(identity['name'].startswith('E2E_PRODUCT_MERCHANT_'))
        self.assertLessEqual(len(identity['sku'] + '-OUT'), 50)
        for bad in ('', '../shop', '1;echo secret', '9' * 21):
            with self.assertRaises(ValueError):
                _identity({'GITHUB_RUN_ID': bad, 'GITHUB_RUN_ATTEMPT': '1'})

    def test_publish_requires_exact_new_product_ownership(self):
        identity = _identity({'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'})
        product = {'id': 'new', **identity}
        _owned_product(product, identity)
        for key in ('name', 'slug', 'sku', 'id'):
            modified = {**product, key: ''}
            with self.assertRaises(ValueError):
                _owned_product(modified, identity)

    def test_valid_namespaced_feed_matches_both_real_variants(self):
        offers = _feed(xml(), HEADERS)
        self.assertEqual(len(_selected_offers(offers, PRODUCT)), 2)
        self.assertEqual({row['availability'] for row in offers}, {'in_stock', 'out_of_stock'})

    def test_partial_headers_and_duplicate_sku_cannot_pass(self):
        for headers in ({**HEADERS, 'X-Merchant-Item-Count': '3'},
                        {**HEADERS, 'X-Merchant-Product-Count': '2'},
                        {**HEADERS, 'Cache-Control': 'public'},
                        {**HEADERS, 'X-Merchant-Generated-At': 'not-a-time'}):
            with self.assertRaises(ValueError):
                _feed(xml(), headers)
        with self.assertRaises(ValueError):
            _feed(xml().replace(b'E2E-MER-1-1-OUT', b'e2e-mer-1-1-in'), HEADERS)

    def test_unsafe_xml_or_invalid_money_and_options_fail(self):
        for body in (b'<!DOCTYPE rss>' + xml(), b'<!ENTITY remote "file:///etc/passwd">' + xml(),
                     xml().replace(b'200000 VND', b'200000.5 VND'),
                     xml().replace(b'180000 VND', b'300000 VND'),
                     xml().replace(b'<g:name>E2E_ATTRIBUTE_MERCHANT_1-1</g:name>', b'<g:name></g:name>')):
            with self.assertRaises(ValueError):
                _feed(body, HEADERS)

    def test_landing_links_cannot_escape_or_select_another_variant(self):
        for link in ('https://bigbike.vn/product/e2e-product-merchant-1-1/?variant=var-in',
                     'http://localhost:8080/product/e2e-product-merchant-1-1/?variant=var-in',
                     'http://localhost:13000/product/e2e-product-merchant-1-1/?variant=var-other',
                     'http://localhost:13000/product/e2e-product-merchant-1-1/?variant=var-in&variant=var-out',
                     'http://localhost:13000/product/e2e-product-merchant-1-1/?variant=var-in#private'):
            offers = _feed(xml(), HEADERS)
            offers[0]['link'] = link
            with self.assertRaises(ValueError):
                _selected_offers(offers, PRODUCT)

    def test_other_image_price_stock_or_group_cannot_pass(self):
        for key, value in (('image', 'https://external.invalid/photo.jpg'),
                           ('image', 'http://localhost:13000/media/uploads/another/photo.jpg'),
                           ('price', '200001 VND'), ('availability', 'out_of_stock'), ('group', 'other')):
            offers = _feed(xml(), HEADERS)
            offers[0][key] = value
            with self.assertRaises(ValueError):
                _selected_offers(offers, PRODUCT)

    def test_store_code_is_never_invented_or_normalized(self):
        self.assertEqual(_store_code('ACTUAL_CONFIGURED_CODE'), 'ACTUAL_CONFIGURED_CODE')
        for code in (None, '', ' example ', 'a\tb', 'a\nb', 'x' * 65):
            with self.assertRaises(ValueError):
                _store_code(code)

    def test_raw_files_are_private_and_cannot_overwrite_an_existing_file(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'private.json'
            _write_private(path, '{}')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                _write_private(path, 'replacement')
            self.assertEqual(path.read_text(), '{}')

    def test_local_inventory_matches_xml_and_never_adds_quantity(self):
        offers = _feed(xml(), HEADERS)
        headers = {'Content-Type': 'text/tab-separated-values', 'Cache-Control': 'no-store'}
        body = ('store_code\tid\tavailability\tprice\n'
                + '\n'.join('ACTUAL_CONFIGURED_CODE\t' + row['id'] + '\t' + row['availability']
                            + '\t' + row['salePrice'] for row in offers) + '\n').encode()
        _local_inventory(body, headers, offers, 'ACTUAL_CONFIGURED_CODE')
        for invalid in (body.replace(b'180000 VND', b'200000 VND'),
                        body.replace(b'store_code\tid\tavailability\tprice', b'store_code\tid\tavailability\tprice\tquantity'),
                        body.replace(b'ACTUAL_CONFIGURED_CODE', b'OTHER')):
            with self.assertRaises(ValueError):
                _local_inventory(invalid, headers, offers, 'ACTUAL_CONFIGURED_CODE')


if __name__ == '__main__':
    unittest.main()
