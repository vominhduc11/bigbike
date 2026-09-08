#!/usr/bin/env python3
"""Check real admin/visitor video reads on the isolated preview, without invoking AI."""
import argparse
import json
from pathlib import Path
import urllib.request
import urllib.error
from bigbike_assistant_live import save_private

parser = argparse.ArgumentParser()
parser.add_argument('--private-dir', type=Path, required=True)
args = parser.parse_args()
props = dict(line.split('=', 1) for line in (args.private_dir / 'isolate/application-audit.properties').read_text().splitlines()
             if '=' in line and not line.startswith('#'))
assert props['server.port'] == '58080'
manifest = json.loads((args.private_dir / 'video-main/private-manifest.json').read_text())
fixture = next(value for value in manifest['sessions'].values() if value.get('complete') and value.get('mediaId'))
out = args.private_dir / 'video-admin'
out.mkdir(mode=0o700, exist_ok=True)
req = urllib.request.Request('http://127.0.0.1:58080/api/v1/auth/login',
    data=json.dumps({'email': props['bigbike.seed.admin-email'], 'password': props['bigbike.seed.admin-password']}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req, timeout=15) as response:
    auth = json.load(response)['data']
save_private(out / 'private-auth.json', auth)

results = []
for case, token, admin in [('V_ADMIN_AUTHORIZED', auth['accessToken'], True),
                           ('V_ADMIN_ANONYMOUS', None, True),
                           ('V_ADMIN_VISITOR_DENIED', fixture['token'], True),
                           ('V_CUSTOMER_OWNER_READ', fixture['token'], False)]:
    resource = '/api/v1/admin/chat/videos/' if admin else '/api/v1/chat/videos/'
    headers = {}
    if token:
        headers['Authorization' if case == 'V_ADMIN_AUTHORIZED' else 'X-Chat-Visitor-Token'] = ('Bearer ' if case == 'V_ADMIN_AUTHORIZED' else '') + token
    req = urllib.request.Request('http://127.0.0.1:58080' + resource + fixture['mediaId'] + '/content', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            row = {'caseId': case, 'http': response.status, 'bytes': len(response.read()), 'cacheControl': response.headers.get('Cache-Control')}
    except urllib.error.HTTPError as error:
        row = {'caseId': case, 'http': error.code}
    results.append(row)
    print(json.dumps(row), flush=True)
(out / 'results.json').write_text(json.dumps(results, indent=2))
assert results[0]['http'] == 200 and results[0]['cacheControl'] == 'no-store'
assert results[1]['http'] in (401, 403) and results[2]['http'] in (401, 403)
assert results[3]['http'] == 200 and results[3]['cacheControl'] == 'no-store'
