import subprocess
import unittest
from unittest.mock import patch

from run_ci import CommandFailure, run


class CommandDiagnosticsTest(unittest.TestCase):
    def test_registry_and_network_failures_are_distinguishable_without_raw_logs(self):
        for message, category in (
            ('pull access denied for minio/minio, authentication required', 'registry_authentication'),
            ('manifest unknown', 'registry_manifest'),
            ('toomanyrequests: You have reached your pull rate limit', 'registry_rate_limit'),
            ('TLS handshake timeout', 'registry_transport'),
            ('Pool overlaps with other one on this address space', 'docker_network_overlap'),
            ('service api refers to undefined network example', 'compose_config'),
        ):
            with self.subTest(category=category):
                secret_marker = 'generated-private-value-do-not-publish'
                result = subprocess.CompletedProcess([], 1, secret_marker, message + secret_marker)
                with patch('run_ci.subprocess.run', return_value=result):
                    with self.assertRaises(CommandFailure) as raised:
                        run(['docker', secret_marker])
                self.assertIn(category, raised.exception.categories)
                self.assertNotIn(secret_marker, str(raised.exception))
                self.assertNotIn(message, str(raised.exception))

    def test_unclassified_failure_does_not_publish_captured_output(self):
        with patch('run_ci.subprocess.run', return_value=subprocess.CompletedProcess([], 1, 'private-out', 'private-err')):
            with self.assertRaises(CommandFailure) as raised:
                run(['docker', 'private-argument'])
        self.assertEqual(raised.exception.categories, [])
        self.assertEqual(str(raised.exception), 'Command failed: docker; exit=1; categories=')
