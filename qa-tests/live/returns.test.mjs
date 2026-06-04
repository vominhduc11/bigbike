// Item 14 (🔴) — Returns: eligibility, ownership isolation, admin flow, restock.
// Oracle: docs/business/STATE_MACHINES.md §10 (return transitions) + BUSINESS_RULES.md
//   RETURN_RULE_001/002/006/007 (only own COMPLETED orders; one active return; full-coverage
//   for refund) + Returns And Inspection Rules (COMPLETED from RECEIVED restores received items).
import { req, test, expect, suite, adminLogin, createCustomerSession } from './lib/harness.mjs';
import { createTestProduct, resetVariantStock, variantStock, teardownQa, QA_ADDRESS } from './lib/fixtures.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let TOKEN;
const adm = (m, p, body) => req(m, p, { token: TOKEN, body });

async function completeOnlineOrder(cust, prod, qty) {
  const r = await req('POST', '/api/v1/orders/quick-buy', {
    cookies: cust.cookies, headers: { 'X-CSRF-Token': cust.csrfToken },
    body: { productId: prod.productId, productVariantId: prod.variantId, quantity: qty,
      billingAddress: { ...QA_ADDRESS, email: cust.email }, paymentMethod: 'COD' },
  });
  if (r.status === 429) return { rateLimited: true };
  const id = r.json.data.id;
  const o = (await adm('GET', `/api/v1/admin/orders/${id}`)).json.data;
  await adm('PATCH', `/api/v1/admin/orders/${id}/payment-status`, { paymentStatus: 'PAID', paidAmount: o.totalAmount });
  await adm('PATCH', `/api/v1/admin/orders/${id}/fulfillment`, { fulfillmentStatus: 'PROCESSING' });
  await adm('PATCH', `/api/v1/admin/orders/${id}/fulfillment`, { fulfillmentStatus: 'SHIPPED', trackingNumber: 'QA123', shippingCarrier: 'GHN' });
  await adm('PATCH', `/api/v1/admin/orders/${id}/fulfillment`, { fulfillmentStatus: 'DELIVERED' });
  await adm('PATCH', `/api/v1/admin/orders/${id}/status`, { status: 'COMPLETED' });
  return { id };
}

export default async function run() {
  suite('Item 14 — Returns (STATE_MACHINES §10 / RETURN_RULE_*)');
  TOKEN = (await adminLogin()).token;
  const prod = createTestProduct({ key: 'ret', qty: 20 });
  const A = await createCustomerSession();
  const B = await createCustomerSession();

  try {
    // In-store (POS) order is NOT eligible for online return.
    await test('14', 'In-store (POS) order cannot be returned online (IN_STORE_ORDER)', async () => {
      const pos = await adm('POST', '/api/v1/admin/pos/orders', {
        items: [{ productId: prod.productId, productVariantId: prod.variantId, quantity: 1 }],
        paymentMethod: 'CASH', tenderedAmount: 999999999, customerId: A.customerId, posIdempotencyKey: 'qa-retpos-' + Date.now(),
      });
      const posId = pos.json.data.orderId;
      const det = (await req('GET', `/api/v1/customer/orders/${posId}`, { cookies: A.cookies })).json?.data;
      const liId = (det?.lineItems || det?.items || [{}])[0]?.id;
      const r = await req('POST', `/api/v1/customer/orders/${posId}/returns`, {
        cookies: A.cookies, headers: { 'X-CSRF-Token': A.csrfToken },
        body: { reason: 'DEFECTIVE', items: [{ orderLineItemId: liId, quantity: 1 }] },
      });
      expect(r.status).toBeOneOf([400, 409, 422], `in-store return should be rejected, got ${r.status}`);
    });

    console.log('    (waiting ~62s for a fresh checkout rate-limit window…)');
    await sleep(62000);
    resetVariantStock(prod.variantId, 20);
    const ord = await completeOnlineOrder(A, prod, 2);
    if (ord.rateLimited) { await test('14', 'create completed online order', () => { const e = new Error('rate limited'); e.__blocked = true; throw e; }); return; }
    const stockAfterOrder = variantStock(prod.variantId); // 18

    // OWNERSHIP isolation (RETURN_RULE_006).
    await test('14', 'Customer B cannot view customer A\'s order (404)', async () => {
      const r = await req('GET', `/api/v1/customer/orders/${ord.id}`, { cookies: B.cookies });
      expect(r.status).toBeOneOf([403, 404], `expected 403/404, got ${r.status}`);
    });
    await test('14', 'Customer B cannot create a return on A\'s order (404)', async () => {
      const det = (await req('GET', `/api/v1/customer/orders/${ord.id}`, { cookies: A.cookies })).json.data;
      const liId = (det.lineItems || det.items)[0].id;
      const r = await req('POST', `/api/v1/customer/orders/${ord.id}/returns`, {
        cookies: B.cookies, headers: { 'X-CSRF-Token': B.csrfToken },
        body: { reason: 'DEFECTIVE', items: [{ orderLineItemId: liId, quantity: 1 }] },
      });
      expect(r.status).toBeOneOf([403, 404], `expected 403/404, got ${r.status}`);
    });

    // ELIGIBILITY: reason is a validated enum; valid reason on own completed order -> created.
    const det = (await req('GET', `/api/v1/customer/orders/${ord.id}`, { cookies: A.cookies })).json.data;
    const liId = (det.lineItems || det.items)[0].id;
    await test('14', 'Return with invalid reason rejected (reason is an enum)', async () => {
      const r = await req('POST', `/api/v1/customer/orders/${ord.id}/returns`, {
        cookies: A.cookies, headers: { 'X-CSRF-Token': A.csrfToken },
        body: { reason: 'whatever', items: [{ orderLineItemId: liId, quantity: 1 }] },
      });
      expect(r.status).toBe(400, `expected 400, got ${r.status}`);
    });
    let rid;
    await test('14', 'Owner creates return on own completed order (201)', async () => {
      const r = await req('POST', `/api/v1/customer/orders/${ord.id}/returns`, {
        cookies: A.cookies, headers: { 'X-CSRF-Token': A.csrfToken },
        body: { reason: 'DEFECTIVE', items: [{ orderLineItemId: liId, quantity: 2 }] },
      });
      expect(r.status).toBeOneOf([200, 201], `create return failed: ${r.status} ${r.text?.slice(0, 150)}`);
      rid = r.json.data.id || r.json.data.returnId;
    });
    await test('14', 'Customer sees own return in their returns list', async () => {
      const r = await req('GET', '/api/v1/customer/orders/returns', { cookies: A.cookies });
      const items = r.json?.data?.items || r.json?.data || [];
      expect(items.some((x) => (x.id || x.returnId) === rid)).toBeTruthy('own return not listed');
    });

    // ADMIN FLOW: PENDING -> APPROVED -> RECEIVED -> COMPLETED, restock received items.
    await test('14', 'Admin advances PENDING -> APPROVED -> RECEIVED', async () => {
      expect((await adm('PATCH', `/api/v1/admin/returns/${rid}/status`, { status: 'APPROVED' })).status).toBe(200);
      expect((await adm('PATCH', `/api/v1/admin/returns/${rid}/status`, { status: 'RECEIVED' })).status).toBe(200);
    });
    await test('14', 'Admin COMPLETED restores stock for received (non-serial) items', async () => {
      const before = variantStock(prod.variantId);
      const r = await adm('PATCH', `/api/v1/admin/returns/${rid}/status`, { status: 'COMPLETED' });
      expect(r.status).toBe(200, `complete failed: ${r.status}`);
      const after = variantStock(prod.variantId);
      expect(after).toBe(stockAfterOrder + 2,
        `expected stock restored to ${stockAfterOrder + 2} (order left ${stockAfterOrder}); got ${after}. ` +
        `Oracle: COMPLETED-from-RECEIVED restores received items.`);
    });
  } finally {
    teardownQa();
  }
}
