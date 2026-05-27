---
name: docs-first
description: Dùng ở ĐẦU mọi thay đổi code trong repo BigBike (backend/web/admin/mobile) để thực thi Docs-First Contract. Map thay đổi dự định sang đúng file+section docs cần đọc, trích rule kèm evidence path, dừng-hỏi khi gặp NEEDS_VERIFICATION / NOT_FOUND_IN_REPO / CONFLICTING_EVIDENCE, và kết luận có cần sửa docs trước khi code không. Gọi bằng /docs-first <mô tả thay đổi>.
---

# /docs-first — Định tuyến Docs-First trước khi sửa code

Docs trong `docs/business/` và `docs/engineering/` là **source of truth**. Code dựng từ docs, không ngược lại. Skill này biến mapping table thụ động thành một bước thực thi: đọc đúng chỗ, trích rule, phát hiện gap.

> Docs là **local-only** (đã gỡ khỏi git tracking) nhưng vẫn canonical. Đọc trên đĩa; **không commit** `docs/`.

## Bước 1 — Phân loại thay đổi

Trả lời 2 câu: (a) sub-project nào? (b) chạm vào concern nào? — endpoint, business logic, data shape, enum, migration, state transition, permission/role, UI/flow, deployment.

## Bước 2 — Map sang đúng docs (chỉ đọc section liên quan)

| Đang sửa | Đọc (chỉ section liên quan) |
|---|---|
| Backend controller/service — endpoint hoặc logic | `docs/engineering/API_CONTRACT.md` (endpoint đó) + `docs/business/BUSINESS_RULES.md` (rule liên quan) |
| Backend entity/DTO/enum/migration | `docs/engineering/DATA_CONTRACT.md` (entity đó) |
| Backend state transition | `docs/business/STATE_MACHINES.md` (entity đó) |
| Backend integration (DB, MinIO, Mail, WS) | `docs/engineering/INTEGRATION_GUIDE.md` |
| Frontend API call / response shape | `docs/engineering/API_CONTRACT.md` + `docs/engineering/DATA_CONTRACT.md` |
| Frontend flow màn hình → API | `docs/engineering/API_FLOW_MAP.md` |
| Frontend workflow / UX | `docs/business/WORKFLOW_OVERVIEW.md` |
| Permission / role / auth | `docs/engineering/PERMISSION_MATRIX.md` + `docs/business/USER_ROLES.md` |
| Order/payment/refund/inventory/return | `docs/business/BUSINESS_RULES.md` + `docs/business/STATE_MACHINES.md` |
| Serial / tồn kho serial | `docs/business/SERIAL_INVENTORY_RULES.md` + `docs/engineering/SERIAL_INVENTORY_FLOW.md` |
| Deployment / Docker / env / CI | `docs/engineering/DEPLOYMENT_GUIDE.md` + `docs/engineering/INTEGRATION_GUIDE.md` |
| Test / quality gate | `docs/engineering/TESTING_GUIDE.md` + `docs/business/ACCEPTANCE_CRITERIA.md` |
| Cần toàn cảnh kiến trúc | `docs/engineering/ARCHITECTURE.md` + `docs/business/MODULE_CATALOG.md` + `docs/business/PROJECT_OVERVIEW.md` |

Full map: `AGENTS.md` §4 và bảng trong `CLAUDE.md`. Mở **đúng section**, không đọc cả file vì một thay đổi nhỏ.

**Không cần docs khi:** câu hỏi giải thích thuần, đổi thuần style/token, refactor nội tại không chạm API/contract/data/permission/state/deployment.

## Bước 3 — Đọc & trích rule kèm evidence

Với mỗi rule chi phối thay đổi, ghi lại dạng có thể cite trong PR:
> theo `docs/business/BUSINESS_RULES.md` rule `ORDER_RULE_003`, …

Trích đúng nội dung rule, không diễn giải sai.

## Bước 4 — Gặp gap thì DỪNG, không bịa

Nếu docs ghi `NEEDS_VERIFICATION`, `NOT_FOUND_IN_REPO`, hoặc `CONFLICTING_EVIDENCE` cho điều bạn cần để code → **dừng và hỏi user**, không tự suy diễn rule. Cũng dừng nếu docs hoàn toàn im lặng về một business rule bạn cần.

## Bước 5 — Khi docs mâu thuẫn nhau

- `docs/business/` mâu thuẫn `docs/engineering/` → **business thắng**, engineering cần sửa.
- `docs/engineering/` mâu thuẫn code → check report trong `docs/audits/` nếu có; mặc định docs là source of truth khi chưa có verdict. Không tự "fix" cái đã được audit flag là code bug — đó là task riêng.

## Bước 6 — Kết luận: có phải update docs TRƯỚC không?

Nếu thay đổi ảnh hưởng **business rule / API contract / data shape / permission / state machine / workflow / deployment** → **update docs trước, rồi mới sửa code, trong cùng một change**.

Nếu là refactor nội tại / style / token thuần → bỏ qua, code trực tiếp.

## Output của skill

In ra plan ngắn:
1. Sub-project + concern.
2. Docs đã đọc (file + section) và rule trích được (kèm evidence path).
3. Gap cần hỏi user (nếu có) — và DỪNG ở đây nếu có gap chặn.
4. Docs cần update trước (danh sách file + thay đổi) — hoặc "không cần update docs".
5. Sau khi xong code, dùng `/preflight` để đóng gate.
