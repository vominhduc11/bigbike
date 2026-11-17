import json
import os
import unittest
from unittest.mock import Mock, patch

from runtime_diagnostics import collect, service_state, signatures, transport_state


class RuntimeDiagnosticsTest(unittest.TestCase):
    def test_async_and_proxy_failures_are_fixed_codes_without_log_values(self):
        private = 'private-path-token-cookie-body'
        for log, expected in (
            ('AsyncRequestNotUsableException ' + private, 'async_response_unusable'),
            ('upstream sent too big header ' + private, 'proxy_header_too_large'),
            ('upstream sent invalid header ' + private, 'proxy_invalid_header'),
            ('upstream sent invalid status ' + private, 'proxy_invalid_status'),
            ('upstream sent duplicate header ' + private, 'proxy_duplicate_header'),
            ('upstream sent no valid HTTP ' + private, 'proxy_no_valid_http'),
            ('invalid chunked response ' + private, 'proxy_invalid_chunked'),
            ('upstream prematurely closed connection ' + private, 'proxy_upstream_closed_early'),
            ('bigbike-backend could not be resolved ' + private, 'proxy_dns_failure'),
            ('open() failed (13: Permission denied) ' + private, 'filesystem_io_failure'),
            ('upstream sent "Content-Length" and "Transfer-Encoding" headers at the same time ' + private,
             'proxy_conflicting_length_headers'),
        ):
            result = signatures(log)
            self.assertIn(expected, result)
            self.assertNotIn(private, json.dumps(result))

    def test_pre_cleanup_relay_counters_exclude_arbitrary_values(self):
        row = dict(accepted=1, active=0, capacity_rejected=0, connect_failed=0, transport_failed=1, idle_timeout=0)
        result = transport_state({'18080': {**row, 'private-cookie': 'private-value'}})
        self.assertEqual(result, {'18080': row})
        self.assertNotIn('private', json.dumps(result))
        for bad in ({'8080': row}, {'18080': {**row, 'active': -1}}, {'18080': {**row, 'active': 'private-value'}}):
            with self.assertRaises(ValueError):
                transport_state(bad)

    def test_owned_proxy_stderr_is_classified_before_cleanup(self):
        cid, project = 'b' * 64, 'bbperf-123-1-before'
        item = {'Id': cid, 'Config': {'Labels': {'com.docker.compose.project': project,
                                                'com.docker.compose.service': 'api-proxy'}},
                'State': {'Running': True, 'Status': 'running', 'ExitCode': 0}}
        stack = Mock(project=project)
        stack.compose_command.return_value = ['docker', 'compose', 'ps', '--all', '-q']
        run = Mock(side_effect=[cid, json.dumps([item]), 'upstream sent too big header private-value'])
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True):
            result = collect(stack, run)
        self.assertEqual(result['services']['api-proxy']['error_signature_codes'], ['proxy_header_too_large'])
        self.assertNotIn('private-value', json.dumps(result))
        self.assertIn('400', run.call_args.args[0])

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
