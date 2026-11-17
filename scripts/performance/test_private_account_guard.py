"""Offline checks of the real-API scenario's guards; no runtime acceptance or app mocks."""
from copy import deepcopy
import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from stack_checks import functional_checks


CI_ENV = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}
FIXTURES = {'products': [
    {'id': 'prod-fixture-0', 'slug': 'e2e-perf-product-0000', 'name': 'E2E_PERF_Product 0'},
    {'id': 'prod-fixture-1', 'slug': 'e2e-perf-product-0001', 'name': 'E2E_PERF_Product 1'},
]}
ORDER_ID = '00000000-0000-4000-8000-000000000001'


class TraceTransport:
    """Test-only responses verify the harness rejects deliberate isolation violations."""
    def __init__(self, failure=None):
        self.failure = failure
        self.sessions = []
        self.trace = []
        self.orders = []
        self.admin = Session(self, -1)

    def session(self, origin):
        assert origin == self.admin.origin
        instance = Session(self, len(self.sessions))
        self.sessions.append(instance)
        return instance

    def respond(self, session, method, path, payload):
        self.trace.append((session.index, method, path))
        headers = {'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate'}
        status = 200
        result = {'data': {}}
        if path.startswith('/api/v1/admin/'):
            if session.index != -1:
                return {'error': {'code': 'UNAUTHORIZED'}}, headers, 401
            if method == 'GET' and path == '/api/v1/admin/products/prod-fixture-0':
                result['data'] = {'shortDescription': 'E2E_PERF_Đã sửa'}
        elif path == '/api/v1/customer/auth/register':
            session.email = payload['email']
            status = 201
            result['data'] = {'id': f'customer-{session.index}'}
        elif path == '/api/v1/customer/me':
            result['data'] = {'id': f'customer-{session.index}', 'email': session.email}
        elif path == '/api/v1/cart':
            result['data'] = deepcopy(session.cart)
            if self.failure == 'cart_cross_session' and session.index == 3:
                result['data'] = deepcopy(self.sessions[2].cart)
        elif path == '/api/v1/cart/items':
            index = int(payload['productId'][-1])
            line = {'id': f'item-{session.index}', 'productId': payload['productId'],
                    'quantity': payload['quantity'], 'unitPrice': 200000 + index * 1000}
            session.cart['items'] = [line]
            session.cart['totals']['totalAmount'] = line['quantity'] * line['unitPrice']
            result['data'] = deepcopy(session.cart)
        elif path == '/api/v1/checkout':
            result['data'] = {'id': ORDER_ID, 'orderNumber': 'E2E-PRIVATE-ORDER',
                'status': 'PENDING', 'paymentMethod': 'COD',
                'totalAmount': session.cart['totals']['totalAmount']}
            if session.index == 2:
                self.orders.append((session.index, deepcopy(result['data'])))
        elif path.startswith('/api/v1/customer/orders'):
            if not session.email:
                status = 200 if self.failure == 'anonymous_order_allowed' else 401
                result = {'error': {'code': 'UNAUTHORIZED'}}
            elif path.endswith('/' + ORDER_ID):
                if session.index == 2:
                    result['data'] = deepcopy(self.orders[0][1])
                else:
                    status = 200 if self.failure == 'foreign_order_allowed' else 404
                    result = {'error': {'code': 'NOT_FOUND'}}
                    if self.failure == 'foreign_order_private_payload':
                        result['data'] = deepcopy(self.orders[0][1])
                    if self.failure == 'foreign_order_cacheable':
                        headers = {'Cache-Control': 'public, max-age=60'}
            else:
                result['data'] = [deepcopy(order) for owner, order in self.orders
                                  if owner == session.index or self.failure == 'foreign_order_in_list']
                if self.failure == 'own_order_cacheable' and session.index == 2:
                    headers = {'Cache-Control': 'public, max-age=60'}
        return result, headers, status


class Session:
    def __init__(self, transport, index):
        self.transport, self.index = transport, index
        self.origin = 'http://localhost:18080'
        self.jar = [SimpleNamespace(name='bb_csrf', value='test-only-csrf')]
        self.email = None
        self.cart = {'id': f'cart-{index}', 'status': 'ACTIVE', 'currency': 'VND',
                     'items': [], 'totals': {'totalAmount': 0, 'shippingAmount': 0}}

    def call(self, method, path, payload=None, headers=None, expected=(200,), **kwargs):
        body, response_headers, status = self.transport.respond(self, method, path, payload)
        if status not in expected:
            raise AssertionError('Unexpected response status in offline transport')
        return body, response_headers, 1.0

    def data(self, method, path, payload=None, **kwargs):
        return self.call(method, path, payload, **kwargs)[0]['data']


class PrivateAccountGuardTest(unittest.TestCase):
    def run_scenario(self, failure=None):
        transport = TraceTransport(failure)
        with patch.dict(os.environ, CI_ENV, clear=True), patch('stack_checks.Api', transport.session), \
                patch('stack_checks.time.sleep', side_effect=lambda seconds: transport.trace.append(
                    ('pacing', 'sleep', seconds))):
            result = functional_checks(transport.admin, deepcopy(FIXTURES))
        return result, transport.trace

    def test_refuses_shared_or_local_host_before_any_call(self):
        api = Mock()
        with patch.dict(os.environ, {}, clear=True), patch('stack_checks.Api') as factory:
            with self.assertRaises(ValueError):
                functional_checks(api, {})
        factory.assert_not_called()
        self.assertEqual(api.mock_calls, [])

    def test_requires_exact_origin_and_owned_fixture_before_any_call(self):
        for origin, products in (('http://localhost:8080', FIXTURES['products']),
                                 ('http://localhost:18080', [FIXTURES['products'][0]]),
                                 ('http://localhost:18080', [FIXTURES['products'][0],
                                    {'id': 'shop-row', 'name': 'Shop product', 'slug': 'shop-product'}])):
            api = Mock(origin=origin)
            with patch.dict(os.environ, CI_ENV, clear=True), patch('stack_checks.Api') as factory:
                with self.assertRaises(ValueError):
                    functional_checks(api, {'products': products})
            factory.assert_not_called()
            self.assertEqual(api.mock_calls, [])

    def test_happy_trace_uses_two_accounts_and_checks_owner_foreign_and_anonymous_reads(self):
        result, trace = self.run_scenario()
        self.assertEqual(result['authenticated_cart_session_count'], 2)
        self.assertTrue(result['authenticated_cod_checkout_and_own_order'])
        self.assertTrue(result['private_account_success_and_error_no_store'])
        own_path = '/api/v1/customer/orders/' + ORDER_ID
        for index in (2, 3, 4):
            self.assertIn((index, 'GET', own_path), trace)
            self.assertIn((index, 'GET', '/api/v1/customer/orders?page=1&size=20'), trace)
        self.assertEqual(sum(method == 'POST' and path == '/api/v1/checkout'
                             for _, method, path in trace), 2)  # existing guest + new account
        exported = json.dumps(result)
        for private in (ORDER_ID, 'customer-', 'example.invalid', 'test-only-csrf'):
            self.assertNotIn(private, exported)

    def test_extra_checkout_waits_one_shared_ip_token_refill_after_guest_checkout(self):
        _, trace = self.run_scenario()
        pauses = [index for index, (_, method, _) in enumerate(trace) if method == 'sleep']
        self.assertEqual(len(pauses), 1)
        pause = pauses[0]
        self.assertEqual(trace[pause], ('pacing', 'sleep', 12.1))
        guest = trace.index((0, 'POST', '/api/v1/checkout'))
        authenticated = trace.index((2, 'POST', '/api/v1/checkout'))
        self.assertLess(guest, pause)
        self.assertLess(pause, authenticated)

    def test_a_cart_crossing_authenticated_sessions_cannot_pass(self):
        with self.assertRaisesRegex(AssertionError, 'Authenticated cart crossed'):
            self.run_scenario('cart_cross_session')

    def test_a_foreign_order_success_or_error_body_leak_cannot_pass(self):
        for failure in ('foreign_order_allowed', 'foreign_order_private_payload'):
            with self.assertRaises(AssertionError):
                self.run_scenario(failure)

    def test_private_success_and_error_responses_need_no_store(self):
        for failure in ('own_order_cacheable', 'foreign_order_cacheable'):
            with self.assertRaisesRegex(AssertionError, 'must not be shared-cacheable'):
                self.run_scenario(failure)

    def test_order_lists_cannot_cross_authenticated_sessions(self):
        with self.assertRaisesRegex(AssertionError, 'Order list crossed'):
            self.run_scenario('foreign_order_in_list')

    def test_signed_out_order_access_cannot_pass(self):
        with self.assertRaises(AssertionError):
            self.run_scenario('anonymous_order_allowed')


if __name__ == '__main__':
    unittest.main()
