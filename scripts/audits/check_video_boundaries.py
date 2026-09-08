#!/usr/bin/env python3
"""Real decoding and HTTP limits, exclusively on authorized preview fixtures; zero AI calls."""
import argparse
import json
from pathlib import Path
import time
import uuid
from bigbike_assistant_live import request, save_private
from bigbike_assistant_media_live import upload, video_quota

parser = argparse.ArgumentParser()
parser.add_argument('--private-dir', type=Path, required=True)
parser.add_argument('--authorized-fixtures', action='store_true')
args = parser.parse_args()
if not args.authorized_fixtures:
    parser.error('Owner fixture authorization required')
base = 'http://127.0.0.1:58080'
container = 'bb-assistant-audit-pg-20260908'
out = args.private_dir / 'video-boundaries'
out.mkdir(mode=0o700, exist_ok=True)
manifest_path = out / 'private-manifest.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'sessions': {}}
before = video_quota(container)

def emit(case, status, **details):
    row = {'caseId': case, 'http': status, **details, 'videoQuota': video_quota(container)}
    with (out / 'results.jsonl').open('a') as file:
        file.write(json.dumps(row, ensure_ascii=False) + '\n')
    print(json.dumps(row, ensure_ascii=False), flush=True)

def session(key):
    if key in manifest['sessions']:
        return manifest['sessions'][key]
    visitor = str(uuid.uuid4())
    status, opened = request(base, 'POST', '/api/v1/chat/sessions', {'visitorId': visitor, 'locale': 'en'})
    assert status == 200
    value = {'visitorId': visitor, 'token': opened['data']['visitorToken'], 'uploads': []}
    manifest['sessions'][key] = value
    save_private(manifest_path, manifest)
    time.sleep(7)
    return value

large = out / 'over-40mb.mp4'
with large.open('wb') as file:
    file.truncate(40 * 1024 * 1024 + 1)
corrupt = out / 'invalid.mp4'
corrupt.write_bytes(b'not a video')
media = args.private_dir / 'media/videos'
cases = [('V_WEBM_DECODE', media / 'operation-04.webm', 200),
         ('V_SECOND_VIDEO', media / 'operation-04.mov', 200),
         ('V_THIRD_VIDEO', media / 'operation-04.mp4', 400),
         ('V_BYTES_40MB_PLUS_ONE', large, 400),
         ('V_CORRUPT_MP4', corrupt, 400)]
for case, file, expected in cases:
    owner = session('limits' if case in {'V_WEBM_DECODE', 'V_SECOND_VIDEO', 'V_THIRD_VIDEO'} else case)
    request_id = str(uuid.uuid4())
    started = time.monotonic()
    status, result = upload(base, 'video', {'requestId': request_id, 'lang': 'en', 'conversationId': owner.get('conversationId')}, file, owner['token'])
    data = result.get('data', {})
    if status == 200:
        owner['conversationId'] = data['conversationId']
        owner['uploads'].append({'requestId': request_id, 'video': data['video']})
        save_private(manifest_path, manifest)
    safe = {k: data.get('video', {}).get(k) for k in ['mimeType', 'sizeBytes', 'durationSeconds', 'hasAudio']}
    emit(case, status, seconds=round(time.monotonic() - started, 3), video=safe,
         remainingMillis=data.get('remainingMillis'), error=result.get('error'))
    assert status == expected, case
    time.sleep(7)
owner = manifest['sessions']['limits']
body = {'conversationId': owner['conversationId'], 'visitorToken': owner['token'], 'requestId': str(uuid.uuid4()),
        'lang': 'en', 'message': '', 'videoIds': [entry['video']['id'] for entry in owner['uploads']]}
status, result = request(base, 'POST', '/api/v1/chat/messages', body, owner['token'])
emit('V_TWO_VIDEOS_IN_ONE_TURN', status, error=result.get('error'))
assert status == 400
assert video_quota(container) == before, 'Validation must not consume native AI'
