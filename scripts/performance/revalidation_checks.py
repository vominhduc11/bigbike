"""Real internal backend-to-Next refresh; no direct privileged refresh shortcut."""
from html.parser import HTMLParser
import time
from ci_guard import require_ci
from stack_checks import Api


class Headings(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.text = []

    def handle_starttag(self, tag, _attrs):
        if tag == 'h1':
            self.inside = True

    def handle_endtag(self, tag):
        if tag == 'h1':
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.text.append(data)


def verify_revalidation(api, fixtures):
    require_ci()
    product = fixtures['products'][6]
    if (not product.get('name', '').startswith('E2E_PERF_')
            or not product.get('slug', '').startswith('e2e-perf-product-')):
        raise ValueError('Only owned CI product can exercise web refresh')
    web = Api('http://localhost:13000')
    web.call('POST', '/api/revalidate', {'tags': ['products']}, expected=(401,))
    route = '/product/' + product['slug'] + '/'
    def heading():
        body, _, _ = web.call('GET', route, raw=True)
        parsed = Headings()
        parsed.feed(body.decode())
        return ''.join(parsed.text)
    assert product['name'] in heading(), 'Initial real PDP fixture missing'
    changed = 'E2E_PERF_Đã làm mới nội bộ'
    def wait_for(name):
        started = time.monotonic()
        attempts = 0
        while time.monotonic() - started < 20:
            attempts += 1
            if name in heading():
                return {'attempts': attempts, 'wall_ms': (time.monotonic() - started) * 1000}
            time.sleep(1)
        raise AssertionError('Committed Admin change did not refresh real rendered PDP')
    time.sleep(1.2)
    api.call('PATCH', '/api/v1/admin/products/' + product['id'], {'name': changed})
    try:
        observed = wait_for(changed)
    finally:
        time.sleep(1.2)
        api.call('PATCH', '/api/v1/admin/products/' + product['id'], {'name': product['name']})
    restored = wait_for(product['name'])
    return {'unauthorized_refresh_denied': True, 'committed_change_visible_in_rendered_h1': True,
            'fixture_restored': True, 'change_observation': observed, 'restore_observation': restored,
            'scope': 'Real Admin commit -> internal authenticated Next revalidation -> HTML; no direct secret call'}
