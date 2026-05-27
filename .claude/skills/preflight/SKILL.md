---
name: preflight
description: Chạy trước khi commit/push hoặc mở PR trong repo BigBike. Tự phát hiện sub-project nào đã đổi (web/admin/backend) rồi chạy ĐÚNG bộ check của riêng nó (mirror CI), kiểm tra docs đã update nếu thay đổi chạm contract/data/permission/state, và xuất PR summary đúng format bắt buộc. Gọi bằng /preflight.
---

# /preflight — Cổng kiểm tra trước khi push / mở PR

Mục tiêu: bắt lỗi **trước** khi CI bắt, và đảm bảo repo "more consistent than it found it". Không bao giờ claim một check pass nếu chưa chạy thật.

## Bước 1 — Phát hiện sub-project đã thay đổi

```bash
git status --porcelain
git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only main...HEAD
```

Gộp output, phân loại theo prefix path:

| Prefix path | Sub-project | Có cần chạy gate? |
|---|---|---|
| `bigbike-web/` | web | ✅ |
| `bigbike-admin/` | admin | ✅ |
| `bigbike-backend/` | backend | ✅ |
| `docs/` | docs (local-only) | Không có build gate — xem Bước 3 |
| `bigbike-web/`, root config | có thể cần nếu chạm CI | xét theo file |

Chỉ chạy gate cho sub-project **thật sự có file đổi**. Đừng build cả 3 nếu chỉ sửa 1.

## Bước 2 — Chạy đúng gate cho từng sub-project đã đổi

Bộ check khác nhau giữa các app — **không nhầm**:

```bash
# WEB — có lint + test (vitest) + build
(cd bigbike-web && npm run lint && npm run test && npm run build)

# ADMIN — chỉ có lint + build. KHÔNG có script "test" → đừng chạy npm run test ở admin.
(cd bigbike-admin && npm run lint && npm run build)

# BACKEND — test; package chỉ khi chuẩn bị release
(cd bigbike-backend && ./mvnw test)
```

Lưu ý:
- `npm run lint` ở **web** đã bao gồm `check:no-runtime-business-data`; ở **admin** bao gồm `check:no-admin-runtime-mock`. Đây là guard script CI enforce — fail nghĩa là có business-data/mock hardcode lọt vào runtime.
- Build chậm: nếu chỉ cần phản hồi nhanh, chạy `lint` (+`test`) trước; `build` trước khi push.
- Backend test cần DB; nếu môi trường không sẵn DB, ghi rõ "Not run: backend test cần Postgres" thay vì bịa.

## Bước 3 — Docs-First closure check

Nếu file đã đổi chạm vào **business rule / API shape / data shape / permission / state transition / workflow / deployment**, thì docs liên quan **phải được update trong cùng change**. Đối chiếu nhanh:

- Backend controller/service (endpoint, logic) → `docs/engineering/API_CONTRACT.md`, `docs/business/BUSINESS_RULES.md`
- Entity/DTO/enum/migration → `docs/engineering/DATA_CONTRACT.md`
- State transition → `docs/business/STATE_MACHINES.md`
- Permission/role → `docs/engineering/PERMISSION_MATRIX.md`, `docs/business/USER_ROLES.md`
- Frontend response shape / flow → `API_CONTRACT.md`, `API_FLOW_MAP.md`

Nếu code đổi mà docs **chưa** phản ánh → dừng, update docs trước (hoặc dùng `/docs-first`), rồi mới coi là xong. Docs là local-only (không commit) nhưng vẫn là source of truth — sửa trên đĩa, đừng commit `docs/`.

## Bước 4 — Cảnh báo CI sẽ chặn

CI thật chạy: gitleaks secret scan, secret-artifact-guard (chặn `.env`, `*.jks`, `*.keystore`, `service_account*.json`… bị track), backend mvn test trên Postgres. Trước khi push:
- Không commit `.env` hay secret. `git status` không được có file nhạy cảm mới.
- Nếu sửa text UI / CSS → cân nhắc chạy `/hygiene` (mojibake, dead CSS).

## Bước 5 — Xuất PR summary đúng format bắt buộc

Khi mọi gate xong, in ra theo đúng template (AGENTS.md §17):

```text
Summary:
- <what changed>
- <why>

Files changed:
- <path> — <1 dòng>

Checks:
- npm run lint        (web)        ✅ / ❌ / Not run: <reason>
- npm run test        (web)        ...
- npm run build       (web)        ...
- npm run lint+build  (admin)      ...
- ./mvnw test         (backend)    ...

Notes:
- <migration cần chạy? doc đã update? risk / follow-up>
```

## Quy tắc tuyệt đối

- ❌ Không ghi một check là pass nếu chưa thật sự chạy và thấy kết quả. Skip thì ghi `Not run: <reason>`.
- ❌ Không chạy `npm run test` ở admin (không có script đó).
- ❌ Không tự commit/push trừ khi user yêu cầu.
