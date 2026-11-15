#!/usr/bin/env python3
"""Deliver only known sanitized JSON outputs via bounded job logs, without artifacts."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

NAMES = frozenset(('reused-frontend.json', 'bigbike-admin.json', 'bigbike-web.json', 'backend.json',
    'toolchain.json', 'fixture-identities.json', 'source-identities.json',
    'status.json', 'dataset-identity.json', 'build-identity.json', 'runtime-identity.json',
    'functional.json', 'commerce.json', 'revalidation.json', 'media.json', 'browser.json', 'admin-smoke.json',
    'lighthouse.json', 'api.json', 'resources.json', 'pool-before.json', 'pool-after.json',
    'comparison.json', 'comparison-status.json', 'browser-egress-native.json', 'large-seed.json', 'large-catalog-pages.json'))


def bundle(directory):
    directory = Path(directory).resolve()
    reports = {}
    if directory.exists():
        for path in sorted(directory.rglob('*.json')):
            if (path.is_symlink() or not path.resolve().is_relative_to(directory)
                    or path.name not in NAMES):
                raise ValueError('Refusing unapproved result file')
            if path.stat().st_size > 4 * 1024 * 1024:
                raise ValueError('Result exceeds per-file log budget')
            reports[path.relative_to(directory).as_posix()] = json.loads(path.read_text())
    raw = json.dumps(reports, separators=(',', ':'), sort_keys=True).encode()
    if len(raw) > 12 * 1024 * 1024:
        raise ValueError('Results exceed uncompressed log budget')
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    if len(packed) > 1024 * 1024:
        raise ValueError('Results exceed compressed log budget')
    encoded = base64.b64encode(packed).decode()
    digest = hashlib.sha256(packed).hexdigest()
    return [f'BBPERF-BEGIN {digest} {len(packed)}',
            *['BBPERF-DATA ' + encoded[i:i + 3072] for i in range(0, len(encoded), 3072)],
            'BBPERF-END ' + digest]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    print('\n'.join(bundle(parser.parse_args().directory)))
