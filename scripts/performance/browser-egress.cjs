/* Lab HTTP-family egress boundary. This proxy never resolves or forwards upstream. */
const http = require('node:http');

const COUNTERS = ['http_rejected', 'connect_rejected', 'upgrade_rejected', 'malformed_rejected'];

async function createRejectProxy() {
  const counts = Object.fromEntries(COUNTERS.map(name => [name, 0]));
  const sockets = new Set();
  const server = http.createServer((_request, response) => {
    counts.http_rejected++;
    response.writeHead(403, { 'Cache-Control': 'no-store', Connection: 'close', 'Content-Length': '0' });
    response.end();
  });
  const rejectSocket = (socket, counter) => {
    counts[counter]++;
    socket.end('HTTP/1.1 403 Forbidden\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  };
  server.on('connect', (_request, socket) => rejectSocket(socket, 'connect_rejected'));
  server.on('upgrade', (_request, socket) => rejectSocket(socket, 'upgrade_rejected'));
  server.on('clientError', (_error, socket) => rejectSocket(socket, 'malformed_rejected'));
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });
  server.maxHeadersCount = 64;
  server.headersTimeout = 5000;
  server.requestTimeout = 5000;
  server.keepAliveTimeout = 0;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  if (port < 10000) {
    await new Promise(resolve => server.close(resolve));
    throw Error('Dedicated ephemeral proxy port required');
  }
  let closing;
  return {
    // Explicitly subtract Chromium's implicit localhost/link-local bypass first.
    // Only the two owned host spellings bypass the reject-only proxy. No DIRECT fallback.
    launchArgs: Object.freeze([
      '--proxy-server=http://127.0.0.1:' + port,
      '--proxy-bypass-list=<-loopback>;localhost;127.0.0.1',
      '--disable-quic',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    ]),
    snapshot: () => ({ ...counts }),
    async close() {
      if (!closing) closing = new Promise(resolve => {
        server.close(resolve);
        for (const socket of sockets) socket.destroy();
      });
      await closing;
    },
  };
}

function counterDelta(after, before) {
  return Object.fromEntries(Object.keys(after).map(name => [name, after[name] - (before[name] || 0)]));
}

function isPrivateApi(url) {
  try {
    const parsed = new URL(url);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname)
      && /^\/api\/v1\/(?:cart(?:\/|$)|checkout(?:\/|$)|customer(?:\/|$)|orders(?:\/|$)|admin(?:\/|$)|auth(?:\/|$))/.test(parsed.pathname);
  } catch (_) {
    return false;
  }
}

async function observeHttpCache(context, page) {
  const session = await context.newCDPSession(page);
  const served = new Set(), disk = new Set(), hits = new Set(), privateRequests = new Set();
  const privateHits = new Set(), serviceWorker = new Set();
  const noteHit = id => {
    hits.add(id);
    if (privateRequests.has(id)) privateHits.add(id);
  };
  session.on('Network.requestWillBeSent', entry => {
    if (isPrivateApi(entry.request.url)) {
      privateRequests.add(entry.requestId);
      if (hits.has(entry.requestId)) privateHits.add(entry.requestId);
    }
  });
  session.on('Network.requestServedFromCache', entry => {
    served.add(entry.requestId);
    noteHit(entry.requestId);
  });
  session.on('Network.responseReceived', entry => {
    if (entry.response.fromDiskCache) {
      disk.add(entry.requestId);
      noteHit(entry.requestId);
    }
    if (entry.response.fromServiceWorker) serviceWorker.add(entry.requestId);
  });
  await session.send('Network.enable');
  return {
    snapshot: () => ({ cache_hit_requests: hits.size, served_from_cache_events: served.size,
      disk_cache_responses: disk.size, private_http_cache_hits: privateHits.size,
      service_worker_responses: serviceWorker.size }),
    // This clears HTTP cache only; auth cookies, browser storage and app state remain intact.
    clearHttpCache: () => session.send('Network.clearBrowserCache'),
    close: () => session.detach(),
  };
}

const METHOD = Object.freeze({
  mode: 'browser-wide reject-only loopback HTTP proxy; allowed localhost/127.0.0.1 go directly',
  cache: 'HTTP cache enabled; first measured navigation explicitly clears only HTTP cache',
  scope: 'HTTP/HTTPS/ws/wss transport; QUIC/non-proxied WebRTC UDP disabled in lab; not a blanket network audit',
  service_workers: 'normal browser behavior; no service-worker bypass/block override',
  application_mutation: false,
});

module.exports = { createRejectProxy, counterDelta, isPrivateApi, observeHttpCache, METHOD };
