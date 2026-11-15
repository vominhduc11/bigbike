"""Private exact dataset transfer between the two job-owned CI benchmark arms.

This is not a shop backup/import tool. The database archive contains synthetic
accounts and sessions and must never be placed in downloadable artifacts. Only
``identity(snapshot)`` is suitable for publication.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import quote, urlsplit

from ci_guard import loopback_url, project_name, require_ci, safe_directory
from s3_setup import signed_request


ORIGIN = 'http://localhost:19000'
BUCKET = 'bigbike-media'
MAX_OBJECT_BYTES = 210 * 1024 * 1024


def _guard(stack):
    require_ci()
    project_name(stack.project)
    loopback_url(ORIGIN)
    if not callable(getattr(stack, 'compose_command', None)):
        raise ValueError('Job-owned Compose command builder required')
    if not isinstance(getattr(stack, 'password', None), str) or not stack.password:
        raise ValueError('Ephemeral CI storage credential required')


def _directory(path):
    boundary = os.environ.get('RUNNER_TEMP')
    if not boundary:
        raise ValueError('Job temporary directory required')
    return safe_directory(path, boundary)


def _command_environment():
    # No inherited app/provider credentials, remote Docker host or pg connection.
    return {key: os.environ[key] for key in ('PATH', 'HOME', 'LANG', 'LC_ALL') if key in os.environ}


def _run(stack, arguments, *, stdin=None, stdout=subprocess.DEVNULL):
    command = stack.compose_command(*arguments)
    if (command[:2] != ['docker', 'compose'] or command.count('-p') != 1
            or command[command.index('-p') + 1] != stack.project
            or '--project-name' in command):
        raise ValueError('Compose command must target exactly the job-owned project')
    try:
        result = subprocess.run(command, stdin=stdin, stdout=stdout,
                                stderr=subprocess.PIPE, env=_command_environment(), timeout=180,
                                check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RuntimeError('Private CI dataset command failed') from error
    if result.returncode:
        # pg errors may include snapshot values; never expose captured stderr.
        raise RuntimeError('Private CI dataset command failed')
    return result


def _checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _key(value):
    if not isinstance(value, str) or not value.startswith('uploads/'):
        raise ValueError('Only generated fixture upload keys are eligible')
    if any(char in value for char in ('\\', '\x00', '\r', '\n', '?', '#')):
        raise ValueError('Unsafe fixture upload key')
    if any(part in ('', '.', '..') for part in value.split('/')):
        raise ValueError('Unsafe fixture upload key')
    return value


def _variant_key(value):
    if not isinstance(value, str):
        raise ValueError('Fixture variant path must be a relative media URL')
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or not parsed.path.startswith('/media/'):
        raise ValueError('Fixture variant path must be a relative media URL')
    return _key(parsed.path[len('/media/'):])


def _media_keys(fixtures):
    records = fixtures.get('media')
    if isinstance(records, dict):
        records = [records]
    if not isinstance(records, list) or not records or not all(isinstance(row, dict) for row in records):
        raise ValueError('Stored fixture media records required')
    keys = set()
    for row in records:
        keys.add(_key(row.get('filePath')))
        sizes = row.get('sizes')
        if isinstance(sizes, str):
            try:
                sizes = json.loads(sizes)
            except (ValueError, TypeError) as error:
                raise ValueError('Invalid fixture variant metadata') from error
        if sizes is None:
            sizes = {}
        if not isinstance(sizes, dict):
            raise ValueError('Invalid fixture variant metadata')
        keys.update(_variant_key(value) for value in sizes.values())
    return sorted(keys), len(records)


def _object_path(key):
    return '/' + BUCKET + '/' + quote(_key(key), safe='/')


def _content_type(headers):
    value = next((value for key, value in headers.items() if key.lower() == 'content-type'), None)
    if not isinstance(value, str) or not value or '\r' in value or '\n' in value:
        raise ValueError('Stored fixture MIME type required')
    return value


def identity(snapshot):
    """Return hashes/counts only; never return archive paths, object keys or sessions."""
    objects = snapshot['objects']
    manifest = [{'key': row['key'], 'sha256': row['sha256'], 'bytes': row['bytes'],
                 'content_type': row['content_type']} for row in objects]
    fingerprint = hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return {'database_archive_sha256': snapshot['database']['sha256'],
            'database_archive_bytes': snapshot['database']['bytes'],
            'media_manifest_sha256': fingerprint, 'media_objects': len(objects),
            'media_total_bytes': sum(row['bytes'] for row in objects),
            'fixture_product_count': snapshot['fixture_product_count'],
            'fixture_media_records': snapshot['fixture_media_records'],
            'large_catalog_count': snapshot.get('large_catalog_count', 0)}


def capture(stack, fixtures, private_dir):
    """Capture after first-arm seeding, before functional/test writes; return PRIVATE metadata."""
    _guard(stack)
    keys, record_count = _media_keys(fixtures)
    directory = _directory(Path(private_dir) / 'frozen-dataset')
    directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    directory.chmod(0o700)
    archive = directory / 'database.dump'
    with archive.open('xb') as output:
        archive.chmod(0o600)
        _run(stack, ('exec', '-T', 'postgres', 'pg_dump', '-U', 'perf', '-d', 'bigbike_perf',
                     '--format=custom', '--no-owner', '--no-acl'), stdout=output)
    with archive.open('rb') as source:
        if source.read(5) != b'PGDMP':
            raise RuntimeError('Private database archive format invalid')
    snapshot = {'private_directory': str(directory),
                'database': {'filename': archive.name, 'sha256': _checksum(archive), 'bytes': archive.stat().st_size},
                'objects': [], 'fixture_product_count': len(fixtures.get('products', [])),
                'fixture_media_records': record_count,
                'large_catalog_count': fixtures.get('large_catalog', {}).get('count', 0)}
    for index, key in enumerate(keys):
        content, headers = signed_request(ORIGIN, stack.password, 'GET', _object_path(key))
        if not content or len(content) > MAX_OBJECT_BYTES:
            raise ValueError('Stored fixture object is empty or exceeds the bounded snapshot size')
        filename = f'media-{index:06d}.bin'
        destination = directory / filename
        with destination.open('xb') as output:
            destination.chmod(0o600)
            output.write(content)
        snapshot['objects'].append({'key': key, 'filename': filename, 'content_type': _content_type(headers),
                                    'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
    return snapshot


def _checked_file(directory, record, expected_filename):
    if record.get('filename') != expected_filename:
        raise ValueError('Unexpected private dataset filename')
    path = directory / expected_filename
    if path.is_symlink() or not path.is_file():
        raise ValueError('Private dataset file missing or unsafe')
    if path.stat().st_size != record['bytes'] or _checksum(path) != record['sha256']:
        raise ValueError('Private dataset checksum mismatch')
    return path


def restore(stack, snapshot):
    """Restore into fresh owned services before starting the second-arm backend."""
    _guard(stack)
    directory = _directory(snapshot['private_directory'])
    if not directory.is_dir() or directory.is_symlink():
        raise ValueError('Private dataset directory missing or unsafe')
    archive = _checked_file(directory, snapshot['database'], 'database.dump')
    objects, seen = [], set()
    # Validate every private input before changing any service state.
    for index, record in enumerate(snapshot['objects']):
        key = _key(record['key'])
        if key in seen or not 0 < record['bytes'] <= MAX_OBJECT_BYTES:
            raise ValueError('Duplicate or invalid fixture object')
        seen.add(key)
        _content_type({'Content-Type': record['content_type']})
        objects.append((record, _checked_file(directory, record, f'media-{index:06d}.bin')))
    if not objects:
        raise ValueError('Stored fixture objects required')
    running = _run(stack, ('ps', '--status', 'running', '-q', 'bigbike-backend'), stdout=subprocess.PIPE)
    if running.stdout.strip():
        raise ValueError('Restore must occur before starting the CI backend')
    with archive.open('rb') as source:
        _run(stack, ('exec', '-T', 'postgres', 'pg_restore', '-U', 'perf', '-d', 'bigbike_perf',
                     '--clean', '--if-exists', '--exit-on-error', '--no-owner', '--no-acl'), stdin=source)
    for record, source in objects:
        content = source.read_bytes()
        path = _object_path(record['key'])
        signed_request(ORIGIN, stack.password, 'PUT', path, content, content_type=record['content_type'])
        stored, headers = signed_request(ORIGIN, stack.password, 'GET', path)
        if hashlib.sha256(stored).hexdigest() != record['sha256'] or _content_type(headers) != record['content_type']:
            raise RuntimeError('Restored fixture object verification failed')
    return identity(snapshot)
