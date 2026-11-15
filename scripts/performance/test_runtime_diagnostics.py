import json
import os
import unittest
from unittest.mock import Mock, patch

from runtime_diagnostics import collect, service_state, signatures


class RuntimeDiagnosticsTest(unittest.TestCase):
    def test_private_text_is_reduced_to_fixed_vocabulary(self):
        private = 'private-runtime-payload-never-export'
        result = signatures('TypeError: Cannot read properties of undefined (reading "map") '
                            'ECONNREFUSED ' + private + ' (reading "' + private + '")')
        self.assertEqual(result, ['node_type_error', 'connection_refused', 'undefined_property_map'])
        self.assertNotIn(private, json.dumps(result))

    def test_service_metadata_excludes_environment_error_and_health_logs(self):
        project = 'bbperf-123-1-before'
        private = 'private-runtime-payload-never-export'
        item = {'Config': {'Labels': {'com.docker.compose.project': project,
                                     'com.docker.compose.service': 'bigbike-web'}, 'Env': [private]},
                'State': {'Running': True, 'OOMKilled': False, 'ExitCode': 0, 'Status': 'running',
                          'Error': private, 'Health': {'Status': 'healthy', 'Log': [private]}}}
        name, result = service_state(project, item)
        self.assertEqual(name, 'bigbike-web')
        self.assertTrue(result['running'])
        self.assertEqual(result['health'], 'healthy')
        self.assertNotIn(private, json.dumps(result))
        item['Config']['Labels']['com.docker.compose.project'] = 'bigbike'
        with self.assertRaises(ValueError):
            service_state(project, item)

    def test_no_local_or_foreign_container_commands(self):
        stack, run = Mock(), Mock()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                collect(stack, run)
        run.assert_not_called()

    def test_container_stderr_is_classified_without_exporting_raw_output(self):
        cid, project = 'a' * 64, 'bbperf-123-1-before'
        item = {'Id': cid, 'Config': {'Labels': {'com.docker.compose.project': project,
                                                'com.docker.compose.service': 'bigbike-web'}},
                'State': {'Running': True, 'Status': 'running', 'ExitCode': 0}}
        stack = Mock(project=project)
        stack.compose_command.return_value = ['docker', 'compose', 'ps', '--all', '-q']
        run = Mock(side_effect=[cid, json.dumps([item]), 'Error PRODUCT_TEMPORARILY_UNAVAILABLE private-payload'])
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True):
            result = collect(stack, run)
        self.assertEqual(result['services']['bigbike-web']['error_signature_codes'], ['product_read_unavailable'])
        self.assertNotIn('private-payload', json.dumps(result))
        self.assertTrue(run.call_args.kwargs['combine_output'])
