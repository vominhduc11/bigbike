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
    ('async_timeout', r'AsyncRequestTimeoutException'),
    ('async_response_unusable', r'AsyncRequestNotUsableException'),
    ('executor_rejected', r'RejectedExecutionException|TaskRejectedException'),
    ('stream_closed', r'stream.*closed|closed.*stream|Broken pipe|premature EOF'),
    ('access_denied', r'AccessDeniedException'),
    ('http_message_conversion', r'HttpMessageNotWritableException|HttpMessageConversionException'),
    ('proxy_upstream_closed_early', r'upstream prematurely closed connection'),
    ('proxy_header_too_large', r'upstream sent too big header'),
    ('proxy_header_invalid', r'upstream sent invalid header|upstream sent invalid status|upstream sent duplicate header|upstream sent no valid HTTP|invalid chunked response'),
    ('proxy_invalid_header', r'upstream sent invalid header'),
    ('proxy_invalid_status', r'upstream sent invalid status'),
    ('proxy_duplicate_header', r'upstream sent duplicate header'),
    ('proxy_no_valid_http', r'upstream sent no valid HTTP'),
    ('proxy_invalid_chunked', r'invalid chunked response'),
    ('proxy_conflicting_length_headers', r'upstream sent [^\n]*Content-Length[^\n]*Transfer-Encoding[^\n]*at the same time'),
    ('proxy_dns_failure', r'could not be resolved|no resolver defined|host not found in upstream'),
    ('filesystem_io_failure', r'(?:open|mkdir|writev?|pwritev?)\(\).*failed|Permission denied|No space left on device'),
    ('proxy_no_live_upstream', r'no live upstreams'),
)
PROPERTIES = frozenset(('map', 'filter', 'length', 'name', 'url', 'retailPrice', 'salePrice',
                        'price', 'image', 'variants', 'categories', 'brand', 'slug', 'id',
                        'toLowerCase', 'startsWith', 'split', 'trim', 'prototype', 'call'))


def signatures(output):
    codes = [name for name, pattern in SIGNATURES if re.search(pattern, output, re.I)]
    # Correlate only within a single nginx log line and export fixed labels,
    # never the request path, header value, identifier or log text.
    for line in output.splitlines():
        if re.search(r'/api/v1/admin/media/[a-f0-9-]+/download(?:[?\s"]|$)', line, re.I):
            for label, pattern in (('invalid_header', r'upstream sent invalid header'),
                                   ('duplicate_header', r'upstream sent duplicate header')):
                if re.search(pattern, line, re.I):
                    codes.append('media_download_proxy_' + label)
                    for header in ('content-length', 'content-type', 'content-disposition', 'transfer-encoding'):
                        if re.search(r'upstream sent (?:invalid|duplicate) header(?: line)?:\s*["\']'
                                     + re.escape(header) + r'\s*:', line, re.I):
                            codes.append('media_download_header_' + header.replace('-', '_'))
    # Only literal names from this fixed source-code vocabulary, never the
    # property/message extracted from a log or arbitrary runtime value.
    for name in sorted(PROPERTIES):
        if re.search(r"(?:reading|property) ['\"]" + re.escape(name) + r"['\"]", output):
            codes.append('undefined_property_' + name)
    return list(dict.fromkeys(codes))


def media_failure_correlation(output):
    """Correlate first media request on an nginx connection; export fixed counts only."""
    responses = {}
    lines = output.splitlines()
    for position, line in enumerate(lines):
        match = re.fullmatch(r'BBMEDIA ([0-9]+) ([0-9]+) ([0-9]{3})\s*', line)
        if match:
            connection, ordinal, status = match.groups()
            responses.setdefault(connection, []).append((int(ordinal), int(status), position))
    media_errors = {}
    for position, line in enumerate(lines):
        match = re.search(r'\*([0-9]+)\s', line)
        if not match or not re.search(r'/api/v1/admin/media/[a-f0-9-]+/download(?:[?\s"]|$)', line, re.I):
            continue
        codes = signatures(line)
        media_errors.setdefault(match.group(1), []).append((position, {code for code in codes if code.startswith('media_download_')}))
    counts = {}
    for connection, statuses in responses.items():
        if len(statuses) != 1 or statuses[0][:2] != (1, 502):
            continue
        codes = set().union(*(codes for position, codes in media_errors.get(connection, ()) if position < statuses[0][2]))
        for code in codes:
            counts[code] = counts.get(code, 0) + 1
    return {'first_request_media_502_connections': sum(len(statuses) == 1 and statuses[0][:2] == (1, 502) for statuses in responses.values()),
            'correlated_codes': counts,
            'scope': 'same nginx connection and media route; first request only and error before access log; missing or reordered logs may omit evidence'}


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


def transport_state(value):
    if not isinstance(value, dict) or set(value) - {'13000', '14000', '18080', '19000'}:
        raise ValueError('Unexpected relay diagnostics')
    fields = ('accepted', 'active', 'capacity_rejected', 'connect_failed', 'transport_failed', 'idle_timeout')
    result = {}
    for port, counters in value.items():
        if not isinstance(counters, dict) or any(type(counters.get(key)) is not int or counters[key] < 0 for key in fields):
            raise ValueError('Invalid relay counters')
        result[port] = {key: counters[key] for key in fields}
    return result


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
  const sr=await fetch('http://bigbike-backend:8080/api/v1/sliders?location=home',{signal:AbortSignal.timeout(5000),cache:'no-store',redirect:'error'});
  const sv=await sr.json();const rows=sv?.data;
  result.public_slider_read={http_status:sr.status,data_array:Array.isArray(rows)};
  if(Array.isArray(rows)){
   const owned=rows.filter(item=>item?.productId===process.argv[2]);
   result.public_slider_read.count=rows.length;
   result.public_slider_read.owned_count=owned.length;
   result.public_slider_read.owned_desktop_url_present=owned.some(item=>typeof item?.desktopImage?.url==='string'&&item.desktopImage.url.length>0);
   result.public_slider_read.owned_product_link_present=owned.some(item=>typeof item?.productLink==='string'&&item.productLink.length>0);
  }
 }catch(e){result.failure_code=['ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(e?.cause?.code)?e.cause.code:e?.name==='TimeoutError'?'timeout':'probe_failed';}
 console.log(JSON.stringify(result));
})().catch(()=>{console.log('{"failure_code":"probe_failed"}')});
"""


def collect(stack, run, fixtures=None):
    require_ci()
    project_name(stack.project)
    result = {'scope': 'owned CI runtime failure diagnostics; no app logs or response values', 'services': {}}
    try:
        result['transport_before_cleanup'] = transport_state(stack.relays.stats())
    except Exception:
        result['transport_before_cleanup_unavailable'] = True
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
        if name in ('bigbike-backend', 'bigbike-web', 'api-proxy', 'minio'):
            logs = run(['docker', 'logs', '--since', '5m', '--tail', '400', cid], timeout=15, combine_output=True)
            state['error_signature_codes'] = signatures(logs)
            if name == 'api-proxy':
                state['media_502_correlation'] = media_failure_correlation(logs)
        if name == 'bigbike-web' and state['running'] and fixtures:
            products = fixtures.get('products') or []
            if len(products) > 6:
                slug = products[6].get('slug', '')
                if not re.fullmatch(r'e2e-perf-product-[0-9]{4}', slug):
                    raise ValueError('Internal probe requires an owned fixture')
                product_id = products[0].get('id', '')
                if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', product_id):
                    raise ValueError('Slider probe requires an owned product identifier')
                result['web_container_public_product_read'] = json.loads(run(
                    ['docker', 'exec', cid, 'node', '-e', PROBE, slug, product_id], timeout=15))
    return result
