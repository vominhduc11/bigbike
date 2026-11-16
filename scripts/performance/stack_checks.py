"""Real CI-only API fixture setup and correctness checks. Never writes to shop services."""
import hashlib
import http.cookiejar
import json
import mimetypes
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from ci_guard import loopback_url, require_ci


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


class ApiFailure(AssertionError):
    """Fixed failure categories only; never retain a response body or headers."""
    def __init__(self, method, path, response, body):
        content_type = response.headers.get('Content-Type', '').lower()
        self.status = response.status
        self.response_class = ('json' if 'application/json' in content_type or '+json' in content_type
                               else 'html' if 'text/html' in content_type else 'other')
        self.error_code = 'unrecognized'
        if self.response_class == 'json' and len(body) <= 65536:
            try:
                value = json.loads(body)
                code = value.get('error', {}).get('code')
                if code in ('VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', 'FORBIDDEN', 'CONFLICT',
                            'UPSTREAM_ERROR', 'INTERNAL_ERROR', 'RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE'):
                    self.error_code = code
            except (ValueError, TypeError, AttributeError):
                pass
        super().__init__(f'{method} {path.split("?")[0]} unexpected status {self.status}; '
                         f'response_class={self.response_class}; error_code={self.error_code}')


class Api:
    def __init__(self, origin, token=None):
        self.origin = loopback_url(origin)
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPCookieProcessor(self.jar))
        self.token = token

    def call(self, method, path, payload=None, headers=None, expected=(200,), raw=False):
        if method != 'GET':
            require_ci()
        if not path.startswith('/') or path.startswith('//'):
            raise ValueError('Only relative API paths allowed')
        request_headers = {'Accept': 'application/json', **(headers or {})}
        if self.token:
            request_headers['Authorization'] = 'Bearer ' + self.token
        csrf = next((c.value for c in self.jar if c.name == 'bb_csrf'), None)
        if csrf:
            request_headers['X-CSRF-Token'] = csrf
        if payload is not None and not isinstance(payload, bytes):
            payload = json.dumps(payload).encode()
            request_headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(self.origin + path, data=payload, headers=request_headers, method=method)
        started = time.perf_counter()
        try:
            response = self.opener.open(request, timeout=60)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read()
        elapsed = (time.perf_counter() - started) * 1000
        if response.status not in expected:
            # Do not leak payloads, cookies, error details, email or token values.
            raise ApiFailure(method, path, response, body)
        return (body if raw else json.loads(body) if body else None), dict(response.headers), elapsed

    def data(self, method, path, payload=None, **kwargs):
        return self.call(method, path, payload, **kwargs)[0]['data']


def login(origin, password):
    api = Api(origin)
    api.token = api.data('POST', '/api/v1/auth/login', {'email': 'perf-admin@example.invalid', 'password': password})['accessToken']
    return api


def upload(api, file):
    content = file.read_bytes()
    boundary = 'BigBikePerformanceFixture'
    mime = mimetypes.guess_type(file.name)[0]
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="E2E_PERF_{file.name}"\r\n'
                 f'Content-Type: {mime}\r\n\r\n').encode() + content + f'\r\n--{boundary}--\r\n'.encode()
    result, headers, elapsed = api.call('POST', '/api/v1/admin/media', multipart,
        headers={'Content-Type': 'multipart/form-data; boundary=' + boundary}, expected=(201,))
    return result['data'], headers, elapsed


def seed(api, directory, count=40):
    require_ci()
    if count < 1 or count > 200:
        raise ValueError('API fixture cap is 200; use component benchmark for large collation datasets')
    brand = api.data('POST', '/api/v1/admin/brands', {
        'name': 'E2E_PERF_Thương hiệu', 'slug': 'e2e-perf-brand',
        'translations': {'en': {'name': 'E2E_PERF_Brand'}}}, expected=(200, 201))
    category = api.data('POST', '/api/v1/admin/categories', {
        'name': 'E2E_PERF_Danh mục', 'slug': 'e2e-perf-category', 'visible': True,
        'translations': {'en': {'name': 'E2E_PERF_Category'}}}, expected=(200, 201))
    image, _, _ = upload(api, Path(directory) / 'photo-1600.jpg')
    products = []
    names = ['Áo bảo hộ', 'Đồ đi mưa', 'Mũ bảo hiểm', 'Găng tay', 'Ống tay', 'ÁO BẢO HỘ']
    for index in range(count):
        # Respect 60/min admin mutation policy including setup writes; no limiter bypass.
        time.sleep(1.15)
        payload = {'name': f'E2E_PERF_{names[index % len(names)]} {index:04}',
                   'slug': f'e2e-perf-product-{index:04}', 'sku': f'E2E-PERF-{index:04}',
                   'brandId': brand['id'], 'categoryIds': [category['id']],
                   'retailPrice': 200000 + index * 1000, 'available': True,
                   'image': {'url': image['publicUrl'], 'alt': 'E2E_PERF_Ảnh thử',
                             'width': image['width'], 'height': image['height'], 'mimeType': image['mimeType']},
                   'publishStatus': 'DRAFT', 'description': '<p>Sản phẩm kiểm thử hiệu năng tách biệt.</p>',
                   'translations': {'en': {'name': f'E2E_PERF_Product {index:04}'}}}
        created = api.data('POST', '/api/v1/admin/products', payload, expected=(200, 201))
        time.sleep(1.15)
        products.append(api.data('PATCH', f'/api/v1/admin/products/{created["id"]}/publish', {'publishStatus': 'PUBLISHED'}))
    # Replace only ephemeral migration-fixture home slots using normal APIs;
    # broken legacy media must not inflate scores by leaving the page empty.
    sliders = api.data('GET', '/api/v1/admin/sliders?location=home')
    for slider in sliders:
        time.sleep(1.15)
        api.call('PATCH', f'/api/v1/admin/sliders/{slider["id"]}', {'isActive': False})
    time.sleep(1.15)
    api.data('POST', '/api/v1/admin/sliders', {'location': 'home',
        'sortOrder': max([slider.get('sortOrder', 0) for slider in sliders] + [0]) + 1,
        'productId': products[0]['id'], 'isActive': True,
        'desktopImage': {'url': image['publicUrl'], 'alt': 'E2E_PERF_Banner thử', 'width': image['width'],
                         'height': image['height'], 'mimeType': image['mimeType']}}, expected=(200, 201))
    time.sleep(1.15)
    api.call('POST', '/api/v1/admin/products/homepage-blocks', {'featuredGrid': [p['id'] for p in products[:8]]})
    return {'brand': brand, 'category': category, 'products': products, 'media': image}


def media_checks(api, directory, record_callback=None):
    require_ci()
    results = []
    for file in sorted(Path(directory).iterdir()):
        if file.suffix not in ('.jpg', '.png', '.webp', '.mp4') or file.name.startswith('batch-'):
            continue
        if file.name not in ({f'{kind}-{width}.png' for kind in ('alpha', 'opaque') for width in (320, 1600, 2400)}
                             | {f'photo-{width}.{kind}' for kind in ('jpg', 'webp') for width in (320, 1600)} | {'clip.mp4'}):
            raise ValueError('Refusing unapproved media fixture name in diagnostics')
        time.sleep(2.1)  # Keep each real upload within 30/min; no synthetic identity spoofing.
        content = file.read_bytes()
        print('BBPERF-MEDIA', file.name, 'upload', flush=True)
        media, _, duration = upload(api, file)
        print('BBPERF-MEDIA', file.name, 'private-original-download', flush=True)
        original, download_headers, download_ms = api.call('GET', f'/api/v1/admin/media/{media["id"]}/download', raw=True)
        print('BBPERF-MEDIA', file.name, 'authorization-denial', flush=True)
        Api(api.origin).call('GET', f'/api/v1/admin/media/{media["id"]}/download', expected=(401, 403), raw=True)
        public = Api('http://localhost:14000')
        print('BBPERF-MEDIA', file.name, 'public-original-download', flush=True)
        stored, cache_headers, public_ms = public.call('GET', media['publicUrl'], raw=True)
        # MEDIA_RULE_006 compresses the stored original. Download must return that
        # exact object (MEDIA_RULE_008), not the pre-compression upload/thumbnail.
        assert original == stored, 'Download differs from the stored original'
        if file.suffix in ('.webp', '.mp4'):
            assert original == content, 'Within-cap WebP or MP4 fixture bytes changed'
        if file.suffix != '.mp4':
            dimensions = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height', '-of', 'json', 'pipe:0'], input=original,
                capture_output=True, check=True).stdout)['streams'][0]
            source_dimensions = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height', '-of', 'json', 'pipe:0'], input=content,
                capture_output=True, check=True).stdout)['streams'][0]
            assert (media['width'], media['height']) == (dimensions['width'], dimensions['height'])
            assert dimensions['width'] == min(2000, source_dimensions['width']), 'Original cap/upscale contract changed'
        transparency = None
        if file.name.startswith('alpha-'):
            decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-frames:v', '1',
                        '-f', 'rawvideo', '-pix_fmt', 'rgba', '-threads', '1', 'pipe:1'],
                        input=original, capture_output=True, check=True).stdout
            transparency = min(decoded[3::4])
            assert transparency == max(decoded[3::4]) == 96, 'PNG alpha channel changed'
        range_status = None
        if file.suffix == '.mp4':
            part, range_headers, _ = public.call('GET', media['publicUrl'], headers={'Range': 'bytes=0-31'}, expected=(206,), raw=True)
            assert part == content[:32] and range_headers.get('Content-Range', range_headers.get('Content-range', '')).startswith('bytes 0-31/')
            range_status = 206
        results.append({'fixture': file.name, 'original_hash_matches': True, 'unauthenticated_download_denied': True,
                        'upload_request_wall_ms': duration, 'download_request_wall_ms': download_ms,
                        'public_download_wall_ms': public_ms, 'http_range_status': range_status,
                        'server_processing_ms': None, 'transfer_only_ms': None,
                        'cache_control': cache_headers.get('Cache-Control'),
                        'content_length': download_headers.get('Content-Length'),
                        'width': media.get('width'), 'height': media.get('height')})
        results[-1]['alpha_min'] = transparency
        results[-1]['stored_sha256'] = hashlib.sha256(original).hexdigest()
        if record_callback:
            record_callback(results)
    time.sleep(2.1)

    def parallel_upload(file):
        client = Api(api.origin, api.token)
        media, _, elapsed = upload(client, file)
        downloaded, _, _ = client.call('GET', f'/api/v1/admin/media/{media["id"]}/download', raw=True)
        assert downloaded == file.read_bytes(), 'Batch upload original bytes changed'
        return {'fixture': file.name, 'concurrent_uploads': 2, 'upload_request_wall_ms': elapsed,
                'original_hash_matches': True, 'stored_sha256': hashlib.sha256(downloaded).hexdigest()}

    with ThreadPoolExecutor(max_workers=2) as pool:
        results.extend(pool.map(parallel_upload, sorted(Path(directory).glob('batch-*.jpg'))))
    if record_callback:
        record_callback(results)
    return results


def functional_checks(api, fixtures):
    """Real requests, guest isolation and checkout; all identities are synthetic."""
    require_ci()
    product = fixtures['products'][0]
    public = Api(api.origin)
    public.call('GET', '/api/v1/admin/products', expected=(401, 403))
    api.call('GET', '/api/v1/admin/products?page=1&size=20&sort=name:asc')
    api.call('GET', '/api/v1/admin/media?page=1&size=20')
    api.call('PATCH', f'/api/v1/admin/products/{product["id"]}', {'shortDescription': 'E2E_PERF_Đã sửa'})
    updated = api.data('GET', f'/api/v1/admin/products/{product["id"]}')
    assert updated['shortDescription'] == 'E2E_PERF_Đã sửa', 'Admin edit did not persist'
    public.call('GET', '/api/v1/products/' + product['slug'])
    public.call('GET', '/api/v1/cart')
    csrf = next((c.value for c in public.jar if c.name == 'bb_csrf'), None)
    assert csrf, 'Guest cart must issue CSRF cookie'
    public.data('POST', '/api/v1/cart/items', {'productId': product['id'], 'quantity': 1})
    other = Api(api.origin)
    other_cart, other_headers, _ = other.call('GET', '/api/v1/cart')
    assert other_cart['data']['items'] == [], 'Guest cart leaked between sessions'
    own, own_headers, _ = public.call('GET', '/api/v1/cart')
    assert len(own['data']['items']) == 1, 'Guest cart contents missing'
    line = own['data']['items'][0]
    assert line['productId'] == product['id'] and line['quantity'] == 1 and line['unitPrice'] == 200000
    assert own['data']['totals']['totalAmount'] == 200000 and own['data']['totals']['shippingAmount'] == 0
    for headers in (other_headers, own_headers):
        assert 'no-store' in headers.get('Cache-Control', '').lower(), 'Private cart must not be shared-cacheable'
    checkout = {'billingAddress': {'fullName': 'E2E_PERF_Khách thử', 'email': 'perf-customer@example.invalid',
                'phone': '0900000000', 'country': 'VN', 'province': 'Thành phố Hồ Chí Minh',
                'ward': 'Phường Bến Thành', 'addressLine1': 'E2E_PERF_Địa chỉ thử'}, 'paymentMethod': 'COD',
                'customerNote': 'E2E_PERF_Only isolated CI data', 'locale': 'vi'}
    order, _, _ = public.call('POST', '/api/v1/checkout', checkout,
                             headers={'Idempotency-Key': 'E2E-PERF-CHECKOUT-1'}, expected=(200, 201))
    assert order.get('data'), 'Checkout returned no order'
    assert order['data']['totalAmount'] == 200000, 'Checkout total differs from authoritative fixture price'
    customers = []
    password = 'E2E-PERF-Account-only-32characters'
    for index in (1, 2):
        customer = Api(api.origin)
        email = f'perf-customer-{index}@example.invalid'
        registered = customer.data('POST', '/api/v1/customer/auth/register', {
            'email': email, 'password': password, 'displayName': f'E2E_PERF_Khách {index}',
            'privacyConsent': True, 'privacyPolicyLocale': 'vi'}, expected=(200, 201))
        own_profile, profile_headers, _ = customer.call('GET', '/api/v1/customer/me')
        assert 'no-store' in profile_headers.get('Cache-Control', '').lower()
        assert own_profile['data']['email'] == email, 'Customer profile crossed sessions'
        customer.call('GET', '/api/v1/admin/products', expected=(401,))
        customers.append(own_profile['data'])
    assert customers[0]['id'] != customers[1]['id']
    return {'real_guest_cart_and_checkout': True, 'private_cart_isolation': True,
            'admin_product_patch': True, 'unauthenticated_admin_denied': True,
            'customer_account_registration_and_profile_isolation': True,
            'admin_bulk_reports_role_denial': 'not verified by this scenario'}
