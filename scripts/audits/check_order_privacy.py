#!/usr/bin/env python3
"""Exercise real customer-session ownership against the isolated order projections."""
import argparse
import json
from pathlib import Path
import time
import urllib.request
import urllib.error
import uuid
from bigbike_assistant_live import quotas, save_private

parser = argparse.ArgumentParser()
parser.add_argument('--private-dir', type=Path, required=True)
parser.add_argument('--base', default='http://localhost:58080')
a = parser.parse_args()
if a.base != 'http://localhost:58080':
    parser.error('This fixture is restricted to the isolated preview')
p = a.private_dir / 'private-manifest.json'
m = json.loads(p.read_text())
if m['environment'] != 'isolated':
    raise RuntimeError('Wrong fixture environment')

def call(path, body, cookie):
    headers = {'Content-Type':'application/json'}
    if cookie:
        headers['Cookie'] = 'bb_session=' + cookie
    req = urllib.request.Request(a.base + path, data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=75) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)

rows = []
for i, lang in [(0,'vi'),(1,'en'),(None,'en')]:
    account = m['accounts'][i] if i is not None else None
    cookie = account['cookie'] if account else None
    before = quotas()
    status, opened = call('/api/v1/chat/sessions', {'visitorId':str(uuid.uuid4()),'locale':lang}, cookie)
    if status != 200:raise RuntimeError('Session open failed')
    visitor_token = opened['data']['visitorToken']
    m.setdefault('testChats',[]).append({'token':visitor_token,'account':i})
    save_private(p,m)
    body = {'requestId':str(uuid.uuid4()), 'message':'Kiểm tra đơn hàng gần nhất của tôi' if lang=='vi' else 'Check my latest order', 'lang':lang,'visitorToken':visitor_token,
            'customerId':m['accounts'][1 if i==0 else 0]['customerId']}
    status,result=call('/api/v1/chat/messages',body,cookie)
    if status==429:
        time.sleep(20);status,result=call('/api/v1/chat/messages',body,cookie)
    data=result.get('data',{});answer=data.get('answer','')
    own = account is not None and account['orderNumber'] in answer
    other = any(x['orderNumber'] in answer for n,x in enumerate(m['accounts']) if n!=i)
    rows.append({'case':'signed-in-'+lang if account else 'guest-forged-customer-id','http':status,
                 'ownOrderShown':own,'otherOrderShown':other,'response':data,
                 'quotaBefore':before,'quotaAfter':quotas()})
    time.sleep(7)
save_private(a.private_dir/'responses.json',rows)
print(json.dumps([{k:v for k,v in x.items() if k!='response'} for x in rows]))
