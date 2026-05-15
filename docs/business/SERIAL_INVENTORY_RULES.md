# Serial Inventory Business Rules

**Scope:** Products / variants that have at least one serial record — `track_serials` is set automatically.

---

## Serial Lifecycle States

```
IN_STOCK → RESERVED → SOLD → RETURNED → INSPECTION → IN_STOCK
                                                    → DAMAGED
                                                    → SCRAPPED
         → IN_STOCK  (reservation expired or order cancelled)
```

| State | Meaning |
|---|---|
| `IN_STOCK` | Available for sale |
| `RESERVED` | Held for a checkout session; TTL applies |
| `SOLD` | Linked to a completed order; warranty starts here |
| `RETURNED` | Customer returned; awaiting inspection |
| `INSPECTION` | Staff inspecting returned unit |
| `DAMAGED` | Inspection result: not resaleable |
| `SCRAPPED` | Inspection result: disposed of |

Only `IN_STOCK` serials count toward `quantity_on_hand` (maintained by DB trigger).

---

## Rules

### RULE-SER-001 — Serial as sole source of truth
For any variant/product with `track_serials = true`, `quantity_on_hand` is derived from the count of `IN_STOCK` serials. The application MUST NOT manually increment or decrement `quantity_on_hand` for these variants.

### RULE-SER-002 — Reservation TTL
When a serial is reserved during checkout, a `reserved_until` timestamp is set (default: NOW + 15 minutes, configurable via `reservation_ttl_minutes` site setting). Expired reservations are released automatically by the cleanup job.

### RULE-SER-003 — FIFO reservation
Available serials are reserved in `received_at ASC` order (oldest first).

### RULE-SER-004 — Concurrent checkout safety
Serial reservation uses `SELECT ... FOR UPDATE SKIP LOCKED` to prevent double-reservation under concurrent requests. Only one checkout session can hold a given serial at a time.

### RULE-SER-005 — Idempotent operations
All lifecycle transitions are idempotent. Re-calling `reserveForOrderLine` for a line item that already has bridge records is a no-op. Re-calling `markSoldForOrder` for serials already SOLD is a no-op.

### RULE-SER-006 — Order completion triggers markSold
When an order transitions to `COMPLETED`, all RESERVED serials linked via `order_line_item_serials` are marked SOLD. Warranty records are created at this point.

### RULE-SER-007 — Order cancellation releases reservation
When an order transitions to `CANCELLED`, all RESERVED serials linked to that order are returned to `IN_STOCK` and `reserved_until` is cleared.

### RULE-SER-008 — Returns go through INSPECTION
When a return is RECEIVED, linked serials transition SOLD → RETURNED. They then move to INSPECTION before the inspection result (IN_STOCK, DAMAGED, SCRAPPED) is recorded. Only serials marked IN_STOCK after inspection are added back to available stock.

### RULE-SER-009 — Warranty creation
A `warranty_record` is created for each serial when it is marked SOLD. Warranty period starts on the sold date; duration from `default_warranty_months` site setting (default: 12 months).

### RULE-SER-010 — Manual adjustment blocked when gate enabled
If `serial_inventory_only = true` in `site_settings`, calls to `POST /admin/inventory/adjust` or `POST /admin/inventory/products/{id}/adjust` return `400 SERIAL_INVENTORY_ONLY` for serial-tracked variants.

### RULE-SER-011 — Non-serial products unaffected
Products / variants that have no serial records (`track_serials = false`) continue to use the legacy quantity-based path. The `serial_inventory_only` gate does not block adjustments for these products.

### RULE-SER-013 — Serial tracking is auto-activated; there is no manual toggle
`track_serials` is set to `true` automatically when the first serial is added to a product or variant (via add, bulk import, or stock-in). There is no API to manually enable or disable serial tracking — the flag is derived from the presence of serials. Once serial tracking is active, `quantity_on_hand` is exclusively maintained by the DB trigger (`fn_sync_qty_from_serial_lifecycle`); the legacy manual-adjustment path should not be used for these products.

### RULE-SER-012 — POS immediate markSold
POS orders skip the RESERVED state from the customer's perspective; the system internally reserves then marks sold in the same transaction because POS orders are COMPLETED on creation.

---

## Configuration

| Setting key | Default | Description |
|---|---|---|
| `serial_inventory_only` | `false` | Blocks manual qty adjustments for serial-tracked variants |
| `reservation_ttl_minutes` | `15` | Minutes a RESERVED serial is held before auto-release |
| `default_warranty_months` | `12` | Warranty duration in months from sale date |
| `low_stock_threshold` | `5` | Units below which stock state = LOW_STOCK |
| `inventory.reservation.cleanup-interval-ms` | `60000` | Cleanup job poll interval (application.properties) |
