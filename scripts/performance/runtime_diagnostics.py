"""Fixed, payload-free evidence from a failing CI-owned stack before cleanup."""
import json
import re

from ci_guard import project_name, require_ci


SERVICES = frozenset(('postgres', 'redis', 'minio', 'bigbike-backend',
                      'bigbike-web', 'bigbike-admin', 'api-proxy'))
SIGNATURES = (
    ('product_read_unavailable', r'PRODUCT_TEMPORARILY_UNAVAILABLE'),
    ('node_type_error', r'\bTypeError\b'),
    ('node_reference_error', r'\bReferenceError\b'),
    ('node_range_error', r'\bRangeError\b'),
    ('node_module_missing', r'Cannot find module|MODULE_NOT_FOUND'),
    ('node_esm_interop', r'ERR_REQUIRE_ESM|ERR_REQUIRE_ASYNC_MODULE|require\(\) of ES Module'),
    ('connection_refused', r'ECONNREFUSED|Connection refused'),
    ('connection_reset', r'ECONNRESET|Connection reset'),
    ('upstream_timeout', r'ETIMEDOUT|TimeoutError|timed out'),
    ('file_permission', r'\bEACCES\b|\bEPERM\b'),
    ('file_missing', r'\bENOENT\b'),
    ('out_of_memory', r'OutOfMemoryError|heap out of memory'),
    ('next_image_origin', r'Invalid src prop|hostname.*not configured.*images'),
    ('next_static_dynamic', r'static to dynamic|STATIC_GEN_BAILOUT|Dynamic server usage'),
    ('next_intl_config', r'find next-intl config|No intl context|MISSING_MESSAGE|INVALID_MESSAGE'),
    ('next_server_only', r'cannot be imported from a Client Component|server-only'),
    ('flyway_failure', r'FlywayValidateException|FlywayMigrateException'),
    ('schema_validation', r'SchemaManagementException|Schema-validation'),
    ('database_connection', r'PSQLException|CannotCreateTransactionException'),
    ('invalid_json', r'Unexpected token.*JSON|JSON.*unexpected|not valid JSON'),
)
PROPERTIES = frozenset(('map', 'filter', 'length', 'name', 'url', 'retailPrice', 'salePrice',
                        'price', 'image', 'variants', 'categories', 'brand', 'slug', 'id',
                        'toLowerCase', 'startsWith', 'split', 'trim', 'prototype', 'call'))


def signatures(output):
    codes = [name for name, pattern in SIGNATURES if re.search(pattern, output, re.I)]
    # Only literal names from this fixed source-code vocabulary, never the
    # property/message extracted from a log or arbitrary runtime value.
    for name in sorted(PROPERTIES):
        if re.search(r"(?:reading|property) ['\"]" + re.escape(name) + r"['\"]", output):
            codes.append('undefined_property_' + name)
    return codes


def service_state(project, item):
    labels = item.get('Config', {}).get('Labels') or {}
    name = labels.get('com.docker.compose.service')
    if labels.get('com.docker.compose.project') != project or name not in SERVICES:
        raise ValueError('Refusing diagnostics for a foreign container')
    state = item.get('State') or {}
    status = state.get('Status')
    health = (state.get('Health') or {}).get('Status')
    return name, {'running': state.get('Running') is True,
        'oom_killed': state.get('OOMKilled') is True,
        'exit_code': state.get('ExitCode') if isinstance(state.get('ExitCode'), int) else None,
        'status': status if status in ('created', 'running', 'paused', 'restarting', 'removing', 'exited', 'dead') else 'unknown',
        'health': health if health in ('starting', 'healthy', 'unhealthy') else None}


PROBE = r"""
(async()=>{
 const result={expected_api_origin:process.env.BIGBIKE_API_BASE_URL==='http://bigbike-backend:8080'};
 if(!result.expected_api_origin){console.log(JSON.stringify(result));return;}
 const start=performance.now();
 try{
  const r=await fetch('http://bigbike-backend:8080/api/v1/products/'+encodeURIComponent(process.argv[1])+'?lang=vi',{signal:AbortSignal.timeout(5000),cache:'no-store'});
  result.http_status=r.status;result.wall_ms=performance.now()-start;
  const value=await r.json();const p=value?.data;
  result.data_object=!!p&&typeof p==='object'&&!Array.isArray(p);
  if(result.data_object){
   result.fields={};
   for(const key of ['id','name','slug','publishStatus','price','image','brand','category','categories','variants','variantOptions','description','seo','faqs','relatedProducts','commitments']){
    const v=p[key];result.fields[key]={type:v===null?'null':Array.isArray(v)?'array':typeof v};
    if(Array.isArray(v))result.fields[key].count=v.length;
   }
  }
 }catch(e){result.failure_code=['ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(e?.cause?.code)?e.cause.code:e?.name==='TimeoutError'?'timeout':'probe_failed';}
 console.log(JSON.stringify(result));
})().catch(()=>{console.log('{"failure_code":"probe_failed"}')});
"""


def collect(stack, run, fixtures=None):
    require_ci()
    project_name(stack.project)
    result = {'scope': 'owned CI runtime failure diagnostics; no app logs or response values', 'services': {}}
    ids = run(stack.compose_command('ps', '--all', '-q'), timeout=15).split()
    if not ids:
        return result
    if len(ids) > 7 or any(not re.fullmatch(r'[a-f0-9]{12,64}', value) for value in ids):
        raise ValueError('Invalid owned CI container selection')
    rows = json.loads(run(['docker', 'inspect', *ids], timeout=15))
    for item in rows:
        name, state = service_state(stack.project, item)
        result['services'][name] = state
        cid = item.get('Id')
        if cid not in ids:
            raise ValueError('Docker inspection returned an unexpected container')
        if name in ('bigbike-backend', 'bigbike-web'):
            state['error_signature_codes'] = signatures(run(['docker', 'logs', '--tail', '80', cid],
                                                           timeout=15, combine_output=True))
        if name == 'bigbike-web' and state['running'] and fixtures:
            products = fixtures.get('products') or []
            if len(products) > 6:
                slug = products[6].get('slug', '')
                if not re.fullmatch(r'e2e-perf-product-[0-9]{4}', slug):
                    raise ValueError('Internal probe requires an owned fixture')
                result['web_container_public_product_read'] = json.loads(run(
                    ['docker', 'exec', cid, 'node', '-e', PROBE, slug], timeout=15))
    return result
