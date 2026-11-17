const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createRejectProxy, observeHttpCache, isPrivateApi, counterDelta } = require('./browser-egress.cjs');

async function requestProxy(proxy, method, headers = {}) {
  const port = Number(proxy.launchArgs[0].split(':').at(-1));
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, method,
      path: method === 'CONNECT' ? 'blocked.egress.invalid:443' : 'http://blocked.egress.invalid/probe', headers });
    request.once('error', reject);
    request.once('response', response => { response.resume(); response.once('end', () => resolve(response.statusCode)); });
    request.once('connect', (response, socket) => { socket.destroy(); resolve(response.statusCode); });
    request.setTimeout(3000, () => request.destroy(Error('Owned proxy probe timeout')));
    request.end();
  });
}

async function nativeProof() {
  const { chromium } = createRequire(path.resolve('bigbike-web/package.json'))('@playwright/test');
  const denied = http.createServer((_request, response) => response.end('owned sentinel'));
  let deniedConnections = 0, assetRequests = 0, privateRequests = 0, allowedPort;
  denied.on('connection', () => deniedConnections++);
  denied.on('upgrade', (_request, socket) => socket.destroy());
  const listen = (server, host) => new Promise(resolve => server.listen(0, host, resolve));
  await listen(denied, '127.0.0.2');
  const deniedPort = denied.address().port;
  const external = 'http://blocked.egress.invalid:' + deniedPort;
  const allowed = http.createServer((request, response) => {
    const route = request.url.split('?')[0];
    response.setHeader('Cache-Control', route === '/asset.js' ? 'public,max-age=3600,immutable' : 'no-store');
    response.setHeader('Content-Type', route.endsWith('.js') ? 'text/javascript' : 'text/html');
    if (route === '/asset.js') { assetRequests++; return response.end('window.__cacheProof=true'); }
    if (route === '/api/v1/customer/me') { privateRequests++; return response.end('{}'); }
    if (route === '/worker.js') return response.end(`fetch('${external}/worker',{mode:'no-cors'}).then(()=>postMessage('done')).catch(()=>postMessage('done'));`);
    if (route === '/sw.js') return response.end(`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>{fetch('${external}/service-worker',{mode:'no-cors'}).catch(()=>{}).finally(()=>e.source.postMessage('done'))});`);
    if (route === '/frame') return response.end(`<script>fetch('${external}/frame',{mode:'no-cors'}).catch(()=>{})</script>`);
    response.end(`<body><script src="/asset.js"></script><script>
      fetch('${external}/main',{mode:'no-cors'}).catch(()=>{});
      fetch('http://127.0.0.2:${deniedPort}/raw-ip',{mode:'no-cors'}).catch(()=>{});
      fetch('https://blocked.egress.invalid:${deniedPort}/https',{mode:'no-cors'}).catch(()=>{});
      fetch('/api/v1/customer/me').catch(()=>{});
      const worker=new Worker('/worker.js');worker.onmessage=()=>window.__workerDone=true;
      const ws=new WebSocket('ws://blocked.egress.invalid:${deniedPort}/websocket');ws.onerror=()=>window.__wsBlocked=true;
      navigator.serviceWorker.addEventListener('message',()=>window.__swDone=true);
      navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(r=>r.active.postMessage('probe'));
      const frame=document.createElement('iframe');frame.src='http://localhost:${allowedPort}/frame';document.body.append(frame);
      </script>`);
  });
  await listen(allowed, '127.0.0.1');
  allowedPort = allowed.address().port;
  const proxy = await createRejectProxy();
  let browser, page, cache;
  const report = { complete: false, phase: 'launch',
    scope: 'Owned loopback static transport/cache proof; no BigBike latency or UDP certification' };
  try {
    browser = await chromium.launch({ headless: true, args: [...proxy.launchArgs,
      '--site-per-process', '--host-resolver-rules=MAP *.egress.invalid 127.0.0.2'] });
    const context = await browser.newContext();
    page = await context.newPage();
    let pageErrors = 0;
    page.on('pageerror', () => pageErrors++);
    cache = await observeHttpCache(context, page);
    await cache.clearHttpCache();
    const visit = async () => {
      await page.goto(`http://127.0.0.1:${allowedPort}/`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__wsBlocked && window.__workerDone && window.__swDone, null, { timeout: 10000 });
      await page.waitForTimeout(250);
    };
    report.phase = 'first_navigation';
    await visit();
    const firstAssets = assetRequests;
    report.phase = 'repeat';
    await visit();
    const observed = cache.snapshot();
    assert.equal(firstAssets, 1);
    assert.equal(assetRequests, 1);
    assert.equal(privateRequests, 2);
    assert.equal(deniedConnections, 0);
    assert.ok(observed.cache_hit_requests > 0);
    assert.equal(observed.private_http_cache_hits, 0);
    assert.ok(proxy.snapshot().http_rejected >= 10);
    assert.ok(proxy.snapshot().connect_rejected >= 2);
    assert.equal(page.frames().length, 2);
    assert.equal(page.workers().length, 1);
    Object.assign(report, { browser: await browser.version(), first_asset_requests: firstAssets,
      repeated_asset_requests_total: assetRequests, no_store_private_requests: privateRequests,
      denied_target_connections: deniedConnections, ...observed, rejections: proxy.snapshot(),
      default_service_worker_completed: true,
      page_errors: pageErrors,
      scope: 'Owned loopback static transport/cache proof; main/worker/OOPIF/service-worker/HTTP/HTTPS/ws; no BigBike latency or UDP certification' });
    assert.equal(pageErrors, 0);
    report.phase = 'explicit_clear';
    await page.goto('about:blank');
    await cache.clearHttpCache();
    await visit();
    assert.equal(assetRequests, 2, 'Explicit cache clear must cause a fresh asset request');
    report.explicit_clear_refetched_asset = true;
    report.complete = true;
    report.phase = 'complete';
    await cache.close();
  } finally {
    Object.assign(report, { denied_target_connections: deniedConnections, asset_requests_total: assetRequests,
      no_store_private_requests: privateRequests, observed_cache: cache?.snapshot(), rejections: proxy.snapshot() });
    if (page && !page.isClosed()) {
      report.observed_document = await page.evaluate(() => ({ worker: !!window.__workerDone,
        websocket_denied: !!window.__wsBlocked, service_worker: !!window.__swDone })).catch(() => null);
      report.frames = page.frames().length;
    }
    console.log(JSON.stringify(report));
    if (browser) await browser.close();
    await proxy.close();
    for (const server of [allowed, denied]) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
}

if (process.argv.includes('--native')) {
  nativeProof().catch(() => { console.error('Native cache/egress protocol proof failed'); process.exitCode = 1; });
} else {
  const test = require('node:test');
  test('browser error categories retain only fixed origin, resource and error classes', () => {
    const { responseCategory, pageErrorCategory } = require('./browser.cjs');
    const privateUrl = 'http://localhost:13000/private-token?secret=private';
    assert.equal(responseCategory(privateUrl, 'script', 429), 'web_script_429');
    assert.equal(responseCategory(privateUrl, 'private', 503), 'web_other_5xx');
    assert.equal(responseCategory('https://private.invalid/token', 'image', 429), null);
    assert.equal(responseCategory(privateUrl, 'image', 200), null);
    assert.equal(pageErrorCategory({ name: 'TypeError', message: 'private' }), 'TypeError');
    assert.equal(pageErrorCategory({ name: 'private' }), 'other');
    assert.ok(!JSON.stringify([responseCategory(privateUrl, 'script', 429), pageErrorCategory({ name: 'private' })]).includes('private'));
  });
  test('hung renderer diagnostics end with an explicit unavailable result', async () => {
    const { failureDomCounts } = require('./browser.cjs');
    assert.deepEqual(await failureDomCounts({ evaluate: () => new Promise(() => {}) }), { unavailable: true });
  });
  test('browser failure diagnostics retain only fixed DOM counts without content or URLs', async () => {
    const { failureDomCounts } = require('./browser.cjs');
    const result = await failureDomCounts({ evaluate: async () => ({ ready_state: 'complete',
      hero_containers: 1, hero_images: 1, hero_visible_images: 0, hero_decoded_images: 0,
      images: 9, headings: 1, text: 'private-value', url: 'https://private.invalid/?token=private-value' }) });
    assert.equal(result.hero_visible_images, 0);
    assert.equal(result.ready_state, 'complete');
    assert.ok(!JSON.stringify(result).includes('private'));
    const invalid = await failureDomCounts({ evaluate: async () => ({ ready_state: 'private-value', hero_images: NaN }) });
    assert.equal(invalid.ready_state, 'unknown');
    assert.equal(invalid.hero_images, null);
    assert.deepEqual(await failureDomCounts({ evaluate: async () => { throw Error('private-value'); } }), { unavailable: true });
  });
  test('reject-only proxy denies HTTP CONNECT and upgrade without upstream forwarding', async () => {
    const proxy = await createRejectProxy();
    try {
      assert.equal(await requestProxy(proxy, 'GET'), 403);
      assert.equal(await requestProxy(proxy, 'CONNECT'), 403);
      assert.equal(await requestProxy(proxy, 'GET', { Connection: 'upgrade', Upgrade: 'websocket' }), 403);
      assert.deepEqual(proxy.snapshot(), { http_rejected: 1, connect_rejected: 1, upgrade_rejected: 1, malformed_rejected: 0 });
      assert.ok(proxy.launchArgs.includes('--proxy-bypass-list=<-loopback>;localhost;127.0.0.1'));
      assert.ok(!proxy.launchArgs.some(value => value.includes('direct://')));
    } finally { await proxy.close(); }
  });
  test('private cache detector selects authenticated APIs without raw payload retention', () => {
    assert.equal(isPrivateApi('http://localhost:14000/api/v1/admin/products?q=fixture'), true);
    assert.equal(isPrivateApi('http://localhost:13000/api/v1/customer/me'), true);
    assert.equal(isPrivateApi('http://localhost:13000/_next/static/app.js'), false);
    assert.deepEqual(counterDelta({ count: 3 }, { count: 1 }), { count: 2 });
  });
}
