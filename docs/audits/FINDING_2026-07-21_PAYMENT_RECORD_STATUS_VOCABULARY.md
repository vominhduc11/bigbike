# Finding: WordPress payment-record status vocabulary mismatch

- **Status:** OPEN; out of scope for the order-status consolidation task.
- **Location:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/mapper/WordPressOrderMapper.java:285`.
- **Evidence:** `derivePaymentRecordStatus()` returns `PAID` and `UNPAID`, while `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/PaymentRecordStatus.java` defines only `PENDING`, `SUCCEEDED`, `FAILED`, and `CANCELLED`.
- **Impact:** WordPress-imported payment records may contain status values outside the current payment-record vocabulary.
- **Decision:** Not fixed in this task, per explicit scope. Resolve separately with an import/migration contract decision and dedicated tests.
