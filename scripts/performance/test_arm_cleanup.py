import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

from run_ci import finalize_arm


class ArmCleanupTest(unittest.TestCase):
    def test_original_failure_survives_relay_and_docker_cleanup_failures(self):
        stack = Mock(started=True)
        stack.relays.close.side_effect = RuntimeError('private-relay-error')
        stack.relays.stats.return_value = {}
        stack.compose.side_effect = RuntimeError('private-docker-error')
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, '^original-failure$'):
                try:
                    raise ValueError('original-failure')
                finally:
                    finalize_arm(stack, Path(tmp), {'complete': False}, sys.exc_info()[0] is not None)
            status = json.loads(Path(tmp, 'status.json').read_text())
        stack.compose.assert_called_once_with('down', '--volumes', '--remove-orphans', '--timeout', '10')
        self.assertEqual(status['completion_failure_codes'], ['relay_shutdown_failed', 'owned_stack_cleanup_failed'])
        self.assertNotIn('private-', json.dumps(status))

    def test_disk_failure_cannot_skip_any_owned_cleanup_or_mask_original(self):
        stack = Mock(started=True)
        stack.relays.stats.return_value = {}
        with patch('run_ci.write_json', side_effect=OSError('private-filesystem-error')):
            finalize_arm(stack, Path('/unused'), {'complete': False}, original_error=True)
        stack.relays.close.assert_called_once()
        stack.compose.assert_called_once()

    def test_cleanup_failure_fails_an_otherwise_successful_arm(self):
        stack = Mock(started=True)
        stack.relays.close.side_effect = RuntimeError('private-cleanup-error')
        stack.relays.stats.return_value = {}
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(RuntimeError, '^CI arm cleanup or evidence recording failed$'):
                finalize_arm(stack, Path(tmp), {'complete': True})
            self.assertFalse(json.loads(Path(tmp, 'status.json').read_text())['complete'])
        stack.compose.assert_called_once()
