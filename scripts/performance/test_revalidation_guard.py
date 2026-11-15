import os
from unittest.mock import Mock, call, patch
import unittest
from revalidation_checks import Headings, verify_revalidation


class RevalidationGuardTest(unittest.TestCase):
    def fixture(self):
        product = {'id': 'owned-product-6', 'slug': 'e2e-perf-product-0006',
                   'name': 'E2E_PERF_Tên gốc',
                   'translations': {'en': {'name': 'E2E_PERF_Exact stored English'}}}
        return product, {'products': [{}] * 6 + [product]}

    def test_refuses_local_writes_and_unowned_fixture_before_calls(self):
        api = Mock()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                verify_revalidation(api, {})
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True):
            with self.assertRaises(ValueError):
                verify_revalidation(api, {'products': [{}] * 7})
        self.assertEqual(api.mock_calls, [])

    def test_reads_owned_detail_and_preserves_english_in_edit_and_restore(self):
        product, fixtures = self.fixture()
        api, web = Mock(), Mock()
        api.data.return_value = product
        # Keep the real helper's response tuple and HTML parser, replacing only
        # protocol transport; no mocked response enters an application or lab.
        web.call.side_effect = [(None, {}, 0)] + [(body, {}, 0) for body in [
            ('<h1>' + product['name'] + '</h1>').encode(),
            '<h1>E2E_PERF_Đã làm mới nội bộ</h1>'.encode(),
            ('<h1>' + product['name'] + '</h1>').encode()]]
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True), \
                patch('revalidation_checks.Api', return_value=web), patch('revalidation_checks.time.sleep'):
            result = verify_revalidation(api, fixtures)
        self.assertTrue(result['fixture_restored'])
        self.assertEqual(api.mock_calls, [
            call.data('GET', '/api/v1/admin/products/owned-product-6'),
            call.call('PATCH', '/api/v1/admin/products/owned-product-6',
                      {'name': 'E2E_PERF_Đã làm mới nội bộ', 'translations': product['translations']}),
            call.call('PATCH', '/api/v1/admin/products/owned-product-6',
                      {'name': product['name'], 'translations': product['translations']})])

    def test_restores_and_verifies_original_after_failed_change_request(self):
        product, fixtures = self.fixture()
        api, web = Mock(), Mock()
        api.data.return_value = product
        api.call.side_effect = [AssertionError('Change response failed'), (None, {}, 0)]
        original = ('<h1>' + product['name'] + '</h1>').encode()
        web.call.side_effect = [(None, {}, 0), (original, {}, 0), (original, {}, 0)]
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True), \
                patch('revalidation_checks.Api', return_value=web), patch('revalidation_checks.time.sleep'):
            with self.assertRaisesRegex(AssertionError, 'Change response failed'):
                verify_revalidation(api, fixtures)
        self.assertEqual(api.call.call_args_list[-1],
            call('PATCH', '/api/v1/admin/products/owned-product-6',
                 {'name': product['name'], 'translations': product['translations']}))
        self.assertEqual(web.call.call_count, 3)

    def test_missing_english_or_wrong_detail_never_mutates(self):
        for change in ({'translations': None}, {'translations': {'en': {'name': '  '}}},
                       {'id': 'other-product'}, {'slug': 'other-product'}, {'name': 'Other product'}):
            product, fixtures = self.fixture()
            api = Mock()
            api.data.return_value = {**product, **change}
            with self.subTest(change=change), patch.dict(os.environ,
                    {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True):
                with self.assertRaises(ValueError):
                    verify_revalidation(api, fixtures)
            api.call.assert_not_called()

    def test_restores_after_changed_heading_read_fails(self):
        product, fixtures = self.fixture()
        api, web = Mock(), Mock()
        api.data.return_value = product
        original = ('<h1>' + product['name'] + '</h1>').encode()
        web.call.side_effect = [(None, {}, 0), (original, {}, 0),
                                AssertionError('Changed heading unavailable'), (original, {}, 0)]
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True), \
                patch('revalidation_checks.Api', return_value=web), patch('revalidation_checks.time.sleep'):
            with self.assertRaisesRegex(AssertionError, 'Changed heading unavailable'):
                verify_revalidation(api, fixtures)
        self.assertEqual(api.call.call_args_list[-1],
            call('PATCH', '/api/v1/admin/products/owned-product-6',
                 {'name': product['name'], 'translations': product['translations']}))
        self.assertEqual(web.call.call_count, 4)

    def test_reads_visible_heading_text_without_matching_serialized_private_payload(self):
        parsed = Headings()
        parsed.feed('<script>hidden_name</script><h1>Visible <span>product</span></h1>')
        self.assertEqual(''.join(parsed.text), 'Visible product')
