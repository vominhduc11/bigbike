#!/usr/bin/env python3
"""Serial, opt-in live chat audit. Secrets stay in a private run directory.

Run only with the shop owner's authorization. This creates chat sessions and
consumes real AI allowances. Cleanup deletes only identities in this run's manifest.
The output is evidence for review, never an automatic claim of semantic correctness.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import uuid


def db(sql):
    command = ['docker', 'exec', 'bigbike-postgres', 'sh', '-c',
               'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1 -c "$1"',
               'psql', sql]
    return subprocess.check_output(command, text=True).strip()


def quotas():
    return json.loads(db("""SELECT json_build_object('date',
      (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
      'text',coalesce((SELECT used_count FROM chat_ai_daily_usage WHERE usage_date=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),0),
      'images',coalesce((SELECT used_count FROM chat_image_daily_usage WHERE usage_date=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),0));"""))


def request(base, method, path, body=None, token=None):
    headers = {'Accept': 'application/json', 'User-Agent': 'BigBike-owner-authorized-audit/20260908'}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['X-Chat-Visitor-Token'] = token
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=80) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        try:
            payload = json.load(error)
        except Exception:
            payload = {'error': {'code': 'NON_JSON_HTTP_ERROR'}}
        payload['retryAfterSeconds'] = error.headers.get('Retry-After')
        return error.code, payload


def save_private(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://localhost:8080')
    parser.add_argument('--cases', type=Path, required=True)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--start', type=int, default=0)
    parser.add_argument('--count', type=int, default=10)
    parser.add_argument('--authorized-live', action='store_true')
    parser.add_argument('--cleanup', action='store_true')
    args = parser.parse_args()
    if not args.authorized_live:
        parser.error('Explicit --authorized-live is required after owner authorization.')
    args.run_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    manifest_path = args.run_dir / 'private-manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
        'run': 'E2E_ASSISTANT_' + uuid.uuid4().hex, 'base': args.base,
        'baselineQuotas': quotas(), 'sessions': {}}
    if manifest['base'] != args.base:
        parser.error('The run manifest belongs to another environment.')
    if args.cleanup:
        for name, session in manifest['sessions'].items():
            if session.get('deleted'):
                continue
            status, result = request(args.base, 'DELETE', '/api/v1/chat/history', token=session['token'])
            if status != 200 or not result.get('data', {}).get('deleted'):
                raise RuntimeError('Scoped cleanup failed for ' + name)
            session['deleted'] = True
            save_private(manifest_path, manifest)
        print(json.dumps({'cleanup': 'complete', 'sessions': len(manifest['sessions']), 'quotas': quotas()}))
        return
    cases = json.loads(args.cases.read_text())[args.start:args.start + args.count]
    evidence_path = args.run_dir / 'responses.jsonl'
    done = {json.loads(line)['caseId'] for line in evidence_path.read_text().splitlines()
            if json.loads(line)['http'] != 429} if evidence_path.exists() else set()
    for case in cases:
        if case['id'] in done:
            continue
        before = quotas()
        if before['text'] >= 200 or before['text'] - manifest['baselineQuotas']['text'] >= 160:
            raise RuntimeError('Live audit budget exhausted; preserve the customer allowance.')
        name = case.get('thread', case['id'])
        session = manifest['sessions'].get(name)
        if not session:
            visitor = str(uuid.uuid5(uuid.NAMESPACE_URL, manifest['run'] + '/' + name))
            status, result = request(args.base, 'POST', '/api/v1/chat/sessions', {'visitorId': visitor, 'locale': case['lang']})
            if status != 200:
                raise RuntimeError('Session creation failed: HTTP ' + str(status))
            session = {'visitorId': visitor, 'token': result['data']['visitorToken'], 'conversationId': None, 'requests': {}}
            manifest['sessions'][name] = session
        request_id = session['requests'].setdefault(case['id'], str(uuid.uuid4()))
        save_private(manifest_path, manifest)
        body = {'requestId': request_id, 'conversationId': session['conversationId'],
                'visitorToken': session['token'], 'message': case['question'], 'lang': case['lang']}
        if case.get('pageContext'):
            body['pageContext'] = case['pageContext']
        started = time.monotonic()
        status, result = request(args.base, 'POST', '/api/v1/chat/messages', body, session['token'])
        if status == 429:
            delay = min(60, max(7, int(result.get('retryAfterSeconds') or 15)))
            print(json.dumps({'caseId': case['id'], 'rateLimited': True, 'waitSeconds': delay}), flush=True)
            time.sleep(delay)
            status, result = request(args.base, 'POST', '/api/v1/chat/messages', body, session['token'])
        seconds = round(time.monotonic() - started, 3)
        data = result.get('data', {})
        session['conversationId'] = data.get('conversationId') or session['conversationId']
        save_private(manifest_path, manifest)
        safe_data = {k: v for k, v in data.items() if k not in {'conversationId', 'assistantMessageId', 'continuation'}}
        row = {'caseId': case['id'], 'lang': case['lang'], 'question': case['question'],
               'category': case['category'], 'thread': name, 'at': dt.datetime.now(dt.timezone.utc).isoformat(),
               'http': status, 'seconds': seconds, 'response': safe_data,
               'error': result.get('error'), 'quotaBefore': before, 'quotaAfter': quotas()}
        with evidence_path.open('a') as out:
            out.write(json.dumps(row, ensure_ascii=False) + '\n')
        evidence_path.chmod(0o600)
        print(json.dumps({'caseId': case['id'], 'http': status, 'seconds': seconds,
                          'kind': data.get('resultKind'), 'answer': data.get('answer'),
                          'products': [p.get('name') for p in data.get('products', [])]}, ensure_ascii=False), flush=True)
        # The running shop allows ten chat requests/minute. Do not alter or bypass that gate.
        time.sleep(7)
    print(json.dumps({'batchComplete': True, 'quotas': quotas()}), flush=True)


if __name__ == '__main__':
    main()
