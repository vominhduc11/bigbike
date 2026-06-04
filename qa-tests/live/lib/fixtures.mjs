// Isolated QA test fixtures on the LIVE dev Postgres. All rows are tagged with the
// 'qatest' prefix so teardown can remove the entire footprint. We clone a real PUBLISHED
// product row (so every NOT-NULL column is valid) and override only identity/stock fields.
import { execFileSync } from 'node:child_process';

const PG = ['exec', '-i', 'bigbike-postgres', 'psql', '-U', 'bigbike', '-d', 'bigbike', '-v', 'ON_ERROR_STOP=1'];

export function sql(text, { rows = false } = {}) {
  const args = rows ? [...PG, '-t', '-A', '-F', '|', '-c', text] : [...PG, '-c', text];
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}
export function scalar(text) {
  const out = execFileSync('docker', [...PG, '-t', '-A', '-c', text], { encoding: 'utf8' }).trim();
  return out;
}

const SOURCE_PRODUCT = 'wp-prod-6093';
const SOURCE_VARIANT = 'wp-var-6094';

// Create (or recreate) an isolated published test product + single variant.
export function createTestProduct({ key, qty = 1, trackSerials = false }) {
  const pid = `qatest-prod-${key}`;
  const vid = `qatest-var-${key}`;
  sql(`
    DELETE FROM stock_movements WHERE product_variant_id='${vid}';
    DELETE FROM product_serials WHERE product_variant_id='${vid}';
    DELETE FROM product_variants WHERE id='${vid}';
    DELETE FROM products WHERE id='${pid}';
    CREATE TEMP TABLE _p AS SELECT * FROM products WHERE id='${SOURCE_PRODUCT}';
    UPDATE _p SET id='${pid}', sku='QATEST-${key}-P', slug='${pid}', name='QA Test ${key}',
       stock_quantity=0, manage_stock=true, track_serials=${trackSerials}, stock_state='IN_STOCK',
       publish_status='PUBLISHED', version=0, legacy_id=NULL;
    INSERT INTO products SELECT * FROM _p;
    DROP TABLE _p;
    CREATE TEMP TABLE _v AS SELECT * FROM product_variants WHERE id='${SOURCE_VARIANT}';
    UPDATE _v SET id='${vid}', product_id='${pid}', sku='QATEST-${key}-V', name='QA Variant ${key}',
       quantity_on_hand=${qty}, is_available=true, stock_state='IN_STOCK', track_serials=${trackSerials};
    INSERT INTO product_variants SELECT * FROM _v;
    DROP TABLE _v;
  `);
  return { productId: pid, variantId: vid };
}

export function resetVariantStock(variantId, qty) {
  sql(`UPDATE product_variants SET quantity_on_hand=${qty},
       stock_state=CASE WHEN ${qty}<=0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END
       WHERE id='${variantId}';`);
}
export function variantStock(variantId) {
  return Number(scalar(`SELECT quantity_on_hand FROM product_variants WHERE id='${variantId}';`));
}

// Remove the entire QA footprint: orders that contain a qatest line item + all order
// children, then the qatest products/variants and their stock movements.
export function teardownQa() {
  const orderChildren = [
    'accounts_receivable', 'admin_notifications', 'checkout_idempotency_keys', 'order_addresses',
    'order_applied_coupons', 'order_fee_items', 'order_line_items', 'order_notes',
    'order_shipping_items', 'payment_events', 'payments', 'refund_transactions',
  ];
  // order_line_items.product_id is UUID-typed and does not hold our string product id;
  // identify QA orders via the text SKU snapshot instead (QATEST-*).
  const sel = `SELECT DISTINCT order_id FROM order_line_items WHERE sku LIKE 'QATEST-%'`;
  // returns reference orders too; clear their items first
  sql(`DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE order_id IN (${sel}));`);
  sql(`DELETE FROM returns WHERE order_id IN (${sel});`);
  for (const t of orderChildren) {
    try { sql(`DELETE FROM ${t} WHERE order_id IN (${sel});`); } catch { /* table/col may differ */ }
  }
  sql(`DELETE FROM orders WHERE id IN (${sel});`);
  sql(`DELETE FROM stock_movements WHERE product_variant_id LIKE 'qatest-%';`);
  sql(`DELETE FROM product_serials WHERE product_variant_id LIKE 'qatest-%';`);
  sql(`DELETE FROM product_variants WHERE id LIKE 'qatest-%';`);
  sql(`DELETE FROM products WHERE id LIKE 'qatest-%';`);
}

export const QA_ADDRESS = {
  fullName: 'QA Tester', email: 'qa-buyer@bigbike.test', phone: '0901234567',
  country: 'VN', province: 'Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé',
  addressLine1: '123 QA Street',
};
