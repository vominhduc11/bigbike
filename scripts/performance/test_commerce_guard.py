import os
from unittest.mock import patch, Mock
import unittest
from commerce_checks import check_commerce


class CommerceGuardTest(unittest.TestCase):
    def test_refuses_any_local_service_write(self):
        api = Mock()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                check_commerce(api, {}, Mock())
        self.assertEqual(api.mock_calls, [])

    def test_requires_own_fixture_identity_before_any_call(self):
        api = Mock()
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}, clear=True):
            with self.assertRaises(ValueError):
                check_commerce(api, {'products': [{}, {}, {'slug': 'shop-product'}, {}]}, Mock())
        self.assertEqual(api.mock_calls, [])
