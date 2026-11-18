"""Isolated launcher checks; no running shop services are contacted."""
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from run_ci import wait_for_web_startup


ROOT = Path(__file__).resolve().parents[2]


class WebStartupTest(unittest.TestCase):
    def test_launcher_runs_real_startup_entrypoint_in_both_standalone_layouts(self):
        for nested in (False, True):
            with self.subTest(nested=nested), tempfile.TemporaryDirectory(prefix='bbperf-web-startup-') as temp:
                root = Path(temp)
                app = root / 'bigbike-web' if nested else root
                app.mkdir(exist_ok=True)
                shutil.copy2(ROOT / 'scripts/performance/launch-web.cjs', root)
                shutil.copy2(ROOT / 'bigbike-web/docker-entrypoint.mjs', app)
                (app / 'server.js').write_text('''
const http = require('node:http'), fs = require('node:fs');
http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') return res.end('ready');
  if (req.method === 'POST' && req.url === '/api/revalidate') {
    let data = ''; req.on('data', part => data += part); req.on('end', () => {
      fs.writeFileSync(process.env.PROOF_FILE, JSON.stringify({
        authenticated: req.headers['x-revalidate-secret'] === process.env.REVALIDATE_SECRET,
        tags: JSON.parse(data).tags
      })); res.end('ok');
    }); return;
  }
  res.statusCode = 404; res.end();
}).listen(Number(process.env.PORT), '127.0.0.1');
''')
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0))
                    port = sock.getsockname()[1]
                proof = root / 'proof.json'
                env = {**os.environ, 'PORT': str(port), 'REVALIDATE_SECRET': 'fixture-only-secret', 'PROOF_FILE': str(proof)}
                proc = subprocess.Popen(['node', str(root / 'launch-web.cjs')], cwd=root, env=env,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
                try:
                    deadline = time.monotonic() + 10
                    while not proof.exists() and proc.poll() is None and time.monotonic() < deadline:
                        time.sleep(.05)
                    self.assertTrue(proof.exists(), 'Production entrypoint did not refresh after startup')
                    observed = json.loads(proof.read_text())
                    self.assertTrue(observed['authenticated'])
                    self.assertIn('sliders', observed['tags'])
                    self.assertIn('products', observed['tags'])
                finally:
                    os.killpg(proc.pid, signal.SIGTERM)
                    proc.wait(timeout=5)

    def test_missing_production_entrypoint_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix='bbperf-web-startup-') as temp:
            root = Path(temp)
            shutil.copy2(ROOT / 'scripts/performance/launch-web.cjs', root)
            (root / 'server.js').write_text('process.exit(0);')
            result = subprocess.run(['node', str(root / 'launch-web.cjs')], capture_output=True, timeout=5)
            self.assertNotEqual(result.returncode, 0)

    def test_ci_gate_accepts_only_observed_success_without_exporting_logs(self):
        stack = Mock()
        stack.compose.return_value = 'private-log [entrypoint] startup revalidate → HTTP 200'
        wait_for_web_startup(stack)
        stack.compose.return_value = 'private-log [entrypoint] startup revalidate → HTTP 500'
        with self.assertRaisesRegex(RuntimeError, '^Production web startup refresh failed$'):
            wait_for_web_startup(stack)
        stack.compose.return_value = 'private-log'
        with patch('run_ci.time.monotonic', side_effect=[0, 2]):
            with self.assertRaisesRegex(RuntimeError, '^Production web startup refresh not observed$'):
                wait_for_web_startup(stack, seconds=1)


if __name__ == '__main__':
    unittest.main()
