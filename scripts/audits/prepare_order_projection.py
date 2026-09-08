#!/usr/bin/env python3
"""Copy two PII-free real order projections into an explicitly isolated audit DB.

No production writes. The private manifest contains test credentials and must never
be committed. Order/customer identities are replaced; amounts, states and items are
read from the live database. This is not evidence of a real customer's account login.
"""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import uuid
from bigbike_assistant_live import db, save_private

parser = argparse.ArgumentParser()
parser.add_argument('--private-dir', type=Path, required=True)
parser.add_argument('--container', default='bb-assistant-audit-pg-20260908')
parser.add_argument('--authorized-isolated', action='store_true')
a = parser.parse_args()
if not a.authorized_isolated:
    parser.error('Explicit isolated-test authorization required')
label = subprocess.check_output(['docker', 'inspect', '--format', '{{index .Config.Labels "bigbike.task"}}', a.container], text=True).strip()
if label != 'assistant-20260908':
    raise RuntimeError('Refusing a database without this task label')
a.private_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
manifest_path = a.private_dir / 'private-manifest.json'
if manifest_path.exists():
    raise RuntimeError('Fixture already has a manifest; do not duplicate it')
fields = ['status','currency','subtotal_amount','discount_amount','shipping_amount','fee_amount','tax_amount','total_amount','paid_amount','created_at','updated_at','placed_at','channel','fulfillment_type','locale']
items = ['product_name','quantity','unit_price','line_subtotal','line_discount','line_tax','line_total','created_at','updated_at']
projection = db("SELECT coalesce(json_agg(x),'[]') FROM (SELECT " + ','.join('o.'+x for x in fields)
    + ", (SELECT json_agg(i) FROM (SELECT " + ','.join(items)
    + " FROM order_line_items WHERE order_id=o.id) i) AS items FROM orders o WHERE EXISTS (SELECT 1 FROM order_line_items i WHERE i.order_id=o.id) ORDER BY o.created_at DESC LIMIT 2) x;")
rows = json.loads(projection)
if len(rows) != 2:
    raise RuntimeError('Two real order projections are required')

def sql_value(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"

manifest = {'environment':'isolated', 'source':'PII-free live order projection', 'accounts':[], 'expected':[]}
statements = ['BEGIN']
for index, row in enumerate(rows):
    customer, session, order = (str(uuid.uuid4()) for _ in range(3))
    token = secrets.token_urlsafe(32)
    number = 'E2E_ASSISTANT_20260908_' + chr(65 + index)
    digest = hashlib.sha256(token.encode()).hexdigest()
    statements.append(f"INSERT INTO customers(id,status,is_synthetic,created_at,updated_at) VALUES ('{customer}','ACTIVE',true,now(),now())")
    statements.append(f"INSERT INTO customer_sessions(id,customer_id,session_token_hash,status,session_expires_at,created_at,updated_at) VALUES ('{session}','{customer}','{digest}','ACTIVE',now()+interval '12 hours',now(),now())")
    values = [order,customer,number] + [row.get(x) for x in fields]
    statements.append('INSERT INTO orders(id,customer_id,order_number,' + ','.join(fields) + ') VALUES (' + ','.join(map(sql_value,values)) + ')')
    for item in row['items']:
        values = [str(uuid.uuid4()),order] + [item.get(x) for x in items]
        statements.append('INSERT INTO order_line_items(id,order_id,' + ','.join(items) + ') VALUES (' + ','.join(map(sql_value,values)) + ')')
    manifest['accounts'].append({'customerId':customer,'sessionId':session,'cookie':token,'orderId':order,'orderNumber':number})
    manifest['expected'].append({'orderNumber':number,**row})
statements.append('COMMIT')
save_private(manifest_path,manifest)
result = subprocess.run(['docker','exec','-i',a.container,'psql','-X','-U','assistant_audit','-d','assistant_audit','-v','ON_ERROR_STOP=1'],input=';\n'.join(statements)+';',text=True,capture_output=True)
if result.returncode:
    raise RuntimeError('Isolated fixture transaction failed; inspect private DB')
print(json.dumps({'createdTestAccounts':2,'copiedAnonymizedOrderProjections':2,'productionWrites':0}))
