# Serial Table Cleanup Plan

**Purpose:** Plan for removing orphan legacy tables (`stock_receipt_serials`, `stock_movement_serials`) that predate the serial lifecycle architecture and are no longer written to by application code.

**Status:** DEFERRED — tables exist but are not actively used; cleanup should happen after the serial-only migration has been stable in production for at least 30 days.

---

## Background

Two tables were created in early inventory prototype work and were never fully integrated:

| Table | Created in migration | Description |
|---|---|---|
| `stock_receipt_serials` | V6x (approximate) | Linked serials to stock receipt line items; replaced by `product_serials.status` transitions |
| `stock_movement_serials` | V6x (approximate) | Linked serials to stock movement ledger entries; replaced by `stock_movements` writing variant/product-level ledger directly |

The current architecture uses:
- `order_line_item_serials` (V90) — order-to-serial bridge
- `return_item_serials` (V90) — return-to-serial bridge
- `warranty_records` (V90) — warranty module
- `stock_movements` — ledger (written by `SerialLifecycleService.writeStockMovement()`)

The orphan tables are **not referenced** by any Java entity, repository, or service as of V90.

---

## Pre-Cleanup Verification Checklist

Before dropping these tables, verify all of the following:

### 1. No application code references

```bash
# Search all Java source files for any reference to these table names
grep -r "stock_receipt_serials\|stock_movement_serials" \
  bigbike-backend/src/main/java/
```

Expected: zero results.

### 2. No active FK constraints pointing to them

```sql
SELECT
    tc.table_name AS fk_table,
    kcu.column_name AS fk_column,
    ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('stock_receipt_serials', 'stock_movement_serials');
```

Expected: zero rows.

### 3. No data written in last 30 days

```sql
-- Check if tables have a created_at column and recent rows
SELECT COUNT(*) FROM stock_receipt_serials
WHERE created_at >= NOW() - INTERVAL '30 days';

SELECT COUNT(*) FROM stock_movement_serials
WHERE created_at >= NOW() - INTERVAL '30 days';
```

Expected: zero rows.

### 4. Confirm row counts (for audit record)

```sql
SELECT 'stock_receipt_serials' AS tbl, COUNT(*) AS row_count FROM stock_receipt_serials
UNION ALL
SELECT 'stock_movement_serials', COUNT(*) FROM stock_movement_serials;
```

Record these counts in the cleanup PR description before dropping.

---

## Cleanup Migration

Create `V91__drop_orphan_serial_tables.sql` only after all checklist items pass:

```sql
-- V91__drop_orphan_serial_tables.sql
-- Drops legacy serial tables that were never integrated into the lifecycle architecture.
-- Verified: no FK references, no app code references, no rows written in last 30 days.
-- Row counts at time of drop: stock_receipt_serials=<N>, stock_movement_serials=<N>

DROP TABLE IF EXISTS stock_movement_serials;
DROP TABLE IF EXISTS stock_receipt_serials;
```

**Order matters:** drop `stock_movement_serials` before `stock_receipt_serials` in case of any FK dependency.

---

## Rollback

Flyway migrations are not reversible by default. If the drop needs to be undone:

1. Restore from pre-migration DB snapshot (ops team).
2. Or recreate tables from original DDL (check git history for the original migration that created them).

Because there is no live application code reading these tables, rollback is only needed if some external reporting tool queries them directly.

---

## Timeline

| Step | Owner | Target |
|---|---|---|
| Run pre-cleanup verification checklist | Backend engineer | After serial-only is stable in prod (≥30 days) |
| Record row counts in PR | Backend engineer | Before merging V91 |
| Apply V91 in staging | Backend engineer | Verify no errors |
| Apply V91 in production | DBA / ops | During maintenance window |
| Remove this document | Backend engineer | After V91 is deployed |
