import argparse
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('monitor', Path(__file__).parents[1] / 'run-storefront-monitor.py')
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / 'config.json'
        self.config.write_text(json.dumps({'checks': {
            'home': {'url': 'https://bigbike.vn/', 'marker': 'Bigbike'},
            'product': {'url': 'https://bigbike.vn/product/real/', 'marker': 'SKU'},
            'feed': {'url': 'https://bigbike.vn/google-merchant.xml'},
        }}))
        self.credentials = self.root / 'credentials.json'
        self.credentials.write_text(json.dumps({'bot_token': 'secret-never-logged', 'chat_id': 'confirmed-group'}))
        self.args = argparse.Namespace(config=self.config, state=self.root / 'state.json', credentials=self.credentials, dry_run=False, test_event=None)

    def run_probe(self, failed=(), sender=None):
        def probe(kind, url, marker):
            return {'target': kind, 'errors': ['SOURCE_UNAVAILABLE'] if kind in failed else [], 'seconds': 0.01}
        with patch.object(monitor.uptime, 'probe', side_effect=probe), patch.object(monitor, 'send_telegram', side_effect=sender) as send, contextlib.redirect_stdout(io.StringIO()):
            code = monitor.run(self.args)
        return code, send

    def test_no_startup_spam_then_failure_once_and_recovery(self):
        code, send = self.run_probe()
        self.assertEqual(code, 0)
        send.assert_not_called()
        code, send = self.run_probe(('product',))
        self.assertEqual(code, 1)
        self.assertIn('product', send.call_args.args[1])
        self.run_probe(('product',))[1].assert_not_called()
        code, send = self.run_probe()
        self.assertIn('Đã khôi phục: product', send.call_args.args[1])
        self.assertEqual(code, 0)
        self.run_probe()[1].assert_not_called()

    def test_delivery_failure_retains_state_and_retries_next_minute(self):
        self.run_probe()
        previous = self.args.state.read_text()
        with self.assertRaises(OSError):
            self.run_probe(('feed',), sender=OSError('contains secret'))
        self.assertEqual(self.args.state.read_text(), previous)
        self.run_probe(('feed',))[1].assert_called_once()
        with self.assertRaises(OSError):
            self.run_probe(sender=OSError('recovery not delivered'))
        self.run_probe()[1].assert_called_once()

    def test_targets_are_independent(self):
        self.run_probe(('home',))
        _, send = self.run_probe(('feed',))
        text = send.call_args.args[1]
        self.assertIn('feed (SOURCE_UNAVAILABLE)', text)
        self.assertIn('Đã khôi phục: home', text)

    def test_dry_run_needs_no_credentials_and_does_not_change_state(self):
        self.credentials.unlink()
        self.args.dry_run = True
        self.run_probe(('product',))[1].assert_not_called()
        self.assertFalse(self.args.state.exists())

    def test_test_events_label_simulation_and_do_not_probe_or_change_state(self):
        for event in ('outage', 'recovery'):
            self.args.test_event = event
            with patch.object(monitor.uptime, 'probe') as probe, patch.object(monitor, 'send_telegram') as send, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(monitor.run(self.args), 0)
                self.assertIn('THỬ NGHIỆM', send.call_args.args[1])
                probe.assert_not_called()
                self.assertFalse(self.args.state.exists())

    def test_main_never_prints_sensitive_exception_and_does_not_claim_delivery(self):
        with patch('sys.argv', ['monitor', '--config', str(self.config), '--dry-run']), patch.object(monitor, 'run', side_effect=OSError('botTOKEN-secret')), contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(monitor.main(), 2)
            self.assertNotIn('botTOKEN', out.getvalue())
            self.assertEqual(json.loads(out.getvalue())['error'], 'CONFIG_STATE_OR_DELIVERY_FAILED')

    def test_rejects_missing_target_and_untrusted_credentials_in_target_url(self):
        cfg = json.loads(self.config.read_text())
        cfg['checks']['home']['url'] = 'https://user:secret@bigbike.vn/'
        self.config.write_text(json.dumps(cfg))
        with self.assertRaises(ValueError):
            monitor.load_targets(self.config)
        del cfg['checks']['home']
        self.config.write_text(json.dumps(cfg))
        with self.assertRaises(ValueError):
            monitor.load_targets(self.config)


if __name__ == '__main__':
    unittest.main()
