# Serial-Only Inventory Backfill Guide

**Purpose:** Step-by-step guide for migrating existing product stock data from quantity-based tracking to serial-number-based tracking.

**Audience:** Backend engineers, DBAs, ops team.

**Prerequisites:** Migration `V90__add_serial_bridge_tables_and_warranty.sql` already applied; `serial_inventory_only` site setting exists (defaults to `false`).

---

## Overview

BigBike's inventory system supports two tracking modes per product/variant:

| Mode | `track_serials` flag | Source of truth |
|---|---|---|
| Legacy (quantity) | `false` | `product_variants.quantity_on_hand` |
| Serial-only | `true` | `product_serials` rows in `IN_STOCK` state |

The DB trigger `fn_sync_qty_from_serial_lifecycle` keeps `quantity_on_hand` in sync whenever a serial's status changes. Once a variant is switched to `track_serials = true`, manual qty adjustments are blocked (if `serial_inventory_only = true` globally).

This guide covers:
1. Deciding which products to migrate
2. Generating serial import CSVs from existing stock
3. Running the import via the API
4. Verifying counts match
5. Enabling `track_serials` per variant/product
6. Enabling the global `serial_inventory_only` gate

---

## Phase 1 — Assess Existing Stock

### 1.1 Identify variants with nonzero stock

```sql
SELECT
    p.id AS product_id,
    p.name AS product_name,
    pv.id AS variant_id,
    pv.sku,
    pv.quantity_on_hand
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.quantity_on_hand > 0
  AND pv.track_serials = false
ORDER BY p.name, pv.sku;
```

### 1.2 Check which variants already have serial rows

```sql
SELECT variant_id, COUNT(*) AS serial_count
FROM product_serials
WHERE status = 'IN_STOCK'
GROUP BY variant_id;
```

Variants already present with `IN_STOCK` serials matching `quantity_on_hand` are ready to switch; skip to Phase 4.

---

## Phase 2 — Generate Serial Import CSV

For variants that need new serials created, generate a CSV using the template:

```
productId,variantId,chassisNumber,engineNumber,note,enableTracking
<UUID>,<UUID>,CHASSIS-001,,Backfill 2026-05-10,false
```

**Rules:**
- `chassisNumber` must be globally unique across `product_serials`. Use a prefix scheme: `BF-<YYYY>-<SKU>-<seq>`.
- `engineNumber` is optional; leave blank if not applicable.
- `enableTracking`: set to `false` during import — enable per-variant only after verifying counts.
- `partialMode`: use `true` for the first test run so invalid rows are reported without aborting.

### 2.1 Example script (psql) — generate chassis numbers for a variant

```sql
SELECT
    pv.product_id,
    pv.id AS variant_id,
    'BF-2026-' || pv.sku || '-' || LPAD(gs.n::text, 4, '0') AS chassis_number,
    '' AS engine_number,
    'Backfill 2026-05-10' AS note,
    'false' AS enable_tracking
FROM product_variants pv
CROSS JOIN LATERAL generate_series(1, pv.quantity_on_hand) AS gs(n)
WHERE pv.id = '<variant-uuid>'
  AND pv.track_serials = false;
```

Export with `\copy` or `COPY ... TO STDOUT WITH CSV HEADER`.

---

## Phase 3 — Run the Import API

**Endpoint:** `POST /api/v1/admin/inventory/serials/import`

**Headers:** `Authorization: Bearer <admin-token>`, `Content-Type: application/json`

**Body:**
```json
{
  "rows": [
    {
      "productId": "...",
      "variantId": "...",
      "chassisNumber": "BF-2026-SKU001-0001",
      "engineNumber": null,
      "note": "Backfill 2026-05-10",
      "enableTracking": false
    }
  ],
  "partialMode": true
}
```

**Response:**
```json
{
  "inserted": 48,
  "skipped": 0,
  "errors": []
}
```

If `errors` is non-empty, review each `rowIndex` / `field` / `code` and correct the CSV before re-running with `partialMode: false`.

**Batch size:** Keep each request under 500 rows to avoid gateway timeouts. Use pagination or loop scripts for large catalogues.

---

## Phase 4 — Verify Counts

After import, verify serial count matches `quantity_on_hand` for each variant:

```sql
SELECT
    pv.id AS variant_id,
    pv.sku,
    pv.quantity_on_hand,
    COUNT(ps.id) FILTER (WHERE ps.status = 'IN_STOCK') AS serial_in_stock,
    pv.quantity_on_hand = COUNT(ps.id) FILTER (WHERE ps.status = 'IN_STOCK') AS counts_match
FROM product_variants pv
LEFT JOIN product_serials ps ON ps.variant_id = pv.id
WHERE pv.track_serials = false
  AND pv.quantity_on_hand > 0
GROUP BY pv.id, pv.sku, pv.quantity_on_hand
HAVING pv.quantity_on_hand != COUNT(ps.id) FILTER (WHERE ps.status = 'IN_STOCK');
```

This query returns only variants where counts do NOT match. Result should be empty before proceeding.

---

## Phase 5 — Enable `track_serials` Per Variant

Once counts match, flip the flag. **Do this during low-traffic hours.**

### 5.1 Via Admin API (preferred, audited)

`PATCH /api/v1/admin/inventory/variants/{variantId}/track-serials` (if endpoint exists)

Or update via the product catalog admin UI (Settings → Inventory → "Track by serial number").

### 5.2 Direct DB update (emergency only)

```sql
-- Enable for a single variant
UPDATE product_variants
SET track_serials = true, updated_at = NOW()
WHERE id = '<variant-uuid>';

-- Enable for all variants of a product
UPDATE product_variants
SET track_serials = true, updated_at = NOW()
WHERE product_id = '<product-uuid>';
```

After enabling, the DB trigger will keep `quantity_on_hand` in sync. Verify one more time:

```sql
SELECT quantity_on_hand FROM product_variants WHERE id = '<variant-uuid>';
-- Should equal the count of IN_STOCK serials
```

---

## Phase 6 — Enable the Global Gate (Optional)

Once **all** variants that should be serial-tracked have been migrated, enable the global gate to block any future manual qty adjustments:

```sql
UPDATE site_settings
SET setting_value = 'true', updated_at = NOW()
WHERE setting_key = 'serial_inventory_only';
```

After this, calling `POST /api/v1/admin/inventory/adjust` or `POST /api/v1/admin/inventory/products/{id}/adjust` will return `400 SERIAL_INVENTORY_ONLY` for serial-tracked variants.

**Warning:** Variants with `track_serials = false` are still adjustable via legacy paths. Decide whether to migrate them before enabling the gate.

---

## Rollback

If something goes wrong after enabling `track_serials`:

```sql
-- Disable serial tracking for a variant (reverts to qty-based)
UPDATE product_variants
SET track_serials = false, updated_at = NOW()
WHERE id = '<variant-uuid>';

-- Disable the global gate
UPDATE site_settings
SET setting_value = 'false', updated_at = NOW()
WHERE setting_key = 'serial_inventory_only';
```

Serials created during backfill remain in the DB but are not used for stock calculations until `track_serials` is re-enabled.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `CHASSIS_DUPLICATE` error on import | `chassisNumber` already in `product_serials` | Check existing rows; use a different prefix |
| `counts_match = false` after import | Some rows were rejected in `partialMode` | Check `errors[]` in import response |
| `quantity_on_hand` not updated after enabling `track_serials` | DB trigger may not have fired | Manually update one serial status (OUT then IN) to trigger recount, or run `SELECT fn_sync_qty_from_serial_lifecycle()` if exposed |
| `400 SERIAL_INVENTORY_ONLY` on manual adjust | Global gate is enabled | Import serials and use lifecycle API instead |
