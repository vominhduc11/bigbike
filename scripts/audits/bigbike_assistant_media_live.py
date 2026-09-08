#!/usr/bin/env python3
"""Real media audit, serial and opt-in. Uses only test identities in its manifest."""
import argparse
import json
import mimetypes
from pathlib import Path
import time
import subprocess
import urllib.error
import urllib.request
import uuid
from bigbike_assistant_live import quotas, request, save_private


def upload(base, kind, fields, file, token):
    boundary = 'BigBikeAudit' + uuid.uuid4().hex
    parts = []
    for key, value in fields.items():
        if value is not None:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="E2E_AUDIT{file.suffix}"\r\nContent-Type: {mimetypes.guess_type(file)[0] or "application/octet-stream"}\r\n\r\n'.encode(), file.read_bytes(), f'\r\n--{boundary}--\r\n'.encode()])
    req = urllib.request.Request(base + '/api/v1/chat/' + kind + 's', data=b''.join(parts),
        headers={'Content-Type': 'multipart/form-data; boundary=' + boundary, 'X-Chat-Visitor-Token': token}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=75) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def video_quota(container):
    if not container:
        return None
    label = subprocess.check_output(['docker', 'inspect', '--format', '{{ index .Config.Labels "bigbike.task" }}', container], text=True).strip()
    if label != 'assistant-20260908':
        raise RuntimeError('Video quota target is not the isolated audit database')
    value = subprocess.check_output(['docker', 'exec', container, 'psql', '-X', '-U', 'assistant_audit', '-d', 'assistant_audit', '-At', '-c',
        "SELECT coalesce((SELECT used_count FROM chat_video_daily_usage WHERE usage_date=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),0)"], text=True)
    return int(value.strip())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://localhost:8080')
    parser.add_argument('--cases', type=Path, required=True)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--authorized-live', action='store_true')
    parser.add_argument('--video-quota-container')
    args = parser.parse_args()
    if not args.authorized_live:
        parser.error('Owner authorization is required.')
    args.run_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = args.run_dir / 'private-manifest.json'
    manifest = json.loads(path.read_text()) if path.exists() else {
        'run': 'E2E_ASSISTANT_MEDIA_' + uuid.uuid4().hex, 'base': args.base,
        'baselineQuotas': quotas(), 'sessions': {}}
    if manifest['base'] != args.base:
        parser.error('Manifest environment differs.')
    for case in json.loads(args.cases.read_text()):
        if manifest['sessions'].get(case['id'], {}).get('complete'):
            continue
        before = quotas()
        before['videos'] = video_quota(args.video_quota_container)
        if case.get('kind') == 'video' and (before['videos'] is None or before['videos'] >= 8):
            raise RuntimeError('Real video allowance is unavailable or exhausted')
        if before['text'] >= 200 or before['images'] >= 8:
            raise RuntimeError('Audit allowance reached; preserve customer capacity.')
        session = manifest['sessions'].get(case['id'])
        if not session:
            visitor = str(uuid.uuid4())
            status, opened = request(args.base, 'POST', '/api/v1/chat/sessions', {'visitorId': visitor, 'locale': case['lang']})
            if status != 200:
                raise RuntimeError('Could not open test session')
            session = {'visitorId': visitor, 'token': opened['data']['visitorToken'], 'requestId': str(uuid.uuid4())}
            manifest['sessions'][case['id']] = session
            save_private(path, manifest)
        kind = case.get('kind', 'image')
        started = time.monotonic()
        status, result = upload(args.base, kind, {'requestId': session['requestId'], 'lang': case['lang']}, Path(case['file']), session['token'])
        if status == 200:
            session['conversationId'] = result['data']['conversationId']
            session['mediaId'] = result['data'][kind]['id']
            save_private(path, manifest)
            body = {'conversationId': session['conversationId'], 'requestId': session['requestId'],
                    'visitorToken': session['token'], 'message': case.get('message', ''), 'lang': case['lang'], kind + 'Ids': [session['mediaId']]}
            status, result = request(args.base, 'POST', '/api/v1/chat/messages', body, session['token'])
        elapsed = round(time.monotonic() - started, 3)
        safe = {k: v for k, v in result.get('data', {}).items() if k not in {'conversationId','assistantMessageId','continuation'}}
        evidence = {'caseId': case['id'], 'kind': kind, 'lang': case['lang'], 'message': case.get('message', ''),
                    'http': status, 'seconds': elapsed, 'response': safe, 'error': result.get('error'), 'quotaBefore': before, 'quotaAfter': {**quotas(), 'videos': video_quota(args.video_quota_container)}}
        with (args.run_dir / 'responses.jsonl').open('a') as out:
            out.write(json.dumps(evidence, ensure_ascii=False) + '\n')
        print(json.dumps(evidence, ensure_ascii=False), flush=True)
        session['complete'] = status == 200
        save_private(path, manifest)
        time.sleep(14)


if __name__ == '__main__':
    main()
