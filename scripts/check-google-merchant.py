#!/usr/bin/env python3
"""Read-only GMC probe. JSON stdout, exit 1 on failure; never sends alerts."""
import argparse
import datetime as dt
import http.client
import json
import math
import time
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

G = '{http://base.google.com/ns/1.0}'


def validate(body, headers, now, max_age, expected_items=None):
    errors = []
    counts = {}
    if 'application/xml' not in headers.get('content-type', '').lower():
        errors.append('CONTENT_TYPE')
    try:
        root = ET.fromstring(body)
        channel = root.find('channel')
        if root.tag != 'rss' or root.get('version') != '2.0' or channel is None:
            raise ValueError()
    except (ET.ParseError, ValueError):
        return {'errors': errors + ['XML_INVALID']}
    items = channel.findall('item')
    ids, parents = set(), set()
    for item in items:
        sku = (item.findtext(G + 'id') or '').strip()
        key = unicodedata.normalize('NFC', sku).lower()
        if not sku or len(sku) > 50 or key in ids:
            errors.append('SKU_INVALID_OR_DUPLICATE')
        ids.add(key)
        group = item.findtext(G + 'item_group_id')
        parents.add(('group', group) if group else ('item', key))
        for field in ('title', 'description', 'link', 'image_link', 'price', 'availability'):
            if not item.findtext(G + field):
                errors.append('ITEM_FIELD_MISSING')
    for name, actual in [('item', len(items)), ('product', len(parents))]:
        counts[name + 'Count'] = actual
        if headers.get('x-merchant-' + name + '-count') != str(actual):
            errors.append(name.upper() + '_COUNT_MISMATCH')
    if expected_items is not None and len(items) != expected_items:
        errors.append('CATALOG_COUNT_MISMATCH')
    # Empty XML needs independent catalog confirmation, never green by HTTP alone.
    if not items and expected_items != 0:
        errors.append('EMPTY_UNVERIFIED')
    try:
        stamp = dt.datetime.fromisoformat(headers.get('x-merchant-generated-at', '').replace('Z', '+00:00'))
        if stamp.utcoffset() != dt.timedelta(0):
            raise ValueError()
        age = (now - stamp).total_seconds()
        counts['ageSeconds'] = round(age, 3)
        if age < -5 or age > max_age:
            errors.append('GENERATED_AT_STALE_OR_FUTURE')
    except (ValueError, TypeError):
        errors.append('GENERATED_AT_MISSING_OR_INVALID')
    return {**counts, 'errors': sorted(set(errors))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--max-age-seconds', type=float, required=True)
    parser.add_argument('--expected-items', type=int)
    args = parser.parse_args()
    if not math.isfinite(args.max_age_seconds) or args.max_age_seconds <= 0:
        parser.error('max age must be positive and finite')
    if args.expected_items is not None and args.expected_items < 0:
        parser.error('expected items must be nonnegative')
    started = time.monotonic()
    result = {'errors': []}
    try:
        request = urllib.request.Request(args.url, headers={'User-Agent': 'BigBike-Merchant-Probe/1.0'})
        with urllib.request.urlopen(request, timeout=30) as response:
            result['httpStatus'] = response.status
            if response.status != 200:
                result['errors'].append('HTTP_NOT_200')
            else:
                body = response.read(32 * 1024 * 1024 + 1)
                if len(body) > 32 * 1024 * 1024:
                    result['errors'].append('BODY_TOO_LARGE')
                else:
                    result.update(validate(body, {k.lower(): v for k, v in response.headers.items()},
                                           dt.datetime.now(dt.timezone.utc), args.max_age_seconds,
                                           args.expected_items))
    except urllib.error.HTTPError as error:
        result.update(httpStatus=error.code, errors=['HTTP_NOT_200'])
    except (OSError, ValueError, http.client.HTTPException):
        result['errors'].append('SOURCE_UNAVAILABLE')
    result['seconds'] = round(time.monotonic() - started, 3)
    if result['seconds'] >= 30:
        result['errors'].append('RESPONSE_TOO_SLOW')
    result['checkedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    result['ok'] = not result['errors']
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
