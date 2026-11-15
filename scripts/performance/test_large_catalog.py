"""Protocol boundary tests only: fake transport here is never application acceptance."""
import json
import os
import unittest
from unittest.mock import patch

from large_catalog import (NAME_PREFIX, QUERY, SKU_PREFIX, LargeCatalogFailure,
                           _import_report, _multipart, _row, seed_large, verify_large_pages)


class Clock:
    def __init__(self):
        self.now = 0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def report(mode, count=2, errors=0):
    return {'data': {'mode': mode, 'totalRows': count, 'okCount': count - errors,
        'warningCount': 0, 'errorCount': errors, 'skippedCount': 0,
        'rows': [{'rowNumber': index + 1, 'rowKey': f'row-{index + 1}:{SKU_PREFIX}{index:05d}',
                  'productId': f'prod-{index}' if mode == 'COMMIT' else None,
                  'action': 'CREATE', 'status': 'OK', 'errors': [], 'warnings': []} for index in range(count)]}}


def metadata(count=40):
    return {'count': count, 'query': QUERY, 'publish_status': 'DRAFT',
            'page_size': 20, 'sku_prefix': SKU_PREFIX}


def page_report(page, direction, count=40):
    indices = list(range(count)) if direction == 'asc' else list(reversed(range(count)))
    rows = [{'id': f'prod-{index}', 'sku': SKU_PREFIX + f'{index:05d}',
             'name': NAME_PREFIX + f'fixture {index:05d}', 'publishStatus': 'DRAFT'}
            for index in indices[(page - 1) * 20:page * 20]]
    return {'data': rows, 'pagination': {'page': page, 'pageSize': 20, 'totalItems': count,
            'totalPages': (count + 19) // 20, 'hasNext': page < (count + 19) // 20,
            'hasPrevious': page > 1}}


class LargeCatalogProtocolTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.fixtures = {'category': {'slug': 'e2e-perf-category'}, 'brand': {'slug': 'e2e-perf-brand'}}
        self.clock = Clock()

    def test_fixture_preserves_case_and_nfc_nfd_ties_with_distinct_skus(self):
        rows = [_row(index, 'e2e-perf-category', 'e2e-perf-brand') for index in range(6)]
        self.assertEqual(len({row['sku'] for row in rows}), 6)
        self.assertNotEqual(rows[0]['name']['nameVI'], rows[2]['name']['nameVI'])
        import unicodedata
        self.assertEqual(unicodedata.normalize('NFC', rows[0]['name']['nameVI']),
                         unicodedata.normalize('NFC', rows[2]['name']['nameVI']))
        body, headers = _multipart(rows)
        self.assertIn(rows[2]['name']['nameVI'].encode(), body)
        self.assertIn('multipart/form-data', headers['Content-Type'])

    def test_import_http_success_does_not_hide_partial_rows_or_existing_match(self):
        with self.assertRaisesRegex(ValueError, 'nonpassing_import_rows'):
            _import_report(report('COMMIT', errors=1), 2, 'COMMIT')
        existing = report('VALIDATE')
        existing['data']['rows'][0]['productId'] = 'existing-product'
        with self.assertRaisesRegex(ValueError, 'fixture_matched_existing_product'):
            _import_report(existing, 2, 'VALIDATE')
        duplicate = report('COMMIT')
        duplicate['data']['rows'][1]['productId'] = duplicate['data']['rows'][0]['productId']
        with self.assertRaisesRegex(ValueError, 'invalid_created_identity'):
            _import_report(duplicate, 2, 'COMMIT')

    def test_failed_commit_is_not_retried_and_uses_exact_validated_bytes(self):
        calls = []
        class Api:
            origin = 'http://localhost:18080'
            def call(inner, method, endpoint, payload, **kwargs):
                calls.append((endpoint, payload))
                return report('COMMIT' if endpoint.endswith('/commit') else 'VALIDATE', errors=int(endpoint.endswith('/commit'))), {}, 2
        with self.assertRaises(LargeCatalogFailure) as failure:
            seed_large(Api(), self.fixtures, lambda: True, count=2, batch_size=2,
                       _clock=self.clock, _sleep=self.clock.sleep)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][1], calls[1][1])
        self.assertGreaterEqual(self.clock.now, 1.15)
        self.assertEqual(failure.exception.summary['validated_rows'], 2)
        self.assertEqual(failure.exception.summary['committed_rows'], 0)
        self.assertEqual(failure.exception.summary['failed_batch_okCount'], 1)
        self.assertTrue(failure.exception.summary['partial_commit_possible'])
        self.assertFalse(failure.exception.summary['complete'])

    def test_resource_guard_stops_before_writes_without_exporting_exception_detail(self):
        class Api:
            origin = 'http://localhost:18080'
            def call(*_args, **_kwargs):
                raise AssertionError('Transport must not be reached')
        def unsafe():
            raise RuntimeError('private@example.invalid must not leave the callback')
        with self.assertRaises(LargeCatalogFailure) as failure:
            seed_large(Api(), self.fixtures, unsafe, count=2, _clock=self.clock, _sleep=self.clock.sleep)
        summary = failure.exception.summary
        self.assertEqual(summary['requests'], 0)
        self.assertEqual(summary['failure_code'], 'resource_collection_failed')
        self.assertNotIn('private', json.dumps(summary))

    def test_rejects_external_origin_and_oversized_fixture_before_requests(self):
        class Api:
            origin = 'https://example.com'
        with self.assertRaises(ValueError):
            seed_large(Api(), self.fixtures, lambda: True, count=10001)
        with self.assertRaises(ValueError):
            seed_large(Api(), self.fixtures, lambda: True, count=2)

    def test_rate_limit_does_not_trigger_retry_or_raw_error_export(self):
        class Api:
            origin = 'http://localhost:18080'
            def call(*_args, **_kwargs):
                raise AssertionError('POST /api/v1/admin/products/import/validate unexpected status 429')
        with self.assertRaises(LargeCatalogFailure) as failure:
            seed_large(Api(), self.fixtures, lambda: True, count=2, _clock=self.clock, _sleep=self.clock.sleep)
        self.assertEqual(failure.exception.summary['requests'], 1)
        self.assertEqual(failure.exception.summary['failed_http_status'], 429)
        self.assertEqual(failure.exception.summary['failure_code'], 'rate_limited')

    def test_long_seed_renews_only_through_normal_auth_callback(self):
        clock, renewals = self.clock, []
        class Api:
            origin = 'http://localhost:18080'
            def call(inner, method, endpoint, *_args, **_kwargs):
                clock.now += 451
                return report('COMMIT' if endpoint.endswith('/commit') else 'VALIDATE', count=1), {}, 451000
        def renew():
            renewals.append(clock.now)
            return Api()
        result = seed_large(Api(), self.fixtures, lambda: True, renew, count=1, batch_size=1,
                            _clock=clock, _sleep=clock.sleep)
        self.assertTrue(result['summary']['complete'])
        self.assertEqual(result['summary']['committed_rows'], 1)
        self.assertEqual(renewals, [451, 902])

    def test_distinct_sample_pages_must_not_reuse_an_identity(self):
        from urllib.parse import parse_qs, urlsplit
        class Api:
            origin = 'http://localhost:18080'
            def call(inner, method, endpoint, *_args, **_kwargs):
                query = parse_qs(urlsplit(endpoint).query)
                page = int(query['page'][0])
                result = page_report(page, 'asc')
                if page == 2:
                    result['data'][0]['id'] = 'prod-0'
                return result, {}, 3
        with self.assertRaises(LargeCatalogFailure) as failure:
            verify_large_pages(Api(), metadata(), lambda: True,
                               _clock=self.clock, _sleep=self.clock.sleep)
        self.assertEqual(failure.exception.summary['failure_code'], 'overlap_between_distinct_pages')

    def test_sampled_page_hashes_are_repeatable_and_contain_no_raw_products(self):
        from urllib.parse import parse_qs, urlsplit
        class Api:
            origin = 'http://localhost:18080'
            def call(inner, method, endpoint, *_args, **_kwargs):
                query = parse_qs(urlsplit(endpoint).query)
                return page_report(int(query['page'][0]), query['sort'][0].split(':')[1]), {}, 3
        result = verify_large_pages(Api(), metadata(), lambda: True,
                                    _clock=self.clock, _sleep=self.clock.sleep)
        self.assertTrue(result['complete'])
        self.assertEqual(len(result['page_identities']), 4)
        self.assertEqual(result['requests'], 8)
        self.assertNotIn('prod-', json.dumps(result))
        self.assertTrue(all(len(row['sha256']) == 64 for row in result['page_identities']))

    def test_changed_page_cannot_pass_stability_check(self):
        class Api:
            origin = 'http://localhost:18080'
            calls = 0
            def call(inner, *_args, **_kwargs):
                inner.calls += 1
                result = page_report(1, 'asc')
                if inner.calls == 2:
                    result['data'][0]['name'] += ' changed'
                return result, {}, 3
        with self.assertRaises(LargeCatalogFailure) as failure:
            verify_large_pages(Api(), metadata(), lambda: True,
                               _clock=self.clock, _sleep=self.clock.sleep)
        self.assertEqual(failure.exception.summary['failure_code'], 'repeated_page_unstable')
