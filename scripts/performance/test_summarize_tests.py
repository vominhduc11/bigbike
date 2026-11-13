import json
from pathlib import Path
import tempfile
import unittest
from summarize_tests import vitest


class SanitizedFailureTest(unittest.TestCase):
    def test_failure_keeps_case_location_without_matcher_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, 'report.json')
            path.write_text(json.dumps({'testResults': [{'name': '/runner/app/test.js',
                'assertionResults': [{'fullName': 'URL policy retains expected origin',
                    'status': 'failed', 'failureMessages': [
                        'AssertionError: expected DO_NOT_PUBLISH src/lib/urlPolicies.test.js:139:77']}]}]}))
            result = vitest(path)
            case = result['nonpassing_cases'][0]
            self.assertEqual(case['source_locations'], ['src/lib/urlPolicies.test.js:139:77'])
            self.assertEqual(case['categories'], ['assertion'])
            self.assertNotIn('DO_NOT_PUBLISH', json.dumps(result))
