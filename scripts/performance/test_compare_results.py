import json
from pathlib import Path
import tempfile
import unittest

from compare_results import compare


class ComparisonIntegrityTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        for arm in ('before', 'after'):
            path = self.root / arm
            path.mkdir()
            (path / 'dataset-identity.json').write_text(json.dumps({'database_archive_sha256': 'fixture-hash', 'media_manifest_sha256': 'media-hash'}))
            (path / 'status.json').write_text(json.dumps({'complete': True}))
            (path / 'runtime-identity.json').write_text(json.dumps({
                'configuration_sha256': 'same-generated-fixture-configuration',
                'limits': {'backend': {'memory_bytes': 2147483648, 'nano_cpus': 0}}}))
            row = {'phase': 'measurement', 'path': '/api/v1/settings/public', 'concurrency': 1,
                   'requests': 100, 'non_2xx_or_network_error_rate': 0,
                   'latency_ms_2xx_only': {'p95': 10}, 'successful_requests_per_second': 2}
            (path / 'api.json').write_text(json.dumps({'stopped': False, 'results': [row, dict(row)]}))

    def mutate_after(self, change):
        path = self.root / 'after/api.json'
        report = json.loads(path.read_text())
        change(report)
        path.write_text(json.dumps(report))

    def test_equal_workloads_report_repeat_medians_without_claiming_pooled_tails(self):
        report = compare(self.root)
        self.assertEqual(report['api'][0]['after']['successful_requests'], 200)
        self.assertIn('not a pooled P95', report['note'])

    def test_refuses_fast_failures_instead_of_reporting_a_latency_win(self):
        self.mutate_after(lambda report: report['results'][0].update(non_2xx_or_network_error_rate=.5,
            latency_ms_2xx_only={'p95': .1}))
        with self.assertRaises(ValueError):
            compare(self.root)
        self.assertFalse((self.root / 'comparison.json').exists())

    def test_refuses_missing_repeats_or_incomplete_arm(self):
        self.mutate_after(lambda report: report['results'].pop())
        with self.assertRaises(ValueError):
            compare(self.root)

    def test_refuses_missing_or_changed_dataset_identity(self):
        path = self.root / 'after/dataset-identity.json'
        path.unlink()
        with self.assertRaises(ValueError):
            compare(self.root)
        path.write_text(json.dumps({'database_archive_sha256': 'different'}))
        with self.assertRaises(ValueError):
            compare(self.root)
        path.write_text((self.root / 'before/dataset-identity.json').read_text())
        (self.root / 'after/status.json').write_text(json.dumps({'complete': False}))
        with self.assertRaises(ValueError):
            compare(self.root)

    def test_large_dataset_requires_completed_equal_sampled_page_proof(self):
        for arm in ('before', 'after'):
            path = self.root / arm / 'dataset-identity.json'
            value = json.loads(path.read_text())
            value['large_catalog_count'] = 10000
            path.write_text(json.dumps(value))
        with self.assertRaises(ValueError):
            compare(self.root)

        proof = {'complete': True, 'count': 10000,
                 'page_identities': [{'page': 1, 'direction': 'asc', 'sha256': 'same-rows'}]}
        for arm in ('before', 'after'):
            (self.root / arm / 'large-catalog-pages.json').write_text(json.dumps(proof))
        self.assertTrue(compare(self.root)['sampled_large_pages_equivalent'])
        proof['page_identities'][0]['sha256'] = 'different-order'
        (self.root / 'after/large-catalog-pages.json').write_text(json.dumps(proof))
        with self.assertRaises(ValueError):
            compare(self.root)

    def test_refuses_missing_or_mismatched_runtime_configuration(self):
        path = self.root / 'after/runtime-identity.json'
        original = path.read_text()
        path.unlink()
        with self.assertRaises(ValueError):
            compare(self.root)
        value = json.loads(original)
        value['limits']['backend']['memory_bytes'] = 1073741824
        path.write_text(json.dumps(value))
        with self.assertRaises(ValueError):
            compare(self.root)
