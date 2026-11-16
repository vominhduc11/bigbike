"""Failure privacy controls for the lab client; not application acceptance."""
import json
import unittest
from unittest.mock import Mock

from stack_checks import Api, ApiFailure


class ApiFailureDiagnosticsTest(unittest.TestCase):
    def failure(self, body, content_type):
        api = Api('http://localhost:18080')
        api.opener = Mock()
        api.opener.open.return_value = Mock(status=502, headers={'Content-Type': content_type,
            'Set-Cookie': 'private-cookie'}, read=Mock(return_value=body))
        with self.assertRaises(ApiFailure) as caught:
            api.call('GET', '/download?private-query=never-export')
        error = caught.exception
        self.assertEqual(error.status, 502)
        for private in ('private-cookie', 'private-query', 'private-body', 'private-code'):
            self.assertNotIn(private, str(error))
            self.assertNotIn(private, repr(vars(error)))
        return error

    def test_html_gateway_failure_is_classified_without_body_or_headers(self):
        error = self.failure(b'<html>private-body</html>', 'text/html; charset=utf-8')
        self.assertEqual(error.response_class, 'html')
        self.assertEqual(error.error_code, 'unrecognized')

    def test_json_exports_only_a_fixed_known_error_code(self):
        error = self.failure(json.dumps({'error': {'code': 'UPSTREAM_ERROR',
            'message': 'private-body'}}).encode(), 'application/json')
        self.assertEqual(error.response_class, 'json')
        self.assertEqual(error.error_code, 'UPSTREAM_ERROR')

    def test_arbitrary_json_codes_or_shapes_are_not_retained(self):
        for body in (b'{"error":{"code":"private-code","message":"private-body"}}',
                     b'[]', b'null', b'{"error":null}', b'{invalid private-body'):
            error = self.failure(body, 'application/problem+json')
            self.assertEqual(error.error_code, 'unrecognized')
