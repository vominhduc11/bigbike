#!/usr/bin/env python3
"""Read-only, three-URL external uptime probe. No schedule or message sending is installed."""
import argparse
import concurrent.futures
import datetime as dt
import importlib.util
import http.client
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location('merchant_probe', Path(__file__).with_name('check-google-merchant.py'))
merchant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(merchant)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def inspect_body(kind, body, headers, marker=None):
    if kind == 'feed':
        return merchant.validate(body, headers, dt.datetime.now(dt.timezone.utc), 60)['errors']
    if 'text/html' not in headers.get('content-type', '').lower():
        return ['HTML_CONTENT_TYPE']
    html = body.decode('utf-8', errors='replace').casefold()
    if '<html' not in html or '</html>' not in html or not marker or marker.casefold() not in html:
        return ['PAGE_CONTENT_MISSING']
    if kind == 'product' and not ('"@type":"product' in html or '"@type": "product' in html):
        return ['PRODUCT_CONTENT_MISSING']
    return []


def probe(kind, url, marker=None):
    started = time.monotonic()
    result = {'target': kind, 'errors': []}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'BigBike-Uptime/1.0'})
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=15) as response:
            result['status'] = response.status
            body = response.read(8 * 1024 * 1024 + 1)
            if response.status != 200:
                result['errors'] = ['HTTP_NOT_200']
            elif len(body) > 8 * 1024 * 1024:
                result['errors'] = ['BODY_TOO_LARGE']
            else:
                result['errors'] = inspect_body(kind, body, {k.lower(): v for k, v in response.headers.items()}, marker)
    except urllib.error.HTTPError as error:
        result.update(status=error.code, errors=['HTTP_NOT_200'])
    except (OSError, ValueError, http.client.HTTPException):
        result['errors'] = ['SOURCE_UNAVAILABLE']
    result['seconds'] = round(time.monotonic() - started, 3)
    if result['seconds'] >= 15:
        result['errors'].append('RESPONSE_TOO_SLOW')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home-url', required=True)
    parser.add_argument('--home-marker', required=True)
    parser.add_argument('--product-url', required=True)
    parser.add_argument('--product-marker', required=True, help='A real SKU/name visible in server HTML')
    parser.add_argument('--feed-url', required=True)
    args = parser.parse_args()
    targets = [('home', args.home_url, args.home_marker), ('product', args.product_url, args.product_marker), ('feed', args.feed_url, None)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(lambda target: probe(*target), targets))
    ok = all(not result['errors'] for result in results)
    print(json.dumps({'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'ok': ok, 'targets': results}, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
