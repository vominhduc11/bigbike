#!/usr/bin/env python3
"""Copy reviewable audit evidence, excluding access credentials and private identities.

Reads an existing owner-authorized run; it never calls the shop or an AI provider.
Semantic verdicts belong in the accompanying human-reviewed report, not this script.
"""
import argparse
import json
from pathlib import Path
import shutil


PRIVATE_KEYS = {
    'visitorId', 'visitorToken', 'token', 'accessToken', 'refreshToken',
    'conversationId', 'assistantMessageId', 'requestId', 'customerId',
    'mediaId', 'storageObjectKey', 'storageBucket', 'contentPath',
    'continuation', 'contacts', 'clarificationId',
}


def sanitize(value):
    if isinstance(value, dict):
        return {key: sanitize(item) for key, item in value.items()
                if key not in PRIVATE_KEYS and not key.lower().endswith('token')}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--private-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source, output = args.private_dir.resolve(), args.output.resolve()
    assert source != output and not output.is_relative_to(source)
    output.mkdir(parents=True, exist_ok=True)
    copied = []

    def copy_json(relative, target=None):
        path = source / relative
        if not path.exists():
            return
        destination = output / (target or relative.replace('/', '-'))
        if path.suffix == '.jsonl':
            rows = [sanitize(json.loads(line)) for line in path.read_text().splitlines() if line.strip()]
            destination.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows))
        else:
            raw = json.loads(path.read_text())
            if relative == 'order-privacy/responses.json':
                # Order/customer projections are private even when test accounts are synthetic.
                raw = [{key: value for key, value in row.items() if key != 'response'} for row in raw]
            destination.write_text(json.dumps(sanitize(raw), ensure_ascii=False, indent=2) + '\n')
        copied.append(destination.name)

    for run in ['baseline', 'preview-1', 'preview-2', 'preview-3', 'preview-4', 'preview-5',
                'preview-6', 'preview-7', 'final-80', 'image-baseline', 'image-preview',
                'video-main', 'historical-extra', 'historical-original', 'ambiguity-before',
                'last-regression', 'name-final', 'name-color-final', 'name-complete', 'name-release']:
        copy_json(run + '/responses.jsonl', run + '.jsonl')
    for name in ['baseline-catalog.json', 'catalog-variant-prices.json', 'catalog-live-recheck.json',
                 'card-fact-verification.json', 'video-server-timings.json', 'backend-full-gate.json',
                 'backend-chat-final-gate.json', 'checks-final.json', 'usage-final.json',
                 'live-cleanup.json', 'preview-cleanup.json', 'semantic-review.json',
                 'fixture-cleanup-counts.json', 'storage-cleanup.json', 'backend-runtime-image.json',
                 'nginx-candidate-check.json', 'hygiene-secret-check.json']:
        copy_json(name)
    for relative, target in {
        'video-browser/final-result.json': 'video-ui-answer.json',
        'video-browser/results.jsonl': 'video-ui.jsonl',
        'video-browser/en-results.json': 'video-ui-en.json',
        'video-admin/browser-result.json': 'video-admin-ui.json',
        'video-admin/results.json': 'video-permissions.json',
        'video-admin/permission-denied.json': 'video-admin-permission-denied.json',
        'video-duration/results.json': 'video-duration.json',
        'video-boundaries/results.jsonl': 'video-boundaries.jsonl',
        'video-validation/contracts.jsonl': 'video-contracts.jsonl',
        'video-validation/object-stat.json': 'video-object-deletion.json',
        'image-baseline/ownership.json': 'image-permissions.json',
        'order-privacy/responses.json': 'order-privacy.json',
    }.items():
        copy_json(relative, target)
    for relative in ['video-browser/chat-video-375.png', 'video-browser/chat-video-768.png',
                     'video-browser/chat-video-1440.png', 'video-browser/chat-video-en-375.png',
                     'video-admin/admin-video-1440.png']:
        path = source / relative
        if path.exists():
            shutil.copyfile(path, output / path.name)
            copied.append(path.name)
    print(json.dumps({'copiedFiles': len(copied), 'files': copied}))


if __name__ == '__main__':
    main()
