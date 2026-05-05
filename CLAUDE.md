# CLAUDE.md

> **Read this before doing anything in this codebase.**
>
> Auto-load behavior:
> - **Claude Code**: tự động đọc file này ở đầu mọi conversation trong repo.
> - **Codex** (CLI / web agent): KHÔNG đọc file này. Codex tự load [AGENTS.md](AGENTS.md) — nội dung đầy đủ và canonical hơn.
> - **Tool khác** (Cursor, Continue, …): tuỳ tool. Nếu không chắc, đọc cả 2 file để an toàn.
>
> File này là **bản tóm tắt mirror** của Docs-First Contract trong [AGENTS.md](AGENTS.md). Khi 2 file khác nhau, AGENTS.md là canonical.

---

## ⚠️ Docs-First Contract

Tài liệu trong [docs/business/](docs/business/) và [docs/engineering/](docs/engineering/) là **source of truth** của BigBike. Code được dựng từ docs, không phải ngược lại.

### Trước khi sửa BẤT KỲ file source nào trong [bigbike-backend/](bigbike-backend/), [bigbike-web/](bigbike-web/), [bigbike-admin/](bigbike-admin/), [bigbike_mobile/](bigbike_mobile/):

1. **Đọc docs liên quan** trong [docs/](docs/) (xem mapping bên dưới).
2. **Cite evidence path** khi mô tả thay đổi trong response/PR (ví dụ "theo `docs/business/BUSINESS_RULES.md` rule `ORDER_RULE_003`").
3. Nếu thay đổi ảnh hưởng business rule, API contract, data shape, permission, state machine, workflow hoặc deployment env → **update docs trước**, rồi mới sửa code, trong cùng một PR.
4. **Không bịa rule.** Nếu docs ghi `NEEDS_VERIFICATION` / `NOT_FOUND_IN_REPO` / `CONFLICTING_EVIDENCE` mà bạn cần biết để code → **dừng và hỏi user** thay vì tự suy diễn.
5. **Trước khi "fix bug"**, đọc [docs/DOCS_VERIFICATION_REPORT.md](docs/DOCS_VERIFICATION_REPORT.md) Section 3 để biết những vấn đề đã được flag là code bug có task riêng — không tự ý fix chung trong task khác.

### Mapping nhanh

| Bạn đang sửa | Đọc docs |
|---|---|
| Backend controller / service / entity / migration | [API_CONTRACT.md](docs/engineering/API_CONTRACT.md), [DATA_CONTRACT.md](docs/engineering/DATA_CONTRACT.md), [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md), [STATE_MACHINES.md](docs/business/STATE_MACHINES.md), [BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md) |
| Frontend route / component / API call | [API_CONTRACT.md](docs/engineering/API_CONTRACT.md), [API_FLOW_MAP.md](docs/engineering/API_FLOW_MAP.md), [WORKFLOW_OVERVIEW.md](docs/business/WORKFLOW_OVERVIEW.md), [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md) |
| Permission / role / auth | [PERMISSION_MATRIX.md](docs/engineering/PERMISSION_MATRIX.md), [USER_ROLES.md](docs/business/USER_ROLES.md) |
| Order / payment / refund / inventory / return logic | [BUSINESS_RULES.md](docs/business/BUSINESS_RULES.md), [STATE_MACHINES.md](docs/business/STATE_MACHINES.md), [WORKFLOW_OVERVIEW.md](docs/business/WORKFLOW_OVERVIEW.md), [API_FLOW_MAP.md](docs/engineering/API_FLOW_MAP.md) |
| Deployment / Dockerfile / env / CI | [DEPLOYMENT_GUIDE.md](docs/engineering/DEPLOYMENT_GUIDE.md), [INTEGRATION_GUIDE.md](docs/engineering/INTEGRATION_GUIDE.md) |
| Test / quality gate | [TESTING_GUIDE.md](docs/engineering/TESTING_GUIDE.md), [ACCEPTANCE_CRITERIA.md](docs/business/ACCEPTANCE_CRITERIA.md) |
| Architecture / module ownership | [ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md), [MODULE_CATALOG.md](docs/business/MODULE_CATALOG.md), [PROJECT_OVERVIEW.md](docs/business/PROJECT_OVERVIEW.md) |
| Trace requirement → API → test | [TRACEABILITY_MATRIX.md](docs/engineering/TRACEABILITY_MATRIX.md) |

### Khi docs mâu thuẫn nhau

- `docs/business/` mâu thuẫn `docs/engineering/` → **business docs thắng**, engineering cần sửa.
- `docs/engineering/` mâu thuẫn code → check [DOCS_VERIFICATION_REPORT.md](docs/DOCS_VERIFICATION_REPORT.md) trước; mặc định docs là source of truth nếu chưa có verdict.

### Cấm

- ❌ Sửa code mà không đọc docs liên quan.
- ❌ Đẩy code mà docs không phản ánh thay đổi (trừ refactor nội tại không ảnh hưởng API/contract/data/permission/state/deployment).
- ❌ "Code-first, doc-fix-later" trừ khi user explicitly cho phép.
- ❌ Tự "fix" cái đã được [DOCS_VERIFICATION_REPORT.md](docs/DOCS_VERIFICATION_REPORT.md) Section 3 flag là code bug — đó là task riêng.

---

## Đọc thêm

Full agent operating rules: [AGENTS.md](AGENTS.md) — đặc biệt Section 3 (Required Reading Order) và Section 4 (Source of Truth Map).
