"""Create only the CI public bucket with SigV4; no external SDK/account needed."""
import datetime
import hashlib
import hmac
import json
import urllib.request
from urllib.parse import urlsplit
from ci_guard import loopback_url, require_ci
from stack_checks import NoRedirect


def signed_request(origin, password, method, path, body=b'', content_type=None, query=''):
    """Only the ephemeral loopback MinIO is eligible, including dataset restore."""
    require_ci()
    origin = loopback_url(origin)
    if (method not in ('GET', 'PUT') or not (path == '/bigbike-media' or path.startswith('/bigbike-media/'))
            or '..' in path or '\r' in path or '\n' in path or '?' in path or '#' in path or query not in ('', 'policy=')):
        raise ValueError('Only the synthetic CI bucket is eligible')
    now = datetime.datetime.now(datetime.timezone.utc)
    stamp, day = now.strftime('%Y%m%dT%H%M%SZ'), now.strftime('%Y%m%d')
    scope = f'{day}/us-east-1/s3/aws4_request'
    digest = hashlib.sha256(body).hexdigest()
    host = urlsplit(origin).netloc
    canonical_headers = f'host:{host}\nx-amz-content-sha256:{digest}\nx-amz-date:{stamp}\n'
    names = 'host;x-amz-content-sha256;x-amz-date'
    canonical = '\n'.join([method, path, query, canonical_headers, names, digest])
    to_sign = f'AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}'
    key = ('AWS4' + password).encode()
    for part in (day, 'us-east-1', 's3', 'aws4_request'):
        key = hmac.new(key, part.encode(), hashlib.sha256).digest()
    signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
    auth = f'AWS4-HMAC-SHA256 Credential=perf_minio/{scope}, SignedHeaders={names}, Signature={signature}'
    headers = {'Authorization': auth, 'X-Amz-Date': stamp, 'X-Amz-Content-Sha256': digest}
    if content_type:
        headers['Content-Type'] = content_type
    request = urllib.request.Request(origin + path + ('?' + query if query else ''),
        data=body if method == 'PUT' else None, headers=headers, method=method)
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
        assert response.status in (200, 204)
        return response.read(), dict(response.headers)


def setup(password):
    origin = 'http://localhost:19000'
    signed_request(origin, password, 'PUT', '/bigbike-media')
    policy = {'Version': '2012-10-17', 'Statement': [{'Effect': 'Allow', 'Principal': {'AWS': ['*']},
              'Action': ['s3:GetObject'], 'Resource': ['arn:aws:s3:::bigbike-media/*']}]}
    signed_request(origin, password, 'PUT', '/bigbike-media', json.dumps(policy).encode(), query='policy=')
