/* Lab observations on real production builds. Raw page content/cookies never leave memory. */
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { installCollector } = require('./lab-inp.cjs');
const { createRejectProxy, counterDelta, observeHttpCache, METHOD } = require('./browser-egress.cjs');

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
    throw Error('Browser workload requires the isolated GitHub-hosted stack');
  }
  const [root, fixtureFile, output, sessionFile] = process.argv.slice(2);
  const { chromium } = createRequire(path.resolve(root, 'bigbike-web/package.json'))('@playwright/test');
  const fixture = JSON.parse(fs.readFileSync(fixtureFile));
  const session = JSON.parse(fs.readFileSync(sessionFile));
  const collectorDirectory = path.join(process.env.RUNNER_TEMP, 'perf-tools/node_modules/web-vitals');
  const egress = await createRejectProxy();
  let browser;
  const results = [];
  const progress = { surface: 'launch', step: 'starting' };
  let inpCollectorIdentity = null;
  const product = fixture.products[0];
  try {
    browser = await chromium.launch({ headless: true, args: [...egress.launchArgs] });
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const egressAtViewportStart = egress.snapshot();
      const context = await browser.newContext({ viewport, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
      const inp = await installCollector(context, collectorDirectory);
      inpCollectorIdentity = inp.identity;
      await context.addInitScript(() => {
        const supported = PerformanceObserver.supportedEntryTypes;
        window.__perf = { lcp: null, cls: null, interactions: [], supported };
        if (supported.includes('largest-contentful-paint')) {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        }
        if (supported.includes('layout-shift')) {
          window.__perf.cls = 0;
          // CLS uses session windows (max 5s, <=1s between shifts), excluding recent input.
          let start = 0, last = 0, sum = 0;
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              if (last === 0 || entry.startTime - last > 1000 || entry.startTime - start > 5000) {
                start = entry.startTime; sum = 0;
              }
              sum += entry.value; last = entry.startTime;
              window.__perf.cls = Math.max(window.__perf.cls, sum);
            }
          }).observe({ type: 'layout-shift', buffered: true });
        }
        if (supported.includes('event')) {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) if (entry.interactionId) {
              window.__perf.interactions.push({ interactionId: entry.interactionId, duration: entry.duration });
            }
          }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
        }
      });
      const page = await context.newPage();
      const httpCache = await observeHttpCache(context, page);
      let pageErrors = 0, apiErrors = 0, resourceErrors = 0, rateLimited = 0;
      let localNetworkErrors = 0, canceledRequests = 0, consoleErrors = 0, externalConsoleErrors = 0;
      page.on('pageerror', () => pageErrors += 1);
      page.on('requestfailed', request => {
        const url = new URL(request.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) return;
        if (request.failure()?.errorText.includes('ERR_ABORTED')) {
          canceledRequests += 1;
          return;
        }
        if (url.pathname.startsWith('/api/') || ['image', 'script', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
          localNetworkErrors += 1;
        }
      });
      page.on('console', message => {
        if (message.type() !== 'error') return;
        try {
          if (!['localhost', '127.0.0.1'].includes(new URL(message.location().url).hostname)) {
            externalConsoleErrors += 1;
            return;
          }
        } catch (_) { /* Console errors without a location still count. */ }
        consoleErrors += 1;
      });
      page.on('response', response => {
        const url = new URL(response.url());
        const local = ['localhost', '127.0.0.1'].includes(url.hostname);
        if (response.status() === 429) rateLimited += 1;
        if (local && url.pathname.startsWith('/api/') && response.status() >= 400) apiErrors += 1;
        if (local && response.status() >= 400
            && ['image', 'script', 'stylesheet', 'font', 'media'].includes(response.request().resourceType())) resourceErrors += 1;
      });
      const surfaces = [
        ['home', '/'], ['category', '/danh-muc/' + fixture.category.slug + '/'],
        ['product', '/product/' + product.slug + '/'], ['search', '/tim-kiem/?s=E2E_PERF'],
        ['cart', '/gio-hang/'], ['content', '/lien-he/'], ['account-login', '/dang-nhap/'],
      ];
      for (const [name, route] of surfaces) {
        for (const cacheState of ['browser_http_cache_cleared', 'browser_http_cache_enabled_repeat']) {
          progress.surface = name;
          progress.step = cacheState;
          progress.viewport = viewport;
          if (cacheState === 'browser_http_cache_cleared') {
            // The blank navigation finishes before clearing HTTP cache. Keep cookies
            // and normal app state; this makes no claim about server/DB cache warmth.
            await page.goto('about:blank', { waitUntil: 'load' });
            await httpCache.clearHttpCache();
          }
          const cacheBefore = httpCache.snapshot();
          const egressBefore = egress.snapshot();
          const response = await page.goto('http://localhost:13000' + route, { waitUntil: 'load', timeout: 60000 });
          if (!response || response.status() !== 200) throw Error('Required browser surface failed: ' + name);
          await page.waitForTimeout(2000);
          if (name === 'home') {
            const hero = page.locator('[data-analytics-location="homepage_hero"] img').first();
            await hero.waitFor({ state: 'visible' });
            if (!await hero.evaluate(image => image.complete && image.naturalWidth > 0)) {
              throw Error('Representative home hero image failed');
            }
          }
          if (name === 'product') {
            const image = page.locator('[data-product-gallery-main] img').first();
            await image.waitFor({ state: 'visible' });
            if (!await image.evaluate(img => img.complete && img.naturalWidth > 0)) throw Error('Product image failed');
          }
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            const counts = new Map();
            for (const entry of resources) {
              const url = new URL(entry.name);
              const key = url.origin + url.pathname;
              counts.set(key, (counts.get(key) || 0) + 1);
            }
            return { ttfb_ms: nav.responseStart - nav.startTime,
              fcp_ms: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
              lcp_ms: window.__perf.lcp, cls: window.__perf.cls,
              js_transfer_bytes: resources.filter(e => new URL(e.name).pathname.endsWith('.js')).reduce((n,e) => n+e.transferSize,0),
              css_transfer_bytes: resources.filter(e => new URL(e.name).pathname.endsWith('.css')).reduce((n,e) => n+e.transferSize,0),
              duplicate_path_counts: [...counts].filter(([,n]) => n>1).map(([,n]) => n),
              resource_count: resources.length,
              canonical_present: !!document.querySelector('link[rel=canonical]'),
              h1_count: document.querySelectorAll('h1').length,
              json_ld_blocks: document.querySelectorAll('script[type="application/ld+json"]').length };
          });
          results.push({ surface: name, viewport, cache_state: cacheState, metrics,
            http_cache_observed: counterDelta(httpCache.snapshot(), cacheBefore),
            egress_rejections: counterDelta(egress.snapshot(), egressBefore),
            inp: await inp.record(page) });
        }
      }
      await page.goto('http://localhost:13000/tim-kiem/?s=E2E_PERF', { waitUntil: 'load' });
      progress.surface = 'search-interaction';
      progress.step = 'submit';
      const searchInp = await inp.record(page);
      const search = page.locator('[data-search-page-form] input');
      // Use the real API's current page, preserving search ranking/alias rules.
      // This reference read intentionally warms API cache in both measured arms.
      const referenceResponse = await context.request.get('http://localhost:18080/api/v1/products?'
        + new URLSearchParams({ q: 'Áo', page: '1', size: '24', sort: 'relevance', lang: 'vi' }));
      if (!referenceResponse.ok()) throw Error('Search reference API failed');
      const referenceSearch = await referenceResponse.json();
      const ownedProducts = new Map(fixture.products.map(item => [item.id, item.slug]));
      if (!Array.isArray(referenceSearch.data) || !referenceSearch.data.length
          || referenceSearch.data.some(item => ownedProducts.get(item.id) !== item.slug)) {
        throw Error('Expected owned search reference page missing');
      }
      const expectedSearchPaths = referenceSearch.data.map(item => '/product/' + item.slug + '/').sort();
      await search.fill('Áo');
      await page.locator('[data-search-page-form] button[type=submit]').click();
      await page.waitForURL(url => url.searchParams.get('s') === 'Áo');
      await page.waitForFunction(expected => {
        if (!document.querySelector('h1')?.textContent.includes('Áo')) return false;
        const grid = document.querySelector('#main-content [data-catalog-product-grid]');
        if (!grid || grid.getAttribute('aria-busy') === 'true') return false;
        const actual = [...grid.querySelectorAll('[data-product-card] h3 a')]
          .map(link => new URL(link.href).pathname).sort();
        return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
      }, expectedSearchPaths, { timeout: 60000 });
      await inp.record(page, true);
      results.push({ surface: 'search-interaction', viewport, url_state_updated: true,
        rendered_fixture_results_verified: true, current_page_result_count: expectedSearchPaths.length,
        api_reference_read_cache_prewarmed: true, inp: searchInp });
      // A real add-to-cart interaction. Seeded simple product deliberately has no variant.
      progress.surface = 'cart-to-checkout';
      progress.step = 'add-and-order';
      await page.goto('http://localhost:13000/product/' + product.slug + '/', { waitUntil: 'load' });
      const productInp = await inp.record(page);
      const add = page.locator('[data-purchase-add]').first();
      await add.waitFor({ state: 'visible' });
      if (!await add.isEnabled()) throw Error('Seeded available product cannot be added');
      const addResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/cart/items' && r.request().method() === 'POST');
      await add.click();
      if (!(await addResponse).ok()) throw Error('Real cart mutation failed');
      await page.waitForTimeout(400);
      const interactions = await page.evaluate(() => window.__perf.interactions);
      await inp.record(page, true);
      await page.goto('http://localhost:13000/dat-hang/', { waitUntil: 'load' });
      const checkoutInp = await inp.record(page);
      const form = page.locator('[data-checkout-form]');
      await form.waitFor({ state: 'visible' });
      await form.locator('#billing_full_name').fill('E2E_PERF_Khách trình duyệt');
      await form.locator('#billing_phone').fill('0900000000');
      await form.locator('#billing_email').fill('perf-browser@example.invalid');
      await form.locator('#billing_address_1').fill('E2E_PERF_Địa chỉ thử riêng');
      await form.getByRole('combobox').first().click();
      await page.getByRole('option').first().click();
      await form.getByRole('combobox').nth(1).click();
      await page.getByRole('option').first().click();
      await form.getByRole('checkbox').last().check();
      await inp.record(page, true); // Snapshot completed form interactions before navigation.
      const checkout = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/checkout' && r.request().method() === 'POST');
      await form.locator('button[type=submit]').click();
      if (!(await checkout).ok()) throw Error('Browser checkout failed');
      await page.waitForURL(url => url.pathname === '/don-hang/xac-nhan/');
      await page.waitForTimeout(300); // Allow the actual page-hidden callback to cross the binding.
      results.push({ surface: 'cart-to-checkout', viewport, real_add_to_cart: true,
        checkout_form_present: true, order_confirmation_reached: true, interaction_event_durations: interactions,
        inp: { product_document: productInp, checkout_document: checkoutInp },
        inp_field_ms: null, note: 'Official web-vitals interim scripted lab INP; hidden finalization only when observed, full navigation may omit final click; field INP and variant interaction unmeasured' });

      // Use the real refresh cookie from the standard login already performed by API setup.
      await context.addCookies([{ name: 'bb_admin_refresh', value: session.refreshCookie,
        domain: 'localhost', path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }]);
      for (const [route, endpoint] of [
        ['/admin/products', '/api/v1/admin/products'], ['/admin/media', '/api/v1/admin/media'],
        ['/admin/orders', '/api/v1/admin/orders'], ['/admin/customers', '/api/v1/admin/customers']]) {
        progress.surface = route;
        progress.step = 'authenticated-navigation';
        const loaded = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.request().method() === 'GET');
        const response = await page.goto('http://localhost:14000' + route, { waitUntil: 'load' });
        if (!(await loaded).ok()) throw Error('Authenticated admin data failed');
        await page.locator('.bb-page-content .bb-screen-header').first().waitFor({ state: 'visible' });
        await page.waitForTimeout(1800);
        if (new URL(page.url()).pathname !== route || !response || response.status() !== 200) {
          throw Error('Authenticated admin browser surface failed');
        }
        const metrics = await page.evaluate(() => ({
          ttfb_ms: performance.getEntriesByType('navigation')[0].responseStart,
          fcp_ms: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          lcp_ms: window.__perf.lcp, cls: window.__perf.cls,
          screen_content_visible: !!document.querySelector('.bb-page-content .screen'),
        }));
        if (!metrics.screen_content_visible) throw Error('Authenticated admin screen missing');
        results.push({ surface: 'admin' + route, viewport, metrics, inp: await inp.record(page) });
      }
      const egressCounts = counterDelta(egress.snapshot(), egressAtViewportStart);
      const blockedExternal = Object.values(egressCounts).reduce((total, count) => total + count, 0);
      const cacheCounts = httpCache.snapshot();
      results.push({ viewport, page_errors: pageErrors, api_errors: apiErrors, resource_errors: resourceErrors,
        local_network_errors: localNetworkErrors, canceled_requests: canceledRequests, console_errors: consoleErrors,
        external_console_errors: externalConsoleErrors, rate_limited_requests: rateLimited,
        blocked_external_requests: blockedExternal, egress_rejections: egressCounts, http_cache_observed: cacheCounts });
      if (pageErrors || apiErrors || resourceErrors || rateLimited || localNetworkErrors || consoleErrors
          || cacheCounts.private_http_cache_hits) throw Error('Browser runtime/API/resource/private-cache errors occurred');
      const rotated = (await context.cookies()).find(cookie => cookie.name === 'bb_admin_refresh');
      if (!rotated) throw Error('Rotated admin session cookie missing');
      session.refreshCookie = rotated.value;
      await httpCache.close();
      await context.close();
    }
    progress.step = 'complete';
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await egress.close();
      fs.writeFileSync(output, JSON.stringify({ results, progress,
        inp_collector: inpCollectorIdentity, browser_egress: { ...METHOD, rejections: egress.snapshot() },
        method: 'Chromium unthrottled lab; HTTP-cache-cleared then cache-enabled repeat with observed hits; fixed 2s navigation observation; scripted lab INP only; server/DB cold cache unmeasured' }, null, 2));
    }
  }
}
main().catch(() => { console.error('Browser validation failed; sanitized partial metrics retained'); process.exitCode = 1; });
