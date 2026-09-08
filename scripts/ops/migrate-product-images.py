#!/usr/bin/env python3
"""Owner-run catalog images only. No application startup, Gemini or customer data access.

Uses psql's normal PG* / service credentials and BIGBIKE_IMAGE_MIGRATION_TOKEN for
existing admin media/product APIs. See IMAGE_ASSISTANT_OPERATIONS.md before use.
"""
import argparse
import copy
import hashlib
import html
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import subprocess
import sys
import tempfile
import time
from urllib.parse import urljoin, urlsplit, unquote, quote
import uuid

MAX_BYTES = 16 * 1024 * 1024
VERSION = 1
IMAGE_COLUMNS = ['image_id', 'image_url', 'image_mime_type', 'image_width', 'image_height']
TEXT_COLUMNS = ['description', 'description_en', 'short_description', 'short_description_en',
                'size_guide', 'size_guide_en', 'specifications_html', 'specifications_html_en',
                'spec_stats_html', 'spec_stats_html_en', 'trust_badges_html', 'trust_badges_html_en',
                'quick_answer_summary', 'quick_answer_summary_en']
JSON_COLUMNS = ['gallery', 'description_blocks', 'size_guide_section', 'suitability_section',
                'faqs', 'commitments', 'highlights']
TABLES = {
    'products': IMAGE_COLUMNS + ['seo_og_image_id', 'seo_og_image_url', 'seo_og_image_mime_type', 'seo_og_image_width', 'seo_og_image_height'] + TEXT_COLUMNS + JSON_COLUMNS,
    'product_variants': IMAGE_COLUMNS,
    'product_variant_gallery_images': IMAGE_COLUMNS,
}
ELIGIBLE = "p.publish_status = 'PUBLISHED' and not p.discontinued and upper(p.currency) = 'VND' and p.retail_price > 0"
TAG = re.compile(r'<(?:img|source)\b[^>]*>', re.I)
ATTRIBUTE = re.compile(r'(\b(?:src|srcset|data-src|data-srcset)\s*=\s*)([\"\'])(.*?)(\2)', re.I | re.S)


def sql_text(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"


def sql_json(value):
    return sql_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))) + '::jsonb'


def database(sql):
    # Do not print connection parameters or database stderr (it may contain secrets).
    result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                            input="SET standard_conforming_strings = on; SET lock_timeout = '5s'; SET statement_timeout = '30s';\n" + sql,
                            text=True, capture_output=True, timeout=40)
    if result.returncode:
        raise RuntimeError('Database command failed; check connection/permissions/schema separately.')
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def atomic_save(path, manifest):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False, encoding='utf-8') as output:
        os.chmod(output.name, 0o600)
        json.dump(manifest, output, ensure_ascii=False, indent=2)
        output.write('\n')
        output.flush()
        os.fsync(output.fileno())
    os.replace(output.name, path)
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def origin(value):
    uri = urlsplit(value)
    if uri.scheme not in ('http', 'https') or not uri.hostname or uri.username or uri.password:
        raise ValueError('Expected an HTTP(S) origin without credentials.')
    return f'{uri.scheme}://{uri.netloc.lower()}'


def legacy_url(value, origins):
    if not isinstance(value, str) or not value:
        return None
    clean = html.unescape(value).strip()
    if clean.startswith('//'):
        clean = urlsplit(origins[0]).scheme + ':' + clean
    elif clean.startswith('/'):
        clean = urljoin(origins[0], clean)
    uri = urlsplit(clean)
    if uri.scheme not in ('http', 'https') or origin(clean) not in origins:
        return None
    path = unquote(uri.path)
    if path.startswith('/media/') or path.startswith('/media-proxy/'):
        return None
    if '..' in path.split('/') or '\\' in path or '\x00' in path:
        raise ValueError('Invalid legacy image path.')
    # Scope is shop-managed WordPress uploads, never arbitrary links or video files.
    if '/wp-content/uploads/' not in path or not re.search(r'\.(?:jpe?g|png|webp|gif|avif)$', path, re.I):
        return None
    return clean


def public_address(uri):
    answers = socket.getaddrinfo(uri.hostname, uri.port or (443 if uri.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    addresses = [answer[4][0] for answer in answers]
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError('Source must resolve only to public IP addresses.')
    return addresses[0]


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, port, address):
        super().__init__(host, port, timeout=20, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        stream = socket.create_connection((self.address, self.port), self.timeout)
        self.sock = self._context.wrap_socket(stream, server_hostname=self.host)


def download(url, origins):
    for _ in range(4):
        uri = urlsplit(url)
        if origin(url) not in origins:
            raise ValueError('Redirect left the approved source origins.')
        address = public_address(uri)
        connection = PinnedHTTPS(uri.hostname, uri.port or 443, address) if uri.scheme == 'https' else http.client.HTTPConnection(address, uri.port or 80, timeout=20)
        try:
            connection.request('GET', uri.path + ('?' + uri.query if uri.query else ''), headers={'Host': uri.netloc, 'Accept': 'image/*'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location:
                    raise ValueError('Redirect has no destination.')
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise RuntimeError('Source image is unavailable.')
            if int(response.getheader('Content-Length', '0')) > MAX_BYTES:
                raise ValueError('Source image is larger than 16 MB.')
            content = response.read(MAX_BYTES + 1)
            if not content or len(content) > MAX_BYTES:
                raise ValueError('Source image is empty or too large.')
            # Upload pipeline independently decodes, normalizes, hashes and deduplicates it.
            mime = response.getheader('Content-Type', '').split(';')[0].strip().lower()
            if mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'):
                raise ValueError('Source did not return an allowed image type.')
            return content, mime
        finally:
            connection.close()
    raise ValueError('Too many redirects.')


def api_request(base, path, method='GET', body=None, content_type='application/json'):
    token = os.environ.get('BIGBIKE_IMAGE_MIGRATION_TOKEN')
    if not token:
        raise ValueError('Set BIGBIKE_IMAGE_MIGRATION_TOKEN to an admin token with media.write and products.update.')
    uri = urlsplit(base)
    if uri.scheme != 'https' and uri.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('Admin API requires HTTPS except on loopback.')
    if uri.username or uri.password or uri.query or uri.fragment:
        raise ValueError('Invalid admin API base.')
    connection = http.client.HTTPSConnection(uri.hostname, uri.port or 443, timeout=60) if uri.scheme == 'https' else http.client.HTTPConnection(uri.hostname, uri.port or 80, timeout=60)
    try:
        connection.request(method, uri.path.rstrip('/') + path, body=body,
                           headers={'Authorization': 'Bearer ' + token, 'Content-Type': content_type})
        response = connection.getresponse()
        raw = response.read(2 * 1024 * 1024)
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f'Admin API returned {response.status}; no redirect is followed.')
        return json.loads(raw).get('data', {})
    finally:
        connection.close()


def import_media(url, origins, api_base):
    content, mime = download(url, origins)
    boundary = 'bigbike-' + uuid.uuid4().hex
    filename = 'catalog-image.' + {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif'}[mime]
    header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
    data = api_request(api_base, '/admin/media', 'POST', header + content + f'\r\n--{boundary}--\r\n'.encode(), 'multipart/form-data; boundary=' + boundary)
    if not data.get('id') or not str(data.get('publicUrl', '')).startswith('/media/') or data.get('storageProvider') != 'MINIO':
        raise RuntimeError('Upload did not return a registered MinIO image.')
    return {'id': str(data['id']), 'url': data['publicUrl'], 'mimeType': data['mimeType'],
            'width': data.get('width'), 'height': data.get('height'), 'sourceSha256': hashlib.sha256(content).hexdigest()}


def rewrite_html(value, replace):
    def tag_replace(match):
        tag = match.group(0)
        # <source src> belongs to video/audio. Only a source's srcset can describe images.
        image_tag = bool(re.match(r'<img\b', tag, re.I))
        def attribute_replace(attribute):
            name = attribute.group(1).lower()
            if not image_tag and 'srcset' not in name:
                return attribute.group(0)
            original = attribute.group(3)
            if 'srcset' in name:
                def entry(item):
                    bits = item.strip().split(None, 1)
                    if not bits:
                        return item
                    updated = replace(html.unescape(bits[0]))
                    return (updated['url'] if updated else bits[0]) + (' ' + bits[1] if len(bits) > 1 else '')
                changed = ', '.join(entry(item) for item in original.split(','))
            else:
                updated = replace(html.unescape(original))
                changed = updated['url'] if updated else original
            return attribute.group(1) + attribute.group(2) + changed + attribute.group(4)
        return ATTRIBUTE.sub(attribute_replace, tag)
    return TAG.sub(tag_replace, value)


def rewrite_json(value, replace):
    if isinstance(value, list):
        return [rewrite_json(item, replace) for item in value]
    if isinstance(value, dict):
        if value.get('mediaType') == 'video' or value.get('type') == 'video':
            return copy.deepcopy(value)
        result = {key: rewrite_json(item, replace) for key, item in value.items()}
        if isinstance(value.get('url'), str):
            media = replace(value['url'])
            if media:
                for key in ('id', 'url', 'mimeType', 'width', 'height'):
                    if key in value or key == 'url':
                        result[key] = media.get(key)
        # Description image/feature blocks use src, not ImageAsset.url.
        for key in ('src', 'imageUrl'):
            if isinstance(value.get(key), str):
                media = replace(value[key])
                if media:
                    result[key] = media['url']
        return result
    if isinstance(value, str) and '<' in value:
        return rewrite_html(value, replace)
    return value


def rewrite_fields(fields, replace):
    result = copy.deepcopy(fields)
    for prefix in ('image_', 'seo_og_image_'):
        if isinstance(fields.get(prefix + 'url'), str):
            media = replace(fields[prefix + 'url'])
            if media:
                for key, source in [('url', 'url'), ('id', 'id'), ('mime_type', 'mimeType'), ('width', 'width'), ('height', 'height')]:
                    if prefix + key in fields:
                        result[prefix + key] = media.get(source)
    for key in TEXT_COLUMNS:
        if isinstance(fields.get(key), str):
            result[key] = rewrite_html(fields[key], replace)
    for key in JSON_COLUMNS:
        if key in fields:
            result[key] = rewrite_json(fields[key], replace)
    return result


def collect_rows():
    result = []
    for table, columns in TABLES.items():
        available = database("SELECT coalesce(json_agg(column_name),'[]'::json) FROM information_schema.columns WHERE table_schema='public' AND table_name=" + sql_text(table))[0]
        columns = [column for column in columns if column in available]
        pairs = ','.join(sql_text(column) + ',r.' + column for column in columns)
        join = '' if table == 'products' else (' JOIN products p ON p.id=r.product_id' if table == 'product_variants' else ' JOIN product_variants v ON v.id=r.variant_id JOIN products p ON p.id=v.product_id')
        alias = 'p' if table == 'products' else 'r'
        pairs = pairs.replace('r.', alias + '.')
        condition = ELIGIBLE + (" AND coalesce(r.media_type,'image') <> 'video'" if table == 'product_variant_gallery_images' else '')
        sql = f"SELECT json_build_object('table',{sql_text(table)},'id',{alias}.id::text,'productId',p.id,'fields',json_build_object({pairs})) FROM {table} {alias}{join} WHERE {condition} ORDER BY p.id,{alias}.id"
        result.extend(database(sql))
    return result


def row_current(row):
    allowed = TABLES.get(row['table'], [])
    if not row['before'] or any(key not in allowed for key in row['before']):
        raise ValueError('Manifest contains an unsupported table or field.')
    pairs = ','.join(sql_text(key) + ',' + key for key in row['before'])
    return database(f"SELECT json_build_object({pairs}) FROM {row['table']} WHERE id::text={sql_text(row['id'])}")


def compare_and_swap(row, before, after):
    table = row['table']
    row_current(row)  # Validate the table/columns before constructing identifiers.
    if set(before) != set(row['before']) or set(after) != set(before):
        raise ValueError('Manifest before/after fields must match.')
    assignments = ','.join(key + '=' + (sql_json(value) if key in JSON_COLUMNS else sql_text(value)) for key, value in after.items())
    pairs = ','.join(sql_text(key) + ',' + key for key in before)
    if table == 'products':
        assignments += ',version=version+1,updated_at=now()'
    parent = '' if table == 'products' else f", parent_changed AS (UPDATE products SET version=version+1,updated_at=now() WHERE id={sql_text(row['productId'])} AND EXISTS(SELECT 1 FROM changed) RETURNING id)"
    relation = f"id::text={sql_text(row['productId'])}" if table == 'products' else (f"product_id={sql_text(row['productId'])}" if table == 'product_variants' else f"EXISTS(SELECT 1 FROM product_variants v WHERE v.id=variant_id AND v.product_id={sql_text(row['productId'])})")
    eligible = f"EXISTS(SELECT 1 FROM products p WHERE p.id={sql_text(row['productId'])} AND {ELIGIBLE})"
    # Parent lock + field-level CAS: another writer's changes are never overwritten.
    sql = f"BEGIN; SELECT to_json(id) FROM products WHERE id={sql_text(row['productId'])} FOR UPDATE;"
    sql += f"WITH changed AS (UPDATE {table} SET {assignments} WHERE id::text={sql_text(row['id'])} AND {relation} AND {eligible} AND jsonb_build_object({pairs})={sql_json(before)} RETURNING id){parent} SELECT to_json(count(*)) FROM changed;COMMIT;"
    result = database(sql)
    if not result or result[-1] != 1:
        raise RuntimeError('CONFLICT: a field changed since the manifest was prepared.')


def run(args):
    path = Path(args.manifest).resolve()
    repo = Path(__file__).resolve().parents[2]
    if path == repo or repo in path.parents:
        raise ValueError('Keep manifests outside the repository.')
    identity = hashlib.sha256(json.dumps(database("SELECT json_build_array(current_database(),inet_server_addr(),inet_server_port())")[0]).encode()).hexdigest()
    if args.command == 'dry-run':
        if path.exists():
            raise ValueError('Manifest exists; use a new path.')
        origins = list(dict.fromkeys(origin(item) for item in args.source_origin))
        if not origins:
            raise ValueError('Supply at least one --source-origin.')
        rows = []
        for record in collect_rows():
            sources = set()
            def observe(url):
                candidate = legacy_url(url, origins)
                if candidate:
                    sources.add(candidate)
                return None
            rewrite_fields(record['fields'], observe)
            if sources:
                rows.append({**{key: record[key] for key in ('table', 'id', 'productId')},
                             'before': record['fields'], 'sources': sorted(sources), 'state': 'PLANNED'})
        manifest = {'version': VERSION, 'databaseIdentity': identity, 'createdAt': time.time(), 'origins': origins, 'rows': rows, 'media': {}}
        atomic_save(path, manifest)
    else:
        manifest = json.loads(path.read_text())
        if manifest.get('databaseIdentity') != identity:
            raise ValueError('Manifest belongs to another database connection.')
        if manifest.get('version') != VERSION:
            raise ValueError('Unsupported manifest version.')
        failures = 0
        for row in manifest['rows']:
            try:
                if args.command == 'verify':
                    expected = row.get('after') if row['state'] in ('APPLIED', 'REFRESH_PENDING') else row['before']
                    if row_current(row) != [expected]:
                        raise RuntimeError('CONFLICT: current values do not match the manifest.')
                    continue
                if args.command == 'rollback':
                    if 'after' not in row or row['state'] == 'ROLLED_BACK':
                        continue
                    current = row_current(row)
                    if current == [row['after']]:
                        compare_and_swap(row, row['after'], row['before'])
                    elif current != [row['before']]:
                        raise RuntimeError('CONFLICT: rollback would overwrite a later edit.')
                    row['state'] = 'ROLLBACK_REFRESH_PENDING'
                else:
                    if row['state'] == 'APPLIED':
                        continue
                    if row_current(row) != [row['before']] and row_current(row) != [row.get('after')]:
                        raise RuntimeError('CONFLICT: product changed; make a new dry-run plan.')
                    def replace(url):
                        candidate = legacy_url(url, manifest['origins'])
                        if not candidate:
                            return None
                        if candidate not in manifest['media']:
                            manifest['media'][candidate] = import_media(candidate, manifest['origins'], args.api_base)
                            atomic_save(path, manifest)
                        return manifest['media'][candidate]
                    row['after'] = rewrite_fields(row['before'], replace)
                    row['state'] = 'WRITE_PENDING'
                    atomic_save(path, manifest)
                    if row_current(row) == [row['before']]:
                        compare_and_swap(row, row['before'], row['after'])
                    row['state'] = 'REFRESH_PENDING'
                atomic_save(path, manifest)
                api_request(args.api_base, '/admin/products/' + quote(row['productId'], safe=''), 'PATCH', b'{}')
                row['state'] = 'ROLLED_BACK' if args.command == 'rollback' else 'APPLIED'
                row.pop('error', None)
            except Exception as error:
                failures += 1
                # No raw HTTP bodies, credentials or private customer data in output.
                row['error'] = type(error).__name__ + ': ' + str(error)[:200]
                print(f"{row['table']} {row['id']}: {row['error']}", file=sys.stderr)
            finally:
                if args.command != 'verify':
                    atomic_save(path, manifest)
        if failures:
            print(f'Incomplete rows: {failures}. Inspect the manifest and resume.', file=sys.stderr)
            return 1
    print(json.dumps({'products': len({row['productId'] for row in manifest['rows']}),
                      'rows': len(manifest['rows']), 'imagesImportedOrReused': len(manifest['media']),
                      'states': {state: sum(row['state'] == state for row in manifest['rows']) for state in sorted({row['state'] for row in manifest['rows']})}}))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dry-run', 'apply', 'verify', 'rollback'])
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--source-origin', action='append', default=[])
    parser.add_argument('--api-base', help='Existing backend base including /api/v1; required for apply/rollback.')
    args = parser.parse_args()
    if args.command in ('apply', 'rollback') and not args.api_base:
        parser.error('--api-base is required for writes and cache refresh.')
    return run(args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as failure:
        print(type(failure).__name__ + ': ' + str(failure)[:200], file=sys.stderr)
        sys.exit(1)
