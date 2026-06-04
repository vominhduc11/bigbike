// Items 9 (🔴 order state machine), 11 (refund), 12 (🔴 POS) — money & stock correctness.
// Oracle: docs/business/STATE_MACHINES.md §6 (order transitions, terminal states) +
//   BUSINESS_RULES.md ORDER_RULE_001..005 (COD completion needs PAID; cancel only when unpaid;
//   COMPLETED/CANCELLED/FAILED/REFUNDED terminal; refund only via refund endpoint, full-only).
import { req, test, expect, suite, adminLogin } from './lib/harness.mjs';
import { createTestProduct, resetVariantStock, variantStock, teardownQa, QA_ADDRESS } from './lib/fixtures.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let TOKEN;
const adm = (m, p, body) => req(m, p, { token: TOKEN, body });
const getOrder = async (id) => (await adm('GET', `/api/v1/admin/orders/${id}`)).json?.data;
function posSale(productId, variantId, qty, key) {
  return adm('POST', '/api/v1/admin/pos/orders', {
    items: [{ productId, productVariantId: variantId, quantity: qty }],
    paymentMethod: 'CASH', tenderedAmount: 999999999, posIdempotencyKey: key,
  });
}
function quickBuyCOD(productId, variantId) {
  return req('POST', '/api/v1/orders/quick-buy', {
    body: { productId, productVariantId: variantId, quantity: 1, billingAddress: QA_ADDRESS, paymentMethod: 'COD' },
  });
}

export default async function run() {
  suite('Item 9/11/12 — State machine, refund, POS (STATE_MACHINES §6 / ORDER_RULE_*)');
  TOKEN = (await adminLogin()).token;
  const pos = createTestProduct({ key: 'pos', qty: 10 });
  const cod = createTestProduct({ key: 'cod', qty: 5 });

  try {
    // ===== POS (item 12) — not rate-limited =====
    let posOrderId;
    await test('12', 'POS cash sale -> COMPLETED + PAID, stock decremented by qty', async () => {
      resetVariantStock(pos.variantId, 10);
      const r = await posSale(pos.productId, pos.variantId, 2, 'qa-pos-' + Date.now());
      expect(r.status).toBe(200, `POS sale failed: ${r.status} ${r.text?.slice(0, 150)}`);
      expect(r.json.data.status).toBe('COMPLETED');
      expect(r.json.data.paymentStatus).toBe('PAID');
      posOrderId = r.json.data.orderId;
      expect(variantStock(pos.variantId)).toBe(8, 'stock not decremented by 2');
    });
    await test('12', 'POS idempotency: same posIdempotencyKey -> same order, no double stock', async () => {
      resetVariantStock(pos.variantId, 10);
      const key = 'qa-posidem-' + Date.now();
      const a = await posSale(pos.productId, pos.variantId, 2, key);
      const b = await posSale(pos.productId, pos.variantId, 2, key);
      expect(b.json?.data?.orderId).toBe(a.json.data.orderId, 'POS idempotency broke — different order');
      expect(variantStock(pos.variantId)).toBe(8, 'POS idempotency double-decremented stock');
    });

    // ===== Order state machine on the COMPLETED POS order (item 9) =====
    await test('9', 'COMPLETED order is terminal: allowed-transitions is empty', async () => {
      const at = await adm('GET', `/api/v1/admin/orders/${posOrderId}/allowed-transitions`);
      const list = at.json?.data?.allowedTransitions || at.json?.data || [];
      expect(Array.isArray(list) ? list.length : -1).toBe(0, `expected no transitions, got ${JSON.stringify(list)}`);
    });
    await test('9', 'COMPLETED -> PROCESSING rejected (terminal, 409)', async () => {
      const r = await adm('PATCH', `/api/v1/admin/orders/${posOrderId}/status`, { status: 'PROCESSING' });
      expect(r.status).toBeOneOf([409, 400, 422], `expected rejection, got ${r.status}`);
    });
    await test('9', 'Direct COMPLETED -> REFUNDED via status PATCH rejected (must use /refund)', async () => {
      const r = await adm('PATCH', `/api/v1/admin/orders/${posOrderId}/status`, { status: 'REFUNDED' });
      expect(r.status).toBeOneOf([409, 400, 422], `expected rejection, got ${r.status}`);
    });

    // ===== Refund (item 11) on the PAID POS order =====
    await test('11', 'Partial refund rejected — refund is full-only (V114)', async () => {
      const ord = await getOrder(posOrderId);
      const r = await adm('POST', `/api/v1/admin/orders/${posOrderId}/refund`,
        { refundAmount: 1000, refundReason: 'qa partial' });
      expect(r.status).toBeOneOf([400, 409, 422], `partial refund should be rejected, got ${r.status} (paid=${ord?.paidAmount})`);
    });
    let stockBeforeRefund;
    await test('11', 'Full refund succeeds -> order REFUNDED (paymentStatus REFUNDED)', async () => {
      const ord = await getOrder(posOrderId);
      const full = ord.paidAmount ?? ord.totalAmount;
      stockBeforeRefund = variantStock(pos.variantId);
      const r = await adm('POST', `/api/v1/admin/orders/${posOrderId}/refund`,
        { refundAmount: full, refundReason: 'qa full refund' });
      expect(r.status).toBeOneOf([200, 201], `full refund failed: ${r.status} ${r.text?.slice(0, 150)}`);
      const after = await getOrder(posOrderId);
      expect(after.paymentStatus).toBe('REFUNDED', `payment status ${after.paymentStatus}`);
    });
    await test('11', 'Full refund RESTORES variant stock (sold qty back to inventory)', async () => {
      // The sale decremented variant.quantity_on_hand; a refund must add it back.
      const after = variantStock(pos.variantId);
      expect(after).toBe(stockBeforeRefund + 2,
        `BUG-2: refund did NOT restore stock (was ${stockBeforeRefund}, still ${after}, expected ${stockBeforeRefund + 2}). ` +
        `Restore services read OrderLineItemEntity.productId/productVariantId (UUID columns that are NULL for the ` +
        `string-id catalog; real id is in product_pk) -> every line item is skipped -> permanent stock loss on ` +
        `cancel/refund/return. Sale decrements correctly, restore does not.`);
    });
    await test('11', 'REFUNDED order is terminal: further status change rejected', async () => {
      const r = await adm('PATCH', `/api/v1/admin/orders/${posOrderId}/status`, { status: 'PROCESSING' });
      expect(r.status).toBeOneOf([409, 400, 422], `expected rejection, got ${r.status}`);
    });

    // ===== COD online order guards (item 9 🔴) — uses 2 rate-limited quick-buys =====
    console.log('    (waiting ~62s for a fresh checkout rate-limit window for COD orders…)');
    await sleep(62000);
    let codId;
    await test('9', 'COD order created -> PROCESSING / UNPAID', async () => {
      resetVariantStock(cod.variantId, 5);
      const r = await quickBuyCOD(cod.productId, cod.variantId);
      if (r.status === 429) { const e = new Error('rate limited'); e.__blocked = true; throw e; }
      expect(r.status).toBe(200, `COD quick-buy failed: ${r.status}`);
      codId = r.json.data.id; // quick-buy summary uses `id` (POS uses `orderId`)
      const ord = await getOrder(codId);
      expect(ord.paymentStatus).toBe('UNPAID');
    });
    await test('9', 'COD: COMPLETE while UNPAID rejected (ORDER_RULE_002 — COD must be PAID)', async () => {
      const r = await adm('PATCH', `/api/v1/admin/orders/${codId}/status`, { status: 'COMPLETED' });
      expect(r.status).toBeOneOf([409, 400, 422], `expected COD-unpaid completion to be rejected, got ${r.status}`);
    });
    await test('9', 'Cannot CANCEL a PAID order (ORDER_RULE_004 — must refund first)', async () => {
      // make a 2nd COD order, mark it PAID, then attempt cancel
      const r0 = await quickBuyCOD(cod.productId, cod.variantId);
      if (r0.status === 429) { const e = new Error('rate limited'); e.__blocked = true; throw e; }
      const id2 = r0.json.data.id;
      const pay = await adm('PATCH', `/api/v1/admin/orders/${id2}/payment-status`, { paymentStatus: 'PAID' });
      expect(pay.status).toBeOneOf([200, 201], `mark PAID failed: ${pay.status} ${pay.text?.slice(0, 120)}`);
      const cancel = await adm('PATCH', `/api/v1/admin/orders/${id2}/status`, { status: 'CANCELLED' });
      expect(cancel.status).toBeOneOf([409, 400, 422], `paid order cancel should be rejected, got ${cancel.status}`);
    });
  } finally {
    teardownQa();
  }
}
