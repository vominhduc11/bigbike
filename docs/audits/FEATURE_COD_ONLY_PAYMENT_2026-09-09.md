# COD-only payment cutover — 2026-09-09

## Decision

New storefront orders use COD only. The bank-transfer checkout, customer instructions, payment
receipt workflow, bank-account settings and receipt notifications are removed. Historical order
methods and read-only payment details remain available for accounting.

The assistant keeps its product-image consultation flow. Payment-document images have no payment
side effect.

## Protected data scope

Only these two unconfirmed processing orders may change method:

- `BB-20260907-8D3C36` — 5.450.000đ
- `BB-20260909-471115` — 1.550.000đ

The current live baseline has 1.169 non-COD orders. After the cutover, exactly 1.167 non-COD
orders must remain unchanged. The baseline also contains historical non-COD orders that are still
open; the explicit owner instruction is to preserve them as well.

## Evidence and checks

Before migration, record only aggregate counts, invariant fingerprints and the two target rows'
business fields. Do not record customer contact data, bank credentials or raw order exports in Git.

Required checks:

- backup artifact, checksum and restore verification are recorded without secrets;
- both target order/payment methods become `COD`, while status, amount and unpaid fields stay intact;
- all other order methods, statuses and monetary fields remain unchanged;
- public checkout accepts only omitted/`COD` and rejects explicit non-COD values;
- web, admin, email and assistant contain no active transfer-receipt path;
- historical method labels remain readable in Vietnamese and English;
- the controlled `E2E_PAYMENT_COD_` order reaches customer confirmation, email and admin, then is
  cancelled through the existing admin flow.

## Delivery record

Status: `IMPLEMENTED_WITH_LIVE_DEPLOYMENT_BLOCKER`

### Repository implementation

- Guarded data migration: `bigbike-backend/src/main/resources/db/migration/V1083__cod_only_payment_cutover.sql`.
- Customer web, admin, email templates, assistant payment-document path, API contract and data
  contract were updated together. The product-image assistant path remains covered by its existing
  tests.
- Historical method labels and payment detail rows remain read-only. No active source reference
  remains for the removed receipt command, receipt notification service or bank settings UI.

### Verification

- Web: 104 test files, 680 tests passed; lint and production build passed.
- Admin: 120 test files, 1,142 tests passed; lint and production build passed.
- Backend: 217 test groups, 1,757 tests, 0 failures, 0 errors, 1 skipped.
- OpenAPI drift check: 5 tests passed.
- Locale/OpenAPI JSON validation and repository diff whitespace checks passed.

### Backup evidence

The database backup was created before any live data write at 19:45:33 +07 as
`db-20260909T194533.dump` (12 MB). NAS read-back verification passed at 19:46:14 +07 with SHA-256
`8ed8e9a4e9802beedd4319d0147b843297b8b46bd93d287cc45531e1bd1805b7`; the backup index was readable
and restore-ready. Recovery instructions are in `docs/engineering/BACKUP_RESTORE_RUNBOOK.md`,
section 3.6.

### Live database and rollout status

Read-only inspection confirmed the live database was still at Flyway version `1082`; the two named
orders were still `PROCESSING`/`BANK_TRANSFER` with unpaid pending payment rows, four bank settings
remained, and no receipt notification rows were present. No live order or setting was changed in
this handoff. The guarded migration remains ready to apply in the same deployment window as the
new backend, as required by `docs/engineering/DEPLOYMENT_GUIDE.md`.

`Không chạy được: các container BigBike đang chạy dùng image đã tạo trước thay đổi và không gắn source hiện tại; AGENTS.md và docs/engineering/DEPLOYMENT_GUIDE.md không cho phép tự khởi động lại/triển khai lại shared stack, nên không thể áp dụng migration V1083 hoặc chạy E2E live trong lượt này.`

The controlled `E2E_PAYMENT_COD_` order was therefore not created, because the running checkout
still served the pre-cutover transfer flow. No customer or order data was created for the blocked
E2E attempt.

Secrets, customer contact data, bank credentials and raw order exports are excluded.
