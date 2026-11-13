import tempfile
from pathlib import Path
import unittest
from ci_guard import require_ci, loopback_url, project_name, safe_directory
from fixtures import png


class CiIsolationTest(unittest.TestCase):
    def test_requires_hosted_runner(self):
        for env in ({}, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'self-hosted'}):
            with self.assertRaises(ValueError):
                require_ci(env)
        require_ci({'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'})

    def test_owned_projects_only(self):
        self.assertEqual(project_name('bbperf-123-1-after'), 'bbperf-123-1-after')
        for name in ('bigbike', 'bbperf', 'bbperf-123-1-after --all', 'bbperf-123-1-prod'):
            with self.assertRaises(ValueError):
                project_name(name)

    def test_origins_and_paths(self):
        self.assertEqual(loopback_url('http://localhost:18080/'), 'http://localhost:18080')
        for value in ('https://bigbike.vn', 'http://localhost:8080', 'http://user:secret@localhost:18080',
                      'http://localhost:18080?target=prod', 'http://localhost:18080/path'):
            with self.assertRaises(ValueError):
                loopback_url(value)
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(safe_directory(Path(tmp) / 'child', tmp), Path(tmp) / 'child')
            for path in (tmp, Path(tmp) / '..'):
                with self.assertRaises(ValueError):
                    safe_directory(path, tmp)

    def test_media_png_is_deterministic_and_has_alpha(self):
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / 'a.png', Path(tmp) / 'b.png'
            png(a, 2, 3, True)
            png(b, 2, 3, True)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            self.assertEqual(a.read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
            import struct, zlib
            raw = a.read_bytes()
            self.assertEqual(struct.unpack('!II', raw[16:24]), (2, 3))
            size = struct.unpack('!I', raw[33:37])[0]
            self.assertIn(bytes([64, 128, 192, 96]), zlib.decompress(raw[41:41 + size]))
