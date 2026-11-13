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
        (self.root / 'after/status.json').write_text(json.dumps({'complete': False}))
        with self.assertRaises(ValueError):
            compare(self.root)
