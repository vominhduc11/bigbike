#!/usr/bin/env python3
"""HTTP/file lifecycle checks on owner-authorized isolated fixtures; never spends video AI."""
import argparse
import json
from pathlib import Path
import subprocess
import time
import urllib.request
import urllib.error
import uuid
from bigbike_assistant_live import request, save_private, quotas
from bigbike_assistant_media_live import upload, video_quota

parser = argparse.ArgumentParser()
parser.add_argument('--private-dir', type=Path, required=True)
parser.add_argument('--authorized-fixtures', action='store_true')
args = parser.parse_args()
if not args.authorized_fixtures:
    parser.error('Explicit owner fixture authorization is required')
base = 'http://127.0.0.1:58080'
container = 'bb-assistant-audit-pg-20260908'
video_quota(container)  # Checks the task label before any private fixture write.
out = args.private_dir / 'video-validation'
manifest_path = out / 'private-manifest.json'
manifest = json.loads(manifest_path.read_text())

def emit(case, status, **details):
    row = {'caseId': case, 'http': status, **details}
    with (out / 'contracts.jsonl').open('a') as file:
        file.write(json.dumps(row, ensure_ascii=False) + '\n')
    print(json.dumps(row, ensure_ascii=False), flush=True)

def content(token=None):
    req = urllib.request.Request(base + '/api/v1/chat/videos/' + manifest['video']['id'] + '/content',
        headers={'X-Chat-Visitor-Token': token} if token else {})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status, {'bytes': len(res.read()), 'cache': res.headers.get('Cache-Control')}
    except urllib.error.HTTPError as error:
        return error.code, {}

before = {**quotas(), 'videos': video_quota(container)}
for case, token in [('V_OWNER_READ', manifest['token']), ('V_ANONYMOUS_READ', None)]:
    status, details = content(token); emit(case, status, **details)
status, opened = request(base, 'POST', '/api/v1/chat/sessions', {'visitorId': str(uuid.uuid4()), 'locale': 'en'})
assert status == 200
manifest['otherToken'] = opened['data']['visitorToken']; save_private(manifest_path, manifest)
status, details = content(manifest['otherToken']); emit('V_OTHER_VISITOR_READ', status, **details)
body = {'conversationId': manifest['conversationId'], 'requestId': manifest['requestId'],
        'visitorToken': manifest['token'], 'message': '', 'lang': 'vi', 'videoIds': [manifest['video']['id']]}
status, result = request(base, 'POST', '/api/v1/chat/messages', body, manifest['token'])
emit('V_EXPIRED_TURN_DEADLINE', status, answer=result.get('data', {}).get('answer'))
time.sleep(7)
status, replay = request(base, 'POST', '/api/v1/chat/messages', body, manifest['token'])
emit('V_TIMEOUT_REPLAY', status, sameAnswer=result.get('data', {}).get('answer') == replay.get('data', {}).get('answer'))
time.sleep(7)
invalid = dict(body, requestId=str(uuid.uuid4()), imageIds=[str(uuid.uuid4())])
status, result = request(base, 'POST', '/api/v1/chat/messages', invalid, manifest['token'])
emit('V_IMAGE_VIDEO_EXCLUSIVE', status, error=result.get('error'))
time.sleep(7)
status, result = upload(base, 'video', {'requestId': manifest['requestId'], 'lang': 'vi'},
    args.private_dir / 'media/videos/operation-04.mp4', manifest['token'])
emit('V_UPLOAD_REPLAY', status, sameVideo=result.get('data', {}).get('video', {}).get('id') == manifest['video']['id'])

# Expire only the video enumerated in this private manifest, simulating the seven-day boundary.
video_id = str(uuid.UUID(manifest['video']['id']))
sql = "UPDATE chat_videos SET expires_at=now()-interval '1 second' WHERE id='" + video_id + "'::uuid"
subprocess.run(['docker', 'exec', container, 'psql', '-X', '-U', 'assistant_audit', '-d', 'assistant_audit',
    '-v', 'ON_ERROR_STOP=1', '-c', sql], check=True, capture_output=True)
status, details = content(manifest['token']); emit('V_SEVEN_DAY_ACCESS_CUTOFF', status)
for _ in range(10):
    status = subprocess.check_output(['docker', 'exec', container, 'psql', '-X', '-U', 'assistant_audit', '-d',
        'assistant_audit', '-At', '-c', "SELECT status FROM chat_videos WHERE id='" + video_id + "'::uuid"], text=True).strip()
    if status == 'DELETED': break
    time.sleep(7)
emit('V_RETENTION_JOB', 200 if status == 'DELETED' else 500, storedStatus=status,
     quotaBefore=before, quotaAfter={**quotas(), 'videos': video_quota(container)})
