"""Bounded real-import setup and sampled page checks for CI-owned draft products.

This module never bypasses the normal product import/auth/rate-limit path. Unit
tests exercise protocol guards only; acceptance requires the hosted real stack.
"""
import hashlib
import json
import math
import re
import time
import unicodedata
from urllib.parse import urlencode

from ci_guard import loopback_url, require_ci


QUERY = 'E2E_PERF_LARGE'
SKU_PREFIX = 'E2E-PERF-LARGE-'
NAME_PREFIX = QUERY + '_'
PAGE_SIZE = 20
MAX_ROWS = 10000
MAX_BATCH = 100
IMPORT_INTERVAL = 1.15
AUTH_INTERVAL = 450
NAMES = ('Áo bảo hộ', 'ÁO BẢO HỘ', unicodedata.normalize('NFD', 'Áo bảo hộ'),
         'Đồ đi mưa', 'ĐỒ ĐI MƯA', unicodedata.normalize('NFD', 'Đồ đi mưa'))


class LargeCatalogFailure(RuntimeError):
    """Carries only safe partial progress; never retains a raw response/payload."""
    def __init__(self, code, summary):
        self.summary = {**summary, 'complete': False, 'failure_code': code}
        super().__init__('Large catalog protocol failed: ' + code)


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()


def _safe_count(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _row(index, category_slug, brand_slug):
    return {'sku': SKU_PREFIX + f'{index:05d}',
            'name': {'nameVI': NAME_PREFIX + NAMES[index % len(NAMES)] + f' {index // len(NAMES):05d}',
                     'nameEN': NAME_PREFIX + f'Product {index:05d}'},
            'slug': {'slugVI': f'e2e-perf-large-product-{index:05d}'},
            'retailPrice': 200000, 'currency': 'VND', 'available': True,
            'categorySlugs': [category_slug], 'brandId': brand_slug,
            'description': '<p>Sản phẩm nháp kiểm thử hiệu năng riêng CI.</p>'}


def _multipart(rows):
    # Deterministic bytes sent unchanged for the validate and commit requests.
    encoded = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()
    if len(encoded) > 256 * 1024:
        raise ValueError('Synthetic import file exceeds the bounded fixture budget')
    boundary = 'BigBikeLargeCatalogFixture'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="E2E_PERF_LARGE.json"\r\n'
            'Content-Type: application/json\r\n\r\n').encode() + encoded + f'\r\n--{boundary}--\r\n'.encode()
    return body, {'Content-Type': 'multipart/form-data; boundary=' + boundary}


def _import_report(body, expected, mode):
    """Reject an HTTP200 partial/ambiguous import instead of declaring a seed complete."""
    report = body.get('data') if isinstance(body, dict) else None
    keys = ('totalRows', 'okCount', 'warningCount', 'errorCount', 'skippedCount')
    if (not isinstance(report, dict) or report.get('mode') != mode
            or any(not _safe_count(report.get(key)) for key in keys)
            or report['totalRows'] != expected
            or sum(report[key] for key in keys[1:]) != expected
            or not isinstance(report.get('rows'), list) or len(report['rows']) != expected):
        raise ValueError('invalid_import_report')
    if any(report[key] for key in ('warningCount', 'errorCount', 'skippedCount')):
        raise ValueError('nonpassing_import_rows')
    ids, seen_keys = [], set()
    for index, row in enumerate(report['rows'], 1):
        if (not isinstance(row, dict) or row.get('rowNumber') != index
                or row.get('action') != 'CREATE' or row.get('status') != 'OK'
                or row.get('errors') != [] or row.get('warnings') != []
                or not isinstance(row.get('rowKey'), str)
                or not row['rowKey'].startswith(f'row-{index}:' + SKU_PREFIX)
                or row['rowKey'] in seen_keys):
            raise ValueError('invalid_import_row')
        seen_keys.add(row['rowKey'])
        product_id = row.get('productId')
        if mode == 'COMMIT':
            if not isinstance(product_id, str) or not product_id or product_id in ids:
                raise ValueError('invalid_created_identity')
            ids.append(product_id)
        elif product_id is not None:
            raise ValueError('fixture_matched_existing_product')
    return ids


class _Session:
    def __init__(self, api, summary, resource_check, auth_refresh, cutoff_seconds, interval,
                 clock, sleep):
        require_ci()
        loopback_url(api.origin)
        if not callable(resource_check):
            raise ValueError('A real resource boundary callback is required')
        if not isinstance(cutoff_seconds, (int, float)) or not 1 <= cutoff_seconds <= 3600:
            raise ValueError('Bounded positive workload cutoff required')
        self.api, self.summary, self.resource_check = api, summary, resource_check
        self.auth_refresh, self.cutoff, self.interval = auth_refresh, cutoff_seconds, interval
        self.clock, self.sleep = clock, sleep
        self.started = self.auth_at = clock()
        self.last_request_at = None

    def fail(self, code):
        self.summary['elapsed_seconds'] = round(self.clock() - self.started, 3)
        raise LargeCatalogFailure(code, self.summary) from None

    def check(self):
        self.summary['elapsed_seconds'] = round(self.clock() - self.started, 3)
        if self.clock() - self.started >= self.cutoff:
            self.fail('workload_cutoff')
        try:
            resources = self.resource_check()
        except Exception:
            self.fail('resource_collection_failed')
        if resources is False or isinstance(resources, dict) and resources.get('unsafe'):
            self.fail('resource_boundary')
        if self.clock() - self.auth_at >= AUTH_INTERVAL:
            if not callable(self.auth_refresh):
                self.fail('normal_auth_refresh_required')
            try:
                refreshed = self.auth_refresh()
                if refreshed is not None:
                    loopback_url(refreshed.origin)
                    if refreshed.origin != self.api.origin:
                        self.fail('auth_origin_changed')
                    self.api = refreshed
            except LargeCatalogFailure:
                raise
            except Exception:
                self.fail('normal_auth_refresh_failed')
            self.auth_at = self.clock()

    def request(self, method, endpoint, payload=None, headers=None):
        self.check()
        if self.last_request_at is not None:
            self.sleep(max(0, self.last_request_at + self.interval - self.clock()))
        self.check()
        self.last_request_at = self.clock()
        self.summary['requests'] += 1
        if endpoint.endswith('/commit'):
            self.summary['partial_commit_possible'] = True
        try:
            result = self.api.call(method, endpoint, payload, headers=headers, expected=(200,))
        except Exception as error:
            # Api intentionally returns no raw HTTP body on error. Only a numeric
            # status from its fixed assertion text may enter this safe summary.
            status = re.search(r'unexpected status ([1-5][0-9]{2})\b', str(error))
            if status:
                self.summary['failed_http_status'] = int(status.group(1))
            self.fail('rate_limited' if status and status.group(1) == '429' else 'http_or_transport_failure')
        self.check()
        return result


def seed_large(api, fixtures, resource_check, auth_refresh=None, *, count=MAX_ROWS,
               batch_size=MAX_BATCH, cutoff_seconds=1200, _clock=time.monotonic, _sleep=time.sleep):
    """Return {metadata, summary}; writes only through the normal CI-owned import API.

    ``auth_refresh()`` may return a new normally authenticated Api or update the
    current instance in place. It is called at most every450s before another request.
    ``resource_check()`` must inspect the owned services; return False/{unsafe:true}
    or raise to stop. Failure.summary is safe partial progress for the report.
    """
    if (not isinstance(count, int) or isinstance(count, bool) or not 1 <= count <= MAX_ROWS
            or not isinstance(batch_size, int) or isinstance(batch_size, bool) or not 1 <= batch_size <= MAX_BATCH):
        raise ValueError('Synthetic row/batch count exceeds the bounded protocol')
    try:
        category_slug, brand_slug = fixtures['category']['slug'], fixtures['brand']['slug']
    except (KeyError, TypeError):
        raise ValueError('Owned category/brand fixtures required') from None
    if any(not isinstance(value, str) or not value.startswith('e2e-perf-')
           or not re.fullmatch(r'[a-z0-9-]{1,100}', value) for value in (category_slug, brand_slug)):
        raise ValueError('Only the isolated E2E_PERF fixture references are eligible')
    summary = {'complete': False, 'requested_rows': count, 'validated_rows': 0, 'committed_rows': 0,
               'batches_completed': 0, 'requests': 0, 'partial_commit_possible': False,
               'elapsed_seconds': 0, 'request_wall_ms': [],
               'scope': 'synthetic simple DRAFT products via real import; no published/variant/media claim'}
    session = _Session(api, summary, resource_check, auth_refresh, cutoff_seconds,
                       IMPORT_INTERVAL, _clock, _sleep)
    created_ids, input_digest = set(), hashlib.sha256()
    for start in range(0, count, batch_size):
        rows = [_row(index, category_slug, brand_slug) for index in range(start, min(count, start + batch_size))]
        body, headers = _multipart(rows)
        input_digest.update(body)
        for mode in ('VALIDATE', 'COMMIT'):
            summary['phase'] = mode.lower()
            summary['batch'] = start // batch_size + 1
            report, _, elapsed = session.request('POST', '/api/v1/admin/products/import/' + mode.lower(), body, headers)
            summary['request_wall_ms'].append({'mode': mode, 'batch': summary['batch'], 'ms': round(elapsed, 3)})
            try:
                ids = _import_report(report, len(rows), mode)
            except ValueError as error:
                data = report.get('data') if isinstance(report, dict) else None
                if isinstance(data, dict):
                    for key in ('okCount', 'warningCount', 'errorCount', 'skippedCount'):
                        if _safe_count(data.get(key)):
                            summary['failed_batch_' + key] = data[key]
                session.fail(str(error))
            if mode == 'VALIDATE':
                summary['validated_rows'] += len(rows)
            else:
                if created_ids.intersection(ids):
                    session.fail('duplicate_created_identity_across_batches')
                created_ids.update(ids)
                summary['committed_rows'] += len(rows)
                summary['partial_commit_possible'] = False
        summary['batches_completed'] += 1
    session.check()
    summary.update(complete=True, phase='complete', elapsed_seconds=round(_clock() - session.started, 3))
    metadata = {'count': count, 'query': QUERY, 'publish_status': 'DRAFT', 'page_size': PAGE_SIZE,
                'sku_prefix': SKU_PREFIX, 'category_slug': category_slug, 'brand_slug': brand_slug,
                'seed_input_sha256': input_digest.hexdigest(),
                'created_ids_sha256': _digest(sorted(created_ids)), 'case_and_nfc_nfd_ties': True}
    return {'metadata': metadata, 'summary': summary}


def _page(body, count, page, size):
    if not isinstance(body, dict) or not isinstance(body.get('data'), list) or not isinstance(body.get('pagination'), dict):
        raise ValueError('invalid_page_report')
    pagination = body['pagination']
    total_pages = math.ceil(count / size)
    expected = {'page': page, 'pageSize': size, 'totalItems': count, 'totalPages': total_pages,
                'hasNext': page < total_pages, 'hasPrevious': page > 1}
    if any(pagination.get(key) != value for key, value in expected.items()):
        raise ValueError('page_total_or_boundary_mismatch')
    rows = body['data']
    if len(rows) != min(size, count - (page - 1) * size):
        raise ValueError('page_row_count_mismatch')
    ids = []
    for row in rows:
        if (not isinstance(row, dict) or not isinstance(row.get('id'), str) or not row['id']
                or not isinstance(row.get('sku'), str) or not row['sku'].startswith(SKU_PREFIX)
                or not isinstance(row.get('name'), str) or not row['name'].startswith(NAME_PREFIX)
                or row.get('publishStatus') != 'DRAFT'):
            raise ValueError('page_contains_wrong_fixture_or_status')
        ids.append(row['id'])
    if len(set(ids)) != len(ids):
        raise ValueError('duplicate_identity_within_page')
    return rows, ids


def verify_large_pages(api, metadata, resource_check=None, auth_refresh=None, *,
                       cutoff_seconds=240, _clock=time.monotonic, _sleep=time.sleep):
    """Observe sampled adjacent/middle/end pages twice, keeping hashes not raw rows.

    Root compares ``page_identities`` exactly between the two frozen arms; timings
    are separate. This samples page identity, not a proof of every catalog row/order.
    """
    if (not isinstance(metadata, dict) or not isinstance(metadata.get('count'), int)
            or isinstance(metadata['count'], bool) or not 1 <= metadata['count'] <= MAX_ROWS
            or metadata.get('query') != QUERY or metadata.get('publish_status') != 'DRAFT'
            or metadata.get('page_size') != PAGE_SIZE or metadata.get('sku_prefix') != SKU_PREFIX):
        raise ValueError('Owned bounded large-catalog metadata required')
    count = metadata['count']
    total_pages = math.ceil(count / PAGE_SIZE)
    middle = max(1, total_pages // 2)
    pages = sorted({page for page in (1, 2, middle, middle + 1, total_pages - 1, total_pages)
                    if 1 <= page <= total_pages})
    summary = {'complete': False, 'requests': 0, 'count': count, 'sampled_pages': pages,
               'page_identities': [], 'request_wall_ms': [], 'elapsed_seconds': 0,
               'scope': 'sampled DRAFT simple-product pages; comparator semantics also require source/unit evidence'}
    session = _Session(api, summary, resource_check, auth_refresh, cutoff_seconds, .5, _clock, _sleep)
    for direction in ('asc', 'desc'):
        seen_ids = set()
        for page in pages:
            previous = None
            summary.update(direction=direction, page=page)
            for repeat in (1, 2):
                summary['repeat'] = repeat
                endpoint = '/api/v1/admin/products?' + urlencode({
                    'q': QUERY, 'publishStatus': 'DRAFT', 'page': page, 'size': PAGE_SIZE,
                    'sort': 'name:' + direction})
                body, _, elapsed = session.request('GET', endpoint)
                try:
                    rows, ids = _page(body, count, page, PAGE_SIZE)
                except ValueError as error:
                    session.fail(str(error))
                identity = {'direction': direction, 'page': page, 'page_size': PAGE_SIZE,
                            'total': count, 'count': len(rows), 'sha256': _digest(rows),
                            'ids_sha256': _digest(ids)}
                summary['request_wall_ms'].append({'direction': direction, 'page': page,
                                                   'repeat': repeat, 'ms': round(elapsed, 3)})
                if previous is not None:
                    if identity != previous:
                        session.fail('repeated_page_unstable')
                else:
                    if seen_ids.intersection(ids):
                        session.fail('overlap_between_distinct_pages')
                    seen_ids.update(ids)
                    summary['page_identities'].append(identity)
                    previous = identity
    session.check()
    summary.update(complete=True, repeated_pages_stable=True, no_overlap_within_direction=True,
                   exact_total_verified=True, elapsed_seconds=round(_clock() - session.started, 3))
    for key in ('direction', 'page', 'repeat'):
        summary.pop(key, None)
    return summary
