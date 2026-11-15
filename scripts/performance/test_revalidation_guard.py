import os
from unittest.mock import Mock, patch
import unittest
from revalidation_checks import Headings, verify_revalidation


class RevalidationGuardTest(unittest.TestCase):
    def test_refuses_local_writes_and_unowned_fixture_before_calls(self):
        api = Mock()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                verify_revalidation(api, {})
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True):
            with self.assertRaises(ValueError):
                verify_revalidation(api, {'products': [{}] * 7})
        self.assertEqual(api.mock_calls, [])

    def test_reads_visible_heading_text_without_matching_serialized_private_payload(self):
        parsed = Headings()
        parsed.feed('<script>hidden_name</script><h1>Visible <span>product</span></h1>')
        self.assertEqual(''.join(parsed.text), 'Visible product')
