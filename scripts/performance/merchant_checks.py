"""Real post-measurement Merchant/variant checks in the job-owned hosted CI stack.

Contract: BUSINESS_RULES GMC_RULE_002..008, PRODUCT_RULE_012/013,
STOCK_RULE_005; API_CONTRACT Google Merchant feed + attribute operations sections.
No application mocks, Google account calls, shop writes or invented store code.
"""
import csv
import datetime
import io
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time
import unicodedata
from urllib.parse import parse_qs, quote, urlsplit
import xml.etree.ElementTree as ET

from ci_guard import loopback_url, require_ci, safe_directory
from stack_checks import Api


WEB_ORIGIN = 'http://localhost:13000'
API_ORIGIN = 'http://localhost:18080'
G = '{http://base.google.com/ns/1.0}'


def _guard(root, api, private_dir, environment, measurements_complete):
    require_ci(environment)
    require_ci()
    if measurements_complete is not True:
        raise ValueError('Merchant fixtures are eligible only after all measurements')
    if not isinstance(api, Api) or loopback_url(api.origin) != API_ORIGIN:
        raise ValueError('Dedicated CI API origin required')
    boundary = environment.get('RUNNER_TEMP')
    if not boundary:
        raise ValueError('Job temporary directory required')
    return safe_directory(root, boundary), safe_directory(private_dir, boundary)


def _identity(environment):
    run, attempt = environment.get('GITHUB_RUN_ID', ''), environment.get('GITHUB_RUN_ATTEMPT', '')
    if not re.fullmatch(r'[0-9]{1,20}', run) or not re.fullmatch(r'[0-9]{1,6}', attempt):
        raise ValueError('Numeric hosted job identity required')
    suffix = run + '-' + attempt
    return {'name': 'E2E_PRODUCT_MERCHANT_' + suffix,
            'slug': 'e2e-product-merchant-' + suffix,
            'sku': 'E2E-MER-' + suffix}


def _attribute(api, identity):
    # An existing size dictionary may have only M in the synthetic migration seed.
    # Use a separately owned generic variation axis, never mutate real size/color data.
    suffix = identity['sku'][len('E2E-MER-'):]
    name = 'E2E_ATTRIBUTE_MERCHANT_' + suffix
    time.sleep(1.15)
    attribute = api.data('POST', '/api/v1/admin/attributes', {'name': name, 'nameEn': name}, expected=(200, 201))
    if (attribute.get('name') != name or not attribute.get('id') or not attribute.get('code')
            or len(attribute['code']) > 100):
        raise ValueError('New Merchant attribute ownership could not be proven')
    options = []
    for slot in ('A', 'B'):
        label = 'E2E_ATTRIBUTE_VALUE_' + suffix + '_' + slot
        time.sleep(1.15)
        value = api.data('POST', '/api/v1/admin/attributes/' + quote(str(attribute['id']), safe='') + '/values',
                         {'label': label, 'labelEn': label}, expected=(200, 201))
        if value.get('label') != label or value.get('attributeId') != attribute['id'] or not value.get('id'):
            raise ValueError('New Merchant attribute value ownership could not be proven')
        options.append({'optionName': attribute['code'], 'optionValue': label, 'attributeValueId': value['id']})
    return options


def _owned_product(product, identity):
    if (not isinstance(product, dict) or not product.get('id')
            or any(product.get(key) != identity[key] for key in ('name', 'slug', 'sku'))):
        raise ValueError('New Merchant product ownership could not be proven')


def _fixture_image(fixtures):
    image = fixtures.get('products', [{}])[0].get('image') or {}
    url = image.get('url')
    if not isinstance(url, str) or not url.startswith('/media/uploads/'):
        raise ValueError('Existing synthetic MinIO product image required')
    return {key: image[key] for key in ('url', 'alt', 'width', 'height', 'mimeType') if key in image}


def _create(api, fixtures, identity):
    image = _fixture_image(fixtures)
    options = _attribute(api, identity)
    expected = {identity['sku'] + '-IN': (200000, 180000, True),
                identity['sku'] + '-OUT': (250000, 210000, False)}
    payload = {**identity, 'brandId': fixtures['brand']['id'], 'categoryIds': [fixtures['category']['id']],
               'retailPrice': 200000, 'salePrice': 180000,
               'image': image, 'publishStatus': 'DRAFT',
               'description': '<p>Sản phẩm riêng để kiểm nguồn Merchant trong CI tách biệt.</p>',
               'translations': {'en': {'name': identity['name']}},
               'variants': [
                   {'sku': identity['sku'] + '-IN', 'isAvailable': True,
                    'options': [options[0]]},
                   {'sku': identity['sku'] + '-OUT', 'retailPrice': 250000, 'salePrice': 210000,
                    'isAvailable': False, 'options': [options[1]]}]}
    time.sleep(1.15)  # Preserve the real 60/min admin mutation budget.
    created = api.data('POST', '/api/v1/admin/products', payload, expected=(200, 201))
    _owned_product(created, identity)
    if created['id'] in {row.get('id') for row in fixtures.get('products', [])}:
        raise ValueError('Refusing a measured-product identity')
    path = '/api/v1/admin/products/' + quote(str(created['id']), safe='')
    _owned_product(api.data('GET', path), identity)
    time.sleep(1.15)
    published = api.data('PATCH', path + '/publish', {'publishStatus': 'PUBLISHED'})
    _owned_product(published, identity)
    product = Api(API_ORIGIN).data('GET', '/api/v1/products/' + quote(identity['slug'], safe='') + '?lang=vi')
    _owned_product(product, identity)
    if product.get('publishStatus') != 'PUBLISHED' or len(product.get('variants') or []) != 2:
        raise ValueError('Published Merchant variant fixture incomplete')
    for variant in product['variants']:
        if variant.get('sku') not in expected or not variant.get('id') or not variant.get('options'):
            raise ValueError('Returned variant identity/options differ from fixture')
        retail, sale, available = expected[variant['sku']]
        price = variant.get('price') or {}
        if (price.get('retailPrice'), price.get('salePrice'), price.get('currency'), variant.get('isAvailable')) != (retail, sale, 'VND', available):
            raise ValueError('Own/inherited variant price or availability differs from contract')
    return product


def _headers(headers):
    return {key.lower(): value for key, value in headers.items()}


def _cart_variants(product):
    """Verify explicit choices only; no rule about omitting a variant is inferred."""
    available = next(row for row in product['variants'] if row['isAvailable'])
    unavailable = next(row for row in product['variants'] if not row['isAvailable'])
    customer = Api(API_ORIGIN)
    customer.call('GET', '/api/v1/cart')
    cart = customer.data('POST', '/api/v1/cart/items',
        {'productId': product['id'], 'productVariantId': available['id'], 'quantity': 2})
    if len(cart['items']) != 1:
        raise ValueError('Selected variant cart must contain one line')
    line = cart['items'][0]
    price = available['price']['salePrice']
    if (line['productId'], line['productVariantId'], line['sku'], line['quantity'], line['unitPrice'], line['available']) != (
            product['id'], available['id'], available['sku'], 2, price, True):
        raise ValueError('Cart lost selected variant identity, quantity or inherited price')
    if line['lineTotal'] != price * 2 or cart['totals']['totalAmount'] != price * 2:
        raise ValueError('Selected variant cart total differs from authoritative price')
    customer.call('POST', '/api/v1/cart/items',
        {'productId': product['id'], 'productVariantId': unavailable['id'], 'quantity': 1}, expected=(409,))
    if customer.data('GET', '/api/v1/cart') != cart:
        raise ValueError('Rejected unavailable variant changed the guest cart')
    return {'explicit_variant_opaque_ids_and_price': True, 'unavailable_variant_denied_409': True,
            'rejected_add_cart_unchanged': True, 'missing_variant_policy_verified': False}


def _money(value):
    if not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]* VND', value):
        raise ValueError('Invalid VND amount in Merchant source')
    return int(value[:-4])


def _feed(body, headers):
    headers = _headers(headers)
    if ('application/xml' not in headers.get('content-type', '')
            or 'no-store' not in headers.get('cache-control', '')
            or 'noindex' not in headers.get('x-robots-tag', '')):
        raise ValueError('Merchant feed headers differ from contract')
    if len(body) > 10 * 1024 * 1024 or b'<!DOCTYPE' in body.upper() or b'<!ENTITY' in body.upper():
        raise ValueError('Unexpected Merchant XML size/declaration')
    root = ET.fromstring(body)
    if root.tag != 'rss' or root.get('version') != '2.0':
        raise ValueError('Expected documented RSS 2.0 feed')
    offers, ids = [], set()
    for item in root.findall('./channel/item'):
        value = lambda name: item.findtext(G + name, default='')
        sku = value('id')
        normalized = unicodedata.normalize('NFC', sku).lower()
        if not sku or len(sku) > 50 or normalized in ids:
            raise ValueError('Missing, duplicate or oversized Merchant SKU')
        ids.add(normalized)
        _money(value('price'))
        if value('sale_price') and _money(value('sale_price')) >= _money(value('price')):
            raise ValueError('Invalid Merchant sale price')
        if value('availability') not in ('in_stock', 'out_of_stock'):
            raise ValueError('Invalid Merchant availability')
        for name in ('link', 'image_link'):
            target = urlsplit(value(name))
            if target.scheme not in ('http', 'https') or not target.netloc or target.username or target.password:
                raise ValueError('Invalid Merchant URL')
        offers.append({'id': sku, 'link': value('link'), 'price': value('price'),
                       'salePrice': value('sale_price'), 'availability': value('availability'),
                       'image': value('image_link'), 'group': value('item_group_id'),
                       'options': [{'name': option.findtext(G + 'name', default=''),
                                    'value': option.findtext(G + 'value', default='')}
                                   for option in item.findall(G + 'variant_option')]})
        if any(not option['name'] or not option['value'] for option in offers[-1]['options']):
            raise ValueError('Merchant variant option missing its name/value')
    if len(offers) != int(headers.get('x-merchant-item-count', '-1')):
        raise ValueError('Merchant body/header item counts differ')
    products = len({offer['group'] for offer in offers if offer['group']}) + sum(not offer['group'] for offer in offers)
    if not offers or int(headers.get('x-merchant-product-count', '-1')) != products:
        raise ValueError('Merchant product count differs from groups/simple items')
    generated = datetime.datetime.fromisoformat(headers.get('x-merchant-generated-at', '').replace('Z', '+00:00'))
    if generated.utcoffset() != datetime.timedelta(0):
        raise ValueError('Merchant generation time must be explicit UTC')
    return offers


def _selected_offers(offers, product):
    variants = {row['sku']: row for row in product['variants']}
    selected = [offer for offer in offers if offer['id'] in variants]
    if len(selected) != 2 or any(offer['id'] == product['sku'] for offer in offers):
        raise ValueError('Variant fixture must have exactly two SKU rows and no parent row')
    for offer in selected:
        variant = variants[offer['id']]
        link = urlsplit(offer['link'])
        if (link.scheme != 'http' or link.netloc != 'localhost:13000'
                or link.path != '/product/' + product['slug'] + '/' or link.fragment
                or parse_qs(link.query, keep_blank_values=True) != {'variant': [variant['id']]}):
            raise ValueError('Merchant link does not select the real owned variant')
        image = urlsplit(offer['image'])
        expected_key = product['image']['url'][len('/media/'):]
        if (image.scheme != 'http' or image.netloc not in ('localhost:13000', 'localhost:19000')
                or image.path not in ('/media/' + expected_key, '/bigbike-media/' + expected_key)
                or image.query or image.fragment):
            raise ValueError('Merchant image does not reference the shared owned MinIO object')
        price = variant['price']
        if (offer['group'] != product['id'] or _money(offer['price']) != price['retailPrice']
                or _money(offer['salePrice']) != price['salePrice']
                or offer['availability'] != ('in_stock' if variant['isAvailable'] else 'out_of_stock')
                or offer['options'] != [{'name': row['name'], 'value': row['value']} for row in variant['options']]):
            raise ValueError('Merchant variant price/group/stock/options differ from API truth')
    return selected


def _store_code(value):
    if (not isinstance(value, str) or not value or value != value.strip() or len(value) > 64
            or any(unicodedata.category(char) in ('Cc', 'Cs', 'Zl', 'Zp') for char in value)):
        raise ValueError('Actual configured Local Inventory store code required')
    return value


def _local_inventory(body, headers, offers, code):
    _store_code(code)
    headers = _headers(headers)
    if ('text/tab-separated-values' not in headers.get('content-type', '')
            or 'no-store' not in headers.get('cache-control', '')):
        raise ValueError('Local Inventory headers differ from contract')
    reader = csv.DictReader(io.StringIO(body.decode('utf-8')), delimiter='\t')
    if reader.fieldnames != ['store_code', 'id', 'availability', 'price']:
        raise ValueError('Local Inventory columns differ from contract')
    rows = list(reader)
    if len(rows) != len(offers) or len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Local Inventory rows differ from XML')
    expected = {offer['id']: offer for offer in offers}
    for row in rows:
        offer = expected.get(row['id'])
        if (not offer or row['store_code'] != code or row['availability'] != offer['availability']
                or row['price'] != (offer['salePrice'] or offer['price'])):
            raise ValueError('Local Inventory SKU/price/stock/store differs from XML/configuration')


_BROWSER = r'''
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') throw Error('Hosted CI only');
  const [root, input, output] = process.argv.slice(2);
  const load = createRequire(path.join(root, 'bigbike-web/package.json'));
  const {chromium, expect: baseExpect} = load('@playwright/test');
  const expect = baseExpect.configure({timeout: 15000});
  const unregister = load('tsx/cjs/api').register();
  const {VIEWPORTS} = load(path.join(root, 'bigbike-web/e2e/helpers/viewports.ts'));
  const {installPageGuards, summarizeGuards, expectNoHorizontalOverflow} = load(path.join(root, 'bigbike-web/e2e/helpers/ui-quality.ts'));
  const {createRejectProxy, METHOD} = require(path.join(root, 'scripts/performance/browser-egress.cjs'));
  const {offers} = JSON.parse(fs.readFileSync(input, 'utf8'));
  const rows = [];
  const progress = {stage: 'launch', complete: false};
  const egress = await createRejectProxy();
  let browser;
  try {
    browser = await chromium.launch({headless: true, args: [...egress.launchArgs]});
    for (const viewport of VIEWPORTS.filter(row => ['mobile-375x812', 'tablet-768x1024', 'desktop-1440x900'].includes(row.name))) {
      const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, locale: 'vi-VN'});
      for (const offer of offers) {
        progress.stage = 'landing'; progress.viewport = viewport.name;
        const page = await context.newPage();
        const guards = installPageGuards(page);
        let localApiFailures = 0;
        page.on('response', response => {
          const url = new URL(response.url());
          if (['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/api/') && response.status() >= 400) localApiFailures++;
        });
        page.on('requestfailed', request => {
          const url = new URL(request.url());
          if (['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/api/') && !request.failure()?.errorText.includes('ERR_ABORTED')) localApiFailures++;
        });
        const link = new URL(offer.link);
        const response = await page.goto(offer.link, {waitUntil: 'domcontentloaded', timeout: 60000});
        expect(response?.status()).toBe(200);
        expect(response.request().redirectedFrom()).toBeNull();
        const html = await response.text();
        const structured = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(match => JSON.parse(match[1]));
        const product = structured.find(row => row['@type'] === 'Product' && row.sku === offer.id);
        expect(product).toBeDefined();
        expect(product.inProductGroupWithID).toBe(offer.group);
        expect(String(product.offers.price)).toBe((offer.salePrice || offer.price).split(' ')[0]);
        expect(product.offers.priceCurrency).toBe('VND');
        expect(product.offers.availability).toBe('https://schema.org/' + (offer.availability === 'in_stock' ? 'InStock' : 'OutOfStock'));
        expect(product.offers.url).toBe(offer.link);
        expect(product.image).toContain(offer.image);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', link.origin + link.pathname);
        const info = page.locator('[data-purchase-info]');
        async function selected(expected) {
          for (const option of expected.options) await expect(info.getByRole('radio', {name: option.value, exact: true})).toHaveAttribute('aria-checked', 'true');
          const price = Number((expected.salePrice || expected.price).split(' ')[0]).toLocaleString('vi-VN');
          await expect(info.getByText(`${price} ₫`, {exact: true})).toBeVisible();
          await expect(info.locator(expected.availability === 'in_stock' ? '.stock.in-stock' : '.stock.out-of-stock')).toBeVisible();
          await expect(page.locator('[data-purchase-add]').first()).toBeEnabled({enabled: expected.availability === 'in_stock'});
        }
        await selected(offer);
        progress.stage = 'change-variant';
        const other = offers.find(row => row.id !== offer.id);
        for (const option of other.options) await info.getByRole('radio', {name: option.value, exact: true}).click();
        await selected(other);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', link.origin + link.pathname);
        await expectNoHorizontalOverflow(page, 'CI Merchant variant');
        const image = page.locator('[data-product-gallery-main] img').first();
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
        const summary = summarizeGuards(guards);
        expect(summary.serious).toEqual([]);
        expect(localApiFailures).toBe(0);
        rows.push({viewport: viewport.name, initial_stock: offer.availability, initial_html_and_schema: true,
          canonical: true, selected_variant_price_stock: true, manual_variant_change: true, image_loaded: true, overflow: false, serious_errors: 0, local_api_failures: 0});
        await page.close();
      }
      await context.close();
    }
    progress.stage = 'complete'; progress.complete = true;
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await egress.close();
      unregister();
      fs.writeFileSync(output, JSON.stringify({rows, progress, browser_egress: {...METHOD, rejections: egress.snapshot()}}), {mode: 0o600});
    }
  }
}
main().catch(() => {console.error('Merchant browser check failed; raw details remain private'); process.exitCode = 1;});
'''


def _write_private(path, value):
    with _private_stream(path) as output:
        output.write(value)


def _private_stream(path):
    return os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w')


def _browser(root, directory, environment, offers):
    script, payload, output = directory / 'merchant.cjs', directory / 'input.json', directory / 'browser-private.json'
    _write_private(script, _BROWSER)
    _write_private(payload, json.dumps({'offers': offers}))
    allowed = ('PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'RUNNER_TEMP', 'PLAYWRIGHT_BROWSERS_PATH',
               'GITHUB_ACTIONS', 'RUNNER_ENVIRONMENT')
    env = {key: environment[key] for key in allowed if key in environment}
    env.update(CI='true', E2E_BASE_URL=WEB_ORIGIN)
    with _private_stream(directory / 'stdout-private.log') as stdout, _private_stream(directory / 'stderr-private.log') as stderr:
        process = subprocess.Popen(['node', str(script), str(root), str(payload), str(output)],
                                   cwd=root / 'bigbike-web', env=env, stdout=stdout, stderr=stderr, start_new_session=True)
        try:
            code = process.wait(timeout=360)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=5)
            raise RuntimeError('Merchant browser timeout') from None
    if code:
        raise RuntimeError('Merchant browser validation failed')
    result = json.loads(output.read_text())
    if result.get('progress', {}).get('complete') is not True or len(result.get('rows', [])) != 6:
        raise ValueError('Merchant browser cases incomplete')
    counters = (result.get('browser_egress') or {}).get('rejections') or {}
    keys = ('http_rejected', 'connect_rejected', 'upgrade_rejected', 'malformed_rejected')
    if any(not isinstance(counters.get(key), int) or counters[key] < 0 for key in keys):
        raise ValueError('Merchant browser egress evidence absent')
    return {'passed': 6, 'viewports': ['mobile-375x812', 'tablet-768x1024', 'desktop-1440x900'],
            'initial_html_schema_canonical_price_stock': True, 'manual_variant_change': True,
            'product_image_loaded': True, 'runtime_errors': 0,
            'browser_egress_rejections': {key: counters[key] for key in keys}}


def run_merchant_checks(root, api, fixtures, private_dir, environment, *,
                        measurements_complete=False, configured_store_code=None, record_callback=None):
    """Run after API/media/browser measurements; never alter their 40/10k datasets.

    A missing store-code argument asserts the current CI configuration is absent
    and must yield 503. Positive Local Inventory needs the actual configured code;
    this function never configures or invents one. Only whole-project teardown
    removes this separately owned product after evidence is retained by the caller.
    """
    root, private_dir = _guard(root, api, private_dir, environment, measurements_complete)
    identity = _identity(environment)
    if configured_store_code is not None:
        _store_code(configured_store_code)
    directory = private_dir / 'merchant-checks'
    directory.mkdir(mode=0o700, exist_ok=False)
    summary = {'complete': False, 'phase': 'fixture', 'fixture_scope': 'one separately owned generic-attribute two-variant product after measurements',
               'measured_products_modified': False, 'google_account_or_approval_verified': False,
               'size_color_or_multi_axis_variants_verified': False, 'fixture_cleanup': 'job-owned stack teardown',
               'local_inventory_positive': 'not run: actual configured store code not supplied'}
    def record():
        if record_callback:
            record_callback(summary)
    record()
    try:
        product = _create(api, fixtures, identity)
        summary['phase'] = 'variant-cart'
        record()
        summary['variant_cart'] = _cart_variants(product)
        summary['phase'] = 'xml'
        record()
        public = Api(WEB_ORIGIN)
        body, headers, _ = public.call('GET', '/google-merchant.xml', raw=True)
        offers = _feed(body, headers)
        selected = _selected_offers(offers, product)
        head, head_headers, _ = public.call('HEAD', '/google-merchant.xml', raw=True)
        head_headers = _headers(head_headers)
        if (head or 'application/xml' not in head_headers.get('content-type', '')
                or 'no-store' not in head_headers.get('cache-control', '')
                or int(head_headers.get('x-merchant-item-count', '-1')) != len(offers)):
            raise ValueError('Merchant HEAD body/headers differ from GET')
        summary['xml'] = {'passed': True, 'complete_feed_items': len(offers), 'owned_variant_items': 2,
                          'parent_item_omitted': True, 'sku_price_stock_group_image_options': True,
                          'no_store_header_verified': True, 'head_contract': True}
        summary['phase'] = 'local-inventory'
        record()
        if configured_store_code is None:
            _, headers, _ = public.call('GET', '/google-local-inventory.tsv', expected=(503,), raw=True)
            headers = _headers(headers)
            if 'no-store' not in headers.get('cache-control', '') or headers.get('retry-after') != '300':
                raise ValueError('Missing store-code rejection headers differ from contract')
            head, head_headers, _ = public.call('HEAD', '/google-local-inventory.tsv', expected=(503,), raw=True)
            head_headers = _headers(head_headers)
            if head or 'no-store' not in head_headers.get('cache-control', '') or head_headers.get('retry-after') != '300':
                raise ValueError('Missing store-code HEAD differs from contract')
            summary['local_inventory_missing_code_rejected'] = True
        else:
            body, headers, _ = public.call('GET', '/google-local-inventory.tsv', raw=True)
            _local_inventory(body, headers, offers, configured_store_code)
            summary['local_inventory_positive'] = 'passed against actual configured code; no external GMC call'
        summary['phase'] = 'landing-browser'
        record()
        summary['landing_browser'] = _browser(root, directory, environment, selected)
        summary.update(complete=True, phase='complete')
        record()
        return summary
    except Exception:
        summary['failure_code'] = 'MERCHANT_VALIDATION_FAILED'
        record()
        raise RuntimeError('Post-measurement Merchant checks failed; sanitized phase retained') from None
