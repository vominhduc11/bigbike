import base64
import gzip
import json
from pathlib import Path
import tempfile
import unittest
from publish_results import bundle


class PublishResultsTest(unittest.TestCase):
    def test_only_sanitized_known_reports_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, 'status.json').write_text('{"complete":false}')
            lines = bundle(tmp)
            packed = base64.b64decode(''.join(line.removeprefix('BBPERF-DATA ') for line in lines[1:-1]))
            self.assertEqual(json.loads(gzip.decompress(packed)), {'status.json': {'complete': False}})

    def test_rejects_private_filename_and_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, 'session.json')
            path.write_text('{}')
            with self.assertRaises(ValueError):
                bundle(tmp)
            path.unlink()
            Path(tmp, 'status.json').symlink_to('/dev/null')
            with self.assertRaises(ValueError):
                bundle(tmp)

    def test_missing_directory_reports_empty_without_raw_diagnostics(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(bundle(Path(tmp, 'absent'))[0].startswith('BBPERF-BEGIN '))
