"""Real commerce recovery checks, confined to synthetic owned CI fixtures."""
import time
import uuid
from ci_guard import require_ci
from stack_checks import Api


def check_commerce(api, fixtures, counts):
    require_ci()
    selected = fixtures['products'][2:4]
    if len(selected) != 2 or any(not product.get('slug', '').startswith('e2e-perf-product-')
                                 or not product.get('name', '').startswith('E2E_PERF_') for product in selected):
        raise ValueError('Commerce writes require dedicated synthetic fixture identities')
    priced, retired = selected
    checkout = {'billingAddress': {'fullName': 'E2E_PERF_Khách kiểm giá',
        'email': 'perf-price-review@example.invalid', 'phone': '0900000000', 'country': 'VN',
        'province': 'Thành phố Hồ Chí Minh', 'ward': 'Phường Bến Thành',
        'addressLine1': 'E2E_PERF_Địa chỉ thử riêng'}, 'paymentMethod': 'COD', 'locale': 'vi'}
    customer = Api(api.origin)
    customer.call('GET', '/api/v1/cart')
    cart = customer.data('POST', '/api/v1/cart/items', {'productId': priced['id'], 'quantity': 2})
    old_price = cart['items'][0]['unitPrice']
    new_price = old_price + 50000
    # Deliberate functional price-change case, not a benchmark-data shortcut.
    time.sleep(1.2)
    api.call('PATCH', '/api/v1/admin/products/' + priced['id'], {'retailPrice': new_price})
    try:
        before = counts()
        headers = {'Idempotency-Key': str(uuid.uuid5(uuid.NAMESPACE_URL, priced['id'] + '/price-review'))}
        rejected, _, _ = customer.call('POST', '/api/v1/checkout', checkout, headers=headers, expected=(409,))
        assert rejected['error']['code'] == 'CONFLICT'
        assert counts() == before, 'Price review created order/payment or retained empty reservation'
        reviewed = customer.data('GET', '/api/v1/cart')
        assert reviewed['items'][0]['unitPrice'] == new_price
        assert reviewed['totals']['totalAmount'] == new_price * 2
        first = customer.data('POST', '/api/v1/checkout', checkout, headers=headers, expected=(200, 201))
        again = customer.data('POST', '/api/v1/checkout', checkout, headers=headers, expected=(200, 201))
        assert first['id'] == again['id'] and first['totalAmount'] == new_price * 2
        after = counts()
        assert all(after[key] == before[key] + 1 for key in ('orders', 'payments', 'reservations'))
    finally:
        time.sleep(1.2)
        api.call('PATCH', '/api/v1/admin/products/' + priced['id'], {'retailPrice': old_price})

    customer = Api(api.origin)
    customer.call('GET', '/api/v1/cart')
    cart = customer.data('POST', '/api/v1/cart/items', {'productId': retired['id'], 'quantity': 1})
    item = cart['items'][0]
    time.sleep(1.2)
    api.call('PATCH', '/api/v1/admin/products/' + retired['id'], {'discontinued': True})
    try:
        before = counts()
        customer.call('POST', '/api/v1/cart/items', {'productId': retired['id'], 'quantity': 1}, expected=(409,))
        customer.call('PATCH', '/api/v1/cart/items/' + item['id'], {'quantity': 2}, expected=(409,))
        blocked = customer.data('GET', '/api/v1/cart')
        assert blocked['items'][0]['available'] is False and blocked['items'][0]['quantity'] == 1
        customer.call('POST', '/api/v1/checkout', checkout,
                      headers={'Idempotency-Key': str(uuid.uuid5(uuid.NAMESPACE_URL, retired['id'] + '/discontinued'))}, expected=(409,))
        assert counts() == before, 'Unavailable checkout created order/payment or reservation'
    finally:
        time.sleep(1.2)
        api.call('PATCH', '/api/v1/admin/products/' + retired['id'], {'discontinued': False})
    restored = customer.data('GET', '/api/v1/cart')
    assert restored['items'][0]['available'] is True
    return {'price_review_409_then_reload': True, 'same_key_retry_and_replay_one_order': True,
            'rejected_requests_no_order_payment_or_reservation': True,
            'discontinued_add_quantity_checkout_denied': True, 'fixture_values_restored': True,
            'scope': 'Real API/PostgreSQL; two owned simple products; variant guards separately tested'}
