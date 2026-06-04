// Item 8 (🔴) — Oversell prevention + idempotency (highest-risk: money & stock).
// Oracle: docs/business/BUSINESS_RULES.md STOCK_RULE_005/006 (checkout enforces stock atomically;
//   2 buyers / 1 unit -> only 1 succeeds) + CheckoutService pessimistic FOR UPDATE lock +
//   checkout_idempotency_keys unique(flow_type,scope_key,idempotency_key) — a double-submit must
//   yield exactly ONE order and the retry must return that same order.
// NOTE: checkout/quick-buy is rate-limited 5/min per IP; XFF is untrusted from our origin, so we
//   wait for a fresh bucket and spend exactly 5 calls.
import { req, test, expect, suite } from './lib/harness.mjs';
import { createTestProduct, resetVariantStock, variantStock, teardownQa, QA_ADDRESS } from './lib/fixtures.mjs';
import { execFileSync } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cookiesOf = (r) => (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
function quickBuy(productId, variantId, { idemKey, cookies } = {}) {
  const headers = {};
  if (idemKey) headers['Idempotency-Key'] = idemKey;
  if (cookies) headers['Cookie'] = cookies;
  return req('POST', '/api/v1/orders/quick-buy', {
    headers: Object.keys(headers).length ? headers : undefined,
    body: { productId, productVariantId: variantId, quantity: 1, billingAddress: QA_ADDRESS, paymentMethod: 'COD' },
  });
}
const ok = (r) => r.status === 200 && r.json?.data?.id;
function orderCountForSku(sku) {
  const out = execFileSync('docker', ['exec', '-i', 'bigbike-postgres', 'psql', '-U', 'bigbike', '-d', 'bigbike', '-t', '-A',
    '-c', `select count(distinct order_id) from order_line_items where sku='${sku}'`], { encoding: 'utf8' }).trim();
  return Number(out);
}

export default async function run() {
  suite('Item 8 — Oversell + idempotency (BUSINESS_RULES STOCK_RULE_005/006)');
  const os = createTestProduct({ key: 'os', qty: 1 });
  const idem = createTestProduct({ key: 'idem', qty: 5 });

  try {
    console.log('    (waiting ~62s for a fresh checkout rate-limit window…)');
    await sleep(62000);

    // 1) OVERSELL: 2 simultaneous buyers, stock = 1 -> exactly ONE order; stock floor 0. [2 calls]
    await test('8', 'Oversell: 2 concurrent buyers on stock=1 -> exactly 1 success, 1 rejected', async () => {
      resetVariantStock(os.variantId, 1);
      const pair = await Promise.all([quickBuy(os.productId, os.variantId), quickBuy(os.productId, os.variantId)]);
      if (pair.some((r) => r.status === 429)) { const e = new Error('hit rate limit (429) — inconclusive'); e.__blocked = true; throw e; }
      const wins = pair.filter(ok);
      expect(wins.length).toBe(1, `expected exactly 1 success, got ${wins.length} (statuses ${pair.map((r) => r.status).join(',')})`);
      const loser = pair.find((r) => !ok(r));
      expect(loser.status).toBeOneOf([400, 409, 422], `loser should be a stock rejection, got ${loser.status}`);
    });
    await test('8', 'Oversell: final stock is exactly 0 (never negative)', async () => {
      expect(variantStock(os.variantId)).toBe(0, 'non-zero/negative stock means oversell occurred');
    });

    // 2) Buy on empty stock is rejected with a clean 4xx (not 5xx). [1 call]
    await test('8', 'Buy on stock=0 rejected with stock error (4xx, not 5xx)', async () => {
      const r = await quickBuy(os.productId, os.variantId);
      if (r.status === 429) { const e = new Error('rate limited'); e.__blocked = true; throw e; }
      expect(r.status).toBeOneOf([400, 409, 422], `expected stock rejection, got ${r.status}`);
    });

    // 3) IDEMPOTENCY: same session + same Idempotency-Key twice. [2 calls]
    const key = 'qa-idem-' + Date.now();
    let a, b;
    await test('8', 'Idempotency: double-submit does NOT duplicate (stock decremented once: 5 -> 4)', async () => {
      resetVariantStock(idem.variantId, 5);
      a = await quickBuy(idem.productId, idem.variantId, { idemKey: key });
      const cookies = cookiesOf(a); // carry the guest session so scope_key is stable (real double-click)
      b = await quickBuy(idem.productId, idem.variantId, { idemKey: key, cookies });
      if (a.status === 429 || b.status === 429) { const e = new Error('rate limited'); e.__blocked = true; throw e; }
      expect(ok(a)).toBeTruthy(`first submit failed: ${a.status}`);
      expect(variantStock(idem.variantId)).toBe(4, 'stock decremented more than once — a duplicate order was created');
    });
    // The oracle requires the retry to RETURN the original order (HTTP 200, same id).
    await test('8', 'Idempotency: retry returns the SAME order (HTTP 200) — not an error', async () => {
      expect(b.status).toBe(200,
        `BUG: idempotency retry returned HTTP ${b.status} instead of the original order. ` +
        `Backend log shows PathElementException "Could not resolve attribute 'categories' of ProductEntity" ` +
        `in the dedup reload path (CheckoutService.loadExistingSummary -> catalog read). ` +
        `Duplicate orders ARE prevented, but the retry response is broken on PostgreSQL.`);
      expect(b.json?.data?.id).toBe(a.json.data.id, 'retry returned a different order id');
    });
  } finally {
    teardownQa();
  }
}
